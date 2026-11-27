(function(w){
  'use strict';
  var panel,launcher,allTarget,resultBox,drag=null,ghost=null,activeKey='',tab='favorites',busy=false,receipts=[],suppressUntil=0,authEpoch=0;
  var kind='statuses',category='';
  var preferences={};
  function preferencesKey(){return 'zg-gm-library-preferences-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
  function loadPreferences(){try{preferences=JSON.parse(localStorage.getItem(preferencesKey()))||{};}catch(_){preferences={};}if(!preferences||typeof preferences!=='object'||Array.isArray(preferences))preferences={};kind=['statuses','items','special','spells','documents','people','maps'].includes(preferences.kind)?preferences.kind:'statuses';}
  function savePreferences(){var search=panel?.querySelector('input[type=search]');preferences[kind]={tab:tab,category:category,query:search?.value||''};preferences.kind=kind;try{localStorage.setItem(preferencesKey(),JSON.stringify(preferences));}catch(_){}}
  function restorePreferences(){var value=preferences[kind]||{};tab=['all','favorites'].includes(value.tab)?value.tab:kind==='statuses'?'favorites':'all';category=typeof value.category==='string'?value.category:'';return typeof value.query==='string'?value.query:'';}
  var defaults=['bleed','stun','poison','fear','burn','shield'];
  function t(ru,uk){return w.ZargotaI18n?.getLocale()==='uk'?uk:ru;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?.translate(s)||s;}
  function label(s){return w.ZargotaI18n?.getLocale()==='uk'&&s.labelUk?s.labelUk:tr(s.label||s.key);}
  function templatesKey(){return 'zg-gm-ability-templates-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
  function upgradePeople(list){
    var seeds=new Map((w.ZargotaCampaignSeeds||[]).filter(d=>d._special==='person').map(d=>[d.key,d]));
    for(var contact of list){
      var seed=seeds.get(contact?.key);
      if(!seed||!contact.ability)continue;
      if(seed.gmProfile&&!contact.gmProfile)contact.gmProfile=seed.gmProfile;
      var oldPortraits=seed.previousPortraits||[];
      var paths=[contact.iconPath,contact.ability.iconAsset].filter(Boolean);
      var custom=paths.find(path=>path!==seed.iconPath&&!oldPortraits.includes(path));
      if(!custom||paths.length<2||paths.some(path=>oldPortraits.includes(path))){
        contact.iconPath=contact.ability.iconAsset=custom||seed.iconPath;
      }
    }
    return list;
  }
  function migratePeople(list){
    var flag=templatesKey()+':people-oil-v2';
    if(!w.ZargotaCampaignSeeds?.length||localStorage.getItem(flag))return;
    var existing=new Set(list.map(item=>item.key));
    var previouslySeeded=localStorage.getItem(templatesKey()+':people-oil-v1');
    if(!previouslySeeded)list.push(...w.ZargotaCampaignSeeds.filter(item=>item._special==='person'&&!existing.has(item.key)));
    upgradePeople(list);
    localStorage.setItem(templatesKey(),JSON.stringify(list));
    localStorage.setItem(flag,'1');
  }
  function templates(){try{var list=JSON.parse(localStorage.getItem(templatesKey())||'[]');if(Array.isArray(list))migratePeople(list);return Array.isArray(list)?list.filter(function(d){return d&&d.key&&d.ability&&['trait','mastery','document','person'].includes(d._special);}):[];}catch(_){return [];}}
  function spellCatalog(){return (w.getCharacterSpellCatalogEntries?.()||[]).filter(function(s){return s&&s.id!=null&&s.name;}).map(function(s){return {key:'spell:'+s.id,_special:'spell',spell:s,label:s.name,labelUk:s.nameUk,description:s.description||s.desc||'',descriptionUk:s.descriptionUk||s.descUk,iconPath:w.ZargotaSpellArt?.resolve(s)||s.iconAsset||s.image||'images/ui/combat-generated/folio.png'};});}
  function abilityCatalog(){return spellCatalog().concat(templates());}

  function sectionNavigation(){return '<nav class="gms-kinds" aria-label="'+t('Разделы хранилища','Розділи сховища')+'">'+[['statuses','◉','Статусы','Стани'],['items','◇','Предметы','Предмети'],['spells','✧','Заклинания','Заклинання'],['documents','▤','Документы','Документи'],['special','✦','Особое','Особливе'],['people','♙','Люди','Люди'],['maps','⌖','Карты','Мапи']].map(function(a){return '<button type="button" data-gms-kind="'+a[0]+'" aria-pressed="'+(kind===a[0])+'"><span aria-hidden="true">'+a[1]+'</span><span>'+t(a[2],a[3])+'</span></button>';}).join('')+'</nav>';}
  function localizeEditorFields(dialog,pairs){
    var uk=w.ZargotaI18n?.getLocale()==='uk';
    pairs.forEach(function(pair){['', 'Uk'].forEach(function(suffix){var input=dialog.querySelector('[name='+pair[0]+suffix+']'),label=input.closest('label'),visible=(suffix==='Uk')===uk;label.hidden=!visible;label.style.display=visible?'':'none';input.required=visible&&pair[0]==='name';if(visible){label.firstChild.textContent=t(pair[1],pair[2]);if(!input.value)input.value=dialog.querySelector('[name='+pair[0]+(uk?'':'Uk')+']').value;}});});
  }
  function editPerson(existing){
    var a=existing?.ability||{},d=document.createElement('dialog');d.className='gms-template';d.setAttribute('data-zg-i18n-skip','');
    function field(k,title,multi){return '<label>'+title+(multi?'<textarea name="'+k+'">'+esc(a[k]||'')+'</textarea>':'<input name="'+k+'" value="'+esc(a[k]||'')+'">')+'</label>';}
    d.innerHTML='<form><header><strong>'+t('Контакт мастера','Контакт майстра')+'</strong><button type="button" data-close>×</button></header>'+field('name',t('Имя','Ім’я'))+field('nameUk',t('Имя','Ім’я'))+field('relation',t('Кто это','Хто це'))+field('relationUk',t('Кто это','Хто це'))+field('lastKnownPlace',t('Последнее известное место','Останнє відоме місце'))+field('lastKnownPlaceUk',t('Последнее известное место','Останнє відоме місце'))+field('description',t('Известно игроку','Відомо гравцю'),true)+field('descriptionUk',t('Известно игроку','Відомо гравцю'),true)+field('iconAsset',t('Изображение: ссылка или путь images/','Зображення: посилання або шлях images/'))+'<p role="status"></p><button type="submit">'+t('Сохранить','Зберегти')+'</button></form>';
    localizeEditorFields(d,[['name','Имя','Ім’я'],['relation','Кто это','Хто це'],['lastKnownPlace','Последнее известное место','Останнє відоме місце'],['description','Известно игрокам','Відомо гравцям']]);d.classList.add('gms-contact-editor');
    d.refreshLocale=function(){var values=Object.assign({},a,Object.fromEntries(new FormData(d.querySelector('form'))));d.remove();editPerson(Object.assign({},existing,{ability:values}));};
    document.body.appendChild(d);w.ZargotaGmTable.presentDialog(d);d.querySelector('[data-close]').onclick=function(){d.remove();};
    d.querySelector('form').onsubmit=function(ev){ev.preventDefault();var a=Object.fromEntries(new FormData(ev.target));Object.keys(a).forEach(function(k){a[k]=a[k].trim();});a.name=a.name||a.nameUk;a.nameUk=a.nameUk||a.name;a.description=a.description||a.descriptionUk;a.descriptionUk=a.descriptionUk||a.description;['relation','lastKnownPlace'].forEach(function(k){a[k]=a[k]||a[k+'Uk'];a[k+'Uk']=a[k+'Uk']||a[k];});if(!a.name){d.querySelector('[role=status]').textContent=t('Укажите имя.','Укажіть ім’я.');return;}
      if(a.iconAsset&&!/^(https?:\/\/|images\/|assets\/)/i.test(a.iconAsset)){d.querySelector('[role=status]').textContent=t('Укажите ссылку https или путь images/.','Укажіть посилання https або шлях images/.');return;}
      var def={key:existing?.key||'person:'+crypto.randomUUID(),_special:'person',ability:a,label:a.name,labelUk:a.nameUk,description:a.description,descriptionUk:a.descriptionUk,iconPath:a.iconAsset||''};
      var list=templates().filter(function(x){return x.key!==def.key;});list.push(def);try{localStorage.setItem(templatesKey(),JSON.stringify(list));}catch(_){d.querySelector('[role=status]').textContent=t('Не удалось сохранить.','Не вдалося зберегти.');return;}tab='all';activeKey=def.key;savePreferences();paintList();closeCardMenu();d.remove();};
  }
  function editTemplate(existing){
    if(kind==='people'||existing?._special==='person'){editPerson(existing);return;}
    var d=document.createElement('dialog');d.className='gms-template';d.setAttribute('data-zg-i18n-skip','');var a=existing?.ability||{};var documentMode=['documents','maps'].includes(kind);
    function field(key,title,value,multiline){return '<label>'+title+(multiline?'<textarea name="'+key+'" rows="4">'+esc(value||'')+'</textarea>':'<input name="'+key+'" value="'+esc(value||'')+'" '+(['name','nameUk'].includes(key)?'required maxlength="160"':'')+'>')+'</label>';}
    d.innerHTML='<form><header><strong>'+(documentMode?t('Новый документ','Новий документ'):t('Своя способность','Власна здібність'))+'</strong><button type="button" data-close>×</button></header><label>'+t('Тип','Тип')+'<select name="kind"><option value="trait">'+t('Черта','Риса')+'</option><option value="mastery">'+t('Мастерство','Майстерність')+'</option></select></label>'+field('name',t('Название','Назва'),a.name)+field('nameUk',t('Название','Назва'),a.nameUk)+field('description',t('Описание и правила','Опис і правила'),a.description,true)+field('descriptionUk',t('Описание и правила','Опис і правила'),a.descriptionUk,true)+field('usages',t('Применение / ресурс','Застосування / ресурс'),a.usages)+field('iconAsset',t('Ссылка на изображение (необязательно)','Посилання на зображення (необов’язково)'),a.iconAsset)+'<p role="status"></p><button type="submit">'+t('Сохранить в хранилище','Зберегти у сховищі')+'</button></form>';
    if(documentMode){d.querySelector('[name=kind]').innerHTML='<option value="letter">'+t('Письмо','Лист')+'</option><option value="note">'+t('Записка','Записка')+'</option><option value="announcement">'+t('Объявление','Оголошення')+'</option>';d.querySelector('[name=usages]').closest('label').innerHTML=field('sender',t('Отправитель / подпись','Відправник / підпис'),a.sender)+'<label>'+t('Бумага','Папір')+'<select name=paper><option value=parchment>'+t('Пергамент','Пергамент')+'</option><option value=dark>'+t('Тёмная','Темна')+'</option><option value=gray>'+t('Серая','Сіра')+'</option></select></label>';d.querySelector('[name=paper]').value=a.paper||'parchment';}if(kind==='maps')d.querySelector('[name=kind]').innerHTML='<option value=place>'+t('Карта','Мапа')+'</option>';d.querySelector('[name=kind]').value=documentMode?(kind==='maps'?'place':a.kind||'letter'):(existing?._special||'trait');document.body.appendChild(d);w.ZargotaGmTable.presentDialog(d);if(documentMode){var preview=document.createElement('article');preview.className='zgml-document';d.querySelector('form').insertBefore(preview,d.querySelector('[type=submit]'));function drawPreview(){preview.className='zgml-document paper-'+d.querySelector('[name=paper]').value;preview.innerHTML='<strong>'+esc(d.querySelector('[name='+t('name','nameUk')+']').value)+'</strong><p class="zgml-entry-text">'+esc(d.querySelector('[name='+t('description','descriptionUk')+']').value||t('Текст документа','Текст документа'))+'</p>';}d.addEventListener('input',drawPreview);drawPreview();var upload=document.createElement('input');upload.type='file';upload.accept='image/*';upload.setAttribute('aria-label',d.querySelector('[name=iconAsset]').parentElement.textContent);d.querySelector('[name=iconAsset]').after(upload);upload.onchange=function(){var file=upload.files[0];if(!file)return;var url=URL.createObjectURL(file),img=new Image(),submit=d.querySelector('[type=submit]');submit.disabled=true;img.onload=function(){try{var canvas=document.createElement('canvas'),scale=Math.min(1,900/img.width,900/img.height);canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);d.querySelector('[name=iconAsset]').value=canvas.toDataURL('image/webp',.7);}finally{submit.disabled=false;URL.revokeObjectURL(url);}};img.onerror=function(){submit.disabled=false;URL.revokeObjectURL(url);};img.src=url;};}if(documentMode){d.classList.add('is-document-editor');var form=d.querySelector('form'),extra=document.createElement('details');extra.className='gms-document-extra';extra.innerHTML='<summary>'+t('Дополнительно','Додатково')+'</summary>';var primary=t('name','nameUk'),secondary=primary==='name'?'nameUk':'name';var bodyPrimary=t('description','descriptionUk'),bodySecondary=bodyPrimary==='description'?'descriptionUk':'description';d.querySelector('[name='+primary+']').closest('label').firstChild.textContent=t('Название','Назва');d.querySelector('[name='+bodyPrimary+']').closest('label').firstChild.textContent=t('Текст','Текст');d.querySelector('[name='+secondary+']').required=false;var paper=d.querySelector('[name=paper]'),paperLabel=paper.closest('label');form.insertBefore(paperLabel,form.querySelector('[role=status]'));[secondary,bodySecondary,'sender','iconAsset'].forEach(function(key){extra.appendChild(d.querySelector('[name='+key+']').closest('label'));});form.insertBefore(extra,paperLabel);var swatches=document.createElement('div');swatches.className='gms-paper-swatches';paper.hidden=true;['parchment','dark','gray'].forEach(function(key){var b=document.createElement('button');b.type='button';b.dataset.paper=key;b.className='paper-'+key;b.textContent=key==='parchment'?t('Пергамент','Пергамент'):key==='dark'?t('Тёмная','Темна'):t('Серая','Сіра');b.setAttribute('aria-pressed',String(paper.value===key));b.onclick=function(){paper.value=key;swatches.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});paper.dispatchEvent(new Event('input',{bubbles:true}));};swatches.appendChild(b);});paperLabel.appendChild(swatches);form.querySelectorAll('label').forEach(function(l){if(!l.children.length&&!l.textContent.trim())l.remove();});}
localizeEditorFields(d,[['name','Название','Назва'],['description',documentMode?'Текст':'Описание и правила',documentMode?'Текст':'Опис і правила']]);
    d.refreshLocale=function(){var values=Object.assign({},a,Object.fromEntries(new FormData(d.querySelector('form'))));d.remove();editTemplate(Object.assign({},existing,{_special:values.kind,ability:values}));};
d.querySelector('[data-close]').onclick=function(){d.remove();};d.oncancel=function(){d.remove();};
    d.querySelector('form').onsubmit=function(ev){ev.preventDefault();var data=Object.fromEntries(new FormData(ev.target));{data.name=data.name.trim()||data.nameUk.trim();data.nameUk=data.nameUk.trim()||data.name;data.description=data.description.trim()||data.descriptionUk.trim();data.descriptionUk=data.descriptionUk.trim()||data.description;}var type=data.kind,art=data.iconAsset.trim();if(art&&!art.startsWith('data:image/webp;base64,')&&!/^(https?:\/\/|images\/|assets\/)/i.test(art)){d.querySelector('[role=status]').textContent=t('Укажите https-ссылку или путь images/.','Укажіть https-посилання або шлях images/.');return;}
      var ability={name:data.name.trim(),nameUk:data.nameUk.trim(),description:data.description.trim(),descriptionUk:data.descriptionUk.trim(),usages:(data.usages||'').trim(),cdMax:0,cdUsed:0};if(art)ability.iconAsset=art;
      var def={key:existing?.key||'ability:'+crypto.randomUUID(),_special:type,ability:ability,label:ability.name,labelUk:ability.nameUk,description:ability.description,descriptionUk:ability.descriptionUk,iconPath:art||('images/ui/mobile-skills/source-'+(type==='trait'?'traits-v2':'mastery-v1')+'.png')};
      if(documentMode){ability.sender=data.sender||'';ability.kind=type;ability.paper=data.paper;def._special='document';def.document={kind:type,title:ability.name,titleUk:ability.nameUk,text:ability.description,textUk:ability.descriptionUk,sender:ability.sender,paper:ability.paper,image:art};def.iconPath=type==='place'?(art||'images/ui/character-lore/path.webp'):'images/ui/character-lore/'+(type==='letter'?'letter':type==='note'?'handwritten-note-v1':'notes')+'.webp';}
      var list=templates().filter(function(item){return item.key!==def.key;});list.push(def);try{localStorage.setItem(templatesKey(),JSON.stringify(list));}catch(_){d.querySelector('[role=status]').textContent=t('Не удалось сохранить шаблон.','Не вдалося зберегти шаблон.');return;}if(tab==='favorites'){try{localStorage.setItem(favoriteKey(),JSON.stringify(Array.from(new Set(favorites().concat(def.key)))));}catch(_){}}d.remove();activeKey=def.key;category=documentMode?'':type;if(panel.querySelector('[data-gms-category]'))panel.querySelector('[data-gms-category]').value=category;panel.querySelector('input[type=search]').value='';savePreferences();paintList();closeCardMenu();
    };
  }
  function seedDocument(){var flag=templatesKey()+':sample-document-v1';try{if(localStorage.getItem(flag))return;var list=templates();list.push({key:'document:sample-v1',_special:'document',label:'Тестовое письмо',labelUk:'Тестовий лист',ability:{name:'Тестовое письмо',nameUk:'Тестовий лист',description:'Это пример письма. Здесь будет ваш текст.',descriptionUk:'Це приклад листа. Тут буде ваш текст.',kind:'letter',paper:'parchment'},document:{kind:'letter',title:'Тестовое письмо',titleUk:'Тестовий лист',text:'Это пример письма. Здесь будет ваш текст.',textUk:'Це приклад листа. Тут буде ваш текст.',paper:'parchment'},iconPath:'images/ui/character-lore/letter.webp'});localStorage.setItem(templatesKey(),JSON.stringify(list));localStorage.setItem(flag,'1');}catch(_){}}
  function seedVillageMap(){
    var flag=templatesKey()+':village-handout-v1';
    try{
      if(localStorage.getItem(flag))return;
      var list=templates(),key='document:ebg-handout-v1';
      if(!list.some(d=>d.key===key||d.key==='document:ebg-map-v1')){
        var name='Ебатьэтогденск',nameUk='Ебатьєтогденськ',image='images/maps/ebatyetogdensk-painted-v1.webp';
        list.push({key:key,_special:'document',label:name,labelUk:nameUk,iconPath:image,
          ability:{kind:'place',name:name,nameUk:nameUk,iconAsset:image},
          document:{kind:'place',title:name,titleUk:nameUk,image:image,paper:'parchment'}});
        localStorage.setItem(templatesKey(),JSON.stringify(list));
      }
      localStorage.setItem(flag,'1');
    }catch(_){}
  }
  function catalog(section){if((section||kind)==='people')return templates().filter(function(d){return d._special==='person';});if((section||kind)==='maps'){seedVillageMap();return templates().filter(function(d){return d._special==='document'&&['place','map'].includes(d.document?.kind);});}if((section||kind)==='spells')return abilityCatalog().filter(function(d){return !['document','person'].includes(d._special);});if((section||kind)==='documents'){seedDocument();return templates().filter(function(d){return d._special==='document';});}if((section||kind)==='items')return (w.loadShopItems?.()||[]).filter(function(i){return i&&i.id&&i.name&&!['service','services'].includes(i.category||i.cat);}).map(function(i){return Object.assign({},i,{key:String(i.id),label:i.name,labelUk:i.nameUk,description:i.description||i.desc||'',_item:true});});var states=(w.zgGmStatusCatalog?.()||[]).filter(function(s){return s&&s.key&&s.enabled!==false;});return (section||kind)==='special'?states.filter(function(s){return s.key==='exhausted';}).concat(w.ZargotaCharacterSpecial.catalog(w.ZARGOTA_INJURY_TABLE)):states;}
  function definition(key){return catalog().find(function(s){return s.key===key;});}
  function glyph(s){if(s._special==='person'&&!s.iconPath)return '<span class="gms-icon" aria-hidden="true">♙</span>';if(s._special)return '<img class="gms-icon" src="'+esc(s.document?.kind==='note'?'images/ui/character-lore/handwritten-note-v1.webp':s.iconPath)+'" alt="" draggable="false">';if(s.key==='exhausted')return '<img class="gms-icon" src="images/ui/character-mobile/exhaustion-traveller-v1.png" alt="" draggable="false">';if(s._item){var src=s.imageThumb||s.image||w.ZargotaItemIcons?.pathFor(s)||'';return /^(https?:\/\/|images\/|assets\/|data:image\/)/i.test(src)?'<img class="gms-icon gms-item-art" src="'+esc(src)+'" alt="" draggable="false">':'<span class="gms-icon">◇</span>';}return w.zgStatusGlyphMarkup?.(s,label(s),'gms-icon')||'<span class="gms-icon">'+esc(s.icon||'✦')+'</span>';}
  function favoriteKey(){return 'zg-gm-'+(kind==='items'?'item':kind==='spells'?'spell':['people','maps'].includes(kind)?kind:'status')+'-favorites-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
  function favorites(){try{var value=JSON.parse(localStorage.getItem(favoriteKey()));if(Array.isArray(value))return value;}catch(_){}return ['items','spells'].includes(kind)?[]:defaults.slice();}
  function targets(){return w.ZargotaGmTable?.targets()||[];}
  var categories={currency:['Монеты','Монети'],weapon:['Оружие','Зброя'],armor:['Броня','Броня'],shield:['Щиты','Щити'],potion:['Зелья','Зілля'],consumable:['Расходники','Витратні предмети'],food:['Еда и быт','Їжа й побут'],magic:['Магическое','Магічне'],accessory:['Украшения','Прикраси'],tool:['Инструменты','Інструменти'],mount:['Транспорт','Транспорт'],property:['Жильё','Житло'],material:['Материалы','Матеріали'],contraband:['Подпольное','Підпільне'],other:['Разное','Різне']};
  function itemCategory(item){var key=item.category==='currency'?'currency':item.cat||item.category||'other';key=({artifact:'magic',clothing:'armor',item:'other'})[key]||key;return categories[key]?key:'other';}
  function hasStats(person){return Object.keys(person.gmProfile?.stats||{}).some(key=>key!=='age');}
  function personPlace(person){return person.ability.lastKnownPlace||person.ability.lastKnownPlaceUk||'';}
  function matchesPerson(person){
    if(!category)return true;
    if(category==='stats')return hasStats(person);
    if(category==='traits')return !!person.gmProfile?.traits?.length;
    return category==='place:'+personPlace(person);
  }
  function peopleFilters(){
    var places=new Map();
    for(var person of catalog('people')){
      var place=personPlace(person);
      if(place)places.set('place:'+place,t(place,person.ability.lastKnownPlaceUk||place));
    }
    var options=[['',t('Все люди','Усі люди')],['stats',t('С характеристиками','З характеристиками')],['traits',t('С чертами','З рисами')],...places];
    var selected=options.find(option=>option[0]===category)||options[0];
    category=selected[0];
    return '<details class="gms-people-filter"><summary aria-label="'+t('Фильтр людей','Фільтр людей')+'">'+esc(selected[1])+'</summary><div>'+options.map(([value,name])=>
      '<button type="button" data-person-filter="'+esc(value)+'" aria-pressed="'+(value===category)+'">'+esc(name)+'</button>').join('')+'</div></details>';
  }
  function filterMarkup(){
    var values=new Set(catalog().map(itemCategory));var spellTypes={spell:t('Заклинания','Заклинання'),trait:t('Черты','Риси'),mastery:t('Мастерство','Майстерність'),kodex:t('Боевой кодекс','Бойовий кодекс'),folio:t('Фолиант','Фоліант'),obrad:t('Обрядник','Обрядник')};
    return '<div class="gms-filters">'+(kind==='people'?peopleFilters():'')+(kind==='documents'?'<select data-gms-category aria-label="'+t('Тип документа','Тип документа')+'"><option value="">'+t('Все документы','Усі документи')+'</option>'+[['letter',t('Письма','Листи')],['note',t('Записки','Записки')],['announcement',t('Объявления','Оголошення')]].map(function(a){return '<option value="'+a[0]+'"'+(category===a[0]?' selected':'')+'>'+a[1]+'</option>';}).join('')+'</select>':'')+(kind==='spells'?'<select data-gms-category aria-label="'+t('Тип способности','Тип здібності')+'"><option value="">'+t('Все типы','Усі типи')+'</option>'+Object.keys(spellTypes).map(function(k){return '<option value="'+k+'"'+(category===k?' selected':'')+'>'+spellTypes[k]+'</option>';}).join('')+'</select>':'')+(kind==='items'?'<select data-gms-category aria-label="'+t('Категория предметов','Категорія предметів')+'"><option value="">'+t('Все категории','Усі категорії')+'</option>'+Object.keys(categories).filter(function(key){return values.has(key);}).map(function(key){return '<option value="'+key+'"'+(category===key?' selected':'')+'>'+t(categories[key][0],categories[key][1])+'</option>';}).join('')+'</select>':'')+'<button type="button" data-gms-favorites aria-pressed="'+(tab==='favorites')+'" aria-label="'+t('Только избранное','Лише обране')+'" title="'+t('Только избранное','Лише обране')+'">★</button></div>';
  }
  function paintList(){
    if(!panel||panel.hidden)return;
    var query=panel.querySelector('input[type=search]').value.toLocaleLowerCase().trim(),favs=favorites();
    var list=catalog().filter(function(s){return (kind!=='documents'||!['place','map'].includes(s.document?.kind))&&(tab!=='favorites'||favs.includes(s.key))&&(kind!=='people'||matchesPerson(s))&&(kind!=='items'||!category||itemCategory(s)===category)&&(kind!=='documents'||!category||s.document?.kind===category)&&(kind!=='spells'||!category||s._special===category||s.spell?.spellType===category)&&(!query||[label(s),s.label,s.labelUk,s.key,...(kind==='people'?[s.ability.relation,s.ability.relationUk,personPlace(s),s.ability.lastKnownPlaceUk]:[])].join(' ').toLocaleLowerCase().includes(query));});
    panel.querySelector('[data-gms-list]').innerHTML=list.map(function(s){var starred=favs.includes(s.key);return '<article class="gms-tile'+(activeKey===s.key?' is-selected':'')+'"><button type="button" data-gms-drag="'+esc(s.key)+'" aria-label="'+esc(label(s))+'">'+glyph(s)+'<span>'+esc(label(s))+'</span></button><button type="button" class="gms-star" data-gms-star="'+esc(s.key)+'" aria-pressed="'+starred+'" aria-label="'+esc(starred?t('Убрать из избранного','Прибрати з обраного'):t('В избранное','До обраного'))+'">'+(starred?'★':'☆')+'</button></article>';}).join('')||'<p class="gms-empty">'+t('Ничего не найдено','Нічого не знайдено')+'</p>';
    panel.querySelector('[data-gms-favorites]').setAttribute('aria-pressed',tab==='favorites');
  }
  var defaultDescriptionsUk={
    stun:'Втрачає довгу дію та реакцію. Перешкода на атаки й більшість перевірок. На початку ходу — Сл 14 Витривалості для зняття.',
    burn:'Отримує 1d4 Вогню на початку ходу. Гаситься водою, дією «Впасти й котитися» або залежно від обсягу полум’я.',
    poison:'Отримує 1 шкоди Отрутою на початку ходу. Перешкода на кидки атак і перевірки характеристик. Знімається ліками або Сл 14 Витривалості.',
    freeze:'Скутий льодом: знерухомлений, засліплений, загальмований. Вразливий до Дробильної та Звукової шкоди. Атаки по ньому — з перевагою.',
    fear:'Не може добровільно наближатися до джерела страху. Перешкода на кидки поряд із ним.',
    blind:'Перешкода на атаки. Усі атаки по ньому — з перевагою.',
    prone:'Повалений. Підвестися = половина швидкості ходу. Ближні атаки по ньому — з перевагою, дальні — з перешкодою.',
    bleed:'Отримує 1 шкоди на початку ходу. Кожне наступне накладання додає 1 накопичення та збільшує шкоду на 1. Знімається перев’язкою (Сл 10 Спритності).',
    silence:'Магічна німота. Не може використовувати заклинання й магічні здібності. Звичайні навички та атаки працюють.',
    anchor:'Магічний якір. Не може телепортуватися або переміщуватися магічними засобами (телепорт, Політ, портал, стрибок-крізь-тінь тощо).',
    charm:'Зачарований. Не може атакувати джерело чарів. Перешкода на перевірки проти нього.',
    dominate:'Підкорений. Діє повністю за волею джерела стану (контролера); власних дій не здійснює.',
    paralyze:'Повний параліч. Знерухомлений і не може діяти, але думки в порядку. Атаки по ньому — з перевагою. Сл 15 Витривалості для зняття.',
    restrain:'Знерухомлений. Швидкість 0. Перешкода на атаки й рятівні кидки Спритності. Атаки по ньому — з перевагою. Діяти (атакувати, чаклувати) — можна.',
    slow:'Уповільнений. Пересування вдвічі менше. Лише одна дія за хід.',
    curse:'Проклятий. Конкретні ефекти — власні, залежать від джерела прокляття. Типово: -2 до атак, -1 до шкоди. Знімається ритуалом або святою магією.',
    exhausted:'Виснажений (5 рівнів). Рів. 1 Втома — перешкода на перевірки характеристик. Рів. 2 Знемога — швидкість ÷ 2, реакцій немає. Рів. 3 Виснаження — перешкода на атаки й рятівні кидки. Рів. 4 Зрив — макс. HP ÷ 2, не можна чаклувати. Рів. 5 Колапс — непритомність (боротьба за життя). Знімається: -1 рівень за короткий відпочинок, усе за довгий.',
    invisible:'Справді невидимий. Можна лише почути за звуком, помітити за димом/рідинами або предметами, особливими заклинаннями чи перевірками Сприйняття від ГМ.',
    regen:'Відновлює 1d4 HP на початку ходу. Ефекти — власні, залежать від джерела регенерації.',
    shield:'Захисний щит (власний). Типово: +2 AC. Один удар може зняти — за рішенням джерела.',
    rage:'Лють. Посилення атак і шкоди, зниження захисту та контролю. Числа задає джерело люті. Не знімається добровільно до кінця бою.',
    fly:'Політ. Швидкість задає джерело ефекту. Ігнорує складну місцевість. Може вийти з ближнього бою без реакцій.',
    confusion:'Сум’яття. У свій хід: 50% шанс атакувати випадкову ціль у радіусі 1 клітини (включно із союзниками).'
  };
  function description(def){
    if(w.ZargotaI18n?.getLocale()==='uk'){
      if(def.descriptionUk)return def.descriptionUk;
      // Translate only the shipped text; never hide a master's custom rule
      // behind the default translation for a coincidentally matching key.
      var stock=(w.getDefaultStatusMechanics?.()||[]).find(function(s){return s.key===def.key;});
      if(stock&&stock.description===def.description&&defaultDescriptionsUk[def.key])return defaultDescriptionsUk[def.key];
    }
    if(def.injury)return tr(def.injury.effect)+'\n'+tr(def.injury.treatment);
    return tr(def.description||'');
  }
  function inspectCard(tile){
    var key=tile.dataset.gmsDrag,def=definition(key);if(!def)return;
    w.ZargotaTableObjects.preview(kind==='maps'?'documents':kind,key,optionsFor(def)||{unit:'manual',duration:0},tile.parentElement);
  }
  function closeCardMenu(){panel?.querySelector('.gms-card-menu')?.remove();}
  function showCardMenu(tile,x,y){
    closeCardMenu();
    var def=definition(tile.dataset.gmsDrag);if(!def)return;
    var menu=document.createElement('div');menu.className='gms-card-menu';menu.setAttribute('popover','auto');
    function action(attr,title){var button=document.createElement('button');button.type='button';button.setAttribute(attr,def.key);button.textContent=title;menu.appendChild(button);}
    action('data-gms-inspect',t('Осмотреть','Оглянути'));
    if(def.ability)action('data-template-edit',t('Редактировать шаблон','Редагувати шаблон'));
    if(def._special==='person')action('data-contact-update',t('Обновить у знакомых на столе','Оновити у знайомих на столі'));
    if(templates().some(d=>d.key===def.key))action('data-template-delete',t('Удалить заготовку','Видалити заготовку'));
    panel.appendChild(menu);menu.showPopover();var bounds=menu.getBoundingClientRect(),anchor=tile.getBoundingClientRect();
    menu.style.left=Math.max(4,Math.min(x??anchor.left,innerWidth-bounds.width-4))+'px';
    menu.style.top=Math.max(4,Math.min(y??anchor.bottom,innerHeight-bounds.height-4))+'px';
    menu.querySelector('button').focus({preventScroll:true});
    menu.addEventListener('toggle',()=>{if(!menu.matches(':popover-open'))menu.remove();});
  }
  async function updateKnownContacts(button){if(busy)return;var key=button.dataset.contactUpdate,def=definition(key);if(def?._special!=='person')return;var chosen=targets().filter(function(target){var c=(w.characters||[]).find(function(c){return String(c.id)===String(target.id);});return target.ready&&(c?.family||[]).concat(c?.contacts||[]).some(function(p){return p.grantTemplateId===key;});}),box=button.parentElement,message=document.createElement('p');message.dataset.contactResult='';message.setAttribute('role','status');box.querySelector('[data-contact-result]')?.remove();box.appendChild(message);if(!chosen.length){message.textContent=t('На столе ещё никто не знаком с этим контактом.','На столі ще ніхто не знайомий із цим контактом.');return;}busy=true;button.disabled=true;var updated=0,failed=0,epoch=authEpoch;
    try{for(var target of chosen){if(epoch!==authEpoch)return;try{var result=await w.ZargotaGmTable.status(target,key,{unit:'manual',duration:0,updateOnly:true});if(result.ok){if(result.changed)updated++;}else failed++;}catch(_){failed++;}}message.textContent=t('Обновлено: ','Оновлено: ')+updated+(failed?t('. Не удалось: ','. Не вдалося: ')+failed:'');}finally{busy=false;button.disabled=false;}}
  function optionsFor(def){
    if(def.key==='exhausted'){var levels=Number(panel.querySelector('[data-gms-levels]')?.value||1);return Number.isInteger(levels)&&levels>=1&&levels<=5?{unit:'manual',duration:0,levels:levels}:null;}
    if(def._special)return {unit:'manual',duration:0};
    if(def._item){var qty=Number(panel.querySelector('[data-gms-qty]').value);return Number.isInteger(qty)&&qty>0&&qty<=999?{qty:qty}:null;}
    var unit=panel.querySelector('[data-gms-unit]').value,amount=Number(panel.querySelector('[data-gms-duration]').value);
    if(unit==='default'){amount=Math.max(0,Number(def.defaultDuration)||0);unit=amount?'rounds':'manual';}
    if(unit!=='manual'&&(!Number.isInteger(amount)||amount<1||amount>999))return null;
    return {unit:unit,duration:unit==='manual'?0:amount};
  }
  function reasonText(reason){return ({
    added:t('Добавлен','Додано'),stacked:t('Уровень увеличен','Рівень збільшено'),undone:t('Отменено','Скасовано'),
    'already-active':t('Уже действует','Уже діє'),'stack-limit':t('Достигнут предел накопления','Досягнуто межі накопичення'),
    'duplicate-existing':t('Есть несколько эффектов — проверьте лист','Є кілька ефектів — перевірте аркуш'),
    'not-ready':t('Лист недоступен или ещё сохраняется','Аркуш недоступний або ще зберігається'),
    conflict:t('Лист изменился — повторите после проверки','Аркуш змінився — повторіть після перевірки'),
    unconfirmed:t('Нет подтверждения — проверьте лист','Немає підтвердження — перевірте аркуш'),
    'changed-since':t('Эффект уже изменён — отмена пропущена','Ефект уже змінено — скасування пропущено'),
    'local-save-failed':t('Не удалось сохранить на устройстве','Не вдалося зберегти на пристрої'),
    'unknown-item':t('Предмет больше недоступен','Предмет більше недоступний'),'invalid-quantity':t('Количество: от 1 до 999','Кількість: від 1 до 999'),'inventory-full':t('Достигнут предел записей инвентаря','Досягнуто межі записів інвентарю'),'receipt-limit':t('Игроку нужно просмотреть прошлые выдачи','Гравцеві потрібно переглянути минулі надходження'),'unknown-status':t('Статус больше недоступен','Стан більше недоступний')
  })[reason]||t('Не удалось применить','Не вдалося застосувати');}
  function showResults(title,results){
    var failed=results.filter(function(r){return !r.ok;});
    if(failed.length&&panel.hidden)open();
    resultBox.hidden=!failed.length;
    resultBox.textContent=failed.map(function(r){return r.target.name+(r.entry?' · '+r.entry:'')+': '+reasonText(r.reason);}).join(' · ');
  }
  async function deliver(def,chosen,options,bundle){
    if(busy||!chosen.length)return;
    busy=true;receipts=[];panel.setAttribute('aria-busy','true');
    resultBox.hidden=true;resultBox.textContent='';
    var result=[],epoch=authEpoch,operations=bundle||[{def:def,options:options}];
    try{
      // Fixed recipient set for this gesture. Each write checks current access,
      // saves against the latest acknowledged revision and reports independently.
      for(var target of chosen){
       for(var operation of operations){
        var def=operation.def,options=operation.options;
        if(epoch!==authEpoch)return;
        var response;
        try{response=def._item?await w.ZargotaGmTable.item(target,(w.loadShopItems?.()||[]).find(function(i){return String(i.id)===def.key;}),options.qty,w.crypto.randomUUID()):await w.ZargotaGmTable.status(target,def.key,options);}
        catch(_){response={ok:false,reason:'unconfirmed'};}
        if(epoch!==authEpoch)return;
        if(response.ok&&response.changed)receipts.push({target:target,receipt:response.receipt});
        result.push(Object.assign({target:target,entry:label(def)},response));
       }
      }
      showResults(label(def),result);
    }finally{busy=false;panel.setAttribute('aria-busy','false');}
  }
  async function undo(){
    if(busy||!receipts.length)return;
    busy=true;var entries=receipts;receipts=[];resultBox.textContent=t('Отменяем выдачу…','Скасовуємо надання…');
    try{
      var results=[],epoch=authEpoch;
      for(var entry of entries){if(epoch!==authEpoch)return;var response;try{response=await w.ZargotaGmTable.undoStatus(entry.target,entry.receipt);}catch(_){response={ok:false,reason:'unconfirmed'};}if(epoch!==authEpoch)return;results.push(Object.assign({target:entry.target},response));}
      showResults(t('Отмена выдачи','Скасування надання'),results);
    }finally{busy=false;}
  }
  function refreshTargets(){
    if(!drag||!drag.started)return;
    var now=targets();
    allTarget.querySelector('small').textContent=String(drag.targets.length);
    document.querySelectorAll('#zg-irl-character-dock [data-gm-key]').forEach(function(el){var target=now.find(function(r){return r.key===el.dataset.gmKey;});el.classList.toggle('gms-unavailable',!target||!target.ready);});
  }
  function clearHover(){document.querySelectorAll('.gms-drop-hover').forEach(function(el){el.classList.remove('gms-drop-hover');});}
  function cancel(){
    if(drag?.started)suppressUntil=Date.now()+400;
    drag?.hooks?.cancel();drag=null;ghost?.remove();ghost=null;clearHover();if(allTarget)allTarget.hidden=true;
    if(document.body.classList.contains('gms-dragging'))document.body.classList.remove('gms-dragging');
    document.querySelectorAll('.gms-unavailable').forEach(function(el){el.classList.remove('gms-unavailable');});
  }
  function destination(x,y){
    var el=document.elementFromPoint(x,y);if(!el)return null;
    if(el.closest('[data-gms-all]'))return {node:allTarget,targets:drag.targets};
    var hero=el.closest('#zg-irl-character-dock [data-gm-key]');
    var target=hero&&drag.targets.find(function(r){return r.key===hero.dataset.gmKey;});
    return target?{node:hero,targets:[target]}:null;
  }
  function open(){if(!panel)return;panel.hidden=false;launcher.setAttribute('aria-expanded','true');paintList();panel.querySelector('input[type=search]').focus();}
  function close(){closeCardMenu();document.querySelectorAll('dialog.gms-template').forEach(function(d){d.remove();});cancel();if(panel)panel.hidden=true;if(launcher)launcher.setAttribute('aria-expanded','false');}
  function init(){
    var table=document.querySelector('#page-gm-table .zg-irl-table');if(!table)return;
    launcher=document.createElement('button');launcher.type='button';launcher.className='gms-launcher';launcher.setAttribute('aria-controls','gms-library');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('data-zg-i18n-skip','');table.appendChild(launcher);
    panel=document.createElement('section');panel.id='gms-library';panel.className='gms-library';panel.hidden=true;panel.setAttribute('data-zg-i18n-skip','');panel.setAttribute('aria-labelledby','gms-title');table.appendChild(panel);
    allTarget=document.createElement('div');allTarget.className='gms-all';allTarget.dataset.gmsAll='';allTarget.hidden=true;allTarget.setAttribute('data-zg-i18n-skip','');table.appendChild(allTarget);
    resultBox=document.createElement('section');resultBox.className='gms-result';resultBox.hidden=true;resultBox.setAttribute('role','status');resultBox.setAttribute('aria-live','polite');resultBox.setAttribute('data-zg-i18n-skip','');panel.appendChild(resultBox);
    loadPreferences();
    function localize(){
      var restoredQuery=restorePreferences();
      cancel();launcher.textContent=t('Хранилище','Сховище');
      panel.innerHTML='<header><h2 id="gms-title">'+t('Хранилище','Сховище')+'</h2><button type="button" data-gms-close aria-label="'+t('Закрыть хранилище','Закрити сховище')+'">×</button></header><div class="gms-controls">'+sectionNavigation()+'<input type="search" autocomplete="off" placeholder="'+(kind==='items'?t('Найти предмет…','Знайти предмет…'):kind==='spells'?t('Найти способность…','Знайти здібність…'):kind==='special'?t('Найти…','Знайти…'):t('Найти статус…','Знайти стан…'))+'" aria-label="'+t('Поиск в хранилище','Пошук у сховищі')+'">'+filterMarkup()+'</div><div class="gms-list" data-gms-list></div><footer><label>'+t('Длительность','Тривалість')+'<select data-gms-unit><option value="default">'+t('По правилу статуса','За правилом стану')+'</option><option value="rounds">'+t('Раунды','Раунди')+'</option><option value="minutes">'+t('Минуты','Хвилини')+'</option><option value="hours">'+t('Часы','Години')+'</option><option value="days">'+t('Дни','Дні')+'</option><option value="manual">'+t('До снятия','До зняття')+'</option></select></label><input type="number" data-gms-duration min="1" max="999" value="3" hidden aria-label="'+t('Количество','Кількість')+'"></footer>';
      if(kind==='special')panel.querySelector('footer').innerHTML='<label>'+t('Уровней истощения каждому','Рівнів виснаження кожному')+'<input type="number" data-gms-levels min="1" max="5" value="1"></label>';
      if(['spells','documents','people','maps'].includes(kind))panel.querySelector('footer').innerHTML='';if(['spells','documents','people','maps'].includes(kind)){var create=document.createElement('button');create.type='button';create.dataset.templateNew='';create.textContent=kind==='people'?t('+ Создать контакт','+ Створити контакт'):kind==='maps'?t('+ Добавить карту','+ Додати мапу'):kind==='documents'?t('+ Создать документ','+ Створити документ'):t('+ Черта / мастерство','+ Риса / майстерність');panel.querySelector('.gms-controls').appendChild(create);}
      var nav=panel.querySelector('.gms-kinds');panel.insertBefore(nav,panel.querySelector('.gms-controls'));panel.querySelector('input[type=search]').placeholder=t('Найти…','Знайти…');panel.querySelector('input[type=search]').value=restoredQuery;
      if(kind==='items')panel.querySelector('footer').innerHTML='<label>'+t('Количество каждому','Кількість кожному')+'<input type="number" data-gms-qty min="1" max="999" value="1"></label>';
      panel.appendChild(resultBox);
      allTarget.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="9" r="4"/><path d="M9 26v-4a7 7 0 0 1 14 0v4M6 9a3 3 0 1 0 0 6m20-6a3 3 0 1 1 0 6M2 26v-4a5 5 0 0 1 5-5m23 9v-4a5 5 0 0 0-5-5"/></svg><b>'+t('Всем','Усім')+'</b><small></small>';
      allTarget.title=t('Всем персонажам на этом столе','Усім персонажам на цьому столі');paintList();closeCardMenu();
    }
    localize();launcher.addEventListener('click',function(){if(panel.hidden)open();else close();});
    document.addEventListener('pointerdown',function(e){
      var filter=panel.querySelector('.gms-people-filter[open]');
      if(filter&&!filter.contains(e.target))filter.open=false;
    });
    panel.addEventListener('keydown',function(e){
      var filter=e.target.closest('.gms-people-filter[open]');
      if(e.key==='Escape'&&filter){e.preventDefault();e.stopPropagation();filter.open=false;filter.querySelector('summary').focus();}
    });
    panel.addEventListener('input',function(e){if(e.target.type==='search'){savePreferences();paintList();}});
    panel.addEventListener('change',function(e){if(e.target.matches('[data-gms-category]')){category=e.target.value;activeKey='';savePreferences();closeCardMenu();paintList();}if(e.target.matches('[data-gms-unit]'))panel.querySelector('[data-gms-duration]').hidden=['default','manual'].includes(e.target.value);});
    panel.addEventListener('click',function(e){
      var button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-gms-close')){close();launcher.focus();}
      else if(button.hasAttribute('data-template-new'))editTemplate();
      else if(button.hasAttribute('data-person-filter')){
        category=button.dataset.personFilter;activeKey='';savePreferences();
        panel.querySelector('.gms-people-filter').outerHTML=peopleFilters();
        panel.querySelector('.gms-people-filter summary').focus();paintList();
      }
      else if(button.dataset.gmsInspect){
        var tile=Array.from(panel.querySelectorAll('[data-gms-drag]')).find(b=>b.dataset.gmsDrag===button.dataset.gmsInspect);
        closeCardMenu();if(tile)inspectCard(tile);
      }
      else if(button.dataset.templateDelete){closeCardMenu();confirmDelete(definition(button.dataset.templateDelete));}

      else if(button.dataset.contactUpdate)updateKnownContacts(button);
      else if(button.dataset.templateEdit){closeCardMenu();editTemplate(templates().find(function(d){return d.key===button.dataset.templateEdit;}));}
      else if(button.dataset.gmsKind&&!busy){savePreferences();kind=button.dataset.gmsKind;activeKey='';localize();savePreferences();}
      else if(button.hasAttribute('data-gms-favorites')){tab=tab==='favorites'?'all':'favorites';savePreferences();paintList();}
      else if(button.dataset.gmsStar){var fav=favorites(),key=button.dataset.gmsStar;try{localStorage.setItem(favoriteKey(),JSON.stringify(fav.includes(key)?fav.filter(function(k){return k!==key;}):fav.concat(key)));}catch(_){}paintList();}
      else if(button.dataset.gmsDrag){activeKey=button.dataset.gmsDrag;paintList();var tile=panel.querySelector('.is-selected [data-gms-drag]');if(['documents','maps'].includes(kind)&&tile)inspectCard(tile);}
    });
    panel.addEventListener('contextmenu',function(ev){
      var tile=ev.target.closest('.gms-tile')?.querySelector('[data-gms-drag]');if(!tile)return;
      ev.preventDefault();ev.stopPropagation();showCardMenu(tile,ev.clientX,ev.clientY);
    });
    function confirmDelete(def){document.querySelector('.gms-template-delete')?.remove();var menu=document.createElement('dialog');menu.className='gms-template gms-template-delete';menu.setAttribute('data-zg-i18n-skip','');menu.innerHTML='<strong>'+esc(label(def))+'</strong><p>'+t('Уже выданные записи останутся у игроков.','Вже надані записи залишаться у гравців.')+'</p><button data-delete>'+t('Удалить заготовку','Видалити заготовку')+'</button> <button data-cancel>'+t('Отмена','Скасувати')+'</button>';document.body.appendChild(menu);w.ZargotaGmTable.presentDialog(menu);menu.querySelector('[data-cancel]').onclick=function(){menu.remove();};menu.querySelector('[data-delete]').onclick=function(){try{localStorage.setItem(templatesKey(),JSON.stringify(templates().filter(function(d){return d.key!==def.key;})));menu.remove();activeKey='';paintList();closeCardMenu();}catch(_){menu.querySelector('p').textContent=t('Не удалось сохранить удаление.','Не вдалося зберегти видалення.');}};menu.oncancel=function(){menu.remove();};}
    panel.addEventListener('pointerdown',function(e){
      var button=e.target.closest('[data-gms-drag]');if(!button||e.button!==0||busy)return;
      var def=definition(button.dataset.gmsDrag),opts=def&&optionsFor(def);if(!opts){panel.querySelector(kind==='items'?'[data-gms-qty]':def?.key==='exhausted'?'[data-gms-levels]':'[data-gms-duration]')?.reportValidity();return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,def:def,options:opts,targets:targets(),started:false};button.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
      if(!drag.started){drag.started=true;document.body.classList.add('gms-dragging');allTarget.hidden=!drag.targets.length;refreshTargets();if(!drag.hooks){ghost=document.createElement('div');ghost.className='gms-ghost';ghost.innerHTML=glyph(drag.def)+'<span>'+esc(label(drag.def))+'</span>';document.body.appendChild(ghost);}}
      if(drag.hooks)drag.hooks.move(e.clientX,e.clientY);
      e.preventDefault();if(ghost){ghost.style.left=(e.clientX+16)+'px';ghost.style.top=(e.clientY-30)+'px';}clearHover();var dest=destination(e.clientX,e.clientY);dest?.node.classList.add('gms-drop-hover');
    },{passive:false});
    document.addEventListener('pointerup',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started){cancel();return;}
      var dest=destination(e.clientX,e.clientY),def=drag.def,opts=drag.options,prepared=drag.prepared,bundle=drag.bundle;drag.hooks?.drop(e.clientX,e.clientY,!!dest);suppressUntil=Date.now()+400;cancel();
      if(dest)deliver(def,dest.targets,opts,bundle);
      else if(!prepared)w.ZargotaTableObjects?.place(def,opts,e.clientX,e.clientY);
    });
    document.addEventListener('click',function(e){if(Date.now()<suppressUntil&&e.target.closest('[data-gms-drag],[data-table-object],#zg-irl-character-dock,[data-gms-all]')){suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('pointercancel',cancel);w.addEventListener('blur',cancel);
    document.addEventListener('visibilitychange',function(){if(document.hidden)cancel();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&(drag||!panel.hidden)){e.preventDefault();e.stopPropagation();if(panel.querySelector('.gms-card-menu:popover-open'))closeCardMenu();else if(drag)cancel();else{close();launcher.focus();}}},true);
    resultBox.addEventListener('click',function(e){if(e.target.closest('[data-gms-undo]'))undo();if(e.target.closest('[data-gms-result-close]'))resultBox.hidden=true;});
    document.addEventListener('zargota:localechange',function(){document.querySelectorAll('.gms-template').forEach(function(d){d.refreshLocale?.();});var query=panel.querySelector('input[type=search]').value,qty=panel.querySelector('[data-gms-qty]')?.value,unit=panel.querySelector('[data-gms-unit]')?.value,duration=panel.querySelector('[data-gms-duration]')?.value;localize();panel.querySelector('input[type=search]').value=query;if(qty)panel.querySelector('[data-gms-qty]').value=qty;if(unit){panel.querySelector('[data-gms-unit]').value=unit;panel.querySelector('[data-gms-duration]').value=duration;panel.querySelector('[data-gms-duration]').hidden=['default','manual'].includes(unit);}paintList();closeCardMenu();resultBox.hidden=true;});
    w.addEventListener('zargota:persistent-auth-change',function(){authEpoch++;close();receipts=[];resultBox.hidden=true;loadPreferences();localize();});
    new MutationObserver(function(){if(!document.body.classList.contains('zg-irl-table-view'))close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
    if(w.ZG_APP_CHANGELOG?.[0]){w.ZG_APP_CHANGELOG[0].notes+=' Редакторы контактов, способностей и документов показывают только язык сайта; при смене языка открытый редактор обновляется с сохранением черновика.';w.ZG_APP_CHANGELOG[0].notesUk+=' Редактори контактів, здібностей і документів показують лише мову сайту; під час зміни мови відкритий редактор оновлюється зі збереженням чернетки.';w.ZG_APP_CHANGELOG[0].notes+=' Фильтры хранилища сохраняются отдельно для вкладок и аккаунтов: избранное, поиск и категория. В особом можно выбрать от 1 до 5 выдаваемых уровней истощения.';w.ZG_APP_CHANGELOG[0].notesUk+=' Фільтри сховища зберігаються окремо для вкладок і акаунтів: обране, пошук і категорія. В особливому можна вибрати від 1 до 5 рівнів виснаження для надання.';
      w.ZG_APP_CHANGELOG[0].notes+=' Монеты со стола зачисляются в кошелёк. Принятие выдачи сопровождается звуком монет или предмета. Правый клик по предмету позволяет удалить выбранное количество, а старые стопки монет — перенести в кошелёк. Исправлено пустое название при отсутствии перевода.';
      w.ZG_APP_CHANGELOG[0].notes+=' В хранилище убраны кнопка выдачи и список получателей: предметы и статусы выдаются перетаскиванием, нажатие показывает описание.';
      w.ZG_APP_CHANGELOG[0].notes+=' Фильтры хранилища упрощены: категории предметов и компактная звезда избранного вместо второго ряда вкладок. Подписи следуют общему языку сайта.';
      w.ZG_APP_CHANGELOG[0].notes+=' На столе предметы открываются с крупным изображением, цветом редкости и выделением характеристик, без количества и действий инвентаря. Маска изображения работает и при локальном открытии файла; убраны полосы прокрутки в просмотре. Исправлено исчезновение изображения при обновлении листа и закрытие рисунков способностей.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' На столі предмети відкриваються з великим зображенням, кольором рідкісності та виділенням характеристик, без кількості й дій інвентарю. Маска зображення працює і під час локального відкриття файлу; прибрано смуги прокручування в перегляді. Виправлено зникнення зображення під час оновлення аркуша та закриття малюнків здібностей.';
      w.ZG_APP_CHANGELOG[0].notes+=' Исправлено масштабирование содержимого окон; убраны повторные заголовки и вложенные рамки. Исправлены значки особых карточек и длительность состояний.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Виправлено масштабування вмісту вікон; прибрано повторні заголовки та вкладені рамки. Виправлено значки особливих карток і тривалість станів.';
      w.ZG_APP_CHANGELOG[0].notes+=' Окна предметов, документов, способностей и состояний не размывают и не блокируют стол. Все окна перемещаются за верхнюю область с захватом и масштабируются за угол.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Вікна предметів, документів, здібностей і станів не розмивають і не блокують стіл. Усі вікна пересуваються за верхню область із захватом і масштабуються за кут.';
      w.ZG_APP_CHANGELOG[0].notes+=' Карточки на столе открывают общий просмотр игрока: предметы с редкостью, способности с вкладками, состояния и документы с анимацией. Просмотр не изменяет листы.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Картки на столі відкривають спільний перегляд гравця: предмети з рідкістю, здібності з вкладками, стани та документи з анімацією. Перегляд не змінює аркуші.';
      w.ZG_APP_CHANGELOG[0].notes+=' Название и тип карточки на столе показываются через секунду наведения без нажатия.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Назва й тип картки на столі показуються через секунду наведення без натискання.';
      w.ZG_APP_CHANGELOG[0].notes+=' Управление контактами, документами, способностями и предметами открывается шестерёнкой рядом с закрытием окна.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Керування контактами, документами, здібностями та предметами відкривається шестірнею поруч із закриттям вікна.';
      w.ZG_APP_CHANGELOG[0].notes+=' Контакты: роль и последнее известное место; повторная выдача обновляет общие сведения, сохраняя отношения и личные заметки. Доступно обновление уже знакомых героев на столе.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Контакти: роль і останнє відоме місце; повторне надання оновлює спільні відомості, зберігаючи стосунки й особисті нотатки. Доступне оновлення вже знайомих героїв на столі.';
      w.ZG_APP_CHANGELOG[0].notes+=' Хранилище: разделы перенесены в левое меню, добавлены контакты мастера и отдельный каталог карт; записки остаются в документах с фильтром по типу.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Сховище: розділи перенесено в ліве меню, додано контакти майстра й окремий каталог мап; записки залишаються в документах із фільтром за типом.';
      w.ZG_APP_CHANGELOG[0].notes+=' Письма, записки и карты раскрываются с анимацией и звуком бумаги; настройка уменьшения движения учитывается.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Листи, записки та мапи розгортаються з анімацією і звуком паперу; налаштування зменшення руху враховано.';
      w.ZG_APP_CHANGELOG[0].notes+=' Создание документов стало компактнее; добавлены текстура бумаги, образцы оформления и удаление заготовок правым кликом. Исправлено уменьшение карточек до удобной иконки.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Створення документів стало компактнішим; додано текстуру паперу, зразки оформлення та видалення заготовок правим кліком. Виправлено зменшення карток до зручної іконки.';
      w.ZG_APP_CHANGELOG[0].notes+=' В хранилище добавлены предметы из общего каталога: выдача перетаскиванием одному или всем, с количеством каждому. Полученные предметы показываются в листе игрока на весь экран, со стрелками и кнопкой «Принять»; непросмотренные выдачи сохраняются до следующего входа.';
      w.ZG_APP_CHANGELOG[0].notes+=' На столе мастера добавлено хранилище статусов с поиском, избранным и длительностью. Статус можно перетащить на героя или на временную зону «Всем» слева; сохранение подтверждается для каждого листа, успешная выдача проходит без всплывающего отчёта. Игрок видит сверху значок полученного состояния, название и длительность; правый клик по состоянию в листе открывает «Убрать». На столе отключено меню браузера, в мобильных листах — случайное выделение; поля ввода сохраняют выделение и вставку. Обновления содержимого доступны через восклицательный знак на характеристиках; большой баннер и уведомления о HP убраны. На телефоне после перезапуска восстанавливаются последний лист и вкладка, если версия сайта не изменилась.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Монети зі столу зараховуються до гаманця. Прийняття надходження супроводжується звуком монет або предмета. Правий клік по предмету дозволяє видалити вибрану кількість, а старі стоси монет — перенести до гаманця. Виправлено порожню назву за відсутності перекладу.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' У сховищі прибрано кнопку надання та список одержувачів: предмети й стани надаються перетягуванням, натискання показує опис.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Фільтри сховища спрощено: категорії предметів і компактна зірка обраного замість другого ряду вкладок. Підписи відповідають загальній мові сайту.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' У сховищі додано предмети зі спільного каталогу: надання перетягуванням одному або всім, із кількістю кожному. Отримані предмети показуються в аркуші гравця на весь екран, зі стрілками та кнопкою «Прийняти»; непереглянуті надходження зберігаються до наступного входу.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' На столі майстра додано сховище станів із пошуком, обраним і тривалістю. Стан можна перетягнути на героя або на тимчасову зону «Усім» ліворуч; збереження підтверджується для кожного аркуша, успішне надання відбувається без спливного звіту. Гравець бачить угорі значок отриманого стану, назву й тривалість; правий клік по стану в аркуші відкриває «Прибрати». На столі вимкнено меню браузера, у мобільних аркушах — випадкове виділення; поля введення зберігають виділення та вставлення. Оновлення вмісту доступні через знак оклику на характеристиках; великий банер і сповіщення про HP прибрано. На телефоні після перезапуску відновлюються останній аркуш і вкладка, якщо версія сайту не змінилася.';
    }
  }
  w.ZargotaGmStatusLibrary={abilityCatalog:abilityCatalog,lookup:function(section,key){return catalog(section).find(function(s){return s.key===key;});},label:label,glyph:glyph,description:description,beginPrepared:function(event,section,key,options,hooks,bundle){if(busy)return;var def=catalog(section).find(function(s){return s.key===key;});if(!def)return;var operations=(bundle||[{kind:section,key:key,options:options}]).map(function(entry){return {def:catalog(entry.kind).find(function(d){return d.key===entry.key;}),options:JSON.parse(JSON.stringify(entry.options))};});if(operations.some(function(entry){return !entry.def;})){w.showToast?.(t('Часть выбранных карточек больше недоступна в каталоге.','Частина вибраних карток більше недоступна в каталозі.'));return;}drag={id:event.pointerId,x:event.clientX,y:event.clientY,def:def,options:JSON.parse(JSON.stringify(options)),targets:targets(),started:false,prepared:true,hooks:hooks,bundle:operations};event.target.closest('[data-table-object],[data-folder-entry]')?.setPointerCapture(event.pointerId);},cancelDrag:cancel,open:open,close:close,refreshTargets:refreshTargets,isActive:function(){return !!drag||!!panel&&!panel.hidden;}};
  if(document.readyState==='complete')init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
