const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {provisionTestAdmin}=require('./persistent-admin-fixture.cjs');
const base=process.env.ZG_TEST_URL||'http://127.0.0.1:8765/?firebase_emulator=1',out=process.env.ZG_TEST_SCREENSHOTS||'/tmp/zg-account-release-review';
if(new URL(base).hostname!=='127.0.0.1'||new URL(base).searchParams.get('firebase_emulator')!=='1')throw Error('Local emulator required');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});const errors=[];
try{
 async function context(width){const ctx=await browser.newContext({viewport:{width,height:width<700?844:900},isMobile:width<700,hasTouch:width<700});await ctx.addInitScript(()=>localStorage.setItem('zargota_ui_locale_v1','ru'));await ctx.route(/https:\/\/.*(firebaseio.com|identitytoolkit.googleapis.com|firebasedatabase.app).*/,r=>r.abort());await ctx.route('**/persistent-character-transport.js*',async r=>{const s=await r.fetch();await r.fulfill({response:s,body:(await s.text())});});return ctx;}
 async function load(p){p.on('pageerror',e=>errors.push(e.stack));await p.goto(base);await p.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});await p.evaluate(()=>zgCharacterLoadPromise);}
 async function login(p,code){await p.evaluate(()=>ZargotaPersistentCharacters.settings());await p.locator('#persistent-login-code').fill(code);await p.locator('[data-pc-action=login]').click();}
 async function settled(p,n){await p.waitForFunction(n=>Object.values(ZargotaPersistentCharacters.status().records).some(e=>e.base?.revision>=n&&!e.pending&&!e.conflict),n,{timeout:30000});}
 const gc=await context(1280),pc=await context(390),gm=await gc.newPage(),pl=await pc.newPage();await Promise.all([load(gm),load(pl)]);
 await pl.evaluate(()=>ZargotaPersistentCharacters.settings());await pl.screenshot({path:out+'/login-phone.png'});await pl.keyboard.press('Escape');
 await login(gm,provisionTestAdmin().code);await gm.waitForFunction(()=>ZargotaPersistentCharacters.status().account.role==='admin');
 await gm.locator('[data-pc-action=account-add]').click();await gm.locator('[data-pc-action=account-new]').click();await gm.locator('#pc-new-character-name').fill('Тест синхронизации');await gm.locator('#pc-new-character-name').press('Enter');await gm.waitForFunction(()=>/^\d{4}$/.test(document.querySelector('#pc-account-detail .pc-code-mask')?.textContent||''));const code=await gm.locator('#pc-account-detail .pc-code-mask').innerText();assert.match(code,/^\d{4}$/);assert.equal(await gm.locator('#persistent-character-dialog[open]').count(),0);const id=await gm.evaluate(()=>String(characters.find(c=>c.name==='Тест синхронизации').id));
 await login(pl,code);await settled(pl,1);await gm.locator('#pc-account-list .pc-online.is-online').waitFor();await gm.screenshot({path:out+'/admin-desktop.png'});
 const initial=await pl.evaluate(()=>characters.find(c=>c.id===viewingCharId).hpCur);await pl.locator('[data-zgmo="damage"]').click();await settled(pl,2);await settled(gm,2);assert.equal(await gm.evaluate(id=>characters.find(c=>String(c.id)===id).hpCur,id),initial-1);
 await gm.locator('#pc-account-detail [data-pc-action=history]').click();await gm.locator('#persistent-character-dialog').waitFor();assert.match(await gm.locator('#persistent-character-dialog').innerText(),/Игрок/);await gm.screenshot({path:out+'/history-desktop.png'});await gm.keyboard.press('Escape');
 await gm.evaluate(async id=>{const c=characters.find(c=>String(c.id)===id);c.notes='Подарок и сведения от мастера';c.inventoryItems.push({itemId:'release-gift',name:'Ключ',qty:1});await saveChars();},id);await settled(gm,3);await settled(pl,3);assert.equal(await pl.evaluate(()=>characters.find(c=>c.id===viewingCharId).notes),'Подарок и сведения от мастера');

 // Real upload from one device must display on the other without its IndexedDB.
 await gm.keyboard.press('Escape');
 await gm.evaluate(id=>{showPage('characters');openCharSheet(Number(id));},id);
 const png=await pl.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#649440';ctx.fillRect(0,0,1200,1000);ctx.fillStyle='#efdc99';ctx.fillRect(400,200,400,600);return canvas.toDataURL('image/png').split(',')[1];});
 await pl.locator('#sheet-portrait-input').setInputFiles({name:'custom-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await settled(pl,4);await settled(gm,4);
 const portrait=await pl.evaluate(()=>characters.find(c=>c.id===viewingCharId).portrait);
 assert.match(portrait,/^data:image\/webp;base64,/);
 assert.equal(await gm.evaluate(id=>characters.find(c=>String(c.id)===id).portrait,id),portrait);
 await gm.waitForFunction(portrait=>[...document.querySelectorAll('#char-sheet img')].some(img=>img.getAttribute('src')===portrait&&img.naturalWidth>0),portrait);
 async function track(p){await p.evaluate(()=>{window.stableImages=[...document.querySelectorAll('#char-sheet img,#char-sheet-tab-bar img,#persistent-entry img,#persistent-online img')].map(img=>({img,src:img.getAttribute('src')}));window.imageLoads=0;stableImages.forEach(({img})=>img.addEventListener('load',()=>window.imageLoads++));});}
 async function stable(p){assert.deepEqual(await p.evaluate(()=>stableImages.filter(({img,src})=>!img.isConnected||img.getAttribute('src')!==src).map(({img,src})=>({connected:img.isConnected,src:src.slice(0,90),class:img.className,parent:img.parentElement?.outerHTML.slice(0,160)}))),[],'unrelated changes keep mounted images and their URLs');assert.equal(await p.evaluate(()=>imageLoads),0,'no image reload for a stat/inventory edit');}
 await Promise.all([gm.waitForTimeout(500),pl.waitForTimeout(500)]);await track(gm);await track(pl);
 await pl.evaluate(async()=>{const c=characters.find(c=>c.id===viewingCharId);c.stats.str.cur=4;c.stats.str.base=4;await saveChars();renderCharSheet();});
 await settled(pl,5);await settled(gm,5);await stable(gm);await stable(pl);
 await pl.evaluate(async()=>{const c=characters.find(c=>c.id===viewingCharId);c.inventoryItems.push({itemId:'player-item',name:'Монета',qty:2});await saveChars();renderCharSheet();});
 await settled(pl,6);await settled(gm,6);await stable(gm);await stable(pl);
 assert.equal(await gm.evaluate(id=>characters.find(c=>String(c.id)===id).stats.str.cur,id),4);
 assert.ok(await gm.evaluate(id=>characters.find(c=>String(c.id)===id).inventoryItems.some(i=>i.itemId==='player-item'),id));
 // A pre-fix portrait has only a local filename plus its portable thumbnail.
 await pl.evaluate(async png=>{const blob=await(await fetch('data:image/png;base64,'+png)).blob();const path=await new Promise(resolve=>zgImageStore.put(blob,'portraits','legacy_fixture',resolve));const c=characters.find(c=>c.id===viewingCharId);c.portrait=path;await saveChars();renderCharSheet();},png);
 await settled(pl,7);await settled(gm,7);
 await pl.waitForFunction(()=>document.querySelector('.zgmo-portrait-image')?.src.startsWith('blob:'));
 await gm.waitForFunction(()=>[...document.querySelectorAll('#char-sheet img')].some(img=>img.dataset.zgResolvedSource==='images/portraits/legacy_fixture.png'&&img.src.startsWith('data:')&&img.naturalWidth>0));
 await gm.waitForFunction(()=>[...document.querySelectorAll('#persistent-online img')].every(img=>img.complete&&img.naturalWidth>0));
 await gm.waitForTimeout(250);await pl.waitForTimeout(250);await track(gm);await track(pl);
 await pl.locator('[data-zgmo="damage"]').click();await settled(pl,8);await settled(gm,8);await stable(gm);await stable(pl);
 await gm.screenshot({path:out+'/portrait-sync-desktop.png'});await pl.screenshot({path:out+'/portrait-sync-phone.png'});
 const uid=await pl.evaluate(()=>ZargotaPersistentCharacters.status().uid);await pl.reload();await pl.locator('#zg-data-loader-splash').waitFor({state:'hidden'});await settled(pl,8);assert.equal(await pl.evaluate(()=>ZargotaPersistentCharacters.status().uid),uid);await pl.evaluate(()=>ZargotaPersistentCharacters.settings());await pl.screenshot({path:out+'/player-account-phone.png'});
 assert.equal(await pl.locator('[data-pc-action=account-add],[data-pc-action=master-code],[data-pc-action=account-code]').count(),0);
 await pl.keyboard.press('Escape');await pl.evaluate(id=>{showPage('characters');openCharSheet(Number(id));},id);await pl.screenshot({path:out+'/player-sheet-phone.png'});
 await gm.reload();await gm.locator('#zg-data-loader-splash').waitFor({state:'hidden'});await settled(gm,8);assert.equal(await gm.evaluate(()=>ZargotaPersistentCharacters.status().account.role),'admin');
 await gm.evaluate(()=>ZargotaPersistentCharacters.settings());await pc.close();await gm.waitForFunction(()=>!document.querySelector('#pc-account-list .pc-online.is-online'),null,{timeout:30000});await gm.locator('#pc-account-list .pc-last-seen').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: real Edge two-device portrait upload + legacy fallback, stable desktop/mobile image nodes during stat/inventory/HP changes, login/history/reload/presence');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
