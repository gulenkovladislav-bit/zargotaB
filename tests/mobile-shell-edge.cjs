const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ZG_TEST_URL || 'http://127.0.0.1:8765';
const output = process.env.ZG_TEST_OUTPUT || '/tmp/zargota-mobile-review';
const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' });
  try {
    for (const ua of [iphoneUA, 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 Telegram']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 700 }, userAgent: ua, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(base);
      await page.locator('#zg-data-loader-splash').waitFor({ state: 'hidden', timeout: 45000 });
      for (const locale of ['ru', 'uk']) {
        await page.evaluate(locale => ZargotaI18n.setLocale(locale), locale);
        for (const [width, height] of [[320,568], [375,600], [390,700], [430,800], [667,375], [844,390]]) {
          await page.setViewportSize({ width, height });
          await page.evaluate(() => showPage('home'));
          await page.waitForTimeout(250);
          const home = await page.evaluate(() => {
            const root = document.querySelector('#page-home');
            const header = document.querySelector('#header').getBoundingClientRect();
            return {
              overflow: root.scrollHeight - root.clientHeight,
              bodyOverflow: document.body.scrollHeight - innerHeight,
              top: root.getBoundingClientRect().top,
              headerBottom: header.bottom,
              cards: [...root.querySelectorAll('.home-card')].map(el => {
                const r = el.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, overflow: el.scrollHeight - el.clientHeight };
              })
            };
          });
          assert.equal(home.overflow, 0, `home scroll ${width}x${height} ${locale}`);
          assert.equal(home.bodyOverflow, 0);
          assert.equal(home.top, home.headerBottom);
          assert.equal(home.cards.length, 6);
          for (const card of home.cards) {
            assert.ok(card.top >= home.headerBottom && card.bottom <= height && card.left >= 0 && card.right <= width, JSON.stringify(card));
            assert.ok(card.overflow <= 1, `card content clipped ${width}x${height}: ${JSON.stringify(card)}`);
          }
        }
        await page.setViewportSize({ width:390, height:700 });
        await page.screenshot({ path:path.join(output, `home-${locale}-${ua.includes('iPhone')?'ios':'telegram'}.png`) });
        for (const name of ['catalog', 'bestiary']) {
          await page.evaluate(name => showPage(name), name);
          await page.waitForTimeout(300);
          // A fixed fixture keeps this geometry test independent of cloud catalog content.
          await page.evaluate(name => {
            const root = document.getElementById('page-' + name);
            if (!root.querySelector('[data-scroll-fixture]')) {
              const fixture = document.createElement('div');
              fixture.dataset.scrollFixture = '';
              fixture.style.height = '2000px';
              root.appendChild(fixture);
            }
            root.scrollTop = 0;
          }, name);
          const bar = page.locator('#page-' + name + ' > .page-back-bar');
          const initial = await bar.boundingBox();
          const header = await page.locator('#header').boundingBox();
          assert.equal(initial.y, header.y + header.height, `${name} initial gap`);
          await page.evaluate(name => document.getElementById('page-' + name).scrollTop = 500, name);
          await page.waitForTimeout(100);
          assert.equal((await bar.boundingBox()).y, initial.y, `${name} sticky bar moved`);
          assert.ok(await page.evaluate(name => document.getElementById('page-' + name).scrollTop > 0, name));
          await page.screenshot({ path:path.join(output, `${name}-${locale}-${ua.includes('iPhone')?'ios':'telegram'}.png`) });
          await bar.locator('.back-to-home').filter({ visible: true }).first().tap();
          await page.waitForTimeout(200);
          assert.ok(await page.locator('#page-home').evaluate(el => el.classList.contains('active')));
        }
        const note = page.locator('#page-home .mobile-arena-note');
        assert.equal(await note.innerText(), locale === 'uk' ? 'Арена — поки лише на комп’ютері' : 'Арена — пока только на компьютере');
        await page.locator('.home-dice-test-btn').tap();
        await page.locator('#zg-workshop-mode.open').waitFor();
        assert.ok(await page.locator('#zg-workshop-mode .mobile-arena-note').isVisible());
        await page.evaluate(() => zgWorkshopModeClose());
      }
      await context.close();
    }
    const desktop = await browser.newPage({ viewport:{width:1440,height:1000} });
    await desktop.goto(base);
    await desktop.locator('#zg-data-loader-splash').waitFor({state:'hidden',timeout:45000});
    assert.equal(await desktop.locator('#page-home .mobile-arena-note').isVisible(), false);
    assert.ok(await desktop.locator('.home-adventure-btn .home-action-label').isVisible());
    await desktop.screenshot({path:path.join(output,'desktop.png')});
    console.log('Mobile shell: 24 viewport/locale cases, sticky catalog and bestiary, navigation, arena notices, desktop: OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
