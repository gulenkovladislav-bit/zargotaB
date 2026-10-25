const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{e.intro.enabled=false;ZargotaStoryPlayer.start(e);},e);assert.equal(await p.evaluate(()=>ZargotaStoryPlayer.getState().sceneId),'scene-mvctoydb');
 for(const id of ['scene-mvctoydb','scene-esteros-food-backwater','scene-esteros-food-roots','scene-esteros-food-channel']){
  const result=await p.evaluate(({e,id})=>{ZargotaStoryPlayer.stop();e.activeSceneId=id;e.scene=e.scenes.find(s=>s.id===id).scene;e.startSceneId=id;e.intro={enabled:false};e.testLocation=true;e.initialQuestId='food-search';e.testPreparedState=ZargotaStoryTestEntry.prepareAll(e,id,'food-search').state;e.nodes.forEach(n=>{n.textSpeed=999;(n.slides||[]).forEach(s=>s.textSpeed=999)});ZargotaStoryPlayer.start(e);return {done:e.testPreparedState.quests.done,flags:e.testPreparedState.flags};},{e,id});
  assert(!result.done.includes('food-search'));assert(!result.done.includes('food-return'));
  if(id==='scene-esteros-food-channel')assert(!result.flags['esteros-food-eggs-taken']);
  if(id==='scene-esteros-food-roots')assert(!result.flags['esteros-food-roots-taken']);
  if(id==='scene-esteros-food-channel')assert(await p.locator('#zg-story-player .zg-story-dialogue').isHidden(),'arrival must not reveal the nest');
  await p.locator('#zg-story-player').focus();await p.keyboard.press('s');await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-dialogue').hidden);
  assert(await p.locator('#zg-story-player .zg-story-dialogue').isHidden());assert(await p.locator('.zg-story-inspection').isHidden());
  const world=await p.locator('[data-play-world]').boundingBox();assert(world.x<=1&&world.y<=1&&world.x+world.width>=1439&&world.y+world.height>=899);
  const point=id==='scene-esteros-food-channel'?'food-point-nest':id==='scene-esteros-food-roots'?'food-point-good':id==='scene-mvctoydb'?'food-point-water':'food-point-cart';
  assert.equal(await p.locator('[data-token-id="'+point+'"] .zg-story-interaction').count(),1);
  await p.screenshot({path:'output/esteros-snake-reach/'+id+'-fixed.png'});
  if(id==='scene-esteros-food-channel'){
   await p.locator('[data-token-id="food-point-nest"]').click();
   await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-nest');
   await p.keyboard.press('s');await p.locator('#zg-story-player .zg-story-answers button').nth(1).click();
   await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-leave');await p.keyboard.press('s');
   await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-dialogue').hidden);
   assert.equal(await p.locator('[data-token-id="food-point-nest"] .zg-story-interaction').count(),1,'declining eggs must keep marker');
  }

  // World is accessible at the actual player's position after leaving the introductory dialogue.
  const hero=await p.locator('[data-token-id="esteros-child-viewpoint"]').boundingBox();const hit=await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-play-world]')!=null,{x:hero.x+hero.width/2,y:hero.y+hero.height/2});assert(hit,'inspection overlay blocks map');
 }
 // A travel link used to explicitly reopen the removed arrival dialogue.
 await p.evaluate(e=>{ZargotaStoryPlayer.stop();e.intro={enabled:false};e.startSceneId='scene-mvctoydb';e.testDialogueId='food-map-channel';e.nodes.forEach(n=>n.textSpeed=999);ZargotaStoryPlayer.start(e);},e);
 await p.locator('#zg-story-player').focus();await p.keyboard.press('s');await p.locator('#zg-story-player .zg-story-answers button').first().click();
 await p.waitForFunction(()=>ZargotaStoryPlayer.getState().sceneId==='scene-esteros-food-channel'&&document.querySelector('#zg-story-player .zg-story-dialogue').hidden);
 assert.equal(await p.locator('[data-token-id="food-point-nest"] .zg-story-interaction').count(),1);
 await p.evaluate(e=>{ZargotaStoryPlayer.stop();e.activeSceneId='scene-esteros-food-channel';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;ZargotaStoryTestEntry.choose(e,()=>{});},e);
 const labels=await p.locator('dialog.zg-custom-menu .zg-custom-options button').allTextContents();assert(new Set(labels).size===labels.length);
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS four actual locations: target rewards unclaimed, selected quest unfinished, intro releases map, markers remain, camera covers viewport, distinct quest stages, no runtime errors.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
