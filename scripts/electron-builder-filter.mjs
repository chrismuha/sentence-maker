#!/usr/bin/env node
import {execFileSync,spawn,execFile} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const projectRoot=process.cwd();
let packageName='mcr-app';
try{packageName=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8')).name||packageName;}catch{}
const appPrefix=packageName.replace(/[^a-z0-9-]/gi,'-');
const args=process.argv.slice(2).filter(arg=>!/^(?:dist|build):/.test(arg));
let output=path.join(projectRoot,'release');
for(let index=0;index<args.length;index++){
 if(args[index].startsWith('--config.directories.output=')){
  output=path.resolve(projectRoot,args[index].slice('--config.directories.output='.length));args.splice(index--,1);
 }else if(args[index]==='--config.directories.output'){
  if(!args[index+1])throw Error('Missing output directory.');
  output=path.resolve(projectRoot,args[index+1]);args.splice(index--,2);
 }
}
const defaultConfig=path.join(projectRoot,'electron-builder.base.json');
const explicitConfig=args.some(arg=>arg==='--config'||arg==='-c'||arg.startsWith('--config=')||arg.startsWith('-c='));
if(!explicitConfig&&fs.existsSync(defaultConfig))args.push('--config',defaultConfig);
const executable=path.join(projectRoot,'node_modules','.bin',process.platform==='win32'?'electron-builder.cmd':'electron-builder');
if(!fs.existsSync(executable))throw Error('Install project dependencies before packaging.');
const lockDir=path.join(os.tmpdir(),`mcr-package-lock-${createHash('sha256').update(projectRoot).digest('hex').slice(0,16)}`);
if(fs.existsSync(lockDir)){
 try{const pid=Number(fs.readFileSync(path.join(lockDir,'pid'),'utf8'));if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Invalid lock owner');process.kill(pid,0);throw Error('A build is already running for this project. Wait for it to finish before starting another.');}
 catch(error){if(error.code!=='ESRCH')throw error;fs.rmSync(lockDir,{recursive:true,force:true});}
}
fs.mkdirSync(lockDir);fs.writeFileSync(path.join(lockDir,'pid'),String(process.pid));
function releaseLock(){fs.rmSync(lockDir,{recursive:true,force:true});}
process.once('exit',releaseLock);
const buildDir=fs.mkdtempSync(path.join(os.tmpdir(),`${appPrefix}-package-`));
args.push(`--config.directories.output=${buildDir}`);
try{
 const {fixElectronBuilderDep0190}=await import('../../_shared/fix-electron-builder-dep0190.mjs');
 fixElectronBuilderDep0190(projectRoot);
}catch{/* The shared compatibility helper is optional. */}
if(process.platform==='darwin'){
 const targets=["assets", "dist", "index.html", "main.js", "preload", "script", "styles.css"].map(file=>path.join(projectRoot,file)).filter(file=>fs.existsSync(file));
 for(const target of targets){try{if(fs.statSync(target).isDirectory())execFileSync('find',[target,'-name','._*','-delete'],{stdio:'ignore',timeout:30000});}catch{console.warn('Could not remove AppleDouble metadata before packaging.');}}
 try{if(targets.length)execFileSync('xattr',['-cr',...targets],{stdio:'ignore',timeout:30000});}catch{console.warn('Could not clear macOS metadata before packaging.');}
}
console.log(`Packaging in a fresh local folder: ${buildDir}`);
const child=spawn(executable,args,{cwd:projectRoot,stdio:['inherit','pipe','pipe'],detached:process.platform!=='win32',shell:process.platform==='win32'});
let lastProgress=Date.now(),timedOut=false,stopping=false,spawnFailed=false;
const configuredTimeout=Number(process.env.MCR_BUILD_IDLE_TIMEOUT_MS||process.env.MONOPOLY_BUILD_IDLE_TIMEOUT_MS||300000);
const idleTimeout=Number.isFinite(configuredTimeout)&&configuredTimeout>0?configuredTimeout:300000;
let killTimer;
function stop(signal='SIGTERM'){
 if(stopping)return;stopping=true;
 function signalTree(value){try{if(process.platform==='win32')execFileSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore',timeout:5000});else process.kill(-child.pid,value);}catch{/* Already exited. */}}
 signalTree(signal);killTimer=setTimeout(()=>signalTree('SIGKILL'),3000);killTimer.unref();
}
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>stop(signal));
for(const [stream,destination] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{lastProgress=Date.now();destination.write(chunk);});
const watchdog=setInterval(()=>{
 if(stopping)return;
 if(Date.now()-lastProgress<idleTimeout)return;
 timedOut=true;
 console.error('Packaging stopped after no progress. A cloud-only dependency file may be blocking a read. Keep this project and node_modules available offline in Dropbox, then retry.');
 if(process.platform==='darwin'&&child.pid)execFile('lsof',['-p',String(child.pid),'-Fn'],{timeout:2000},(_,stdout)=>{
  const files=(stdout||'').split('\n').filter(line=>line.startsWith('n'+projectRoot+path.sep));
  if(files.length)console.error(`Last open project file: ${files.at(-1).slice(1)}`);
 });
 stop();
},Math.min(1000,idleTimeout));
child.on('error',error=>{spawnFailed=true;console.error(`Could not start packaging: ${error.message}`);});
child.on('close',(code,signal)=>{
 clearInterval(watchdog);clearTimeout(killTimer);
 if(code!==0||signal||stopping||timedOut||spawnFailed){
  console.error(`Packaging failed; existing release files were not replaced. Diagnostic output remains in ${buildDir}`);
  process.exitCode=code||1;return;
 }
 try{
  const entries=fs.readdirSync(buildDir).filter(name=>!name.endsWith('.nsis.7z')&&!name.endsWith('.__uninstaller.exe'));
  if(!entries.length)throw Error('Packaging produced no output.');
  fs.mkdirSync(output,{recursive:true});
  for(const name of entries){
   const source=path.join(buildDir,name),destination=path.join(output,name);
   const staged=path.join(output,`.${name}.copy-${process.pid}`);
   try{
    fs.cpSync(source,staged,{recursive:true,dereference:false});
    fs.rmSync(destination,{recursive:true,force:true});fs.renameSync(staged,destination);
   }finally{fs.rmSync(staged,{recursive:true,force:true});}
  }
  console.log(`Copied completed build output to ${output}`);
  fs.rmSync(buildDir,{recursive:true,force:true});
 }catch(error){
  console.error(`Could not deliver build output: ${error.message}. Completed files remain in ${buildDir}`);process.exitCode=1;
 }
});
