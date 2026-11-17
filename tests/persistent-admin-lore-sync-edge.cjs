'use strict';
// Full mobile application + real sync controller, deterministic transactional server.
// No credentials, production writes, or biography/family display fallbacks.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const D=require('../functions/character-domain');
const seeds=require('../data/campaign-heroes.v1.json').heroes;
const url=process.env.ZG_TEST_URL||'http://127.0.0.1:8880';
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const browser=await (process.env.ZG_ENGINE==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'}));
 const duplicates=process.env.ZG_TEST_OLD_DUPLICATES==='1';
 const server={},records={},local=[],calls=[],pages=[];
 const account={uid:'test-admin',role:'admin'};
 for(const seed of seeds){
  const hero={...clone(seed),biography:'',biographyUk:'',family:[],deathSaves:seed.deathSaves||{success:0,fail:0},statuses:seed.statuses||[],spellCD:seed.spellCD||{},battleEcho:seed.battleEcho||''};
  const sid=hero.campaignKey;
  const base=D.initial(hero,account.uid,'test-player',D.code(),100);
  const updated={...hero,biography:'История '+hero.name+'. Проверка серверного текста.',biographyUk:'Історія '+hero.name+'. Перевірка серверного тексту.',family:[{id:'parent',name:'Родитель',nameUk:'Батько',relation:'Семья',relationUk:'Родина'}]};
  server[sid]=D.commit(base,account.uid,{character:updated,expectedRevision:1,operationId:'server_update_'+sid},200);
  records[sid]={allowed:true,role:'master',localId:duplicates?hero.id+100:hero.id,remoteId:hero.id,remoteKey:sid,base:base.state};
  if(duplicates)local.push({...hero,name:hero.name+' (старая копия)'});
  local.push({...hero,id:records[sid].localId,notes:'Сохранить мою локальную заметку'});
 }
 const ids=Object.fromEntries(Object.keys(server).map(id=>[id,'master']));
 async function open(cached){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await context.newPage();pages.push(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('__syncServer',async req=>{
   if(req.action==='boot')return {account,ids,packets:Object.fromEntries(Object.entries(server).map(([k,v])=>[k,v.state]))};
   if(req.action==='read')return server[req.sheetId].state;
   assert.equal(req.action,'save');calls.push(clone(req));
   server[req.sheetId]=D.commit(server[req.sheetId],account.uid,req,Date.now());
   const packet=clone(server[req.sheetId].state);
   setTimeout(()=>pages.forEach(p=>{if(!p.isClosed())p.evaluate(({sid,packet})=>window.__syncWatchers?.[sid]?.(packet),{sid:req.sheetId,packet}).catch(()=>{});}),10);
   return {state:packet};
  });
  await page.addInitScript(({account,records,local,cached})=>{
   if(sessionStorage.getItem('sync-fixture-started'))return;
   sessionStorage.setItem('sync-fixture-started','yes');
   if(cached)localStorage.setItem('grimoire_chars',JSON.stringify(local));
   localStorage.setItem('zargota_persistent_characters_v1',JSON.stringify({enabled:true,activeUid:account.uid,identities:{[account.uid]:account},accounts:{[account.uid]:cached?records:{}}}));
   localStorage.setItem('zargota_ui_locale_v1','ru');
  },{account,records,local,cached});
  await page.route('**/persistent-character-transport.js*',r=>r.fulfill({contentType:'application/javascript',body:`window.ZargotaPersistentTransport={available:()=>true,start:async()=>{const d=await window.__syncServer({action:'boot'}),noop=()=>()=>{};window.__syncWatchers={};return {uid:()=>d.account.uid,account:async()=>d.account,list:async()=>d.ids,meta:async()=>({ownerUid:d.account.uid,playerUid:'test-player'}),watch:(sid,fn)=>{window.__syncWatchers[sid]=fn;setTimeout(()=>fn(d.packets[sid]),50);return()=>delete window.__syncWatchers[sid]},read:sid=>window.__syncServer({action:'read',sheetId:sid}),call:req=>window.__syncServer(req),watchMeta:noop,watchLastSeen:noop,watchActivity:noop,presence:noop,watchMessages:noop}}};`}));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records).length===5&&Object.values(ZargotaPersistentCharacters.status().records).every(e=>e.base?.revision>=3&&!e.pending&&!e.conflict),null,{timeout:20000});
  return {page,context,errors};
 }
 async function verify(page){
  if(duplicates){
   await page.evaluate(()=>showPage('characters'));
   assert.equal(await page.locator('.roster-thumb').count(),5,'old empty copies must not appear in the roster');
   assert.equal(await page.evaluate(()=>characters.filter(c=>String(c.name).endsWith('(старая копия)')).length),5,'keep old local copies intact');
  }
  for(const seed of seeds){
   await page.evaluate(()=>showPage('characters'));
   if(await page.locator('[data-zgml=back]').isVisible())await page.locator('[data-zgml=back]').tap();
   await page.getByRole('button',{name:seed.name,exact:true}).click();
   await page.locator('[data-roster-action=open]').click();
   if(duplicates)await page.evaluate(id=>openCharSheet(id),seed.id);
   await page.locator('button[onclick*="_charSheetTab"][onclick*="lore"]').click();
   for(const locale of ['ru','uk']){
    await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);
    await page.locator('[data-zgml=story]').tap();
    const expected=JSON.parse(server[seed.campaignKey].state.characterJson)[locale==='ru'?'biography':'biographyUk'];
    assert.equal((await page.locator('.zgml-story-full>p').allTextContents()).join('\n\n'),expected);
    if(seed.campaignKey==='lin-yin'&&locale==='ru')await page.waitForTimeout(300);
    if(seed.campaignKey==='lin-yin'&&locale==='ru')await page.screenshot({path:'/private/tmp/zg-admin-lore-sync-fixed.png'});
    const rect=await page.locator('#zgml-dialog').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=845);
    await page.locator('#zgml-dialog [data-zgml=close]').tap();
    await page.locator('[data-zgml=tree]').first().tap();assert.equal(await page.locator('.zgml-tree [data-key]').count(),1);
    await page.locator('#zgml-dialog [data-zgml=close]').tap();
   }
   assert.equal(await page.evaluate(id=>characters.find(c=>c.id===ZargotaPersistentCharacters.resolveCharacterId(id)).notes,seed.id),'Сохранить мою локальную заметку');
   await page.evaluate(()=>ZargotaI18n.setLocale('ru'));
  }
 }
 try{
  const first=await open(true);console.log('Cached admin synchronized');await verify(first.page);console.log('Five mobile sheets verified');
  assert.equal(calls.length,5);assert.ok(calls.every(c=>c.expectedRevision===2));
  const second=await open(duplicates);await verify(second.page);
  await first.page.reload();await first.page.locator('#zg-data-loader-splash').waitFor({state:'hidden'});await verify(first.page);
  assert.equal(calls.length,5,'Reload and second client must not rewrite synchronized data');
  await first.page.evaluate(async()=>{await ZargotaPersistentCharacters.logout();showPage('characters');showCharView('list');});
  const notice=first.page.locator('#pc-access-char-list-view');
  await notice.waitFor({state:'visible'});assert.match(await notice.innerText(),/локальные листы/);
  const rect=await notice.boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<844);
  await notice.getByRole('button',{name:'Войти',exact:true}).tap();await first.page.locator('#persistent-login-code').waitFor();
  await first.page.screenshot({path:'/private/tmp/zg-local-sheets-signin.png'});
  assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);
  console.log('PASS: admin roster → sheet → Lore → My history; all five heroes RU/UK; family; local notes; revision-safe saves; second client; reload');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
