const {chromium}=require('playwright'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:5184/index.html?lookout-demo=1');
  await page.waitForFunction(()=>window.ZargotaStoryTestEntry&&window.zgStoryEditorOpen);
  const source=fs.readFileSync('tests/story-test-entry.test.cjs','utf8');
  const fixture=vm.runInNewContext('('+source.split('const data=')[1].split('\nconst api=')[0].replace(/;\s*$/,'')+')');
  const before=await page.evaluate(fixture=>{
   ZargotaStoryPlayer.stop();
   const project=JSON.parse(JSON.stringify(ZargotaStoryCampaign));Object.assign(project,fixture);
   project.scenes=[project.scenes[2],project.scenes[0],project.scenes[1]];
   project.nodes.forEach(n=>n.editorSceneId=n.id==='target-node'?'target':'start');
   project.storyItems.push({itemId:'alternative',stackable:false});
   project.nodes.find(n=>n.id==='bad').beforeWorldActions=[{type:'giveItem',itemId:'alternative',qty:1}];
   project.heroTokenId='hero';project.player.inventoryItems=[];
   project.scenes.forEach(r=>{r.scene.boardWidth=24;r.scene.boardHeight=16;r.scene.layers=[];r.scene.tokens.push({id:'hero',x:50,y:50,type:'hero',name:'Герой',nameUk:'Герой'});});
   project.scene=project.scenes.find(r=>r.id==='target').scene;
   const all=JSON.parse(localStorage.getItem('zargota_story_editor_v1')||'{}');all['test-entry-route']=project;localStorage.setItem('zargota_story_editor_v1',JSON.stringify(all));zgStoryEditorOpen('test-entry-route');
   return JSON.stringify(zgStoryEditorProject());
  },fixture);
  await page.getByRole('button',{name:/Зайти на локац/,exact:false}).click();
  const dialog=page.locator('dialog.zg-custom-menu');await dialog.waitFor();
  assert.equal(await dialog.locator('input[type=checkbox]').isChecked(),true);
  await dialog.getByRole('button',{name:/Зайти на локац/}).click();
  await page.waitForFunction(()=>ZargotaStoryPlayer.getState()?.flags.ready);
  const state=await page.evaluate(()=>ZargotaStoryPlayer.getState());
  assert.equal(state.sceneId,'target');assert.equal(state.flags.yes,true);assert.equal(state.flags.no,true);assert.deepEqual(state.quests.done,['q1']);assert.deepEqual(state.character.inventoryItems.map(i=>i.itemId).sort(),['alternative','key']);assert.equal(state.flags['target-completed'],undefined);
  await page.locator('[data-test-tools]>summary').click();
  await page.getByRole('button',{name:/Сбросить весь тест|Скинути весь тест/}).click();
  assert.deepEqual((await page.evaluate(()=>ZargotaStoryPlayer.getState())).quests.done,['q1']);
  await page.evaluate(()=>{ZargotaStoryPlayer.stop();zgStoryEditorOpen('test-entry-route');});
  assert.equal(await page.evaluate(()=>JSON.stringify(zgStoryEditorProject())),before);
  await page.getByRole('button',{name:/Зайти на локац/}).click();await dialog.locator('input[type=checkbox]').uncheck();await dialog.getByRole('button',{name:/Зайти на локац/}).click();
  const manual=await page.evaluate(()=>ZargotaStoryPlayer.getState());assert.deepEqual(manual.quests.done,[]);assert.deepEqual(manual.flags,{});assert.equal(manual.character.inventoryItems.length,0);
  await page.screenshot({path:'/private/tmp/zargota-test-entry-edge.png'});
  console.log('PASS Microsoft Edge: editor entry, all alternative items and prior quests, reset, unchanged episode, explicit manual entry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
