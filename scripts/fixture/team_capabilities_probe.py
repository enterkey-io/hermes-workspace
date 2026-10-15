"""Research-only native team capability probe; disposable state, zero model prompts.

Does not expose new HTTP/model tools or change the running app/plugin. Run under
one of the two pinned Hermes interpreters. All identities and secrets are synthetic.
"""
import asyncio
import importlib.util
import inspect
import json
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def load_plugin():
    spec = importlib.util.spec_from_file_location('bot_web', ROOT / 'plugins/bot-web/__init__.py',
        submodule_search_locations=[str(ROOT / 'plugins/bot-web')])
    module = importlib.util.module_from_spec(spec)
    sys.modules['bot_web'] = module
    spec.loader.exec_module(module)


async def probe(home):
    from bot_web.native import NativeGateway
    from hermes_cli.profiles import get_profile_dir
    from hermes_cli.plugins import PluginContext
    from tools.bot_mode_dm import _resolve_local_name
    from tools.bot_mode_probe import _handle, _profile_role
    native = NativeGateway()
    await native.start()
    results = {}
    try:
        source_soul = (home / 'SOUL.md').read_bytes()
        created = await native.call('profiles.create', {
            'name': 'specialist', 'description': 'Native description BEFORE',
            'soul': 'SYNTHETIC_NEW_AGENT_PERSONALITY', 'no_alias': True, 'no_skills': True,
            'mirror_credentials': False, 'clone_channels': False,
            'model': 'fixture-model', 'provider': 'custom:fixture',
        })
        assert created['ok'] and created['soul_written'], {key: created.get(key) for key in ['ok', 'soul_written', 'model_set']}
        results['custom_provider_model_pin_applied'] = created['model_set']
        target = Path(get_profile_dir('specialist'))
        assert (target / 'SOUL.md').read_text() == 'SYNTHETIC_NEW_AGENT_PERSONALITY'
        assert b'SYNTHETIC_SECRET_NEVER_COPY' not in (target / '.env').read_bytes()
        assert (home / 'SOUL.md').read_bytes() == source_soul
        results['fresh_native_profile_without_parent_soul_or_env_copy'] = True

        async def row(profile='specialist'):
            return next(r for r in (await native.call('profiles.list', {}))['profiles'] if r['name'] == profile)

        async def meta(value, expected, profile='specialist'):
            return await native.call('profiles.configure', {'name': profile,
                'ui_meta': {'hermes-bots': value},
                'ui_meta_expected_revisions': {'hermes-bots': expected}})

        original = {'title': 'Specialist', 'description': 'UI description ONLY',
                    'sectionId': 'fixture-team', 'sectionName': 'Research', 'color': '#556677'}
        assert (await meta(original, 0))['applied']['ui_meta']
        assert 'Native description BEFORE' in _profile_role(target)
        assert 'UI description ONLY' not in _profile_role(target)
        results['native_roster_role_uses_top_level_description_not_ui_description'] = True
        revision = (await row())['ui_meta_revisions']['hermes-bots']
        stale = await meta({'title': 'Stale write'}, revision - 1)
        assert stale['applied']['ui_meta'] is False
        # Prove the native namespace-replacement trap only in this disposable profile.
        assert (await meta({'description': 'Partial namespace'}, revision))['applied']['ui_meta']
        partial = await row()
        assert partial['ui_meta']['hermes-bots'] == {'description': 'Partial namespace'}
        assert (await meta(original, partial['ui_meta_revisions']['hermes-bots']))['applied']['ui_meta']
        updated = await native.call('profiles.configure', {'name': 'specialist',
            'description': 'Native description AFTER'})
        assert updated['applied']['description']
        assert 'Native description AFTER' in _profile_role(target)
        assert (await row())['ui_meta']['hermes-bots']['sectionId'] == 'fixture-team'
        assert (target / 'SOUL.md').read_text() == 'SYNTHETIC_NEW_AGENT_PERSONALITY'
        results['section_metadata_native_write_and_stale_cas_rejection'] = True
        results['ui_namespace_replaces_whole_value_requires_read_merge_cas'] = True
        results['description_edit_preserves_soul'] = True

        skill = target / 'skills' / 'fixture-skill' / 'SKILL.md'
        skill.parent.mkdir(parents=True, exist_ok=True)
        skill.write_text('---\nname: fixture-skill\ndescription: Synthetic probe skill\n---\nNo external action.\n')
        result = await native.call('profiles.configure', {'name': 'specialist', 'disabled_skills': ['fixture-skill']})
        assert result['applied']['skills']
        described = await native.call('profiles.describe', {'name': 'specialist'})
        assert next(s for s in described['skills'] if s['name'] == 'fixture-skill')['enabled'] is False
        results['installed_skill_enable_disable_native'] = True

        pinned = await native.call('profiles.configure', {'name': 'specialist', 'enabled_toolsets': ['terminal']})
        assert pinned['applied']['toolsets']
        assert (await native.call('profiles.describe', {'name': 'specialist'}))['toolsets_pinned'] is True
        cleared = await native.call('profiles.configure', {'name': 'specialist', 'enabled_toolsets': []})
        assert cleared['applied']['toolsets']
        assert (await native.call('profiles.describe', {'name': 'specialist'}))['toolsets_pinned'] is False
        results['empty_toolset_selection_resets_to_defaults_not_no_tools'] = True

        mcp = await native.call('profiles.configure', {'name': 'specialist', 'enabled_mcp_servers': ['fixture-mcp']})
        assert mcp['applied']['mcp_servers']
        described = await native.call('profiles.describe', {'name': 'specialist'})
        assert next(s for s in described['mcp_servers'] if s['name'] == 'fixture-mcp')['enabled'] is True
        mcp = await native.call('profiles.configure', {'name': 'specialist', 'enabled_mcp_servers': []})
        assert mcp['applied']['mcp_servers']
        results['known_mcp_configuration_attach_without_credential_copy'] = True
        results['mcp_live_connection_or_authorization_verified'] = False

        default = await row('default')
        await meta({'title': 'Captain'}, default['ui_meta_revisions'].get('hermes-bots', 0), 'default')
        roster = [r['name'] for r in (await native.call('profiles.list', {}))['profiles']]
        if 'root' in inspect.signature(_resolve_local_name).parameters:
            friendly = _resolve_local_name('captain', roster, root=home)
        else:
            friendly = _resolve_local_name('captain', roster)
        assert _handle('default') == 'hermes'
        results['default_native_handle'] = _handle('default')
        results['friendly_alias_resolves_default'] = friendly == 'default'
        await native.call('profiles.create', {'name': 'captain', 'no_alias': True, 'no_skills': True,
            'mirror_credentials': False})
        roster = [r['name'] for r in (await native.call('profiles.list', {}))['profiles']]
        resolved = (_resolve_local_name('captain', roster, root=home) if
                    'root' in inspect.signature(_resolve_local_name).parameters else
                    _resolve_local_name('captain', roster))
        assert resolved == 'captain'
        results['exact_profile_id_wins_over_friendly_alias_collision'] = True
        results['plugin_sdk'] = {name: hasattr(PluginContext, name) for name in
            ['register_tool', 'register_skill', 'register_system_prompt_section', 'register_hook']}
        assert all(results['plugin_sdk'].values())
        assert (home / 'SOUL.md').read_bytes() == source_soul
        print(json.dumps({'revision': native.build['revision'], 'checks': results,
            'submitted_model_prompts': 0, 'scope': 'disposable native fixture; research only'}))
    finally:
        await native.stop()


