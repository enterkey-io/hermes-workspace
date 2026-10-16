"""Real native display bridge/ticket/RFB-filter probe with a synthetic framebuffer, not a Linux desktop certification."""
import asyncio
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from urllib.parse import urlencode
from native_smoke import load_plugin

async def exercise(home):
    from tui_gateway import server
    from bot_web import screen_native
    from hermes_cli.dashboard_auth.ws_tickets import mint_ticket
    from tools.bot_desktop import lease
    from websockets.asyncio.client import connect
    from websockets.exceptions import InvalidStatus
    root=Path(home)/'bot-desktop';root.mkdir()
    received=bytearray()
    async def framebuffer(reader,writer):
        writer.write(b'RFB 003.008\n');await writer.drain()
        received.extend(await reader.readexactly(12))
        writer.write(b'\x01\x01');await writer.drain()
        received.extend(await reader.readexactly(1))
        writer.write(b'\x00'*4);await writer.drain()
        received.extend(await reader.readexactly(1))
        writer.write(struct.pack('!HH',2,2)+bytes([32,24,0,1])+struct.pack('!HHH',255,255,255)+bytes([16,8,0,0,0,0])+struct.pack('!I',4)+b'Test');await writer.drain()
        while chunk:=await reader.read(4096):received.extend(chunk)
        writer.close();await writer.wait_closed()
    unix=await asyncio.start_unix_server(framebuffer,path=str(root/'rfb.sock'))
    server._methods.setdefault('display.observe',lambda *_:None)
    screen_native.register()
    transport=await asyncio.to_thread(server._methods['bot_web.screen.transport'],1,{})
    assert 'result' in transport,transport
    transport=transport['result']
    def ticket():return mint_ticket(user_id='display:fixture-viewer',provider='bot-desktop',extra={'hermes_home':home,'viewer_id':'fixture-viewer'})
    url='ws://127.0.0.1:'+str(transport['port'])+'/stream?'
    good=ticket()
    try:
        try:
            async with connect(url+urlencode({'display_ticket':good}),origin='http://attacker.invalid',additional_headers={'Authorization':'Bearer '+transport['credential']}):raise AssertionError('bad origin accepted')
        except InvalidStatus:pass
        async with connect(url+urlencode({'display_ticket':good}),origin='http://pebble.internal',additional_headers={'Authorization':'Bearer '+transport['credential']}) as ws:
            assert await ws.recv()==b'RFB 003.008\n';await ws.send(b'RFB 003.008\n');assert await ws.recv()==b'\x01\x01';await ws.send(b'\x01');assert await ws.recv()==b'\x00'*4;await ws.send(b'\x01');assert (await ws.recv()).endswith(b'Test')
            key=b'\x04\x01\x00\x00\x00\x00\x00a'
            before=len(received);await ws.send(key);await asyncio.sleep(.1);assert len(received)==before,'watcher input reached native socket'
            lease.acquire('fixture-viewer',profile_key=home);await asyncio.sleep(.35);await ws.send(key);await asyncio.sleep(.1);assert received[before:]==key,'lease-holder input was not delivered'
            await ws.close(code=1000)
        await asyncio.sleep(.1);assert lease.get(profile_key=home).holder!=lease.HUMAN,'clean close kept lease'
        try:
            async with connect(url+urlencode({'display_ticket':good}),origin='http://pebble.internal',additional_headers={'Authorization':'Bearer '+transport['credential']}):raise AssertionError('ticket replay accepted')
        except InvalidStatus:pass
        print(json.dumps({'native_ticket_same_process':'pass','private_origin_auth':'pass','native_rfb_watch_gate':'pass','native_human_control':'pass','native_clean_close_handback':'pass','one_use_ticket':'pass','runtime':'synthetic-framebuffer-real-native-bridge','linux_desktop_runtime':'not-tested-on-mac'}))
    finally:
        unix.close();await unix.wait_closed()

with tempfile.TemporaryDirectory(prefix='pebble-screen-') as home:
    os.environ['HERMES_HOME']=home
    load_plugin(Path(__file__).resolve().parents[2])
    asyncio.run(exercise(home))
