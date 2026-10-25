const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765';
const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
const android='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
async function state(page){return page.evaluate(()=>({page:currentPage,hub:getComputedStyle(document.getElementById('arena-hub-inner')).display,game:document.getElementById('zg-game-overlay').classList.contains('open'),opens:window.arenaEntryOpens}));}
function assertHub(result,label){assert.equal(result.page,'arena',label);assert.equal(result.hub,'block',label);assert.equal(result.game,false,label);assert.equal(result.opens,0,label);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  for(const config of [
   {name:'iphone-small',userAgent:ios,viewport:{width:375,height:600},isMobile:true,hasTouch:true},
   {name:'iphone',userAgent:ios,viewport:{width:390,height:700},isMobile:true,hasTouch:true},
   {name:'android',userAgent:android,viewport:{width:430,height:800},isMobile:true,hasTouch:true},
   {name:'desktop',viewport:{width:1440,height:900},isMobile:false,hasTouch:false}
  ]){
   const {name,...options}=config;
   const context=await browser.newContext(options),page=await context.newPage();
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
   await page.evaluate(()=>{window.arenaEntryOpens=0;const open=zgArenaWorkspaceOpen;window.zgArenaWorkspaceOpen=function(){arenaEntryOpens++;return open.apply(this,arguments);};});
   const card=page.locator('.home-card[data-target-page="arena"]');
   const activate=locator=>options.hasTouch?locator.tap():locator.click();
   await activate(card);
   await page.waitForTimeout(150);
   assertHub(await state(page),name+' one gesture must only open the hub');
   await activate(page.locator('#arena-hub-inner .arena-hub-card').first());
   await page.waitForTimeout(100);
   assert.equal((await state(page)).opens,1,name+' separate arena gesture must work');
   assert.equal((await state(page)).game,true);
   await page.evaluate(()=>{zgGameClose(true);showPage('home');arenaEntryOpens=0;});
   await activate(card);
   assertHub(await state(page),name+' return visit must open the hub');
   await activate(page.locator('#arena-hub-inner .arena-hub-card').nth(1));
   assert.equal((await state(page)).game,false,name+' shop must not open combat');
   assert.equal((await state(page)).opens,0);
   assert.ok(await page.locator('#shop-page-inner').isVisible());
   if(options.hasTouch){
    // Some WebViews never synthesize click. The next physical tap must still work.
    await page.evaluate(()=>showPage('home'));
    await card.dispatchEvent('pointerdown',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:280,clientY:380});
    await card.dispatchEvent('pointerup',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:280,clientY:380});
    assertHub(await state(page),name+' pointerup without compatibility click');
    await page.locator('#arena-hub-inner .arena-hub-card').first().tap();
    assert.equal((await state(page)).opens,1,name+' fresh tap must clear the guard immediately');
    await page.evaluate(()=>{zgGameClose(true);showPage('home');arenaEntryOpens=0;});
   }else{
    await page.evaluate(()=>showPage('home'));
    await card.focus();await page.keyboard.press('Enter');
    assertHub(await state(page),'keyboard navigation');
    await page.locator('#arena-hub-inner .arena-hub-card').first().focus();await page.keyboard.press('Enter');
    assert.equal((await state(page)).opens,1,'keyboard arena choice');
   }
   console.log(name+': home opens hub; explicit arena/shop choice and repeat entry: OK');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
