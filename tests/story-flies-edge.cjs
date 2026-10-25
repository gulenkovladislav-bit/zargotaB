const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:17349/**',r=>r.abort());await page.goto('file://'+path.resolve('index.html'));await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 await page.evaluate(e=>{window.flyEpisode=e;window.flyFixture={id:'fly-test',activeSceneId:'backwater',nodes:e.nodes,speakers:e.speakers,scene:structuredClone(e.scenes.find(s=>s.id==='scene-esteros-food-backwater').scene)};flyFixture.scene.story.decorations=[];window.saveFly=(fn,opts)=>{fn(flyFixture);if(!opts?.quiet)ZargotaStoryStageEditor.open(flyFixture,saveFly,[{id:'backwater',scene:flyFixture.scene}]);};ZargotaStoryStageEditor.open(flyFixture,saveFly,[{id:'backwater',scene:flyFixture.scene}]);zgStoryEditorOpen('fly-editor-test');const root=document.getElementById('zg-story-editor');root.dataset.workspace='scene';const panel=document.getElementById('zg-story-stage-settings');panel.classList.add('zg-story-embedded');root.querySelector('.zg-story-workspace-pane').append(panel);},episode);
 await page.waitForFunction(()=>document.querySelector('.zg-stage-minimap')?.getBoundingClientRect().width>100);
 await page.locator('.zg-stage-effects-menu > summary').click();await page.getByRole('button',{name:'＋ Мухи',exact:true}).click();
 const swarm=page.locator('.zg-stage-minimap .is-flies');assert.equal(await swarm.count(),1);assert.equal(await swarm.locator('.zg-story-fly').count(),20);assert.equal(await swarm.locator('img').count(),0);
 assert.equal(await swarm.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const paths=await swarm.locator('i').evaluateAll(els=>els.map(el=>el.style.offsetPath));assert.equal(new Set(paths).size,20);
 const before=await swarm.locator('i').first().evaluate(el=>getComputedStyle(el).offsetDistance);await page.waitForTimeout(250);assert.notEqual(await swarm.locator('i').first().evaluate(el=>getComputedStyle(el).offsetDistance),before);
 for(const [label,value] of [[/Количество мух|Кількість мух/,'32'],[/Размер, px|Розмір, px/,'240'],[/Высота роя|Висота рою/,'140'],[/Скорость полёта|Швидкість польоту/,'0.6']]){const input=page.getByLabel(label);await input.fill(value);await input.dispatchEvent('change');}
 assert.equal(await swarm.locator('i').count(),32);assert.equal(await swarm.evaluate(el=>el.style.width),'240px');assert.equal(await swarm.evaluate(el=>el.style.height),'140px');
 const area=page.getByRole('button',{name:/Переместить рой мух|Перемістити рій мух/}),box=await area.boundingBox(),origin=await page.evaluate(()=>flyFixture.scene.story.decorations[0].x);
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.75+35,box.y+box.height*.6+15,{steps:8});await page.mouse.up();assert((await page.evaluate(()=>flyFixture.scene.story.decorations[0].x))>origin);
 await page.getByRole('button',{name:/Дублировать эффект|Дублювати ефект/}).click();assert.equal(await swarm.count(),2);
 await page.getByRole('button',{name:/Удалить выбранное|Видалити вибране/}).click();assert.equal(await swarm.count(),1);
 await page.locator('[data-effects-toggle]').click();assert.equal(await swarm.count(),0);await page.locator('[data-effects-toggle]').click();assert.equal(await swarm.count(),1);
 const saved=await page.evaluate(()=>JSON.stringify(flyFixture));await page.evaluate(s=>{flyFixture=JSON.parse(s);ZargotaStoryStageEditor.open(flyFixture,saveFly,[{id:'backwater',scene:flyFixture.scene}]);},saved);assert.equal(await swarm.locator('i').count(),32);
 fs.mkdirSync('output/flies-review',{recursive:true});await page.screenshot({path:'output/flies-review/editor.png'});
 await page.evaluate(()=>{ZargotaStoryStageEditor.close();zgStoryEditorClose();const e=structuredClone(flyEpisode);e.intro={enabled:false};e.nodes=[];e.quests=[];e.testLocation=true;e.startSceneId=e.activeSceneId='scene-esteros-food-backwater';e.scene=e.scenes.find(s=>s.id===e.activeSceneId).scene;ZargotaStoryPlayer.start(e);});
 await page.waitForFunction(()=>document.querySelectorAll('#zg-story-player .is-flies').length===2);assert.equal(await page.locator('#zg-story-player .zg-story-fly').count(),42);
 await page.waitForTimeout(350);await page.screenshot({path:'output/flies-review/player.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('#zg-story-player .zg-story-fly')).animationName==='none');assert.equal(await page.locator('#zg-story-player .zg-story-fly').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.evaluate(()=>new Promise(resolve=>ZargotaStoryPlayer.travel('scene-mvctoydb',resolve)));assert.equal(await page.locator('#zg-story-player .is-flies').count(),0);await page.evaluate(()=>ZargotaStoryPlayer.stop());assert.deepEqual(errors,[]);
 console.log('PASS: add/edit/drag/duplicate/delete, hide/show, JSON reload; independent moving flies in editor and player, reduced motion and scene cleanup.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
