# Hermes independent web client implementation plan

> Updated 14 October 2026: the user explicitly authorized an optional integration plugin for native Bot Mode access. The preview now uses a user-hosted bot-web bridge and static browser app. Earlier text excluding a plugin as an access adapter is superseded by this authorization. See docs/SETUP.md and PROGRESS.md for the implemented boundary, current scope and evidence. Public release remains gated separately.
> Architecture correction, 14 October 2026: web hosting and Hermes hosting are independent. The web app is static files on any chosen HTTPS host. Only the optional native integration runs on the Hermes host; it serves an API, not the web app. An agent can install/configure either component without relocating the other. The browser stays on its web origin and pairs directly with a separately configured Hermes endpoint. Product name remains undecided. [Current architecture and review](docs/ARCHITECTURE.md) supersede the mistaken combined-host flow.

Draft for architecture and scope decisions, 11 October 2026. Planning only; no infrastructure or Hermes changes are authorized by this document.

Build an independent, browser-direct client for Hermes running anywhere, distributed as static files. Users can host it on Cloudflare, DigitalOcean or any suitable HTTPS web host; an optional vendor-hosted copy uses the same output. Each user connects their own Hermes endpoint and authenticates to that endpoint. Hermes owns execution, history, memory, tools, and schedules. A static hosting service distributes application code; it does not broker conversations. The client's compatibility contract is with Hermes, independent of the machine, operating system, hosting provider, or deployment platform running either component.

The first engineering milestone is a Bot Mode compatibility spike. The product must operate Hermes's underlying Bot Mode, including its managed bot identities, canonical conversations, native coordination, rooms, and bot-owned routines. REST chat access alone does not meet that requirement. Determine which supported REST and dashboard RPC interfaces provide these behaviors from a separate web origin, and establish supported Hermes versions through contract tests. Do not use one user's deployment as the product baseline. Unresolved access to core Bot Mode behavior blocks the working-product milestone; it does not justify substituting a generic chat client.

## Target and compatibility contract

The target is a user's Hermes installation running on a desktop, home server, container, virtual machine, hosted server, or other environment. No host-specific account, package, SDK, or service is a prerequisite. Model-provider selection belongs to Hermes and does not change the client's connection contract.

Support is determined by the installation's reachable endpoint, authentication method, exposed Hermes APIs, and advertised or tested capabilities. Hosting platforms can introduce reverse proxies or additional authentication, which are connection arrangements to accommodate rather than product-specific integrations to require. Network access and browser restrictions still apply; host independence does not imply that every unconfigured server is remotely reachable.

Maintain a Hermes compatibility matrix by version, API surface, authentication mode, and connection topology. Deployment labels must not control feature availability. All four applications connect to this same Hermes contract; hosting our web interface and hosting the user's Hermes are separate choices.

## Architecture decisions

- Use React, strict TypeScript, and Vite for a static single-page application. Use a small pure TypeScript Hermes client/domain package shared with later native clients. Avoid SSR, a vendor application backend, or a generalized plugin framework.
- Connect directly over authenticated HTTPS/WSS to the Hermes interfaces needed for genuine Bot Mode operation. Require supported origin and authentication configuration. REST and dashboard RPC have separate security boundaries; the spike must establish the complete connection contract before selecting transports.
- Start with existing Hermes-managed bots discovered from the backend, their canonical conversations, native bot coordination, existing group rooms, run progress, cancellation, approvals, and bot-owned routines. Limit administration and visual complexity rather than replacing Bot Mode with manually labeled chat sessions.
- Keep credentials and transcripts in browser memory for the first release. Remembering private endpoint configuration is optional and local only. No persistent transcript cache, offline send queue, vendor account, or telemetry collector in v1.
- Publish the same static output and an ordinary web-server container through GitHub. Neither self-hosting nor native chat may require our Cloudflare account or a vendor license server to authorize Hermes.
- Later Mac/Windows products may share protocol code and UI components. Keep packaging, OS credentials, native networking, payments, and licensing outside the web core. iOS requires its own authentication and lifecycle spike.

## Critical review of Hermes compatibility

The source audit used Hermes 0.21.0 build `29112be`, resolved to `29112bef099274229cadff79cdff7bf7b99c4b77`, as a pinned research reference. It is not the exclusive target or a predetermined minimum supported version. The findings below describe that source revision; test other versions before extending the compatibility matrix. A healthy API server alone does not establish browser reachability, CORS, profile keys, or dashboard authorization. CI must use disposable fixtures with synthetic data and no dependency on any user's installation.

