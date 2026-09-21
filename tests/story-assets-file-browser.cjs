const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const p=await b.newPage();
 await p.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
 await p.evaluate(()=>{
  window.reads=0;window.prompts=0;window.names=['first.mp3'];
  window.showDirectoryPicker=async()=>{prompts++;return {name:'stories',queryPermission:async()=>'granted',async *values(){reads++;for(const name of names)yield {name,kind:'file'};}};};
 });
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 assert.equal(await p.locator('.zg-asset-tile').count(),1);
 await p.locator('#zg-story-assets button').first().click();
 await p.evaluate(()=>names.push('Gall Goídil.mp3'));
 await p.waitForTimeout(1800);
 assert.equal(await p.evaluate(()=>reads),1,'No background scanning');
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 assert.equal(await p.locator('.zg-asset-tile').count(),2);
 assert.equal(await p.evaluate(()=>reads),2);
 assert.equal(await p.evaluate(()=>prompts),1);
 await p.reload();
 await p.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('Cancelled','AbortError');};});
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 assert.equal(await p.locator('.zg-asset-tile').count(),0,'Do not silently show stale catalog after cancellation');
 console.log('PASS: file URL, mocked permission picker once, fresh read on reopen only, cancellation does not show stale catalog.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
