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
    '\nthis.result = { revision: ZG_BESTIARY_ZOMBIE_REVISION, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const zombieId = '1775678137839.754';
const { revision, patches, uk } = context.result;
const sourceZombie = (data.beasts || []).find((beast) => String(beast.id) === zombieId);
assert(sourceZombie, 'the source Fresh Zombie record must remain in data.json');
assert.strictEqual(sourceZombie.name, 'Свежий Зомби');

const zombie = patches[zombieId];
assert(zombie, 'the Fresh Zombie needs an explicit one-creature migration');
assert.strictEqual(zombie.designRevision, revision);
assert.strictEqual(uk['Свежий Зомби'], 'Свіжий зомбі');
assert.strictEqual(uk['Замедлен'], 'Уповільнений');
assert.strictEqual(zombie.hp, 12, 'the zombie remains sturdier than the nine-HP skeleton');
assert.strictEqual(zombie.ac, 10, 'low defense keeps the durable body hittable');
assert.strictEqual(zombie.initiative, -1);
assert.strictEqual(zombie.speed, '5');
assert.strictEqual(zombie.attacks.length, 1, 'the GM needs one clear default long action');
assert.strictEqual(zombie.traits.length, 2, 'the zombie loop must not become an ability checklist');
assert.strictEqual(zombie.attacks[0].damage, '1d6 дробящий');
assert.deepStrictEqual(Array.from(zombie.attacks[0].statuses), ['Замедлен'], 'the grip must use the canonical status');
assert(zombie.attacks[0].desc.includes('пока остаётся рядом с зомби'), 'slow must have a visible positional end condition');
assert.deepStrictEqual(Array.from(zombie.immunities), ['Яд', 'Страх']);
assert.deepStrictEqual(Array.from(zombie.resistances), ['Некротический']);
assert.deepStrictEqual(Array.from(zombie.vulnerabilities), ['Святой']);
assert(zombie.traits.some((trait) => trait.name === 'Тянется к теплу' && trait.desc.includes('раненой живой цели')));
assert(zombie.traits.some((trait) => trait.name === 'Живучая плоть' && trait.desc.includes('остаётся с 1 HP')));
assert(zombie.traits.some((trait) => trait.name === 'Живучая плоть' && trait.desc.includes('святым')));
assert.strictEqual(zombie.behavior.split('\n').length, 4, 'the zombie needs a four-step GM loop');
assert.strictEqual(zombie.variants.split('\n').length, 4, 'the zombie needs solo, party, tracking, and scaling guidance');
assert(zombie.variants.includes('1 зомби под прикрытием 2 сырых скелетов'));

const serialized = JSON.stringify(zombie);
assert(!serialized.includes('20%'), 'the zombie must not rely on a separate random proc');
assert(!serialized.includes('Кровотечение'), 'the redesign must not add an ongoing damage timer');
assert(!serialized.includes('-1 к скорости'), 'the redesign must not stack permanent movement penalties');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(zombie);
const missingUk = [...new Set(patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]))];
assert.deepStrictEqual(missingUk, [], 'every new Russian Fresh Zombie string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous zombie record must be backed up before migration');
assert(indexSource.includes("{ v: '2026-08-28.17', notes: 'Поштучно переработан свежий зомби"));
assert(indexSource.includes("notesUk: 'Поштучно перероблено свіжого зомбі"), 'the Fresh Zombie changelog must remain bilingual');

console.log('Bestiary Fresh Zombie redesign contract: OK');
