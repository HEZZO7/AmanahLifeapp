import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_RETURN_KEY, resolveAuthReturn, readAuthReturn, rememberAuthReturn, consumeAuthReturn } from '../src/lib/authReturn.ts';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('direct subscription login persists the destination across OAuth navigation', () => {
  const store = storage();
  const destination = readAuthReturn('?next=%2Fsubscription', store);
  rememberAuthReturn(destination, store);
  assert.equal(consumeAuthReturn('?code=opaque-code', store), '/subscription');
  assert.equal(store.getItem(AUTH_RETURN_KEY), null);
});

test('known callback destination works in a new tab without session storage', () => {
  assert.equal(consumeAuthReturn('?code=opaque-code&next=%2Fsubscription', storage()), '/subscription');
});

test('ordinary login keeps its existing dashboard destination', () => {
  assert.equal(consumeAuthReturn('?code=opaque-code', storage()), '/');
});

test('external, protocol-relative, encoded, and arbitrary internal destinations cannot redirect', () => {
  for (const value of ['https://attacker.example', '//attacker.example', '/admin', 'javascript:alert(1)', '/subscription?success=true', '%2Fsubscription', '/subscription/']) {
    assert.equal(resolveAuthReturn(value, null), '/');
  }
});

test('an explicit invalid destination cannot inherit an old subscription intent', () => {
  assert.equal(resolveAuthReturn('https://attacker.example', '/subscription'), '/');
});

test('stored values are validated and cannot create an open redirect', () => {
  const store = storage();
  store.setItem(AUTH_RETURN_KEY, 'https://attacker.example');
  assert.equal(consumeAuthReturn('', store), '/');
  assert.equal(store.getItem(AUTH_RETURN_KEY), null);
});

test('ordinary authentication clears a stale intent', () => {
  const store = storage();
  rememberAuthReturn('/subscription', store);
  rememberAuthReturn('/', store);
  assert.equal(readAuthReturn('', store), '/');
});

test('storage failures do not break safe return resolution', () => {
  const blocked = {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); },
    removeItem() { throw Error('blocked'); },
  };
  assert.doesNotThrow(() => rememberAuthReturn('/subscription', blocked));
  assert.equal(consumeAuthReturn('?next=%2Fsubscription', blocked), '/subscription');
  assert.equal(readAuthReturn('', blocked), '/');
});
