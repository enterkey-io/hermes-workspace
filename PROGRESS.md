# Implementation progress

14 October 2026. The user authorized an optional user-hosted integration plugin. This supersedes the earlier plugin exclusion and resolves the decision needed to continue the independently hosted web preview.

## Implemented and verified

- React/strict TypeScript static web app, desktop/mobile layout, original minimal bots workspace, built static assets and portable packaging.
- Direct browser-to-personal-Hermes bridge, normal Hermes plugin discovery and CLI registration, one persistent native stdio process, native room lifecycle, no Hermes source patches.
- Existing managed roster and canonical Bot Chat; normal interactive resume preserves approvals and stored runtime/history semantics. Observer-only lazy resume was found inappropriate by a real approval test and removed.
- Native streaming, tool progress, exact bot/room approval operations, Stop, existing room history pagination/send and owner-scoped routine listing.
- No vendor data API, proxy, relay, account or telemetry. Memory-only client credentials/state. Bridge credential removed from the native child environment. Exact origin/Host boundary, scoped session ownership and bounded resource use.
- Unsafe native-reader termination fails closed. Stream loss and uncertain send responses block further sends until explicit reconnect. Stale responses cannot update another conversation, and no mutation is automatically retried.
- Isolated unmodified Hermes 0.21.0 native test passed canonical continuity, actual message_agent tool injection and teammate delivery, native room driver output, owner-specific routines, approval denial preserving a synthetic test file, and stopping an active turn.
- Thirteen Python security/lifecycle tests and 44 TypeScript tests pass; type/lint/format/build checks pass.
- Four browser tests passed against the built UI and real plugin on separate localhost HTTPS origins, including native approvals and Stop, storage/privacy boundaries and lost-stream/lost-acknowledgment handling. Desktop/mobile screenshots were visually inspected.
- Independent ordinary Node static host smoke test passed assets, security headers, query-credential rejection and mutation/data-route denial. Preview archives passed integrity and secret/state path exclusion checks.
- Normal enabled-plugin discovery and `hermes bot-web --help` passed in a disposable home. Native integration file digests validate the tested build.

## Honest release boundary

This is a working local preview, not a public hosted-release certification. Tests use a deterministic local model and a disposable certificate exception. Real public Cloudflare-to-home networking and certificate trust, compaction under pressure, native routine execution and future Hermes versions are still pending. Existing bot/canonical chat setup happens in Hermes first. Room creation/recovery and routine editing/run-now are not implemented.

The old stock-dashboard CORS findings remain valid historical evidence; the new optional bridge has a separate explicit security boundary and never relaxes those guards. The production certification gate stays closed.

No personal infrastructure, keys or model account was used. No GitHub repository/PR was created and no public service was deployed. CI files were authored; remote CI has not run.

## Agent-installed owner experience update

The owner-facing first run has been redesigned. The public front door explains the app and has no address/token fields. Product naming stays undecided. The owner hands `/install` to their Hermes agent; it can also fetch `/install.md` without JavaScript and download checksummed ZIPs from `/downloads/`. The owner receives one private URL from their agent.

Historical combined-host implementation (superseded below): the plugin had setup/approve/revoke commands, generated a private administrator credential on the owner’s host, and served the static app and native API together. The self-hosted page detects its own server and uses a five-minute, verifier-bound pairing code; the browser receives an origin-bound one-hour credential rather than the administrator secret. Unknown browser approvals require the local operator credential. Credentials are never put in owner URLs.

19 Python boundary/setup tests and five actual browser tests passed. The exact downloaded-package installation sequence passed in a disposable Hermes home, including CLI setup/serve/approve/revoke and the native roster, with zero model turns. Desktop/mobile first-run pages were visually inspected. The existing private tailnet preview route serves the new introduction, installation page and package manifest. No owner server was installed or modified.

## Private preview availability repair

