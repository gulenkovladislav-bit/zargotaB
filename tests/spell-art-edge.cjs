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
const uploadedImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#284b63"/><path d="M0 360L320 0L640 360Z" fill="#d8a85b"/></svg>');
const linInImage = 'images/abilities/lin-in/existential-veil-v1.png';
assert.ok(fs.existsSync(path.join(root, linInImage)), 'The Lin In fixture uses an existing illustration');
const fixture = JSON.parse(JSON.stringify(data.characters.find(c => /Эстерос/.test(c.name)) || data.characters[0]));
Object.assign(fixture, {
  id: heroId, name: 'Проверка иллюстраций', nameUk: 'Перевірка ілюстрацій',
  skills: [
    { name: 'Загрузка / Завантаження', type: 'Активный', image: uploadedImage },
    { name: 'Лин’Ин / Лін’Ін', type: 'Активный', image: linInImage }
  ], mastery: [], spellRefs: [], spellsLearned: {},
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

async function assertMobileArtFill(page, label, measurements, selector = '.zgms-card .zgms-art > img') {
  const metrics = await page.locator(selector).evaluateAll(async images => Promise.all(images.map(async image => {
    await image.decode();
    const frame = image.parentElement, outer = frame.getBoundingClientRect(), inner = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    return {
      key: image.closest('.zgms-card')?.dataset.key || 'detail',
      src: image.getAttribute('src'), scene: frame.classList.contains('scene'),
      frame: { width: outer.width, height: outer.height }, image: { width: inner.width, height: inner.height },
      edges: [inner.left - outer.left, inner.top - outer.top, inner.right - outer.right, inner.bottom - outer.bottom],
      objectFit: style.objectFit,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
    };
  })));
  assert.ok(metrics.length, label + ': visible artwork exists');
  metrics.forEach(metric => {
    assert.equal(metric.scene, true, label + ': illustration classified as scene: ' + metric.key);
    assert.equal(metric.objectFit, 'cover', label + ': artwork fills its frame: ' + metric.key);
    assert.ok(metric.padding.every(value => parseFloat(value) === 0), label + ': no symbol padding: ' + JSON.stringify(metric));
    assert.ok(metric.frame.width > 0 && metric.frame.height > 0 && metric.edges.every(value => Math.abs(value) <= 1), label + ': artwork and frame rectangles match: ' + JSON.stringify(metric));
  });
  measurements.push({ label, metrics });
  return metrics;
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

async function checkMappedArtworkOverride(page, id, source, expected, label, measurements) {
  const card = await findMobileCard(page, id);
  const previous = await page.evaluate(({ id, source }) => {
    const item = findCharacterCatalogSpell(id), previous = { own: Object.hasOwn(item, 'iconAsset'), value: item.iconAsset, src: ZargotaSpellArt.resolve(item) };
    item.iconAsset = source;
    ZargotaMobileSkills.refresh();
    return previous;
  }, { id, source });
  try {
    await page.waitForFunction(({ id, expected }) => document.querySelector('.zgms-card[data-key="spell-' + id + '"] .zgms-art > img')?.getAttribute('src') === expected, { id, expected });
    assert.equal((await decoded(card.locator('.zgms-art > img')))[0].src, expected, label);
    await assertMobileArtFill(page, label, measurements);
    await card.click();
    assert.equal((await decoded(page.locator('#zgms-dialog .zgms-detail-art > img')))[0].src, expected, label + ': detail');
    await assertMobileArtFill(page, label + ': detail', measurements, '#zgms-dialog .zgms-detail-art > img');
    await page.locator('[data-zgms=close]').click();
  } finally {
    await page.evaluate(({ id, previous }) => {
      const item = findCharacterCatalogSpell(id);
      if (previous.own) item.iconAsset = previous.value; else delete item.iconAsset;
      ZargotaMobileSkills.refresh();
    }, { id, previous });
    await page.waitForFunction(({ id, previous }) => document.querySelector('.zgms-card[data-key="spell-' + id + '"] .zgms-art > img')?.getAttribute('src') === previous.src, { id, previous });
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.ZG_EDGE_EXECUTABLE || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  });
  const errors = [], blocked = new Set(), checks = [], fillMeasurements = [];
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
    assert.ok(mapped.length > 0, 'The artwork catalog is not empty');
    if (process.env.ZG_EXPECTED_SPELL_ART_COUNT) assert.equal(mapped.length, Number(process.env.ZG_EXPECTED_SPELL_ART_COUNT), 'Expected release artwork count');
    assert.equal(new Set(mapped.map(record => record.src)).size, mapped.length, 'Every spell has its own illustration');
    const pageCount = Math.ceil(mapped.length / 4);
    mapped.forEach(record => { assert.equal(record.resolved, record.src, record.name); assert.equal(record.scene, true, record.name); });
    const allImages = await page.evaluate(async records => Promise.all(records.map(async record => {
      const image = new Image(); image.src = record.src; await image.decode();
      return { id: record.id, width: image.naturalWidth, height: image.naturalHeight };
    })), mapped);
    assert.ok(allImages.every(image => image.width > 0 && image.height > 0), 'All mapped published paths decode');
    const eye = mapped.find(record => /eye|глаз|око/i.test(record.src + ' ' + record.name));
    assert.ok(eye, 'The eye illustration is included');
    checks.push(mapped.length + ' unique mapped URLs decode and resolve to scene art');

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
      assert.equal(await refs.locator(thumbSelector).count(), mapped.length, 'Desktop references show every mapped artwork');
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
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        await page.waitForFunction(({ pageNumber, pageCount }) => document.querySelector('.zgms-pagination span').textContent === pageNumber + ' / ' + pageCount, { pageNumber, pageCount });
        const countOnPage = Math.min(4, mapped.length - (pageNumber - 1) * 4);
        assert.equal(await page.locator('.zgms-card').count(), countOnPage);
        assert.equal(await page.locator(mobileSelector).count(), countOnPage);
        await assertMobileArtFill(page, locale + ': catalog page ' + pageNumber, fillMeasurements);
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
        if (pageNumber < pageCount) await page.locator('[data-zgms=next]').click();
      }
      assert.deepEqual(seen.slice().sort(), mapped.map(record => record.id).sort(), 'All mapped spells appear once across ' + pageCount + ' pages');
      await (await findMobileCard(page, eye.id)).click();
      assert.equal((await decoded(page.locator('#zgms-dialog .zgms-detail-art.scene > img')))[0].src, eye.src);
      await assertMobileArtFill(page, locale + ': eye detail', fillMeasurements, '#zgms-dialog .zgms-detail-art > img');
      await page.locator('#zgms-dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path: path.join(output, 'mobile-eye-' + locale + '.png') });
      await page.locator('[data-zgms=close]').click();
      checks.push(locale + ': mobile 390x780, ' + pageCount + ' artwork pages and eye detail');
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

    const custom = uploadedImage;
    const customResult = await page.evaluate(({ id, custom }) => {
      const original = findCharacterCatalogSpell(id), item = Object.assign({}, original, { iconAsset: custom });
      const parsed = document.createElement('template'); parsed.innerHTML = cardHTML(item);
      const image = parsed.content.querySelector('img.zg-spell-art-thumb, .zg-spell-art-thumb img');
      return { resolved: ZargotaSpellArt.resolve(item), custom: ZargotaSpellArt.resolveCustom(item), scene: ZargotaSpellArt.isScene(custom), card: image && image.getAttribute('src') };
    }, { id: mapped[0].id, custom });
    assert.deepEqual(customResult, { resolved: custom, custom, scene: true, card: custom }, 'Custom artwork has priority over the default and renders as an illustration');
    const customCard = await findMobileCard(page, mapped[0].id);
    await page.evaluate(({ id, custom }) => {
      const item = findCharacterCatalogSpell(id);
      window.__spellArtCustomBefore = { own: Object.hasOwn(item, 'iconAsset'), value: item.iconAsset };
      item.iconAsset = custom;
      ZargotaMobileSkills.refresh();
    }, { id: mapped[0].id, custom });
    await page.waitForFunction(({ id, custom }) => document.querySelector('.zgms-card[data-key="spell-' + id + '"] .zgms-art > img')?.getAttribute('src') === custom, { id: mapped[0].id, custom });
    assert.equal((await decoded(customCard.locator('.zgms-art > img')))[0].src, custom, 'Mobile card uses custom artwork');
    await assertMobileArtFill(page, 'Custom spell upload', fillMeasurements);
    await page.evaluate(id => {
      const item = findCharacterCatalogSpell(id), before = window.__spellArtCustomBefore;
      if (before.own) item.iconAsset = before.value; else delete item.iconAsset;
      ZargotaMobileSkills.refresh();
    }, mapped[0].id);

    const queriedImage = mapped[0].src + '?v=geometry-test#preview';
    const sourceClassification = await page.evaluate(({ queriedImage, uploadedImage, linInImage }) => {
      const api = ZargotaSpellArt;
      return {
        queried: api.isScene(queriedImage), uploaded: api.isScene(uploadedImage), linIn: api.isScene(linInImage),
        bookSymbol: api.isScene('images/ui/combat-generated/codex.png'),
        sourceSymbol: api.isScene('images/ui/mobile-skills/source-folio-v2.png'),
        queriedCustom: api.resolveCustom({ image: queriedImage }),
        uploadedCustom: api.resolveCustom({ image: uploadedImage }),
        linInCustom: api.resolveCustom({ image: linInImage })
      };
    }, { queriedImage, uploadedImage, linInImage });
    assert.deepEqual(sourceClassification, {
      queried: true, uploaded: true, linIn: true, bookSymbol: false, sourceSymbol: false,
      queriedCustom: queriedImage, uploadedCustom: uploadedImage, linInCustom: linInImage
    }, 'Queries and provided illustrations stay scenes; actual built-in symbols stay symbols');
    await checkMappedArtworkOverride(page, mapped[0].id, queriedImage, queriedImage, 'Mapped image with query and fragment', fillMeasurements);

    const legacyCases = await page.evaluate(() => ['kodex', 'folio', 'obrad'].map(type => {
      const item = entries.find(item => item.spellType === type && ZargotaSpellArt.defaults[String(item.id)]);
      if (!item) throw Error('No mapped spell for legacy source type: ' + type);
      const legacy = 'images/ui/combat-generated/' + ({ kodex: 'codex', folio: 'folio', obrad: 'ritual' })[type] + '.png';
      return { id: String(item.id), type, legacy, expected: ZargotaSpellArt.defaults[String(item.id)], actual: ZargotaSpellArt.resolve(Object.assign({}, item, { iconAsset: legacy })) };
    }));
    for (const legacy of legacyCases) {
      assert.equal(legacy.actual, legacy.expected, 'New default replaces matching stale ' + legacy.type + ' book artwork');
      await checkMappedArtworkOverride(page, legacy.id, legacy.legacy, legacy.expected, 'Legacy ' + legacy.type + ' fallback', fillMeasurements);
    }
    checks.push('Queried image fills its card/detail; matching stale codex, folio and ritual defaults resolve to current art');

    await page.locator('[data-group=personal]').click();
    for (const locale of ['ru', 'uk']) {
      await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
      await page.waitForFunction(() => document.querySelectorAll('.zgms-card').length === 2 && document.querySelector('.zgms-card[data-key="skills-0"]'));
      assert.deepEqual((await decoded(page.locator('.zgms-card .zgms-art > img'))).map(image => image.src), [uploadedImage, linInImage]);
      await assertMobileArtFill(page, locale + ': personal uploaded and Lin In illustrations', fillMeasurements);
      await page.screenshot({ path: path.join(output, 'mobile-personal-art-' + locale + '.png') });
      for (const [index, source] of [uploadedImage, linInImage].entries()) {
        await page.locator('.zgms-card[data-key="skills-' + index + '"]').click();
        assert.equal((await decoded(page.locator('#zgms-dialog .zgms-detail-art > img')))[0].src, source);
        await assertMobileArtFill(page, locale + ': personal illustration ' + index + ' detail', fillMeasurements, '#zgms-dialog .zgms-detail-art > img');
        await page.locator('[data-zgms=close]').click();
      }
    }
    checks.push('Personal uploaded data image and existing Lin In illustration fill card/detail frames in RU/UK');
    assert.ok(await page.evaluate(() => window.__spellArtCatalogBefore === JSON.stringify(entries)), 'Viewing illustrations and spending a charge never changes catalog rules');
    checks.push('Charge update preserves image nodes and pagination; custom art wins; catalog remains unchanged');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    const report = { checks, mappedCount: mapped.length, pageCount, mapped, dimensions: allImages, fillMeasurements, sourceClassification, legacyCases, blockedExternalOrigins: [...blocked], screenshots: fs.readdirSync(output).filter(name => name.endsWith('.png')) };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS spell art: ' + mapped.length + ' assets, RU/UK catalog and desktop details, 390x780 mobile pagination/charges, frame fill and custom priority. Evidence: ' + output);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
