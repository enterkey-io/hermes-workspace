# Executable implementation plan

> Updated 14 October 2026: the user explicitly authorized an optional integration plugin for native Bot Mode access. The preview now uses a user-hosted bot-web bridge and static browser app. Earlier text excluding a plugin as an access adapter is superseded by this authorization. See docs/SETUP.md and PROGRESS.md for the implemented boundary, current scope and evidence. Public release remains gated separately.
> Launch requirement, 14 October 2026: one installation agent must complete setup and native Bot Mode initialization, verify independent hosting and persistent service recovery, and return a usable app URL. The owner must not relay diagnostics between agents or configure server settings. Reopening/reconnecting must not require another agent exchange. [The installation contract](docs/INSTALLATION_CONTRACT.md) supersedes preview handoffs as the launch acceptance standard; its machine-readable evidence is unverified and enforced by the release gate.
> Architecture correction, 14 October 2026: deploy the static web app independently to any HTTPS host. The agent configures only the API integration on Hermes when using an existing web app. Web app origin and Hermes endpoint are separate configuration values, with no redirect or credential relay. [Current architecture and review](docs/ARCHITECTURE.md) supersede the previous combined-host flow. Product name remains undecided.

12 October 2026. Execution companion to `WEB_APP_PLAN.md`; that document remains the architecture and privacy contract. This plan does not authorize deployment, changes to a user's Hermes, model spend, or upstream contributions. Current status: **a working local web/plugin preview is verified against actual Hermes; public hosted-release certification remains pending**. Current evidence and completed work are recorded in PROGRESS.md. Historical milestone checkboxes below are not a certification claim.

## Fixed delivery contract

Deliver a static React/strict TypeScript/Vite client operating real Hermes Bot Mode: server-managed bots and metadata, persistent canonical chats, native teammate delivery, existing native rooms/driver, bot-owned routines, progress, stop, and approvals. Hermes can run anywhere; no host-specific or personal-server dependency. Distribute open-source, self-hostable GitHub artifacts usable on Cloudflare, DigitalOcean or another HTTPS host; an optional vendor-hosted copy uses the same files. Web hosting is independent of Hermes. No vendor proxy or relay. The explicitly authorized, user-hosted bot-web plugin can adapt native Bot Mode access without source patches; it is required for this preview’s independent web connection path and serves only its API. Never weaken authentication or Origin guards.

Credentials, endpoints, drafts and history remain in browser memory for this iteration. Vendor infrastructure must receive no user content, credentials, endpoint names or private metadata. No analytics, error collection, remote rendering assets or service worker. Future purchases and content-free opt-in statistics remain outside this implementation. Native Mac/Windows/iOS choices come later.

## Evidence and present feasibility

Research revisions: `1fd18277267152893a8a24792b79213e7ca3f899` (local research clone HEAD inspected for this plan) and `29112bef099274229cadff79cdff7bf7b99c4b77` (historical 0.21 reference). Neither is automatically a supported product version. Do not describe the first revision as current upstream without a fresh remote check.

