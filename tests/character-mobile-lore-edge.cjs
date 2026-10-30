'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try {
 const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true,deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8879');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(()=>{
  const c=JSON.parse(JSON.stringify(characters.find(c=>c.name==='Эстерос')||characters[0]));c.id=987654398;
  c.biography='История до обновления';c.currentGoal='Цель до обновления';c.notes='Старая заметка';c.battleEcho='Старый след боя';
  c.family=[{id:'a',name:'Старый знакомый',relation:'Наставник',note:'Старая личная запись',parentId:'root',region:'Север',relationshipLevel:'trust',portrait:c.portrait},{id:'b',name:'Путница',parentId:'a',region:'Юг',relationshipLevel:'neutral',portrait:c.portrait},{id:'d',name:'Торговец',parentId:'root',region:'Север',portrait:c.portrait}];
  c.journalEntries=[{journalId:'master-letter',kind:'letter',title:'Письмо мастера',text:'Текст письма',updatedBy:'gm',createdAt:1},{journalId:'map',kind:'image',title:'Карта',image:'images/map-vtt-2048.webp',text:'Карту можно приблизить',createdAt:2}];
  characters.push(c);window._charSheetTab='lore';showPage('characters');openCharSheet(c.id);
 });
 await page.locator('.zgml-sheet').waitFor();await page.waitForTimeout(400);
 const action=a=>page.locator('[data-zgml="'+a+'"]');const close=()=>page.locator('#zgml-dialog>header [data-zgml=close]').tap();
 assert.equal(await page.locator('.zgml-portrait h2').innerText(),'Эстерос');assert.equal(await page.locator('.zgml-story-preview').innerText(),'История до обновления');
 await page.screenshot({path:'/tmp/zargota-lore-about.png'});
 await action('story').tap();assert.match(await page.locator('.zgml-dialog-body').innerText(),/История до обновления/);await close();
 await action('tree').tap();assert.equal(await page.locator('.zgml-tree [data-key]').count(),3);await close();
 // Existing relationship values survive editing; cancellation creates no record.
 await page.locator('[data-tab=people]').tap();await action('add').tap();await page.locator('[name=name]').fill('Не сохранять');await close();assert.equal(await page.locator('.zgml-person').count(),3);
 await page.locator('.zgml-person[data-key=a]').tap();await page.locator('#zgml-dialog details').click();await action('edit-person').tap();
 assert.equal(await page.locator('[name=note]').inputValue(),'Старая личная запись');await page.locator('[name=region]').fill('Восток');await page.locator('[name=relationshipLevel]').selectOption('close');await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 assert.ok(await page.evaluate(()=>characters.find(c=>c.id===987654398).family[0].note==='Старая личная запись'));
 // Search keeps the same focused DOM input after every character.
 const input=page.locator('[data-zgml-search]');await input.tap();await input.evaluate(el=>window.searchNode=el);await input.pressSequentially('Старый',{delay:35});assert.equal(await page.locator('.zgml-person').count(),1);assert.ok(await input.evaluate(el=>el===window.searchNode&&el===document.activeElement));await input.fill('Несуществующее имя');assert.match(await page.locator('.zgml-empty').innerText(),/Ничего не найдено/);await action('reset-filters').tap();assert.equal(await input.inputValue(),'');assert.equal(await page.locator('.zgml-person').count(),3);
 await action('filters').tap();await page.locator('.zgml-filters [name=region]').selectOption('Юг');assert.equal(await page.locator('.zgml-person').count(),1);await page.locator('.zgml-filters [name=region]').selectOption('');await page.locator('.zgml-filters [name=relation]').selectOption('unknown');assert.equal(await page.locator('.zgml-person strong').innerText(),'Торговец');await page.locator('.zgml-filters [name=relation]').selectOption('');await action('filters').tap();
 // Add a person with an image; parent selection is retained across reload.
 await action('add').tap();await page.locator('[name=name]').fill('Новый знакомый');await page.locator('[name=region]').fill('Юг');await page.locator('[name=parentId]').selectOption('b');await page.locator('[name=knownInfo]').fill('Известные сведения');await page.locator('[data-zgml-upload]').setInputFiles('images/portraits/char_1776463717210.png');await page.locator('[data-upload-state]').filter({hasText:'готово'}).waitFor();await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 await action('prev').tap();
 // A cycle cannot be saved.
 await page.locator('.zgml-person[data-key=a]').tap();await page.locator('#zgml-dialog details').click();await action('edit-person').tap();await page.locator('[name=parentId]').selectOption('b');await page.locator('#zgml-form [type=submit]').tap();assert.match(await page.locator('.zgml-save-error').innerText(),/круг/);await close();
 await page.screenshot({path:'/tmp/zargota-lore-people.png'});
 // Long records have a scrollable detail, legacy text remains available.
 await page.locator('[data-tab=letters]').tap();assert.equal(await page.locator('.zgml-unread').count(),1);await page.locator('.zgml-record').filter({hasText:'Письмо мастера'}).tap();await close();assert.equal(await page.locator('.zgml-unread').count(),0);await action('add').tap();await page.locator('[name=title]').fill('Моя новая запись');await page.locator('[name=text]').fill('Текст записи. '.repeat(100));await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654398).notes),'Старая заметка');
 await page.locator('.zgml-record').filter({hasText:'Моя новая запись'}).tap();assert.ok(await page.locator('.zgml-dialog-body').evaluate(el=>el.scrollHeight>el.clientHeight));await close();
 await page.locator('.zgml-record').filter({hasText:'Карта'}).tap();await action('zoom').tap();await action('zoom-in').tap();assert.equal(await page.locator('.zgml-image-scroll img').getAttribute('data-scale'),'1.5');await action('return-record').tap();assert.match(await page.locator('.zgml-entry-text').innerText(),/Карту можно приблизить/);await close();
 await page.screenshot({path:'/tmp/zargota-lore-letters.png'});
 // Path description has no side effects on stats or skills.
 await page.locator('[data-tab=about]').tap();const before=await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);return JSON.stringify([c.stats,c.skills,c.hpCur]);});await action('path').tap();await action('edit-path').tap();await page.locator('[name=title]').fill('Тестовый путь');await page.locator('[name=development]').fill('Условия будут согласованы отдельно');await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);return JSON.stringify([c.stats,c.skills,c.hpCur]);}),before);
 await action('biography').tap();await page.locator('[name=text]').fill('Изменённая история');await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 await page.reload();await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(()=>{window._charSheetTab='lore';showPage('characters');openCharSheet(987654398);});await page.locator('.zgml-sheet').waitFor();
 assert.ok(await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);return c.biography==='Изменённая история'&&c.family.length===4&&c.family.find(x=>x.name==='Новый знакомый').parentId==='b'&&c.family.find(x=>x.name==='Новый знакомый').portrait.startsWith('data:image/')&&c.journalEntries.some(x=>x.title==='Моя новая запись')&&c.narrativePath.title==='Тестовый путь';}));
 for(const locale of ['ru','uk']){await page.evaluate(l=>ZargotaI18n.setLocale(l),locale);for(const [width,height] of [[320,568],[390,780],[430,932]]){await page.setViewportSize({width,height});for(const tab of ['about','people','letters']){await page.locator('[data-tab='+tab+']').tap();await page.waitForTimeout(260);const g=await page.evaluate(()=>{const root=document.querySelector('.zgml-sheet'),content=root.querySelector('.zgml-content'),nav=document.querySelector('.zgmo-nav');return {w:document.documentElement.scrollWidth-innerWidth,h:root.scrollHeight-root.clientHeight,top:root.getBoundingClientRect().top,bottom:root.getBoundingClientRect().bottom,nav:nav.getBoundingClientRect().top,overflow:content.scrollHeight-content.clientHeight};});assert.ok(g.w<=1&&g.h<=2&&g.top<=1&&g.bottom<=g.nav+1&&g.overflow<=2,JSON.stringify({locale,width,height,tab,g}));}}}
 // Removing a parent reparents descendants rather than deleting them.
 await page.locator('[data-tab=people]').tap();await page.locator('.zgml-person[data-key=a]').tap();await page.locator('#zgml-dialog details').click();await action('remove-person').tap();await action('confirm-delete').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});assert.ok(await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);return c.family.length===3&&c.family.find(x=>x.id==='b').parentId==='root';}));
 // Bound players can read master content but do not get its editor or the path editor.
 await page.evaluate(()=>{window._originalPersistent=window.ZargotaPersistentCharacters;window.ZargotaPersistentCharacters=Object.assign({},window._originalPersistent,{usesCharacter:()=>true,status:()=>({account:{role:'player'}})});});
 await page.locator('[data-tab=about]').tap();await action('path').tap();assert.equal(await action('edit-path').count(),0);await close();await page.locator('[data-tab=letters]').tap();await page.locator('.zgml-record').filter({hasText:'Письмо мастера'}).tap();assert.equal(await action('edit-record').count(),0);await close();await page.evaluate(()=>window.ZargotaPersistentCharacters=window._originalPersistent);
 // Preserve existing record types and attachment aliases, including master notes and quests.
 await page.evaluate(()=>{const c=characters.find(c=>c.id===987654398);c.journalEntries.push(
  {journalId:'place-fixture',kind:'place',title:'Место с картой',art:'images/map-vtt-2048.webp',text:'Описание места'},
  {journalId:'note-fixture',kind:'note',title:'Заметка мастера',updatedBy:'gm',text:'Это заметка'},
  {journalId:'quest-fixture',kind:'quest',title:'Старое задание',status:'active',questId:'quest-1',text:'Существующее задание'}
 );});
 await page.locator('[data-tab=letters]').tap();await action('filters').tap();await page.locator('.zgml-filters [name=kind]').selectOption('place');assert.equal(await page.locator('.zgml-record').count(),1);
 await page.locator('.zgml-record').tap();await page.locator('#zgml-dialog details').click();await action('edit-record').tap();assert.equal(await page.locator('.zgml-upload-preview img').count(),1);await action('remove-image').tap();assert.equal(await page.locator('.zgml-upload-preview img').count(),0);await close();
 assert.ok(await page.evaluate(()=>characters.find(c=>c.id===987654398).journalEntries.find(x=>x.journalId==='place-fixture').art));
 await page.locator('.zgml-record').tap();await page.locator('#zgml-dialog details').click();await action('edit-record').tap();await action('remove-image').tap();await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 assert.ok(await page.evaluate(()=>{const r=characters.find(c=>c.id===987654398).journalEntries.find(x=>x.journalId==='place-fixture');return !r.image&&!r.art&&r.kind==='place';}));
 await page.locator('.zgml-filters [name=kind]').selectOption('quest');await page.locator('.zgml-record').tap();await page.locator('#zgml-dialog details').click();await action('edit-record').tap();assert.equal(await page.locator('#zgml-form [name=kind]').inputValue(),'quest');await page.locator('[name=text]').fill('Дополнение к заданию');await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 assert.ok(await page.evaluate(()=>{const r=characters.find(c=>c.id===987654398).journalEntries.find(x=>x.journalId==='quest-fixture');return r.kind==='quest'&&r.questId==='quest-1'&&r.status==='active';}));
 await page.locator('.zgml-filters [name=kind]').selectOption('note');assert.equal(await page.locator('.zgml-record').filter({hasText:'Заметка мастера'}).count(),1);
 // A failed save stays actionable and retry does not create duplicate records.
 await action('add').tap();await page.locator('[name=title]').fill('Повтор сохранения');await page.locator('[name=text]').fill('Не дублировать');
 await page.evaluate(()=>{window._saveBeforeLoreTest=saveChars;window.saveChars=()=>Promise.resolve({ok:false});});
 await page.locator('#zgml-form [type=submit]').tap();assert.ok((await page.locator('.zgml-save-error').innerText()).length>0);assert.equal(await page.locator('#zgml-dialog').count(),1);await page.evaluate(()=>window.saveChars=window._saveBeforeLoreTest);await page.locator('#zgml-form [type=submit]').tap();await page.locator('#zgml-dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>characters.find(c=>c.id===987654398).journalEntries.filter(x=>x.title==='Повтор сохранения').length),1);
 // Closing dialog on tab/desktop transition; desktop still uses the existing journal.
 await page.locator('[data-tab=about]').tap();await action('tree').tap();await page.keyboard.press('Escape');assert.equal(await page.locator('#zgml-dialog').count(),0);await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(300);assert.equal(await page.locator('.zgml-sheet').count(),0);assert.equal(await page.locator('.sheet-journal').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS lore: RU/UK 320–430px, biography, people CRUD, search focus, filters, cycle guard, image upload, journal/map detail, persistence, path isolation, attachment removal, legacy types, failed save retry, desktop fallback');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
