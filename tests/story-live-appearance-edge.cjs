const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:950}});p.setDefaultTimeout(15000);
 await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));await p.waitForFunction(()=>window.ZargotaStoryPlayer);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 await p.evaluate(e=>{
  e.intro={enabled:false};e.scenes=[];e.startSceneId=e.activeSceneId='';e.scene.story={};e.walkable=null;e.scene.tokens=[{id:'hero',x:50,y:50,size:80},{id:'point',type:'note',x:52,y:50,size:32}];e.heroTokenId='hero';e.interactions={point:{entryId:'a'}};e.quests=[];e.storyItems=[];e.entryId='a';e.testLocation=true;
  e.nodes=[{id:'a',text:'First reply',textUk:'First reply',textAnimation:'none',textSpeed:16,textSize:30,typingSound:'off',slides:[{text:'Second reply',textUk:'Second reply',textAnimation:'rise',textSpeed:55,textSize:38},{text:'Third reply',textUk:'Third reply',textAnimation:'fade',textSpeed:70,textSize:26},{text:'Inherited reply',textUk:'Inherited reply'}],links:[]}];
  window.appearanceSaved=structuredClone(e);window.appearanceEdits=[];
  ZargotaStoryPlayer.startTest(e,()=>{},edit=>{appearanceEdits.push(edit);return ZargotaLivePageEditor.apply(appearanceSaved,edit);});
 },episode);
 const root=p.locator('#zg-story-player'),line=root.locator('.zg-story-line');
 await root.locator('[data-token-id=point]').click();await p.locator('.zg-play-settings summary').click();await p.locator('[data-edit-dialogue]').check();await p.locator('.zg-play-settings summary').click();
 await root.getByRole('button',{name:/Настройки отображения|Налаштування відображення/}).click();
 const panel=root.locator('[data-live-appearance]'),modes=panel.locator('.zg-live-animation-modes button'),sliders=panel.locator('input[type=range]');
 assert.equal(await modes.nth(3).getAttribute('aria-pressed'),'true');assert.equal(await sliders.nth(0).inputValue(),'16');
 // Apply fade to page one and actually inspect the rendered animation, not only data attributes.
 await modes.nth(1).click();await panel.getByRole('button',{name:/Применить|Застосувати/}).click();
 assert.equal(await line.evaluate(el=>getComputedStyle(el).animationName),'zgLineFade');
 assert.equal(await line.textContent(),'First reply');assert.equal(await panel.locator('strong').textContent().then(s=>s.endsWith('1 / 4')),true);
 const next=root.locator('.zg-dialogue-page-nav button').nth(1),prev=root.locator('.zg-dialogue-page-nav button').nth(0);
 await next.click();assert.equal(await line.evaluate(el=>getComputedStyle(el).animationName),'zgLineRise');assert.equal(await modes.nth(2).getAttribute('aria-pressed'),'true');assert.equal(await sliders.nth(0).inputValue(),'55');assert.equal(await sliders.nth(1).inputValue(),'38');
 await next.click();assert.equal(await modes.nth(1).getAttribute('aria-pressed'),'true');assert.equal(await sliders.nth(0).inputValue(),'70');
 // Same-mode consecutive pages must restart their fade.
 await prev.click();await modes.nth(1).click();await panel.getByRole('button',{name:/Применить|Застосувати/}).click();
 await p.waitForTimeout(550);await next.click();assert(await line.evaluate(el=>el.getAnimations().some(a=>a.playState==='running'&&a.currentTime<500)));
 await next.click();assert.equal(await modes.nth(3).getAttribute('aria-pressed'),'true','first-page edit leaves inherited page unchanged');assert.equal(await line.evaluate(el=>getComputedStyle(el).animationName),'none');
 // Keyboard history also uses the saved appearance, with the open panel rebound to its page.
 await root.focus();await p.keyboard.press('ArrowLeft');assert.equal(await modes.nth(1).getAttribute('aria-pressed'),'true');assert.equal(await sliders.nth(0).inputValue(),'70');
 await modes.nth(0).click();await panel.getByRole('button',{name:/Применить|Застосувати/}).click();assert.equal(await line.getAttribute('data-animation'),'typewriter');await p.waitForFunction(()=>document.querySelector('.zg-story-line').textContent==='Third reply');
 assert.equal(await p.evaluate(()=>appearanceEdits.at(-1).pageIndex),2);
 const saved=await p.evaluate(()=>appearanceSaved.nodes[0]);assert.equal(saved.textAnimation,'fade');assert.equal(saved.slides[0].textAnimation,'fade');assert.equal(saved.slides[1].textAnimation,'typewriter');assert.equal(saved.slides[2].textAnimation,'none');
 await p.emulateMedia({reducedMotion:'reduce'});await prev.click();assert.equal(await line.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.evaluate(()=>ZargotaStoryPlayer.stop());console.log('PASS Edge: four modes render, consecutive fades restart, open panel follows arrow/history navigation, per-reply saves and inherited isolation, reduced motion.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