| Finding at 1fd1827 | Primary source | Consequence |
| --- | --- | --- |
| Dashboard HTTP CORS is hardcoded to localhost/127.0.0.1 origins | [web_server.py, CORS middleware](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/hermes_cli/web_server.py#L801) | REST CORS configuration does not authorize a separately hosted public SPA to call dashboard HTTP |
| WS ticket creation requires a verified dashboard session; native authorize validates a loopback redirect | [auth routes](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/hermes_cli/dashboard_auth/routes.py#L289) and [ticket route](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/hermes_cli/dashboard_auth/routes.py#L556) | An API key is not proof of a supported hosted SPA dashboard sign-in |
| RPC websocket is mounted at `/api/ws`, behind sidecar authentication and Host/Origin validation | [chat_ws.py](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/hermes_cli/web_routers/chat_ws.py#L131) | WebSocket reachability alone does not satisfy the auth contract |
| `profiles.list` supplies backend profile metadata; canonical Bot Chat summary is backend-derived | [methods_profiles.py](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/tui_gateway/methods_profiles.py#L162) | Required roster must come from Hermes, not a client-created list |
| Existing native group methods include capabilities/list/state/send/log/stop/retry/approve | [methods_groups.py](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/tui_gateway/methods_groups.py#L17) | RoomLink federation REST is not a substitute |
| Native teammate tool and Bot Mode prompt/roster logic exist in backend tools | [bot_mode_dm.py](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/tools/bot_mode_dm.py), [bot_mode_probe.py](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/tools/bot_mode_probe.py) | Deterministic tests must activate these real behaviors, not synthesize browser handoffs |
| Dashboard cron includes explicit owner-profile resolution | [cron router](https://github.com/NousResearch/hermes-agent/blob/1fd18277267152893a8a24792b79213e7ca3f899/hermes_cli/web_routers/cron.py#L79) | Routine controls need tested backend ownership, not profile-label assumptions |

**Initial decision:** GO for isolated research, security/core foundation, synthetic UI and packaging. NO-GO for claiming a working hosted Bot Mode client. No supported separate-public-origin dashboard flow has been established. Stock localhost CORS and native loopback callback are concrete obstacles; the full candidate-version matrix still needs execution. An optional user-owned same-origin static deployment may be investigated as a distinct topology, but cannot pass the vendor-hosted-origin gate. An upstream supported origin allowlist plus appropriate public-client authentication/API may resolve the gap; this plan does not assume that interface exists or authorize patching Hermes to invent one.

## Execution order and dependency rules

1. Run P0.1–P0.3 first; record failures as evidence, never as a passing compatibility result.
2. Build P1.1–P1.4 while research is unresolved. Keep demo and compatibility inspection clearly labeled.
3. Complete P0.4–P0.6 against real isolated Hermes. P2 live adapters require a proved interface and P0 pass; UI components can use synthetic fixtures before that.
4. Complete P2 and P3, then P4 delivery gates. Do not report the whole plan complete when only the foundation passes.

Suggested structure (create only as needed):

```text
apps/web/src/                  # views, connection lifetime, in-memory state
packages/core/src/             # pure identities/state/rules; no orchestration
packages/hermes-client/src/    # endpoint/schema/transport/version adapters
scripts/                      # source audit, fixture orchestration, artifact checks
test/fixtures/                 # synthetic protocol payloads; never real user data
test/integration/              # fake transport + isolated real-Hermes contracts
test/e2e/                      # browser/privacy/topology checks
docs/compatibility/            # evidence per revision and connection topology
deploy/                       # static-only Cloudflare adapter and HTTP container
```

Command names below are implementation targets, not claims that scripts already exist. Pin runtime/package manager and dependency versions when bootstrapping. Use the repository's chosen package manager consistently; examples use npm.

## P0 — Prove the real Bot Mode contract

### P0.1 [ ] Reproducible source/interface inventory

Create `scripts/audit-hermes-source.*`, a revision manifest and `docs/compatibility/interfaces.md`. Read the two pinned revisions without switching a shared research checkout; fetch/check a newer candidate only in isolated research storage. For each required operation record actual method, request/response schema, source path/commit, auth scope, profile routing, transport, relevant capabilities and unknowns. Trace the desktop caller and server together for canonical chat, native send, group driver and routines. Inspect API capabilities documentation and actual handlers; do not infer routes from names.

**Acceptance:** `npm run compatibility:audit` reproducibly reports source presence and guards for pinned commits; every required behavior is mapped or explicitly missing. Audit output says “source evidence,” not integration success. Version manifest records immutable hashes. No personal credentials or infrastructure are read.

### P0.2 [ ] Disposable real-Hermes test runtime

Create an isolated fixture runner and deterministic local OpenAI-compatible provider mock. Install a pinned upstream checkout in a disposable environment, set a fixture-specific home/profile root through supported Hermes configuration, clear inherited provider credentials, and bind only local fixture interfaces. Deny runtime egress except local mock/fixture communication; install dependencies separately. Disable external tool integrations and outbound messaging, while preserving the real Bot Mode teammate/group/scheduler paths under test. Seed two synthetic managed bots using supported profile creation/metadata operations, canonical sessions, an existing room and a harmless routine. Never copy the user's home, config or keys.

**Acceptance:** `npm run fixture:hermes` starts and cleans up a real Hermes process with synthetic data; a smoke request reaches its actual handler. Provider requests hit only the deterministic mock, unexpected requests fail, and no model spend is possible. Evidence lists real modules exercised and mocks used. Mocking a server response or stubbing an entire dispatcher cannot pass this task. If executable setup is unavailable, record that limitation and leave this box unchecked.

### P0.3 [ ] Separate-origin browser authentication and authorization gate

Use two HTTPS test hostnames/origins for the static client and fixture endpoint. Test REST preflights with exact allowlists, profile-specific keys, wrong keys, and redirects. Separately test dashboard sign-in/ticket acquisition/WS Origin checks. Inspect supported configuration and candidate versions for a lawful hosted-SPA flow; do not alter source, forge browser Origin, strip guards, treat `dashboard.public_url` as an unrelated frontend allowlist, or put long-lived keys in WS URLs. Test denied origins as well as success. A local localhost-origin success must be reported separately from a public hosted-origin success.

**Acceptance:** `npm run test:compatibility:auth` records browser-visible requests and result codes for allowed/denied cases, using only synthetic secrets. PASS requires actual managed-roster and room RPC from a separate public-style origin through documented auth and guards. If impossible on tested stock versions, publish a precise BLOCKED result with missing supported configuration/API and an upstream-change specification; expose an unsupported state in the app. Do not invent a live adapter to bypass this gate.

### P0.4 [ ] Canonical session and real teammate delivery proof

For both fixture bots, discover managed status and role metadata from Hermes. Resolve exact `Bot Chat` including hidden state and archive policy. Establish root versus active session after compaction, then reopen/reconnect without creating a duplicate. Verify native Bot Mode prompt/tool activation and run a deterministic teammate tool call through the real Hermes execution path; observe backend-confirmed delivery and recipient canonical history. Check whether REST `/v1/runs` actually preserves this path before choosing it for sends.

**Acceptance:** `npm run test:compatibility:bots` proves both identities, continuity before/after compaction, and a native delivery from A to B with backend attribution. A plain text @mention, manually labeled session, mock “delivered” event, or browser-created orchestration fails. Unknown archive/creation semantics leave creation disabled.

### P0.5 [ ] Native room, routines and control proof

Use the fixture's existing native room through real group capabilities/state/send/log/stop/approve methods and native driver. Verify room attention and member participation, server-issued approvals, stop confirmation and recovery after closing the observing browser. List bot-owned routines from the actual owner scope; exercise trigger, pause and resume on a deterministic harmless routine with delivery confined to fixture history. Check job ID collisions across profiles and timezone/last-run semantics.

**Acceptance:** `npm run test:compatibility:rooms-routines` proves room activity is native backend work and survives a browser observer disconnect; routine owner and last-run updates are backend-confirmed; stop and approvals are tied to real pending identifiers. No client-side driver/scheduler is used.

### P0.6 [ ] Publish the compatibility verdict

Create `docs/compatibility/matrix.md` and a machine-readable report keyed by commit/version, auth scheme, browser and topology. States: source-only, fixture-pass, browser-pass, blocked, unsupported. Separate individual feature results from whole-product support. Add a supported contract only when P0.3–P0.5 pass together.

**Acceptance:** `npm run test:compatibility` exits unsuccessfully for an uncertified release target and reports missing gates. Evidence includes repeatable commands, synthetic artifacts and known limitations. No supported version is guessed. An upstream API gap is an explicit external dependency, not a silently omitted feature.

## P1 — Safe independent foundation

### P1.1 [ ] Workspace and continuous checks

Bootstrap React/Vite, strict TypeScript project boundaries, lockfile, lint/format scripts, Vitest and Playwright. Keep core/client free of React, DOM storage, Cloudflare and payment imports. Add read-only contributor CI, fixed dependency/action versions and production build.

**Acceptance:** clean install, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass; generated output is static. CI runs without user or deployment secrets. Establish a documented runtime/package-manager version.

### P1.2 [ ] Memory-only connection and transport boundary

Implement normalized immutable endpoint/base-path configuration; reject userinfo, fragments, unexpected queries, unsupported schemes and ambiguous paths. Use explicit credential scope, `credentials: omit` for bearer REST, redirect rejection, timeouts/abort and bounded JSON/event bodies. Do not generalize dashboard authentication from API bearer behavior. Connection lifetime clears secrets/drafts/history and invalidates stale async callbacks. No persistence initially.

**Acceptance:** tests cover foreign-origin capability URLs, encoded/path traversal, redirects, profile-key isolation, malformed/oversized bodies, timeout and late results after disconnect. Browser storage remains empty of all connection/content state across connect/disconnect/reload. Fixed error codes contain no remote text/URLs/secrets.

### P1.3 [ ] Typed core and synthetic fixture boundary

Define connection/profile/bot/canonical-owner identities, versioned capability results and discriminated run/approval/delivery/room/routine state. Expose verified service interfaces with unsupported results until adapters are certified. Create a synthetic transport harness for hostile and interrupted cases; clearly identify it as fake in UI/tests/docs.

**Acceptance:** owner key includes connection and routed profile; delayed responses cannot contaminate another bot; duplicate/out-of-order observations reconcile predictably; stop-pending differs from stopped; stale approvals cannot silently approve. Synthetic fixture passing never sets the real-Hermes support flag.

### P1.4 [ ] Minimal usable shell and privacy headers

Build connection form, explicit synthetic demo, compatibility result and responsive roster/conversation/activity panes. No private identifiers in routes. Render remote output as inert text initially; later Markdown must reject HTML/unsafe URLs/remote images. Bundle assets locally. Add no-referrer, nosniff, restrictive CSP, frame/object/form restrictions and appropriate Permissions Policy. Broad HTTPS connect permission is required for arbitrary endpoints and must be disclosed; WSS only when a verified adapter needs it.

**Acceptance:** keyboard/focus/narrow-layout smoke tests pass; untrusted text executes nothing and triggers no automatic remote fetch. Browser network audit sees static assets plus explicitly selected fixture endpoint only. Unsupported core access shows a clear blocker, never a generic-chat replacement branded Bot Mode.

## P2 — Real Bot Mode vertical slice (depends on P0 certification)

### P2.1 [ ] Managed roster and canonical history

Implement certified roster/metadata schemas, exact canonical resolution, bounded history pagination and owner-scoped caches. Keep server IDs and root/tip identities separate. Bot opening does not create arbitrary chats. Use source-verified managed-profile markers; do not infer bot status from every profile.

**Acceptance:** two real fixture bots appear with backend metadata; selection/reload preserves canonical server history; compaction and simultaneous clients do not create forks/duplicates; wrong-profile data never displays.

### P2.2 [ ] Send, observe, recover, stop and approve

Use the certified native execution path, existing session identity and server history loading. Add idempotency only with verified server semantics; keep an uncertain send's exact payload/key and reconcile before retry. Stream with bounded buffers/backoff and tested cursor or status/history reconciliation. Render server-issued approval context with explicit approve/deny.

**Acceptance:** real fixture send/stream/stop/approval passes; terminal cancellation waits for server confirmation; reconnect neither duplicates output nor automatically approves; expired retention produces an explicit gap; reload reconciles history without claiming exactly-once delivery.

### P2.3 [ ] Native teammate and existing rooms UI

Expose backend-confirmed native handoff status and attribution. Open existing rooms and display native driver state, events and attention. Wire send/stop/approval/retry only to certified methods and semantics; do not invent client orchestration or require new-room administration.

**Acceptance:** browser demo has A call B through native tooling, then shows a native existing-room discussion. Closing/reopening the client recovers backend-owned activity. A text mention alone is never displayed as confirmed delivery.

## P3 — Routines, hardening and portability

### P3.1 [ ] Bot-owned routine controls

Show owner, schedule/timezone, status and last run; implement certified run/pause/resume with explicit pending/failed/uncertain outcomes. Re-read after ambiguous mutation failures; avoid blind retry. Defer creation/editing until separately verified.

**Acceptance:** two bots cannot mutate each other's identically named/numbered routine by UI mix-up; actions update authoritative state; fixture routine runs with browser closed and appears on reopen.

### P3.2 [ ] Privacy and adversarial regression suite

Test credential redirects, hostile returned URLs, XSS/Markdown, malformed JSON/Unicode, large streams, remote images, stale callbacks, cache/storage and dependency network behavior. Capture asset-host traffic and assert no private strings from fixtures reach URLs, bodies or logs. Keep diagnostic exports local and redacted by construction.

**Acceptance:** `npm run test:privacy` fails on any credential/content/endpoint leakage or forbidden storage; all hostile fixtures remain inert. No service worker, analytics SDK or hidden vendor request is included.

### P3.3 [ ] Browser/topology/accessibility matrix

Exercise Chrome/Firefox/WebKit with isolated standalone/containerized Hermes, HTTPS reverse proxy and path-prefixed endpoints. Test permission denial/private-network behavior and equivalent client contracts without host-platform branches. Complete manual actual Safari/iOS, keyboard and screen-reader checks before claiming those platforms.

**Acceptance:** `npm run test:e2e` passes declared automated targets; manual checks have dated evidence or remain explicitly unsupported. Hosting provider names never determine capability flags. No personal endpoint is used.

## P4 — Reviewable release artifacts (publishing is separate)

### P4.1 [ ] Static and container outputs

Build Cloudflare Workers Static Assets configuration with no request handler/proxy or data bindings, a static archive and a non-root ordinary HTTP-server image with health check. Support documented base paths and equivalent headers. Supply TLS/reverse-proxy instructions for self-hosting; no license or vendor account required.

**Acceptance:** `npm run package` produces inspectable artifacts; container smoke test and independent static-server smoke test pass; installed self-host build works with vendor domains blocked. Configuration contains no secrets, user endpoint defaults or fixture credentials. Do not deploy as part of this task.

### P4.2 [ ] Release documentation and supply-chain evidence

Write README setup/demo/unsupported guidance, privacy data-flow disclosure, compatibility policy, SECURITY reporting instructions and rollback procedure. Review licenses and select project license/branding before publishing. Produce source-tag mapping, SBOM, checksums and provenance; signed attestations require the actual configured release identity, never fabricated claims. Keep contributor checks separate from protected release permissions.

**Acceptance:** another person can build/self-host using only repository artifacts; evidence states exactly which real Bot Mode versions/topologies pass. No reproducibility/signing claim appears without proof. Artifacts and release instructions are ready for review; any missing license/domain/account decision is listed precisely.

### P4.3 [ ] Final acceptance demonstration

Run the complete isolated browser scenario: connect → discover two managed bots → reopen persistent canonical history → native A-to-B handoff → existing room/driver → bot routine run/pause/resume → server approval and stop → browser-close/reopen recovery. Include privacy/storage/network assertions and test results.

**Acceptance:** all core actions operate real isolated Hermes, deterministic provider only, with no personal infrastructure/spend. Hosted separate-origin authentication passes intact. Static/self-host artifacts pass. If any core gate is blocked, deliver completed foundation/evidence honestly and leave “working Bot Mode product” incomplete.

## Later work, deliberately outside this execution

Native Mac/Windows: evaluate system-browser auth, credentials, networking, signing and update trust before choosing shell technology. iOS: independently prove redirects, lifecycle/background limits and transport. Keep sales/licensing isolated from Hermes identity; optional statistics must exclude content and private metadata and require consent. Advanced administration, new rooms, federation, computer control, uploads and optional enhancement plugins get separate contracts after the core release.

## Installation, distribution and maintenance clarification

Web hosting needs trusted HTTPS, static file/header support and deployment rollback; Hermes runtime requirements belong only to the integration host. See docs/HOSTING.md for provider suggestions, currently ordinary non-affiliate links. Public source and preview packages are distributed through the descriptive `enterkey-io/hermes-workspace` repository and tagged releases. Product naming remains undecided. Normal installs do not need a fork: docs/UPDATES.md defines agent-managed release checks, staging/checksums, compatibility, private-configuration preservation, coordinated deployment and rollback. An unattended updater is not implemented.

The current plugin accesses actual native Bot Mode through its RPC/stdio engine; it is not yet a `ctx.register_platform` messaging channel. docs/HERMES_INTEGRATION.md records the source assessment and follow-up contract for platform setup/status and proactive/cron delivery without replacing canonical Bot Chats.
