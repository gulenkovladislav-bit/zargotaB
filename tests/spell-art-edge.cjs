'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  playwright = require('/Users/merkov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}

const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8876';
const baseURL = new URL(base);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(baseURL.hostname), 'Use an isolated local server');
const output = process.env.ZG_TEST_OUTPUT || '/tmp/zargota-spell-art-review';
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const heroId = 987654329;
const fixture = JSON.parse(JSON.stringify(data.characters.find(c => /Эстерос/.test(c.name)) || data.characters[0]));
Object.assign(fixture, {
  id: heroId, name: 'Проверка иллюстраций', nameUk: 'Перевірка ілюстрацій',
  skills: [], mastery: [], spellRefs: [], spellsLearned: {},
  preparedSpells: { kodex: [], folio: [], obrad: [] }, spellCD: {}
});
delete fixture.campaignKey;

const thumbSelector = 'img.zg-spell-art-thumb, .zg-spell-art-thumb img';
const detailSelector = 'img.zg-spell-art-detail, .zg-spell-art-detail img';
const mobileSelector = '.zgms-card .zgms-art.scene > img';

async function decoded(locator) {
  await locator.first().waitFor({ state: 'visible' });
  return locator.evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight }));
  });
}

async function firstMobilePage(page) {
  while (await page.locator('[data-zgms=prev]').isEnabled()) {
    const before = await page.locator('.zgms-pagination span').innerText();
    await page.locator('[data-zgms=prev]').click();
    await page.waitForFunction(before => document.querySelector('.zgms-pagination span').textContent !== before, before);
  }
}

