"""Research only: exercise unmodified Hermes dashboard extension points.

Run with a supported Hermes Python environment and --source its checkout.
Every write and synthetic credential belongs to a disposable Hermes home.
No models, owner profiles, production services, or external providers are used.
"""

import argparse
import asyncio
import importlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time


API = '''import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, StreamingResponse

marker = Path(__file__).parent / "lifecycle.json"
@asynccontextmanager
async def lifecycle(app):
    marker.write_text('["started"]')
    yield
    marker.write_text('["started", "stopped"]')

router = APIRouter(lifespan=lifecycle)
@router.get("/ping")
async def ping(request: Request):
    return {"authenticated": bool(getattr(request.state, "session", None))}
@router.post("/mutation")
async def mutation():
    return {"ok": True}
@router.get("/page", response_class=HTMLResponse)
async def page():
    return "<!doctype html><title>Disposable plugin page</title>"
@router.get("/stream")
async def stream():
    async def frames():
        for i in range(3):
            yield '{"frame":%d}\\n' % i
            await asyncio.sleep(0.2)
    return StreamingResponse(frames(), media_type="application/x-ndjson")
'''


def child(source, home):
    sys.path.insert(0, str(source))
    os.chdir(home)
    plugin = home / "plugins" / "hosting-probe"
    dashboard = plugin / "dashboard"
    (dashboard / "dist").mkdir(parents=True)
    (plugin / "plugin.yaml").write_text("name: hosting-probe\nversion: 0.0.1\n")
    (plugin / "__init__.py").write_text("def register(ctx):\n    pass\n")
    (dashboard / "manifest.json").write_text(json.dumps({
        "name": "hosting-probe", "label": "Hosting probe", "version": "0.0.1",
        "tab": {"path": "/hosting-probe"}, "entry": "dist/index.js", "api": "plugin_api.py",
    }))
    (dashboard / "dist/index.js").write_text("/* disposable discovery probe, not a rendered app */")
    (dashboard / "plugin_api.py").write_text(API)
    config = home / "config.yaml"
    config.write_text("plugins:\n  enabled: [hosting-probe]\n"
                      "dashboard:\n  public_url: https://workspace.example.test\n")
    from fastapi.testclient import TestClient
    from hermes_cli import web_server as web
    from hermes_cli.dashboard_auth import clear_providers, register_provider
    from hermes_cli.dashboard_auth.cookies import SESSION_AT_COOKIE
    from plugins.dashboard_auth.basic import BasicAuthProvider, hash_password

    results = {"source_revision": subprocess.check_output(
        ["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip(),
        "python": sys.version.split()[0], "checks": {}, "observations": {}}
    checks, observations = results["checks"], results["observations"]
    password = secrets.token_urlsafe(32)
    password_hash = hash_password(password)
    key = secrets.token_bytes(32)

    def provider(secret=key):
        return BasicAuthProvider(username="fixture-owner", password_hash=password_hash, secret=secret)

    clear_providers()
    register_provider(provider())
    web.app.state.auth_required = web.should_require_dashboard_auth("127.0.0.1")
    web.app.state.bound_host = "127.0.0.1"
    web.app.state.trusted_public_hosts = frozenset({"workspace.example.test"})
    checks["public_url_requires_auth_on_loopback"] = web.app.state.auth_required
    discovered = web._get_dashboard_plugins(force_rescan=True)
    checks["user_plugin_discovered"] = any(p["name"] == "hosting-probe" for p in discovered)
    path = "/api/plugins/hosting-probe"
    # The real application lifespan is exercised: no model is configured in this home.
    with TestClient(web.app, base_url="https://workspace.example.test") as client:
        checks["unauthenticated_api_denied"] = client.get(path + "/ping").status_code == 401
        checks["unauthenticated_plugin_html_denied"] = client.get(path + "/page").status_code == 401
        checks["login_page_available"] = client.get("/login").status_code == 200
        checks["unauthenticated_wrong_host_denied"] = client.get(
            path + "/ping", headers={"Host": "evil.example.test"}).status_code in (400, 401)
        login = client.post("/auth/password-login", json={
            "provider": "basic", "username": "fixture-owner", "password": password,
            "next": "/hosting-probe",
        })
        checks["native_password_login"] = login.status_code == 200
        checks["authenticated_wrong_host_denied"] = client.get(
            path + "/ping", headers={"Host": "evil.example.test"}).status_code == 400
        checks["login_keeps_plugin_tab_target"] = login.json().get("next") == "/hosting-probe"
        cookie_headers = login.headers.get_list("set-cookie")
        checks["session_cookie_secure_httponly"] = any(
            SESSION_AT_COOKIE + "=" in c and "secure" in c.lower() and "httponly" in c.lower()
            for c in cookie_headers)
        ping = client.get(path + "/ping")
        checks["plugin_api_inherits_verified_session"] = ping.status_code == 200 and ping.json().get("authenticated") is True
        checks["plugin_html_available_after_login"] = client.get(path + "/page").status_code == 200
        listing = client.get("/api/dashboard/plugins")
        checks["authenticated_discovery_api"] = listing.status_code == 200 and "hosting-probe" in listing.text
        checks["plugin_js_served"] = client.get("/dashboard-plugins/hosting-probe/dist/index.js").status_code == 200
        marker = dashboard / "lifecycle.json"
        observations["router_lifespan_entered"] = marker.exists() and json.loads(marker.read_text()) == ["started"]
        # This explicitly forged HTTP request is not a browser CSRF exploit test.
        # It distinguishes native CORS from an exact-Origin mutation guard our API needs.
        observations["forged_origin_authenticated_post_status"] = client.post(
            path + "/mutation", headers={"Origin": "https://unapproved.example.test"}).status_code
        access_name = next(name for name in client.cookies if name.endswith(SESSION_AT_COOKIE))
        access = client.cookies.get(access_name)
        clear_providers()
        register_provider(provider())
        checks["session_survives_provider_reconstruction_with_persisted_key"] = client.get(path + "/ping").status_code == 200
        clear_providers()
        register_provider(provider(secrets.token_bytes(32)))
        observations["session_after_changed_signing_key_status"] = client.get(path + "/ping").status_code
        clear_providers()
        register_provider(provider())
        # The changed-key probe clears the client's cookies; restore its synthetic AT.
        client.cookies.set(access_name, access, domain="workspace.example.test", path="/")

        async def stream_timing():
            chunks, times = [], []
            started = time.monotonic()
            receive_once = False

            async def receive():
                nonlocal receive_once
                if not receive_once:
                    receive_once = True
                    return {"type": "http.request", "body": b"", "more_body": False}
                await asyncio.Event().wait()

            status = None

            async def send(message):
                nonlocal status
                if message["type"] == "http.response.start":
                    status = message["status"]
                elif message["type"] == "http.response.body" and message.get("body"):
                    chunks.append(message["body"].decode())
                    times.append(round(time.monotonic() - started, 3))

            scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
                     "http_version": "1.1", "method": "GET", "scheme": "https",
                     "path": path + "/stream", "raw_path": (path + "/stream").encode(),
                     "query_string": b"", "root_path": "", "server": ("workspace.example.test", 443),
                     "client": ("127.0.0.1", 10001), "headers": [
                         (b"host", b"workspace.example.test"),
                         (b"cookie", (access_name + "=" + access).encode())]}
            await asyncio.wait_for(web.app(scope, receive, send), 10)
            return status, chunks, times

        status, chunks, times = asyncio.run(stream_timing())
        observations["stream_frame_seconds"] = times
        checks["authenticated_stream_unbuffered_through_native_middleware"] = (
            status == 200 and len(chunks) == 3 and times[0] < 0.15
            and times[-1] - times[0] >= 0.3)
        config.write_text(config.read_text().replace("enabled: [hosting-probe]", "enabled: []\n  disabled: [hosting-probe]"))
        checks["disabled_plugin_route_denied"] = client.get(path + "/ping").status_code == 404
    observations["router_lifespan_completed"] = marker.exists() and json.loads(marker.read_text()) == ["started", "stopped"]

    # Use Hermes' installer dependency gate itself, with a package containing no Python deps.
    # A quiet console and a guaranteed non-TTY prevent any prompt or npm execution.
    try:
        install = importlib.import_module("hermes_cli.plugins_cmd_install")
    except ModuleNotFoundError:
        install = importlib.import_module("hermes_cli.plugins_cmd")
    node_plugin = home / "node-consent-probe"
    node_plugin.mkdir()
    (node_plugin / "package.json").write_text('{"name":"fixture-node-deps","dependencies":{"fixture":"1.0.0"}}')

    class Console:
        def __init__(self):
            self.lines = []

        def print(self, *args, **kwargs):
            self.lines.append(" ".join(map(str, args)))

    console = Console()
    gate = getattr(install, "_install_plugin_python_deps", None)
    if gate:
        import inspect
        kwargs = {"assume_yes": True} if "assume_yes" in inspect.signature(gate).parameters else {}
        consented, reason = gate({"name": "fixture-node-deps"}, node_plugin, console, **kwargs)
        observations["node_deps_headless"] = {
            "assume_yes_supported": bool(kwargs), "gate_allows_enable": consented,
            "node_modules_created": (node_plugin / "node_modules").exists(),
            "skip_message_present": any("Skipped Node" in s for s in console.lines),
        }
    else:
        observations["node_deps_headless"] = "No equivalent dependency gate on this build"
    results["passed"] = all(checks.values())
    # The native gateway deliberately redirects sys.stdout to stderr when imported.
    sys.__stdout__.write(json.dumps(results, indent=2) + "\n")
    return 0 if results["passed"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--child-home", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.child_home:
        return child(args.source.resolve(), args.child_home)
    with tempfile.TemporaryDirectory(prefix="hermes-plugin-hosting-research-") as temporary:
        home = Path(temporary)
        env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": temporary,
               "HERMES_HOME": temporary, "PYTHONNOUSERSITE": "1", "PYTHONPYCACHEPREFIX": str(home / "pycache"),
               "HERMES_GUEST_ONBOARDING": "0", "HERMES_NO_UPDATE_CHECK": "1", "NO_COLOR": "1"}
        run = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--source", str(args.source.resolve()),
                              "--child-home", temporary], env=env, capture_output=True, text=True, timeout=150)
        if run.returncode not in (0, 1):
            raise RuntimeError(run.stderr[-4000:])
        # Native diagnostic output may precede the structured result.
        start = run.stdout.find('{\n  "source_revision"')
        if start < 0:
            raise RuntimeError(run.stderr[-4000:] + run.stdout[-2000:])
        result = json.loads(run.stdout[start:])
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))
        return run.returncode


if __name__ == "__main__":
    sys.exit(main())
