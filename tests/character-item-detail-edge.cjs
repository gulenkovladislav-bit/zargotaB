'use strict';

// Isolated, real Edge coverage for inventory rows and the illustrated item page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const economy = require('../item-economy.js');
const translations = require('../zargota-i18n-shop-uk.js').translations;

const root = path.resolve(__dirname, '..');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8877';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Use an isolated local server');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const definitions = economy.getShopSeedItems();
const fixtureIds = ['shp_weapon_23', 'shp_armor_06', 'shp_potion_01', 'shp_consumable_02', 'shp_adornment_01'];
const sourceItems = fixtureIds.map(id => {
  const item = definitions.find(item => item.id === id);
  assert.ok(item, 'Missing real catalog fixture: ' + id);
  assert.ok(translations[item.name] && translations[item.effect] && translations[item.desc], 'Fixture has reviewed RU/UK prose: ' + id);
  return item;
});
const heroId = 987654361;
const hero = JSON.parse(JSON.stringify(data.characters.find(character => character.name === 'Эстерос') || data.characters[0]));
Object.assign(hero, {
  id: heroId,
  name: 'Проверка предметов',
  nameUk: 'Перевірка предметів',
  equipItems: [],
  arenaEquipSlots: {},
  inventoryItems: sourceItems.map((source, index) => {
    const qty = index === 2 ? 3 : 1;
    const itemId = 'item-detail-fixture-' + index;
    const item = Object.assign({}, source, economy.definitionToInventorySnapshot(source, itemId, qty), {
      itemId, catalogItemId: String(source.id), qty, equipped: false,
      description: source.description || source.desc || '', preferredSlot: source.preferredSlot || source.slot || ''
    });
    delete item.slot;
    return item;
  })
});
delete hero.campaignKey;
hero.inventoryItems.push({
  itemId: 'item-detail-fixture-manual', name: 'Рукописный журнал с очень длинным названием',
  nameUk: 'Рукописний журнал із дуже довгою назвою', qty: 1, icon: '◇',
  description: 'Авторская заметка без числовых параметров. '.repeat(30) + 'Последняя строка заметки.',
  descriptionUk: 'Авторська нотатка без числових параметрів. '.repeat(30) + 'Останній рядок нотатки.'
});
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const screenshots = {};
const normalized = value => String(value).normalize('NFC').replace(/\s+/g, ' ').trim();

async function settle(page) {
  await page.locator('#zgmi-dialog>section').evaluate(async element => {
    await Promise.allSettled(element.getAnimations({subtree: true}).map(animation => animation.finished));
    await Promise.allSettled([...element.querySelectorAll('img')].map(image => image.decode()));
  });
}

async function closeDetail(page) {
  if (await page.locator('#zgmi-dialog').count()) await page.locator('#zgmi-dialog header [data-zgmi=close]').first().click();
}

