'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /w\.ZargotaPerformance=\{/);
assert.match(html, /setPlaybackProvider:function\(provider\)/);
assert.match(html, /setVfxProvider:function\(provider\)/);
assert.match(html, /startCapture:startCapture/);
assert.match(html, /buildReport:buildReport/);
assert.match(html, /PerformanceObserver/);
assert.match(html, /data-game-panel-tab="optimization"/);
assert.match(html, /id="zg-performance-report"/);
assert.match(html, /zgPerformanceCopyReport/);
assert.match(html, /playback:playbackProvider\?playbackProvider\(\):null/);
assert.match(html, /vfx:vfxProvider\?vfxProvider\(\):null/);
assert.match(html, /BroadcastChannel\('zargota-performance-v1'\)/);
assert.match(html, /ZargotaPerformance\.mark\('renderTokens'\)/);
assert.match(html, /ZargotaPerformance\.mark\('renderDrawer'\)/);
assert.match(html, /Firebase-записи \/ мин\./);
assert.match(html, /Повторные subscribe\(\)/);
assert.match(html, /VFX активно \/ максимум/);
assert.match(html, /VFX частицы \/ projectiles/);
assert.match(html, /VFX RAF \/ медленные кадры/);
assert.match(html, /Canvas активно \/ скрыто/);
assert.match(html, /liveCanvasPerf\.hiddenDrops/);
assert.match(html, /Audio samples активно \/ максимум/);
assert.match(html, /Audio nodes \/ hidden stops/);
assert.match(html, /VFX качество \/ изменения/);
assert.match(html, /VFX pool created \/ reused/);
assert.match(html, /Dice ticker активно \/ максимум/);
assert.match(html, /Room watch start \/ stop/);
assert.match(html, /Подписка соединения/);
assert.match(html, /ID вкладки/);
assert.match(html, /Сессия уже открыта в другой вкладке/);
assert.match(html, /before_\.\*restore/);
assert.match(html, /резерв перед импортом/);
assert.match(html, /category==='scene-media'/);
['characters','portraits','scenes','backgrounds','tokens','backups'].forEach(function(category){
  assert.match(html, new RegExp('profile\\.'+category), category+' storage size must be reported');
});

