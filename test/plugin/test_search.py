import hashlib
import json
from test_presentation import PresentationTests
from bot_web.search import query, context
from bot_web.attachments import AttachmentStore
from bot_web.operations import InvalidOperation


class SearchTests(PresentationTests):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        previous = self.native.call
        async def native(method, params):
            if method == 'bot_web.search':
                if not params['query']:
                    return {'verified': True}
                return {'hits': [{'id': '91', 'text': 'sequoia visible chat message'}], 'canonical': 'root' if params['profile'] == 'default' else 'amy-root'}
            if method == 'cron.manage':
                return {'jobs': [{'job_id': 'r1', 'name': 'sequoia weekly', 'schedule': 'Mondays'}]}
            return await previous(method, params)
        self.native.call = native

    async def test_queries_unopened_chats_and_routines_without_open_resume_or_read_cursor_writes(self):
        before = self.store.read()
        calls = len(self.native.calls)
        result = await query(self.service, None, 'owner', {'query': 'sequoia'})
        self.assertEqual({h['kind'] for h in result['hits']}, {'message', 'routine'})
        self.assertEqual({h['profile'] for h in result['hits']}, {'default', 'amy'})
        self.assertEqual(self.store.read(), before)
        self.assertFalse(any(m in {'session.resume', 'session.create', 'profiles.configure', 'prompt.submit'} for m, _ in self.native.calls[calls:]))
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM read_cursors').fetchone()[0], 2)

    async def test_file_contents_are_bounded_principal_and_incarnation_scoped_and_binary_names_only(self):
        files = AttachmentStore(self.path.parent / 'files')
        try:
            for i, (principal, incarnation, name, content) in enumerate([
                ('owner', 'a'*64, 'notes.md', b'private sequoia notes'),
                ('other', 'a'*64, 'other.md', b'sequoia another principal'),
                ('owner', 'c'*64, 'retired.md', b'sequoia retired profile'),
                ('owner', 'a'*64, 'sequoia.pdf', b'not indexed'),
            ]):
                file_id=str(i)*43
                files.path(file_id).write_bytes(content)
                files.db.execute('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)', (file_id,principal,'default',json.dumps(incarnation),'root',name,'file',len(content),hashlib.sha256(content).hexdigest(),'sent',123))
            files.db.commit()
            result = await query(self.service, files, 'owner', {'query': 'sequoia'})
            found=[h for h in result['hits'] if h['kind']=='file']
            self.assertEqual({h['title'] for h in found}, {'notes.md','sequoia.pdf'})
            self.assertIn('names only', result['coverage'])
        finally:
            files.db.close()

    async def test_hidden_and_recreated_profiles_do_not_return_stale_matches(self):
        self.native.profiles[1]['ui_meta']['hermes-bots']['hidden']=True
        result = await query(self.service, None, 'owner', {'query':'sequoia'})
        self.assertEqual({h['profile'] for h in result['hits']}, {'default'})
        for query_text in ['', 'x'*201]:
            with self.assertRaises(InvalidOperation):
                await query(self.service, None, 'owner', {'query':query_text})

    async def test_exact_context_resolves_saved_message_and_routine_and_rejects_replaced_identity(self):
        bot = self.store.read()['bots']['default']
        target = {'profile': 'default', 'bot_id': bot['id'], 'kind': 'message', 'item_id': '91', 'query': 'sequoia'}
        result = await context(self.service, None, 'owner', target)
        self.assertEqual(result['text'], 'sequoia visible chat message')
        routine = await context(self.service, None, 'owner', {**target, 'kind': 'routine', 'item_id': 'r1'})
        self.assertEqual(routine['text'], 'Mondays')
        with self.assertRaises(InvalidOperation):
            await context(self.service, None, 'owner', {**target, 'bot_id': 'replaced-id'})

    async def test_context_rechecks_hidden_state_after_async_work(self):
        bot = self.store.read()['bots']['default']
        previous = self.native.call
        async def changed(method, params):
            result = await previous(method, params)
            if method == 'cron.manage':
                self.native.profiles[0]['ui_meta']['hermes-bots']['hidden'] = True
            return result
        self.native.call = changed
        with self.assertRaises(InvalidOperation):
            await context(self.service, None, 'owner', {'profile': 'default', 'bot_id': bot['id'], 'kind': 'routine', 'item_id': 'r1', 'query': 'sequoia'})
