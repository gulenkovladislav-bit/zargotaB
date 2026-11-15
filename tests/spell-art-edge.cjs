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
    const frame = image.parentElement, card = image.closest('.zgms-card');
    // The scene layer spans the card, but the actual illustration must fit
    // inside it without cropping. Its painted bounds differ from the img box.
    const reference = card || frame, outer = reference.getBoundingClientRect(), inner = image.getBoundingClientRect();
    const art = frame.getBoundingClientRect(), copy = card?.querySelector('.zgms-copy')?.getBoundingClientRect();
    const style = getComputedStyle(image);
    const scale = card ? Math.min(inner.width / image.naturalWidth, inner.height / image.naturalHeight) : Math.max(inner.width / image.naturalWidth, inner.height / image.naturalHeight);
    const paintedWidth = image.naturalWidth * scale, paintedHeight = image.naturalHeight * scale;
    const positions = style.objectPosition.split(/\s+/);
    const offset = (position, extra) => position.endsWith('%') ? extra * parseFloat(position) / 100 : parseFloat(position) || 0;
    const paintedLeft = inner.left + offset(positions[0], inner.width - paintedWidth);
    const paintedTop = inner.top + offset(positions[1] || '50%', inner.height - paintedHeight);
    return {
      key: card?.dataset.key || 'detail', reference: card ? 'whole-card' : 'detail-art',
      src: image.getAttribute('src'), scene: frame.classList.contains('scene'),
      frame: { width: outer.width, height: outer.height }, image: { width: inner.width, height: inner.height },
      artBox: { width: art.width, height: art.height },
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      painted: { width: paintedWidth, height: paintedHeight, scale, left: paintedLeft - outer.left, top: paintedTop - outer.top, right: paintedLeft + paintedWidth - outer.left, bottom: paintedTop + paintedHeight - outer.top },
      edges: [inner.left - outer.left, inner.top - outer.top, inner.right - outer.right, inner.bottom - outer.bottom],
      coversText: !copy || (inner.left <= copy.left + 1 && inner.top <= copy.top + 1 && inner.right >= copy.right - 1 && inner.bottom >= copy.bottom - 1),
      objectFit: style.objectFit,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
    };
  })));
  assert.ok(metrics.length, label + ': visible artwork exists');
  metrics.forEach(metric => {
    assert.equal(metric.scene, true, label + ': illustration classified as scene: ' + metric.key);
    assert.equal(metric.objectFit, metric.reference === 'whole-card' ? 'contain' : 'cover', label + ': correct fit mode for ' + metric.reference + ': ' + metric.key);
    assert.ok(metric.padding.every(value => parseFloat(value) === 0), label + ': no symbol padding: ' + JSON.stringify(metric));
    assert.ok(metric.frame.width > 0 && metric.frame.height > 0 && metric.edges.every(value => Math.abs(value) <= 1), label + ': image element fills its ' + metric.reference + ' within the 1px border: ' + JSON.stringify(metric));
    if (metric.reference === 'whole-card') {
      assert.ok(metric.painted.left >= -1 && metric.painted.top >= -1 && metric.painted.right <= metric.frame.width + 1 && metric.painted.bottom <= metric.frame.height + 1, label + ': complete painted artwork stays inside the card: ' + JSON.stringify(metric));
      assert.ok(Math.abs(metric.painted.width / metric.painted.height - metric.natural.width / metric.natural.height) < 0.00001, label + ': painted artwork preserves its natural aspect ratio');
      assert.ok(Math.abs(metric.painted.width - metric.image.width) <= 1 || Math.abs(metric.painted.height - metric.image.height) <= 1, label + ': contained artwork uses the available width or height');
    }
  });
  measurements.push({ label, metrics });
  return metrics;
}

