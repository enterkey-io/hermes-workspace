from copy import deepcopy
from test_presentation import PresentationTests
from bot_web.operations import InvalidOperation
from bot_web.native import NativeError
from bot_web.workspace import WorkspaceStore, WorkspaceService
from bot_web.operations import BotOperations


class OrganizationTests(PresentationTests):
    async def test_layout_reorder_and_collapse_persist_without_rewriting_native_roles_or_pin_order(self):
        original = deepcopy(self.store.read())
        org = await self.service.invoke('organization.get', {})
        changed = {'sections': list(reversed(org['sections'])), 'crews': org['crews']}
        changed['sections'][0]['collapsed'] = True
        before = len(self.native.calls)
        saved = await self.service.invoke('organization.save', {'organization': changed, 'expected_revision': org['revision']})
        self.assertEqual(saved['revision'], 1)
        self.assertEqual(self.store.read()['bots'], original['bots'])
        self.assertFalse(any(m == 'profiles.configure' for m, _ in self.native.calls[before:]))
        reopened = WorkspaceStore(self.path)
        service = WorkspaceService(BotOperations(self.native), reopened)
        self.assertEqual(await service.invoke('organization.get', {}), saved)
        reopened.db.close()
        with self.assertRaises(InvalidOperation):
            await self.service.invoke('organization.save', {'organization': changed, 'expected_revision': 0})

    async def test_duplicate_foreign_and_missing_identity_placements_are_rejected(self):
        org = await self.service.invoke('organization.get', {})
        for mode in ['duplicate', 'foreign', 'missing']:
            changed = deepcopy({'sections': org['sections'], 'crews': org['crews']})
            items = changed['sections'][0]['items']
            if mode == 'duplicate':
                items.append(deepcopy(items[0]))
            elif mode == 'foreign':
                items.append({'kind': 'pebble', 'id': 'not-on-this-install'})
            else:
                items.pop()
            with self.assertRaises(InvalidOperation):
                await self.service.invoke('organization.save', {'organization': changed, 'expected_revision': org['revision']})

    async def test_native_crew_chat_is_reused_and_never_mutates_existing_members(self):
        org = await self.service.invoke('organization.get', {})
        ids = [b['id'] for b in self.store.read()['bots'].values()]
        changed = {'sections': [{**s, 'items': [{'kind': 'crew', 'id': 'crew-a'}] if s['id'] == 'crews' else []} for s in org['sections']],
                   'crews': [{'id': 'crew-a', 'name': 'Research', 'purpose': '', 'collapsed': False, 'members': ids}]}
        saved = await self.service.invoke('organization.save', {'organization': changed, 'expected_revision': 0})
        rooms, creates = {}, []
        previous = self.native.call
        async def native(method, params):
            if method == 'groups.state':
                if params['room_id'] not in rooms:
                    raise NativeError('not found')
                return {'room': rooms[params['room_id']]}
            if method == 'groups.create':
                creates.append(deepcopy(params))
                rooms[params['room_id']] = {**params, 'created_at': 123}
                return {'room': rooms[params['room_id']]}
            return await previous(method, params)
        self.native.call = native
        params = {'id': 'crew-a', 'expected_revision': saved['revision'], 'confirm_new': False}
        first = await self.service.invoke('organization.chat', params)
        again = await self.service.invoke('organization.chat', params)
        self.assertEqual(first, again)
        self.assertEqual(len(creates), 1)
        self.assertEqual(len(first['room']['members']), 2)
        self.assertFalse(any(m == 'prompt.submit' for m, _ in self.native.calls))

    async def test_builtin_sections_reject_wrong_item_types_renames_and_removal(self):
        org = await self.service.invoke('organization.get', {})
        for action in ['wrong-kind', 'rename', 'remove']:
            changed = deepcopy({'sections': org['sections'], 'crews': org['crews']})
            pebbles = next(s for s in changed['sections'] if s['id'] == 'pebbles')
            crews = next(s for s in changed['sections'] if s['id'] == 'crews')
            if action == 'wrong-kind': crews['items'].append(pebbles['items'].pop())
            elif action == 'rename': crews['name'] = 'Random'
            else: changed['sections'].remove(crews)
            with self.assertRaises(InvalidOperation):
                await self.service.invoke('organization.save', {'organization': changed, 'expected_revision': org['revision']})

    async def test_legacy_misplaced_items_and_builtin_labels_are_repaired_without_losing_ids(self):
        org = await self.service.invoke('organization.get', {})
        original = deepcopy(org)
        org['sections'][1]['name'] = 'Previously renamed'
        org['sections'][1]['items'].append(org['sections'][0]['items'].pop())
        import json
        self.store.db.execute("INSERT OR REPLACE INTO presentation VALUES('organization',?)", (json.dumps(org),))
        repaired = await self.service.invoke('organization.get', {})
        self.assertEqual(repaired['sections'][1]['name'], 'Crews')
        self.assertEqual({i['id'] for i in repaired['sections'][0]['items']}, {i['id'] for i in original['sections'][0]['items']})
        self.assertEqual(repaired['sections'][1]['items'], [])
