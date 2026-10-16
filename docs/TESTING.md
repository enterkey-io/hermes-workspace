# Reproduce the verification

The unit suites require no personal infrastructure, server endpoint or model account. The native/browser fixtures additionally require a trusted isolated Hermes checkout and Python environment. They run only synthetic state and a deterministic localhost model. Do not point these fixtures at an existing personal Hermes home.

## Unit and build checks

```sh
npm ci --ignore-scripts
npm run check
python -m unittest discover -s test/plugin -p 'test_*.py'
```

The Python stream regression sends a continuous sequence of native events belonging to another session through the actual ASGI handler. It requires scheduled heartbeat frames without leaking those events, checks idle streams and verifies that closing an operator probe leaves the owner's grant intact. A closed lease must not receive an event that was pending while it was closed. The browser empty-roster case additionally stays idle beyond the client's 35-second deadline before refreshing the roster.

`scripts/fixture/existing_agents_smoke.py`, run with each supported isolated Hermes interpreter, prepares real ordinary profiles and enables the same profiles through the actual adapter. It verifies SOUL/configuration/memory/skills bytes before and after registration, canonical reuse, duplicate prevention and refusal to replace a retired chat. A synthetic local-model turn must include the selected profile's SOUL and not the launch home's SOUL. No model prompt occurs during enrollment. The af0 native runtime may append its own `onboarding.seen.profile_build_offered` flag on the first actual chat turn; the test allows only that known housekeeping change after chat and checks all model/provider settings remain equal. Runtime auth caches are maintained by Hermes and are not identity-file preservation assertions.

Use a separate Python 3.12 environment with `test/plugin/requirements.txt` for the Python boundary tests, or the isolated Hermes environment below. CI runs these Node/Python checks with read-only repository permissions. Prior published preview checks passed remotely; each change still needs its own validation.

## Isolated real Hermes environment

Create a disposable checkout at `29112bef099274229cadff79cdff7bf7b99c4b77`, then install its own web dependencies into a virtual environment **outside the checkout**. Follow that revision's contribution instructions; the throwaway-checkout workflow supports an editable `[web]` installation with uv. No Hermes source patch is needed. Use only an upstream checkout you trust; installation and testing execute its code.

```sh
uv venv /tmp/bot-web-test-python --python 3.12
uv pip install --python /tmp/bot-web-test-python/bin/python -e '/path/to/disposable/hermes[web]'
/tmp/bot-web-test-python/bin/python scripts/fixture/native_smoke.py
```

The additional tested Docker-source revision is `af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a` from `enterkey-io/hermes-agent`. For that isolated checkout, use a separate Python 3.14 environment and its own declared dependencies:

```sh
uv venv /tmp/bot-web-af0-python --python 3.14
uv pip install --python /tmp/bot-web-af0-python/bin/python -e '/path/to/disposable/af0-hermes[web]'
/tmp/bot-web-af0-python/bin/python scripts/fixture/native_smoke.py
```

Its distribution version is intentionally `0.0.0`. The fixture reports the matched tested revision, metadata and version instead of hardcoding 0.21.0. Use this same environment for the API/browser and installer tests below to exercise the Docker-source contract. These tests run the exact source on the development host, not the owner's live Linux container. Production instructions use the owner's existing runtime; they do not install another Hermes or change its package metadata.

The native fixture clears inherited environment variables before importing Hermes, creates its own temporary `HERMES_HOME`, seeds synthetic managed bots/canonical chats, starts a local OpenAI-compatible deterministic model and runs the actual plugin/gateway. It verifies normal canonical continuity, native `message_agent` delivery into a teammate's Bot Chat, native room member output, profile-owned routine listing, denial preserving a synthetic file and an interrupted turn returning idle. Native histories and routine/room stores are temporary.

To verify first-time installation rather than seeded bots, run `scripts/fixture/bot_mode_setup_smoke.py` with either isolated Hermes interpreter. It starts with zero managed bots, calls native `profiles.create`/`profiles.configure` and `session.create`/`session.title`, confirms the resulting bot is exposed by the real adapter, and reuses its canonical chat. It checks that no model turn was submitted. It never writes session database rows directly or reads a personal Hermes home.

Approval mode is explicitly manual in the fixture, so a deterministic model cannot cause smart auto-approval to masquerade as a human approval round trip. The test action targets only a directory created inside the fixture's disposable root. Hermes performs its real approval check, the test denies it, and the fixture verifies that the protected synthetic file remains.

## Browser tests against real Hermes

Generate a short-lived test-only certificate in a temporary directory:

```sh
mkdir -p /tmp/bot-web-test-tls
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /tmp/bot-web-test-tls/key.pem -out /tmp/bot-web-test-tls/cert.pem \
  -days 2 -subj '/CN=localhost' -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost'
npm run build
```

