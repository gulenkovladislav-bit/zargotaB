const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('file://'+path.resolve('index.html'));
  await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
  await p.evaluate(e=>{
   e.intro.enabled=false;e.startSceneId=e.activeSceneId='scene-esteros-food-roots';e.testLocation=true;e.testDialogueId='';
   e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;e.scene.story.onEnter='';
   ZargotaStoryPlayer.start(e);
   const Native=window.Audio;window.resolveAudio=[];window.Audio=function(...args){const a=new Native(...args);resolveAudio.push(a);return a;};
  },episode);
  const start=async(type,sound=true)=>{
   await p.evaluate(({type,sound})=>{
    window.finishCount=0;window.stopResolve=ZargotaEsterosResolve.play(document.querySelector('#zg-story-player'),{type,from:3,to:type==='hope'?4:2,direction:type==='hope'?1:-1},{hitTime:4.27},sound,()=>finishCount++);
    window.bow=resolveAudio.at(-1);
   },{type,sound});
   if(sound){await p.waitForFunction(()=>bow.currentTime>0);await p.evaluate(()=>bow.pause());}
  };
  const sample=async time=>{
   await p.evaluate(t=>{bow.currentTime=t;},time);await p.waitForTimeout(600);
   return p.evaluate(()=>{
    const root=document.querySelector('#zg-story-player'),scene=root.querySelector('.zg-esteros-resolve');
    const opacity=s=>Number(getComputedStyle(root.querySelector(s)).opacity);
    return {volume:bow.volume,neutral:opacity('.resolve-edge-neutral'),choice:opacity('.resolve-edge-choice'),color:scene.querySelector('.resolve-edge-choice').style.getPropertyValue('--resolve-edge-color'),award:opacity('.award'),quest:opacity('.zg-story-quest'),tools:opacity('.zg-story-play-tools'),health:opacity('.zg-story-health'),inert:root.querySelector('.zg-story-play-tools').inert,stroke:getComputedStyle(scene.querySelector('.award strong')).webkitTextStrokeWidth,strokeColor:getComputedStyle(scene.querySelector('.award strong')).webkitTextStrokeColor,fill:getComputedStyle(scene.querySelector('.award strong')).color};
   });
  };
  fs.mkdirSync('output/esteros-resolve-review',{recursive:true});
  for(const type of ['hope','fatalism']){
   await start(type);
   let v=await sample(0);assert.equal(v.volume,0);assert.equal(v.neutral,0);
   v=await sample(.75);assert(Math.abs(v.volume-.2625)<.001);assert.equal(v.award,0);assert.equal(v.choice,0);
   v=await sample(2);assert.equal(v.volume,.525);assert.equal(v.neutral,1);assert.equal(v.choice,0);assert.equal(v.award,0);
   assert.equal(v.quest,0,JSON.stringify(v));assert.equal(v.tools,0);assert.equal(v.health,0);assert(v.inert);
   v=await sample(4.26);assert.equal(v.award,0);assert.equal(v.choice,0);
   v=await sample(4.8);assert.equal(v.award,1);assert.equal(v.choice,1);assert.equal(v.neutral,0);assert.equal(v.color,type==='hope'?'245,225,180':'125,23,30');
   if(type==='fatalism'){assert.equal(v.stroke,'2px');assert.equal(v.strokeColor,'rgb(0, 0, 0)');assert.equal(v.fill,'rgb(128, 0, 32)');}
   await p.screenshot({path:`output/esteros-resolve-review/${type}.png`});
   if(type==='fatalism'){
    await sample(7);
    assert.equal(await p.locator('.zg-esteros-resolve .label.fatal').evaluate(el=>getComputedStyle(el).webkitTextStrokeWidth),'1.5px');
    await p.screenshot({path:'output/esteros-resolve-review/fatalism-upper-label.png'});
   }
   const duration=await p.evaluate(()=>bow.duration),rate=await p.evaluate(()=>bow.playbackRate);
   v=await sample(duration-.5*rate);assert(Math.abs(v.volume-.2625)<.001,'keep the existing final-second fade');
   await p.evaluate(()=>stopResolve());
   assert.equal(await p.locator('.zg-esteros-resolve').count(),0);
   assert.equal(await p.locator('.is-resolve-focus').count(),0);
   assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.zg-story-play-tools')).opacity),'1');
   assert.equal(await p.evaluate(()=>document.querySelector('.zg-story-play-tools').inert),false);
  }
  // With audio disabled, the visual clock and cancellation still work.
  await start('hope',false);await p.waitForTimeout(150);
  assert(await p.evaluate(()=>bow.paused));
  assert(await p.evaluate(()=>Number(document.querySelector('.resolve-edge-neutral').style.opacity)>0));
  await p.evaluate(()=>stopResolve());
  // Natural completion restores the UI once, without requiring cancellation.
  await start('hope');await p.evaluate(()=>{bow.currentTime=bow.duration-.05;bow.play();});
  await p.locator('.zg-esteros-resolve').waitFor({state:'hidden',timeout:5000});
  assert.equal(await p.evaluate(()=>finishCount),1);
  await p.waitForFunction(()=>getComputedStyle(document.querySelector('.zg-story-health')).opacity==='1',{},{timeout:1500});
  assert.equal(await p.evaluate(()=>document.querySelector('.zg-story-play-tools').inert),false);
  assert.equal(await p.locator('.is-resolve-focus').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS Edge: both tones, 25% quieter audio, 1.5s fade-in, strike at 4.27s, neutral-to-choice vignette, HUD hidden and restored, flat black fatalism outline, end fade, sound-off, cancellation and completion.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
