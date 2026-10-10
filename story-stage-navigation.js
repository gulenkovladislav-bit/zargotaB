(function(w){
 'use strict';
 const views=new Map(),t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 function zoomAt(state,next,x,y){next=Math.max(1,Math.min(6,next));const ratio=next/state.zoom;return {zoom:next,x:x-(x-state.x)*ratio,y:y-(y-state.y)*ratio};}
 function mount(surround,viewport,key){
  let state=views.get(key)||{zoom:1,x:0,y:0},drag=null,hand=false,suppressClick=false;
  surround.style.position='relative';surround.style.overflow='hidden';viewport.style.transformOrigin='center';
  const tools=document.createElement('div');tools.className='zg-stage-editor-navigation';tools.style.cssText='position:absolute;left:10px;top:10px;z-index:1000;display:flex;flex-direction:column;gap:4px;padding:5px;width:38px;box-sizing:border-box;font-size:10px;border:1px solid #a48a51;border-radius:12px;background:#14271ef2;color:#ecd7a1';surround.appendChild(tools);
  const range=document.createElement('input');range.type='range';range.min=100;range.max=600;range.step=10;range.style.cssText='writing-mode:vertical-lr;direction:rtl;height:110px;width:8px;accent-color:#d1b46a;align-self:center';range.setAttribute('aria-label',t('Масштаб редактора','Масштаб редактора'));const label=document.createElement('output');
  function apply(){viewport.style.transform='translate('+state.x+'px,'+state.y+'px) scale('+state.zoom+')';views.set(key,state);range.value=Math.round(state.zoom*100);label.textContent=Math.round(state.zoom*100)+'%';}
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.style.cssText='background:#263d2e;color:#ecd7a1;border:1px solid #a48a51;border-radius:8px;padding:3px;width:26px;height:26px;min-width:0;min-height:0;font:14px sans-serif;cursor:pointer';b.onclick=fn;tools.appendChild(b);return b;}
  tools.append(label,range);range.oninput=()=>{state=zoomAt(state,Number(range.value)/100,0,0);apply();};
  const pan=button('✋',()=>{hand=!hand;pan.setAttribute('aria-pressed',String(hand));viewport.style.cursor=hand?'grab':'';});pan.title=t('Перемещать сцену','Переміщувати сцену');pan.setAttribute('aria-label',pan.title);pan.setAttribute('aria-pressed','false');button('↺',()=>{state={zoom:1,x:0,y:0};apply();}).setAttribute('aria-label',t('Сбросить вид редактора','Скинути вигляд редактора'));tools.title=t('Колесо — масштаб. Средняя кнопка или Alt + перетаскивание — перемещение.','Колесо — масштаб. Середня кнопка або Alt + перетягування — переміщення.');
  surround.addEventListener('wheel',e=>{if(tools.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();const r=surround.getBoundingClientRect();state=zoomAt(state,state.zoom*Math.exp(-e.deltaY*.0015),e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);apply();},{capture:true,passive:false});
  surround.addEventListener('pointerdown',e=>{if(tools.contains(e.target)||!(e.button===1||e.button===0&&(e.altKey||hand)))return;e.preventDefault();e.stopImmediatePropagation();drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:state.x,oy:state.y};suppressClick=true;surround.setPointerCapture(e.pointerId);},true);
  surround.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();state={zoom:state.zoom,x:drag.ox+e.clientX-drag.x,y:drag.oy+e.clientY-drag.y};apply();},true);
  function end(e){if(!drag||drag.id!==e.pointerId)return;e.stopImmediatePropagation();drag=null;if(surround.hasPointerCapture(e.pointerId))surround.releasePointerCapture(e.pointerId);setTimeout(()=>{suppressClick=false;},0);}
  surround.addEventListener('pointerup',end,true);surround.addEventListener('pointercancel',end,true);surround.addEventListener('click',e=>{if(suppressClick&&!tools.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
  apply();
 }
 w.ZargotaStageNavigation={mount,zoomAt};
})(window);
