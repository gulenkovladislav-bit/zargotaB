const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:950}});p.setDefaultTimeout(15000);
 await p.route('http://127.0.0.1:17349/**',r=>r.abort());await p.goto('file://'+path.resolve('index.html'));await p.waitForFunction(()=>window.ZargotaStoryPlayer);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const episode=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
 async function start(at=0){await p.evaluate(({e,at})=>{
  ZargotaStoryPlayer.stop();e.intro={enabled:false};e.scenes=[];e.startSceneId=e.activeSceneId='';e.scene.story={};e.walkable=null;e.scene.tokens=[{id:'hero',x:50,y:50,size:80},{id:'point',type:'note',x:52,y:50,size:32}];e.heroTokenId='hero';e.interactions={point:{entryId:'a'}};e.quests=[];e.storyItems=[];e.entryId='a';e.testLocation=true;e.testDialogueId='a';e.testDialoguePage=at;
  e.nodes=[{id:'a',text:'A',textUk:'A',textAnimation:'none',typingSound:'off',slides:[{text:'B',textUk:'B'},{text:'C',textUk:'C'},{text:'D',textUk:'D'}],links:[{id:'go',to:'b'}]},{id:'b',text:'E',textUk:'E',textAnimation:'none',typingSound:'off',slides:[{text:'F',textUk:'F'}],links:[]}];
  window.navigationSaved=structuredClone(e);ZargotaStoryPlayer.startTest(e,()=>{},edit=>ZargotaLivePageEditor.apply(navigationSaved,edit));
 },{e:episode,at});await p.locator('#zg-story-player [data-token-id=point]').click();}
 const root=p.locator('#zg-story-player'),line=root.locator('.zg-story-line'),nav=root.locator('.zg-dialogue-page-nav');
 async function expect(text,count){assert.equal(await line.textContent(),text);if(count)assert.equal(await nav.locator('span').textContent(),count);}
 async function key(k,text,count){await p.keyboard.press(k);await expect(text,count);}
 await start();await expect('A','1 / 4');await key('ArrowRight','B','2 / 4');await key('ArrowRight','C','3 / 4');await key('ArrowLeft','B','2 / 4');await key('ArrowLeft','A','1 / 4');await key('ArrowLeft','A','1 / 4');await key('ArrowRight','B','2 / 4');
 // Alternate physical and on-screen arrows without duplicate history entries.
 await nav.locator('button').nth(1).click();await expect('C','3 / 4');await key('ArrowLeft','B','2 / 4');await nav.locator('button').nth(0).click();await expect('A','1 / 4');await key('ArrowRight','B','2 / 4');await key('ArrowRight','C','3 / 4');await key('ArrowRight','D','4 / 4');
 // Reading across node boundaries restores the active block's actual page index.
 await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='b');await expect('E','1 / 2');await key('ArrowLeft','D');assert(await nav.isHidden());await key('ArrowRight','E','1 / 2');await key('ArrowRight','F','2 / 2');await key('ArrowLeft','E','1 / 2');await key('ArrowRight','F','2 / 2');
 // Reopening the same conversation creates a fresh reading sequence.
 await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('.zg-story-dialogue').hidden);await root.locator('[data-token-id=point]').click();await expect('A','1 / 4');await key('ArrowRight','B','2 / 4');await key('ArrowLeft','A','1 / 4');await key('ArrowRight','B','2 / 4');await key('ArrowRight','C','3 / 4');
 // Starting a test on the third reply must still allow going to the first.
 await start(2);await expect('C','3 / 4');await key('ArrowLeft','B','2 / 4');await key('ArrowLeft','A','1 / 4');await key('ArrowRight','B','2 / 4');await key('ArrowRight','C','3 / 4');await key('ArrowRight','D','4 / 4');
 // Focus on the appearance cog must not swallow page arrows, but a slider must.
 await p.locator('.zg-play-settings summary').click();await p.locator('[data-edit-dialogue]').check();await p.locator('.zg-play-settings summary').click();await root.getByRole('button',{name:/Настройки отображения|Налаштування відображення/}).click();await key('ArrowLeft','C','3 / 4');
 const settings=root.locator('[data-live-appearance]');assert((await settings.locator('strong').textContent()).endsWith('3 / 4'));const slider=settings.locator('input[type=range]').first();await slider.focus();await p.keyboard.press('ArrowLeft');await expect('C','3 / 4');await root.focus();await key('Backspace','B','2 / 4');await key('ArrowRight','C','3 / 4');
 await p.evaluate(()=>ZargotaStoryPlayer.stop());console.log('PASS Edge: keyboard/mouse mixed navigation, counters, first-page boundary, cross-node history, test from page 3, settings focus and slider keys.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
