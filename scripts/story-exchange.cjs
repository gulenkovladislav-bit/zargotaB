#!/usr/bin/env node
'use strict';
// Loopback-only transport. No filesystem paths supplied by the browser are trusted.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'.story-exchange'),PORT=17349;
const json=x=>JSON.stringify(x,null,2),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp';fs.writeFileSync(tmp,json(value),{mode:0o600});fs.renameSync(tmp,file);}
function changes(before,after){
 if(!after||typeof after!=='object')throw Error('invalid episode');
 const list=[];for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!same(before[key],after[key]))list.push(key in after?{op:'set',path:[key],value:after[key]}:{op:'remove',path:[key]});
 // The editor maintains scene as an alias of the active scenes entry.
 if(list.some(c=>c.path[0]==='scenes')&&list.some(c=>c.path[0]==='scene')){
  const scene=after.scenes?.find(s=>s.id===after.activeSceneId)?.scene;
  if(!same(scene,after.scene))throw Error('scene and scenes disagree');
  return list.filter(c=>c.path[0]!=='scene');
 }
 return list;
}
function createServer({dir=DIR,token=crypto.randomBytes(32).toString('hex'),port=PORT}={}){
 const jobs=new Map(),snapshots=new Map();let client=null,lastSeen=0;
 const events=[];let lastBackup=null;try{lastBackup=JSON.parse(fs.readFileSync(path.join(dir,'last-backup.json'),'utf8'));}catch{}
 const log=(event)=>{events.push({time:new Date().toISOString(),event});if(events.length>30)events.shift();};
 const server=http.createServer(async(req,res)=>{
  const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(json(value));};
  if(req.headers.host!==`127.0.0.1:${server.address().port}`)return send(403,{error:'host'});
  const origin=req.headers.origin;
  if(origin&&origin!=='null'&&origin!==`http://127.0.0.1:${server.address().port}`)return send(403,{error:'origin'});
  if(origin==='null')res.setHeader('Access-Control-Allow-Origin','null');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network','true');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.headers.authorization!==`Bearer ${token}`)return send(401,{error:'auth'});
  if(req.method!=='POST')return send(405,{error:'method'});
  try{
   let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw Error('body too large');raw+=chunk;}const body=JSON.parse(raw||'{}');
   if(req.url==='/poll'){
    if(typeof body.client!=='string')throw Error('client');
    if(client&&client!==body.client&&Date.now()-lastSeen<15000)return send(409,{error:'another-tab'});
    client=body.client;lastSeen=Date.now();
    const job=[...jobs.values()].find(j=>j.state==='queued');
    if(job){job.state='sent';job.client=client;}
    return send(200,{job:job?{id:job.id,op:job.op,payload:job.payload}:null});
   }
   if(req.url==='/result'){
    const job=jobs.get(body.id);if(!job||job.state!=='sent'||job.client!==body.client)return send(409,{error:'unknown-or-completed-job'});
    const result=body.result;
    if(job.op==='read'&&result?.ok){
     if(!result.episode||result.projectId!==job.payload.projectId)throw Error('wrong project');
     const key=crypto.randomUUID();snapshots.set(key,result);
     write(path.join(dir,'snapshots',key+'.json'),result);
     const file=path.join(dir,'working',key+'.json');write(file,{exchangeId:key,...result});result.file=file;result.exchangeId=key;
    }
    if(job.op==='backup'&&result?.ok){
     if(!result.episodes||typeof result.episodes!=='object')throw Error('invalid backup');
     const folder=path.join(dir,'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
     let count=0;for(const [id,episode] of Object.entries(result.episodes)){if(!episode||!Array.isArray(episode.nodes)||!episode.scene)throw Error('invalid episode');write(path.join(folder,crypto.createHash('sha256').update(id).digest('hex').slice(0,16)+'.json'),{format:'zargota-story',version:1,episode});count++;}
     lastBackup={time:new Date().toISOString(),count,folder};write(path.join(dir,'last-backup.json'),lastBackup);body.result={ok:true,...lastBackup};
    }
    job.state='done';job.result=body.result;log(job.op+': '+(result?.ok?'ok':result?.error||'error'));return send(200,{ok:true});
   }
   if(req.url==='/status')return send(200,{uiVersion:1,connected:!!client&&Date.now()-lastSeen<15000,pending:[...jobs.values()].some(j=>j.state!=='done'),lastBackup,events});
   if(req.url==='/shutdown'){if([...jobs.values()].some(j=>j.state!=='done'))return send(409,{error:'job-pending'});send(200,{ok:true});server.close();server.closeIdleConnections();return;}
   if(req.url==='/job'){const j=jobs.get(body.id);return send(200,j?{state:j.state,result:j.result}:{error:'missing'});}
   if(req.url==='/command'){
    if(!client||Date.now()-lastSeen>=15000)return send(409,{error:'editor-not-connected'});
    if([...jobs.values()].some(j=>j.state!=='done'))return send(409,{error:'job-pending'});
    if(!['list','read','apply','backup'].includes(body.op))throw Error('operation');
    let payload=body.payload||{};
    if(body.op==='read'&&typeof payload.projectId!=='string')throw Error('projectId');
    if(body.op==='apply'){
     const base=snapshots.get(payload.exchangeId);if(!base)throw Error('snapshot unavailable: read again');
     if(base.projectId!==payload.projectId||base.snapshotId!==payload.snapshotId)throw Error('snapshot mismatch');
     const patch=changes(base.episode,payload.episode);
     if(!patch.length)return send(200,{done:true,result:{ok:true,changed:false}});
     // Disk backup must succeed before any browser mutation is dispatched.
     const backupFile=path.join(dir,'backups',crypto.randomUUID()+'.json');
     write(backupFile,base);
     if(!same(JSON.parse(fs.readFileSync(backupFile,'utf8')),base))throw Error('backup verification failed');
     payload={projectId:base.projectId,snapshotId:base.snapshotId,changes:patch,diskBackup:{file:backupFile,projectId:base.projectId,snapshotId:base.snapshotId}};
    }
    const id=crypto.randomUUID();jobs.set(id,{id,op:body.op,payload,state:'queued'});log(body.op+': queued');return send(200,{id});
   }
   send(404,{error:'route'});
  }catch(e){send(400,{error:e.message});}
 });
 return {server,token,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server.address().port));})};
}
async function main(){
 const [op,arg]=process.argv.slice(2);
 if(op==='launch'){
  const app=path.join(ROOT,'Обмен эпизодами.app');if(!fs.existsSync(app))throw Error('Build: zsh scripts/build-exchange-app.sh');
  require('node:child_process').spawn('/usr/bin/open',[app],{stdio:'ignore'});return;
 }
 if(op==='serve'){
  let saved;try{saved=JSON.parse(fs.readFileSync(path.join(DIR,'connection.json'),'utf8')).token;}catch{}
  const service=createServer({token:/^[a-f0-9]{64}$/.test(saved)?saved:undefined});await service.listen();write(path.join(DIR,'connection.json'),{port:PORT,token:service.token});
  fs.writeFileSync(path.join(DIR,'connection.js'),'window.__zgLocalExchangeKey='+JSON.stringify(service.token)+';\n',{mode:0o600});
  console.log('Обмен запущен / Обмін запущено: 127.0.0.1:'+PORT+'\nОстановить / Зупинити: Ctrl+C');return;
 }
 const connection=JSON.parse(fs.readFileSync(path.join(DIR,'connection.json'),'utf8'));
 async function post(route,data){const r=await fetch(`http://127.0.0.1:${connection.port}${route}`,{method:'POST',headers:{Authorization:`Bearer ${connection.token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
 if(op==='status'){console.log(json(await post('/status',{})));return;}
 if(!['list','read','apply'].includes(op))throw Error('Usage: serve | status | list | read EPISODE_ID | apply FILE');
 const payload=op==='read'?{projectId:arg}:op==='apply'?JSON.parse(fs.readFileSync(path.resolve(arg),'utf8')):{};
 const task=await post('/command',{op,payload});if(task.done){console.log(json(task.result));return;}
 for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,1000));const result=await post('/job',{id:task.id});if(result.state==='done'){if(op==='read'&&result.result?.ok)console.log(json({ok:true,file:result.result.file,projectId:result.result.projectId}));else console.log(json(result.result));return;}}
 throw Error('No result yet; do not resend. Restart the service to discard pending commands, then read a fresh snapshot.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={createServer,changes};
