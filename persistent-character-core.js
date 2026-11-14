(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ZargotaPersistentCore=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var metadata=['revision','_updatedAt','updatedAt','updatedBy','source','syncOperationId','_equipBonusCache'];
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function clean(value){var next=clone(value);metadata.forEach(function(key){delete next[key];});return next;}
  function equal(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;var keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(function(k){return Object.prototype.hasOwnProperty.call(b,k)&&equal(a[k],b[k]);});}
  function same(a,b){return equal(clean(a),clean(b));}
  function draft(entry,character,newId,source){
    var next=clean(character);next.id=entry.remoteId;
    if(entry.remoteKey)next.campaignKey=entry.remoteKey;else delete next.campaignKey;
    entry.draft=next;entry.source=source==='session'?'session':'sheet';
    if(!entry.pending&&!same(next,JSON.parse(entry.base.characterJson)))entry.pending={operationId:newId(),expectedRevision:entry.base.revision,character:clone(next),source:entry.source};
    return entry;
  }
  function incoming(entry,packet,editing){
    if(!packet||packet.revision<entry.base.revision)return 'old';
    if(entry.pending&&packet.operationId===entry.pending.operationId)return 'own';
    if(packet.revision===entry.base.revision)return 'same';
    if(entry.pending||editing||(entry.draft&&!same(entry.draft,JSON.parse(entry.base.characterJson)))){
      entry.remote=clone(packet);entry.conflict=!!entry.pending;return 'deferred';
    }
    return 'apply';
  }
  function acknowledged(entry,packet,newId){
    var pending=entry.pending;if(!pending)return;
    // A retry may return a newer server revision. Never treat it as our own saved snapshot.
    if(packet.operationId!==pending.operationId&&packet.revision>pending.expectedRevision&&!same(JSON.parse(packet.characterJson),pending.character)){
      entry.remote=clone(packet);entry.conflict=true;return;
    }
    entry.base=clone(packet);entry.pending=null;entry.conflict=false;
    if(entry.remote&&entry.remote.revision<=packet.revision)entry.remote=null;
    if(entry.remote&&entry.remote.revision>packet.revision)entry.conflict=true;
    if(entry.draft&&!same(entry.draft,JSON.parse(packet.characterJson)))draft(entry,entry.draft,newId,entry.source);
  }
  return {clone:clone,clean:clean,equal:equal,same:same,draft:draft,incoming:incoming,acknowledged:acknowledged};
});
