(function(w){
  'use strict';
  var C=w.ZargotaPersistentCore,key='zargota_persistent_characters_v1',state={enabled:false,accounts:{}},transport,uid='',records={},stops=[],starting=null,error='',sendTimers={},sending={},account={role:'visitor'};
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function newId(){return Array.from(w.crypto.getRandomValues(new Uint8Array(16)),function(b){return b.toString(16).padStart(2,'0');}).join('');}
  try{var old=JSON.parse(localStorage.getItem(key)||'null');if(old&&old.accounts)state=old;}catch(_){}
  uid=state.activeUid||'';records=state.accounts[uid]||{};Object.values(records).forEach(function(e){e.localSaving=0;e.dirtyInput=false;});
  var cacheWrite=Promise.resolve(),cacheReady=false;
  var boot=w.ZargotaPersistentCache.read().then(function(saved){if(saved&&saved.accounts){state=saved;uid=state.activeUid||'';records=state.accounts[uid]||{};}Object.values(records).forEach(function(e){e.localSaving=0;e.dirtyInput=false;e.presence={};});account=state.identities&&state.identities[uid]||{role:'visitor'};cacheReady=true;});
  function persist(){
    if(uid){state.activeUid=uid;state.accounts[uid]=records;}
    cacheWrite=w.ZargotaPersistentCache.write(state);
    cacheWrite.catch(function(){error=t('Не удалось сохранить черновик на устройстве. Не закрывайте страницу.','Не вдалося зберегти чернетку на пристрої. Не закривайте сторінку.');render();});
    return true;
  }
  function character(id){return (w.characters||[]).find(function(c){return String(c.id)===String(id);});}
  function binding(id){return state.enabled&&Object.keys(records).find(function(sid){return String(records[sid].localId)===String(id);});}
  // The in-person table observes the same acknowledged sheet as the player.
  // Cached presence alone must never unlock an edit after a reload or account change.
  var tableSeen=new Set(),tableWrites=new Set(),tablePackets=new WeakMap(),incomingTasks=new Map();
  var subscribedUid='',retryAttempts={},authGeneration=0,revealedCodes={};
  function tableHero(sid){
    var e=records[sid];
    if(!state.enabled||account.role!=='admin'||!e||!e.allowed||e.role!=='master'||!e.meta||e.meta.ownerUid!==uid||!e.base||e.localId==null)return null;
    var c=tablePackets.get(e.base);
    if(!c){
      var raw=JSON.parse(e.base.characterJson);
      c={id:e.localId,campaignKey:raw.campaignKey||'',name:raw.name,hpCur:raw.hpCur,hpMax:raw.hpMax,ac:raw.ac};
      tablePackets.set(e.base,c);
    }
    var presence=e.presence||{},connected=navigator.onLine&&transport&&transport.uid()===uid&&Object.keys(presence[uid]||{}).length;
    var status=!navigator.onLine?'offline':error||e.error?'error':!tableSeen.has(e)?'loading':!connected?'offline':e.conflict||e.remote?'conflict':tableWrites.has(e)||e.pending||e.localSaving||e.dirtyInput||editing(e)||inSession(e)?'pending':'ready';
    return {id:e.localId,localId:e.localId,sheetId:sid,name:c.name,character:c,state:status,ready:status==='ready',online:!!(connected&&Object.keys(presence[e.meta.playerUid]||{}).length)};
  }
  function tableHeroes(){return Object.keys(records).map(tableHero).filter(Boolean);}
  function tableHp(localId,delta){
    var row=tableHeroes().find(function(hero){return String(hero.localId)===String(localId);}),sid=row&&row.sheetId;
    if(!row||!row.ready||(delta!==1&&delta!==-1))return false;
    var e=records[sid],base=e.base,next=JSON.parse(base.characterJson),max=Number(next.hpMax),hp=Number(next.hpCur==null?max:next.hpCur);
    if(!Number.isFinite(max)||!Number.isFinite(hp)||max<1)return false;
    next.hpCur=Math.max(0,Math.min(max,hp+delta));if(next.hpCur===hp)return false;
    tableWrites.add(e);render();
    // Send only an HP change based on a known server version, never unrelated local edits.
    transport.call({action:'save',sheetId:sid,operationId:newId(),expectedRevision:base.revision,source:'sheet',character:next})
      .then(function(result){return receiveInOrder(sid,e,result.state);})
      .catch(function(err){
        if(!state.enabled||records[sid]!==e)return;
        var msg=/revision-conflict/.test(String(err&&err.message||err))?t('Лист уже изменился. Проверьте HP перед повтором.','Аркуш уже змінився. Перевірте HP перед повтором.'):t('Нет подтверждения изменения HP. Проверьте значение после подключения.','Немає підтвердження зміни HP. Перевірте значення після підключення.');
        if(w.showToast)w.showToast(msg);
      }).finally(function(){tableWrites.delete(e);render();});
    return true;
  }
  function receiveInOrder(sid,e,packet){
    var task=(incomingTasks.get(e)||Promise.resolve()).catch(function(){}).then(function(){
      if(state.enabled&&records[sid]===e&&packet)return receive(sid,packet);
    });
    incomingTasks.set(e,task);
    return task.finally(function(){if(incomingTasks.get(e)===task)incomingTasks.delete(e);});
  }
  function editing(entry){
    var editor=document.getElementById('char-editor-view');
    if(editor && editor.style.display!=='none' && String(w.editingCharId)===String(entry.localId))return true;
    if(String(w.viewingCharId)!==String(entry.localId))return false;
    if(document.getElementById('zgmo-number-pad'))return true;
    var active=document.activeElement;
    return !!(active && active.closest('#char-sheet') && active.matches('input:not([readonly]), textarea:not([readonly]), select'));
  }
  function inSession(entry){var snap=w.ZargotaRooms&&w.ZargotaRooms.getSnapshot(),s=snap&&snap.session,m=s&&snap.room&&snap.room.members&&snap.room.members[s.uid];return !!(m&&(String(m.characterId)===String(entry.localId)||entry.remoteKey&&m.campaignKey===entry.remoteKey));}
  function explain(e){
    var text=String(e&&e.message||e),code=String(e&&e.code||'');
    if(/persistent-backend-not-enabled/.test(text))return t('Вход по кодам ещё не включён на этом сайте. Разделы сайта доступны без входа.','Вхід за кодами ще не ввімкнено на цьому сайті. Розділи сайту доступні без входу.');
    if(/leave-session-before-linking/.test(text))return t('Сначала выйдите из онлайн-игры, затем выдайте код.','Спочатку вийдіть з онлайн-гри, потім видайте код.');
    if(/unsent-character-changes/.test(text))return t('Сначала сохраните правки или разрешите конфликт версии.','Спочатку збережіть правки або розв’яжіть конфлікт версії.');
    if(/wait-for-remote/.test(text))return t('Новая версия ещё загружается. Попробуйте ещё раз.','Нова версія ще завантажується. Спробуйте ще раз.');
    if(/resource-exhausted|try-later/.test(code+' '+text))return t('Слишком много попыток входа. Попробуйте через 10 минут.','Забагато спроб входу. Спробуйте через 10 хвилин.');
    if(/invalid-character/.test(text))return t('Не удалось подключить лист: проверьте значения в редакторе персонажа. Ваши данные сохранены.','Не вдалося підключити аркуш: перевірте значення в редакторі персонажа. Ваші дані збережено.');
    if(/invalid-code/.test(text))return t('Код не найден. Проверьте его у мастера.','Код не знайдено. Перевірте його в майстра.');
    if(/revision-conflict/.test(text))return t('Лист уже изменён на другом устройстве. Ваши правки сохранены отдельно.','Аркуш уже змінено на іншому пристрої. Ваші правки збережено окремо.');
    if(/permission-denied|access-denied/.test(code+' '+text))return t('Нет доступа к этому листу.','Немає доступу до цього аркуша.');
    if(/character-too-large/.test(text))return t('Лист слишком большой для отправки. Уменьшите встроенные изображения.','Аркуш завеликий для надсилання. Зменште вбудовані зображення.');
    if(/unsafe-character-content/.test(text))return t('В листе есть неподдерживаемая разметка или ссылка. Проверьте вставленный текст и изображения.','В аркуші є непідтримувана розмітка або посилання. Перевірте вставлений текст і зображення.');
    return t('Постоянные листы сейчас недоступны. Локальные данные сохранены; попробуйте подключиться позже.','Постійні аркуші зараз недоступні. Локальні дані збережено; спробуйте приєднатися пізніше.');
  }
  function failed(e){error=explain(e);render();var alert=document.querySelector('#persistent-character-dialog [role=alert]')||document.querySelector('#pc-account-popover [role=alert]')||document.querySelector('#pc-control-accounts [role=alert]');if(alert)alert.textContent=error;}
  function redraw(id){
    if(w.charView==='sheet'){
      if((id==null||String(w.viewingCharId)===String(id))&&typeof w.renderCharSheet==='function')w.renderCharSheet();
    }else if(w.charView==='list'&&typeof w.renderCharList==='function')w.renderCharList();
    render();
  }
  function markup(node,html){
    if(w.ZargotaMobileSheet)w.ZargotaMobileSheet.updateMarkup(node,html);
    else if(node.innerHTML!==html)node.innerHTML=html;
  }
  async function apply(sid,packet,initial,merged){
    var generation=authGeneration,entry=records[sid];if(!state.enabled||!entry)return;
    var remote=JSON.parse(packet.characterJson),before=character(entry.localId),value=C.clone(merged||remote);
    value.id=entry.localId;value._updatedAt=Date.now();value.revision=Math.max(Number(before&&before.revision)||0,packet.revision)+1;
    var result=await w.ZargotaCharacterStore.saveCharacter(value.id,value,w.characters,{replace:true});
    // A delayed local write must not repaint a sheet after a cross-tab signout.
    if(generation!==authGeneration||!state.enabled||records[sid]!==entry)return;
    if(!result.ok)throw Error('local-storage-failed');
    // The user may start typing while IndexedDB is writing the incoming packet.
    // Restore the local snapshot and defer instead of replacing that new input.
    if(!initial&&(editing(entry)||entry.localSaving||entry.dirtyInput)){
      var local=character(entry.localId);
      if(local)await w.ZargotaCharacterStore.saveCharacter(local.id,local,w.characters,{replace:true});
      if(generation!==authGeneration||!state.enabled||records[sid]!==entry)return;
      entry.remote=C.clone(packet);persist();render();return;
    }
    var index=w.characters.findIndex(function(c){return String(c.id)===String(value.id);});if(index<0)w.characters.push(value);else w.characters[index]=value;
    entry.base=C.clone(packet);entry.remote=null;entry.draft=null;entry.conflict=false;
    if(merged){entry.pending=null;entry.error='';C.draft(entry,value,newId,entry.source);}
    if(!persist())return;
    if(!initial&&before&&packet.updatedBy!==uid&&w.ZargotaCharacterUpdates)w.ZargotaCharacterUpdates.receive({characterId:value.id,before:before,after:value,channel:'cloud',revision:'persistent:'+sid+':'+packet.revision,author:packet.writerRole==='master'?'master':'shared'});
    redraw(value.id);
    if(merged&&entry.pending)queue(sid);
  }
  async function receive(sid,packet){
    if(!state.enabled||!packet)return;
    var entry=records[sid];if(!entry)return;
    if(entry.base&&!character(entry.localId)){await apply(sid,packet,true);return;}
    if(!entry.base){
      var remote=JSON.parse(packet.characterJson),local=character(remote.id),collision=Object.keys(records).some(function(k){return k!==sid&&String(records[k].localId)===String(remote.id);});
      entry.remoteId=remote.id;entry.remoteKey=remote.campaignKey||'';
      entry.localId=collision||local&&local.name!==remote.name?Date.now():remote.id;
      if(character(entry.localId))entry.backup=C.clone(character(entry.localId));
      await apply(sid,packet,true);return;
    }
    var busy=editing(entry)||entry.localSaving||entry.dirtyInput||inSession(entry)||sending[sid];
    var action=C.incoming(entry,packet,busy);
    if(action==='apply')await apply(sid,packet,false);
    else if(action==='deferred'){
      var merged=!busy&&C.mergeRemote(entry,packet,character(entry.localId));
      if(merged)await apply(sid,packet,false,merged);else{persist();render();}
    }
    else if((action==='same'||action==='own')&&entry.pending)queue(sid);
  }
  function stop(){if(w.ZargotaPlayerMessages)w.ZargotaPlayerMessages.stop();stops.forEach(function(fn){fn();});stops=[];subscribedUid='';tableSeen.clear();Object.values(sendTimers).forEach(clearTimeout);sendTimers={};retryAttempts={};}
  async function connect(){
    if(starting)return starting;
    starting=(async function(){
      await boot;
      await Promise.resolve(w.zgCharacterLoadPromise);
      var generation=authGeneration,api=await w.ZargotaPersistentTransport.start();
      if(generation!==authGeneration||!state.enabled)return;
      var nextUid=api.uid(),ids=await api.list(),identity=await api.account();
      if(generation!==authGeneration||!state.enabled||api.uid()!==nextUid)return;
      transport=api;uid=nextUid;records=state.accounts[uid]||{};account=identity;state.identities=state.identities||{};state.identities[uid]=account;stop();
      // Records lost through revocation are retained as local backups but never sent.
      Object.keys(records).forEach(function(id){records[id].allowed=!!ids[id];});
      for(let sid of Object.keys(ids)){
        records[sid]=records[sid]||{};records[sid].role=ids[sid];records[sid].allowed=true;
        var meta=await transport.meta(sid);if(generation!==authGeneration||!state.enabled)return;records[sid].meta=meta;
        var local=character(records[sid].localId);
        if(records[sid].base&&local)C.draft(records[sid],local,newId,'sheet');
        let watched=records[sid];
        stops.push(transport.watch(sid,function(packet){
          if(!packet||records[sid]!==watched)return;
          receiveInOrder(sid,watched,packet).then(function(){if(state.enabled&&records[sid]===watched){tableSeen.add(watched);render();}}).catch(failed);
        },failed));
        stops.push(transport.watchMeta(sid,function(meta){if(records[sid]===watched){watched.meta=meta;render();}},failed));
        stops.push(transport.watchLastSeen(sid,function(value){if(records[sid]===watched){watched.lastSeen=value;render();}},failed));
        if(records[sid].role==='master')stops.push(transport.watchActivity(sid,function(value){if(records[sid]===watched){watched.activity=value;render();}},failed));
        stops.push(transport.presence(sid,function(value){if(records[sid]===watched){watched.presence=value;render();}},function(){if(records[sid]===watched){watched.presence={};render();}}));
      }
      if(w.ZargotaPlayerMessages)w.ZargotaPlayerMessages.start(api,uid,ids,function(sid){var c=records[sid]&&character(records[sid].localId);return c&&c.name;});
      subscribedUid=uid;error='';persist();render();return records;
    })().finally(function(){starting=null;});return starting;
  }
  async function enable(){await boot;state.enabled=true;persist();return connect();}
  async function login(code,originDialog){
    await boot;var generation=authGeneration;
    if(starting)await starting.catch(function(){});
    if(generation!==authGeneration)return;
    if(hasUnsaved())throw Error('unsent-character-changes');
    var api=await w.ZargotaPersistentTransport.start();
    if(generation!==authGeneration)return;
    transport=api;var identity=await api.login(code);
    if(generation!==authGeneration)return;
    stop();uid='';records={};state.enabled=true;persist();await connect();
    await openOwnSheet(identity&&identity.sheetId,originDialog);
  }
  async function create(localId){
    await enable();var c=character(localId);if(!c||c.type==='npc')throw Error('character-missing');
    var sid=binding(localId);if(sid)return transport.call({action:'code',sheetId:sid});
    if(w.ZargotaRooms.getSnapshot().session)throw Error('leave-session-before-linking');
    state.creating=state.creating||{};sid=state.creating[uid+':'+localId]||newId();state.creating[uid+':'+localId]=sid;persist();
    var copy=C.clean(c);copy.campaignKey=copy.campaignKey||'persistent-'+sid;
    var result=await transport.call({action:'create',sheetId:sid,character:copy});
    records[sid]={localId:c.id,remoteId:copy.id,remoteKey:copy.campaignKey,role:'master',allowed:true,meta:result.meta,backup:C.clone(c)};
    await apply(sid,result.state,true);delete state.creating[uid+':'+localId];persist();await connect();return result;
  }
  function queue(sid,delay){clearTimeout(sendTimers[sid]);sendTimers[sid]=setTimeout(function(){flush(sid).catch(failed);},delay==null?650:delay);}
  async function flush(sid){
    var entry=records[sid];if(!state.enabled||!navigator.onLine||!transport||!entry||!entry.allowed||entry.conflict||!entry.pending||sending[sid])return;
    try{await cacheWrite;}catch(_){return;}
    if(!state.enabled||records[sid]!==entry||!entry.pending||entry.conflict||sending[sid])return;
    sending[sid]=true;entry.error='';render();
    var pending=C.clone(entry.pending);
    try{
      var result=await transport.call(Object.assign({action:'save',sheetId:sid},pending));
      C.acknowledged(entry,result.state,newId);delete retryAttempts[sid];error='';persist();
    }catch(e){
      entry.error=explain(e);if(/revision-conflict/.test(String(e&&e.message))){entry.conflict=true;try{entry.remote=await transport.read(sid);}catch(_){};}
      else if(state.enabled&&records[sid]===entry&&navigator.onLine&&/unavailable|deadline-exceeded|network-request-failed/.test(String(e&&e.code))){
        var attempt=retryAttempts[sid]=(retryAttempts[sid]||0)+1;
        queue(sid,Math.min(60000,1500*Math.pow(2,Math.min(attempt,6))));
      }
      persist();
    }finally{
      delete sending[sid];
      if(state.enabled&&records[sid]===entry&&entry.remote)await receiveInOrder(sid,entry,entry.remote);
      render();if(entry.pending&&!entry.conflict&&!entry.error)queue(sid);
    }
  }
  function saved(chars,options){
    if(!cacheReady){boot.then(function(){saved(chars,options);});return;}
    if(!state.enabled)return;
    var changed=false;
    Object.keys(records).forEach(function(sid){
      var entry=records[sid],c=chars.find(function(v){return String(v.id)===String(entry.localId);});
      if(!entry.allowed||!entry.base||!c)return;
      entry.localSaving=Math.max(0,(entry.localSaving||0)-1);entry.dirtyInput=false;
      // A remote snapshot received during a form edit must be reviewed before sending the old form.
      if(entry.remote&&entry.remote.revision>entry.base.revision)entry.conflict=true;
      C.draft(entry,c,newId,options&&options.sync===false?'session':'sheet');
      changed=true;if(entry.pending&&!entry.conflict)queue(sid);
    });if(changed)persist();render();resume().catch(failed);
  }
  async function resume(){
    if(!state.enabled)return;
    for(var sid of Object.keys(records)){
      var entry=records[sid];
      if(entry.remote&&!entry.localSaving&&!entry.dirtyInput&&!editing(entry)&&!inSession(entry)&&!sending[sid])await receiveInOrder(sid,entry,entry.remote);
    }
  }
  function status(entry,sid){
    if(!entry.allowed)return t('Доступ закрыт','Доступ закрито');
    if(error)return error;
    if(entry.conflict)return t('Есть другая версия · ваши правки сохранены','Є інша версія · ваші правки збережено');
    if(entry.remote)return inSession(entry)?t('Есть обновление · применится после игры','Є оновлення · застосуються після гри'):t('Есть обновление · завершите ввод','Є оновлення · завершіть введення');
    if(entry.error)return entry.error;
    if(sending[sid]||entry.pending)return navigator.onLine?t('Сохраняется…','Зберігається…'):t('Нет сети · правки на устройстве','Немає мережі · правки на пристрої');
    return t('Сохранено','Збережено');
  }
  function button(action,label,attrs){return '<button type="button" data-pc-action="'+action+'" '+(attrs||'')+'>'+label+'</button>';}
  function dialog(title,body){
    closeAccountMenu();
    var old=document.getElementById('persistent-character-dialog');if(old)old.close();
    var el=document.createElement('dialog');el.id='persistent-character-dialog';el.setAttribute('aria-labelledby','pc-dialog-title');el.setAttribute('data-zg-i18n-skip','');
    el.innerHTML=button('close','×','class="pc-dialog-close" aria-label="'+t('Закрыть','Закрити')+'"')+'<h2 id="pc-dialog-title">'+esc(title)+'</h2>'+body+'<p role="alert" aria-live="polite"></p>';
    document.body.appendChild(el);el.addEventListener('close',function(){el.remove();});
    el.addEventListener('click',function(ev){if(ev.target===el){var r=el.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)el.close();}});
    el.showModal();return el;
  }
  var selectedAccount='',accountAnchor=null;
  function closeAccountMenu(){var p=document.getElementById('pc-account-popover');if(p)p.remove();if(accountAnchor){accountAnchor.setAttribute('aria-expanded','false');accountAnchor=null;}}
  function accountMenu(anchor){
    closeAccountMenu();var items=accountItems(),item=items.find(function(i){return String(i.hero.id)===String(w.viewingCharId);})||items[0],logged=state.enabled&&account.role!=='visitor';
    var text=logged&&item?status(records[item.sid],item.sid):t('На этом устройстве','На цьому пристрої');
    var el=document.createElement('section');el.id='pc-account-popover';el.setAttribute('role','dialog');el.setAttribute('aria-label',t('Мой персонаж','Мій персонаж'));el.setAttribute('data-zg-i18n-skip','');
    if(!item)item={hero:character(w.viewingCharId)};
    el.innerHTML=button('close-account','×','class="pc-dialog-close" aria-label="'+t('Закрыть','Закрити')+'"')+w.ZargotaAccountViews.accountMenu(item,text,logged)+ '<p role="alert" aria-live="polite"></p>';
    document.body.appendChild(el);accountAnchor=anchor;if(anchor)anchor.setAttribute('aria-expanded','true');
    var close=el.querySelector('[data-pc-action="close-account"]');if(close)close.focus({preventScroll:true});
  }
  function hasUnsaved(){return Object.values(records).some(function(e){return e.pending||e.localSaving||e.dirtyInput||e.conflict||editing(e);})||Object.keys(sending).length>0||tableWrites.size>0;}
  async function logout(){
    await boot;if(starting)await starting.catch(function(){});
    if(hasUnsaved())throw Error('unsent-character-changes');
    authGeneration++;revealedCodes={};
    await cacheWrite;
    if(!transport&&w.ZargotaPersistentTransport.available())transport=await w.ZargotaPersistentTransport.start();
    if(transport&&transport.logout)await transport.logout();
    stop();state.enabled=false;state.activeUid='';uid='';records={};account={role:'visitor'};transport=null;error='';persist();await cacheWrite;
    closeAccountMenu();var el=document.getElementById('persistent-character-dialog');if(el)el.close();
    var panel=document.getElementById('zg-net-monitor-panel');if(panel)panel.classList.remove('pc-players-open');
    redraw();
  }
  function accountItems(){
    return Object.keys(records).filter(function(sid){return records[sid].allowed&&character(records[sid].localId);}).map(function(sid){
      var entry=records[sid],playerUid=entry.meta&&entry.meta.playerUid;
      var activity=entry.activity||{};
      return {sid:sid,code:revealedCodes[sid],hero:character(entry.localId),online:navigator.onLine&&!!(entry.presence&&entry.presence[playerUid]&&Object.keys(entry.presence[playerUid]).length),lastSeen:entry.lastSeen&&entry.lastSeen[playerUid],unread:entry.role==='master'&&(activity.lastPlayerRevision||0)>(activity.seenRevision||0)};
    });
  }
  function paintAccounts(){
    if(account.role!=='admin')return;
    var items=accountItems();if(!items.some(function(i){return i.sid===selectedAccount;}))selectedAccount=items[0]&&items[0].sid||'';
    var list=document.getElementById('pc-account-list');if(!list)return;
    document.querySelectorAll('[data-pc-player-count]').forEach(function(el){el.textContent=items.length;});
    var html=w.ZargotaAccountViews.roster(items,selectedAccount);
    if(!list.contains(document.activeElement))markup(list,html);
    var detail=document.getElementById('pc-account-detail');
    if(detail&&!detail.contains(document.activeElement)){var body=w.ZargotaAccountViews.accountDetail(items.find(function(i){return i.sid===selectedAccount;}));markup(detail,body);}
  }
  function controlTabs(){
    var panel=document.getElementById('zg-net-monitor-panel');if(!panel)return;
    // Accounts and the gear have distinct entry points; do not duplicate settings inside accounts.
    var tabs=document.getElementById('pc-control-tabs');if(tabs)tabs.remove();
    if(!state.enabled||account.role!=='admin')panel.classList.remove('pc-players-open');
    var title=panel.querySelector('.zg-net-monitor-head b');
    if(title)title.textContent=panel.classList.contains('pc-players-open')?t('Игроки','Гравці'):t('Центр управления','Центр керування');
  }
  function showGeneralSettings(){
    var panel=document.getElementById('zg-net-monitor-panel');
    if(panel)panel.classList.remove('pc-players-open');
    controlTabs();
  }
  function showAccounts(){
    closeAccountMenu();var admin=account.role==='admin',items=accountItems();
    if(!items.some(function(i){return i.sid===selectedAccount;}))selectedAccount=items[0]&&items[0].sid||'';
    var body=admin?w.ZargotaAccountViews.accounts(items,selectedAccount):w.ZargotaAccountViews.mine(items);
    var panel=document.getElementById('zg-net-monitor-panel'),header=document.getElementById('header');
    if(admin&&panel&&header&&header.clientHeight&&w.matchMedia('(min-width:701px)').matches){
      var old=document.getElementById('persistent-character-dialog');if(old)old.close();
      var host=document.getElementById('pc-control-accounts');if(!host){host=document.createElement('section');host.id='pc-control-accounts';host.setAttribute('data-zg-i18n-skip','');panel.appendChild(host);}
      host.innerHTML=body+'<p role="alert" aria-live="polite"></p>';panel.classList.add('pc-players-open');controlTabs();
      if(w.zgSessionMonitorToggle)w.zgSessionMonitorToggle(null,true);
    }else{var el=dialog(admin?t('Игроки','Гравці'):t('Мой аккаунт','Мій акаунт'),body);el.classList.add('pc-accounts-dialog');}
  }
  function showCreatedAccount(localId,result){
    selectedAccount=binding(localId);revealedCodes={};
    if(selectedAccount)revealedCodes[selectedAccount]=result.code;
    var el=document.getElementById('persistent-character-dialog');if(el)el.close();
    showAccounts();
  }
  function openLocalRoster(){
    w.showPage('characters');
    w.showCharView('list');
    if(w.showToast)w.showToast(t('Выберите персонажа на этом устройстве.','Виберіть персонажа на цьому пристрої.'));
  }
  async function openOwnSheet(requestedId,originDialog){
    await boot;
    await w.zgCharacterLoadPromise;
    if(originDialog&&!originDialog.open)return;
    var available=w.ZargotaPersistentTransport.available()&&navigator.onLine;
    if(state.enabled&&available&&starting&&(account.role==='visitor'||!Object.keys(records).length)){
      try{await starting;}catch(_){}
      if(originDialog&&!originDialog.open)return;
    }
    if(!state.enabled||account.role==='visitor'){
      if(available)menu();else openLocalRoster();
      return;
    }
    if(account.role==='admin'){showAccounts();return;}
    var mine=Object.keys(records).filter(function(id){return records[id].allowed&&records[id].role==='player';});
    var sid=requestedId||(mine.length===1?mine[0]:null);
    if(!mine.includes(sid)){showAccounts();return;}
    var entry=records[sid],waitDialog=originDialog;
    if(!entry.base||!character(entry.localId)){
      if(!available){openLocalRoster();return;}
      if(!waitDialog)waitDialog=dialog(t('Лист персонажа','Аркуш персонажа'),'<p role="status">'+t('Открываем ваш лист…','Відкриваємо ваш аркуш…')+'</p>');
      if(!transport||subscribedUid!==uid)await connect();
      if(!waitDialog.open||records[sid]!==entry||!entry.allowed)return;
      if(!entry.base||!character(entry.localId)){
        var packet=await transport.read(sid);
        if(!packet)throw Error('wait-for-remote');
        await receiveInOrder(sid,entry,packet);
      }
    }
    if((waitDialog&&!waitDialog.open)||!state.enabled||records[sid]!==entry||!entry.allowed)return;
    if(!character(entry.localId))throw Error('wait-for-remote');
    if(waitDialog)waitDialog.close();
    w.showPage('characters');
    w.openCharSheet(entry.localId);
  }
  function menu(){
    var el=dialog(t('Ваш персонаж','Ваш персонаж'),w.ZargotaAccountViews.login(w.ZargotaPersistentTransport.available()));
    el.classList.add('pc-login-dialog');
  }
  async function settings(){
    await boot;
    if(!state.enabled||account.role==='visitor'){menu();return;}
    showAccounts();
  }
  function showCode(code,master){dialog(master?t('Код администратора','Код адміністратора'):t('Код входа игрока','Код входу гравця'),'<p>'+ (master?t('Этот код открывает ваш аккаунт администратора и листы игроков. Не передавайте его игрокам.','Цей код відкриває ваш акаунт адміністратора й аркуші гравців. Не передавайте його гравцям.'):t('Передайте этот код игроку. Ввести его нужно один раз на каждом устройстве.','Передайте цей код гравцеві. Ввести його потрібно один раз на кожному пристрої.'))+'</p><input id="persistent-issued-code" type="password" readonly value="'+esc(code)+'" aria-label="'+t('Постоянный код','Постійний код')+'">'+button('reveal-code',t('Показать','Показати'))+button('copy',t('Скопировать','Скопіювати'))+button('settings',t('← Аккаунты','← Акаунти')));}
  var fieldNames={name:['Имя','Ім’я'],race:['Раса','Раса'],class:['Класс','Клас'],level:['Уровень','Рівень'],stats:['Характеристики','Характеристики'],str:['Сила','Сила'],dex:['Ловкость','Спритність'],int:['Интеллект','Інтелект'],cha:['Харизма','Харизма'],per:['Восприятие','Сприйняття'],con:['Выносливость','Витривалість'],cur:['Текущее','Поточне'],base:['Базовое','Базове'],hpCur:['Здоровье','Здоров’я'],hpMax:['Максимум здоровья','Максимум здоров’я'],baseHpMax:['Базовое здоровье','Базове здоров’я'],ac:['Броня','Броня'],baseAc:['Базовая броня','Базова броня'],initiative:['Инициатива','Ініціатива'],speed:['Скорость','Швидкість'],inventoryItems:['Инвентарь','Інвентар'],equipItems:['Снаряжение','Спорядження'],spellRefs:['Карточки','Картки'],spellsLearned:['Изученные карточки','Вивчені картки'],spellCD:['Ресурсы карточек','Ресурси карток'],preparedSpells:['Подготовленные карточки','Підготовлені картки'],skills:['Навыки','Навички'],mastery:['Позиции','Позиції'],coins:['Монеты','Монети'],statuses:['Состояния','Стани'],tempHp:['Временное здоровье','Тимчасове здоров’я'],notes:['Записи персонажа','Записи персонажа'],biography:['Биография','Біографія'],portrait:['Портрет','Портрет'],description:['Описание','Опис'],qty:['Количество','Кількість'],weight:['Вес','Вага'],price:['Цена','Ціна'],journalEntries:['Дневник','Щоденник'],currentGoal:['Цель','Мета'],progressionPlan:['Развитие','Розвиток'],battleEcho:['След боя','Слід бою']};
  function fieldLabel(field){return fieldNames[field]?t.apply(null,fieldNames[field]):t('Поле','Поле')+' «'+field+'»';}
  function historyChanges(changes){
    var before={},after={};changes.forEach(function(c){if(!c.before.absent)before[c.field]=c.before.value;if(!c.after.absent)after[c.field]=c.after.value;});
    var rows;try{rows=w.ZargotaCharacterReview.diff(before,after);}catch(_){rows=changes.map(function(c){return {path:[c.field],before:{value:c.before.value},after:{value:c.after.value}};});}
    return rows.map(function(row){
      var label=row.path.map(function(part,i){
        if(typeof part==='string')return fieldLabel(part);
        var path=row.path.slice(0,i+1),item=w.ZargotaCharacterReview.get(after,path).value||w.ZargotaCharacterReview.get(before,path).value;
        return item&&(item.name||item.title)||t('Предмет','Предмет');
      }).join(' · ');
      return '<details><summary>'+esc(label)+'</summary><strong>'+t('Было','Було')+'</strong><pre>'+esc(displayValue(row.before.value))+'</pre><strong>'+t('Стало','Стало')+'</strong><pre>'+esc(displayValue(row.after.value))+'</pre></details>';
    }).join('');
  }
  function displayValue(value){
    if(value==null)return '—';if(typeof value==='boolean')return value?t('Да','Так'):t('Нет','Ні');
    if(typeof value==='string'&&/^data:image\//.test(value))return t('Изображение','Зображення');
    if(typeof value!=='object')return String(value);
    if(Array.isArray(value))return value.length?value.map(function(item,i){return (i+1)+'. '+displayValue(item);}).join('\n'):'—';
    return Object.keys(value).map(function(k){return fieldLabel(k)+': '+displayValue(value[k]);}).join('\n');
  }
  function shareLink(sid){var url=new URL(location.href);url.hash='';url.searchParams.set('character',sid);return url.href;}
  function actionShare(sid){dialog(t('Ссылка на лист','Посилання на аркуш'),'<input id="persistent-issued-code" readonly aria-label="'+t('Ссылка','Посилання')+'" value="'+esc(shareLink(sid))+'">'+button('copy',t('Скопировать','Скопіювати')));}
  async function sharedView(sid){
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(sid))return;
    try{var api=await w.ZargotaPersistentTransport.start(),meta=await api.meta(sid);if(meta.locked!==false)throw Error('access-denied');var packet=await api.read(sid),c=JSON.parse(packet.characterJson);
      dialog(c.name,'<p>'+t('Просмотр листа · без редактирования','Перегляд аркуша · без редагування')+'</p>'+Object.keys(c).filter(function(k){return !['id','campaignKey','name','portrait'].includes(k)&&k.charAt(0)!=='_';}).map(function(k){return '<details><summary>'+esc(fieldLabel(k))+'</summary><pre>'+esc(displayValue(c[k]))+'</pre></details>';}).join(''));
    }catch(e){dialog(t('Лист недоступен','Аркуш недоступний'),'<p>'+t('Владелец закрыл просмотр этого листа или нет связи.','Власник закрив перегляд цього аркуша або немає зв’язку.')+'</p>');}
  }
  async function historyDialog(sid){
    var data=await transport.history(sid),rows=Object.values(data).sort(function(a,b){return b.revision-a.revision;});
    var html='<p>'+t('История видна только мастеру. Здесь последние сохранённые изменения.','Історію бачить лише майстер. Тут останні збережені зміни.')+'</p>';
    if(!rows.length)html+='<p>'+t('Изменений пока нет','Змін поки немає')+'</p>';
    rows.forEach(function(row){html+='<section class="pc-history"><h3>'+ (row.source==='session'?t('Из онлайн-игры','З онлайн-гри'):row.actorRole==='player'?t('Игрок','Гравець'):t('Мастер','Майстер'))+' · '+esc(new Date(row.at).toLocaleString())+'</h3>'+historyChanges(JSON.parse(row.changesJson))+'</section>';});
    dialog(t('История листа','Історія аркуша'),html||t('Изменений пока нет','Змін поки немає'));
    var reviewed=Math.max(0,...rows.filter(function(row){return row.actorRole==='player';}).map(function(row){return row.revision;}));
    if(reviewed){var result=await transport.call({action:'review',sheetId:sid,revision:reviewed});records[sid].activity=result.activity;render();}
  }
  function conflictDialog(sid){var entry=records[sid];dialog(t('Лист изменился','Аркуш змінився'),'<p>'+t('На другом устройстве сохранена новая версия. Ваш черновик остаётся на этом устройстве.','На іншому пристрої збережено нову версію. Ваша чернетка залишається на цьому пристрої.')+'</p>'+button('take-remote',t('Получить новую версию','Отримати нову версію'),'data-sheet="'+sid+'"')+button('replace-confirm',t('Сохранить мой черновик вместо неё','Зберегти мою чернетку замість неї'),'data-sheet="'+sid+'"'));}
  function render(){
    if(typeof w.zgIrlSharedHpChanged==='function')w.zgIrlSharedHpChanged();
    var nav=document.getElementById('nav'),tools=document.querySelector('.zg-control-tools');if(!nav||!tools)return;
    var loginButton=document.getElementById('persistent-entry');if(!loginButton){loginButton=document.createElement('button');loginButton.id='persistent-entry';loginButton.type='button';loginButton.dataset.pcAction='entry';nav.insertBefore(loginButton,nav.querySelector('.zg-net-monitor'));}
    var logged=state.enabled&&account.role!=='visitor',myHero=accountItems()[0];
    markup(loginButton,logged?w.ZargotaAccountViews.avatar(account.role==='admin'?null:myHero&&myHero.hero,account.role==='admin'):t('Вход','Вхід'));
    loginButton.classList.toggle('pc-account-entry',logged);loginButton.setAttribute('aria-label',logged?(account.role==='admin'?t('Аккаунты · администратор','Акаунти · адміністратор'):t('Мой аккаунт','Мій акаунт')):t('Вход по коду','Вхід за кодом'));
    var items=accountItems(),admin=logged&&account.role==='admin',unread=admin&&items.some(function(item){return item.unread;});
    loginButton.classList.toggle('pc-has-updates',!!unread);
    if(unread)loginButton.setAttribute('aria-label',t('Аккаунты · есть изменения игроков','Акаунти · є зміни гравців'));
    var onlineBar=document.getElementById('persistent-online');if(!onlineBar){onlineBar=document.createElement('div');onlineBar.id='persistent-online';nav.insertBefore(onlineBar,loginButton);}
    var online=admin?items.filter(function(item){return item.online;}):[];
    var onlineHtml=w.ZargotaAccountViews.online(online);markup(onlineBar,onlineHtml);
    onlineBar.hidden=!online.length;document.getElementById('header').classList.toggle('pc-has-online',!!online.length);
    var settingsButton=document.getElementById('persistent-settings');if(!settingsButton){settingsButton=document.createElement('button');settingsButton.id='persistent-settings';settingsButton.type='button';settingsButton.className='zg-control-tool';settingsButton.dataset.pcAction='settings';tools.appendChild(settingsButton);}settingsButton.innerHTML='<i>♙</i><span><b>'+t('Аккаунты','Акаунти')+'</b><small>'+t('Игроки и личные коды входа','Гравці й особисті коди входу')+'</small></span>';
    var panel=document.getElementById('character-cloud-panel'),sid=binding(w.viewingCharId),entry=sid&&records[sid],sheet=document.getElementById('char-sheet-view'),viewing=entry&&sheet&&sheet.style.display!=='none';
    var toolbar=document.getElementById('persistent-sheet-status');
    if(!toolbar){toolbar=document.createElement('section');toolbar.id='persistent-sheet-status';if(sheet)sheet.insertBefore(toolbar,sheet.firstChild);}
    toolbar.hidden=!viewing;
    if(sheet)sheet.classList.toggle('pc-linked-sheet',!!viewing);
    if(panel)panel.classList.toggle('pc-legacy-hidden',!!viewing);
    var oldLamp=document.getElementById('character-cloud-indicator');if(oldLamp)oldLamp.classList.toggle('pc-legacy-hidden',!!viewing);
    controlTabs();paintAccounts();
    if(!viewing)return;
    var others=Object.keys(entry.presence||{}).filter(function(other){return navigator.onLine&&other!==uid&&Object.keys(entry.presence[other]||{}).length;});
    var html='<span role="status">'+esc(status(entry,sid))+(others.length?' · '+(entry.role==='master'?t('Игрок онлайн','Гравець онлайн'):t('Мастер онлайн','Майстер онлайн')):'')+'</span>';
    if(entry.conflict)html+=button('conflict',t('Посмотреть','Переглянути'),'data-sheet="'+sid+'"');
    else if(entry.error)html+=button('retry',t('Повторить','Повторити'),'data-sheet="'+sid+'"');
    html+=button('lock',entry.meta&&entry.meta.locked===false?'🔓':'🔒','data-sheet="'+sid+'" aria-label="'+t('Доступ других игроков к листу','Доступ інших гравців до аркуша')+'"');
    if(entry.meta&&entry.meta.locked===false)html+=button('share',t('Ссылка','Посилання'),'data-sheet="'+sid+'"');
    if(entry.role==='master')html+=button('history',(entry.activity&&(entry.activity.lastPlayerRevision||0)>(entry.activity.seenRevision||0)?'● '+t('Есть изменения','Є зміни'):t('История','Історія')),'data-sheet="'+sid+'"');
    markup(toolbar,html);
  }
  async function action(buttonEl){
    await boot;
    var action=buttonEl.dataset.pcAction,sid=buttonEl.dataset.sheet,el=document.getElementById('persistent-character-dialog');
    if(action==='message'){if(!records[sid]||!records[sid].allowed)throw Error('access-denied');if(el)el.close();closeAccountMenu();if(w.zgSessionMonitorToggle)w.zgSessionMonitorToggle(null,false);if(w.ZargotaPlayerMessages)w.ZargotaPlayerMessages.open(sid);return;}
    if(action==='close'){if(el)el.close();return;}
    if(action==='character-actions'){closeAccountMenu();if(w.zgMobileCharacterActions)w.zgMobileCharacterActions();return;}
    if(action==='close-account'){closeAccountMenu();return;}
    if(action==='account-menu'){accountMenu(buttonEl);return;}
    if(action==='leave'){await logout();return;}
    if(action==='select-account'){
      selectedAccount=sid;revealedCodes={};
      var list=document.getElementById('pc-account-list'),detail=document.getElementById('pc-account-detail');
      // Keep the clicked row attached so the settings panel's outside-click
      // handler does not mistake account selection for a click outside it.
      if(list)list.querySelectorAll('[data-pc-action="select-account"]').forEach(function(row){var active=row.dataset.sheet===sid;row.classList.toggle('is-selected',active);row.setAttribute('aria-pressed',String(active));});
      if(detail)detail.innerHTML=w.ZargotaAccountViews.accountDetail(accountItems().find(function(item){return item.sid===sid;}));
      return;
    }
    if(action==='menu'){menu();return;}
    if(action==='own-sheet'){await openOwnSheet();return;}
    if(action==='entry'){if(state.enabled&&account.role!=='visitor')await settings();else menu();return;}
    if(action==='ordinary'){if(el)el.close();return;}
    if(action==='settings'){await settings();return;}
    if(action==='login'){var input=document.getElementById('persistent-login-code');if(!input)return;if(!String(input.value||'').trim()){input.focus();if(input.reportValidity)input.reportValidity();return;}await login(input.value,el);if(el&&el.open)el.close();return;}
    if(action==='open'||action==='account-open'){if(!records[sid]||!records[sid].allowed)throw Error('access-denied');closeAccountMenu();if(el)el.close();if(w.zgSessionMonitorToggle)w.zgSessionMonitorToggle(null,false);w.showPage('characters');w.openCharSheet(records[sid].localId);return;}
    if(action==='account-add'){if(account.role!=='admin')throw Error('access-denied');dialog(t('Добавить игрока','Додати гравця'),w.ZargotaAccountViews.picker((w.characters||[]).filter(function(c){return c.type!=='npc'&&!binding(c.id);}))).classList.add('pc-accounts-dialog');return;}
    if(action==='account-new'){
      if(account.role!=='admin')throw Error('access-denied');
      dialog(t('Новый персонаж','Новий персонаж'),'<form id="pc-new-character-form"><label for="pc-new-character-name">'+t('Имя персонажа','Ім’я персонажа')+'</label><input id="pc-new-character-name" maxlength="300" required placeholder="'+t('Например, Тест','Наприклад, Тест')+'"><p>'+t('Создадим пустой лист и сразу выдадим код для входа с телефона. Остальное можно заполнить позже.','Створимо порожній аркуш і одразу видамо код для входу з телефона. Решту можна заповнити пізніше.')+'</p><button type="submit" class="pc-primary" data-pc-action="account-new-save">'+t('Создать и выдать код','Створити й видати код')+'</button></form>');return;
    }
    if(action==='account-new-save'){
      if(account.role!=='admin')throw Error('access-denied');
      var form=document.getElementById('pc-new-character-form'),input=document.getElementById('pc-new-character-name');
      if(!input||!input.value.trim()){if(input)input.reportValidity();return;}
      var localId=Number(form.dataset.localId);
      if(!localId){
        var c=w.blankChar('hero');c.inventoryItems=[];while(character(c.id))c.id++;c.name=input.value.trim();
        var saved=await w.ZargotaCharacterStore.saveCharacter(c.id,c,w.characters);
        if(!saved.ok)throw Error('local-storage-failed');
        w.characters.push(c);localId=c.id;form.dataset.localId=String(localId);
        if(w.renderCharList)w.renderCharList();
      }
      var result=await create(localId);showCreatedAccount(localId,result);return;
    }
    if(action==='account-create'){if(account.role!=='admin')throw Error('access-denied');var result=await create(buttonEl.dataset.character);showCreatedAccount(buttonEl.dataset.character,result);return;}
    if(action==='account-code'){
      if(account.role!=='admin')throw Error('access-denied');
      var host=buttonEl.closest('[data-account-detail]'),generation=authGeneration;
      if(!host)return;
      if(revealedCodes[sid])delete revealedCodes[sid];
      else{
        var result=await transport.call({action:'code',sheetId:sid});
        if(generation!==authGeneration||account.role!=='admin'||selectedAccount!==sid||!host.isConnected)return;
        revealedCodes[sid]=result.code;
      }
      var detail=document.getElementById('pc-account-detail');
      if(detail)detail.innerHTML=w.ZargotaAccountViews.accountDetail(accountItems().find(function(item){return item.sid===sid;}));
      return;
    }
    if(action==='copy-account-code'){
      if(account.role!=='admin'||!revealedCodes[sid])return;
      await navigator.clipboard.writeText(revealedCodes[sid]);buttonEl.textContent=t('Скопировано','Скопійовано');return;
    }
    if(action==='reveal-code'){var codeInput=document.getElementById('persistent-issued-code');codeInput.type=codeInput.type==='password'?'text':'password';buttonEl.textContent=codeInput.type==='password'?t('Показать','Показати'):t('Скрыть','Приховати');return;}
    if(action==='master-code'){var result=await transport.call({action:'master-code'});showCode(result.code,true);return;}
    if(action==='copy'){var input=document.getElementById('persistent-issued-code');await navigator.clipboard.writeText(input.value);buttonEl.textContent=t('Скопировано','Скопійовано');return;}
    if(action==='history'){await historyDialog(sid);return;}
    if(action==='conflict'){conflictDialog(sid);return;}
    if(action==='retry'){records[sid].error='';await flush(sid);return;}
    if(action==='lock'){var locked=records[sid].meta.locked!==false;dialog(t('Доступ к листу','Доступ до аркуша'),'<p>'+t('Закрытый лист доступен вам и мастеру. Открытый лист можно показать по ссылке; другие игроки не смогут его редактировать.','Закритий аркуш доступний вам і майстру. Відкритий аркуш можна показати за посиланням; інші гравці не зможуть його редагувати.')+'</p>'+button('set-lock',locked?t('Открыть просмотр по ссылке','Відкрити перегляд за посиланням'):t('Закрыть просмотр','Закрити перегляд'),'data-sheet="'+sid+'" data-locked="'+(!locked)+'"'));return;}
    if(action==='share'){actionShare(sid);return;}
    if(action==='set-lock'){var result=await transport.call({action:'visibility',sheetId:sid,locked:buttonEl.dataset.locked==='true'});records[sid].meta=result.meta;persist();el.close();render();if(!result.meta.locked){buttonEl.dataset.pcAction='share';await actionShare(sid);}return;}
    if(action==='take-remote'){
      var e=records[sid];if(!e.remote)throw Error('wait-for-remote');e.backup=C.clone(e.draft||character(e.localId));e.pending=null;e.draft=null;persist();await apply(sid,e.remote,false);el.close();return;
    }
    if(action==='replace-confirm'){dialog(t('Заменить общую версию?','Замінити спільну версію?'),'<p>'+t('Весь ваш черновик заменит новую версию. Изменения другого устройства останутся в истории мастера.','Уся ваша чернетка замінить нову версію. Зміни іншого пристрою залишаться в історії майстра.')+'</p>'+button('replace',t('Заменить моей версией','Замінити моєю версією'),'data-sheet="'+sid+'"'));return;}
    if(action==='replace'){var e=records[sid];if(!e.remote)throw Error('wait-for-remote');var draft=e.draft||C.clean(character(e.localId));e.base=e.remote;e.remote=null;e.pending=null;e.conflict=false;C.draft(e,draft,newId,e.source);persist();await flush(sid);el.close();return;}
  }
  function runAction(b){if(!b||b.disabled)return;error='';document.querySelectorAll('#persistent-character-dialog [role=alert],#pc-control-accounts [role=alert]').forEach(function(el){el.textContent='';});b.disabled=true;Promise.resolve(action(b)).catch(failed).finally(function(){b.disabled=false;});}
  document.addEventListener('click',function(event){
    var b=event.target.closest('[data-pc-action]');
    if(!b){if(!event.target.closest('#pc-account-popover')&&!(accountAnchor&&accountAnchor.contains(event.target)))closeAccountMenu();return;}
    event.preventDefault();
    // These controls own their navigation. Replacing a modal must not let the
    // global outside-click listener immediately close the panel they open.
    if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    runAction(b);
  });
  document.addEventListener('submit',function(event){if(!['pc-login-form','pc-new-character-form'].includes(event.target.id))return;event.preventDefault();runAction(event.target.querySelector('[type="submit"]'));});
  document.addEventListener('keydown',function(event){var pop=document.getElementById('pc-account-popover');if(!pop)return;if(event.key==='Escape'){var anchor=accountAnchor;closeAccountMenu();if(anchor)anchor.focus({preventScroll:true});event.preventDefault();}else if(event.key==='Tab'){var buttons=Array.from(pop.querySelectorAll('button:not(:disabled)'));var first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}});
  w.addEventListener('zargota:persistent-auth-change',function(){
    // Preserve cached drafts, but never send them using another tab's identity.
    authGeneration++;revealedCodes={};stop();state.enabled=false;state.activeUid='';uid='';records={};account={role:'visitor'};transport=null;persist();closeAccountMenu();render();
    var el=document.getElementById('persistent-character-dialog');if(el)el.close();
  });
  document.addEventListener('input',function(event){var sid=binding(w.viewingCharId);if(sid&&event.target.closest('#char-sheet,#char-editor-view'))records[sid].dirtyInput=true;});
  document.addEventListener('focusout',function(){setTimeout(function(){resume().catch(failed);},0);});
  document.addEventListener('zargota:localechange',render);
  w.addEventListener('online',function(){if(!state.enabled)return;Promise.resolve(subscribedUid&&subscribedUid===uid?null:connect()).then(function(){Object.keys(records).forEach(function(sid){if(records[sid].pending)queue(sid);});render();}).catch(failed);});
  w.addEventListener('offline',render);
  var resizeTimer;w.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(render,100);});
  w.addEventListener('zargota-room-state',function(){resume().catch(failed);});
  document.addEventListener('DOMContentLoaded',function(){boot.then(function(){render();if(state.enabled)connect().catch(failed);});var shared=new URLSearchParams(location.search).get('character');if(shared)sharedView(shared);});
  w.ZargotaPersistentCharacters={tableHeroes:tableHeroes,tableHp:tableHp,start:enable,login:login,create:create,saved:saved,beforeSave:function(){Object.values(records).forEach(function(e){e.localSaving=(e.localSaving||0)+1;});},saveFailed:function(){Object.values(records).forEach(function(e){e.localSaving=Math.max(0,(e.localSaving||0)-1);});},usesCharacter:function(id){return !!binding(id);},refresh:function(){setTimeout(render,0);},settings:settings,showGeneralSettings:showGeneralSettings,accountMenu:accountMenu,logout:logout,status:function(){return {account:C.clone(account),uid:uid,enabled:state.enabled,records:C.clone(records),error:error};},visible:function(c){var roles=Object.values(records).map(function(e){return e.role;});return !state.enabled||!roles.length||roles.includes('master')||!!binding(c.id);}};
})(window);
