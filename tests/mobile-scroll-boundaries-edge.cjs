const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8765';
async function swipe(page, cdp, from, to) {
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:180,y:from}]});
  for(let i=1;i<=12;i++) {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:from+(to-from)*i/12}]});
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(300);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
  for(const legacy of [false,true]) {
   const context=await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Telegram'});
   if(process.env.ZG_BASELINE) await context.route(/mobile-shell\.(css|js)/,route=>{
    const file=new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({body:execFileSync('git',['show','HEAD:'+file]),contentType:file.endsWith('css')?'text/css':'text/javascript'});
   });
   if(legacy) {
    await context.addInitScript(()=>{const supports=CSS.supports.bind(CSS);CSS.supports=(...args)=>args[0].includes('overscroll')?false:supports(...args);});
    // Exercise the fallback with CSS boundary containment disabled.
    await context.route(/mobile-shell\.css/,async route=>{
     const response=await route.fetch();
     await route.fulfill({response,body:(await response.text()).replaceAll('overscroll-behavior','unsupported-overscroll-behavior')});
    });
   }
   const page=await context.newPage(),cdp=await context.newCDPSession(page);
   await page.goto(base);
   await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
   for(const section of ['home','characters','catalog','bestiary','arena','manual','world']) {
    await page.evaluate(section=>{
     showPage(section);
     if(section==='world')setWorldTab('enc');
     if(section==='arena')arenaShowTab('shop');
    },section);
    await page.waitForTimeout(200);
    if(!legacy) {
     const bad=await page.evaluate(section=>[...document.querySelectorAll('#page-'+section+', #page-'+section+' *')].filter(e=>{
      const s=getComputedStyle(e);return e.clientHeight>0 && /auto|scroll/.test(s.overflowY) && s.overscrollBehaviorY!=='none';
     }).map(e=>e.id||e.className),section);
     assert.deepEqual(bad,[],section+': native scrolling must disable boundary bounce, including iOS overrides');
    }
    // Deterministic cancellation checks supplement native swipes (Chromium does
    // not emulate Safari's compositor rubber band just by changing the UA).
    if(legacy) {
     const results=await page.evaluate(section=>{
      const pg=document.getElementById('page-'+section);
      const scroller=section==='catalog'||section==='bestiary'||section==='world'?pg.querySelector(':scope > .page-inner'):pg;
      const target=document.createElement('div');target.style.height='2500px';scroller.appendChild(target);
      function drag(delta) {
       const start=new Touch({identifier:1,target,clientX:180,clientY:300});
       target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[start]}));
       const move=new Touch({identifier:1,target,clientX:180,clientY:300+delta});
       const event=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[move]});target.dispatchEvent(event);
       target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));
       return event.defaultPrevented;
      }
      scroller.scrollTop=0;const top=drag(50);
      const inward=drag(-50);
      scroller.scrollTop=100;const middle=drag(40);
      scroller.scrollTop=scroller.scrollHeight;const bottom=drag(-50);
      scroller.scrollTop=0;target.remove();
      return {top,inward,middle,bottom};
     },section);
     assert.equal(results.top,true,section+' top boundary');assert.equal(results.bottom,true,section+' bottom boundary');
     if(section!=='home') {assert.equal(results.inward,false,section+' inward scrolling');assert.equal(results.middle,false,section+' middle scrolling');}
    }
    if(section==='characters'||section==='manual') {
     await page.evaluate(section=>{const pg=document.getElementById('page-'+section);pg.scrollTop=0;const f=document.createElement('div');f.style.height='3000px';pg.appendChild(f);},section);
     await swipe(page,cdp,550,250);
     assert.ok(await page.evaluate(section=>document.getElementById('page-'+section).scrollTop>50,section),section+' native swipe still scrolls');
    }
   }
   if(legacy) {
    const exemptions=await page.evaluate(()=>{
     const pg=document.getElementById('page-world');
     function drag(target,multi) {
      const touches=[new Touch({identifier:1,target,clientX:180,clientY:300})];
      if(multi)touches.push(new Touch({identifier:2,target,clientX:220,clientY:300}));
      target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches}));
      const ev=new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:touches.map(t=>new Touch({identifier:t.identifier,target,clientX:t.clientX,clientY:350}))});
      let blockedByBoundaryGuard;document.addEventListener('touchmove',event=>{blockedByBoundaryGuard=event.defaultPrevented;},{capture:true,once:true});
      target.dispatchEvent(ev);target.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,touches:[]}));return blockedByBoundaryGuard;
     }
     const input=pg.querySelector('input'),custom=document.createElement('div');custom.style.touchAction='none';pg.appendChild(custom);
     const result=[drag(input),drag(custom),drag(pg,true)];custom.remove();return result;
    });
    assert.deepEqual(exemptions,[false,false,false],'text controls, custom drag and multi-touch must not be intercepted');
   }
   console.log((legacy?'Legacy fallback':'Native CSS')+': all seven sections, scroll boundaries and normal swipes OK');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
