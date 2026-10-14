"""One persistent, local Hermes stdio child; never one child per browser/request."""

import asyncio
import json
import os
from pathlib import Path
import sys
import uuid
from .compatibility import check_native_adapter


class NativeError(Exception):
    pass


class NativeGateway:
    def __init__(self):
        self.process = None
        self.pending = {}
        self.listeners = set()
        self.reader = None
        self.lock = asyncio.Lock()
        self.healthy = False
        self.build = None

    async def start(self):
        self.build = check_native_adapter()
        # Uses the installed Hermes interpreter/modules and user's own environment.
        env = {key: value for key, value in os.environ.items() if not key.startswith("HERMES_BOT_WEB_")}
        # Normal session.resume owns interactive approval setup. Do not use watch/lazy resume.
        env["HERMES_SINGLE_QUERY_SESSION"] = ""
        self.process = await asyncio.create_subprocess_exec(
            sys.executable, str(Path(__file__).with_name("native_entry.py")),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
            # Native stderr may contain tool output. Do not duplicate it in HTTP logs.
            stderr=asyncio.subprocess.DEVNULL, limit=4 * 1024 * 1024, env=env,
        )
        self.reader = asyncio.create_task(self._read())
        self.healthy = True
        # Startup handshake uses the actual native handler, not a fabricated capability.
        try:
            if self.build["server_requests"]:
                await self.call("client.capabilities", {"server_requests": True})
            await self.call("profiles.list", {"include_sessions": True})
            capabilities = await self.call("groups.capabilities", {})
            if capabilities.get("driver") is not True:
                raise NativeError("Native room driver unavailable")
        except BaseException:
            await self.stop()
            raise

    async def _read(self):
        try:
            while line := await self.process.stdout.readline():
                frame = json.loads(line)
                future = self.pending.get(frame.get("id"))
                if future is not None and not future.done():
                    if "error" in frame:
                        future.set_exception(NativeError("Hermes rejected the operation"))
                    else:
                        result = frame.get("result")
                        future.set_result(result)
                        if isinstance(result, dict):
                            for request in result.get("open_requests", []) or []:
                                if isinstance(request, dict):
                                    await self._server_request(request)
                elif frame.get("method") == "event":
                    event = frame["params"]
                    if event.get("type") == "request.cancel" and event.get("payload", {}).get("method") == "approval":
                        self._publish({**event, "type": "approval.request"})
                    else:
                        self._publish(event)
                elif frame.get("id") and isinstance(frame.get("method"), str):
                    await self._server_request(frame)
        except (ValueError, asyncio.LimitOverrunError):
            pass
        finally:
            self.healthy = False
            for future in self.pending.values():
                if not future.done():
                    future.set_exception(NativeError("Hermes gateway disconnected"))
            for queue in tuple(self.listeners):
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait({"type": "bridge.resync"})
            self.listeners.clear()
            if self.process.returncode is None:
                self.process.terminate()

    def _publish(self, event):
        for queue in tuple(self.listeners):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                self.listeners.discard(queue)
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait({"type": "bridge.resync"})

    async def _server_request(self, frame):
        params = frame.get("params", {})
        if frame.get("method") == "approval" and isinstance(params, dict):
            # Native approval.pending/respond remain authoritative: the browser never
            # gets a generic server-request responder or permanent/session approval.
            self._publish({"type": "approval.request", "session_id": params.get("session_id"),
                           "payload": {"request_id": params.get("request_id")}})
            return
        # Decline unsupported secret/sudo/desktop prompts instead of silently hanging
        # or inventing an answer. Never expose arbitrary request/response RPC to web.
        async with asyncio.timeout(8):
            async with self.lock:
                self.process.stdin.write((json.dumps({"jsonrpc": "2.0", "id": frame["id"],
                    "error": {"code": -32601, "message": "This client does not support this prompt"}}) + "\n").encode())
                await self.process.stdin.drain()

    async def call(self, method, params):
        if not self.healthy or len(self.pending) >= 32 or self.process is None or self.process.returncode is not None:
            raise NativeError("Hermes gateway unavailable")
        rid = uuid.uuid4().hex
        future = asyncio.get_running_loop().create_future()
        self.pending[rid] = future
        try:
            async with asyncio.timeout(45):
                async with self.lock:
                    if not self.healthy:
                        raise NativeError("Hermes gateway unavailable")
                    self.process.stdin.write((json.dumps({"jsonrpc": "2.0", "id": rid,
                        "method": method, "params": params}) + "\n").encode())
                    await self.process.stdin.drain()
                return await future
        except (TimeoutError, BrokenPipeError, ConnectionError) as error:
            # A timed-out mutation may have been accepted. Never retry automatically.
            raise NativeError("Operation outcome unknown; refresh before retrying") from error
        finally:
            self.pending.pop(rid, None)

    async def stop(self):
        if self.process is not None and self.process.returncode is None:
            self.process.stdin.close()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=8)
            except TimeoutError:
                self.process.terminate()
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=3)
                except TimeoutError:
                    self.process.kill()
                    await self.process.wait()
        if self.reader:
            await self.reader
