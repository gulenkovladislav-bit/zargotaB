(function(w){
 'use strict';
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a,copy=v=>JSON.parse(JSON.stringify(v));
 function valid(rows){return Array.isArray(rows)&&new Set(rows.map(r=>r.id)).size===rows.length&&rows.every(r=>typeof r.id==='string'&&r.id&&typeof r.pickup?.itemId==='string'&&r.pickup.itemId&&Number.isInteger(r.pickup.qty)&&r.pickup.qty>0&&r.pickup.qty<=999&&[r.x,r.y,r.size].every(Number.isFinite)&&r.x>=0&&r.x<=100&&r.y>=0&&r.y<=100&&r.size>=1&&r.size<=25&&['scaleX','scaleY'].every(k=>r[k]===undefined||Number.isFinite(r[k])&&r[k]>=0.25&&r[k]<=3)&&['glow','particles'].every(k=>r[k]===undefined||typeof r[k]==='boolean'));}
 function geometry(width,height,iw,ih,fit){const scale=(fit==='contain'?Math.min:Math.max)(width/iw,height/ih);return {x:(width-iw*scale)/2,y:(height-ih*scale)/2,width:iw*scale,height:ih*scale};}
 function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
 function appearance(token,r){
  token.style.left=r.x+'%';token.style.top=r.y+'%';
  token.style.aspectRatio=String((r.scaleX||1)/(r.scaleY||1));
  token.style.width=r.size*(r.scaleX||1)+'%';
  token.classList.toggle('has-glow',r.glow!==false);
  token.classList.toggle('has-particles',r.particles===true);
 }
 function edit(project,page,save){
  const rows=copy(page.imageSecrets||[]).filter(r=>!r.image||r.image===page.image),items=w.ZargotaStoryItems.list(project),dialog=document.createElement('dialog');dialog.className='zg-image-secret-editor';
  const title=document.createElement('h2');title.textContent=t('Тайники на картинке','Схованки на зображенні');
  const help=document.createElement('p');help.textContent=t('Добавьте предмет и перетащите его на картинку. Каждый тайник подбирается один раз.','Додайте предмет і перетягніть його на зображення. Кожна схованка підбирається один раз.');
  const controls=document.createElement('div');controls.className='zg-image-secret-controls';const select=document.createElement('select');select.setAttribute('aria-label',t('Предмет','Предмет'));
  items.forEach(i=>{const o=document.createElement('option');o.value=i.itemId;o.textContent=t(i.name,i.nameUk||i.name);select.append(o);});
  const stage=document.createElement('div');stage.className='zg-image-secret-preview';const art=document.createElement('img');art.src=page.image;art.alt='';art.draggable=false;stage.append(art);
  const workspace=document.createElement('div');workspace.className='zg-image-secret-workspace';
  const list=document.createElement('aside');list.className='zg-image-secret-list';workspace.append(stage,list);
  let selected=rows[0]?.id;
  function inspect(){
   list.replaceChildren();
   const r=rows.find(r=>r.id===selected);
   stage.querySelectorAll('.zg-image-secret-token').forEach(token=>token.classList.toggle('is-selected',token.dataset.id===selected));
   if(!r){const empty=document.createElement('p');empty.textContent=t('Добавьте предмет или выберите его на картинке.','Додайте предмет або виберіть його на зображенні.');list.append(empty);return;}
   const item=items.find(i=>i.itemId===r.pickup.itemId),heading=document.createElement('h3');heading.textContent=item?t(item.name,item.nameUk||item.name):r.pickup.itemId;list.append(heading);
   const picker=document.createElement('select');picker.setAttribute('aria-label',t('Выбранный тайник','Вибрана схованка'));
   rows.forEach((row,i)=>{const option=document.createElement('option'),it=items.find(it=>it.itemId===row.pickup.itemId);option.value=row.id;option.textContent=(i+1)+'. '+(it?t(it.name,it.nameUk||it.name):row.pickup.itemId);picker.append(option);});picker.value=selected;picker.onchange=()=>{selected=picker.value;inspect();};list.append(picker);
   function update(){const token=Array.from(stage.querySelectorAll('.zg-image-secret-token')).find(b=>b.dataset.id===selected);if(token)appearance(token,r);}
   function input(caption,key,min,max,step){const wrap=document.createElement('label'),control=document.createElement('input'),value=document.createElement('output');wrap.textContent=caption;control.type=key==='qty'?'number':'range';control.min=min;control.max=max;control.step=step;control.value=key==='qty'?r.pickup.qty:(r[key]??1);value.textContent=control.value;control.oninput=()=>{const n=Number(control.value);if(!Number.isFinite(n)||n<min||n>max)return;if(key==='qty'){if(!Number.isInteger(n))return;r.pickup.qty=n;}else r[key]=n;value.textContent=control.value;update();};wrap.append(control);if(key!=='qty')wrap.append(value);list.append(wrap);}
   input(t('Количество','Кількість'),'qty',1,999,1);
   input(t('Размер','Розмір'),'size',1,25,0.1);
   input(t('Ширина ×','Ширина ×'),'scaleX',0.25,3,0.05);
   input(t('Высота ×','Висота ×'),'scaleY',0.25,3,0.05);
   function toggle(caption,key,checked){const wrap=document.createElement('label'),control=document.createElement('input');wrap.className='zg-image-secret-toggle';control.type='checkbox';control.checked=checked;control.onchange=()=>{r[key]=control.checked;update();};wrap.append(control,document.createTextNode(caption));list.append(wrap);}
   toggle(t('Свечение','Світіння'),'glow',r.glow!==false);toggle(t('Частицы','Частинки'),'particles',r.particles===true);
   list.append(button(t('Сбросить пропорции','Скинути пропорції'),()=>{r.scaleX=1;r.scaleY=1;inspect();update();}));
   const remove=button(t('Удалить предмет','Видалити предмет'),()=>{const index=rows.indexOf(r);rows.splice(index,1);selected=rows[Math.min(index,rows.length-1)]?.id;draw();});remove.className='zg-image-secret-delete';list.append(remove);
  }
  function draw(){stage.querySelectorAll('button').forEach(b=>b.remove());rows.forEach(r=>{
   const item=items.find(i=>i.itemId===r.pickup.itemId),name=item?t(item.name,item.nameUk||item.name):r.pickup.itemId;
   const token=button('',()=>{selected=r.id;inspect();});token.className='zg-image-secret-token';token.dataset.id=r.id;token.setAttribute('aria-label',name);const img=document.createElement('img');img.src=w.ZargotaStoryItems.icon(item||{});img.alt=name;img.draggable=false;token.append(img);appearance(token,r);stage.append(token);
   let drag=null;token.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();selected=r.id;inspect();drag={x:e.clientX,y:e.clientY,startX:r.x,startY:r.y};token.setPointerCapture(e.pointerId);};token.onpointermove=e=>{if(!drag||!token.hasPointerCapture(e.pointerId))return;const rect=stage.getBoundingClientRect();r.x=Math.max(0,Math.min(100,drag.startX+(e.clientX-drag.x)/rect.width*100));r.y=Math.max(0,Math.min(100,drag.startY+(e.clientY-drag.y)/rect.height*100));appearance(token,r);};token.onpointerup=token.onpointercancel=e=>{if(token.hasPointerCapture(e.pointerId))token.releasePointerCapture(e.pointerId);};
  });inspect();}
  const add=button(t('+ Предмет','+ Предмет'),()=>{if(!select.value)return;const row={id:'image-secret-'+crypto.randomUUID(),image:page.image,x:50,y:50,size:5,scaleX:1,scaleY:1,glow:true,particles:false,pickup:{itemId:select.value,qty:1}};rows.push(row);selected=row.id;draw();});add.disabled=!items.length;controls.append(select,add);
  const footer=document.createElement('footer');footer.append(button(t('Сохранить','Зберегти'),()=>{if(valid(rows)&&save(rows))dialog.close();}),button(t('Отмена','Скасувати'),()=>dialog.close()));
  dialog.append(title,help,controls,workspace,footer);dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);draw();dialog.showModal();return ()=>{dialog.close();dialog.remove();};
 }
 function mount(view,art,page,project,state,onCollect){
  const rows=page?.imageSecrets||[];if(!rows.length)return ()=>{};
  const layer=document.createElement('div');layer.className='zg-image-secret-layer';view.append(layer);
  rows.forEach(r=>{if(!valid([r])||r.image&&r.image!==page.image||state.secretPickups?.['dialogue-image:'+r.id])return;const item=w.ZargotaStoryItems.list(project).find(i=>i.itemId===r.pickup.itemId);if(!item)return;
   const b=button('',e=>{e.stopPropagation();const result=w.ZargotaStorySecrets.collect(project,state,'dialogue-image',r);if(result.ok){b.remove();onCollect(result,r.pickup);}});b.className='zg-image-secret-token';b.setAttribute('aria-label',t('Подобрать: ','Підібрати: ')+t(item.name,item.nameUk||item.name));appearance(b,r);const img=document.createElement('img');img.src=w.ZargotaStoryItems.icon(item);img.alt='';img.draggable=false;b.append(img);layer.append(b);
  });
  let frame=0,stopped=false;const animated=page.imageMotion?.type&&page.imageMotion.type!=='none'||!!page.imageSequence;function place(){if(stopped)return;const rect=art.getBoundingClientRect(),parent=view.getBoundingClientRect();if(art.naturalWidth&&art.naturalHeight){const g=geometry(rect.width,rect.height,art.naturalWidth,art.naturalHeight,page.imageFit==='contain'?'contain':'cover');Object.assign(layer.style,{left:rect.left-parent.left+g.x+'px',top:rect.top-parent.top+g.y+'px',width:g.width+'px',height:g.height+'px'});}if(animated)frame=requestAnimationFrame(place);}const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place);});observer.observe(view);art.addEventListener('load',place);frame=requestAnimationFrame(place);return ()=>{stopped=true;observer.disconnect();art.removeEventListener('load',place);cancelAnimationFrame(frame);layer.remove();};
 }
 w.ZargotaImageSecrets={valid,geometry,edit,mount};
})(window);
