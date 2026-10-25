const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createServer,changes}=require('../scripts/story-exchange.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zg-exchange-')),service=createServer({dir,port:0}),port=await service.listen(),url='http://127.0.0.1:'+port;
 try{
 const post=async(route,body,token=service.token,origin)=>{const r=await fetch(url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});return {code:r.status,...await r.json()};};
 assert.equal((await post('/poll',{client:'one'},'bad')).code,401);
 assert.equal((await post('/poll',{client:'one'},service.token,'https://example.com')).code,403);
 assert.equal((await post('/command',{op:'list'})).code,409);
 await post('/poll',{client:'one'},service.token,'null');assert.equal((await post('/poll',{client:'two'})).code,409);
 assert.equal((await post('/status',{},service.token,url)).code,200);
 let data={a:{title:'Original',scene:{name:'Scene'},nodes:[{id:'n',links:[],text:'Authored'}]},b:{title:'Untouched',scene:{},nodes:[]}},saves=0;
 const window={};vm.runInNewContext(fs.readFileSync('story-direct-edit.js','utf8'),{window});const memory=new Map();
 const api=window.ZargotaStoryDirectEdit.create({active:()=> 'a',busy:()=>false,load:()=>structuredClone(data),save:v=>{data=structuredClone(v);saves++;return true;},refresh:()=>{},storage:{setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)}});
 async function run(op,payload){const task=await post('/command',{op,payload});assert.equal(task.code,200);if(task.done)return task.result;const {job}=await post('/poll',{client:'one'});assert.equal(job.id,task.id);assert.equal((await post('/poll',{client:'one'})).job,null,'sent jobs are not delivered twice');if(job.op==='apply'){assert.equal(job.payload.diskBackup.snapshotId,job.payload.snapshotId);assert.equal(JSON.parse(fs.readFileSync(job.payload.diskBackup.file)).snapshotId,job.payload.snapshotId);}
 const result=job.op==='backup'?api.backup():job.op==='read'?api.read(job.payload.projectId):api.apply(job.payload,job.payload.diskBackup);const ack=await post('/result',{client:'one',id:job.id,result});assert.equal(ack.code,200);assert.equal((await post('/result',{client:'one',id:job.id,result})).code,409);return (await post('/job',{id:task.id})).result;}
 let read=await run('read',{projectId:'a'});let edit=JSON.parse(fs.readFileSync(read.file));assert.equal(edit.episode.nodes[0].text,'Authored');edit.episode.title='Changed';assert((await run('apply',edit)).ok);assert.equal(data.a.title,'Changed');assert.equal(data.b.title,'Untouched');assert.equal(saves,1);
 const backups=fs.readdirSync(path.join(dir,'backups'));assert.equal(backups.length,1);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'backups',backups[0]))).episode.title,'Original');
 read=await run('read',{projectId:'a'});edit=JSON.parse(fs.readFileSync(read.file));data.a.nodes[0].text='New live text';edit.episode.title='Stale';assert.equal((await run('apply',edit)).error,'conflict');assert.equal(data.a.nodes[0].text,'New live text');assert.equal(saves,1);
 const backup=await run('backup',{});assert.equal(backup.count,2);assert.equal(fs.readdirSync(backup.folder).length,2);assert.equal((await post('/status',{})).lastBackup.folder,backup.folder);assert.equal(saves,1,'backup must not write browser data');
 assert.throws(()=>changes({scene:{},scenes:[]},{scene:{x:1},scenes:[{id:'x',scene:{}}]}),/disagree/);
 assert.throws(()=>changes({text:'відповідь'},{text:'в��дповідь'}),/damaged Unicode/);
 assert.doesNotThrow(()=>changes({text:'в��дповідь',other:1},{text:'в��дповідь',other:2}));
 assert.doesNotThrow(()=>changes({text:'в��дповідь'},{text:'відповідь'}));
 // Deliberately split every Cyrillic byte across HTTP writes, as large exports do.
 const http=require('node:http');
 async function fragmented(bytes){return new Promise((resolve,reject)=>{const req=http.request(url+'/poll',{method:'POST',headers:{Authorization:'Bearer '+service.token}},res=>{let chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({code:res.statusCode,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);(async()=>{for(const byte of bytes){req.write(Buffer.from([byte]));await new Promise(r=>setTimeout(r,1));}req.end();})().catch(reject);});}
 // Queue a read and send its browser result through the fragmented transport.
 const task=await post('/command',{op:'read',payload:{projectId:'a'}});await post('/poll',{client:'one'});
 const original=data.a.nodes[0].text='Піднімаю. Твоя відповідь? Їжак, ґанок, ёж 🪙';
 const readResult=api.read('a');
 const bytes=Buffer.from(JSON.stringify({client:'one',id:task.id,result:readResult}));
 await new Promise((resolve,reject)=>{const req=http.request(url+'/result',{method:'POST',headers:{Authorization:'Bearer '+service.token}},res=>{res.resume();res.on('end',()=>{assert.equal(res.statusCode,200);resolve();});});req.on('error',reject);(async()=>{for(let i=0;i<bytes.length;i++){req.write(bytes.subarray(i,i+1));await new Promise(r=>setTimeout(r,1));}req.end();})().catch(reject);});
 const saved=(await post('/job',{id:task.id})).result;
 assert.equal(JSON.parse(fs.readFileSync(saved.file)).episode.nodes[0].text,original);
 assert.equal((await fragmented(Buffer.from([123,34,120,34,58,34,0xd0,34,125]))).code,400,'invalid UTF-8 rejected');
 assert.equal((await post('/shutdown',{})).ok,true);
 console.log('PASS loopback auth, origin, connection, tab lease, disk snapshot, backup, apply, live conflict and no duplicate delivery.');
 }finally{await new Promise(r=>service.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
