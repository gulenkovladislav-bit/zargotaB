(function(w){
  'use strict';
  const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
  const local=(o,k)=>t(o[k]||'',o[k+'Uk']||o[k]||'');
  let active=null,activeMap=null,refreshActive=null;
  function refresh(flags){if(active&&activeMap?.refreshOnFlags&&refreshActive)refreshActive(flags);}
  function destinations(map,scenes,flags){
    return (map?.destinations||[]).map(d=>w.ZargotaI18n?.getLocale()==='uk'&&d.geometryUk?Object.assign({},d,d.geometryUk):d).filter(d=>(!d.requires||!!flags?.[d.requires])&&(d.nodeId||scenes.some(s=>s.id===d.sceneId))&&
      [d.x,d.y,d.width,d.height].every(Number.isFinite)&&d.x>=0&&d.y>=0&&d.width>0&&d.height>0&&d.x+d.width<=100&&d.y+d.height<=100);
  }
  // Small shoreline-like changes in curvature, stable for each named place.
  function contour(id){
    const seed=Array.from(String(id||'')).reduce((s,c)=>s+c.charCodeAt(0),0),points=[];
    for(let i=0;i<24;i++){const a=i*Math.PI/12,r=1+.045*Math.sin(i*2.3+seed)+.025*Math.cos(i*4.1+seed);points.push([50+46*r*Math.cos(a),50+44*r*Math.sin(a)]);}
    const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],first=mid(points[23],points[0]);
    return 'M '+first.join(' ')+' '+points.map((p,i)=>'Q '+p.join(' ')+' '+mid(p,points[(i+1)%24]).join(' ')).join(' ')+' Z';
  }
  function close(animated){
    if(!active)return;
    const old=active;
    function finish(){if(!old.open)return;if(active===old)active=null;old.close();}
    // Engine teardown and replacement must stay synchronous; user dismissal folds the paper.
    if(animated!==true||w.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
    if(old.dataset.closing)return;
    old.dataset.closing='true';old.setAttribute('aria-busy','true');
    const board=old.querySelector('.zg-travel-board');
    if(!board?.animate){finish();return;}
    const fold=board.animate([{opacity:1,transform:'perspective(1400px) rotateX(0deg) scale(1)'},{opacity:.85,transform:'perspective(1400px) rotateX(6deg) scale(.98,.72)',offset:.45},{opacity:0,transform:'perspective(1400px) rotateX(18deg) scale(.92,.06)'}],{duration:430,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
    old.animate([{opacity:1},{opacity:0}],{duration:430,easing:'ease-in',fill:'forwards'});
    fold.finished.then(finish,finish);
  }
  function open(map,scenes,travel,sound,options){
    options=options||{};
    const places=destinations(map,scenes,options.flags);if(!local(map,'image')||!places.length)return false;
    close();const trigger=document.activeElement,dialog=document.createElement('dialog');active=dialog;activeMap=map;
    dialog.className='zg-story-travel-map'+(map.mode==='inspect'?' zg-story-memory-map':'');dialog.setAttribute('aria-label',local(map,'title')||t('Карта','Мапа'));
    const header=document.createElement('header'),title=document.createElement('strong'),back=document.createElement('button');
    title.textContent=local(map,'title');back.type='button';back.textContent=t('Закрыть карту','Закрити мапу');back.onclick=()=>close(true);header.append(title,back);
    const board=document.createElement('div');board.className='zg-travel-board';
    const art=document.createElement('img');art.src=local(map,'image');art.alt=local(map,'title');art.onload=()=>{if(art.naturalWidth&&art.naturalHeight)board.style.setProperty('--map-aspect',art.naturalWidth/art.naturalHeight);};board.append(art);
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent=map.mode==='inspect'?t('Выберите место, чтобы вспомнить о нём.','Оберіть місце, щоб згадати про нього.'):options.inspect?t('План корпусов. Закройте карту, чтобы продолжить разговор.','План корпусів. Закрийте мапу, щоб продовжити розмову.'):t('Выберите корпус на карте. Tab — сменить корпус, Enter — перейти.','Оберіть корпус на мапі. Tab — змінити корпус, Enter — перейти.');
    let busy=false;const rendered=new Map();
    function addPlace(d){const b=document.createElement('button');b.type='button';b.className='zg-travel-destination';b.setAttribute('data-destination-id',d.id);rendered.set(d.id,b);b.style.cssText=`left:${d.x}%;top:${d.y}%;width:${d.width}%;height:${d.height}%`;
      const here=!!d.sceneId&&d.sceneId===options.currentSceneId,visited=!!d.sceneId&&!!options.visitedScenes?.[d.sceneId];
      if(visited)b.setAttribute('data-visited','true');
      if(d.marker)b.setAttribute('data-marker',d.marker);
      if(here){b.setAttribute('data-current','true');b.setAttribute('aria-current','location');b.setAttribute('aria-disabled','true');}
      // Keep labels outside the decorative outline; never clip the whole button.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS('http://www.w3.org/2000/svg','path');
      svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
      shape.setAttribute('d',d.outline||contour(d.id));shape.setAttribute('pathLength','1000');shape.setAttribute('vector-effect','non-scaling-stroke');svg.append(shape);b.append(svg);
      const label=document.createElement('span');label.textContent=local(d,'name');b.append(label);b.setAttribute('aria-label',local(d,'name'));
      if(d.marker||here||visited){const mark=document.createElement('i');mark.className='zg-travel-marker';mark.setAttribute('aria-hidden','true');mark.textContent=here?'•':visited?'×':d.marker==='search'?'?':'↩';b.append(mark);}
      const caption=local(d,'name')+(here?' · '+t('Вы здесь','Ви тут'):visited?' · '+t('Уже посещено · можно вернуться','Вже відвідано · можна повернутися'):'');b.setAttribute('aria-label',caption);
      b.onmouseenter=b.onfocus=()=>{status.textContent=caption;};
      b.onclick=()=>{if(dialog.dataset.closing)return;if(here||options.inspect){status.textContent=caption;return;}if(busy)return;busy=true;const ok=travel(d);if(ok!==false){if(map.mode!=='inspect')close();else busy=false;}else{busy=false;status.textContent=t('Переход сейчас недоступен. Закончите разговор и попробуйте снова.','Перехід зараз недоступний. Завершіть розмову й спробуйте знову.');}};board.append(b);
    }
    places.forEach(addPlace);
    refreshActive=flags=>{const available=destinations(map,scenes,flags),ids=new Set(available.map(d=>d.id));rendered.forEach((b,id)=>{if(!ids.has(id)){b.remove();rendered.delete(id);}});available.forEach(d=>{if(!rendered.has(d.id))addPlace(d);});};
    let audio=null;
    dialog.append(header,board,status);dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!options.host?.classList.contains('in-dialogue'))close(true);}else if(!options.host?.classList.contains('in-dialogue'))e.stopPropagation();});
    dialog.addEventListener('close',()=>{dialog.getAnimations?.({subtree:true}).forEach(a=>a.cancel());if(audio){audio.pause();audio.src='';}if(active===dialog){active=null;activeMap=null;}options.host?.classList.remove('has-memory-map');dialog.remove();if(trigger?.isConnected)trigger.focus();if(options.onClose)options.onClose();});
    if(options.host){options.host.append(dialog);options.host.classList.add('has-memory-map');dialog.show();}else{document.body.append(dialog);dialog.showModal();}back.focus();
    if(sound===true){try{audio=new Audio('assets/stories/audio/mixkit-paper-slide-1530.wav');audio.volume=.45;audio.play().catch(()=>{});}catch(e){}}
    return true;
  }
  function transition(map,from,to){
    const places=map?.destinations||[],target=places.find(d=>d.sceneId===to),origin=places.find(d=>d.sceneId===from);
    if(!target||!origin||from===to)return null;
    const fallback=target.marker==='search'||origin.marker==='search'?60:0;
    const minutes=Math.max(0,Math.min(1440,Math.round(Number(target.travelMinutes??map.travelMinutes??fallback)||0)));
    if(!minutes)return null;
    return {minutes,color:'black',text:map.travelCaption||(minutes===60?'Час спустя':minutes+' мин. спустя'),textUk:map.travelCaptionUk||(minutes===60?'Годину потому':minutes+' хв потому'),holdSeconds:2.8,soundRate:target.travelSound||map.travelSound?1:.65,sound:target.travelSound??map.travelSound??'assets/stories/audio/runnigfoot.mp3'};
  }
  // Kept with the item, so exported episodes retain their own destination settings.
  function edit(item,data,host,save){
    if(!item.travelMap)return;
    const fold=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('Карта-путеводитель · переходы','Мапа-путівник · переходи');fold.append(summary);host.append(fold);
    function update(fn){save(d=>{const record=(d.storyItems||[]).find(i=>i.itemId===item.itemId)||(d.player?.inventoryItems||[]).find(i=>i.itemId===item.itemId);if(!record)return;fn(record.travelMap);(d.player?.inventoryItems||[]).filter(i=>i.itemId===item.itemId).forEach(i=>i.travelMap=JSON.parse(JSON.stringify(record.travelMap)));});}
    function field(label,value,change,number){const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.type=number?'number':'text';input.value=value??'';if(number){input.min=0;input.max=100;input.step=.1;}input.onchange=()=>{if(!number||input.checkValidity())change(number?Number(input.value):input.value);};l.append(input);fold.append(l);return input;}
    const img=field(t('Изображение карты','Зображення мапи'),item.travelMap.image,v=>update(m=>m.image=v));w.ZargotaStoryAssets?.attach(img,'image');
    field(t('Надпись перехода · RU (пусто — время пути)','Напис переходу · RU (порожньо — час у дорозі)'),item.travelMap.travelCaption,v=>update(m=>m.travelCaption=v));
    field(t('Надпись перехода · UK (пусто — время пути)','Напис переходу · UK (порожньо — час у дорозі)'),item.travelMap.travelCaptionUk,v=>update(m=>m.travelCaptionUk=v));
    (item.travelMap.destinations||[]).forEach((d,index)=>{
      field(t('Название · RU','Назва · RU'),d.name,v=>update(m=>m.destinations[index].name=v));field(t('Название · UK','Назва · UK'),d.nameUk,v=>update(m=>m.destinations[index].nameUk=v));
      const label=document.createElement('label');label.textContent=t('Локация','Локація');const select=document.createElement('select');(data.scenes||[]).forEach(s=>{const opt=document.createElement('option');opt.value=s.id;opt.textContent=local(s.scene||s,'name')||s.id;select.append(opt);});select.value=d.sceneId;select.onchange=()=>update(m=>m.destinations[index].sceneId=select.value);label.append(select);fold.append(label);
      if(d.sceneId){const minutes=field(t('Время пути · минуты (0 — без экрана перехода)','Час у дорозі · хвилини (0 — без екрана переходу)'),d.travelMinutes??item.travelMap.travelMinutes??60,v=>update(m=>m.destinations[index].travelMinutes=v),true);minutes.max=1440;minutes.step=1;const audio=field(t('Звук дороги · необязательно','Звук дороги · необов’язково'),d.travelSound||'',v=>update(m=>m.destinations[index].travelSound=v));w.ZargotaStoryAssets?.attach(audio,'audio');}
      [['x','X'],['y','Y'],['width',t('Ширина','Ширина')],['height',t('Высота','Висота')]].forEach(([key,name])=>field(name+' %',d[key],v=>update(m=>m.destinations[index][key]=v),true));
    });
  }
  w.ZargotaStoryTravelMap={open,close,refresh,isOpen:map=>!!active&&(!map||activeMap===map),destinations,transition,edit};
})(window);
