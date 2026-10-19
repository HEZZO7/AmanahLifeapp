"""Bootstrap CONNECT proxy: only public dependency registries, never Supabase.
No credential/body/URL logging. Deleted before any authenticated integration test.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import select
import socket
ALLOWED = {'registry.npmjs.org', 'deno.land', 'jsr.io', 'esm.sh'}
class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass
    def do_CONNECT(self):
        parts = self.path.rsplit(':', 1)
        if len(parts) != 2 or parts[0].lower() not in ALLOWED or parts[1] != '443':
            self.send_error(403, 'Dependency origin not allowed')
            return
        try:
            with socket.create_connection((parts[0], 443), timeout=15) as remote:
                self.send_response(200, 'Connection established')
                self.end_headers()
                while True:
                    readers, _, _ = select.select([self.connection, remote], [], [], 30)
                    if not readers:
                        break
                    for current in readers:
                        data = current.recv(65536)
                        if not data:
                            return
                        (remote if current is self.connection else self.connection).sendall(data)
        except OSError:
            return
    def do_GET(self):
        self.send_error(403, 'CONNECT dependency origins only')
ThreadingHTTPServer(('0.0.0.0', 3128), Proxy).serve_forever()
