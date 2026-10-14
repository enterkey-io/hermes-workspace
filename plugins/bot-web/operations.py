"""Typed operations over real native handlers. No arbitrary RPC passthrough."""

import asyncio
import re

from .native import NativeError


class InvalidOperation(Exception):
    pass


def fields(params, allowed):
    if not isinstance(params, dict) or set(params) != set(allowed):
        raise InvalidOperation("Invalid operation fields")


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value):
        raise InvalidOperation("Invalid identifier")
    return value


class BotOperations:
    def __init__(self, gateway):
        self.gateway = gateway
        self.sessions = {}
        self.open_lock = asyncio.Lock()

    async def roster(self):
        result = await self.gateway.call("profiles.list", {"include_sessions": True})
        if result.get("bot_mode_protocol") is not True:
            raise NativeError("Native Bot Mode protocol unavailable")
        return [row for row in result["profiles"]
                if isinstance(row.get("ui_meta", {}).get("hermes-bots"), dict)]

    async def bot(self, profile):
        identifier(profile)
        for bot in await self.roster():
            if bot["name"] == profile:
                return bot
        raise InvalidOperation("Managed bot unavailable")

    async def invoke(self, operation, params):
        if operation == "bots.list":
            fields(params, [])
            return {"bots": [{"profile": b["name"],
                "name": b["ui_meta"]["hermes-bots"].get("title") or b.get("display_name") or b["name"],
                "description": b["ui_meta"]["hermes-bots"].get("description") or b.get("description") or "",
                "canonical": b.get("canonical_session") is not None}
                for b in await self.roster()]}
        if operation == "bot.open":
            fields(params, ["profile"])
            async with self.open_lock:
                bot = await self.bot(params["profile"])
                canonical = bot.get("canonical_session")
                if not canonical or not canonical.get("id"):
                    # Do not resurrect deliberately retired chats or fork a second canonical.
                    raise InvalidOperation("Open this bot's Bot Chat once in Hermes first")
                live = await self.gateway.call("session.resume", {"profile": bot["name"],
                    "session_id": canonical["id"]})
                sid = identifier(live["session_id"])
                self.sessions[sid] = bot["name"]
                return {"session_id": sid, "profile": bot["name"],
                        "canonical_id": canonical["id"], "messages": live.get("messages", []),
                        "inflight": live.get("inflight"), "running": live.get("running") is True}
        if operation in {"chat.send", "chat.stop", "chat.history", "chat.approvals", "chat.approve", "chat.replay"}:
            extras = {"chat.send": ["text"], "chat.approve": ["request_id", "choice"],
                      "chat.replay": ["last_seen"]}.get(operation, [])
            fields(params, ["session_id", *extras])
            sid = identifier(params["session_id"])
            if sid not in self.sessions:
                raise InvalidOperation("Open the managed bot first")
            await self.bot(self.sessions[sid])
            native_params = {"session_id": sid}
            method = {"chat.send": "prompt.submit", "chat.stop": "session.interrupt",
                      "chat.history": "session.history", "chat.approvals": "approval.pending",
                      "chat.approve": "approval.respond", "chat.replay": "session.events.since"}[operation]
            if operation == "chat.send":
                text = params["text"]
                if not isinstance(text, str) or not text.strip() or len(text) > 16000:
                    raise InvalidOperation("Invalid message")
                native_params["text"] = text
            if operation == "chat.approve":
                if params["choice"] not in {"once", "deny"}:
                    raise InvalidOperation("Invalid approval choice")
                pending = await self.gateway.call("approval.pending", native_params)
                request_id = identifier(params["request_id"])
                if not any(a.get("request_id") == request_id for a in pending["approvals"]):
                    raise InvalidOperation("Approval is no longer pending for this bot")
                native_params.update(request_id=request_id, choice=params["choice"])
            if operation == "chat.replay":
                cursor = params["last_seen"]
                if type(cursor) is not int or cursor < 0:
                    raise InvalidOperation("Invalid cursor")
                native_params["last_seen"] = cursor
            return await self.gateway.call(method, native_params)
        if operation == "routines.list":
            fields(params, ["profile"])
            await self.bot(params["profile"])
            return await self.gateway.call("cron.manage", {"profile": params["profile"],
                "action": "list", "include_disabled": True})
        if operation == "rooms.list":
            fields(params, [])
            return await self.gateway.call("groups.list", {"limit": 100, "offset": 0})
        if operation == "room.approve":
            fields(params, ["room_id", "member_id", "task_id", "execution_generation", "request_id", "choice"])
            keys = ["member_id", "task_id", "request_id"]
            checked = {key: identifier(params[key]) for key in ["room_id", *keys]}
            if type(params["execution_generation"]) is not int or params["execution_generation"] < 1 or params["choice"] not in {"once", "deny"}:
                raise InvalidOperation("Invalid room approval")
            checked.update(execution_generation=params["execution_generation"], choice=params["choice"])
            state = await self.gateway.call("groups.state", {"room_id": checked["room_id"]})
            pending = state.get("driver_status", {}).get("pending_actions", [])
            if not any(action.get("kind") == "approval" and all(action.get(key) == checked[key]
                for key in [*keys, "execution_generation"]) for action in pending):
                raise InvalidOperation("Room approval is no longer pending")
            return await self.gateway.call("groups.approve", checked)
        if operation in {"room.state", "room.log", "room.send", "room.stop"}:
            extras = {"room.log": ["since_seq"], "room.send": ["event_id", "text"]}.get(operation, [])
            fields(params, ["room_id", *extras])
            native_params = {"room_id": identifier(params["room_id"])}
            if operation == "room.log":
                if type(params["since_seq"]) is not int or params["since_seq"] < 0:
                    raise InvalidOperation("Invalid cursor")
                native_params.update(since_seq=params["since_seq"], limit=100)
            if operation == "room.send":
                text = params["text"]
                if not isinstance(text, str) or not text.strip() or len(text) > 16000:
                    raise InvalidOperation("Invalid message")
                event_id = identifier(params["event_id"])
                native_params.update(event_id=event_id, payload={"text": text, "thread_id": event_id})
            return await self.gateway.call({"room.state": "groups.state", "room.log": "groups.log",
                "room.send": "groups.send", "room.stop": "groups.stop"}[operation], native_params)
        raise InvalidOperation("Operation unavailable")
