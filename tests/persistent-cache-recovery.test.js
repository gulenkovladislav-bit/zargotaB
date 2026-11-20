'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../persistent-character-cache.js'),'utf8');

test('reload picks the fallback with the newest unsent edit after a failed IndexedDB transaction',async()=>{
  const values=new Map();
  let disk,failWrites=false;
  function openCache(){
    const db={transaction(){
      const tx={objectStore(){return {
        get(){const request={result:disk};queueMicrotask(()=>request.onsuccess());return request;},
        put(snapshot){queueMicrotask(()=>{if(failWrites){tx.onabort();return;}disk=snapshot;tx.oncomplete();});}
      };}};return tx;
    }};
    const window={},indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
    vm.runInNewContext(source,{window,indexedDB,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
    return window.ZargotaPersistentCache;
  }
  const initial=openCache();
  await initial.write({enabled:true,accounts:{player:{hp:14}}});
  failWrites=true;
  await initial.write({enabled:true,accounts:{player:{hp:0,pending:true}}});
  const afterReload=openCache(),recovered=await afterReload.read();
  assert.equal(recovered.accounts.player.hp,0);
  assert.equal(recovered.accounts.player.pending,true);
  failWrites=false;
  await afterReload.write({enabled:true,accounts:{player:{hp:1}}});
  assert.equal((await openCache().read()).accounts.player.hp,1);
});
