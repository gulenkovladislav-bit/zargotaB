const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});
 await p.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
 await p.evaluate(()=>ZargotaStoryPlayer.start({title:'test',intro:{enabled:false},heroTokenId:'hero',activeSceneId:'s',entryId:'talk',scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',name:'Hero',x:20,y:50},{id:'brother',name:'Brother',x:40,y:50,entryId:'talk'}],story:{movementSpeed:3}},nodes:[{id:'talk',kind:'dialogue',text:'Done',textUk:'Готово',links:[]}],quests:[{id:'q',title:'Quest',titleUk:'Завдання',dialogueId:'talk',objective:'test',objectiveUk:'тест'}],initialQuestId:'q'}));
 await p.evaluate(()=>{ /* Configure a quest reward on a fresh isolated fixture. */ ZargotaStoryPlayer.stop(); });
 await p.evaluate(()=>ZargotaStoryPlayer.start({title:'test',intro:{enabled:false},heroTokenId:'hero',activeSceneId:'s',entryId:'talk',scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',name:'Hero',x:20,y:50},{id:'brother',name:'Brother',x:40,y:50,entryId:'talk'}],story:{movementSpeed:3}},nodes:[{id:'talk',kind:'dialogue',text:'Done',textUk:'Готово',links:[]}],quests:[{id:'q',title:'Quest',titleUk:'Завдання',dialogueId:'talk',actions:[{type:'spawn',kind:'tokens',sceneId:'s',id:'reward',object:{type:'note',x:50,y:50,size:64,markerVisible:true}}]}],initialQuestId:'q'}));
 await p.locator('[data-token-id="brother"]').click();
 await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-line').textContent==='Done');
 const before=await p.locator('[data-token-id="hero"]').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));assert(before.x>20);
 await p.locator('#zg-story-player .zg-story-answers button').first().click();
 await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-dialogue').hidden);
 const after=await p.locator('[data-token-id="hero"]').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));assert.deepEqual(after,before);
 const mark=p.locator('[data-token-id="reward"] .zg-story-interaction');assert.equal(await mark.count(),1);assert.equal(await mark.innerText(),'?');assert.equal(await mark.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(16, 25, 21)');assert.equal(await mark.evaluate(el=>getComputedStyle(el).opacity),'1');
 await p.evaluate(()=>ZargotaStoryPlayer.start({intro:{enabled:false},heroTokenId:'hero',activeSceneId:'s',scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',x:20,y:50}],story:{zones:[{id:'rock',x:70,y:50,radius:10,blocked:true,blockedMessage:'Rock blocks the path'}]}},nodes:[]}));
 const box=await p.locator('[data-play-world]').boundingBox();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.5);await p.waitForFunction(()=>document.querySelector('.zg-gold-cursor').dataset.mode==='unknown');await p.mouse.click(box.x+box.width*.7,box.y+box.height*.5);assert.equal(await p.locator('[data-play-hint]').innerText(),'Rock blocks the path');await p.waitForFunction(()=>document.querySelector('.zg-gold-cursor').dataset.mode==='blocked');
 console.log('PASS actual player: position, quest marker, first blocked click displays message and updates cursor');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
