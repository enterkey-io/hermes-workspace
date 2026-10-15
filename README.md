# Hermes workspace preview — name undecided

> **Preview limitation:** the installed-product target starts with creating the owner's administrator login and reconnects to Hermes automatically. That owner-hosted authentication service is not implemented here yet; the current preview still uses temporary browser pairing. See the [owner instance plan](docs/OWNER_INSTANCE_PLAN.md). These instructions describe the existing preview and must not be presented as the finished onboarding flow.

An independent interface to **actual Hermes Bot Mode**. The open-source web app is static HTML/CSS/JavaScript that users can host on Cloudflare Pages, a DigitalOcean droplet, or another HTTPS web host. It connects directly from the browser to the user's existing Hermes, wherever Hermes runs. Web hosting and Hermes hosting are independent.

A small integration plugin supplies the native Bot Mode API required by the current preview. Only that plugin runs on the Hermes host; it does not serve the web app, replace agents or modify Hermes core. The [channel assessment](docs/HERMES_INTEGRATION.md) distinguishes this native API adapter from a registered Telegram-style messaging channel, which remains follow-up work. Later native Mac/Windows/iOS apps can use the same client contract. No personal Hermes server was modified or public Cloudflare deployment created.

Source: [enterkey-io/hermes-workspace](https://github.com/enterkey-io/hermes-workspace). Versioned packages: [v0.2.4-preview.2](https://github.com/enterkey-io/hermes-workspace/releases/tag/v0.2.4-preview.2). The product name remains undecided; the repository name is descriptive.

## Try an existing web app

Give your Hermes agent the app's `/install` or `/install.html` page. The [agent guide](docs/AGENT_INSTALL.md) explicitly keeps the existing web app on its current host and installs/configures only the integration on Hermes. It returns a separately labeled Hermes HTTPS connection address. Choose **Connect my Hermes** in the original web app, enter that address, request browser access, and send the displayed code to your agent for local approval. You never enter an administrator/API key, and the app never redirects to the bridge.

[Owner instructions](docs/SETUP.md) explain the handoff. [Current architecture and review](docs/ARCHITECTURE.md) describe the boundaries and corrections to the earlier combined-host assumption. The adapter recognizes tested native source bundles for Hermes 0.21.0 (`29112bef`) and the reported 0.21.7 Docker source (`af0cd4df`). Package metadata such as `0.0.0` is advisory; unknown gateway fingerprints still fail closed. Run `hermes bot-web doctor` for a read-only report.

## Build and host your own web app

Use Node 26.0.0 and npm 11.12.1:

```sh
npm ci --ignore-scripts
npm run check
npm run dev
```

`npm run build` produces `apps/web/dist` and the shared client library. Those static files can be hosted independently with the supplied security headers; no backend, Hermes install or credential binding is required on the web host. `npm run serve` runs the loopback-only static preview on port 8080. Remote access needs the host's HTTPS ingress.

```sh
npm run package
```

This creates separate web/plugin/source ZIPs, a complete-site ZIP, SHA-256 manifest and `SHA256SUMS` in `artifacts/packages`, plus `artifacts/site`, a complete deployable static directory with agent-guide downloads. An extracted web archive can run its included `serve-static.mjs` outside the repository; it serves its own files and binds loopback by default. Cloudflare Pages uses the static directory and `_headers`; an ordinary web server must apply equivalent security headers. The [agent guide](docs/AGENT_INSTALL.md) and [hosting requirements](docs/HOSTING.md) include both recipes and ordinary provider links.

Leave `connection.json` as `{"bridgeUrl":null}` for a shared app. An owner may choose to publish a non-secret `bridgeUrl` on their own deployment to prefill it. It is never a user setting stored on our shared host. No endpoint is contacted before the user requests access.

## Configure the separate Hermes integration

Install/enable the `bot-web` plugin in Hermes's actual home/profile, then run:

```sh
hermes bot-web setup --bridge-url "$BRIDGE_URL" --app-origin "$APP_ORIGIN" --port 8788
hermes bot-web serve
```

`BRIDGE_URL` is the owner's trusted HTTPS native API endpoint; `APP_ORIGIN` is the independently hosted web app's exact origin. Setup generates a private administrator credential without printing it; no web files or `--web-dir` are required. Approve a code the owner supplies using `hermes bot-web approve CODE --app-origin "$APP_ORIGIN"`. A private VPN/tailnet endpoint must be reachable from the owner's device, not from the web hosting provider. Browser local-network permission and trusted certificates remain necessary where applicable.

## Privacy, native behavior and security

The web host serves software only. Browser pairing, scoped native operations and streaming go directly to the user's Hermes integration. Endpoints, credentials, drafts and displayed contents stay in tab memory; no vendor proxy, content store, account, analytics, localStorage, IndexedDB, cookies or service worker exists. Static hosting can still observe asset-request network metadata. Model-provider policy remains the user's Hermes/provider choice. Use a web build/host you trust: browser code can access its own session and displayed contents.

The bridge enforces exact Host/origin allowlists, verifier-bound five-minute pairing requests, local operator-only approval, one-hour origin-bound browser grants, connection/session isolation, bounded requests/streams and explicit operation allowlists. It strips its secret from the native agent environment. It never relaxes Hermes dashboard guards. Profiles are not OS sandboxes; agents retain the powers configured in Hermes. Network loss or an uncertain send blocks further sends until explicit reconnect/history inspection; mutations are never automatically retried.

The app opens existing managed bots and canonical Bot Chats, streams replies and tool activity, presents exact approvals and Stop, reads/sends existing rooms and lists bot-owned routines. Hermes performs coordination and teammate delivery. Closing a tab leaves native agents running; Stop is an explicit Hermes operation.

## Verification and release boundary

[Agent-managed updates](docs/UPDATES.md) use explicit GitHub releases, staged checks, preserved private configuration and rollback. A fork is not needed for ordinary installs. Installed `version.json`, plugin metadata and the release manifest identify what to update. Unattended automatic updates and signed release provenance are not implemented; the first release is a prerelease, with full production certification still pending.

[Reproducible verification](docs/TESTING.md) covers TypeScript unit/build checks, Python configuration/security tests, actual separate-origin Chromium tests, native Bot Mode fixtures, and downloaded-package CLI installation. All fixtures use disposable Hermes homes and a deterministic local model without production provider credentials. The browser happy path uses a static HTTPS server and a separate API-only real Hermes process; it checks that the owner stays on the web origin and private requests never go to the static host.

Public-hosted-to-home networking across real browsers, full production TLS/topology certification, compaction under pressure, routine execution and later Hermes builds remain release work. Use **Add existing agents** to discover ordinary Hermes profiles and enable native Bot Mode on the profiles you choose, initializing/reusing their Bot Chats. The same profiles keep their SOUL, memory, skills and settings; no placeholder or persona clone is created. See [identity and setup semantics](docs/BOT_MODE_SETUP.md). The browser does not create new profiles. Routine editing/run-now, room creation/recovery, uploads and rich Markdown are not implemented. `npm run compatibility:gate` remains intentionally closed for a full public release; [compatibility evidence](docs/compatibility/matrix.md) distinguishes local tests from production claims.

## Team and orchestrator research

The next behavior contract is guided selection of an existing orchestrator, teams, editable roles/reporting, stable @ identities, and bot-callable agent creation/attachment. This is [researched and specified](docs/TEAMS_AND_ORCHESTRATOR_PLAN.md), not implemented in the current preview. The reproducible native configuration probe uses disposable profiles with zero model prompts on both supported builds.
