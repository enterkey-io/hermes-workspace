"""Enable native reaction feedback only for the explicitly opened profile."""


def register():
    from tui_gateway import server

    def enable(rid, params):
        try:
            if set(params) != {'session_id'}:
                raise ValueError()
            session, error = server._sess_nowait(params, rid)
            if error:
                return error
            from hermes_cli.config import _CONFIG_LOCK, load_config_readonly
            with server._session_profile_runtime_scope(session), _CONFIG_LOCK:
                config = load_config_readonly()
                selected = (config.get('platform_toolsets') or {}).get('cli')
                # Enabling an already enabled plugin does not reconcile old saved
                # selections on all supported Hermes builds. Add only our toolset
                # to this profile's explicit CLI selection; never replace defaults
                # or enable the unrelated desktop_ui surface.
                if isinstance(selected, list) and 'workspace' not in selected:
                    server._write_config_key('platform_toolsets.cli', [*selected, 'workspace'])
                if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
                    server._write_config_key('display.message_reactions', True)
                if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
                    raise ValueError()
            return server._ok(rid, {'enabled': True})
        except Exception:
            return server._err(rid, 5078, 'Message reactions could not be enabled')

    server.method('bot_web.reactions.enable')(enable)
