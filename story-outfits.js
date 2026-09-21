(function(w){
 'use strict';
 const folder='assets/stories/portraits/Portraits/kenku-in-cloak/';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 function install(data,key){
  const actor=data.speakers[key],id='kenku-cloak-'+key;
  const emotions={};
  Object.entries(actor.emotions||{}).forEach(([key,e])=>{
   const label=[key,e.name,e.nameUk].join(' ').toLowerCase();
   const file=/sad|сум|груст/.test(label)?'01_sad.png':/angry|зл|гнів/.test(label)?'03_angry.png':/think|дум|замис/.test(label)?'04_thinking.png':/speak|talk|говор|мов/.test(label)?'05_speaking.png':'02_neutral.png';
   emotions[key]=folder+file;
  });
  actor.equipmentPortraits={itemId:id,portrait:folder+'02_neutral.png',emotions};
  data.player=data.player||{};data.player.inventoryItems=data.player.inventoryItems||[];
  if(!data.player.inventoryItems.some(i=>i.itemId===id))data.player.inventoryItems.push({itemId:id,name:'Плащ',nameUk:'Плащ',description:'Плащ меняет портреты персонажа, пока экипирован.',descriptionUk:'Плащ змінює портрети персонажа, поки споряджений.',image:'assets/stories/objects/kenku-cloak.png',qty:1,equipped:false});
 }
 function resolve(data,node,character,result){
  const key=node.speaker==='@player'?data.playerSpeakerId:node.speaker;
  const set=data.speakers?.[key]?.equipmentPortraits;
  if(set&&(character?.inventoryItems||data.player?.inventoryItems||[]).some(i=>i.itemId===set.itemId&&i.equipped&&i.qty!==0)){
   return Object.assign({},result,{portrait:set.emotions?.[node.emotion]||set.portrait||result.portrait});
  }
  return result;
 }
 function tokenPortrait(data,character,fallback){
  const items=character?.inventoryItems||data.player?.inventoryItems||[];
  const equipped=id=>items.some(i=>i.itemId===id&&i.equipped&&i.qty!==0);
  const preferred=data.speakers?.[data.playerSpeakerId]?.equipmentPortraits;
  const set=preferred&&equipped(preferred.itemId)?preferred:Object.values(data.speakers||{}).map(s=>s.equipmentPortraits).find(s=>s&&equipped(s.itemId));
  if(set)return set.portrait||fallback||'';
  return fallback||'';
 }
 function edit(data,key,host,save){
  const details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent=t('Портреты при экипировке','Портрети під час спорядження');details.appendChild(summary);
  const set=data.speakers[key].equipmentPortraits;
  if(!set){const button=document.createElement('button');button.type='button';button.textContent=t('＋ Добавить комплект «В плаще»','＋ Додати комплект «У плащі»');button.onclick=()=>save(d=>install(d,key));details.appendChild(button);}
  else {
   const note=document.createElement('p');note.textContent=t('Плащ в инвентаре: надеть — этот комплект, снять — обычный.','Плащ в інвентарі: спорядити — цей комплект, зняти — звичайний.');details.appendChild(note);
   const fields=[['',t('Обычный','Звичайний')],...Object.entries(data.speakers[key].emotions||{}).map(([id,e])=>[id,e.nameUk||e.name||id])];
   fields.forEach(([id,name])=>{const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.value=id?set.emotions[id]||'':set.portrait||'';input.onchange=()=>save(d=>{const s=d.speakers[key].equipmentPortraits;if(id)s.emotions[id]=input.value;else s.portrait=input.value;});label.appendChild(input);details.appendChild(label);w.ZargotaStoryAssets?.attach(input,'image');});
  }
  host.appendChild(details);
 }
 w.ZargotaStoryOutfits={install,resolve,tokenPortrait,edit};
})(window);
