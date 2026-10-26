const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765';
const output='/tmp/zargota-cloud-review';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
  for(const [width,height,locale] of [[320,650,'ru'],[390,700,'ru'],[390,700,'uk'],[844,390,'ru'],[1280,900,'ru']]) {
   const mobile=width<1000;
   const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile});
   // No real cloud operations: exercise the permission error and invitation UI.
   await context.route(/character-cloud-store\.js/,route=>route.fulfill({contentType:'text/javascript',body:`
    window.ZargotaCharacterCloudStore={create:function(){return {
     list:function(){return Promise.reject({code:'PERMISSION_DENIED'});},
     join:function(){return new Promise(function(resolve){window.finishCloudJoin=resolve;});}
    };}};
   `}));
   const page=await context.newPage();
   await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
   await page.evaluate(locale=>{ZargotaI18n.setLocale(locale);showPage('characters');},locale);
   await page.waitForTimeout(350);
   const button=page.locator('#character-cloud-indicator'),panel=page.locator('#character-cloud-panel');
   assert.equal(await panel.isVisible(),!mobile);
   assert.equal(await button.isVisible(),mobile);
   if(mobile) {
    assert.equal(await button.getAttribute('data-state'),'attention');
    assert.ok((await button.getAttribute('aria-label')).includes(locale==='uk'?'Синхронізація':'Синхронизация'),await button.getAttribute('aria-label'));
    const b=await button.boundingBox(),bar=await page.locator('#chars-back-bar').boundingBox();
    assert.ok(b.width>=40&&b.height>=40);assert.ok(b.x+b.width<=width&&b.y>=bar.y&&b.y+b.height<=bar.y+bar.height);
    assert.ok(await page.locator('#char-list-view').boundingBox().then(r=>r.y<180),'large sync panel no longer pushes characters down');
    if(width===390&&locale==='ru')await page.screenshot({path:output+'/characters.png'});
    await button.tap();
    const dialog=page.locator('#character-cloud-dialog');assert.equal(await dialog.isVisible(),true);
    assert.ok(!(await dialog.innerText()).includes('Firebase'));
    assert.ok((await dialog.innerText()).includes(locale==='uk'?'Локальні персонажі доступні':'Локальные персонажи доступны'));
    if(width===390&&locale==='ru')await page.screenshot({path:output+'/sync-details.png'});
    await page.keyboard.press('Escape');await page.waitForTimeout(100);
    assert.equal(await dialog.count(),0,'Escape removes summary so incoming cloud updates are not permanently deferred');
    assert.equal(await button.evaluate(e=>e===document.activeElement),true);
    await button.tap();await dialog.locator('[data-cloud-action=join]').tap();
    await page.locator('#character-cloud-code').fill('test-invitation');
    await page.locator('#character-cloud-name').fill('Тест');
    await page.locator('[data-cloud-action=join-confirm]').tap();
    assert.equal(await button.getAttribute('data-state'),'busy');
    assert.equal(await page.locator('#character-cloud-name').inputValue(),'Тест','background render preserves invitation inputs');
    await page.evaluate(()=>finishCloudJoin());await page.waitForTimeout(150);
    assert.equal(await dialog.count(),0);assert.equal(await button.getAttribute('data-state'),'attention');
    await button.tap();assert.ok((await dialog.innerText()).includes(locale==='uk'?'Очікується доступ':'Ожидается доступ'));
    await dialog.locator('[data-cloud-action=close]').tap();assert.equal(await dialog.count(),0);
   }
   console.log(width+'x'+height+' '+locale+': compact layout, details, close, invitation and pending status OK');
   await context.close();
  }
  // Validate truthful idle/ready/draft states independently of live network data.
  const context=await browser.newContext({viewport:{width:390,height:700},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{
   localStorage.setItem('zargota_character_cloud_v1',JSON.stringify({records:{fixture:{characterId:'fixture',base:{id:'fixture',name:'Fixture'}}},pending:[]}));
  });
  await context.route(/character-cloud-store\.js/,route=>route.fulfill({contentType:'text/javascript',body:`
   window.ZargotaCharacterCloudStore={create:function(){return {
    list:function(){return Promise.resolve(['fixture']);},
    watch:function(id,cb){window.cloudEmit=cb;return function(){};}
   };}};
  `}));
  const page=await context.newPage();await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>{showPage('characters');});await page.waitForTimeout(100);
  assert.equal(await page.locator('#character-cloud-indicator').getAttribute('data-state'),'local');
  await page.evaluate(()=>{
   characters.push({id:'fixture',name:'Fixture'});
   cloudEmit('approved',{data:{id:'fixture',name:'Fixture'}},{master:true,uid:'test'});
  });
  assert.equal(await page.locator('#character-cloud-indicator').getAttribute('data-state'),'ready');
  await page.evaluate(()=>{characters.find(c=>c.id==='fixture').name='Edited';ZargotaCharacterCloud.refresh();});await page.waitForTimeout(100);
  assert.equal(await page.locator('#character-cloud-indicator').getAttribute('data-state'),'attention');
  await page.evaluate(()=>{
   characters.find(c=>c.id==='fixture').name='Fixture';viewingCharId='fixture';
   document.getElementById('char-sheet-view').style.display='block';ZargotaCharacterCloud.refresh();
  });await page.waitForTimeout(100);
  await page.locator('#character-cloud-indicator').tap();
  await page.evaluate(()=>cloudEmit('approved',{data:{id:'fixture',name:'Fixture'}},{master:true,uid:'test'}));
  await page.locator('#character-cloud-summary [data-cloud-action=refresh]').tap();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#character-cloud-dialog').count(),0);
  assert.equal(await page.locator('#character-cloud-indicator').getAttribute('data-state'),'ready','refresh closes the summary before applying deferred updates');
  console.log('Local, synchronized and draft indicator states OK');await context.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
