const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function element(tagName, attributes) {
  const attrs = Object.assign({}, attributes || {});
  return {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    childrenForWalker: [],
    classList: { toggle() {} },
    closest(selector) { return this.skipAuthored && selector.indexOf('.card-name') >= 0 ? this : null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(attrs, name); },
    getAttribute(name) { return this.hasAttribute(name) ? attrs[name] : null; },
    setAttribute(name, value) { attrs[name] = String(value); },
    querySelectorAll() { return []; },
    attrs
  };
}

function text(value, parentElement) {
  return { nodeType: 3, data: String(value), parentElement };
}

function makeHarness() {
  const html = element('html');
  const button = element('button', { title: 'Настройки', 'aria-label': 'Настройки' });
  const buttonText = text('Настройки', button);
  const authored = element('p');
  authored.skipAuthored = true;
  authored.className = 'card-name';
  const authoredText = text('Мастер', authored);
  const builtInContent = element('p');
  builtInContent.skipAuthored = true;
  builtInContent.className = 'card-name';
  const builtInContentText = text('Эстерос', builtInContent);
  html.childrenForWalker = [button, buttonText, authored, authoredText, builtInContent, builtInContentText];

  const storage = new Map([
    ['grimoire_chars', '[{"id":1,"name":"Эстерос"}]'],
    ['zargota_shop_v1', '[{"id":"rope","name":"Верёвка"}]'],
    ['zargota_scene_v1', '{"name":"Старый мост"}']
  ]);
  const listeners = {};
  const document = {
    documentElement: html,
    readyState: 'loading',
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatchEvent() {},
    querySelectorAll() { return []; },
    createTreeWalker(scope) {
      const rows = scope.childrenForWalker || [];
      let index = 0;
      return { nextNode() { return rows[index++] || null; } };
    }
  };
  const window = {
    document,
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; }
  };
  return { window, document, storage, button, buttonText, authoredText, builtInContent, builtInContentText, listeners };
}

const harness = makeHarness();
const source = fs.readFileSync(path.join(__dirname, '..', 'zargota-i18n.js'), 'utf8');
const dictionarySource = source.slice(source.indexOf('var UK = Object.freeze({'), source.indexOf('var UK_PATTERNS'));
const dictionaryKeys = Array.from(dictionarySource.matchAll(/^\s*'((?:\\'|[^'])+)'\s*:/gm), (match) => match[1]);
assert.strictEqual(new Set(dictionaryKeys).size, dictionaryKeys.length, 'Ukrainian dictionary must not contain duplicate exact keys');
vm.runInNewContext(source, { window: harness.window, WeakMap, Object, Array, String, RegExp });
const i18n = harness.window.ZargotaI18n;

assert(i18n, 'i18n API should be exposed');
assert.strictEqual(i18n.getLocale(), 'ru');
assert.strictEqual(i18n.translate('Настройки', 'ru'), 'Настройки');
assert.strictEqual(i18n.translate('Настройки', 'uk'), 'Налаштування');
assert.strictEqual(i18n.translate('Исцеление', 'uk'), 'Зцілення');
assert.strictEqual(i18n.translate('Трансформация', 'uk'), 'Перетворення');
assert.strictEqual(i18n.translate('Риск', 'uk'), 'Ризик');
assert.strictEqual(i18n.translate('  Сессия ABCD  ', 'uk'), '  Сесія ABCD  ');
assert.strictEqual(i18n.translate('Неизвестная будущая фраза', 'uk'), 'Неизвестная будущая фраза', 'missing entries must fall back to Russian');

const gameplayBefore = Object.fromEntries(
  Array.from(harness.storage.entries()).filter(([key]) => key !== i18n.storageKey)
);

i18n.setLocale('uk');
assert.strictEqual(harness.document.documentElement.lang, 'uk');
assert.strictEqual(harness.buttonText.data, 'Налаштування');
assert.strictEqual(harness.button.attrs.title, 'Налаштування');
assert.strictEqual(harness.button.attrs['aria-label'], 'Налаштування');
assert.strictEqual(harness.authoredText.data, 'Мастер', 'authored content must not be translated even when it matches a UI phrase');
assert.strictEqual(harness.builtInContentText.data, 'Эстерос', 'unregistered authored content must remain untouched');
assert.strictEqual(harness.storage.get(i18n.storageKey), 'uk');

assert.strictEqual(i18n.registerContentTranslations({ Эстерос: 'Естерос' }), 1);
i18n.refresh(harness.builtInContentText);
assert.strictEqual(harness.builtInContentText.data, 'Естерос', 'registered built-in content should translate inside authored-content surfaces');
assert.strictEqual(i18n.hasContentTranslation('  Эстерос  '), true);

const dynamic = element('button', { title: 'Сохранить' });
const dynamicText = text('Сохранить', dynamic);
dynamic.childrenForWalker = [dynamicText];
i18n.refresh(dynamic);
assert.strictEqual(dynamicText.data, 'Зберегти', 'dynamic UI should use the active locale');
assert.strictEqual(dynamic.attrs.title, 'Зберегти');

i18n.setLocale('ru');
assert.strictEqual(harness.document.documentElement.lang, 'ru');
assert.strictEqual(harness.buttonText.data, 'Настройки', 'RU round-trip must restore source text');
assert.strictEqual(harness.button.attrs.title, 'Настройки', 'RU round-trip must restore source attributes');
assert.strictEqual(harness.builtInContentText.data, 'Эстерос', 'RU round-trip must restore registered content exactly');
i18n.refresh(dynamic);
assert.strictEqual(dynamicText.data, 'Сохранить', 'dynamic UI must also restore its Russian source');
assert.strictEqual(dynamic.attrs.title, 'Сохранить');

const gameplayAfter = Object.fromEntries(
  Array.from(harness.storage.entries()).filter(([key]) => key !== i18n.storageKey)
);
assert.deepStrictEqual(gameplayAfter, gameplayBefore, 'locale changes must not mutate gameplay storage');

console.log('i18n locale safety: OK');