async function painted(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openItem(page, index) {
  await closeDetail(page);
  const group = page.locator('.zgmi-groups [data-group=bag]');
  if (await group.getAttribute('aria-pressed') !== 'true') await group.click();
  await painted(page);
  const previous = page.locator('.zgmi-footer [data-zgmi=prev]');
  for (let n = 0; n < 10 && await previous.isEnabled(); n++) { await previous.click(); await painted(page); }
  const card = page.locator('.zgmi-card[data-zgmi=item][data-key="inventoryItems-' + index + '"]');
  for (let n = 0; n < 10 && !await card.count(); n++) {
    const next = page.locator('.zgmi-footer [data-zgmi=next]');
    assert.ok(await next.isEnabled(), 'Fixture item must be reachable: ' + index);
    await next.click();
    await painted(page);
  }
  await card.click();
  await page.locator('#zgmi-dialog>section[data-view=item]').waitFor();
  await settle(page);
}

async function assertGeometry(page, context) {
  const geometry = await page.locator('#zgmi-dialog>section').evaluate(panel => {
    const art = panel.querySelector('.zgmi-detail-art');
    const title = panel.querySelector('.zgmi-detail-scroll h2');
    const image = art?.querySelector('img[data-zgmi-full]');
    const rect = element => element.getBoundingClientRect();
    const artRect = art && rect(art), titleRect = title && rect(title);
    return {
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      top: rect(panel).top, bottom: rect(panel).bottom,
      navTop: rect(document.querySelector('.zgmo-nav')).top,
      navBottom: rect(document.querySelector('.zgmo-nav')).bottom,
      viewportHeight: innerHeight,
      toolbar: [...panel.querySelectorAll('header>button')].map(button => ({top: rect(button).top, bottom: rect(button).bottom, visible: getComputedStyle(button).visibility !== 'hidden' && getComputedStyle(button).display !== 'none'})),
      artBeforeTitle: !!artRect && !!titleRect && artRect.bottom <= titleRect.top + 1,
      titleBeforeRules: !!title && !!panel.querySelector('.zgmi-item-effect') && !!(title.compareDocumentPosition(panel.querySelector('.zgmi-item-effect')) & Node.DOCUMENT_POSITION_FOLLOWING),
      tabs: panel.querySelectorAll('[role=tab],[role=tablist],details').length,
      image: image ? {fit: getComputedStyle(image).objectFit, transform: getComputedStyle(image).transform, complete: image.complete && image.naturalWidth > 0, inside: rect(image).left >= artRect.left - 1 && rect(image).right <= artRect.right + 1 && rect(image).top >= artRect.top - 1 && rect(image).bottom <= artRect.bottom + 1} : null,
      buttons: [...panel.querySelectorAll('.zgmi-item-actions button')].map(button => ({width: button.clientWidth, height: button.clientHeight, overflow: button.scrollWidth - button.clientWidth}))
    };
  });
  assert.ok(geometry.pageOverflow <= 1 && geometry.panelOverflow <= 1, JSON.stringify({context, geometry}));
  assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.navTop + 1, JSON.stringify({context, geometry}));
  assert.ok(geometry.navBottom <= geometry.viewportHeight + 1 && geometry.bottom <= geometry.viewportHeight, JSON.stringify({context, geometry}));
  assert.ok(geometry.toolbar.every(button => button.visible && button.top >= 0 && button.bottom <= geometry.viewportHeight), JSON.stringify({context, geometry}));
  assert.equal(geometry.artBeforeTitle, true, 'Concept A artwork must precede the title: ' + context);
  assert.equal(geometry.titleBeforeRules, true, 'Concept A title must precede the human-readable rules: ' + context);
  assert.equal(geometry.tabs, 0, 'Concept A is one page, not tabs or accordions');
  assert.ok(geometry.buttons.every(button => button.width >= 44 && button.height >= 44 && button.overflow <= 1), JSON.stringify({context, geometry}));
  assert.ok(geometry.image?.complete && geometry.image.inside && geometry.image.fit === 'contain' && geometry.image.transform === 'none', JSON.stringify({context, geometry}));
}

async function assertContent(page, index, locale) {
  const source = sourceItems[index];
  const expected = value => locale === 'uk' ? translations[value] : value;
  assert.equal(normalized(await page.locator('.zgmi-detail-scroll h2').innerText()), normalized(expected(source.name)));
  assert.ok(normalized(await page.locator('.zgmi-item-effect').innerText()).includes(normalized(expected(source.effect))), 'Full source effect must survive: ' + source.id + ' / ' + locale);
  assert.ok(normalized(await page.locator('.zgmi-description').innerText()).includes(normalized(expected(source.desc))), 'Description must survive: ' + source.id + ' / ' + locale);
  const text = await page.locator('#zgmi-dialog').innerText();
  assert.doesNotMatch(text, /undefined|\[object Object\]|visible-adjacent-melee|next-fire|ninth-answer-riposte/);
  assert.equal(await page.locator('#zgmi-dialog header h2').count(), 0, 'Title should not consume another toolbar above the illustration');
  if (index === 0) {
    assert.match(text, /1d8/);
    assert.match(text, locale === 'uk' ? /Спритність\s*4\+/i : /Ловкость\s*4\+/i);
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=equip]').count(), 1);
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=use]').count(), 0);
  }
  if (index === 2 || index === 3) {
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=use]').count(), 1, 'A single-use consumable has a Use action');
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=equip]').count(), 0, 'A potion or utility salve must not pretend to be equipment');
  }
}

