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
    '\nthis.result = { hamsterRevision: ZG_BESTIARY_DESIGN_REVISION, waveRevision: ZG_BESTIARY_ROLE_WAVE_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const { hamsterRevision, waveRevision, patches, uk } = context.result;
const hamsterId = '1775678137839.4075';
const wolfId = '1775678137839.9426';
const skeletonId = '1775678137839.5496';
const zombieId = '1775678137839.754';
const wildDogId = '1775678137839.249';
const commonRatId = '1775678137839.942';
const fatRatId = '1775678137839.5317';
const smallTreantId = '1775678137839.945';
const treantBarricadeId = '1775678309276';
const combatGolemId = '1775678488055';
const waveIds = [
  '1775678137839.2095', // ambusher
  '1775678137839.3735', // guardian
  '1775678556687',      // swarm
  '1775687106152'       // support/controller
];

assert.strictEqual(patches[hamsterId].designRevision, hamsterRevision, 'approved hamster must not be silently revised again');
assert.notStrictEqual(waveRevision, hamsterRevision, 'the next role wave needs an independent backup revision');
assert.deepStrictEqual(
  Object.keys(patches).filter((id) => id !== wolfId && id !== skeletonId && id !== zombieId && id !== wildDogId && id !== commonRatId && id !== fatRatId && id !== smallTreantId && id !== treantBarricadeId && id !== combatGolemId).sort(),
  [hamsterId].concat(waveIds).sort(),
  'the original migration must remain a small explicit role wave'
);
assert(Object.prototype.hasOwnProperty.call(patches, wolfId), 'later single-creature revisions may extend the patch table explicitly');
assert(Object.prototype.hasOwnProperty.call(patches, skeletonId), 'each later creature must be added as an explicit migration');
assert(Object.prototype.hasOwnProperty.call(patches, zombieId), 'the next catalog creature must remain an explicit migration');
assert(Object.prototype.hasOwnProperty.call(patches, wildDogId), 'the Wild Dog must remain a separate one-creature migration');
assert(Object.prototype.hasOwnProperty.call(patches, commonRatId), 'the Common Rat must remain a separate one-creature migration');
assert(Object.prototype.hasOwnProperty.call(patches, fatRatId), 'the Fat Rat must remain a separate one-creature migration');
assert(Object.prototype.hasOwnProperty.call(patches, smallTreantId), 'the Small Treant must remain a separate one-creature migration');
assert(Object.prototype.hasOwnProperty.call(patches, treantBarricadeId), 'the Treant Barricade must remain a separate one-creature migration');
assert(Object.prototype.hasOwnProperty.call(patches, combatGolemId), 'the Combat Golem must remain a separate one-creature migration');

const sourceNames = new Map((data.beasts || []).map((beast) => [String(beast.id), beast.name]));
waveIds.forEach((id) => assert(sourceNames.has(id), `source Bestiary entry is missing: ${id}`));
assert.strictEqual(sourceNames.get(waveIds[0]), 'Подвальный Кот');
assert.strictEqual(sourceNames.get(waveIds[1]), 'Краб-Хранитель Камня');
assert.strictEqual(sourceNames.get(waveIds[2]), 'Рой Гнуса');
assert.strictEqual(sourceNames.get(waveIds[3]), 'Ворожея');

waveIds.forEach((id) => {
  const beast = patches[id];
  assert.strictEqual(beast.designRevision, waveRevision);
  assert.strictEqual(beast.attacks.length, 1, `${sourceNames.get(id)} must offer one clear default long action`);
  assert(beast.traits.length >= 2 && beast.traits.length <= 3, `${sourceNames.get(id)} must avoid ability overload`);
  assert.strictEqual(beast.behavior.split('\n').length, 4, `${sourceNames.get(id)} needs a four-step GM loop`);
  assert(beast.variants.split('\n').length >= 3, `${sourceNames.get(id)} needs encounter and scaling guidance`);
  assert(!JSON.stringify(beast).includes('+1 к атакам'), `${sourceNames.get(id)} must not rely on passive attack modifiers`);
  assert(!JSON.stringify(beast).includes('+1 к AC'), `${sourceNames.get(id)} must not rely on passive AC modifiers`);
});

const cat = patches[waveIds[0]];
assert.strictEqual(cat.hp, 6);
assert.strictEqual(cat.ac, 13);
assert(cat.traits.some((trait) => trait.name === 'Сорваться с глаз'));
assert(cat.behavior.includes('При 2 HP или меньше'));

const crab = patches[waveIds[1]];
assert.strictEqual(crab.hp, 12);
assert.strictEqual(crab.ac, 14);
assert.deepStrictEqual(Array.from(crab.resistances), ['Колющий']);
assert.deepStrictEqual(Array.from(crab.vulnerabilities), ['Дробящий']);
assert(crab.attacks[0].statuses.includes('Захват'));

const swarm = patches[waveIds[2]];
assert.strictEqual(swarm.hp, 8);
assert(swarm.vulnerabilities.includes('Огонь'));
assert(swarm.traits.some((trait) => trait.name === 'Облако тел'));

const witch = patches[waveIds[3]];
assert.strictEqual(witch.hp, 32);
assert.strictEqual(witch.traits.length, 3);
assert(witch.traits.some((trait) => trait.name === 'Травяной дым' && trait.desc.includes('1d6 + 3 HP')));
assert(witch.traits.some((trait) => trait.name === 'Предсказанный промах' && trait.desc.includes('худший результат')));

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
waveIds.forEach((id) => collect(patches[id]));
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Bestiary string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'every entry must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.5', notes: 'Рефакторинг бестиария"));
assert(indexSource.includes("notesUk: 'Рефакторинг бестіарію"), 'the role-wave changelog must remain bilingual');

console.log('Bestiary role wave contract: OK');
