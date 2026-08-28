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
    '\nthis.result = { revision: ZG_BESTIARY_COMMON_RAT_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const commonRatId = '1775678137839.942';
const hamsterId = '1775678137839.4075';
const { revision, patches, uk } = context.result;
const sourceRat = (data.beasts || []).find((beast) => String(beast.id) === commonRatId);
assert(sourceRat, 'the source Common Rat record must remain in data.json');
assert.strictEqual(sourceRat.name, 'Обычная Крыса');

const rat = patches[commonRatId];
const hamster = patches[hamsterId];
assert(rat, 'the Common Rat needs an explicit one-creature migration');
assert(hamster, 'the Basement Hamster comparison patch must remain available');
assert.strictEqual(rat.designRevision, revision);
assert.strictEqual(uk['Обычная Крыса'], 'Звичайний щур');
assert.strictEqual(rat.hp, 4);
assert.strictEqual(rat.ac, 11);
assert.strictEqual(rat.initiative, 2);
assert.strictEqual(rat.speed, '8');
assert.strictEqual(rat.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(rat.traits.length, 2, 'the rat loop must not become an ability checklist');
assert.strictEqual(rat.attacks[0].damage, '1d4 колющий');
assert.deepStrictEqual(Array.from(rat.attacks[0].statuses), []);

const scurry = rat.traits.find((trait) => trait.name === 'Шмыг под ногами');
assert(scurry, 'the rat needs a direct movement tool');
assert(scurry.desc.includes('занятые существами клетки'));
assert(scurry.desc.includes('узкие проходы'));
assert(scurry.desc.includes('свободной клетке'));

const panic = rat.traits.find((trait) => trait.name === 'Паника стаи');
assert(panic, 'the pack retreat needs a visible trigger');
assert(panic.desc.includes('1 раз за раунд на всю стаю'));
assert(panic.desc.includes('другая крыса'));
assert(panic.desc.includes('погибает'));
assert.strictEqual(rat.behavior.split('\n').length, 4, 'the rat needs a four-step GM loop');
assert.strictEqual(rat.variants.split('\n').length, 4, 'the rat needs solo, party, mixed, and scaling guidance');
assert(rat.variants.includes('1 жирной крысы'));

assert.notStrictEqual(rat.role, hamster.role, 'the rat must not duplicate the hamster role');
assert.strictEqual(rat.hp + 2, hamster.hp, 'the rat must remain visibly frailer than the hamster');
assert.strictEqual(rat.ac + 1, hamster.ac, 'the hamster must remain harder to hit');
assert.strictEqual(rat.speed, String(Number(hamster.speed) + 1), 'the rat trades resilience for one point of speed');

const serialized = JSON.stringify(rat);
assert(!serialized.includes('+1 к атакам'), 'the rat must not rely on a passive pack modifier');
assert(!serialized.includes('пытается сбежать'), 'retreat must be deterministic and visible');
assert(!serialized.includes('Может проходить через узкие проходы'), 'narrow-passage movement must state timing and limits');
assert(!serialized.includes('раз в 2 хода'), 'the rat must not require cooldown bookkeeping');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(rat);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Common Rat string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous rat record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.19', notes: 'Поштучно переработана обычная крыса"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено звичайного щура"), 'the Common Rat changelog must remain bilingual');

console.log('Bestiary Common Rat redesign contract: OK');