async function firstMobilePage(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  while (await page.locator('[data-zgms=prev]').isEnabled()) {
    const before = await page.locator('.zgms-pagination span').innerText();
    await page.locator('[data-zgms=prev]').click();
    await page.waitForFunction(before => document.querySelector('.zgms-pagination span').textContent !== before, before);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

async function findMobileCard(page, id) {
  await firstMobilePage(page);
  const card = page.locator('.zgms-card[data-key="spell-' + id + '"]');
  while (!await card.count() && await page.locator('[data-zgms=next]').isEnabled()) {
    const before = await page.locator('.zgms-pagination span').innerText();
    await page.locator('[data-zgms=next]').click();
    await page.waitForFunction(before => document.querySelector('.zgms-pagination span').textContent !== before, before);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await page.locator('.zgms-grid').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
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
  const errors = [], blocked = new Set(), checks = [], fillMeasurements = [], responsiveCases = [];
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

    const originalPrepared = await page.evaluate(heroId => JSON.parse(JSON.stringify(characters.find(c => c.id === heroId).preparedSpells)), heroId);
    await page.locator('.zgms-filter [data-filter=equipped]').click();
    for (const locale of ['ru', 'uk']) {
      await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
      for (const [width, height] of [[390, 699], [390, 780], [360, 640]]) {
        await page.setViewportSize({ width, height });
        for (const count of [4, 3]) {
          await page.evaluate(({ heroId, ids }) => {
            const hero = characters.find(c => c.id === heroId);
            hero.preparedSpells = { kodex: [], folio: [], obrad: [] };
            ids.forEach(id => { const item = findCharacterCatalogSpell(id); hero.preparedSpells[item.spellType].push(String(id)); });
            ZargotaMobileSkills.refresh();
          }, { heroId, ids: mapped.slice(0, count).map(record => record.id) });
          await page.waitForFunction(count => document.querySelectorAll('.zgms-card').length === count && document.querySelector('.zgms-pagination span').textContent === '1 / 1', count);
          await page.waitForTimeout(150); // Resize observers and pagination fades must settle for visual evidence.
          assert.equal(await page.locator('.zgms-card em').count(), 0, 'Equipped cards do not repeat their equipped badge');
          const label = locale + ': ' + count + ' equipped cards at ' + width + 'x' + height;
          await assertMobileArtFill(page, label, fillMeasurements);
          const geometry = await page.evaluate(() => {
            const nav = document.querySelector('.zgmo-nav').getBoundingClientRect();
            return {
              width: innerWidth, height: innerHeight, documentOverflow: document.documentElement.scrollWidth - innerWidth,
              navTop: nav.top,
              cards: [...document.querySelectorAll('.zgms-card')].map(card => {
                const rect = card.getBoundingClientRect(), copy = card.querySelector('.zgms-copy').getBoundingClientRect();
                return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, copyInside: copy.left >= rect.left - 1 && copy.right <= rect.right + 1 && copy.top >= rect.top - 1 && copy.bottom <= rect.bottom + 1 };
              })
            };
          });
          assert.ok(geometry.documentOverflow <= 1, label + ': no horizontal page overflow');
          assert.ok(geometry.cards.every(card => card.left >= -1 && card.right <= width + 1 && card.top >= 0 && card.bottom <= geometry.navTop + 1 && card.copyInside), label + ': all card text and images remain above navigation: ' + JSON.stringify(geometry));
          responsiveCases.push({ locale, count, ...geometry });
          await page.screenshot({ path: path.join(output, 'mobile-equipped-' + count + '-' + width + 'x' + height + '-' + locale + '.png') });
          if (locale === 'ru' && width === 390 && height === 699 && count === 3) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 3, mobile: false });
            await page.screenshot({ path: path.join(output, 'mobile-equipped-3-390x699-ru-dpr3.png') });
            await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
            await cdp.detach();
          }
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(({ heroId, prepared }) => { characters.find(c => c.id === heroId).preparedSpells = prepared; ZargotaMobileSkills.refresh(); }, { heroId, prepared: originalPrepared });
    await page.locator('.zgms-filter [data-filter=all]').click();
    await page.waitForFunction(() => document.querySelector('.zgms-filter [data-filter=all]').getAttribute('aria-pressed') === 'true');
    await firstMobilePage(page);
    checks.push('RU/UK three and four equipped cards at 390x699, 390x780 and 360x640: complete artwork contained without cropping, no repeated badge, no clipping');

    const chargedId = await page.evaluate(heroId => {
      const hero = characters.find(c => c.id === heroId);
      return hero.spellRefs.find(id => Number((findCharacterCatalogSpell(id).cd || '').match(/(\d+)\s*(?:раз|заряд)/i)?.[1]) >= 2);
    }, heroId);
    assert.ok(chargedId, 'A mapped spell has charges to exercise');
    await (await findMobileCard(page, String(chargedId))).click();
    assert.equal((await decoded(page.locator('#zgms-dialog .zgms-detail-art > img')))[0].src, mapped.find(record => record.id === String(chargedId)).src, 'Charge test opens the chosen spell before spending');
    await page.evaluate(({ heroId, id }) => {
      window.__spellArtNodes = {
        detail: document.querySelector('#zgms-dialog .zgms-detail-art > img'),
        cards: [...document.querySelectorAll('.zgms-card .zgms-art > img')],
        pagination: document.querySelector('.zgms-pagination span').textContent,
        beforeUsed: characters.find(c => c.id === heroId).spellCD[id].used,
        title: document.querySelector('#zgms-dialog h2').textContent
      };
    }, { heroId, id: chargedId });
    await page.locator('[data-zgms=spend]').click();
    await page.waitForFunction(({ heroId, id }) => characters.find(c => c.id === heroId).spellCD[id].used === window.__spellArtNodes.beforeUsed + 1, { heroId, id: chargedId }).catch(async error => {
      const diagnostic = await page.evaluate(({ heroId, id }) => ({
        heroId, id, beforeUsed: window.__spellArtNodes.beforeUsed,
        expectedTitle: window.__spellArtNodes.title,
        currentTitle: document.querySelector('#zgms-dialog h2')?.textContent,
        currentCharges: document.querySelector('.zgms-charges')?.innerText,
        used: characters.find(c => c.id === heroId)?.spellCD[id],
        toast: document.getElementById('toast')?.textContent,
        errors: document.querySelector('#zgms-dialog')?.innerText
      }), { heroId, id: chargedId });
      fs.writeFileSync(path.join(output, 'charge-failure.json'), JSON.stringify(diagnostic, null, 2) + '\n');
      await page.screenshot({ path: path.join(output, 'charge-failure.png') });
      throw error;
    });
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
    await page.evaluate(heroId => {
      const hero = characters.find(c => c.id === heroId);
      hero.skills.push({ name: 'Значок / Піктограма', type: 'Активный', iconAsset: 'images/ui/combat-generated/codex.png' });
      ZargotaMobileSkills.refresh();
    }, heroId);
    const symbolCard = page.locator('.zgms-card[data-key="skills-2"]');
    await decoded(symbolCard.locator('.zgms-art.symbol > img'));
    const symbolMetrics = await symbolCard.evaluate(card => {
      const frame = card.querySelector('.zgms-art'), image = frame.querySelector(':scope > img');
      const style = getComputedStyle(image), cardRect = card.getBoundingClientRect(), frameRect = frame.getBoundingClientRect();
      return { scene: frame.classList.contains('scene'), symbol: frame.classList.contains('symbol'), objectFit: style.objectFit, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], cardHeight: cardRect.height, artHeight: frameRect.height };
    });
    assert.equal(symbolMetrics.scene, false, 'Built-in symbols do not turn into scene backgrounds');
    assert.equal(symbolMetrics.symbol, true);
    assert.equal(symbolMetrics.objectFit, 'contain', 'Genuine small symbols retain contain mode');
    assert.ok(symbolMetrics.padding.every(value => parseFloat(value) > 0), 'Genuine small symbols retain internal padding');
    assert.ok(symbolMetrics.artHeight < symbolMetrics.cardHeight - 20, 'The small symbol box stays separate from text');
    await assertMobileArtFill(page, 'Personal illustrations beside a genuine symbol', fillMeasurements, '.zgms-card .zgms-art.scene > img');
    await page.screenshot({ path: path.join(output, 'mobile-personal-art-and-symbol.png') });
    checks.push('Genuine built-in symbol keeps its padded contain-mode icon area beside uncropped personal illustrations');
    assert.ok(await page.evaluate(() => window.__spellArtCatalogBefore === JSON.stringify(entries)), 'Viewing illustrations and spending a charge never changes catalog rules');
    checks.push('Charge update preserves image nodes and pagination; custom art wins; catalog remains unchanged');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    const report = { checks, mappedCount: mapped.length, pageCount, mapped, dimensions: allImages, fillMeasurements, responsiveCases, symbolMetrics, sourceClassification, legacyCases, blockedExternalOrigins: [...blocked], screenshots: fs.readdirSync(output).filter(name => name.endsWith('.png')) };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS spell art: ' + mapped.length + ' assets, RU/UK catalog/details, 390x699/390x780/360x640 uncropped contained artwork, 3/4 equipped cards, stable charge image nodes and symbol mode. Evidence: ' + output);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
