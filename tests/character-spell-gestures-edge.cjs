'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8876';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use an isolated local preview');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const catalog = Array.isArray(data.catalog) ? data.catalog : data.catalog.entries;
const heat = catalog.find(spell => /Жар Пальцев/i.test(spell.name));
const complex = catalog.find(spell => String(spell.id) === '1775564915341');
assert.ok(heat && complex, 'Use real learned and long unlearned catalog entries');
const learnedSpells = [heat, ...catalog.filter(spell => spell.id !== heat.id && spell.id !== complex.id).slice(0, 8)];
const heroId = 987654362;
const hero = JSON.parse(JSON.stringify(data.characters[0]));
Object.assign(hero, {id: heroId, name: 'Проверка жестов', nameUk: 'Перевірка жестів', spellRefs: [...learnedSpells.map(spell => spell.id), complex.id], spellsLearned: Object.fromEntries(learnedSpells.map(spell => [spell.id, true])), preparedSpells: {kodex: [], folio: [], obrad: []}, spellCD: {[heat.id]: {used: 0}}, skills: [], mastery: []});
hero.preparedSpells[heat.spellType].push(String(heat.id));
delete hero.campaignKey;
const screenshots = {};
const run = new Date().toISOString().replace(/[^0-9]/g, '');

async function selected(page) {
  return page.locator('#zgms-dialog [role=tab][aria-selected=true]').getAttribute('data-tab');
}

async function openSpell(page, spell) {
  await page.evaluate(({heroId, spellId}) => {
    window._charSheetTab = 'skills';
    showPage('characters');
    openCharSheet(heroId);
    ZargotaMobileSkills.openSpell(heroId, spellId);
  }, {heroId, spellId: spell.id});
  await page.locator('#zgms-dialog .zgms-spell-panel').waitFor();
  assert.equal(await selected(page), 'use');
}

async function gesture(page, cdp, from, to, cancel = false) {
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: from.x, y: from.y, id: 1}]});
  for (let step = 1; step <= 8; step++) {
    const fraction = step / 8;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction, id: 1}]});
    await page.waitForTimeout(18);
  }
  await cdp.send('Input.dispatchTouchEvent', {type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: []});
  await page.waitForTimeout(180);
}

async function swipe(page, cdp, direction, selector = '.zgms-grid') {
  const box = await page.locator(selector).boundingBox();
  const y = box.y + Math.min(100, box.height / 2);
  const left = box.x + box.width * .22, right = box.x + box.width * .78;
  await gesture(page, cdp, {x: direction === 'left' ? right : left, y}, {x: direction === 'left' ? left : right, y: y + 3});
}

