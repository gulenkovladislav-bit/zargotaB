'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../persistent-character-transport.js'),'utf8').replace(/\bimport\(/g,'__import(');
function fixture(initialUid='remembered-player'){
  const observers=new Set(),events=[],calls={anonymous:0,custom:0,signOut:0,persistence:[]};
  const auth={currentUser:initialUid?{uid:initialUid}:null,authStateReady:async()=>{}};
  function change(uid){auth.currentUser=uid?{uid}:null;for(const fn of observers)fn(auth.currentUser);}
  let reply=async()=>({data:{token:'player-token',sheetId:'sheet-a'}});
  const modules={
    app:{getApps:()=>[],initializeApp:()=>({})},
    auth:{getAuth:()=>auth,browserLocalPersistence:'LOCAL',setPersistence:async(_,kind)=>calls.persistence.push(kind),
      signInAnonymously:async()=>{calls.anonymous++;change('anonymous-'+calls.anonymous);},
      signInWithCustomToken:async()=>{calls.custom++;change('player-token-uid');},
      signOut:async()=>{calls.signOut++;change(null);},
      onAuthStateChanged:(_,fn)=>{observers.add(fn);queueMicrotask(()=>{if(observers.has(fn))fn(auth.currentUser);});return()=>observers.delete(fn);}},
    database:{getDatabase:()=>({})},
    functions:{getFunctions:()=>({}),httpsCallable:()=>data=>reply(data)}
  };
  const window={ZG_PERSISTENT_BACKEND_ENABLED:true,ZargotaRooms:{firebaseConfig:()=>({})},dispatchEvent:e=>events.push(e)};
  vm.runInNewContext(source,{window,location:{hostname:'zargota.example',search:''},URLSearchParams,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    __import:async path=>modules[path.match(/firebase-(\w+)\.js$/)[1]]});
  return {transport:window.ZargotaPersistentTransport,events,calls,auth,change,setReply:fn=>{reply=fn;}};
}
test('remembered Firebase identity starts with local persistence and without entering a code',async()=>{
  const f=fixture(),api=await f.transport.start();
  assert.deepEqual(f.calls.persistence,['LOCAL']);assert.equal(api.uid(),'remembered-player');
  assert.equal(f.calls.anonymous,0);assert.equal(f.calls.custom,0);assert.equal(f.events.length,0);
  assert.equal(await f.transport.start(),api);
});
test('own login does not masquerade as a cross-tab auth change',async()=>{
  const f=fixture(null),api=await f.transport.start();await api.login('test-code');
  assert.equal(api.uid(),'player-token-uid');assert.equal(f.calls.anonymous,1);assert.equal(f.events.length,0);
});
test('logout signs out rather than just hiding the account, and next explicit start is a visitor',async()=>{
  const f=fixture(),api=await f.transport.start();await api.logout();
  assert.equal(f.calls.signOut,1);assert.equal(f.auth.currentUser,null);assert.equal(f.calls.anonymous,0);
  assert.equal(f.events.length,0);const next=await f.transport.start();
  assert.notEqual(next,api);assert.equal(next.uid(),'anonymous-1');
});
test('external signout emits identity invalidation and never signs in automatically',async()=>{
  const f=fixture();await f.transport.start();f.change(null);await Promise.resolve();
  assert.equal(f.calls.anonymous,0);assert.equal(f.events.length,1);
  assert.equal(f.events[0].type,'zargota:persistent-auth-change');
  assert.equal(f.events[0].detail.uid,null);assert.equal(f.events[0].detail.previousUid,'remembered-player');
});
test('external account switch invalidates the old transport exactly once',async()=>{
  const f=fixture(),old=await f.transport.start();f.change('another-player');f.change('another-player');
  assert.equal(f.events.length,1);assert.equal(f.events[0].detail.uid,'another-player');
  const next=await f.transport.start();assert.notEqual(old,next);assert.equal(next.uid(),'another-player');
  assert.equal(f.calls.anonymous,0);
});
test('an outstanding code exchange cannot undo a cross-tab logout',async()=>{
  const f=fixture(),api=await f.transport.start();let release;
  f.setReply(()=>new Promise(resolve=>{release=resolve;}));
  const login=api.login('test-code');f.change(null);release({data:{token:'late-token'}});
  await assert.rejects(login,/auth-session-changed/);assert.equal(f.calls.custom,0);assert.equal(f.auth.currentUser,null);
});
test('an outstanding code exchange cannot undo an explicit logout in this tab',async()=>{
  const f=fixture(),api=await f.transport.start();let release;
  f.setReply(()=>new Promise(resolve=>{release=resolve;}));
  const login=api.login('test-code');await api.logout();release({data:{token:'late-token'}});
  await assert.rejects(login,/auth-session-changed/);assert.equal(f.calls.custom,0);assert.equal(f.auth.currentUser,null);
});
