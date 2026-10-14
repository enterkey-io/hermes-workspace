# Connect an independently hosted web app to Hermes

These instructions are for the owner's existing Hermes agent. The application is an independent web interface to **actual Hermes Bot Mode**. Its product name is undecided; the software packages are currently named `workspace-*-preview.zip`. The `bot-web` package is a small integration plugin, not the web app.

**Web hosting and Hermes hosting are independent.** The web app is static HTML/CSS/JavaScript that can run on Cloudflare Pages, a DigitalOcean droplet, or another HTTPS web host. Only the native integration plugin runs on the Hermes host. It exposes a narrow authenticated API; it does not host or proxy the web app. Do not move the web app to the Hermes server as a prerequisite.

## What to deliver for this test

Use the existing web app URL supplied in the owner's request. If this guide is opened inside that app, its origin is the web origin. A GitHub guide URL is not the app URL. **Keep using that web app for this test**, unless the owner explicitly chooses a different web host. Configure their separate Hermes installation to accept browser connections from this exact web origin. Return both:

- **Web app URL:** the existing web app the owner opens.
- **Hermes connection address:** a separate trusted HTTPS endpoint the owner's browser can reach.

The owner opens the web app, clicks **Connect my Hermes**, enters that connection address, and requests browser access. They send you the displayed code. On their Hermes host, approve that exact code and web origin:

```sh
hermes bot-web approve ABCD-EFGH --app-origin "$APP_ORIGIN"
```

The owner stays on the web app's original URL. Browser pairing and bot traffic go directly to the separate Hermes endpoint. No Hermes administrator key is entered into the web app or saved on its host. If this guide was read on GitHub rather than inside the web app, use the **web app URL supplied in the owner's message**; do not treat github.com or raw.githubusercontent.com as the app origin. If no web URL was supplied, establish that choice before configuring an allowlist.

## Step 1 — Get the packages and inspect Hermes

