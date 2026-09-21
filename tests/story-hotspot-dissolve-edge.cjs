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
      const scene={boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[
        {id:'hero',name:'Hero',nameUk:'Герой',x:20,y:50,size:64},
        {id:'look',type:'note',name:'Осмотр',nameUk:'Огляд',x:26,y:50,size:30,markerSize:70,hideAfterInteraction:true},
        {id:'far',type:'note',name:'Далеко',nameUk:'Далеко',x:80,y:50,size:30,markerSize:70,hideAfterInteraction:true}
      ],story:{spawnX:20,spawnY:50,zones:[{id:'near-wall',blocked:true,x:26,y:50,radius:8},{id:'route-wall',blocked:true,x:50,y:50,radius:8}]}};
      ZargotaStoryPlayer.start({id:'dissolve-test',title:'Test',titleUk:'Тест',intro:{enabled:false},heroTokenId:'hero',entryId:'line',startSceneId:'room',activeSceneId:'room',scene,scenes:[{id:'room',scene}],interactions:{look:{entryId:'line',marker:'?'},far:{entryId:'line',marker:'?'}},speakers:{},quests:[],nodes:[{id:'line',title:'Seen',titleUk:'Огляд',text:'Seen',textUk:'Огляд',textAnimation:'none',speaker:'',links:[]}]});
    });
    const hotspot=page.locator('[data-token-id=look]');
    const far=page.locator('[data-token-id=far]');
    await hotspot.waitFor();
    assert.equal(await hotspot.evaluate(el=>getComputedStyle(el).zIndex),'100');
    await far.click();
    assert.equal(await page.locator('.zg-hotspot-dissolve').count(),0);
    assert.equal(await far.isVisible(),true,'A distant blocked lookout must not activate');
    await hotspot.click();
    assert.equal(await page.locator('.zg-hotspot-dissolve i').count(),18);
    assert.equal(await hotspot.evaluate(el=>el.classList.contains('is-dissolving')),true);
    await page.waitForTimeout(850);
    assert.equal(await hotspot.isHidden(),true);
    assert.equal(await page.locator('.zg-hotspot-dissolve').count(),0);
    await page.evaluate(()=>{
      ZargotaStoryPlayer.stop();
      window.radiusFixture={id:'radius-editor-test',activeSceneId:'room',heroTokenId:'hero',nodes:[],interactions:{},speakers:{},scene:{boardWidth:12,boardHeight:8,gridSize:64,layers:[],tokens:[{id:'hero',name:'Hero',nameUk:'Герой',x:20,y:50,size:64},{id:'look',type:'note',name:'Осмотр',nameUk:'Огляд',x:40,y:50,size:32}],story:{zones:[]}}};
      window.radiusSave=function(fn){fn(radiusFixture);};
      ZargotaStoryStageEditor.open(radiusFixture,radiusSave,[{id:'room',name:'Room',scene:radiusFixture.scene}]);
    });
    await page.locator('[data-stage-id=look]').evaluate(el=>el.click());
    const ring=page.locator('.zg-stage-interaction-radius');
    await ring.waitFor();
    assert.equal(await ring.evaluate(el=>el.style.width),'16%','Editor shows the exact default 8% interaction radius around the point');
    const radius=page.getByRole('button',{name:/Радиус взаимодействия: 2×|Радіус взаємодії: 2×/});
    await radius.click();
    assert.equal(await page.evaluate(()=>radiusFixture.scene.tokens.find(token=>token.id==='look').interactionRadiusScale),2);
    assert.equal(await ring.evaluate(el=>el.style.width),'32%','Editor ring grows with the same multiplier used by runtime');
    assert.equal(await radius.getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);
    console.log('PASS Edge: lookout dissolve, blocked distance, and visible 1x/2x/3x interaction radius.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