| Surface | Verified source behavior | Product consequence |
| --- | --- | --- |
| Agent REST | Bearer authentication, capabilities, runs/events/stop/approval, sessions, jobs, skill/toolset discovery | Reuse where it preserves native Bot Mode behavior; REST execution access alone is insufficient |
| Profile routing | Multiplexed `/p/<profile>/…` routes require that profile's own API key | Configure endpoint/profile/credential together; never try the default key across profiles |
| Bot identity | Bot metadata belongs to profiles; canonical conversation identity is exact title `Bot Chat`, with compaction lineage | Preserve the existing registry and active lineage; do not allocate a new conversation on each open |
| Dashboard | HTTP CORS accepts localhost origins; WebSocket Host/Origin guards use bound/trusted public hosts | API CORS configuration does not unlock dashboard RPC; access to required Bot Mode methods is a release blocker to resolve |
| Dashboard auth | WS tickets require an authenticated dashboard session; native authorization uses PKCE and literal loopback callbacks | API bearer keys are not a universal dashboard login; native auth is not a web SPA callback flow |
| RoomLink REST | Member invitations/grants/capabilities and scoped dispatch exist | This is federation machinery, not proof of end-user group listing/creation/control |

The compatibility report must map each required Bot Mode operation to a real Hermes interface: managed roster and metadata, canonical conversation resolution, native bot-to-bot delivery, existing rooms and their driver, bot-scoped routines, and runtime controls. A REST success is not evidence that the Bot Mode protocol or tools were activated. Test managed-profile markers, session identity, and an actual native teammate delivery using a deterministic model fixture. The client must not replace missing coordination with a separate browser-side agent loop.

The [exact-build API documentation](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/website/docs/user-guide/features/api-server.md) describes the broad public surface. The [actual REST implementation](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/gateway/platforms/api_server.py) additionally supports `GET /api/sessions?title=Bot%20Chat&include_hidden=true`, recoverable-archive handling, and PATCH of `hidden`. These are promising for canonical Bot continuity, but must be exercised against compaction and concurrent access. The [canonical Bot implementation](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/apps/desktop/src/plugins/hermes-bots/canonical-chat.ts) distinguishes registry/root IDs from resolved active IDs. REST response fields do not justify assuming identical lineage semantics.

