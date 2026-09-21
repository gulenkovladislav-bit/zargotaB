const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage();
  await page.setContent('<main style="position:relative;width:800px;height:600px"><button style="position:absolute;left:20px;top:20px;width:200px;height:100px">Map target</button><aside style="position:absolute;left:0;top:0;width:400px;height:150px;background:black;color:white"><h2 data-play-title>Quest</h2><p>Objective</p></aside></main>');
  await page.addStyleTag({path:path.join(__dirname,'../story-quest-polish.css')});
  await page.addScriptTag({path:path.join(__dirname,'../story-quest-polish.js')});
  await page.evaluate(()=>{window.clicks=0;document.querySelector('button').onclick=()=>window.clicks++;ZargotaStoryQuestPolish.install(document.querySelector('main'));});
  await page.mouse.move(70,60);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('aside')).opacity)<.2);
  await page.mouse.click(70,60);
  assert.equal(await page.evaluate(()=>window.clicks),1);
  await page.mouse.move(700,500);
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('aside')).opacity)===1);
  console.log('PASS Edge: quest fades over underlying target, first click reaches target, opacity restores');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
