const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  await page.goto(process.env.STORY_TEST_URL||'http://127.0.0.1:5176/index.html');
  await page.waitForFunction(()=>window.ZargotaStoryAssets&&window.ZargotaStoryStageEditor);
  await page.evaluate(()=>{
   window.__draft=JSON.parse(JSON.stringify(ZargotaStoryCampaign));
   window.__save=function(fn){fn(__draft);ZargotaStoryStageEditor.open(__draft,__save,[]);};
   ZargotaStoryStageEditor.open(__draft,__save,[]);
  });
  await page.getByLabel('Добавить персонажа').selectOption({index:1});
  await page.getByLabel('Название · RU',{exact:true}).fill('Test actor');
  await page.getByLabel('Название · RU',{exact:true}).press('Tab');
  assert.equal(await page.evaluate(()=>__draft.scene.tokens.at(-1).name),'Test actor');
  await page.getByLabel('Диалог при нажатии').selectOption({index:1});
  assert.ok(await page.evaluate(()=>__draft.interactions[__draft.scene.tokens.at(-1).id].entryId));
  await page.getByRole('button',{name:'▧ Из папки ресурсов',exact:true}).last().click();
  await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Ресурсы проекта'})}).waitFor();
  await page.getByText('Добавьте файлы в assets/stories и выполните npm run story:assets.',{exact:true}).waitFor();
  await page.locator('#zg-story-assets').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.screenshot({path:'/private/tmp/zargota-scene-assets-editor.png'});
  console.log('Scene actor placement, right inspector, dialogue binding and resource picker passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
