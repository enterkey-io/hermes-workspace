"""Exercise the exact downloaded-package/CLI handoff in a disposable Hermes home."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from zipfile import ZipFile

from native_smoke import Model, seed
from http.server import ThreadingHTTPServer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer-base", default="http://127.0.0.1:8080")
    parser.add_argument("--release-base", help="Explicit GitHub release asset base URL, without /downloads")
    args = parser.parse_args()
    download_base = args.release_base or args.installer_base + "/downloads"
    manifest = json.loads(urllib.request.urlopen(download_base + "/workspace-manifest.json", timeout=20).read(65536))
    with tempfile.TemporaryDirectory(prefix="workspace-agent-install-") as directory:
        root = Path(directory)
        home = root / "hermes-home"; home.mkdir()
        for artifact in manifest["artifacts"]:
            name = artifact["name"]
            if name not in {"workspace-plugin-preview.zip", "workspace-web-preview.zip"}:
                continue
            data = urllib.request.urlopen(download_base + "/" + name, timeout=20).read(2 * 1024 * 1024)
            assert len(data) == artifact["bytes"] and hashlib.sha256(data).hexdigest() == artifact["sha256"]
            archive = root / name; archive.write_bytes(data)
            destination = root / name.removesuffix(".zip")
            with ZipFile(archive) as zipped:
                assert all(not Path(item.filename).is_absolute() and ".." not in Path(item.filename).parts
                    and not stat.S_ISLNK(item.external_attr >> 16) for item in zipped.infolist())
                zipped.extractall(destination)
        web = root / "separate-web-host"
        shutil.copytree(root / "workspace-web-preview", web)
        shutil.copytree(root / "workspace-plugin-preview/bot-web", home / "plugins/bot-web")
        os.environ.clear()
        os.environ.update(PATH=str(Path(sys.executable).parent) + ":/usr/bin:/bin", HERMES_HOME=str(home),
            HERMES_RUNTIME_DIR=str(root / "runtime"), PYTHONPYCACHEPREFIX=str(root / "pycache"), NO_PROXY="127.0.0.1,localhost")
        model = ThreadingHTTPServer(("127.0.0.1", 0), Model)
        threading.Thread(target=model.serve_forever, daemon=True).start()
        seed(home, model.server_port)
        with socket.socket() as socket_:
            socket_.bind(("127.0.0.1", 0)); port = socket_.getsockname()[1]
        bridge_url = "https://bridge-fixture.example.test"
        app_origin = "https://separate-web-fixture.example.test"
        def cli(*arguments):
            result = subprocess.run(["hermes", "bot-web", *arguments], capture_output=True, text=True, timeout=30)
            assert result.returncode == 0, result.stderr[-1000:]
            return result.stdout
        enabled = subprocess.run(["hermes", "plugins", "enable", "bot-web"], capture_output=True, text=True, timeout=30)
        assert enabled.returncode == 0, enabled.stderr[-1000:]
        setup_output = cli("setup", "--bridge-url", bridge_url, "--app-origin", app_origin, "--port", str(port))
        config = home / "bot-web/connection.json"
        settings = json.loads(config.read_text())
        assert settings["token"] not in setup_output and config.stat().st_mode & 0o777 == 0o600
        service = subprocess.Popen(["hermes", "bot-web", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        def request(path, body=None, token=None):
            headers = {"Host": "bridge-fixture.example.test", "Origin": app_origin}
            if token: headers["Authorization"] = "Bearer " + token
            payload = None if body is None else json.dumps(body).encode()
            if body is not None: headers["Content-Type"] = "application/json"
            with urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}" + path,
                data=payload, headers=headers), timeout=10) as response:
                return response.read(1_000_000)
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                try:
                    if json.loads(request("/v1/connect", {}, settings["token"]))["protocol"] == "hermes-bot-web.v1": break
                except Exception:
                    if service.poll() is not None:
                        raise AssertionError(service.stderr.read().decode()[-1000:])
                    time.sleep(0.2)
            else: raise AssertionError("Installed service did not become ready")
            assert b"Your Hermes workspace" in (web / "index.html").read_bytes()
            assert not (home / "apps").exists(), "Web app must not be installed on Hermes"
            assert "web_dir" not in settings and settings["origins"] == [app_origin]
            verifier = "v" * 43
            pending = json.loads(request("/v1/pairing/request", {"challenge":hashlib.sha256(verifier.encode()).hexdigest()}))
            assert json.loads(request("/v1/pairing/claim", {"request_id":pending["request_id"], "verifier":verifier}))["status"] == "pending"
            cli("approve", pending["code"], "--app-origin", app_origin)
            grant = json.loads(request("/v1/pairing/claim", {"request_id":pending["request_id"], "verifier":verifier}))["credential"]
            connection = json.loads(request("/v1/connect", {}, grant))["connection"]
            req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/rpc",
                data=json.dumps({"operation":"bots.list","params":{}}).encode(), headers={"Host":settings["host"], "Origin":app_origin,
                "Authorization":"Bearer " + grant,"X-Bot-Connection":connection,"Content-Type":"application/json"})
            result = json.loads(urllib.request.urlopen(req, timeout=10).read(1_000_000))
            assert {bot["profile"] for bot in result["result"]["bots"]} == {"alpha", "beta"}
            cli("revoke")
            assert Model.turns == 0, "Installation verification must not submit model turns"
            print("Separate web files, API-only Hermes install, checksums, real CLI setup/serve/approve/revoke and native roster: PASS (zero model turns)")
        finally:
            service.terminate()
            try: service.wait(timeout=12)
            except subprocess.TimeoutExpired: service.kill(); service.wait()
            model.shutdown()


if __name__ == "__main__":
    main()
