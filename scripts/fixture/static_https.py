"""Disposable HTTPS static host; no proxy or data API."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import ssl

parser = argparse.ArgumentParser()
parser.add_argument("--directory", default="apps/web/dist")
parser.add_argument("--port", type=int, default=5443)
parser.add_argument("--cert", required=True)
parser.add_argument("--key", required=True)
args = parser.parse_args()


class Static(SimpleHTTPRequestHandler):
    def __init__(self, *values, **kwargs):
        super().__init__(*values, directory=args.directory, **kwargs)

    def log_message(self, *values):
        pass

    def do_GET(self):
        if self.path == "/install":
            self.path = "/install.html"
        return super().do_GET()

    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


server = ThreadingHTTPServer(("127.0.0.1", args.port), Static)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(args.cert, args.key)
server.socket = context.wrap_socket(server.socket, server_side=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
