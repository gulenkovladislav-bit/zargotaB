(function(w){
 'use strict';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 function open(map,toolbar,scene,zone,save){
  const width=(scene.boardWidth||24)*(scene.gridSize||64),height=(scene.boardHeight||16)*(scene.gridSize||64),scale=Math.min(1,2048/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:100;touch-action:none;cursor:crosshair;opacity:.55;filter:drop-shadow(0 0 1px #44ffe4)';map.appendChild(canvas);
  const ctx=canvas.getContext('2d'),tools=document.createElement('div');tools.className='zg-occlusion-brush-tools';toolbar.appendChild(tools);let erase=false,drawing=false,last=null,closed=false,ready=!zone?.occlusionBitmap;const undo=[];
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;tools.appendChild(b);return b;}
  function close(){closed=true;canvas.remove();tools.remove();}
  const mode=button(t('Кисть','Пензель'),()=>{erase=!erase;mode.textContent=erase?t('Ластик','Гумка'):t('Кисть','Пензель');mode.setAttribute('aria-pressed',String(erase));});
  const size=document.createElement('input');size.type='range';size.min=2;size.max=160;size.value=24;size.setAttribute('aria-label',t('Размер кисти','Розмір пензля'));const label=document.createElement('span');function sizeLabel(){label.textContent=size.value+' px';}size.oninput=sizeLabel;sizeLabel();tools.append(size,label);
  const back=button(t('↶ Мазок','↶ Мазок'),()=>{if(drawing||!undo.length)return;ctx.putImageData(undo.pop(),0,0);back.disabled=!undo.length;});back.disabled=true;
  const accept=button(t('✓ Сохранить маску','✓ Зберегти маску'),()=>{if(!ready||drawing)return;const bitmap=canvas.toDataURL('image/png').split(',')[1];close();save({format:'png',width:canvas.width,height:canvas.height,data:bitmap});});accept.disabled=!ready;
  button(t('Отмена','Скасувати'),close);
  if(!ready){const img=new Image();img.onload=()=>{if(closed)return;ctx.drawImage(img,0,0,canvas.width,canvas.height);ready=true;accept.disabled=false;};img.onerror=()=>{if(closed)return;w.showToast?.(t('Не удалось открыть маску','Не вдалося відкрити маску'));close();};img.src='data:image/png;base64,'+zone.occlusionBitmap.data;}
  function position(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))];}
  function stroke(p){ctx.globalCompositeOperation=erase?'destination-out':'source-over';ctx.strokeStyle=ctx.fillStyle='white';ctx.lineWidth=Number(size.value)*scale;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();if(last){ctx.moveTo(...last);ctx.lineTo(...p);ctx.stroke();}else{ctx.arc(p[0],p[1],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}last=p;}
  canvas.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(!ready||drawing||e.button!==0)return;undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(undo.length>8)undo.shift();back.disabled=false;drawing=true;last=null;canvas.setPointerCapture(e.pointerId);stroke(position(e));};
  canvas.onpointermove=e=>{if(!drawing)return;e.preventDefault();stroke(position(e));};
  function end(){drawing=false;last=null;}canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;canvas.onclick=e=>e.stopPropagation();
  return close;
 }
 w.ZargotaOcclusionBrush={open};
})(window);
