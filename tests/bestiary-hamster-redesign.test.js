const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sidecar = require(path.join(root, 'zargota-i18n-bestiary-uk.js'));

const constantsStart = indexSource.indexOf("var ZG_BESTIARY_DESIGN_REVISION");
const constantsEnd = indexSource.indexOf('function beastReviewPayload()', constantsStart);
assert(constantsStart >= 0 && constantsEnd > constantsStart, 'versioned Bestiary design constants must exist');

const context = {};
vm.runInNewContext(
  indexSource.slice(constantsStart, constantsEnd) +
    '\nthis.result = { revision: ZG_BESTIARY_DESIGN_REVISION, id: ZG_BESTIARY_HAMSTER_ID, patches: ZG_BESTIARY_DESIGN_PATCHES, uk: ZG_BESTIARY_DESIGN_TRANSLATIONS_UK };',
  context
);

const { revision, id, patches, uk } = context.result;
assert.strictEqual(id, '1775678137839.4075');
assert(Object.prototype.hasOwnProperty.call(patches, id), 'the approved Basement Hamster patch must remain present');
const hamster = patches[id];
assert.strictEqual(hamster.designRevision, revision);
assert.strictEqual(hamster.hp, 6, 'level-one nuisance must survive a typical weak hit without becoming a tank');
assert.strictEqual(hamster.ac, 12);
assert.strictEqual(hamster.attacks.length, 1);
assert.strictEqual(hamster.traits.length, 2, 'the redesign intentionally removes modifier bookkeeping');
assert(!JSON.stringify(hamster).includes('+1 к атакам'));
assert(!JSON.stringify(hamster).includes('временных HP'));
assert(hamster.behavior.split('\n').length >= 4, 'GM plan must be a short step-by-step loop');
assert(hamster.variants.includes('3-го уровня и выше'), 'scaling guidance must explain when the creature becomes scenery');

const russianText = /[А-ЯЁа-яё]/u;
const patchStrings = [];
function collect(value) {
  if (typeof value === 'string') patchStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(hamster);
const missingUk = patchStrings.filter((source) => russianText.test(source) && !uk[source] && !sidecar.translations[source]);
assert.deepStrictEqual(missingUk, [], 'every Russian hamster string must ship with a Ukrainian variant');

assert(indexSource.includes("'zargota_beast_backup_' + id + '_before_' + patch.designRevision"), 'the previous creature record must be backed up before migration');
assert(indexSource.includes('var designUpdated = applyBestiaryDesignRevisions();'));
assert(indexSource.includes('if (designUpdated) saveBeasts();'));
assert(indexSource.includes('class="beast-detail-command"'));
assert(indexSource.includes('class="beast-playbook-steps"'));
assert(indexSource.includes('class="beast-detail-layout"'));
const appVersionMatch = indexSource.match(/var ZG_APP_VERSION = '(\d{4}-\d{2}-\d{2}\.\d+)'/);
assert(appVersionMatch, 'the application version must remain declared');
const [appVersionDate, appVersionSequence] = appVersionMatch[1].split('.');
assert(
  appVersionDate > '2026-08-28' || (appVersionDate === '2026-08-28' && Number(appVersionSequence) >= 5),
  'the hamster redesign must remain included in later releases'
);
assert(indexSource.includes("notesUk: 'Бестіарій"), 'the changelog must remain bilingual');

console.log('Bestiary hamster redesign contract: OK');
