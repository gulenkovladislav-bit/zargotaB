'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8876';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Run against an isolated local server');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const catalog = Array.isArray(data.catalog) ? data.catalog : data.catalog.entries;
const charged = catalog.find(spell => /Ответный Шип/i.test(spell.name));
const complex = catalog.find(spell => String(spell.id) === '1775564915341');
assert.ok(charged && complex, 'The fixture uses existing two-use and complex spells');
assert.match(charged.cd, /2\s*раз/, 'The charge fixture must really allow two uses');
const heroId = 987654341;
const hero = JSON.parse(JSON.stringify(data.characters.find(character => /Эстерос/.test(character.name)) || data.characters[0]));
Object.assign(hero, {
  id: heroId,
  name: 'Проверка карточки заклинания',
  nameUk: 'Перевірка картки заклинання',
  spellRefs: [charged.id, complex.id],
  spellsLearned: {[charged.id]: true},
  preparedSpells: {kodex: [], folio: [], obrad: []},
  spellCD: {[charged.id]: {used: 0}},
  skills: [],
  mastery: []
});
hero.preparedSpells[charged.spellType] = [String(charged.id)];
delete hero.campaignKey;

async function selectTab(page, tab) {
  const button = page.locator('#zgms-dialog [data-zgms="detail-tab"][data-tab="' + tab + '"]');
  await button.click();
  await page.waitForFunction(tab => document.querySelector('#zgms-dialog [data-zgms="detail-tab"][data-tab="' + tab + '"]')?.getAttribute('aria-selected') === 'true', tab);
  await assertTabs(page, tab);
}

async function assertTabs(page, selected) {
  const state = await page.locator('#zgms-dialog').evaluate((dialog, selected) => {
    const buttons = [...dialog.querySelectorAll('[data-zgms="detail-tab"]')];
    return {
      keys: buttons.map(button => button.dataset.tab),
      panels: dialog.querySelectorAll('[role="tabpanel"]').length,
      selected: buttons.filter(button => button.getAttribute('aria-selected') === 'true').map(button => button.dataset.tab),
      connected: buttons.every(button => {
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        return panel && dialog.contains(panel) && panel.getAttribute('role') === 'tabpanel' && panel.hidden === (button.dataset.tab !== selected);
      })
    };
  }, selected);
  assert.deepEqual(state.keys, ['use', 'learn', 'description']);
  assert.equal(state.panels, 3);
  assert.deepEqual(state.selected, [selected]);
  assert.equal(state.connected, true, 'Each tab controls exactly its own hidden/visible content');
}

async function waitCharges(page, remaining, max = 2) {
  await page.waitForFunction(({remaining, max}) => {
    const strong = document.querySelector('#zgms-dialog .zgms-charges strong');
    return strong && strong.textContent.trim() === remaining + ' / ' + max;
  }, {remaining, max});
}

async function used(page) {
  return page.evaluate(({heroId, spellId}) => Number(characters.find(character => character.id === heroId).spellCD?.[spellId]?.used) || 0, {heroId, spellId: charged.id});
}

async function assertMetadata(page, spell, locale = 'ru') {
  const names = {
    damage: ['Урон', 'Шкода'], transform: ['Трансформация', 'Перетворення'], control: ['Контроль', 'Контроль'],
    pierce: ['Колющий', 'Колючий'], slash: ['Рубящий', 'Рубальний'], blunt: ['Дробящий', 'Дробильний'],
    psych: ['Психический', 'Психічний'], radiant: ['Лучевой', 'Променевий']
  };
  const tags = await page.locator('#zgms-dialog #zgms-panel-use .zgms-spell-metadata .zgms-spell-tag').allTextContents();
  for (const key of [...(spell.categories || []), ...(spell.damageTypes || [])]) {
    const expected = names[key]?.[locale === 'uk' ? 1 : 0];
    assert.ok(expected && tags.some(tag => tag.includes(expected)), 'Catalog metadata missing: ' + key + ' / ' + JSON.stringify(tags));
  }
  if (locale === 'ru') for (const value of [spell.klasse, spell.tip].filter(Boolean)) {
    assert.ok(tags.some(tag => tag.includes(value)), 'Catalog class/type missing: ' + value);
  }
}

async function rememberNodes(page) {
  await page.evaluate(() => {
    const panel = document.querySelector('#zgms-dialog .zgms-spell-panel');
    window.__spellDetailNodes = {
      dialog: document.getElementById('zgms-dialog'),
      panel,
      header: panel.querySelector('header'),
      art: panel.querySelector('.zgms-detail-art img')
    };
    if (!window.__spellDetailNodes.header || !window.__spellDetailNodes.art) throw Error('Missing stable spell header or thumbnail');
  });
}

