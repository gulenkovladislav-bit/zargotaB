const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.goto(process.env.STORY_TEST_URL||'http://127.0.0.1:5175/index.html');
  await page.waitForFunction(()=>window.ZargotaStoryCampaign&&window.ZargotaStoryPlayer);
  await page.evaluate(()=>ZargotaStoryPlayer.start(ZargotaStoryCampaign));
  await page.getByRole('button',{name:'Брат Вротика · Взаимодействовать',exact:true}).click();
  await page.waitForFunction(()=>ZargotaStoryPlayer.getState().nodeId==='dialog-1');
  for(const [label,size] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   await page.setViewportSize(size);
   const styles=await page.evaluate(()=>['.zg-story-dialogue','.zg-story-quest'].map(s=>{const e=document.querySelector(s),pseudo=getComputedStyle(e,'::before');return{mask:pseudo.maskImage,events:pseudo.pointerEvents};}));
   for(const s of styles){assert.match(s.mask,/data:image\/svg\+xml/);assert.equal(s.events,'none');}
   assert.equal(await page.locator('.zg-story-answers button').isVisible(),true);
   await page.locator('.zg-story-answers button').hover();
   const answer=await page.locator('.zg-story-answers button').evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth,mask:getComputedStyle(e,'::after').maskImage}));
   assert.equal(answer.background,'rgba(0, 0, 0, 0)');
   assert.equal(answer.border,'0px');
   assert.match(answer.mask,/data:image\/svg\+xml/);
   await page.screenshot({path:'/private/tmp/zargota-story-panels-'+label+'.png'});
  }
  console.log('Story panels: embedded backgrounds and borderless hover verified, desktop/mobile screenshots captured');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
