"""Real unmodified Hermes native gateway with a deterministic local model.

All Hermes state and test messages live in an isolated temporary directory.
This proves native execution, not quality or reliability of a production model.
"""

import argparse
import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import os
import shlex
from pathlib import Path
import sys
import tempfile
import threading
import time


def load_plugin(root):
    spec = importlib.util.spec_from_file_location("bot_web", root / "plugins/bot-web/__init__.py",
        submodule_search_locations=[str(root / "plugins/bot-web")])
    module = importlib.util.module_from_spec(spec)
    sys.modules["bot_web"] = module
    spec.loader.exec_module(module)


class Model(BaseHTTPRequestHandler):
    saw_native_tool = False
    emitted_handoff = False
    emitted_approval = False
    approval_target = ""
    slow_started = threading.Event()
    turns = 0
    tools_seen = set()

    def log_message(self, *args):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            # Native Stop can cancel an in-flight provider response.
            pass

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"object":"list","data":[{"id":"fixture-model","object":"model"}]}')

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Model.turns += 1
        if any(t.get("function", {}).get("name") == "message_agent" for t in data.get("tools", [])):
            Model.saw_native_tool = True
        text = "Native fixture reply"
        latest_user = next((m for m in reversed(data.get("messages", [])) if m.get("role") == "user"), {})
        tools = data.get("tools", [])
        Model.tools_seen.update(t.get("function", {}).get("name", "") for t in tools)
        handoff = ("nativehandoff" in str(latest_user.get("content"))
            and not Model.emitted_handoff
            and any(t.get("function", {}).get("name") == "message_agent" for t in tools))
        approval = ("nativeapproval" in str(latest_user.get("content")) and not Model.emitted_approval
            and any(t.get("function", {}).get("name") == "terminal" for t in tools))
        if "nativestop" in str(latest_user.get("content")) and any(t.get("function", {}).get("name") == "message_agent" for t in tools):
            Model.slow_started.set()
            time.sleep(3)
            text = "Slow fixture reply"
        message = {"role": "assistant", "content": text}
        finish = "stop"
        if handoff:
            Model.emitted_handoff = True
            message = {"role": "assistant", "content": None, "tool_calls": [{"id": "fixture-dm",
                "type": "function", "function": {"name": "message_agent", "arguments": json.dumps(
                    {"target": "beta", "message": "Teammate delivery proof"})}}]}
            finish = "tool_calls"
        elif approval:
            Model.emitted_approval = True
            message = {"role": "assistant", "content": None, "tool_calls": [{"id": "fixture-approval",
                "type": "function", "function": {"name": "terminal", "arguments": json.dumps(
                    {"command": "rm -rf " + shlex.quote(Model.approval_target)})}}]}
            finish = "tool_calls"
        output = {"id": "fixture-completion", "object": "chat.completion", "created": int(time.time()),
            "model": "fixture-model", "choices": [{"index": 0, "message": message,
            "finish_reason": finish}], "usage": {"prompt_tokens": 100, "completion_tokens": 10, "total_tokens": 110}}
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream" if data.get("stream") else "application/json")
        self.end_headers()
        if data.get("stream"):
            delta = {"role": "assistant", "content": text}
            if handoff or approval:
                delta = {"role": "assistant", "tool_calls": [{"index": 0, **message["tool_calls"][0]}]}
            for delta, reason in [(delta, None), ({}, finish)]:
                chunk = {**output, "object": "chat.completion.chunk", "choices": [{"index": 0,
                    "delta": delta, "finish_reason": reason}]}
                self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.write(b"data: [DONE]\n\n")
        else:
            self.wfile.write(json.dumps(output).encode())


