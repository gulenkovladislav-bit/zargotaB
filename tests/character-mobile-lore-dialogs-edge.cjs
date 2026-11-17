'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.ZG_TEST_URL||'http://127.0.0.1:8880';
(async()=>{
 for(const engine of (process.env.ZG_TEST_ENGINE||'edge,webkit').split(',')){
  const browser=await (engine==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:740},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
   await page.evaluate(()=>{
    const hero=structuredClone(characters.find(c=>c.campaignKey==='lin-yin')||characters[0]);hero.id=987654339;
    const text='Длинная проверочная запись. '.repeat(40);
    hero.biography=text;hero.biographyUk=text;
    hero.narrativePath={title:'Проверка длинного пути',description:text,development:text};
    hero.family=[{id:'relative',name:'Близкий человек',nameUk:'Близька людина',relation:'Семья',relationUk:'Родина',knownInfo:text,note:text,portrait:hero.portrait}];
    hero.family.push({id:'relative-two',name:'Второй близкий',relation:'Родина'});
    hero.journalEntries=[{journalId:'test-letter',title:'Проверочное письмо',kind:'letter',text,updatedBy:'local'}];
    characters=[hero];window._charSheetTab='lore';showPage('characters');openCharSheet(hero.id);
   });
   const action=a=>page.locator('[data-zgml="'+a+'"]');
   const close=()=>page.locator('#zgml-dialog>header [data-zgml=close]').tap();
   async function about(){await page.locator('[data-zgml=tab][data-tab=about]').tap();}
   async function person(){await about();await action('tree').first().tap();await page.locator('.zgml-tree [data-key]').first().tap();}
   const scenes={
    path:async()=>{await about();await action('path').tap();},
    'path-edit':async()=>{await about();await action('path').tap();await action('edit-path').tap();},
    'world-fame':async()=>{await about();await page.locator('[data-fame=fameMundo]').tap();},
    'local-fame':async()=>{await about();await page.locator('[data-fame=fameZargoty]').tap();},
    tree:async()=>{await about();await action('tree').first().tap();},
    person,
    'person-status':async()=>{await person();await action('life-picker').tap();},
    'person-edit':async()=>{await person();await action('edit-person').tap();},
    'people-card':async()=>{await page.locator('[data-zgml=tab][data-tab=people]').tap();await action('person').first().tap();},
    story:async()=>{await about();await action('story').tap();},
    'story-edit':async()=>{await about();await action('story').tap();await action('biography').tap();},
    letter:async()=>{await page.locator('[data-zgml=tab][data-tab=letters]').tap();await action('record').first().tap();}
   };
   async function check(name,limitTop,limitBottom){
    await page.waitForTimeout(230);
    const dimensions=await page.locator('#zgml-dialog').evaluate(d=>{
     const b=d.querySelector('.zgml-form-fields')||d.querySelector('.zgml-dialog-body'),header=d.querySelector('header'),r=d.getBoundingClientRect(),br=b.getBoundingClientRect();
     b.scrollTop=b.scrollHeight;
     const last=b.lastElementChild,lr=last.getBoundingClientRect();
     return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,body:br.height,bodyBottom:br.bottom,header:header.getBoundingClientRect().height,scroll:b.scrollHeight,client:b.clientHeight,end:lr.bottom,scrollAtEnd:b.scrollTop+b.clientHeight>=b.scrollHeight-2,width:innerWidth};
    });
    assert.ok(dimensions.top>=limitTop&&dimensions.bottom<=limitBottom+1,engine+' '+name+' bounds '+JSON.stringify(dimensions));
    assert.ok(dimensions.left>=0&&dimensions.right<=dimensions.width,engine+' '+name+' width');
    // Original WebKit failure: auto-sized flex dialog was 92px, body only 28px.
    assert.ok(dimensions.body>=110,engine+' '+name+' collapsed '+JSON.stringify(dimensions));
    if(name==='tree'){const tails=await page.locator('.zgml-tree>ul>li').evaluateAll(es=>[getComputedStyle(es[0],'::before').borderTopWidth,getComputedStyle(es.at(-1),'::after').borderTopWidth]);assert.deepEqual(tails,['0px','0px'],'Tree has protruding connector tails');}
    assert.ok(dimensions.scrollAtEnd,engine+' '+name+' unreachable scroll end');
    if(name!=='tree')assert.ok(dimensions.end<=dimensions.bodyBottom+2,engine+' '+name+' clipped content '+JSON.stringify(dimensions));
    assert.ok(await page.locator('#zgml-dialog>header [data-zgml=close]').isVisible());
    const edit=page.locator('#zgml-dialog>.zgml-detail-actions');if(await edit.count()){const r=await edit.boundingBox();assert.ok(r.y>=limitTop&&r.y+r.height<=limitBottom+1,'Edit footer clipped');}
    if(name==='path-edit'||name==='person-edit'||name==='story-edit'){
     const input=page.locator('#zgml-dialog textarea').last();await input.fill('Новая запись / Новий запис');
     const before=await page.locator('#zgml-form [type=submit]').boundingBox();
     await page.locator('.zgml-form-fields').evaluate(e=>e.scrollTop=0);
     const after=await page.locator('#zgml-form [type=submit]').boundingBox();assert.ok(Math.abs(before.y-after.y)<1,'Save moved with form scrolling');
     const rect=await page.locator('#zgml-form [type=submit]').boundingBox();assert.ok(rect.y>=limitTop&&rect.y+rect.height<=limitBottom+1);
    }
   }
   for(const locale of ['ru','uk']){
    await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);
    for(const size of [{width:320,height:568},{width:390,height:740},{width:430,height:932},{width:780,height:390}]){
     await page.setViewportSize(size);await page.waitForTimeout(100);
     for(const [name,open] of Object.entries(scenes)){
      await open();await check(name,0,size.height);
      if(size.width===390&&locale==='ru'&&['path','world-fame','person'].includes(name)){
       await page.locator('.zgml-dialog-body').evaluate(e=>e.scrollTop=0);
       await page.screenshot({path:'/private/tmp/zg-lore-'+engine+'-'+name+'-fixed.png'});
      }
      await close();
     }
     console.log(engine,locale,size.width+'x'+size.height+': 12 lore windows fit, content ends and controls reachable');
    }
   }
   await page.setViewportSize({width:390,height:740});await scenes['person-edit']();
   await page.evaluate(()=>{document.documentElement.style.setProperty('--zg-viewport-top','70px');document.documentElement.style.setProperty('--zg-viewport-height','350px');});
   await check('person-edit',70,420);await close();
   assert.deepEqual(errors,[]);console.log('PASS '+engine+': RU/UK, long content, portrait/landscape, reduced available viewport while editing');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
