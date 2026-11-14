'use strict';

// Visual/interaction regression only. All account traffic and cache are local fixtures;
// no Firebase SDK, project, user browser profile, production writes or billing is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:18765/';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'fixture tests require a local origin');
const out = process.env.ZG_TEST_SCREENSHOTS || '/tmp/zargota-account-ui';
const errors=[];

function fixtureScript() {
  return `(${function () {
    const clone = value => JSON.parse(JSON.stringify(value));
    const fixture = window.__pcFixture = {calls: [], heroes: [], packets: {}};
    function role() { return localStorage.getItem('pc-test-role') || 'visitor'; }
    function uid() { return role() === 'admin' ? 'fixture-admin' : role() === 'player' ? 'fixture-player' : 'fixture-guest'; }
    function meta(sid) { return {ownerUid:'fixture-admin', playerUid:sid === 'sheet-1' ? 'fixture-player' : 'fixture-player-two', locked:true}; }
    const prepared = new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once:true})).then(async () => {
      await window.zgCharacterLoadPromise;
      fixture.heroes = window.characters.filter(c => c.type === 'hero').slice(0, 5);
      fixture.heroes.push(Object.assign(clone(fixture.heroes[0]),{id:9000001,name:'Тест'}));
      window.characters.push(fixture.heroes[5],{id:9000002,name:'NPC must not appear',type:'npc'},{id:9000003,name:'Available player',type:'hero'});
      if (fixture.heroes.length < 2) throw Error('fixture requires two existing heroes');
      const accounts = {'fixture-admin': {}, 'fixture-player': {}};
      fixture.heroes.forEach((hero, index) => {
        const sid = 'sheet-' + (index + 1), clean = window.ZargotaPersistentCore.clean(hero);
        const packet = fixture.packets[sid] = {characterJson:JSON.stringify(clean), revision:1, updatedBy:'fixture-admin', writerRole:'master'};
        const entry = {localId:hero.id, remoteId:hero.id, remoteKey:hero.campaignKey || '', allowed:true, role:'master', meta:meta(sid), base:packet};
        accounts['fixture-admin'][sid] = entry;
        if (!index) accounts['fixture-player'][sid] = Object.assign({}, clone(entry), {role:'player'});
      });
      const stored = JSON.parse(localStorage.getItem('pc-test-cache') || 'null');
      return stored || {enabled:role() !== 'visitor', activeUid:role() === 'visitor' ? '' : uid(), accounts,
        identities:{'fixture-admin':{role:'admin'}, 'fixture-player':{role:'player', sheetId:'sheet-1'}}};
    });
    window.ZargotaPersistentCache = {
      read: () => prepared.then(clone),
      write: async state => { localStorage.setItem('pc-test-cache', JSON.stringify(state)); }
    };
    function watch(value, listener) { const timer = setTimeout(() => listener(clone(value)), 0); return () => clearTimeout(timer); }
    const api = {
      uid,
      account: async () => ({role:role(), sheetId:role() === 'player' ? 'sheet-1' : undefined}),
      login: async code => {
        fixture.calls.push({action:'login'});
        if (code !== 'FIXTURE-PLAYER') throw Error('invalid-code');
        localStorage.setItem('pc-test-role', 'player');
        return {sheetId:'sheet-1'};
      },
      logout: async () => { fixture.calls.push({action:'logout'}); localStorage.setItem('pc-test-role', 'visitor'); },
      list: async () => role() === 'admin' ? Object.fromEntries(Object.keys(fixture.packets).map(sid=>[sid,'master'])) : role() === 'player' ? {'sheet-1':'player'} : {},
      meta: async sid => meta(sid),
      read: async sid => clone(fixture.packets[sid]),
      watch: (sid, cb) => watch(fixture.packets[sid], cb),
      watchMeta: (sid, cb) => watch(meta(sid), cb),
      watchLastSeen: (sid, cb) => watch({[meta(sid).playerUid]:Date.now()-3600000}, cb),
      watchActivity: (sid, cb) => watch({lastPlayerRevision:2,seenRevision:1}, cb),
      presence: (sid, cb) => watch(sid === 'sheet-1' ? {'fixture-admin':{tab:{online:true}},'fixture-player':{tab:{online:true}}} : {'fixture-admin':{tab:{online:true}}}, cb),
      history: async () => ({}),
      call: async data => {
        fixture.calls.push({action:data.action,sheetId:data.sheetId});
        if (data.action === 'create') {
          const state=fixture.packets[data.sheetId]={characterJson:JSON.stringify(data.character),revision:1,updatedBy:uid(),writerRole:'master'};
          return {code:'4826',meta:meta(data.sheetId),state};
        }
        if (data.action === 'code') return {code:data.sheetId === 'sheet-1' ? 'FIXTURE-PLAYER' : 'FIXTURE-SECOND'};
        if (data.action === 'master-code') return {code:'FIXTURE-ADMIN'};
        if (data.action === 'save') {
          const state = fixture.packets[data.sheetId] = {characterJson:JSON.stringify(data.character),revision:data.expectedRevision+1,operationId:data.operationId,updatedBy:uid()};
          return {state};
        }
        throw Error('Unexpected fixture action: ' + data.action);
      }
    };
    window.ZargotaPersistentTransport = {available:() => true, start:async () => { await prepared; return api; }};
  }.toString()})();`;
}

