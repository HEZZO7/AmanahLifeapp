// Generates only ephemeral CI tokens; never reads Supabase or payment secrets.
import {randomBytes,createHmac} from 'node:crypto';
import {appendFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.PGHOST,'localhost');
assert.equal(process.env.PGOPTIONS,'-c amanahlife.security_fixture=isolated');
const secret=randomBytes(48).toString('base64url');
const jwt=sub=>{
 const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+900})).toString('base64url');
 return `${h}.${p}.${createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url')}`;
};
const a=jwt('11111111-1111-4111-8111-111111111111');
const b=jwt('22222222-2222-4222-8222-222222222222');
const c=jwt('33333333-3333-4333-8333-333333333333');
for(const value of [secret,a,b,c]) console.log(`::add-mask::${value}`);
writeFileSync('/tmp/notification-postgrest.env',[
 'PGRST_DB_URI=postgres://authenticator:isolated-local-only@127.0.0.1:5432/postgres',
 'PGRST_DB_SCHEMAS=public','PGRST_DB_ANON_ROLE=anon',`PGRST_JWT_SECRET=${secret}`,
 'PGRST_JWT_AUD=authenticated','PGRST_SERVER_HOST=127.0.0.1',
].join('\n')+'\n',{mode:0o600});
appendFileSync(process.env.GITHUB_ENV,[
 'NOTIFICATION_TEST_MODE=local-ci','NOTIFICATION_TEST_MUTATION=synthetic-users-only',
 'NOTIFICATION_TEST_URL=http://127.0.0.1:3000',`NOTIFICATION_TEST_JWT_A=${a}`,`NOTIFICATION_TEST_JWT_B=${b}`,`NOTIFICATION_TEST_JWT_C=${c}`,
].join('\n')+'\n');

