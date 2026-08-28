const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const sidecar = require(path.join(root, 'zargota-i18n-bestiary-uk.js'));

const constantsStart = indexSource.indexOf('var ZG_BESTIARY_DESIGN_REVISION');
const constantsEnd = indexSource.indexOf('function beastReviewPayload()', constantsStart);
assert(constantsStart >= 0 && constantsEnd > constantsStart, 'versioned Bestiary design constants must exist');

const context = {};
vm.runInNewContext(
  indexSource.slice(constantsStart, constantsEnd) +
    '\nthis.result = { revision: ZG_BESTIARY_FAT_RAT_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const fatRatId = '1775678137839.5317';
const commonRatId = '1775678137839.942';
const { revision, patches, uk } = context.result;
const sourceRat = (data.beasts || []).find((beast) => String(beast.id) === fatRatId);
assert(sourceRat, 'the source Fat Rat record must remain in data.json');
assert.strictEqual(sourceRat.name, 'Жирная Крыса');

const rat = patches[fatRatId];
const commonRat = patches[commonRatId];
assert(rat, 'the Fat Rat needs an explicit one-creature migration');
assert(commonRat, 'the Common Rat comparison patch must remain available');
assert.strictEqual(rat.designRevision, revision);
assert.strictEqual(sidecar.translations['Жирная Крыса'], 'Товстий щур');

assert.strictEqual(rat.hp, 14);
assert.strictEqual(rat.ac, 12);
assert.strictEqual(rat.initiative, 1);
assert.strictEqual(rat.speed, '6');
assert.deepStrictEqual(Array.from(rat.immunities), ['Страх']);
assert.deepStrictEqual(Array.from(rat.resistances), ['Яд']);
assert.deepStrictEqual(Array.from(rat.vulnerabilities), ['Святой']);
assert.strictEqual(rat.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(rat.traits.length, 2, 'the Fat Rat loop must not become an ability checklist');
assert.strictEqual(rat.attacks[0].damage, '1d6 колющий');
assert.deepStrictEqual(Array.from(rat.attacks[0].statuses), ['Отравлен']);
assert(rat.attacks[0].desc.includes('ВЫН (Сл 12)'));
assert(rat.attacks[0].desc.includes('до конца своего следующего хода'));

const summon = rat.traits.find((trait) => trait.name === 'Хрюк выводка');
assert(summon, 'the Fat Rat needs one bounded brood action');
assert(summon.desc.includes('1 раз за бой'));
assert(summon.desc.includes('не больше 2 обычных крыс одновременно'));
assert(summon.desc.includes('не действуют сразу'));
assert(summon.desc.includes('со следующего раунда'));

const guard = rat.traits.find((trait) => trait.name === 'Прикрыть выводок');
assert(guard, 'the Fat Rat needs one visible defensive reaction');
assert(guard.desc.includes('1 раз за раунд'));
assert(guard.desc.includes('одиночной атаки'));
assert(guard.desc.includes('становится новой целью'));
assert.strictEqual(rat.behavior.split('\n').length, 4, 'the Fat Rat needs a four-step GM loop');
assert.strictEqual(rat.variants.split('\n').length, 4, 'the Fat Rat needs solo, party, mixed, and scaling guidance');
assert(rat.variants.includes('1 жирная и 2 обычные крысы'));
assert(rat.variants.includes('не повышая HP, DC яда'));

assert.notStrictEqual(rat.role, commonRat.role, 'the nest guardian must not duplicate the Common Rat role');
assert.strictEqual(rat.hp, commonRat.hp + 10, 'the level-two guardian must be clearly sturdier than a Common Rat');
assert.strictEqual(rat.ac, commonRat.ac + 1);
assert.strictEqual(Number(rat.speed) + 2, Number(commonRat.speed), 'the guardian trades speed for durability and control');
assert.strictEqual(rat.attacks[0].damage, '1d6 колющий');
assert.strictEqual(commonRat.attacks[0].damage, '1d4 колющий');

const serialized = JSON.stringify(rat);
assert(!serialized.includes('+1 к атакам'), 'the Fat Rat must not rely on passive pack arithmetic');
assert(!serialized.includes('Первый полученный урон'), 'the Fat Rat must not require first-hit bookkeeping');
assert(!serialized.includes('критического урона'), 'the Fat Rat must not depend on random critical triggers');
assert(!serialized.includes('При ярком свете'), 'the Fat Rat must not carry another passive modifier');
assert(!serialized.includes('Призывает 1-2 обычных крыс'), 'the old immediate summon must be removed');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(rat);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Fat Rat string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous Fat Rat record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.20', notes: 'Поштучно переработана жирная крыса"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено товстого щура"), 'the Fat Rat changelog must remain bilingual');

console.log('Bestiary Fat Rat redesign contract: OK');
