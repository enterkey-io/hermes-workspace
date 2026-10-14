"""Proof-bound owner approvals; browser grants cannot act as administrator credentials."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

import httpx

ROOT = Path(__file__).resolve().parents[2]
if "bot_web" not in sys.modules:
    spec = importlib.util.spec_from_file_location("bot_web", ROOT / "plugins/bot-web/__init__.py",
        submodule_search_locations=[str(ROOT / "plugins/bot-web")])
    module = importlib.util.module_from_spec(spec)
    sys.modules["bot_web"] = module
    spec.loader.exec_module(module)
from bot_web.pairing import BrowserPairing
from bot_web.operations import InvalidOperation
from bot_web.server import create_app
from bot_web.setup import configure, read_settings

ORIGIN = "https://owner.example.test"
VERIFIER = "v" * 43
CHALLENGE = hashlib.sha256(VERIFIER.encode()).hexdigest()


class PairingTests(unittest.TestCase):
    def test_no_credential_before_owner_approval_and_single_use_claim(self):
        pairing = BrowserPairing()
        request = pairing.request(ORIGIN, CHALLENGE)
        self.assertNotIn("credential", request)
        self.assertEqual(pairing.claim(request["request_id"], VERIFIER, ORIGIN), {"status": "pending"})
        pairing.approve(request["code"], ORIGIN)
        grant = pairing.claim(request["request_id"], VERIFIER, ORIGIN)
        self.assertIsNotNone(pairing.principal(grant["credential"], ORIGIN))
        self.assertIsNone(pairing.principal(grant["credential"], "https://other.test"))
        self.assertNotIn(grant["credential"], pairing.grants)
        with self.assertRaises(InvalidOperation):
            pairing.claim(request["request_id"], VERIFIER, ORIGIN)

    def test_known_code_does_not_replace_browser_proof(self):
        pairing = BrowserPairing()
        request = pairing.request(ORIGIN, CHALLENGE)
        pairing.approve(request["code"], ORIGIN)
        with self.assertRaises(InvalidOperation):
            pairing.claim(request["request_id"], "x" * 43, ORIGIN)
        self.assertEqual(pairing.grants, {})
        with self.assertRaises(InvalidOperation):
            pairing.approve(request["code"], "https://evil.test")

    def test_expiry_and_revocation(self):
        pairing = BrowserPairing()
        with patch("bot_web.pairing.time.monotonic", return_value=100):
            pending = pairing.request(ORIGIN, CHALLENGE)
        with patch("bot_web.pairing.time.monotonic", return_value=401):
            with self.assertRaises(InvalidOperation):
                pairing.approve(pending["code"], ORIGIN)
        pending = pairing.request(ORIGIN, CHALLENGE)
        pairing.approve(pending["code"], ORIGIN)
        grant = pairing.claim(pending["request_id"], VERIFIER, ORIGIN)
        pairing.revoke()
        self.assertIsNone(pairing.principal(grant["credential"], ORIGIN))

    def test_request_and_wrong_proof_attempts_are_bounded(self):
        pairing = BrowserPairing()
        first = pairing.request(ORIGIN, CHALLENGE)
        for _ in range(7):
            pairing.request(ORIGIN, CHALLENGE)
        with self.assertRaises(InvalidOperation):
            pairing.request(ORIGIN, CHALLENGE)
        for _ in range(5):
            with self.assertRaises(InvalidOperation):
                pairing.claim(first["request_id"], "x" * 43, ORIGIN)
        self.assertNotIn(first["request_id"], pairing.pending)


class PairingBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_browser_cannot_approve_itself_or_use_another_lease(self):
        class Native:
            listeners = set()
            async def call(self, method, params):
                return {"bot_mode_protocol": True, "profiles": []}
        app = create_app("a" * 43, {ORIGIN}, {"owner.example.test"}, Native())
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN) as client:
            headers = {"Origin": ORIGIN}
            pending = (await client.post('/v1/pairing/request', headers=headers, json={"challenge": CHALLENGE})).json()
            self.assertEqual((await client.post('/v1/pairing/approve', headers=headers, json={"code":pending["code"]})).status_code, 401)
            operator = {**headers, "Authorization": "Bearer " + "a" * 43}
            self.assertEqual((await client.post('/v1/pairing/approve', headers=operator, json={"code":pending["code"]})).status_code, 200)
            grant = (await client.post('/v1/pairing/claim', headers=headers, json={"request_id":pending["request_id"], "verifier":VERIFIER})).json()
            browser = {**headers, "Authorization": "Bearer " + grant["credential"]}
            self.assertEqual((await client.post('/v1/pairing/approve', headers=browser, json={"code":pending["code"]})).status_code, 403)
            operator_lease = (await client.post('/v1/connect', headers=operator)).json()["connection"]
            self.assertEqual((await client.post('/v1/rpc', headers={**browser, "X-Bot-Connection":operator_lease}, json={"operation":"bots.list","params":{}})).status_code, 400)
            self.assertEqual((await client.post('/v1/connect', headers=browser)).status_code, 200)
            await client.post('/v1/pairing/revoke', headers=operator, json={})
            self.assertEqual((await client.post('/v1/connect', headers=browser)).status_code, 401)


class SetupTests(unittest.TestCase):
    def test_setup_keeps_administrator_credential_private_and_preserves_existing_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            web = root / "web"; web.mkdir()
            (web / "index.html").write_text("preview")
            (web / "_headers").write_text("headers")
            config = root / "private/connection.json"
            output = io.StringIO()
            with patch("bot_web.setup.config_path", return_value=config), patch("bot_web.compatibility.check_native_adapter"), redirect_stdout(output):
                configure("https://BRIDGE.EXAMPLE.TEST:443/", [ORIGIN], 8788)
                settings = read_settings()
                self.assertEqual(settings["bridge_url"], "https://bridge.example.test")
                self.assertEqual(settings["origins"], [ORIGIN])
                self.assertNotIn("web_dir", settings)
                self.assertEqual(config.stat().st_mode & 0o777, 0o600)
                self.assertNotIn(settings["token"], output.getvalue())
                before = config.read_bytes()
                with self.assertRaises(ValueError):
                    configure("https://bridge.example.test", [ORIGIN], 8788)
                self.assertEqual(config.read_bytes(), before)

    def test_setup_needs_no_web_files_and_rejects_unsafe_origins(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "private/connection.json"
            with patch("bot_web.setup.config_path", return_value=config), patch("bot_web.compatibility.check_native_adapter"), redirect_stdout(io.StringIO()):
                for origin in ["*", "http://app.test", "https://app.test/path", "https://user:pass@app.test", "https://app.test?secret=bad"]:
                    with self.assertRaises(ValueError):
                        configure("https://bridge.test", [origin], 8788)
                configure("https://bridge.test", [ORIGIN, "https://second-app.test"], 8788)
                self.assertEqual(read_settings()["origins"], [ORIGIN, "https://second-app.test"])
                self.assertEqual(list(config.parent.iterdir()), [config])