async function context(browser, width, height, role = 'visitor') {
  const ctx = await browser.newContext({viewport:{width,height}, isMobile:width < 701, hasTouch:width < 701, reducedMotion:'reduce'});
  ctx.on('page',page => page.on('pageerror',error => errors.push(error.message)));
  await ctx.addInitScript(({role,origin}) => { if (location.origin===origin && !localStorage.getItem('pc-test-role')) localStorage.setItem('pc-test-role', role); }, {role,origin});
  // Abort every remote request, not only Firebase: the test never uses live services.
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.endsWith('/persistent-character-cache.js')) return route.fulfill({contentType:'application/javascript',body:fixtureScript()});
    if (url.pathname.endsWith('/persistent-character-transport.js')) return route.fulfill({contentType:'application/javascript',body:'/* transport supplied by isolated test cache fixture */'});
    return route.continue();
  });
  return ctx;
}

async function load(page) {
  await page.goto(base, {waitUntil:'domcontentloaded'});
  await page.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
  await page.evaluate(() => window.zgCharacterLoadPromise);
  await page.waitForFunction(() => window.__pcFixture && window.__pcFixture.heroes.length === 6);
}

async function fits(page, selector, label) {
  const bounds = await page.locator(selector).evaluate(el => {
    const r=el.getBoundingClientRect();
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};
  });
  assert.ok(bounds.x >= -1 && bounds.right <= bounds.width + 1 && bounds.y >= -1 && bounds.bottom <= bounds.height + 1, `${label} stays within viewport: ${JSON.stringify(bounds)}`);
  assert.ok(bounds.scroll <= bounds.client + 1, `${label} does not overflow horizontally`);
}

async function screenshot(page, name) { await page.screenshot({path:out+'/'+name+'.png', animations:'disabled'}); }

