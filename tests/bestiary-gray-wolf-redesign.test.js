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
    '\nthis.result = { revision: ZG_BESTIARY_WOLF_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const wolfId = '1775678137839.9426';
const { revision, patches, uk } = context.result;
const sourceWolf = (data.beasts || []).find((beast) => String(beast.id) === wolfId);
assert(sourceWolf, 'the source Gray Wolf record must remain in data.json');
assert.strictEqual(sourceWolf.name, 'Серый Волк');

const wolf = patches[wolfId];
assert(wolf, 'the Gray Wolf needs an explicit one-creature migration');
assert.strictEqual(wolf.designRevision, revision);
assert.strictEqual(wolf.hp, 8, 'the wolf stays tougher than the six-HP nuisance and ambusher');
assert.strictEqual(wolf.ac, 12);
assert.strictEqual(wolf.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(wolf.traits.length, 2, 'pack identity must not become an ability checklist');
assert.strictEqual(wolf.attacks[0].damage, '1d6 колющий');
assert.deepStrictEqual(Array.from(wolf.attacks[0].statuses), [], 'the redesign removes redundant bleed and knockdown tracking');
assert(wolf.attacks[0].desc.includes('сдвиньте цель на 1 клетку'), 'the bite should create visible positional play');
assert(wolf.traits.some((trait) => trait.name === 'Смена фланга' && trait.desc.includes('короткое действие')));
assert(wolf.traits.some((trait) => trait.name === 'Подхватить погоню' && trait.desc.includes('1 раз за раунд на всю стаю')));
assert.strictEqual(wolf.behavior.split('\n').length, 4, 'the wolf needs a four-step GM loop');
assert(wolf.variants.includes('3 волка с общей инициативой'));
assert(wolf.variants.includes('не повышая их урон'));

const serialized = JSON.stringify(wolf);
assert(!serialized.includes('преимуществ'), 'the wolf must not rely on advantage bookkeeping');
assert(!serialized.includes('+1 к атакам'), 'the wolf must not rely on passive attack modifiers');
assert(!serialized.includes('Кровотечение'), 'the wolf must not add a separate damage timer');
assert(!serialized.includes('опрокинут'), 'the wolf must not require another save and prone state');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(wolf);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Gray Wolf string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous wolf record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.15', notes: 'Продолжен поштучный рефакторинг бестиария"));
assert(indexSource.includes("notesUk: 'Продовжено поштучний рефакторинг бестіарію"), 'the Gray Wolf changelog must remain bilingual');

console.log('Bestiary Gray Wolf redesign contract: OK');
