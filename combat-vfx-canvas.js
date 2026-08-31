(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaCombatVfxCanvas=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';

  var VERSION=2;
  function createEngine(options){
    options=options||{};
    var runtime=options.runtime||null,sourceId=String(options.sourceId||'canvas'),now=typeof options.now==='function'?options.now:function(){return performance.now();},requestFrame=options.requestFrame||function(callback){return requestAnimationFrame(callback);},cancelFrame=options.cancelFrame||function(id){cancelAnimationFrame(id);},documentRef=options.document||(typeof document!=='undefined'?document:null),maxConcurrent=Math.max(1,Number(options.maxConcurrent)||12);
    var canvas=null,context=null,host=null,frameId=0,effects=[],effectPool=[],diagnostics={plays:0,completed:0,cancelled:0,capacityDrops:0,hiddenDrops:0,createdEffects:0,reusedEffects:0,maxEffects:0,resizes:0,drawFrames:0};
    function qualityDpr(quality){var base=typeof devicePixelRatio==='number'?devicePixelRatio:1,cap=quality==='high'?1.5:quality==='low'?1:1.25;return Math.max(1,Math.min(base,cap));}
    function ensureCanvas(nextHost,quality){
      if(!nextHost||!documentRef)return false;
      if(canvas&&host!==nextHost){if(canvas.parentNode)canvas.remove();canvas=null;context=null;}
      host=nextHost;
      if(!canvas){canvas=documentRef.createElement('canvas');canvas.className='zg-combat-vfx-canvas';canvas.setAttribute('aria-hidden','true');host.insertBefore(canvas,host.firstChild||null);context=canvas.getContext&&canvas.getContext('2d');}
      if(!context)return false;
      var width=Math.max(1,Math.round(host.clientWidth||host.getBoundingClientRect&&host.getBoundingClientRect().width||1)),height=Math.max(1,Math.round(host.clientHeight||host.getBoundingClientRect&&host.getBoundingClientRect().height||1)),dpr=qualityDpr(quality),pixelWidth=Math.max(1,Math.round(width*dpr)),pixelHeight=Math.max(1,Math.round(height*dpr));
      if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.dataset.dpr=String(dpr);diagnostics.resizes+=1;}
      return true;
    }
    function acquire(){var effect=effectPool.pop();if(effect)diagnostics.reusedEffects+=1;else{effect={};diagnostics.createdEffects+=1;}return effect;}
    function release(effect,reason){effect.done=true;if(reason==='complete')diagnostics.completed+=1;else diagnostics.cancelled+=1;effect.handle=null;effect.command=null;effect.eventId='';effectPool.push(effect);}
    function priority(command){var key=command&&command.preset&&command.preset.key||'';if(key==='movement'||key==='mist-teleport')return 0;if(key==='cleanse'||key==='heal'||key==='curse-break'||key==='blood-transfer')return 1;if(key==='projectile'||key==='fire-projectile'||key==='arcane'||key==='fire'||key==='lightning'||key==='necro'||key==='psychic'||key==='hypnosis'||key==='lightning-spear'||key==='rot-ray')return 2;return 3;}
    function reserveCapacity(handle){
      if(effects.length<maxConcurrent)return true;
      var incomingPriority=priority(handle.command),replaceIndex=-1,lowestPriority=incomingPriority;
      effects.forEach(function(effect,index){var current=priority(effect.command);if(current<lowestPriority){lowestPriority=current;replaceIndex=index;}});
      if(replaceIndex<0){diagnostics.capacityDrops+=1;if(runtime)runtime.finish(handle,'canvas-capacity');return false;}
      var replaced=effects.splice(replaceIndex,1)[0];diagnostics.capacityDrops+=1;if(runtime)runtime.finish(replaced.handle,'canvas-capacity');release(replaced,'canvas-capacity');return true;
    }
    function palette(key){
      if(key==='fire'||key==='fire-projectile')return['#fff0a2','#ff9b36','#e63f1f'];if(key==='lightning'||key==='lightning-spear')return['#ffffff','#a8ecff','#557cff'];if(key==='rot-ray')return['#efffc3','#86c94f','#334d22'];if(key==='psychic')return['#fff2ff','#d28cff','#713da6'];if(key==='hypnosis')return['#fff2a6','#d992ff','#6754d9'];if(key==='curse-break')return['#fff5c7','#dfc86d','#55426e'];if(key==='blood-transfer')return['#ffe1dc','#ef5d6c','#741d37'];if(key==='necro')return['#e6ffd0','#a979c8','#4a2c66'];if(key==='heal')return['#e5ffd5','#78e899','#35a968'];if(key==='cleanse')return['#ffffff','#d9f5c7','#8bcaa4'];if(key==='projectile')return['#fff1b5','#d9ad57','#76502a'];if(key==='movement')return['#d9f1ff','#85b8d2','#486f86'];if(key==='mist-teleport')return['#e7f5f4','#9cbfc2','#526b75'];if(key==='slash'||key==='critical'||key==='miss')return['#fff3c2','#ef9d58','#c73f32'];if(key==='block')return['#fff7c7','#72c9d7','#28748c'];return['#f4ddff','#c28aff','#764bb3'];
    }
    function shape(contextValue,key,x,y,size,rotation,color){
      contextValue.save();contextValue.translate(x,y);contextValue.rotate(rotation);contextValue.globalAlpha=Math.max(0,Math.min(1,contextValue.globalAlpha));contextValue.fillStyle=color;
      if(key==='fire'){contextValue.beginPath();contextValue.moveTo(0,-size);contextValue.quadraticCurveTo(size*.8,0,0,size);contextValue.quadraticCurveTo(-size*.7,0,0,-size);contextValue.fill();}
      else if(key==='lightning'||key==='lightning-spear'){contextValue.beginPath();contextValue.moveTo(size*.15,-size);contextValue.lineTo(-size*.55,size*.05);contextValue.lineTo(-size*.05,size*.05);contextValue.lineTo(-size*.3,size);contextValue.lineTo(size*.62,-size*.18);contextValue.lineTo(size*.12,-size*.18);contextValue.closePath();contextValue.fill();}
      else if(key==='necro'||key==='rot-ray'){contextValue.beginPath();contextValue.arc(0,0,size,Math.PI*.25,Math.PI*1.75);contextValue.lineTo(0,0);contextValue.closePath();contextValue.fill();}
      else if(key==='heal'){contextValue.fillRect(-size*.18,-size,size*.36,size*2);contextValue.fillRect(-size,-size*.18,size*2,size*.36);}
      else if(key==='psychic'){contextValue.beginPath();contextValue.arc(0,0,size,Math.PI*.32,Math.PI*1.68);contextValue.arc(-size*.25,0,size*.58,Math.PI*1.68,Math.PI*.32,true);contextValue.fill();}
      else if(key==='hypnosis'){contextValue.beginPath();for(var petal=0;petal<6;petal++){var a=petal*Math.PI/3;contextValue.lineTo(Math.cos(a)*size,Math.sin(a)*size);contextValue.lineTo(Math.cos(a+Math.PI/6)*size*.42,Math.sin(a+Math.PI/6)*size*.42);}contextValue.closePath();contextValue.fill();}
      else if(key==='curse-break'){contextValue.strokeStyle=color;contextValue.lineWidth=Math.max(1,size*.35);contextValue.beginPath();contextValue.ellipse(0,0,size,size*.5,0,0,Math.PI*2);contextValue.stroke();contextValue.beginPath();contextValue.moveTo(-size*.2,-size*.65);contextValue.lineTo(size*.15,size*.65);contextValue.stroke();}
      else if(key==='blood-transfer'){contextValue.beginPath();contextValue.moveTo(0,-size);contextValue.bezierCurveTo(size*.8,-size*.15,size*.7,size*.65,0,size);contextValue.bezierCurveTo(-size*.7,size*.65,-size*.8,-size*.15,0,-size);contextValue.fill();}
      else{contextValue.beginPath();contextValue.moveTo(0,-size);contextValue.lineTo(size*.55,0);contextValue.lineTo(0,size);contextValue.lineTo(-size*.55,0);contextValue.closePath();contextValue.fill();}
      contextValue.restore();
    }
    function drawProjectile(effect,elapsed,duration,width,height){
      var key=effect.command.preset.key,fire=key==='fire-projectile',flightRatio=fire ? .68 : .78,t=Math.max(0,Math.min(1,elapsed/Math.max(1,duration*flightRatio))),start=effect.start,end=effect.end,eased=1-Math.pow(1-t,3),x=start.x+(end.x-start.x)*eased,y=start.y+(end.y-start.y)*eased,angle=Math.atan2(end.y-start.y,end.x-start.x),colors=palette(key),trailCount=effect.command.composition.trails;
      for(var trail=trailCount;trail>0;trail--){var trailT=Math.max(0,eased-trail*.026),tx=start.x+(end.x-start.x)*trailT,ty=start.y+(end.y-start.y)*trailT;context.globalAlpha=(1-trail/trailCount)*.34;context.fillStyle=colors[1];context.beginPath();context.arc(tx,ty,Math.max(1,3-trail*.16),0,Math.PI*2);context.fill();}
      context.save();context.translate(x,y);context.rotate(angle);context.globalAlpha=t<.05?t/.05:Math.max(0,1-(t-.94)/.06);context.strokeStyle=colors[0];context.fillStyle=colors[1];context.lineWidth=2;if(fire){context.shadowColor=colors[2];context.shadowBlur=10;context.beginPath();context.arc(0,0,7,0,Math.PI*2);context.fill();context.beginPath();context.moveTo(-21,0);context.lineTo(-6,0);context.stroke();}else{context.beginPath();context.moveTo(-18,0);context.lineTo(10,0);context.stroke();context.beginPath();context.moveTo(14,0);context.lineTo(5,-5);context.lineTo(7,0);context.lineTo(5,5);context.closePath();context.fill();context.beginPath();context.moveTo(-13,0);context.lineTo(-19,-5);context.moveTo(-13,0);context.lineTo(-19,5);context.stroke();}context.restore();
      if(fire&&elapsed>=duration*flightRatio){var impact=Math.max(0,Math.min(1,(elapsed-duration*flightRatio)/Math.max(1,duration*(1-flightRatio)))),particles=effect.command.composition.particles;for(var index=0;index<particles.length;index++){var particle=particles[index],particleAngle=particle.angle*Math.PI/180,distance=(8+48*particle.distance)*Math.sin(Math.PI*.72*impact);context.globalAlpha=Math.sin(Math.PI*impact)*.9;context.fillStyle=colors[index%colors.length];context.beginPath();context.arc(end.x+Math.cos(particleAngle)*distance,end.y+Math.sin(particleAngle)*distance,Math.max(1,4*particle.scale*(1-impact*.55)),0,Math.PI*2);context.fill();}context.globalAlpha=Math.max(0,1-impact);context.strokeStyle=colors[0];context.lineWidth=2.5;context.beginPath();context.arc(end.x,end.y,10+42*impact,0,Math.PI*2);context.stroke();}
    }
    function drawMovement(effect,elapsed,duration){
      var t=Math.max(0,Math.min(1,elapsed/duration)),start=effect.start,end=effect.end,count=Math.max(2,effect.command.composition.particles.length),colors=palette('movement');context.lineWidth=2;context.setLineDash([5,9]);context.strokeStyle=colors[2];context.globalAlpha=Math.sin(Math.PI*t)*.75;context.beginPath();context.moveTo(start.x,start.y);context.lineTo(start.x+(end.x-start.x)*Math.min(1,t*1.45),start.y+(end.y-start.y)*Math.min(1,t*1.45));context.stroke();context.setLineDash([]);
      for(var index=0;index<count;index++){var progress=(index+1)/(count+1);if(progress>t*1.35)continue;var x=start.x+(end.x-start.x)*progress,y=start.y+(end.y-start.y)*progress,angle=Math.atan2(end.y-start.y,end.x-start.x)+Math.PI/2;context.globalAlpha=Math.max(0,.8-(t-progress)*.9);shape(context,'cleanse',x,y,3,angle,colors[index%2]);}
    }
    function drawMistTeleport(effect,elapsed,duration){
      var t=Math.max(0,Math.min(1,elapsed/duration)),start=effect.start,end=effect.end,colors=palette('mist-teleport'),particles=effect.command.composition.particles,trailCount=Math.max(2,effect.command.composition.trails);
      context.lineWidth=2;context.strokeStyle=colors[1];context.globalAlpha=Math.sin(Math.PI*t)*.42;context.setLineDash([3,8]);context.beginPath();context.moveTo(start.x,start.y);context.quadraticCurveTo((start.x+end.x)/2,(start.y+end.y)/2-12,end.x,end.y);context.stroke();context.setLineDash([]);
      for(var trail=0;trail<trailCount;trail++){var travel=Math.max(0,Math.min(1,t*1.5-trail/trailCount*.36)),tx=start.x+(end.x-start.x)*travel,ty=start.y+(end.y-start.y)*travel-Math.sin(Math.PI*travel)*8;context.globalAlpha=Math.sin(Math.PI*travel)*.24;context.fillStyle=colors[1];context.beginPath();context.arc(tx,ty,3+trail%3,0,Math.PI*2);context.fill();}
      for(var index=0;index<particles.length;index++){var particle=particles[index],angle=particle.angle*Math.PI/180,originPhase=Math.max(0,Math.min(1,t/.48)),destinationPhase=Math.max(0,Math.min(1,(t-.42)/.58)),atDestination=t>.42,phase=atDestination?destinationPhase:originPhase,center=atDestination?end:start,radius=(8+28*particle.distance)*(atDestination?(1-phase*.55):phase),rise=(atDestination?-10*(1-phase):-18*phase);context.globalAlpha=(atDestination?Math.sin(Math.PI*destinationPhase):Math.sin(Math.PI*originPhase))*.62;context.fillStyle=colors[index%colors.length];context.beginPath();context.arc(center.x+Math.cos(angle)*radius,center.y+Math.sin(angle)*radius+rise,3+4*particle.scale,0,Math.PI*2);context.fill();}
    }
    function drawSpellPath(effect,elapsed,duration){
      var key=effect.command.preset.key,t=Math.max(0,Math.min(1,elapsed/duration)),colors=palette(key),start=effect.start,end=effect.end,dx=end.x-start.x,dy=end.y-start.y,segments=key==='lightning-spear'?9:key==='rot-ray'?6:3;
      context.save();context.globalAlpha=Math.sin(Math.PI*Math.min(1,t*1.35))*(key==='lightning-spear'||key==='rot-ray' ? .9 : .62);context.strokeStyle=colors[1];context.lineWidth=key==='lightning-spear'?3.5:key==='rot-ray'?3:2.5;context.shadowColor=colors[2];context.shadowBlur=key==='lightning-spear'?15:key==='rot-ray'?12:9;context.beginPath();context.moveTo(start.x,start.y);
      for(var segment=1;segment<=segments;segment++){var p=segment/segments,jitter=segment===segments?0:Math.sin(segment*7.13)*(key==='lightning-spear'?5:key==='rot-ray'?1.2:2);context.lineTo(start.x+dx*p-dy/(Math.sqrt(dx*dx+dy*dy)||1)*jitter,start.y+dy*p+dx/(Math.sqrt(dx*dx+dy*dy)||1)*jitter);}context.stroke();context.restore();
    }
    function drawBurst(effect,elapsed,duration){
      var t=Math.max(0,Math.min(1,elapsed/duration)),target=effect.end,key=effect.command.preset.key,colors=palette(key),particles=effect.command.composition.particles;
      particles.forEach(function(particle,index){var local=Math.max(0,Math.min(1,(elapsed-particle.delayMs)/(duration-particle.delayMs||1)));if(local<=0||local>=1)return;var angle=particle.angle*Math.PI/180,distance=(20+58*particle.distance)*Math.sin(Math.PI*.62*local),rise=(key==='heal'||key==='cleanse')?-58*local:0,x=target.x+Math.cos(angle)*distance,y=target.y+Math.sin(angle)*distance+rise,size=(2.2+4.5*particle.scale)*(1-local*.72);context.globalAlpha=Math.sin(Math.PI*local)*.9;shape(context,key,x,y,size,angle+local*2.2,colors[index%colors.length]);});
      context.globalAlpha=Math.sin(Math.PI*Math.min(1,t*1.4))*.72;context.strokeStyle=colors[1];context.lineWidth=2;context.beginPath();context.arc(target.x,target.y,12+44*t,0,Math.PI*2);context.stroke();
      if(key==='slash'||key==='critical'||key==='miss'){
        var slashAlpha=Math.max(0,1-Math.abs(t-.34)/.34),missOffset=key==='miss'?24:0;context.save();context.translate(target.x+missOffset,target.y-missOffset*.35);context.globalAlpha=slashAlpha;context.strokeStyle=colors[0];context.lineWidth=key==='critical'?5:4;context.beginPath();context.moveTo(-44,30);context.quadraticCurveTo(0,-44,44,-25);context.stroke();if(key==='critical'){context.strokeStyle=colors[2];context.beginPath();context.moveTo(-38,-30);context.quadraticCurveTo(2,42,42,22);context.stroke();}context.restore();
      }else if(key==='block'){
        var blockAlpha=Math.max(0,1-Math.abs(t-.38)/.42),radius=18+20*Math.min(1,t*2);context.save();context.translate(target.x,target.y);context.globalAlpha=blockAlpha;context.strokeStyle=colors[0];context.lineWidth=4;context.beginPath();context.moveTo(0,-radius);context.lineTo(radius*.82,-radius*.35);context.lineTo(radius*.66,radius*.72);context.lineTo(0,radius);context.lineTo(-radius*.66,radius*.72);context.lineTo(-radius*.82,-radius*.35);context.closePath();context.stroke();context.restore();
      }
    }
    function renderFrame(timestamp){
      frameId=0;if(!canvas||!context||!host){stopLoop();return;}
      var frameStarted=now(),width=Number(canvas.style.width.replace('px',''))||host.clientWidth||1,height=Number(canvas.style.height.replace('px',''))||host.clientHeight||1,dpr=Number(canvas.dataset.dpr)||1;context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.globalCompositeOperation='lighter';
      var remaining=[];effects.forEach(function(effect){var elapsed=Math.max(0,timestamp-effect.startedAt),duration=effect.command.durationMs||effect.command.preset.durationMs,key=effect.command.preset.key;if(elapsed>=duration){release(effect,'complete');return;}if(key==='projectile'||key==='fire-projectile')drawProjectile(effect,elapsed,duration,width,height);else if(key==='movement')drawMovement(effect,elapsed,duration);else if(key==='mist-teleport')drawMistTeleport(effect,elapsed,duration);else{if(key==='blood-transfer'||key==='lightning-spear'||key==='rot-ray')drawSpellPath(effect,elapsed,duration);drawBurst(effect,elapsed,duration);}remaining.push(effect);});effects=remaining;diagnostics.drawFrames+=1;if(runtime)runtime.noteFrame(now()-frameStarted);if(effects.length)frameId=requestFrame(renderFrame);else stopLoop();
    }
    function startLoop(){if(frameId)return;if(runtime)runtime.setRafActive(true,sourceId);frameId=requestFrame(renderFrame);}
    function stopLoop(){if(frameId){cancelFrame(frameId);frameId=0;}if(runtime)runtime.setRafActive(false,sourceId);if(context&&canvas){var dpr=Number(canvas.dataset.dpr)||1,width=Number(canvas.style.width.replace('px',''))||1,height=Number(canvas.style.height.replace('px',''))||1;context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);}}
    function cancelHandle(handleId,reason){var count=0,remaining=[];effects.forEach(function(effect){if(effect.handle&&String(effect.handle.id)===String(handleId||'')){release(effect,reason||'cancelled');count+=1;}else remaining.push(effect);});effects=remaining;if(!effects.length)stopLoop();return count;}
    function play(handle,nextHost,anchors){
      if(!handle||!handle.command)return false;
      if(documentRef&&documentRef.hidden){diagnostics.hiddenDrops+=1;return true;}
      if(!ensureCanvas(nextHost,handle.command.quality)||!reserveCapacity(handle))return false;anchors=anchors||{};var width=nextHost.clientWidth||1,height=nextHost.clientHeight||1,effect=acquire(),handleId=handle.id;effect.handle=handle;effect.command=handle.command;effect.eventId=handle.eventId;effect.startedAt=now();effect.start={x:Number(anchors.startX==null?width*.19:anchors.startX),y:Number(anchors.startY==null?height*.5:anchors.startY)};effect.end={x:Number(anchors.endX==null?width*.78:anchors.endX),y:Number(anchors.endY==null?height*.5:anchors.endY)};effect.done=false;handle.cancelRenderer=function(reason){return cancelHandle(handleId,reason);};effects.push(effect);diagnostics.plays+=1;diagnostics.maxEffects=Math.max(diagnostics.maxEffects,effects.length);startLoop();return true;
    }
    function cancel(eventId,reason){var count=0,remaining=[];effects.forEach(function(effect){if(effect.eventId===String(eventId||'')){release(effect,reason||'cancelled');count+=1;}else remaining.push(effect);});effects=remaining;if(!effects.length)stopLoop();return count;}
    function clear(reason){effects.forEach(function(effect){release(effect,reason||'cleared');});effects=[];stopLoop();}
    function handleVisibilityChange(){
      if(!documentRef||!documentRef.hidden)return;
      effects.forEach(function(effect){if(runtime&&effect.handle)runtime.finish(effect.handle,'hidden-document');release(effect,'hidden-document');});effects=[];stopLoop();
    }
    function snapshot(){return{version:VERSION,plays:diagnostics.plays,completed:diagnostics.completed,cancelled:diagnostics.cancelled,capacityDrops:diagnostics.capacityDrops,hiddenDrops:diagnostics.hiddenDrops,activeEffects:effects.length,createdEffects:diagnostics.createdEffects,reusedEffects:diagnostics.reusedEffects,poolSize:effectPool.length,maxEffects:diagnostics.maxEffects,maxConcurrent:maxConcurrent,resizes:diagnostics.resizes,drawFrames:diagnostics.drawFrames,rafActive:!!frameId};}
    if(documentRef&&typeof documentRef.addEventListener==='function')documentRef.addEventListener('visibilitychange',handleVisibilityChange);
    return{play:play,cancel:cancel,cancelHandle:cancelHandle,clear:clear,snapshot:snapshot,canvas:function(){return canvas;}};
  }

  return{VERSION:VERSION,createEngine:createEngine};
});