The [dashboard server](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/hermes_cli/web_server.py) and [authentication routes](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/hermes_cli/dashboard_auth/routes.py) impose independent boundaries. Do not add our domain as a supposed trusted dashboard host merely to evade an Origin check. Do not advise disabling CORS, accepting all origins, browser security flags, or putting long-lived keys in WebSocket URLs. [Room grants](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/gateway/platforms/api_server_room_grants.py) do not replace [group management RPC](https://github.com/NousResearch/hermes-agent/blob/29112bef099274229cadff79cdff7bf7b99c4b77/tui_gateway/methods_groups.py).

A profile is a Hermes configuration/history boundary, not an OS sandbox. API credentials can authorize powerful host tools. Our UI must neither imply that it contains execution nor request users' model-provider credentials. Model and provider configuration remains Hermes-owned. Enable features, including computer viewing, only for versions and capabilities that have passed compatibility tests.

## Privacy contract and trust boundaries

“Our infrastructure stores no user content or Hermes connection secrets” means no prompts, outputs, tool arguments/results, attachments, memories, credentials, endpoint hostnames, profile names, session/run IDs, or related private metadata enter our application services, logs, analytics, error reporting, URLs, or support collection by default.

| Location | Permitted data and lifetime |
| --- | --- |
| Vendor Cloudflare hosting | Public static assets and ordinary asset-delivery traffic metadata; no Hermes request handling |
| Browser memory | Active credentials, configured endpoints, transcripts, drafts, run state; discarded on disconnect/reload where feasible |
| Optional browser persistence | Explicitly opted-in endpoint/profile labels and harmless UI preferences; never keys or transcripts in v1 |
| User Hermes host | Canonical history, memory, jobs, tool activity, authorization, and execution according to the user's installation |
| Future sales/license system | Purchase/entitlement records, isolated from Hermes identity and activity |

Browser-local storage is not vendor-server storage, but scripts served from our origin can read it. Explain this before remembering connection details. A browser or operating system may retain memory, form data, crash artifacts, or downloads; memory-only is an application behavior, not a forensic-erasure guarantee. No service worker or offline transcripts in v1. If offline shell caching is added later, allowlist immutable application assets only and test that authenticated requests never enter Cache Storage.

Serve assets, fonts, icons, and rendering libraries locally. No session replay, third-party analytics, remote avatars, automatic link previews, telemetry SDK, or content-bearing CSP reports. Production logs use fixed error codes only; diagnostic export is locally generated, redacted by construction, and previewed by the user before they choose to share it. Automated support uploads are excluded. Optional future usage statistics require a separate privacy decision: aggregate counts do not automatically remove IP/timing correlation.

Cloudflare will process ordinary hosting access metadata such as IP addresses and asset requests. Configure the minimum available logging/retention and disclose provider processing accurately. Never claim that nobody sees network metadata. Direct browser-to-Hermes traffic bypasses our infrastructure, but hosted JavaScript can access secrets and plaintext: a malicious deployment, compromised dependency, or XSS can violate privacy. Self-hosted pinned builds and future signed native releases give users a different code-distribution trust choice, not immunity to client compromise.

## Supported connectivity and authentication

| Mode | Initial position |
| --- | --- |
| User-owned bot-web API bridge with trusted HTTPS and exact web-origin allowlist | Implemented preview path: proof-bound local approval, one-hour browser credential, native Bot Mode; API-only bridge on Hermes |
| Existing trusted HTTPS stock API endpoint plus bearer key and exact CORS allowlist | Runtime transport candidate; not sufficient by itself to certify full Bot Mode access |
| Private VPN plus HTTPS endpoint reachable from the user's device | Optional supported recipe after browser/device testing; no vendor network participation |
| User-owned Cloudflare Tunnel/Access | Optional advanced recipe only after authentication/preflight tests; never a required account |
| LAN HTTP, self-signed TLS, SSH forwarding | Expert/local development paths; do not promise compatibility from hosted HTTPS |
| Dashboard authentication and RPC | Required wherever core Bot Mode operations depend on it; certify a supported separate-origin web flow before implementation |
| Vendor proxy, credential vault, relay, Worker VPC bridge | Excluded from default architecture |

[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) can provide HTTPS within a user's tailnet; the browsing device must have access. Browser network permissions and certificate trust still matter. [Chrome's Local Network Access model](https://developer.chrome.com/blog/local-network-access) makes local/private reachability an explicit browser concern; verify current Chrome, Firefox, Safari, and iOS behavior rather than extrapolating from curl.

A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) can connect outward from the user's network, but ordinary HTTP proxying terminates TLS at Cloudflare. It is not end-to-end private against that provider. [Access CORS guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/) documents additional preflight/authentication constraints. Never embed an Access service secret in a public client or remove endpoint authentication to make OPTIONS work. Our Worker cannot automatically access a user's tailnet or LAN. A custom encrypted relay/local connector would be a separate, substantial project requiring explicit product approval; it is unnecessary for the primary design.

Connection sequence:

1. User enters the Hermes endpoint and completes the authentication supported by the certified connection contract. If different interface or profile credentials are needed, identify their scope explicitly. Show the exact destination before sending credentials. Reject embedded URL credentials, fragments, unexpected query parameters, invalid schemes, and ambiguous path construction.
2. Normalize and freeze the connection origin/base path. Use bearer fetch with `credentials: omit`, redirect rejection, request timeouts, and a per-connection transport instance. Never forward credentials to a capability-supplied foreign origin.
3. Discover and validate the required REST and RPC capabilities through their supported authentication paths. Check browser-origin permission independently for each interface. Load the Hermes-managed bot roster and metadata; fail with a clear compatibility result if core Bot Mode access is missing. Expose diagnostics locally without sending the URL to us.
4. Resolve the selected bot's canonical session and route operations through the verified native Bot Mode contract. Use supported run/event transports and native room/routine interfaces. Do not assume browser EventSource can attach bearer headers or that an API bearer key grants dashboard RPC access.
5. On disconnect, abort transports, clear caches/drafts/secrets, revoke blob URLs, and remove any opted-in local connection record on request. Distinguish local forgetting from server-side key revocation; provide host-side rotation instructions.

