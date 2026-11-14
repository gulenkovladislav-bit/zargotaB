'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {provisionTestAdmin}=require('./persistent-admin-fixture.cjs');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765/?firebase_emulator=1';
if(new URL(base).hostname!=='127.0.0.1'||new URL(base).searchParams.get('firebase_emulator')!=='1')throw Error('Local emulator required');
async function load(page){await page.goto(base);await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await page.evaluate(()=>zgCharacterLoadPromise);}
(async()=>{
 const pin=String(require('node:crypto').randomInt(1000,10000));
 const admin=provisionTestAdmin({code:pin});
 assert.match(admin.code,/^ZG-/);
 assert.deepEqual(provisionTestAdmin({uid:admin.uid,code:pin}),admin);
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:750},isMobile:true,hasTouch:true});
  await context.route(/https:\/\/.*(firebaseio.com|identitytoolkit.googleapis.com|firebasedatabase.app).*/,r=>r.abort());
  const page=await context.newPage();await load(page);
  await page.locator('#persistent-entry').click();await page.locator('#persistent-login-code').fill(pin);await page.locator('[data-pc-action=login]').click();
  await page.waitForFunction(()=>document.querySelector('#persistent-character-dialog [role=alert]')?.textContent.length>0);
  assert.notEqual((await page.evaluate(()=>ZargotaPersistentCharacters.status())).account.role,'admin');
  await page.locator('#persistent-login-code').fill(admin.code);await page.locator('[data-pc-action=login]').click();await page.locator('.pc-account-admin').waitFor();
  assert.equal((await page.evaluate(()=>ZargotaPersistentCharacters.status())).uid,admin.uid);
  await page.locator('[data-pc-action=master-code]').click();assert.equal(await page.locator('#persistent-issued-code').inputValue(),admin.code);
  await page.evaluate(pin=>ZargotaPersistentCharacters.login(pin),pin);
  await page.reload();await page.waitForFunction(()=>window.ZargotaPersistentCharacters?.status().account.role==='admin');
  assert.equal((await page.evaluate(()=>ZargotaPersistentCharacters.status())).uid,admin.uid);
  console.log('PASS: fresh device denied PIN; private recovery pairs the master; paired PIN and remembered login work');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