The public source repository is [enterkey-io/hermes-workspace](https://github.com/enterkey-io/hermes-workspace). The current software release is [v0.2.1-preview.1](https://github.com/enterkey-io/hermes-workspace/releases/tag/v0.2.1-preview.1), a preview. The [maintained installation guide](https://raw.githubusercontent.com/enterkey-io/hermes-workspace/main/docs/AGENT_INSTALL.md) receives instruction corrections between software releases. Packages remain pinned to one immutable release; do not install executable code from a moving branch. Use these explicit versioned public download URLs for an installation that does not depend on a development machine:

- [Manifest](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/workspace-manifest.json)
- [Checksums](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/SHA256SUMS)
- [Hermes integration plugin](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/workspace-plugin-preview.zip)
- [Web app](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/workspace-web-preview.zip)
- [Complete static site](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/workspace-site-preview.zip)
- [Source package](https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.1-preview.1/workspace-source-preview.zip)

The running development preview also mirrors these paths on its own origin for the same-tailnet test. Use that origin only when the owner supplied the preview URL, never infer it from a GitHub page:

- `/downloads/workspace-manifest.json`
- `/downloads/workspace-plugin-preview.zip` — native integration, installed on Hermes.
- `/downloads/workspace-web-preview.zip` — static web app, needed only for a new web deployment.
- `/downloads/workspace-site-preview.zip` — complete static site with guide downloads.
- `/downloads/workspace-source-preview.zip` — optional source/build instructions.

Download over trusted HTTPS. Check each archive's size and SHA-256 against the manifest or `SHA256SUMS` before extracting; the complete site's digest is in `SHA256SUMS`. Use one explicit tag for every file. Reject absolute paths, `..` traversal and symlinks in archive entries. Extract into fresh temporary directories. Do not execute a remote shell script through a pipe. If GitHub or a supplied private mirror is unreachable, report that specific blocker rather than guessing another source.

Discover the existing Hermes executable/Python runtime, actual `HERMES_HOME`/profile, installed version/build, native managed bots and their existing Bot Chats, and the host's service supervisor/private HTTPS arrangement. Do not dump keys, `.env` or full configuration into conversation. Olares, Kubernetes, a particular OS, or a particular model provider is not required.

The adapter recognizes two tested native gateway bundles: **29112bef099274229cadff79cdff7bf7b99c4b77** (Hermes 0.21.0) and **af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a** (the source reported as Hermes 0.21.7 in the Docker installation). The latter intentionally declares distribution metadata **0.0.0**; that label is not a rejection reason. Matching a complete tested gateway fingerprint set determines compatibility. Unknown/mixed gateway files are refused; the version string alone never grants support. Do not downgrade or patch Hermes to satisfy this preview. Check FastAPI/Uvicorn are present in Hermes's existing runtime. If no native managed bot/initialized Bot Chat exists, explain that prerequisite and let the owner choose it through Hermes's existing tools; do not create substitute chat state.

## Step 2 — Keep or deploy the web app

For this test, set `APP_ORIGIN` to the exact HTTPS origin of the existing app supplied by the owner (scheme, hostname and non-default port, without a path or trailing slash). An in-app copy of this guide shares that app's origin; the public GitHub copy does not. There is no web deployment to perform in the existing-app path.

For an owner who wants a new installation, deploy the **complete static site** or **web package** independently to the HTTPS host they choose. The package's root contains `index.html`, `assets/`, `_headers`, `install.html`, `connection.json` and `version.json`. It contains no Hermes runtime, operator key or user data. Use the final web origin as `APP_ORIGIN`; a temporary preview hostname does not authorize the final domain.

Required hosting capabilities: trusted HTTPS, static HTML/JS/CSS/JSON serving at the site root, equivalent supplied security headers, and a way to replace/roll back a deployment. No Hermes runtime, model/GPU, database or backend function is required on the web host. Source builds use Node 26.0.0/npm 11.12.1 and Python 3; prebuilt static hosting needs none of that tooling at runtime. If no provider is preferred, suggest [Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/direct-upload/) or [DigitalOcean static hosting](https://docs.digitalocean.com/products/app-platform/how-to/manage-static-sites/), and respect the owner's budget/account choice before purchasing anything. [Hosting requirements and choices](https://github.com/enterkey-io/hermes-workspace/blob/main/docs/HOSTING.md) keep provider links separate from connection code; current links are not affiliate links.

- **Cloudflare Pages:** upload the extracted static site as a Pages project, or use its source with build command `npm run build` and output `apps/web/dist`. Apply the included `_headers`. Do not create Workers/functions, databases, a Hermes proxy, account storage or secret bindings. The hosting provider serves software assets only.
- **DigitalOcean or another server:** serve those files using the owner's normal HTTPS static server, with equivalent security headers from `_headers`. The included `serve-static.mjs` can run with `node /path/to/extracted-web/serve-static.mjs`; it binds only `127.0.0.1:8080` by default and needs the host's HTTPS reverse proxy. No Hermes installation is needed on this machine.
- To keep the agent guide's download links usable on a new site, copy the three verified ZIPs and manifest into its `downloads/` directory. A source build's `npm run package` also produces `artifacts/site`, a complete deployable static directory with those downloads. A plain web archive does not recursively contain its own release archives.

Leave `connection.json` as `{"bridgeUrl":null}` for a general-purpose/shared app. The owner enters their connection address on the separate connection screen; it is not stored. On an owner's own deployment only, they may explicitly choose to replace it with `{"bridgeUrl":"https://their-bridge.example"}` to prefill the field. That file is public to anyone who can load their site: it must contain no credential. Never put a private endpoint into our shared deployment, a query string, analytics or a vendor environment variable. No connection or private network scan starts until the owner requests access.

## Step 3 — Establish the separate Hermes endpoint

Choose a **trusted HTTPS bridge URL** on the Hermes host's existing private access arrangement. Call this `BRIDGE_URL`. It is a different address and role from `APP_ORIGIN`. Use a hostname root rather than a path prefix for this preview.

The **owner's browser/device** must reach this address; Cloudflare or the web server does not connect to Hermes. For a private home server, prefer its existing tailnet or VPN plus trusted HTTPS. The owner needs that VPN on the device they use. A public static web app can connect to a private endpoint through the owner's browser; it does not need a tunnel into our infrastructure. Some browsers ask the owner to allow local-network access. Do not disable browser security or silently expose Hermes publicly to work around a denied permission.

Check listeners in the namespace where the bridge will actually run before choosing `BRIDGE_PORT` (an unprivileged port from 1024 to 65535). The default 8788 is only a suggestion: an existing MCP socket or another service may already use it. In one reported installation, the agent correctly selected 8798 instead. Never stop an unrelated service to free a preferred port. Record the chosen port privately and use it consistently in setup and the forwarding destination.

For Tailscale, also inspect existing Serve routes and select an unused HTTPS port, `BRIDGE_HTTPS_PORT`. These are separate port choices. Only when Serve runs in the **same network namespace** as the bridge, forward directly to the chosen loopback listener:

```sh
tailscale serve --bg --https="$BRIDGE_HTTPS_PORT" "http://127.0.0.1:$BRIDGE_PORT"
```

Set both port variables to inspected, unused numeric values before running this command. Use the actual HTTPS URL Tailscale reports as `BRIDGE_URL`. Preserve all other routes, including the web app's route. Do not enable Funnel, change ACLs or open router ports without authorization. Containers have different loopback interfaces from their hosts: use the existing ingress/service arrangement rather than assuming host loopback reaches a Hermes container. If a separate SSH forward is needed, its listener has its own independently chosen port; follow the container recipe below rather than pointing Serve at an unreachable container loopback.

A user can instead choose their own authenticated public HTTPS reverse proxy. Preserve Host, Origin, Authorization and X-Bot-Connection; disable response buffering and private header/body logging; allow long-lived event streams. Extra gateways that redirect cross-origin API requests to HTML login pages are not automatically compatible. Do not promise those configurations work without a browser test. Do not weaken Hermes dashboard authentication or CORS.

## Step 4 — Install only the plugin on Hermes

The plugin is required for this preview's tested Hermes build. Hermes supports platform/channel plugins for external messaging systems; this preview instead exposes native Bot Mode's canonical-session/room interfaces directly. It is a real plugin and native Bot Mode adapter, but **not yet a registered messaging channel** in `hermes gateway setup`. Do not claim Telegram-style channel registration, proactive channel notifications or cron delivery are implemented. [The channel assessment](https://github.com/enterkey-io/hermes-workspace/blob/main/docs/HERMES_INTEGRATION.md) records that boundary and the follow-up contract.

Place the extracted `bot-web` directory in `<actual HERMES_HOME>/plugins/bot-web`. Preserve an unrelated or existing installation/configuration instead of overwriting it blindly. Use the correct existing Hermes executable and home/profile context for every command:

```sh
hermes plugins enable bot-web
hermes bot-web --help
hermes bot-web doctor
hermes bot-web setup --bridge-url "$BRIDGE_URL" --app-origin "$APP_ORIGIN" --port "$BRIDGE_PORT"
hermes bot-web serve
```

`APP_ORIGIN`, `BRIDGE_URL` and `BRIDGE_PORT` are the real values you discovered, not example text. Repeat `--app-origin` only for another specifically authorized web origin. Wildcards and origin reflection are forbidden. The bridge URL controls the allowed Host; app origins control browser CORS and browser-credential binding. These values must not be conflated.

Setup creates `<HERMES_HOME>/bot-web/connection.json` in a private directory with mode 0600, generates an independent administrator credential, and never prints it. Web files and `--web-dir` are **not needed** on Hermes. Configuration has schema 2; setup refuses to overwrite an existing configuration. No Hermes stores or core files should change.

If the earlier combined-host preview was installed, migrate only this integration: stop its service, preserve the previous plugin and private configuration in a local mode-0700 backup outside every web-served directory, then install the corrected plugin. Move the old configuration into that backup and run the new setup with the independently chosen `BRIDGE_URL` and `APP_ORIGIN`, preserving its local port where practical. Keep its backup configuration mode 0600 and never print its credential. Reuse the existing HTTPS route when suitable; do not replace unrelated services. Restart the corrected bridge and pair again. Leave Hermes's bot/history stores untouched, and retain the backup for rollback if verification fails. Do not publish the old web-host configuration or keep serving it as the required entry point.

The doctor command reads package metadata and native source fingerprints only; it makes no model calls and does not touch private configuration. Confirm it reports supported=true and the expected matched revision before setup. If not, return its JSON as compatibility evidence without editing its pins or downgrading Hermes.

First verify this API-only service in the foreground. It binds `127.0.0.1` at the configured `BRIDGE_PORT`; the owner's HTTPS route forwards to it. Its persistent native gateway uses Hermes's existing agents, stores and provider configuration.

For a permanent installation, use the host's existing supervisor with the correct executable, user, environment and Hermes home. Cover **both the bridge and any required SSH tunnel**, including startup after the relevant gateway, container/pod or host restart, restart after failure, and a private local stop/restart procedure. Plugin/configuration files and supervisor startup definitions must persist or be restored by the deployment after a container replacement. A tracked background process or tunnel keeper that survives the agent's terminal ending does **not** prove restart durability. Avoid duplicate bridge/tunnel processes, credential-bearing command arguments and content/header logging.

If only a temporary test is authorized or supervision cannot be completed, a working background service may be handed off as **temporary test ready**. State exactly which restart will interrupt it and what remains to make it permanent; do not call it restart-safe. Do not reboot a live Hermes host or disrupt other services merely to test persistence. Record whether recovery was actually tested or only configured.

## Step 5 — Verify the actual separate-origin connection

Before claiming success, verify:

1. The web app loads over trusted HTTPS from `APP_ORIGIN`, independently of the bridge. Its static host has no Hermes credential, user-content routes or proxy.
2. Probe the real HTTPS bridge URL through the intended ingress, not just localhost. An unauthenticated GET is denied (403 is expected); it must not expose a page, roster or conversation content. This service is an API, not the page the owner should open. Agent-side HTTP probes do not establish reachability from the owner's device.
3. An OPTIONS request to `$BRIDGE_URL/v1/pairing/request` with Origin `$APP_ORIGIN`, method POST and requested header Content-Type returns 204 and **that exact** Access-Control-Allow-Origin. An unapproved origin is denied. This checks CORS, not owner approval or full browser reachability.
4. On the owner's device, with any required VPN connected, the owner opens the original web app, selects **Connect my Hermes**, enters `BRIDGE_URL`, and selects **Request browser access**. A five-minute code appears. No credential exists before local approval. If the code expires, request access again and approve only the newly displayed code; never extend expiry or bypass pairing to finish setup.
5. Approve only the code the owner sends, using `hermes bot-web approve CODE --app-origin "$APP_ORIGIN"`. The browser receives an origin-bound one-hour credential held in tab memory; it never receives the administrator key.
6. The real managed bot roster appears while the address bar remains on the original web app. Bot/history/API/event requests go to `BRIDGE_URL`; no contents or credentials are sent to the static host. Separately verify whether the service/route survive your setup session ending and document restart durability as described above.

Report three independent statuses: **infrastructure checks**, **owner browser pairing/roster**, and **restart durability**. For example: HTTP checks passed; owner pairing pending; temporary background processes, not restart-safe. This is a useful handoff, not proof of a completed owner browser test.

Do not spend model tokens, send test messages, execute tools or run routines without the owner's permission. Pairing and read-only roster verification suffice for installation. If you cannot operate the owner's browser, say which checks you completed and have them perform steps 4–6; do not invent a pass. They can disconnect to revoke that tab's grant, or run `hermes bot-web revoke` locally to revoke all current browser grants. Refresh starts a new memory-only session.

## Return this to the owner

> Open **[actual web app URL]**, then choose **Connect my Hermes**. Use **[actual Hermes connection address]** and click **Request browser access**. Send me its code and I’ll approve it. Codes last five minutes; if one expires, request a fresh code and send that one. The web app stays on its current host; your bots and history remain in Hermes.

Also state the required private-access method (if any), the three verification statuses, and any restart limitation in plain language. For a background-only pod test, say: “You can test now. Restarting the gateway/pod will interrupt the bridge and tunnel until they are relaunched; permanent startup is not configured.” Include a private local recovery procedure in the deployment record. Do not send an operator token, private configuration file or credential-bearing URL. Keep private endpoint addresses, tunnel identities and local configuration out of public repositories, release artifacts and our shared web deployment.

## Keeping the installation updated

Record the installed release/tag, component versions, verified package digests and deployment/rollback method privately. The agent can check GitHub releases on the owner's request or their chosen local schedule, download the chosen tag's matching packages, verify them, preserve private plugin configuration, replace the static deployment/plugin code and test pairing/roster again. **A fork is not required for ordinary installations.** Fork only for intentional custom source changes or a provider workflow that requires it. Follow [the complete update and rollback procedure](https://github.com/enterkey-io/hermes-workspace/blob/main/docs/UPDATES.md). This preview has no unattended automatic updater; GitHub availability is needed for updates, not normal app operation.

## Docker host without a Tailscale interface

A Tailscale interface in the Hermes pod is not required when an existing owner-controlled ingress or SSH path can expose the loopback bridge privately. For the owner's proposed Mac reverse-SSH/Tailscale Serve test route, follow [the container connection recipe](https://github.com/enterkey-io/hermes-workspace/blob/main/docs/CONTAINER_CONNECTION.md). Preserve the web app's existing route, use another unused private HTTPS port for the bridge, keep the reverse SSH listener on Mac loopback, and verify Host/Origin and the complete browser path. Conversations remain persisted in Hermes; traffic transits the chosen proxy. No Mac route is required by the product or introduced on the owner's machine automatically by these instructions.
