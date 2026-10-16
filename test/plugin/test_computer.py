import time
import unittest
from types import SimpleNamespace
from test_security import Native
from bot_web.operations import BotOperations, InvalidOperation
from bot_web.computer import Computer

class ScreenNative(Native):
    build={'revision':'af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a'}
    async def call(self,method,params):
        if method=='bot_web.screen.transport':
            self.calls.append((method,params));return {'port':12345,'credential':'PRIVATE'}
        if method=='display.observe':
            self.calls.append((method,params));return {'viewer_id':'bound-viewer','ticket':'NATIVE_PRIVATE'}
        if method.startswith('display.'):
            self.calls.append((method,params));return {'supported':True,'installed':True,'running':True,'rfb_socket':'SECRET_PATH','pid':123,'lease':{'holder':'human','viewer_id':'bound-viewer'}}
        return await super().call(method,params)
class Ws:
    def __init__(self,ticket,origin='https://owner.invalid',extra=[]):
        from starlette.datastructures import Headers,QueryParams
        raw=[(b'host',b'owner.invalid'),(b'origin',origin.encode()),*extra]
        self.scope={'headers':raw};self.headers=Headers(raw=raw);self.query_params=QueryParams({'ticket':ticket});self.closed=None
    async def close(self,code):self.closed=code
class ComputerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.native=ScreenNative();self.ops=BotOperations(self.native);self.clients={'connection':{'expires':time.time()+60}};self.computer=Computer(self.native,self.ops,self.clients,{'https://owner.invalid'},{'owner.invalid'}, enabled=True)
    async def test_typed_status_strips_private_fields_and_control_is_viewer_bound(self):
        client=self.clients['connection'];status=await self.computer.invoke('computer.status',{'profile':'alpha'},client,'connection')
        self.assertNotIn('rfb_socket',status);self.assertNotIn('pid',status);self.assertFalse(status['lease']['mine'])
        with self.assertRaises(InvalidOperation):await self.computer.invoke('computer.control',{'profile':'alpha'},client,'connection')
        ticket=await self.computer.invoke('computer.observe',{'profile':'alpha'},client,'connection')
        self.assertNotIn('credential',ticket);self.assertNotIn('native_ticket',ticket)
        await self.computer.invoke('computer.control',{'profile':'alpha'},client,'connection')
        self.assertIn(('display.lease.acquire',{'profile':'alpha','viewer_id':'bound-viewer'}),self.native.calls)
        with self.assertRaises(InvalidOperation):await self.computer.invoke('computer.control',{'profile':'alpha','viewer_id':'foreign'},client,'connection')
    async def test_stream_rejects_origin_duplicate_headers_expiry_replay_and_revocation(self):
        async def mint():return (await self.computer.invoke('computer.observe',{'profile':'alpha'},self.clients['connection'],'connection'))['ticket']
        ticket=await mint();ws=Ws(ticket,origin='https://evil.invalid');await self.computer.stream(ws);self.assertEqual(ws.closed,4403)
        ws=Ws(ticket,extra=[(b'origin',b'https://owner.invalid')]);await self.computer.stream(ws);self.assertEqual(ws.closed,4403)
        self.computer.tickets[ticket]['expires']=0;ws=Ws(ticket);await self.computer.stream(ws);self.assertEqual(ws.closed,4401)
        ws=Ws(ticket);await self.computer.stream(ws);self.assertEqual(ws.closed,4401)
        ticket=await mint();self.clients.clear();ws=Ws(ticket);await self.computer.stream(ws);self.assertEqual(ws.closed,4401)
    async def test_active_viewers_are_bounded_and_replaced_identity_is_rejected(self):
        client=self.clients['connection'];ticket=(await self.computer.invoke('computer.observe',{'profile':'alpha'},client,'connection'))['ticket'];self.computer.active.add(('connection','alpha'));ws=Ws(ticket);await self.computer.stream(ws);self.assertEqual(ws.closed,4429)
        self.computer.active.clear();ticket=(await self.computer.invoke('computer.observe',{'profile':'alpha'},client,'connection'))['ticket'];self.native.incarnation='b'*64;ws=Ws(ticket);await self.computer.stream(ws);self.assertEqual(ws.closed,4401)
    async def test_unsupported_revision_does_not_call_display(self):
        self.native.build={'revision':'29112bef099274229cadff79cdff7bf7b99c4b77'}
        self.assertEqual(await self.computer.invoke('computer.status',{'profile':'alpha'},{},'x'),{'supported':False})
        with self.assertRaises(InvalidOperation):await self.computer.invoke('computer.start',{'profile':'alpha'},{},'x')
        self.assertFalse(any(m.startswith('display.') for m,_ in self.native.calls))

    async def test_revoked_active_stream_closes_abnormally_without_handing_back_control(self):
        import asyncio
        from unittest.mock import patch
        client=self.clients['connection']
        ticket=(await self.computer.invoke('computer.observe',{'profile':'alpha'},client,'connection'))['ticket']
        client['expires']=time.time()+.1
        class Upstream:
            close_code=None
            async def __aenter__(self):return self
            async def __aexit__(self,*_):
                if self.close_code is None:self.close_code=1000
            def __aiter__(self):return self
            async def __anext__(self):await asyncio.Future()
            async def close(self,code):self.close_code=code
        class Viewer(Ws):
            async def accept(self):pass
            async def receive(self):await asyncio.Future()
            async def send_bytes(self,_):pass
        upstream=Upstream();ws=Viewer(ticket)
        with patch('websockets.asyncio.client.connect',return_value=upstream):
            await asyncio.wait_for(self.computer.stream(ws),3)
        self.assertEqual(ws.closed,4401)
        self.assertEqual(upstream.close_code,1011)
        self.assertEqual(self.computer.active,set())