There is no pairing relay. In the implemented preview the bridge performs short-lived pairing directly: a browser-generated verifier challenge, five-minute approval code, explicit local operator approval bound to the exact web origin, and a one-hour browser credential kept in tab memory. No manual administrator-key entry is offered by the app. Native desktop may use a supported system-browser authorization flow or this bridge contract after its own networking/credential assessment; neither automatically establishes an iOS flow.

## Minimum product scope

Borrow the approachable roster, conversation, activity, and routine concepts from [Grok Bot](https://docs.x.ai/grok-bot/overview), with original branding and components. The first screen is a concise connection form with a demo option using synthetic local data. Desktop layout has the backend's managed-bot and room roster, a conversation pane, and an activity/routines panel. Narrow screens use one pane at a time with persistent connection and run status. A minimal interface must still use the real Bot Mode runtime and state.

Initial scope, subject to acceptance gates:

- Connect to Hermes and discover its existing managed bots, using backend identities and role/avatar metadata. Keep connection records separate from bot records. Forgetting a connection must not delete a Hermes bot.
- Open the canonical Bot conversation; show paginated history, streaming text, bounded tool progress, explicit waiting/failed/interrupted states, and connection health.
- Submit messages, stop runs, and respond to server-issued approvals with clear action/context. Never infer approval from agent text.
- Preserve and expose native bot-to-bot messaging and handoffs, with backend-confirmed attribution and delivery state. Route mentions according to Hermes's Bot Mode contract; do not invent a client-side coordination protocol.
- Open existing native group rooms, send messages, observe the native driver's discussion and attention state, and use supported stop/approval controls. Group membership editing and new-room creation can follow; existing rooms must not be simulated as concatenated bot chats.
- List bot-owned routines and last-run state, and provide validated run/pause/resume controls. Add schedule creation/editing after ownership, timezone, delivery, and cancellation semantics are verified. Scheduling and execution remain Hermes-owned.
- Display discovered skills/tools read-only. Keep the server's model default; a model picker can wait until profile/session precedence is tested.
- Provide keyboard navigation, visible focus, semantic controls, sufficient contrast, reduced motion, accessible approval dialogs, and restrained live announcements. Preserve scroll position while streaming; offer jump-to-latest rather than stealing focus.

Defer advanced bot creation/configuration, metadata editing, new-room creation/membership editing, cross-server federation, MCP setup, marketplace, terminal, computer control, browser extension control, general file uploads, push notifications, arbitrary artifact execution, and memory editing. These exclusions do not defer core Bot Mode integration, managed roster discovery, native teammate behavior, or use of existing group rooms and routines. Inline images can follow only after run-path support and size limits are verified. Hermes schedules continue on its host, not in a sleeping browser. Optional functionality plugins remain separately scoped additions when existing interfaces cannot supply a requested enhancement.

## Code structure and implementation boundaries

Use a small workspace, pinned Node/package-manager versions and lockfile, strict TypeScript, lint/format rules, and documented dependency direction. [Vite static output](https://vite.dev/guide/static-deploy.html) can be served independently of its development server; [React](https://react.dev/learn) fits the interactive stateful interface without adding server runtime requirements.

| Module | Responsibility |
| --- | --- |
| `apps/web` | React views, accessible components, routing, in-memory view state, web connection lifecycle |
| `packages/hermes-client` | Endpoint construction, schema validation, verified REST/RPC transports and event parsers, version/capability adapters, typed errors |
| `packages/core` | Connection/bot/room identity, canonical conversation resolution, run and delivery state, approval/routine rules; no DOM or React and no agent orchestration |
| `test/fixtures` | Synthetic protocol transcripts and disposable Hermes fixtures, including malformed/adversarial cases |
| `deploy` and `docs` | Static headers, container recipe, Cloudflare configuration, compatibility matrix, privacy/security decisions |

Start with concrete interfaces: `HermesTransport.request/observe`, `CapabilitySnapshot`, `BotService.listManaged`, `ConversationService.resolveCanonical/loadHistory`, `RunService.submit/observe/stop/approve`, `RoomService`, and `RoutineService`. Native teammate delivery is observed through the verified Hermes protocol rather than executed by our own orchestrator. Use injected clock, random ID source, and transport only where needed for deterministic tests. Keep raw version-specific payloads inside the client adapter; expose a small discriminated event union to the reducer. Validate external JSON at runtime with a maintained schema library. Do not build a universal agent protocol or duplicate Hermes orchestration.

Shared code must not import browser storage, Cloudflare bindings, payment SDKs, or UI libraries. Later native shells supply credential storage/network/lifecycle implementations. Do not choose Electron, Tauri, or an iOS framework merely to maximize code sharing before their auth, signing, and background constraints are evaluated.

## Conversation and run correctness

The logical owner is `(connection identity, routed profile, canonical title)`, never profile name alone. Include this owner in every cache key and async operation. On switching profiles, discard late responses from the previous owner. Resolve `Bot Chat` by exact title including hidden records; distinguish root from active lineage. Creating a missing canonical session must handle title conflicts by rereading, set supported hidden state, and respect deliberately archived/deleted sessions. No automatic resurrection policy invented by the client. Disable creation initially if this cannot match Hermes behavior safely.

Use `/v1/runs` with explicit existing `session_id`; let Hermes load its transcript. Do not resend reconstructed history or inject replacement system instructions. Generate an unguessable idempotency key per user send, retain the exact payload/key while the outcome is uncertain, and reuse it only for that same operation within the verified server window. The exact-build documentation contains inconsistent short cache versus durable retention descriptions; contract tests must settle behavior. After reload with memory-only state, reconcile history/status before offering retry; do not claim exactly-once delivery across an unknown outcome.

Treat streaming as an observation channel. Reconnect with bounded exponential backoff and jitter; resume by cursor only if supported. Otherwise reconcile authoritative status/history and avoid appending replayed deltas twice. Cap event size, queued updates, and transcript rendering. After stream expiry or restart, show an explicit gap/interrupted state. A closed browser connection is not cancellation; a stop request is not completed cancellation until Hermes confirms terminal state. Pending approvals are server-bound decisions with identifiers/expiry, explicit approve/deny, and stale-decision handling. Never auto-approve on reconnect.

Do not blindly retry mutations such as creating routines, deleting sessions, or approving tools. Refresh state after ambiguous failures. Test simultaneous tabs/clients; server leases and idempotency are authoritative, while client locks only improve UX. Preserve running work through view navigation where practical, without promising survival of a Hermes crash or unlimited event retention.

## Security design

Bundle scripts locally and disallow inline/evaluated scripts. Deploy CSP with `default-src 'none'`, self-only scripts/styles, restricted images/fonts, no objects, `base-uri 'none'`, `frame-ancestors 'none'`, and no form submissions. Arbitrary user endpoints require broad HTTPS connectivity in the general hosted build; disclose that `connect-src https:` cannot prevent exfiltration by compromised script. Restrict destinations additionally in the transport; user-specific self-hosted builds may generate a narrower policy. Do not send endpoint-specific CSP to a vendor server. Add WSS only if an approved adapter needs it.

Set no-referrer, nosniff, appropriate Permissions Policy, and HTTPS security headers. Keep endpoint/profile IDs out of browser routes and asset URLs. Do not log Authorization, raw URLs, response bodies, or exceptions containing remote text. Redirects, capability endpoints, and returned artifact links cannot silently change the authenticated destination. [OWASP HTML5 guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) supports treating web storage and remote messages as untrusted and keeping origin validation exact.

Render Markdown through a controlled parser without raw HTML. Escape tool output, reject dangerous URL schemes, and require intentional opening of external links. Disable automatic remote images/previews to prevent tracking and intranet requests. Never execute returned HTML/JS/SVG or mount generated artifacts in the app's authenticated origin. Initially offer inert text/downloads only; future previews need a separate sandbox/origin and dedicated review. Bound attachment and response sizes, handle malformed Unicode/JSON, and revoke object URLs. A malicious Hermes server or agent response is part of the threat model.

## Verification and delivery

Use [Vitest](https://vitest.dev/guide/) for pure parsing/state/identity tests and [Playwright browser projects](https://playwright.dev/docs/test-projects) for cross-browser user flows. Prefer meaningful invariants over snapshot volume or arbitrary coverage targets.

- Unit tests: owner isolation, endpoint validation, schema failures, fragmented SSE, bounded buffers, canonical root/tip handling, duplicate/reordered events, uncertain outcomes, approval state, schedule input, redaction.
- Integration tests: deterministic fake Hermes exercising the actual HTTP client; then pinned disposable Hermes with synthetic profiles, test credentials, mock model responses, disabled external tools, and temporary volumes. Verify public behavior rather than private implementation details.
- Bot Mode integration tests: discover two managed bots from backend metadata; open their canonical chats; execute a real Hermes teammate handoff with deterministic model responses; observe backend attribution and delivery; exercise an existing native group room and bot-owned routine. Chat replies alone do not pass this gate. Close the browser during supported native background work and verify that reopening recovers Hermes-owned state.
- Browser tests: separate HTTPS application/API origins, allowed and denied preflights, profile-specific auth, hidden canonical chat, compaction, concurrent sends, disconnect/reconnect, token rotation, cancel/approval, routine mutations, and refresh with no stored credentials.
- Deployment topology tests: disposable standalone and containerized Hermes, remote HTTPS through a reverse proxy, path-prefixed endpoints, and emulated private-network access. Exercise the same client contract across these arrangements without host-specific branches.
- Adversarial tests: XSS payloads, malicious Markdown/links, oversized streams, cross-profile late responses, hostile capability URLs, redirect credential leakage, third-party request detection, storage/cache inspection, and confirmation that no content reaches the asset host.
- Manual release checks: actual Safari/iOS, keyboard/screen reader, narrow layouts, VPN/local-network permission denial, offline/recovery, and long histories. Playwright WebKit is valuable but does not replace an actual Safari device check.

PR CI runs format/lint/type checks, focused tests, production build, dependency/secret/license scans, and E2E against fake services. Scheduled compatibility jobs and release gates run pinned real Hermes fixtures for candidate supported versions; supported versions are added only after passing. Tests use no personal servers, user credentials, external model accounts, or live LLM spend. Any test-created files/volumes are disposable.

Run untrusted pull-request code with read-only repository permissions and no release, deployment, or signing credentials. Separate release jobs from contributor test jobs; publish only reviewed commits through a protected release workflow. Prefer short-lived deployment identities where supported, and never give a preview build production privileges. Keep synthetic test evidence separate from release assets so fixture credentials cannot be mistaken for user connection settings.

Pin dependencies and CI actions, review lockfile changes, minimize install scripts and runtime dependencies, and require review for authentication/rendering/deployment changes. Publish security reporting instructions, SBOM, source tag, checksums, build provenance and signed attestations using a documented trust identity. Establish deterministic build checks where practical; do not label releases reproducible until independently verified. Review upstream licenses before copying code/assets; protocol reuse is preferable to importing desktop internals. Open-source license and branding rights remain explicit release decisions.

## Hosting and packaging

Use [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) for our production distribution, with no request-proxy handler and no D1, KV, R2, Durable Objects, queues, or AI bindings. Cloudflare-specific files remain deployment adapters. Separate production from previews; previews use synthetic data and must not be recommended for entering real Hermes keys. Keep a stable production origin for the user's CORS allowlist. Release immutable hashed assets, short-cache entry HTML, version manifests without user data, and a tested rollback procedure.

Publish a static archive plus a non-root ordinary HTTP-server container with health check and documented TLS/reverse-proxy setup. Self-hosting supports configurable base paths and equivalent security headers, builds with no vendor secrets, and works with outbound access to vendor domains blocked after installation. The container serves the app; it does not need to bundle Hermes or proxy its traffic. Optional same-origin user-owned reverse proxy deployment can be documented separately and does not prove compatibility for our hosted origin.

Keep the sales website and future licensing service on separate application boundaries. Native purchases must never identify or authorize a Hermes profile; local entitlement verification and sensible offline behavior belong to a later commercial design. Do not add purchase/account requirements to self-hosted web builds by accident.

## Milestones and decision gates

Effort bands are planning estimates for an experienced small team, not delivery commitments. Re-estimate after the spike; security review and upstream changes can dominate elapsed time.

| Phase | Scope and acceptance | Indicative effort |
| --- | --- | --- |
| 0 Bot Mode compatibility and privacy spike | Separate-origin browser connects to disposable Hermes fixtures; prove the complete auth/interface contract, managed roster, canonical chats/compaction, native teammate handoff, existing group room/driver, routines and runtime controls; establish supported versions and a pass/fail matrix | Re-estimate against full Bot Mode access; high uncertainty |
| 1 Foundation | Repository boundaries, CI, fake server, schemas, memory-only credentials, endpoint validation, CSP, static/container outputs; no personal infrastructure | 4–7 days |
| 2 Bot Mode vertical slice | Discover managed bots, open canonical history, send/observe/stop/approve, perform a native teammate handoff and use an existing group room; isolation and recovery tests pass | Re-estimate after phase 0 |
| 3 Routines and hardening | Bot-owned routine controls, room/background-work recovery, adversarial tests, real-Hermes contracts, actual-browser checks, privacy network audit | Re-estimate after phase 0 |
| 4 Release candidate | Docs, compatibility policy, license review, signed/provenance artifacts, independent self-host smoke test and rollback rehearsal | 3–7 days plus review |

Phase 0 must prove the required Bot Mode behaviors together through supported interfaces from the hosted web origin. Network reachability, generic REST chat, and canonical-session lookup are partial results, not a working-product verdict. Missing managed roster discovery or native coordination is a blocker to resolve. A generic chat harness may be used internally to test transport, but is not a product fallback or an acceptable completion milestone.

If stock interfaces cannot satisfy the required experience, record the missing contract and choose among a supported newer Hermes version, upstream API improvement, a separately authorized user-owned adapter for missing functionality, or deferral. A plugin/helper is never silently added to onboarding. No bypass of dashboard security guards or vendor relay is an acceptable spike workaround.

## Risks and decisions still required

| Risk | Response or release gate |
| --- | --- |
| REST and desktop canonical semantics diverge | Compaction/concurrency fixtures; block Bot Mode claim until passing |
| Browser cannot authenticate/reach selected endpoint | Certified connection recipes and actionable local diagnostics; no universal-connectivity promise |
| Hosted JS or dependency compromise exposes keys | Minimal trusted scripts, strong review/provenance, CSP, memory-only secrets, pinned self-host option |
| API key privileges exceed UI needs | Explain host authority; prefer future server-scoped credentials when available, never imply UI scoping restricts the key |
| Job ownership/timezone behavior differs | Contract tests and read-only fallback; gate mutations independently |
| Protocol drift | Pinned compatibility fixtures and capability-based adapters; actionable unsupported-version state |
| Core Bot Mode methods cannot be reached from the hosted origin | Resolve a supported authentication/interface contract before claiming a working app; no generic-chat substitution |
| Users expect advanced administration/computer parity | Keep advanced UI separately scoped while preserving required native Bot Mode behavior |
| Privacy overstatement | Publish concrete data flows, provider metadata disclosure, and hosted-code trust limitation |

Decide before implementation scope is locked: the smallest administration surface beyond existing managed bots/rooms/routines; target browser support; whether optional local endpoint persistence is acceptable; product name/domain; open-source license and contributor policy. Decide during phase 0: the complete Bot Mode interface/authentication contract, canonical continuity, native coordination behavior, exact retry/recovery behavior, approved connection recipes, and minimum supported Hermes version. Genuine underlying Bot Mode operation is a fixed requirement. These decisions require reproducible Hermes fixtures, not access to any user's personal infrastructure.

The release gate is a minimal interface that actually operates underlying Hermes Bot Mode, with independently hostable artifacts and verified absence of vendor data paths. Demonstrate discovery of real managed bots, persistent canonical conversations, a native teammate handoff, an existing group discussion, and a bot-owned routine. Advanced administration, native apps, and commercial services expand from that tested foundation.

## Installation, distribution and maintenance clarification

Web hosting needs trusted HTTPS, static file/header support and deployment rollback; Hermes runtime requirements belong only to the integration host. See docs/HOSTING.md for provider suggestions, currently ordinary non-affiliate links. Public source and preview packages are distributed through the descriptive `enterkey-io/hermes-workspace` repository and tagged releases. Product naming remains undecided. Normal installs do not need a fork: docs/UPDATES.md defines agent-managed release checks, staging/checksums, compatibility, private-configuration preservation, coordinated deployment and rollback. An unattended updater is not implemented.

The current plugin accesses actual native Bot Mode through its RPC/stdio engine; it is not yet a `ctx.register_platform` messaging channel. docs/HERMES_INTEGRATION.md records the source assessment and follow-up contract for platform setup/status and proactive/cron delivery without replacing canonical Bot Chats.
