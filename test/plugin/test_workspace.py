import base64
import io
import json
from pathlib import Path
import tempfile
import unittest
from test_security import Native
from bot_web.operations import BotOperations, InvalidOperation
from bot_web.workspace import WorkspaceStore, WorkspaceService, normalize_photo


class WorkspaceNative(Native):
    def __init__(self):
        super().__init__()
        self.profiles = [{'name': 'default', 'is_default': True, 'ui_meta': {'hermes-bots': {'title': 'Aurora', 'foreign': {'keep': 1}}}, 'ui_meta_revisions': {'hermes-bots': 3}, 'canonical_session': {'id': 'root'}},
            {'name': 'amy', 'is_default': False, 'ui_meta': {'hermes-bots': {'title': 'Amy'}}, 'canonical_session': {'id': 'amy-root'}}]

    async def call(self, method, params):
        self.calls.append((method, params))
        if method == 'profiles.list':
            return {'bot_mode_protocol': True, 'profiles': json.loads(json.dumps(self.profiles))}
        if method == 'profiles.configure':
            row = next(r for r in self.profiles if r['name'] == params['name'])
            row['ui_meta'].update(params['ui_meta'])
            return {'applied': {'ui_meta': True, 'description': True}}
        if method == 'session.list':
            return {'sessions': [{'id': 'root', 'title': 'Bot Chat'}]}
        return {}


class WorkspaceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'workspace.sqlite'
        self.store = WorkspaceStore(self.path)
        self.native = WorkspaceNative()
        self.service = WorkspaceService(BotOperations(self.native), self.store)
        detection = await self.service.invoke('workspace.detect_primary', {})
        self.assertEqual(detection['profile'], 'default')
        self.assertEqual(detection['bot']['name'], 'Aurora')
        await self.service.invoke('workspace.initialize', {'profile': 'default', 'handle': 'aurora', 'appearance': {'kind': 'shape', 'shape': 'petal', 'color': 'white'}, 'photo': None, 'expected_revision': detection['revision']})

    async def asyncTearDown(self):
        self.store.db.close()
        self.directory.cleanup()

    async def test_durable_identity_and_metadata_merge_preserve_unknown_native_fields(self):
        state = self.store.read()
        self.assertEqual(self.native.profiles[0]['ui_meta']['hermes-bots']['foreign'], {'keep': 1})
        await self.service.invoke('bots.update_handle', {'profile': 'default', 'handle': 'lead', 'expected_revision': state['revision']})
        reopened = WorkspaceStore(self.path)
        self.assertEqual(reopened.read()['bots']['default']['id'], state['bots']['default']['id'])
        self.assertEqual(reopened.read()['aliases']['aurora'], 'default')
        reopened.db.close()
        self.assertFalse(any(method == 'prompt.submit' for method, _ in self.native.calls))

    async def test_stale_revision_and_native_identity_collisions_are_rejected(self):
        state = self.store.read()
        for handle in ('amy', 'admin', 'bad handle'):
            with self.assertRaises(InvalidOperation):
                await self.service.invoke('bots.update_handle', {'profile': 'default', 'handle': handle, 'expected_revision': state['revision']})
        with self.assertRaises(InvalidOperation):
            await self.service.invoke('bots.update_handle', {'profile': 'default', 'handle': 'safe', 'expected_revision': -1})

    async def test_extended_appearance_catalogue_survives_restart_without_changing_identity(self):
        original = self.store.read()['bots']['default']
        for shape, color in zip(('cairn', 'seed', 'dune', 'flint', 'drift'),
                                ('umber', 'moss', 'ocean', 'heather', 'sienna')):
            state = self.store.read()
            look = {'kind': 'shape', 'shape': shape, 'color': color}
            await self.service.invoke('bots.appearance.update', {
                'profile': 'default', 'appearance': look, 'photo': None,
                'expected_revision': state['revision']})
            reopened = WorkspaceStore(self.path)
            saved = reopened.read()['bots']['default']
            self.assertEqual(saved['appearance'], look)
            self.assertEqual(saved['id'], original['id'])
            self.assertEqual(saved['handle'], original['handle'])
            self.assertEqual(saved['role'], original['role'])
            reopened.db.close()
        self.assertFalse(any(method == 'prompt.submit' for method, _ in self.native.calls))

    async def test_reporting_cycle_is_rejected_and_teams_do_not_grant_permissions(self):
        state = self.store.read()
        role = state['bots']['amy']['role']
        with self.assertRaises(InvalidOperation):
            await self.service.invoke('roles.update', {'profile': 'amy', 'role': role, 'manager': 'amy', 'team': None, 'expected_revision': state['revision']})
        saved = await self.service.invoke('teams.save', {'teams': [{'id': 'team-1', 'name': 'Research'}], 'expected_revision': state['revision']})
        self.assertNotIn('grants', saved)
        self.assertEqual(saved['orchestrator'], 'default')

    async def test_model_proposal_cannot_execute_and_approval_binds_exact_spec(self):
        request_id, status = self.store.request('amy', 'agent.enable', {'profile': 'amy', 'initialize_chat': True})
        self.assertEqual(status, 'pending')
        request = self.store.requests()[0]
        before = len(self.native.calls)
        with self.assertRaises(InvalidOperation):
            await self.service.invoke('requests.approve', {'id': request_id, 'fingerprint': 'wrong'})
        self.assertTrue(all(method in {'profiles.list', 'bot_web.models', 'bot_web.identities'} for method, _ in self.native.calls[before:]))
        denied = await self.service.invoke('requests.deny', {'id': request_id, 'fingerprint': request['fingerprint']})
        self.assertEqual(denied['state'], 'denied')
        with self.assertRaises(InvalidOperation):
            await self.service.invoke('requests.approve', {'id': request_id, 'fingerprint': request['fingerprint']})

    def test_photo_decoder_rejects_active_and_oversized_content(self):
        for value in ('https://example.test/photo.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YmFk'):
            with self.assertRaises(InvalidOperation):
                normalize_photo(value)

    def test_photo_reencoded_as_metadata_free_bounded_raster(self):
        from PIL import Image, PngImagePlugin
        source = io.BytesIO()
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text('private', 'synthetic GPS/filename marker')
        Image.new('RGB', (64, 32), 'red').save(source, format='PNG', pnginfo=metadata)
        normalized = normalize_photo('data:image/png;base64,' + base64.b64encode(source.getvalue()).decode())
        with Image.open(io.BytesIO(base64.b64decode(normalized.split(',')[1]))) as image:
            self.assertEqual(image.size, (512, 512))
            self.assertEqual(image.info, {})
