'use strict';
// Read-only reproduction from private `character-patch.cjs show` snapshots.
// Keep snapshots outside Git; preserve each character's actual equipment flags.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const snapshotDir=process.env.ZG_INVENTORY_SNAPSHOTS;
assert.ok(snapshotDir,'Set ZG_INVENTORY_SNAPSHOTS to private character-patch show JSON files');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8877';
const snapshots=['esteros','melissa','evan','lin-yin','vrotik'].map(key=>{
 const {character:c}=JSON.parse(fs.readFileSync(path.join(snapshotDir,key+'.json'),'utf8'));
 return {key,id:c.id,name:c.name,campaignKey:c.campaignKey,inventoryItems:c.inventoryItems||[],equipItems:c.equipItems||[],arenaEquipSlots:c.arenaEquipSlots||{}};
});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const p=await browser.newPage({viewport:{width:390,height:694},hasTouch:true,deviceScaleFactor:3});
  if(base.includes('127.0.0.1'))await p.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await p.goto(base);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await p.evaluate(async snapshots=>{await zgCharacterLoadPromise;for(const c of snapshots){const existing=characters.find(x=>x.id===c.id);Object.assign(existing,c);}showPage('characters');_charSheetTab='inventory';},snapshots);
  const before=await p.evaluate(()=>JSON.stringify(characters.map(c=>[c.id,c.inventoryItems,c.equipItems,c.arenaEquipSlots])));
  const paint=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const output=process.env.ZG_INVENTORY_OUTPUT||'/private/tmp/zg-real-inventory-ui';fs.mkdirSync(output,{recursive:true});
  for(const locale of ['ru','uk'])for(const [width,height] of [[390,694],[390,780],[320,568]])for(const c of snapshots){
   await p.setViewportSize({width,height});await p.evaluate(({id,locale})=>{ZargotaI18n.setLocale(locale);_charSheetTab='inventory';openCharSheet(id);},{id:c.id,locale});await paint();
   await p.locator('[data-zgmi=group][data-group=bag]').tap();await paint();
   const expected=['inventoryItems','equipItems'].flatMap(field=>c[field].flatMap((item,i)=>item&&!item.equipped?[field+'-'+i]:[]));
   const pages=[];
   for(let n=0;n<30;n++){
    await paint();const geometry=await p.locator('.zgmi-grid').evaluate(el=>({height:el.clientHeight,overflow:el.scrollHeight-el.clientHeight,gap:parseFloat(getComputedStyle(el).rowGap)||0,rows:[...el.querySelectorAll('[data-zgmi=item]')].map(row=>({key:row.dataset.key,height:row.getBoundingClientRect().height}))}));
    assert.ok(geometry.overflow<=1,JSON.stringify({character:c.key,locale,width,height,geometry}));pages.push(geometry);
    if(c.key==='esteros'&&locale==='ru'&&width===390&&height===694)await p.screenshot({path:output+'/esteros-page-'+(n+1)+'.png',animations:'disabled'});
    if(!await p.locator('[data-zgmi=next]').isEnabled())break;
    await p.locator('[data-zgmi=next]').tap();
   }
   assert.deepEqual(pages.flatMap(page=>page.rows.map(row=>row.key)),expected,'Every unequipped entry appears once, in order');
   for(let i=0;i<pages.length-1;i++){
    const page=pages[i],used=page.rows.reduce((sum,row)=>sum+row.height,0)+Math.max(0,page.rows.length-1)*page.gap,next=pages[i+1].rows[0];
    assert.ok(used+page.gap+next.height>page.height+.5,JSON.stringify({character:c.key,locale,width,height,page:i,used,available:page.height,nextHeight:next.height}));
   }
   if(c.key==='esteros'&&locale==='ru'&&width===390&&height===694){assert.equal(c.inventoryItems.length,8);assert.equal(expected.length,6);assert.deepEqual(pages.map(page=>page.rows.length),[4,2]);}
   console.log(JSON.stringify({character:c.key,locale,width,height,bag:expected.length,pages:pages.map(page=>page.rows.length)}));
  }
  assert.equal(await p.evaluate(()=>JSON.stringify(characters.map(c=>[c.id,c.inventoryItems,c.equipItems,c.arenaEquipSlots]))),before,'Browsing never rewrites item data');
  console.log('PASS: five canonical inventories, actual equipment flags, every page filled, no omissions/duplicates/scroll, no data writes; '+await p.evaluate(()=>ZG_APP_VERSION));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