async function saveScreenshot(page, name) {
  const file = '/private/tmp/zargota-item-detail-' + stamp + '-' + name + '.png';
  await page.locator('.zgmi-detail-scroll').evaluate(element => element.scrollTop = 0);
  await painted(page);
  await page.screenshot({path: file});
  screenshots[name] = file;
  if (process.env.ZG_ITEM_LAYOUT_DEBUG === '1') console.log('LAYOUT ' + name, JSON.stringify(await page.evaluate(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
    const inspect = selector => { const element = document.querySelector(selector); if (!element) return null; const style=getComputedStyle(element); return {rect:rect(element),opacity:style.opacity,visibility:style.visibility,transform:style.transform,position:style.position,zIndex:style.zIndex}; };
    const close=document.querySelector('#zgmi-dialog [data-zgmi=close]'),r=close.getBoundingClientRect();
    return {scroll:[scrollX,scrollY],viewport:[innerWidth,innerHeight,visualViewport?.width,visualViewport?.height,visualViewport?.offsetTop],vars:[getComputedStyle(document.documentElement).getPropertyValue('--zg-viewport-height'),getComputedStyle(document.body).getPropertyValue('--zgmo-nav-height')],close:inspect('#zgmi-dialog [data-zgmi=close]'),header:inspect('#zgmi-dialog header'),dialog:inspect('#zgmi-dialog'),panel:inspect('#zgmi-dialog>section'),nav:inspect('.zgmo-nav'),actions:inspect('.zgmi-item-actions'),closeHit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)};
  })));
}

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.ZG_EDGE_EXECUTABLE || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'});
  const errors = [], blockedOrigins = new Set();
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, deviceScaleFactor: 2});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return route.continue();
      blockedOrigins.add(url.origin);
      return route.abort();
    });
    await context.addInitScript(({catalog, hero, version}) => {
      if (localStorage.getItem('zg_item_detail_fixture_v1')) return;
      localStorage.setItem('grimoire_v3', JSON.stringify(catalog));
      localStorage.setItem('grimoire_chars', JSON.stringify([hero]));
      localStorage.setItem('zg_data_version', version);
      localStorage.setItem('zg_item_detail_fixture_v1', '1');
    }, {catalog: data.catalog, hero, version: manifest.version});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.locator('#zg-data-loader-splash').waitFor({state: 'hidden', timeout: 45000});
    await page.evaluate(async id => { await window.zgCharacterLoadPromise; window._charSheetTab = 'inventory'; showPage('characters'); openCharSheet(id); }, heroId);
    await page.locator('.zgmi-v2').waitFor();
    await painted(page);
    const bagShot='/private/tmp/zargota-item-detail-'+stamp+'-bag.png';
    await page.screenshot({path:bagShot}); screenshots.bag=bagShot;
    console.log('BAG',JSON.stringify(await page.locator('.zgmi-grid').evaluate(grid=>({clientHeight:grid.clientHeight,scrollHeight:grid.scrollHeight,items:grid.querySelectorAll('[data-zgmi=item]').length}))));

    for (const locale of process.env.ZG_ITEM_ACTIONS_ONLY === '1' ? [] : process.env.ZG_ITEM_LAYOUT_DEBUG === '1' ? ['ru'] : ['ru', 'uk']) {
      await page.evaluate(value => ZargotaI18n.setLocale(value), locale);
      for (const [width, height] of process.env.ZG_ITEM_VIEWPORT_ONLY === '390' ? [[390,844]] : [[320, 568], [390, 844], [430, 932]]) {
        await page.setViewportSize({width, height});
        await page.waitForTimeout(180);
        await closeDetail(page);
        const gridGeometry=await page.locator('.zgmi-grid').evaluate(grid=>({clientHeight:grid.clientHeight,scrollHeight:grid.scrollHeight,items:grid.querySelectorAll('[data-zgmi=item]').length}));
        assert.ok(gridGeometry.scrollHeight-gridGeometry.clientHeight<=1,'Horizontal rows must fit their page instead of adding a nested scroll: '+locale+' '+width+' '+JSON.stringify(gridGeometry));
        const rows = await page.locator('.zgmi-card[data-zgmi=item]').evaluateAll(cards => cards.map(card => {
          const art = card.querySelector('.zgmi-art').getBoundingClientRect();
          const copy = card.querySelector('.zgmi-card-copy');
          return {horizontal: copy && copy.getBoundingClientRect().left >= art.right - 1, name: copy?.querySelector('strong')?.textContent, meta: card.querySelector('.zgmi-card-meta')?.textContent, overflow: card.scrollWidth - card.clientWidth};
        }));
        assert.ok(rows.length && rows.every(row => row.horizontal && row.name && row.meta && row.overflow <= 1), JSON.stringify({locale, width, rows}));
        for (const index of [0, 1, 2]) {
          await openItem(page, index);
          await assertContent(page, index, locale);
          await assertGeometry(page, locale + ' ' + width + ' ' + sourceItems[index].id);
          if (width === 390 && (index === 0 || index === 2)) await saveScreenshot(page, locale + (index === 0 ? '-sword' : '-potion'));
        }
      }
    }

    if(process.env.ZG_ITEM_LAYOUT_DEBUG === '1'){ console.log(JSON.stringify({screenshots},null,2)); return; }

    await page.evaluate(() => ZargotaI18n.setLocale('ru'));
    await page.setViewportSize({width: 390, height: 844});
    await openItem(page, 3);
    await assertContent(page, 3, 'ru');
    assert.match(await page.locator('.zgmi-item-effect').innerText(), /следующий огненный урон\s*−1d6\s*в этой сцене/);
    await openItem(page, 4);
    await assertContent(page, 4, 'ru');
    assert.match(await page.locator('.zgmi-item-effect').innerText(), /Мелкие предметы.*мокрой ладони/);
    await openItem(page, 5);
    await page.locator('.zgmi-detail-scroll').evaluate(element => element.scrollTop = element.scrollHeight);
    assert.match(await page.locator('.zgmi-description').innerText(), /Последняя строка заметки/);
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=use]').count(), 0, 'An ordinary note is not a consumable');
    assert.ok(await page.locator('#zgmi-dialog').evaluate(dialog => dialog.getBoundingClientRect().bottom <= document.querySelector('.zgmo-nav').getBoundingClientRect().top + 1));

    // Enlarging the original artwork returns to the same one-page detail.
    await openItem(page, 0);
    await page.locator('[data-zgmi=art]').click();
    await page.locator('[data-zgmi=art-zoom]').click();
    assert.ok(await page.locator('.zgmi-art-canvas').evaluate(element => element.scrollWidth > element.clientWidth));
    await page.locator('[data-zgmi=art-return]').click();
    await assertContent(page, 0, 'ru');

    // Equipment transitions keep the original instance and its custom metadata.
    const beforeEquip = await page.evaluate(id => JSON.stringify(characters.find(character => character.id === id).inventoryItems), heroId);
    await page.locator('.zgmi-item-actions [data-zgmi=equip]').click();
    await page.waitForFunction(id => characters.find(character => character.id === id).inventoryItems[0].equipped, heroId);
    await closeDetail(page);
    await page.locator('.zgmi-groups [data-group=equipment]').click();
    await page.locator('.zgmi-card[data-key="inventoryItems-0"]').click();
    await page.locator('.zgmi-item-actions [data-zgmi=equip]').click();
    await page.waitForFunction(id => !characters.find(character => character.id === id).inventoryItems[0].equipped, heroId);
    assert.equal(await page.evaluate(id => JSON.stringify(characters.find(character => character.id === id).inventoryItems), heroId), beforeEquip);

    // Quantity edits cancel cleanly; a single Use changes only the stack count.
    await openItem(page, 2);
    await page.locator('[data-zgmi=quantity]').click();
    await page.locator('[data-zgmi=plus]').click();
    await page.locator('[data-zgmi=quantity-cancel]').last().click();
    assert.equal(await page.evaluate(id => characters.find(character => character.id === id).inventoryItems[2].qty, heroId), 3);
    const beforeUse = await page.evaluate(id => {
      const character = characters.find(character => character.id === id);
      return JSON.parse(JSON.stringify({items: character.inventoryItems, coins: character.coins, hp: [character.hpCur, character.hpMax]}));
    }, heroId);
    await page.evaluate(() => window.__itemOriginalSave = window.saveChars);
    for(const cloneOnSave of [false,true]){
      await openItem(page,2);
      await page.evaluate(({id,cloneOnSave}) => {
        window.__itemUseSaveCalls=0;window.__finishItemUse=null;
        window.saveChars=()=>{
          window.__itemUseSaveCalls++;
          // prepareLocal can replace the inventory array before persistence resolves.
          if(cloneOnSave){const character=characters.find(character=>character.id===id);character.inventoryItems=JSON.parse(JSON.stringify(character.inventoryItems));}
          return new Promise(resolve=>window.__finishItemUse=resolve);
        };
      },{id:heroId,cloneOnSave});
      await page.locator('[data-zgmi=use]').click();
      await page.waitForFunction(() => typeof window.__finishItemUse === 'function');
      await page.evaluate(() => document.querySelector('[data-zgmi=use]')?.click());
      assert.equal(await page.evaluate(() => window.__itemUseSaveCalls), 1, 'Pending use rejects duplicate submissions');
      await page.evaluate(() => window.__finishItemUse({ok: false}));
      await page.waitForFunction(id => characters.find(character => character.id === id).inventoryItems[2].qty === 3, heroId);
      await page.evaluate(() => window.saveChars = window.__itemOriginalSave);
    }
    await openItem(page, 2);
    await page.locator('[data-zgmi=use]').click();
    await page.waitForFunction(id => characters.find(character => character.id === id).inventoryItems[2].qty === 2, heroId);
    const afterUse = await page.evaluate(id => {
      const character = characters.find(character => character.id === id);
      return JSON.parse(JSON.stringify({items: character.inventoryItems, coins: character.coins, hp: [character.hpCur, character.hpMax]}));
    }, heroId);
    beforeUse.items[2].qty = 2;
    assert.deepEqual(afterUse, beforeUse, 'Use accounts for one item, without silently applying healing or altering other inventory metadata');

    // Consuming the last unit removes exactly its instance; a failed cloned save restores it.
    await openItem(page,3);
    const beforeLastUnit=await page.evaluate(id=>JSON.parse(JSON.stringify(characters.find(character=>character.id===id).inventoryItems)),heroId);
    await page.evaluate(id=>{window.__finishItemUse=null;window.saveChars=()=>{const character=characters.find(character=>character.id===id);character.inventoryItems=JSON.parse(JSON.stringify(character.inventoryItems));return new Promise(resolve=>window.__finishItemUse=resolve);};},heroId);
    await page.locator('[data-zgmi=use]').click();
    await page.waitForFunction(()=>typeof window.__finishItemUse==='function');
    assert.equal(await page.evaluate(id=>characters.find(character=>character.id===id).inventoryItems.some(item=>item.itemId==='item-detail-fixture-3'),heroId),false);
    await page.evaluate(()=>window.__finishItemUse({ok:false}));
    await page.waitForFunction(id=>characters.find(character=>character.id===id).inventoryItems.some(item=>item.itemId==='item-detail-fixture-3'),heroId);
    assert.deepEqual(await page.evaluate(id=>characters.find(character=>character.id===id).inventoryItems,heroId),beforeLastUnit,'Failed last-unit save restores exact position and metadata');
    await page.evaluate(()=>window.saveChars=window.__itemOriginalSave);
    await openItem(page,3);
    await page.locator('[data-zgmi=use]').click();
    await page.waitForFunction(id=>!characters.find(character=>character.id===id).inventoryItems.some(item=>item.itemId==='item-detail-fixture-3'),heroId);
    assert.deepEqual(await page.evaluate(id=>characters.find(character=>character.id===id).inventoryItems,heroId),beforeLastUnit.filter(item=>item.itemId!=='item-detail-fixture-3'));

    // Catalog preview uses the same article, but offers adding instead of equipping.
    await closeDetail(page);
    await page.locator('.zgmi-footer [data-zgmi=shop]').click();
    await page.locator('[data-zgmi-search]').fill(sourceItems[0].name);
    await page.locator('[data-zgmi=catalog-item][data-id="shp_weapon_23"]').click();
    await settle(page);
    assert.match(await page.locator('.zgmi-item-effect').innerText(), /Раз за сцену/);
    assert.equal(await page.locator('[data-zgmi=catalog-save]').count(), 1);
    assert.equal(await page.locator('.zgmi-item-actions [data-zgmi=equip]').count(), 0);
    await closeDetail(page);

    await page.reload();
    await page.locator('#zg-data-loader-splash').waitFor({state: 'hidden', timeout: 45000});
    await page.evaluate(async () => { await window.zgCharacterLoadPromise; });
    assert.equal(await page.evaluate(id => characters.find(character => character.id === id).inventoryItems[2].qty, heroId), 2, 'Consumed quantity persists locally after reload');
    assert.equal(await page.evaluate(id=>characters.find(character=>character.id===id).inventoryItems.some(item=>item.itemId==='item-detail-fixture-3'),heroId),false,'Last-unit consumption persists after reload');
    assert.deepEqual(errors, []);
    console.log(process.env.ZG_ITEM_ACTIONS_ONLY === '1'
      ? 'PASS item actions: original artwork/zoom; equip and quantity; consume rollback/retry/double-submit; cloned-save rollback; final-unit removal/restore; catalog preview; local reload; external network blocked'
      : 'PASS item detail: horizontal rows without inner scroll; concept A art/title/rules order; RU/UK 320/390/430px; truthful equipment, healing and conditional effects; original artwork/zoom; equip and quantity; consume rollback/retry/double-submit; cloned-save rollback; final-unit removal/restore; local reload; external network blocked');
    console.log(JSON.stringify({screenshots, blockedOrigins: [...blockedOrigins]}, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
