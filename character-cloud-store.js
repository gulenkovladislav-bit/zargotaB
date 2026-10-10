(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./character-review.js'));
  else root.ZargotaCharacterCloudStore=factory(root.ZargotaCharacterReview);
})(typeof window==='undefined'?globalThis:window,function(R){
  'use strict';
  function valid(value){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);}
  function pack(character,revision){var json=JSON.stringify(character);if(json.length>2000000)throw Error('character-too-large');return {revision:revision,characterJson:json,updatedAt:Date.now()};}
  function unpack(approved){return approved?{revision:approved.revision,data:JSON.parse(approved.characterJson),updatedAt:approved.updatedAt}:null;}
  function unpackRequests(value,master){if(!value)return value;Object.keys(value).forEach(function(k){if(master)unpackRequests(value[k],false);else{try{value[k].changes=JSON.parse(value[k].changesJson);R.analyze({},value[k].changes);}catch(e){value[k].changes=[];value[k].invalid=true;}}});return value;}
  function create(transport,newId){
    function path(id,tail){if(!valid(id))throw Error('invalid-sheet');return 'characterSheets/'+id+(tail?'/'+tail:'');}
    function call(fn){return transport().then(fn);}
    function read(t,p){return t.firebase.get(t.firebase.ref(t.db,p)).then(function(s){return s.val();});}
    function save(t,p,v){return t.firebase.set(t.firebase.ref(t.db,p),v);}
    function register(t,id){return save(t,'characterSheetUsers/'+t.user.uid+'/'+id,true);}
    function transact(t,id,update){return read(t,path(id)).then(function(initial){var first=true;return t.firebase.runTransaction(t.firebase.ref(t.db,path(id)),function(current){if(first&&current===null)current=R.clone(initial);first=false;return update(current);});});}
    return {
      list:function(){return call(function(t){return read(t,'characterSheetUsers/'+t.user.uid).then(function(v){return Object.keys(v||{});});});},
      identity:function(){return call(function(t){return {uid:t.user.uid,anonymous:t.user.isAnonymous};});},
      create:function(character,id){
        id=id||newId();var prepared=R.prepare(character,newId);
        return call(function(t){return t.firebase.runTransaction(t.firebase.ref(t.db,path(id)),function(current){
          if(current)return;
          return {meta:{ownerUid:t.user.uid,createdAt:Date.now()},approved:pack(prepared,1)};
        }).then(function(result){if(!result.committed){return read(t,path(id)).then(function(existing){if(!existing||existing.meta.ownerUid!==t.user.uid)throw Error('sheet-exists');return register(t,id).then(function(){return {id:id,character:unpack(existing.approved).data};});});}return register(t,id).then(function(){return {id:id,character:prepared};});});});
      },
      join:function(id,name){return call(function(t){
        return read(t,path(id,'meta')).then(function(meta){if(!meta)throw Error('sheet-missing');return save(t,path(id,'joinRequests/'+t.user.uid),{uid:t.user.uid,name:String(name||'').trim().slice(0,100),createdAt:Date.now()});});
      });},
      checkAccess:function(id){return call(function(t){return read(t,path(id,'meta')).then(function(meta){
        if(!meta)throw Error('sheet-missing');if(meta.ownerUid===t.user.uid)return register(t,id).then(function(){return true;});
        return read(t,path(id,'access/'+t.user.uid)).then(function(allowed){if(!allowed)return false;return register(t,id).then(function(){return true;});});
      });});},
      grant:function(id,uid,allow){if(!valid(uid))return Promise.reject(Error('invalid-user'));return call(function(t){var values={};values['access/'+uid]=allow===true;values['joinRequests/'+uid]=null;return t.firebase.update(t.firebase.ref(t.db,path(id)),values);});},
      submit:function(id,base,character,requestId){
        requestId=requestId||newId();var changes=R.diff(base,character);if(!changes.length)return Promise.reject(Error('no-changes'));
        var payload={id:requestId,status:'pending',changesJson:JSON.stringify(changes),createdAt:Date.now()};
        if(JSON.stringify(payload).length>250000)return Promise.reject(Error('request-too-large'));
        return call(function(t){payload.authorUid=t.user.uid;var p=path(id,'requests/'+t.user.uid+'/'+requestId);
          return read(t,p).then(function(previous){if(previous){if(!R.equal(JSON.parse(previous.changesJson),changes))throw Error('operation-id-reused');return previous;}return save(t,p,payload).then(function(){return payload;});});
        });
      },
      publish:function(id,base,character,choices,expected){var changes=R.diff(base,character);return call(function(t){var conflict=false;
        return transact(t,id,function(sheet){
          if(!sheet||sheet.meta.ownerUid!==t.user.uid)return;
          var applied=R.apply(unpack(sheet.approved).data,changes,choices,expected);if(!applied.ok){conflict=true;return;}
          sheet.approved=pack(applied.character,sheet.approved.revision+1);return sheet;
        }).then(function(r){if(!r.committed)throw Error(conflict?'review-conflict':'publish-failed');return unpack(r.snapshot.val().approved);});
      });},
      resolve:function(id,author,requestId,choices,expected,reject){return call(function(t){var failure='request-missing';
        return transact(t,id,function(sheet){
          if(!sheet||sheet.meta.ownerUid!==t.user.uid)return;
          var request=sheet.requests&&sheet.requests[author]&&sheet.requests[author][requestId];
          if(!request)return;if(request.status!=='pending'){failure='already-resolved';return;}
          if(!reject){var applied;try{applied=R.apply(unpack(sheet.approved).data,JSON.parse(request.changesJson),choices,expected);}catch(e){failure='invalid-request';return;}if(!applied.ok){failure='review-conflict';return;}sheet.approved=pack(applied.character,sheet.approved.revision+1);}
          request.status=reject?'rejected':'accepted';request.resolvedAt=Date.now();request.resolvedBy=t.user.uid;return sheet;
        }).then(function(r){if(!r.committed)throw Error(failure);return unpack(r.snapshot.val().approved);});
      });},
      watch:function(id,listener,onError){var cancelled=false,stops=[];
        call(function(t){return read(t,path(id,'meta')).then(function(meta){
          if(cancelled)return;if(!meta)throw Error('sheet-missing');var master=meta.ownerUid===t.user.uid;
          function watch(tail,kind){stops.push(t.firebase.onValue(t.firebase.ref(t.db,path(id,tail)),function(s){if(!cancelled)listener(kind,kind==='approved'?unpack(s.val()):kind==='requests'?unpackRequests(s.val(),master):s.val(),{master:master,uid:t.user.uid});},onError));}
          watch('approved','approved');watch(master?'requests':'requests/'+t.user.uid,'requests');if(master)watch('joinRequests','joins');
        });}).catch(onError);
        return function(){cancelled=true;stops.forEach(function(stop){stop();});};
      }
    };
  }
  return {create:create};
});
