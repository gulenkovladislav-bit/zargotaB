"""Extract the approved animation math; keep prototype controls out of the game."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
source=(root/'output/esteros-hud-particle-test-v1/preview.html').read_text()
def between(a,b): return source[source.index(a):source.index(b,source.index(a))]
art=between('function art(', '\nlet value=')
art=art.replace("'../esteros-hud-base-v1/'", "ASSETS")
assembly=between('function makeAssembly()', '// Reveal follows')
animation=between('function flightArrival(', '\npause.onclick=')
animation=animation.replace('change(value+award.dir)', 'change(outcome.to)')
animation=animation.replace("award=null;overlay.style.opacity=0;fg.setTransform(1,0,0,1,0,0);fg.clearRect(0,0,fx.width,fx.height);labels()", "complete()")
dust=between("document.querySelectorAll('.flame').forEach", '\n\nconst sync=')
dust=dust.replace('document.querySelectorAll', 'scene.querySelectorAll')
intro=r'''(function(w){
 'use strict';
 const ASSETS='assets/stories/ui/esteros-resolve/';
 const boxes={socket:[161,167,1092,1080],fatalism:[148,106,1142,1149],hope:[399,88,892,1190]};
 ART
 function play(host,outcome,config,sound,done){
  const scene=document.createElement('div');scene.className='zg-esteros-resolve';scene.setAttribute('aria-live','polite');
  scene.innerHTML='<div class="hud"><div class="emblem"><div class="art" data-art="fatalism"></div><div class="label fatal"></div></div><div class="slots"></div><div class="emblem"><div class="art" data-art="hope"></div><div class="label hope"></div></div></div><div class="award"><div class="art"></div><strong></strong></div><canvas class="fx"></canvas>';
  host.append(scene);
  const hud=scene.querySelector('.hud'),slots=scene.querySelector('.slots'),overlay=scene.querySelector('.award'),fx=scene.querySelector('.fx'),fg=fx.getContext('2d');
  const language=w.ZargotaI18n?.getLocale()==='uk'?'uk':'ru',words={ru:['','','','','Фатализм','Надежда'],uk:['','','','','Фаталізм','Надія']};
  scene.querySelector('.fatal').textContent=words[language][4];scene.querySelector('.hope').textContent=words[language][5];
  const cells=[];let value=outcome.from,raf=0,last=performance.now(),stopped=false,scrubbing=false;
  let award={dir:outcome.direction,t:0,index:outcome.direction>0?5-value:6-value,committed:false,audio:false,base:value};
  award.index=Math.max(0,Math.min(5,award.index));
  const hitTime=Number(config.hitTime)||4.27,bow=new Audio(ASSETS+'hope-bow.mp3');bow.preload='auto';bow.volume=.7;bow.playbackRate=award.dir>0?1:.94;bow.preservesPitch=false;
  for(let i=0;i<6;i++){const el=document.createElement('div');el.className='slot';el.style.setProperty('--delay',(-i*.73)+'s');el.innerHTML='<div class="flames"><div class="flame fatal-flame"><img src="'+ASSETS+'flame-fatalism.png"></div><div class="flame hope-flame"><img src="'+ASSETS+'flame-hope.png"></div></div><div class="art"></div>';slots.append(el);art(el.lastChild,'socket');cells.push({el});}
  scene.querySelectorAll('[data-art]').forEach(el=>art(el,el.dataset.art));
  function change(n){value=n;cells.forEach((c,i)=>c.el.dataset.hope=String(i>=6-value?1:0));}
  function labels(){}
  change(value);art(overlay.querySelector('.art'),award.dir>0?'hope':'fatalism');overlay.dataset.tone=outcome.type;overlay.querySelector('strong').textContent=words[language][award.dir>0?5:4];overlay.style.color=award.dir>0?'#f0e3c5':'#800020';
  DUST
  ASSEMBLY
  ANIMATION
  function fit(){hud.style.setProperty('--resolve-scale',String(Math.min(1.5,Math.max(.6,scene.clientWidth/1100))));}
  function complete(){if(stopped)return;cleanup();done();}
  function cleanup(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);bow.pause();bow.removeAttribute('src');bow.load();document.removeEventListener('visibilitychange',visibility);w.removeEventListener('resize',fit);scene.remove();}
  function tick(now){raf=0;if(stopped||document.hidden)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;updateAward(dt);if(!stopped)raf=requestAnimationFrame(tick);}
  function wake(){last=performance.now();if(!raf&&!stopped&&!document.hidden)raf=requestAnimationFrame(tick);}
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;scene.classList.add('paused');bow.pause();}else{scene.classList.remove('paused');if(award?.audio&&!bow.ended)bow.play().catch(()=>{award.audio=false;award.t=bow.currentTime;});wake();}}
  document.addEventListener('visibilitychange',visibility);w.addEventListener('resize',fit);fit();
  if(sound){bow.play().then(()=>{if(stopped)return;award.audio=true;wake();}).catch(wake);}
  wake();return cleanup;
 }
 w.ZargotaEsterosResolve={play};
})(window);
'''
runtime=intro.replace(' ART', '\n'+art).replace('  DUST',dust).replace('  ASSEMBLY',assembly).replace('  ANIMATION',animation)
(root/'story-esteros-resolve.js').write_text(runtime)
