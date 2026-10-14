"""User-owned bridge. Static app hosting never proxies these requests."""

import asyncio
from contextlib import asynccontextmanager
import hmac
import json
import os
import re
import secrets
import time
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from .native import NativeError, NativeGateway
from .operations import BotOperations, InvalidOperation
from .compatibility import check_native_adapter
from .pairing import BrowserPairing

MAX_BODY = 65536
LEASE_SECONDS = 1800
HEARTBEAT_SECONDS = 15


def configuration():
    token = os.environ.get("HERMES_BOT_WEB_TOKEN", "")
    # token_urlsafe(32) is 43 characters. Operators generate their own credential.
    if not re.fullmatch(r"[A-Za-z0-9_-]{43,128}", token):
        raise ValueError("Set HERMES_BOT_WEB_TOKEN to an independently generated random token")
    dev = os.environ.get("HERMES_BOT_WEB_LOCAL_DEV") == "1"
    origins = set(filter(None, os.environ.get("HERMES_BOT_WEB_ORIGINS", "").split(",")))
    if not origins:
        raise ValueError("Set explicit HERMES_BOT_WEB_ORIGINS")
    for origin in origins:
        parsed = urlsplit(origin)
        local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        if (parsed.scheme != "https" and not (dev and local and parsed.scheme == "http")) or (
            parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment
            or not parsed.hostname or origin == "null"
        ):
            raise ValueError("Origins must be exact HTTPS origins (explicit loopback development excepted)")
    hosts = set(filter(None, os.environ.get("HERMES_BOT_WEB_HOSTS", "").split(",")))
    if not hosts or any(not re.fullmatch(r"[A-Za-z0-9.\[\]:-]+", host) for host in hosts):
        raise ValueError("Set exact HERMES_BOT_WEB_HOSTS including ports when present")
    return token, origins, hosts


