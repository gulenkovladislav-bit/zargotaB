'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const data=require('../data.json'),entries=Array.isArray(data.catalog)?data.catalog:data.catalog.entries,spellId=entries.find(x=>x.spellType==='folio').id;
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8877';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Synthetic fixtures only on local server');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true});
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(async spellId=>{
   await zgCharacterLoadPromise;window.ZargotaCharacterCloud=null;window.ZargotaPersistentCharacters=null;
   const c=JSON.parse(JSON.stringify(characters[0]));Object.assign(c,{id:987654389,name:'Sound QA',coins:{gold:5},hpCur:10,hpMax:20,baseHpMax:20,tempEffects:[],effectHistory:[],spellsLearned:{},preparedSpells:{folio:[],kodex:[],obrad:[]}});delete c.campaignKey;characters.push(c);window.qaSoundHero=c.id;
   c.spellRefs=[spellId];window.qaSoundSpell=spellId;
   window.qaCues=[];for(const key of ['coinChange','spellLearned','characterDamage']){const play=ZargotaSound[key];ZargotaSound[key]=()=>{qaCues.push(key);play();};}
   if(ZargotaSound.isMuted())ZargotaSound.toggleMute();showPage('characters');_charSheetTab='inventory';openCharSheet(c.id);
  },spellId);
  await page.locator('[data-zgmi=coin][data-coin=gold]').tap();await page.locator('[data-zgmi=coin-plus]').tap();
  assert.deepEqual(await page.evaluate(()=>qaCues),[],'coin draft remains silent');
  let plays=await page.evaluate(()=>ZargotaSound.diagnostics().plays);
  await page.locator('[data-zgmi=coin-save]').tap();await page.waitForFunction(n=>ZargotaSound.diagnostics().plays>n,plays);
  assert.deepEqual(await page.evaluate(()=>qaCues),['coinChange']);
  await page.evaluate(()=>{renderCharSheet();renderCharSheet();});assert.deepEqual(await page.evaluate(()=>qaCues),['coinChange']);
  await page.evaluate(()=>ZargotaMobileSkills.openSpell(qaSoundHero,qaSoundSpell));
  await page.locator('#zgms-dialog [data-zgms=detail-tab][data-tab=learn]').tap();
  plays=await page.evaluate(()=>ZargotaSound.diagnostics().plays);
  await page.locator('#zgms-dialog [data-zgms=learn]').tap();await page.waitForFunction(n=>ZargotaSound.diagnostics().plays>n,plays);
  assert.deepEqual(await page.evaluate(()=>qaCues),['coinChange','spellLearned']);
  await page.locator('#zgms-dialog [data-zgms=close]').tap();
  plays=await page.evaluate(()=>ZargotaSound.diagnostics().plays);
  await page.evaluate(()=>changeHP(qaSoundHero,-1));await page.waitForFunction(n=>ZargotaSound.diagnostics().plays>n,plays);
  assert.deepEqual(await page.evaluate(()=>qaCues),['coinChange','spellLearned','characterDamage']);
  const muted=await page.evaluate(async()=>{ZargotaSound.toggleMute();const before=ZargotaSound.diagnostics().plays;await setCoin(qaSoundHero,'gold',8);return{before,after:ZargotaSound.diagnostics().plays,state:ZargotaSound.diagnostics().contextState};});
  assert.equal(muted.after,muted.before);assert.equal(muted.state,'muted');
  console.log('PASS: mobile coin save and study taps plus HP loss start decoded audio; redraw silent; mute respected');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
