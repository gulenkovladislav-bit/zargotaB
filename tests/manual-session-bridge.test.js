'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  html,
  /\.zg-journal3-manual\{[\s\S]*?transform:translate3d\(0,-50%,0\);[\s\S]*?transition:border-color[^}]+\}/,
  'Кнопка книги должна сохранять один и тот же transform во время анимации'
);
assert.match(
  html,
  /\.zg-journal3-manual:active\{transform:translate3d\(0,-50%,0\);/,
  'Нажатие не должно сдвигать или масштабировать кнопку книги'
);

const journalHandlerStart = html.indexOf('w.zgVttJournalOpenManual=function(event)');
const journalHandlerEnd = html.indexOf('w.zgVttJournalOpen=function(journalId)', journalHandlerStart);
assert.ok(journalHandlerStart >= 0 && journalHandlerEnd > journalHandlerStart, 'Не найден обработчик кнопки Мануала');
const journalHandler = html.slice(journalHandlerStart, journalHandlerEnd);
assert.match(journalHandler, /zgManualOpenFromGame\('journal'\)/);
assert.doesNotMatch(journalHandler, /zgVttCloseDrawer/, 'Журнал нельзя закрывать перед переходом в Мануал');

const bridgeStart = html.indexOf('function syncManualBridgeUi()');
const bridgeEnd = html.indexOf('function showPage(name)', bridgeStart);
assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart, 'Не найден мост игры с Мануалом');
const bridgeSource = html.slice(bridgeStart, bridgeEnd);
assert.match(bridgeSource, /classList\.add\('manual-bridge-hidden'\)/);
assert.match(bridgeSource, /fromPage:\s*currentPage\s*\|\|\s*'home'/);
assert.doesNotMatch(bridgeSource, /zgGameClose|ZargotaRooms\.leave|location\.reload/, 'Мост не должен завершать игру или соединение');

const classNames = new Set(['open']);
const overlay = {
  classList: {
    contains(value) { return classNames.has(value); },
    add(value) { classNames.add(value); },
    remove(value) { classNames.delete(value); }
  }
};
const badge = { hidden:true };
const label = { textContent:'Главная' };
const pageCalls = [];
const context = {
  document: {
    getElementById(id) {
      if (id === 'zg-game-overlay') return overlay;
      if (id === 'manual-bridge-state') return badge;
      if (id === 'manual-back-label') return label;
      return null;
    }
  },
  showPage(page) { pageCalls.push(page); },
  window: {}
};
vm.runInNewContext(
  'var manualBridgeState=null;var manualUiState={query:"",category:"all"};var currentPage="arena";\n' + bridgeSource,
  context
);
assert.strictEqual(context.window.zgManualOpenFromGame('journal'), false);
assert.deepStrictEqual(pageCalls, ['manual']);
assert.strictEqual(classNames.has('manual-bridge-hidden'), true);
assert.strictEqual(badge.hidden, false);
assert.strictEqual(label.textContent, 'Назад к игре');
assert.strictEqual(context.window.zgManualReturn(), false);
assert.deepStrictEqual(pageCalls, ['manual', 'arena']);

const showPageStart = html.indexOf('function showPage(name)');
const showPageEnd = html.indexOf('// ═══════════════════════════════════════════════════════════\n// РЕЕСТР НПС', showPageStart);
const showPageSource = html.slice(showPageStart, showPageEnd);
assert.match(showPageSource, /name !== 'manual' && manualBridgeState/);
assert.match(showPageSource, /classList\.remove\('manual-bridge-hidden'\)/);
assert.match(showPageSource, /manualBridgeState = null/);

assert.match(html, /id="manual-search-input"/);
assert.match(html, /id="manual-result-count"/);
assert.match(html, /class="manual-category-list"/);
assert.match(html, /id="manual-empty"/);
assert.match(html, /toLocaleLowerCase\('ru-RU'\)\.indexOf\(query\)/);
assert.match(html, /data-manual-category=/);
assert.match(html, /if \(query\) zgManualSetSectionOpen\(section, true, false\)/);
assert.match(html, /id="manual-bridge-state" hidden/);
assert.match(html, /id="manual-back-label">Главная/);
assert.match(html, /\.zg-game-overlay\.manual-bridge-hidden\{display:none!important\}/);

console.log('Manual session bridge contract: OK');
