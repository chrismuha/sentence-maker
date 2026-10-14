// Keep this helper inside each app so packaged apps do not depend on the suite.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const markerName='.mcr-app-folder-migration.json';
const transient=new Set(['Cache','Code Cache','GPUCache','DawnCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','SingletonLock','SingletonCookie','SingletonSocket']);
// Chromium databases must move as a unit; mixing two profiles can corrupt them.
const profileDatabases=new Set(['Local Storage','IndexedDB','Session Storage','databases','File System','blob_storage','WebStorage','Service Worker','Sessions','Network']);
function profileIsInUse(root){
 let lock;try{lock=fs.readlinkSync(path.join(root,'SingletonLock'));}catch{return false;}
 const match=lock.match(/^(.*)-(\d+)$/);
 if(!match||match[1]!==os.hostname()||Number(match[2])===process.pid)return false;
 try{process.kill(Number(match[2]),0);return true;}catch(error){return error.code!=='ESRCH';}
}
function sameDirectory(left,right){try{const a=fs.statSync(left),b=fs.statSync(right);return a.dev===b.dev&&a.ino===b.ino;}catch{return false;}}
function replaceRoot(value,roots,target){
 if(typeof value==='string')for(const root of roots){if(value===root||value.startsWith(root+path.sep))return target+value.slice(root.length);}
 if(Array.isArray(value))return value.map(item=>replaceRoot(item,roots,target));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,replaceRoot(item,roots,target)]));
 return value;
}
function rewritePointer(file,roots,target){
 if(!/\.(json|txt)$/i.test(file))return;
 const original=fs.readFileSync(file,'utf8');let updated;
 if(/\.json$/i.test(file)){
  let value;try{value=JSON.parse(original);}catch{return;}
  const replaced=replaceRoot(value,roots,target);
  if(JSON.stringify(value)===JSON.stringify(replaced))return;
  updated=JSON.stringify(replaced,null,2)+'\n';
 }else{
  const stripped=original.trim(),replaced=replaceRoot(stripped,roots,target);
  if(replaced===stripped)return;updated=original.replace(stripped,replaced);
 }
 const temporary=file+'.migration-'+randomUUID();
 try{fs.writeFileSync(temporary,updated,{mode:fs.statSync(file).mode});fs.renameSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
}
function copyMissing(source,target,roots,canonical){
 fs.mkdirSync(target,{recursive:true,mode:fs.statSync(source).mode});
 const copiedFiles=new Set();
 for(const name of fs.readdirSync(source).sort()){
  if(transient.has(name)||name===markerName||name.startsWith('.mcr-migrate-'))continue;
  const from=path.join(source,name),to=path.join(target,name),stat=fs.lstatSync(from);
  if(stat.isDirectory()){
   if(profileDatabases.has(name)&&fs.existsSync(to))continue;
   if(!fs.existsSync(to)||fs.lstatSync(to).isDirectory())copyMissing(from,to,roots,canonical);
  }else if(!fs.existsSync(to)){
   const companion=name.match(/^(.*)-(?:wal|shm|journal)$/);
   if(companion&&fs.existsSync(path.join(target,companion[1]))&&!copiedFiles.has(companion[1]))continue;
   if(stat.isSymbolicLink())fs.symlinkSync(fs.readlinkSync(from),to);
   else if(stat.isFile()){fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);copiedFiles.add(name);rewritePointer(to,roots,canonical);}
  }
 }
}
function rewriteTree(root,roots,canonical){
 for(const name of fs.readdirSync(root)){
  if(transient.has(name)||name===markerName)continue;
  const file=path.join(root,name),stat=fs.lstatSync(file);
  if(stat.isDirectory())rewriteTree(file,roots,canonical);else if(stat.isFile())rewritePointer(file,roots,canonical);
 }
}
function initializeAppData(app,{displayName,legacyNames=[],platform=process.platform,logger=console}={}){
 const previous=app.getPath('userData');
 if(platform!=='darwin')return previous;
 if(!displayName||path.basename(displayName)!==displayName)throw Error('Invalid application display name.');
 const appData=app.getPath('appData');
 app.setName(displayName);
 // Respect an explicitly configured nonstandard user-data root.
 if(path.resolve(path.dirname(previous))!==path.resolve(appData))return previous;
 const canonical=path.join(appData,displayName);
 const roots=[...new Set([previous,...legacyNames.map(name=>path.join(appData,name))])].filter(root=>path.resolve(root)!==path.resolve(canonical));
 let stage;
 try{
  if(roots.some(root=>profileIsInUse(root)))throw Error('Close the older running copy of this app before migrating its folder.');
  // Handle capitalization-only renames on the normal case-insensitive Mac disk.
  const spellings=fs.existsSync(appData)?fs.readdirSync(appData):[];
  if(!spellings.includes(displayName)){
   const source=roots.find(root=>spellings.includes(path.basename(root))&&sameDirectory(root,canonical));
   if(source){
    const temporary=path.join(appData,'.mcr-migrate-'+randomUUID());
    fs.renameSync(source,temporary);
    try{fs.renameSync(temporary,canonical);}catch(error){fs.renameSync(temporary,source);throw error;}
    if(!fs.lstatSync(canonical).isSymbolicLink())rewriteTree(canonical,roots,canonical);
   }
  }
  const marker=path.join(canonical,markerName);let completed=[];
  if(fs.existsSync(marker))completed=JSON.parse(fs.readFileSync(marker,'utf8')).sources||[];
  const sources=roots.filter(root=>fs.existsSync(root)&&!sameDirectory(root,canonical)&&!completed.includes(root));
  if(!fs.existsSync(canonical)){
   fs.mkdirSync(appData,{recursive:true});stage=path.join(appData,'.mcr-migrate-'+randomUUID());fs.mkdirSync(stage,{mode:0o700});
   for(const source of sources)copyMissing(source,stage,roots,canonical);
   fs.renameSync(stage,canonical);stage=undefined;
  }else for(const source of sources)copyMissing(source,canonical,roots,canonical);
  if(sources.length){
   rewriteTree(canonical,roots,canonical);
   const temporary=marker+'.tmp-'+randomUUID();
   try{fs.writeFileSync(temporary,JSON.stringify({version:1,sources:[...completed,...sources]},null,2)+'\n',{mode:0o600});fs.renameSync(temporary,marker);}finally{fs.rmSync(temporary,{force:true});}
  }
  app.setPath('userData',canonical);
  // sessionData otherwise keeps Electron's previously cached default path.
  app.setPath('sessionData',canonical);
  return canonical;
 }catch(error){
  if(stage)fs.rmSync(stage,{recursive:true,force:true});
  logger.warn(`Could not migrate ${displayName}'s application folder; retaining its previous location: ${error.message}`);
  app.setPath('userData',previous);app.setPath('sessionData',previous);return previous;
 }
}
module.exports={initializeAppData};
