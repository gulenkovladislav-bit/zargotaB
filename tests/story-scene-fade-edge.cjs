const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
  async function start(method){
   await page.evaluate(method=>{
    const scene={boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',x:50,y:50}],story:{}};
    if(method==='token')scene.tokens.push({id:'gate',name:'Gate',x:51,y:50,sceneId:'b'});
    if(method==='zone')scene.story.zones=[{id:'gate',x:55,y:50,radiusCells:2,mode:'enter',sceneId:'b'}];
    const target={...scene,tokens:[{id:'hero',x:70,y:60},{id:'destination',x:80,y:70}],story:{}};
    ZargotaStoryPlayer.start({intro:{enabled:false},heroTokenId:'hero',activeSceneId:'a',scene,scenes:[{id:'a',scene},{id:'b',scene:target}],testDialogueId:method==='dialogue'?'talk':undefined,nodes:[{id:'talk',text:'Ready',textAnimation:'none',links:[{id:'go',label:'Go',sceneId:'b'}]}]});
   },method);
  }
  async function trigger(method){
   if(method==='dialogue')await page.locator('.zg-story-answers button').first().click();
   else if(method==='token')await page.locator('[data-token-id="gate"]').click();
   else {const box=await page.locator('[data-play-world]').boundingBox();await page.mouse.click(box.x+box.width*.55,box.y+box.height*.5);}
  }
  for(const method of ['token','zone','dialogue']){
   await start(method);await trigger(method);
   await page.waitForSelector('.zg-story-scene-fade');
   // The old scene remains until the screen is black.
   assert.equal(await page.locator('[data-token-id="destination"]').count(),0);
   await page.waitForSelector('[data-token-id="destination"]');
   assert.equal(await page.locator('.zg-story-scene-fade').count(),1);
   await page.waitForSelector('.zg-story-scene-fade',{state:'detached'});
   assert.equal(await page.locator('[data-token-id="hero"]').evaluate(el=>parseFloat(el.style.left)),70);
  }
  await start('token');await trigger('token');await page.waitForSelector('.zg-story-scene-fade');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.zg-story-scene-fade',{state:'detached'});
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#zg-story-player.open').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS Edge: token, enter-zone and dialogue fade transitions; destination spawn; Escape cancellation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
