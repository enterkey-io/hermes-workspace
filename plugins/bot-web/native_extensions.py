"""Additional named stdio handlers, registered through Hermes's method seam.

No native handler is replaced. Only our own fixed plugin code can be activated;
callers cannot choose filesystem paths, commands, repositories or credentials.
"""
import hashlib
import os
from pathlib import Path
import shutil
import tempfile


def register(source):
    from tui_gateway import server
    source = Path(source).resolve()

    def prepare(rid, params):
        try:
            if not isinstance(params, dict) or set(params) != {'profile'}:
                raise ValueError()
            profile = params['profile']
            from hermes_cli.profiles import get_profile_dir, list_profiles
            if profile not in {p.name for p in list_profiles()}:
                raise ValueError()
            home = Path(get_profile_dir(profile)).resolve()
            destination = home / 'plugins' / 'bot-web'
            from payload import payload_paths
            files = payload_paths(source)
            if destination.is_symlink():
                raise ValueError()
            if destination.exists():
                for path in files:
                    target = destination / path.relative_to(source)
                    if not target.is_file() or target.is_symlink() or hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
                        raise ValueError('Installed integration needs a coordinated update')
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                temporary = Path(tempfile.mkdtemp(prefix='.bot-web-', dir=destination.parent))
                try:
                    for path in files:
                        target = temporary / path.relative_to(source)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(path, target)
                    os.replace(temporary, destination)
                finally:
                    if temporary.exists():
                        shutil.rmtree(temporary)
            # Version adapters share native runtime scoping; the older signature has
            # no hydrate_secrets option, so use only their common supported argument.
            with server._session_profile_runtime_scope({'profile_home': str(home)}):
                from hermes_cli.plugins_cmd import dashboard_set_agent_plugin_enabled
                result = dashboard_set_agent_plugin_enabled('bot-web', enabled=True)
                if result.get('ok') is not True:
                    raise ValueError('Native activation not confirmed')
            return server._ok(rid, {'prepared': True, 'runtime': 'refresh_required'})
        except Exception:
            return server._err(rid, 5069, 'Workspace runtime preparation not confirmed')

    server.method('bot_web.runtime.prepare')(prepare)
