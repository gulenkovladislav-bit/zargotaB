const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const path=process.argv[2]||'/private/tmp/episode-mutloww8-sapc-exchange-fixed.json';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const page=await browser.newPage({viewport:{width:1440,height:950}});page.setDefaultTimeout(20000);
 await page.goto('http://127.0.0.1:5184/index.html?lookout-demo=1');await page.waitForFunction(()=>window.ZargotaStoryPlayer);
 const data=JSON.parse(fs.readFileSync(path)).episode;
 await page.evaluate(data=>{ZargotaStoryPlayer.stop();const yard='scene-evan-green-courtyard';data.startSceneId=data.activeSceneId=yard;data.scene=data.scenes.find(r=>r.id===yard).scene;data.initialQuestId='evan-yard-meet-quest';data.testLocation=true;data.testDialogueId='evan-exchange-leave';data.intro={enabled:false};data.scenes.forEach(r=>{if(r.scene.story)r.scene.story.cameraZoom=1;});data.player=data.player||{};data.player.inventoryItems=[];ZargotaStoryItems.give(data.player,ZargotaStoryItems.list(data).find(i=>i.itemId==='evan-silver-coin'),2);ZargotaStoryPlayer.startTest(data);},data);
 await page.locator('.zg-story-line').click();await page.getByRole('button',{name:/Пойду искать размен|Піду шукати розмін/}).click();
 await page.locator('[data-token-id="evan-green-exit"]').click();
 await page.waitForFunction(()=>ZargotaStoryPlayer.getState()?.sceneId==='scene-mu7f8tk1-6m4a');await page.waitForSelector('.zg-story-scene-fade',{state:'detached'});
 let state=await page.evaluate(()=>ZargotaStoryPlayer.getState());assert.deepEqual(state.position,{x:72,y:40});assert.equal(state.quests.done.includes('evan-walk-quest'),false);
 assert.match(await page.locator('[data-play-title]').innerText(),/Разменять серебро|Розміняти срібло/);
 const gate=page.locator('[data-zone-id="evan-green-entrance"]');await gate.click();await page.waitForFunction(()=>ZargotaStoryPlayer.getState()?.sceneId==='scene-evan-green-courtyard');await page.waitForSelector('.zg-story-scene-fade',{state:'detached'});
 state=await page.evaluate(()=>ZargotaStoryPlayer.getState());assert.deepEqual(state.position,{x:47,y:75});assert.match(await page.locator('[data-play-title]').innerText(),/Свои во дворе|Свої у дворі/);
 await page.locator('[data-token-id="evan-green-exit"]').click();await page.waitForFunction(()=>ZargotaStoryPlayer.getState()?.sceneId==='scene-mu7f8tk1-6m4a');await page.waitForSelector('.zg-story-scene-fade',{state:'detached'});
 const porter=data.scenes.find(r=>r.id==='scene-mu7f8tk1-6m4a').scene.tokens.find(t=>t.entryId==='evan-exchange-porter'||data.interactions?.[t.id]?.entryId==='evan-exchange-porter');assert(porter);
 await page.waitForFunction(id=>{const r=document.querySelector('[data-token-id="'+id+'"]').getBoundingClientRect();return r.x>50&&r.right<innerWidth-50&&r.y>0&&r.bottom<innerHeight;},porter.id,{timeout:60000});const npc=await page.locator('[data-token-id="'+porter.id+'"]').boundingBox();await page.mouse.click(npc.x+npc.width/2,npc.y+npc.height/2);await page.waitForSelector('.zg-story-dialogue:not([hidden])');
 await page.locator('.zg-story-line').click();await page.keyboard.press('ArrowRight');await page.locator('.zg-story-line').click();
 await page.getByRole('button',{name:/серебро 1 → медь 10|срібло 1 → мідь 10/}).click();
 await page.locator('.zg-story-line').click();await page.keyboard.press('ArrowRight');await page.locator('.zg-story-line').click();await page.getByRole('button',{name:/Завершить разговор|Завершити розмову/}).click();
 state=await page.evaluate(()=>ZargotaStoryPlayer.getState());assert.equal(state.character.inventoryItems.find(i=>i.itemId==='evan-copper-coin').qty,10);assert.equal(state.character.inventoryItems.find(i=>i.itemId==='evan-silver-coin').qty,1);
 // Walk along the street before approaching the gate, avoiding the authored fence contour.
 const world=await page.locator('[data-play-world]').boundingBox();await page.mouse.click(world.x+world.width*.72,world.y+world.height*.42);await page.waitForFunction(()=>Math.abs(ZargotaStoryPlayer.getState().position.x-72)<1,{},{timeout:20000});
 await gate.click();await page.waitForFunction(()=>ZargotaStoryPlayer.getState()?.sceneId==='scene-evan-green-courtyard');
 state=await page.evaluate(()=>ZargotaStoryPlayer.getState());assert.equal(state.character.inventoryItems.find(i=>i.itemId==='evan-copper-coin').qty,10);assert.equal(state.flags['evan-exchange-errand'],true);
 console.log('PASS Edge supplied episode: gate arrival, return before exchange with unmet walk quest, contextual objective, 1 silver -> 10 copper, return after exchange and preserved progress.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
