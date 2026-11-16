'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => /^(?:https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
    await page.goto(process.env.ZG_TEST_URL || 'http://127.0.0.1:8896');
    await page.locator('#zg-data-loader-splash').waitFor({ state: 'hidden', timeout: 45000 });
    await page.evaluate(() => {
      window.saveChars = function () {};
      const c = JSON.parse(JSON.stringify(characters.find(c => c.name === 'Эстерос') || characters[0]));
      c.id = 987654319; c.name = 'Page transition fixture';
      c.hpCur = 12; c.hpMax = 12; c.baseHpMax = 12;
      c.arenaEquipSlots = {}; c.tempEffects = [];
      c.statuses = ['poison', 'shield', 'burn', 'freeze', 'fear', 'blind'];
      characters.push(c); ZargotaI18n.setLocale('ru'); window._charSheetTab = 'stats';
      showPage('characters'); openCharSheet(c.id);
      window.pageTurnAnimations = [];
      const nativeAnimate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        if (this.matches('.zgmo-state-cards,.status-info-card,.zgms-grid,.test-page-turn')) {
          pageTurnAnimations.push({ target: this.className, frames, options });
        }
        return nativeAnimate.call(this, frames, options);
      };
    });
    await page.waitForTimeout(350);
    const cdp = await page.context().newCDPSession(page);
    async function swipe(selector, dx, dy = 0) {
      const box = await page.locator(selector).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 5; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    async function settled() { await page.waitForFunction(() => !document.querySelector('[data-zg-page-turn]')); }
    const count = () => page.locator('.zgmo-page-count').innerText();

    // A real horizontal gesture moves only the cards, after a brief outgoing stage.
    const original = await page.locator('.zgmo-state-cards').innerText();
    await page.evaluate(() => { window.stablePageNodes = [...document.querySelectorAll('.zgmo-states,.zgmo-state-heading,.zgmo-state-arrow,.zgmo-state-cards,.zgmo-portrait-image,#char-sheet-tab-bar')]; });
    await swipe('.zgmo-state-cards', -95);
    assert.equal(await page.locator('.zgmo-state-cards').getAttribute('data-zg-page-turn'), 'out');
    assert.equal(await page.locator('.zgmo-state-cards').innerText(), original);
    await settled(); assert.equal(await count(), '2 / 3');
    assert.notEqual(await page.locator('.zgmo-state-cards').innerText(), original);
    assert.ok(await page.evaluate(() => stablePageNodes.every(node => node.isConnected)));
    const frames = await page.evaluate(() => pageTurnAnimations.slice(0, 2));
    assert.deepEqual(frames.map(a => a.options.duration), [90, 170]);
    assert.equal(frames[0].frames[1].transform, 'translateX(-16px)');
    assert.equal(frames[1].frames[0].transform, 'translateX(16px)');
    assert.equal(await page.locator('.zgmo-state-cards').evaluate(el => el.scrollTop), 0);

    // Vertical movement remains vertical; fast reverse/cancel does not paint a stale page.
    await swipe('.zgmo-state-cards', 5, -75); await settled(); assert.equal(await count(), '2 / 3');
    await page.evaluate(() => {
      document.querySelector('[data-zgmo=next]').click();
      document.querySelector('[data-zgmo=prev]').click();
      document.querySelector('[data-zgmo=prev]').click();
    });
    await settled(); assert.equal(await count(), '1 / 3');
    assert.equal(await page.locator('.zgmo-state-cards').innerText(), original);
    assert.equal(await page.locator('.zgmo-state-cards').count(), 1);
    await page.evaluate(() => { pageTurnAnimations.length = 0; characters.find(c => c.id === 987654319).hpCur = 11; renderCharSheet(); });
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => pageTurnAnimations), [], 'Ordinary HP refresh must not page-animate');

    // Open status detail preserves the actual dialog/card across physical swipes.
    await page.locator('[data-zgmo=status]').first().click(); await page.waitForTimeout(300);
    await page.evaluate(() => { window.stableStatusNodes = [...document.querySelectorAll('#status-info-popup,.status-info-card')]; });
    await swipe('.zgmo-status-hero', -95); await settled();
    assert.equal(await page.locator('.zgmo-status-position').innerText(), '2 / 6');
    await swipe('.zgmo-status-hero', 5, -90); await settled();
    assert.equal(await page.locator('.zgmo-status-position').innerText(), '2 / 6');
    await page.evaluate(() => {
      document.querySelector('[data-status-step="1"]').click();
      document.querySelector('[data-status-step="1"]').click();
      document.querySelector('[data-status-step="-1"]').click();
    });
    await settled(); assert.equal(await page.locator('.zgmo-status-position').innerText(), '3 / 6');
    assert.ok(await page.evaluate(() => stableStatusNodes.every(node => node.isConnected)));
    assert.equal(await page.locator('#zgmo-status-actions').count(), 1);
    assert.equal(await page.locator('#status-info-popup').count(), 1);
    await page.locator('.zgmo-status-tool').click();
    await page.evaluate(() => { pageTurnAnimations.length = 0; ZargotaI18n.setLocale('uk'); });
    assert.equal(await page.locator('.zgmo-status-dismiss').getAttribute('aria-label'), 'Закрити стан');
    assert.equal(await page.locator('.zgmo-remove-status').innerText(), 'Зняти стан');
    assert.equal(await page.locator('.zgmo-status-tool').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('zgmo-status-tool')), true);
    assert.deepEqual(await page.evaluate(() => pageTurnAnimations), [], 'Locale refresh is immediate, without paging');
    assert.ok(await page.evaluate(() => stableStatusNodes.every(node => node.isConnected)));
    await page.evaluate(() => ZargotaI18n.setLocale('ru'));
    await page.screenshot({ path: '/private/tmp/zargota-status-page-transition.png' });
    await page.evaluate(() => { document.querySelector('[data-status-step="1"]').click(); document.querySelector('.zgmo-status-dismiss').click(); });
    await page.locator('#status-info-popup').waitFor({ state: 'detached' });
    await page.waitForTimeout(200); assert.equal(await page.locator('#status-info-popup').count(), 0);

    // Reduced motion updates synchronously and does not create page animations.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => {
      pageTurnAnimations.length = 0; document.querySelector('[data-zgmo=next]').click();
      return { count: document.querySelector('.zgmo-page-count').textContent, animations: pageTurnAnimations.length, marked: !!document.querySelector('[data-zg-page-turn]') };
    });
    assert.deepEqual(reduced, { count: '2 / 3', animations: 0, marked: false });
    await page.locator('[data-zgmo=status]').first().click();
    assert.equal(await page.evaluate(() => { document.querySelector('[data-status-step="1"]').click(); return document.querySelector('.zgmo-status-position').textContent; }), '4 / 6');
    await page.locator('.zgmo-status-dismiss').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Contract: cancellation settles promises, rejects stale updates, supports a replacement.
    const contract = await page.evaluate(async () => {
      const sheet = ZargotaMobileSheet, node = document.createElement('div');
      node.className = 'test-page-turn'; node.textContent = 'old'; document.body.appendChild(node);
      const callbacks = [];
      const first = sheet.animatePage(node, 1, () => { callbacks.push('stale'); return node; });
      const second = sheet.animatePage(node, -1, () => { callbacks.push('current'); node.textContent = 'current'; return node; });
      const results = await Promise.all([first, second]);
      const detached = sheet.animatePage(node, 1, () => { callbacks.push('detached'); return node; }); node.remove();
      const detachedResult = await detached;
      const disconnectedResult = await sheet.animatePage(node, 1, () => { callbacks.push('never'); });
      document.body.appendChild(node);
      const cancelled = sheet.animatePage(node, 1, () => new Promise(() => {}));
      await new Promise(resolve => setTimeout(resolve, 120)); sheet.cancelPageAnimation(node);
      const cancelledResult = await cancelled;
      let replacement;
      const replacedResult = await sheet.animatePage(node, 1, () => {
        replacement = document.createElement('div'); replacement.className = 'test-page-turn'; replacement.textContent = 'replacement'; node.replaceWith(replacement); return replacement;
      });
      const error = await sheet.animatePage(replacement, 1, () => { throw new Error('expected updater error'); }).catch(error => error.message);
      const marked = replacement.hasAttribute('data-zg-page-turn'); replacement.remove();
      return { callbacks, results, detachedResult, disconnectedResult, cancelledResult, replacedResult, error, marked };
    });
    assert.deepEqual(contract, { callbacks: ['current'], results: [false, true], detachedResult: false, disconnectedResult: false, cancelledResult: false, replacedResult: true, error: 'expected updater error', marked: false });
    assert.deepEqual(errors, []);
    console.log('PASS: physical status swipes and vertical scrolling, directional outgoing/incoming animation, rapid reversal, stable real DOM, close cancellation, reduced motion, HP refresh, superseded/disconnected/async/replacement/error helper contracts. No external requests or live writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
