// Isolated Node suites only: no real provider/Supabase HTTP or TCP connections.
// Provider handlers receive injected fixture adapters instead of global fetch.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

const deny = () => { throw new Error('External network prohibited in isolated subscription tests'); };
globalThis.fetch = async () => deny();
net.Socket.prototype.connect = deny;
http.request = deny;
http.get = deny;
https.request = deny;
https.get = deny;
