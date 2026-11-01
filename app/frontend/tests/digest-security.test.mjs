import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const entry = new URL('../supabase/functions/app_11941c8fec_weekly_digest/index.ts', import.meta.url).href;
const previous = { Deno: globalThis.Deno, fixture: globalThis.__digestFixture };
let handler, active;
globalThis.__digestFixture = { serve: fn => { handler = fn; }, client: () => active.client, mail: (...args) => active.mail(...args) };
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://offline.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture', INTERNAL_DIGEST_SECRET: active?.secret,
  SMTP_HOST: 'smtp.offline.invalid', SMTP_USER: 'fixture', SMTP_PASSWORD: 'fixture', SMTP_FROM: 'fixture@offline.invalid' })[key] } };
const moduleURL = source => 'data:text/javascript,' + encodeURIComponent(source);
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === entry && specifier.startsWith('https://deno.land')) return { url: moduleURL('export const serve=fn=>globalThis.__digestFixture.serve(fn);'), shortCircuit: true };
  if (context.parentURL === entry && specifier.startsWith('npm:@supabase')) return { url: moduleURL('export const createClient=()=>globalThis.__digestFixture.client();'), shortCircuit: true };
  if (context.parentURL === entry && specifier === 'npm:nodemailer') return { url: moduleURL('export default {createTransport(){return {sendMail:(...a)=>globalThis.__digestFixture.mail(...a)}}};'), shortCircuit: true };
  return next(specifier, context);
} });
try { await import(entry); } finally { hook.deregister(); }
after(() => {
  if (previous.Deno === undefined) delete globalThis.Deno; else globalThis.Deno = previous.Deno;
  if (previous.fixture === undefined) delete globalThis.__digestFixture; else globalThis.__digestFixture = previous.fixture;
});
const challenge = { id: 'fixture', name: '<img src=x onerror=alert(1)>', icon: '<script>', targetAmount: 100, savedAmount: 10, completedMilestones: [] };
function fixture(options = {}) {
  const calls = [];
  active = { calls, secret: options.secret, mail: async message => { calls.push(['mail', message]); }, client: {
    auth: { getUser: async token => ({ data: { user: token === 'own-token' ? { id: 'own' } : null }, error: null }),
      admin: { getUserById: async id => { calls.push(['identity', id]); return { data: { user: { email: 'fixture@offline.invalid' } }, error: null }; } } },
    from: table => {
      calls.push(['from', table]); let write = false;
      const q = {
        select: columns => { calls.push(['select', columns]); return q; }, eq: (...args) => { calls.push(['eq', ...args]); return q; },
        single: async () => ({ data: { enabled: false }, error: null }),
        upsert: async row => { calls.push(['upsert', row]); return { error: options.writeError ? { message: 'PRIVATE_DATABASE_DETAIL' } : null }; },
        update: row => { write = true; calls.push(['update', row]); return q; },
        then: (resolve, reject) => Promise.resolve({ data: [{ user_id: 'own', savings_data: { challenges: [challenge] } }], error: write && options.writeError ? { message: 'PRIVATE_DATABASE_DETAIL' } : null }).then(resolve, reject),
      }; return q;
    },
  } };
  return active;
}
const request = (body, auth = 'Bearer own-token', secret) => new Request('https://offline.invalid/digest', {
  method: 'POST', headers: { Authorization: auth, ...(secret ? { 'X-Internal-Digest-Secret': secret } : {}) }, body: JSON.stringify(body),
});
for (const secret of [undefined, 'forged']) {
  test('bulk email requires the configured internal secret: ' + secret, async () => {
    const f = fixture({ secret: 'fixture-internal' }); assert.equal((await handler(request({ action: 'send_digests' }, 'Bearer own-token', secret))).status, 401);
    assert.deepEqual(f.calls, []);
  });
}
test('unset internal configuration fails closed even with a supplied secret', async () => {
  const f = fixture(); assert.equal((await handler(request({ action: 'send_digests' }, '', 'fixture-internal'))).status, 401); assert.deepEqual(f.calls, []);
});
test('digest subscribe binds ownership to JWT, ignoring forged target identity', async () => {
  const f = fixture(); const r = await handler(request({ action: 'subscribe', enabled: true, user_id: 'victim', savings_data: { challenges: [challenge] } }));
  assert.equal(r.status, 200); assert.equal(f.calls.find(c => c[0] === 'upsert')[1].user_id, 'own');
});
for (const auth of ['', 'Basic own-token', 'Bearer forged', 'Bearer own-token extra']) {
  test('digest preferences require a valid Bearer identity: ' + auth, async () => {
    const f = fixture(); const r = await handler(request({ action: 'subscribe', enabled: true }, auth)); assert.equal(r.status, 401); assert.deepEqual(f.calls, []);
  });
}
for (const body of [null, [], { action: 'subscribe', enabled: 'true' }, { action: 'subscribe', enabled: true, savings_data: { challenges: [3] } },
  { action: 'subscribe', enabled: true, savings_data: { challenges: [{ ...challenge, savedAmount: 'markup' }] } }]) {
  test('malformed digest input cannot be stored: ' + JSON.stringify(body), async () => {
    const f = fixture(); assert.equal((await handler(request(body))).status, 400); assert.equal(f.calls.some(c => c[0] === 'upsert'), false);
  });
}
test('digest preference lookup selects only enabled and authenticated identity', async () => {
  const f = fixture(); const r = await handler(request({ action: 'get_preferences', user_id: 'victim' })); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { enabled: false }); assert.ok(f.calls.some(c => c[0] === 'eq' && c[2] === 'own'));
  assert.equal(f.calls.find(c => c[0] === 'select')[1], 'enabled');
});
test('trusted digest delivery escapes stored HTML and does not take a request target', async () => {
  const f = fixture({ secret: 'fixture-internal' }); const r = await handler(request({ action: 'send_digests', user_id: 'victim' }, '', 'fixture-internal'));
  assert.equal(r.status, 200); assert.equal((await r.json()).sent, 1);
  const mail = f.calls.find(c => c[0] === 'mail')[1]; assert.doesNotMatch(mail.html, /<img src=x|<script>/); assert.match(mail.html, /&lt;img/);
  assert.ok(f.calls.some(c => c[0] === 'eq' && c[2] === 'own')); assert.equal(JSON.stringify(f.calls).includes('victim'), false);
});
test('digest marker failures do not report a successful sweep', async () => {
  fixture({ secret: 'fixture-internal', writeError: true }); const r = await handler(request({ action: 'send_digests' }, '', 'fixture-internal'));
  assert.equal(r.status, 502); const body = await r.json(); assert.equal(body.success, false); assert.equal(body.failed, 1); assert.doesNotMatch(JSON.stringify(body), /PRIVATE_DATABASE_DETAIL/);
});
