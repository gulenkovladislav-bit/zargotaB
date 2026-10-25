(function(w){
 'use strict';
 const ASSETS='assets/stories/ui/esteros-resolve/';
 const boxes={socket:[161,167,1092,1080],fatalism:[148,106,1142,1149],hope:[399,88,892,1190]};

function art(el,name){const [x,y,r,b]=boxes[name],h=b-y;const im=new Image();im.src=ASSETS+name+'.png';im.style.cssText=`height:${1254/h*100}%;left:calc(50% - ${(x+(r-x)/2)/h*100}%);top:${-y/h*100}%`;el.append(im)}
 function play(host,outcome,config,sound,done){
  w.ZargotaSnakeReach?.fadeBiteEffect();
  const scene=document.createElement('div');scene.className='zg-esteros-resolve';scene.setAttribute('aria-live','polite');
  scene.innerHTML='<div class="resolve-edge resolve-edge-neutral" aria-hidden="true"></div><div class="resolve-edge resolve-edge-choice" aria-hidden="true"></div><div class="hud"><div class="emblem"><div class="art" data-art="fatalism"></div><div class="label fatal"></div></div><div class="slots"></div><div class="emblem"><div class="art" data-art="hope"></div><div class="label hope"></div></div></div><div class="award"><div class="art"></div><strong></strong></div><canvas class="fx"></canvas>';
  host.append(scene);
  const previousFocus=host.style.getPropertyValue('--resolve-ui-opacity'),previousPriority=host.style.getPropertyPriority('--resolve-ui-opacity'),hadFocus=host.classList.contains('is-resolve-focus');
  host.classList.add('is-resolve-focus');
  const hiddenUi=Array.from(host.querySelectorAll('.zg-story-quest,.zg-story-play-tools,.zg-story-health,.zg-story-dialogue,.zg-story-play-hint')).map(el=>({el,inert:el.inert}));
  hiddenUi.forEach(({el})=>{el.inert=true;});
  const neutralEdge=scene.querySelector('.resolve-edge-neutral'),choiceEdge=scene.querySelector('.resolve-edge-choice');
  choiceEdge.style.setProperty('--resolve-edge-color',outcome.direction>0?'245,225,180':'125,23,30');
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  function focus(t,arrival){
   const strength=smooth(t/1.5)*(1-smooth((t-arrival-.25)/.9));
   const choice=smooth((t-hitTime)/.45);
   neutralEdge.style.opacity=String(strength*(1-choice));
   choiceEdge.style.opacity=String(strength*choice);
   host.style.setProperty('--resolve-ui-opacity',String(1-strength));
  }
  const hud=scene.querySelector('.hud'),slots=scene.querySelector('.slots'),overlay=scene.querySelector('.award'),fx=scene.querySelector('.fx'),fg=fx.getContext('2d');
  const language=w.ZargotaI18n?.getLocale()==='uk'?'uk':'ru',words={ru:['','','','','Фатализм','Надежда'],uk:['','','','','Фаталізм','Надія']};
  scene.querySelector('.fatal').textContent=words[language][4];scene.querySelector('.hope').textContent=words[language][5];
  const cells=[];let value=outcome.from,raf=0,last=performance.now(),stopped=false,scrubbing=false;
  let award={dir:outcome.direction,t:0,index:outcome.direction>0?5-value:6-value,committed:false,audio:false,base:value};
  award.index=Math.max(0,Math.min(5,award.index));
  const hitTime=Number(config.hitTime)||4.27,bow=new Audio(ASSETS+'hope-bow.mp3');bow.preload='auto';bow.volume=0;bow.playbackRate=award.dir>0?1:.94;bow.preservesPitch=false;
  for(let i=0;i<6;i++){const el=document.createElement('div');el.className='slot';el.style.setProperty('--delay',(-i*.73)+'s');el.innerHTML='<div class="flames"><div class="flame fatal-flame"><img src="'+ASSETS+'flame-fatalism.png"></div><div class="flame hope-flame"><img src="'+ASSETS+'flame-hope.png"></div></div><div class="art"></div>';slots.append(el);art(el.lastChild,'socket');cells.push({el});}
  scene.querySelectorAll('[data-art]').forEach(el=>art(el,el.dataset.art));
  function change(n){value=n;cells.forEach((c,i)=>c.el.dataset.hope=String(i>=6-value?1:0));}
  function labels(){}
  change(value);art(overlay.querySelector('.art'),award.dir>0?'hope':'fatalism');overlay.dataset.tone=outcome.type;overlay.querySelector('strong').textContent=words[language][award.dir>0?5:4];overlay.style.color=award.dir>0?'#f0e3c5':'#800020';
scene.querySelectorAll('.flame').forEach((el,index)=>{const c=document.createElement('canvas');c.width=c.height=128;c.className='dust';const g=c.getContext('2d');const col=el.classList.contains('hope-flame')?'245,225,182':'143,27,36';const grad=g.createRadialGradient(64,70,0,64,64,63);grad.addColorStop(0,`rgba(${col},.32)`);grad.addColorStop(1,`rgba(${col},0)`);g.fillStyle=grad;g.fillRect(0,0,128,128);for(let j=0;j<48;j++){const a=j*2.399+index*.7,rad=8+(j*13%46),x=64+Math.cos(a)*rad,y=64+Math.sin(a)*rad*.85;g.fillStyle=`rgba(${col},${.22+(j%5)*.09})`;g.beginPath();g.arc(x,y,j%7===0?1.1:.55,0,Math.PI*2);g.fill()}el.prepend(c)});
function makeAssembly(){
 const mask=document.createElement('canvas');mask.width=360;mask.height=220;const m=mask.getContext('2d',{willReadFrequently:true});
 m.fillStyle='#fff';m.font='30px Georgia';m.textAlign='center';m.fillText(words[language][award.dir>0?5:4],180,175);
 const data=m.getImageData(0,0,360,220).data;const pts=[];for(let y=0;y<220;y+=4)for(let x=0;x<360;x+=4)if(data[(y*360+x)*4+3]>75)pts.push({x:x-180,y:y-110});
 pts.push(...{"hope": [{"x": 3.39, "y": -86}, {"x": 3.39, "y": -82}, {"x": 7.39, "y": -82}, {"x": 7.39, "y": -78}, {"x": 7.39, "y": -74}, {"x": 7.39, "y": -70}, {"x": 11.39, "y": -70}, {"x": 3.39, "y": -66}, {"x": 7.39, "y": -66}, {"x": 11.39, "y": -66}, {"x": 3.39, "y": -62}, {"x": 7.39, "y": -62}, {"x": 11.39, "y": -62}, {"x": -0.61, "y": -58}, {"x": 3.39, "y": -58}, {"x": 7.39, "y": -58}, {"x": 11.39, "y": -58}, {"x": -0.61, "y": -54}, {"x": 3.39, "y": -54}, {"x": 7.39, "y": -54}, {"x": 11.39, "y": -54}, {"x": -4.61, "y": -50}, {"x": -0.61, "y": -50}, {"x": 3.39, "y": -50}, {"x": 11.39, "y": -50}, {"x": -8.61, "y": -46}, {"x": -4.61, "y": -46}, {"x": -0.61, "y": -46}, {"x": 3.39, "y": -46}, {"x": -12.61, "y": -42}, {"x": -8.61, "y": -42}, {"x": -4.61, "y": -42}, {"x": -0.61, "y": -42}, {"x": 3.39, "y": -42}, {"x": 7.39, "y": -42}, {"x": -16.61, "y": -38}, {"x": -12.61, "y": -38}, {"x": -8.61, "y": -38}, {"x": -4.61, "y": -38}, {"x": -0.61, "y": -38}, {"x": -16.61, "y": -34}, {"x": -8.61, "y": -34}, {"x": -4.61, "y": -34}, {"x": -0.61, "y": -34}, {"x": 3.39, "y": -34}, {"x": 15.39, "y": -34}, {"x": -20.61, "y": -30}, {"x": -16.61, "y": -30}, {"x": -12.61, "y": -30}, {"x": -8.61, "y": -30}, {"x": -4.61, "y": -30}, {"x": -0.61, "y": -30}, {"x": 15.39, "y": -30}, {"x": 19.39, "y": -30}, {"x": -20.61, "y": -26}, {"x": -12.61, "y": -26}, {"x": -8.61, "y": -26}, {"x": -4.61, "y": -26}, {"x": 15.39, "y": -26}, {"x": 19.39, "y": -26}, {"x": -20.61, "y": -22}, {"x": -16.61, "y": -22}, {"x": -12.61, "y": -22}, {"x": -8.61, "y": -22}, {"x": -4.61, "y": -22}, {"x": 15.39, "y": -22}, {"x": 19.39, "y": -22}, {"x": 23.39, "y": -22}, {"x": -24.61, "y": -18}, {"x": -20.61, "y": -18}, {"x": -16.61, "y": -18}, {"x": -12.61, "y": -18}, {"x": -8.61, "y": -18}, {"x": 11.39, "y": -18}, {"x": 15.39, "y": -18}, {"x": 19.39, "y": -18}, {"x": 23.39, "y": -18}, {"x": -24.61, "y": -14}, {"x": -20.61, "y": -14}, {"x": -16.61, "y": -14}, {"x": -12.61, "y": -14}, {"x": 7.39, "y": -14}, {"x": 11.39, "y": -14}, {"x": 15.39, "y": -14}, {"x": 19.39, "y": -14}, {"x": 23.39, "y": -14}, {"x": -20.61, "y": -10}, {"x": -16.61, "y": -10}, {"x": -12.61, "y": -10}, {"x": 3.39, "y": -10}, {"x": 7.39, "y": -10}, {"x": 11.39, "y": -10}, {"x": 15.39, "y": -10}, {"x": 23.39, "y": -10}, {"x": -20.61, "y": -6}, {"x": -16.61, "y": -6}, {"x": -12.61, "y": -6}, {"x": -0.61, "y": -6}, {"x": 3.39, "y": -6}, {"x": 7.39, "y": -6}, {"x": 11.39, "y": -6}, {"x": 15.39, "y": -6}, {"x": 19.39, "y": -6}, {"x": -20.61, "y": -2}, {"x": -16.61, "y": -2}, {"x": -12.61, "y": -2}, {"x": -0.61, "y": -2}, {"x": 7.39, "y": -2}, {"x": 11.39, "y": -2}, {"x": 15.39, "y": -2}, {"x": 19.39, "y": -2}, {"x": -16.61, "y": 2}, {"x": -12.61, "y": 2}, {"x": -0.61, "y": 2}, {"x": 3.39, "y": 2}, {"x": 7.39, "y": 2}, {"x": 11.39, "y": 2}, {"x": 15.39, "y": 2}, {"x": -12.61, "y": 6}, {"x": -0.61, "y": 6}, {"x": 3.39, "y": 6}, {"x": 7.39, "y": 6}, {"x": 11.39, "y": 6}, {"x": -8.61, "y": 10}, {"x": -0.61, "y": 10}, {"x": 3.39, "y": 10}, {"x": -0.61, "y": 14}, {"x": 3.39, "y": 14}], "fatalism": [{"x": -0.42, "y": -86}, {"x": 3.58, "y": -86}, {"x": 7.58, "y": -86}, {"x": -16.42, "y": -82}, {"x": -12.42, "y": -82}, {"x": -8.42, "y": -82}, {"x": -4.42, "y": -82}, {"x": -20.42, "y": -78}, {"x": -16.42, "y": -78}, {"x": -12.42, "y": -78}, {"x": -8.42, "y": -78}, {"x": -32.42, "y": -74}, {"x": -24.42, "y": -74}, {"x": -20.42, "y": -74}, {"x": -16.42, "y": -74}, {"x": 23.58, "y": -74}, {"x": 27.58, "y": -74}, {"x": 31.58, "y": -74}, {"x": -36.42, "y": -70}, {"x": -32.42, "y": -70}, {"x": -28.42, "y": -70}, {"x": -24.42, "y": -70}, {"x": -20.42, "y": -70}, {"x": 27.58, "y": -70}, {"x": -40.42, "y": -66}, {"x": -36.42, "y": -66}, {"x": -32.42, "y": -66}, {"x": -28.42, "y": -66}, {"x": -24.42, "y": -66}, {"x": 35.58, "y": -66}, {"x": -40.42, "y": -62}, {"x": -36.42, "y": -62}, {"x": -32.42, "y": -62}, {"x": -28.42, "y": -62}, {"x": -24.42, "y": -62}, {"x": 35.58, "y": -62}, {"x": 39.58, "y": -62}, {"x": -44.42, "y": -58}, {"x": -40.42, "y": -58}, {"x": -36.42, "y": -58}, {"x": -32.42, "y": -58}, {"x": -28.42, "y": -58}, {"x": -24.42, "y": -58}, {"x": 35.58, "y": -58}, {"x": 39.58, "y": -58}, {"x": 43.58, "y": -58}, {"x": -44.42, "y": -54}, {"x": -40.42, "y": -54}, {"x": -36.42, "y": -54}, {"x": -32.42, "y": -54}, {"x": -28.42, "y": -54}, {"x": 39.58, "y": -54}, {"x": 43.58, "y": -54}, {"x": -48.42, "y": -50}, {"x": -44.42, "y": -50}, {"x": -40.42, "y": -50}, {"x": -36.42, "y": -50}, {"x": -32.42, "y": -50}, {"x": 43.58, "y": -50}, {"x": 47.58, "y": -50}, {"x": -48.42, "y": -46}, {"x": -44.42, "y": -46}, {"x": -40.42, "y": -46}, {"x": -36.42, "y": -46}, {"x": 43.58, "y": -46}, {"x": 47.58, "y": -46}, {"x": -48.42, "y": -42}, {"x": -44.42, "y": -42}, {"x": -40.42, "y": -42}, {"x": 47.58, "y": -42}, {"x": -48.42, "y": -38}, {"x": -44.42, "y": -38}, {"x": -40.42, "y": -38}, {"x": -52.42, "y": -34}, {"x": -48.42, "y": -34}, {"x": -44.42, "y": -34}, {"x": -40.42, "y": -34}, {"x": -48.42, "y": -30}, {"x": -44.42, "y": -30}, {"x": -40.42, "y": -30}, {"x": -48.42, "y": -26}, {"x": -44.42, "y": -26}, {"x": -40.42, "y": -26}, {"x": 47.58, "y": -26}, {"x": -48.42, "y": -22}, {"x": -44.42, "y": -22}, {"x": -40.42, "y": -22}, {"x": 47.58, "y": -22}, {"x": -48.42, "y": -18}, {"x": -44.42, "y": -18}, {"x": -40.42, "y": -18}, {"x": -36.42, "y": -18}, {"x": -32.42, "y": -18}, {"x": 43.58, "y": -18}, {"x": 47.58, "y": -18}, {"x": -44.42, "y": -14}, {"x": -40.42, "y": -14}, {"x": -36.42, "y": -14}, {"x": -32.42, "y": -14}, {"x": 43.58, "y": -14}, {"x": 47.58, "y": -14}, {"x": -44.42, "y": -10}, {"x": -36.42, "y": -10}, {"x": -32.42, "y": -10}, {"x": 39.58, "y": -10}, {"x": 43.58, "y": -10}, {"x": -36.42, "y": -6}, {"x": -32.42, "y": -6}, {"x": -28.42, "y": -6}, {"x": 35.58, "y": -6}, {"x": 39.58, "y": -6}, {"x": 43.58, "y": -6}, {"x": -36.42, "y": -2}, {"x": -32.42, "y": -2}, {"x": -28.42, "y": -2}, {"x": 27.58, "y": -2}, {"x": 31.58, "y": -2}, {"x": 35.58, "y": -2}, {"x": 39.58, "y": -2}, {"x": -32.42, "y": 2}, {"x": -28.42, "y": 2}, {"x": -24.42, "y": 2}, {"x": 23.58, "y": 2}, {"x": 27.58, "y": 2}, {"x": 31.58, "y": 2}, {"x": 35.58, "y": 2}, {"x": -24.42, "y": 6}, {"x": -20.42, "y": 6}, {"x": 19.58, "y": 6}, {"x": 23.58, "y": 6}, {"x": 27.58, "y": 6}, {"x": 31.58, "y": 6}, {"x": -16.42, "y": 10}, {"x": -12.42, "y": 10}, {"x": 3.58, "y": 10}, {"x": 7.58, "y": 10}, {"x": 11.58, "y": 10}, {"x": 15.58, "y": 10}, {"x": 19.58, "y": 10}, {"x": 23.58, "y": 10}, {"x": 27.58, "y": 10}, {"x": -12.42, "y": 14}, {"x": -8.42, "y": 14}, {"x": -4.42, "y": 14}, {"x": 7.58, "y": 14}, {"x": 11.58, "y": 14}, {"x": 15.58, "y": 14}, {"x": 19.58, "y": 14}, {"x": 3.58, "y": 18}]}[award.dir>0?'hope':'fatalism']);return pts.filter((_,i)=>i%Math.max(1,Math.ceil(pts.length/280))===0).map((p,i)=>({...p,a:i*2.399,rad:70+(i*37%150)}));
}

function flightArrival(end){const start=Math.min(hitTime+4,end-1.6);return start+(end-.8-start)/2.6}
function revealHud(t,arrival){
 const clamp=x=>Math.max(0,Math.min(1,x));
 const start=hitTime+.35;
 const opening=clamp((t-start)/1.6);
 const ease=x=>x*x*(3-2*x);
 const fade=1-ease(clamp((t-arrival-.65)/.7));
 hud.style.opacity=String(ease(clamp((t-start)/.35))*fade);
 hud.dataset.revealed=String(opening>0&&fade>0);
 const center=hud.clientWidth/2;
 hud.querySelectorAll('.emblem').forEach(el=>{
  const shift=center-(el.offsetLeft+el.offsetWidth/2);
  el.style.transform=`translateX(${shift*(1-ease(opening))}px)`;
  el.querySelector('.label').style.opacity=String(ease(clamp((opening-.55)/.45)));
 });
 cells.forEach((c,i)=>{
  const el=c.el,shift=center-(slots.offsetLeft+el.offsetLeft+el.offsetWidth/2);
  const progress=ease(clamp((opening-.16-Math.abs(i-2.5)*.075)/.55));
  el.style.translate=`${shift*(1-progress)}px 0`;
  el.style.opacity=String(progress);
 });
}
function updateAward(dt){if(!award)return;const r=scene.getBoundingClientRect();if(fx.width!==Math.round(r.width*.6)||fx.height!==Math.round(r.height*.6)){fx.width=Math.round(r.width*.6);fx.height=Math.round(r.height*.6)}
 fg.setTransform(1,0,0,1,0,0);fg.clearRect(0,0,fx.width,fx.height);fg.setTransform(.6,0,0,.6,0,0);award.t+=dt;
 const t=award.audio?bow.currentTime+((bow.ended)?award.tail||0:0):award.t;if(award.audio&&bow.ended)award.tail=(award.tail||0)+dt;const end=award.audio&&Number.isFinite(bow.duration)?bow.duration:11.7;const arrival=flightArrival(end);revealHud(t,arrival);focus(t,arrival);
 if(award.audio){const remaining=Math.max(0,(end-bow.currentTime)/bow.playbackRate);bow.volume=.525*smooth(bow.currentTime/1.5)*smooth(remaining);}
 if(!award.points)award.points=makeAssembly();
 const cx=r.width*.5,cy=r.height*.42;
 const target=slots.children[award.index].getBoundingClientRect();const ex=target.x+target.width/2-r.x,ey=target.y+target.height/2-r.y;
 const flightStart=Math.min(hitTime+4,end-1.6);
 const particleStart=.25;
 const gathering=Math.max(0,Math.min(1,(t-particleStart)/Math.max(.1,hitTime-particleStart)));
 const pull=.12*gathering+.88*Math.pow(gathering,2.6);
 const snap=Math.max(0,Math.min(1,(t-hitTime)/.10));
 const formation=t<hitTime?.62*pull:.62+.38*(1-Math.pow(1-snap,3));const flight=Math.max(0,Math.min(1,(t-flightStart)/Math.max(.25,arrival-flightStart)));
 const vis=t<hitTime?0:t<hitTime+.10?snap:t<=flightStart?1:Math.max(0,1-flight*3);
 overlay.style.opacity=vis;
 const breathTime=Math.max(0,t-hitTime);
 const breath=.5-.5*Math.cos(breathTime*Math.PI*2/1.8);
 const onset=Math.exp(-breathTime*9)*.3;
 overlay.style.setProperty('--aura-color',award.dir>0?'245,225,180':'125,23,30');
 overlay.style.setProperty('--aura-opacity',String(.45+.35*breath+onset));
 overlay.style.setProperty('--aura-scale',String(.94+.14*breath));
 // One damped impulse on the audio timeline, shared by icon and label.
 const strike=t-hitTime;const impulse=strike>=0&&strike<.9?Math.pow(1-strike/.9,2):0;
 const shakeX=Math.sin(strike*38)*4*impulse,shakeY=Math.cos(strike*31)*2*impulse;
 overlay.style.transform=`translate(-50%,-50%) translate(${shakeX}px,${shakeY}px)`;
 const color=award.dir>0?'245,225,180':'165,40,46';
 if(t>=particleStart&&t<arrival){for(let i=0;i<award.points.length;i++){const p=award.points[i];let x,y,alpha;
 if(t<flightStart){
 // Slow deterministic spirals: uneven lanes, smooth drift, no rapid jitter.
 const local=Math.max(0,Math.min(t,hitTime)-particleStart);
 const seed=(Math.sin(i*127.1+3.7)*43758.5453)%1;
 const speed=.10+.07*Math.abs(seed);
 const spiralTime=local*(.35+1.65*gathering*gathering);
 const angle=p.a+spiralTime*speed+.06*Math.sin(local*.65+p.a);
 const contraction=1-.42*Math.pow(pull,1+.3*Math.abs(seed));
 const radius=p.rad*contraction;
 const driftx=Math.cos(angle)*radius,drifty=Math.sin(angle)*radius*(.48+.12*Math.abs(seed));
 const restless=t<hitTime?1:1-snap;
 const jitterX=Math.sin(local*.6+p.a)*5*restless,jitterY=Math.cos(local*.48+p.a*1.3)*4*restless;
 x=cx+driftx*(1-formation)+p.x*formation+jitterX+shakeX;y=cy+drifty*(1-formation)+p.y*formation+jitterY+shakeY;
 alpha=Math.min(1,Math.max(0,(t-particleStart)/.55))*(t>=hitTime?.65*(1-snap)+.08:.65);
 }else{const u=Math.pow(flight,1.15);x=cx+p.x*(1-u)+(ex-cx)*u+Math.sin(p.a+u*7)*24*Math.sin(Math.PI*u);y=cy+p.y*(1-u)+(ey-cy)*u-Math.sin(Math.PI*u)*65;alpha=Math.min(1,flight*8)*(1-flight*.3)}
 fg.fillStyle=`rgba(${color},${alpha})`;fg.fillRect(x,y,i%5===0?2:1.1,i%5===0?2:1.1);
 }}
 if(!scrubbing&&t>=arrival&&!award.committed){award.committed=true;change(outcome.to);const slot=slots.children[award.index];slot.classList.remove('impact');hud.classList.remove('impact');void slot.offsetWidth;slot.style.setProperty('--slot-flash',award.dir>0?'#fff5df':'#dc263e');slot.classList.add('impact');hud.style.setProperty('--impact-color',award.dir>0?'#eee0bf':'#831e28');hud.classList.add('impact')}
 if(!scrubbing&&t>=Math.max(end,arrival+1.4)){complete()}}

  function fit(){hud.style.setProperty('--resolve-scale',String(Math.min(1.5,Math.max(.6,scene.clientWidth/1100))));}
  function complete(){if(stopped)return;cleanup();done();}
  function cleanup(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);bow.pause();bow.removeAttribute('src');bow.load();document.removeEventListener('visibilitychange',visibility);w.removeEventListener('resize',fit);scene.remove();hiddenUi.forEach(({el,inert})=>{el.inert=inert;});if(!hadFocus)host.classList.remove('is-resolve-focus');if(previousFocus)host.style.setProperty('--resolve-ui-opacity',previousFocus,previousPriority);else host.style.removeProperty('--resolve-ui-opacity');}
  function tick(now){raf=0;if(stopped||document.hidden)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;updateAward(dt);if(!stopped)raf=requestAnimationFrame(tick);}
  function wake(){last=performance.now();if(!raf&&!stopped&&!document.hidden)raf=requestAnimationFrame(tick);}
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;scene.classList.add('paused');bow.pause();}else{scene.classList.remove('paused');if(award?.audio&&!bow.ended)bow.play().catch(()=>{award.audio=false;award.t=bow.currentTime;});wake();}}
  document.addEventListener('visibilitychange',visibility);w.addEventListener('resize',fit);fit();
  if(sound){bow.play().then(()=>{if(stopped)return;award.audio=true;wake();}).catch(wake);}
  wake();return cleanup;
 }
 w.ZargotaEsterosResolve={play};
})(window);
