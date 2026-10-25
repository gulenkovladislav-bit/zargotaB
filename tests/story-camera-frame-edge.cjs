const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});await p.goto('file://'+path.resolve('index.html'));await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const raw=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 const source=raw.scenes.find(r=>r.id==='scene-esteros-food-channel');
 await p.evaluate(({raw,source})=>{window.fixture=structuredClone(raw);fixture.scene=structuredClone(source.scene);fixture.scene.tokens.find(t=>t.id===fixture.heroTokenId).size=128;fixture.scene.story.firstVisitDialogueId='';fixture.scene.story.ambience='';fixture.scene.story.music='';fixture.activeSceneId=source.id;fixture.startSceneId=source.id;fixture.intro={enabled:false};fixture.testLocation=true;fixture.nodes=[];fixture.quests=[];
 window.openFixture=()=>{ZargotaStoryStageEditor.open(fixture,fn=>fn(fixture),[]);let host=document.getElementById('zg-story-editor');if(!host){host=document.createElement('div');host.id='zg-story-editor';document.body.appendChild(host);}host.style.display='';host.classList.add('open');host.replaceChildren(document.getElementById('zg-story-stage-settings'));const stage=document.getElementById('zg-story-stage-settings');stage.style.cssText='display:block;position:fixed;inset:0;width:100vw;height:100vh';};openFixture();},{raw,source});
 for(const size of [{width:1440,height:900},{width:1100,height:900}]){await p.setViewportSize(size);
 for(const fit of ['contain','cover'])for(const y of [null,25,70]){
 await p.evaluate(({fit,y})=>{ZargotaStoryPlayer.stop();fixture.scene.story.cameraFit=fit;fixture.scene.story.cameraZoom=1.35;if(y===null)delete fixture.scene.story.cameraCenterY;else fixture.scene.story.cameraCenterY=y;openFixture();},{fit,y});
 await p.waitForTimeout(180);
 await p.locator('select[aria-label="Заполнение экрана игрока"],select[aria-label="Заповнення екрана гравця"]').selectOption(fit==='cover'?'contain':'cover');
 await p.locator('select[aria-label="Заполнение экрана игрока"],select[aria-label="Заповнення екрана гравця"]').selectOption(fit);
 assert.equal(await p.evaluate(()=>fixture.scene.story.cameraFit),fit);
 // Exercise actual controls, including quiet save and rerender.
 const center=p.locator('input[aria-label="Положение кадра по вертикали"],input[aria-label="Положення кадру за вертикаллю"]');
 if(y!==null)await center.evaluate((el,y)=>{el.value=y;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},y);
 await p.locator('input[aria-label="Показать рамку вида игрока"],input[aria-label="Показати рамку вигляду гравця"]').check();
 if(size.width===1440&&fit==='cover'&&y===70){fs.mkdirSync('output/camera-frame-check',{recursive:true});await p.screenshot({path:'output/camera-frame-check/editor.png'});}
 const expected=await p.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect(),m=r('.zg-stage-minimap'),f=r('.zg-stage-player-frame'),t=r('.zg-stage-pin.is-player');return {x:(f.x-m.x)/m.width,y:(f.y-m.y)/m.height,w:f.width/m.width,h:f.height/m.height,tokenW:t.width/f.width,tokenX:(t.x+t.width/2-f.x)/f.width,tokenY:(t.y+t.height/2-f.y)/f.height};});
 await p.evaluate(()=>{fixture.scenes=[{id:fixture.activeSceneId,scene:structuredClone(fixture.scene)}];ZargotaStoryPlayer.start(fixture);document.getElementById('zg-story-editor').style.display='none';});await p.waitForTimeout(100);
 if(size.width===1440&&fit==='cover'&&y===70)await p.screenshot({path:'output/camera-frame-check/player.png'});
 const actual=await p.evaluate(()=>{const m=document.querySelector('[data-play-world]').getBoundingClientRect(),t=document.querySelector('[data-token-id="'+fixture.heroTokenId+'"]').getBoundingClientRect();return {x:-m.x/m.width,y:-m.y/m.height,w:innerWidth/m.width,h:innerHeight/m.height,tokenW:t.width/innerWidth,tokenX:(t.x+t.width/2)/innerWidth,tokenY:(t.y+t.height/2)/innerHeight};});
 for(const k of Object.keys(expected))assert(Math.abs(expected[k]-actual[k])<.004,JSON.stringify({size,fit,y,k,expected,actual}));
 assert.equal(await p.evaluate(()=>fixture.scene.tokens.find(t=>t.id===fixture.heroTokenId).size),128);
 } }
 console.log('PASS: editor frame and player crop, hero position and ×2 token size agree for 12 cases (fit modes, vertical positions, screen sizes).');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
