"""Compatibility labels are advisory; complete tested code bundles remain mandatory."""
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
import importlib.util
import sys
import tempfile
import unittest
from unittest.mock import patch, AsyncMock, Mock
import asyncio
import json

ROOT = Path(__file__).resolve().parents[2]
if 'bot_web' not in sys.modules:
    spec = importlib.util.spec_from_file_location('bot_web', ROOT / 'plugins/bot-web/__init__.py',
        submodule_search_locations=[str(ROOT / 'plugins/bot-web')])
    module = importlib.util.module_from_spec(spec)
    sys.modules['bot_web'] = module
    spec.loader.exec_module(module)
from bot_web.compatibility import inspect_native_adapter, check_native_adapter
from bot_web.native import NativeGateway


class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.files = {'session.py': b'tested session', 'prompt.py': b'tested prompt'}
        for name, content in self.files.items():
            (self.root / name).write_bytes(content)
        first = {'version': 'tested-a', 'revision': 'a'*40, 'server_requests': False,
                 'files': {name: sha256(content).hexdigest() for name, content in self.files.items()}}
        second = {'version': 'tested-b', 'revision': 'b'*40, 'server_requests': True,
                  'files': {name: sha256(content+b'2').hexdigest() for name, content in self.files.items()}}
        for patcher in [patch('bot_web.compatibility.SUPPORTED_BUILDS', [first, second]),
                        patch('bot_web.compatibility.find_spec', return_value=SimpleNamespace(submodule_search_locations=[str(self.root)]))]:
            patcher.start(); self.addCleanup(patcher.stop)

    def test_docker_zero_package_version_does_not_reject_tested_code(self):
        with patch('bot_web.compatibility.version', return_value='0.0.0'):
            result = check_native_adapter()
        self.assertEqual(result['distribution_version'], '0.0.0')
        self.assertEqual(result['revision'], 'a'*40)

    def test_version_string_cannot_authorize_untested_code(self):
        (self.root / 'prompt.py').write_bytes(b'untested code')
        with patch('bot_web.compatibility.version', return_value='0.21.7'):
            self.assertFalse(inspect_native_adapter()['supported'])
            with self.assertRaises(RuntimeError): check_native_adapter()

    def test_files_from_different_tested_bundles_cannot_be_mixed(self):
        (self.root / 'prompt.py').write_bytes(self.files['prompt.py']+b'2')
        with patch('bot_web.compatibility.version', return_value='0.0.0'):
            self.assertFalse(inspect_native_adapter()['supported'])

    def test_missing_file_is_an_unsupported_report(self):
        (self.root / 'session.py').unlink()
        result = inspect_native_adapter()
        self.assertFalse(result['supported'])
        self.assertIsNone(result['fingerprints']['session.py'])


class ServerRequestTests(unittest.IsolatedAsyncioTestCase):
    async def test_pending_approval_replay_and_cancellation_reach_the_same_session(self):
        native = NativeGateway()
        queue = asyncio.Queue()
        native.listeners.add(queue)
        request = {'id': 'srq-123456789abc', 'method': 'approval',
                   'params': {'session_id': 'live-alpha', 'request_id': 'exact-approval'}}
        frames = [json.dumps({'id': 'resume-1', 'result': {'session_id': 'live-alpha', 'open_requests': [request]}}).encode(),
                  json.dumps({'method': 'event', 'params': {'type': 'request.cancel', 'session_id': 'live-alpha',
                              'payload': {'method': 'approval', 'id': request['id']}}}).encode()]
        finish = asyncio.Event()
        async def readline():
            if frames:
                return frames.pop(0)
            await finish.wait()
            return b''
        native.process = SimpleNamespace(stdout=SimpleNamespace(readline=readline),
                                         returncode=0)
        result = asyncio.get_running_loop().create_future()
        native.pending['resume-1'] = result
        reader = asyncio.create_task(native._read())
        try:
            for _ in range(2):
                event = await asyncio.wait_for(queue.get(), timeout=2)
                self.assertEqual(event['type'], 'approval.request')
                self.assertEqual(event['session_id'], 'live-alpha')
            self.assertEqual(result.result()['session_id'], 'live-alpha')
        finally:
            finish.set()
            await reader

    async def test_approval_notification_preserves_native_session_and_identity(self):
        native = NativeGateway()
        queue = asyncio.Queue()
        native.listeners.add(queue)
        await native._server_request({'id': 'srq-123456789abc', 'method': 'approval',
            'params': {'session_id': 'live-alpha', 'request_id': 'exact-approval', 'command': 'native redacted command'}})
        self.assertEqual(await queue.get(), {'type': 'approval.request', 'session_id': 'live-alpha',
            'payload': {'request_id': 'exact-approval'}})
        self.assertIsNone(native.process)  # No synthesized approval response was sent.

    async def test_unsupported_secret_request_is_declined_without_an_answer(self):
        native = NativeGateway()
        stdin = SimpleNamespace(write=Mock(), drain=AsyncMock())
        native.process = SimpleNamespace(stdin=stdin)
        await native._server_request({'id': 'srq-123456789abc', 'method': 'secret',
            'params': {'session_id': 'live-alpha', 'prompt': 'Private value'}})
        reply = json.loads(stdin.write.call_args.args[0])
        self.assertEqual(reply['id'], 'srq-123456789abc')
        self.assertEqual(reply['error']['code'], -32601)
        self.assertNotIn('result', reply)
        self.assertNotIn('Private value', str(reply))
