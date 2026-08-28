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
    '\nthis.result = { revision: ZG_BESTIARY_SMALL_TREANT_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const smallTreantId = '1775678137839.945';
const largeTreantId = '1775678309276';
const crabId = '1775678137839.3735';
const { revision, patches, uk } = context.result;
const sourceTreant = (data.beasts || []).find((beast) => String(beast.id) === smallTreantId);
const largeTreant = (data.beasts || []).find((beast) => String(beast.id) === largeTreantId);
assert(sourceTreant, 'the source Small Treant record must remain in data.json');
assert(largeTreant, 'the source Treant Barricade comparison record must remain in data.json');
assert.strictEqual(sourceTreant.name, 'Малый Трент');

const treant = patches[smallTreantId];
const crab = patches[crabId];
assert(treant, 'the Small Treant needs an explicit one-creature migration');
assert(crab, 'the Stone Crab comparison patch must remain available');
assert.strictEqual(treant.designRevision, revision);
assert.strictEqual(sidecar.translations['Малый Трент'], 'Малий трент');

assert.strictEqual(treant.hp, 8);
assert.strictEqual(treant.ac, 12);
assert.strictEqual(treant.initiative, 0);
assert.strictEqual(treant.speed, '6');
assert.deepStrictEqual(Array.from(treant.immunities), ['Яд', 'Страх', 'Подчинён']);
assert.deepStrictEqual(Array.from(treant.resistances), []);
assert.deepStrictEqual(Array.from(treant.vulnerabilities), ['Огонь']);
assert.strictEqual(treant.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(treant.traits.length, 2, 'the Small Treant loop must not become an ability checklist');
assert.strictEqual(treant.attacks[0].damage, '1d4 дробящий');
assert.deepStrictEqual(Array.from(treant.attacks[0].statuses), []);
assert(treant.attacks[0].desc.includes('притянуть цель на 1 клетку'));
assert(treant.attacks[0].desc.includes('не сталкивает цель с опасностью'));

const rooting = treant.traits.find((trait) => trait.name === 'Врасти в тропу');
assert(rooting, 'the Small Treant needs one explicit rooting action');
assert(rooting.desc.includes('короткое действие'));
assert(rooting.desc.includes('скорость становится 0'));
assert(rooting.desc.includes('нельзя принудительно переместить'));
assert(rooting.desc.includes('труднопроходимыми для врагов'));

const remains = treant.traits.find((trait) => trait.name === 'Ломкая поросль');
assert(remains, 'the defeated Treant needs a short-lived terrain consequence');
assert(remains.desc.includes('падает до 0 HP'));
assert(remains.desc.includes('до конца следующего раунда'));
assert(remains.desc.includes('уберите отметку корней'));
assert.strictEqual(treant.behavior.split('\n').length, 4, 'the Small Treant needs a four-step GM loop');
assert.strictEqual(treant.variants.split('\n').length, 4, 'the Small Treant needs solo, party, mixed, and scaling guidance');
assert(treant.variants.includes('только 1 трент за раунд'));
assert(treant.variants.includes('не повышая HP, урон и длительность корней'));

assert.notStrictEqual(treant.role, crab.role, 'the mobile overgrowth must not duplicate the stationary Crab role');
assert.strictEqual(treant.hp + 4, crab.hp);
assert.strictEqual(treant.ac + 2, crab.ac);
assert.strictEqual(Number(treant.speed), Number(crab.speed) + 2, 'the Small Treant trades defense for mobility before rooting');
assert.notStrictEqual(treant.role, largeTreant.role, 'the Small Treant must not duplicate the Treant Barricade role');
assert(treant.hp < largeTreant.hp);
assert(treant.attacks.length < largeTreant.attacks.length);

const serialized = JSON.stringify(treant);
assert(!serialized.includes('+1 к броску атаки'), 'the Small Treant must not rely on conditional attack arithmetic');
assert(!serialized.includes('+1 к проверкам сопротивления'), 'the Small Treant must not rely on passive group arithmetic');
assert(!serialized.includes('+1 дополнительного урона'), 'fire vulnerability must not be counted twice');
assert(!serialized.includes('разницей 3+'), 'the Small Treant must not depend on margin-of-miss bookkeeping');
assert(!serialized.includes('Сл 12 на снятие'), 'the redundant fear attack must be removed');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(treant);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Small Treant string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous Small Treant record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.21', notes: 'Поштучно переработан Малый Трент"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено Малого трента"), 'the Small Treant changelog must remain bilingual');

console.log('Bestiary Small Treant redesign contract: OK');