assert.match(network, /function trackedFirebaseWrite\(kind, fn, valueIndex\)/);
assert.match(network, /writesPerMinute:networkPerformance\.writes\.length/);
assert.match(network, /writeKinds:Object\.assign/);
assert.match(network, /snapshotBytes=jsonBytes\(currentRoom\)/);
assert.match(network, /duplicateListenerAdds\+\+/);
assert.match(network, /activeRoomWatches=Math\.max\(0,networkPerformance\.activeRoomWatches-1\)/);
assert.match(network, /getPerformanceDiagnostics: performanceSnapshot/);
assert.match(network, /set: trackedFirebaseWrite\('set'/);
assert.match(network, /update: trackedFirebaseWrite\('update'/);
assert.match(network, /runTransaction: trackedFirebaseWrite\('transaction', databaseModule\.runTransaction, -1\)/);
assert.match(network, /remove: trackedFirebaseWrite\('remove', databaseModule\.remove, -1\)/);

var start = html.indexOf('(function(w){\n  var startedAt=Date.now()');
var end = html.indexOf('})(window);', start) + '})(window);'.length;
var profilerSource = html.slice(start,end);
var fakeWindow = {addEventListener:function(){}};
var context = {
  window:fakeWindow,
  Date:Date,Math:Math,Object:Object,String:String,
  BroadcastChannel:undefined
};
vm.runInNewContext(html.slice(start, end), context);
for(var index=0;index<6;index++)fakeWindow.ZargotaPerformance.mark('renderTokens');
var snapshot = fakeWindow.ZargotaPerformance.snapshot();
assert.strictEqual(snapshot.renders.renderTokens.perMinute, 6);
assert.strictEqual(snapshot.renders.renderTokens.perSecond, 1.2);
assert.strictEqual(snapshot.tabs.active, 1);
fakeWindow.ZargotaPerformance.setPlaybackProvider(function(){return{lateCues:2,maxPending:4};});
fakeWindow.ZargotaPerformance.setVfxProvider(function(){return{activeVfx:1,activeParticles:12};});
snapshot=fakeWindow.ZargotaPerformance.snapshot();
assert.deepStrictEqual(snapshot.playback,{lateCues:2,maxPending:4});
assert.deepStrictEqual(snapshot.vfx,{activeVfx:1,activeParticles:12});

var frameQueue=[],cancelledFrame=0,observerCallback=null;
var frameDocument={
  hidden:false,
  getElementsByTagName:function(){return{length:1240};},
  getAnimations:function(){return[{playState:'running'},{playState:'paused'},{playState:'running'}];},
  querySelectorAll:function(selector){return{length:selector==='.zg-vtt-token'?4:selector==='canvas'?2:0};}
};
var frameWindow={
  addEventListener:function(){},document:frameDocument,innerWidth:1920,innerHeight:1080,devicePixelRatio:2,
  navigator:{hardwareConcurrency:8,deviceMemory:16,userAgent:'Zargota test browser'},
  localStorage:{getItem:function(){return null;},setItem:function(){}},
  performance:{memory:{usedJSHeapSize:104857600,jsHeapSizeLimit:1073741824}},
  requestAnimationFrame:function(callback){frameQueue.push(callback);return frameQueue.length;},
  cancelAnimationFrame:function(id){cancelledFrame=id;},
  PerformanceObserver:function(callback){observerCallback=callback;this.observe=function(){};}
};
vm.runInNewContext(profilerSource,{
  window:frameWindow,Date:Date,Math:Math,Object:Object,String:String,Number:Number,Array:Array,
  BroadcastChannel:undefined
});
var frameTime=0;
for(var frameIndex=0;frameIndex<600;frameIndex++){
  var frameCallback=frameQueue.shift();
  frameTime+=16.67;
  frameCallback(frameTime);
}
observerCallback({getEntries:function(){return[{duration:128}];}});
var frameSnapshot=frameWindow.ZargotaPerformance.snapshot({after:Date.now()-10000});
assert.ok(frameSnapshot.frames.fps>59&&frameSnapshot.frames.fps<61,'RAF sampling reports stable 60 FPS');
assert.ok(frameSnapshot.frames.frameP95Ms>16&&frameSnapshot.frames.frameP95Ms<17,'frame p95 is computed from bounded samples');
assert.strictEqual(frameSnapshot.longTasks.count,1,'long tasks are observed without polling');
assert.strictEqual(frameSnapshot.runtime.domNodes,1240,'DOM size is collected only in snapshots');
assert.strictEqual(frameSnapshot.runtime.animations,2,'running CSS animations are counted');
assert.strictEqual(frameSnapshot.runtime.tokens,4,'scene token count is part of the lag context');
var report=frameWindow.ZargotaPerformance.buildReport({after:Date.now()-10000});
assert.match(report,/ZARGOTA PERFORMANCE REPORT/);
assert.match(report,/FPS: 60\.0/);
assert.match(report,/Long tasks: 1; максимум 128 мс/);
assert.match(report,/DOM: 1240; активные анимации: 2; токены: 4/);
assert.match(report,/Firebase subscriptions: room/);
assert.match(report,/VFX: active\/max/);
assert.match(report,/Playback: pending/);
assert.match(report,/Audio: active\/max/);
assert.match(report,/Диагноз:/);
assert.match(report,/User agent: Zargota test browser/);
var capture=frameWindow.ZargotaPerformance.startCapture(30);
assert.strictEqual(capture.seconds,30,'lag capture uses the requested bounded interval');
assert.strictEqual(frameWindow.ZargotaPerformance.captureState().complete,false);
assert.strictEqual(frameWindow.ZargotaPerformance.setEnabled(false),false);
assert.ok(cancelledFrame>0,'disabled monitoring cancels its single RAF loop');

var channels = [];
function FakeBroadcastChannel(name){this.name=name;this.onmessage=null;channels.push(this);}
FakeBroadcastChannel.prototype.postMessage=function(data){
  var own=this;
  channels.forEach(function(channel){if(channel!==own&&channel.name===own.name&&channel.onmessage)channel.onmessage({data:data});});
};
FakeBroadcastChannel.prototype.close=function(){var own=this;channels=channels.filter(function(channel){return channel!==own;});};
function profilerTab(){
  var timers=[];
  var tabWindow={addEventListener:function(){}};
  vm.runInNewContext(profilerSource,{
    window:tabWindow,Date:Date,Math:Math,Object:Object,String:String,
    BroadcastChannel:FakeBroadcastChannel,
    setInterval:function(callback){timers.push(callback);return timers.length;},
    clearInterval:function(){}
  });
  return {window:tabWindow,timers:timers};
}
var firstTab=profilerTab(),secondTab=profilerTab();
firstTab.timers[0]();
assert.strictEqual(firstTab.window.ZargotaPerformance.snapshot().tabs.active,2);
assert.strictEqual(secondTab.window.ZargotaPerformance.snapshot().tabs.active,2);

var perfStart = network.indexOf('  function jsonBytes(value)');
var perfEnd = network.indexOf('  function syncIdentity(character)', perfStart);
var networkContext = {
  Blob:Blob,Date:Date,Object:Object,
  tabCanWrite:function(){return true;},
  networkPerformance:{
    writes:[],writeBytes:0,writeKinds:{},roomSnapshots:[],
    roomSnapshotBytes:0,roomSnapshotMaxBytes:0,roomWatchStarts:0,roomWatchStops:0,
    activeRoomWatches:0,maxRoomWatches:0,duplicateListenerAdds:0,
    maxApiListeners:0,connectionSubscriptions:0
  },
  listeners:[]
};
vm.runInNewContext('function now(){return Date.now();}\n'+network.slice(perfStart,perfEnd),networkContext);
var observedArgs = null;
var update = networkContext.trackedFirebaseWrite('update',function(){observedArgs=[].slice.call(arguments);return 'ok';});
assert.strictEqual(update('ref',{hp:7}),'ok');
assert.deepStrictEqual(observedArgs,['ref',{hp:7}]);
var transaction = networkContext.trackedFirebaseWrite('transaction',function(){return 'transaction-ok';},-1);
assert.strictEqual(transaction('ref',function(){return {hp:8};}),'transaction-ok');
var networkSnapshot = networkContext.performanceSnapshot();
assert.strictEqual(networkSnapshot.writesPerMinute,2);
assert.strictEqual(networkSnapshot.writeKinds.update,1);
assert.strictEqual(networkSnapshot.writeKinds.transaction,1);
assert.strictEqual(networkSnapshot.writeBytesPerMinute,new Blob([JSON.stringify({hp:7})]).size);

var watcherStart=network.indexOf('  function stopWatchingRoom()');
var watcherEnd=network.indexOf('  function setPresence(session)',watcherStart);
var watcherContext={
  roomUnsubscribe:null,currentRoom:null,characterInboundSession:'old',db:{},
  privateDeliveriesUnsubscribe:null,currentPrivateDeliveries:{},
  combatEquipmentReconcileTimer:0,combatEquipmentReconcileBusy:false,combatEquipmentReconcilePending:false,
  connected:false,networkPerformance:networkContext.networkPerformance,
  clearTimeout:clearTimeout,setTimeout:setTimeout,
  firebase:{
    ref:function(db,path){return path;},
    onValue:function(){return function(){watcherContext.unsubscribeCalls++;};}
  },
  unsubscribeCalls:0,
  readSession:function(){return null;},saveSession:function(){},
  syncOutbox:function(){return null;},emit:function(){}
};
vm.runInNewContext(network.slice(watcherStart,watcherEnd),watcherContext);
watcherContext.watchRoom('ROOM1');
assert.strictEqual(watcherContext.networkPerformance.activeRoomWatches,1);
watcherContext.watchRoom('ROOM2');
assert.strictEqual(watcherContext.unsubscribeCalls,1);
assert.strictEqual(watcherContext.networkPerformance.activeRoomWatches,1);
assert.strictEqual(watcherContext.networkPerformance.maxRoomWatches,1);
watcherContext.stopWatchingRoom();
assert.strictEqual(watcherContext.unsubscribeCalls,2);
assert.strictEqual(watcherContext.networkPerformance.activeRoomWatches,0);

console.log('performance diagnostics contract passed');
