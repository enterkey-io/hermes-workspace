"""Private loopback transport in the SAME process as native display ticket minting.

Only the fixed parent integration can reach it; native RFB filtering and leases
remain authoritative. The public dashboard/router authorization is not changed.
"""
import hmac
import secrets
import socket
import threading
import time

_transport = None
_lock = threading.Lock()

def register():
    from tui_gateway import server

    def prepare(rid, params):
        global _transport
        try:
            if params or 'display.observe' not in server._methods:
                raise ValueError()
            with _lock:
                if _transport:
                    return server._ok(rid, _transport)
                from fastapi import FastAPI, WebSocket
                from hermes_cli.dashboard_auth.ws_tickets import consume_ticket
                from hermes_cli.web_routers.display import _bridge
                import uvicorn
                app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
                credential = secrets.token_urlsafe(32)
                @app.websocket('/stream')
                async def stream(ws: WebSocket):
                    if (ws.headers.get('origin') != 'http://pebble.internal' or
                        not hmac.compare_digest(ws.headers.get('authorization', ''), 'Bearer ' + credential) or
                        len(ws.query_params) != 1 or 'display_ticket' not in ws.query_params):
                        await ws.close(code=4403)
                        return
                    try:
                        info = consume_ticket(ws.query_params['display_ticket'])
                        if info.get('provider') != 'bot-desktop' or not info.get('hermes_home') or not info.get('viewer_id'):
                            raise ValueError()
                    except Exception:
                        await ws.close(code=4401)
                        return
                    await ws.accept()
                    await _bridge(ws, info)
                listener = socket.socket()
                listener.bind(('127.0.0.1', 0))
                listener.listen(8)
                config = uvicorn.Config(app, log_level='critical', access_log=False, ws_max_size=2 * 1024 * 1024)
                runtime = uvicorn.Server(config)
                threading.Thread(target=runtime.run, kwargs={'sockets': [listener]}, daemon=True, name='pebble-native-screen').start()
                deadline = time.monotonic() + 5
                while not runtime.started and time.monotonic() < deadline:
                    time.sleep(.01)
                if not runtime.started:
                    runtime.should_exit = True
                    listener.close()
                    raise RuntimeError()
                _transport = {'port': listener.getsockname()[1], 'credential': credential}
                return server._ok(rid, _transport)
        except Exception:
            return server._err(rid, 5072, 'Native Computer transport unavailable')
    server.method('bot_web.screen.transport')(prepare)
