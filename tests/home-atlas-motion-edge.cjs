'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const page=await browser.newPage({viewport:{width:390,height:750},hasTouch:true,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18547/');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 for(const locale of ['ru','uk']){
  await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
  for(const [width,height] of [[320,568],[360,640],[390,750],[430,932],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   const sizes=await page.evaluate(()=>{const brand=document.querySelector('.home-mobile-wordmark').getBoundingClientRect();return{top:brand.top,height:brand.height,wide:document.documentElement.scrollWidth>innerWidth+1,cards:[...document.querySelectorAll('.home-card,.home-own-sheet,.home-adventure-btn')].map(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right}})};});
   assert.ok(sizes.top>=9&&sizes.height>=44,JSON.stringify({width,locale,sizes}));assert.ok(!sizes.wide);
   sizes.cards.forEach(r=>assert.ok(r.top>=0&&r.bottom<=height+1&&r.left>=-1&&r.right<=width+1,JSON.stringify({width,height,r})));
   await page.locator('.home-mobile-wordmark').tap();await page.waitForTimeout(230);
   const panel=await page.locator('#header').boundingBox();assert.ok(panel.y>=sizes.top+sizes.height&&panel.x>=8&&panel.x+panel.width<=width-8+1);
   assert.equal(await page.locator('.home-mobile-wordmark').getAttribute('aria-expanded'),'true');
   await page.locator('#zg-net-monitor-btn').tap();assert.ok(await page.locator('#zg-net-monitor-panel').isVisible());
   const monitor=await page.locator('#zg-net-monitor-panel').boundingBox();assert.ok(monitor.x>=-1&&monitor.x+monitor.width<=width+1,JSON.stringify(monitor));
   await page.keyboard.press('Escape');assert.equal(await page.locator('.home-mobile-wordmark').getAttribute('aria-expanded'),'false');
  }
 }
 await page.setViewportSize({width:390,height:750});await page.evaluate(()=>ZargotaI18n.setLocale('ru'));
 // Sample either side of the seam and the middle without waiting for a long loop.
 const loops=await page.evaluate(()=>document.querySelector('.home-mobile-backdrop').getAnimations({subtree:true}).map(a=>{a.pause();const d=a.effect.getTiming().duration,frames=a.effect.getKeyframes();return{name:a.animationName,d,first:frames[0],last:frames.at(-1)};}));
 assert.equal(loops.length,2);loops.forEach(a=>{assert.ok(a.d>=30000 && a.d<=40000);assert.equal(a.first.transform,a.last.transform);assert.equal(a.first.opacity,a.last.opacity);});
 async function frame(fraction){return page.evaluate(f=>{const node=document.querySelector('.home-mobile-backdrop');node.getAnimations({subtree:true}).forEach(a=>a.currentTime=a.effect.getTiming().duration*f);return['::before','::after'].map(p=>({transform:getComputedStyle(node,p).transform,opacity:getComputedStyle(node,p).opacity}));},fraction);}
 const start=await frame(0),middle=await frame(.5),end=await frame(1);assert.notDeepEqual(start,middle);assert.deepEqual(start,end);
 const embers=await page.locator('.home-particle').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>({name:getComputedStyle(e).animationName,visibility:getComputedStyle(e).visibility})));assert.equal(embers.length,6);assert.ok(embers.every(e=>e.name==='atlas-ember-rise'&&e.visibility==='visible'));
 await page.screenshot({path:'/private/tmp/zg-mobile-unified/home-after.png'});await page.locator('.home-mobile-wordmark').tap();await page.waitForTimeout(230);await page.screenshot({path:'/private/tmp/zg-mobile-unified/menu-after.png'});await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(await page.locator('.home-mobile-backdrop').evaluate(e=>['::before','::after'].map(p=>getComputedStyle(e,p).animationName)),['none','none']);
 await page.locator('.home-card[data-target-page=characters]').tap();assert.ok(await page.locator('#char-list-view').isVisible());await page.evaluate(()=>showPage('home'));
 await page.setViewportSize({width:1440,height:900});assert.ok(!await page.locator('.home-mobile-backdrop').isVisible());assert.ok(await page.locator('#header').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS: home/menu RU/UK320–430 and landscape; inset controls; full cycle seam; reduced motion; character route; desktop unchanged.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
