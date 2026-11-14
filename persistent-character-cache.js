(function(w){
  'use strict';
  var key='zargota_persistent_characters_v1',opened,queue=Promise.resolve(),stamp=0;
  function database(){
    if(opened)return opened;
    opened=new Promise(function(resolve,reject){
      var request=indexedDB.open('zargota_persistent_characters',1);
      request.onupgradeneeded=function(){request.result.createObjectStore('state');};
      request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};
      request.onblocked=function(){reject(Error('cache-blocked'));};
    }).catch(function(e){opened=null;throw e;});return opened;
  }
  function local(){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
  async function read(){
    try{
      var db=await database(),stored=await new Promise(function(resolve,reject){
        var tx=db.transaction('state','readonly'),request=tx.objectStore('state').get('accounts');
        request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};
      });
      var fallback=local();
      if(fallback&&fallback.cacheStamp&&(!stored||fallback.cacheStamp>(stored.cacheStamp||0)))stored=fallback;
      if(stored)stamp=Math.max(stamp,stored.cacheStamp||0);
      return stored||fallback;
    }
    catch(_){return local();}
  }
  function write(value){
    var snapshot=JSON.parse(JSON.stringify(value));
    snapshot.cacheStamp=stamp=Math.max(stamp+1,Date.now());
    queue=queue.catch(function(){}).then(async function(){
      try{var db=await database();await new Promise(function(resolve,reject){var tx=db.transaction('state','readwrite');tx.objectStore('state').put(snapshot,'accounts');tx.oncomplete=resolve;tx.onerror=tx.onabort=function(){reject(tx.error||Error('cache-write-failed'));};});}
      catch(e){localStorage.setItem(key,JSON.stringify(snapshot));return;}
      // Only a small startup marker belongs in localStorage; portraits and the outbox stay in IndexedDB.
      try{localStorage.setItem(key,JSON.stringify({enabled:snapshot.enabled,activeUid:snapshot.activeUid,accounts:{}}));}catch(_){}
    });return queue;
  }
  w.ZargotaPersistentCache={read:read,write:write};
})(window);
