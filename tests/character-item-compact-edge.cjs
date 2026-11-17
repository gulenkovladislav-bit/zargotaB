'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8877',data=require('../data.json'),version=require('../manifest.json').version;
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const hero=JSON.parse(JSON.stringify(data.characters.find(c=>c.id===1776626039651)));
hero.inventoryItems=hero.inventoryItems.concat(hero.equipItems);hero.equipItems=[];hero.arenaEquipSlots={};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const context=await browser.newContext({viewport:{width:390,height:700},hasTouch:true,deviceScaleFactor:3});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await context.addInitScript(({hero,data,version})=>{localStorage.setItem('grimoire_chars',JSON.stringify([hero]));localStorage.setItem('grimoire_v3',JSON.stringify(data.catalog));localStorage.setItem('zg_data_version',version);},{hero,data,version});
 const page=await context.newPage();await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(async()=>{await zgCharacterLoadPromise;showPage('characters');_charSheetTab='inventory';openCharSheet(1776626039651);});
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const output=process.env.ZG_COMPACT_OUTPUT||'/private/tmp/zg-item-compact';fs.mkdirSync(output,{recursive:true});
 for(const locale of ['ru','uk'])for(const [width,height] of [[320,568],[390,700],[430,780]]){
  await page.setViewportSize({width,height});await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);await paint();
  for(const [item,index] of [['mortar',0],['axe',hero.inventoryItems.findIndex(x=>x.name==='Топор')]]){
   const prev=page.locator('.zgmi-footer [data-zgmi=prev]');while(await prev.isEnabled()){await prev.tap();await paint();}
   const row=page.locator('.zgmi-card[data-key="inventoryItems-'+index+'"]');
   for(let n=0;n<10&&!await row.count();n++){await page.locator('.zgmi-footer [data-zgmi=next]').tap();await paint();}
   await row.tap();
   // Sample the actual opening frames, before waiting for animation completion.
   const frames=await page.evaluate(async()=>{let out=[];for(let n=0;n<18;n++){await new Promise(requestAnimationFrame);const r=document.querySelector('#zgmi-dialog>section').getBoundingClientRect();out.push([r.x,r.y,r.width,r.height]);}return out;});
   assert.ok(frames.every(f=>f.every((v,i)=>Math.abs(v-frames[0][i])<.1)),JSON.stringify({item,locale,width,frames}));
   await page.locator('#zgmi-dialog').evaluate(async root=>{await Promise.allSettled([...root.querySelectorAll('img')].map(im=>im.decode()));await Promise.allSettled(root.getAnimations({subtree:true}).map(a=>a.finished));});
   const g=await page.locator('.zgmi-detail-page').evaluate(el=>({overflow:el.scrollHeight-el.clientHeight,footer:!!document.querySelector('.zgmi-item-actions'),quantity:el.querySelector('[data-zgmi=quantity]')?.getBoundingClientRect().height,title:el.querySelector('h2').innerText}));
   assert.ok(g.overflow<=1,JSON.stringify({item,locale,width,height,...g}));assert.equal(g.footer,false);assert.ok(g.quantity>=44);
   if(width===390)await page.screenshot({path:output+'/'+item+'-'+locale+'.png',animations:'disabled'});
   const title=g.title;
   assert.ok(await page.locator('.zgmi-art-hint').isVisible());
   await page.locator('[data-zgmi=art]').tap();
   const quote=await page.locator('.zgmi-art-quote').innerText();
   assert.match(quote,locale==='ru'?(item==='mortar'?/растёртых трав/:/Вес стали/):(item==='mortar'?/розтертих трав/:/Вага сталі/));
   const viewer=await page.locator('#zgmi-dialog').boundingBox();assert.ok(Math.abs(viewer.height-height)<1);
   assert.equal(await page.locator('#zgmi-dialog h2').innerText(),title);
   await page.locator('.zgmi-art-canvas img[data-zgmi-full]').evaluate(im=>im.decode());
   const layout=await page.locator('#zgmi-dialog>section').evaluate(el=>({overflow:el.scrollHeight-el.clientHeight,art:el.querySelector('.zgmi-art-canvas').clientHeight}));
   assert.ok(layout.overflow<=1&&layout.art>=200,JSON.stringify(layout));
   if(width===390)await page.screenshot({path:output+'/'+item+'-art-'+locale+'.png',animations:'disabled'});
   await page.locator('[data-zgmi=art-zoom]').tap();await page.locator('[data-zgmi=art-zoom]').tap();
   await page.locator('[data-zgmi=art-close]').tap();
   assert.equal(await page.locator('.zgmi-detail-heading h2').innerText(),title);
   await page.locator('[data-zgmi=quantity]').tap();await page.locator('[data-zgmi=quantity-cancel]').first().tap();await paint();
   await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();await paint();
  }
 }
 console.log('PASS: mortar and axe fit without vertical scrolling at 320/390/430px RU/UK; inline quantity editable; opening frames stable; full-screen art, bilingual epigraphs, zoom and return verified. '+output);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
