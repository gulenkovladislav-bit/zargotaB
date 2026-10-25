const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/esteros/episode-1-food-search-v1.json')).episode;
 async function start(dialogue){await p.evaluate(({e,dialogue})=>{ZargotaStoryPlayer.stop();e.intro.enabled=false;e.startSceneId=e.activeSceneId='scene-esteros-food-channel';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;e.scene.story.firstVisitDialogueId='';e.testLocation=true;e.testDialogueId=dialogue||'';ZargotaStoryPlayer.start(e);},{e,dialogue});}
 const transform=()=>p.locator('[data-play-world]').evaluate(el=>el.style.transform);
 const hero=()=>p.evaluate(()=>ZargotaStoryPlayer.getState().position);
 await start();assert.equal(e.scenes.find(s=>s.id==='scene-esteros-food-channel').scene.story.cameraZoom,1,'reproduce authored cover/100%');
 const position=await hero();await p.mouse.move(700,350);await p.mouse.wheel(0,-300);await p.waitForTimeout(80);const upper=await transform();
 await p.mouse.wheel(0,600);await p.waitForTimeout(80);const lower=await transform();assert.notEqual(upper,lower,'wheel must pan cropped 100% cover');
 await p.mouse.down({button:'middle'});await p.mouse.move(700,500,{steps:6});await p.mouse.up({button:'middle'});assert.notEqual(await transform(),lower,'middle drag must pan cropped 100% cover');assert.deepEqual(await hero(),position,'camera movement must not move character');
 const rect=await p.locator('[data-play-world]').boundingBox();assert(rect.y<=.5&&rect.y+rect.height>=899.5,'camera remains within image');
 fs.mkdirSync('output/esteros-repair-review',{recursive:true});await p.screenshot({path:'output/esteros-repair-review/camera-after-pan.png'});
 await start('food-nest');const locked=await transform();await p.mouse.move(700,350);await p.mouse.wheel(0,600);await p.mouse.down({button:'middle'});await p.mouse.move(700,500);await p.mouse.up({button:'middle'});await p.waitForTimeout(80);assert.equal(await transform(),locked,'dialogue locks camera');
 assert.deepEqual(errors,[]);console.log('PASS Edge: actual channel at cover/100%, wheel and middle drag, hero unchanged, bounded camera, dialogue guard.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
