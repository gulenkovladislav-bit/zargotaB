const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1600,height:1000}});p.setDefaultTimeout(15000);await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));await p.waitForFunction(()=>window.ZargotaStoryPlayer);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync(process.env.EPISODE_FILE||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 const fragment=JSON.parse(fs.readFileSync('story-content/esteros/shore-choice-continuation-v1.json'));
 const choiceId=fragment.choiceId,fatalId=fragment.nodes[0].links[0].to,hopeId=fragment.nodes[0].links[1].to;
 for(const n of fragment.nodes){const index=episode.nodes.findIndex(x=>x.id===n.id);if(index<0)episode.nodes.push(n);else episode.nodes[index]=n;}
 await p.evaluate(()=>{window.realResolvePlay=ZargotaEsterosResolve.play;});
 async function start(real=false){await p.evaluate(({e,choiceId,real})=>{
  ZargotaStoryPlayer.stop();e.intro={enabled:false};e.scenes=[];e.startSceneId=e.activeSceneId='';e.scene.story={};e.walkable=null;e.scene.tokens=[{id:'hero',x:50,y:50,size:80},{id:'point',type:'note',x:52,y:50,size:32}];e.heroTokenId='hero';e.interactions={point:{entryId:choiceId}};e.quests=[];e.storyItems=[];e.entryId=choiceId;e.testLocation=true;e.testDialogueId=choiceId;e.player.inventoryItems=[];
  e.nodes.forEach(n=>{n.textAnimation='none';n.typingSound='off';if(n.slides)n.slides.forEach(s=>s.textAnimation='none');});
  window.awards=[];window.completeAward=null;
  ZargotaEsterosResolve.play=real?realResolvePlay:(root,outcome,config,sound,done)=>{awards.push(outcome);completeAward=done;return ()=>{completeAward=null;};};
  ZargotaStoryPlayer.startTest(e,()=>{});
 },{e:episode,choiceId,real});await p.waitForFunction(id=>ZargotaStoryPlayer.getState().nodeId===id,choiceId);}
 const root=p.locator('#zg-story-player'),line=root.locator('.zg-story-line'),answers=root.locator('.zg-story-answers button');
 for(const [index,type,to,balance] of [[0,'fatalism',fatalId,2],[1,'hope',hopeId,4]]){
  await start();await answers.nth(index).click();await p.waitForFunction(()=>awards.length===1);
  assert.equal(await p.evaluate(()=>ZargotaStoryPlayer.getState().nodeId),choiceId,'follow-up is not entered before award finishes');
  assert(await root.locator('.zg-story-dialogue').isHidden());
  assert.deepEqual(await p.evaluate(()=>[awards[0].type,ZargotaStoryPlayer.getState().esterosResolve.hope]),[type,balance]);
  await p.evaluate(()=>completeAward());await p.waitForFunction(id=>ZargotaStoryPlayer.getState().nodeId===id,to);
  const node=fragment.nodes.find(n=>n.id===to);assert([node.text,node.textUk].includes(await line.textContent()));
  // Read all pages and return to the same choice; choosing the other side cannot farm a second reward.
  for(let i=0;i<3;i++)await p.keyboard.press('ArrowRight');
  await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='graph-mvo1gsmu-r6v6a');await p.keyboard.press('Space');
  await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-dialogue').hidden);
  await root.locator('[data-token-id=point]').click();await answers.nth(1-index).click();
  await p.waitForFunction(id=>ZargotaStoryPlayer.getState().nodeId===id,index?fatalId:hopeId);
  assert.equal(await p.evaluate(()=>awards.length),1,'choice reward is one-time across both branches');
 }
 await start(true);await answers.nth(1).click();await root.locator('.zg-esteros-resolve').waitFor();assert(await root.locator('.zg-story-dialogue').isHidden());await p.waitForFunction(id=>ZargotaStoryPlayer.getState().nodeId===id,hopeId,{timeout:25000});
 assert.equal(await root.locator('.zg-esteros-resolve').count(),0);await p.screenshot({path:'/private/tmp/esteros-shore-hope-followup.png'});
 await p.evaluate(()=>ZargotaStoryPlayer.stop());
 // The event is editable next to each individual answer.
 await p.evaluate(({e,choiceId})=>{e.activeSceneId=e.nodes.find(n=>n.id===choiceId).editorSceneId;const all=JSON.parse(localStorage.getItem('zargota_story_editor_v1')||'{}');all['choice-resolve-test']=e;localStorage.setItem('zargota_story_editor_v1',JSON.stringify(all));zgStoryEditorOpen('choice-resolve-test');}, {e:episode,choiceId});
 await p.locator('[data-workspace-tab=dialogues]').click();await p.locator(`[data-node-id="${choiceId}"]`).click();
 const selects=p.locator('.zg-graph-choice-editor select');await selects.first().waitFor({state:'attached'});assert.equal(await selects.count(),2);assert.equal(await selects.nth(0).inputValue(),'fatalism');assert.equal(await selects.nth(1).inputValue(),'hope');
 await p.locator('#zg-story-inspector .zg-inspector-tabs button').filter({hasText:/^(Связи|Зв’язки)$/}).click();await selects.nth(0).selectOption('hope');assert.equal(await selects.nth(0).inputValue(),'hope');assert.equal(await selects.nth(1).inputValue(),'hope');
 console.log('PASS Edge: both choices animate BEFORE their follow-up; balance and one-time reward; real animation completes; per-answer editor controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
