# Other agent systems: initial feasibility

16 October 2026. Documentation and source-boundary review only: no OpenClaw or
CLI integration has been implemented or tested. The UI reference update was
pushed first. The product title remains unchanged.

**Technically feasible.** One Pebble Crew interface can connect to multiple
agent runtimes, including Hermes, OpenClaw and supported CLI agents. That needs
runtime adapters and capability-aware UI. It does not require vendor-operated
storage or a relay, and it does not require discarding the Hermes plugin.

## Integration surfaces verified in primary documentation

| Runtime                | Available surface                                                                                                                                                                                   | Implication                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenClaw               | The Gateway exposes WebSocket RPC for external clients, runs, events, cancellation and resources; session RPC includes history/send/abort.                                                          | A native Gateway adapter is a credible next proof of concept. Preserve native agent/session identities, auth scopes and version behavior.                                                   |
| Codex CLI              | App Server supports conversation history, streamed events and approval requests for rich clients. Stdio is the default transport; its TCP WebSocket mode is documented as experimental/unsupported. | Use an owner-host process adapter, preferably stdio, behind our authenticated service. Do not expose the raw agent process to the public browser.                                           |
| Claude Code            | Agent SDK embeds the Claude Code binary in a Python/TypeScript process the developer operates, including sessions, permissions, tools and hooks.                                                    | Another owner-host adapter is feasible. The docs require API-key authentication for third-party products unless otherwise approved; do not promise reuse of a claude.ai subscription/login. |
| ACP-capable CLI agents | Agent Client Protocol defines initialization/capabilities, prompts, streamed updates, cancellation and permission requests. Session loading is optional.                                            | A shared ACP adapter could support multiple compatible agents. Each implementation still needs capability/version testing; ACP does not make arbitrary terminal programs compatible.        |

Sources: [OpenClaw external apps](https://docs.openclaw.ai/gateway/external-apps),
[OpenClaw session control](https://docs.openclaw.ai/gateway/protocol/rpc-session-control),
[Codex App Server](https://learn.chatgpt.com/docs/app-server),
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview),
[ACP overview](https://agentclientprotocol.com/protocol/v1/overview).
The installed Codex CLI's read-only `app-server --help` also confirms its
structured server transports. No agent execution or account access was tested.

## Recommended product shape

This is an architectural inference from those interfaces and our current code:

- Keep one runtime-neutral UI/core for pebbles, sections, avatars, conversation
  presentation and owner login. Give every agent/conversation a backend-qualified
  native identity; matching names must never merge accounts or history.
- Put Hermes, OpenClaw and CLI/ACP adapters behind an owner-host service. Each
  adapter translates actual run events, approvals and content, and declares
  capabilities. Expose routines, creation, attachments or Computer only when
  the selected runtime supports them.
- Offer **Hermes plugin packaging** for the current one-install experience. It
  can bundle the core and Hermes adapter, and could optionally connect other
  runtimes. A plugin requirement is packaging, not a fundamental UI limitation.
- Later offer **standalone self-hosted packaging** for owners without Hermes.
  It would use the same core and selected adapters. CLI adapters need a supervised
  service where the CLI is installed; a browser/static host alone cannot run
  that process. Remote installations need an authenticated private route.

Our Node owner service already separates local authentication from bridge
proxying, but currently has a single Hermes `bridgeUrl`, Hermes ticket/discovery
routes and a fixed bridge allowlist. The real UI also uses `BotBridgeClient`
directly. Supporting more runtimes needs an explicit backend registry and adapter
boundary; it is not an existing setting we can turn on.

All application credentials, login state and any required indexes/coordinator
state stay on the owner's systems. Model-provider processing still depends on
the owner's chosen runtime and provider. This does not make cloud inference
local or remove provider limits.

## The main unresolved feature: mixed-runtime Crews

Displaying and chatting with different runtimes is simpler than having them
work together in one Crew. Hermes group-chat semantics cannot be assumed to work
with OpenClaw/Codex agents. A mixed Crew needs an owner-host coordinator for
message routing, participation, approval boundaries, cancellation, retries and
durability. Shared context must be explicit. Native personalities, memory,
skills and histories remain owned by their original runtime; adding a pebble
does not automatically migrate or unify those stores.

Next proof: one owner-host OpenClaw adapter beside Hermes, covering discovery,
existing session resume, streamed send, stop, approval and restart/reconnect,
with no duplicate message execution. Then one CLI adapter. Test mixed-Crew
coordination separately before offering it. No broader architecture or title
change is needed to make that feasibility test.
