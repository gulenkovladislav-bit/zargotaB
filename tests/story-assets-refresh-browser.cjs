const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5183/index.html');
  await page.waitForFunction(()=>window.ZargotaStoryAssets);
  const exported=JSON.parse(fs.readFileSync('/Users/merkov/Downloads/episode-mtw2jv2r-n0lm (1).json','utf8'));
  const repaired=await page.evaluate(d=>ZargotaStoryAssets.repair(d),exported);
  const refs=new Set();function walk(v){if(typeof v==='string'&&v.startsWith('assets/'))refs.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(repaired);
  for(const ref of refs){assert.ok(fs.existsSync(decodeURIComponent(ref)),ref);assert.ok((await page.request.get('http://127.0.0.1:5183/'+ref)).ok(),ref);}
  await page.route('**/assets/stories/catalog.json?*',r=>r.abort());
  const scanned=await page.evaluate(()=>ZargotaStoryAssets.freshCatalog());assert.ok(scanned.files.length>=79);
  await page.route('**/assets/stories/**',r=>r.request().url().includes('catalog.js')?r.continue():r.abort());
  const fallback=await page.evaluate(()=>ZargotaStoryAssets.freshCatalog());assert.ok(fallback.files.length>=79);
  await page.unrouteAll();
  await page.evaluate(()=>ZargotaStoryAssets.pick('image',()=>{}));await page.locator('#zg-story-assets .zg-asset-tile').first().waitFor();
  assert.ok(await page.locator('#zg-story-assets .zg-asset-tile').count());
  await page.goto('file:///Users/merkov/Documents/GitHub/zargotaB/index.html');
  await page.waitForFunction(()=>window.ZargotaStoryAssets);
  await page.evaluate(()=>ZargotaStoryAssets.pick('image',()=>{}));await page.locator('#zg-story-assets .zg-asset-tile').first().waitFor();
  console.log('PASS: all exported media resolve over HTTP; missing JSON scans folders; unavailable fetch falls back to refreshed script catalog; picker renders over HTTP and file://.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
