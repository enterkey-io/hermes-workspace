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
                if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
                    server._write_config_key('display.message_reactions', True)
                if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
                    raise ValueError()
            return server._ok(rid, {'enabled': True})
        except Exception:
            return server._err(rid, 5078, 'Message reactions could not be enabled')

    server.method('bot_web.reactions.enable')(enable)
