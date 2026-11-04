'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  const output = process.env.ZG_PORTRAIT_OUTPUT || '/private/tmp/zg-mobile-refinement';
  fs.mkdirSync(output, {recursive:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.ZG_TEST_URL || 'http://127.0.0.1:18543/');
    await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
    const ids = await page.evaluate(()=>characters.slice(0,5).map(c=>c.id));
    async function checkPortraits(context) {
      await page.locator('img[data-zg-portrait="'+context+'"]:visible').first().waitFor();
      await page.waitForTimeout(240);
      const frames = await page.locator('img[data-zg-portrait="'+context+'"]:visible').evaluateAll(async imgs=>{
        await Promise.all(imgs.map(i=>i.decode())); ZargotaPortrait.refresh();
        return imgs.map(i=>{
          const width=i.clientWidth,height=i.clientHeight,scale=Math.max(width/i.naturalWidth,height/i.naturalHeight);
          const [px,py]=getComputedStyle(i).objectPosition.split(' ').map(parseFloat);
          return {x:(width-i.naturalWidth*scale)*px/100+i.naturalWidth*scale*Number(i.dataset.portraitX)/100,
            y:(height-i.naturalHeight*scale)*py/100+i.naturalHeight*scale*Number(i.dataset.portraitY)/100,
            width,height,position:i.style.objectPosition,transform:getComputedStyle(i).transform};
        });
      });
      frames.forEach(f=>{assert.ok(f.width>0&&f.height>0);assert.ok(f.x>f.width*.15&&f.x<f.width*.85,JSON.stringify({context,f}));assert.ok(f.y>f.height*.12&&f.y<f.height*.65,JSON.stringify({context,f}));assert.ok(f.position);assert.equal(f.transform,'none');});
    }
    for (const [width,height] of [[320,568],[390,780],[430,932]]) {
      await page.setViewportSize({width,height});
      for (let n=0;n<ids.length;n++) {
        await page.evaluate(id=>{window._charSheetTab='stats';showPage('characters');openCharSheet(id);},ids[n]);
        await checkPortraits('sheet');
        if(width===390) await page.screenshot({path:output+'/portrait-'+n+'.png'});
        await page.locator('.zgmo-nav button').nth(3).tap();await checkPortraits('lore');
      }
      await page.evaluate(()=>{charView='list';showPage('characters');showCharView('list');});
      await checkPortraits('roster');await checkPortraits('thumb');
      await page.locator('[data-roster-action=next]').tap();await checkPortraits('roster');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(width===390)await page.screenshot({path:output+'/portrait-roster.png'});
    }
    await page.setViewportSize({width:390,height:780});
    await page.evaluate(id=>{window._charSheetTab='stats';openCharSheet(id);},ids[0]);await checkPortraits('sheet');
    await page.evaluate(()=>{window.portraitBefore=document.querySelector('.zgmo-portrait-image');window.frameBefore=portraitBefore.style.objectPosition;});
    await page.locator('[data-zgmo=damage]').tap();await checkPortraits('sheet');
    assert.ok(await page.evaluate(()=>portraitBefore===document.querySelector('.zgmo-portrait-image')&&portraitBefore.style.objectPosition===frameBefore));
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(350);
    await page.setViewportSize({width:390,height:780});await checkPortraits('sheet');
    // The same image node also adapts if a source changes after initial rendering.
    await page.evaluate(()=>{const i=document.querySelector('.zgmo-portrait-image');i.src='images/portraits/char_1776463717210.png';i.dataset.portraitX='49';i.dataset.portraitY='22';});await checkPortraits('sheet');
    assert.deepEqual(await page.evaluate(()=>ZargotaPortrait.point({portraitFocusX:0,portraitFocusY:100})),[0,100]);
    assert.deepEqual(errors,[]);
    console.log('PASS: all five real portraits keep faces visible at 320/390/430; roster/thumbnail/sheet/lore; source changes and resize; stable HP DOM; zero overflow/errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
