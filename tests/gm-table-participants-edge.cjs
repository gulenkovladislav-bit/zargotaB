'use strict';
// Two isolated browser clients, real sheet controller/renderers and transactional
// domain model. The transport alone is substituted; no live accounts are touched.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../functions/character-domain');
const clone=x=>JSON.parse(JSON.stringify(x));
const url=process.env.ZG_TEST_URL||'http://127.0.0.1:8957/';
const out=process.env.ZG_TEST_OUTPUT||'/private/tmp/zg-table-participants';
const heroes=require('../data/campaign-heroes.v1.json').heroes.map(c=>({...clone(c),statuses:c.statuses||[],deathSaves:c.deathSaves||{success:0,fail:0},spellCD:c.spellCD||{},battleEcho:c.battleEcho||''}));
heroes.push({...clone(heroes[0]),id:9876501,campaignKey:'custom-table-hero',name:'Другой игрок',portrait:'',inventoryItems:[]});
const server=Object.fromEntries(heroes.map(c=>['test-'+c.campaignKey,D.initial(c,'test-gm','player-'+c.campaignKey,'test-only-code',1)]));
const sid='test-esteros',playerUid='player-esteros';
const pages=[],calls=[];
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
   assert.equal(req.action,'save');assert.ok(ids[req.sheetId]);
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
  await p.goto(url);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await p.waitForFunction(n=>Object.values(ZargotaPersistentCharacters.status().records).filter(e=>e.base).length===n,role==='admin'?6:1);
  console.log('Loaded',role);return {p,context};
 }
 try{
  const {p:gm,context:gmContext}=await openClient('admin');
  const {p:player}=await openClient('player');
  await gm.evaluate(()=>{zgIrlSessionStart();showPage('gm-table');});
  console.log('Table opened');await gm.waitForFunction(()=>ZargotaPersistentCharacters.tableHeroes().every(r=>r.ready));console.log('Ready');
  assert.equal(await gm.locator('[data-gm-open]').count(),5,'existing five profiles are retained by default');
  assert.equal(await gm.locator('[data-gm-add-player]').count(),0,'no plus once five profiles are on the table');
  const before=calls.length;
  await gm.locator('[data-gm-open="sheet-test-vrotik"]').click({button:'right',position:{x:30,y:30}});
  assert.equal(await gm.locator('.zg-gm-participant-menu [role=status]').textContent(),'Не в сети');
  const menuBox=await gm.locator('.zg-gm-participant-menu').boundingBox();
  assert.ok(menuBox.x>=0&&menuBox.y>=0&&menuBox.y+menuBox.height<=1000);
  await gm.screenshot({path:out+'/00-context-menu.png'});
  await gm.locator('[data-gmp-remove]').click();
  assert.equal(await gm.locator('[data-gm-open]').count(),4);
  assert.equal(await gm.locator('[data-gm-add-player]').count(),1,'plus returns after removing a profile');
  assert.ok(server['test-vrotik'],'removal keeps the original sheet');
  await openPicker(gm);
  await gm.locator('[data-gm-participant="test-vrotik"]').check();
  await gm.locator('[data-gmp-apply]').click();
  assert.equal(await gm.locator('[data-gm-open]').count(),5);
  assert.equal(await gm.locator('[data-gm-add-player]').count(),0);

  await openPicker(gm);
  const picker=gm.locator('dialog.zg-gm-participants');
  assert.equal(await picker.locator('input[type=checkbox]').count(),6,'all real profiles, including non-campaign hero');
  assert.equal(await picker.locator('[data-gmp-status="test-esteros"]').textContent(),'В сети');
  assert.equal(await picker.locator('[data-gmp-status="test-custom-table-hero"]').textContent(),'Не в сети');
  await picker.locator('[data-gm-participant="test-custom-table-hero"]').check();
  // Repaint on presence must preserve an in-progress selection and its DOM node.
  const checkbox=await picker.locator('[data-gm-participant="test-custom-table-hero"]').elementHandle();
  presence={...presence,'player-custom-table-hero':{phone:{online:true}}};await presenceChanged();
  await gm.waitForFunction(()=>document.querySelector('[data-gmp-status="test-custom-table-hero"]').textContent==='В сети');
  assert.equal(await checkbox.evaluate(el=>el.isConnected&&el.checked),true);
  await gm.screenshot({path:out+'/01-picker.png'});
  await picker.locator('[data-gmp-apply]').click();
  assert.equal(await gm.locator('[data-gm-open]').count(),6);
  assert.equal(calls.length,before,'choosing profiles does not write any character');
  await gm.locator('[data-gm-open="sheet-test-esteros"]').click({position:{x:30,y:30}});
  await gm.locator('.zg-gm-sheet-host .zgmo-nav').waitFor();
  assert.equal(await gm.locator('#char-sheet').count(),1);
  assert.equal(await gm.locator('.zg-gm-phone iframe').count(),0);
  // Escape dismisses only the participant dialog, preserving the open sheet.
  await openPicker(gm);await gm.keyboard.press('Escape');
  assert.equal(await gm.locator('.zg-gm-phone.open').count(),1);
  await player.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='esteros').id);});
  const originalHp=JSON.parse(server[sid].state.characterJson).hpCur;
  assert.equal(await gm.evaluate(()=>ZargotaGmTable.isEditing(viewingCharId)),false,'hidden display:none editor must not defer incoming packets');await player.locator('[data-zgmo=damage]').click();
  await gm.waitForFunction(hp=>document.querySelector('[data-gm-key="sheet-test-esteros"] .zg-gm-hp b').textContent===String(hp-1),originalHp);
  await gm.waitForFunction(()=>ZargotaPersistentCharacters.tableHeroes().find(r=>r.sheetId==='test-esteros').ready);
  await gm.locator('[data-gm-key="sheet-test-esteros"] [data-gm-hp="1"]').click();
  await player.waitForFunction(hp=>characters.find(c=>c.campaignKey==='esteros').hpCur===hp,originalHp);
  // A full mobile-sheet save (not only the dock HP operation) reaches the GM.
  await player.evaluate(async()=>{const c=characters.find(c=>c.campaignKey==='esteros');c.notes='Запись игрока';c.statuses=['bleed'];await saveChars();});
  await gm.waitForFunction(()=>characters.find(c=>c.campaignKey==='esteros').notes==='Запись игрока');
  await gm.waitForFunction(()=>document.querySelector('[data-gm-key="sheet-test-esteros"] .zg-gm-statuses').textContent.includes('Кровотечение'));
  await gm.evaluate(async()=>{const c=characters.find(c=>c.campaignKey==='esteros');c.notes='Ответ мастера';await saveChars();});
  await player.waitForFunction(()=>characters.find(c=>c.campaignKey==='esteros').notes==='Ответ мастера');
  await gm.screenshot({path:out+'/02-connected-sheet.png'});
  // The player going offline does not remove the character or invent a disconnect.
  delete presence[playerUid];await presenceChanged();
  await gm.waitForFunction(()=>!ZargotaPersistentCharacters.tableHeroes().find(r=>r.sheetId==='test-esteros').online);
  assert.equal(await gm.locator('[data-gm-open="sheet-test-esteros"]').count(),1);
  // Master network loss locks the transactional HP controls; reconnect restores them.
  await gmContext.setOffline(true);
  await gm.waitForFunction(()=>document.querySelector('[data-gm-key="sheet-test-esteros"] [data-gm-hp="-1"]').disabled);
  await gmContext.setOffline(false);
  await gm.waitForFunction(()=>!document.querySelector('[data-gm-key="sheet-test-esteros"] [data-gm-hp="-1"]').disabled);
  await gm.locator('[data-gm-close]').click();
  await gm.reload();await gm.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await gm.waitForFunction(()=>ZargotaPersistentCharacters.tableHeroes().length===6);
  await gm.evaluate(()=>{zgIrlSessionStart();showPage('gm-table');});
  assert.equal(await gm.locator('[data-gm-open]').count(),6,'selection survives reload');
  await openPicker(gm);
  const count=calls.length;
  await gm.locator('[data-gm-participant="test-custom-table-hero"]').uncheck();
  await gm.locator('[data-gmp-cancel]').click();
  assert.equal(await gm.locator('[data-gm-open]').count(),6,'cancel preserves roster');
  await gm.evaluate(()=>ZargotaI18n.setLocale('uk'));
  await openPicker(gm);
  assert.equal(await gm.locator('#zg-gmp-title').textContent(),'Учасники столу');
  for(const c of await gm.locator('[data-gm-participant]').all())await c.uncheck();
  await gm.locator('[data-gmp-apply]').click();
  assert.equal(await gm.locator('[data-gm-open]').count(),0);
  assert.equal(await gm.locator('.zg-gm-empty-party').textContent(),'Додайте гравців через ＋');
  assert.equal(calls.length,count,'removing profiles does not delete or alter their sheets');
  // Signout must not expose local replicas of account sheets in the dock.
  await gm.evaluate(()=>ZargotaPersistentCharacters.logout());
  assert.equal(await gm.locator('[data-gm-open]').count(),0);
  await openPicker(gm);
  assert.equal(await gm.locator('[data-gm-participant]').count(),0);
  assert.equal(await gm.locator('[data-gmp-apply]').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: profile picker, five-card layout, context menu removal, presence, same native sheet, bidirectional HP/full saves, offline, reload, cancellation, removal, logout, RU/UK; no production access.');
 }catch(e){console.error(e);for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});console.log('Client',i,await pages[i].evaluate(()=>({focus:document.activeElement?.outerHTML,editorStyle:document.getElementById('char-editor-view')?.getAttribute('style'),editorVisible:getComputedStyle(document.getElementById('char-editor-view')).display,gmEditing:ZargotaGmTable.isEditing(viewingCharId),numberPad:!!document.getElementById('zgmo-number-pad'),identity:ZargotaPersistentCharacters.tableIdentity(),rows:ZargotaPersistentCharacters.tableHeroes().map(r=>({id:r.sheetId,state:r.state})),records:Object.values(ZargotaPersistentCharacters.status().records).map(e=>({base:e.base?.revision,allowed:e.allowed,error:e.error,pending:!!e.pending,conflict:e.conflict}))})).catch(()=>({})));}throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
