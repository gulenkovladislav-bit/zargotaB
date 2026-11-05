'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const output=process.env.ZG_TEST_OUTPUT||'/private/tmp/zg-mobile-unified';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18549/');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  for(const locale of ['ru','uk']){
   await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
   for(const [width,height] of [[320,568],[390,780],[430,932],[844,390]]){
    await page.setViewportSize({width,height});
    for(const name of ['catalog','bestiary','manual','arena','world']){
     await page.evaluate(n=>showPage(n),name);await page.waitForTimeout(450);
     const toggle=page.locator('.zg-mobile-tools-toggle');
     assert.ok(await toggle.isVisible(),name);
     assert.equal(await page.locator('#nav').isVisible(),false,name);
     const before=await page.locator('#page-'+name).boundingBox();
     assert.ok(before.y>=47&&before.y<=50,JSON.stringify({name,before}));
     await toggle.tap();await page.waitForTimeout(250);
     const after=await page.locator('#page-'+name).boundingBox();
     for(const key of ['x','y','width','height'])assert.ok(Math.abs(after[key]-before[key])<1,'menu must not move page '+name+' '+key);
     assert.ok(await page.locator('#nav').isVisible());
     const nav=await page.locator('#nav').boundingBox();
     assert.ok(nav.x>=10&&nav.x+nav.width<=width-10&&nav.y+nav.height<=height,JSON.stringify({name,nav,width,height}));
     assert.ok(await page.locator('#home-atlas-version').isVisible());
     await page.locator('#zg-net-monitor-btn').tap();
     assert.ok(await page.locator('#zg-net-monitor-panel').isVisible());
     const monitor=await page.locator('#zg-net-monitor-panel').boundingBox();
     assert.ok(monitor.y>=0&&monitor.y+monitor.height<=height+1,JSON.stringify(monitor));
     await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
     assert.equal(await page.locator('#nav').isVisible(),false);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
   }
  }
  await page.setViewportSize({width:390,height:780});
  await page.evaluate(()=>{ZargotaI18n.setLocale('ru');showPage('bestiary');});await page.waitForTimeout(300);
  assert.ok(await page.locator('#world-map-splash').evaluate(e=>e.classList.contains('hidden')),'map splash must close when leaving the atlas');
  await page.evaluate(()=>document.activeElement.blur());
  await page.screenshot({path:output+'/bestiary-header.png'});
  // Scrolling the content leaves both navigation rows in place.
  const bar=page.locator('#page-bestiary>.page-back-bar'),initial=await bar.boundingBox();
  await page.locator('#page-bestiary>.page-inner').evaluate(e=>e.scrollTop=500);
  assert.equal((await bar.boundingBox()).y,initial.y);
  await page.locator('.zg-mobile-tools-toggle').tap();await page.waitForTimeout(250);
  await page.screenshot({path:output+'/section-menu.png'});
  await page.evaluate(()=>showPage('home'));assert.ok(!await page.locator('.zg-mobile-tools-toggle').isVisible());
  await page.locator('.home-adventure-btn').tap();await page.waitForTimeout(400);
  assert.ok(await page.locator('#zg-adv-overlay').evaluate(e=>e.classList.contains('open')));
  await page.locator('#zg-adv-view-main .zg-adv-card').first().tap();
  await page.waitForTimeout(45);
  assert.ok(await page.locator('#zg-adv-view-format').evaluate(e=>e.getAnimations().some(a=>a.playState==='running')),'adventure step animates');
  await page.waitForTimeout(350);
  await page.screenshot({path:output+'/adventure-format.png'});
  await page.locator('#zg-adv-back').tap();await page.waitForTimeout(350);
  await page.locator('#zg-adv-view-main .zg-adv-card').last().tap();await page.waitForTimeout(350);
  await page.locator('#zg-adv-code').fill('ABC12');
  assert.equal(await page.locator('#zg-adv-code').inputValue(),'ABC12');
  await page.locator('.zg-adv-close').tap();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.home-adventure-btn').tap();
  await page.locator('#zg-adv-view-main .zg-adv-card').first().tap();
  assert.equal(await page.locator('#zg-adv-view-format').evaluate(e=>e.getAnimations().filter(a=>a.playState==='running').length),0);
  await page.locator('.zg-adv-close').tap();
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>showPage('catalog'));await page.waitForTimeout(300);
  assert.ok(await page.locator('#logo').isVisible());assert.ok(await page.locator('#nav').isVisible());
  assert.ok(!await page.locator('.zg-mobile-tools-toggle').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS: compact menu across5sections, RU/UK320–430+landscape, fixed page/scroll, settings bounds, animated adventure steps/input/reduced motion, desktop.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
