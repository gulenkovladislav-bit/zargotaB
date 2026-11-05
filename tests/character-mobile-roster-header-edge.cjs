'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18547/');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.locator('.home-card[data-target-page=characters]').tap();
  for(const locale of ['ru','uk']){
   await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
   for(const [width,height] of [[320,568],[390,780],[430,932]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(180);
    const geometry=await page.evaluate(()=>{
     const bar=document.querySelector('#chars-back-bar'),title=document.querySelector('#chars-back-title'),stage=document.querySelector('.roster-stage');
     return {barHeight:bar.getBoundingClientRect().height,titleFit:title.scrollWidth<=title.clientWidth+1,stageHeight:stage.clientHeight,overflow:document.documentElement.scrollWidth-innerWidth,
      controls:['#chars-btn-home','#character-cloud-indicator','.roster-menu summary'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};})};
    });
    assert.ok(geometry.titleFit,JSON.stringify({locale,width,geometry}));assert.ok(geometry.barHeight<=60);assert.ok(geometry.stageHeight>140);assert.ok(geometry.overflow<=1);
    geometry.controls.forEach(r=>{assert.ok(r.width>=44&&r.height>=44,JSON.stringify({locale,width,r,geometry}));assert.ok(r.y>=7.5&&r.x>=0&&r.right<=width);});
    await page.locator('.roster-menu summary').tap();
    const dropdown=await page.locator('[data-roster-action=import]').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,clickable:el.contains(hit),height:r.height};});
    assert.ok(dropdown.visible&&dropdown.clickable&&dropdown.height>=44,JSON.stringify(dropdown));
    await page.locator('.roster-menu summary').tap();
   }
  }
  // Opening import uses the original picker and does not navigate away from the roster.
  await page.locator('.roster-menu summary').tap();
  const chooserPromise=page.waitForEvent('filechooser');await page.locator('[data-roster-action=import]').tap();await chooserPromise;
  assert.ok(await page.locator('.roster-screen').isVisible());assert.equal(await page.locator('.roster-menu').getAttribute('open'),null);
  await page.locator('#character-cloud-indicator').tap();await page.locator('#character-cloud-dialog').waitFor();await page.keyboard.press('Escape');
  const focus=await page.locator('#character-cloud-indicator').evaluate(el=>{const s=getComputedStyle(el);return {visible:el.matches(':focus-visible'),width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset)};});
  assert.ok(focus.visible&&focus.width>0&&focus.width<=2&&focus.offset<=-4,'Connection keyboard focus must stay inside its touch target: '+JSON.stringify(focus));
  await page.locator('#character-cloud-indicator').tap();await page.locator('#character-cloud-dialog [data-cloud-action=close]').tap();
  const touchFocus=await page.locator('#character-cloud-indicator').evaluate(el=>{const s=getComputedStyle(el);return {visible:el.matches(':focus-visible'),width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset)};});
  assert.ok(!touchFocus.visible||touchFocus.offset<=-4,'Touch close must not leave an outer focus ring');
  // Emulate a device's safe-area inset without changing global viewport variables.
  await page.setViewportSize({width:390,height:780});await page.evaluate(()=>document.querySelector('#chars-back-bar').style.setProperty('--roster-safe-top','34px'));
  assert.ok((await page.locator('#chars-btn-home').boundingBox()).y>=42);assert.ok(await page.locator('.roster-open').isVisible());
  await page.evaluate(()=>document.querySelector('#chars-back-bar').style.removeProperty('--roster-safe-top'));
  await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await page.waitForTimeout(200);
  const output=process.env.ZG_ROSTER_OUTPUT||'/private/tmp/zg-roster-header';fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:output+'/after.png'});await page.locator('.roster-menu summary').tap();await page.screenshot({path:output+'/menu.png'});await page.locator('.roster-menu summary').tap();
  await page.locator('.roster-open').tap();assert.ok(await page.locator('.zgmo-portrait').isVisible());await page.locator('[data-zgmo=back]').tap();assert.ok(await page.locator('.roster-screen').isVisible());
  await page.locator('#chars-btn-home').tap();assert.ok(await page.locator('#page-home').isVisible());
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>showPage('characters'));assert.ok(await page.locator('#header').isVisible());assert.ok(!await page.locator('.roster-menu').isVisible());
  assert.deepEqual(errors,[]);console.log('PASS roster header: RU/UK320/390/430; safe area;44px controls; import dropdown hit/picker; cloud dialog; sheet/back/home; desktop; zero errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
