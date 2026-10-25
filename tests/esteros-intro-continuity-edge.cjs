const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 async function start(skip){await p.evaluate(e=>{ZargotaStoryPlayer.stop();window.media=[];if(!window.NativeAudio)window.NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);media.push(a);return a;};e.startSceneId=e.activeSceneId=e.intro.sceneId;e.scene=e.scenes.find(s=>s.id===e.startSceneId).scene;delete e.testDialogueId;delete e.testPreparedState;e.testLocation=false;ZargotaStoryPlayer.start(e);window.introImage=document.querySelector('.zg-intro-dialogue-image');window.handoffFrames=[];window.monitor=true;function capture(){if(!monitor)return;const intro=document.querySelector('.zg-episode-intro'),view=document.querySelector('.zg-story-inspection');if(!intro&&view&&!view.hidden)handoffFrames.push({opacity:getComputedStyle(view).opacity,animation:getComputedStyle(view).animationName,loaded:view.querySelector('img').complete&&view.querySelector('img').naturalWidth>0,same:view.querySelector('img')===introImage});requestAnimationFrame(capture);}capture();},episode);
  const button=p.locator('.zg-intro-start');if(await button.count())await button.click();
  await p.waitForFunction(()=>media.some(a=>a.src.includes('the-last-of-us-main-menu')&&!a.paused&&a.currentTime>0&&a.currentTime<5&&a.volume>0),{},{timeout:5000});
  assert.equal(await p.locator('.zg-episode-intro').count(),1,'music is playing during the titles');
  await p.waitForFunction(()=>media.some(a=>a.src.includes('shore-water-soft')&&!a.paused&&a.currentTime>0));
  const water=await p.evaluate(()=>media.find(a=>a.src.includes('shore-water-soft')&&!a.paused).volume);assert(Math.abs(water-.054)<.00001);
  if(skip)await p.locator('.zg-intro-skip').click();
  await p.locator('.zg-episode-intro').waitFor({state:'detached',timeout:30000});await p.waitForFunction(()=>handoffFrames.length>=30);
  const frames=await p.evaluate(()=>{monitor=false;return handoffFrames;});assert(frames.every(f=>f.opacity==='1'&&f.animation==='none'&&f.loaded&&f.same),JSON.stringify(frames));
  assert.equal(await p.evaluate(()=>ZargotaStoryPlayer.getState().nodeId),'dialog-1');assert(await p.locator('.zg-story-dialogue').isVisible());
  assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('the-last-of-us-main-menu')&&!a.paused).length),1,'no music restart or duplicate');
 }
 await start(false);fs.mkdirSync('output/esteros-intro-review',{recursive:true});await p.screenshot({path:'output/esteros-intro-review/river-handoff.png'});await start(true);
 // Every water frame stays below the unchanged vignette, including mid-crossfade.
 const vignette=()=>p.evaluate(()=>{const view=document.querySelector('.zg-story-inspection'),v=getComputedStyle(view,'::after');return{z:Number(v.zIndex),opacity:v.opacity,gradient:v.backgroundImage,frames:[...view.querySelectorAll('img')].map(el=>Number(getComputedStyle(el).zIndex)||0)};});
 const first=await vignette();assert.equal(first.opacity,'1');assert(first.frames.every(z=>z<first.z));assert(first.gradient.includes('radial-gradient'));
 await p.waitForTimeout(4200);const next=await vignette();assert(next.frames.some(z=>z===2),'check while incoming water frame is on top');assert(next.frames.every(z=>z<next.z));assert.equal(next.gradient,first.gradient);
 await p.screenshot({path:'output/esteros-intro-review/river-vignette.png'});
 await p.locator('.zg-dialogue-page-nav button').nth(1).click();assert.equal((await vignette()).gradient,first.gradient);

 assert.deepEqual(errors,[]);console.log('PASS Edge: actual intro natural/skip, same loaded image reused, 30+ frames fully opaque, no map flash, music audible-level playback during titles, quieter shore water and single music track.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