def seed(home, port):
    from hermes_cli.profiles import create_profile
    from hermes_state import SessionDB

    config = ("model:\n  default: fixture-model\n  provider: custom:fixture\nproviders:\n"
              f"  fixture:\n    base_url: http://127.0.0.1:{port}/v1\n    api_key: fixture-only\n"
              "agent:\n  max_turns: 3\n  bot_mode_protocol: true\n"
              "approvals:\n  mode: manual\n"
              "toolsets:\n  - terminal\n")
    (home / "config.yaml").write_text(config)
    (home / ".env").write_text("# No user credentials\n")
    for name in ("alpha", "beta"):
        path = create_profile(name, no_alias=True, no_skills=True)
        (path / "config.yaml").write_text(config)
        (path / "profile.yaml").write_text(f"name: {name}\nui_meta:\n  hermes-bots:\n    title: {name.title()}\n")
        db = SessionDB(db_path=path / "state.db")
        db.create_session(f"canonical-{name}", "cli")
        db.set_session_title(f"canonical-{name}", "Bot Chat")
        db.set_session_hidden(f"canonical-{name}", True)
        db.close()


async def exercise(root, home, port, *, seed_only=False):
    from hermes_state import SessionDB
    from bot_web.native import NativeGateway
    from bot_web.operations import BotOperations
    seed(home, port)
    approval_target = home.parent / "approval-target"
    approval_target.mkdir()
    (approval_target / "keep.txt").write_text("Synthetic protected test file")
    Model.approval_target = str(approval_target)
    gateway = NativeGateway()
    await gateway.start()
    ops = BotOperations(gateway)
    try:
        for name in ("alpha", "beta"):
            routine = await gateway.call("cron.manage", {"profile": name, "action": "add",
                "name": f"{name}-routine", "schedule": "0 9 * * *", "prompt": "Synthetic routine", "deliver": f"bot-chat:{name}"})
            assert routine.get("success") is True
        await gateway.call("groups.create", {"room_id": "fixture-room", "name": "Team room",
            "members": [{"member_id": name, "profile": name, "handle": name, "display_name": name.title()}
                        for name in ("alpha", "beta")]})
        if seed_only:
            return
        roster = await ops.invoke("bots.list", {})
        assert {bot["profile"] for bot in roster["bots"]} == {"alpha", "beta"}
        opened = await ops.invoke("bot.open", {"profile": "alpha"})
        sid = opened["session_id"]
        assert opened["canonical_id"] == "canonical-alpha"
        queue = asyncio.Queue(maxsize=256)
        gateway.listeners.add(queue)
        await ops.invoke("chat.send", {"session_id": sid, "text": "Hello native bot"})
        completed = False
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            event = await asyncio.wait_for(queue.get(), timeout=60)
            if event.get("type") == "message.complete" and event.get("session_id") == sid:
                assert event.get("payload", {}).get("status") != "error", "Real native turn failed"
                completed = True
                break
        assert completed
        history = await ops.invoke("chat.history", {"session_id": sid})
        assert any(m.get("text") == "Native fixture reply" for m in history["messages"])
        assert Model.saw_native_tool, "Actual Bot Mode message_agent tool was not injected"
        await ops.invoke("chat.send", {"session_id": sid, "text": "nativehandoff: ask beta to help"})
        deadline = time.monotonic() + 60
        delivered = False
        while time.monotonic() < deadline:
            db = SessionDB(db_path=home / "profiles/beta/state.db")
            beta_messages = db.get_messages_as_conversation("canonical-beta", include_ancestors=True)
            db.close()
            if any("Teammate delivery proof" in str(m.get("content")) for m in beta_messages):
                delivered = True
                break
            await asyncio.sleep(0.2)
        assert delivered, "Native message_agent did not deliver into beta's Bot Chat"
        async def idle():
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if not (await ops.invoke("bot.open", {"profile": "alpha"}))["running"]:
                    return
                await asyncio.sleep(0.1)
            raise AssertionError("Native bot remained running")
        await idle()
        await ops.invoke("chat.send", {"session_id": sid, "text": "nativeapproval: require explicit permission"})
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            pending = await ops.invoke("chat.approvals", {"session_id": sid})
            if pending["approvals"]:
                await ops.invoke("chat.approve", {"session_id": sid, "request_id": pending["approvals"][0]["request_id"], "choice": "deny"})
                break
            await asyncio.sleep(0.1)
        else:
            raise AssertionError(f"Native approval was not requested; emitted={Model.emitted_approval}; terminal_offered={'terminal' in Model.tools_seen}; target_exists={approval_target.exists()}")
        await idle()
        assert (approval_target / "keep.txt").exists(), "Denied action must not execute"
        await ops.invoke("chat.send", {"session_id": sid, "text": "nativestop: a cancellable native turn"})
        assert await asyncio.to_thread(Model.slow_started.wait, 10), "Slow native turn never started"
        stopped = await ops.invoke("chat.stop", {"session_id": sid})
        assert stopped.get("status") == "interrupted"
        await idle()
        room_send = await ops.invoke("room.send", {"room_id": "fixture-room", "event_id": "fixture-room-event", "text": "@alpha Begin the native discussion"})
        assert room_send.get("driver_started") is True
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            log = await ops.invoke("room.log", {"room_id": "fixture-room", "since_seq": 0})
            if any(e.get("kind") == "message.member" for e in log["events"]):
                break
            await asyncio.sleep(0.2)
        else:
            raise AssertionError("Native group driver produced no member response")
        reopened = await ops.invoke("bot.open", {"profile": "alpha"})
        assert reopened["canonical_id"] == opened["canonical_id"]
        assert any(m.get("text") == "Hello native bot" for m in reopened["messages"])
        routines = await ops.invoke("routines.list", {"profile": "alpha"})
        assert routines.get("scoped") == "alpha"
        assert {job["name"] for job in routines["jobs"]} == {"alpha-routine"}
        print(json.dumps({"native_bot_mode": "pass", "canonical_continuity": "pass",
            "native_message_agent_injection": "pass", "owner_scoped_routines": "pass",
            "native_teammate_delivery": "pass", "native_room_driver_execution": "pass",
            "native_denied_approval": "pass", "native_stop": "pass",
            "model_turns": Model.turns, "hermes_version": "0.21.0", "evidence": "real-runtime-local"}))
    finally:
        await gateway.stop()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=str(Path(__file__).resolve().parents[2]))
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int, default=8788)
    parser.add_argument("--cert")
    parser.add_argument("--key")
    parser.add_argument("--origin", default="https://127.0.0.1:5443")
    args = parser.parse_args()
    root = Path(args.project)
    with tempfile.TemporaryDirectory(prefix="bot-web-native-") as directory:
        home = Path(directory) / "home"
        home.mkdir()
        # No inherited model keys or personal Hermes configuration.
        os.environ.clear()
        os.environ.update(PATH=f"{Path(sys.executable).parent}:/usr/bin:/bin",
            HERMES_HOME=str(home), HERMES_RUNTIME_DIR=str(Path(directory) / "runtime"),
            PYTHONPYCACHEPREFIX=str(Path(directory) / "pycache"), PYTHONUNBUFFERED="1",
            NO_PROXY="127.0.0.1,localhost", HERMES_NO_AUTO_INSTALL="1")
        model = ThreadingHTTPServer(("127.0.0.1", 0), Model)
        thread = threading.Thread(target=model.serve_forever, daemon=True)
        thread.start()
        load_plugin(root)
        try:
            if args.serve:
                asyncio.run(exercise(root, home, model.server_port, seed_only=True))
                from bot_web.server import create_app
                import uvicorn
                uvicorn.run(create_app("f" * 43, {args.origin}, {f"127.0.0.1:{args.port}"}),
                    host="127.0.0.1", port=args.port, ssl_certfile=args.cert, ssl_keyfile=args.key,
                    access_log=False, proxy_headers=False, log_level="warning")
            else:
                asyncio.run(exercise(root, home, model.server_port))
        finally:
            model.shutdown()


if __name__ == "__main__":
    main()
