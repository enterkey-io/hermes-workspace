"""Exercise actual ASGI stream frames without model calls or private Hermes state."""
import asyncio
from contextlib import suppress
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx

ROOT = Path(__file__).resolve().parents[2]
if "bot_web" not in sys.modules:
    spec = importlib.util.spec_from_file_location("bot_web", ROOT / "plugins/bot-web/__init__.py",
        submodule_search_locations=[str(ROOT / "plugins/bot-web")])
    module = importlib.util.module_from_spec(spec)
    sys.modules["bot_web"] = module
    spec.loader.exec_module(module)
from bot_web.server import create_app

ORIGIN = "https://app.example.test"
HOST = "hermes.example.test"
TOKEN = "s" * 43


class StreamTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        class Native:
            def __init__(self):
                self.listeners = set()
        self.native = Native()
        self.app = create_app(TOKEN, {ORIGIN}, {HOST}, self.native)
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url=f"https://{HOST}")
        headers = {"Origin": ORIGIN, "Authorization": "Bearer " + TOKEN}
        connected = await self.http.post("/v1/connect", headers=headers)
        self.headers = {**headers, "X-Bot-Connection": connected.json()["connection"]}
        self.tasks = []

    async def asyncTearDown(self):
        for task in self.tasks:
            task.cancel()
        for task in self.tasks:
            with suppress(asyncio.CancelledError):
                await task
        await self.http.aclose()

    async def stream(self):
        frames = asyncio.Queue()
        response = {}
        scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1", "scheme": "https", "method": "GET", "path": "/v1/events",
            "raw_path": b"/v1/events", "query_string": b"", "server": (HOST, 443),
            "client": ("127.0.0.1", 12345), "headers": [(key.lower().encode(), value.encode())
                for key, value in {**self.headers, "Host": HOST}.items()]}

        async def receive():
            await asyncio.Future()

        async def send(message):
            if message["type"] == "http.response.start":
                response.update(message)
            elif message["type"] == "http.response.body" and message.get("body"):
                for line in message["body"].splitlines():
                    frames.put_nowait(json.loads(line))

        task = asyncio.create_task(self.app(scope, receive, send))
        self.tasks.append(task)
        self.assertEqual(await asyncio.wait_for(frames.get(), 1), {"type": "bridge.ready"})
        self.assertEqual(response["status"], 200)
        self.assertEqual(dict(response["headers"])[b"access-control-allow-origin"].decode(), ORIGIN)
        return frames, task

    async def test_filtered_native_traffic_does_not_starve_heartbeats(self):
        with patch("bot_web.server.HEARTBEAT_SECONDS", 0.04, create=True):
            frames, _ = await self.stream()

            async def unrelated_traffic():
                while True:
                    for queue in tuple(self.native.listeners):
                        queue.put_nowait({"type": "status.update", "session_id": "another-session",
                            "payload": {"text": "private unrelated event"}})
                    await asyncio.sleep(0.003)

            self.tasks.append(asyncio.create_task(unrelated_traffic()))
            for _ in range(2):
                self.assertEqual(await asyncio.wait_for(frames.get(), 0.5), {"type": "bridge.heartbeat"})

    async def test_idle_stream_sends_heartbeats_without_native_events(self):
        with patch("bot_web.server.HEARTBEAT_SECONDS", 0.04):
            frames, _ = await self.stream()
            self.assertEqual(await asyncio.wait_for(frames.get(), 0.5), {"type": "bridge.heartbeat"})

    async def test_closed_lease_does_not_receive_an_event_already_waiting_for_delivery(self):
        frames, task = await self.stream()
        closed = await self.http.delete("/v1/connect", headers=self.headers)
        self.assertEqual(closed.status_code, 200)
        for queue in tuple(self.native.listeners):
            queue.put_nowait({"type": "bridge.resync"})
        await asyncio.wait_for(task, 0.5)
        self.assertTrue(frames.empty())
        self.assertFalse(self.native.listeners)

    async def test_closing_operator_probe_does_not_revoke_owner_browser(self):
        verifier = "v" * 43
        import hashlib
        pending = (await self.http.post("/v1/pairing/request", headers={"Origin": ORIGIN},
            json={"challenge": hashlib.sha256(verifier.encode()).hexdigest()})).json()
        approved = await self.http.post("/v1/pairing/approve", headers=self.headers, json={"code": pending["code"]})
        self.assertEqual(approved.status_code, 200)
        grant = (await self.http.post("/v1/pairing/claim", headers={"Origin": ORIGIN},
            json={"request_id": pending["request_id"], "verifier": verifier})).json()
        closed = await self.http.delete("/v1/connect", headers=self.headers)
        self.assertEqual(closed.status_code, 200)
        owner = await self.http.post("/v1/connect", headers={"Origin": ORIGIN,
            "Authorization": "Bearer " + grant["credential"]})
        self.assertEqual(owner.status_code, 200)


if __name__ == "__main__":
    unittest.main()
