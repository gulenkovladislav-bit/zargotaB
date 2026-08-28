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
    '\nthis.result = { revision: ZG_BESTIARY_TREANT_BARRICADE_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const treantId = '1775678309276';
const smallTreantId = '1775678137839.945';
const { revision, patches, uk } = context.result;
const sourceTreant = (data.beasts || []).find((beast) => String(beast.id) === treantId);
assert(sourceTreant, 'the source Treant Barricade record must remain in data.json');
assert.strictEqual(sourceTreant.name, 'Трент-Завал');

const treant = patches[treantId];
const smallTreant = patches[smallTreantId];
assert(treant, 'the Treant Barricade needs an explicit one-creature migration');
assert(smallTreant, 'the Small Treant comparison patch must remain available');
assert.strictEqual(treant.designRevision, revision);
assert.strictEqual(sidecar.translations['Трент-Завал'], 'Трент-завал');
assert.strictEqual(uk['1d8 + 2 дробящий'], '1d8 + 2 дробильної шкоди');

assert.strictEqual(revision, '2026-08-29.1-treant-barricade-boss-v3');
assert.strictEqual(treant.role, 'Босс прохода / Живой бастион');
assert.strictEqual(treant.hp, 34);
assert.strictEqual(treant.ac, 13);
assert.strictEqual(treant.initiative, -1);
assert.strictEqual(treant.speed, '6');
assert.deepStrictEqual(Array.from(treant.immunities), ['Яд', 'Очарован']);
assert.deepStrictEqual(Array.from(treant.resistances), ['Колющий', 'Дробящий']);
assert.deepStrictEqual(Array.from(treant.vulnerabilities), ['Огонь']);
assert.strictEqual(treant.attacks.length, 2, 'the boss needs one default action and one telegraphed area action');
assert.strictEqual(treant.traits.length, 2, 'the boss needs one body rule and one phase transition');

const strike = treant.attacks.find((attack) => attack.name === 'Удар-корчеватель');
assert(strike, 'the Treant needs one clear default strike');
assert.strictEqual(strike.actionType, 'long');
assert.strictEqual(strike.damage, '1d8 + 2 дробящий');
assert(strike.desc.includes('сдвинуть цель на 1 клетку'));
assert(strike.desc.includes('свободна и безопасна'));

const collapse = treant.attacks.find((attack) => attack.name === 'Нависшая крона');
assert(collapse, 'the boss needs one telegraphed crowd-control action');
assert.strictEqual(collapse.cd, '1 раз за фазу');
assert.strictEqual(collapse.damage, '1d6 дробящий');
assert.deepStrictEqual(Array.from(collapse.statuses), ['Опрокинут']);
assert(collapse.desc.includes('отметьте до 3 клеток'));
assert(collapse.desc.includes('В начале следующего хода трента'));
assert(collapse.desc.includes('статус «Опрокинут»'));
assert(collapse.desc.includes('до действий трента'));
assert(collapse.desc.includes('не требует броска атаки'));

const body = treant.traits.find((trait) => trait.name === 'Тело-завал');
assert(body, 'the two-cell body must be explicit and easy to mark');
assert(body.desc.includes('2 соседние клетки'));
assert(body.desc.includes('отметьте вторую клетку корнем'));
assert(body.desc.includes('перекрывают проход и обзор'));
assert(body.desc.includes('нельзя принудительно переместить'));
assert(body.desc.includes('Коротким действием перенесите корень'));

const phaseTwo = treant.traits.find((trait) => trait.name === 'Раскол ствола — фаза II');
assert(phaseTwo, 'the boss needs one visible phase transition');
assert(phaseTwo.desc.includes('17 HP или меньше'));
assert(phaseTwo.desc.includes('снова сделайте «Нависшую крону» доступной'));
assert(phaseTwo.desc.includes('чтобы на поле их стало 2'));
assert(phaseTwo.desc.includes('не действуют сразу'));
assert(phaseTwo.desc.includes('только 1 Малый Трент за раунд'));

assert.strictEqual(treant.behavior.split('\n').length, 5, 'the boss needs a five-step two-phase GM loop');
assert.strictEqual(treant.variants.split('\n').length, 4, 'the Treant needs solo, level-two, level-three, and scaling guidance');
assert(treant.variants.includes('ослабленный босс с 26 HP'));
assert(treant.variants.includes('стандартный босс с 34 HP начинает один'));
assert(treant.variants.includes('предел в 2 Малых Трента'));
assert(uk[treant.variants].includes('не підвищуйте шкоду, Сл'));

assert.notStrictEqual(treant.role, smallTreant.role, 'the living barricade must not duplicate mobile undergrowth');
assert.strictEqual(treant.hp, smallTreant.hp + 26);
assert.strictEqual(treant.ac, smallTreant.ac + 1);
assert.strictEqual(treant.speed, smallTreant.speed, 'the large Treant controls space through size, not another speed rule');
assert.strictEqual(smallTreant.attacks[0].damage, '1d4 дробящий');

const serialized = JSON.stringify(treant);
assert(!serialized.includes('перезарядка 4-6'), 'the Treant must not require random cooldown bookkeeping');
assert(!serialized.includes('совершает 2 атаки за ход'), 'phase II must not add another full attack to the boss turn');
assert(!serialized.includes('-2 к следующей атаке'), 'the Treant must not add a custom arithmetic debuff');
assert(!serialized.includes('При первом появлении'), 'the Treant must not add an opening fear save to every fight');
assert(!serialized.includes('При получении огненного урона'), 'fire vulnerability must remain the single fire rule');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(treant);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Treant Barricade string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous Treant Barricade record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-29.1', notes: 'Уточнено, что Трент-Завал — босс встречи"));
assert(indexSource.includes("notesUk: 'Уточнено, що Трент-завал — бос зустрічі"), 'the Treant Barricade changelog must remain bilingual');

console.log('Bestiary Treant Barricade redesign contract: OK');
