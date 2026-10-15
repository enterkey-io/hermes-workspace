"""Real native enrollment of existing profiles, identity preservation and persona use."""
import asyncio
from http.server import ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading

from native_smoke import Model, load_plugin

ROOT = Path(__file__).resolve().parents[2]
PERSONA = "SYNTHETIC_ARCHIVIST_PERSONA_42"


class PersonaModel(Model):
    requests = []

    def do_POST(self):
        payload = self.rfile.read(int(self.headers["Content-Length"]))
        self.requests.append(json.loads(payload))
        self.rfile = io.BytesIO(payload)
        super().do_POST()


async def verify():
    from bot_web.native import NativeGateway
    from bot_web.operations import BotOperations, InvalidOperation
    from hermes_cli.profiles import get_profile_dir
    native = NativeGateway()
    await native.start()
    try:
        ops = BotOperations(native)
        for name in ("archivist", "engineer", "retired"):
            await native.call("profiles.create", {"name": name, "no_alias": True, "no_skills": True})
            # These represent already configured agents, including custom provider
            # definitions. Fresh-profile model inheritance alone does not copy those.
            (Path(get_profile_dir(name)) / 'config.yaml').write_bytes(
                (Path(os.environ['HERMES_HOME']) / 'config.yaml').read_bytes())
        profile = Path(get_profile_dir("archivist"))
        for relative, content in {
            "SOUL.md": f"You are the existing archivist. Identity marker: {PERSONA}.\n",
            "AGENTS.md": "Synthetic existing workspace guidance.\n",
            "memories/MEMORY.md": "Synthetic existing memory: prefers concise notes.\n",
            "skills/preserve/SKILL.md": "---\nname: preserve\ndescription: Synthetic preservation fixture\n---\nKeep notes concise.\n",
        }.items():
            path = profile / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        # Hermes may maintain its own runtime auth/cache files on native session open.
        # Verify identity/configuration/skills/memory, not cache timestamps/formatting.
        preserved = {str(p.relative_to(profile)): p.read_bytes() for p in profile.rglob('*')
            if p.is_file() and (p.name in {'SOUL.md', 'AGENTS.md', 'config.yaml', '.env'}
                or p.relative_to(profile).parts[0] in {'skills', 'memories'})}
        before = await ops.invoke("agents.list", {})
        assert {a['profile'] for a in before['agents']} >= {'archivist', 'engineer'}
        assert not any(a['managed'] for a in before['agents'])

        original = await native.call('session.create', {'profile': 'archivist', 'title': 'Bot Chat',
            'hidden': True, 'follow_profile_config': True})
        await native.call('session.title', {'session_id': original['session_id'], 'title': 'Bot Chat'})
        original_id = (await native.call('session.list', {'profile': 'archivist', 'title': 'Bot Chat',
            'include_hidden': True}))['sessions'][0]['id']
        first = await ops.invoke('agent.enable', {'profile': 'archivist', 'initialize_chat': True})
        assert first['managed'] and first['canonical']
        await asyncio.gather(*[ops.invoke('agent.enable', {'profile': 'engineer', 'initialize_chat': True})
            for _ in range(2)])
        opened = await ops.invoke('bot.open', {'profile': 'archivist'})
        assert opened['canonical_id'] == original_id
        assert Model.turns == 0, 'Enrollment must not submit model prompts'
        for relative, content in preserved.items():
            assert (profile / relative).read_bytes() == content, relative

        retired = await native.call('session.create', {'profile': 'retired', 'title': 'Bot Chat', 'hidden': True})
        await native.call('session.title', {'session_id': retired['session_id'], 'title': 'Bot Chat'})
        # Fixture-only archived state: this RPC differs across the tested native builds.
        from hermes_state import SessionDB
        retired_id = (await native.call('session.list', {'profile': 'retired', 'title': 'Bot Chat',
            'include_hidden': True}))['sessions'][0]['id']
        db = SessionDB(db_path=Path(get_profile_dir('retired')) / 'state.db')
        db.set_session_archived(retired_id, True)
        db.close()
        try:
            await ops.invoke('agent.enable', {'profile': 'retired', 'initialize_chat': True})
        except InvalidOperation:
            pass
        else:
            raise AssertionError('Deliberately retired chat must not be replaced')

        queue = asyncio.Queue()
        native.listeners.add(queue)
        await ops.invoke('chat.send', {'session_id': opened['session_id'], 'text': 'Synthetic persona verification'})
        async with asyncio.timeout(45):
            while True:
                event = await queue.get()
                if event.get('type') == 'message.complete' and event.get('session_id') == opened['session_id']:
                    break
        assert Model.turns > 0 and PersonaModel.requests, 'Synthetic verification did not reach the local model'
        assert PERSONA in json.dumps(PersonaModel.requests), 'Native runtime did not use the existing SOUL'
        assert 'SYNTHETIC_DEFAULT_PERSONA' not in json.dumps(PersonaModel.requests)
        assert 'Native fixture reply' in json.dumps(await ops.invoke('chat.history', {'session_id': opened['session_id']}))
        for relative, content in preserved.items():
            if (profile / relative).read_bytes() != content:
                if relative == 'config.yaml':
                    import hermes_yaml as yaml
                    before = yaml.safe_load(content)
                    after = yaml.safe_load((profile / relative).read_text())
                    # The af0 native first-turn UX records its own onboarding flag.
                    seen = after.get('onboarding', {}).get('seen', {})
                    if seen.get('profile_build_offered') is True:
                        seen.pop('profile_build_offered')
                        if not seen:
                            after['onboarding'].pop('seen')
                        if not after['onboarding']:
                            after.pop('onboarding')
                    assert before == after, 'Native turn changed settings beyond its onboarding flag'
                    continue
                import difflib
                raise AssertionError(relative + '\n' + '\n'.join(difflib.unified_diff(
                    content.decode().splitlines(), (profile / relative).read_text().splitlines())))
        print(json.dumps({'existing_agents': 'pass', 'revision': native.build['revision'],
            'same_profile_persona': 'pass', 'canonical_reuse': 'pass', 'files_preserved': 'pass',
            'retired_chat_preserved': 'pass', 'enrollment_model_turns': 0, 'synthetic_verification_turns': Model.turns}))
    finally:
        await native.stop()


def main():
    with tempfile.TemporaryDirectory(prefix='workspace-existing-agents-') as directory:
        home = Path(directory) / 'home'
        home.mkdir()
        os.environ.clear()
        os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin', HERMES_HOME=str(home),
            HERMES_RUNTIME_DIR=str(Path(directory) / 'runtime'), PYTHONPYCACHEPREFIX=str(Path(directory) / 'pycache'),
            PYTHONUNBUFFERED='1', NO_PROXY='127.0.0.1,localhost', HERMES_NO_AUTO_INSTALL='1')
        model = ThreadingHTTPServer(('127.0.0.1', 0), PersonaModel)
        threading.Thread(target=model.serve_forever, daemon=True).start()
        (home / '.env').write_text('# No personal credentials\n')
        (home / 'SOUL.md').write_text('SYNTHETIC_DEFAULT_PERSONA\n')
        (home / 'config.yaml').write_text('model:\n  default: fixture-model\n  provider: custom:fixture\nproviders:\n  fixture:\n    base_url: http://127.0.0.1:' + str(model.server_port) + '/v1\n    api_key: fixture-only\nagent:\n  max_turns: 3\n  bot_mode_protocol: true\napprovals:\n  mode: manual\n')
        load_plugin(ROOT)
        try:
            asyncio.run(verify())
        finally:
            model.shutdown()


if __name__ == '__main__':
    main()
