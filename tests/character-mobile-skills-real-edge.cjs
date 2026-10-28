'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8877');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  const heroes=await page.evaluate(()=>characters.filter(c=>c.type==='hero').map(c=>({id:c.id,name:c.name})));
  assert.ok(heroes.length>0);let views=0,opened=0;const clipping=[];
  for(const locale of ['ru','uk']){
   await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
   for(const [width,height] of [[320,568],[390,780],[430,932]]){
    await page.setViewportSize({width,height});
    for(const hero of heroes){
     await page.evaluate(id=>{window._charSheetTab='skills';showPage('characters');openCharSheet(id);},hero.id);
     await page.waitForFunction(()=>document.querySelector('.zgms-screen')&&Math.abs(document.querySelector('.zgms-screen').getBoundingClientRect().top)<0.1);
     for(const group of ['personal','learned','traits','mastery']){
      await page.locator('[data-group='+group+']').tap();
      await page.waitForFunction(g=>document.querySelector('[data-group='+g+']').getAttribute('aria-pressed')==='true',group);
      if(group==='learned'){await page.locator('.zgms-filter [data-filter=all]').tap();await page.waitForFunction(()=>document.querySelector('.zgms-filter [data-filter=all]').getAttribute('aria-pressed')==='true');}
      await page.locator('.zgms-source img').evaluateAll(els=>Promise.all(els.map(el=>el.decode())));
      const geometry=await page.evaluate(()=>{
       const root=document.querySelector('.zgms-screen'),nav=document.querySelector('.zgmo-nav');
       return {overflow:Math.max(root.scrollHeight-root.clientHeight,document.documentElement.scrollWidth-innerWidth,document.body.scrollHeight-innerHeight),overlap:root.getBoundingClientRect().bottom-nav.getBoundingClientRect().top,clips:[...document.querySelectorAll('.zgms-source')].filter(el=>el.getBoundingClientRect().bottom>el.parentElement.getBoundingClientRect().bottom+1).map(el=>el.closest('.zgms-card').innerText)};
      });
      assert.ok(geometry.overflow<=1&&geometry.overlap<=1,JSON.stringify({locale,width,hero,group,geometry}));
      if(geometry.clips.length)clipping.push({locale,width,hero:hero.name,group,cards:geometry.clips});
      views++;
      if(width===390&&locale==='ru'&&await page.locator('.zgms-card').count()){
       await page.locator('.zgms-card').first().tap();
       assert.ok(await page.locator('#zgms-dialog').isVisible());
       await page.locator('#zgms-dialog').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
       const fits=await page.evaluate(()=>document.querySelector('#zgms-dialog').getBoundingClientRect().bottom<=document.querySelector('.zgmo-nav').getBoundingClientRect().top+1);
       assert.ok(fits,'Details cover bottom navigation');
       await page.locator('[data-zgms=close]').tap();opened++;
       if(group==='traits')await page.screenshot({path:'/tmp/zargota-real-traits-'+hero.id+'.png'});
      }
     }
    }
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(clipping,[],'Source emblems clipped at small heights');
  console.log(JSON.stringify({result:'PASS',heroes:heroes.map(h=>h.name),views,opened,locales:['ru','uk'],widths:[320,390,430]}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
