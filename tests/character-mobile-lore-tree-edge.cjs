'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html><head><style>body{margin:0;background:#100d08;color:#ecdcb7}#char-sheet{height:760px}.zgml-sheet{height:100%}</style></head><body><div id="page-characters" class="active"><div id="char-sheet"></div></div></body></html>');
 await page.addStyleTag({path:path.resolve('character-mobile-lore.css')});
 await page.evaluate(()=>{
  window.locale='ru';window.ZargotaI18n={getLocale:()=>locale,setLocale:value=>{locale=value;document.dispatchEvent(new Event('zargota:localechange'));}};
  window.ZargotaMobileSheet={updateMarkup:(el,markup)=>el.innerHTML=markup};window.charView='sheet';
  window.characters=[{id:987654399,name:'Герой',race:'Человек',age:17,biography:'Первый абзац.\n\nВторой абзац.\n\nТретий абзац.',biographyUk:'Перший абзац.\n\nДругий абзац.\n\nТретій абзац.',currentGoal:'Существующая цель',family:[
   {id:'father',name:'Отец',nameUk:'Батько',relation:'Отец',relationUk:'Батько',knownInfo:'Важные сведения',knownInfoUk:'Важливі відомості',parentId:'root'},
   {id:'mother',name:'Мать',nameUk:'Мати',relation:'Мать',relationUk:'Мати',dead:true,parentId:'root'},
   {id:'friend',name:'Друг',nameUk:'Друг',relation:'Близкий друг',relationUk:'Близький друг',lifeStatus:'alive',parentId:'root'},
   {id:'pet',name:'Питомец',nameUk:'Улюбленець',relation:'Питомец',relationUk:'Улюбленець',lifeStatus:'undead',parentId:'root'},
   {id:'sister',name:'Сестра',nameUk:'Сестра',parentId:'father'}
  ]}];window.saveChars=async()=>{window.characters=structuredClone(characters);return {ok:true};};
 });
 await page.addScriptTag({path:path.resolve('character-mobile-lore.js')});
 await page.evaluate(()=>{document.querySelector('#char-sheet').innerHTML=ZargotaMobileLore.render(characters[0]);ZargotaMobileLore.setActive(true);});
 const action=a=>page.locator('[data-zgml='+a+']');
 await action('story').tap();assert.equal(await page.locator('.zgml-story-full>p').count(),3);
 await page.evaluate(()=>ZargotaI18n.setLocale('uk'));assert.equal(await page.locator('.zgml-story-full>p').first().innerText(),'Перший абзац.');
 await action('biography').tap();await page.locator('[name=biography]').fill('Оновлена історія.');await page.locator('[type=submit]').tap();
 assert.equal(await page.evaluate(()=>characters[0].biography),'Первый абзац.\n\nВторой абзац.\n\nТретий абзац.');assert.equal(await page.evaluate(()=>characters[0].biographyUk),'Оновлена історія.');assert.equal(await page.evaluate(()=>characters[0].currentGoal),'Существующая цель');assert.equal(await page.evaluate(()=>characters[0].currentGoalUk),undefined);
 await page.evaluate(()=>ZargotaI18n.setLocale('ru'));await action('tree').tap();assert.equal(await page.locator('.zgml-tree [data-key]').count(),5);
 assert.equal(await page.locator('.zgml-tree [data-key=father] .zgml-life-badge').innerText(),'Неизвестно');
 assert.equal(await page.locator('.zgml-tree [data-key=mother] .zgml-life-badge').getAttribute('data-life'),'dead');
 const viewport=page.locator('.zgml-tree-scroll'),bounds=await viewport.boundingBox(),before=await viewport.evaluate(el=>el.scrollLeft);
 await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+35);await page.mouse.down();await page.mouse.move(bounds.x+35,bounds.y+35,{steps:8});await page.mouse.up();
 assert.ok(await viewport.evaluate((el,before)=>el.scrollLeft>before+40,before));assert.equal(await page.locator('.zgml-tree').count(),1);
 await action('tree-in').tap();assert.equal(await page.locator('.zgml-tree').evaluate(el=>el.style.zoom),'1.15');await action('tree-center').tap();
 // Touch drag pans without opening the card under the finger.
 const cdp=await page.context().newCDPSession(page),r=await viewport.boundingBox(),touchBefore=await viewport.evaluate(el=>el.scrollLeft);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+250,y:r.y+40}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+120,y:r.y+40}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(await viewport.evaluate((el,n)=>el.scrollLeft>n+20,touchBefore));assert.equal(await page.locator('.zgml-tree').count(),1);
 await action('tree-center').tap();await page.locator('.zgml-tree [data-key=father]').tap();assert.equal(await action('tree-return').count(),1);
 await action('life-picker').tap();await page.locator('[data-zgml=life-set][data-life=dead]').tap();assert.equal(await page.evaluate(()=>characters[0].family[0].lifeStatus),'dead');assert.equal(await page.evaluate(()=>characters[0].family[0].dead),true);assert.equal(await page.locator('.zgml-person-detail').getAttribute('data-life'),'dead');
 await page.evaluate(()=>ZargotaI18n.setLocale('uk'));assert.equal(await page.locator('#zgml-dialog>header h2').innerText(),'Батько');assert.match(await page.locator('.zgml-person-facts').innerText(),/Важливі відомості/);
 await action('tree-return').tap();assert.match(await page.locator('.zgml-tree [data-key=mother]').innerText(),/Мати/);
 await page.screenshot({path:'/private/tmp/zg-lore-family-tree.png'});
 await page.locator('.zgml-tree [data-key=father]').tap();
 // Save preparation can replace objects: rollback must find the live entry by ID.
 await page.evaluate(()=>{window.saveChars=async()=>{window.characters=structuredClone(characters);return {ok:false};};});
 await action('life-picker').tap();await page.locator('[data-zgml=life-set][data-life=alive]').tap();assert.equal(await page.evaluate(()=>characters[0].family[0].lifeStatus),'dead');assert.match(await page.locator('.zgml-life-error').innerText(),/Не вдалося/);assert.equal(await page.locator('#zgml-dialog').getAttribute('aria-busy'),null);
 // A newer value arriving during a failed save must not be overwritten.
 await page.evaluate(()=>{window.saveChars=async()=>{window.characters=structuredClone(characters);characters[0].family[0].lifeStatus='undead';characters[0].family[0].dead=false;return {ok:false};};});
 await action('life-picker').tap();await page.locator('[data-zgml=life-set][data-life=alive]').tap();assert.equal(await page.evaluate(()=>characters[0].family[0].lifeStatus),'undead');
 await page.evaluate(()=>{window.saveChars=async()=>({ok:true});});await action('life-picker').tap();await page.locator('[data-zgml=life-set][data-life=unknown]').tap();assert.equal(await page.evaluate(()=>characters[0].family[0].lifeStatus),'unknown');assert.equal(await page.evaluate(()=>characters[0].family[0].dead),false);
 for(const width of [320,430]){await page.setViewportSize({width,height:760});await action('tree-return').tap();assert.ok(await page.locator('#zgml-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.locator('.zgml-tree [data-key=father]').tap();}
 assert.deepEqual(errors,[]);console.log('PASS lore: bilingual paragraphs/edit preservation, mouse/touch tree pan, zoom, localized relations, quick status, cloned-save rollback, concurrent update preservation, 320–430px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
