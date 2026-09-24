(function(w){
'use strict';
function clamp(v,min,max,f){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;}
function route(item,scene){
 var m=item.ambientMotion||{},pts=(m.points||[]).filter(function(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);});
 if(pts.length<2)pts=[[item.x||50,item.y||50],[clamp((item.x||50)+25,0,100,75),item.y||50]];
 if(m.mode==='pingpong')pts=pts.concat(pts.slice(0,-1).reverse());
 var total=0,lengths=[0];pts.slice(1).forEach(function(p,i){total+=Math.hypot(p[0]-pts[i][0],(p[1]-pts[i][1])*(scene.boardHeight||16)/(scene.boardWidth||24));lengths.push(total);});
 return {points:pts,lengths:lengths,total:total};
}
function sample(r,f){
 var d=r.total*f,i=1;while(i<r.lengths.length-1&&r.lengths[i]<d)i++;
 var a=r.points[i-1],b=r.points[i],k=(d-r.lengths[i-1])/(r.lengths[i]-r.lengths[i-1]||1);
 return {x:a[0]+(b[0]-a[0])*k,y:a[1]+(b[1]-a[1])*k,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
}
function create(mixer){
 var soundEnabled=false,soundVolume=.6,listener={x:50,y:50};
 function silence(s){if(s.audio){s.audio.pause();if(mixer)mixer.unregister(s.audio);s.audio.removeAttribute('src');s.audio.load();s.audio=null;}s.pending=false;}
 function sound(s,p,opacity,now){
  var gain=Math.pow(Math.max(0,1-Math.hypot((p.x-listener.x)*(scene.boardWidth||24)/100,(p.y-listener.y)*(scene.boardHeight||16)/100)/clamp(s.motion.soundRadius,1,30,5)),2)*clamp(s.motion.soundVolume,0,1,.45)*opacity*soundVolume;
  if(!soundEnabled||!s.motion.sound||gain<.001){if(s.audio)s.audio.pause();return;}
  if(!s.audio){s.audio=new Audio(s.motion.sound);s.audio.loop=true;if(mixer)mixer.register(s.audio,'traffic',false,0);}
  if(mixer)mixer.gain(s.audio,gain);else s.audio.volume=gain;
  if(s.audio.paused&&!s.pending&&now>(s.retryAt||0)){s.pending=true;var audio=s.audio;var promise=audio.play();if(promise&&promise.then)promise.then(function(){s.pending=false;}).catch(function(){s.pending=false;s.retryAt=now+2000;});else s.pending=false;}
 }
 var world=null,scene={},identity=null,states=new Map(),raf=0,last=0,disposed=false;
 var reduced=w.matchMedia?w.matchMedia('(prefers-reduced-motion: reduce)'):null;
 function stopWalk(s){if(s.el&&w.ZargotaStoryWalk)w.ZargotaStoryWalk.stop(s.el);}
 function clear(){states.forEach(function(s){stopWalk(s);silence(s);});states.clear();if(world)world.querySelectorAll('[data-traffic-trail]').forEach(function(el){el.remove();});}
 function frame(now){
  raf=0;if(disposed)return;
  var dt=last?Math.min(64,Math.max(0,now-last)):0;last=now;
  var paused=document.hidden||reduced&&reduced.matches||!world||!world.isConnected||world.closest('[hidden]');
  states.forEach(function(s){
   if(!s.el||!s.el.isConnected)return;
   if(paused||Number(s.el.dataset.storyHailedUntil)>now||s.el.closest('.in-dialogue')){stopWalk(s);if(s.audio)s.audio.pause();return;}
   s.elapsed+=dt;
   var phase=s.elapsed%s.cycle,f=Math.min(1,phase/s.travel),p=sample(s.route,f);
   var visible=phase<=s.travel,opacity=visible?(s.motion.mode==='pingpong'?1:Math.min(1,f/.04,(1-f)/.04)):0;
   s.el.style.left=p.x+'%';s.el.style.top=p.y+'%';s.el.style.opacity=String(Math.max(0,opacity));
   sound(s,p,Math.max(0,opacity),now);
   if(s.motion.kind==='cart'){var art=s.el.querySelector('img');if(art)art.style.transform='rotate('+(Math.atan2(Math.sin(p.angle)*(scene.boardHeight||16)/(scene.boardWidth||24),Math.cos(p.angle))*180/Math.PI+180)+'deg)';}
   if(s.motion.kind!=='cart'&&visible&&opacity>.2&&w.ZargotaStoryWalk){
    // Shared gait and the same alternating boot prints as the hero.
    w.ZargotaStoryWalk.update(s.el,world,scene,p,now,false,s.motion.trails!==false);
   }else stopWalk(s);
   if(s.motion.kind==='cart'&&s.motion.trails!==false&&visible&&opacity>.2&&now-s.trailTime>380){
    s.trailTime=now;var previous=s.trailPoint||p;s.trailPoint=p;var dx=(p.x-previous.x)*world.clientWidth/100,dy=(p.y-previous.y)*world.clientHeight/100,len=Math.hypot(dx,dy);if(len>80)return;var mark=document.createElement('span');mark.dataset.trafficTrail='true';
    mark.style.cssText='position:absolute;pointer-events:none;width:'+Math.max(2,len+1)+'px;height:18px;border-top:2px solid #624c3280;border-bottom:2px solid #624c3280;transform:translate(-50%,-50%) rotate('+(Math.atan2(dy,dx)*180/Math.PI)+'deg);z-index:3;';
    mark.style.left=((p.x+previous.x)/2)+'%';mark.style.top=((p.y+previous.y)/2)+'%';world.appendChild(mark);
    if(mark.animate){var fade=mark.animate([{opacity:.55},{opacity:0}],{duration:1800,fill:'forwards'});fade.onfinish=function(){mark.remove();};}
    var marks=world.querySelectorAll('[data-traffic-trail]');if(marks.length>32)marks[0].remove();
   }
  });
  if(states.size)raf=requestAnimationFrame(frame);
 }
 function mount(settings,target,id){
  if(disposed)return;
  if(identity!==id){clear();identity=id;}world=target;scene=settings;
  var tokens=(settings.trafficTokens||[]).filter(function(t){return t&&t.visible!==false&&!t.hidden&&t.enabled!==false&&t.ambientMotion&&t.ambientMotion.enabled;}).slice(0,16);
  var keep=new Set();
  tokens.forEach(function(token){
   var el=Array.from(world.querySelectorAll('[data-token-id]')).find(function(el){return el.dataset.tokenId===token.id;});
   if(!el)return;
   keep.add(token.id);var motion=token.ambientMotion,key=JSON.stringify([motion,token.x,token.y]);
   var s=states.get(token.id);
   if(!s||s.key!==key){
    if(s){stopWalk(s);silence(s);}
    var random=motion.random!==false,travel=clamp(motion.duration,4,300,40)*1000*(random?.88+Math.random()*.24:1),gap=clamp(motion.gap,0,120,8)*1000*(random?.7+Math.random()*.6:1);
    s={key:key,motion:motion,route:route(token,settings),travel:travel,cycle:travel+gap,elapsed:random?Math.random()*(travel+gap):0,trailTime:0};states.set(token.id,s);
   }
   if(s.el!==el)stopWalk(s);s.el=el;
   el.style.pointerEvents=token.dialogueInteractive?'auto':'none';el.setAttribute('aria-hidden',token.dialogueInteractive?'false':'true');
   var p=sample(s.route,Math.min(1,(s.elapsed%s.cycle)/s.travel));el.style.left=p.x+'%';el.style.top=p.y+'%';
   var image=el.querySelector('img');if(image){image.style.objectFit='contain';image.style.objectPosition='center';image.style.filter='none';}
   if(token.bakedFrame){el.style.border='0';el.style.background='transparent';el.style.boxShadow='none';}
   if(image&&motion.kind==='cart'){el.style.height=((token.size||88)*2/3)+'px';el.style.border='0';el.style.background='transparent';el.style.boxShadow='none';image.style.borderRadius='50%';image.style.padding='0';}
  });
  states.forEach(function(s,id){if(!keep.has(id)){stopWalk(s);silence(s);states.delete(id);}});
  if(!raf&&states.size){last=0;raf=requestAnimationFrame(frame);}
 }
 return {mount:mount,position:function(p){listener=p;},setSound:function(v){soundEnabled=!!v;if(!v)states.forEach(silence);},setVolume:function(v){soundVolume=clamp(v,0,1,.6);},dispose:function(){disposed=true;if(raf)cancelAnimationFrame(raf);raf=0;clear();}};
}
w.ZargotaStoryTraffic={create:create};
})(window);
