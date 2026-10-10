(function(w){
 'use strict';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 function create(settings,soundEnabled){
  if(settings?.prop!=='gear')return null;
  const button=document.createElement('button'),art=document.createElement('img'),label=document.createElement('span');
  button.type='button';button.className='zg-card-workbench-prop';button.setAttribute('aria-label',t('Покрутить механизм','Покрутити механізм'));
  art.src=settings.propImage||'assets/stories/Evan/university/cards/cog-v1.png';art.alt='';art.draggable=false;label.setAttribute('aria-live','polite');
  button.append(art,label);
  let closed=false,busy=false,animation=null,endTimer=0,sound=null,audioTimers=[],audioFailed=false;
  const duration=Math.max(300,Math.min(6000,Number(settings.durationMs)||1800));
  function caption(){label.textContent=busy?t('Трещит и крутится…','Тріщить і крутиться…'):t('Покрутить механизм','Покрутити механізм');}
  function stopAudio(){audioTimers.forEach(clearTimeout);audioTimers=[];if(sound){sound.pause();sound.removeAttribute('src');sound.load();sound=null;}}
  function clickSound(){
   if(closed||!soundEnabled())return;
   if(!sound){sound=new Audio(settings.propSound||'assets/stories/cards/tower-claw/audio/candidates/interface/click_001.mp3');sound.volume=Math.max(0,Math.min(1,settings.volume==null?.4:Number(settings.volume)||0));}
   try{sound.currentTime=0;const play=sound.play();play?.catch(()=>{if(!closed)audioFailed=true;});}catch(e){audioFailed=true;}
  }
  button.onclick=function(){
   if(closed||busy)return;busy=true;audioFailed=false;button.setAttribute('aria-busy','true');caption();
   const reduced=!!w.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   if(art.animate)animation=art.animate(reduced?[{opacity:1},{opacity:.65},{opacity:1}]:[{transform:'rotate(0deg)'},{transform:'rotate(720deg)'}],{duration:reduced?180:duration,easing:'cubic-bezier(.12,.65,.3,1)'});
   clickSound();[.09,.2,.34,.52,.74].forEach(f=>audioTimers.push(setTimeout(clickSound,duration*f)));
   endTimer=setTimeout(()=>{busy=false;button.setAttribute('aria-busy','false');stopAudio();caption();if(audioFailed)label.textContent=t('Звук не загрузился','Звук не завантажився');},duration);
  };
  caption();
  return {element:button,stopAudio,dispose(){if(closed)return;closed=true;clearTimeout(endTimer);stopAudio();animation?.cancel();button.onclick=null;button.remove();}};
 }
 w.ZargotaCardTableProp={create};
})(window);