async function viewer(page, spell, locale, width, closeWithEscape, duringViewer) {
  const body = page.locator('#zgms-dialog .zgms-detail-body');
  // Let native touch inertia finish before checking restoration of the reading position.
  await body.evaluate(async node => {
    let last = node.scrollTop, steady = 0;
    for (let frame = 0; frame < 90 && steady < 10; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      steady = Math.abs(node.scrollTop - last) < .1 ? steady + 1 : 0;
      last = node.scrollTop;
    }
  });
  const before = {tab: await selected(page), scroll: await body.evaluate(node => node.scrollTop)};
  const art = page.locator('#zgms-dialog [data-zgms=preview-art]');
  const source = await art.locator('img').getAttribute('src');
  await art.click();
  const overlay = page.locator('#zgms-art-viewer');
  await overlay.waitFor({state: 'visible'});
  await overlay.locator('img').evaluate(image => image.decode());
  if (duringViewer) await duringViewer();
  assert.equal(await overlay.locator('img').getAttribute('src'), source, 'Viewer uses the actual spell illustration');
  const caption = await overlay.locator('blockquote').innerText();
  assert.ok(caption.trim().length > 10, 'Viewer includes a meaningful caption in ' + locale);
  const geometry = await overlay.evaluate(node => {
    const bounds = element => { const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height}; };
    const image = node.querySelector('img');
    const filters = [];
    for (let element = image; element; element = element.parentElement) filters.push(getComputedStyle(element).filter);
    return {overlay: bounds(node), image: bounds(image), quote: bounds(node.querySelector('blockquote')), close: bounds(node.querySelector('[data-zgms=close-art]')), width: innerWidth, height: innerHeight, overflow: node.scrollWidth - node.clientWidth, fit: getComputedStyle(image).objectFit, filters};
  });
  assert.ok(geometry.overlay.x <= 1 && geometry.overlay.y <= 1 && geometry.overlay.right >= geometry.width - 1 && geometry.overlay.bottom >= geometry.height - 1, 'Art viewer covers the whole viewport');
  for (const key of ['image', 'quote', 'close']) assert.ok(geometry[key].x >= -1 && geometry[key].right <= geometry.width + 1 && geometry[key].y >= -1 && geometry[key].bottom <= geometry.height + 1, key + ' fits: ' + JSON.stringify(geometry));
  assert.ok(geometry.image.width >= Math.min(width, 390) - 40, 'Full-screen art is larger than its thumbnail');
  if (geometry.height >= geometry.width || geometry.height > 500) assert.ok(Math.abs((geometry.image.x + geometry.image.right) / 2 - geometry.width / 2) <= 1, 'Portrait and desktop artwork is centered');
  assert.ok(geometry.overflow <= 1, 'Viewer must not scroll sideways');
  assert.equal(geometry.fit, 'contain', 'Full illustration stays visible without cropping');
  assert.ok(geometry.filters.every(filter => !/grayscale|brightness/.test(filter)), 'Unknown spell art is shown in its original colours');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('#zgms-art-viewer')), 'Keyboard focus stays inside the viewer');
  await overlay.evaluate(async node => {
    await Promise.all(node.getAnimations({subtree: true}).map(animation => animation.finished.catch(() => {})));
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await overlay.evaluate(node => Number(getComputedStyle(node).opacity)), 1, 'Finished viewer is fully visible');
  const file = '/tmp/zargota-spell-viewer-' + run + '-' + locale + '-' + width + '-' + spell.id + '.png';
  await page.screenshot({path: file}); screenshots[locale + '-' + width + '-' + spell.id] = file;
  if (closeWithEscape) await page.keyboard.press('Escape');
  else await overlay.locator('[data-zgms=close-art]').click();
  await overlay.waitFor({state: 'hidden'});
  assert.equal(await selected(page), before.tab, 'Closing art restores the same spell tab');
  const afterScroll = await body.evaluate(node => node.scrollTop);
  assert.ok(Math.abs(afterScroll - before.scroll) <= 2, 'Closing art retains the reading position: ' + before.scroll + ' → ' + afterScroll);
  assert.equal(await art.evaluate(node => document.activeElement === node), true, 'Focus returns to the spell artwork');
}

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  const errors = [], blocked = new Set();
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 780}, deviceScaleFactor: 2, hasTouch: true});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return route.continue();
      blocked.add(url.origin); return route.abort();
    });
    await context.addInitScript(({catalog, hero, version}) => {
      localStorage.setItem('grimoire_v3', JSON.stringify(catalog));
      localStorage.setItem('grimoire_chars', JSON.stringify([hero]));
      localStorage.setItem('zg_data_version', version);
    }, {catalog: data.catalog, hero, version: manifest.version});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.locator('#zg-data-loader-splash').waitFor({state: 'hidden', timeout: 45000});
    await page.evaluate(async () => {
      await window.zgCharacterLoadPromise;
      window.__gestureSaveCalls = 0;
      window.saveChars = () => { window.__gestureSaveCalls++; return Promise.resolve({ok: true}); };
    });
    const cdp = await context.newCDPSession(page);
    const state = () => page.evaluate(id => {
      const c = characters.find(c => c.id === id);
      return JSON.stringify([c.spellCD, c.spellsLearned, c.preparedSpells]);
    }, heroId);
    const initial = await state();
    for (const locale of ['ru', 'uk']) for (const width of [320, 390]) {
      await page.setViewportSize({width, height: width === 320 ? 568 : 780});
      await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
      if (await page.locator('#zgms-dialog').count()) await page.locator('#zgms-dialog [data-zgms=close]').click();
      await page.evaluate(heroId => { window._charSheetTab = 'skills'; showPage('characters'); openCharSheet(heroId); }, heroId);
      await page.locator('.zgms-filter [data-filter=all]').click();
      const pagination = page.locator('.zgms-pagination span');
      while (await page.locator('[data-zgms=prev]').isEnabled()) await page.locator('[data-zgms=prev]').click();
      assert.equal(await pagination.innerText(), '1 / 3');
      const firstKeys = await page.locator('.zgms-card').evaluateAll(cards => cards.map(card => card.dataset.key));
      await swipe(page, cdp, 'right'); assert.equal(await pagination.innerText(), '1 / 3', 'First card page does not wrap');
      await swipe(page, cdp, 'left'); assert.equal(await pagination.innerText(), '2 / 3');
      assert.notDeepEqual(await page.locator('.zgms-card').evaluateAll(cards => cards.map(card => card.dataset.key)), firstKeys, 'Swipe actually changes the displayed cards');
      await swipe(page, cdp, 'left'); assert.equal(await pagination.innerText(), '3 / 3');
      await swipe(page, cdp, 'left'); assert.equal(await pagination.innerText(), '3 / 3', 'Last card page does not wrap');
      await swipe(page, cdp, 'right'); assert.equal(await pagination.innerText(), '2 / 3');
      await swipe(page, cdp, 'right'); assert.equal(await pagination.innerText(), '1 / 3');
      assert.equal(await page.locator('#zgms-dialog').count(), 0, 'Dragging a card never opens it accidentally');
      const grid = await page.locator('.zgms-grid').boundingBox();
      await gesture(page, cdp, {x: grid.x + grid.width * .3, y: grid.y + grid.height * .7}, {x: grid.x + grid.width * .3 + 6, y: grid.y + grid.height * .2});
      assert.equal(await pagination.innerText(), '1 / 3', 'Vertical gesture does not page the grid');
      assert.equal(await page.locator('#zgms-dialog').count(), 0, 'Vertical drag never opens a card');
      await page.waitForTimeout(450);
      await page.locator('.zgms-card').first().tap();
      await page.locator('#zgms-dialog').waitFor();
      assert.equal(await selected(page), 'use', 'A normal tap still opens the spell');
      await openSpell(page, complex);
      await swipe(page, cdp, 'left', '#zgms-dialog .zgms-detail-body');
      assert.equal(await selected(page), 'use', 'Reading tabs are not changed by a swipe inside the opened spell');
      const body = page.locator('#zgms-dialog .zgms-detail-body');
      await body.evaluate(node => { node.scrollTop = 0; });
      const box = await body.boundingBox();
      await gesture(page, cdp, {x: width / 2, y: box.y + box.height * .8}, {x: width / 2 + 8, y: box.y + box.height * .2});
      assert.equal(await selected(page), 'use', 'Vertical reading gesture never switches tab');
      assert.ok(await body.evaluate(node => node.scrollTop) > 10, 'Vertical reading gesture scrolls the content');
      await viewer(page, complex, locale, width, width === 320);
      await page.locator('#zgms-dialog [data-tab=description]').click();
      await viewer(page, complex, locale, width, width !== 320);
      await openSpell(page, heat);
      const apply = await page.locator('#zgms-dialog [data-zgms=spend]').boundingBox();
      await gesture(page, cdp, {x: apply.x + apply.width * .8, y: apply.y + apply.height / 2}, {x: 30, y: apply.y + apply.height / 2});
      assert.equal(await selected(page), 'use', 'Swiping an action control does not change the reading tab');
      assert.equal(await page.evaluate(() => window.__gestureSaveCalls), 0, 'A swipe must never consume a charge or save the character');
      assert.equal(await state(), initial, 'Browsing and artwork viewing never change character data');
    }
    await page.setViewportSize({width: 780, height: 390});
    await openSpell(page, complex);
    await viewer(page, complex, 'uk', 780, false);
    await page.setViewportSize({width: 390, height: 780});
    await openSpell(page, heat);
    await page.evaluate(() => {
      window.__beforePendingArtSave = window.saveChars;
      window.saveChars = () => new Promise(resolve => { window.__finishPendingArtSave = resolve; });
    });
    await page.locator('#zgms-dialog [data-zgms=spend]').click();
    await page.waitForFunction(() => typeof window.__finishPendingArtSave === 'function');
    await viewer(page, heat, 'uk', 390, true, async () => {
      await page.evaluate(() => window.__finishPendingArtSave({ok: false}));
      await page.waitForFunction(() => document.querySelector('#zgms-dialog .zgms-spell-panel')?.getAttribute('aria-busy') === 'false');
      assert.equal(await state(), initial, 'A rejected pending save rolls back while artwork stays open');
      assert.ok(await page.locator('#zgms-art-viewer').isVisible());
    });
    await page.evaluate(() => { window.saveChars = window.__beforePendingArtSave; });
    await page.setViewportSize({width: 1440, height: 900});
    await page.evaluate(() => ZargotaI18n.setLocale('ru'));
    await openSpell(page, heat);
    await viewer(page, heat, 'ru', 1440, true);
    assert.equal(await state(), initial);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({result: 'PASS', checks: ['real CDP touch paging through three card pages', 'first/last boundaries and ordinary card tap', 'vertical drag and opened detail do not page', 'vertical reading scroll preserved', 'no accidental casts or saves', 'full-screen original art and caption', 'close/Escape restores tab, scroll and focus', 'pending-save rollback with artwork open', 'RU/UK at 320/390', 'landscape and desktop art viewer'], screenshots, blockedExternalOrigins: [...blocked]}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
