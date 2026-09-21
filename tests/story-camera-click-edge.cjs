const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  await page.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(()=>ZargotaStoryPlayer.start({intro:{enabled:false},heroTokenId:'hero',activeSceneId:'s',scene:{boardWidth:24,boardHeight:16,gridSize:64,layers:[],tokens:[{id:'hero',x:50,y:50}],story:{cameraZoom:2}},nodes:[]}));
  for(const mode of ['middle','alt']){
   await page.mouse.move(600,250);
   if(mode==='alt')await page.keyboard.down('Alt');
   await page.mouse.down({button:mode==='middle'?'middle':'left'});
   await page.mouse.move(680,280,{steps:5});
   await page.mouse.up({button:mode==='middle'?'middle':'left'});
   if(mode==='alt')await page.keyboard.up('Alt');
   assert.equal(await page.locator('.zg-move-ping').count(),0,'camera drag must not move hero');
   const before=await page.locator('[data-token-id="hero"]').evaluate(e=>e.style.left);
   await page.mouse.click(850,450);
   await page.waitForSelector('.zg-move-ping');
   assert.equal(await page.locator('.zg-move-ping').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
   await page.waitForFunction(before=>document.querySelector('[data-token-id="hero"]').style.left!==before,before);
   await page.waitForSelector('.zg-move-ping',{state:'detached'});
  }
  console.log('PASS Edge: first movement click after middle/Alt camera drag, gold ping and cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
