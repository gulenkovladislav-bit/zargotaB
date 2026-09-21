(function(w){
 'use strict';
 function clamp(v,def){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):def;}
 function create(report){
  var tracks=new Map(),music=null,policy=null,enabled=true,master=1,musicVolume=.6,frame=0,disposed=false;
  function target(r){return enabled?r.gain*master*(r.background&&policy&&!policy.keep.includes(r.key)?policy.level:1):0;}
  function tick(){frame=0;var now=performance.now(),pending=false;tracks.forEach(function(r,a){if(r.fade){var f=r.fade,p=Math.min(1,(now-f.start)/f.ms);a.volume=clamp(f.from+(f.to-f.from)*p,0);if(p<1)pending=true;else{r.fade=null;if(f.done)f.done();}}});if(pending)frame=requestAnimationFrame(tick);}
  function fade(a,to,ms,done){var r=tracks.get(a);if(!r)return;ms=Math.max(0,Math.min(30000,Number(ms)||0));if(!ms){r.fade=null;a.volume=clamp(to,0);if(done)done();return;}r.fade={from:a.volume,to:clamp(to,0),start:performance.now(),ms:ms,done:done};if(!frame)frame=requestAnimationFrame(tick);}
  function refresh(ms){tracks.forEach(function(r,a){if(!r.retiring)fade(a,target(r),ms);});}
  function remove(a){if(!a)return;tracks.delete(a);a.pause();a.removeAttribute('src');a.load();}
  function retire(a,ms){var r=tracks.get(a);if(r){r.retiring=true;fade(a,0,ms,function(){remove(a);});}}
  function register(a,key,background,gain){tracks.set(a,{key:key||'effect',background:!!background,gain:clamp(gain,1),fade:null});a.volume=target(tracks.get(a));return a;}
  function stop(ms){var old=music;music=null;policy=null;if(old)retire(old.audio,ms==null?old.event.fadeOutMs:ms);refresh(ms==null?old&&old.event.fadeOutMs:ms);}
  function command(event){if(disposed||!event)return;if(event.action==='stop'){stop(event.fadeOutMs);return;}if(event.action!=='play'||!event.sound)return;
   var a=new Audio(event.sound),old=music,e=Object.assign({loop:true,volume:.75,fadeInMs:1200,fadeOutMs:1200,duck:true,duckVolume:0,keep:[],scope:'scene'},event);a.loop=e.loop!==false;register(a,'music',false,e.volume*musicVolume);a.volume=0;music={audio:a,event:e};policy=e.duck?{level:clamp(e.duckVolume,0),keep:Array.isArray(e.keep)?e.keep:[]}:null;if(old)retire(old.audio,e.fadeOutMs);refresh(e.fadeInMs);
   a.onended=function(){if(music&&music.audio===a)stop(e.fadeOutMs);else remove(a);};a.onerror=function(){if(music&&music.audio===a)stop(0);else remove(a);if(report)report();};var promise=a.play();if(promise&&promise.catch)promise.catch(function(error){if(error&&error.name==='NotAllowedError')return;a.onerror();});
  }
  function reset(){music=null;policy=null;cancelAnimationFrame(frame);frame=0;Array.from(tracks.keys()).forEach(remove);}
  return {register:register,unregister:function(a){tracks.delete(a);},gain:function(a,v){var r=tracks.get(a);if(!r)return;r.gain=clamp(v,1);if(r.fade&&!r.retiring)r.fade.to=target(r);else if(!r.retiring)a.volume=target(r);},command:command,stop:stop,stopScope:function(scope){if(music&&music.event.scope===scope)stop();},setSound:function(value){enabled=!!value;if(!enabled)tracks.forEach(function(r,a){if(r.retiring)remove(a);});refresh(0);if(enabled&&music&&music.audio.paused){var p=music.audio.play();if(p&&p.catch)p.catch(function(){});}},setVolume:function(v){musicVolume=clamp(v,.6);if(music&&tracks.has(music.audio))tracks.get(music.audio).gain=clamp(music.event.volume,.75)*musicVolume;refresh(0);},reset:reset,dispose:function(){reset();disposed=true;},status:function(){return {tracks:tracks.size,music:music&&music.event.sound,duck:policy};}};
 }
 w.ZargotaStoryAudioMixer={create:create};
})(window);
