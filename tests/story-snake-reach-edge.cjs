const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1280,height:900}});await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));
 await p.waitForFunction(()=>window.ZargotaSnakeReach);
 assert(await p.evaluate(()=>ZargotaSnakeReach.path.slice(1).every((v,i)=>ZargotaSnakeReach.segmentSafe(ZargotaSnakeReach.path[i],v))));
 assert.equal(await p.evaluate(()=>ZargotaSnakeReach.segmentSafe(ZargotaSnakeReach.path[0],ZargotaSnakeReach.path.at(-1))),false);
 assert.equal(await p.evaluate(()=>ZargotaSnakeReach.handRadius),12);
 assert.equal(await p.evaluate(()=>ZargotaSnakeReach.safe([485,520])),false);
 const open=()=>p.evaluate(()=>{window.result=null;window.cleanup=ZargotaSnakeReach.open({},false,r=>window.result=r);});
 const at=async q=>{const box=await p.locator('.zg-snake-stage canvas').boundingBox();return {x:box.x+q[0]/1000*box.width,y:box.y+q[1]/562*box.height};};
 const pts=await p.evaluate(()=>ZargotaSnakeReach.path);
 await open();await p.screenshot({path:'output/esteros-snake-reach/mini-game.png'});
 let a=await at(pts[0]);await p.mouse.move(a.x,a.y);await p.mouse.down();for(const q of pts.slice(1)){a=await at(q);await p.mouse.move(a.x,a.y,{steps:12});}await p.mouse.up();await p.waitForFunction(()=>result==='success');
 await open();a=await at(pts[0]);await p.mouse.move(a.x,a.y);await p.mouse.down();a=await at([800,500]);await p.mouse.move(a.x,a.y);await p.mouse.up();await p.locator('.zg-snake-strike').waitFor();assert.equal(await p.locator('.zg-snake-reach.is-striking').count(),1);assert.equal(await p.locator('.zg-snake-bite-vignette:popover-open').count(),1);await p.waitForFunction(()=>document.querySelector('.zg-snake-strike').naturalWidth>0);await p.waitForTimeout(320);await p.screenshot({path:'output/esteros-snake-reach/strike.png'});await p.waitForFunction(()=>result==='failed');assert.equal(await p.locator('.zg-snake-reach.is-striking').count(),0);
 // Audio must be unlocked on a gesture; the held dot must actually drift.
 await p.evaluate(()=>{window.biteElement=null;window.localAudioErrors=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('snake-bite-01'))window.biteElement=this;return play.call(this);};const source=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(...args){localAudioErrors.push('Local audio routed through CORS-restricted Web Audio');return source.apply(this,args);};const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,...args){if(r===12)window.handPoint=[x,y];return arc.call(this,x,y,r,...args);};window.result=null;window.cleanup=ZargotaSnakeReach.open({},true,r=>window.result=r);});
 a=await at(pts[0]);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.waitForFunction(()=>Math.hypot(handPoint[0]-470,handPoint[1]-520)>2);assert.equal(await p.evaluate(()=>result),null);
 a=await at([800,500]);await p.mouse.move(a.x,a.y);await p.mouse.up();await p.waitForFunction(()=>biteElement.currentTime>0&&!biteElement.paused&&!biteElement.muted&&biteElement.volume>0);assert.equal(await p.evaluate(()=>biteElement.playbackRate),4);assert.equal(await p.evaluate(()=>biteElement.preservesPitch),true);assert.deepEqual(await p.evaluate(()=>localAudioErrors),[]);await p.waitForFunction(()=>result==='failed');
 await open();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>result),'aborted');
 await open();await p.evaluate(()=>cleanup());assert.equal(await p.locator('.zg-snake-reach').count(),0);assert.equal(await p.evaluate(()=>result),null);
 // Actual player integration: use a small isolated episode, preserve live editor storage.
 const fixture={title:'test',testDialogueId:'reach',intro:{enabled:false},heroTokenId:'hero',scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',x:20,y:50}]},minigames:{snakeReach:{enabled:true,startNodeId:'reach',successNodeId:'won',failureNodeId:'lost'}},nodes:[{id:'reach',text:'Start',links:[]},{id:'won',text:'Won',textUk:'Won',textSpeed:999,links:[]},{id:'lost',text:'Lost',textUk:'Lost',textSpeed:999,links:[]}]};
 await p.evaluate(f=>ZargotaStoryPlayer.start(f),fixture);await p.locator('.zg-snake-reach').waitFor();a=await at(pts[0]);await p.mouse.move(a.x,a.y);await p.mouse.down();a=await at([800,500]);await p.mouse.move(a.x,a.y);await p.mouse.up();await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-line').textContent==='Lost');await p.evaluate(()=>ZargotaStoryPlayer.stop());
 const e=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 assert.equal(e.nodes.find(n=>n.id==='food-snake-wait').links[0].to,e.minigames.snakeReach.startNodeId);
 assert.equal(e.nodes.find(n=>n.id===e.minigames.snakeReach.failureNodeId).resolveEvent.type,'fatalism');
 assert.equal(e.nodes.find(n=>n.id===e.minigames.snakeReach.failureNodeId).afterWorldActions,undefined);
 console.log('PASS path traversal, wall collision and scare, abort, cleanup, actual player failure routing, episode penalty/reward separation.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
