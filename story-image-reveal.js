(function(w){
 'use strict';
 function duration(value,fallback){return Number.isFinite(Number(value))?Math.max(100,Math.min(60000,Number(value))):fallback;}
 function timing(cfg){var frames=cfg.frames,spans=frames.map(function(f,i){return{hold:duration(f.holdMs,duration(cfg.holdMs,900)),fade:cfg.loop===false&&i===frames.length-1?0:duration(frames[(i+1)%frames.length].fadeMs,duration(cfg.fadeMs,1500))};});return{spans:spans,total:spans.reduce(function(n,s){return n+s.hold+s.fade;},0)};}
 function phase(cfg,elapsed){var t=timing(cfg),at=cfg.loop===false?Math.min(Math.max(0,elapsed),t.total):Math.max(0,elapsed)%t.total;for(var i=0;i<t.spans.length;i++){var s=t.spans[i];if(at<s.hold||i===t.spans.length-1&&!s.fade)return{from:i,to:i,mix:0};at-=s.hold;if(at<s.fade){var p=at/s.fade;return{from:i,to:(i+1)%t.spans.length,mix:p*p*(3-2*p)};}at-=s.fade;}return{from:0,to:0,mix:0};}
 // One native media clock drives both water sound and the authored crossfades.
 function audioSequence(view,art,cfg,options){
  options=options||{};var stopped=false,raf=0,began=0,audio=null,failed=false,started=false,lastGain=-1,lastCue=-1,layers=[],total=timing(cfg).total,reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function active(value){if(options.onAudioActive)options.onAudioActive(value);}
  function releaseAudio(){if(!audio)return;if(options.mixer)options.mixer.unregister(audio);audio.pause();audio.removeAttribute('src');audio.load();audio=null;active(false);}
  function fallback(){if(stopped||failed)return;failed=true;began=performance.now();releaseAudio();}
  function tick(now){if(stopped)return;var elapsed=now-began;if(audio&&started&&!failed&&Number.isFinite(audio.duration)&&audio.duration>0)elapsed=audio.currentTime/audio.duration*total;
   var p=reduced?{from:0,to:0,mix:0}:phase(cfg,elapsed);layers.forEach(function(l,i){l.style.zIndex=i===p.to&&p.to!==p.from?'2':i===p.from?'1':'0';l.style.opacity=i===p.from?'1':i===p.to?String(p.mix):'0';});
   if(lastCue!==p.to){lastCue=p.to;if(view.dispatchEvent&&w.CustomEvent)view.dispatchEvent(new w.CustomEvent('zg-image-sequence-frame',{bubbles:true,detail:{index:p.to,cue:cfg.frames[p.to].cue||''}}));}
   if(audio){var gain=Math.max(0,Math.min(1,Number(cfg.volume==null?.09:cfg.volume)))*(options.getVolume?options.getVolume():.6);if(gain!==lastGain){lastGain=gain;if(options.mixer)options.mixer.gain(audio,gain);else audio.volume=options.sound===false?0:gain;}}
   raf=w.requestAnimationFrame(tick);
  }
  cfg.frames.forEach(function(f){var l=art.cloneNode(false);l.src=f.image;l.alt='';l.setAttribute('aria-hidden','true');l.style.cssText=art.style.cssText;Object.assign(l.style,{position:'absolute',inset:'0',pointerEvents:'none',opacity:'0',zIndex:'0',transform:'none'});view.appendChild(l);layers.push(l);});
  Promise.all(layers.map(function(l){return l.decode?l.decode():Promise.resolve();})).then(function(){if(stopped)return;began=performance.now();layers[0].style.opacity='1';raf=w.requestAnimationFrame(tick);audio=new w.Audio(cfg.sound);audio.loop=cfg.loop!==false;audio.volume=0;if(options.mixer)options.mixer.register(audio,'image-sequence',true,0);
   audio.onloadedmetadata=function(){if(!audio||stopped)return;audio.playbackRate=Math.max(.25,Math.min(4,audio.duration/(total/1000)));audio.preservesPitch=true;};audio.onerror=fallback;
   var played=audio.play();Promise.resolve(played).then(function(){if(stopped||failed||!audio)return;started=true;active(true);}).catch(fallback);
  }).catch(function(){layers.forEach(function(l){l.remove();});});
  return function(){stopped=true;w.cancelAnimationFrame(raf);releaseAudio();layers.forEach(function(l){l.remove();});};
 }
 // An optional paired still reveal. Both layers share framing and movement.
 function sequence(view,art,cfg,options){
  cfg=Object.assign({},cfg,{frames:cfg.frames.filter(function(f){return f&&typeof f.image==='string'&&f.image;})});
  if(cfg.sound&&cfg.soundMode!=='cue'&&cfg.frames.length)return audioSequence(view,art,cfg,options);
  options=options||{};
  var stopped=false,timer=0,animation=null,index=0,layers=[],reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cueAudio=null,cueRaf=0;
  function releaseCue(){w.cancelAnimationFrame(cueRaf);cueRaf=0;if(!cueAudio)return;var a=cueAudio;cueAudio=null;if(options.mixer)options.mixer.unregister(a);a.pause();a.removeAttribute('src');a.load();}
  function cueGain(){return Math.max(0,Math.min(1,Number(cfg.volume==null?.06:cfg.volume)))*(options.getVolume?options.getVolume():.6);}
  function setCueGain(gain){if(!cueAudio)return;if(options.mixer)options.mixer.gain(cueAudio,gain);else cueAudio.volume=options.sound===false?0:gain;}
  function playCue(){
   if(!cfg.sound||cfg.soundMode!=='cue'||reduced)return;
   if(Array.isArray(cfg.soundFrames)&&cfg.soundFrames.indexOf(index)<0)return;
   releaseCue();var a=cueAudio=new w.Audio(cfg.sound);a.loop=false;a.volume=0;
   if(options.mixer)options.mixer.register(a,'image-cue',true,0);
   function gain(){if(stopped||cueAudio!==a)return;setCueGain(cueGain());cueRaf=w.requestAnimationFrame(gain);}
   a.onended=a.onerror=function(){if(cueAudio===a)releaseCue();};gain();
   Promise.resolve(a.play()).catch(function(){if(cueAudio===a)releaseCue();});
  }
  function fadeCue(){
   w.cancelAnimationFrame(cueRaf);if(!cueAudio)return;var began=performance.now(),gain=cueGain();
   function tick(now){var p=Math.min(1,(now-began)/250);setCueGain(gain*(1-p));if(p<1)cueRaf=w.requestAnimationFrame(tick);else releaseCue();}
   cueRaf=w.requestAnimationFrame(tick);
  }
  var frames=cfg.frames.filter(function(f){return f&&typeof f.image==='string'&&f.image;});
  function ms(v,fallback){return Number.isFinite(Number(v))?Math.max(100,Math.min(60000,Number(v))):fallback;}
  function cue(){playCue();if(view.dispatchEvent&&w.CustomEvent)view.dispatchEvent(new w.CustomEvent('zg-image-sequence-frame',{bubbles:true,detail:{index:index,cue:frames[index].cue||''}}));}
  function schedule(){if(stopped||reduced||frames.length<2||cfg.loop===false&&index===frames.length-1)return;timer=w.setTimeout(next,ms(frames[index].holdMs,ms(cfg.holdMs,900)));}
  function next(){if(stopped)return;var previous=index;index=(index+1)%frames.length;var incoming=layers[index],outgoing=layers[previous];incoming.style.zIndex='2';outgoing.style.zIndex='1';incoming.style.opacity='0';cue();
   function finish(){if(stopped)return;incoming.style.opacity='1';outgoing.style.opacity='0';incoming.style.zIndex='1';outgoing.style.zIndex='0';if(animation){animation.cancel();animation=null;}schedule();}
   if(incoming.animate){animation=incoming.animate([{opacity:0},{opacity:1}],{duration:ms(frames[index].fadeMs,ms(cfg.fadeMs,1500)),easing:'ease-in-out',fill:'forwards'});animation.onfinish=finish;}else finish();
  }
  if(!frames.length)return function(){};
  frames.forEach(function(f,i){var layer=art.cloneNode(false);layer.src=f.image;layer.alt='';layer.setAttribute('aria-hidden','true');layer.style.cssText=art.style.cssText;Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',opacity:'0',zIndex:'0',transform:'none'});view.appendChild(layer);layers.push(layer);});
  Promise.all(layers.map(function(l){return l.decode?l.decode():Promise.resolve();})).then(function(){if(stopped)return;layers[0].style.opacity='1';cue();schedule();}).catch(function(){layers.forEach(function(l){l.remove();});});
  return function(){stopped=true;w.clearTimeout(timer);fadeCue();if(animation)animation.cancel();layers.forEach(function(l){l.remove();});};
 }
 function play(view,art,node,options){
  if(node.imageSequence&&Array.isArray(node.imageSequence.frames))return sequence(view,art,node.imageSequence,options);
  var stopped=false,animations=[],cover=null,reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(target,frames,options){if(target.animate)animations.push(target.animate(frames,options));}
  function drift(target){if(!reduced)animate(target,[{transform:'scale(1)'},{transform:'scale(1.018)'}],{duration:18000,easing:'ease-out',fill:'forwards'});}
  if(node.imageRevealFrom&&!reduced){
   cover=art.cloneNode(false);cover.removeAttribute('src');cover.alt='';cover.setAttribute('aria-hidden','true');
   cover.style.cssText=art.style.cssText;cover.style.position='absolute';cover.style.inset='0';cover.style.pointerEvents='none';
   cover.src=node.imageRevealFrom;view.appendChild(cover);
   Promise.all([art.decode?art.decode():Promise.resolve(),cover.decode?cover.decode():Promise.resolve()]).then(function(){
    if(stopped)return;drift(art);drift(cover);
    animate(cover,[{opacity:1},{opacity:0}],{delay:250,duration:2600,easing:'ease-in-out',fill:'forwards'});
   }).catch(function(){if(!stopped&&cover)cover.remove();});
  }else drift(art);
  return function(){stopped=true;animations.forEach(function(a){a.cancel();});if(cover)cover.remove();};
 }
 w.ZargotaStoryImageReveal={play:play,phase:phase};
})(window);
