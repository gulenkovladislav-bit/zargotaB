'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:18549/');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>showPage('characters'));
  const desktopCloud={indicator:await page.locator('#character-cloud-indicator').isVisible(),panel:await page.locator('#character-cloud-panel').isVisible()};
  assert.ok(await page.locator('#char-list-view>.char-tabs').isVisible());assert.ok(await page.locator('#chars-btn-home').isVisible());
  await page.evaluate(()=>showPage('home'));await page.setViewportSize({width:390,height:780});
  await page.locator('.home-card[data-target-page=characters]').tap();
  const hasAccount=await page.evaluate(()=>typeof window.ZargotaPersistentCharacters?.settings==='function');
  assert.equal(await page.locator('[data-roster-action=account]').count(),hasAccount?1:0,'No dead account action in public builds without the persistent module');
  for(const locale of ['ru','uk']){
   await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
   for(const [width,height] of [[320,568],[390,780],[430,932]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(180);
    const geometry=await page.evaluate(()=>{
     const bar=document.querySelector('#chars-back-bar'),title=document.querySelector('#chars-back-title'),stage=document.querySelector('.roster-stage');
     return {barHeight:bar.getBoundingClientRect().height,titleFit:title.scrollWidth<=title.clientWidth+1,stageHeight:stage.clientHeight,overflow:document.documentElement.scrollWidth-innerWidth,
      controls:['#chars-btn-home','.roster-menu summary'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};})};
    });
    assert.ok(geometry.titleFit,JSON.stringify({locale,width,geometry}));assert.ok(geometry.barHeight<=60);assert.ok(geometry.stageHeight>140);assert.ok(geometry.overflow<=1);
    assert.ok(!await page.locator('#char-list-view>.char-tabs').isVisible());assert.ok(!await page.locator('#character-cloud-indicator').isVisible());
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
  await page.locator('.roster-menu summary').tap();await page.locator('[data-roster-action=sync]').tap();await page.locator('#character-cloud-dialog').waitFor();await page.keyboard.press('Escape');
  assert.ok(await page.locator('.roster-menu summary').evaluate(el=>el===document.activeElement),'Closing legacy sync restores the visible menu trigger');
  // The account command uses the persistent system, not the old invitation lamp.
  await page.evaluate(()=>{window.rosterAccountCalls=0;window.rosterAccountAPI=window.ZargotaPersistentCharacters;window.ZargotaPersistentCharacters={...(window.rosterAccountAPI||{}),settings:()=>window.rosterAccountCalls++,visible:()=>true};renderCharList();});
  await page.locator('.roster-menu summary').tap();await page.locator('[data-roster-action=account]').tap();assert.equal(await page.evaluate(()=>rosterAccountCalls),1);
  await page.evaluate(()=>{window.ZargotaPersistentCharacters=window.rosterAccountAPI;renderCharList();});
  assert.equal(await page.locator('[data-roster-action=account]').count(),hasAccount?1:0);
  await page.locator('.roster-menu summary').tap();await page.keyboard.press('Escape');assert.equal(await page.locator('.roster-menu').getAttribute('open'),null);
  await page.locator('.roster-menu summary').tap();await page.locator('#chars-back-title').tap();assert.equal(await page.locator('.roster-menu').getAttribute('open'),null);
  // Hero changes retain the decorative layer; its animation does not restart with each draw.
  await page.evaluate(()=>window.rosterMotes=document.querySelector('.roster-motes'));
  await page.locator('[data-roster-action=next]').tap();assert.ok(await page.evaluate(()=>rosterMotes===document.querySelector('.roster-motes')));
  await page.locator('[data-roster-action=prev]').tap();
  const arrows=await page.locator('.roster-arrow').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));assert.ok(Math.abs(arrows[0]-arrows[1])<1,'Pressed carousel arrows must stay vertically aligned');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.roster-motes i').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  // Emulate a device's safe-area inset without changing global viewport variables.
  await page.setViewportSize({width:390,height:780});await page.evaluate(()=>document.querySelector('#chars-back-bar').style.setProperty('--roster-safe-top','34px'));
  assert.ok((await page.locator('#chars-btn-home').boundingBox()).y>=42);assert.ok(await page.locator('.roster-open').isVisible());
  await page.evaluate(()=>document.querySelector('#chars-back-bar').style.removeProperty('--roster-safe-top'));
  await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await page.waitForTimeout(200);
  const output=process.env.ZG_ROSTER_OUTPUT||'/private/tmp/zg-roster-header';fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:output+'/after.png'});await page.locator('.roster-menu summary').tap();await page.screenshot({path:output+'/menu.png'});await page.locator('.roster-menu summary').tap();
  await page.locator('.roster-open').tap();assert.ok(await page.locator('.zgmo-portrait').isVisible());await page.locator('[data-zgmo=back]').tap();assert.ok(await page.locator('.roster-screen').isVisible());
  await page.locator('#chars-btn-home').tap();assert.ok(await page.locator('#page-home').isVisible());
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>showPage('characters'));assert.ok(await page.locator('#header').isVisible());assert.ok(!await page.locator('.roster-menu').isVisible());assert.ok(await page.locator('#char-list-view>.char-tabs').isVisible());assert.ok(await page.locator('#chars-btn-home').isVisible());
  assert.deepEqual({indicator:await page.locator('#character-cloud-indicator').isVisible(),panel:await page.locator('#character-cloud-panel').isVisible()},desktopCloud,'Desktop sync controls retain their original visibility after the mobile route');
  assert.deepEqual(errors,[]);console.log('PASS roster header: RU/UK320/390/430; safe area;44px controls; mobile NPC/legacy lamp hidden; import/account/sync in menu; persistent motion nodes; reduced motion; sheet/back/home; desktop unchanged; zero errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
