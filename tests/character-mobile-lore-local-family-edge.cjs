const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ZG_TEST_URL||'http://127.0.0.1:8880');await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
 const counts={esteros:4,evan:2,melissa:3,vrotik:2,'lin-yin':2};
 const originals=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/campaign-heroes.v1.json'))).heroes.map(c=>({...c,
  biography:['История персонажа. '.repeat(35),'Дорога продолжается. '.repeat(25),'Завершение истории. '.repeat(30)].join('\n\n'),
  biographyUk:['Історія персонажа. '.repeat(35),'Дорога триває. '.repeat(25),'Завершення історії. '.repeat(30)].join('\n\n')}));
 await page.evaluate(()=>{window._loreSaves=0;window.saveChars=async()=>{window._loreSaves++;return {ok:true}};showPage('characters');});
 // Fresh app's actual starter heroes, without injecting server family records.
 for(const hero of originals){
  const before=await page.evaluate(id=>{const c=characters.find(c=>String(c.id)===String(id));return (c.family||[]).length},hero.id);
  assert.equal(before,0,'Fresh local hero must reproduce the missing family case');
  await page.evaluate(id=>{window._charSheetTab='lore';openCharSheet(id)},hero.id);
  await page.locator('[data-zgml=tree]').first().tap();
  assert.equal(await page.locator('.zgml-tree [data-key]').count(),counts[hero.campaignKey]);
  await page.waitForTimeout(250);if(hero.campaignKey==='lin-yin')await page.screenshot({path:'/private/tmp/zg-lore-local-family-fixed.png'});
  await page.locator('#zgml-dialog [data-zgml=close]').tap();
  for(const locale of ['ru','uk']){
   await page.evaluate(locale=>ZargotaI18n.setLocale(locale),locale);await page.locator('[data-zgml=portrait]').tap();
   assert.ok((await page.locator('#zgml-art-viewer blockquote').innerText()).length>20);
   const quoteBox=await page.locator('#zgml-art-viewer figcaption').boundingBox();assert.ok(quoteBox.y+quoteBox.height<=844);
   await page.locator('[data-zgml=art-close]').tap();
  }
  console.log(hero.campaignKey+': local starter family '+counts[hero.campaignKey]+', portrait quotes RU/UK');
 }
 assert.equal(await page.evaluate(()=>window._loreSaves),0,'Viewing must not save or replace live sheets');
 const lin=originals.find(c=>c.campaignKey==='lin-yin');
 await page.evaluate(id=>{window._charSheetTab='lore';openCharSheet(id)},lin.id);
 await page.locator('[data-zgml=tree]').first().tap();await page.locator('.zgml-tree [data-key]').first().click();await page.locator('[data-zgml=life-picker]').tap();await page.locator('[data-zgml=life-set][data-life=alive]').tap();
 assert.equal(await page.evaluate(id=>characters.find(c=>c.id===id).family[0].lifeStatus,lin.id),'alive');assert.equal(await page.evaluate(()=>window._loreSaves),1);
 await page.locator('#zgml-dialog [data-zgml=close]').tap();
 // An explicit empty collection stays empty, and customized collections win.
 for(let i=0;i<2;i++){
  await page.locator('[data-zgml=tree]').first().tap();await page.locator('.zgml-tree [data-key]').first().click();
  await page.locator('#zgml-dialog details summary').click();await page.locator('[data-zgml=remove-person]').click();await page.locator('[data-zgml=confirm-delete]').click();
 }
 assert.equal(await page.evaluate(id=>characters.find(c=>c.id===id).familyInitialized,lin.id),true);
 await page.locator('[data-zgml=tree]').first().tap();assert.equal(await page.locator('.zgml-tree [data-key]').count(),0);await page.locator('#zgml-dialog [data-zgml=close]').tap();
 await page.evaluate(id=>{characters.find(c=>c.id===id).family=[{id:'custom',name:'Своя запись',relation:'Семья'}];ZargotaMobileLore.refresh()},lin.id);
 await page.locator('[data-zgml=tree]').first().tap();assert.equal(await page.locator('.zgml-tree [data-key]').count(),1);await page.locator('#zgml-dialog [data-zgml=close]').tap();
 await page.evaluate(data=>{window.characters=data;window._charSheetTab='lore';openCharSheet(data[0].id)},originals);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:780,height:390}]){
  await page.setViewportSize(size);
  for(const c of originals){
   await page.evaluate(id=>{window._charSheetTab='lore';openCharSheet(id);ZargotaI18n.setLocale('ru')},c.id);
   await page.locator('[data-zgml=story]').tap();await page.waitForTimeout(250);
   const dims=await page.locator('#zgml-dialog').evaluate(el=>{let body=el.querySelector('.zgml-dialog-body'),footer=el.querySelector('.zgml-story-actions');body.scrollTop=body.scrollHeight;return {dialog:el.getBoundingClientRect().toJSON(),body:body.getBoundingClientRect().toJSON(),footer:footer.getBoundingClientRect().toJSON(),end:body.scrollTop+body.clientHeight>=body.scrollHeight-2,width:innerWidth,height:innerHeight}});
   assert.ok(dims.dialog.y>=0&&dims.dialog.bottom<=dims.height,'Dialog fits viewport');assert.ok(dims.dialog.right<=dims.width,'Dialog width fits');assert.ok(dims.body.bottom<=dims.footer.y+1,'Footer does not cover text');assert.ok(dims.end,'End of story reachable');
   assert.equal((await page.locator('.zgml-story-full>p').allTextContents()).join('\n\n'),c.biography.trim());
   if(size.width===390&&c.campaignKey==='lin-yin'){await page.locator('.zgml-dialog-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'/private/tmp/zg-lore-story-fixed.png'});}
   await page.locator('#zgml-dialog [data-zgml=close]').tap();
   await page.locator('[data-zgml=portrait]').tap();
   const art=await page.locator('#zgml-art-viewer').evaluate(el=>({h:el.clientHeight,s:el.scrollHeight}));assert.ok(art.s<=art.h+1,'Portrait quote fits');await page.locator('[data-zgml=art-close]').tap();
  }
  console.log(size.width+'x'+size.height+': five complete stories, reachable endings, separate footer, portrait quotes fit');
 }
 assert.deepEqual(errors,[]);console.log('PASS local families, edit persistence, explicit empty/custom collection preservation and five mobile biographies/quotes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
