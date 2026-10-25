const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 async function start(id){await p.evaluate(({e,id})=>{ZargotaStoryPlayer.stop();e.intro.enabled=false;e.startSceneId=e.activeSceneId=id;e.scene=e.scenes.find(s=>s.id===id).scene;e.scene.story.firstVisitDialogueId='';e.testLocation=true;e.testDialogueId='';e.nodes.forEach(n=>n.textSpeed=999);window.fixture=e;ZargotaStoryPlayer.start(e);},{e,id});}
 for(const [id,token,choice,entry] of [['scene-esteros-food-roots','food-point-good','Пока оставить','food-roots-find'],['scene-esteros-food-channel','food-point-nest','Отойти от корней','food-nest']]){
  await start(id);const hotspot=p.locator(`[data-token-id="${token}"]`);assert.equal(await hotspot.locator('.zg-story-interaction').count(),1);
  await hotspot.click();await p.waitForFunction(entry=>ZargotaStoryPlayer.getState().nodeId===entry,entry);await p.keyboard.press('s');await p.locator('.zg-story-answers button').filter({hasText:choice}).click();await p.waitForFunction(entry=>ZargotaStoryPlayer.getState().nodeId!==entry,entry);await p.keyboard.press('s');
  await p.waitForFunction(()=>document.querySelector('.zg-story-dialogue').hidden);assert.equal(await hotspot.locator('.zg-story-interaction').count(),0,'completed conversation removes question even without reward');
  assert(await hotspot.isVisible(),'place remains available for optional revisit');
  assert.equal(await p.locator('[data-token-id$="-exit"]:visible').count(),0);
 }
 await start('scene-mvctoydb');assert.equal(await p.locator('[data-token-id="food-point-path"]').isVisible(),false);
 await p.evaluate(()=>{window.travelDone=false;ZargotaStoryPlayer.travel('scene-esteros-food-roots',()=>travelDone=true);});
 await p.getByText('Через некоторое время',{exact:true}).waitFor();fs.mkdirSync('output/esteros-marker-review',{recursive:true});await p.screenshot({path:'output/esteros-marker-review/travel-caption.png'});
 await p.waitForFunction(()=>travelDone);assert.equal((await p.evaluate(()=>ZargotaStoryPlayer.getState())).sceneId,'scene-esteros-food-roots');
 // The map retains the existing home outcome after removing the path marker.
 await p.evaluate(()=>{const state=ZargotaStoryPlayer.getState();state.flags['food-found']=true;fixture.testPreparedState=state;fixture.testDialogueId='esteros-map-home';ZargotaStoryPlayer.stop();ZargotaStoryPlayer.start(fixture);});
 await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-home');
 assert.deepEqual(errors,[]);console.log('PASS Edge: questions disappear only after completed branches, uncollected locations remain usable, exits hidden, actual travel caption and transition, map home route preserved.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
