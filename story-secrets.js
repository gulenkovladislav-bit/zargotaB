(function(w){
  'use strict';
  const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
  const local=(o,k)=>t(o[k]||'',o[k+'Uk']||o[k]||'');
  const defaultSound='assets/stories/audio/yodguard-coin-collect-3-540190.mp3';
  let active=null;
  function collect(data,state,sceneId,token){
    const key=sceneId+':'+token.id,cfg=token.pickup;
    if(!cfg||!state.character||state.consumed?.[key]||state.secretPickups?.[key])return {ok:false,reason:'collected'};
    const item=w.ZargotaStoryItems.list(data).find(i=>i.itemId===cfg.itemId),qty=Number(cfg.qty);
    if(!item||!Number.isSafeInteger(qty)||qty<1||qty>999)return {ok:false,reason:'invalid'};
    const character=JSON.parse(JSON.stringify(state.character));
    const result=w.ZargotaStoryItems.award(character,item,qty,false);
    if(!result.received)return {ok:false,reason:'owned'};
    state.character=result.character;
    (state.secretPickups||(state.secretPickups={}))[key]=true;
    (state.consumed||(state.consumed={}))[key]=true;
    return {ok:true,item,qty:item.stackable===false?1:qty};
  }
  function close(){if(active){const d=active;active=null;d.close();}}
  function show(result,cfg,sound,done){
    close();const focus=document.activeElement,dialog=document.createElement('dialog');active=dialog;
    dialog.className='zg-secret-found';dialog.setAttribute('aria-label',local(cfg,'title')||t('Вы нашли','Ви знайшли'));
    const heading=document.createElement('h2');heading.textContent=local(cfg,'title')||t('Вы нашли','Ви знайшли');
    const glow=document.createElement('div');glow.className='zg-secret-glow';
    const coinView=w.ZargotaStoryCoins?.viewer(result.item,{interactive:false});
    const image=coinView||document.createElement('img');if(!coinView){image.src=cfg.image||w.ZargotaStoryItems.icon(result.item);image.alt=local(result.item,'name');}glow.append(image);
    const name=document.createElement('p');name.textContent=local(result.item,'name')+(result.qty>1?' ×'+result.qty:'');
    const back=document.createElement('button');back.type='button';back.textContent=local(cfg,'button')||t('Подобрать','Підібрати');back.onclick=close;
    dialog.append(heading,glow,name,back);let audio=null;
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.addEventListener('close',()=>{coinView?.dispose();if(active===dialog)active=null;if(audio){audio.pause();audio.src='';}dialog.remove();if(focus?.isConnected)focus.focus();if(done)done();});
    document.body.append(dialog);dialog.showModal();back.focus();
    if(sound&&cfg.sound!==false){const source=w.ZargotaStoryCoins?.metal(result.item)?defaultSound:(cfg.sound||defaultSound);audio=new Audio(source);audio.volume=Math.max(0,Math.min(1,Number(cfg.volume??.5)));audio.play().catch(()=>{});}
  }
  function edit(o){
    const button=document.createElement('button');button.type='button';button.textContent=t('✦ Тайник / находка','✦ Схованка / знахідка');
    button.onclick=()=>{const id='secret-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);o.select('tokens',id,false);o.save(d=>{d.scene.tokens=d.scene.tokens||[];d.scene.tokens.push({id,type:'note',name:'Тайник',nameUk:'Схованка',x:50,y:50,size:28,visible:true,markerVisible:false,hideAfterInteraction:true,pickup:{itemId:'',qty:1,volume:.5}});});};o.menu.append(button);
    if(o.kind!=='tokens'||!o.item?.pickup)return;
    const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=t('Награда тайника','Нагорода схованки');box.append(legend);o.host.prepend(box);
    function set(key,value){o.save(d=>{const item=d.scene.tokens.find(i=>i.id===o.item.id);if(item)item.pickup[key]=value;});}
    function field(name,value,key,type){const label=document.createElement('label');label.className='zg-story-field';label.textContent=name;const input=document.createElement('input');input.type=type||'text';input.value=value??'';input.onchange=()=>{if(input.checkValidity())set(key,type==='number'?Number(input.value):input.value);};label.append(input);box.append(label);return input;}
    const label=document.createElement('label');label.className='zg-story-field';label.textContent=t('Предмет или монета','Предмет або монета');const select=document.createElement('select');
    const items=w.ZargotaStoryItems.list(o.data);[['',t('Выберите сюжетный предмет','Оберіть сюжетний предмет')],...items.map(i=>[i.itemId,local(i,'name')||i.itemId])].forEach(([id,name])=>{const opt=document.createElement('option');opt.value=id;opt.textContent=name;select.append(opt);});select.value=o.item.pickup.itemId||'';
    select.onchange=()=>o.save(d=>{const token=d.scene.tokens.find(i=>i.id===o.item.id),item=items.find(i=>i.itemId===select.value);if(token){token.pickup.itemId=select.value;token.image=item?w.ZargotaStoryItems.icon(item):'';}});label.append(select);box.append(label);
    const qty=field(t('Количество','Кількість'),o.item.pickup.qty,'qty','number');qty.min=1;qty.max=999;qty.step=1;
    const art=field(t('Крупное изображение · необязательно','Велике зображення · необов’язково'),o.item.pickup.image,'image');w.ZargotaStoryAssets?.attach(art,'image');
    const audio=field(t('Звук находки · пусто = звон монет','Звук знахідки · порожньо = дзвін монет'),o.item.pickup.sound===false?'':o.item.pickup.sound,'sound');w.ZargotaStoryAssets?.attach(audio,'audio');
    const mute=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=o.item.pickup.sound!==false;check.onchange=()=>set('sound',check.checked?'':false);mute.append(check,document.createTextNode(t('Звук находки включён','Звук знахідки увімкнено')));box.append(mute);
    const vol=field(t('Громкость · 0–1','Гучність · 0–1'),o.item.pickup.volume??.5,'volume','number');vol.min=0;vol.max=1;vol.step=.05;
    const hint=document.createElement('p');hint.textContent=t('Перетащите находку по карте. Герой подойдёт и подберёт её по щелчку. Один тайник — одна награда за прохождение. Предметы добавляются в разделе «Персонажи». Для картинки без фона используйте PNG/WebP с прозрачностью.','Перетягніть знахідку на мапі. Герой підійде й підбере її за клацанням. Одна схованка — одна нагорода за проходження. Предмети додаються в розділі «Персонажі». Для зображення без тла використовуйте PNG/WebP із прозорістю.');box.append(hint);
  }
  w.ZargotaStorySecrets={collect,show,close,edit};
})(window);
