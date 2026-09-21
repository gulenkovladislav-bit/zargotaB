const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage();
  await page.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(()=>{
   const episode=title=>({title,titleUk:title,scene:{layers:[],tokens:[],story:{}},nodes:[]});
   localStorage.setItem('zargota_story_editor_v1',JSON.stringify({a:episode('Alpha'),b:episode('Beta')}));
   zgStoryEditorOpen('a');
  });
  for(const name of ['Beta','Alpha']){
   await page.evaluate(()=>document.querySelector('[data-story-project-select]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
   const remove=page.locator('.zg-custom-menu button').filter({hasText:'⌫'}).filter({visible:true});
   const target=page.locator('.zg-custom-menu button[title$="'+name+'"]');
   await target.click();
   assert.equal(await page.evaluate(name=>JSON.parse(localStorage.getItem('zargota_story_editor_v1'))[name==='Alpha'?'a':'b']._deleted,name),undefined);
   await target.click();
   assert.equal(await page.evaluate(name=>JSON.parse(localStorage.getItem('zargota_story_editor_v1'))[name==='Alpha'?'a':'b']._deleted,name),true);
   assert.equal(await page.locator('.zg-custom-menu button[title$="'+name+'"]').count(),0);
   await page.keyboard.press('Escape');
  }
  assert.notEqual(await page.evaluate(()=>zgStoryEditorProject().title),'Alpha');
  await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zargota_story_editor_v1')).a._deleted),true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zargota_story_editor_v1')).a.title),'Alpha');
  console.log('PASS Edge: confirmation, inactive/active episode removal, fallback, reload persistence and recoverable data');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
