(function(w){
  'use strict';
  var ready,api,stopAuth;
  function emulator(){return /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname)&&new URLSearchParams(location.search).get('firebase_emulator')==='1';}
  function available(){return emulator()||w.ZG_PERSISTENT_BACKEND_ENABLED===true;}
  function start(){
    if(!available())return Promise.reject(Error('persistent-backend-not-enabled'));
    if(ready)return ready;
    ready=Promise.all(['app','auth','database','functions'].map(function(name){return import('https://www.gstatic.com/firebasejs/12.16.0/firebase-'+name+'.js');})).then(async function(modules){
      var A=modules[0],U=modules[1],D=modules[2],F=modules[3],config=w.ZargotaRooms.firebaseConfig();
      if(emulator())config=Object.assign({},config,{projectId:'demo-zargota-persistent',apiKey:'demo-key',authDomain:'demo-zargota-persistent.firebaseapp.com',databaseURL:'https://demo-zargota-persistent-default-rtdb.firebaseio.com'});
      var existing=A.getApps().find(function(a){return a.name==='zargota-persistent-characters';});
      var app=existing||A.initializeApp(config,'zargota-persistent-characters'),auth=U.getAuth(app),db=D.getDatabase(app),functions=F.getFunctions(app,'europe-west1');
      if(emulator()&&!existing){U.connectAuthEmulator(auth,'http://127.0.0.1:9199',{disableWarnings:true});D.connectDatabaseEmulator(db,'127.0.0.1',9190);F.connectFunctionsEmulator(functions,'127.0.0.1',5191);}
      await U.setPersistence(auth,U.browserLocalPersistence);await auth.authStateReady();
      if(!auth.currentUser)await U.signInAnonymously(auth);
      var observedUid=auth.currentUser&&auth.currentUser.uid,changingIdentity=0,authEpoch=0;
      if(stopAuth)stopAuth();
      stopAuth=U.onAuthStateChanged(auth,function(user){
        var nextUid=user&&user.uid||null,previousUid=observedUid;
        if(nextUid===previousUid)return;
        observedUid=nextUid;
        if(changingIdentity)return;
        authEpoch++;
        // Another tab may sign out or switch account. Suspend the controller's
        // subscriptions before another explicit start; never auto-login here.
        ready=null;api=null;
        w.dispatchEvent(new CustomEvent('zargota:persistent-auth-change',{detail:{uid:nextUid,previousUid:previousUid}}));
      });
      var call=F.httpsCallable(functions,'characterAccess',{timeout:30000});
      api={
        uid:function(){return auth.currentUser&&auth.currentUser.uid;},
        account:async function(){return (await call({action:'account'})).data;},
        call:async function(data){return (await call(data)).data;},
        login:async function(code){
          var epoch=authEpoch,result=(await call({action:'login',code:code})).data;
          if(epoch!==authEpoch)throw Error('auth-session-changed');
          changingIdentity++;
          try{await U.signInWithCustomToken(auth,result.token);observedUid=auth.currentUser&&auth.currentUser.uid||null;return result;}
          finally{changingIdentity--;}
        },
        logout:async function(){
          authEpoch++;
          changingIdentity++;
          try{
            await U.signOut(auth);observedUid=null;
            if(stopAuth){stopAuth();stopAuth=null;}ready=null;api=null;
          }finally{changingIdentity--;}
        },
        list:async function(){return (await D.get(D.ref(db,'persistentCharacterUsers/'+auth.currentUser.uid))).val()||{};},
        watch:function(id,listener,onError){return D.onValue(D.ref(db,'persistentCharacters/'+id+'/state'),function(s){listener(s.val());},onError);},
        meta:async function(id){return (await D.get(D.ref(db,'persistentCharacters/'+id+'/meta'))).val();},
        watchMeta:function(id,listener,onError){return D.onValue(D.ref(db,'persistentCharacters/'+id+'/meta'),function(s){listener(s.val());},onError);},
        read:async function(id){return (await D.get(D.ref(db,'persistentCharacters/'+id+'/state'))).val();},
        history:async function(id){return (await D.get(D.ref(db,'persistentCharacters/'+id+'/history'))).val()||{};},
        watchActivity:function(id,listener,onError){return D.onValue(D.ref(db,'persistentCharacters/'+id+'/activity'),function(s){listener(s.val()||{});},onError);},
        watchLastSeen:function(id,listener,onError){return D.onValue(D.ref(db,'persistentCharacters/'+id+'/lastSeen'),function(s){listener(s.val()||{});},onError);},
        presence:function(id,listener,onError){
          var handle,stopped=false,connected=false,user=auth.currentUser.uid,last=D.ref(db,'persistentCharacters/'+id+'/lastSeen/'+user),onlineStop=D.onValue(D.ref(db,'.info/connected'),async function(s){
            if(stopped)return;connected=!!s.val();if(!connected){listener({});return;}
            try{handle=D.push(D.ref(db,'persistentCharacters/'+id+'/presence/'+user));await D.onDisconnect(handle).remove();await D.onDisconnect(last).set(D.serverTimestamp());if(!stopped){await D.set(last,D.serverTimestamp());await D.set(handle,{online:true,at:D.serverTimestamp()});}else await D.remove(handle);}catch(e){if(!stopped)onError(e);}
          });
          var stop=D.onValue(D.ref(db,'persistentCharacters/'+id+'/presence'),function(s){listener(connected?s.val()||{}:{});},onError);
          return function(){stopped=true;onlineStop();stop();if(handle)D.remove(handle).catch(function(){});D.set(last,D.serverTimestamp()).catch(function(){});};
        }
      };return api;
    }).catch(function(e){ready=null;throw e;});return ready;
  }
  w.ZargotaPersistentTransport={start:start,available:available};
})(window);
