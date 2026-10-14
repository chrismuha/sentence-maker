import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),wrapper=fileURLToPath(new URL('./electron-builder-filter.mjs',import.meta.url));
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mcr-packaging-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'node_modules/.bin'),{recursive:true});
 const fakeBuilder=`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const output=process.argv.find(value=>value.startsWith('--config.directories.output=')).split('=').slice(1).join('=');
fs.writeFileSync(path.join(output,'seen-output'),output);
fs.writeFileSync(path.join(output,'seen-args.json'),JSON.stringify(process.argv.slice(2)));
if(process.env.FAKE_BUILD_IDLE){setInterval(()=>{},1000);return;}
fs.writeFileSync(path.join(output,'Test App.dmg'),'finished');
fs.writeFileSync(path.join(output,'app-arm64.nsis.7z'),'partial payload');
if(process.env.FAKE_BUILD_FAIL)process.exit(2);
`;
 const bin=path.join(root,'node_modules/.bin');
 await fs.writeFile(path.join(bin,'electron-builder'),fakeBuilder,{mode:0o755});
 await fs.writeFile(path.join(bin,'fake-builder.cjs'),fakeBuilder);
 await fs.writeFile(path.join(bin,'electron-builder.cmd'),'@node "%~dp0fake-builder.cjs" %*\r\n');
 return fs.realpath(root);
}
async function build(root,argv=[],env={}){
 try{return {ok:true,...await run(process.execPath,[wrapper,...argv],{cwd:root,env:{...process.env,...env},timeout:10000})};}
 catch(error){return {ok:false,...error};}
}
async function removeDiagnostics(result){const found=(result.stdout||'').match(/Packaging in a fresh local folder: (.+)/);if(found)await fs.rm(found[1],{recursive:true,force:true});}
test('packaging isolates default and custom output and retains universal artifacts without architecture in filename',async t=>{
 const root=await fixture(t);
 for(const args of [[],['--config.directories.output','custom']]){
  const result=await build(root,['--mac','--universal',...args]);assert.equal(result.ok,true,result.stderr);
  const out=path.join(root,args.length?'custom':'release');
  assert.equal(await fs.readFile(path.join(out,'Test App.dmg'),'utf8'),'finished');
  const stage=await fs.readFile(path.join(out,'seen-output'),'utf8');assert.notEqual(stage,out);
  await assert.rejects(fs.stat(path.join(out,'app-arm64.nsis.7z')));
 }
});
test('failed build preserves previously delivered installer and leaves diagnostics',async t=>{
 const root=await fixture(t),out=path.join(root,'release');await fs.mkdir(out);await fs.writeFile(path.join(out,'Test App.dmg'),'previous');
 const result=await build(root,[],{FAKE_BUILD_FAIL:'1'});assert.equal(result.ok,false);assert.equal(await fs.readFile(path.join(out,'Test App.dmg'),'utf8'),'previous');assert.match(result.stderr,/existing release files were not replaced/);await removeDiagnostics(result);
});
test('stalled build exits with actionable cloud-file guidance',async t=>{
 const root=await fixture(t);const result=await build(root,[],{FAKE_BUILD_IDLE:'1',MCR_BUILD_IDLE_TIMEOUT_MS:'50'});
 assert.equal(result.ok,false);assert.match(result.stderr,/Keep this project and node_modules available offline/);await removeDiagnostics(result);
});
test('delivery errors fail the command and keep the completed artifact recoverable',async t=>{
 const root=await fixture(t);await fs.writeFile(path.join(root,'blocked-output'),'file');
 const result=await build(root,['--config.directories.output=blocked-output']);assert.equal(result.ok,false);assert.match(result.stderr,/Could not deliver build output/);await removeDiagnostics(result);
});

test('an overlapping build is rejected and interruption releases the project lock',async t=>{
 const root=await fixture(t);
 const first=spawn(process.execPath,[wrapper],{cwd:root,env:{...process.env,FAKE_BUILD_IDLE:'1'},stdio:['ignore','pipe','pipe']});
 let output='';first.stdout.on('data',chunk=>output+=chunk);
 first.stderr.on('data',()=>{});
 const closed=new Promise(resolve=>first.once('close',resolve));
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('First build did not start')),3000);first.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
  const second=await build(root);assert.equal(second.ok,false);assert.match(second.stderr,/already running/);
 }finally{first.kill('SIGTERM');await closed;await removeDiagnostics({stdout:output});}
 const retry=await build(root);assert.equal(retry.ok,true,retry.stderr);
});

test('retains the app default packaging config unless an explicit config is supplied',async t=>{
 const root=await fixture(t);await fs.writeFile(path.join(root,'electron-builder.base.json'),'{}');
 const first=await build(root);assert.equal(first.ok,true,first.stderr);
 const args=JSON.parse(await fs.readFile(path.join(root,'release/seen-args.json'),'utf8'));
 assert.ok(args.includes(path.join(root,'electron-builder.base.json')));
 const second=await build(root,['--config','custom.json']);assert.equal(second.ok,true,second.stderr);
 const explicit=JSON.parse(await fs.readFile(path.join(root,'release/seen-args.json'),'utf8'));
 assert.ok(explicit.includes('custom.json'));assert.ok(!explicit.includes(path.join(root,'electron-builder.base.json')));
});
