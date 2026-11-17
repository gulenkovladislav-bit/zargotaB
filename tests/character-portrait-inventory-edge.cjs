'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8877';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const data=require('../data.json'),version=require('../manifest.json').version;
const keys={1776627463516:'evan',1776626039651:'melissa',1776463717210:'esteros',1778221131899:'vrotik',1778221143711:'lin-yin'};
const heroes=data.characters.filter(c=>keys[c.id]).map(c=>({...c,portrait:'images/portraits/defaults/'+keys[c.id]+'-2026-11.png'}));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:3});
 await context.addInitScript(({heroes,data,version})=>{localStorage.setItem('grimoire_chars',JSON.stringify(heroes));localStorage.setItem('grimoire_v3',JSON.stringify(data.catalog));localStorage.setItem('zg_data_version',version);},{heroes,data,version});
 const page=await context.newPage(),requests=[],errors=[];
 page.on('request',r=>{if(r.url().includes('/portraits/defaults/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(async()=>{await zgCharacterLoadPromise;showPage('characters');});
 await page.locator('.roster-stage>img').evaluate(im=>im.decode());
 await page.locator('.roster-thumb img').evaluateAll(ims=>Promise.all(ims.map(im=>im.decode())));
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});await paint();
  const selected=page.locator('.roster-thumb[aria-pressed=true]');
  await selected.hover();await paint();
  const g=await selected.evaluate(b=>{const r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect();return {top:r.top,rail:p.top,bottom:r.bottom,railBottom:p.bottom,transform:getComputedStyle(b).transform};});
  assert.equal(g.transform,'none');assert.ok(g.top>=g.rail-.5&&g.bottom<=g.railBottom+.5,JSON.stringify(g));
  await page.locator('.roster-thumb').nth(1).tap();await paint();
 }
 const portraitSources=await page.locator('.roster-thumb img').evaluateAll(ims=>ims.map(im=>im.currentSrc));
 assert.ok(portraitSources.every(src=>/-thumb\.jpg$|-display\.jpg$/.test(src)),'All stock portraits load optimized resources');
 assert.ok((await page.locator('.roster-stage>img').evaluate(im=>im.currentSrc)).endsWith('-display.jpg'));
 assert.ok(!requests.some(url=>url.endsWith('.png')),'No original multi-megabyte stock PNG requests');
 const custom=await page.evaluate(()=>ZargotaPortrait.sources({portrait:'images/custom.png'},'thumb'));assert.equal(custom,null);
 const output=process.env.ZG_PORTRAIT_OUTPUT||'/private/tmp/zg-portrait-inventory';fs.mkdirSync(output,{recursive:true});
 await page.setViewportSize({width:390,height:844});await paint();await page.screenshot({path:output+'/roster.png'});
 for(const locale of ['ru','uk']){
  await page.evaluate(locale=>{ZargotaI18n.setLocale(locale);window._charSheetTab='inventory';openCharSheet(1776626039651);},locale);
  await page.locator('.zgmi-groups [data-group=equipment]').tap();await paint();
  const hive=page.locator('.zgmi-card').filter({hasText:locale==='ru'?'Маленький переносной улей':'Маленький переносний вулик'});await hive.tap();await paint();
  const img=page.locator('#zgmi-dialog img[data-zgmi-full]');await img.evaluate(im=>im.decode());assert.ok((await img.getAttribute('src')).endsWith('melissa-hive.jpg'));
  assert.ok((await page.locator('.zgmi-detail-art').boundingBox()).height>=165);
  await page.locator('#zgmi-dialog').evaluate(async root=>{await Promise.allSettled(root.getAnimations({subtree:true}).map(a=>a.finished));});await page.screenshot({path:output+'/hive-'+locale+'.png',animations:'disabled'});
  await page.locator('#zgmi-dialog header [data-zgmi=close]').tap();await paint();
 }
 // Local stock records must stay untouched by display upgrades, including legacy equipItems.
 const stored=await page.evaluate(()=>characters.find(c=>c.id===1776626039651));
 assert.ok(stored.inventoryItems.concat(stored.equipItems).some(x=>x.name==='🐝 Маленький переносной улей'&&!x.image));
 assert.deepEqual(errors,[]);
 const bytes=[...new Set(requests)].reduce((sum,url)=>sum+fs.statSync(path.join(__dirname,'..',new URL(url).pathname)).size,0);
 console.log(JSON.stringify({result:'PASS',portraitRequests:[...new Set(requests)].length,portraitBytes:bytes,checks:'320/390/430px stationary selection, optimized sources, RU/UK legacy hive visible, no saved-data mutation',output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
