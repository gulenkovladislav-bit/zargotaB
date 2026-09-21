const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' });
  try {
    const page = await browser.newPage();
    await page.setContent('<main></main>');
    await page.evaluate(() => {
      window.ZargotaStoryQuestActions = {
        list: q => q.actions,
        apply: scene => scene,
        run: (actions, ctx) => { window.previewSceneId = ctx.sceneId(); return () => {}; }
      };
      window.ZargotaStoryAudioMixer = { create: () => ({ dispose() {} }) };
      window.ZargotaStoryEnvironment = { create: () => ({ setSound() {}, scene() {}, position() {}, dispose() {} }) };
    });
    await page.addScriptTag({ path: path.join(__dirname, '../story-quest-actions-editor.js') });
    for (const actions of [[], [{ type: 'reveal', sceneId: 'first', kind: 'tokens', id: 'old' }]]) {
      await page.evaluate(actions => {
        const scene = id => ({ layers: [], tokens: [{ id, name: id, x: 50, y: 50 }], story: {} });
        const host = document.querySelector('main');
        host.replaceChildren();
        ZargotaStoryQuestActionsEditor.edit({ activeSceneId: 'second', scene: scene('current-draft'), scenes: [
          { id: 'first', scene: scene('first-token') },
          { id: 'second', scene: scene('stale-saved-token') }
        ] }, { id: 'q', actions }, host, () => {});
      }, actions);
      await page.getByRole('button', { name: '▶ Предпросмотр действий на карте', exact: true }).click();
      assert.equal(await page.evaluate(() => window.previewSceneId), 'second');
      assert.equal(await page.locator('dialog [data-token-id="current-draft"]').count(), 1);
      assert.equal(await page.locator('dialog [data-token-id="first-token"]').count(), 0);
      assert.equal(await page.locator('dialog [data-token-id="stale-saved-token"]').count(), 0);
      await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    }
    console.log('PASS Edge: action preview uses active location and its current draft, with empty or cross-location actions');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
