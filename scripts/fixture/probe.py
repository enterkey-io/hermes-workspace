"""Run the unmodified Hermes dashboard in a temporary, credential-free home.

This probe exercises actual HTTP handlers. It is not a native handoff/group
acceptance test, and intentionally cannot certify a working Bot Mode product.
"""

import argparse
from http.cookies import SimpleCookie
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


def request(port, path, method="GET", origin=None, payload=None, cookie=None):
    headers = {"Host": "hermes-fixture.invalid"}
    if origin:
        headers["Origin"] = origin
        headers["Access-Control-Request-Method"] = "POST"
        headers["Access-Control-Request-Headers"] = "content-type"
    if cookie:
        headers["Cookie"] = cookie
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            return response.status, response.headers, response.read(65536)
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read(65536)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--python", required=True)
    parser.add_argument("--output", default="docs/compatibility/runtime-auth-evidence.json")
    args = parser.parse_args()
    source = Path(args.source).resolve()
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="hermes-client-auth-") as temporary:
        home = Path(temporary) / "home"
        home.mkdir()
        (home / "config.yaml").write_text("dashboard:\n  public_url: https://hermes-fixture.invalid\n", encoding="utf8")
        (home / ".env").write_text("# Synthetic fixture. No model credentials.\n", encoding="utf8")
        env = {
            "PATH": f"{Path(args.python).parent}:/usr/bin:/bin",
            "HERMES_HOME": str(home),
            "HERMES_RUNTIME_DIR": str(Path(temporary) / "runtime"),
            "PYTHONPYCACHEPREFIX": str(Path(temporary) / "pycache"),
            "PYTHONUNBUFFERED": "1",
            "HERMES_DASHBOARD_BASIC_AUTH_USERNAME": "fixture-user",
            "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD": "synthetic-fixture-password-not-a-user-secret",
            "NO_PROXY": "127.0.0.1,localhost",
        }
        # No inherited environment or model keys. This probe never submits a turn.
        launch = (
            "from pathlib import Path; "
            "from hermes_cli.profiles import _get_default_hermes_home; "
            "import os; "
            "assert _get_default_hermes_home().resolve() == Path(os.environ['HERMES_HOME']).resolve(); "
            "from hermes_cli.plugins import discover_plugins; discover_plugins(); "
            "from hermes_cli.web_server import start_server; "
            f"start_server(host='127.0.0.1', port={port}, open_browser=False, headless=True)"
        )
        log_path = Path(temporary) / "runtime.log"
        with log_path.open("wb") as log:
            process = subprocess.Popen([args.python, "-c", launch], cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                ready = False
                for _ in range(90):
                    if process.poll() is not None:
                        break
                    try:
                        status, _, _ = request(port, "/api/auth/providers")
                        if status == 200:
                            ready = True
                            break
                    except (OSError, urllib.error.URLError):
                        pass
                    time.sleep(0.25)
                if not ready:
                    # Synthetic-only logs stay local. Never run this against a user's home.
                    print(log_path.read_text(encoding="utf8", errors="replace")[-6000:])
                    raise RuntimeError("Disposable Hermes fixture did not start.")
                checks = []
                status, headers, _ = request(port, "/auth/password-login", "POST", payload={
                    "provider": "basic", "username": "fixture-user",
                    "password": "synthetic-fixture-password-not-a-user-secret",
                })
                if status != 200:
                    raise RuntimeError("Fixture's normal password sign-in failed.")
                cookies = SimpleCookie()
                for value in headers.get_all("set-cookie", []):
                    cookies.load(value)
                cookie = "; ".join(f"{name}={value.value}" for name, value in cookies.items())
                checks.append({"case": "normal-fixture-password-sign-in", "status": status})
                for label, origin in [("public-style-hosted-origin", "https://client-fixture.invalid"), ("localhost-development-origin", "http://localhost:5173")]:
                    status, headers, _ = request(port, "/api/auth/ws-ticket", "OPTIONS", origin)
                    checks.append({"case": label + "-unauthenticated-preflight", "status": status, "originAllowed": headers.get("access-control-allow-origin") == origin})
                    status, headers, _ = request(port, "/api/auth/ws-ticket", "OPTIONS", origin, cookie=cookie)
                    checks.append({"case": label + "-authenticated-http-origin-probe", "status": status, "originAllowed": headers.get("access-control-allow-origin") == origin})
                status, _, _ = request(port, "/api/auth/ws-ticket", "POST", payload={}, cookie=cookie)
                checks.append({"case": "authenticated-ws-ticket", "status": status})
                status, _, _ = request(port, "/auth/native/authorize?code_challenge_method=S256&code_challenge=synthetic&redirect_uri=https%3A%2F%2Fclient-fixture.invalid%2Fcallback")
                checks.append({"case": "native-https-callback", "status": status})
                status, _, _ = request(port, "/api/auth/ws-ticket", "POST", payload={})
                checks.append({"case": "unauthenticated-ws-ticket", "status": status})
                result = {
                    "revision": revision,
                    "evidenceLevel": "real-runtime-http-probe",
                    "checks": checks,
                    "productCertified": False,
                    "hostedBotModeStatus": "blocked" if not next(check for check in checks if check["case"] == "public-style-hosted-origin-authenticated-http-origin-probe")["originAllowed"] else "unverified",
                    "probeLimitations": ["Authenticated HTTP probes supply a synthetic cookie explicitly; this does not prove a browser can obtain or send a cross-site cookie."],
                    "notExercised": ["browser-tls", "managed-roster", "canonical-continuity", "native-teammate-delivery", "native-room-driver", "bot-owned-routines"],
                }
                output = Path(args.output)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
                print(json.dumps(result, indent=2))
            finally:
                process.terminate()
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)


if __name__ == "__main__":
    main()