The tailnet preview returned HTTP 502 after its development-session server stopped. Its private HTTPS route was intact. The loopback static server now uses a dedicated local user supervisor with restart-on-exit and login startup. This is development-host setup only, excluded from distribution packages, and changes no other services or network routes. HTTPS homepage, installation HTML/plain text and all preview package downloads/checksums were verified through the private route.

## Independent hosting correction

The original independent-hosting contract is restored. The app stays on its own web origin and pairs directly with a separately configured Hermes endpoint. The plugin is API-only; setup takes separate `--bridge-url` and exact `--app-origin` values, with no web directory. Both root plans, owner/agent guides, standalone packaging and architecture review now reflect those boundaries.

44 TypeScript tests, 20 Python boundary/configuration tests and six actual separate-origin browser tests pass. The browser suite proves native Bot Mode chat/controls from the separate static host, exact origin denial, memory-only state and absence of credentials/content requests to the web host. Further publication/package checks are recorded with the actual release when complete. The owner’s separate Hermes installation is not yet configured by this development task.

The current plugin uses native Bot Mode RPC and is not yet a registered messaging platform/channel. Proactive channel/cron delivery is explicitly follow-up work. Hosting requirements/provider references and a tagged-release update/rollback procedure have been documented. A fork is not required for an ordinary installation. The descriptive public repository target is `enterkey-io/hermes-workspace`; product naming remains undecided.

The initial source is now public at `https://github.com/enterkey-io/hermes-workspace`. The corrected downloaded-package CLI handoff passed in a disposable real Hermes home with zero model turns, including separate bridge/app origins, no web files on Hermes, operator approval/revocation and native roster. The web archive also ran successfully from an unrelated temporary directory with no repository, npm dependencies or Hermes installation. All six separate-origin browser tests passed again for the versioned release build, and the production dependency audit reported zero vulnerabilities. Release packages exclude private state/workspace metadata and include a complete static-site archive, version metadata and checksums. The release remains a preview with the production certification gate closed.

## Reported Docker-build installation blocker fixed

Preview 0.2.1 recognizes the exact public fork source af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a, reported as 0.21.7, whose package metadata intentionally declares 0.0.0. Support is determined by a complete tested native fingerprint bundle; package labels do not reject matching code or authorize unknown/mixed code. A new read-only `hermes bot-web doctor` reports the evidence.

Approval server-request notifications/replays are translated while native approval.pending/respond remain authoritative. Unsupported non-approval prompts are declined without supplying secrets or automatic consent. Native regression passed on both revisions; the new source passed six separate-origin browser tests and packaged CLI doctor/setup/serve/approve/revoke/roster with zero model turns. 27 Python tests and 44 TypeScript/build checks pass. Container private ingress and an optional owner-controlled reverse-SSH/Tailscale Serve route are documented without relocating the web app. No live owner infrastructure has been modified or declared tested.

## Owner-reported installation and instruction corrections

The owner subsequently forwarded a successful installation report from their own Hermes agent: plugin 0.2.1, af0cd4df and five matching gateway fingerprints, private mode-0600 configuration, and bridge port 8798 after finding an unrelated MCP service on 8788. The agent reported allowed-origin preflight 204, denied-origin/unauthenticated 403, and independent web app HTTP 200 through the actual private SSH/Tailscale route. These are reported checks, not independent development-agent verification. No private endpoints, credentials, SSH identities or owner content are committed; see `docs/compatibility/owner-install-report.json`.

Owner browser pairing and native roster verification remain pending. The agent reports background bridge/tunnel processes that survive the conversation ending but need relaunch after a gateway/pod restart; permanent supervision is not configured. Instructions now require independent port selection in each namespace, preservation of existing services/routes, a two-address owner handoff with five-minute pairing retry guidance, and separate infrastructure/browser/restart statuses. Permanent setup must cover both the bridge and any tunnel; background-only tests must be labeled temporary. Traffic transits and terminates TLS at the chosen proxy, while Hermes retains persistent conversations.

The app's copied agent message now points to maintained installation instructions on main, while executable downloads remain pinned to an immutable release. Documentation updates do not replace published release ZIPs or automatically update existing self-hosted copies.

