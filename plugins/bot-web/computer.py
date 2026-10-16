"""Owner-authenticated per-profile screen broker. No public native ports or general proxy."""
import asyncio
from contextlib import suppress
import secrets
import time
from urllib.parse import urlencode
from .operations import InvalidOperation, fields, identifier
from .native import NativeError

class Computer:
    def __init__(self, native, ops, clients, origins, hosts, *, enabled=False):
        self.native, self.ops, self.clients = native, ops, clients
        self.origins, self.hosts, self.tickets = origins, hosts, {}
        self.active = set()
        self.enabled = enabled

    @property
    def supported(self):
        return self.enabled and (getattr(self.native, 'build', None) or {}).get('revision') == 'af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a'

    async def invoke(self, operation, params, client, connection):
        fields(params, ['profile'])
        profile = identifier(params['profile'])
        await self.ops.bot(profile)
        if not self.supported:
            if operation == 'computer.status':
                return {'supported': False}
            raise InvalidOperation('Computer unavailable in this native revision')
        stamp = await self.ops.stamp(profile)
        if operation in {'computer.status', 'computer.start', 'computer.stop'}:
            result = await self.native.call({'computer.status': 'display.status', 'computer.start': 'display.start', 'computer.stop': 'display.stop'}[operation], {'profile': profile})
        elif operation == 'computer.observe':
            transport = await self.native.call('bot_web.screen.transport', {})
            if type(transport.get('port')) is not int or not 1 <= transport['port'] <= 65535 or not isinstance(transport.get('credential'), str):
                raise InvalidOperation('Computer transport unavailable')
            result = await self.native.call('display.observe', {'profile': profile, **({'viewer_id': client.get('viewers', {}).get(profile)} if client.get('viewers', {}).get(profile) else {})})
            if await self.ops.stamp(profile) != stamp:
                raise InvalidOperation('Pebble changed')
            now = time.monotonic()
            self.tickets = {k: v for k, v in self.tickets.items() if v['expires'] > now}
            if len(self.tickets) >= 32:
                raise InvalidOperation('Too many viewers')
            ticket = secrets.token_urlsafe(32)
            client.setdefault('viewers', {})[profile] = result['viewer_id']
            self.tickets[ticket] = {'expires': now + 25, 'connection': connection, 'profile': profile, 'stamp': stamp, 'transport': transport, 'native_ticket': result['ticket']}
            return {'ticket': ticket, 'viewer_id': result['viewer_id']}
        elif operation in {'computer.control', 'computer.release', 'computer.force_release'}:
            viewer = client.get('viewers', {}).get(profile)
            if not viewer and operation != 'computer.force_release':
                raise InvalidOperation('Open this Computer first')
            result = await self.native.call('display.lease.acquire' if operation == 'computer.control' else 'display.lease.release', {'profile': profile, **({'force': True} if operation == 'computer.force_release' else {'viewer_id': viewer})})
        else:
            raise InvalidOperation('Computer operation unavailable')
        # Paths, native socket names, pids and install commands are not browser configuration.
        safe = {key: result[key] for key in ('supported', 'installed', 'running', 'missing', 'blocker', 'placement', 'lease') if key in result}
        if isinstance(safe.get('lease'), dict):
            lease = safe['lease']
            safe['lease'] = {'holder': lease.get('holder'), 'mine': lease.get('viewer_id') == client.get('viewers', {}).get(profile)}
        return safe

    async def stream(self, ws):
        headers = list(ws.scope.get('headers', []))
        if (ws.headers.get('origin') not in self.origins or ws.headers.get('host') not in self.hosts or
            any(sum(k == name for k, _ in headers) != 1 for name in (b'host', b'origin')) or
            len(list(ws.query_params.multi_items())) != 1):
            await ws.close(code=4403)
            return
        grant = self.tickets.pop(ws.query_params.get('ticket', ''), None)
        if not grant or grant['expires'] < time.monotonic():
            await ws.close(code=4401)
            return
        client = self.clients.get(grant['connection'])
        try:
            if not client or (client.get('expires') and client['expires'] <= time.time()) or await self.ops.stamp(grant['profile']) != grant['stamp']:
                raise InvalidOperation('Viewer access expired')
            await self.ops.bot(grant['profile'])
        except (InvalidOperation, NativeError):
            await ws.close(code=4401)
            return
        key = (grant['connection'], grant['profile'])
        if key in self.active or len(self.active) >= 4:
            await ws.close(code=4429)
            return
        self.active.add(key)
        from websockets.asyncio.client import connect
        from websockets.exceptions import ConnectionClosed
        transport = grant['transport']
        url = 'ws://127.0.0.1:' + str(transport['port']) + '/stream?' + urlencode({'display_ticket': grant['native_ticket']})
        await ws.accept()
        try:
            async with connect(url, origin='http://pebble.internal', additional_headers={'Authorization': 'Bearer ' + transport['credential']}, max_size=2 * 1024 * 1024, max_queue=4, close_timeout=2) as upstream:
                async def browser_to_native():
                    while True:
                        message = await ws.receive()
                        if message['type'] == 'websocket.disconnect':
                            await upstream.close(code=1000 if message.get('code') in {1000, 1001} else 1011)
                            return
                        if not isinstance(message.get('bytes'), bytes) or len(message['bytes']) > 2 * 1024 * 1024:
                            await ws.close(code=1003)
                            await upstream.close(code=1011)
                            return
                        await upstream.send(message['bytes'])
                async def native_to_browser():
                    try:
                        async for frame in upstream:
                            if not isinstance(frame, bytes):
                                raise ValueError()
                            await ws.send_bytes(frame)
                    except ConnectionClosed:
                        pass
                    await ws.close(code=upstream.close_code if upstream.close_code and 1000 <= upstream.close_code < 5000 and upstream.close_code not in {1005, 1006, 1015} else 1011)
                async def authorization():
                    while True:
                        await asyncio.sleep(1)
                        try:
                            active = self.clients.get(grant['connection'])
                            if not active or (active.get('expires') and active['expires'] <= time.time()) or await self.ops.stamp(grant['profile']) != grant['stamp']:
                                raise InvalidOperation('Viewer access expired')
                            await self.ops.bot(grant['profile'])
                        except (InvalidOperation, NativeError):
                            await ws.close(code=4401)
                            await upstream.close(code=1011)
                            return
                tasks = [asyncio.create_task(fn()) for fn in (browser_to_native, native_to_browser, authorization)]
                try:
                    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
                    if upstream.close_code is None:
                        await upstream.close(code=1011)
        except Exception:
            with suppress(Exception):
                await ws.close(code=1011)
        finally:
            self.active.discard(key)
