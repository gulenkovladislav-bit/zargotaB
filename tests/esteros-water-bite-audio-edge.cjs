const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('MediaElementAudioSource outputs zeroes'))errors.push(m.text());});
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(()=>{window.testMedia=[];const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);testMedia.push(a);a.addEventListener('playing',()=>{if(!a.muted)a.audibleStart=performance.now();});return a;};});
 async function start(id,intro){await p.evaluate(({e,id,intro})=>{ZargotaStoryPlayer.stop();testMedia=[];e.startSceneId=e.activeSceneId=id;e.scene=e.scenes.find(r=>r.id===id).scene;e.testLocation=true;e.testDialogueId='';e.intro.enabled=intro;if(!intro)e.scene.story.firstVisitDialogueId='';ZargotaStoryPlayer.start(e);}, {e,id,intro});}
 async function water(){await p.waitForFunction(()=>testMedia.some(a=>a.src.includes('shore-water-soft-loop')&&!a.paused&&!a.muted&&a.currentTime>.1&&a.volume>0&&a.readyState>=2));return p.evaluate(()=>testMedia.filter(a=>a.src.includes('shore-water-soft-loop')&&!a.paused).map(a=>({volume:a.volume,loop:a.loop,error:a.error&&a.error.code})));}
 await start('scene-mvctoydb',true);if(await p.locator('.zg-intro-start').count())await p.locator('.zg-intro-start').click();else await p.locator('.zg-episode-intro').click({position:{x:10,y:10}});
 let a=await water();assert.equal(a.length,1);assert(a[0].loop);assert(!a[0].error);
 await p.evaluate(()=>window.introWater=testMedia.find(a=>a.src.includes('shore-water-soft-loop')&&!a.paused));
 await p.locator('.zg-intro-skip').click();await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='dialog-1');
 assert(await p.evaluate(()=>!introWater.paused&&introWater.currentTime>0),'river monologue keeps the same water track');
 for(const id of ['scene-mvctoydb','scene-esteros-food-backwater','scene-esteros-food-roots','scene-esteros-food-channel']){
  await start(id,false);await p.locator('.zg-story-health').click();a=await water();assert.equal(a.length,1);assert(a[0].volume>0&&a[0].volume<=.073,JSON.stringify(a));assert(a[0].loop);
  assert(await p.evaluate(()=>testMedia.some(a=>a.src.includes('the-last-of-us')&&!a.paused&&a.volume>0)),'water must coexist with music');
 }
 await p.evaluate(cfg=>{window.strikeInfo=null;window.result=null;new MutationObserver(()=>{if(!strikeInfo&&document.querySelector('.zg-snake-strike')){const a=testMedia.findLast(a=>a.src.includes('snake-bite'));strikeInfo={delta:performance.now()-a.audibleStart,current:a.currentTime,volume:a.volume,muted:a.muted,paused:a.paused};}}).observe(document.body,{childList:true,subtree:true});window.stopSnake=ZargotaSnakeReach.open(cfg,true,r=>result=r);},e.minigames.snakeReach);
 const box=await p.locator('.zg-snake-stage canvas').boundingBox();const point=(x,y)=>({x:box.x+x/1000*box.width,y:box.y+y/562*box.height});
 let q=point(470,520);await p.mouse.move(q.x,q.y);await p.mouse.down();await p.waitForTimeout(120);q=point(800,500);await p.mouse.move(q.x,q.y);await p.mouse.up();
 await p.waitForFunction(()=>strikeInfo!==null);const s=await p.evaluate(()=>strikeInfo);assert(s.delta>=0&&s.delta<85,JSON.stringify(s));assert(!s.muted&&!s.paused&&s.volume>0);assert(s.current<.2);
 await p.waitForFunction(()=>result==='failed');assert.equal(await p.locator('.zg-snake-reach').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS Edge: water during intro, river dialogue and all four locations; music retained; snake sound and lunge start within '+s.delta.toFixed(1)+' ms; no local CORS audio silence.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
