"""Restricted adapters over native MCP config, discovery and dashboard OAuth.

Only already-configured services are authenticated. The native OAuth engine owns
PKCE, discovery, issuer checks, exchanges, refresh tokens and private token storage.
"""
from copy import deepcopy
import hashlib
import inspect
import json
from pathlib import Path
import re
import secrets
import threading
import time
from urllib.parse import urlsplit


def register(source):
    from tui_gateway import server
    flows = {}
    lock = threading.Lock()

    def scope(profile):
        from hermes_cli.profiles import get_profile_dir, list_profiles
        if not isinstance(profile, str) or profile not in {p.name for p in list_profiles()}:
            raise ValueError()
        return server._session_profile_runtime_scope({'profile_home': str(Path(get_profile_dir(profile)).resolve())})

    def entry(profile, name):
        from hermes_cli.config import read_user_config_raw
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', name):
            raise ValueError()
        with scope(profile):
            value = (read_user_config_raw() or {}).get('mcp_servers', {}).get(name)
        if not isinstance(value, dict):
            raise ValueError('Only owner-configured connections can be changed')
        return deepcopy(value)

    def fingerprint(config):
        return hashlib.sha256(json.dumps(config, sort_keys=True, default=str).encode()).hexdigest()

    def cancel(flow, reason):
        if 'cancelled' in inspect.signature(flow.mark_error).parameters:
            flow.mark_error(reason, cancelled=True)
        else:
            # The old flow is already terminal on error and cannot be reminted.
            flow.mark_error(reason)

    def snapshot(flow):
        value = flow.snapshot()
        return {'id': value['flow_id'], 'status': value['status'], 'authorization_url': value['authorization_url'],
            'error': 'Authorization could not be completed. Check the provider’s client registration.' if value.get('error') else None,
            'tools': flow.tools, 'runtime': 'refresh_required' if value['status'] == 'approved' else 'unknown'}

    def permissions(rid, params):
        try:
            if set(params) not in ({'profile', 'name'}, {'profile', 'name', 'expected', 'tools'}):
                raise ValueError()
            profile, name = params['profile'], params['name']
            config = entry(profile, name)
            if 'tools' in params:
                tools = params['tools']
                if not isinstance(tools, list) or len(tools) > 1000 or any(not isinstance(t, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,160}', t) for t in tools):
                    raise ValueError('Exact tool names only; no wildcard expansion')
                if params['expected'] != fingerprint(config):
                    raise ValueError('Connection changed')
                from hermes_cli.config import _CONFIG_LOCK
                from hermes_cli.mcp_config import _save_mcp_server
                with scope(profile), _CONFIG_LOCK:
                    current = entry(profile, name)
                    if fingerprint(current) != params['expected']:
                        raise ValueError('Connection changed')
                    # Preserve every unrelated native config/header/credential reference.
                    current['tools'] = {**(current.get('tools') or {}), 'include': sorted(set(tools)), 'resources': False, 'prompts': False}
                    if not _save_mcp_server(name, current):
                        raise ValueError('Native save rejected')
                    config = entry(profile, name)
                    if config.get('tools', {}).get('include') != sorted(set(tools)):
                        raise ValueError('Readback failed')
            include = config.get('tools', {}).get('include')
            return server._ok(rid, {'fingerprint': fingerprint(config), 'allowed_tools': include if isinstance(include, list) else None,
                'auth': config.get('auth'), 'bearer_supported': bool(config.get('url')) and config.get('auth') != 'oauth' and set(config.get('headers') or {}) <= {'Authorization'},
                'runtime': 'refresh_required' if 'tools' in params else 'unknown'})
        except Exception:
            return server._err(rid, 5070, 'Connection permissions could not be confirmed')

    def oauth(rid, params):
        try:
            action = params.get('action')
            if action == 'start':
                if set(params) != {'action', 'profile', 'name', 'callback'}:
                    raise ValueError()
                profile, name = params['profile'], params['name']
                config = entry(profile, name)
                callback = urlsplit(params['callback'])
                if callback.scheme != 'https' or callback.username or callback.password or callback.query or callback.fragment:
                    raise ValueError()
                if not config.get('url') or (config.get('headers') and config.get('auth') != 'oauth'):
                    raise ValueError('This service uses a different authorization method')
                from tools.mcp_dashboard_oauth import DashboardOAuthFlow
                from hermes_cli.profiles import get_profile_dir
                try:
                    from hermes_cli.web_server_mcp import _run_dashboard_mcp_oauth
                except ImportError:
                    from hermes_cli.web_server import _run_dashboard_mcp_oauth
                with lock:
                    for key in list(flows):
                        if time.time() - flows[key].created_at > 600:
                            cancel(flows[key], 'Expired')
                            del flows[key]
                    if len([f for f in flows.values() if not f.worker_done]) >= 4 or any(f.profile == profile and f.server_name == name and not f.worker_done for f in flows.values()):
                        raise ValueError('Authorization already in progress')
                    flow_id = secrets.token_urlsafe(24)
                    flow = DashboardOAuthFlow(flow_id=flow_id, server_name=name, profile=profile, hermes_home=str(Path(get_profile_dir(profile)).resolve()), redirect_uri=params['callback'], reconnect_live=False)
                    flows[flow_id] = flow
                config['auth'] = 'oauth'
                # OAuth may test the connection, but it must not implicitly grant all tools.
                config['tools'] = {**(config.get('tools') or {}), 'include': [], 'resources': False, 'prompts': False}
                # The fixed bridge callback is authoritative; reject pinned redirects rather
                # than pretending a loopback-only client supports independent web hosting.
                pinned = (config.get('oauth') or {}).get('redirect_uri')
                if pinned and pinned != flow.redirect_uri:
                    cancel(flow, 'Provider requires its registered redirect')
                    raise ValueError()
                threading.Thread(target=_run_dashboard_mcp_oauth, args=(flow, config), daemon=True, name='workspace-oauth').start()
                return server._ok(rid, snapshot(flow))
            if set(params) not in ({'action', 'id'}, {'action', 'id', 'code', 'state', 'error', 'iss'}):
                raise ValueError()
            flow = (next((f for f in flows.values() if f.expected_state and isinstance(params.get('state'), str) and secrets.compare_digest(f.expected_state, params['state'])), None) if action == 'callback' and params['id'] is None else flows.get(params['id']))
            if flow is None or time.time() - flow.created_at > 300:
                raise ValueError('Authorization expired')
            if action == 'cancel':
                cancel(flow, 'Cancelled')
            elif action == 'callback':
                if set(params) != {'action', 'id', 'code', 'state', 'error', 'iss'}:
                    raise ValueError()
                if 'iss' in inspect.signature(flow.deliver_callback).parameters:
                    flow.deliver_callback(code=params['code'], state=params['state'], error=params['error'], iss=params['iss'])
                else:
                    if params['iss'] is not None:
                        raise ValueError('This native version cannot carry an issuer response')
                    flow.deliver_callback(code=params['code'], state=params['state'], error=params['error'])
            elif action != 'status':
                raise ValueError()
            return server._ok(rid, snapshot(flow))
        except Exception:
            return server._err(rid, 5071, 'Authorization unavailable, expired or rejected')

    server.method('bot_web.connections.permissions')(permissions)
    server.method('bot_web.connections.oauth')(oauth)