async function assertStableNodes(page) {
  const stable = await page.evaluate(() => {
    const before = window.__spellDetailNodes;
    const panel = document.querySelector('#zgms-dialog .zgms-spell-panel');
    return before.dialog === document.getElementById('zgms-dialog') && before.panel === panel && before.header === panel.querySelector('header') && before.art === panel.querySelector('.zgms-detail-art img');
  });
  assert.equal(stable, true, 'Changing uses or study state must not recreate the header or thumbnail');
}

async function assertFits(page, label) {
  const geometry = await page.locator('#zgms-dialog .zgms-spell-panel').evaluate(panel => {
    const rect = panel.getBoundingClientRect();
    const nav = document.querySelector('.zgmo-nav');
    const navRect = nav && nav.getClientRects().length ? nav.getBoundingClientRect() : null;
    const tabOverflows = [...panel.querySelectorAll('[data-zgms="detail-tab"]')].map(button => button.scrollWidth - button.clientWidth);
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      overflow: panel.scrollWidth - panel.clientWidth,
      tabOverflows,
      navTop: navRect && navRect.top,
      width: rect.width
    };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1, label + ': horizontal clipping ' + JSON.stringify(geometry));
  assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.viewportHeight + 1, label + ': vertical clipping ' + JSON.stringify(geometry));
  assert.ok(geometry.overflow <= 1 && geometry.tabOverflows.every(value => value <= 1), label + ': text overflows ' + JSON.stringify(geometry));
  if (geometry.viewportWidth < 1000 && geometry.navTop != null) assert.ok(geometry.bottom <= geometry.navTop + 1, label + ': bottom navigation is covered');
  if (geometry.viewportWidth >= 1000) assert.ok(geometry.width >= 600, label + ': desktop must not be a narrow phone strip');
}

async function assertHeaderControls(page) {
  const result = await page.locator('#zgms-dialog .zgms-spell-panel').evaluate(panel => {
    const rect = node => {
      const box = node.getBoundingClientRect();
      return {left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height};
    };
    const outer = rect(panel);
    const heading = rect(panel.querySelector('.zgms-spell-heading'));
    const controls = ['detail-menu', 'close', 'study-tab'].map(action => {
      const node = panel.querySelector('[data-zgms="' + action + '"]');
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = rect(node);
      const icon = node.querySelector('svg');
      const content = icon ? [icon.getBoundingClientRect()] : [...range.getClientRects()];
      return {
        action, box,
        accessible: !!node.getAttribute('aria-label'),
        content: icon ? !!icon.querySelector('path,circle,line,polyline') : !!node.textContent.trim(),
        insidePanel: box.left >= outer.left && box.right <= outer.right && box.top >= outer.top && box.bottom <= outer.bottom,
        textFits: content.length > 0 && content.every(text => text.width > 0 && text.height > 0 && text.left >= box.left - 1 && text.right <= box.right + 1 && text.top >= box.top - 1 && text.bottom <= box.bottom + 1)
      };
    });
    return {heading, controls};
  });
  assert.deepEqual(result.controls.map(control => control.action), ['detail-menu', 'close', 'study-tab']);
  assert.ok(result.controls.every(control => control.accessible && control.content && control.insidePanel && control.textFits), 'Header actions and icons must fit: ' + JSON.stringify(result));
  assert.ok(result.heading.right <= result.controls[0].box.left && result.controls[0].box.right <= result.controls[1].box.left, 'Title, menu and close must not overlap');
}