async function findMobileCard(page, id) {
  await firstMobilePage(page);
  const card = page.locator('.zgms-card[data-key="spell-' + id + '"]');
  while (!await card.count() && await page.locator('[data-zgms=next]').isEnabled()) {
    const before = await page.locator('.zgms-pagination span').innerText();
    await page.locator('[data-zgms=next]').click();
    await page.waitForFunction(before => document.querySelector('.zgms-pagination span').textContent !== before, before);
  }
  assert.equal(await card.count(), 1, 'Mapped spell has a mobile card: ' + id);
  return card;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.ZG_EDGE_EXECUTABLE || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  });
  const errors = [], blocked = new Set(), checks = [];
  try {
    // A fresh, nonpersistent context cannot access the user's browser login or storage.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true, deviceScaleFactor: 1 });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === baseURL.origin) return route.continue();
      blocked.add(url.origin);
      return route.abort();
    });
    await context.addInitScript(({ catalog, hero, version }) => {
      localStorage.setItem('grimoire_v3', JSON.stringify(catalog));
      localStorage.setItem('grimoire_chars', JSON.stringify([hero]));
      localStorage.setItem('zg_data_version', version);
    }, { catalog: data.catalog, hero: fixture, version: manifest.version });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#zg-data-loader-splash').waitFor({ state: 'hidden', timeout: 45000 });
    await page.waitForFunction(() => window.ZargotaSpellArt && typeof window.ZargotaSpellArt.resolve === 'function');
    const mapped = await page.evaluate(async heroId => {
      await window.zgCharacterLoadPromise;
      const defaults = window.ZargotaSpellArt.defaults;
      const records = Object.entries(defaults).map(([id, src]) => {
        const item = findCharacterCatalogSpell(id);
        if (!item) throw Error('Mapped catalog entry missing: ' + id);
        return { id: String(id), name: item.name, src, resolved: ZargotaSpellArt.resolve(item), scene: ZargotaSpellArt.isScene(src) };
      });
      const preferred = [/ответный шип/i, /жар пальцев/i, /луч гнили/i, /огненный снаряд/i];
      const priority = record => { const i = preferred.findIndex(re => re.test(record.name)); return i < 0 ? 4 : i; };
      records.sort((a, b) => priority(a) - priority(b));
      const hero = characters.find(c => c.id === heroId);
      hero.spellRefs = records.map(record => findCharacterCatalogSpell(record.id).id);
      hero.spellsLearned = {};
      hero.preparedSpells = { kodex: [], folio: [], obrad: [] };
      hero.spellCD = {};
      records.forEach(record => {
        const item = findCharacterCatalogSpell(record.id);
        hero.spellsLearned[item.id] = true;
        hero.spellCD[item.id] = { used: 0 };
        if (hero.preparedSpells[item.spellType].length < 3) hero.preparedSpells[item.spellType].push(String(item.id));
      });
      window.__spellArtCatalogBefore = JSON.stringify(entries);
      return records;
    }, heroId);
    assert.equal(mapped.length, 20, 'Exactly 20 mapped spell illustrations');
    assert.equal(new Set(mapped.map(record => record.src)).size, 20, 'Every spell has its own illustration');
    mapped.forEach(record => { assert.equal(record.resolved, record.src, record.name); assert.equal(record.scene, true, record.name); });
    const allImages = await page.evaluate(async records => Promise.all(records.map(async record => {
      const image = new Image(); image.src = record.src; await image.decode();
      return { id: record.id, width: image.naturalWidth, height: image.naturalHeight };
    })), mapped);
    assert.ok(allImages.every(image => image.width > 0 && image.height > 0), 'All 20 published paths decode');
    const eye = mapped.find(record => /eye|глаз|око/i.test(record.src + ' ' + record.name));
    assert.ok(eye, 'The eye illustration is included');
    checks.push('20 unique mapped URLs decode and resolve to scene art');

    for (const locale of ['ru', 'uk']) {
      await page.evaluate(locale => { ZargotaI18n.setLocale(locale); showPage('catalog'); renderCatalog(); }, locale);
      for (const record of mapped) {
        await page.evaluate(() => showPage('catalog'));
        const card = page.locator('.spell-card[data-id="' + record.id + '"]');
        assert.equal(await card.count(), 1, locale + ' catalog card ' + record.name);
        assert.equal((await decoded(card.locator(thumbSelector)))[0].src, record.src);
        await page.evaluate(id => openDetail(findCharacterCatalogSpell(id).id), record.id);
        assert.equal((await decoded(page.locator('#detail-body').locator(detailSelector)))[0].src, record.src);
      }
      await page.evaluate(id => openDetail(findCharacterCatalogSpell(id).id), eye.id);
      await decoded(page.locator('#detail-body').locator(detailSelector));
      await page.waitForTimeout(300); // Let the page transition finish before taking visual evidence.
      await page.screenshot({ path: path.join(output, 'desktop-eye-' + locale + '.png') });
      await page.evaluate(heroId => { window._charSheetTab = 'skills'; showPage('characters'); openCharSheet(heroId); }, heroId);
      const refs = page.locator('#spell-refs-' + heroId);
      assert.equal(await refs.locator(thumbSelector).count(), 20, 'Desktop references show all 20 artworks');
      await decoded(refs.locator(thumbSelector));
      for (const record of mapped) {
        await page.evaluate(({ heroId, id }) => showSpellDetail(heroId, findCharacterCatalogSpell(id).id), { heroId, id: record.id });
        assert.equal((await decoded(page.locator('#spell-detail-popup').locator(detailSelector)))[0].src, record.src);
      }
      await page.evaluate(() => document.getElementById('spell-detail-popup').remove());
      checks.push(locale + ': actual catalog cards, catalog detail, desktop learned references and detail');
    }

    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(heroId => { window._charSheetTab = 'skills'; showPage('characters'); openCharSheet(heroId); }, heroId);
    await page.locator('.zgms-card').first().waitFor();
    await page.locator('[data-group=learned]').click();
    await page.locator('.zgms-filter [data-filter=all]').click();
    for (const locale of ['ru', 'uk']) {
      await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
      await firstMobilePage(page);
      const seen = [];
      for (let pageNumber = 1; pageNumber <= 5; pageNumber++) {
        await page.waitForFunction(pageNumber => document.querySelector('.zgms-pagination span').textContent === pageNumber + ' / 5', pageNumber);
        assert.equal(await page.locator('.zgms-card').count(), 4);
        assert.equal(await page.locator(mobileSelector).count(), 4);
        const visible = await page.locator('.zgms-card').evaluateAll(async cards => Promise.all(cards.map(async card => {
          const image = card.querySelector('.zgms-art.scene > img'); await image.decode();
          const rect = card.getBoundingClientRect();
          return { id: card.dataset.key.slice(6), src: image.getAttribute('src'), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        })));
        visible.forEach(card => {
          assert.equal(card.src, mapped.find(record => record.id === card.id).src);
          assert.ok(card.left >= -1 && card.right <= 391 && card.top >= 0 && card.bottom <= 780, JSON.stringify(card));
          seen.push(card.id);
        });
        if (pageNumber === 1) await page.screenshot({ path: path.join(output, 'mobile-four-cards-' + locale + '.png') });
        if (pageNumber < 5) await page.locator('[data-zgms=next]').click();
      }
      assert.deepEqual(seen.slice().sort(), mapped.map(record => record.id).sort(), 'All mapped spells appear once across five pages');
      await (await findMobileCard(page, eye.id)).click();
      assert.equal((await decoded(page.locator('#zgms-dialog .zgms-detail-art.scene > img')))[0].src, eye.src);
      await page.locator('#zgms-dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path: path.join(output, 'mobile-eye-' + locale + '.png') });
      await page.locator('[data-zgms=close]').click();
      checks.push(locale + ': mobile 390x780, five pages of four artworks and eye detail');
    }

    const chargedId = await page.evaluate(heroId => {
      const hero = characters.find(c => c.id === heroId);
      return hero.spellRefs.find(id => Number((findCharacterCatalogSpell(id).cd || '').match(/(\d+)\s*(?:раз|заряд)/i)?.[1]) >= 2);
    }, heroId);
    assert.ok(chargedId, 'A mapped spell has charges to exercise');
    await (await findMobileCard(page, String(chargedId))).click();
    await page.evaluate(() => {
      window.__spellArtNodes = {
        detail: document.querySelector('#zgms-dialog .zgms-detail-art > img'),
        cards: [...document.querySelectorAll('.zgms-card .zgms-art > img')],
        pagination: document.querySelector('.zgms-pagination span').textContent
      };
    });
    await page.locator('[data-zgms=spend]').click();
    await page.waitForFunction(({ heroId, id }) => characters.find(c => c.id === heroId).spellCD[id].used === 1, { heroId, id: chargedId });
    await page.waitForFunction(() => document.querySelector('[data-zgms=spend]').disabled === false);
    assert.ok(await page.evaluate(() => {
      const saved = window.__spellArtNodes, now = [...document.querySelectorAll('.zgms-card .zgms-art > img')];
      return saved.detail === document.querySelector('#zgms-dialog .zgms-detail-art > img') &&
        saved.cards.every((image, index) => image === now[index]) &&
        saved.pagination === document.querySelector('.zgms-pagination span').textContent;
    }), 'Spending a charge preserves the detail image, visible card image nodes and current page');
    await page.locator('[data-zgms=close]').click();

    const custom = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#ac7d43"/></svg>');
    const customResult = await page.evaluate(({ id, custom }) => {
      const original = findCharacterCatalogSpell(id), item = Object.assign({}, original, { iconAsset: custom });
      const parsed = document.createElement('template'); parsed.innerHTML = cardHTML(item);
      const image = parsed.content.querySelector('img.zg-spell-art-thumb, .zg-spell-art-thumb img');
      return { resolved: ZargotaSpellArt.resolve(item), card: image && image.getAttribute('src') };
    }, { id: mapped[0].id, custom });
    assert.deepEqual(customResult, { resolved: custom, card: custom }, 'Custom artwork has priority over the default');
    const customCard = await findMobileCard(page, mapped[0].id);
    await page.evaluate(({ id, custom }) => {
      const item = findCharacterCatalogSpell(id);
      window.__spellArtCustomBefore = { own: Object.hasOwn(item, 'iconAsset'), value: item.iconAsset };
      item.iconAsset = custom;
      ZargotaMobileSkills.refresh();
    }, { id: mapped[0].id, custom });
    await page.waitForFunction(({ id, custom }) => document.querySelector('.zgms-card[data-key="spell-' + id + '"] .zgms-art > img')?.getAttribute('src') === custom, { id: mapped[0].id, custom });
    assert.equal((await decoded(customCard.locator('.zgms-art > img')))[0].src, custom, 'Mobile card uses custom artwork');
    await page.evaluate(id => {
      const item = findCharacterCatalogSpell(id), before = window.__spellArtCustomBefore;
      if (before.own) item.iconAsset = before.value; else delete item.iconAsset;
      ZargotaMobileSkills.refresh();
    }, mapped[0].id);
    assert.ok(await page.evaluate(() => window.__spellArtCatalogBefore === JSON.stringify(entries)), 'Viewing illustrations and spending a charge never changes catalog rules');
    checks.push('Charge update preserves image nodes and pagination; custom art wins; catalog remains unchanged');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    const report = { checks, mapped, dimensions: allImages, blockedExternalOrigins: [...blocked], screenshots: fs.readdirSync(output).filter(name => name.endsWith('.png')) };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS spell art: 20 assets, RU/UK catalog and desktop details, 390x780 mobile pagination/charges, custom priority. Evidence: ' + output);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
