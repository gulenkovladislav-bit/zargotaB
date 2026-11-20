const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out=process.env.ZG_TEST_OUTPUT||'/private/tmp/zg-clean-table-review';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
 const context=await b.newContext({viewport:{width:1600,height:1000}}),p=await context.newPage();
 // File mode cannot fetch JSON templates; model an existing local collection.
 const heroes=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/campaign-heroes.v1.json'),'utf8')).heroes;
 await context.addInitScript(heroes=>{if(window===parent&&!localStorage.getItem('grimoire_chars'))localStorage.setItem('grimoire_chars',JSON.stringify(heroes));},heroes);
 const errors=[],requests=[];
 p.on('pageerror',e=>{if(/http:\/\/127\.0\.0\.1|file:\/\/|about:srcdoc/.test(e.stack||''))errors.push(e.stack);});
 await context.route(/https:\/\/.*(firebase|googleapis|gstatic).*/,r=>{requests.push(r.request().url());return r.abort();});
 await p.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8765');
 await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
 await p.evaluate(async()=>{await window.zgCharacterLoadPromise;zgIrlSessionStart();showPage('gm-table');});
 const baseline=await p.evaluate(()=>JSON.stringify(characters));
 const originalSheet=await p.locator('#char-sheet').elementHandle();
 const originalParent=await p.locator('#page-characters').evaluateHandle(el=>el.parentElement);
 // An existing, closed editor must not be copied into the sheet or reinitialized.
 await p.evaluate(()=>{zgStoryEditorOpen('esteros-after');zgStoryEditorClose();});
 const editor=await p.locator('#zg-story-editor').elementHandle();
 await p.locator('#zg-story-reopen').evaluate(el=>el.classList.add('open'));
 assert.equal(await p.locator('#zg-story-reopen').isVisible(),false,'closed story editor does not add tools to the table');
 const navigationRequests=[];p.on('request',r=>{if(r.isNavigationRequest())navigationRequests.push(r.url());});
 assert.equal(await p.locator('[data-gm-open]').count(),5);
 await p.screenshot({path:out+'/01-clean-table.png',animations:'disabled'});
 await p.locator('[data-gm-open="melissa"]').click();
 const sheet=p.locator('.zg-gm-sheet-host');
 await sheet.locator('.zgmo-nav').waitFor({timeout:15000});
 assert.equal(await p.locator('.zg-gm-phone').isVisible(),true);
 assert.equal(await p.locator('.zg-gm-phone iframe').count(),0,'no nested page');
 assert.equal(await p.locator('#char-sheet').count(),1,'one existing sheet');
 assert.equal(await p.locator('#page-gm-table.active').count(),1,'stay on table');
 assert.equal(await originalSheet.evaluate(el=>el===document.getElementById('char-sheet')),true,'moves original DOM node');
 assert.equal(await p.locator('.zg-gm-sheet-host #zg-story-editor').count(),0,'no story editor inside sheet');
 assert.equal(await editor.evaluate(el=>el===document.getElementById('zg-story-editor')),true,'existing editor preserved');
 const after=await p.evaluate(()=>JSON.stringify(characters));const prior=JSON.parse(baseline),now=JSON.parse(after);console.log('Open changes',now.flatMap((c,i)=>Object.keys(c).filter(k=>JSON.stringify(c[k])!==JSON.stringify(prior[i][k])).map(k=>({hero:c.campaignKey,field:k,before:prior[i][k],after:c[k]}))));assert.deepEqual(now.map(c=>[c.id,c.hpCur,c.name,c.inventoryItems,c.biography]),prior.map(c=>[c.id,c.hpCur,c.name,c.inventoryItems,c.biography]),'opening preserves authored data');
 const child=p;
 const initialRequests=requests.length;
 for(const key of ['lin-yin','vrotik','evan','melissa','esteros']){
   if(key!=='melissa'||await p.locator('[data-gm-key="melissa"].is-selected').count()===0)await p.locator('[data-gm-open="'+key+'"]').click();
   await sheet.locator('.zgmo-nav').waitFor();
   assert.equal(await p.locator('.zg-gm-phone').isVisible(),true,key);
   assert.equal(await child.evaluate(()=>characters.find(c=>String(c.id)===String(viewingCharId)).campaignKey),key,'selected hero matches sheet');
   for(let n=0;n<4;n++){
     await sheet.locator('.zgmo-nav button').nth(n).click();
     await child.waitForFunction(n=>window._charSheetTab===['stats','skills','inventory','lore'][n],n);
     assert.equal(await child.evaluate(()=>document.querySelector('.zg-gm-sheet-host').scrollWidth>document.querySelector('.zg-gm-sheet-host').clientWidth+1),false,key+' tab overflow '+n);
   }
 }
 // Dialogs are part of the component too, bounded by the phone window.
 async function contained(selector){
   await sheet.locator(selector).waitFor();
   const outer=await sheet.boundingBox(),box=await sheet.locator(selector).boundingBox();
   assert.ok(box.x>=outer.x-1&&box.y>=outer.y-1&&box.x+box.width<=outer.x+outer.width+1&&box.y+box.height<=outer.y+outer.height+1,selector+' '+JSON.stringify({outer,box}));
 }
 await sheet.locator('[data-zgml=portrait]').click();await contained('#zgml-art-viewer');
 await p.screenshot({path:out+'/06-portrait.png',animations:'disabled'});
 await sheet.locator('[data-zgml=art-close]').click();
 await sheet.locator('[data-zgml=story]').click();await contained('#zgml-dialog');
 await p.screenshot({path:out+'/07-story.png',animations:'disabled'});
 await sheet.locator('[data-zgml=close]').click();
 await sheet.locator('.zgmo-nav button').nth(1).click();
 await sheet.locator('[data-zgms=group][data-group=personal]').click();
 await sheet.locator('.zgms-card').first().click();await contained('#zgms-dialog');
 await p.screenshot({path:out+'/08-skill.png',animations:'disabled'});
 await sheet.locator('[data-zgms=close]').click();
 // A dock refresh must not replace an open character editor.
 await p.evaluate(()=>openCharEditor(viewingCharId));
 await sheet.locator('#ef-name').fill('Черновик — не сохранять');
 await sheet.locator('#ef-name').press('ControlOrMeta+a');
 assert.equal(await sheet.locator('#ef-name').evaluate(el=>el.selectionEnd-el.selectionStart), 'Черновик — не сохранять'.length,'editable text still selects');
 await p.evaluate(()=>ZargotaGmTable.refresh());
 assert.equal(await p.evaluate(()=>charView),'editor');
 assert.equal(await sheet.locator('#ef-name').inputValue(),'Черновик — не сохранять');
 await p.evaluate(()=>openCharSheet(viewingCharId));
 // Both controls use the existing collection and save path.
 await sheet.locator('.zgmo-nav button').first().click();
 const hp=await child.evaluate(()=>characters.find(c=>c.id===viewingCharId).hpCur);
 await sheet.locator('[data-zgmo="damage"]').click();
 await p.waitForFunction(hp=>characters.find(c=>c.campaignKey==='esteros').hpCur===hp-1,hp);
 await p.waitForFunction(hp=>document.querySelector('[data-gm-key="esteros"] .zg-gm-hp b').textContent===String(hp-1),hp);
 await p.locator('[data-gm-key="esteros"] [data-gm-hp="1"]').click();
 await child.waitForFunction(hp=>characters.find(c=>c.id===viewingCharId).hpCur===hp,hp);
 await sheet.locator('.zgmo-nav button').nth(2).click();
 await p.screenshot({path:out+'/02-mobile-inventory.png'});
 await child.evaluate(async()=>{const c=characters.find(c=>c.id===viewingCharId);c.statuses=['bleed'];await saveChars();});
 await p.waitForFunction(()=>document.querySelector('[data-gm-key=esteros] .zg-gm-statuses').textContent.includes('Кровотечение'));
 // Switching while an item popup is open must not leave the old hero's item visible.
 const item=sheet.locator('.zgmi-card').first();
 if(await item.count()){await item.click();await sheet.locator('#zgmi-dialog').waitFor();await contained('#zgmi-dialog');await p.screenshot({path:out+'/09-item.png',animations:'disabled'});await p.locator('[data-gm-open="melissa"]').click();assert.equal(await sheet.locator('#zgmi-dialog').count(),0);}
 // Drag via real pointer, then resize: the profile stays inside the workspace above the dock.
 const head=await p.locator('.zg-gm-phone-head').boundingBox();
 await p.mouse.move(head.x+70,head.y+18);await p.mouse.down();await p.mouse.move(head.x-300,head.y+40,{steps:10});await p.mouse.up();
 assert.ok((await p.locator('.zg-gm-phone').boundingBox()).x<head.x-100);
 for(const [width,height] of [[1366,768],[1280,720],[1024,768],[1600,1000]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(180);
   const box=await p.locator('.zg-gm-phone').boundingBox(),dock=await p.locator('#zg-irl-character-dock').boundingBox();
   assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=dock.y+1,JSON.stringify({width,height,box,dock}));
   assert.equal(await p.evaluate(()=>document.querySelector('.zg-gm-sheet-host').scrollWidth>document.querySelector('.zg-gm-sheet-host').clientWidth+1),false);
 }
 await p.evaluate(()=>ZargotaI18n.setLocale('uk'));await child.waitForFunction(()=>ZargotaI18n.getLocale()==='uk');
 assert.equal(await p.locator('[data-gm-close]').getAttribute('aria-label'),'Закрити аркуш');
 await p.screenshot({path:out+'/03-uk.png'});
 await p.locator('[data-gm-close]').click();assert.equal(await p.locator('.zg-gm-phone').isVisible(),false);
 await p.evaluate(()=>ZargotaI18n.setLocale('ru'));
 await p.locator('#zg-irl-name-tool').click();await p.locator('.zg-irl-name-popover.open').waitFor();
 const names=await p.locator('#zg-irl-name-result').textContent();assert.ok(names.length>1);
 await p.locator('#zg-irl-name-save').click();
 await p.locator('#zg-irl-name-popover #zg-irl-saved-tool').click();
 await p.locator('#zg-irl-saved.open').waitFor();
 assert.ok((await p.locator('#zg-irl-saved-list').textContent()).includes(names),'saved names remain usable');
 await p.locator('.zg-irl-saved-close').click();
 assert.equal(await p.locator('.zg-gm-tools,#zg-irl-scene-switch,#zg-irl-npc-panel,#zg-irl-pin-layer,#irl-prep-launch,#irl-prep-panel').count(),0,'retired tools are not mounted');
 // Actual selection/image-drag gestures on the dock cannot disturb the board.
 await p.evaluate(()=>{getSelection().removeAllRanges();window.testImageDrags=0;document.querySelector('.zg-irl-table').addEventListener('dragstart',e=>{if(!e.defaultPrevented)window.testImageDrags++;});});
 await p.locator('[data-gm-key="esteros"] strong').dblclick();
 assert.equal(await p.evaluate(()=>getSelection().toString()),'','double click does not select board labels');
 const portrait=await p.locator('[data-gm-key="esteros"] img').boundingBox();
 await p.mouse.move(portrait.x+20,portrait.y+30);await p.mouse.down();await p.mouse.move(portrait.x+160,portrait.y-80,{steps:12});await p.mouse.up();
 assert.equal(await p.evaluate(()=>window.testImageDrags),0,'native portrait drag blocked');
 const beforeCanvas=await p.evaluate(()=>JSON.stringify(characters));
 await p.mouse.dblclick(700,300);
 assert.equal(await p.evaluate(()=>JSON.stringify(characters)),beforeCanvas,'empty canvas clicks do not mutate heroes');
 const blocked=await p.locator('.zg-irl-table').evaluate(el=>{const e=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()});e.dataTransfer.setData('text/uri-list','https://example.invalid/picture.png');el.dispatchEvent(e);return e.defaultPrevented;});
 assert.equal(blocked,true,'dropping a foreign image on the canvas cannot navigate');
 await p.evaluate(()=>zgIrlCharacterClose());
 // Reopening moves the same sheet back; no second application or account session.
 await p.locator('[data-gm-open="melissa"]').click();assert.equal(await p.locator('.zg-gm-phone iframe').count(),0);
 await sheet.locator('.zgmo-nav button').nth(2).click();
 await sheet.locator('.zgmi-art img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
 await p.screenshot({path:out+'/04-final.png',animations:'disabled'});
 assert.deepEqual(navigationRequests,[],'opening sheets never navigates or loads a second document');
 await p.locator('[data-gm-close]').click();
 assert.equal(await originalParent.evaluate(el=>document.getElementById('page-characters').parentElement===el),true,'restored original character page');
 await p.locator('#zg-story-reopen').evaluate(el=>el.classList.remove('open'));
 await p.evaluate(()=>{showPage('characters');openCharSheet(characters.find(c=>c.campaignKey==='melissa').id);});
 assert.equal(await p.locator('.zg-gm-sheet-host').count(),0);
 await p.setViewportSize({width:390,height:844});
 await p.locator('.zgmo-nav').waitFor();
 await p.locator('[data-zgmo=damage]').click();
 assert.equal(await p.locator('.zg-gm-sheet-host').count(),0,'regular sheet edit must not remount a hidden table panel');
 assert.equal(await originalParent.evaluate(el=>document.getElementById('page-characters').parentElement===el),true);
 await p.locator('[data-zgmo=heal]').click();
 await p.screenshot({path:out+'/05-phone-regression.png',animations:'disabled'});
 assert.equal(requests.length,initialRequests,'no new Firebase connection when reopening the sheet');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,heroes:5,tabs:4,viewports:4,nativeComponent:true,noNavigation:true,sharedSave:true,errors,screenshots:out}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
