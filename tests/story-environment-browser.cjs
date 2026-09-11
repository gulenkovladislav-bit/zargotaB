// Run with NODE_PATH pointing to a Playwright installation and CHROME_PATH if needed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.__audioEvents=[];HTMLMediaElement.prototype.play=function(){window.__audioEvents.push({src:this.src,loop:this.loop});return Promise.resolve();};HTMLMediaElement.prototype.pause=function(){this.dataset.paused='true';};});
    await page.goto('http://127.0.0.1:5175/index.html');
    await page.waitForFunction(()=>window.ZargotaStoryPlayer&&window.ZargotaStoryStageEditor);
    await page.evaluate(()=>{
      const project=JSON.parse(JSON.stringify(ZargotaStoryCampaign));
      const sceneB=JSON.parse(JSON.stringify(project.scene));sceneB.story={ambience:'audio/vtt-actions/map-ping.mp3',rain:.2,fog:.2,spawnX:35,spawnY:50,decorations:[{id:'lamp',kind:'lamp',x:30,y:40,size:100,opacity:1}]};
      project.scenes=[{id:'B',name:'B',scene:sceneB}];
      project.nodes[0].links=[{id:'travel',to:'',sceneId:'B',effect:'travelled',delayMs:0}];
      project.scene.story={zones:[{id:'sound-zone',x:48,y:58,radius:5,sound:'audio/vtt-actions/map-ping.mp3',effect:'heard',once:true}],decorations:[{id:'fire',kind:'fire',x:70,y:60,size:100,opacity:1}]};
      window.__project=project;ZargotaStoryPlayer.start(project);
    });
    assert.equal(await page.locator('.zg-story-decoration.is-fire').count(),1);
    await page.getByRole('button',{name:'♪ Звук: выкл',exact:true}).click();
    await page.getByRole('button',{name:'Брат Вротика · Взаимодействовать',exact:true}).click();
    await page.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='dialog-1');
    assert.equal(await page.evaluate(()=>ZargotaStoryPlayer.getState().flags.heard),true);
    assert.equal(await page.evaluate(()=>__audioEvents.length),1,'one zone sound, no frame spam');
    await page.getByRole('button',{name:'Продолжить →',exact:false}).click();
    await page.waitForFunction(()=>ZargotaStoryPlayer.getState().sceneId==='B');
    assert.equal(await page.evaluate(()=>ZargotaStoryPlayer.getState().flags.travelled),true);
    assert.equal(await page.locator('.zg-story-decoration.is-fire').count(),0);
    assert.equal(await page.locator('.zg-story-decoration.is-lamp').count(),1);
    assert.equal(await page.locator('.zg-story-rain').count(),1);
    assert.equal(await page.locator('.zg-story-fog').count(),1);
    assert.equal(await page.evaluate(()=>ZargotaStoryPlayer.getState().position.x),35);
    await page.getByRole('button',{name:'↻ Заново',exact:true}).click();
    assert.equal(await page.evaluate(()=>ZargotaStoryPlayer.getState().flags.travelled),undefined);
    assert.equal(await page.locator('.zg-story-decoration.is-fire').count(),1);
    await page.evaluate(()=>{ZargotaStoryPlayer.stop();__project.scene.story.zones=[{id:'portal',x:48,y:58,radius:5,mode:'click',sceneId:'B'}];ZargotaStoryPlayer.start(__project);});
    await page.getByRole('button',{name:'portal',exact:true}).click();
    await page.waitForFunction(()=>ZargotaStoryPlayer.getState().sceneId==='B');
    await page.evaluate(()=>ZargotaStoryPlayer.stop());
    // Real editor handlers and persistence, isolated browser storage only.
    await page.getByRole('button',{name:'⚒ Мастерская',exact:true}).click();
    await page.getByRole('button',{name:/Создание сюжета Сцена/}).click();
    await page.getByRole('combobox',{name:'Сюжет кампании',exact:true}).selectOption('vrotik-episode-1');
    await page.getByRole('button',{name:'☁ Сцена: переходы и эффекты',exact:true}).click();
    await page.getByRole('button',{name:'＋ Огонь',exact:true}).click();
    assert.equal(await page.getByRole('heading',{name:'Визуальный эффект'}).count(),1);
    await page.getByRole('spinbutton',{name:'X %',exact:true}).fill('75');
    await page.getByRole('spinbutton',{name:'X %',exact:true}).press('Tab');
    assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.decorations[0].x),75);
    await page.getByRole('button',{name:'▶ Предпросмотр эффектов',exact:true}).click();
    assert.equal(await page.locator('.zg-stage-minimap .is-fire').count(),1);
    await page.screenshot({path:'/private/tmp/zargota-story-effects-editor.png'});
    await page.locator('#zg-story-stage-settings header button').click();
    await page.getByRole('button',{name:'💾 Сохранить',exact:true}).click();
    await page.waitForFunction(()=>!!zgStoryEditorProject().activeSceneId);
    assert.equal(await page.evaluate(()=>new Promise(resolve=>ZargotaLib.get(zgStoryEditorProject().activeSceneId,r=>resolve(r.scene.story.decorations[0].x)))),75);
    await page.getByRole('button',{name:'▶ Пройти эпизод',exact:true}).click();
    assert.equal(await page.locator('.zg-story-play-world .is-fire').count(),1,'capture keeps effects');
    assert.deepEqual(errors,[]);
    console.log('Browser passed: zone sound once, dialogue scene transition, map portal, weather, restart, editor placement, scene persistence, playback effects. Audio playback is instrumented, not audibly verified.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
