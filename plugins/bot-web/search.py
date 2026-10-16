"""Bounded owner-local search. No transcript index or browser-controlled paths."""
import json
from pathlib import Path
from .operations import InvalidOperation, fields
from .native import NativeError

TEXT_TYPES = {'.txt', '.md', '.csv', '.json', '.yaml', '.yml', '.log', '.py', '.js', '.ts', '.tsx', '.css', '.html'}


def snippet(text, query):
    text = ' '.join(str(text).split())
    at = text.casefold().find(query.casefold())
    start = max(0, at - 60)
    return ('…' if start else '') + text[start:start+240] + ('…' if len(text) > start+240 else '')


async def query(service, attachments, principal, params):
    fields(params, ['query'])
    needle = params['query']
    if not isinstance(needle, str) or not 1 <= len(needle.strip()) <= 200:
        raise InvalidOperation('Search needs 1–200 characters')
    needle = needle.strip()
    state = service.store.read()
    profiles = (await service.ops.gateway.call('profiles.list', {'include_sessions': False})).get('profiles', [])
    allowed = {}
    hits, incomplete = [], set()
    for row in profiles:
        meta = row.get('ui_meta', {}).get('hermes-bots')
        bot = state['bots'].get(row['name'])
        if not bot or not bot.get('available') or not isinstance(meta, dict) or meta.get('hidden') or not bot.get('native_incarnation'):
            continue
        name = meta.get('title') or row.get('display_name') or row['name']
        try:
            result = await service.ops.gateway.call('bot_web.search', {'profile': row['name'], 'incarnation': bot['native_incarnation'], 'query': needle})
        except NativeError:
            incomplete.add('some chats unavailable')
            continue
        canonical = result.get('canonical')
        allowed[row['name']] = (bot, name, canonical)
        if result.get('limited'):
            incomplete.add('some chat results limited')
        title = ' '.join([str(name), '@'+bot['handle'], bot['role']['title'], bot['role']['description']])
        if needle.casefold() in title.casefold():
            hits.append({'id': 'pebble:'+bot['id'], 'kind': 'pebble', 'title': str(name), 'snippet': '@'+bot['handle']+' · '+bot['role']['title'], 'profile': row['name']})
        for m in result.get('hits', []):
            hits.append({'id': 'message:'+bot['id']+':'+str(m['id']), 'kind': 'message', 'title': str(name)+' · message', 'snippet': snippet(m['text'], needle), 'profile': row['name'], 'item_id': str(m['id']), 'bot_id': bot['id']})
        try:
            routines = await service.ops.gateway.call('cron.manage', {'profile': row['name'], 'action': 'list', 'include_disabled': True})
            for r in routines.get('jobs', []):
                title = str(r.get('name') or 'Routine')
                schedule = str(r.get('schedule_display') or r.get('schedule') or '')
                if needle.casefold() in (title+' '+schedule).casefold():
                    hits.append({'id': 'routine:'+bot['id']+':'+str(r.get('id') or r.get('job_id')), 'kind': 'routine', 'title': title, 'snippet': str(name)+' · '+schedule, 'profile': row['name'], 'item_id': str(r.get('id') or r.get('job_id')), 'bot_id': bot['id']})
        except NativeError:
            incomplete.add('some routines unavailable')
    # Native rooms are read directly; discovery never opens a profile session.
    offset = 0
    for _ in range(10):
        page = await service.ops.gateway.call('groups.list', {'limit': 100, 'offset': offset})
        for room in page.get('rooms', []):
            members = room.get('members', [])
            if not members or any(m.get('profile') not in allowed for m in members):
                continue
            title = str(room.get('name') or 'Crew')
            if needle.casefold() in title.casefold():
                hits.append({'id': 'crew:'+room['room_id'], 'kind': 'crew', 'title': title, 'snippet': 'Group chat', 'room': room})
            seq = 0
            for _ in range(20):
                log = await service.ops.invoke('room.log', {'room_id': room['room_id'], 'since_seq': seq})
                events = log.get('events', [])
                for e in events:
                    text = e.get('payload', {}).get('text')
                    if e.get('kind') in {'message.user', 'message.member'} and isinstance(text, str) and needle.casefold() in text.casefold():
                        hits.append({'id': 'room-message:'+room['room_id']+':'+str(e.get('event_id') or e.get('seq')), 'kind': 'message', 'title': title+' · message', 'snippet': snippet(text, needle), 'room': room, 'item_id': str(e.get('event_id') or e.get('seq'))})
                next_seq = max([seq]+[e.get('seq', 0) for e in events])
                if len(events) < 100 or next_seq <= seq:
                    break
                seq = next_seq
            else:
                incomplete.add('some older crew messages limited')
        if page.get('next_offset') is None:
            break
        offset = page['next_offset']
    else:
        incomplete.add('some crews limited')
    if attachments:
        budget = 8*1024*1024
        rows = attachments.db.execute("SELECT id,profile,incarnation,canonical,name,kind,size,digest,state FROM files WHERE principal=? AND state='sent' ORDER BY created DESC LIMIT 501", (principal,)).fetchall()
        if len(rows) > 500:
            incomplete.add('some older files limited')
        for values in rows[:500]:
            f = dict(zip(('id','profile','incarnation','canonical','name','kind','size','digest','state'), values))
            current = allowed.get(f['profile'])
            if not current or f['incarnation'] != json.dumps(current[0]['native_incarnation'], sort_keys=True) or f['canonical'] != current[2]:
                continue
            supported = Path(f['name']).suffix.lower() in TEXT_TYPES and f['size'] <= 512*1024
            text = ''
            if supported and budget >= f['size']:
                try:
                    text = attachments.read(f).decode('utf-8')
                    budget -= f['size']
                except (UnicodeError, InvalidOperation):
                    supported = False
            elif supported:
                incomplete.add('some file contents limited')
            if needle.casefold() in (f['name']+' '+text).casefold():
                hits.append({'id':'file:'+f['id'], 'kind':'file', 'title':f['name'], 'snippet': str(current[1])+' · '+(snippet(text, needle) if text else 'Filename match'), 'profile': f['profile'], 'item_id': f['id'], 'bot_id': current[0]['id']})
    # Recheck metadata after the asynchronous work; a removed/replaced/hidden
    # profile must not leave stale results in this response.
    latest = {r['name']: r for r in (await service.ops.gateway.call('profiles.list', {'include_sessions': False})).get('profiles', [])}
    fresh = service.store.read()
    permitted = {name for name,(b,_,_) in allowed.items() if name in latest and latest[name].get('ui_meta', {}).get('hermes-bots', {}).get('hidden') is not True and fresh['bots'].get(name, {}).get('id') == b['id'] and latest[name].get('ui_meta', {}).get('pebble-crew', {}).get('incarnation') == b['native_incarnation']}
    for name in list(permitted):
        try:
            verified = await service.ops.gateway.call('bot_web.search', {'profile': name, 'incarnation': allowed[name][0]['native_incarnation'], 'query': ''})
            if verified.get('verified') is not True:
                permitted.discard(name)
        except NativeError:
            permitted.discard(name)
    hits = [h for h in hits if h.get('profile') in permitted or (h.get('room') and all(m.get('profile') in permitted for m in h['room']['members']))]
    coverage = 'Your Hermes · chats, routines and files. PDF, image and other binary files: names only.'
    if incomplete or len(hits) > 100:
        coverage += ' Limited: '+', '.join(sorted(incomplete | ({'first 100 matches'} if len(hits)>100 else set())))+'.'
    return {'hits': hits[:100], 'coverage': coverage}


