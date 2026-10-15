"""Foreground process supervisor and owner-side readiness checks for one installation."""
import argparse
import asyncio
from contextlib import suppress
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

from .host_install import (atomic_write, load_install, locked, private_dir, read_private,
                           release_dir, state_dir)


def environment(value):
    env = dict(os.environ)
    # The service must always use the installation which was inventoried, even if
    # a supervisor has a different cwd, profile, HOME or inherited Python path.
    env.update(HERMES_HOME=value["hermes_home"], PYTHONPATH=value["hermes_source"],
               PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1")
    env.pop("HERMES_PROFILE", None)
    env.pop("HERMES_ACTIVE_PROFILE", None)
    return env


async def terminate(child):
    if child is None:
        return
    # Each service has its own group, including its native stdio child. Clean the
    # group after crashes too, before rebinding a port or starting a replacement.
    with suppress(ProcessLookupError):
        os.killpg(child.pid, signal.SIGTERM)
    try:
        await asyncio.wait_for(child.wait(), 10)
    except TimeoutError:
        with suppress(ProcessLookupError):
            os.killpg(child.pid, signal.SIGKILL)
        await child.wait()
    with suppress(ProcessLookupError):
        os.killpg(child.pid, signal.SIGKILL)


async def manager(directory):
    directory = Path(directory).resolve()
    with locked(directory / "service.lock"):
        value = load_install(directory)
        release = release_dir(directory, value["active_release"])
        runtime = release / "web-runtime"
        env = environment(value)
        env["WORKSPACE_SUPERVISOR_PID"] = str(os.getpid())
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for signum in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(signum, stop.set)
        argv = {
            "bridge": [value["python"], str(release / "host_entry.py"), "bridge", "--state", str(directory)],
            "owner": [value["node"], str(runtime / "apps/owner-node/dist/main.mjs"), "serve",
                      "--state", str(directory / "owner"), "--assets", str(runtime / "apps/web/dist"),
                      "--port", str(value["web_port"]), "--bridge-port", str(value["bridge_port"])],
        }
        children, retry_at, failures = {}, {}, {}
        reload_release = False
        try:
            while not stop.is_set():
                latest = load_install(directory)
                if latest["active_release"] != value["active_release"]:
                    reload_release = True
                    break
                for name in argv:
                    child = children.get(name)
                    if child is not None and child.returncode is not None:
                        await terminate(child)
                        children.pop(name)
                        failures[name] = failures.get(name, 0) + 1
                        retry_at[name] = time.monotonic() + min(30, 0.5 * 2 ** min(failures[name], 6))
                        print(f"Workspace {name} service exited; retry scheduled.", file=sys.stderr, flush=True)
                    if name not in children and time.monotonic() >= retry_at.get(name, 0):
                        children[name] = await asyncio.create_subprocess_exec(
                            *argv[name], cwd=runtime, env=env, start_new_session=True,
                            stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.DEVNULL,
                            stderr=asyncio.subprocess.DEVNULL)
                atomic_write(directory / "service.json", {"schema": 1, "pid": os.getpid(),
                    "release": value["active_release"], "children": {name: child.pid for name, child in children.items()}})
                try:
                    await asyncio.wait_for(stop.wait(), 1)
                except TimeoutError:
                    pass
        finally:
            await asyncio.gather(*(terminate(child) for child in children.values()))
            (directory / "service.json").unlink(missing_ok=True)
    if reload_release:
        # Keep the outer OS/container supervisor and its restart policy. The
        # stable launcher resolves the newly activated immutable release.
        os.execv(value["python"], [value["python"], str(directory / "launcher.py")])


def bridge(directory):
    import uvicorn
    from .compatibility import check_native_adapter
    from .server import create_app
    from .trust import OwnerTrust
    from .native import NativeGateway
    from .operations import BotOperations
    from .workspace import WorkspaceService, WorkspaceStore, workspace_path
    from .setup import installed_primary
    check_native_adapter()
    value = load_install(directory)
    trust = OwnerTrust(read_private(Path(directory) / "owner/trust.json"))
    from urllib.parse import urlsplit
    host = urlsplit(value["origin"]).netloc
    native = NativeGateway()
    workspace = WorkspaceService(BotOperations(native), WorkspaceStore(workspace_path()), primary=installed_primary())
    app = create_app(value["operator_token"], {value["origin"]}, {host}, gateway=native, workspace=workspace, trust=trust,
                     public_callback=value["origin"] + "/v1/oauth/callback")
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=value["bridge_port"],
                access_log=False, proxy_headers=False, log_level="warning", timeout_graceful_shutdown=5))
    native_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifecycle(app):
        async with native_lifespan(app):
            async def watch_native():
                parent = int(os.environ.get("WORKSPACE_SUPERVISOR_PID", "0"))
                while native.healthy and (not parent or os.getppid() == parent):
                    await asyncio.sleep(1)
                server.should_exit = True
            watcher = asyncio.create_task(watch_native())
            try:
                yield
            finally:
                watcher.cancel()
                with suppress(asyncio.CancelledError):
                    await watcher
    app.router.lifespan_context = lifecycle
    server.run()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def request(value, path, *, public=False, port=None, method="GET", lease=None, ca_file=None):
    from urllib.parse import urlsplit
    base = value["origin"] if public else f"http://127.0.0.1:{port or value['bridge_port']}"
    headers = {"Host": urlsplit(value["origin"]).netloc, "Origin": value["origin"]}
    if path.startswith("/v1/"):
        headers["Authorization"] = "Bearer " + value["operator_token"]
    if lease:
        headers["X-Bot-Connection"] = lease
    req = urllib.request.Request(base + path, headers=headers, method=method,
                                  data=b"" if method == "POST" else None)
    handlers = [urllib.request.ProxyHandler({}), NoRedirect()]
    if public and ca_file:
        import ssl
        context = ssl.create_default_context()
        context.load_verify_locations(cafile=str(ca_file))
        handlers.append(urllib.request.HTTPSHandler(context=context))
    return urllib.request.build_opener(*handlers).open(req, timeout=22)