Start these in two terminals:

```sh
/tmp/bot-web-test-python/bin/python scripts/fixture/native_smoke.py --serve \
  --cert /tmp/bot-web-test-tls/cert.pem --key /tmp/bot-web-test-tls/key.pem
```

```sh
/tmp/bot-web-test-python/bin/python scripts/fixture/static_https.py \
  --cert /tmp/bot-web-test-tls/cert.pem --key /tmp/bot-web-test-tls/key.pem
```

Then run:

```sh
npx playwright install chromium
npm run test:e2e
```

An already installed test Chromium can instead be selected through `BOT_WEB_TEST_CHROMIUM=/absolute/path/to/test-chromium`. The eleven tests use `https://127.0.0.1:5443` for the independently hosted web app (including connection and conversations) and `https://127.0.0.1:8788` for the separate API-only real Hermes bridge. The page stays on port 5443 after approval; the bridge serves no web app. An unapproved origin is also tested for pairing/preflight denial. Browser access requires code approval; no API-key field is present. No API response is simulated in the happy-path/control tests. Additional onboarding cases deliberately return an empty roster or an uninitialized bot, then verify setup instructions, disabled unavailable chats and roster refresh; a failed list request must not become an empty connected workspace. Loss tests deliberately abort the event stream or drop the acknowledgment after forwarding a real accepted send. All requests to the static host are GETs without a body, credential or query string. Pairing/API/events and requests carrying contents/authorization go only to the bridge origin. Storage remains empty, browser cookies are unused, and reload forgets the endpoint.

The Playwright configuration ignores certificate errors **only in these tests**, because this certificate is self-signed. Production code has no certificate bypass. Thus these results prove separate-origin browser CORS/auth and native execution in an isolated HTTPS topology, not trusted public certificate setup or every public-to-private network policy. Stop the two fixture processes afterwards; their temporary state is removed on orderly shutdown. Screenshots contain synthetic test messages only and are excluded from source archives.

## Public-release gate

```sh
npm run compatibility:gate
```

It intentionally fails for the current separate-origin local preview. Required remaining evidence is public independently hosted connectivity with trusted TLS, production canonical compaction behavior and native routine execution/ownership. Preserve historical stock-dashboard evidence; do not reinterpret localhost/self-host success as public-hosted certification.

## Exercise the agent’s exact installation commands

With the preview download server running (`npm run serve` after `npm run package`):

```sh
/tmp/bot-web-test-python/bin/python scripts/fixture/install_smoke.py
```

This downloads the published ZIPs and manifest, verifies hashes, installs into a disposable Hermes home, enables the real plugin, runs its actual setup/serve/approve/revoke CLI commands, and verifies the real native roster through a paired browser credential for a distinct web origin. It confirms that no web files are installed in the Hermes home; static web files live in a separate directory. It submits zero model turns. The HTTP probe in this installation test models the local reverse-proxy leg; separate browser tests verify the HTTPS UI. It does not install on personal infrastructure.

## Standalone static package check

Run the extracted web package’s `serve-static.mjs` from a working directory outside the repository. Verify its homepage/connection configuration and static headers, and confirm POST/data/API routes are unavailable. A deployment may use `artifacts/site` to include installer downloads too. The web server needs only Node for this local convenience server; a static provider needs no Node runtime or npm dependencies. It does not need Hermes or a bridge credential.

To repeat the installation smoke against an explicit public GitHub release instead of the local mirror, use:

```sh
/tmp/bot-web-test-python/bin/python scripts/fixture/install_smoke.py --release-base https://github.com/enterkey-io/pebble-crew/releases/download/v0.2.4-preview.2
```

It uses the same isolated home and zero-model-turn checks. The URL selects immutable-version-named assets; it never reads the owner’s Hermes installation.

## Chat usability regression coverage

The browser suite also checks a 28-profile picker in laptop, phone and small landscape viewports, actual wheel scrolling to the final agent, persistent action reachability, search and hidden selection retention. Chat-specific checks cover per-conversation tab-memory drafts, composer growth/focus, rich replies with code copying, no remote image fetches, preserving a reader’s history position and following the latest output. The native fixture remains isolated; these checks do not inspect the owner’s profiles or send production model requests. Vitest includes the web renderer’s raw HTML/image/unsafe-link security cases.

Owner administrator creation, local login and automatic reconnection are not implemented or certified by those tests. They have separate acceptance requirements in [the owner instance plan](OWNER_INSTANCE_PLAN.md).

## Isolated avatar playground

