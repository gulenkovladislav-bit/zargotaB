'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('file://'+path.resolve(__dirname,'..','index.html'));
    await page.evaluate(()=>{
      const host=document.createElement('div');host.id='light-visual-fixture';host.style.cssText="position:fixed;inset:40px;width:960px;height:620px;overflow:hidden;background:center/cover url('assets/stories/backgrounds/Home.png');z-index:999999";document.body.appendChild(host);
      ZargotaStoryEnvironment.render({decorations:[
        {id:'fire',kind:'fire',x:30,y:50,size:100,opacity:.4,lightOpacity:.7,showTexture:false,lightEnabled:true,duration:.8},
        {id:'painted-fire',kind:'fire',x:50,y:50,size:110,opacity:.9,lightOpacity:.55,showTexture:true,lightEnabled:true,duration:.9},
        {id:'lamp',kind:'lamp',x:70,y:50,size:130,opacity:.6,lightOpacity:.5,showTexture:true,lightEnabled:true,duration:2.5}
      ]},host);
    });
    const fire=page.locator('[data-effect-id=fire]');
    const paintedFire=page.locator('[data-effect-id=painted-fire]');
    const lamp=page.locator('[data-effect-id=lamp]');
    assert.equal(await fire.locator('.zg-story-effect-texture').count(),0,'Fire can keep lighting without rendering its texture');
    assert.equal(await fire.locator('.zg-story-effect-light').count(),1);
    assert.equal(await fire.evaluate(el=>el.style.getPropertyValue('--light-opacity')),'0.7');
    assert.match(await paintedFire.locator('img').getAttribute('src'),/fire-overlay-v2\.png$/);
    assert.equal(await lamp.locator('img.zg-story-effect-texture').count(),1);
    assert.match(await lamp.locator('img').getAttribute('src'),/lamp-glow-v2\.png$/);
    assert.notEqual(await lamp.locator('.zg-story-effect-light').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#light-visual-fixture img')).every(img=>img.complete));
    await page.locator('#light-visual-fixture').screenshot({path:'/private/tmp/zargota-light-effects-edge.png'});
    await page.evaluate(()=>{
      document.querySelector('#light-visual-fixture').remove();
      window.lightFixture={id:'light-editor-test',activeSceneId:'room',heroTokenId:'',nodes:[],interactions:{},speakers:{},scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[],story:{decorations:[{id:'fire',name:'Fire',kind:'fire',x:50,y:50,size:100,opacity:1,showTexture:true,lightEnabled:true,lightOpacity:.62,duration:.9}],zones:[]}}};
      window.lightSave=function(fn){fn(lightFixture);};
      ZargotaStoryStageEditor.open(lightFixture,lightSave,[{id:'room',name:'Room',scene:lightFixture.scene}]);
    });
    await page.locator('[data-stage-kind=decorations][data-stage-id=fire]').evaluate(el=>el.click());
    const texture=page.getByRole('checkbox',{name:/Показывать текстуру|Показувати текстуру/});
    const lighting=page.getByRole('checkbox',{name:/Эффект освещения|Ефект освітлення/});
    await texture.uncheck();
    assert.equal(await lighting.isChecked(),true);
    assert.equal(await page.evaluate(()=>lightFixture.scene.story.decorations[0].showTexture),false);
    await page.getByRole('button',{name:/Предпросмотр эффектов|Попередній перегляд ефектів/}).evaluate(el=>el.click());
    assert.equal(await page.locator('.zg-stage-minimap .is-fire .zg-story-effect-texture').count(),0);
    assert.equal(await page.locator('.zg-stage-minimap .is-fire .zg-story-effect-light').count(),1);
    assert.deepEqual(errors,[]);
    console.log('PASS Edge: animated fire/lamp textures, independent lighting, and light-only editor mode.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
