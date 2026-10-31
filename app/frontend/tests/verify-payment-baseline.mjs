import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const source='e6dd3fc5e014ea0539df8da12a6ee84582b302b9';
const pkg='9baaa89718e51638d97dfd3f8030e50424c5f28c';
const directory='app/frontend/tests/subscription-009-local/';
const git=(...args)=>execFileSync('git',args,{cwd:root});
// Resolve repository-relative paths without relying on the caller's cwd.
const bytes=p=>readFileSync(root+p);
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(bytes(directory+'source-manifest.json'));
assert.equal(manifest.sourceCommit,source);
assert.deepEqual(bytes(directory+'source-manifest.json'),git('show',pkg+':'+directory+'source-manifest.json'));
for(const [p,hash] of Object.entries(manifest.files)) {
  const b=bytes(p);assert.equal(digest(b),hash.sha256,p);
  assert.equal(execFileSync('git',['hash-object','--stdin'],{cwd:root,input:b}).toString().trim(),hash.gitBlob,p);
  assert.deepEqual(b,git('show',source+':'+p),p);
}
for(const [p,hash] of Object.entries(manifest.packageFiles)) {
  const b=bytes(directory+p);assert.equal(digest(b),hash,p);
  assert.deepEqual(b,git('show',pkg+':'+directory+p),p);
}
const paths=git('ls-tree','-r','--name-only',source,'app/frontend/supabase/migrations').toString().trim().split('\n');
assert.equal(paths.length,9);
for(const p of paths)assert.deepEqual(bytes(p),git('show',source+':'+p),p);
console.log(JSON.stringify({immutableSourceEntries:Object.keys(manifest.files).length,
  immutablePackageEntries:Object.keys(manifest.packageFiles).length,migrationsUnchanged:9,nativeExecution:false,status:'PASS'}));
