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
    '\nthis.result = { revision: ZG_BESTIARY_COMBAT_GOLEM_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const golemId = '1775678488055';
const treantId = '1775678309276';
const { revision, patches, uk } = context.result;
const sourceGolem = (data.beasts || []).find((beast) => String(beast.id) === golemId);
assert(sourceGolem, 'the source Combat Golem record must remain in data.json');
assert.strictEqual(sourceGolem.name, 'Боевой Голем Лёна');

const golem = patches[golemId];
const treant = patches[treantId];
assert(golem, 'the Combat Golem needs an explicit one-creature migration');
assert(treant, 'the boss comparison patch must remain available');
assert.strictEqual(revision, '2026-08-29.2-combat-golem-v1');
assert.strictEqual(golem.designRevision, revision);
assert.strictEqual(sidecar.translations['Боевой Голем Лёна'], 'Бойовий голем Льона');

assert.strictEqual(golem.role, 'Телохранитель / Перехват');
assert(!golem.role.includes('Босс'), 'the Combat Golem must not silently become another boss');
assert.strictEqual(golem.hp, 35);
assert.strictEqual(golem.ac, 14);
assert.strictEqual(golem.initiative, 0);
assert.strictEqual(golem.speed, '5');
assert.deepStrictEqual(Array.from(golem.immunities), ['Яд', 'Страх', 'Сон']);
assert.deepStrictEqual(Array.from(golem.resistances), ['Огонь', 'Холод', 'Некротический']);
assert.deepStrictEqual(Array.from(golem.vulnerabilities), ['Электрический']);
assert.strictEqual(golem.attacks.length, 2, 'the guard needs one default strike and one encounter pull');
assert.strictEqual(golem.traits.length, 3, 'command, interception, and weight must remain separate visible rules');

const crusher = golem.attacks.find((attack) => attack.name === 'Костекрушитель');
assert(crusher, 'the Golem needs one clear default strike');
assert.strictEqual(crusher.actionType, 'long');
assert.strictEqual(crusher.damage, '1d8 + 3 дробящий');
assert.strictEqual(crusher.range, '1 клетка');
assert(crusher.desc.includes('1 свободную безопасную клетку'));
assert(crusher.desc.includes('в сторону от объекта приказа'));

const anchor = golem.attacks.find((attack) => attack.name === 'Якорный шип');
assert(anchor, 'the Golem needs one bounded way to catch a bypassing enemy');
assert.strictEqual(anchor.damage, '1d6 колющий');
assert.strictEqual(anchor.range, '4 клетки');
assert.strictEqual(anchor.cd, '1 раз за бой');
assert(anchor.desc.includes('подтяните цель на 2 клетки'));
assert(anchor.desc.includes('свободному безопасному пути'));
assert(anchor.desc.includes('следующая клетка занята или опасна'));

const order = golem.traits.find((trait) => trait.name === 'Последний приказ');
assert(order, 'the Golem needs one marked object of protection');
assert(order.desc.includes('существо, предмет или клетку'));
assert(order.desc.includes('дальше 3 клеток'));
assert(order.desc.includes('Если Лён теряет сознание'));
assert(order.desc.includes('не пропускает ход'));

const intercept = golem.traits.find((trait) => trait.name === 'Подставить корпус');
assert(intercept, 'the Golem needs one direct bodyguard reaction');
assert(intercept.desc.includes('реакция, 1 раз за раунд'));
assert(intercept.desc.includes('в соседней клетке'));
assert(intercept.desc.includes('одиночной атаки'));
assert(intercept.desc.includes('становится новой целью'));
assert(intercept.desc.includes('поменяться с защищаемым существом местами'));

const heavy = golem.traits.find((trait) => trait.name === 'Тяжёлая конструкция');
assert(heavy, 'forced movement immunity must remain visible');
assert(heavy.desc.includes('нельзя принудительно переместить'));
assert.strictEqual(golem.behavior.split('\n').length, 5, 'the Golem needs a five-step GM loop');
assert.strictEqual(golem.variants.split('\n').length, 4, 'the Golem needs solo, level-two, level-three, and scaling guidance');
assert(golem.variants.includes('руной приказа, которую можно обойти или отключить'));
assert(golem.variants.includes('защищает только 1 союзника 1–2-го уровня'));
assert(golem.variants.includes('не повышайте HP, КБ, число реакций'));

assert.strictEqual(golem.hp, treant.hp + 1, 'the construct can have one more raw HP than the boss');
assert.strictEqual(golem.ac, treant.ac + 1, 'the construct trades boss phases for a sturdier shell');
assert(treant.traits.some((trait) => trait.name.includes('фаза II')), 'the Treant remains the two-phase boss');
assert(!golem.traits.some((trait) => trait.name.includes('фаза')), 'the Golem must remain a single-loop guardian');

const serialized = JSON.stringify(golem);
assert(!serialized.includes('игнорирует броню'), 'the Golem must not bypass the ordinary attack contract');
assert(!serialized.includes('-1 к AC'), 'the Golem must not add a custom armor debuff');
assert(!serialized.includes('Механический рёв'), 'the bodyguard must not duplicate a boss-like mass fear opener');
assert(!serialized.includes('Все клетки рядом считаются труднопроходимыми'), 'the Golem must not duplicate the Treant terrain aura');
assert(!serialized.includes('Если Лён без сознания - пропускает ход'), 'the Golem must keep executing its last order');
assert(!serialized.includes('-50% урона'), 'structured resistances must not be duplicated as percentage arithmetic');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(golem);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Combat Golem string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous Combat Golem record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-29.2', notes: 'Поштучно переработан Боевой Голем Лёна"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено Бойового голема Льона"), 'the Combat Golem changelog must remain bilingual');

console.log('Bestiary Combat Golem redesign contract: OK');
