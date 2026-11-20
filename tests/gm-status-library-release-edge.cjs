'use strict';
// Two isolated browser clients, real sheet controller/renderers and transactional
// domain model. The transport alone is substituted; no live accounts are touched.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('../functions/character-domain');
const clone=x=>JSON.parse(JSON.stringify(x));
const url=process.env.ZG_TEST_URL||'http://127.0.0.1:8957/';
const out=process.env.ZG_TEST_OUTPUT||'/private/tmp/zg-status-library';
const heroes=require('../data/campaign-heroes.v1.json').heroes.map(c=>({...clone(c),statuses:c.statuses||[],deathSaves:c.deathSaves||{success:0,fail:0},spellCD:c.spellCD||{},battleEcho:c.battleEcho||''}));
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
  await p.goto(url);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await p.waitForFunction(n=>Object.values(ZargotaPersistentCharacters.status().records).filter(e=>e.base).length===n,role==='admin'?6:1);
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
  await start('bleed');assert.ok((await first.boundingBox()).x>original.x+50);
  await gm.screenshot({path:out+'/01-drag-all-zone.png'});
  await gm.keyboard.press('Escape');await gm.mouse.up();
  assert.equal(calls.length,0);assert.equal(await gm.locator('[data-gms-all]').isVisible(),false);
  assert.ok(Math.abs((await first.boundingBox()).x-original.x)<1);
  await start('fear');await gm.mouse.move(850,350);await gm.mouse.up();assert.equal(calls.length,0);
  // One real pointer drop; phone receives the same canonical effect.
  assert.equal(await drop('bleed','[data-gm-key="sheet-test-esteros"]'),1);
  await player.waitForFunction(()=>characters.some(c=>(c.tempEffects||[]).some(e=>e.statusKey==='bleed')));
  assert.equal(await gm.locator('.zg-gm-sheet-host').count(),0,'a completed drag does not accidentally open the sheet');
  await player.locator('#character-status-arrival').waitFor();
  assert.match(await player.locator('#character-status-arrival').textContent(),/Кровотечение.*3 раунд/);
  assert.equal(await player.locator('#character-status-arrival button').count(),0);
  assert.equal(await player.locator('#character-status-arrival').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await player.waitForTimeout(300);await player.screenshot({path:out+'/04-player-status-arrival.png'});
  await player.evaluate(()=>ZargotaI18n.setLocale('uk'));
  assert.match(await player.locator('#character-status-arrival').textContent(),/Кровотеч/);
  await player.screenshot({path:out+'/05-player-status-arrival-uk.png'});
  await player.evaluate(()=>ZargotaI18n.setLocale('ru'));
  await broadcast(sid);
  await player.locator('#character-status-arrival').waitFor({state:'detached'});
  await player.waitForTimeout(250);assert.equal(await player.locator('#character-status-arrival').count(),0,'same snapshot does not replay banner');
  let saved=JSON.parse(server[sid].state.characterJson);
  assert.equal(saved.tempEffects.find(e=>e.statusKey==='bleed').remaining,3);
  assert.equal(saved.tempEffects.find(e=>e.statusKey==='bleed').tickValue,-1);
  assert.equal(await gm.locator('.gms-result').isVisible(),false,'no success popup');
  await gm.evaluate(()=>ZargotaI18n.setLocale('uk'));
  // Right click in the actual mobile sheet mounted on the master table.
  await gm.locator('[data-gm-open="sheet-test-esteros"]').click({position:{x:30,y:30}});
  const statusCard=gm.locator('.zg-gm-sheet-host [data-zgmo="status"]').first();
  await statusCard.scrollIntoViewIfNeeded();
  await statusCard.click({button:'right'});
  assert.equal(await gm.locator('#zgmo-status-menu').isVisible(),true);
  assert.equal(await gm.locator('#zgmo-status-menu button').textContent(),'Прибрати');
  assert.equal(await gm.locator('#status-info-popup').count(),0,'right click does not open details');
  await gm.keyboard.press('Escape');assert.equal(await gm.locator('#zgmo-status-menu').count(),0);
  assert.equal(await gm.locator('.zg-gm-phone').isVisible(),true,'Escape only dismisses the context menu');
  await statusCard.click();await gm.locator('#status-info-popup').waitFor();
  await gm.locator('.zgmo-status-dismiss').click();await gm.locator('#status-info-popup').waitFor({state:'detached'});
  const removedKey=await gm.evaluate(()=>{const c=characters.find(c=>c.campaignKey==='esteros');return c.tempEffects.filter(e=>e.type==='status')[0].statusKey;});
  await statusCard.click({button:'right'});await gm.screenshot({path:out+'/06-status-context-menu.png'});
  await gm.locator('#zgmo-status-menu button').click();
  await player.waitForFunction(key=>!characters.find(c=>c.campaignKey==='esteros').statuses.includes(key),removedKey);
  assert.ok(!JSON.parse(server[sid].state.characterJson).statuses.includes(removedKey),'context removal saved and received by player');
  await player.reload();await player.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records).some(e=>e.base));
  assert.equal(await player.locator('#character-status-arrival').count(),0,'reload never replays existing states');
  assert.deepEqual(errors,[]);console.log('PASS: drag target displacement/reset, Escape, empty drop, canonical grant, mobile banner RU/UK, no success popup, right-click removal, reload suppression; no live accounts.');
 }catch(e){console.error(e);for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
