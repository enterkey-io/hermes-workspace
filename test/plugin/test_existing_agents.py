"""Existing-agent selection is narrow native registration, never profile/persona copying."""
import asyncio
from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
if "bot_web" not in sys.modules:
    spec = importlib.util.spec_from_file_location("bot_web", ROOT / "plugins/bot-web/__init__.py",
        submodule_search_locations=[str(ROOT / "plugins/bot-web")])
    module = importlib.util.module_from_spec(spec)
    sys.modules["bot_web"] = module
    spec.loader.exec_module(module)
from bot_web.operations import BotOperations, InvalidOperation
from bot_web.native import NativeError


class Native:
    def __init__(self):
        self.calls = []
        self.rows = [{"name": "writer", "display_name": "Writer", "path": "/private/profile",
            "ui_meta": {"another-plugin": {"keep": True}}, "ui_meta_revisions": {"hermes-bots": 2}}]
        self.sessions = []
        self.retired = False
        self.conflict = False
        self.lookup_error = False

    async def has_stored_bot_chat(self, profile):
        return self.retired or bool(self.sessions)

    async def call(self, method, params):
        self.calls.append((method, deepcopy(params)))
        if method == "profiles.list":
            return {"bot_mode_protocol": True, "profiles": deepcopy(self.rows)}
        if method == "session.list":
            if self.lookup_error: raise NativeError("Lookup failed")
            return {"sessions": deepcopy(self.sessions)}
        if method == "profiles.configure":
            if self.conflict: return {"applied": {"ui_meta": False}}
            self.rows[0]["ui_meta"].update(params["ui_meta"])
            return {"applied": {"ui_meta": True}}
        if method == "session.create":
            return {"session_id": "runtime-new"}
        if method == "session.title":
            self.sessions = [{"id": "canonical-existing", "title": "Bot Chat"}]
            self.rows[0]["canonical_session"] = {"id": "canonical-existing"}
            return {"title": "Bot Chat"}
        raise AssertionError(f"Unexpected native method: {method}")


class ExistingAgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_discovery_includes_unmarked_agents_but_not_paths_or_persona_files(self):
        native = Native()
        data = await BotOperations(native).invoke("agents.list", {})
        self.assertEqual(data["agents"][0]["name"], "Writer")
        self.assertFalse(data["agents"][0]["managed"])
        self.assertNotIn("path", data["agents"][0])
        self.assertEqual([m for m, _ in native.calls], ["profiles.list"])

    async def test_enable_preserves_other_metadata_and_reuses_profile_and_chat(self):
        native = Native()
        ops = BotOperations(native)
        first, second = await asyncio.gather(*[ops.invoke("agent.enable",
            {"profile": "writer", "initialize_chat": True}) for _ in range(2)])
        self.assertTrue(first["managed"] and second["canonical"])
        writes = [p for m, p in native.calls if m == "profiles.configure"]
        self.assertEqual(len(writes), 1)
        self.assertEqual(set(writes[0]), {"name", "ui_meta", "ui_meta_expected_revisions"})
        self.assertEqual(writes[0]["ui_meta_expected_revisions"], {"hermes-bots": 2})
        self.assertEqual(native.rows[0]["ui_meta"]["another-plugin"], {"keep": True})
        self.assertEqual(sum(m == "session.create" for m, _ in native.calls), 1)
        self.assertFalse(any(m in {"profiles.create", "prompt.submit"} for m, _ in native.calls))

    async def test_existing_native_chat_is_adopted_without_creation_or_renaming(self):
        native = Native()
        native.sessions = [{"id": "original", "title": "Bot Chat"}]
        native.rows[0]["canonical_session"] = {"id": "original"}
        result = await BotOperations(native).invoke("agent.enable", {"profile": "writer", "initialize_chat": True})
        self.assertTrue(result["canonical"])
        self.assertFalse(any(m in {"session.create", "session.title"} for m, _ in native.calls))

    async def test_unknown_profiles_injected_fields_and_missing_confirmation_rejected(self):
        native = Native()
        ops = BotOperations(native)
        for params in [{"profile": "../writer", "initialize_chat": True},
                {"profile": "missing", "initialize_chat": True},
                {"profile": "writer", "initialize_chat": False},
                {"profile": "writer", "initialize_chat": True, "soul": "replace"}]:
            with self.assertRaises(InvalidOperation): await ops.invoke("agent.enable", params)
        self.assertFalse(any(m in {"profiles.configure", "session.create"} for m, _ in native.calls))

    async def test_retired_or_inconsistent_chat_is_not_replaced(self):
        for retired, canonical in [(True, None), (False, {"id": "known"})]:
            native = Native()
            native.retired = retired
            native.rows[0]["canonical_session"] = canonical
            with self.assertRaises(InvalidOperation):
                await BotOperations(native).invoke("agent.enable", {"profile": "writer", "initialize_chat": True})
            self.assertFalse(any(m in {"profiles.configure", "session.create"} for m, _ in native.calls))

    async def test_lookup_errors_and_metadata_conflicts_do_not_mint_chats(self):
        for key, error in [("lookup_error", NativeError), ("conflict", InvalidOperation)]:
            native = Native()
            setattr(native, key, True)
            with self.assertRaises(error):
                await BotOperations(native).invoke("agent.enable", {"profile": "writer", "initialize_chat": True})
            self.assertFalse(any(m == "session.create" for m, _ in native.calls))
