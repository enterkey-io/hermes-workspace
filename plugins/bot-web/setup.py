"""Configure only the native bridge on the Hermes host; web hosting is independent."""
import json
import os
import re
from pathlib import Path
import secrets
from urllib.parse import urlsplit
import urllib.request


def config_path():
    from hermes_constants import get_hermes_home
    return Path(get_hermes_home()) / "bot-web" / "connection.json"


def https_origin(value):
    if not isinstance(value, str) or any(ord(char) <= 32 or ord(char) == 127 for char in value) or "\\" in value:
        raise ValueError("Use an HTTPS origin without credentials, a path, query or fragment")
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise ValueError("Use an HTTPS origin without credentials, a path, query or fragment")
    hostname = parsed.hostname.encode("idna").decode().lower()
    if ":" in hostname:
        hostname = f"[{hostname}]"
    authority = hostname + (f":{parsed.port}" if parsed.port and parsed.port != 443 else "")
    return f"https://{authority}", authority


def validate(settings):
    if not isinstance(settings, dict) or set(settings) != {"schema", "bridge_url", "origins", "host", "token", "port"} or settings["schema"] != 2:
        raise ValueError("Unsupported bridge configuration; do not overwrite existing settings")
    url, host = https_origin(settings["bridge_url"])
    if url != settings["bridge_url"] or host != settings["host"]:
        raise ValueError("Invalid bridge URL/Host configuration")
    origins = settings["origins"]
    if not isinstance(origins, list) or not 1 <= len(origins) <= 8 or len(set(origins)) != len(origins):
        raise ValueError("Configure one to eight exact application origins")
    if any(https_origin(origin)[0] != origin for origin in origins):
        raise ValueError("Invalid application origin")
    if not isinstance(settings["token"], str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", settings["token"]):
        raise ValueError("Invalid bridge administrator credential")
    if type(settings["port"]) is not int or not 1024 <= settings["port"] <= 65535:
        raise ValueError("Use a local port from 1024 to 65535")
    return settings


def read_settings():
    path = config_path()
    if path.is_symlink() or path.stat().st_size > 65536:
        raise ValueError("Invalid private bridge configuration")
    if os.name != "nt" and path.stat().st_mode & 0o077:
        raise ValueError("Bridge configuration must be private (chmod 600)")
    return validate(json.loads(path.read_text()))


def configure(bridge_url, app_origins, port):
    from .compatibility import check_native_adapter
    check_native_adapter()
    url, host = https_origin(bridge_url)
    origins = list(dict.fromkeys(https_origin(origin)[0] for origin in app_origins))
    settings = validate({"schema": 2, "bridge_url": url, "origins": origins, "host": host,
                         "token": secrets.token_urlsafe(32), "port": port})
    path = config_path()
    if path.exists() or path.is_symlink():
        raise ValueError("Bridge is already configured; preserve existing settings")
    if path.parent.is_symlink():
        raise ValueError("Private configuration directory cannot be a symlink")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(settings, output)
    print(f"Hermes bridge configured. Start it with: hermes bot-web serve\nHermes connection address: {url}\nAllowed web apps: {', '.join(origins)}\nWeb hosting is separate. No administrator credential needs to be sent to the owner.")


def control(action, code=None, app_origin=None):
    settings = read_settings()
    if app_origin:
        origin = https_origin(app_origin)[0]
        if origin not in settings["origins"]:
            raise ValueError("This application origin is not configured")
    elif len(settings["origins"]) == 1:
        origin = settings["origins"][0]
    else:
        raise ValueError("Specify --app-origin for the browser being approved")
    payload = {"code": code} if action == "approve" else {}
    request = urllib.request.Request(f"http://127.0.0.1:{settings['port']}/v1/pairing/{action}",
        data=json.dumps(payload).encode(), method="POST", headers={
            "Host": settings["host"], "Origin": origin,
            "Authorization": "Bearer " + settings["token"], "Content-Type": "application/json"})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=10) as response:
            json.loads(response.read(65536))
    except Exception as error:
        raise ValueError("Cannot complete browser access control. Check that the bridge is running and the code and application origin are current.") from error
    print(f"Browser approved for {origin}. The owner can return to the web app." if action == "approve" else "Browser access revoked.")
