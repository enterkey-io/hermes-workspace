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
