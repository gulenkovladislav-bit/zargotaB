'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(/https:\/\/.*(firebaseio.com|identitytoolkit.googleapis.com|firebasedatabase.app).*/,r=>r.abort());
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18766/');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(async()=>{await zgCharacterLoadPromise;ZargotaI18n.setLocale('ru');const c=JSON.parse(JSON.stringify(characters[0]));c.id=98700011;c.name='Эван';characters.push(c);window.notificationCharacter=c;window._charSheetTab='stats';showPage('characters');openCharSheet(c.id);});
 await page.locator('.zgmo-overview').waitFor();assert.equal(await page.locator('.zgmo-sync').isVisible(),false);
 async function update(own,revision){await page.evaluate(({own,revision})=>{const c=notificationCharacter;ZargotaCharacterUpdates.receive({characterId:c.id,before:{hpCur:14},after:{hpCur:13},own,author:'master',revision});},{own,revision});await page.waitForTimeout(50);}
 await update(true,1);assert.equal(await page.locator('.zgmo-sync').isVisible(),false,'own edits have no alert');
 await page.evaluate(()=>window.keptPortrait=document.querySelector('.zgmo-portrait-image'));
 await update(false,2);await page.locator('.zgmo-sync').waitFor();
 const css=await page.locator('.zgmo-sync').evaluate(e=>{const s=getComputedStyle(e);return {blur:s.backdropFilter,background:s.backgroundColor,width:e.clientWidth,animation:getComputedStyle(e.querySelector('svg')).animationName};});
 assert.equal(css.blur,'none');assert.equal(css.background,'rgba(0, 0, 0, 0)');assert.ok(css.width>=44);assert.equal(css.animation,'zgmo-update-glow');
 assert.equal(await page.locator('.character-update-notice').isVisible(),false);
 assert.ok(await page.evaluate(()=>!keptPortrait||keptPortrait===document.querySelector('.zgmo-portrait-image')));
 await page.waitForTimeout(600);fs.mkdirSync('/tmp/zg-notices-review',{recursive:true});await page.screenshot({path:'/tmp/zg-notices-review/phone-update.png'});
 await page.locator('.zgmo-sync').click();await page.locator('#character-update-dialog').waitFor();assert.match(await page.locator('#character-update-dialog').innerText(),/Мастер обновил лист/);await page.locator('[data-update-read]').click();await page.locator('.zgmo-sync').waitFor({state:'hidden'});
 await page.evaluate(()=>{window.fixtureThread={messages:{},read:{}};window.fixtureCallback=null;window.fixtureApi={watchMessages(id,cb){fixtureCallback=cb;cb(fixtureThread);return()=>{fixtureCallback=null;};},readMessages(id,at){fixtureThread.read.player=at;fixtureCallback(fixtureThread);return Promise.resolve();},call(){return Promise.resolve();}};ZargotaPlayerMessages.start(fixtureApi,'player',{fixture:'player'},()=> 'Эван');});
 assert.equal(await page.locator('.zg-chat-launcher').isVisible(),false,'no permanent launcher');
 await page.evaluate(()=>{fixtureThread.messages.m1={senderUid:'master',text:'У ворот тебя ждёт проводник.',createdAt:Date.now()};fixtureCallback(fixtureThread);});await page.locator('.zg-chat-panel').waitFor();assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'TEXTAREA');
 await page.locator('.zg-chat-close').click();await page.locator('.zg-chat-launcher').waitFor();const box=await page.locator('.zg-chat-launcher').boundingBox();assert.ok(box.y<30&&box.x>100);
 await page.screenshot({path:'/tmp/zg-notices-review/phone-message.png'});
 // Read-receipt snapshots must not restart the ten-second lifetime.
 await page.waitForTimeout(5500);await page.evaluate(()=>fixtureCallback(fixtureThread));await page.waitForTimeout(4800);assert.equal(await page.locator('.zg-chat-launcher').isVisible(),false);
 await page.evaluate(()=>ZargotaPlayerMessages.open('fixture'));assert.equal(await page.locator('.zg-chat-panel').isVisible(),true,'history can reopen from menu after cue expires');await page.locator('.zg-chat-close').click();assert.equal(await page.locator('.zg-chat-launcher').isVisible(),false);
 await page.evaluate(()=>{fixtureThread.messages.m2={senderUid:'master',text:'Новое сообщение',createdAt:Date.now()};fixtureCallback(fixtureThread);});await page.locator('.zg-chat-panel').waitFor();await page.locator('.zg-chat-close').click();assert.equal(await page.locator('.zg-chat-launcher').isVisible(),true);
 await page.evaluate(()=>ZargotaPlayerMessages.stop());assert.equal(await page.locator('#zg-player-chat').count(),0);
 await page.evaluate(()=>ZargotaI18n.setLocale('uk'));await update(false,3);await page.locator('.zgmo-sync').waitFor();assert.match(await page.locator('.zgmo-sync').getAttribute('aria-label'),/Оновлення/);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.zgmo-sync svg').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(250);assert.equal(await page.locator('.zgmo-sync').count(),0);assert.equal(await page.locator('.character-update-notice').isVisible(),true,'desktop notice preserved');
 const menu=await page.evaluate(()=>ZargotaAccountViews.accountMenu({sid:'fixture',hero:{name:'Эван'}},'',true));assert.match(menu,/data-pc-action="message"/);assert.match(menu,/Повідомлення/);
 assert.deepEqual(errors,[]);console.log('PASS: silent idle, own-edit filtering, transparent update cue, read dismissal, stable portrait, 10-second message cue, repeated snapshots, reopen, logout, UK, reduced motion, desktop notice');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
