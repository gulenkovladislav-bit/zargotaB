const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://127.0.0.1:17349/**',r=>r.abort());
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{e.intro={enabled:false};e.startSceneId=e.activeSceneId='scene-esteros-food-channel';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;e.testLocation=true;e.testDialogueId='food-eggs-reach';e.nodes.forEach(n=>{n.textSpeed=100;(n.slides||[]).forEach(s=>s.textSpeed=100)});window.fixture=e;ZargotaStoryPlayer.start(e);},episode);
 const at=async q=>{const r=await p.locator('.zg-snake-stage canvas').boundingBox();return{x:r.x+q[0]/1000*r.width,y:r.y+q[1]/562*r.height};};
 let pos=await at([470,520]);await p.mouse.move(pos.x,pos.y);await p.mouse.down();pos=await at([800,500]);await p.mouse.move(pos.x,pos.y);await p.mouse.up();
 await p.locator('.zg-snake-strike').waitFor();const vignette=p.locator('.zg-snake-bite-vignette');await vignette.waitFor();
 assert(await vignette.evaluate(el=>el.matches(':popover-open')),'Bite overlay is in top layer above snake dialog');
 assert.equal(await vignette.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 fs.mkdirSync('output/esteros-bite-vignette-review',{recursive:true});await p.screenshot({path:'output/esteros-bite-vignette-review/impact.png'});
 await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-snake-fright');
 await p.waitForTimeout(2000);assert.equal(await p.locator('.zg-story-dialogue').isVisible(),true);assert((await vignette.evaluate(el=>Number(getComputedStyle(el).opacity)))>=.49);
 assert.equal((await p.evaluate(()=>ZargotaStoryPlayer.getState())).character.hp,8);
 await p.screenshot({path:'output/esteros-bite-vignette-review/dialogue.png'});
 await p.locator('#zg-story-player').focus();await p.keyboard.press('s');
 await p.locator('.zg-esteros-resolve').waitFor();const first=await vignette.evaluate(el=>Number(getComputedStyle(el).opacity));assert(first>.4);
 await p.waitForTimeout(4500);const later=await vignette.evaluate(el=>Number(getComputedStyle(el).opacity));assert(later>0&&later<first);
 await p.screenshot({path:'output/esteros-bite-vignette-review/resolve.png'});
 await vignette.waitFor({state:'detached',timeout:11000});
 await p.evaluate(()=>ZargotaStoryPlayer.stop());assert.equal(await vignette.count(),0);
 // Exiting during the retained injury effect must remove it immediately.
 await p.evaluate(()=>ZargotaStoryPlayer.start(fixture));pos=await at([470,520]);await p.mouse.move(pos.x,pos.y);await p.mouse.down();pos=await at([800,500]);await p.mouse.move(pos.x,pos.y);await p.mouse.up();await vignette.waitFor();await p.evaluate(()=>ZargotaStoryPlayer.stop());assert.equal(await vignette.count(),0);
 // Voluntary withdrawal never produces injury edges.
 await p.evaluate(()=>ZargotaStoryPlayer.start(fixture));await p.locator('.zg-snake-stage canvas').waitFor();await p.keyboard.press('Escape');assert.equal(await vignette.count(),0);
 assert.deepEqual(errors,[]);console.log('PASS Edge: red edges at strike; hold through dialogue; fade across resolve; no click blocking; stop cleanup; no injury on abort.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
