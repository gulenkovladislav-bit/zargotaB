(function(w){
'use strict';
const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
let biteEffect=null;
function stopBiteEffect(){if(!biteEffect)return;const effect=biteEffect;biteEffect=null;effect.animation?.cancel();effect.element.remove();}
function showBiteEffect(){
 stopBiteEffect();
 const element=document.createElement('div');element.className='zg-snake-bite-vignette';element.setAttribute('aria-hidden','true');element.setAttribute('popover','manual');
 document.body.append(element);if(element.showPopover)element.showPopover();
 const reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animation=element.animate([{opacity:reduced?.5:.85},{opacity:.5}],{duration:reduced?1:750,fill:'forwards',easing:'ease-out'});
 biteEffect={element,animation,fading:false};
}
function fadeBiteEffect(){
 if(!biteEffect||biteEffect.fading)return;
 const effect=biteEffect;effect.fading=true;
 const opacity=getComputedStyle(effect.element).opacity;effect.animation.cancel();
 effect.animation=effect.element.animate([{opacity},{opacity:0}],{duration:10000,fill:'forwards',easing:'ease-in-out'});
 effect.animation.onfinish=()=>{if(biteEffect===effect)stopBiteEffect();};
}
const path=[[470,520],[450,450],[490,395],[530,350],[585,345],[610,300],[650,285]],radius=24,handRadius=12;
function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);}
function safe(p){return path.slice(1).some((b,i)=>distance(p,path[i],b)<=radius-handRadius-1);}
function segmentSafe(a,b){const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5);for(let i=1;i<=steps;i++)if(!safe([a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps]))return false;return true;}
function open(cfg,sound,done){
 stopBiteEffect();
 const d=document.createElement('dialog');d.className='zg-snake-reach';d.setAttribute('aria-label',t('Достать яйца','Дістати яйця'));
 const instruction=document.createElement('p');instruction.textContent=t('Зажмите светлую точку и осторожно ведите её по проходу к яйцам. Рука дрожит — удерживайте весь круг внутри прохода. Можно двигаться стрелками.','Затисніть світлу точку й обережно ведіть її проходом до яєць. Рука тремтить — утримуйте все коло всередині проходу. Можна рухатися стрілками.');
 const stage=document.createElement('div');stage.className='zg-snake-stage';stage.style.backgroundImage='url("'+(cfg.image||'assets/stories/esteros/snake/root-hollow.png')+'")';
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=562;canvas.tabIndex=0;canvas.setAttribute('aria-label',instruction.textContent);stage.append(canvas);
 const exit=document.createElement('button');exit.textContent=t('Убрать руку','Прибрати руку');d.append(instruction,stage,exit);document.body.append(d);d.showModal();canvas.focus();
 const strike=new Image();strike.src=cfg.scareImage||'assets/stories/esteros/snake/strike.png';if(strike.src.endsWith('/esteros/snake/strike.png'))strike.src+='?v=black-20261024';
 const bite=sound?new Audio(cfg.sound||'assets/stories/audio/esteros/snake-bite-01-tight.wav'):null;if(bite){bite.preload='auto';bite.playbackRate=Math.max(.5,Math.min(4,Number(cfg.soundRate)||4));bite.preservesPitch=true;bite.load();}
 const ctx=canvas.getContext('2d');let pos=path[0].slice(),drag=false,finished=false,timer=0,soundTimer=0,audioFade=0,soundUnlocked=false,striking=false,raf=0,keys=new Set(),last=0,closed=false,aim=pos.slice(),heldFor=0;
 function draw(){ctx.clearRect(0,0,1000,562);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle='#e8d8a844';ctx.lineWidth=radius*2;ctx.stroke();ctx.strokeStyle='#14120a99';ctx.lineWidth=radius*2-4;ctx.stroke();ctx.strokeStyle='#d8c69e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(...path.at(-1),15,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff2ca';ctx.shadowColor='#fff2ca';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(...pos,handRadius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
 function cleanup(){if(closed)return;closed=true;clearTimeout(timer);clearTimeout(soundTimer);if(bite){bite.pause();bite.removeAttribute('src');bite.load();}cancelAnimationFrame(raf);clearInterval(audioFade);d.close();d.remove();}
 function finish(result){if(closed)return;cleanup();done(result);}
 // Native media playback also works on file://; MediaElementAudioSource silences local files.
 function unlockSound(){if(!bite||closed||soundUnlocked)return;soundUnlocked=true;bite.muted=true;const pending=bite.play();if(pending)pending.then(()=>{if(closed||striking)return;bite.pause();bite.currentTime=0;bite.muted=false;}).catch(()=>{soundUnlocked=false;bite.muted=false;});}
 function hiss(reveal){
  if(!sound||!bite){reveal();return;}
  striking=true;let revealed=false;
  const show=()=>{if(closed||revealed)return;revealed=true;clearTimeout(soundTimer);reveal();};
  bite.muted=false;bite.volume=Math.max(0,Math.min(1,cfg.soundVolume==null?1:Number(cfg.soundVolume)));bite.currentTime=0;
  bite.playbackRate=Math.max(.5,Math.min(4,Number(cfg.soundRate)||4));
  const gain=bite.volume;
  // Start the lunge only once native audio is playing, not on an unrelated delay.
  soundTimer=setTimeout(show,500);
  bite.play().then(()=>{
   if(closed)return;show();
   audioFade=setInterval(()=>{const remaining=(bite.duration-bite.currentTime)/bite.playbackRate;
    bite.volume=gain*Math.max(0,Math.min(1,remaining/.12));
    if(bite.ended){clearInterval(audioFade);}
   },16);
  }).catch(()=>{show();instruction.textContent=t('Назад! Звук не воспроизвёлся — проверьте файл звука в настройках мини-игры.','Назад! Звук не відтворився — перевірте звуковий файл у налаштуваннях мінігри.');});
 }
 function drift(seconds){const ramp=Math.min(1,seconds/.8);return [(5*Math.sin(seconds*1.6)+2*Math.sin(seconds*5))*ramp,(5*Math.sin(seconds*1.1)+2*Math.sin(seconds*4.1))*ramp];}

 function move(p){if(finished||closed)return;if(!segmentSafe(pos,p)){finished=true;drag=false;keys.clear();hiss(()=>{d.classList.add('is-striking');showBiteEffect();const snake=strike;snake.alt='';snake.className='zg-snake-strike';stage.append(snake);instruction.textContent=t('Назад!','Назад!');timer=setTimeout(()=>finish('failed'),1100);});return;}pos=p;draw();if(Math.hypot(pos[0]-path.at(-1)[0],pos[1]-path.at(-1)[1])<15){finished=true;timer=setTimeout(()=>finish('success'),250);}}
 function point(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width*1000,(e.clientY-r.top)/r.height*562];}
 canvas.onpointerdown=e=>{if(finished||Math.hypot(point(e)[0]-pos[0],point(e)[1]-pos[1])>30)return;e.preventDefault();unlockSound();aim=pos.slice();heldFor=0;drag=true;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){aim=point(e);const d=drift(heldFor);move([aim[0]+d[0],aim[1]+d[1]]);}};canvas.onpointerup=canvas.onpointercancel=()=>{drag=false;};
 d.onkeydown=e=>{e.stopPropagation();if(e.key.startsWith('Arrow')){e.preventDefault();unlockSound();if(!keys.size){aim=pos.slice();heldFor=0;}keys.add(e.key);}};d.onkeyup=e=>{e.stopPropagation();keys.delete(e.key);};canvas.onblur=()=>keys.clear();
 function tick(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if((drag||keys.size)&&!finished){heldFor+=dt;if(keys.size){aim[0]+=((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*75*dt;aim[1]+=((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*75*dt;}const d=drift(heldFor);move([aim[0]+d[0],aim[1]+d[1]]);}if(!closed)raf=requestAnimationFrame(tick);}

 exit.onclick=()=>{if(!finished)finish('aborted');};d.oncancel=e=>{e.preventDefault();if(!finished)finish('aborted');};draw();raf=requestAnimationFrame(tick);return cleanup;
}
function edit(data,save,host){const cfg=data.minigames?.snakeReach||{};function field(label,key,type){const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.type=type||'text';if(type==='checkbox')i.checked=!!cfg[key];else i.value=cfg[key]??'';i.onchange=()=>save(p=>{p.minigames=p.minigames||{};p.minigames.snakeReach=Object.assign({},p.minigames.snakeReach,{[key]:type==='checkbox'?i.checked:type==='number'?Number(i.value):i.value});});l.append(i);host.append(l);return i;}field(t('Включить','Увімкнути'),'enabled','checkbox');[['startNodeId','Диалог запуска','Діалог запуску'],['successNodeId','Диалог успеха','Діалог успіху'],['failureNodeId','Диалог неудачи','Діалог невдачі']].forEach(p=>field(t(p[1],p[2]),p[0]));const audio=field(t('Звук броска змеи','Звук кидка змії'),'sound');audio.value=cfg.sound||'assets/stories/audio/esteros/snake-bite-01-tight.wav';if(w.ZargotaStoryAssets)w.ZargotaStoryAssets.attach(audio,'audio');const volume=field(t('Громкость звука · 0–1','Гучність звуку · 0–1'),'soundVolume','number');volume.min=0;volume.max=1;volume.step=.1;volume.value=cfg.soundVolume??1;const rate=field(t('Ускорение звука · 0,5–4','Прискорення звуку · 0,5–4'),'soundRate','number');rate.min=.5;rate.max=4;rate.step=.25;rate.value=cfg.soundRate||4;}
w.ZargotaSnakeReach={open,safe,segmentSafe,path,handRadius,fadeBiteEffect,stopBiteEffect};w.ZargotaMinigames.register({id:'snakeReach',name:'Змеиная кладка',nameUk:'Зміїна кладка',description:'Осторожно провести руку под корнем.',descriptionUk:'Обережно провести руку під корінням.',edit});
})(window);
