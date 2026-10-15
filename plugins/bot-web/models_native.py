"""Explicit single-provider grants for fresh agents; never copies an auth pool or .env."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path


def register():
    from tui_gateway import server

    def selected():
        from hermes_cli.config import load_config, read_user_config_raw
        from agent.secret_scope import get_secret
        from providers import get_provider_profile
        raw, resolved = read_user_config_raw() or {}, load_config() or {}
        model = raw.get('model') or {}
        provider, name = model.get('provider'), model.get('default')
        if not isinstance(provider, str) or not isinstance(name, str):
            raise ValueError('Configure the primary model in Hermes first')
        custom_name = provider.removeprefix('custom:')
        custom = (resolved.get('providers') or {}).get(custom_name)
        credential = None
        if isinstance(custom, dict):
            # Exactly the selected custom-provider definition, not all providers.
            definition = deepcopy(custom)
            supported = bool(definition.get('base_url'))
            environment = None
        else:
            metadata = get_provider_profile(provider)
            supported = bool(metadata and metadata.auth_type == 'api_key')
            environment = None
            definition = None
            if supported:
                for key in metadata.env_vars:
                    value = get_secret(key)
                    if value:
                        environment, credential = key, value
                        break
                supported = bool(environment and credential)
        public = {'source': 'default', 'provider': provider, 'model': name, 'supported': supported,
            'auth_kind': 'selected_custom_provider' if definition is not None else 'provider_api_key'}
        proof = hashlib.sha256(json.dumps({'model': model, 'definition': definition, 'environment': environment, 'credential': credential}, sort_keys=True, default=str).encode()).hexdigest()
        return public | {'fingerprint': proof}, model, custom_name, definition, environment, credential

    def handler(rid, params):
        try:
            if set(params) not in ({'action'}, {'action', 'profile', 'expected'}):
                raise ValueError()
            # Source is the real gateway launch/default profile. Named-source grants and
            # OAuth/credential-pool sharing need separate adapters, not broad copying.
            from hermes_cli.profiles import get_profile_dir
            with server._session_profile_runtime_scope({'profile_home': str(Path(get_profile_dir('default')).resolve())}):
                public, model, custom_name, definition, environment, credential = selected()
            if params['action'] == 'describe':
                return server._ok(rid, public)
            if params['action'] != 'grant' or params.get('expected') != public['fingerprint'] or not public['supported']:
                raise ValueError('Model authorization changed or is unsupported')
            from hermes_cli.profiles import get_profile_dir, list_profiles
            if params['profile'] == 'default' or params['profile'] not in {p.name for p in list_profiles()}:
                raise ValueError()
            home = Path(get_profile_dir(params['profile'])).resolve()
            with server._session_profile_runtime_scope({'profile_home': str(home)}):
                from hermes_cli.config import read_user_config_raw, save_config, save_env_value
                config = read_user_config_raw() or {}
                config['model'] = {key: value for key, value in model.items() if key in {'provider', 'default', 'base_url', 'api_mode'}}
                if definition is not None:
                    config.setdefault('providers', {})[custom_name] = definition
                if environment and credential:
                    save_env_value(environment, credential)
                save_config(config)
                verified = read_user_config_raw() or {}
                if verified.get('model') != config['model']:
                    raise ValueError('Model save not confirmed')
            return server._ok(rid, {'configured': True, 'provider': public['provider'], 'model': public['model'], 'runtime': 'unverified'})
        except Exception:
            return server._err(rid, 5072, 'Specific model grant unavailable or changed')

    server.method('bot_web.models')(handler)