def create_app(token, origins, hosts, gateway=None):
    native = gateway or NativeGateway()
    ops = BotOperations(native)
    clients = {}
    pairing = BrowserPairing()

    @asynccontextmanager
    async def lifespan(app):
        check_native_adapter()
        await native.start()
        try:
            yield
        finally:
            await native.stop()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    # ASGI middleware checks before body consumption and authenticates streams too.
    class Boundary:
        def __init__(self, app):
            self.inner = app

        async def __call__(self, scope, receive, send):
            if scope["type"] != "http":
                return await self.inner(scope, receive, send)
            headers = dict(scope["headers"])
            origin = headers.get(b"origin", b"").decode("latin1")
            host = headers.get(b"host", b"").decode("latin1")
            common = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                      "Referrer-Policy": "no-referrer", "Vary": "Origin"}
            if not origin and headers.get(b"sec-fetch-site") == b"same-origin":
                origin = next((item for item in origins if urlsplit(item).netloc == host), "")
            if origin in origins:
                common["Access-Control-Allow-Origin"] = origin
            async def reject(status):
                await JSONResponse({"error": "Request denied"}, status, headers=common)(scope, receive, send)
            # Duplicated boundary headers are ambiguous and always rejected.
            for name in (b"host", b"origin", b"authorization", b"content-length", b"x-bot-connection"):
                if sum(k == name for k, _ in scope["headers"]) > 1:
                    return await reject(400)
            if host not in hosts or origin not in origins or scope.get("query_string"):
                return await reject(403)
            if scope["method"] == "OPTIONS":
                requested = headers.get(b"access-control-request-headers", b"").decode("latin1").lower()
                names = {s.strip() for s in requested.split(",") if s.strip()}
                if headers.get(b"access-control-request-method") not in {b"POST", b"GET", b"DELETE"} or not names <= {
                    "authorization", "content-type", "x-bot-connection"
                }:
                    return await reject(403)
                common.update({"Access-Control-Allow-Methods": "POST, GET, DELETE",
                               "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Bot-Connection"})
                return await Response(status_code=204, headers=common)(scope, receive, send)
            supplied = headers.get(b"authorization", b"")
            principal = "operator" if hmac.compare_digest(supplied, ("Bearer " + token).encode()) else (
                pairing.principal(supplied[7:].decode("latin1"), origin) if supplied.startswith(b"Bearer ") else None)
            public_pair = scope["method"] == "POST" and scope["path"] in {"/v1/pairing/request", "/v1/pairing/claim"}
            if not public_pair and not principal:
                return await reject(401)
            if scope["path"] in {"/v1/pairing/approve", "/v1/pairing/revoke"} and principal != "operator":
                return await reject(403)
            scope["bot.principal"] = principal
            scope["bot.origin"] = origin
            try:
                if int(headers.get(b"content-length", b"0")) > MAX_BODY:
                    return await reject(413)
            except ValueError:
                return await reject(400)
            consumed = 0
            async def bounded_receive():
                nonlocal consumed
                message = await receive()
                consumed += len(message.get("body", b""))
                if consumed > MAX_BODY:
                    raise InvalidOperation("Request too large")
                return message
            async def secured_send(message):
                if message["type"] == "http.response.start":
                    message["headers"] += [(k.lower().encode(), v.encode()) for k, v in common.items()]
                await send(message)
            await self.inner(scope, bounded_receive, secured_send)

    app.add_middleware(Boundary)

    def lease(request):
        connection = request.headers.get("x-bot-connection", "")
        client = clients.get(connection)
        if client is None or time.monotonic() - client["touched"] > LEASE_SECONDS:
            clients.pop(connection, None)
            raise InvalidOperation("Reconnect to Hermes")
        if client["principal"] != request.scope.get("bot.principal"):
            raise InvalidOperation("Connection belongs to another browser")
        client["touched"] = time.monotonic()
        return client

    @app.exception_handler(InvalidOperation)
    async def invalid(request, error):
        return JSONResponse({"error": "Operation unavailable or invalid. Refresh and check the connection."}, 400)

    @app.exception_handler(NativeError)
    async def native_error(request, error):
        return JSONResponse({"error": "Hermes could not confirm the operation. Refresh before retrying."}, 502)

    @app.post("/v1/connect")
    async def connect(request: Request):
        for key in list(clients):
            if time.monotonic() - clients[key]["touched"] > LEASE_SECONDS:
                clients.pop(key)
        if len(clients) >= 8:
            return JSONResponse({"error": "Connection limit reached"}, 429)
        connection = secrets.token_urlsafe(32)
        clients[connection] = {"touched": time.monotonic(), "streaming": False,
                               "inflight": 0, "sessions": set(), "principal": request.scope["bot.principal"]}
        build = getattr(native, "build", None) or {}
        return {"connection": connection, "protocol": "hermes-bot-web.v1", "bridge_version": "0.2.3",
                "hermes_version": build.get("version"), "hermes_revision": build.get("revision")}

    @app.delete("/v1/connect")
    async def disconnect(request: Request):
        client = lease(request)
        clients.pop(request.headers["x-bot-connection"], None)
        if client["principal"] != "operator":
            pairing.grants.pop(client["principal"], None)
        return {"disconnected": True}

    @app.post("/v1/rpc")
    async def rpc(request: Request):
        client = lease(request)
        if client["inflight"] >= 4:
            return JSONResponse({"error": "Too many pending operations"}, 429)
        client["inflight"] += 1
        try:
            if request.headers.get("content-type", "").split(";")[0] != "application/json":
                raise InvalidOperation("JSON required")
            try:
                data = await request.json()
            except (ValueError, UnicodeDecodeError) as error:
                raise InvalidOperation("Invalid JSON") from error
            if not isinstance(data, dict) or set(data) != {"operation", "params"}:
                raise InvalidOperation("Invalid request")
            operation, params = data["operation"], data["params"]
            if not isinstance(operation, str) or not isinstance(params, dict):
                raise InvalidOperation("Invalid operation")
            if operation.startswith("chat.") and params.get("session_id") not in client["sessions"]:
                raise InvalidOperation("Session belongs to another connection")
            result = await ops.invoke(operation, params)
            if operation == "bot.open":
                client["sessions"].add(result["session_id"])
            return {"result": result}
        finally:
            client["inflight"] -= 1

    @app.get("/v1/events")
    async def events(request: Request):
        client = lease(request)
        if client["streaming"]:
            return JSONResponse({"error": "Event stream already active"}, 409)
        client["streaming"] = True
        queue = asyncio.Queue(maxsize=256)
        native.listeners.add(queue)
        connection = request.headers["x-bot-connection"]
        def active():
            return (clients.get(connection) is client
                    and time.monotonic() - client["touched"] <= LEASE_SECONDS
                    and pairing.alive(client["principal"]))
        async def stream():
            try:
                # Flush headers immediately and acknowledge an authenticated stream.
                yield '{"type":"bridge.ready"}\n'
                next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
                while active():
                    # Filtered native traffic must not restart the browser's heartbeat clock.
                    remaining = next_heartbeat - time.monotonic()
                    if remaining <= 0:
                        yield '{"type":"bridge.heartbeat"}\n'
                        next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
                        continue
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=remaining)
                    except TimeoutError:
                        continue
                    if not active():
                        break
                    if event.get("type") == "bridge.resync":
                        yield json.dumps(event) + "\n"
                        break
                    if event.get("session_id") in client["sessions"]:
                        yield json.dumps(event, ensure_ascii=False) + "\n"
            finally:
                native.listeners.discard(queue)
                client["streaming"] = False
        return StreamingResponse(stream(), media_type="application/x-ndjson",
                                 headers={"X-Accel-Buffering": "no"})

    async def pairing_body(request, required):
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            raise InvalidOperation("JSON required")
        try:
            data = await request.json()
        except ValueError as error:
            raise InvalidOperation("Invalid JSON") from error
        if not isinstance(data, dict) or set(data) != set(required):
            raise InvalidOperation("Invalid pairing request")
        return data

    @app.post("/v1/pairing/request")
    async def request_pairing(request: Request):
        data = await pairing_body(request, ["challenge"])
        return pairing.request(request.scope["bot.origin"], data["challenge"])

    @app.post("/v1/pairing/claim")
    async def claim_pairing(request: Request):
        data = await pairing_body(request, ["request_id", "verifier"])
        return pairing.claim(data["request_id"], data["verifier"], request.scope["bot.origin"])

    @app.post("/v1/pairing/approve")
    async def approve_pairing(request: Request):
        data = await pairing_body(request, ["code"])
        return pairing.approve(data["code"], request.scope["bot.origin"])

    @app.post("/v1/pairing/revoke")
    async def revoke_pairing(request: Request):
        await pairing_body(request, [])
        pairing.revoke()
        clients.clear()
        return {"revoked": True}

    return app


def serve():
    import uvicorn
    from .setup import read_settings, config_path
    if not config_path().exists() and os.environ.get("HERMES_BOT_WEB_TOKEN"):
        token, origins, hosts = configuration()
        port = int(os.environ.get("HERMES_BOT_WEB_PORT", "8788"))
    else:
        settings = read_settings()
        token, origins, hosts = settings["token"], set(settings["origins"]), {settings["host"]}
        port = settings["port"]
    # Bind loopback only. Remote HTTPS uses a user-owned reverse proxy/tunnel.
    uvicorn.run(create_app(token, origins, hosts), host="127.0.0.1", port=port,
                access_log=False, proxy_headers=False, log_level="warning")
