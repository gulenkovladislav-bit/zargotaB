'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18549');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{const c=JSON.parse(JSON.stringify(characters.find(x=>x.name==='Эстерос')));c.id=987654397;characters.push(c);window.inventoryCatalogFixture=c;window._charSheetTab='inventory';showPage('characters');openCharSheet(c.id);});
  await page.locator('.zgmi-v2').waitFor();
  const fixtureSource=await page.evaluate(()=>{const x=loadShopItems().find(x=>x.image&&x.imageThumb&&x.image!==x.imageThumb&&x.cat==='weapon');return {id:x.id,name:x.name,image:x.image,thumb:x.imageThumb};});assert.ok(fixtureSource);
  // Catalog source, live search DOM, and category filters survive phone keyboard resizing.
  for(const locale of ['ru','uk']){await page.evaluate(x=>ZargotaI18n.setLocale(x),locale);for(const [width,height] of [[320,568],[390,780],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(220);await page.locator('.zgmi-footer [data-zgmi=shop]').tap();assert.equal(await page.locator('#char-equip-modal-overlay').count(),0);
   const input=page.locator('[data-zgmi-search]');await input.focus();await page.evaluate(()=>window.catalogInputNode=document.activeElement);await input.pressSequentially(fixtureSource.name,{delay:3});assert.ok(await input.evaluate(el=>el===window.catalogInputNode&&document.activeElement===el));
   await page.setViewportSize({width,height:400});await page.waitForTimeout(180);assert.ok(await input.evaluate(el=>el===window.catalogInputNode&&document.activeElement===el));
   await page.locator('[data-zgmi-category]').selectOption('weapon');assert.ok(await page.locator('[data-zgmi=catalog-item]').count());
   await page.setViewportSize({width,height});await page.waitForTimeout(150);await page.locator('[data-zgmi=catalog-item][data-id="'+fixtureSource.id+'"]').tap();
   await page.locator('img[data-zgmi-full]').evaluate(el=>el.decode());await page.waitForTimeout(250);
   const geom=await page.locator('#zgmi-dialog>section').evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,nav:document.querySelector('.zgmo-nav').getBoundingClientRect().top,overflow:el.scrollHeight-el.clientHeight,width:document.documentElement.scrollWidth-innerWidth}));
   assert.ok(Math.abs(geom.top)<1&&Math.abs(geom.bottom-geom.nav)<2&&geom.overflow<=1&&geom.width<=1,JSON.stringify({locale,width,height,geom}));
   assert.equal(await page.locator('img[data-zgmi-full]').getAttribute('src'),fixtureSource.image);assert.equal(await page.locator('img[data-zgmi-full]').evaluate(el=>getComputedStyle(el).mixBlendMode),'normal');
   await page.locator('[data-zgmi=art]').tap();await page.locator('[data-zgmi=art-zoom]').tap();assert.ok(await page.locator('.zgmi-art-canvas').evaluate(el=>el.scrollWidth>el.clientWidth));await page.locator('[data-zgmi=art-return]').tap();assert.equal(await page.locator('[data-zgmi=catalog-save]').count(),1);await page.locator('#zgmi-dialog [data-zgmi=close]').tap();
  }}
  await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await page.setViewportSize({width:390,height:780});await page.waitForTimeout(220);
  const original=await page.evaluate(()=>({items:JSON.parse(JSON.stringify(inventoryCatalogFixture.inventoryItems)),slots:JSON.stringify(inventoryCatalogFixture.arenaEquipSlots||{}),coins:JSON.stringify(inventoryCatalogFixture.coins),hp:[inventoryCatalogFixture.hpCur,inventoryCatalogFixture.hpMax],shop:JSON.stringify(loadShopItems())}));
  await page.locator('.zgmi-toolbar [data-zgmi=add]').tap();await page.locator('.zgmi-add-choices [data-zgmi=shop]').tap();await page.locator('[data-zgmi-search]').fill(fixtureSource.name);await page.locator('[data-zgmi=catalog-item][data-id="'+fixtureSource.id+'"]').tap();await page.locator('[data-zgmi=catalog-plus]').tap();
  await page.evaluate(()=>{window.originalInventorySave=saveChars;window.saveCallCount=0;window.saveChars=()=>{saveCallCount++;return new Promise(resolve=>window.finishCatalogSave=resolve);};});
  await page.locator('[data-zgmi=catalog-save]').tap();assert.ok(await page.locator('[data-zgmi=catalog-save]').isDisabled());await page.evaluate(()=>document.querySelector('[data-zgmi=catalog-save]').click());assert.equal(await page.evaluate(()=>saveCallCount),1);await page.evaluate(()=>finishCatalogSave({ok:false}));await page.waitForTimeout(150);
  assert.match(await page.locator('.zgmi-catalog-error').innerText(),/Не удалось сохранить/);assert.equal(await page.locator('.zgmi-catalog-quantity output').innerText(),'2');assert.equal(await page.evaluate(()=>inventoryCatalogFixture.inventoryItems.length),original.items.length);
  await page.evaluate(()=>window.saveChars=window.originalInventorySave);await page.locator('[data-zgmi=catalog-save]').tap();await page.locator('#zgmi-dialog').waitFor({state:'hidden'});await page.waitForTimeout(180);
  const saved=await page.evaluate(()=>({items:inventoryCatalogFixture.inventoryItems,slots:JSON.stringify(inventoryCatalogFixture.arenaEquipSlots||{}),coins:JSON.stringify(inventoryCatalogFixture.coins),hp:[inventoryCatalogFixture.hpCur,inventoryCatalogFixture.hpMax],shop:JSON.stringify(loadShopItems())}));
  assert.deepEqual(saved.items.slice(0,original.items.length),original.items);assert.equal(saved.slots,original.slots);assert.equal(saved.coins,original.coins);assert.deepEqual(saved.hp,original.hp);assert.equal(saved.shop,original.shop);assert.equal(saved.items.length,original.items.length+1);
  const added=saved.items.at(-1);assert.equal(added.qty,2);assert.equal(added.equipped,false);assert.equal(added.catalogItemId,fixtureSource.id);assert.ok(added.definitionSnapshot);assert.equal(added.image,fixtureSource.image);assert.equal(added.imageThumb,fixtureSource.thumb);
  // Bag previews use thumbs; the detail and enlarged view resolve the original asset.
  await page.locator('.zgmi-card[data-zgmi=item]').filter({hasText:fixtureSource.name}).tap();assert.equal(await page.locator('img[data-zgmi-full]').getAttribute('src'),fixtureSource.image);await page.locator('img[data-zgmi-full]').evaluate(el=>el.decode());await page.waitForTimeout(300);
  await page.screenshot({path:'/private/tmp/zg-mobile-unified/inventory-full-detail.png'});await page.locator('[data-zgmi=art]').tap();await page.locator('img[data-zgmi-full]').evaluate(el=>el.decode());await page.waitForTimeout(250);await page.screenshot({path:'/private/tmp/zg-mobile-unified/inventory-full-art.png'});await page.locator('[data-zgmi=art-return]').tap();await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();
  await page.locator('.zgmi-footer [data-zgmi=shop]').tap();await page.locator('[data-zgmi-category]').selectOption('weapon');await page.waitForTimeout(400);await page.screenshot({path:'/private/tmp/zg-mobile-unified/inventory-catalog.png'});await page.locator('#zgmi-dialog header [data-zgmi=close]').last().tap();
  // Leaving while an asynchronous save is pending closes only the UI; completion stays with its hero.
  await page.locator('.zgmi-footer [data-zgmi=shop]').tap();await page.locator('[data-zgmi-search]').fill(fixtureSource.name);await page.locator('[data-zgmi=catalog-item][data-id="'+fixtureSource.id+'"]').tap();
  await page.evaluate(()=>{window.saveChars=()=>new Promise(resolve=>window.finishLeavingSave=resolve);});await page.locator('[data-zgmi=catalog-save]').tap();await page.locator('.zgmo-nav button').first().tap();assert.equal(await page.locator('#zgmi-dialog').count(),0);await page.evaluate(()=>finishLeavingSave({ok:false}));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>inventoryCatalogFixture.inventoryItems.length),original.items.length+1);await page.evaluate(()=>window.saveChars=window.originalInventorySave);await page.locator('.zgmo-nav button').nth(2).tap();
  // Normal authored equipment stays distinguishable, and reload keeps the bag snapshot.
  await page.locator('.zgmi-groups [data-group=equipment]').tap();await page.waitForTimeout(200);assert.ok(await page.locator('.zgmi-card-equipped').count());await page.screenshot({path:'/private/tmp/zg-mobile-unified/inventory-equipment.png'});
  await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});assert.ok(await page.evaluate(id=>characters.find(c=>c.id===987654397).inventoryItems.some(x=>x.catalogItemId===id&&x.qty===2&&!x.equipped),fixtureSource.id));
  assert.deepEqual(errors,[]);console.log('PASS inventory catalog: RU/UK 320–430px, live search + resized keyboard, category, full-height detail above tabs, original artwork/zoom, real save + reload, equipment/counts preserved, failure rollback + retry + double-submit');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
