'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8877');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(()=>{const c=JSON.parse(JSON.stringify(characters.find(c=>c.name==='Эстерос')));c.id=987654399;c.coins={platinum:0,gold:12,silver:8,copper:24};characters.push(c);window._charSheetTab='inventory';showPage('characters');openCharSheet(c.id);});
 await page.locator('.zgmi-v2').waitFor();await page.locator('.zgmi-art img').evaluateAll(els=>Promise.all(els.map(el=>el.decode())));await page.screenshot({path:'/tmp/zargota-inventory-v2-bag.png'});
 const nav=()=>page.locator('.zgmo-nav button'),items=()=>page.locator('.zgmi-card[data-zgmi=item]');
 for(const locale of ['ru','uk']){await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);for(const [width,height] of [[320,568],[390,780],[430,932]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  for(const group of ['bag','equipment']){
   await page.locator('.zgmi-groups [data-group='+group+']').tap();await page.waitForTimeout(120);
   const g=await page.evaluate(()=>{const root=document.querySelector('.zgmi-v2'),nav=document.querySelector('.zgmo-nav');return {overflow:root.scrollHeight-root.clientHeight,width:document.documentElement.scrollWidth-innerWidth,top:root.getBoundingClientRect().top,end:root.getBoundingClientRect().bottom,nav:nav.getBoundingClientRect().top,cards:[...root.querySelectorAll('.zgmi-card')].map(el=>({h:el.clientHeight,w:el.clientWidth,overflow:el.scrollHeight-el.clientHeight})),wallet:[...root.querySelectorAll('.zgmi-wallet button')].map(el=>el.scrollWidth-el.clientWidth)};});
   assert.ok(g.overflow<=1&&g.width<=1&&g.top===0&&g.end<=g.nav+1&&g.cards.every(x=>x.h>=44&&x.w>=44&&x.overflow<=1)&&g.wallet.every(x=>x<=1),JSON.stringify({locale,width,height,group,g}));
  }
 }}
 await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await page.setViewportSize({width:390,height:780});await page.waitForTimeout(250);
 await page.locator('.zgmi-groups [data-group=equipment]').tap();await page.waitForTimeout(150);await page.screenshot({path:'/tmp/zargota-inventory-v2-equipment.png'});
 // Wallet is compact. Changes can be cancelled and do not summon a keyboard.
 await page.locator('[data-coin=gold]').tap();await page.locator('[data-step="10"]').tap();await page.locator('[data-zgmi=coin-plus]').tap();await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654399).coins.gold),12);
 await page.locator('[data-coin=gold]').tap();await page.locator('[data-zgmi=coin-plus]').tap();await page.locator('[data-zgmi=coin-save]').tap();await page.waitForTimeout(150);assert.equal(await page.locator('[data-coin=gold] b').innerText(),'13');
 // Real item description opens above nav; secondary actions are hidden until requested.
 await page.locator('.zgmi-groups [data-group=bag]').tap();await page.waitForTimeout(100);await items().first().tap();assert.equal(await page.locator('[data-zgmi=edit]').count(),0);assert.ok(await page.locator('#zgmi-dialog').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.zgmo-nav').getBoundingClientRect().top+1));
 await page.locator('[data-zgmi=plus]').tap();await page.waitForTimeout(100);await page.screenshot({path:'/tmp/zargota-inventory-v2-detail.png'});await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();
 // Equip/remove the same stored item without duplication or loss.
 const before=await page.evaluate(()=>characters.find(c=>c.id===987654399).inventoryItems.length);
 await items().first().tap();const title=await page.locator('#zgmi-dialog h2').innerText();await page.locator('[data-zgmi=detail-menu]').tap();await page.locator('[data-zgmi=equip]').tap();await page.waitForTimeout(150);
 await page.locator('.zgmi-groups [data-group=equipment]').tap();await page.waitForTimeout(150);await items().filter({hasText:title}).tap();await page.locator('[data-zgmi=detail-menu]').tap();await page.locator('[data-zgmi=equip]').tap();assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654399).inventoryItems.length),before);
 // A cancelled draft is discarded, a saved custom item keeps its qty and description.
 await page.locator('.zgmi-groups [data-group=bag]').tap();await page.locator('.zgmi-toolbar [data-zgmi=add]').tap();await page.locator('#ic-close').tap();assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654399).inventoryItems.length),before);
 await page.locator('.zgmi-toolbar [data-zgmi=add]').tap();await page.locator('#ic-name').fill('А Проверочный предмет');await page.locator('#ic-desc').fill('Полное описание предмета.');await page.locator('#ic-qty-plus').tap();await page.locator('#ic-save').tap();
 await page.locator('[data-zgmi-sort]').selectOption('name');await page.waitForTimeout(150);await items().filter({hasText:'А Проверочный'}).tap();assert.match(await page.locator('.zgmi-description').innerText(),/Полное описание/);assert.equal(await page.locator('.zgmi-quantity strong').innerText(),'2');
 await page.locator('[data-zgmi=detail-menu]').tap();await page.locator('[data-zgmi=edit]').tap();await page.locator('#ic-name').fill('А Исправленный предмет');await page.locator('#ic-save').tap();await page.waitForTimeout(150);assert.ok(await items().filter({hasText:'А Исправленный'}).isVisible());
 // Pagination with multiple identical names must use the original item indices.
 await page.evaluate(()=>{const c=characters.find(c=>c.id===987654399);for(let i=0;i<12;i++)c.inventoryItems.push({name:'Тест '+i,description:'Запись '+i,qty:1,icon:'art:backpack'});saveChars();ZargotaMobileInventory.refresh();});await page.waitForTimeout(150);assert.equal(await items().count(),9);
 await page.locator('.zgmi-footer [data-zgmi=next]').tap();await page.waitForTimeout(150);assert.match(await page.locator('.zgmi-footer small').innerText(),/2 \/ /);await page.locator('.zgmi-footer [data-zgmi=prev]').tap();await page.waitForTimeout(150);
 // Catalog equipment uses its existing save path and remains visible after reload.
 await page.locator('.zgmi-footer [data-zgmi=shop]').tap();await page.locator('#char-equip-search').pressSequentially('меч',{delay:35});await page.waitForTimeout(450);await page.locator('#char-equip-items [onclick^="charEquipItem"]').first().tap();await page.locator('button[onclick="charSaveEquip()"]').tap();
 await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(()=>{window._charSheetTab='inventory';showPage('characters');openCharSheet(987654399)});
 assert.ok(await page.evaluate(()=>{const c=characters.find(c=>c.id===987654399);return c.coins.gold===13&&c.inventoryItems.some(x=>x.name==='А Исправленный предмет'&&x.qty===2)&&Object.keys(c.arenaEquipSlots).length>0;}));
 await page.locator('.zgmi-groups [data-group=equipment]').tap();await page.waitForTimeout(150);await page.locator('.zgmi-card[data-key^=armory]').first().tap();assert.ok(!(await page.locator('#zgmi-dialog').innerText()).includes('[object Object]'), await page.locator('#zgmi-dialog').innerText());await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();
 await page.locator('.zgmi-groups [data-group=bag]').tap();await page.locator('[data-zgmi-sort]').selectOption('name');await page.waitForTimeout(150);await items().filter({hasText:'А Исправленный'}).tap();await page.locator('[data-zgmi=detail-menu]').tap();await page.locator('[data-zgmi=remove]').tap();await page.locator('[data-zgmi=confirm-remove]').tap();assert.ok(await page.evaluate(()=>!characters.find(c=>c.id===987654399).inventoryItems.some(x=>x.name==='А Исправленный предмет')));
 // Leaving a tab closes its popup. Desktop keeps its existing inventory.
 await items().first().tap();await nav().first().tap();assert.equal(await page.locator('#zgmi-dialog').count(),0);await nav().nth(2).tap();await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(300);assert.equal(await page.locator('.zgmi-v2').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS inventory: RU/UK 320–430px, bag/equipment, wallet, item detail, qty, creation/cancel/edit/delete, sorting, paging, catalog equipment, reload, tab/desktop navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
