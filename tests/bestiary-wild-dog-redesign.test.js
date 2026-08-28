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
    '\nthis.result = { revision: ZG_BESTIARY_WILD_DOG_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const wildDogId = '1775678137839.249';
const wolfId = '1775678137839.9426';
const { revision, patches, uk } = context.result;
const sourceDog = (data.beasts || []).find((beast) => String(beast.id) === wildDogId);
assert(sourceDog, 'the source Wild Dog record must remain in data.json');
assert.strictEqual(sourceDog.name, 'Дикий Пёс');

const dog = patches[wildDogId];
const wolf = patches[wolfId];
assert(dog, 'the Wild Dog needs an explicit one-creature migration');
assert(wolf, 'the Gray Wolf comparison patch must remain available');
assert.strictEqual(dog.designRevision, revision);
assert.strictEqual(uk['Дикий Пёс'], 'Дикий пес');
assert.strictEqual(dog.hp, 9);
assert.strictEqual(dog.ac, 11);
assert.strictEqual(dog.initiative, 2);
assert.strictEqual(dog.speed, '8');
assert.strictEqual(dog.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(dog.traits.length, 2, 'the dog loop must not become an ability checklist');
assert.strictEqual(dog.attacks[0].damage, '1d6 колющий');
assert.deepStrictEqual(Array.from(dog.attacks[0].statuses), []);
assert(dog.traits.some((trait) => trait.name === 'Гнать лаем' && trait.desc.includes('не может использовать реакции')));
assert(dog.traits.some((trait) => trait.name === 'Гнать лаем' && trait.desc.includes('1 раз за раунд на всю стаю')));
assert(dog.traits.some((trait) => trait.name === 'Поджатый хвост' && trait.desc.includes('4 HP или меньше')));
assert.strictEqual(dog.behavior.split('\n').length, 4, 'the dog needs a four-step GM loop');
assert.strictEqual(dog.variants.split('\n').length, 4, 'the dog needs solo, party, mixed, and scaling guidance');
assert(dog.variants.includes('2 пса лаем открывают путь 1 серому волку'));

assert.notStrictEqual(dog.role, wolf.role, 'the nervous dog must not duplicate the disciplined wolf role');
assert(dog.role.includes('Отступление'));
assert(wolf.role.includes('Стайный охотник'));
assert.strictEqual(dog.hp, wolf.hp + 1, 'the dog trades one point of defense for one point of HP');
assert.strictEqual(dog.ac + 1, wolf.ac, 'the wolf remains harder to hit');
assert.strictEqual(dog.str + 1, wolf.str, 'the wolf remains the stronger attacker');

const serialized = JSON.stringify(dog);
assert(!serialized.includes('+1 к атакам'), 'the dog must not rely on passive pack modifiers');
assert(!serialized.includes('Если HP ниже 50%'), 'the dog must not add another health-threshold modifier');
assert(!serialized.includes('шанс отступить'), 'retreat must be deterministic and visible');
assert(!serialized.includes('раз в 2 хода'), 'the dog must not require cooldown bookkeeping');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(dog);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Wild Dog string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous dog record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.18', notes: 'Поштучно переработан дикий пёс"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено дикого пса"), 'the Wild Dog changelog must remain bilingual');

console.log('Bestiary Wild Dog redesign contract: OK');