(async () => {
  fs.mkdirSync(out,{recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  try {
    const guestContext = await context(browser,390,750), guest = await guestContext.newPage();
    await load(guest);
    for (const width of [390,320]) {
      await guest.setViewportSize({width,height:width === 320 ? 650 : 750});
      for (const locale of ['ru','uk']) {
        await guest.evaluate(locale => window.ZargotaI18n.setLocale(locale),locale);
        await guest.evaluate(() => window.ZargotaPersistentCharacters.settings());
        const dialog=guest.locator('#persistent-character-dialog');
        await dialog.waitFor();
        assert.equal(await guest.locator('#persistent-login-code').getAttribute('type'),'password');
        assert.equal(await guest.locator('#persistent-login-code').getAttribute('autocomplete'),'current-password');
        assert.ok((await dialog.innerText()).includes(locale==='ru'?'Открыть свой лист':'Відкрити свій аркуш'));
        assert.equal(await dialog.locator('[data-pc-action=login]').count(),1);
        await fits(guest,'#persistent-character-dialog',`login ${width} ${locale}`);
        await screenshot(guest,`login-${width}-${locale}`);
        await dialog.locator('[data-pc-action=close]').click();
        await dialog.waitFor({state:'detached'});
      }
    }
    // Guest continuation does not create a Firebase account or attempt a login.
    await guest.evaluate(() => window.ZargotaPersistentCharacters.settings());
    await guest.locator('[data-pc-action=ordinary]').click();
    assert.deepEqual(await guest.evaluate(() => window.__pcFixture.calls),[]);
    await guestContext.close();

    const adminContext=await context(browser,1280,900,'admin'), admin=await adminContext.newPage();
    await load(admin);
    await admin.waitForFunction(() => window.ZargotaPersistentCharacters.status().account.role==='admin');
    await admin.evaluate(() => window.ZargotaPersistentCharacters.settings());
    await admin.locator('#zg-net-monitor-panel #pc-account-list .pc-account-row').first().waitFor();
    assert.equal(await admin.locator('#persistent-character-dialog').count(),0,'desktop accounts use existing settings panel');
    assert.equal(await admin.locator('#pc-account-list .pc-account-row').count(),6);
    await fits(admin,'#zg-net-monitor-panel','desktop account settings');
    await admin.locator('#pc-account-list [data-sheet="sheet-2"]').click();
    await admin.locator('[data-account-detail="sheet-2"]').waitFor();
    assert.equal(await admin.locator('#pc-account-list [data-sheet="sheet-2"]').getAttribute('aria-pressed'),'true');
    assert.equal(await admin.locator('#pc-account-list [data-sheet="sheet-1"]').getAttribute('aria-pressed'),'false');
    await screenshot(admin,'admin-settings-desktop');
    await admin.locator('#pc-account-detail [data-pc-action=account-code]').click();
    await admin.waitForFunction(()=>document.querySelector('#pc-account-detail .pc-code-mask').textContent==='FIXTURE-SECOND');
    assert.equal(await admin.locator('#persistent-character-dialog[open]').count(),0,'show code stays inline');
    assert.equal(await admin.locator('.pc-selected-meta').count(),0,'account details omit race and class');
    await admin.locator('#pc-account-detail [data-pc-action=account-code]').click();
    assert.equal(await admin.locator('#pc-account-detail .pc-code-mask').innerText(),'••••');
    await admin.locator('#pc-account-detail [data-pc-action=account-code]').click();
    await admin.waitForFunction(()=>document.querySelector('#pc-account-detail .pc-code-mask').textContent==='FIXTURE-SECOND');
    await admin.locator('#pc-account-list [data-sheet="sheet-1"]').click();
    assert.equal(await admin.locator('#pc-account-detail .pc-code-mask').innerText(),'••••','changing player hides previously revealed code');
    for(const size of [{width:1280,height:900},{width:1690,height:850},{width:1024,height:768}]){
      await admin.setViewportSize(size);
      await fits(admin,'#zg-net-monitor-panel','desktop party '+size.width);
      const roster=await admin.locator('#pc-account-list').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,cols:getComputedStyle(el).gridTemplateColumns.split(' ').length}));
      assert.equal(roster.cols,3);assert.ok(roster.scroll<=roster.height+1,'all six players fit without nested scrolling');
      await fits(admin,'#pc-account-list .pc-account-row:last-child','last player visible');
    }
    await screenshot(admin,'party-six-desktop');
    await admin.locator('[data-pc-action=account-add]').click();
    assert.equal(await admin.locator('[data-character="9000002"]').count(),0,'NPC excluded');
    assert.equal(await admin.locator('[data-character="9000003"]').count(),1,'unbound hero offered');
    await admin.locator('#persistent-character-dialog [data-pc-action=settings]').click();
    await admin.locator('#pc-account-detail [data-pc-action=account-open]').click();
    await admin.waitForFunction(()=>document.querySelector('#char-sheet-view').classList.contains('pc-linked-sheet'));
    for(const zoom of [1,1.1,1.3]){
      await admin.evaluate(z=>{window.sheetZoom=z;window.applyZoom();},zoom);
      await admin.waitForTimeout(200);
      const sizes=await admin.evaluate(()=>({sheet:document.getElementById('char-sheet').getBoundingClientRect().width,view:document.getElementById('char-sheet-view').getBoundingClientRect().width}));
      assert.ok(sizes.sheet>=sizes.view*.8,'linked desktop sheet has full width at zoom '+zoom+': '+JSON.stringify(sizes));
    }
    await screenshot(admin,'linked-sheet-desktop');
    await admin.locator('#persistent-entry').click();
    assert.equal(await admin.locator('#pc-control-tabs').count(),0,'accounts do not repeat general settings');
    await admin.locator('#zg-net-monitor-btn').click();
    assert.equal(await admin.locator('#zg-net-monitor-panel').isVisible(),true,'gear switches to settings without closing the panel');
    assert.equal(await admin.locator('#pc-control-accounts').isVisible(),false,'gear shows general settings only');
    await admin.locator('#persistent-entry').click();
    assert.equal(await admin.locator('#pc-control-accounts').isVisible(),true,'account entry returns directly to players');
    await admin.locator('[data-pc-action=account-add]').click();
    await admin.locator('[data-pc-action=account-create][data-character="9000003"]').click();
    await admin.waitForFunction(()=>document.querySelector('#pc-account-detail .pc-code-mask')?.textContent==='4826');
    assert.equal(await admin.locator('#persistent-character-dialog[open]').count(),0,'linking hero returns inline code');
    await admin.locator('[data-pc-action=account-add]').click();
    await admin.locator('[data-pc-action=account-new]').click();
    await admin.locator('#pc-new-character-name').fill('New test hero');
    await admin.locator('#pc-new-character-name').press('Enter');
    await admin.waitForFunction(()=>document.querySelector('#pc-account-detail h3')?.textContent==='New test hero');
    assert.equal(await admin.locator('#pc-account-detail .pc-code-mask').innerText(),'4826');
    assert.equal(await admin.locator('#persistent-character-dialog[open]').count(),0,'new hero returns inline code');
    await adminContext.close();

    const playerContext=await context(browser,390,750), player=await playerContext.newPage();
    await load(player);
    await player.evaluate(() => window.ZargotaPersistentCharacters.settings());
    await player.locator('#persistent-login-code').fill('FIXTURE-PLAYER');
    await player.locator('#persistent-login-code').press('Enter');
    await player.locator('.zgmo-overview').waitFor();
    await player.locator('[data-zgmo=menu]').click();
    await player.locator('#pc-account-popover').waitFor();
    assert.ok((await player.locator('#pc-account-popover').innerText()).includes('Повторно вводить код не нужно.'));
    assert.equal(await player.locator('#pc-account-popover [data-pc-action=account-code],#pc-account-popover [data-pc-action=account-add]').count(),0);
    await fits(player,'#pc-account-popover','player account popover');
    await screenshot(player,'player-popover-390');
    await player.locator('#pc-account-popover [data-pc-action=character-actions]').click();
    for (const action of ['edit','portrait','level','health','sync']) assert.equal(await player.locator('#zgmo-modal [data-zgmo="'+action+'"]').count(),1,action+' remains reachable');
    await player.keyboard.press('Escape');
    await player.reload({waitUntil:'domcontentloaded'});
    await player.waitForFunction(() => window.ZargotaPersistentCharacters.status().account.role==='player');
    assert.equal(await player.locator('#persistent-login-code').count(),0,'return visit does not prompt for code');
    assert.equal(await player.evaluate(() => window.__pcFixture.calls.filter(c => c.action==='login').length),0,'return visit does not exchange code again');
    await player.evaluate(async () => { const state=window.ZargotaPersistentCharacters.status(); window.showPage('characters'); window.openCharSheet(Object.values(state.records)[0].localId); });
    await player.locator('[data-zgmo=menu]').click();
    await player.locator('#pc-account-popover [data-pc-action=leave]').click();
    await player.waitForFunction(() => !window.ZargotaPersistentCharacters.status().enabled);
    assert.equal(await player.evaluate(() => window.__pcFixture.calls.filter(c => c.action==='logout').length),1);
    await player.evaluate(() => window.ZargotaPersistentCharacters.settings());
    await player.locator('#persistent-login-code').waitFor();
    assert.equal(await player.evaluate(() => window.ZargotaPersistentCharacters.status().account.role),'visitor','settings never silently signs back in after explicit logout');
    await playerContext.close();
    assert.deepEqual(errors,[],'no uncaught app errors');
    console.log('PASS: 390/320 RU/UK login, existing desktop settings, account selection/code, sheet menu/actions, remembered login and explicit logout. Screenshots: '+out);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