def main():
    with tempfile.TemporaryDirectory(prefix='workspace-team-research-') as directory:
        home = Path(directory) / 'home'
        home.mkdir()
        os.environ.clear()
        os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin', HERMES_HOME=str(home),
            HERMES_RUNTIME_DIR=str(Path(directory) / 'runtime'), PYTHONPYCACHEPREFIX=str(Path(directory) / 'pycache'),
            PYTHONUNBUFFERED='1', NO_PROXY='127.0.0.1,localhost', HERMES_NO_AUTO_INSTALL='1')
        (home / 'SOUL.md').write_text('SYNTHETIC_EXISTING_PERSONALITY_DO_NOT_REPLACE')
        (home / '.env').write_text('FIXTURE_PRIVATE_KEY=SYNTHETIC_SECRET_NEVER_COPY\n')
        # Intentionally unserved loopback destinations: no model/MCP calls are part of this probe.
        (home / 'config.yaml').write_text('model:\n  default: fixture-model\n  provider: custom:fixture\n'
            'providers:\n  fixture:\n    base_url: http://127.0.0.1:9/v1\n    api_key: fixture-only\n'
            'agent:\n  bot_mode_protocol: true\napprovals:\n  mode: manual\n'
            'mcp_servers:\n  fixture-mcp:\n    url: http://127.0.0.1:9/mcp\n    enabled: false\n')
        load_plugin()
        asyncio.run(probe(home))


if __name__ == '__main__':
    main()
