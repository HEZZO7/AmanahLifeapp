"""Read-only artifact mirror for Deno; never proxies or opens an outbound connection."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib,json,re,sys,urllib.parse

def route(root,records,path):
    path=urllib.parse.unquote(urllib.parse.urlsplit(path).path).strip('/')
    if path in records:
        return 'application/json',json.dumps(records[path],sort_keys=True).encode()
    if re.fullmatch(r'tarballs/[a-f0-9]{128}\.tgz',path):
        data=(root/path).read_bytes()
        if hashlib.sha512(data).hexdigest()+'.tgz'!=path.split('/')[-1]:
            raise ValueError('Cached tarball integrity mismatch')
        return 'application/octet-stream',data
    raise ValueError('Dependency not in the frozen graph')

def serve(root):
    records=json.loads((root/'index.json').read_text())
    class Registry(BaseHTTPRequestHandler):
        def log_message(self,*_): pass
        def do_GET(self):
            try:
                kind,data=route(root,records,self.path)
            except (OSError,ValueError):
                self.send_error(404,'Frozen artifact not available'); return
            self.send_response(200)
            self.send_header('Content-Type',kind)
            self.send_header('Content-Length',str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    ThreadingHTTPServer(('0.0.0.0',4873),Registry).serve_forever()

if __name__=='__main__': serve(Path(sys.argv[1]))
