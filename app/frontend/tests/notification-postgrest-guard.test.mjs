import assert from 'node:assert/strict';
import {test} from 'node:test';
import {target, productionProjectRef} from './notification-postgrest-target.mjs';
const jwt = (sub, overrides={}) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',exp:Date.now()/1000+600,...overrides})).toString('base64url')}.signature`;
const ref = 'aaaaaaaaaaaaaaaaaaaa';
const valid = () => ({NOTIFICATION_TEST_MODE:'isolated-hosted',NOTIFICATION_TEST_MUTATION:'synthetic-users-only',NOTIFICATION_TEST_PROJECT_REF:ref,
 NOTIFICATION_TEST_URL:`https://${ref}.supabase.co`,NOTIFICATION_TEST_PUBLIC_KEY:'sb_publishable_fixture',
 NOTIFICATION_TEST_JWT_A:jwt('11111111-1111-4111-8111-111111111111',{iss:`https://${ref}.supabase.co/auth/v1`}),
 NOTIFICATION_TEST_JWT_B:jwt('22222222-2222-4222-8222-222222222222',{iss:`https://${ref}.supabase.co/auth/v1`})});
for (const [name, patch] of Object.entries({
 'production project':{NOTIFICATION_TEST_PROJECT_REF:productionProjectRef,NOTIFICATION_TEST_URL:`https://${productionProjectRef}.supabase.co`},
 'custom production alias':{NOTIFICATION_TEST_URL:'https://app.amanahlife.com'},
 'wrong ref':{NOTIFICATION_TEST_URL:'https://bbbbbbbbbbbbbbbbbbbb.supabase.co'},
 'HTTP downgrade':{NOTIFICATION_TEST_URL:`http://${ref}.supabase.co`},
 'missing approval':{NOTIFICATION_TEST_MUTATION:''}, 'missing mode':{NOTIFICATION_TEST_MODE:''},
 'URL credentials':{NOTIFICATION_TEST_URL:`https://user:pass@${ref}.supabase.co`},
 'service key':{NOTIFICATION_TEST_PUBLIC_KEY:'sb_secret_fixture'},
 'service JWT':{NOTIFICATION_TEST_PUBLIC_KEY:jwt('fixture',{role:'service_role'})},
 'expired session':{NOTIFICATION_TEST_JWT_A:jwt('11111111-1111-4111-8111-111111111111',{exp:1})},
 'wrong user role':{NOTIFICATION_TEST_JWT_A:jwt('11111111-1111-4111-8111-111111111111',{role:'service_role'})},
 'wrong issuer':{NOTIFICATION_TEST_JWT_A:jwt('11111111-1111-4111-8111-111111111111',{iss:'https://other.invalid/auth/v1'})},
 'malformed JWT':{NOTIFICATION_TEST_JWT_A:'invalid'},
})) test(`test target rejects ${name}`,()=>assert.throws(()=>target({...valid(),...patch})));
test('same account is rejected',()=>{const e=valid();e.NOTIFICATION_TEST_JWT_B=e.NOTIFICATION_TEST_JWT_A;assert.throws(()=>target(e));});
test('isolated hosted configuration accepted (format guard is not JWT verification)',()=>assert.equal(target(valid()).mode,'isolated-hosted'));
test('only fixed loopback gateway accepted in CI',()=>{const e={...valid(),NOTIFICATION_TEST_MODE:'local-ci',NOTIFICATION_TEST_URL:'http://127.0.0.1:3000'};assert.equal(target(e).mode,'local-ci');assert.throws(()=>target({...e,NOTIFICATION_TEST_URL:'http://10.0.0.1:3000'}));});
