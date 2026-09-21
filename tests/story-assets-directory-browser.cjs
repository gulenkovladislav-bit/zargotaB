const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const p=await b.newPage();
 await p.route('**/assets/stories/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({files:[{name:'old.mp3',path:'assets/stories/old.mp3',type:'audio'}]})}));
 await p.goto('http://127.0.0.1:5184/index.html');
 await p.evaluate(async()=>{
  const root=await navigator.storage.getDirectory();window.testDirectory=await root.getDirectoryHandle('stories',{create:true});
  window.showDirectoryPicker=async()=>testDirectory;
  await testDirectory.getFileHandle('first.mp3',{create:true});
 });
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 assert.match(await p.locator('#zg-story-assets [role=status]').innerText(),/каталог/);
 await p.locator('#zg-story-assets button').filter({hasText:/assets\/stories/}).click();
 await p.locator('.zg-asset-tile').filter({hasText:'first.mp3'}).waitFor();
 await p.locator('#zg-story-assets button').first().click();
 await p.evaluate(async()=>{const nested=await testDirectory.getDirectoryHandle('sounds',{create:true});await nested.getFileHandle('new.mp3',{create:true});});
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 assert.equal(await p.locator('.zg-asset-tile').count(),2);
 await p.locator('.zg-asset-tile').filter({hasText:'new.mp3'}).waitFor();
 await p.reload();
 await p.evaluate(()=>ZargotaStoryAssets.pick('audio',()=>{}));
 await p.locator('.zg-asset-tile').filter({hasText:'new.mp3'}).waitFor();
 assert.equal(await p.locator('.zg-asset-tile').count(),2);
 console.log('PASS: stale manifest identified; new nested file found on reopen; directory handle restored after reload.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
