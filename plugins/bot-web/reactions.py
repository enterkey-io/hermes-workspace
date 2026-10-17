"""A session-bound model tool over Hermes's own reaction store and event emitter."""
import json


def runtime_guidance(platform):
    """Advertise only an enabled capability, including its native discovery path."""
    from hermes_cli.config import load_config_readonly
    if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
        return ''
    from tui_gateway import server
    from model_tools import get_tool_definitions
    # The older pinned adapter has no separate disabled-toolsets loader.
    disabled = server._load_disabled_toolsets() if hasattr(server, '_load_disabled_toolsets') else None
    tools = get_tool_definitions(enabled_toolsets=server._load_enabled_toolsets(platform),
        disabled_toolsets=disabled, quiet_mode=True,
        skip_tool_search_assembly=True)
    if not any(t.get('function', {}).get('name') == 'pebble_react' for t in tools):
        return ''
    return ('In this direct Pebble Crew chat you can send emoji reactions using pebble_react. '
        'Hermes may defer plugin tools: if pebble_react is not in your top-level tools, '
        'load it with tool_describe(names=["pebble_react"]), then invoke it through tool_call '
        'using that tool\'s advertised schema. It is not missing just because it is deferred. '
        'The emoji argument is required; omit target fields to react to the latest user message. '
        'React naturally without narrating the reaction. Owner reactions arrive as native feedback on the next user turn.')


def emoji(value, *, clear=False):
    # Bound untrusted input; accept Unicode emoji sequences, including joined and
    # skin-tone variants, without a duplicate emoji database in the integration.
    import unicodedata
    if clear and value in (None, ''):
        return None
    if not isinstance(value, str) or not 1 <= len(value) <= 32 or value != value.strip():
        raise ValueError('Choose an emoji')
    if any(unicodedata.category(c).startswith('C') and c != '\u200d' for c in value):
        raise ValueError('Invalid reaction')
    if not any(unicodedata.category(c) == 'So' or c == '\u20e3' for c in value):
        raise ValueError('Choose an emoji')
    return value


def register_runtime(ctx):
    def react(args, session_id=None, **_kwargs):
        store = None
        try:
            from .runtime import caller
            from .workspace import WorkspaceStore, workspace_path
            from gateway.session_context import get_session_env
            from hermes_cli.config import load_config_readonly
            store = WorkspaceStore(workspace_path())
            profile = caller(store, session_id)
            key = get_session_env('HERMES_SESSION_KEY', '') or get_session_env('HERMES_SESSION_ID', '')
            if not profile or caller(store, key) != profile:
                raise ValueError('Verified enrolled native caller required')
            from .room_identity import runtime_room
            if runtime_room(store, profile, key):
                raise ValueError('Native group conversations do not support message reactions')
            if (load_config_readonly().get('display') or {}).get('message_reactions') is not True:
                raise ValueError('Message reactions are not enabled')
            if not isinstance(args, dict) or 'emoji' not in args or set(args) - {'emoji', 'message_row_id', 'messages_back'}:
                raise ValueError('Invalid reaction fields')
            chosen = emoji(args.get('emoji'), clear=True)
            for field in ('message_row_id', 'messages_back'):
                if field in args and (type(args[field]) is not int or not 0 <= args[field] <= 9007199254740991):
                    raise ValueError('Invalid reaction target')
            from tools.react_to_message_tool import react_to_message_tool
            return react_to_message_tool(chosen or '', args.get('message_row_id'), args.get('messages_back'))
        except Exception:
            return json.dumps({'error': 'Reaction not confirmed. Use only messages in your current Pebble Crew conversation.'})
        finally:
            if store:
                store.db.close()

    schema = {'name': 'pebble_react',
        'description': 'React naturally to a message in this Pebble Crew conversation with one emoji. Defaults to the latest user message; messages_back selects earlier user messages. A different emoji replaces yours, the same emoji or an empty string removes it. The reaction appears on the message: never narrate it or use reactions as progress indicators. A reaction can be the entire reply when words add nothing.',
        'parameters': {'type': 'object', 'additionalProperties': False, 'required': ['emoji'],
            'properties': {'emoji': {'type': 'string', 'maxLength': 32},
                'message_row_id': {'type': 'integer', 'minimum': 1},
                'messages_back': {'type': 'integer', 'minimum': 0}}}}
    ctx.register_tool(name='pebble_react', toolset='workspace', description=schema['description'],
                      schema=schema, handler=react)
