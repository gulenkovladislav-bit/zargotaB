const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const ctx=await b.newContext({viewport:{width:1600,height:1000}}),p=await ctx.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route(/https:\/\/.*(firebase|googleapis|gstatic).*/,r=>r.abort());
  const heroes=require('../data/campaign-heroes.v1.json').heroes;
  await ctx.addInitScript(heroes=>{if(!localStorage.getItem('grimoire_chars'))localStorage.setItem('grimoire_chars',JSON.stringify(heroes));},heroes);
  async function boot(){await p.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8978/');await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});await p.evaluate(async()=>{await zgCharacterLoadPromise;zgIrlSessionStart();showPage('gm-table');ZargotaI18n.setLocale('ru');});}
  await boot();await p.evaluate(()=>{window.gmrSaveCalls=0;const save=saveChars;window.saveChars=function(){window.gmrSaveCalls++;return save.apply(this,arguments);};});
  assert.equal(await p.locator('[data-gm-reminder]').count(),5);
  const d=p.locator('dialog.zg-gm-reminder');
  await p.locator('[data-gm-reminder="esteros"]').click();
  assert.match(await d.textContent(),/Лупоглазик — свой/);assert.equal(await p.locator('.zg-gm-phone.open').count(),0);
  await p.screenshot({path:'/private/tmp/zg-reminder-view.png',animations:'disabled'});
  await d.locator('[data-reminder-edit]').click();
  await d.locator('[data-reminder-row]').first().locator('[data-field=text]').fill('Личная подсказка <img src=x onerror=alert(1)>');
  await d.locator('[data-reminder-save]').click();
  assert.match(await d.textContent(),/Личная подсказка <img/);assert.equal(await d.locator('img').count(),0);
  await p.keyboard.press('Escape');
  await p.locator('[data-gm-reminder="vrotik"]').click();assert.doesNotMatch(await d.textContent(),/Личная подсказка/);await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>gmrSaveCalls),0,'reminders do not save player sheets');await boot();await p.locator('[data-gm-reminder="esteros"]').click();assert.match(await d.textContent(),/Личная подсказка/);
  await d.locator('[data-reminder-edit]').click();await d.locator('[data-heading]').fill('Отменённая правка');await d.locator('[data-reminder-cancel]').click();assert.doesNotMatch(await d.locator('h2').textContent(),/Отменённая/);
  await d.locator('[data-reminder-edit]').click();await d.locator('[data-reminder-add]').click();assert.equal(await d.locator('[data-reminder-row]').count(),5);
  await d.locator('[data-reminder-row]').last().locator('[data-field=title]').fill('Новый блок');await d.locator('[data-reminder-save]').click();assert.match(await d.textContent(),/Новый блок/);
  await p.setViewportSize({width:1000,height:650});await d.locator('[data-reminder-edit]').click();
  const footer=await d.locator('footer').boundingBox();assert.ok(footer.y+footer.height<=650);await p.screenshot({path:'/private/tmp/zg-reminder-edit.png',animations:'disabled'});
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>characters.some(c=>JSON.stringify(c).includes('Личная подсказка'))),false);await p.setViewportSize({width:1600,height:1000});await p.evaluate(()=>ZargotaI18n.setLocale('uk'));await p.locator('[data-gm-reminder="esteros"]').click();assert.match(await d.textContent(),/Пам’ятка майстра/);assert.match(await d.textContent(),/Розкіш здається неправильною/);assert.doesNotMatch(await d.textContent(),/Личная подсказка/);
  await p.keyboard.press('Escape');await p.locator('[data-gm-open="esteros"]').click({position:{x:30,y:30}});await p.locator('.zg-gm-sheet-host .zgmo-nav').waitFor();await p.locator('[data-gm-reminder="esteros"]').click();await p.keyboard.press('Escape');assert.equal(await p.locator('.zg-gm-phone.open').count(),1);
  // Notes never enter the player's character state.
  assert.deepEqual(errors,[]);console.log('PASS: five seeded reminders, edit/save/reload/cancel/add, hero isolation, escaped text, RU/UK, pinned footer, Escape preserves sheet, no character mutation.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