def status(directory=None, *, public=False, stream=False, ca_file=None):
    directory = Path(directory or state_dir())
    value = load_install(directory)
    metadata = read_private(release_dir(directory, value["active_release"]) / "release.json")
    result = {"schema": 1, "version": metadata["version"], "configured": True,
              "owner_service": False, "native_bridge": False, "active_release_running": False,
              "stream_ready": False, "heartbeat": False, "public_route_checked": public}
    failures = {}
    def failure_code(error):
        if hasattr(error, 'code'):
            return f"HTTP_{error.code}"
        reason = getattr(error, 'reason', error)
        code = getattr(reason, 'verify_code', None)
        return type(reason).__name__ + (f"_{code}" if code is not None else '')
    try:
        record = read_private(directory / "service.json")
        result["active_release_running"] = record["release"] == value["active_release"]
    except (OSError, ValueError, KeyError):
        pass
    try:
        with request(value, "/api/instance/status", public=public, port=value["web_port"], ca_file=ca_file) as response:
            data = json.loads(response.read(8192))
            result["owner_service"] = response.status == 200 and type(data.get("setupRequired")) is bool
    except Exception as error:
        failures['owner_service'] = failure_code(error)
    lease = None
    try:
        with request(value, "/v1/connect", public=public, method="POST", ca_file=ca_file) as response:
            data = json.loads(response.read(8192))
            lease = data.get("connection")
            result["native_bridge"] = (response.status == 200 and data.get("bridge_version") == metadata["version"]
                                         and data.get("capabilities", {}).get("owner_login") is True)
        if stream and lease:
            with request(value, "/v1/events", public=public, lease=lease, ca_file=ca_file) as response:
                first = json.loads(response.readline(8192))
                result["stream_ready"] = first.get("type") == "bridge.ready"
                for _ in range(4):
                    frame = json.loads(response.readline(8192))
                    if frame.get("type") == "bridge.heartbeat":
                        result["heartbeat"] = True
                        break
    except Exception as error:
        failures['native_bridge'] = failure_code(error)
    finally:
        if lease:
            try:
                with request(value, "/v1/connect", public=public, method="DELETE", lease=lease, ca_file=ca_file):
                    pass
            except Exception:
                pass
    result["ready"] = all(result[k] for k in ("owner_service", "native_bridge", "active_release_running"))
    if stream:
        result["ready"] = result["ready"] and result["stream_ready"] and result["heartbeat"]
    if failures:
        result['failures'] = failures
    return result


def wait_ready(directory, timeout=65):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = status(directory)
        if result["ready"]:
            return result
        time.sleep(0.5)
    raise ValueError("The installed services did not become ready; activation needs repair or rollback")


def unit_quote(value):
    if any(ord(c) < 32 for c in value):
        raise ValueError("Control characters are not valid service arguments")
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'


