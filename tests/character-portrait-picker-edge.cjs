'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 const out='/private/tmp/zg-portrait-picker';fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Local assets only; do not contact Firebase or the published site's data loader.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:18543/');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(async()=>{await window.zgCharacterLoadPromise;showPage('characters');openCharSheet(characters[0].id);});
  const id=await page.evaluate(()=>characters[0].id);
  await page.evaluate(id=>triggerPortraitUpload(id),id);
  await page.locator('.zg-portrait-picker').waitFor();
  await page.locator('.zg-portrait-options img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert.equal(await page.locator('.zg-portrait-options button').count(),3);
  await page.waitForTimeout(300);await page.screenshot({path:out+'/picker-390.png'});
  for(const width of [320,430,1440]){
   await page.setViewportSize({width,height:width===1440?900:780});
   assert.ok(await page.locator('.zg-portrait-picker').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
   await page.waitForTimeout(250);
   assert.ok(await page.locator('.zg-portrait-picker').evaluate(d=>{const r=d.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<2&&Math.abs(r.y+r.height/2-innerHeight/2)<2;}));
  }
  await page.setViewportSize({width:390,height:780});
  await page.getByRole('button',{name:'В тумане',exact:true}).click();
  await page.locator('.zg-portrait-picker').waitFor({state:'detached'});
  assert.ok(await page.evaluate(id=>characters.find(c=>c.id===id).portrait.includes('heroart'),id));
  await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(async()=>{await window.zgCharacterLoadPromise;});
  assert.ok(await page.evaluate(id=>characters.find(c=>c.id===id).portrait.includes('heroart'),id));
  await page.evaluate(id=>{showPage('characters');openCharSheet(id);triggerPortraitUpload(id);},id);
  await page.getByRole('button',{name:'Новый портрет',exact:true}).click();await page.locator('.zg-portrait-picker').waitFor({state:'detached'});
  await page.waitForTimeout(400);await page.screenshot({path:out+'/new-sheet-390.png'});
  // Upload follows the existing file picker and keeps a portable preview.
  await page.locator('#sheet-portrait-input').setInputFiles('images/portraits/defaults/evan-classic.png');
  await page.waitForFunction(id=>{const c=characters.find(c=>c.id===id);return c.portrait.includes('custom_')&&c.portraitThumb.startsWith('data:');},id);
  const custom=await page.evaluate(id=>characters.find(c=>c.id===id).portrait,id);
  await page.waitForFunction(path=>JSON.parse(localStorage.getItem('grimoire_chars')).some(c=>c.portrait===path),custom);
  await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(async()=>{await window.zgCharacterLoadPromise;});
  assert.equal(await page.evaluate(id=>characters.find(c=>c.id===id).portrait,id),custom);
  // All five heroes have distinct, loadable sets and both locales.
  const choices=await page.evaluate(()=>characters.slice(0,5).map(c=>ZargotaPortraitPicker.choices(c)));
  assert.equal(new Set(choices.map(c=>c[0].src)).size,5);
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 choices, mobile/desktop fit, fog choice survives reload, new choice, personal upload survives reload; no page errors. Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
