(function(w){
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 const copy=x=>JSON.parse(JSON.stringify(x));
 function icon(item){
  if(item?.itemId==='evan-draft-folder'&&(!item.image||item.image==='assets/stories/Evan/inspections/draft-folder-v1.png'))return 'assets/stories/Evan/items/draft-folder-icon-v1.png';
  return item?.image||'';
 }
 function list(data){return Array.from(new Map([...(data.player?.inventoryItems||[]),...(data.storyItems||[])].map(i=>[i.itemId,i])).values());}
 function unique(item){return item.stackable===false||String(item.itemId||'').startsWith('kenku-cloak-');}
 function give(character,item,qty){if(!item)return;const items=character.inventoryItems||(character.inventoryItems=[]),old=items.find(i=>i.itemId===item.itemId);qty=unique(item)?1:Math.max(1,Math.min(999,Number(qty)||1));if(old){if(unique(item))return;old.qty=(Number(old.qty)||1)+qty;}else items.push(Object.assign(copy(item),{qty,equipped:false}));}
 function edit(data,host,save){
  const box=document.createElement('section'),h=document.createElement('h3');h.textContent=t('Сюжетные предметы','Сюжетні предмети');box.appendChild(h);
  const target=document.createElement('select');
  Object.entries(data.speakers||{}).filter(([,s])=>!s.archived).forEach(([id,s])=>{const o=document.createElement('option');o.value=id;o.textContent=t(s.name,s.nameUk||s.name);target.appendChild(o);});
  target.value=data.playerSpeakerId||target.value;box.appendChild(target);
  const add=document.createElement('button');add.type='button';add.textContent=t('＋ Плащ для персонажа','＋ Плащ для персонажа');add.disabled=!target.options.length;
  add.onclick=()=>save(d=>{const before=new Set((d.player?.inventoryItems||[]).map(i=>i.itemId));w.ZargotaStoryOutfits.install(d,target.value);const id=d.speakers[target.value].equipmentPortraits.itemId,item=d.player.inventoryItems.find(i=>i.itemId===id);d.storyItems=d.storyItems||[];if(!d.storyItems.some(i=>i.itemId===id))d.storyItems.push(copy(item));if(!before.has(id))d.player.inventoryItems=d.player.inventoryItems.filter(i=>i.itemId!==id);});box.appendChild(add);
  const search=document.createElement('input');search.type='search';search.placeholder=t('Найти сюжетный предмет…','Знайти сюжетний предмет…');search.setAttribute('aria-label',search.placeholder);box.appendChild(search);
  const cards=document.createElement('div');cards.style.cssText='max-height:280px;overflow:auto;display:grid;gap:8px';box.appendChild(cards);
  function receive(id){const item=list(data).find(i=>i.itemId===id);if(item)save(d=>{d.player=d.player||{};give(d.player,item,1);});}
  function render(){cards.replaceChildren();list(data).filter(i=>t(i.name||'',i.nameUk||i.name||'').toLowerCase().includes(search.value.toLowerCase())).forEach(item=>{
   const row=document.createElement('article');row.style.cssText='padding:10px;border:1px solid #536c60;border-radius:10px';
   const button=document.createElement('button');button.type='button';const owned=(data.player?.inventoryItems||[]).some(i=>i.itemId===item.itemId);
   button.textContent=t(item.name,item.nameUk||item.name)+' · '+(unique(item)&&owned?t('Уже в инвентаре','Вже в інвентарі'):t('Добавить','Додати'));button.disabled=unique(item)&&owned;button.onclick=()=>receive(item.itemId);
   if(icon(item)){const img=document.createElement('img');img.src=icon(item);img.alt='';img.loading='lazy';img.style.cssText='width:48px;height:48px;object-fit:contain;vertical-align:middle';row.appendChild(img);}row.appendChild(button);
   const desc=document.createElement('p');desc.textContent=t(item.description||'',item.descriptionUk||item.description||'');row.appendChild(desc);
   const sound=document.createElement('input');sound.placeholder=t('Звук надевания · необязательно','Звук спорядження · необов’язково');sound.setAttribute('aria-label',sound.placeholder);sound.value=item.equipSound||'';sound.onchange=()=>save(d=>{d.storyItems=d.storyItems||[];let stored=d.storyItems.find(i=>i.itemId===item.itemId);if(!stored){stored=copy(item);d.storyItems.push(stored);}stored.equipSound=sound.value;(d.player?.inventoryItems||[]).filter(i=>i.itemId===item.itemId).forEach(i=>i.equipSound=sound.value);});row.appendChild(sound);w.ZargotaStoryAssets?.attach(sound,'audio');const use=document.createElement('input');use.placeholder=t('Звук использования · необязательно','Звук використання · необов’язково');use.setAttribute('aria-label',use.placeholder);use.value=item.useSound||'';use.onchange=()=>save(d=>{d.storyItems=d.storyItems||[];let stored=d.storyItems.find(i=>i.itemId===item.itemId);if(!stored){stored=copy(item);d.storyItems.push(stored);}stored.useSound=use.value;(d.player?.inventoryItems||[]).filter(i=>i.itemId===item.itemId).forEach(i=>i.useSound=use.value);});row.appendChild(use);w.ZargotaStoryAssets?.attach(use,'audio');const inspection=document.createElement('input');inspection.placeholder=t('Изображение осмотра на весь экран','Зображення огляду на весь екран');inspection.setAttribute('aria-label',inspection.placeholder);inspection.value=item.inspectImage||'';inspection.onchange=()=>save(d=>{d.storyItems=d.storyItems||[];let stored=d.storyItems.find(i=>i.itemId===item.itemId);if(!stored){stored=copy(item);d.storyItems.push(stored);}stored.inspectImage=inspection.value;(d.player?.inventoryItems||[]).filter(i=>i.itemId===item.itemId).forEach(i=>i.inspectImage=inspection.value);});row.appendChild(inspection);w.ZargotaStoryAssets?.attach(inspection,'image');cards.appendChild(row);
  });}search.oninput=render;render();
  host.appendChild(box);
 }
 function award(character,item,qty,equip){
  if(!item)return {character,received:false,equipped:false};
  const before=(character.inventoryItems||[]).find(i=>i.itemId===item.itemId),count=before?Number(before.qty)||1:0;
  give(character,item,qty);
  const index=character.inventoryItems.findIndex(i=>i.itemId===item.itemId),owned=character.inventoryItems[index];
  const received=(Number(owned.qty)||1)>count;
  if(received)owned.storyUnread=true;
  if(equip&&!owned.equipped&&character.inventoryItems.length<=40){const result=w.ZargotaEquipmentRules?.applyCreatureInventory(character,{action:'equip',index});if(result?.ok)character=result.source;}
  return {character,received,equipped:!!character.inventoryItems[index].equipped};
 }
 function exchange(data,run,link){
  const take=Number(link.exchangeTakeQty),receive=Number(link.exchangeGiveQty),once=link.exchangeOnce,limit=Number(link.exchangeLimit||1),spent=Number(run.exchangeCounts?.[once]||0);
  if(!run.character||!once||run.flags?.[once]||!Number.isSafeInteger(take)||take<1||!Number.isSafeInteger(receive)||receive<1||receive>999||link.exchangeTakeId===link.exchangeGiveId)return false;
  if(!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(spent)||spent<0||spent+take>limit)return false;
  const item=list(data).find(i=>i.itemId===link.exchangeGiveId);
  if(!item||unique(item))return false;
  const inventory=run.character.inventoryItems||[],count=i=>i.qty==null?1:Number(i.qty);
  const sources=inventory.filter(i=>i.itemId===link.exchangeTakeId);
  if(sources.some(i=>!Number.isSafeInteger(count(i))||count(i)<0)||sources.reduce((n,i)=>n+count(i),0)<take)return false;
  const next=copy(run.character);let remaining=take;
  next.inventoryItems=next.inventoryItems.filter(i=>{if(i.itemId!==link.exchangeTakeId)return true;const used=Math.min(remaining,count(i));i.qty=count(i)-used;remaining-=used;return i.qty>0;});
  award(next,item,receive,false);run.character=next;run.exchangeCounts=run.exchangeCounts||{};run.exchangeCounts[once]=spent+take;run.flags=run.flags||{};if(spent+take===limit)run.flags[once]=true;return true;
 }
 w.ZargotaStoryItems={list,give,edit,award,exchange,icon};
})(window);
