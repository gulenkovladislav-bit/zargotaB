const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8765';
const output = process.env.ZG_TEST_OUTPUT || '/tmp/zargota-gesture-review';
const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
function near(a,b,message) { assert.ok(Math.abs(a-b)<=1, message+': '+a+' vs '+b); }
const android = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
async function swipe(page, cdp, x, fromY, toY) {
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y:fromY}] });
  for (let i=1;i<=12;i++) {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x,y:fromY+(toY-fromY)*i/12}]});
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(250);
}
async function pinch(page, cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:0},{x:x+30,y,id:1}]});
  for(let i=1;i<=8;i++) {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30-i*5,y,id:0},{x:x+30+i*5,y,id:1}]});
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  try {
    const cases=[['iphone',ios],['iphone-telegram',ios+' Telegram'],['android-chrome',android],['android-telegram',android+' Telegram'],['generic-legacy','Generic Mobile Browser'],['tablet',android]];
    for(const [name,userAgent] of cases) {
      if(process.env.ZG_TEST_CASES && !process.env.ZG_TEST_CASES.split(',').includes(name)) continue;
      const tablet=name==='tablet';
      const context=await browser.newContext({viewport:tablet?{width:820,height:1180}:{width:390,height:700},hasTouch:true,isMobile:true,userAgent});
      if(name==='generic-legacy') {
        await context.addInitScript(()=>{
          Object.defineProperty(window,'visualViewport',{value:undefined});window.ResizeObserver=undefined;
          const supports=CSS.supports.bind(CSS);
          CSS.supports=(...args)=>args[0].includes('overscroll')?false:supports(...args);
        });
        // Force the new stylesheet's unsupported-dvh fallback path.
        await context.route(/mobile-shell\.css/,async route=>{
          const response=await route.fetch();
          await route.fulfill({response,body:(await response.text()).replaceAll('dvh','unsupportedvh').replaceAll('overscroll-behavior','unsupported-overscroll-behavior')});
        });
      }
      const page=await context.newPage();
      const cdp=await context.newCDPSession(page);
      await page.goto(base);
      await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
      for(const section of ['catalog','bestiary']) {
        await page.evaluate(section=>showPage(section),section);
        await page.waitForTimeout(250);
        await page.evaluate(section=>{
          const scroller=pageScrollElement(document.getElementById('page-'+section));
          const fixture=document.createElement('div');fixture.style.height='2000px';fixture.dataset.scrollFixture='';scroller.appendChild(fixture);scroller.scrollTop=0;
        },section);
        const bar=page.locator('#page-'+section+' > .page-back-bar');
        const before=await bar.boundingBox();
        const header=await page.locator('#header').boundingBox();
        near(before.y,header.y+header.height,`${name} ${section} gap`);
        await swipe(page,cdp,180,550,250);
        const state=await page.evaluate(section=>{
          const pg=document.getElementById('page-'+section),inner=pageScrollElement(pg);
          return {inner:inner.scrollTop,outer:pg.scrollTop,body:scrollY,bottom:inner.getBoundingClientRect().bottom,height:window.visualViewport?visualViewport.height:innerHeight};
        },section);
        assert.ok(state.inner>50,`${name} ${section}: finger swipe must scroll content: ${JSON.stringify(state)}`);
        assert.equal(state.outer,0);assert.equal(state.body,0);
        assert.ok(Math.abs(state.bottom-state.height)<=1,`${name} blank bottom strip`);
        near((await bar.boundingBox()).y,before.y,`${name} ${section} bar moved`);
        await page.evaluate(section=>pageScrollElement(document.getElementById('page-'+section)).scrollTop=0,section);
        await swipe(page,cdp,180,250,550);
        near((await bar.boundingBox()).y,before.y,`${name} ${section} overscroll moved bar`);
        assert.equal(await page.evaluate(()=>scrollY),0);
        if(name==='iphone') await page.screenshot({path:path.join(output,section+'.png')});
      }
      // Other content pages must retain native scrolling even with an unrecognized UA.
      await page.evaluate(()=>{showPage('manual');const f=document.createElement('div');f.style.height='3000px';document.getElementById('page-manual').appendChild(f);});
      await page.waitForTimeout(250);
      await swipe(page,cdp,180,550,250);
      assert.ok(await page.evaluate(()=>document.getElementById('page-manual').scrollTop>30),`${name} manual cannot scroll`);
      await page.evaluate(()=>{showPage('world');worldIntroPlayed=true;setWorldTab('map');worldAtlasRuntime.mode='pan';});
      await page.waitForTimeout(1500);
      await page.evaluate(()=>worldZoomBy(1));
      const map=await page.locator('#world-map-canvas').boundingBox();
      const x=map.x+map.width/2,y=map.y+map.height*.6;
      const start=await page.evaluate(()=>({x:worldOffsetX,y:worldOffsetY,scale:worldScale}));
      await swipe(page,cdp,x,y,y-150);
      const end=await page.evaluate(()=>({x:worldOffsetX,y:worldOffsetY,outer:document.getElementById('page-world').scrollTop,inner:document.querySelector('#page-world > .page-inner').scrollTop,body:scrollY}));
      assert.ok(Math.abs(end.y-start.y)>100,`${name} map did not move: ${JSON.stringify({start,end})}`);
      assert.equal(end.outer,0);assert.equal(end.inner,0);assert.equal(end.body,0);
      await pinch(page,cdp,x,y);
      assert.ok(await page.evaluate(scale=>worldScale>scale,start.scale),`${name} map pinch did not zoom`);
      if(!tablet) {
        const bounds=await page.locator('#world-map-wrap').boundingBox(),nav=await page.locator('#world-nav-bar').boundingBox();
        near(bounds.y,nav.y+nav.height,`${name} map top gap`);
        near(bounds.y+bounds.height,700,`${name} map bottom gap`);
      }
      if(name==='iphone') await page.screenshot({path:path.join(output,'map.png')});
      await page.evaluate(()=>setWorldTab('enc'));
      await page.waitForTimeout(250);
      await page.evaluate(()=>{const f=document.createElement('div');f.style.height='3000px';document.getElementById('world-enc-main').appendChild(f);});
      await swipe(page,cdp,tablet?600:180,550,250);
      if(tablet && process.env.ZG_SCROLL_DEBUG) { console.log(await page.evaluate(()=>({target:document.elementFromPoint(600,400).outerHTML.slice(0,200),parts:[...document.querySelectorAll('#page-world,#page-world > .page-inner,.world-shell,#world-enc-screen,.world-enc-shell,.world-enc-main,.world-enc-sidebar')].map(e=>({id:e.id,cls:e.className,rect:e.getBoundingClientRect().toJSON(),ch:e.clientHeight,sh:e.scrollHeight,st:e.scrollTop,overflow:getComputedStyle(e).overflow,grid:getComputedStyle(e).gridTemplateRows}))}))); await page.screenshot({path:path.join(output,'tablet-enc.png')}); }
      assert.ok(await page.evaluate(()=>document.querySelector('#page-world > .page-inner').scrollTop>30 || document.getElementById('world-enc-main').scrollTop>30),`${name} encyclopedia cannot scroll`);
      if(!tablet) {
        for(const height of [580,760]) {
          await page.setViewportSize({width:390,height});
          await page.evaluate(()=>showPage('bestiary'));
          await page.waitForTimeout(250);
          const b=await page.locator('#page-bestiary').boundingBox();
          near(b.y+b.height,height,`${name} viewport resize bottom gap`);
        }
      }
      console.log(name+': native content swipes, fixed bars, map drag and pinch, encyclopedia, viewport resize: OK');
      await context.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
    for(const name of ['catalog','bestiary']) {
      await page.evaluate(name=>{showPage(name);const f=document.createElement('div');f.style.height='3000px';pageScrollElement(document.getElementById('page-'+name)).appendChild(f);},name);
      await page.waitForTimeout(250);await page.mouse.move(700,500);await page.mouse.wheel(0,500);await page.waitForTimeout(300);
      assert.ok(await page.evaluate(name=>pageScrollElement(document.getElementById('page-'+name)).scrollTop>30,name),`desktop ${name} wheel scrolling`);
    }
    console.log('Desktop native wheel scrolling: OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
