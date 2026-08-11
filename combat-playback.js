(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaCombatPlayback=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';

  var VERSION=1;
  var MOTION_MODES=['dynamic','anchored','minimal'];
  var PHASES=['resolved','roll','result','commit','impact','reaction','audio','log'];
  var FAMILY_CUES={
    system:['resolved','result','log'],
    action:['resolved','result','log'],
    initiative:['resolved','roll','result','log'],
    check:['resolved','roll','result','log'],
    attack:['resolved','roll','result','impact','reaction','log'],
    damage:['resolved','roll','result','commit','impact','reaction','audio','log'],
    save:['resolved','roll','result','commit','reaction','audio','log'],
    ability:['resolved','roll','result','commit','impact','reaction','audio','log'],
    death:['resolved','roll','result','commit','reaction','audio','log'],
    direct:['resolved','result','commit','impact','reaction','audio','log']
  };

  function finite(value,fallback){
    value=Number(value);
    return Number.isFinite(value)?value:fallback;
  }
  function eventTime(event){
    return Math.max(finite(event&&event.ts,0),finite(event&&event.revealAt,0));
  }
  function normalizeMotionMode(value){
    value=String(value||'anchored');
    return MOTION_MODES.indexOf(value)>=0?value:'anchored';
  }
  function eventFamily(event){
    var kind=String(event&&event.kind||'').toLowerCase(),id=String(event&&event.id||'').toLowerCase();
    if(event&&(Array.isArray(event.statusTicks)&&event.statusTicks.length||Array.isArray(event.statusRemoved)&&event.statusRemoved.length))return'direct';
    if(kind==='combat-damage'||kind==='damage')return'damage';
    if(kind==='combat-critical'||kind==='combat-attack'||kind==='attack')return'attack';
    if(kind.indexOf('combat-save')===0||kind==='save'||kind==='saving-throw')return'save';
    if(kind==='combat-ability'||kind==='ability'||kind==='cast')return'ability';
    if(kind==='death-save'||kind==='combat-death'||kind==='combat-stabilized'||id.indexOf('death-save-')===0)return'death';
    if(kind==='combat-check'||kind==='ability-check'||kind==='skill-check'||kind==='check')return'check';
    if(id.indexOf('initiative-')===0||kind==='initiative')return'initiative';
    if(kind==='combat-action'||kind==='action-request'||kind==='action-approved'||kind==='action-rejected')return'action';
    if(kind.indexOf('gm-')===0||kind==='heal'||kind==='temp-hp'||kind==='status')return'direct';
    return'system';
  }
  function hasRoll(event){
    return!!(event&&(event.roll!=null||event.attackRoll!=null||Array.isArray(event.rolls)&&event.rolls.length||Array.isArray(event.attackRolls)&&event.attackRolls.length||Array.isArray(event.damageRolls)&&event.damageRolls.length));
  }
  function validateEvent(event){
    var errors=[],warnings=[],family=eventFamily(event),ts=finite(event&&event.ts,0),revealAt=finite(event&&event.revealAt,0);
    if(!event||typeof event!=='object')errors.push('event-required');
    if(!String(event&&event.id||''))errors.push('id-required');
    if(!ts&&!revealAt)errors.push('time-required');
    if(ts&&revealAt&&revealAt<ts)errors.push('reveal-before-resolution');
    if(hasRoll(event)&&!revealAt)warnings.push('roll-without-reveal');
    if(['attack','damage','save'].indexOf(family)>=0&&!String(event&&event.targetKey||''))warnings.push('target-missing');
    return{valid:errors.length===0,family:family,errors:errors,warnings:warnings};
  }
  function buildTimeline(event,options){
    options=options||{};
    var validation=validateEvent(event),family=validation.family,ts=finite(event&&event.ts,finite(event&&event.revealAt,0)),revealAt=Math.max(ts,finite(event&&event.revealAt,ts)),resultAt=revealAt+Math.max(0,finite(options.resultDelayMs,0));
    var impactDelay=Math.max(0,finite(options.impactDelayMs,0)),commitDelay=Math.max(0,finite(options.commitDelayMs,0)),reactionDelay=Math.max(impactDelay,finite(options.reactionDelayMs,impactDelay));
    var timeByPhase={resolved:ts,roll:ts,result:resultAt,commit:resultAt+commitDelay,impact:resultAt+impactDelay,reaction:resultAt+reactionDelay,audio:resultAt+impactDelay,log:resultAt+Math.max(commitDelay,reactionDelay)};
    var phases=(FAMILY_CUES[family]||FAMILY_CUES.system).filter(function(phase){return phase!=='roll'||hasRoll(event)||revealAt>ts;});
    var cues=phases.map(function(phase,index){return{name:phase,phase:phase,at:timeByPhase[phase],order:index,lane:family+':'+phase};});
    var cueMap={};cues.forEach(function(cue){cueMap[cue.name]=cue;});
    return{eventId:String(event&&event.id||''),family:family,valid:validation.valid,errors:validation.errors,warnings:validation.warnings,anchorAt:ts,revealAt:revealAt,resultAt:resultAt,cues:cues,cueMap:cueMap};
  }
  function createDirector(options){
    options=options||{};
    var now=typeof options.now==='function'?options.now:function(){return Date.now();};
    var setTimer=typeof options.setTimer==='function'?options.setTimer:setTimeout;
    var clearTimer=typeof options.clearTimer==='function'?options.clearTimer:clearTimeout;
    var staleMs=Math.max(1000,finite(options.staleMs,12000));
    var retentionMs=Math.max(staleMs,finite(options.retentionMs,30000));
    var seen=Object.create(null),queue=[],timer=0,sequence=0;
    var diagnostics={claimed:0,duplicates:0,stale:0,invalid:0,scheduled:0,cancelled:0,executed:0,wakeups:0,lateCues:0,maxCueLatenessMs:0,maxPending:0,channels:{},events:[]};

    function note(event,channel,at){
      channel=String(channel||'visual');
      diagnostics.channels[channel]=finite(diagnostics.channels[channel],0)+1;
      diagnostics.events.push({id:String(event&&event.id||''),channel:channel,at:finite(at,now())});
      if(diagnostics.events.length>80)diagnostics.events.splice(0,diagnostics.events.length-80);
    }
    function prune(clock){
      Object.keys(seen).forEach(function(key){if(clock-finite(seen[key],0)>retentionMs)delete seen[key];});
    }
    function claim(event,channel,clock){
      var id=String(event&&event.id||''),at=finite(clock,now()),key=String(channel||'visual')+':'+id;
      if(!id)return false;
      prune(at);
      if(seen[key]){diagnostics.duplicates+=1;return false;}
      if(eventTime(event)&&at-eventTime(event)>staleMs){seen[key]=at;diagnostics.stale+=1;return false;}
      seen[key]=at;diagnostics.claimed+=1;note(event,'claim:'+String(channel||'visual'),at);return true;
    }
    function arm(){
      if(timer){clearTimer(timer);timer=0;}
      if(!queue.length)return;
      queue.sort(function(a,b){return a.at-b.at||a.sequence-b.sequence;});
      timer=setTimer(flush,Math.max(0,queue[0].at-now()));
    }
    function flush(){
      timer=0;
      var clock=now(),due=[];
      diagnostics.wakeups+=1;
      while(queue.length&&queue[0].at<=clock+4)due.push(queue.shift());
      due.forEach(function(item){
        if(item.cancelled)return;
        var lateness=Math.max(0,clock-item.at);diagnostics.maxCueLatenessMs=Math.max(diagnostics.maxCueLatenessMs,lateness);if(lateness>34)diagnostics.lateCues+=1;
        diagnostics.executed+=1;note(item.event,'cue:'+item.cue,clock);
        try{item.callback(item.event,item.cue,clock);}catch(error){setTimer(function(){throw error;},0);}
      });
      arm();
    }
    function cancelLane(lane){
      lane=String(lane||'');
      if(!lane)return 0;
      var removed=0;
      queue=queue.filter(function(item){if(item.lane===lane){removed+=1;return false;}return true;});
      diagnostics.cancelled+=removed;
      if(removed)arm();
      return removed;
    }
    function cancelAll(reason){
      var removed=queue.length;
      if(timer){clearTimer(timer);timer=0;}
      queue=[];diagnostics.cancelled+=removed;
      if(removed)note({id:'playback-cancel'},'cancel-all:'+String(reason||'cancelled'),now());
      return removed;
    }
    function schedule(event,cue,at,callback,settings){
      settings=settings||{};
      var id=String(event&&event.id||''),cueName=String(cue||'cue'),lane=String(settings.lane||''),clock=now();
      if(!id||typeof callback!=='function')return false;
      var validation=validateEvent(event);
      if(settings.validate!==false&&!validation.valid){diagnostics.invalid+=1;note(event,'invalid:'+validation.errors.join(','),clock);return false;}
      if(!claim(event,'schedule:'+cueName,clock))return false;
      if(settings.replaceLane&&lane)cancelLane(lane);
      queue.push({event:event,cue:cueName,at:Math.max(clock,finite(at,clock)),callback:callback,lane:lane,sequence:sequence++});
      diagnostics.scheduled+=1;diagnostics.maxPending=Math.max(diagnostics.maxPending,queue.length);arm();return true;
    }
    function scheduleTimeline(event,handlers,settings){
      handlers=handlers||{};settings=settings||{};
      var plan=buildTimeline(event,settings),scheduled=0,lanePrefix=String(settings.lanePrefix||plan.family);
      if(!plan.valid){diagnostics.invalid+=1;note(event,'invalid:'+plan.errors.join(','),now());return{plan:plan,scheduled:0};}
      plan.cues.forEach(function(cue){
        var handler=handlers[cue.name];if(typeof handler!=='function')return;
        if(schedule(event,cue.name,cue.at,handler,{lane:lanePrefix+':'+cue.name,replaceLane:settings.replaceLane!==false,validate:false}))scheduled+=1;
      });
      return{plan:plan,scheduled:scheduled};
    }
    function reset(){
      if(timer)clearTimer(timer);
      timer=0;seen=Object.create(null);queue=[];sequence=0;
      diagnostics={claimed:0,duplicates:0,stale:0,invalid:0,scheduled:0,cancelled:0,executed:0,wakeups:0,lateCues:0,maxCueLatenessMs:0,maxPending:0,channels:{},events:[]};
    }
    function snapshot(){
      return diagnostics;
    }
    return{claim:claim,note:note,schedule:schedule,scheduleTimeline:scheduleTimeline,cancelLane:cancelLane,cancelAll:cancelAll,flush:flush,reset:reset,snapshot:snapshot,pendingCount:function(){return queue.length;}};
  }

  return{VERSION:VERSION,PHASES:PHASES.slice(),MOTION_MODES:MOTION_MODES.slice(),normalizeMotionMode:normalizeMotionMode,eventFamily:eventFamily,validateEvent:validateEvent,buildTimeline:buildTimeline,createDirector:createDirector};
});
