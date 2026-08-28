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
    '\nthis.result = { revision: ZG_BESTIARY_SKELETON_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const skeletonId = '1775678137839.5496';
const { revision, patches, uk } = context.result;
const sourceSkeleton = (data.beasts || []).find((beast) => String(beast.id) === skeletonId);
assert(sourceSkeleton, 'the source Raw Skeleton record must remain in data.json');
assert.strictEqual(sourceSkeleton.name, 'Сырой Скелет');

const skeleton = patches[skeletonId];
assert(skeleton, 'the Raw Skeleton needs an explicit one-creature migration');
assert.strictEqual(skeleton.designRevision, revision);
assert.strictEqual(uk['Сырой Скелет'], 'Сирий скелет', 'the redesigned entry name must use the reviewed Ukrainian form');
assert.strictEqual(skeleton.hp, 9);
assert.strictEqual(skeleton.ac, 11);
assert.strictEqual(skeleton.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(skeleton.traits.length, 2, 'formation play must not become an ability checklist');
assert.strictEqual(skeleton.attacks[0].damage, '1d6 рубящий');
assert.deepStrictEqual(Array.from(skeleton.attacks[0].statuses), []);
assert.deepStrictEqual(Array.from(skeleton.immunities), ['Яд', 'Страх'], 'fear immunity belongs in the structured field');
assert.deepStrictEqual(Array.from(skeleton.resistances), ['Колющий']);
assert.deepStrictEqual(Array.from(skeleton.vulnerabilities), ['Дробящий']);
assert(skeleton.traits.some((trait) => trait.name === 'Сомкнуть строй' && trait.desc.includes('короткое действие')));
assert(skeleton.traits.some((trait) => trait.name === 'Подставить кости' && trait.desc.includes('одиночной атаки')));
assert(skeleton.traits.some((trait) => trait.name === 'Подставить кости' && trait.desc.includes('1 раз за раунд на весь строй')));
assert.strictEqual(skeleton.behavior.split('\n').length, 4, 'the skeleton needs a four-step GM loop');
assert.strictEqual(skeleton.variants.split('\n').length, 4, 'the skeleton needs solo, party, mixed, and scaling guidance');
assert(skeleton.variants.includes('2 скелета прикрывают 1 свежего зомби или некроманта'));

const serialized = JSON.stringify(skeleton);
assert(!serialized.includes('+1 урона'), 'the structured vulnerability must not be duplicated by arithmetic');
assert(!serialized.includes('Инициатива не может'), 'the printed initiative already communicates the skeleton speed');
assert(!serialized.includes('Иммунитет к страху'), 'fear immunity must not be hidden in prose');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(skeleton);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Raw Skeleton string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous skeleton record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.16', notes: 'Поштучный рефакторинг бестиария продолжен сырым скелетом"));
assert(indexSource.includes("notesUk: 'Поштучний рефакторинг бестіарію продовжено сирим скелетом"), 'the Raw Skeleton changelog must remain bilingual');

console.log('Bestiary Raw Skeleton redesign contract: OK');
