const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('console',m=>{if(m.text().includes('MediaElementAudioSource outputs zeroes'))errors.push(m.text());});
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(()=>{window.testMedia=[];const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);testMedia.push(a);return a;};window.mediaSources=0;const orig=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(...args){mediaSources++;return orig.apply(this,args);};});
 const ids=['scene-mvctoydb','scene-esteros-food-backwater','scene-esteros-food-roots','scene-esteros-food-channel'];
 await p.evaluate(({e,id})=>{e=structuredClone(e);e.intro={enabled:false};e.nodes=[];e.quests=[];e.testLocation=true;e.startSceneId=e.activeSceneId=id;e.scene=e.scenes.find(s=>s.id===id).scene;ZargotaStoryPlayer.start(e);},{e,id:ids[0]});
 await p.waitForFunction(()=>testMedia.some(a=>a.src.includes('the-last-of-us-main-menu')&&a.currentTime>0&&!a.paused));await p.evaluate(()=>window.musicProbe=testMedia.find(a=>a.src.includes('the-last-of-us-main-menu')));
 for(const id of ids.slice(1)){await p.evaluate(id=>new Promise(resolve=>ZargotaStoryPlayer.travel(id,resolve)),id);assert(await p.evaluate(()=>!musicProbe.paused&&musicProbe.currentTime>0));assert.equal(await p.evaluate(()=>testMedia.filter(a=>a.src.includes('the-last-of-us-main-menu')).length),1,'music must continue, not restart');}
 await p.evaluate(()=>ZargotaStoryPlayer.stop());
 const start=async()=>{await p.evaluate(e=>{e=structuredClone(e);e.intro={enabled:false};e.startSceneId=e.activeSceneId='scene-esteros-food-channel';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;e.testLocation=true;e.testDialogueId='food-eggs-reach';e.nodes.forEach(n=>{n.textSpeed=999;(n.slides||[]).forEach(s=>s.textSpeed=999)});window.biteResult=null;ZargotaStoryPlayer.start(e);},e);await p.locator('.zg-snake-stage canvas').waitFor();};
 const at=async q=>{const r=await p.locator('.zg-snake-stage canvas').boundingBox();return{x:r.x+q[0]/1000*r.width,y:r.y+q[1]/562*r.height};};
 await start();let pos=await at([470,520]);await p.mouse.move(pos.x,pos.y);await p.mouse.down();pos=await at([800,500]);await p.mouse.move(pos.x,pos.y);await p.mouse.up();
 await p.waitForFunction(()=>testMedia.some(a=>a.src.includes('snake-bite-01')&&!a.paused&&!a.muted&&a.currentTime>0&&a.volume>0&&a.readyState>=2));assert.equal(await p.evaluate(()=>mediaSources),0,'local snake audio must not route through a CORS-muted media source');
 await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-snake-fright');let st=await p.evaluate(()=>ZargotaStoryPlayer.getState());assert.equal(st.character.hp,8);assert(st.flags['esteros-snake-bitten']);assert(!st.flags['esteros-food-eggs-taken']);assert(!st.flags['esteros-snake-eggs-won']);
 fs.mkdirSync('output/esteros-scene-review',{recursive:true});
 for(let i=0;i<3;i++){
  await p.locator('.zg-story-line').click();
  const portrait=await p.locator('.zg-story-speaker-portrait').evaluate(el=>({src:decodeURIComponent(el.src),loaded:el.complete&&el.naturalWidth>0}));
  assert(portrait.loaded);assert(portrait.src.includes(['21_24_22 (5)','21_24_21 (3)','21_24_21 (4)'][i]),JSON.stringify(portrait));
  await p.screenshot({path:'output/esteros-scene-review/bite-consequence-page'+(i+1)+'.png'});
  if(i<2)await p.locator('.zg-dialogue-page-nav button').nth(1).click();
 }

 // Close all pages and the resolve animation through the normal dialogue controls.
 await p.locator('#zg-story-player').focus();for(let i=0;i<4;i++){await p.keyboard.press('s');await p.keyboard.press('Space');await p.waitForTimeout(100);}
 await p.waitForFunction(()=>document.querySelector('#zg-story-player .zg-story-dialogue').hidden,{},{timeout:20000});
 await p.locator('.zg-esteros-resolve').waitFor({state:'hidden',timeout:20000});await p.locator('[data-token-id="food-point-nest"]').click();await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-nest-bitten');assert.equal(await p.locator('.zg-snake-reach').count(),0);assert.equal((await p.evaluate(()=>ZargotaStoryPlayer.getState())).character.hp,8,'revisit must not apply damage');
 await p.evaluate(()=>ZargotaStoryPlayer.stop());await start();await p.keyboard.press('Escape');await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-leave');st=await p.evaluate(()=>ZargotaStoryPlayer.getState());assert.equal(st.character.hp,10);assert(!st.flags['esteros-snake-bitten']);
 await p.evaluate(()=>ZargotaStoryPlayer.stop());await start();pos=await at([470,520]);await p.mouse.move(pos.x,pos.y);await p.mouse.down();for(const q of await p.evaluate(()=>ZargotaSnakeReach.path.slice(1))){pos=await at(q);await p.mouse.move(pos.x,pos.y,{steps:8});}await p.mouse.up();await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='food-eggs-take');st=await p.evaluate(()=>ZargotaStoryPlayer.getState());assert.equal(st.character.hp,10);assert(st.flags['esteros-snake-eggs-won']);assert(!st.flags['esteros-snake-bitten']);
 assert.deepEqual(errors,[]);console.log('PASS actual episode: uninterrupted music across four scenes; native local bite audio playing unmuted; failure 10→8 HP and wound flag; revisit no new penalty; abort/success no wound.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
