'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765/?firebase_emulator=1';
const out='/tmp/zargota-persistent-review';
const {provisionTestAdmin}=require('./persistent-admin-fixture.cjs');
async function loaded(page){await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(()=>zgCharacterLoadPromise);}
async function record(page){return page.evaluate(()=>Object.values(ZargotaPersistentCharacters.status().records)[0]);}
async function settled(page,revision){await page.waitForFunction(n=>{const e=Object.values(ZargotaPersistentCharacters.status().records)[0];return e&&e.base&&e.base.revision>=n&&!e.pending&&!e.conflict;},revision,{timeout:20000});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const gmContext=await browser.newContext({viewport:{width:1280,height:900}}),playerContext=await browser.newContext({viewport:{width:390,height:750},isMobile:true,hasTouch:true});
  for(const context of [gmContext,playerContext])await context.route(/https:\/\/.*(firebaseio.com|identitytoolkit.googleapis.com|firebasedatabase.app).*/,r=>r.abort());
  const gm=await gmContext.newPage(),player=await playerContext.newPage();let errors=[];for(const p of [gm,player])p.on('pageerror',e=>errors.push(e.message));
  await Promise.all([loaded(gm),loaded(player)]);
  const admin=provisionTestAdmin();await gm.evaluate(code=>ZargotaPersistentCharacters.login(code),admin.code);await gm.locator('#persistent-character-dialog [data-pc-action=close]').click();
  const result=await gm.evaluate(async()=>{
    const hero=JSON.parse(JSON.stringify(characters[0]));hero.id=921334;hero.name='Проверка постоянного листа';hero.portrait='';hero.hpCur=14;hero.hpMax=14;hero.baseHpMax=14;hero.inventoryItems=[];hero.equipItems=[];hero.arenaEquipSlots={};hero.stats.str.cur=1;hero.stats.str.base=1;hero.notes='';
    characters.push(hero);await ZargotaCharacterStore.saveCharacter(hero.id,hero,characters,{replace:true});showPage('characters');openCharSheet(hero.id);return await ZargotaPersistentCharacters.create(hero.id);
  });
  await player.locator('#persistent-entry').click();await player.locator('#persistent-login-code').fill(result.code);await player.locator('[data-pc-action=login]').click();
  await settled(player,1);await player.locator('#persistent-sheet-status').waitFor();
  assert.equal(await player.locator('[data-pc-action=history]').count(),0);
  const input=player.locator('input[onchange*="updateStatField"][onchange*="str"]').first();await input.fill('4');await input.blur();
  await settled(player,2);await settled(gm,2);assert.equal(await gm.evaluate(()=>characters.find(c=>c.id===921334).stats.str.cur),4);
  await gm.locator('[data-pc-action=history]').click();assert.ok((await gm.locator('#persistent-character-dialog').innerText()).includes('Игрок'));await gm.locator('#persistent-character-dialog summary').filter({hasText:'Характеристики'}).first().click();assert.ok((await gm.locator('#persistent-character-dialog').innerText()).includes('Было'));
  await gm.screenshot({animations:'disabled',path:out+'/master-history.png'});await gm.keyboard.press('Escape');
  await gm.evaluate(async()=>{const c=characters.find(c=>c.id===921334);c.inventoryItems.push({itemId:'gift-key',name:'Ключ мастера',qty:1});c.notes='Новая информация от мастера';await saveChars();});
  await settled(gm,3);await settled(player,3);assert.equal(await player.evaluate(()=>characters.find(c=>c.id===921334).notes),'Новая информация от мастера');
  const uid=(await player.evaluate(()=>ZargotaPersistentCharacters.status())).uid;await player.reload();await player.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await settled(player,3);
  assert.equal((await player.evaluate(()=>ZargotaPersistentCharacters.status())).uid,uid,'same login after reload');
  await player.evaluate(()=>{showPage('characters');openCharSheet(921334);});await player.screenshot({animations:'disabled',path:out+'/player-mobile.png'});
  assert.equal(await player.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
  // Start typing while the remote snapshot is already waiting for IndexedDB.
  await player.evaluate(()=>{const save=ZargotaCharacterStore.saveCharacter;let held=false;ZargotaCharacterStore.saveCharacter=function(...args){if(held)return save(...args);held=true;window.incomingHeld=true;return new Promise(resolve=>window.releaseIncoming=resolve).then(()=>save(...args));};});
  await gm.evaluate(async()=>{characters.find(c=>c.id===921334).notes='Изменено параллельно';await saveChars();});await settled(gm,4);
  await player.waitForFunction(()=>window.incomingHeld);
  const focus=player.locator('input[onchange*="updateStatField"][onchange*="str"]').first();await focus.focus();await focus.fill('6');await focus.evaluate(el=>window.persistentFocus=el);
  await player.evaluate(()=>releaseIncoming());
  await player.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records)[0].remote);
  assert.equal(await focus.evaluate(el=>el===window.persistentFocus&&el===document.activeElement),true);assert.equal(await focus.inputValue(),'6');await focus.blur();
  await player.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records)[0].conflict);
  await player.locator('[data-pc-action=conflict]').click();await player.screenshot({animations:'disabled',path:out+'/conflict-mobile.png'});
  await player.locator('[data-pc-action=take-remote]').click();await settled(player,4);assert.equal(await player.evaluate(()=>characters.find(c=>c.id===921334).notes),'Изменено параллельно');
  // Offline outbox survives a page reload and sends once connectivity returns.
  await playerContext.setOffline(true);await player.evaluate(async()=>{characters.find(c=>c.id===921334).notes='Черновик без сети';await saveChars();});await player.waitForFunction(()=>Object.values(ZargotaPersistentCharacters.status().records)[0].pending);
  await player.waitForFunction(async()=>{const cache=await ZargotaPersistentCache.read();return Object.values(cache.accounts).some(records=>Object.values(records).some(e=>e.pending));});
  await playerContext.setOffline(false);await player.reload();await player.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await settled(player,5);await settled(gm,5);
  assert.equal(await player.evaluate(()=>characters.find(c=>c.id===921334).notes),'Черновик без сети');
  await player.evaluate(()=>{showPage('characters');openCharSheet(921334);});
  await player.locator('[data-pc-action=lock]').click();await player.locator('[data-pc-action=set-lock]').click();await player.locator('#persistent-issued-code').waitFor();
  const sharedUrl=await player.locator('#persistent-issued-code').inputValue();await player.keyboard.press('Escape');
  const observerContext=await browser.newContext(),observer=await observerContext.newPage();await observer.goto(sharedUrl);await observer.locator('#persistent-character-dialog').waitFor();assert.ok((await observer.locator('#persistent-character-dialog').innerText()).includes('без редактирования'));await observerContext.close();
  await player.setViewportSize({width:320,height:650});await player.evaluate(()=>ZargotaI18n.setLocale('uk'));await player.locator('#persistent-entry').click();await player.screenshot({animations:'disabled',path:out+'/login-320-uk.png'});assert.ok((await player.locator('#persistent-character-dialog').innerText()).includes('Мій акаунт'));
  assert.equal(await player.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);console.log('PASS: real Edge desktop/mobile, code login, existing stat input, autosave both ways, history, reload, typing conflict, offline recovery, 320px Ukrainian');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
