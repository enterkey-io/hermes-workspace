"""Zero-prompt builtin provider grant with explicit native profile/secret scopes."""
import asyncio
import json
import os
import shutil
from pathlib import Path
import sys
import tempfile
from native_smoke import load_plugin
ROOT=Path(__file__).resolve().parents[2]

async def verify(home):
    from bot_web.native import NativeGateway
    from hermes_cli.profiles import get_profile_dir
    gateway=NativeGateway()
    await gateway.start()
    try:
        created=await gateway.call('profiles.create',{'name':'grant-target','no_alias':True,'no_skills':True,'mirror_credentials':False})
        assert created['ok']
        # Register/activate the secondary profile first: modern Hermes must still read
        # the source credential under its own explicit secret scope afterwards.
        await gateway.call('bot_web.runtime.prepare',{'profile':'grant-target'})
        info=await gateway.call('bot_web.models',{'action':'describe'})
        assert info['supported'] and info['provider']=='ollama-cloud',info
        granted=await gateway.call('bot_web.models',{'action':'grant','profile':'grant-target','expected':info['fingerprint']})
        assert granted['configured']
        target=Path(get_profile_dir('grant-target'))
        content=(target/'.env').read_text()
        assert 'OLLAMA_API_KEY=synthetic-selected-key' in content
        assert 'UNRELATED_TEST_KEY' not in content and 'synthetic-unrelated' not in content
        assert 'synthetic-selected-key' not in json.dumps(info)+json.dumps(granted)
        print(json.dumps({'model_grant':'pass','revision':gateway.build['revision'],'provider':'ollama-cloud','scope_isolation':'pass','unrelated_credentials':'not_copied','secret_returned_to_browser':False,'model_calls':0}))
    finally:
        await gateway.stop()

with tempfile.TemporaryDirectory(prefix='workspace-grant-')as directory:
    home=Path(directory)/'home';home.mkdir()
    os.environ.clear();os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin',HERMES_HOME=str(home),HERMES_RUNTIME_DIR=str(Path(directory)/'runtime'),PYTHONPYCACHEPREFIX=str(Path(directory)/'pycache'),HERMES_NO_AUTO_INSTALL='1')
    (home/'.env').write_text('OLLAMA_API_KEY=synthetic-selected-key\nUNRELATED_TEST_KEY=synthetic-unrelated\n')
    shutil.copytree(ROOT / 'plugins/bot-web', home / 'plugins/bot-web', ignore=shutil.ignore_patterns('__pycache__'))
    (home/'config.yaml').write_text('model:\n  provider: ollama-cloud\n  default: glm-5.3-flash\nagent:\n  bot_mode_protocol: true\nplugins:\n  enabled: [bot-web]\n  entries:\n    bot-web:\n      enabled: true\n')
    load_plugin(ROOT);asyncio.run(verify(home))
