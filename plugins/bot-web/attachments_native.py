"""Fixed attachment helpers at Hermes's extension seam; no native method is replaced."""
import base64
import hashlib
import os
import stat
from pathlib import Path
import re

def register():
    from tui_gateway import server

    def attachment(rid, params):
        try:
            action = params.get('action')
            allowed = {'session_id', 'action', 'ids'} if action in {'pending', 'discard'} else {'session_id', 'action', 'id', 'content_base64', 'filename'}
            if set(params) != allowed:
                raise ValueError()
            session, error = server._sess_building(params, rid)
            if error:
                return error
            if action in {'pending', 'discard'}:
                ids = params['ids']
                if not isinstance(ids, list) or len(ids) > 5 or any(not re.fullmatch(r'[A-Za-z0-9_-]{43}', str(value)) for value in ids):
                    raise ValueError()
                prefixes = tuple('pebble_' + value + '_' for value in ids)
                queued = [path for path in session.get('attached_images', []) if Path(path).name.startswith(prefixes)] if prefixes else []
                if action == 'discard':
                    if session.get('running'):
                        raise ValueError('A turn is still running')
                    session['attached_images'] = [path for path in session.get('attached_images', []) if path not in queued]
                return server._ok(rid, {'running': bool(session.get('running')), 'pending': [value for value in ids if any(Path(path).name.startswith('pebble_' + value + '_') for path in queued)]})
            if action not in {'image', 'file'} or not re.fullmatch(r'[A-Za-z0-9_-]{43}', str(params['id'])):
                raise ValueError()
            data = base64.b64decode(params['content_base64'], validate=True)
            if not 0 < len(data) <= 10 * 1024 * 1024:
                raise ValueError()
            if action == 'file':
                name = params['id'] + '_' + Path(params['filename']).name
                root = server._session_home_dir(session, 'attachments') if hasattr(server, '_session_home_dir') else server._desktop_attachment_dir(session)
                target = root / server._sanitize_attachment_name(name)
                if target.exists() or target.is_symlink():
                    fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW)
                    with os.fdopen(fd, 'rb') as saved:
                        metadata = os.fstat(saved.fileno())
                        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size != len(data) or hashlib.sha256(saved.read(len(data)+1)).digest() != hashlib.sha256(data).digest():
                            raise ValueError()
                    ref = server._attachment_ref_path(session, target)
                    return server._ok(rid, {'attached': True, 'ref_text': '@file:' + server._format_ref_value(ref)})
                return server._methods['file.attach'](rid, {'session_id': params['session_id'], 'data_url': 'data:application/octet-stream;base64,' + params['content_base64'], 'name': name})
            existing = next((p for p in session.get('attached_images', []) if Path(p).name.startswith('pebble_' + params['id'] + '_')), None)
            if existing:
                return server._ok(rid, {'attached': True, 'path': existing})
            ext = server._sniff_image_ext(data, params['filename'])
            if ext not in {'.png', '.jpg', '.jpeg', '.webp'}:
                raise ValueError()
            path = server._queue_attached_image(session, data, ext, prefix='pebble_' + params['id'])
            return server._ok(rid, {'attached': True, 'path': str(path)})
        except Exception:
            return server._err(rid, 5071, 'Attachment state not confirmed')
    server.method('bot_web.attachments')(attachment)