The instruction/link update passed type, lint, formatting, all 44 TypeScript tests and the production build. The generated plain-text guide matched the source when fetched over the existing tailnet web route; shared connection settings remain unset. No owner pairing, native API access, model calls, route changes or service supervision changes were performed for this documentation update.

## Browser-reported empty roster and stream failure

The owner reached the workspace after pairing but reported zero bots/rooms and an event-stream request failure. The workspace renders only after native list responses succeed; ordinary agent profiles are not necessarily managed bots. The precise cause of the empty roster and live stream failure remains awaiting sanitized diagnosis by the owner's Hermes agent. Event-stream preflight through the real ingress returned 204 from the development host, without credentials or content access; that does not prove authenticated streaming from the owner's browser.

The UI now waits for the stream readiness handshake before enabling chat and distinguishes opening, live and failed streams in the connection indicator, welcome view and activity status. Stream errors identify the affected endpoint and a safe error code; sends stay blocked. Empty rosters and uninitialized Bot Chats have actionable agent instructions, and Refresh bots reloads native lists after setup without requiring a new pairing. List failures remain on the connection screen rather than becoming empty successful workspaces. Remote HTML/invalid stream handshakes are rejected; stream startup/idle timeouts have a distinct safe error code.

Agent setup now explicitly includes native Bot Mode readiness, checking the intended Hermes home, reusing existing canonical chats, and creating one starter bot only when authorized by the owner's setup request. The documented local native create/configure/create-session/title procedure passed against both supported revisions in isolated homes with zero model turns, including reuse through the real bridge adapter. A reproducible `scripts/fixture/bot_mode_setup_smoke.py` records that contract without database inserts. All nine browser regression cases and 47 unit tests passed; the empty-roster test was corrected to accept an attached, zero-height empty navigation before rerunning successfully. Desktop/mobile empty states were visually inspected. No owner configuration, bots, services, routes or credentials were changed by this development work.

## Heartbeat starvation fix after owner-agent diagnosis

The owner forwarded a follow-up report: correct runtime/home, zero native managed bots/canonical chats, ready frames over both loopback and HTTPS, but no heartbeats in either 50-second observation. Their agent also reported using global revocation to clean up probe leases, invalidating owner tabs. That report is sanitized in `docs/compatibility/owner-stream-report.json`; the proposed earlier-port-outage explanation is not treated as proven.

The bridge's old queue-idle timer could starve browser heartbeats when unrelated native events kept arriving but were filtered out of the browser's session scope. A targeted ASGI stream regression failed before the fix. Plugin 0.2.3 uses a monotonic heartbeat deadline independent of queue activity and rechecks authorization before delivering an event after a wait. Stream/auth boundary tests pass, including idle/busy-filtered heartbeats, closed-lease delivery prevention and operator-probe cleanup preserving an owner browser grant. No Hermes native/core source was patched.

Installer, update and repair instructions now require 50 seconds of observed stream frames, native Bot Mode initialization by the agent without Desktop/model prompts, and per-probe DELETE cleanup rather than global revocation. The operator revoke command's help/output explicitly states that it invalidates all browsers. The new repair guide keeps web hosting, existing local ports, private configuration and HTTPS/tunnel routes intact. The development task has not updated the owner's live plugin, initialized their bots or re-paired their browser; that owner-side verification remains pending.

The corrected actual native fixture passed a 50-second HTTPS stream observation with readiness at 54 ms and heartbeats at 15.06/30.06/45.06 seconds, closing only its probe lease. All nine browser tests passed, including 40 seconds idle on an empty roster. The full native fixture passed canonical continuity, teammate delivery, room driver, routine ownership/listing, approval denial and Stop with 17 deterministic local model turns. 31 Python boundary tests and 47 TypeScript tests pass; see `docs/compatibility/heartbeat-fix.json`. The fixture certificate exception and pending owner-host verification remain explicit.
