"""Verify first native Bot Mode setup in an isolated home, without model turns."""

import asyncio
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/fixture'))
from native_smoke import Model, load_plugin

async def verify():
    from bot_web.native import NativeGateway
    from bot_web.operations import BotOperations
    native = NativeGateway()
    await native.start()
    try:
        ops = BotOperations(native)
        assert (await ops.invoke('bots.list', {}))['bots'] == []
        created = await native.call('profiles.create', {'name': 'starter', 'no_alias': True, 'no_skills': True})
        assert created['ok'] is True
        marked = await native.call('profiles.configure', {'name': 'starter', 'ui_meta': {'hermes-bots': {'title': 'Assistant'}}})
        assert marked['applied']['ui_meta'] is True
        lookup = {'profile': 'starter', 'title': 'Bot Chat', 'include_hidden': True, 'limit': 100}
        assert (await native.call('session.list', lookup))['sessions'] == []
        session = await native.call('session.create', {'profile': 'starter', 'title': 'Bot Chat', 'hidden': True, 'follow_profile_config': True})
        await native.call('session.title', {'session_id': session['session_id'], 'title': 'Bot Chat'})
        roster = await ops.invoke('bots.list', {})
        assert len(roster['bots']) == 1 and roster['bots'][0]['canonical'] is True
        existing = (await native.call('session.list', lookup))['sessions']
        assert len(existing) == 1
        opened = await ops.invoke('bot.open', {'profile': 'starter'})
        assert opened['canonical_id'] == existing[0]['id']
        assert not opened['messages']
        assert Model.turns == 0
        print(json.dumps({'native_bootstrap': 'pass', 'revision': native.build['revision'], 'model_turns': Model.turns, 'canonical_reuse': 'pass'}))
    finally:
        await native.stop()

with tempfile.TemporaryDirectory(prefix='workspace-bootstrap-') as directory:
    home = Path(directory) / 'home'
    home.mkdir()
    os.environ.clear()
    os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin', HERMES_HOME=str(home),
        HERMES_RUNTIME_DIR=str(Path(directory) / 'runtime'), PYTHONPYCACHEPREFIX=str(Path(directory) / 'pycache'),
        PYTHONUNBUFFERED='1', NO_PROXY='127.0.0.1,localhost', HERMES_NO_AUTO_INSTALL='1')
    model = ThreadingHTTPServer(('127.0.0.1', 0), Model)
    threading.Thread(target=model.serve_forever, daemon=True).start()
    (home / '.env').write_text('# No personal credentials\n')
    (home / 'config.yaml').write_text('model:\n  default: fixture-model\n  provider: custom:fixture\nproviders:\n  fixture:\n    base_url: http://127.0.0.1:' + str(model.server_port) + '/v1\n    api_key: fixture-only\nagent:\n  max_turns: 3\n  bot_mode_protocol: true\napprovals:\n  mode: manual\n')
    load_plugin(ROOT)
    try:
        asyncio.run(verify())
    finally:
        model.shutdown()