After `npm run build`, run `npm run test:avatars`. Set `BOT_WEB_TEST_CHROMIUM` to a local Chromium executable if needed; CI installs Playwright Chromium. These tests use their own loopback static server on port 8092 and never connect to Hermes. They cover shape/color (including white), actual changing poses, interruption/pause, live system reduced motion, large-roster instance cleanup, offscreen pose suspension, phone overflow, local photo replacement/removal and disguised SVG rejection. Photo tests generate a synthetic PNG and verify that selecting it sends no upload.

Headless Chromium does not reliably mark an automation tab hidden when another tab opens, so the automated visibility case explicitly drives the document visibility boundary; it does not certify real OS background/minimized-window behavior. That remains a separate browser/device gate. The measurement case writes ignored `artifacts/avatar-demo-measurements.json`, reporting only JavaScript pose sampling and SVG attribute writes. It does not measure complete rendering, CPU usage, memory, energy or native clients. The [avatar system plan](AVATAR_SYSTEM_PLAN.md) retains those acceptance targets.

## Installed-owner development acceptance (0.3 candidate)

The legacy pairing/browser suite above remains historical preview coverage. The
owner deployment uses first-use administrator creation and ordinary login instead.
Run `npm run test:owner-worker` for the real local Workerd/D1 runtime. It creates
private disposable keys, applies migrations, bootstraps the owner, signs in with
Better Auth, restarts the runtime, obtains a signed ticket and signs out. It needs
no Cloudflare account or remote resource.

After building, run `npm run test:owner-browser` with `HERMES_NATIVE_ROOT` and
`HERMES_NATIVE_PYTHON` pointing at one of the supported isolated checkouts. The
runner creates disposable app state, HTTPS front ends and a native Hermes bridge;
`BOT_WEB_TEST_CHROMIUM` can select an installed test browser. It verifies first-use
admin creation, primary-handle/white-avatar onboarding, secure HttpOnly cookies,
idle heartbeats beyond an accelerated lease, automatic ticket renewal, offline and
native-gateway restart recovery, preserved unsent draft and no automatic sends,
teams/role edits, photo storage and switching, password change, logout and sign-in.
The certificate exception applies only to disposable loopback tests.

Use each supported Hermes interpreter with `scripts/fixture/workspace_smoke.py`
for real model-tool proposals and exact owner approvals, selected-persona
preservation, fresh-agent creation with a restricted model grant and a synthetic
model turn, deferred tool discovery, live identity and public-handle native DM
routing. `model_grant_smoke.py` exercises the built-in Ollama Cloud credential
scope without making any model request; `connections_smoke.py` runs real MCP
sockets, native bearer storage, discovery, per-tool CAS and dashboard OAuth/PKCE.
All keys, profiles, services and model responses are synthetic. Never run these
fixtures against an owner's existing home.

The owner distribution is also extracted outside the repository and installed
using `npm ci --omit=dev --ignore-scripts`; its initialization and public setup/key
endpoints must work without source/dev dependencies. None of these tests certifies
a remote owner's supervision, trusted TLS deployment or installed update/rollback.

## 0.6 design-system and native capability coverage

`npx playwright test --config playwright.chat.config.ts` exercises populated
production chat, Settings, Add/Edit pebble, Crews, uploads/downloads, menus,
conflicting/retired drafts, browser Back, responsive layouts, motion and pin
rollback. It runs axe WCAG checks on the actual rendered states; this does not
replace manual screen-reader/device review. Use the same build root for the
static server and tests. Native owner-browser acceptance separately covers
first use, login, idle renewal, native restart, saved photo/shape switching and
account changes.

`computer_transport.py`, with the exact 0.21.7 checkout/interpreter, uses the
real native private ticket bridge and RFB filter against a synthetic framebuffer.
It verifies wrong-origin rejection, replay rejection, watcher input blocking,
human input and clean-close hand-back. It does not launch Linux Xvnc or certify
its packages/runtime on a Mac. Never run disposable fixtures against personal state.

## Review the installed UI

`npm run check:ui` enforces one app entry, one theme and shared profile forms.
`npm run test:ui-review` builds the real app at the review entry and runs the owner
UI checks with synthetic network responses. It no longer tests separate mockup
screens. Production browser tests use `playwright.chat.config.ts`.

`npm run test:owner-browser` exercises the owner app and real Hermes bridge in a
disposable home. The `native-owner` CI job installs the pinned public Hermes
source and runs this flow. It uses a deterministic local model and no owner keys.
Read the captured settled screenshots as well as the test results. Passing checks
do not establish owner visual acceptance.

The native owner fixture prepares the primary profile's plugin runtime before the
browser starts, as a normal plugin installation does. It verifies zero model
turns during preparation. Owner first-use still performs native Bot Mode
registration and canonical chat initialization. This keeps dependency installation
outside the browser interaction deadline on a cold CI runner.