async function settleArt(page) {
  await page.locator('#zgms-dialog .zgms-detail-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.locator('#zgms-dialog').evaluate(dialog => Promise.all(dialog.getAnimations({subtree: true}).map(animation => animation.finished.catch(() => {}))));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  // Screenshots describe the spell, rather than the intentionally rejected-save toast.
  await page.locator('#toast').waitFor({state: 'hidden'});
}

async function openSpell(page, spellId, bridge = false) {
  await page.evaluate(({heroId, spellId, bridge}) => {
    window._charSheetTab = 'skills';
    showPage('characters');
    openCharSheet(heroId);
    if (bridge) showSpellDetail(heroId, spellId);
    else ZargotaMobileSkills.openSpell(heroId, spellId);
  }, {heroId, spellId, bridge});
  await page.locator('#zgms-dialog .zgms-spell-panel').waitFor();
  await assertTabs(page, 'use');
  await assertHeaderControls(page);
}

async function desktopPendingClose(page, ok, reopen) {
  // Reset only this isolated fixture so both resolution branches start at one remaining use.
  await page.evaluate(({heroId, spellId}) => {
    characters.find(character => character.id === heroId).spellCD[spellId].used = 1;
  }, {heroId, spellId: charged.id});
  await openSpell(page, charged.id, true);
  await assertMetadata(page, charged);
  await page.evaluate(({heroId, spellId}) => {
    window.__desktopRenderOriginal = window.renderCharSheet;
    window.__desktopRenderCalls = [];
    window.renderCharSheet = function (...args) {
      window.__desktopRenderCalls.push({
        character: window.viewingCharId,
        used: characters.find(character => character.id === heroId).spellCD[spellId].used,
        dialog: !!document.getElementById('zgms-dialog')
      });
      return window.__desktopRenderOriginal.apply(this, args);
    };
    window.__desktopFinishSave = null;
    window.saveChars = () => new Promise(resolve => { window.__desktopFinishSave = resolve; });
  }, {heroId, spellId: charged.id});
  try {
    await page.locator('#zgms-dialog [data-zgms="spend"]').click();
    await page.waitForFunction(() => typeof window.__desktopFinishSave === 'function');
    await page.locator('#zgms-dialog [data-zgms="close"]').click();
    assert.equal(await page.locator('#zgms-dialog').count(), 0, 'Closing while saving remains available');
    assert.deepEqual(await page.evaluate(() => window.__desktopRenderCalls), [], 'Do not redraw the desktop from an unsettled save');
    if (reopen) {
      await page.evaluate(({heroId, spellId}) => ZargotaMobileSkills.openSpell(heroId, spellId), {heroId, spellId: complex.id});
      await selectTab(page, 'description');
      await rememberNodes(page);
    }
    await page.evaluate(async ok => {
      window.__desktopFinishSave({ok});
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, ok);
    assert.equal(await used(page), ok ? 2 : 1, 'A delayed desktop save must commit or roll back correctly');
    const renders = await page.evaluate(() => window.__desktopRenderCalls);
    if (reopen) {
      assert.deepEqual(renders, [], 'Completing the prior save must not replace a newly opened dialog');
      await assertStableNodes(page);
      await assertTabs(page, 'description');
      assert.match(await page.locator('#zgms-detail-title').innerText(), /Полиморф/);
    } else {
      assert.deepEqual(renders, [{character: heroId, used: ok ? 2 : 1, dialog: false}], 'The same desktop character refreshes after the final outcome');
      assert.equal(await page.locator('#zgms-dialog').count(), 0);
    }
  } finally {
    await page.evaluate(() => {
      window.saveChars = window.__spellOriginalSave;
      window.renderCharSheet = window.__desktopRenderOriginal;
    });
    if (await page.locator('#zgms-dialog').count()) await page.locator('#zgms-dialog [data-zgms="close"]').click();
  }
}

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.ZG_EDGE_EXECUTABLE || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  const errors = [], blockedOrigins = new Set();
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 780}, hasTouch: true, deviceScaleFactor: 2});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return route.continue();
      blockedOrigins.add(url.origin);
      return route.abort();
    });
    await context.addInitScript(({catalog, hero, version}) => {
      if (localStorage.getItem('zg_spell_detail_fixture_v1')) return;
      localStorage.setItem('grimoire_v3', JSON.stringify(catalog));
      localStorage.setItem('grimoire_chars', JSON.stringify([hero]));
      localStorage.setItem('zg_data_version', version);
      localStorage.setItem('zg_spell_detail_fixture_v1', '1');
    }, {catalog: data.catalog, hero, version: manifest.version});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.locator('#zg-data-loader-splash').waitFor({state: 'hidden', timeout: 45000});
    await page.evaluate(async () => { await window.zgCharacterLoadPromise; });
    await openSpell(page, charged.id);
    await assertMetadata(page, charged);
    await waitCharges(page, 2);
    assert.match(await page.locator('#zgms-dialog .zgms-charge-copy').innerText(), /бой/i, 'Recovery text must retain the real battle limit');
    assert.match(await page.locator('#zgms-dialog [data-zgms="spend"]').innerText(), /Применить/);
    await settleArt(page);
    await page.screenshot({path: '/tmp/zargota-spell-detail-mobile.png'});
    await rememberNodes(page);

    // Only one mutation may enter an unresolved save, even if a second event is dispatched.
    await page.evaluate(() => {
      window.__spellOriginalSave = window.saveChars;
      window.__spellSaveCalls = 0;
      window.saveChars = () => {
        window.__spellSaveCalls++;
        return new Promise(resolve => { window.__finishSpellSave = resolve; });
      };
    });
    await page.locator('#zgms-dialog [data-zgms="spend"]').click();
    await page.waitForFunction(() => window.__spellSaveCalls === 1);
    assert.equal(await page.locator('#zgms-dialog [data-zgms="spend"]').isDisabled(), true, 'Apply disables while saving');
    await page.locator('#zgms-dialog [data-zgms="spend"]').evaluate(button => button.dispatchEvent(new MouseEvent('click', {bubbles: true})));
    assert.equal(await page.evaluate(() => window.__spellSaveCalls), 1);
    assert.equal(await used(page), 1);
    await selectTab(page, 'description');
    await page.evaluate(() => window.__finishSpellSave({ok: true}));
    await waitCharges(page, 1);
    await assertTabs(page, 'description');
    await assertStableNodes(page);
    await page.evaluate(() => { window.saveChars = window.__spellOriginalSave; });
    await selectTab(page, 'use');
    await page.locator('#zgms-dialog [data-zgms="spend"]').click();
    await waitCharges(page, 0);
    assert.equal(await page.locator('#zgms-dialog [data-zgms="spend"]').isDisabled(), true, 'An exhausted spell cannot be used again');
    assert.equal(await used(page), 2);
    await assertStableNodes(page);

    await page.locator('#zgms-dialog [data-zgms="detail-menu"]').click();
    await page.locator('[data-zgms="restore"]').click();
    await waitCharges(page, 1);
    assert.equal(await used(page), 1, 'Restore returns one use, not the entire daily capacity');

    // A rejected save must roll the optimistic use back and keep the dialog usable.
    await page.evaluate(() => {
      window.__spellFailedSaveCalls = 0;
      window.saveChars = () => { window.__spellFailedSaveCalls++; return Promise.resolve({ok: false}); };
    });
    await page.locator('#zgms-dialog [data-zgms="spend"]').click();
    await page.waitForFunction(() => window.__spellFailedSaveCalls === 1);
    await waitCharges(page, 1);
    await page.waitForFunction(() => !document.querySelector('#zgms-dialog [data-zgms="spend"]').disabled);
    assert.equal(await used(page), 1, 'Failed saves must not consume a use');
    await assertTabs(page, 'use');
    await assertStableNodes(page);
    await page.evaluate(() => { window.saveChars = window.__spellOriginalSave; });

    // A known spell and an unknown spell use the same detail shell, with different actions.
    const learnedAppearance = await page.locator('#zgms-dialog .zgms-detail-art img').evaluate(image => {
      const result = [];
      for (let node = image; node && node.id !== 'zgms-dialog'; node = node.parentElement) {
        const style = getComputedStyle(node); result.push([style.filter, style.opacity]);
      }
      return result;
    });
    await page.locator('#zgms-dialog [data-zgms="close"]').click();
    await openSpell(page, complex.id);
    assert.equal(await page.locator('#zgms-dialog [data-zgms="spend"]').count(), 0, 'Unlearned spells never expose Apply');
    assert.match(await page.locator('#zgms-dialog .zgms-study-state').innerText(), /не изучено/i);
    assert.ok(await page.locator('#zgms-dialog footer [data-zgms="study-tab"]').isVisible(), 'Unlearned footer directs the player to learning');
    const unlearnedAppearance = await page.locator('#zgms-dialog .zgms-detail-art img').evaluate(image => {
      const result = [];
      for (let node = image; node && node.id !== 'zgms-dialog'; node = node.parentElement) {
        const style = getComputedStyle(node); result.push([style.filter, style.opacity]);
      }
      return result;
    });
    assert.notDeepEqual(unlearnedAppearance, learnedAppearance, 'Unlearned art must look visibly subdued');
    await settleArt(page);
    await page.screenshot({path: '/tmp/zargota-spell-detail-unlearned.png'});
    await rememberNodes(page);
    await page.locator('#zgms-dialog .zgms-study-state[data-zgms="study-tab"]').click();
    await assertTabs(page, 'learn');
    assert.equal(complex.learnType, 'ritual');
    assert.ok((await page.locator('#zgms-panel-learn .zgms-rule h3').allTextContents()).includes('Ритуал изучения'), 'The actual ritual learning type is preserved');
    assert.ok(await page.locator('#zgms-dialog [data-zgms="learn"]').isVisible());
    await settleArt(page);
    await page.screenshot({path: '/tmp/zargota-spell-detail-learning.png'});
    await page.evaluate(() => { window.saveChars = () => Promise.resolve({ok: false}); });
    await page.locator('#zgms-dialog [data-zgms="learn"]').click();
    await page.waitForFunction(() => {
      const button = document.querySelector('#zgms-dialog [data-zgms="learn"]');
      return button && !button.disabled;
    });
    assert.equal(await page.evaluate(({heroId, spellId}) => !!characters.find(character => character.id === heroId).spellsLearned[spellId], {heroId, spellId: complex.id}), false);
    await assertTabs(page, 'learn');
    await assertStableNodes(page);
    await page.evaluate(() => { window.saveChars = window.__spellOriginalSave; });
    await page.locator('#zgms-dialog [data-zgms="learn"]').click();
    await page.locator('#zgms-dialog [data-zgms="equip"]').waitFor();
    assert.match(await page.locator('#zgms-dialog .zgms-study-state').innerText(), /Изучено/);
    await assertTabs(page, 'learn');
    await assertStableNodes(page);
    await page.locator('#zgms-dialog [data-zgms="equip"]').click();
    await page.waitForFunction(({heroId, spellId}) => Object.values(characters.find(character => character.id === heroId).preparedSpells).flat().map(String).includes(String(spellId)), {heroId, spellId: complex.id});
    await page.locator('#zgms-dialog [data-zgms="detail-menu"]').click();
    await page.locator('[data-zgms="forget"]').click();
    await page.locator('#zgms-dialog [data-zgms="learn"]').waitFor();
    assert.equal(await page.locator('#zgms-dialog [data-zgms="spend"]').count(), 0);
    assert.equal(await page.evaluate(({heroId, spellId}) => Object.values(characters.find(character => character.id === heroId).preparedSpells).flat().map(String).includes(String(spellId)), {heroId, spellId: complex.id}), false, 'Forgetting removes preparation');
    await assertTabs(page, 'learn');
    await assertStableNodes(page);
    await page.locator('#zgms-dialog [data-zgms="close"]').click();

    // Reload the same isolated context without resetting its saved fixture.
    await page.reload();
    await page.locator('#zg-data-loader-splash').waitFor({state: 'hidden', timeout: 45000});
    await page.evaluate(async () => { await window.zgCharacterLoadPromise; });
    assert.equal(await used(page), 1, 'The successful use/restoration persists across reload');

    for (const locale of ['ru', 'uk']) {
      await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
      for (const [width, height] of [[320, 568], [390, 780], [430, 932], [1440, 900]]) {
        await page.setViewportSize({width, height});
        await openSpell(page, complex.id, width >= 1000);
        await assertMetadata(page, complex, locale);
        const labels = await page.locator('#zgms-dialog [data-zgms="detail-tab"]').allTextContents();
        assert.deepEqual(labels.map(label => label.trim()), locale === 'ru' ? ['Применение', 'Изучение', 'Описание'] : ['Застосування', 'Вивчення', 'Опис']);
        for (const tab of ['use', 'learn', 'description']) {
          await selectTab(page, tab);
          await assertFits(page, locale + ' ' + width + '×' + height + ' ' + tab);
          if (tab === 'learn') assert.ok((await page.locator('#zgms-panel-learn .zgms-rule h3').allTextContents()).includes(locale === 'ru' ? 'Ритуал изучения' : 'Ритуал вивчення'));
        }
        if (width === 1440 && locale === 'ru') {
          await selectTab(page, 'use');
          await settleArt(page);
          await page.screenshot({path: '/tmp/zargota-spell-detail-desktop.png'});
        }
        await page.locator('#zgms-dialog [data-zgms="close"]').click();
      }
    }
    await page.evaluate(() => ZargotaI18n.setLocale('ru'));
    for (const ok of [true, false]) {
      await desktopPendingClose(page, ok, false);
      await desktopPendingClose(page, ok, true);
    }
    assert.deepEqual(errors, [], 'No uncaught page errors');
    console.log(JSON.stringify({result: 'PASS',checks: ['three tabs', 'learned and unlearned', '2→1→0 uses', 'pending duplicate guard', 'failed-save rollback', 'restore one use', 'stable header/art', 'learning and preparation', 'reload persistence', 'catalog metadata and actual learning type', 'desktop pending save close success/failure and reopened dialog', 'RU/UK', '320/390/430/mobile and 1440/desktop bridge'], blockedExternalOrigins: [...blockedOrigins]}));
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
