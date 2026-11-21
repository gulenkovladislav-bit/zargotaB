'use strict';
// Two isolated browser clients, real sheet controller/renderers and transactional
// domain model. The transport alone is substituted; no live accounts are touched.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../functions/character-domain');
const clone=x=>JSON.parse(JSON.stringify(x));
const url=process.env.ZG_TEST_URL||'http://127.0.0.1:8957/';
const out=process.env.ZG_TEST_OUTPUT||'/private/tmp/zg-item-library';
const heroes=require('../data/campaign-heroes.v1.json').heroes.map(c=>({...clone(c),statuses:c.statuses||[],deathSaves:c.deathSaves||{success:0,fail:0},spellCD:c.spellCD||{},battleEcho:c.battleEcho||''}));
heroes.find(c=>c.campaignKey==='esteros').inventoryItems=[];
heroes.find(c=>c.campaignKey==='esteros').coins={copper:100,silver:0,gold:0,platinum:0};
heroes.push({...clone(heroes[0]),id:9876501,campaignKey:'custom-table-hero',name:'Другой игрок',portrait:'',inventoryItems:[]});
const server=Object.fromEntries(heroes.map(c=>['test-'+c.campaignKey,D.initial(c,'test-gm','player-'+c.campaignKey,'test-only-code',1)]));
const sid='test-esteros',playerUid='player-esteros';
const pages=[],calls=[];let rejectSheet="";
let presence={'test-gm':{desktop:{online:true}},[playerUid]:{phone:{online:true}}};
async function broadcast(sheetId){const packet=clone(server[sheetId].state);await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(({sheetId,packet})=>window.__testWatchers?.[sheetId]?.(packet),{sheetId,packet})));}
async function openPicker(page){
 if(await page.locator('[data-gm-add-player]').count())await page.locator('[data-gm-add-player]').click();
 else{await page.locator('[data-gm-open]').first().click({button:'right',position:{x:30,y:30}});await page.locator('[data-gmp-choose]').click();}
}
async function presenceChanged(){await Promise.all(pages.filter(p=>!p.isClosed()).map(p=>p.evaluate(value=>{window.__testPresence=value;Object.values(window.__testPresenceWatchers||{}).forEach(fn=>fn(value));},presence)));}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 const errors=[];
 async function openClient(role){
  const account={role,uid:role==='admin'?'test-gm':playerUid};
  const context=await browser.newContext({viewport:role==='admin'?{width:1600,height:1000}:{width:390,height:844},hasTouch:role!=='admin'});
  await context.route(/https:\/\/.*(firebase|googleapis|gstatic).*/,r=>r.abort());
  const p=await context.newPage();p.setDefaultTimeout(20000);pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__testServer',async req=>{
   const ids=Object.fromEntries(Object.keys(server).filter(key=>role==='admin'||key===sid).map(key=>[key,role==='admin'?'master':'player']));
   if(req.action==='boot')return {account,ids,metas:Object.fromEntries(Object.entries(server).map(([k,v])=>[k,v.meta])),packets:Object.fromEntries(Object.entries(server).map(([k,v])=>[k,v.state])),presence};
   if(req.action==='read')return clone(server[req.sheetId].state);
   assert.equal(req.action,'save');assert.ok(ids[req.sheetId]);if(req.sheetId===rejectSheet)throw Error('simulated-network-failure');
   calls.push({uid:account.uid,...clone(req)});
   server[req.sheetId]=D.commit(server[req.sheetId],account.uid,req,Date.now());
   setTimeout(()=>broadcast(req.sheetId).catch(e=>errors.push(e.message)),10);
   return {state:clone(server[req.sheetId].state)};
  });
  await p.addInitScript(({account,heroes})=>{
   if(localStorage.getItem('gm-participant-test'))return;
   localStorage.setItem('gm-participant-test','1');
   localStorage.setItem('grimoire_chars',JSON.stringify(heroes));
   localStorage.setItem('zargota_persistent_characters_v1',JSON.stringify({enabled:true,activeUid:account.uid,identities:{[account.uid]:account},accounts:{[account.uid]:{}}}));
   localStorage.setItem('zargota_ui_locale_v1','ru');
  },{account,heroes:role==='admin'?heroes:heroes.filter(h=>h.campaignKey==='esteros')});
  await p.route('**/persistent-character-transport.js*',r=>r.fulfill({contentType:'application/javascript',body:`
   window.ZargotaPersistentTransport={available:()=>true,start:async()=>{
    const d=await __testServer({action:'boot'}),noop=()=>()=>{};
    window.__testWatchers={};window.__testPresenceWatchers={};window.__testPresence=d.presence;
    return {uid:()=>d.account.uid,account:async()=>d.account,list:async()=>d.ids,meta:async id=>d.metas[id],
     watch:(id,fn)=>{__testWatchers[id]=fn;setTimeout(()=>fn(d.packets[id]),20);return()=>delete __testWatchers[id]},
     watchMeta:noop,watchLastSeen:noop,watchActivity:noop,watchMessages:noop,
     presence:(id,fn)=>{__testPresenceWatchers[id]=fn;setTimeout(()=>fn(__testPresence),25);return()=>delete __testPresenceWatchers[id]},
     read:id=>__testServer({action:'read',sheetId:id}),call:req=>navigator.onLine?__testServer(req):Promise.reject(Error('offline')),logout:async()=>{}};
   }};`}));
  await p.goto(url);
  if(role==='admin')await p.evaluate(()=>{window.loadShopItems=()=>[
   {id:'test-item-potion',cat:'potion',rarity:'rare',name:'Тестовое зелье',nameUk:'Тестове зілля',desc:'Описание тестового предмета.',descUk:'Опис тестового предмета.',effect:'Восстанавливает 1d4 здоровья.',effectUk:'Відновлює 1d4 здоров’я.',range:'1 клетка',image:'images/ui/item-icons/potion.png',stackable:true},
   {id:'shp_currency_copper',cat:'other',category:'currency',name:'Медная монета',nameUk:'',desc:'Монеты',image:'images/shop/zargota-coin-copper.webp'},
   {id:'test-item-sword',cat:'weapon',name:'Тестовый меч',nameUk:'Тестовий меч',desc:'Описание меча.',descUk:'Опис меча.',stackable:false}
  ];});await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await p.waitForFunction(n=>Object.values(ZargotaPersistentCharacters.status().records).filter(e=>e.base).length===n,role==='admin'?6:1);
  await p.evaluate(()=>{window.__itemSounds=[];for(const key of ['itemReward','coinChange'])ZargotaSound[key]=()=>__itemSounds.push(key);});
  console.log('Loaded',role);return {p,context};
 }
 try{
  const {p:gm,context:gmContext}=await openClient('admin');
  const {p:player}=await openClient('player');
  await player.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  assert.equal(await player.locator('#character-status-arrival').count(),0,'initial load is silent');
  await gm.evaluate(()=>{zgIrlSessionStart();showPage('gm-table');});
  await gm.waitForFunction(()=>ZargotaPersistentCharacters.tableHeroes().every(r=>r.ready));
  const first=gm.locator('.zg-gm-hero').first(),original=await first.boundingBox();
  await gm.locator('.gms-launcher').click();
  assert.equal(await gm.locator('[data-gms-drag]').count(),6);
  assert.equal(await gm.locator('#gms-library footer small').count(),0,'no drag tutorial in footer');
  assert.equal(await gm.locator('[data-gms-all]').isVisible(),false);
  assert.equal(await gm.locator('.gms-icon.zg-status-glyph').count(),6);
  async function start(key){
    const source=gm.locator('[data-gms-drag="'+key+'"]');await source.scrollIntoViewIfNeeded();const box=await source.boundingBox();
    await gm.mouse.move(box.x+box.width/2,box.y+box.height/2);await gm.mouse.down();
    await gm.mouse.move(box.x+box.width/2+30,box.y+box.height/2+12,{steps:5});
    await gm.waitForFunction(()=>document.body.classList.contains('gms-dragging'));
    await gm.waitForTimeout(160);
  }
  async function drop(key,target){
    const count=calls.length;await start(key);const box=await gm.locator(target).boundingBox();
    await gm.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});await gm.mouse.up();
    await gm.waitForFunction(()=>document.querySelector('#gms-library').getAttribute('aria-busy')==='false');
    assert.equal(await gm.locator('.gms-ghost').count(),0);assert.equal(await gm.locator('[data-gms-all]').isVisible(),false);
    return calls.length-count;
  }

  await gm.locator('[data-gms-kind="items"]').click();
  await gm.locator('[data-gms-drag="test-item-potion"]').click();
  assert.equal(await gm.locator('[data-gms-detail]').isVisible(),true);
  assert.equal(await gm.locator('[data-gms-choose],[data-gms-send],[data-gms-recipients]').count(),0,'description has no duplicate recipient picker');
  await gm.locator('[data-gms-kind="statuses"]').click();
  await gm.locator('[data-gms-drag="bleed"]').click();
  assert.equal(await gm.locator('[data-gms-detail] button').count(),0,'statuses also use drag only');
  await gm.locator('[data-gms-kind="items"]').click();

  assert.equal(await gm.locator('[data-gms-tab]').count(),0,'no duplicate tab row');
  await gm.locator('[data-gms-category]').selectOption('weapon');
  assert.deepEqual(await gm.locator('[data-gms-drag]').evaluateAll(nodes=>nodes.map(n=>n.dataset.gmsDrag)),['test-item-sword']);
  await gm.locator('[data-gms-star="test-item-sword"]').click();
  await gm.locator('[data-gms-favorites]').click();
  await gm.locator('#gms-library input[type=search]').fill('зелье');
  assert.equal(await gm.locator('[data-gms-drag]').count(),0,'search intersects category and favorites');
  await gm.locator('#gms-library input[type=search]').fill('');
  await gm.evaluate(()=>ZargotaI18n.setLocale('uk'));
  assert.equal(await gm.locator('#gms-title').textContent(),'Сховище');
  assert.equal(await gm.locator('[data-gms-kind="items"]').textContent(),'Предмети');
  assert.equal(await gm.locator('[data-gms-category] option:checked').textContent(),'Зброя');
  assert.equal(await gm.locator('[data-gms-favorites]').getAttribute('aria-label'),'Лише обране');
  assert.equal(await gm.locator('[data-gms-favorites]').getAttribute('aria-pressed'),'true');
  await gm.evaluate(()=>ZargotaI18n.setLocale('ru'));
  assert.equal(await gm.locator('[data-gms-category] option:checked').textContent(),'Оружие');
  assert.equal(await gm.locator('[data-gms-kind="items"]').textContent(),'Предметы');
  await gm.screenshot({path:out+'/item-category-filter.png'});
  await gm.locator('[data-gms-favorites]').click();
  await gm.locator('[data-gms-category]').selectOption('');


  // Prepare reusable objects without delivering anything to players.
  await gm.locator('[data-gms-qty]').fill('2');
  await start('test-item-potion');await gm.mouse.move(650,260,{steps:10});await gm.mouse.up();
  await gm.locator('[data-table-object]').waitFor();
  assert.equal(calls.length,0,'placing on table is not a grant');
  let tableTile=gm.locator('[data-table-object]').first();
  const tileId=await tableTile.getAttribute('data-table-object');
  const initialTile=await tableTile.boundingBox();
  assert.ok(initialTile.width>initialTile.height*3,'horizontal prepared card matches drag preview');
  await gm.mouse.move(initialTile.x+20,initialTile.y+20);await gm.mouse.down();
  await gm.mouse.move(initialTile.x+140,initialTile.y+100,{steps:10});await gm.mouse.up();
  const movedTile=await tableTile.boundingBox();assert.ok(movedTile.x>initialTile.x+100);assert.ok(movedTile.y>initialTile.y+60);
  assert.equal(await gm.locator('[data-table-remove]').count(),0,'moving with left mouse does not open delete menu');
  assert.equal(await gm.locator('.gmt-popup').count(),0,'drag release does not open details');
  const grip=await tableTile.locator('.gmt-resize').boundingBox();
  await gm.mouse.move(grip.x+12,grip.y+12);await gm.mouse.down();await gm.mouse.move(grip.x+65,grip.y+65,{steps:10});await gm.mouse.up();
  assert.ok((await tableTile.boundingBox()).width>initialTile.width+40);
  assert.equal(await gm.locator('.gmt-popup').count(),0,'resize release does not open details');
  await gm.waitForTimeout(550);await tableTile.locator('.gmt-face').click();
  assert.equal(await gm.locator('.gmt-popup strong').textContent(),'Тестовое зелье');
  assert.match(await gm.locator('.gmt-popup').innerText(),/1 клетка/);
  assert.match(await gm.locator('.gmt-popup').innerText(),/Восстанавливает 1d4/);
  assert.match(await gm.locator('.gmt-popup').innerText(),/Описание тестового предмета/);
  await gm.waitForFunction(()=>document.querySelector('.gmt-detail-art img')?.naturalWidth>0);
  assert.ok(await gm.locator('.gmt-detail-stats .zgms-number').count());
  await gm.screenshot({path:out+'/prepared-item-details.png'});
  await gm.locator('.gmt-popup input').fill('4');await gm.locator('.gmt-popup input').press('Tab');
  await gm.locator('.gmt-dismiss').click();
  const beforePreparedGrant=calls.length,faceBox=await tableTile.locator('.gmt-face').boundingBox();
  await gm.mouse.move(faceBox.x+20,faceBox.y+20);await gm.mouse.down();await gm.mouse.move(faceBox.x+45,faceBox.y+35,{steps:5});
  await gm.waitForFunction(()=>document.body.classList.contains('gms-dragging'));
  assert.equal(await gm.locator('.gms-ghost').count(),0,'prepared drag has no duplicate preview');
  assert.equal(await tableTile.isVisible(),true,'prepared object itself stays visible');
  await gm.screenshot({path:out+'/prepared-drag-single-card.png'});
  const receiver=await gm.locator('[data-gm-key="sheet-test-vrotik"]').boundingBox();
  await gm.mouse.move(receiver.x+30,receiver.y+30,{steps:12});
  const overHero=await tableTile.boundingBox();
  assert.ok(overHero.y+overHero.height>receiver.y+30,'dragged card enters the hero dock');
  assert.ok(Math.abs(overHero.y-(receiver.y+10))<3,'card follows cursor past table boundary');
  assert.ok(await gm.locator('[data-gm-key="sheet-test-vrotik"]').evaluate(el=>el.classList.contains('gms-drop-hover')),'receiver highlighted beneath dragged card');
  await gm.screenshot({path:out+'/prepared-drag-over-hero.png'});
  await gm.mouse.up();
  await gm.waitForFunction(()=>document.querySelector('#gms-library').getAttribute('aria-busy')==='false');
  assert.equal(calls.length,beforePreparedGrant+1);assert.equal(JSON.parse(server['test-vrotik'].state.characterJson).gmItemGrants.at(-1).qty,4);
  assert.equal(await gm.locator('[data-table-object]').count(),1,'giving does not consume prepared object');
  await gm.locator('[data-gms-kind="statuses"]').click();
  await start('fear');await gm.mouse.move(1050,280,{steps:10});await gm.mouse.up();
  assert.equal(await gm.locator('[data-table-object]').count(),2);
  // Persist geometry, then remove only the preparation reference.
  const stored=await gm.evaluate(()=>JSON.parse(localStorage.getItem('zg-gm-table-objects-v1:test-gm')));
  assert.equal(stored.length,2);assert.equal(stored.find(r=>r.id===tileId).options.qty,4);
  await gm.waitForTimeout(550);await gm.locator('[data-table-object]').last().click({button:'right',position:{x:20,y:20}});
  await gm.locator('[data-table-remove]').click();assert.equal(await gm.locator('[data-table-object]').count(),1);
  await gm.screenshot({path:out+'/prepared-object.png'});
  await gm.locator('[data-gms-kind="items"]').click();
  await gm.locator('#gms-library input[type=search]').fill('Тестовое зелье');
  await gm.locator('[data-gms-qty]').fill('2');
  assert.equal(await drop('test-item-potion','[data-gm-key="sheet-test-esteros"]'),1);
  await player.locator('#character-item-arrival').waitFor();
  assert.equal(await player.locator('#gia-title').textContent(),'Тестовое зелье');
  assert.equal(await player.locator('.gia-quantity').textContent(),'× 2');
  assert.equal(await gm.locator('#character-item-arrival').count(),0);
  const firstReceipt=JSON.parse(server[sid].state.characterJson).gmItemGrants[0].id;
  await player.evaluate(()=>window.__arrivalElement=document.querySelector('#character-item-arrival'));
  await gm.locator('#gms-library input[type=search]').fill('Тестовый меч');
  await gm.locator('[data-gms-qty]').fill('1');
  assert.equal(await drop('test-item-sword','[data-gm-key="sheet-test-esteros"]'),1);
  await player.waitForFunction(()=>document.querySelector('.gia-count')?.textContent==='1 / 2');
  assert.equal(await player.evaluate(()=>window.__arrivalElement===document.querySelector('#character-item-arrival')),true,'same overlay, animation not restarted');
  await player.locator('[data-arrival-next]').click();
  assert.equal(await player.locator('#gia-title').textContent(),'Тестовый меч');
  await player.locator('[data-arrival-prev]').click();
  await player.waitForTimeout(1000);
  const artLayout=await player.evaluate(()=>{const img=document.querySelector('#character-item-arrival .gia-art img'),a=img.getBoundingClientRect(),t=document.querySelector('#gia-title').getBoundingClientRect(),style=getComputedStyle(img);return {bottom:a.bottom,titleTop:t.top,mask:style.maskImage||style.webkitMaskImage,animation:style.animationName,rarity:document.querySelector('#character-item-arrival').dataset.rarity};});
  assert.ok(artLayout.bottom<artLayout.titleTop,'image never overlaps item name');
  assert.match(artLayout.mask,/item-arrival-edge/);assert.equal(artLayout.animation,'gia-drift');assert.equal(artLayout.rarity,'rare');
  assert.equal(await player.locator('#character-item-arrival').evaluate(el=>el.style.getPropertyValue('--gia-glow')),'122,154,224','rarity uses workshop palette');
  await player.screenshot({path:out+'/item-arrival-ru.png'});
  await player.evaluate(()=>ZargotaI18n.setLocale('uk'));
  await player.waitForFunction(()=>document.querySelector('#gia-title')?.textContent==='Тестове зілля');
  assert.equal(await player.locator('[data-arrival-accept]').textContent(),'Прийняти');
  await player.screenshot({path:out+'/item-arrival-uk.png'});
  await player.locator('[data-arrival-accept]').click();
  await player.waitForFunction(()=>document.querySelector('#gia-title')?.textContent==='Тестовий меч');
  assert.equal(JSON.parse(server[sid].state.characterJson).gmItemAccepted[firstReceipt],true);
  await player.locator('[data-arrival-accept]').click();
  await player.locator('#character-item-arrival').waitFor({state:'detached'});
  await broadcast(sid);await player.waitForTimeout(800);
  assert.equal(await player.locator('#character-item-arrival').count(),0,'no repeat of accepted receipts');
  assert.deepEqual(await player.evaluate(()=>__itemSounds),['itemReward','itemReward']);
  await player.reload();await player.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records).some(e=>e.base));
  await player.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  await player.waitForTimeout(800);assert.equal(await player.locator('#character-item-arrival').count(),0,'reload does not replay accepted receipts');
  // A fresh browser (no cached before-snapshot) must discover an offline grant.
  await player.close();
  await gm.locator('#gms-library input[type=search]').fill('Тестовое зелье');
  assert.equal(await drop('test-item-potion','[data-gm-key="sheet-test-esteros"]'),1);
  const {p:late}=await openClient('player');
  await late.waitForTimeout(800);assert.equal(await late.locator('#character-item-arrival').count(),0,'only in sheet');
  await late.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  await late.locator('#character-item-arrival').waitFor();
  assert.equal(await late.locator('#gia-title').textContent(),'Тестовое зелье');
  // Dismissal leaves unread, re-entry shows again, acceptance does not add inventory.
  await late.locator('[data-arrival-close]').click();await late.waitForTimeout(800);
  assert.equal(await late.locator('#character-item-arrival').count(),0);
  await late.evaluate(()=>showPage('home'));await late.waitForTimeout(800);
  await late.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  await late.locator('#character-item-arrival').waitFor();
  await late.screenshot({path:out+'/item-offline-arrival.png'});
  await late.locator('[data-arrival-accept]').click();await late.locator('#character-item-arrival').waitFor({state:'detached'});
  let saved=JSON.parse(server[sid].state.characterJson);
  assert.equal(saved.inventoryItems.filter(i=>i.definitionId==='test-item-potion').reduce((n,i)=>n+i.qty,0),3);
  // All uses quantity per recipient and does not change dock membership.
  await gm.locator('[data-gms-qty]').fill('3');
  const recipientCount=await gm.evaluate(()=>ZargotaGmTable.targets().length);
  assert.equal(await drop('test-item-potion','[data-gms-all]'),recipientCount);
  await gm.screenshot({path:out+'/item-library.png'});
  assert.equal(await gm.locator('.gms-result').isVisible(),false);

  await late.locator('#character-item-arrival').waitFor();
  await late.locator('[data-arrival-accept]').click();await late.locator('#character-item-arrival').waitFor({state:'detached'});
  await gm.locator('#gms-library input[type=search]').fill('Медная монета');
  await gm.locator('[data-gms-qty]').fill('350');
  assert.equal(await drop('shp_currency_copper','[data-gm-key="sheet-test-esteros"]'),1);
  await late.locator('#character-item-arrival').waitFor();
  saved=JSON.parse(server[sid].state.characterJson);
  assert.equal(saved.coins.copper,450);assert.equal(saved.inventoryItems.some(i=>i.definitionId==='shp_currency_copper'),false);
  await late.locator('[data-arrival-accept]').click();await late.locator('#character-item-arrival').waitFor({state:'detached'});
  assert.equal((await late.evaluate(()=>__itemSounds)).filter(x=>x==='coinChange').length,1);
  await late.evaluate(()=>{_charSheetTab='inventory';renderCharSheet();});
  await late.locator('.zgmi-grid [data-key="inventoryItems-0"]').waitFor();
  await late.evaluate(()=>ZargotaI18n.setLocale('uk'));
  assert.doesNotMatch(await late.locator('.zgmi-grid').textContent(),/Без назви/);
  await late.locator('.zgmi-grid [data-key="inventoryItems-0"]').click({button:'right'});
  await late.locator('#zgmi-item-context').waitFor();
  await late.locator('#zgmi-item-context input').fill('1');
  await late.screenshot({path:out+'/item-remove-quantity.png'});
  await late.locator('#zgmi-item-context [data-remove]').click();
  await late.waitForFunction(()=>!document.querySelector('#zgmi-item-context'));
  for(let attempt=0;attempt<60&&JSON.parse(server[sid].state.characterJson).inventoryItems[0].qty!==1;attempt++)await new Promise(r=>setTimeout(r,100));
  assert.equal(JSON.parse(server[sid].state.characterJson).inventoryItems[0].qty,1);
  await late.locator('.zgmi-grid [data-key="inventoryItems-0"]').click({button:'right'});
  assert.equal(await late.locator('#zgmi-item-context input').count(),0,'single item needs no quantity picker');
  await late.locator('#zgmi-item-context [data-remove]').click();
  for(let attempt=0;attempt<60&&JSON.parse(server[sid].state.characterJson).inventoryItems[0].definitionId!=='test-item-sword';attempt++)await new Promise(r=>setTimeout(r,100));
  assert.equal(JSON.parse(server[sid].state.characterJson).inventoryItems[0].definitionId,'test-item-sword');

  // Old-version coin stack: explicit move credits wallet and removes only chosen units.
  saved=JSON.parse(server[sid].state.characterJson);
  saved.inventoryItems.unshift({itemId:'legacy-coin-stack',definitionId:'shp_currency_copper',name:'Медная монета',nameUk:'',qty:350,icon:'art:coin-pouch'});
  server[sid]=D.commit(server[sid],'test-gm',{character:saved,expectedRevision:server[sid].state.revision,operationId:'legacy-coin-fixture',source:'sheet'},Date.now());
  await broadcast(sid);
  await late.waitForFunction(()=>document.querySelector('.zgmi-grid [data-key="inventoryItems-0"]')?.textContent.includes('350'));
  assert.doesNotMatch(await late.locator('.zgmi-grid').textContent(),/Без назви/);
  await late.locator('.zgmi-grid [data-key="inventoryItems-0"]').click({button:'right'});
  await late.locator('#zgmi-item-context input').fill('350');
  await late.locator('#zgmi-item-context [data-wallet]').click();
  for(let attempt=0;attempt<60&&JSON.parse(server[sid].state.characterJson).coins.copper!==800;attempt++)await new Promise(r=>setTimeout(r,100));
  assert.equal(JSON.parse(server[sid].state.characterJson).coins.copper,800);
  assert.equal(JSON.parse(server[sid].state.characterJson).inventoryItems.some(i=>i.itemId==='legacy-coin-stack'),false);
  assert.equal((await late.evaluate(()=>__itemSounds)).filter(x=>x==='coinChange').length,2);
  await late.screenshot({path:out+'/wallet-repaired.png'});

  const layoutBefore=await gm.locator('[data-table-object]').first().boundingBox();
  const testCatalog=await gm.evaluate(()=>loadShopItems());
  await gm.reload();await gm.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await gm.waitForFunction(()=>ZargotaPersistentCharacters.tableHeroes().length>0);
  await gm.evaluate(catalog=>{window.loadShopItems=()=>catalog;zgIrlSessionStart();showPage('gm-table');},testCatalog);
  await gm.locator('[data-table-object]').waitFor();await gm.waitForTimeout(250);
  const layoutAfter=await gm.locator('[data-table-object]').boundingBox();
  assert.ok(Math.abs(layoutAfter.x-layoutBefore.x)<2&&Math.abs(layoutAfter.y-layoutBefore.y)<2,'position restored after reload');
  assert.equal(layoutAfter.width,layoutBefore.width,'size restored after reload');
  await gm.locator('.gmt-face').click();assert.equal(await gm.locator('.gmt-popup input').inputValue(),'4','prepared quantity restored');
  await gm.locator('.gmt-dismiss').click();
  const beforeCancel=await gm.locator('[data-table-object]').boundingBox();
  await gm.mouse.move(beforeCancel.x+20,beforeCancel.y+20);await gm.mouse.down();await gm.mouse.move(beforeCancel.x+80,beforeCancel.y+50,{steps:5});await gm.keyboard.press('Escape');await gm.mouse.up();
  const afterCancel=await gm.locator('[data-table-object]').boundingBox();assert.equal(afterCancel.x,beforeCancel.x,'Escape restores movement');
  // Mixed selection: actual marquee and mouse gestures, no synthetic grants.
  await gm.locator('.gms-launcher').click();
  await gm.locator('[data-gms-kind="statuses"]').click();
  await start('fear');await gm.mouse.move(800,560,{steps:10});await gm.mouse.up();
  await gm.locator('[data-gms-kind="items"]').click();
  await gm.locator('[data-gms-category]').selectOption('');
  await gm.locator('#gms-library input[type=search]').fill('');
  if(await gm.locator('[data-gms-favorites]').getAttribute('aria-pressed')==='true')await gm.locator('[data-gms-favorites]').click();
  await start('test-item-sword');await gm.mouse.move(1300,300,{steps:10});await gm.mouse.up();
  assert.equal(await gm.locator('[data-table-object]').count(),3);
  const allTiles=gm.locator('[data-table-object]');
  async function marqueePair(){
    const boxes=await allTiles.evaluateAll(nodes=>nodes.slice(0,2).map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));
    await gm.mouse.move(Math.min(...boxes.map(b=>b.x))-12,Math.min(...boxes.map(b=>b.y))-12);await gm.mouse.down();
    await gm.mouse.move(Math.max(...boxes.map(b=>b.right))+12,Math.max(...boxes.map(b=>b.bottom))+12,{steps:12});await gm.mouse.up();
    assert.equal(await gm.locator('.gmt-object.is-selected').count(),2);
    assert.equal(await gm.locator('.gmt-marquee').count(),0);
  }
  await marqueePair();
  await gm.screenshot({path:out+'/prepared-multiselect.png'});
  const pairBefore=await allTiles.evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop})));
  const leader=await allTiles.first().boundingBox(),noGrant=calls.length;
  await gm.mouse.move(leader.x+24,leader.y+24);await gm.mouse.down();await gm.mouse.move(leader.x+74,leader.y+64,{steps:10});await gm.mouse.up();
  const pairAfter=await allTiles.evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop})));
  assert.equal(pairAfter[0].x-pairBefore[0].x,50);assert.equal(pairAfter[1].x-pairBefore[1].x,50);
  assert.equal(pairAfter[0].y-pairBefore[0].y,40);assert.equal(pairAfter[1].y-pairBefore[1].y,40);
  assert.deepEqual(pairAfter[2],pairBefore[2]);assert.equal(calls.length,noGrant);
  assert.equal(await gm.locator('.gmt-popup').count(),0);
  // Modifier toggles never open details; Escape cancels a whole moving group.
  await allTiles.last().locator('.gmt-face').click({modifiers:['Shift']});assert.equal(await gm.locator('.gmt-object.is-selected').count(),3);
  await allTiles.last().locator('.gmt-face').click({modifiers:['Shift']});assert.equal(await gm.locator('.gmt-object.is-selected').count(),2);
  const firstGroupBox=await allTiles.first().boundingBox();
  await gm.mouse.move(firstGroupBox.x+24,firstGroupBox.y+24);await gm.mouse.down();await gm.mouse.move(firstGroupBox.x+90,firstGroupBox.y+60,{steps:5});await gm.keyboard.press('Escape');await gm.mouse.up();
  assert.deepEqual(await allTiles.evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop}))),pairAfter);
  assert.equal(await gm.locator('.gmt-object.is-selected').count(),0);
  await marqueePair();
  const mixedBefore=JSON.parse(server['test-vrotik'].state.characterJson),mixedCalls=calls.length;
  const mixBox=await allTiles.first().boundingBox();
  await gm.mouse.move(mixBox.x+24,mixBox.y+24);await gm.mouse.down();await gm.mouse.move(mixBox.x+60,mixBox.y+50,{steps:5});
  const mixedReceiver=await gm.locator('[data-gm-key="sheet-test-vrotik"]').boundingBox();
  await gm.mouse.move(mixedReceiver.x+40,mixedReceiver.y+40,{steps:10});await gm.mouse.up();
  await gm.waitForFunction(()=>document.querySelector('#gms-library').getAttribute('aria-busy')==='false');
  const mixedAfter=JSON.parse(server['test-vrotik'].state.characterJson);
  assert.equal(calls.length-mixedCalls,2,'item and status both saved');
  assert.equal(mixedAfter.gmItemGrants.length,mixedBefore.gmItemGrants.length+1);
  assert.equal(mixedAfter.gmItemGrants.at(-1).qty,4);
  assert.ok(mixedAfter.statuses.includes('fear'));
  assert.equal(await allTiles.count(),3);
  assert.equal(await gm.locator('.gmt-popup').count(),0);
  assert.equal(await gm.locator('.gms-ghost').count(),0);
  assert.deepEqual(await allTiles.evaluateAll(nodes=>nodes.map(n=>({x:n.offsetLeft,y:n.offsetTop}))),pairAfter,'grant keeps prepared group on table');
  await gm.mouse.click(550,200);assert.equal(await gm.locator('.gmt-object.is-selected').count(),0,'blank click clears selection');
  await marqueePair();
  const retainedId=await allTiles.last().getAttribute('data-table-object'),beforeDeleteCalls=calls.length;
  await allTiles.first().click({button:'right',position:{x:24,y:24}});
  assert.match(await gm.locator('[data-table-remove]').innerText(),/\(2\)/);
  await gm.screenshot({path:out+'/prepared-group-remove.png'});
  await gm.locator('[data-table-remove]').click();
  assert.equal(await allTiles.count(),1);assert.equal(await allTiles.first().getAttribute('data-table-object'),retainedId);
  assert.equal(await gm.locator('.gmt-object.is-selected').count(),0);assert.equal(calls.length,beforeDeleteCalls,'table deletion never changes sheets');
  assert.equal(await gm.evaluate(()=>JSON.parse(localStorage.getItem('zg-gm-table-objects-v1:test-gm')).length),1,'group deletion persisted');
  await allTiles.first().click({modifiers:['Shift'],position:{x:24,y:24}});
  await gm.mouse.click(550,200,{button:'right'});
  assert.equal(await gm.locator('[data-table-remove]').count(),1,'selected cards can be removed from blank table context menu');
  await gm.locator('[data-table-remove]').click();assert.equal(await allTiles.count(),0);
  console.log('PASS marquee: mixed selection, modifier toggle, group movement/spacing, Escape rollback, mixed item/status grant, blank deselection.');
  await late.evaluate(()=>{showPage('home');});await late.waitForTimeout(800);
  const liveCharacter=JSON.parse(server[sid].state.characterJson);
  liveCharacter.inventoryItems=[];
  liveCharacter.gmItemAccepted={};
  server[sid]=D.commit(server[sid],'test-gm',{operationId:'test-arrival-remove',expectedRevision:server[sid].state.revision,source:'sheet',character:liveCharacter},Date.now());
  await broadcast(sid);
  await late.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});await late.waitForTimeout(1000);
  assert.equal(await late.evaluate(()=>ZargotaPersistentCharacters.itemInbox(viewingCharId).items.filter(r=>!r.currency).length),0,'deleted items not announced on return');
  console.log('PASS arrival polish: masked artwork, rarity, gentle loop, no title overlap; removed grants excluded on phone.');
  await gm.locator('[data-gms-kind="special"]').click();
  assert.equal(await gm.locator('[data-gms-drag]').count(),22);
  await late.evaluate(()=>{document.getElementById('character-item-arrival')?.remove();window._charSheetTab='stats';openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  for(let level=1;level<=2;level++){
   await start('exhausted');const box=await gm.locator('[data-gm-key="sheet-test-esteros"]').boundingBox();await gm.mouse.move(box.x+40,box.y+40,{steps:12});await gm.mouse.up();
   await gm.waitForFunction(()=>document.querySelector('#gms-library').getAttribute('aria-busy')==='false');
   await late.waitForFunction(level=>document.querySelector('.zgmo-exhaustion')?.textContent===level+'/5',level);
  }
  await late.locator('[data-zgmo=exhaustion]').click();await late.waitForTimeout(500);
  assert.equal(await late.locator('.zgmo-exhaustion-pips .filled').count(),2);
  await late.screenshot({path:out+'/exhaustion-player.png'});
  console.log('PASS Special: actual exhaustion drag twice, shared sheet level and mobile popup.');
  await late.locator('#zgmo-modal [data-zgmo=close]').click();
  async function specialDrop(key){await start(key);const box=await gm.locator('[data-gm-key="sheet-test-esteros"]').boundingBox();await gm.mouse.move(box.x+40,box.y+40,{steps:12});await gm.mouse.up();await gm.waitForFunction(()=>document.querySelector('#gms-library').getAttribute('aria-busy')==='false');}
  await specialDrop('inspiration');
  await late.waitForFunction(()=>document.querySelector('.zgmo-inspiration b')?.textContent==='1');
  await late.locator('.zgmo-inspiration-feedback').waitFor();
  await late.waitForFunction(()=>/Натхнення|Вдохновение/.test(document.querySelector('#character-status-arrival')?.textContent||''));
  await late.locator('[data-zgmo=inspiration]').click();
  await late.locator('[data-zgmo=spend-inspiration]').click();
  await late.waitForFunction(()=>document.querySelector('.zgmo-inspiration b')?.textContent==='0');
  assert.equal(JSON.parse(server[sid].state.characterJson).inspiration,0);
  assert.ok(await late.locator('#zgmo-modal .zgmo-inspiration-feedback').count(),'spending feedback appears inside the open popup');
  assert.equal(await late.locator('[data-zgmo=spend-inspiration]').isDisabled(),true);
  await late.locator('#zgmo-modal [data-zgmo=close]').click();
  await specialDrop('injury:broken-arm');
  await late.waitForFunction(()=>document.querySelector('.zgmo-injuries span')?.textContent==='1');
  await late.waitForFunction(()=>/Отримано травму|Получена травма/.test(document.querySelector('#character-status-arrival')?.textContent||''));
  await late.locator('[data-zgmo=injuries]').click();
  assert.equal(await late.locator('.zgmo-injury-detail article').count(),1);
  assert.equal(await late.locator('[data-zgmo=remove-injury]').count(),0,'player cannot remove assigned injury');
  await late.waitForTimeout(500);await late.screenshot({path:out+'/injuries-player.png'});
  await late.locator('#zgmo-modal [data-zgmo=close]').click();
  await specialDrop('inspiration');
  await late.waitForFunction(()=>document.querySelector('.zgmo-inspiration b')?.textContent==='1');
  await late.waitForTimeout(2600);await late.screenshot({path:out+'/special-player.png'});
  assert.equal(await late.locator('.zgmo-exhaustion').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  await late.reload();await late.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await late.waitForFunction(()=>document.querySelector('.zgmo-inspiration b')?.textContent==='1');
  assert.equal(await late.locator('.zgmo-inspiration-feedback').count(),0,'received animation is not replayed on refresh');
  const injuryId=JSON.parse(server[sid].state.characterJson).injuries[0].id;
  const removed=await gm.evaluate(async id=>{const row=ZargotaPersistentCharacters.tableHeroes().find(r=>r.sheetId==='test-esteros');return ZargotaPersistentCharacters.specialWrite(row.localId,'remove-injury',id);},injuryId);
  assert.equal(removed.ok,true);await late.waitForFunction(()=>document.querySelector('.zgmo-injuries span')?.textContent==='0');
  await start('inspiration');await gm.mouse.move(1000,300,{steps:12});await gm.mouse.up();
  const prepared=gm.locator('.gmt-object').filter({hasText:/Вдохновение|Натхнення/}).last();await prepared.waitFor();
  const pb=await prepared.locator('.gmt-face').boundingBox();
  await gm.mouse.move(pb.x+20,pb.y+20);await gm.mouse.down();await gm.mouse.move(pb.x+80,pb.y+80,{steps:5});await gm.locator('.gms-all').waitFor({state:'visible'});
  const recipient=await gm.locator('[data-gm-key="sheet-test-esteros"]').boundingBox();await gm.mouse.move(recipient.x+70,recipient.y+35,{steps:15});await gm.mouse.up();
  await late.waitForFunction(()=>document.querySelector('.zgmo-inspiration b')?.textContent==='2');
  console.log('PASS master injury removal and prepared inspiration drag from table.');
  console.log('PASS special: real injury/inspiration drops, player spend, zero floor, persistent reload, single frame and once-only feedback.');
  assert.deepEqual(errors,[]);
  console.log('PASS table preparation: placement, left-drag, corner resize, quantity, reusable grant, removal, reload, Escape; items: real drag, canonical inventory+receipt, batch arrows, one animation, accept/reload, RU/UK, offline fresh client, all recipients; no live accounts.');
 }catch(e){console.error(e);for(let i=0;i<pages.length;i++)if(!pages[i].isClosed())await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
