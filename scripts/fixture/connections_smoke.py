"""Real MCP/OAuth loopback fixture. No owner keys, providers or external services."""
import asyncio
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from urllib.parse import parse_qs, urlencode, urlsplit
from native_smoke import load_plugin

ROOT = Path(__file__).resolve().parents[2]


class Service(BaseHTTPRequestHandler):
    challenge = None
    verifier_checked = False
    bearer = 'synthetic-bearer-key'

    def log_message(self, *args):
        pass

    @property
    def origin(self):
        return 'http://127.0.0.1:'+str(self.server.server_port)

    def reply(self, status, data=None, headers=None):
        body = json.dumps(data).encode() if data is not None else b''
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith('/.well-known/oauth-protected-resource'):
            return self.reply(200, {'resource': self.origin+'/oauth-mcp', 'authorization_servers': [self.origin], 'scopes_supported': ['notes.read'], 'bearer_methods_supported': ['header']})
        if url.path.startswith('/.well-known/oauth-authorization-server') or url.path.startswith('/.well-known/openid-configuration'):
            return self.reply(200, {'issuer': self.origin, 'authorization_endpoint': self.origin+'/authorize', 'token_endpoint': self.origin+'/token', 'registration_endpoint': self.origin+'/register', 'response_types_supported': ['code'], 'grant_types_supported': ['authorization_code', 'refresh_token'], 'code_challenge_methods_supported': ['S256'], 'token_endpoint_auth_methods_supported': ['none'], 'scopes_supported': ['notes.read']})
        if url.path == '/authorize':
            query = parse_qs(url.query)
            Service.challenge = query['code_challenge'][0]
            location = query['redirect_uri'][0]+'?'+urlencode({'code': 'synthetic-authorization-code', 'state': query['state'][0]})
            return self.reply(302, headers={'Location': location})
        return self.reply(405)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path == '/register':
            data = json.loads(body)
            return self.reply(201, {**data, 'client_id': 'synthetic-client', 'token_endpoint_auth_method': 'none'})
        if self.path == '/token':
            data = parse_qs(body.decode())
            verifier = data.get('code_verifier', [''])[0]
            digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
            if digest != Service.challenge or data.get('code') != ['synthetic-authorization-code']:
                return self.reply(400, {'error': 'invalid_grant'})
            Service.verifier_checked = True
            return self.reply(200, {'access_token': 'synthetic-oauth-access', 'refresh_token': 'synthetic-oauth-refresh', 'token_type': 'Bearer', 'expires_in': 3600, 'scope': 'notes.read'})
        expected = 'synthetic-oauth-access' if self.path == '/oauth-mcp' else Service.bearer
        if self.headers.get('Authorization') != 'Bearer '+expected:
            return self.reply(401, {'error': 'unauthorized'}, {'WWW-Authenticate': f'Bearer resource_metadata="{self.origin}/.well-known/oauth-protected-resource"'})
        data = json.loads(body)
        if 'id' not in data:
            return self.reply(202)
        method, params = data.get('method'), data.get('params', {})
        if method == 'initialize':
            result = {'protocolVersion': params['protocolVersion'], 'capabilities': {'tools': {'listChanged': False}}, 'serverInfo': {'name': 'synthetic-notes', 'version': '1'}}
        elif method == 'tools/list':
            result = {'tools': [{'name': name, 'description': 'Synthetic '+name, 'inputSchema': {'type': 'object', 'properties': {}}} for name in ['read_note', 'write_note']]}
        elif method == 'tools/call':
            result = {'content': [{'type': 'text', 'text': 'Synthetic service result'}]}
        else:
            return self.reply(200, {'jsonrpc': '2.0', 'id': data['id'], 'error': {'code': -32601, 'message': 'Unknown method'}})
        return self.reply(200, {'jsonrpc': '2.0', 'id': data['id'], 'result': result})


