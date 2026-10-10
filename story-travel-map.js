(function(w){
  'use strict';
  const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
  const local=(o,k)=>t(o[k]||'',o[k+'Uk']||o[k]||'');
  let active=null;
  function destinations(map,scenes){
    return (map?.destinations||[]).filter(d=>scenes.some(s=>s.id===d.sceneId)&&
      [d.x,d.y,d.width,d.height].every(Number.isFinite)&&d.x>=0&&d.y>=0&&d.width>0&&d.height>0&&d.x+d.width<=100&&d.y+d.height<=100);
  }
  function close(){if(active){const old=active;active=null;old.close();}}
  function open(map,scenes,travel,sound,options){
    options=options||{};
    const places=destinations(map,scenes);if(!map?.image||!places.length)return false;
    close();const trigger=document.activeElement,dialog=document.createElement('dialog');active=dialog;
    dialog.className='zg-story-travel-map';dialog.setAttribute('aria-label',local(map,'title')||t('Карта','Мапа'));
    const header=document.createElement('header'),title=document.createElement('strong'),back=document.createElement('button');
    title.textContent=local(map,'title');back.type='button';back.textContent=t('Закрыть карту','Закрити мапу');back.onclick=close;header.append(title,back);
    const board=document.createElement('div');board.className='zg-travel-board';
    const art=document.createElement('img');art.src=map.image;art.alt=local(map,'title');art.onload=()=>{if(art.naturalWidth&&art.naturalHeight)board.style.setProperty('--map-aspect',art.naturalWidth/art.naturalHeight);};board.append(art);
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent=options.inspect?t('План корпусов. Закройте карту, чтобы продолжить разговор.','План корпусів. Закрийте мапу, щоб продовжити розмову.'):t('Выберите корпус на карте. Tab — сменить корпус, Enter — перейти.','Оберіть корпус на мапі. Tab — змінити корпус, Enter — перейти.');
    let busy=false;
    places.forEach(d=>{const b=document.createElement('button');b.type='button';b.className='zg-travel-destination';b.style.cssText=`left:${d.x}%;top:${d.y}%;width:${d.width}%;height:${d.height}%`;
      // Keep labels outside the decorative outline; never clip the whole button.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS('http://www.w3.org/2000/svg','path');
      svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
      shape.setAttribute('d','M 50 5 C 76 3 94 20 95 46 C 98 72 77 94 51 95 C 24 98 5 78 4 53 C 2 28 21 7 50 5 Z');shape.setAttribute('vector-effect','non-scaling-stroke');svg.append(shape);b.append(svg);
      const label=document.createElement('span');label.textContent=local(d,'name');b.append(label);b.setAttribute('aria-label',local(d,'name'));
      b.onmouseenter=b.onfocus=()=>{status.textContent=local(d,'name');};
      b.onclick=()=>{if(options.inspect){status.textContent=local(d,'name');return;}if(busy)return;busy=true;const ok=travel(d);if(ok!==false)close();else{busy=false;status.textContent=t('Переход сейчас недоступен. Закончите разговор и попробуйте снова.','Перехід зараз недоступний. Завершіть розмову й спробуйте знову.');}};board.append(b);
    });
    let audio=null;
    dialog.append(header,board,status);dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('close',()=>{if(audio){audio.pause();audio.src='';}if(active===dialog)active=null;dialog.remove();if(trigger?.isConnected)trigger.focus();if(options.onClose)options.onClose();});
    document.body.append(dialog);dialog.showModal();back.focus();
    if(sound===true){try{audio=new Audio('assets/stories/audio/mixkit-paper-slide-1530.wav');audio.volume=.45;audio.play().catch(()=>{});}catch(e){}}
    return true;
  }
  // Kept with the item, so exported episodes retain their own destination settings.
  function edit(item,data,host,save){
    if(!item.travelMap)return;
    const fold=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('Карта-путеводитель · переходы','Мапа-путівник · переходи');fold.append(summary);host.append(fold);
    function update(fn){save(d=>{const record=(d.storyItems||[]).find(i=>i.itemId===item.itemId)||(d.player?.inventoryItems||[]).find(i=>i.itemId===item.itemId);if(!record)return;fn(record.travelMap);(d.player?.inventoryItems||[]).filter(i=>i.itemId===item.itemId).forEach(i=>i.travelMap=JSON.parse(JSON.stringify(record.travelMap)));});}
    function field(label,value,change,number){const l=document.createElement('label'),input=document.createElement('input');l.textContent=label;input.type=number?'number':'text';input.value=value??'';if(number){input.min=0;input.max=100;input.step=.1;}input.onchange=()=>{if(!number||input.checkValidity())change(number?Number(input.value):input.value);};l.append(input);fold.append(l);return input;}
    const img=field(t('Изображение карты','Зображення мапи'),item.travelMap.image,v=>update(m=>m.image=v));w.ZargotaStoryAssets?.attach(img,'image');
    (item.travelMap.destinations||[]).forEach((d,index)=>{
      field(t('Название · RU','Назва · RU'),d.name,v=>update(m=>m.destinations[index].name=v));field(t('Название · UK','Назва · UK'),d.nameUk,v=>update(m=>m.destinations[index].nameUk=v));
      const label=document.createElement('label');label.textContent=t('Локация','Локація');const select=document.createElement('select');(data.scenes||[]).forEach(s=>{const opt=document.createElement('option');opt.value=s.id;opt.textContent=local(s.scene||s,'name')||s.id;select.append(opt);});select.value=d.sceneId;select.onchange=()=>update(m=>m.destinations[index].sceneId=select.value);label.append(select);fold.append(label);
      [['x','X'],['y','Y'],['width',t('Ширина','Ширина')],['height',t('Высота','Висота')]].forEach(([key,name])=>field(name+' %',d[key],v=>update(m=>m.destinations[index][key]=v),true));
    });
  }
  w.ZargotaStoryTravelMap={open,close,destinations,edit};
})(window);
