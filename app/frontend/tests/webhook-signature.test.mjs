import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../supabase/functions/_shared/verifyWebhookSignature.ts';

const secret = 'isolated-test-secret';
const body = '{"meta":{"event_name":"subscription_created"},"data":{"id":"test-sub"}}';
const sign = (value, key = secret) => createHmac('sha256', key).update(value).digest('hex');

test('accepts a valid signature from an independent HMAC implementation', async () => {
  assert.equal(await verifySignature(body, sign(body), secret), true);
});
test('rejects body tampering and JSON reformatting after signing', async () => {
  assert.equal(await verifySignature(body.replace('test-sub', 'other-sub'), sign(body), secret), false);
  assert.equal(await verifySignature(JSON.stringify(JSON.parse(body), null, 2), sign(body), secret), false);
});
test('rejects missing, malformed, truncated or wrong-secret signatures', async () => {
  for (const signature of ['', 'x'.repeat(64), sign(body).slice(1), sign(body) + '00', sign(body, 'other-secret')]) {
    assert.equal(await verifySignature(body, signature, secret), false);
  }
  assert.equal(await verifySignature(body, sign(body), ''), false);
});
test('preserves UTF-8 bytes and rejects a signed payload altered to another account', async () => {
  const payload = '{"user_id":"account-a","name":"أمانة"}';
  assert.equal(await verifySignature(payload, sign(payload), secret), true);
  assert.equal(await verifySignature(payload.replace('account-a', 'account-b'), sign(payload), secret), false);
});