async def verify(home, service):
    from bot_web.native import NativeGateway, NativeError
    from bot_web.operations import BotOperations
    from bot_web.workspace import WorkspaceService, WorkspaceStore
    gateway = NativeGateway()
    await gateway.start()
    workspace = WorkspaceService(BotOperations(gateway), WorkspaceStore(home / 'bot-web/workspace.sqlite'))
    try:
        await workspace.invoke('workspace.describe', {})
        permissions = await gateway.call('bot_web.connections.permissions', {'profile': 'default', 'name': 'notes'})
        assert permissions['allowed_tools'] == [] and permissions['bearer_supported']
        saved = await workspace.invoke('connections.set_key', {'profile': 'default', 'name': 'notes', 'value': Service.bearer, 'expected': permissions['fingerprint']})
        assert saved['saved']
        tested = await workspace.invoke('connections.test', {'profile': 'default', 'name': 'notes'})
        assert tested['ok'] is True, tested
        assert {tool['name'] for tool in tested['tools']} == {'read_note', 'write_note'}
        info = await workspace.invoke('connections.permissions', {'profile': 'default', 'name': 'notes'})
        selected = await workspace.invoke('connections.permissions', {'profile': 'default', 'name': 'notes', 'expected': info['fingerprint'], 'tools': ['read_note']})
        assert selected['allowed_tools'] == ['read_note']
        try:
            await workspace.invoke('connections.permissions', {'profile': 'default', 'name': 'notes', 'expected': info['fingerprint'], 'tools': ['write_note']})
        except NativeError:
            pass
        else:
            raise AssertionError('Stale connection write accepted')
        # Server metadata/code exchange are real sockets; only the human approval click is simulated.
        flow = await gateway.call('bot_web.connections.oauth', {'action': 'start', 'profile': 'default', 'name': 'oauth-notes', 'callback': 'https://bridge.example/v1/oauth/callback'})
        async with asyncio.timeout(45):
            while flow['status'] == 'starting':
                await asyncio.sleep(0.1)
                flow = await gateway.call('bot_web.connections.oauth', {'action': 'status', 'id': flow['id']})
        assert flow['status'] == 'authorization_required', flow
        import httpx
        async with httpx.AsyncClient(follow_redirects=False, trust_env=False) as browser:
            authorization = await browser.get(flow['authorization_url'])
        query = parse_qs(urlsplit(authorization.headers['location']).query)
        try:
            await gateway.call('bot_web.connections.oauth', {'action': 'callback', 'id': None, 'code': query['code'][0], 'state': 'wrong-state', 'error': None, 'iss': None})
        except NativeError:
            pass
        else:
            raise AssertionError('Wrong OAuth state accepted')
        await gateway.call('bot_web.connections.oauth', {'action': 'callback', 'id': None, 'code': query['code'][0], 'state': query['state'][0], 'error': None, 'iss': None})
        async with asyncio.timeout(45):
            while flow['status'] not in {'approved', 'error'}:
                await asyncio.sleep(0.1)
                flow = await gateway.call('bot_web.connections.oauth', {'action': 'status', 'id': flow['id']})
        assert flow['status'] == 'approved', flow
        assert Service.verifier_checked, 'PKCE was not checked by fixture provider'
        permissions = await gateway.call('bot_web.connections.permissions', {'profile': 'default', 'name': 'oauth-notes'})
        assert permissions['allowed_tools'] == [], 'OAuth silently granted tools'
        assert 'synthetic-oauth-access' not in json.dumps(flow) and 'synthetic-oauth-refresh' not in json.dumps(flow)
        print(json.dumps({'connections': 'pass', 'revision': gateway.build['revision'], 'bearer_native_storage': 'pass', 'real_mcp_discovery': 'pass', 'exact_tool_allowlist': 'pass', 'stale_write': 'rejected', 'native_dashboard_oauth': 'pass', 'pkce': 'verified', 'wrong_state': 'rejected', 'post_auth_tool_grant': 'empty', 'provider': 'synthetic-loopback-only'}))
    finally:
        workspace.store.db.close()
        await gateway.stop()


def main():
    with tempfile.TemporaryDirectory(prefix='workspace-mcp-') as directory:
        home = Path(directory) / 'home'
        home.mkdir()
        os.environ.clear()
        os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin', HERMES_HOME=str(home), HERMES_RUNTIME_DIR=str(Path(directory) / 'runtime'), PYTHONPYCACHEPREFIX=str(Path(directory) / 'pycache'), PYTHONUNBUFFERED='1', NO_PROXY='127.0.0.1,localhost', HERMES_NO_AUTO_INSTALL='1')
        service = ThreadingHTTPServer(('127.0.0.1', 0), Service)
        threading.Thread(target=service.serve_forever, daemon=True).start()
        origin = f'http://127.0.0.1:{service.server_port}'
        (home / '.env').write_text('# no owner credentials\n')
        (home / 'config.yaml').write_text('agent:\n  bot_mode_protocol: true\nmcp_servers:\n  notes:\n    url: '+origin+'/key-mcp\n    tools:\n      include: []\n  oauth-notes:\n    url: '+origin+'/oauth-mcp\n    auth: oauth\n    tools:\n      include: []\n')
        load_plugin(ROOT)
        try:
            asyncio.run(verify(home, service))
        finally:
            service.shutdown()

if __name__ == '__main__':
    main()
