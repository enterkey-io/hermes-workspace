"""Operator-enrolled app issuer. No discovery URLs, vendor relay or browser admin key."""
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit


def trust_path():
    from .setup import config_path
    return config_path().with_name('owner-trust.json')


def validate_trust(value):
    if not isinstance(value, dict) or set(value) != {'schema', 'issuer', 'audience', 'origin', 'key_id', 'public_key'} or value['schema'] != 1:
        raise ValueError('Invalid owner trust file')
    parsed = urlsplit(value['origin'])
    if parsed.scheme != 'https' or parsed.netloc == '' or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password or value['issuer'] != value['origin']:
        raise ValueError('Exact HTTPS app origin required')
    for key in ('audience', 'key_id'):
        if not isinstance(value[key], str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value[key]):
            raise ValueError('Invalid installation key')
    jwk = value['public_key']
    if not isinstance(jwk, dict) or set(jwk) != {'kty', 'crv', 'x'} or jwk.get('kty') != 'OKP' or jwk.get('crv') != 'Ed25519':
        raise ValueError('Only a public Ed25519 verification key is accepted')
    import jwt
    jwt.algorithms.OKPAlgorithm.from_jwk(json.dumps(jwk))
    return value


def enroll(path):
    value = validate_trust(json.loads(Path(path).read_text()))
    destination = trust_path()
    destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Explicit operator enrollment is required; a browser cannot replace trust.
    temporary = destination.with_name('owner-trust.new')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream)
    os.replace(temporary, destination)
    return value


class OwnerTrust:
    def __init__(self, value):
        self.value = validate_trust(value)
        import jwt
        self.key = jwt.algorithms.OKPAlgorithm.from_jwk(json.dumps(value['public_key']))

    @classmethod
    def installed(cls):
        path = trust_path()
        return cls(json.loads(path.read_text())) if path.exists() else None

    def verify(self, token, origin):
        import jwt
        try:
            if len(token) > 4096 or origin != self.value['origin']:
                return None
            header = jwt.get_unverified_header(token)
            if header != {'alg': 'EdDSA', 'kid': self.value['key_id'], 'typ': 'JWT'}:
                return None
            claims = jwt.decode(token, self.key, algorithms=['EdDSA'], issuer=self.value['issuer'], audience=self.value['audience'],
                options={'require': ['exp', 'iat', 'iss', 'aud', 'sub', 'jti', 'scope', 'sid', 'origin']})
            if (claims['origin'] != origin or claims['scope'] != 'workspace.owner'
                or type(claims['exp']) is not int or type(claims['iat']) is not int
                or not 0 < claims['exp'] - claims['iat'] <= 300 or claims['iat'] > time.time()
                or not re.fullmatch(r'[a-f0-9-]{36}', claims['sub']) or not re.fullmatch(r'[a-f0-9]{64}', claims['sid'])):
                return None
            issuer = hashlib.sha256(self.value['issuer'].encode()).hexdigest()[:16]
            return {'principal': f"owner:{issuer}:{claims['sub']}", 'expires': claims['exp']}
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            return None
