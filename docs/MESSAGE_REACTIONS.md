# Message reactions

Direct pebble chats use Hermes's native message reactions. The app shows both
owner and agent reactions, with one reaction per author per message. Picking a
different emoji replaces your reaction; picking the same emoji or clicking your
reaction removes it. Touch devices expose the reaction button without hover.

Opening a managed Bot Chat enables `display.message_reactions` in that profile
through a fixed, profile-scoped native helper. Unrelated settings, SOUL, memory
and model configuration are preserved. This does not send a model prompt.
The enrolled integration provides `pebble_react`, a session-verified wrapper
around Hermes's `react_to_message_tool`. Agents can react to the current or an
earlier message, and native `message.reaction` events update the open transcript.
No desktop-wide toolset or arbitrary native RPC is exposed.

Owner reactions are persisted on Hermes's message rows. Hermes includes unseen
owner reactions in the agent's next user turn, once. Adding a reaction does not
start an additional model turn. Reloading the app reads the same native history.
There is no separate reaction database or hosted reaction service.

The current Hermes group API has no equivalent reaction operation. Crew chats
do not expose reaction controls, and the agent wrapper refuses group sessions
rather than writing reactions into an invisible participant transcript.

## Wire contract

Integration 0.7.3's `POST /v1/connect` advertises `capabilities.reactions: true` on the updated
integration. Older integrations omit the capability and get no reaction action.
The protocol identifier and NDJSON framing are unchanged.

`chat.react` accepts exactly `session_id`, a positive integer `row_id`, and
`emoji` (a bounded Unicode emoji sequence or `null` to clear). The connection
must already have opened that managed chat. Author is always `user`; callers
cannot impersonate the agent. Native session lineage and profile-incarnation
checks prevent cross-conversation or retired-profile writes.

The result is `{row_id, reactions}` from `message.react`. Both owner changes
and native agent changes emit `message.reaction`. Message history carries the
durable list in `display_metadata.reactions`. Internal `seen` bookkeeping is not
part of the rendered state. Uncertain mutation outcomes are never replayed.

## Updates and verification

This feature needs the updated web bundle and integration together. Use the
normal combined-package update and `hermes bot-web sync-runtime` step in
[the agent installation guide](AGENT_INSTALL.md) so enrolled profiles receive
the new tool. Opening their chat enables native feedback automatically.

Production browser checks cover picking, replacing, removing, persistence,
agent events, keyboard accessibility and phone bounds. Native owner acceptance
uses a disposable Hermes home and a local model to call the agent reaction tool,
render its event, submit owner feedback, verify that feedback reached the model,
and confirm persistence/removal after reload. These checks do not use an owner's
installation, credentials or personas.

Run `scripts/fixture/reactions_smoke.py` with each pinned Hermes interpreter and
source import path for the focused native round trip. The `native-owner` CI job
also runs it after browser acceptance.