async def verified_context(service, targets, result):
    rows = {r['name']: r for r in (await service.ops.gateway.call('profiles.list', {'include_sessions': False})).get('profiles', [])}
    current = service.store.read()
    for profile, expected in targets.items():
        bot = current['bots'].get(profile)
        meta = rows.get(profile, {}).get('ui_meta', {}).get('hermes-bots')
        if not bot or not bot.get('available') or bot['id'] != expected['id'] or bot.get('native_incarnation') != expected.get('native_incarnation') or not isinstance(meta, dict) or meta.get('hidden'):
            raise InvalidOperation('Search target changed')
        native = await service.ops.gateway.call('bot_web.search', {'profile': profile, 'incarnation': bot['native_incarnation'], 'query': ''})
        if native.get('verified') is not True:
            raise InvalidOperation('Search target changed')
    return result


async def context(service, attachments, principal, params):
    if params.get('kind') == 'room-message':
        fields(params, ['kind', 'room_id', 'created_at', 'item_id'])
        found = await service.ops.invoke('room.state', {'room_id': params['room_id']})
        room = found.get('room', {})
        if str(room.get('created_at')) != params['created_at'] or not isinstance(params['item_id'], str) or len(params['item_id']) > 128:
            raise InvalidOperation('Search room changed')
        current = service.store.read()
        roster = {r['name']: r for r in (await service.ops.gateway.call('profiles.list', {'include_sessions': False})).get('profiles', [])}
        members = room.get('members', [])
        if not isinstance(members, list) or not members:
            raise InvalidOperation('Search room unavailable')
        targets = {}
        for member in members:
            profile = member.get('profile')
            bot = current['bots'].get(profile)
            meta = roster.get(profile, {}).get('ui_meta', {}).get('hermes-bots')
            if not bot or not bot.get('available') or not isinstance(meta, dict) or meta.get('hidden'):
                raise InvalidOperation('Search room unavailable')
            targets[profile] = bot
        seq = 0
        for _ in range(20):
            page = await service.ops.invoke('room.log', {'room_id': params['room_id'], 'since_seq': seq})
            events = page.get('events', [])
            for e in events:
                if str(e.get('event_id') or e.get('seq')) == params['item_id'] and e.get('kind') in {'message.user', 'message.member'} and isinstance(e.get('payload', {}).get('text'), str):
                    return await verified_context(service, targets, {'title': str(room.get('name') or 'Crew')+' · message', 'text': e['payload']['text'][:100000]})
            next_seq = max([seq]+[e.get('seq', 0) for e in events])
            if len(events) < 100 or next_seq <= seq:
                break
            seq = next_seq
        raise InvalidOperation('Search message unavailable')
    fields(params, ['profile', 'bot_id', 'kind', 'item_id', 'query'])
    if not isinstance(params['profile'], str) or not isinstance(params['bot_id'], str) or params['kind'] not in {'message', 'file', 'routine'} or not isinstance(params['query'], str) or not 1 <= len(params['query']) <= 200 or not isinstance(params['item_id'], str) or len(params['item_id']) > 128:
        raise InvalidOperation('Invalid search target')
    state = service.store.read()
    bot = state['bots'].get(params['profile'])
    if not bot or not bot.get('available') or bot['id'] != params['bot_id'] or not bot.get('native_incarnation'):
        raise InvalidOperation('Search target changed')
    rows = (await service.ops.gateway.call('profiles.list', {'include_sessions': False})).get('profiles', [])
    profile = next((r for r in rows if r['name'] == params['profile']), None)
    meta = profile.get('ui_meta', {}).get('hermes-bots') if profile else None
    if not isinstance(meta, dict) or meta.get('hidden'):
        raise InvalidOperation('Search target unavailable')
    native = await service.ops.gateway.call('bot_web.search', {'profile': params['profile'], 'incarnation': bot['native_incarnation'], 'query': params['query']})
    title = str(meta.get('title') or params['profile'])
    if params['kind'] == 'message':
        match = next((m for m in native.get('hits', []) if str(m['id']) == params['item_id']), None)
        if not match:
            raise InvalidOperation('Search message no longer visible')
        return await verified_context(service, {params['profile']: bot}, {'title': title+' · message', 'text': match['text']})
    if params['kind'] == 'routine':
        result = await service.ops.gateway.call('cron.manage', {'profile': params['profile'], 'action': 'list', 'include_disabled': True})
        match = next((r for r in result.get('jobs', []) if str(r.get('id') or r.get('job_id')) == params['item_id']), None)
        if not match:
            raise InvalidOperation('Routine no longer available')
        return await verified_context(service, {params['profile']: bot}, {'title': str(match.get('name') or 'Routine'), 'text': str(match.get('schedule_display') or match.get('schedule') or '')})
    if not attachments:
        raise InvalidOperation('File unavailable')
    target = (params['profile'], json.dumps(bot['native_incarnation'], sort_keys=True), native.get('canonical'))
    row = attachments.row(params['item_id'], principal, target)
    if row['state'] != 'sent':
        raise InvalidOperation('File unavailable')
    if Path(row['name']).suffix.lower() not in TEXT_TYPES or row['size'] > 512*1024:
        return await verified_context(service, {params['profile']: bot}, {'title': row['name'], 'text': 'Open the conversation’s Files tab to download this file.'})
    try:
        return await verified_context(service, {params['profile']: bot}, {'title': row['name'], 'text': attachments.read(row).decode('utf-8')})
    except UnicodeError:
        return await verified_context(service, {params['profile']: bot}, {'title': row['name'], 'text': 'Open the conversation’s Files tab to download this file.'})
