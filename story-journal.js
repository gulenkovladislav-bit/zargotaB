(function(w){
 'use strict';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 const local=(o,k)=>t(o[k],o[k+'Uk']||o[k])||'';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function valid(j){return !!j&&typeof j.title==='string'&&Array.isArray(j.pages)&&j.pages.length>0&&j.pages.every(p=>typeof p.title==='string'&&typeof p.text==='string')&&['x','y','width','height'].every(k=>Number.isFinite(j[k])&&j[k]>=0&&j[k]<=100)&&j.width>0&&j.height>0;}
 function open(j,trigger,sound){
  if(!valid(j))return ()=>{};
  const dialog=el('dialog');dialog.className='zg-journal';dialog.setAttribute('aria-label',local(j,'title'));
  const top=el('header'),title=el('strong',local(j,'title')),close=el('button',t('Закрыть журнал','Закрити журнал'));close.type='button';close.onclick=()=>dialog.close();top.append(title,close);
  const spread=el('div');spread.className='zg-journal-spread';
  const footer=el('footer'),prev=el('button','←'),counter=el('output'),next=el('button','→');prev.type=next.type='button';prev.setAttribute('aria-label',t('Предыдущий разворот','Попередній розворот'));next.setAttribute('aria-label',t('Следующий разворот','Наступний розворот'));counter.setAttribute('aria-live','polite');footer.append(prev,counter,next);
  let index=0,audio=null,animation=null;
  function rustle(){if(!sound)return;try{if(audio)audio.pause();audio=new Audio('assets/stories/audio/mixkit-paper-slide-1530.wav');audio.volume=.3;audio.play().catch(()=>{});}catch(e){}}
  function draw(animate){spread.replaceChildren();j.pages.slice(index,index+2).forEach(p=>{const page=el('article');page.className='zg-journal-page';page.append(el('h2',local(p,'title')));if(p.image){const img=el('img');img.src=p.image;img.alt=local(p,'title');page.append(img);}local(p,'text').split('\n\n').forEach(text=>page.append(el('p',text)));spread.append(page);});prev.disabled=index===0;next.disabled=index+2>=j.pages.length;counter.textContent=(index+1)+'–'+Math.min(index+2,j.pages.length)+' / '+j.pages.length;if(animate&&!w.matchMedia('(prefers-reduced-motion: reduce)').matches){animation?.cancel();animation=spread.animate([{opacity:.3,transform:'rotateY(-8deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:260,easing:'ease-out'});}if(animate)rustle();}
  prev.onclick=()=>{if(index>0){index-=2;draw(true);}};next.onclick=()=>{if(index+2<j.pages.length){index+=2;draw(true);}};
  dialog.append(top,spread,footer);document.body.append(dialog);draw(false);dialog.showModal();close.focus();
  const cover=el('div','⚙');cover.className='zg-journal-opening-cover';cover.setAttribute('aria-hidden','true');dialog.append(cover);
  if(!w.matchMedia('(prefers-reduced-motion: reduce)').matches){animation=cover.animate([{transform:'perspective(1200px) rotateY(0)',opacity:1},{transform:'perspective(1200px) rotateY(-115deg)',opacity:0}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});animation.finished.then(()=>cover.remove()).catch(()=>cover.remove());}else cover.remove();rustle();
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='ArrowRight'){e.preventDefault();next.click();}if(e.key==='ArrowLeft'){e.preventDefault();prev.click();}});
  dialog.addEventListener('close',()=>{animation?.cancel();if(audio){audio.pause();audio.src='';}dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});return ()=>{if(dialog.open)dialog.close();else dialog.remove();};
 }
 function mount(view,art,page,sound){
  const j=page.journal;if(!valid(j))return ()=>{};
  const layer=el('div');layer.className='zg-journal-hit-layer';const hit=el('button');hit.type='button';hit.className='zg-journal-hotspot';hit.title=hit.ariaLabel=t('Открыть журнал: ','Відкрити журнал: ')+local(j,'title');Object.assign(hit.style,{left:j.x+'%',top:j.y+'%',width:j.width+'%',height:j.height+'%'});layer.append(hit);view.append(layer);let close=null,frame=0,stopped=false;
  hit.onclick=e=>{e.preventDefault();e.stopPropagation();close?.();close=open(j,hit,sound);};
  function place(){if(stopped)return;const a=art.getBoundingClientRect(),b=view.getBoundingClientRect();if(art.naturalWidth){const g=w.ZargotaImageSecrets.geometry(a.width,a.height,art.naturalWidth,art.naturalHeight,page.imageFit==='contain'?'contain':'cover');Object.assign(layer.style,{left:a.left-b.left+g.x+'px',top:a.top-b.top+g.y+'px',width:g.width+'px',height:g.height+'px'});}if(page.imageMotion?.type&&page.imageMotion.type!=='none'||page.imageSequence)frame=requestAnimationFrame(place);}
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place);});observer.observe(view);art.addEventListener('load',place);frame=requestAnimationFrame(place);
  return ()=>{stopped=true;cancelAnimationFrame(frame);observer.disconnect();art.removeEventListener('load',place);close?.();layer.remove();};
 }
 function edit(data,node,host,save){
  const box=el('details');box.className='zg-journal-editor';box.append(el('summary',t('Журнал на изображении','Журнал на зображенні')));(host.querySelector('[data-tab=visual]')||host).append(box);
  let draft=JSON.parse(JSON.stringify(node.journal||{title:'Рабочий журнал',titleUk:'Робочий журнал',x:20,y:45,width:32,height:32,pages:[{title:'Заметки',titleUk:'Нотатки',text:'',textUk:''}]}));
  const enabled=el('input');enabled.type='checkbox';enabled.checked=!!node.journal;const toggle=el('label',t('Показывать журнал','Показувати журнал'));toggle.prepend(enabled);box.append(toggle);
  function field(label,key,obj,type='text'){const wrap=el('label',label),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=obj[key]??'';input.oninput=()=>obj[key]=type==='number'?Number(input.value):input.value;wrap.append(input);box.append(wrap);}
  field('RU · '+t('Название','Назва'),'title',draft);field('UK · '+t('Название','Назва'),'titleUk',draft);
  [['X · %','x'],['Y · %','y'],[t('Ширина · %','Ширина · %'),'width'],[t('Высота · %','Висота · %'),'height']].forEach(([label,key])=>field(label,key,draft,'number'));
  draft.pages.forEach((p,i)=>{box.append(el('h4',t('Страница ','Сторінка ')+(i+1)));field('RU · '+t('Заголовок','Заголовок'),'title',p);field('UK · '+t('Заголовок','Заголовок'),'titleUk',p);field('RU · '+t('Записи','Записи'),'text',p,'textarea');field('UK · '+t('Записи','Записи'),'textUk',p,'textarea');field(t('Изображение · путь','Зображення · шлях'),'image',p);});
  const note=el('p');note.setAttribute('role','status');const commit=el('button',t('Сохранить журнал','Зберегти журнал'));commit.type='button';commit.onclick=()=>{if(enabled.checked&&!valid(draft)){note.textContent=t('Проверьте страницы и координаты от 0 до 100.','Перевірте сторінки й координати від 0 до 100.');return;}save(d=>{const n=d.nodes.find(n=>n.id===node.id);if(enabled.checked)n.journal=JSON.parse(JSON.stringify(draft));else delete n.journal;});};box.append(commit,note);
 }
 w.ZargotaStoryJournal={valid,open,mount,edit};
})(window);
