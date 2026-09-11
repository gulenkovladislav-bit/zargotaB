const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(process.env.STORY_TEST_URL||'http://127.0.0.1:5175/index.html');
  await page.waitForFunction(()=>window.ZargotaStoryPlayer&&window.ZargotaStoryEnvironment);
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden'});
  await page.evaluate(()=>{const p=JSON.parse(JSON.stringify(ZargotaStoryCampaign));p.walkable=null;p.scene.story={zones:[{id:'cliff',x:50,y:60,radius:3,blocked:true,mode:'click',blockedMessage:'Камни осыпаются. Не подходи ближе.',blockedMessageUk:'Каміння осипається. Не підходь ближче.'}]};ZargotaStoryPlayer.start(p);});
  const before=await page.evaluate(()=>ZargotaStoryPlayer.getState().position);
  const point=await page.locator('[data-play-world]').evaluate(e=>{const b=e.getBoundingClientRect();return{x:b.x+b.width*.5,y:b.y+b.height*.6};});
  await page.mouse.move(point.x,point.y);await page.mouse.click(point.x,point.y);
  assert.equal(await page.locator('[data-play-hint]').textContent(),'Камни осыпаются. Не подходи ближе.');
  assert.deepEqual(await page.evaluate(()=>ZargotaStoryPlayer.getState().position),before);
  assert.equal(await page.locator('.zg-story-zone-marker').count(),0);
  assert.match(await page.locator('[data-play-hint]').evaluate(e=>getComputedStyle(e,'::before').maskImage),/ragged-panel-mask/);
  await page.screenshot({path:'/private/tmp/zargota-story-blocked-hint.png'});
  await page.evaluate(()=>ZargotaStoryPlayer.stop());
  await page.getByRole('button',{name:'⚒ Мастерская',exact:true}).click();
  await page.getByRole('button',{name:/Создание сюжета Сцена/}).click();
  await page.getByRole('combobox',{name:'Сюжет кампании',exact:true}).selectOption('vrotik-episode-1');
  await page.getByRole('button',{name:'☁ Сцена: переходы и эффекты',exact:true}).click();
  await page.getByRole('button',{name:'＋ Запретная зона',exact:true}).click();
  await page.getByRole('textbox',{name:'Сообщение игроку при попытке пройти · RU',exact:true}).fill('Дорогу перекрывает завал.');
  await page.getByRole('textbox',{name:'Сообщение игроку при попытке пройти · RU',exact:true}).press('Tab');
  assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.zones[0].blockedMessage),'Дорогу перекрывает завал.');
  assert.equal(await page.evaluate(()=>zgStoryEditorProject().scene.story.zones[0].blocked),true);
  await page.locator('#zg-story-stage-settings header button').click();
  await page.evaluate(()=>zgStoryEditorClose());
  await page.evaluate(()=>{ZargotaStoryPlayer.stop();window.ZargotaI18n={getLocale:()=> 'uk'};const p=JSON.parse(JSON.stringify(ZargotaStoryCampaign));p.scene.story={blockedMessage:'Стоп',blockedMessageUk:'Обережно, урвище'};ZargotaStoryPlayer.start(p);});
  const outside=await page.locator('[data-play-world]').evaluate(e=>{const b=e.getBoundingClientRect();return{x:b.x+b.width*.85,y:b.y+b.height*.6};});await page.mouse.click(outside.x,outside.y);
  assert.equal(await page.locator('[data-play-hint]').textContent(),'Обережно, урвище');
  console.log('Browser passed: custom forbidden-zone text, no movement, hidden marker, smoky mask and Ukrainian boundary message');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
