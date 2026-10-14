# Reproduce the verification

The unit suites require no personal infrastructure, server endpoint or model account. The native/browser fixtures additionally require a trusted isolated Hermes checkout and Python environment. They run only synthetic state and a deterministic localhost model. Do not point these fixtures at an existing personal Hermes home.

## Unit and build checks

```sh
npm ci --ignore-scripts
npm run check
python -m unittest discover -s test/plugin -p 'test_*.py'
```

The Python stream regression sends a continuous sequence of native events belonging to another session through the actual ASGI handler. It requires scheduled heartbeat frames without leaking those events, checks idle streams and verifies that closing an operator probe leaves the owner's grant intact. A closed lease must not receive an event that was pending while it was closed. The browser empty-roster case additionally stays idle beyond the client's 35-second deadline before refreshing the roster.

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

An already installed test Chromium can instead be selected through `BOT_WEB_TEST_CHROMIUM=/absolute/path/to/test-chromium`. The nine tests use `https://127.0.0.1:5443` for the independently hosted web app (including connection and conversations) and `https://127.0.0.1:8788` for the separate API-only real Hermes bridge. The page stays on port 5443 after approval; the bridge serves no web app. An unapproved origin is also tested for pairing/preflight denial. Browser access requires code approval; no API-key field is present. No API response is simulated in the happy-path/control tests. Additional onboarding cases deliberately return an empty roster or an uninitialized bot, then verify setup instructions, disabled unavailable chats and roster refresh; a failed list request must not become an empty connected workspace. Loss tests deliberately abort the event stream or drop the acknowledgment after forwarding a real accepted send. All requests to the static host are GETs without a body, credential or query string. Pairing/API/events and requests carrying contents/authorization go only to the bridge origin. Storage remains empty, browser cookies are unused, and reload forgets the endpoint.

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
/tmp/bot-web-test-python/bin/python scripts/fixture/install_smoke.py --release-base https://github.com/enterkey-io/hermes-workspace/releases/download/v0.2.3-preview.1
```

It uses the same isolated home and zero-model-turn checks. The URL selects immutable-version-named assets; it never reads the owner’s Hermes installation.
