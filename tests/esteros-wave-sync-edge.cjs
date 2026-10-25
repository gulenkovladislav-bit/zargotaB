const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('http://127.0.0.1:17349/**',r=>r.abort());
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{window.media=[];window.cues=[];const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);a.createdSource=String(args[0]||'');a.pauseCount=0;a.addEventListener('pause',()=>a.pauseCount++);media.push(a);return a;};document.addEventListener('zg-image-sequence-frame',e=>cues.push({time:performance.now(),index:e.detail.index}));const start=document.createElement('button');start.id='real-start';start.textContent='Start';start.style.cssText='position:fixed;left:20px;top:20px;z-index:2147483647';start.onclick=()=>{start.remove();ZargotaStoryPlayer.start(e);};document.body.append(start);},e);
 await p.locator('#real-start').click();await p.waitForFunction(()=>media.some(a=>a.src.includes('shore-water-soft')&&!a.paused&&a.currentTime>.1));
 await p.evaluate(()=>{window.bed=media.find(a=>a.src.includes('shore-water-soft'));window.music=media.find(a=>a.src.includes('main-menu'));});
 assert(Math.abs(await p.evaluate(()=>bed.volume)-.024)<1e-6);assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-wave-short')).length),0,'No accent during titles');
 await p.waitForFunction(()=>document.querySelector('.zg-episode-intro')===null,{},{timeout:26000});
 await p.waitForFunction(()=>media.some(a=>a.src.includes('shore-wave-short')&&!a.paused&&a.currentTime>.05));
 const cue=await p.evaluate(()=>{const a=media.find(a=>a.src.includes('shore-wave-short'));return{duration:a.duration,loop:a.loop,rate:a.playbackRate,volume:a.volume};});
 assert.equal(cue.duration,2.6);assert.equal(cue.loop,false);assert.equal(cue.rate,1);assert(cue.volume<=.036001);
 assert.equal(await p.evaluate(()=>bed.pauseCount),0);assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-water-soft')).length),1);assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-water-synced')).length),0);
 // Reading the next page must not retrigger the wave or restart the continuous bed.
 await p.locator('.zg-dialogue-page-nav button').nth(1).click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>cues.length),1);
 await p.waitForFunction(()=>cues.some(c=>c.index===2),{},{timeout:11000});
 const events=await p.evaluate(()=>cues);assert(events[1].time-events[0].time>=2900);assert(events[2].time-events[0].time>=8900);
 await p.waitForFunction(()=>media.filter(a=>a.createdSource.includes('shore-wave-short')).length===2);
 assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-wave-short')&&!a.paused).length),1,'No overlapping wave accents');
 const volume=await p.evaluate(()=>bed.volume),musicBefore=await p.evaluate(()=>music.currentTime);
 await p.locator('#zg-story-player').focus();await p.keyboard.press('s');await p.waitForFunction(()=>document.querySelector('.zg-story-inspection').hidden);await p.waitForTimeout(350);
 assert.equal(await p.evaluate(()=>bed.pauseCount),0,'Background never pauses across intro/dialogue/location');assert.equal(await p.evaluate(()=>bed.volume),volume,'No gain jump on dialogue exit');assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-water-soft')).length),1);assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('shore-wave-short')&&!a.paused).length),0);
 assert(await p.evaluate(()=>music.currentTime)>musicBefore);assert.equal(await p.evaluate(()=>media.filter(a=>a.src.includes('main-menu')).length),1);
 await p.evaluate(()=>ZargotaStoryPlayer.stop());assert.deepEqual(errors,[]);
 console.log('PASS Edge: one continuous 0.024-gain water bed through full intro, dialogue and location; 2.6s accents only on wash frames at normal speed; no restart or gain jump; exit fades accent; unchanged music continuity.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
