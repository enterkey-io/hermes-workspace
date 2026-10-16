"""Owner-local organization. Native rooms and reporting are never inferred from a Crew."""
import json
from .operations import InvalidOperation, identifier, fields

async def save(service, params):
    from .workspace import bounded
    fields(params, ['id', 'name', 'members', 'remove', 'operation_id', 'expected_revision'])
    crew_id, operation_id = identifier(params['id']), identifier(params['operation_id'])
    name = bounded(params['name'], 80, False)
    if type(params['remove']) is not bool or not isinstance(params['members'], list) or len(params['members']) > 1000:
        raise InvalidOperation('Invalid crew membership')
    members = [identifier(p) for p in params['members']]
    if len(set(members)) != len(members):
        raise InvalidOperation('Duplicate crew member')
    db = service.store.db
    db.execute('CREATE TABLE IF NOT EXISTS crew_changes(id TEXT PRIMARY KEY,spec TEXT NOT NULL,state TEXT NOT NULL)')
    spec = json.dumps(params, sort_keys=True)
    previous = db.execute('SELECT spec,state FROM crew_changes WHERE id=?', (operation_id,)).fetchone()
    if previous:
        if previous[0] != spec:
            raise InvalidOperation('Review the saved crew before making another change')
        return {'state': previous[1]}
    state = service.store.read()
    if state['revision'] != params['expected_revision']:
        raise InvalidOperation('Crew changed; reopen it before saving', 'STALE_REVISION')
    if any(p not in state['bots'] or not state['bots'][p].get('available', True) or not state['bots'][p].get('enrolled') for p in members):
        raise InvalidOperation('Choose available pebbles')
    existing = next((t for t in state['teams'] if t['id'] == crew_id), None)
    if params['remove'] and not existing:
        raise InvalidOperation('Crew no longer exists')
    with db:
        db.execute('INSERT INTO crew_changes VALUES(?,?,?)', (operation_id, spec, 'uncertain'))
    try:
        if not params['remove']:
            teams = [dict(t, name=name) if t['id'] == crew_id else t for t in state['teams']]
            if not existing:
                teams.append({'id': crew_id, 'name': name})
            await service._invoke('teams.save', {'teams': teams, 'expected_revision': state['revision']})
        for profile, bot in state['bots'].items():
            destination = crew_id if profile in members and not params['remove'] else None if bot.get('team') == crew_id else bot.get('team')
            if destination == bot.get('team'):
                continue
            current = service.store.read()
            await service._invoke('roles.update', {'profile': profile, 'role': bot['role'], 'manager': bot.get('manager'), 'team': destination, 'expected_revision': current['revision']})
        if params['remove']:
            current = service.store.read()
            await service._invoke('teams.save', {'teams': [t for t in current['teams'] if t['id'] != crew_id], 'expected_revision': current['revision']})
        status = 'completed'
    except Exception:
        # Some per-profile native CAS writes may have committed. Never replay them automatically.
        status = 'partial'
    with db:
        db.execute('UPDATE crew_changes SET state=? WHERE id=?', (status, operation_id))
    return {'state': status, 'id': crew_id}
