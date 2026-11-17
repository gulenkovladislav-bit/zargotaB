'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8879');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{
   const x=JSON.parse(JSON.stringify(characters.find(x=>x.name==='Эстерос')||characters[0]));
   x.id=987654379;x.campaignKey='esteros';x.name='Эстерос';x.age='17';x.race='Человек';x.portrait='images/portraits/defaults/esteros-2026-11.png';
   characters.push(x);window._charSheetTab='lore';showPage('characters');openCharSheet(x.id);
  });
  await page.locator('.zgml-sheet').waitFor();
  assert.equal(await page.locator('.zgml-age').innerText(),'17 лет');
  await page.locator('.zgml-portrait img').evaluate(img=>img.decode());
  await page.waitForTimeout(300);await page.screenshot({path:'/private/tmp/zg-lore-portrait-about.png'});
  const open=()=>page.locator('[data-zgml=portrait]').tap();
  await open();
  const viewer=page.locator('#zgml-art-viewer');
  assert.equal(await viewer.locator('button').count(),1);
  await viewer.locator('img').evaluate(img=>img.decode());
  assert.match(await viewer.locator('blockquote').innerText(),/цветы у болотной тропы/);
  assert.equal(await viewer.locator('img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
  await page.waitForTimeout(300);await page.screenshot({path:'/private/tmp/zg-lore-portrait-fullscreen.png'});
  await page.evaluate(()=>ZargotaI18n.setLocale('uk'));
  assert.match(await viewer.locator('blockquote').innerText(),/квіти край болотної стежки/);
  assert.equal(await page.locator('.zgml-age').innerText(),'17 років');
  await page.locator('[data-zgml=art-close]').tap();
  assert.equal(await viewer.count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.zgml),'portrait');
  for(const size of [{width:320,height:568},{width:430,height:932},{width:780,height:390}]){
   await page.setViewportSize(size);await page.waitForTimeout(150);await open();
   const dims=await viewer.evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scroll:el.scrollHeight,inner:innerWidth}));
   assert.ok(dims.width<=dims.inner);assert.ok(dims.scroll<=dims.height+1);
   await page.keyboard.press('Escape');assert.equal(await viewer.count(),0);
  }
  await page.setViewportSize({width:390,height:780});
  await page.evaluate(()=>{ZargotaI18n.setLocale('ru');const x=characters.find(x=>x.id===987654379);x.age='';ZargotaMobileLore.refresh();});
  assert.equal(await page.locator('.zgml-age').innerText(),'Возраст не указан');
  await open();await page.evaluate(()=>ZargotaMobileLore.setActive(false));assert.equal(await viewer.count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS lore portrait: age, RU/UK, full artwork, single close, focus, small/large/landscape, navigation cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
