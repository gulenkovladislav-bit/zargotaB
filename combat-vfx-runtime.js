(function(root,factory){
  var presets=root&&root.ZargotaCombatVfxPresets;
  if(typeof module==='object'&&module.exports)presets=require('./combat-vfx-presets.js');
  var api=factory(presets);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaCombatVfxRuntime=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(presets){
  'use strict';

  var VERSION=1;
  var QUALITY_ORDER=['high','balanced','low'];
  function createRuntime(options){
    options=options||{};
    var now=typeof options.now==='function'?options.now:function(){return Date.now();};
    var active=Object.create(null),seen=Object.create(null),pool=[],sequence=0;
    var rafSources=Object.create(null),qualityCap='high',slowFrameScore=0,fastFrameStreak=0,lastQualityChangeAt=0,metrics={plays:0,duplicates:0,fallbacks:0,completed:0,cancelled:0,activeVfx:0,maxActiveVfx:0,activeParticles:0,maxActiveParticles:0,activeProjectiles:0,maxActiveProjectiles:0,activeRafLoops:0,maxActiveRafLoops:0,rafWakeups:0,frameOver20:0,frameOver34:0,maxFrameMs:0,qualityChanges:0,lastQualityReason:'',createdHandles:0,reusedHandles:0,poolSize:0,events:[]};
    function cappedQuality(requested){requested=presets.normalizeQuality(requested);return QUALITY_ORDER[Math.max(QUALITY_ORDER.indexOf(requested),QUALITY_ORDER.indexOf(qualityCap))];}
    function note(type,handle,reason){
      metrics.events.push({type:type,eventId:handle&&handle.eventId||'',presetId:handle&&handle.command&&handle.command.preset.id||'',quality:handle&&handle.command&&handle.command.quality||'',at:now(),reason:String(reason||'')});
      if(metrics.events.length>80)metrics.events.splice(0,metrics.events.length-80);
    }
    function prepare(event,presetId,settings){
      settings=settings||{};event=event||{};
      var preset=presets.resolve(presetId,settings.family||event.family),requestedQuality=presets.normalizeQuality(settings.quality),quality=settings.adaptive===false?requestedQuality:cappedQuality(requestedQuality),composition=presets.buildComposition(preset,event,quality);
      return{eventId:String(event.id||''),preset:preset,presetVersion:preset.version,presetHash:preset.hash,requestedQuality:requestedQuality,quality:quality,composition:composition,durationMs:Math.max(1,Number(settings.durationMs)||Number(preset.durationMs)||1),startedAt:Number(event.ts||now()),revealAt:Number(event.revealAt||event.ts||now()),scope:String(settings.scope||'public')};
    }
    function acquire(){var handle=pool.pop();if(handle)metrics.reusedHandles+=1;else{handle={};handle.cancel=function(reason){if(handle.done)return false;var cancelRenderer=handle.cancelRenderer;if(typeof cancelRenderer==='function')cancelRenderer(reason||'cancelled');return finish(handle,reason||'cancelled');};metrics.createdHandles+=1;}return handle;}
    function begin(event,presetId,settings){
      settings=settings||{};var command=prepare(event,presetId,settings),eventId=command.eventId,key=String(settings.channel||'visual')+':'+eventId;
      if(!eventId)return null;
      if(seen[key]&&!settings.allowReplay){metrics.duplicates+=1;return null;}
      seen[key]=now();
      var handle=acquire();handle.id='vfx-'+(++sequence);handle.key=key;handle.eventId=eventId;handle.command=command;handle.startedAt=now();handle.done=false;handle.node=null;handle.cancelRenderer=null;
      active[handle.id]=handle;metrics.plays+=1;if(command.preset.fallback)metrics.fallbacks+=1;
      metrics.activeVfx+=1;metrics.activeParticles+=command.composition.particles.length;metrics.activeProjectiles+=command.composition.projectiles;
      metrics.maxActiveVfx=Math.max(metrics.maxActiveVfx,metrics.activeVfx);metrics.maxActiveParticles=Math.max(metrics.maxActiveParticles,metrics.activeParticles);metrics.maxActiveProjectiles=Math.max(metrics.maxActiveProjectiles,metrics.activeProjectiles);metrics.poolSize=pool.length;note('begin',handle);return handle;
    }
    function finish(handle,reason){
      if(!handle||handle.done||!active[handle.id])return false;
      handle.done=true;delete active[handle.id];metrics.activeVfx=Math.max(0,metrics.activeVfx-1);metrics.activeParticles=Math.max(0,metrics.activeParticles-handle.command.composition.particles.length);metrics.activeProjectiles=Math.max(0,metrics.activeProjectiles-handle.command.composition.projectiles);
      if(reason&&reason!=='complete')metrics.cancelled+=1;else metrics.completed+=1;note(reason&&reason!=='complete'?'cancel':'complete',handle,reason);
      handle.key='';handle.eventId='';handle.command=null;handle.startedAt=0;handle.node=null;handle.cancelRenderer=null;pool.push(handle);metrics.poolSize=pool.length;return true;
    }
    function cancelEvent(eventId,reason){var count=0;Object.keys(active).forEach(function(id){if(active[id].eventId===String(eventId||'')&&finish(active[id],reason||'replaced'))count+=1;});return count;}
    function cancelAll(reason){var count=0;Object.keys(active).forEach(function(id){if(finish(active[id],reason||'cancelled'))count+=1;});return count;}
    function setRafActive(value,source){source=String(source||'default');value=!!value;if(value===!!rafSources[source])return false;if(value)rafSources[source]=true;else delete rafSources[source];metrics.activeRafLoops=Object.keys(rafSources).length;metrics.maxActiveRafLoops=Math.max(metrics.maxActiveRafLoops,metrics.activeRafLoops);return true;}
    function noteFrame(durationMs){
      durationMs=Math.max(0,Number(durationMs)||0);metrics.rafWakeups+=1;if(durationMs>20)metrics.frameOver20+=1;if(durationMs>34)metrics.frameOver34+=1;metrics.maxFrameMs=Math.max(metrics.maxFrameMs,durationMs);
      if(durationMs>34){slowFrameScore+=3;fastFrameStreak=0;}else if(durationMs>20){slowFrameScore+=1;fastFrameStreak=0;}else{slowFrameScore=Math.max(0,slowFrameScore-1);fastFrameStreak=durationMs<=12?fastFrameStreak+1:0;}
      var clock=now(),capIndex=QUALITY_ORDER.indexOf(qualityCap),cooldownPassed=!lastQualityChangeAt||clock-lastQualityChangeAt>=2000;
      if(slowFrameScore>=6&&capIndex<QUALITY_ORDER.length-1&&cooldownPassed){qualityCap=QUALITY_ORDER[capIndex+1];slowFrameScore=0;fastFrameStreak=0;lastQualityChangeAt=clock;metrics.qualityChanges+=1;metrics.lastQualityReason='slow-frames';}
      else if(fastFrameStreak>=240&&capIndex>0&&(!lastQualityChangeAt||clock-lastQualityChangeAt>=10000)){qualityCap=QUALITY_ORDER[capIndex-1];slowFrameScore=0;fastFrameStreak=0;lastQualityChangeAt=clock;metrics.qualityChanges+=1;metrics.lastQualityReason='stable-frames';}
    }
    function pruneSeen(maxAgeMs){var clock=now(),age=Math.max(1000,Number(maxAgeMs)||30000);Object.keys(seen).forEach(function(key){if(clock-seen[key]>age)delete seen[key];});}
    function snapshot(){return{version:VERSION,plays:metrics.plays,duplicates:metrics.duplicates,fallbacks:metrics.fallbacks,completed:metrics.completed,cancelled:metrics.cancelled,activeVfx:metrics.activeVfx,maxActiveVfx:metrics.maxActiveVfx,activeParticles:metrics.activeParticles,maxActiveParticles:metrics.maxActiveParticles,activeProjectiles:metrics.activeProjectiles,maxActiveProjectiles:metrics.maxActiveProjectiles,activeRafLoops:metrics.activeRafLoops,maxActiveRafLoops:metrics.maxActiveRafLoops,rafWakeups:metrics.rafWakeups,frameOver20:metrics.frameOver20,frameOver34:metrics.frameOver34,maxFrameMs:metrics.maxFrameMs,qualityCap:qualityCap,qualityChanges:metrics.qualityChanges,lastQualityReason:metrics.lastQualityReason,createdHandles:metrics.createdHandles,reusedHandles:metrics.reusedHandles,poolSize:metrics.poolSize,events:metrics.events.slice()};}
    function reset(){Object.keys(active).forEach(function(id){finish(active[id],'reset');});seen=Object.create(null);rafSources=Object.create(null);qualityCap='high';slowFrameScore=0;fastFrameStreak=0;lastQualityChangeAt=0;metrics.plays=0;metrics.duplicates=0;metrics.fallbacks=0;metrics.completed=0;metrics.cancelled=0;metrics.activeVfx=0;metrics.maxActiveVfx=0;metrics.activeParticles=0;metrics.maxActiveParticles=0;metrics.activeProjectiles=0;metrics.maxActiveProjectiles=0;metrics.activeRafLoops=0;metrics.maxActiveRafLoops=0;metrics.rafWakeups=0;metrics.frameOver20=0;metrics.frameOver34=0;metrics.maxFrameMs=0;metrics.qualityChanges=0;metrics.lastQualityReason='';metrics.createdHandles=0;metrics.reusedHandles=0;metrics.events=[];metrics.poolSize=pool.length;}
    return{prepare:prepare,begin:begin,finish:finish,cancelEvent:cancelEvent,cancelAll:cancelAll,setRafActive:setRafActive,noteFrame:noteFrame,pruneSeen:pruneSeen,snapshot:snapshot,reset:reset,activeCount:function(){return metrics.activeVfx;}};
  }

  return{VERSION:VERSION,createRuntime:createRuntime};
});
