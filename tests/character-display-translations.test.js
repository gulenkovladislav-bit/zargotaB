const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const display = require('../character-display-translations.js');
const i18n = require('../zargota-i18n.js');
const sidecar = require('../zargota-i18n-characters-uk.js');
const baseline = require('../zargota-i18n-content-uk.js');
const characters = require('../data.json').characters;
i18n.registerContentTranslations(baseline);
i18n.registerContentTranslations(sidecar.translations);
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const block = source.slice(source.indexOf('function characterEntryIsReviewed('), source.indexOf('function characterEntrySkipAttr('));
const context = vm.createContext({window: {
  ZargotaI18n: i18n, ZargotaI18nCharactersUk: sidecar, ZargotaCharacterDisplayTranslations: display
}});
vm.runInContext(block, context);
const characterText = context.characterEntryText;
const copy = {id: 'test-character', name: 'Рен · Тест'};
const numericTokens = value => String(value).match(/\d+(?:[.,]\d+)?(?:d\d+)?/g) || [];

for (const pair of display.pairs) {
  for (const input of [pair.ru, pair.uk, ...(pair.aliases || [])]) {
    assert.equal(display.translate(copy, input, 'ru'), pair.ru);
    assert.equal(display.translate(copy, input, 'uk'), pair.uk);
  }
  assert.deepEqual(numericTokens(pair.ru), numericTokens(pair.uk), 'translation preserves every numeric and dice token');
  assert(!/[іїєґ]/iu.test(pair.ru), 'reviewed Russian pairs contain no Ukrainian-specific letters');
  assert(!/[ыэъё]/iu.test(pair.uk), 'reviewed Ukrainian pairs contain no Russian-specific letters');
  assert.equal(display.translate(copy, `  ${pair.uk}\n`, 'ru'), `  ${pair.ru}\n`, 'outer whitespace does not hide a known exact pair');
}
assert.equal(display.translate(copy, 'Мой авторский талант: Спритність +7', 'ru'), null);
assert.equal(display.translate(copy, 'До «Вротік» и после', 'ru'), null, 'no substring or name replacement');
assert.equal(display.translate(copy, '__proto__', 'ru'), null);

const snapshot = JSON.stringify(characters);
let abilities = 0;
let fields = 0;
for (const character of characters) {
  for (const group of ['skills', 'mastery']) {
    for (const ability of character[group] || []) {
      abilities++;
      for (const field of ['name', 'type', 'description', 'usages']) {
        const original = ability[field];
        if (!original) continue;
        fields++;
        i18n.setLocale('ru', {persist: false});
        const ru = characterText(character, original);
        assert(!/[іїєґ]/iu.test(ru), `${character.name}: ${field} must display in Russian`);
        assert.equal(characterText(copy, original), ru, 'known copied ability has the same Russian display');
        i18n.setLocale('uk', {persist: false});
        const uk = characterText(character, original);
        assert(!/[ыэъё]/iu.test(uk), `${character.name}: ${field} must display in Ukrainian`);
        assert.equal(characterText(copy, original), uk, 'known copied ability has the same Ukrainian display');
        assert.deepEqual(numericTokens(uk), numericTokens(original), 'Ukrainian display keeps mechanics');
        assert.deepEqual(numericTokens(ru), numericTokens(original), 'Russian display keeps mechanics');
        i18n.setLocale('ru', {persist: false});
        assert.equal(characterText(character, original), ru, 'RU → UK → RU is stable');
      }
    }
  }
}
assert.equal(abilities, 22, 'covers every current personal skill, trait and mastery entry');
assert.equal(JSON.stringify(characters), snapshot, 'display changes never mutate authored source');

const vrotik = characters.find(entry => String(entry.id) === '1778221131899');
for (const [field, ru, uk] of [
  ['name', 'Вротик', 'Вротік'], ['race', 'Уродец (Кенку)', 'Уродець (кенку)'],
  ['klasse', 'Вор', 'Крадій'], ['age', '18 лет', '18 років']
]) {
  i18n.setLocale('ru', {persist: false}); assert.equal(characterText(vrotik, vrotik[field]), ru);
  i18n.setLocale('uk', {persist: false}); assert.equal(characterText(vrotik, vrotik[field]), uk);
}
for (const locale of ['ru', 'uk']) {
  i18n.setLocale(locale, {persist: false});
  assert.equal(characterText(copy, 'Новый авторский талант: Спритність +7'), 'Новый авторский талант: Спритність +7');
  assert.equal(characterText(copy, 'Линена'), 'Линена', 'never guess or correct an authored proper name');
}
assert(source.includes('character-display-translations.js'), 'display pairs are loaded by the app');
console.log(`Character display translations: OK (${display.pairs.length} exact pairs, ${abilities} abilities, ${fields} fields, RU → UK → RU, copied abilities, source preserved)`);
