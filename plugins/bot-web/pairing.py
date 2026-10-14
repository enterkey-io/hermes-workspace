"""Owner-approved, short-lived browser credentials. No operator secret in the browser."""
import hashlib
import hmac
import secrets
import time

from .operations import InvalidOperation


class BrowserPairing:
    def __init__(self):
        self.pending = {}
        self.grants = {}
        self.recent = {}

    def cleanup(self):
        now = time.monotonic()
        self.pending = {key: value for key, value in self.pending.items() if value["expires"] > now}
        self.grants = {key: value for key, value in self.grants.items() if value["expires"] > now}

    def request(self, origin, challenge):
        import re
        if not isinstance(challenge, str) or not re.fullmatch(r"[0-9a-f]{64}", challenge):
            raise InvalidOperation("Invalid pairing challenge")
        self.cleanup()
        now = time.monotonic()
        recent = [stamp for stamp in self.recent.get(origin, []) if stamp > now - 60]
        if len(recent) >= 12 or len(self.pending) >= 8 or len(self.grants) >= 16:
            raise InvalidOperation("Too many pairing requests")
        self.recent[origin] = [*recent, now]
        request_id = secrets.token_urlsafe(32)
        code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        while any(value["code"] == code for value in self.pending.values()):
            code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        self.pending[request_id] = {"code": code, "challenge": challenge, "origin": origin,
                                    "expires": now + 300, "approved": False, "attempts": 0}
        return {"request_id": request_id, "code": code[:4] + "-" + code[4:], "expires_in": 300}

    def approve(self, code, origin):
        if not isinstance(code, str):
            raise InvalidOperation("Invalid pairing code")
        code = code.replace("-", "").strip().upper()
        self.cleanup()
        for value in self.pending.values():
            if value["origin"] == origin and hmac.compare_digest(value["code"], code):
                value["approved"] = True
                return {"approved": True, "origin": origin}
        raise InvalidOperation("No matching pending browser request")

    def claim(self, request_id, verifier, origin):
        import re
        self.cleanup()
        value = self.pending.get(request_id) if isinstance(request_id, str) else None
        if value is None or value["origin"] != origin:
            raise InvalidOperation("Pairing expired or unavailable")
        if not isinstance(verifier, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", verifier):
            raise InvalidOperation("Invalid verifier")
        challenge = hashlib.sha256(verifier.encode()).hexdigest()
        if not hmac.compare_digest(challenge, value["challenge"]):
            value["attempts"] += 1
            if value["attempts"] >= 5:
                self.pending.pop(request_id, None)
            raise InvalidOperation("Pairing proof rejected")
        if not value["approved"]:
            return {"status": "pending"}
        self.pending.pop(request_id)
        token = secrets.token_urlsafe(32)
        principal = hashlib.sha256(token.encode()).hexdigest()
        self.grants[principal] = {"origin": origin, "expires": time.monotonic() + 3600}
        return {"status": "approved", "credential": token, "expires_in": 3600}

    def principal(self, token, origin):
        self.cleanup()
        key = hashlib.sha256(token.encode()).hexdigest()
        grant = self.grants.get(key)
        return key if grant and grant["origin"] == origin else None

    def alive(self, principal):
        self.cleanup()
        return principal == "operator" or principal in self.grants

    def revoke(self):
        self.pending.clear()
        self.grants.clear()
