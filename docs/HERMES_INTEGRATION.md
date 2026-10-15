# Hermes plugin and messaging-channel assessment

The web app needs a Hermes-side interface that exposes actual Bot Mode with suitable browser authentication. The current tested stock Hermes build does not expose the complete external-web-client contract, so this preview requires the published `bot-web` integration plugin. It uses supported plugin discovery/CLI registration without changing Hermes core.

## What Hermes calls a channel/platform

Hermes's [pinned platform-adapter guide](https://raw.githubusercontent.com/NousResearch/hermes-agent/29112bef099274229cadff79cdff7bf7b99c4b77/website/docs/developer-guide/adding-platform-adapters.md) documents a third-party plugin that calls `ctx.register_platform`, implements `BasePlatformAdapter`, receives messages through `handle_message`, and sends responses through the gateway runner. Registration also integrates a platform into configuration/setup/status and can provide host-driven cron/outbound delivery. That is the Telegram/Discord-style channel the owner described.

## What the current plugin actually implements

`bot-web` registers a CLI command and runs an API-only HTTPS-ingress service with strict Host/app-origin allowlists and proof-bound owner approval. Its persistent native stdio child invokes Hermes's real `tui_gateway` handlers, the same native Bot Mode surface used by interactive clients. It resumes existing canonical Bot Chats normally, activates native tool/teammate behavior and the native room service, and exposes narrowly allowlisted methods/events to approved clients.

It does **not** register a new `BasePlatformAdapter` or show up as a messaging channel in `hermes gateway setup`. Interactive native Bot Mode access does not require routing these operations through a new generic inbound-message channel. Moving it blindly to `handle_message` would need proof of canonical-session, bot-profile, native room and approval semantics; a channel that merely starts a separate generic chat would not satisfy the product requirement.

The native fixtures test real canonical continuity, teammate injection/delivery, room-driver output and controls, not a browser-run agent simulator. Browser tests now exercise the API from an independently hosted origin. This is a working preview contract, not evidence that every Hermes messaging-channel feature is implemented.

Existing ordinary profiles can now be discovered through `agents.list` and selected in the web app. `agent.enable` registers those same existing profiles and initializes/reuses their native Bot Chats; it does not create another agent or transfer SOUL. Bot Mode identity stays with the selected profile's existing SOUL, memory, skills and settings. The Desktop managed marker is a discovery/registration detail, not evidence that an unmarked profile lacks an agent identity. New-profile creation is a separate operation and is not exposed by this enrollment API.

## Channel follow-up plan

A properly registered channel is useful for future proactive delivery, host-driven `hermes send`/cron targeting, channel-specific configuration/status and device delivery policies. Before adding it:

1. Prove how platform routing targets each managed bot's existing canonical Bot Chat and native room, without creating parallel generic session histories or changing agent identities.
2. Define authenticated destination identities and local ownership/authorization. A paired browser credential must not become an unrestricted cross-platform sender.
3. Define delivery while the browser/app is offline. Any durable queue/state remains on the owner's Hermes host. No vendor mailbox, account or notification relay is assumed.
4. Register the supported platform plugin and implement its actual lifecycle/send/receive contract. Reuse the existing authenticated transport and native operations only where the source contract supports them.
5. Test ordinary gateway setup/status, exact bot/room routing, native approvals/Stop, host-driven cron/outbound delivery, reconnect/expiry/revocation and upgrade/rollback in disposable real-Hermes fixtures.

The current preview deliberately claims only its implemented API integration and native interactive behavior. Proactive messaging-channel registration, cron execution/delivery and mobile push are not implemented. Adding them is a separate feature milestone, compatible with independent web hosting and the same privacy boundary. The setup guide must not instruct an agent to enable a channel that does not exist.