def supervisor_files(directory=None):
    import plistlib
    directory = Path(directory or state_dir()).resolve()
    value = load_install(directory)
    service = private_dir(directory / "service")
    command = [value["python"], str(directory / "launcher.py")]
    environment_lines = "\n".join("Environment=" + unit_quote(k + "=" + v) for k, v in {
        "HERMES_HOME": value["hermes_home"], "PYTHONPATH": value["hermes_source"]}.items())
    unit = ("[Unit]\nDescription=Private Hermes Workspace\nAfter=network.target\n\n[Service]\nType=simple\n"
            + "ExecStart=" + " ".join(map(unit_quote, command)) + "\n" + environment_lines
            + "\nRestart=on-failure\nRestartSec=3\nUMask=0077\nNoNewPrivileges=yes\nKillMode=control-group\n"
            + "\n[Install]\nWantedBy=default.target\n")
    atomic_write(service / "hermes-workspace.service", unit, text=True)
    plist = {"Label": "io.enterkey.hermes-workspace", "ProgramArguments": command,
        "RunAtLoad": True, "KeepAlive": True, "Umask": 0o077,
        "EnvironmentVariables": {"HERMES_HOME": value["hermes_home"], "PYTHONPATH": value["hermes_source"]},
        "StandardOutPath": "/dev/null", "StandardErrorPath": "/dev/null", "ThrottleInterval": 3}
    atomic_write(service / "io.enterkey.hermes-workspace.plist", plistlib.dumps(plist).decode(), text=True)
    atomic_write(service / "container-command.json", {"command": command,
        "environment": {"HERMES_HOME": value["hermes_home"], "PYTHONPATH": value["hermes_source"]},
        "persistent_state": str(directory), "restart_policy_required": True,
        "loopback_web_port": value["web_port"]})
    return service


def enable_supervisor(directory=None):
    import shutil
    directory = Path(directory or state_dir()).resolve()
    value = load_install(directory)
    files = supervisor_files(directory)
    if value["supervisor"] == "external":
        return {"supervised": False, "service_files": str(files),
                "next": "Attach the generated foreground command to the persistent container or host supervisor"}
    if value["supervisor"] == "systemd-user":
        if sys.platform != "linux":
            raise ValueError("systemd-user is available only on a Linux host with a working user service manager")
        check = subprocess.run(["systemctl", "--user", "show-environment"], capture_output=True)
        if check.returncode:
            raise ValueError("No user service manager is available; use the container's real supervisor")
        linger = subprocess.run(["loginctl", "show-user", str(os.getuid()), "-p", "Linger", "--value"], capture_output=True, text=True)
        if linger.returncode or linger.stdout.strip() != "yes":
            raise ValueError("The Hermes service account needs user lingering enabled for startup after reboot")
        destination = Path.home() / ".config/systemd/user/hermes-workspace.service"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and "Private Hermes Workspace" not in destination.read_text():
            raise ValueError("An unrelated service already uses this unit name")
        if destination.exists() and unit_quote(str(directory / 'launcher.py')) not in destination.read_text():
            raise ValueError("A different workspace installation already owns this service")
        atomic_write(destination, (files / "hermes-workspace.service").read_text(), text=True)
        subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "--user", "enable", "--now", "hermes-workspace.service"], check=True)
    elif value["supervisor"] == "launchd":
        if sys.platform != "darwin":
            raise ValueError("launchd is available only on macOS")
        destination = Path.home() / "Library/LaunchAgents/io.enterkey.hermes-workspace.plist"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and destination.read_bytes() != (files / destination.name).read_bytes():
            raise ValueError("An existing launchd service needs explicit migration; it was not replaced")
        shutil.copyfile(files / destination.name, destination)
        destination.chmod(0o600)
        loaded = subprocess.run(["launchctl", "print", f"gui/{os.getuid()}/io.enterkey.hermes-workspace"], capture_output=True)
        if loaded.returncode:
            subprocess.run(["launchctl", "bootstrap", f"gui/{os.getuid()}", str(destination)], check=True)
    return {"supervised": True, **wait_ready(directory)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["manager", "bridge"])
    parser.add_argument("--state", required=True, type=Path)
    args = parser.parse_args()
    value = load_install(args.state)
    os.environ.update(environment(value))
    sys.path.insert(0, value["hermes_source"])
    if args.action == "manager":
        asyncio.run(manager(args.state))
    else:
        bridge(args.state)
