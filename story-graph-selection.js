(function(w){
 'use strict';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 const copy=x=>JSON.parse(JSON.stringify(x));
 function install(root,api){
  const canvas=root.querySelector('.zg-story-canvas');if(!canvas)return;
  let selected=new Set(),gesture=null,space=false,suppress=false,undo=null;
  const bar=root.querySelector('.zg-board-tools')||canvas.parentElement;
  const remove=document.createElement('button'),restore=document.createElement('button'),status=document.createElement('span');
  remove.type=restore.type='button';restore.textContent=t('↶ Отменить удаление','↶ Скасувати видалення');restore.hidden=true;status.setAttribute('role','status');bar.append(remove,restore,status);
  function selectedIds(){const visible=new Set(cards().map(c=>c.dataset.nodeId));return new Set([...selected].filter(id=>visible.has(id)));}
  function removeSelected(){
   const ids=selectedIds();if(!ids.size)return;
   const before=copy(api.get());
   // Do not silently change quest completion, entry points or map interactions.
   const outside={...before};delete outside.nodes;
   function references(value){if(typeof value==='string')return ids.has(value);if(!value||typeof value!=='object')return false;return Object.values(value).some(references);}
   if(before.nodes.length<=ids.size||references(outside)){status.textContent=t('Сначала отключите выбранные блоки от старта, заданий и объектов карты. Хотя бы один блок должен остаться.','Спочатку від’єднайте вибрані блоки від старту, завдань та об’єктів карти. Хоча б один блок має залишитися.');return;}
   if(!w.confirm(t('Удалить блоки: ','Видалити блоки: ')+ids.size+t('? Связи с ними тоже будут удалены.','? Зв’язки з ними також буде видалено.')))return;
   if(JSON.stringify(api.get())!==JSON.stringify(before)){status.textContent=t('История изменилась. Повторите удаление.','Історія змінилася. Повторіть видалення.');return;}
   api.update(d=>{d.nodes=d.nodes.filter(n=>!ids.has(n.id));d.nodes.forEach(n=>{n.links=(n.links||[]).filter(l=>!ids.has(l.to));});});
   undo={before,after:JSON.stringify(api.get())};selected.clear();restore.hidden=false;status.textContent=t('Удалено блоков: ','Видалено блоків: ')+ids.size;paint();
  }
  remove.onclick=removeSelected;
  restore.onclick=()=>{if(!undo)return;if(JSON.stringify(api.get())!==undo.after){status.textContent=t('После удаления были изменения — отмена недоступна.','Після видалення були зміни — скасування недоступне.');return;}api.update(d=>Object.assign(d,copy(undo.before)));undo=null;restore.hidden=true;status.textContent=t('Блоки и связи восстановлены.','Блоки та зв’язки відновлено.');paint();};
  const hint=Array.from(root.querySelectorAll('.zg-board-tools span:not([role])')).pop();if(hint)hint.textContent=t('ЛКМ · рамка · Shift + клик · выбор · Пробел + мышь · перемещение','ЛКМ · рамка · Shift + клік · вибір · Пробіл + миша · переміщення');
  const cards=()=>Array.from(canvas.querySelectorAll('.zg-story-node'));
  function paint(){const count=selectedIds().size;remove.hidden=!count;remove.textContent=t('Удалить выбранные','Видалити вибрані')+' ('+count+')';cards().forEach(c=>{c.style.outline=selected.has(c.dataset.nodeId)?'3px solid #dfbd69':'';});}
  new MutationObserver(paint).observe(root.querySelector('#zg-story-nodes'),{childList:true});
  function cancel(){if(gesture?.box)gesture.box.remove();if(gesture?.card)cards().forEach(c=>{const n=gesture.nodes.find(n=>n.id===c.dataset.nodeId);if(n){c.style.left=n.x+'px';c.style.top=n.y+'px';}});gesture=null;paint();}
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('input,textarea,select'))space=true;if(e.key==='Escape'){cancel();selected.clear();paint();}});
  document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});w.addEventListener('blur',()=>{space=false;cancel();});
  document.addEventListener('keydown',e=>{if(!root.classList.contains('open')||root.dataset.workspace!=='dialogues'||e.target.closest('input,textarea,select,button,[contenteditable],dialog,[role=dialog]')||document.querySelector('dialog[open]'))return;if((e.key==='Delete'||e.key==='Backspace')&&selectedIds().size){e.preventDefault();e.stopImmediatePropagation();removeSelected();}},true);
  canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0||space||e.target.closest('button,input,textarea,select,[data-story-link]'))return;
   const card=e.target.closest('.zg-story-node');
   if(card&&e.shiftKey){e.preventDefault();e.stopImmediatePropagation();const id=card.dataset.nodeId;if(selected.has(id))selected.delete(id);else selected.add(id);suppress=true;paint();return;}
   if(card&&!selected.has(card.dataset.nodeId)){selected.clear();paint();return;}
   if(card&&selected.size<2)return;
   e.preventDefault();e.stopImmediatePropagation();
   const rect=canvas.getBoundingClientRect();
   gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false,card:!!card,scale:w.ZargotaStoryGraph?.scale||1};
   if(card){const ids=new Set(cards().map(c=>c.dataset.nodeId));gesture.nodes=api.get().nodes.filter(n=>selected.has(n.id)&&ids.has(n.id)).map(n=>({id:n.id,x:Number(n.x)||12,y:Number(n.y)||12}));}
   else{selected.clear();const box=document.createElement('div');box.style.cssText='position:fixed;pointer-events:none;border:1px solid #dfbd69;background:#dfbd6926;z-index:2147483647';document.body.appendChild(box);gesture.box=box;gesture.rect=rect;}
   try{canvas.setPointerCapture(e.pointerId);}catch(_){}paint();
  },true);
  document.addEventListener('pointermove',e=>{
   const g=gesture;if(!g||g.pointer!==e.pointerId)return;
   if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>3)g.moved=true;
   if(!g.moved)return;e.preventDefault();
   if(g.card){let dx=(e.clientX-g.x)/g.scale,dy=(e.clientY-g.y)/g.scale;dx=Math.max(dx,12-Math.min(...g.nodes.map(n=>n.x)));dy=Math.max(dy,12-Math.min(...g.nodes.map(n=>n.y)));g.dx=dx;g.dy=dy;cards().forEach(c=>{const n=g.nodes.find(n=>n.id===c.dataset.nodeId);if(n){c.style.left=n.x+dx+'px';c.style.top=n.y+dy+'px';}});}
   else{const x=Math.min(g.x,e.clientX),y=Math.min(g.y,e.clientY),right=Math.max(g.x,e.clientX),bottom=Math.max(g.y,e.clientY);Object.assign(g.box.style,{left:x+'px',top:y+'px',width:right-x+'px',height:bottom-y+'px'});selected.clear();cards().forEach(c=>{const r=c.getBoundingClientRect();if(r.right>=x&&r.left<=right&&r.bottom>=y&&r.top<=bottom)selected.add(c.dataset.nodeId);});paint();}
  });
  document.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.pointer!==e.pointerId)return;suppress=true;setTimeout(()=>suppress=false,0);cancel();if(g.card&&g.moved)api.update(d=>{g.nodes.forEach(p=>{const n=d.nodes.find(n=>n.id===p.id);if(n){n.x=p.x+g.dx;n.y=p.y+g.dy;}});});},true);
  document.addEventListener('pointercancel',cancel);
  canvas.addEventListener('click',e=>{if(suppress||e.target.closest('.zg-story-node')&&selected.size>1&&selected.has(e.target.closest('.zg-story-node').dataset.nodeId)){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
  paint();
 }
 w.ZargotaStoryGraphSelection={install};
})(window);
