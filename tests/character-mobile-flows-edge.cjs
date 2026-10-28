'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8877');
 await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(()=>{const c=JSON.parse(JSON.stringify(characters.find(c=>c.name==='Эстерос')));c.id=987654398;c.spellRefs=[];c.spellsLearned={};c.preparedSpells={kodex:[],folio:[],obrad:[]};characters.push(c);window._charSheetTab='skills';showPage('characters');openCharSheet(c.id);});
 const nav=()=>page.locator('.zgmo-nav button');
 await page.locator('[data-group=personal]').tap();await page.locator('.zgms-card').first().tap();
 await page.locator('#zgms-dialog').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 assert.ok(await page.locator('#zgms-dialog .char-ability-rule-section').evaluateAll(els=>els.every(el=>getComputedStyle(el).borderLeftWidth==='0px'&&getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)')));
 for(const [width,height] of [[320,568],[390,780],[430,932]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);
  const g=await page.evaluate(()=>{const dialog=document.querySelector('#zgms-dialog'),body=dialog.querySelector('.zgms-detail-body'),charges=dialog.querySelector('.zgms-charges');return {bodyHeight:body.clientHeight,chargesHeight:charges.clientHeight,overlap:dialog.getBoundingClientRect().bottom-document.querySelector('.zgmo-nav').getBoundingClientRect().top,width:dialog.scrollWidth-dialog.clientWidth,controls:[...charges.querySelectorAll('button')].map(el=>el.getBoundingClientRect().width)};});
  assert.ok(g.bodyHeight>170&&g.chargesHeight<92&&g.overlap<=1&&g.width<=1&&g.controls.every(w=>w>=44),JSON.stringify(g));
 }
 await page.setViewportSize({width:390,height:780});await page.waitForTimeout(300);
 await page.locator('[data-zgms=spend]').tap();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-charges strong').innerText(),'0 / 1');assert.ok(await page.locator('[data-zgms=spend]').isDisabled());assert.ok(await page.locator('.zgms-exhausted-label').isVisible());
 await page.locator('[data-zgms=restore]').tap();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-charges strong').innerText(),'1 / 1');
 const chargeTop=await page.locator('.zgms-charges').evaluate(el=>el.getBoundingClientRect().top);
 await page.locator('.zgms-detail-body').evaluate(el=>el.scrollTop=el.scrollHeight);assert.equal(await page.locator('.zgms-charges').evaluate(el=>el.getBoundingClientRect().top),chargeTop);
 await page.locator('.zgms-detail-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'/tmp/zargota-skill-detail-after.png'});
 await nav().first().tap();assert.equal(await page.locator('#zgms-dialog').count(),0);
 await page.locator('#zgmo-dex').tap();await page.locator('[data-number-key=plus]').tap();await page.locator('[data-number-key=save]').tap();
 // Catalog linking must immediately reveal the new, still-unlearned entry.
 await nav().nth(1).tap();await page.locator('[data-group=learned]').tap();await page.locator('[data-zgms=menu]').tap();await page.locator('.zgms-menu [data-zgms=add]').tap();
 const search=page.locator('#sp-picker-search');await search.pressSequentially('Ответный',{delay:45});assert.ok(await search.evaluate(el=>document.activeElement===el));
 await page.locator('.sp-picker-item:visible').first().tap();await page.locator('.zg-spell-picker-done').tap();await page.waitForTimeout(150);
 assert.equal(await page.locator('.zgms-card').count(),1,'New catalog entry should be visible on return');assert.match(await page.locator('.zgms-card').innerText(),/Ответный/);
 // An added but unlearned record survives reload and is directly discoverable.
 await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);if(c.spellRefs.length!==1||Object.values(c.spellsLearned).some(Boolean))throw Error('Unlearned record changed on reload');window._charSheetTab='skills';showPage('characters');openCharSheet(c.id);});
 await page.locator('[data-group=learned]').tap();await page.locator('[data-filter=unlearned]').tap();await page.waitForTimeout(150);assert.equal(await page.locator('.zgms-card').count(),1);assert.match(await page.locator('.zgms-card').innerText(),/Ответный/);
 await page.locator('.zgms-card').tap();assert.ok(await page.locator('[data-zgms=spend]').isDisabled());await page.locator('[data-zgms=detail-menu]').tap();await page.locator('[data-zgms=learn]').tap();await page.waitForTimeout(100);await page.locator('[data-zgms=detail-menu]').tap();await page.locator('[data-zgms=equip]').tap();await page.waitForTimeout(100);await page.locator('[data-zgms=close]').tap();await page.locator('.zgms-filter [data-filter=equipped]').tap();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-card').count(),1);
 // Empty skill creation is cancellable without leaving a placeholder.
 await page.locator('[data-group=traits]').tap();await page.waitForTimeout(100);const traitsBefore=await page.locator('.zgms-card').count();await page.locator('[data-zgms=menu]').tap();await page.locator('.zgms-menu [data-zgms=add]').tap();await page.locator('.sc-cancel-btn').tap();await page.waitForTimeout(100);assert.equal(await page.locator('.zgms-card').count(),traitsBefore);
 // Inventory editing, sorting, scroll reachability and navigation on short screens.
 await nav().nth(2).tap();
 const inventoryCount=()=>page.evaluate(()=>characters.find(c=>c.id===987654398).inventoryItems.length);
 const countBefore=await inventoryCount();await page.locator('button[onclick^="addInventoryItem"]').tap();await page.locator('#ic-close').tap();assert.equal(await inventoryCount(),countBefore,'Cancel new item must not retain an empty slot');
 await page.locator('button[onclick^="addInventoryItem"]').tap();await page.locator('#ic-name').fill('Тестовый предмет');await page.locator('#ic-desc').fill('Сохранённое описание');await page.locator('#ic-qty-plus').tap();await page.locator('#ic-save').tap();
 await page.locator('.char-inventory-sort').selectOption('name');await page.locator('.char-inventory-inline-slot[title="Тестовый предмет"]').tap();assert.equal(await page.locator('#ic-qty').inputValue(),'2');await page.locator('#ic-name').fill('Новый предмет');await page.locator('#ic-save').tap();
 // Equipment catalog: touch selection must update the sheet and preserve the tab.
 await page.locator('.char-inventory-arena-link').tap();
 const equipOverlay=page.locator('#char-equip-modal-overlay');await equipOverlay.waitFor();
 await page.locator('#char-equip-search').pressSequentially('меч',{delay:40});await page.waitForTimeout(450);assert.ok(await page.locator('#char-equip-search').evaluate(el=>document.activeElement===el));
 const equipment=page.locator('#char-equip-items [onclick^="charEquipItem"]');assert.ok(await equipment.count()>0);await equipment.first().tap();
 assert.ok(await page.evaluate(()=>Object.values(characters.find(c=>c.id===987654398).arenaEquipSlots).length>0));
 await equipOverlay.locator('button[onclick="charSaveEquip()"]').tap();assert.ok(await page.locator('.zgmi-sheet').isVisible());
 for(const locale of ['ru','uk']){await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);for(const [width,height] of [[320,568],[390,780],[430,932]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);
  const g=await page.evaluate(()=>{const root=document.querySelector('.zgmi-sheet'),scroll=root.querySelector('.tab-content-wrap'),nav=document.querySelector('.zgmo-nav');scroll.scrollTop=scroll.scrollHeight;return {rootOverflow:root.scrollHeight-root.clientHeight,top:root.getBoundingClientRect().top,end:scroll.getBoundingClientRect().bottom,nav:nav.getBoundingClientRect().top,width:document.documentElement.scrollWidth-innerWidth,remaining:scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight};});
  assert.ok(g.rootOverflow<=1&&g.top===0&&g.end<=g.nav+1&&g.width<=1&&g.remaining<=1,JSON.stringify({locale,width,g}));
 }}
 await page.setViewportSize({width:390,height:780});await page.waitForTimeout(350);await page.locator('.tab-content-wrap').evaluate(el=>el.scrollTop=0);await page.locator('.char-inventory-inline img').evaluateAll(els=>Promise.all(els.map(el=>el.decode())));await page.screenshot({path:'/tmp/zargota-inventory-after.png'});
 await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});assert.ok(await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);return c.stats.dex.base===1&&c.inventoryItems.some(i=>i.name==='Новый предмет'&&i.qty===2&&i.description==='Сохранённое описание')&&Object.values(c.preparedSpells).flat().length===1;}));
 await page.evaluate(()=>{window._charSheetTab='inventory';showPage('characters');openCharSheet(987654398)});await page.locator('.char-inventory-inline-slot[title="Новый предмет"]').tap();await page.locator('#ic-remove').tap();await page.locator('.ic-confirm-accept').tap();assert.ok(await page.evaluate(()=>!characters.find(c=>c.id===987654398).inventoryItems.some(i=>i.name==='Новый предмет')));
 await page.locator('.zgmi-toolbar [data-zgmo=back]').tap();assert.ok(await page.locator('#header').isVisible());assert.equal(await page.locator('body.zg-inventory-view').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS mobile character flows: compact rules/charges, spend/restore, catalog search/link/learn/equip, cancelled creation, inventory add/edit/sort/delete, RU/UK bounds, reload persistence and back navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
