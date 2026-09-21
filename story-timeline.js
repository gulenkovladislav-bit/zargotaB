(function(w){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
 const local=(o,k)=>w.ZargotaI18n?.getLocale()==='uk'?o[k+'Uk']||o[k]||'':o[k]||o[k+'Uk']||'';
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 function duration(s){return Math.max(.1,Number(s.duration)||0,...(s.cues||[]).map(c=>(Number(c.at)||0)+(Number(c.duration)||0)));}
 function active(s,kind,time){return(s.cues||[]).filter(c=>c.kind===kind&&time>=c.at&&time<c.at+c.duration).sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id))).pop()||null;}
 function sample(s,time){time=clamp(time,0,duration(s));const image=active(s,'image',time),dialogue=active(s,'dialogue',time),effect=active(s,'effect',time);return{time,image,dialogue,effect,progress:image?clamp((time-image.at)/image.duration,0,1):0,blend:image?clamp((time-image.at)/(Number(image.fade)||.001),0,1):1};}
 function page(data,c){const n=(data.nodes||[]).find(n=>n.id===c?.nodeId);return n?(w.ZargotaStoryPages?.pages(n)||[n])[c.page||0]||n:null;}
 function pairTiming(c){const legacy=c.pairTiming==null&&c.fps!=null;return Object.assign({firstHold:legacy?0:2,secondHold:legacy?0:2,fade:legacy?1/clamp(c.fps||2,.1,12):.5,loop:legacy},c.pairTiming||{});}
 function imagePair(c,time){
  const first=c?.src||c?.altSrc||'';if(!c?.src||!c?.altSrc||c.src===c.altSrc)return{first,second:first,mix:0};
  const timing=pairTiming(c),a=clamp(timing.firstHold,0,3600),b=clamp(timing.secondHold,0,3600),fade=clamp(timing.fade,0,3600),cycle=a+b+2*fade;
  let elapsed=Math.max(0,time-c.at),mix=0;if(timing.loop&&cycle>0)elapsed%=cycle;
  const smooth=x=>{const p=clamp(x,0,1);return p*p*(3-2*p);};
  if(elapsed<a)mix=0;else if(fade&&elapsed<a+fade)mix=smooth((elapsed-a)/fade);else if(!timing.loop||elapsed<a+fade+b||!fade)mix=1;else mix=1-smooth((elapsed-a-fade-b)/fade);
  return{first,second:c.altSrc,mix};
 }
 function camera(s,c,time){
  const list=(s.cues||[]).filter(x=>x.kind==='image').slice().sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)));
  let previous=null,base=1;
  for(const item of list){
   if(item.motion!=='zoom'||item.restartMotion||!previous||previous.motion!=='zoom'||previous.at+previous.duration<item.at-.001)base=1;
   else base+=clamp(previous.amplitude??.035,0,.2)*clamp((item.at-previous.at)/previous.duration,0,1);
   if(item===c||item.id===c?.id){const p=clamp((time-item.at)/item.duration,0,1),amp=clamp(item.amplitude??.035,0,.2);return item.motion==='zoom'?'scale('+(base+p*amp)+')':item.motion==='pan'?'scale('+(1+amp*2)+') translateX('+((p-.5)*amp*100)+'%)':'none';}previous=item;
  }return 'none';
 }
 function spaceToggle(e,toggle){if(e.code!=='Space'&&e.key!==' ')return false;if(e.target?.closest?.('input,textarea,select,[contenteditable="true"],summary'))return false;e.preventDefault();e.stopPropagation();if(!e.repeat)toggle();return true;}
 function dialogueOpacity(c,time){if(!c||time<c.at||time>=c.at+c.duration)return 0;const seconds=Math.min(c.duration/2,clamp(c.blockFade??.35,0,10));if(!seconds)return 1;const p=Math.min(clamp((time-c.at)/seconds,0,1),clamp((c.at+c.duration-time)/seconds,0,1));return p*p*(3-2*p);}
 function textFrame(c,reply,time){const full=Array.from(local(reply,'text')),mode=c.textAnimation||reply.textAnimation||'typewriter',seconds=c.revealDuration==null?Math.min(c.duration,full.length/Math.max(5,Number(reply.textSpeed)||37)):Math.max(0,Number(c.revealDuration)||0),progress=seconds?clamp((time-c.at)/seconds,0,1):1,count=mode==='typewriter'?Math.floor(full.length*progress):full.length;return{mode,progress,visible:full.slice(0,count).join(''),rest:full.slice(count).join('')};}
 function wordFrames(value,progress,mode){const parts=value.split(/(\s+)/),count=parts.filter(p=>p&&!/^\s+$/.test(p)).length;let index=0;return parts.map(value=>{if(!value||/^\s+$/.test(value))return{value,space:true};const p=clamp(progress*count-index++,0,1),opacity=mode==='words'?Number(p>0):p*p*(3-2*p);return{value,opacity,y:mode==='words-rise'?(1-opacity)*14:0};});}
 function applyTextStyle(s,source,data){const reply=page(data,source)||{},style=Object.assign({},w.ZargotaStoryPresentation?.resolve(data,reply)||{},source.presentation||{}),animation=source.textAnimation||reply.textAnimation||'typewriter';for(const c of s.cues||[]){if(c.kind!=='dialogue'||c===source)continue;c.presentation=JSON.parse(JSON.stringify(style));c.textAnimation=animation;c.blockFade=source.blockFade??.35;if(source.showPortrait!=null)c.showPortrait=source.showPortrait;else delete c.showPortrait;}}
 // Compose backgrounds before presenting them. Only one surface reaches the browser
 // compositor; independent transformed image tiles cannot leak between transitions.
 function pictureSurface(box){
  const canvas=document.createElement('canvas'),buffer=document.createElement('canvas'),pairCanvas=document.createElement('canvas');
  canvas.className='zg-timeline-surface';box.appendChild(canvas);
  const output=canvas.getContext('2d',{alpha:false}),ctx=buffer.getContext('2d',{alpha:false}),pairCtx=pairCanvas.getContext('2d',{alpha:false});
  const cache=new Map();let pending=null,disposed=false;
  function asset(url){
   if(!url)return null;
   if(cache.has(url)){const item=cache.get(url);cache.delete(url);cache.set(url,item);return item;}
   const item={image:new Image(),ready:false};cache.set(url,item);
   item.image.onload=async()=>{try{if(item.image.decode)await item.image.decode();}catch(_){return;}if(disposed)return;item.ready=true;if(pending)paint(pending);};
   item.image.onerror=()=>{item.failed=true;};item.image.src=url;return item;
  }
  function layer(pair,fit,transform,width,height){
   pairCtx.globalAlpha=1;pairCtx.fillStyle='#050807';pairCtx.fillRect(0,0,width,height);
   pairCtx.save();const scale=Number(/scale\(([^)]+)\)/.exec(transform)?.[1])||1,pan=Number(/translateX\(([^%]+)%\)/.exec(transform)?.[1])||0;
   pairCtx.translate(width/2,height/2);pairCtx.scale(scale,scale);pairCtx.translate(-width/2+pan*width/100,-height/2);
   function draw(url,opacity){const item=cache.get(url);if(!item?.ready||opacity<=0)return;const image=item.image,ratio=(fit==='contain'?Math.min:Math.max)(width/image.naturalWidth,height/image.naturalHeight),iw=image.naturalWidth*ratio,ih=image.naturalHeight*ratio;pairCtx.globalAlpha=opacity;pairCtx.drawImage(image,(width-iw)/2,(height-ih)/2,iw,ih);}
   draw(pair.first,1);draw(pair.second,pair.mix);pairCtx.restore();
  }
  function paint(plan){
   if(disposed)return;pending=plan;
   const needed=new Set();for(const p of [plan.blend<1?plan.back:null,plan.blend>0?plan.front:null]){if(p?.first)needed.add(p.first);if(p?.second&&p.mix>0)needed.add(p.second);}
   // Leave the last complete frame intact while a seek loads a new image.
   let ready=true;for(const url of needed){if(!asset(url).ready)ready=false;}if(!ready)return;
   const width=Math.max(2,Math.min(2560,Math.round((box.clientWidth||1920)*Math.min(w.devicePixelRatio||1,2)))),height=Math.round(width*9/16);
   for(const c of [buffer,pairCanvas])if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
   ctx.globalAlpha=1;ctx.fillStyle='#050807';ctx.fillRect(0,0,width,height);
   if(plan.blend<1){layer(plan.back,plan.backFit,plan.backTransform,width,height);ctx.drawImage(pairCanvas,0,0);}
   if(plan.blend>0){layer(plan.front,plan.fit,plan.transform,width,height);ctx.globalAlpha=plan.blend;ctx.drawImage(pairCanvas,0,0);ctx.globalAlpha=1;}
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   output.drawImage(buffer,0,0);
   // Bound retained decoded originals, including during long songs and seeking.
   for(const [url,item] of cache){if(cache.size<=8)break;if(!needed.has(url)){item.image.onload=item.image.onerror=null;cache.delete(url);}}
  }
  return{canvas,paint,dispose(){disposed=true;pending=null;for(const item of cache.values())item.image.onload=item.image.onerror=null;cache.clear();}};
 }
 function stage(host,data){
  const viewport=document.createElement('div');viewport.className='zg-timeline-viewport';host.appendChild(viewport);
  const box=document.createElement('div');box.className='zg-timeline-stage';viewport.appendChild(box);
  const surface=pictureSurface(box),fx=document.createElement('div'),caption=document.createElement('section'),portrait=document.createElement('img'),body=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('p');
  fx.className='zg-timeline-fx';caption.className='zg-timeline-caption';body.append(name,text);caption.append(portrait,body);box.append(fx,caption);
  const dialogueRoot=document.createElement('div'),frame=document.createElement('div'),visible=document.createElement('span'),rest=document.createElement('span');dialogueRoot.className='zg-story-player zg-story-dialogue-preview open zg-timeline-dialogue-root';caption.className='zg-story-dialogue';frame.className='zg-story-speaker-frame';portrait.className='zg-story-speaker-portrait';body.className='zg-story-dialogue-body';name.className='zg-story-speaker-name';text.className='zg-story-line';rest.style.visibility='hidden';text.replaceChildren(visible,rest);frame.append(portrait);caption.prepend(frame);dialogueRoot.append(caption);box.append(dialogueRoot);
  function src(el,value){if(el.dataset.src!==value){el.dataset.src=value;el.src=value||'';}el.hidden=!value;}
  function render(s,time){const scene=s.sceneId===data.activeSceneId?data.scene:(data.scenes||[]).find(r=>r.id===s.sceneId)?.scene||data.scene,background=(scene?.layers||[]).find(l=>l.visible!==false)?.image||'';const f=sample(s,time),c=f.image,previous=(s.cues||[]).filter(x=>x.kind==='image'&&c&&x.at<c.at).sort((a,b)=>a.at-b.at).pop();
   const pair=imagePair(c,time),reduced=w.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   const outgoing=previous?imagePair(previous,Math.max(previous.at,Math.min(c.at,previous.at+previous.duration)-1e-7)):null;
   const backTransform=reduced?'none':c?.motion==='zoom'&&!c.restartMotion&&previous?.motion==='zoom'&&previous.at+previous.duration>=c.at-.001?camera(s,c,time):camera(s,previous,Math.min(time,previous?previous.at+previous.duration:time));
   surface.paint({front:{...pair,first:pair.first||background},back:outgoing||{first:background,mix:0},blend:c?.transition==='cut'?1:f.blend,fit:c?.fit,backFit:previous?.fit,transform:reduced?'none':camera(s,c,time),backTransform});
   fx.style.background=f.effect?.color||'#000';fx.style.opacity=f.effect?clamp(f.effect.opacity??.25,0,1):0;
   const reply=page(data,f.dialogue);caption.hidden=!reply;dialogueRoot.style.opacity=dialogueOpacity(f.dialogue,time);if(reply){const cue=f.dialogue,actor=w.ZargotaStoryActors?.portrait(data,reply)||data.speakers?.[reply.speaker]||{},style=Object.assign({},w.ZargotaStoryPresentation?.resolve(data,reply)||{},cue.presentation||{});src(portrait,(cue.showPortrait??reply.showPortrait)===false?'':actor.portrait);frame.hidden=portrait.hidden;name.textContent=local(actor,'name');w.ZargotaStoryPresentation?.apply(dialogueRoot,caption,actor,style);dialogueRoot.style.transform='scale('+box.clientWidth/1920+')';const tx=textFrame(cue,reply,time);if(tx.mode.startsWith('words')){visible.replaceChildren();for(const part of wordFrames(tx.visible,tx.progress,tx.mode)){const word=document.createElement('span');word.textContent=part.value;if(!part.space){word.style.display='inline-block';word.style.opacity=part.opacity;word.style.transform='translateY('+part.y+'px)';}visible.appendChild(word);}rest.textContent='';}else{visible.textContent=tx.visible;rest.textContent=tx.rest;}text.style.opacity=tx.mode==='fade'||tx.mode==='rise'?tx.progress:1;text.style.transform=tx.mode==='rise'?'translateY('+((1-tx.progress)*18)+'px)':'none';text.style.animation='none';}
  }
  return{box,render,dispose:()=>surface.dispose()};
 }
 // Visuals always sample the audio position; no chain of delayed callbacks accumulates drift.
 function transport(sequence,data,view,notify=()=>{},options={}){
  let s=sequence,audio=new Audio(),raf=0,disposed=false,generation=0,loaded=false;
  audio.preload='auto';audio.volume=.8;
  const offset=()=>Math.max(0,Number(s.audioTrimStart)||0);
  const end=()=>Math.min(Number(s.audioTrimEnd)||Infinity,Number.isFinite(audio.duration)?audio.duration:Infinity,offset()+duration(s));
  const now=()=>clamp(audio.currentTime-offset(),0,duration(s));
  function paint(){if(disposed)return;view.render(s,now());notify(now(),!audio.paused,audio.seeking);}
  function tick(){paint();if(!disposed&&!audio.paused)raf=requestAnimationFrame(tick);}
  function pause(){audio.pause();cancelAnimationFrame(raf);paint();}
  async function prepare(){const g=++generation;loaded=false;const urls=new Set((s.cues||[]).flatMap(c=>[c.src,c.altSrc]).filter(Boolean));for(const c of s.cues||[]){const p=page(data,c);if(p){const a=w.ZargotaStoryActors?.portrait(data,p);if(a?.portrait)urls.add(a.portrait);}}
   await Promise.all([...urls].map(url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(typeof img.decode==='function')img.decode().then(resolve,reject);else resolve();};img.onerror=()=>reject(Error(t('Не загружено изображение: ','Не завантажено зображення: ')+url));img.src=url;})));
   if(disposed||g!==generation)return false;loaded=true;return true;
  }
  async function play(){if(!s.audio)throw Error(t('Сначала выберите основное аудио.','Спершу оберіть основне аудіо.'));if(!loaded&&!await prepare())return;if(audio.currentTime<offset()||audio.currentTime>=end())audio.currentTime=offset();const g=generation;await audio.play();if(disposed||g!==generation){audio.pause();return;}cancelAnimationFrame(raf);tick();}
  function seek(time){audio.currentTime=offset()+clamp(time,0,Math.max(0,end()-offset()));paint();}
  function set(next){const changed=s.audio!==next.audio;s=JSON.parse(JSON.stringify(next));loaded=false;generation++;if(changed||!audio.src){pause();if(s.audio)audio.src=s.audio;else audio.removeAttribute('src');}paint();}
  audio.onseeked=paint;audio.ontimeupdate=()=>{if(audio.currentTime>=end()){pause();options.ended?.();}else paint();};audio.onended=()=>{pause();options.ended?.();};audio.onerror=()=>options.error?.(t('Не удалось открыть аудио. Проверьте путь к файлу.','Не вдалося відкрити аудіо. Перевірте шлях до файлу.'));audio.onloadedmetadata=()=>{options.metadata?.(audio.duration);paint();};
  set(s);
  return{play,pause,seek,set,now,prepare,dispose(){disposed=true;generation++;view.dispose?.();cancelAnimationFrame(raf);audio.onseeked=audio.ontimeupdate=audio.onended=audio.onerror=audio.onloadedmetadata=null;audio.pause();audio.removeAttribute('src');audio.load();},audio};
 }
 function play(sequence,data,done){
  const overlay=document.createElement('div');overlay.className='zg-timeline-play';document.body.appendChild(overlay);const view=stage(overlay,data),tools=document.createElement('div');tools.className='zg-timeline-play-tools';overlay.appendChild(tools);
  const status=document.createElement('span'),toggle=document.createElement('button'),close=document.createElement('button'),seek=document.createElement('input');seek.type='range';seek.min=0;seek.max=duration(sequence);seek.step=.01;seek.setAttribute('aria-label',t('Время сцены','Час сцени'));toggle.textContent='▶ / Ⅱ';close.textContent=t('Завершить сцену','Завершити сцену');tools.append(toggle,seek,status,close);
  let ended=false;const end=()=>{if(ended)return;ended=true;control.dispose();overlay.remove();done?.();};
  const control=transport(sequence,data,view,(time)=>{seek.value=time;status.textContent=time.toFixed(2)+' / '+duration(sequence).toFixed(2);},{ended:end,error:msg=>{status.textContent=msg;}});
  toggle.onclick=()=>control.audio.paused?control.play().catch(e=>status.textContent=e.message):control.pause();seek.oninput=()=>control.seek(seek.value);close.onclick=end;control.play().catch(e=>status.textContent=e.message);
  return()=>{ended=true;control.dispose();overlay.remove();};
 }
 w.ZargotaStoryTimeline={duration,active,sample,page,imagePair,pairTiming,camera,spaceToggle,dialogueOpacity,textFrame,wordFrames,applyTextStyle,pictureSurface,stage,transport,play};
})(window);
