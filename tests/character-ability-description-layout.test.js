const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const helpers = html.match(/function characterAbilityDisplayName\(value\)[\s\S]*?(?=function characterAbilityRowHtml\()/);
assert.ok(helpers, 'character ability description helpers must be extractable');

const context = {
  escHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
vm.createContext(context);
vm.runInContext(helpers[0], context);

let translations = {};
const translationContext = {
  window: {
    ZargotaI18n: {
      registerContentTranslations(payload) { translations = payload; }
    }
  },
  Object
};
vm.createContext(translationContext);
vm.runInContext(fs.readFileSync('zargota-i18n-characters-uk.js', 'utf8'), translationContext);

function translated(value) {
  const text = String(value || '');
  return Object.prototype.hasOwnProperty.call(translations, text) ? translations[text] : text;
}

function translatedItem(item) {
  return Object.assign({}, item, {
    name: translated(item.name),
    type: translated(item.type),
    usages: translated(item.usages),
    description: translated(item.description)
  });
}

const entries = [];
(data.characters || []).forEach(character => {
  (character.mastery || character.masteries || []).forEach(item => entries.push({ character, field: 'mastery', item }));
  (character.skills || character.abilities || []).forEach(item => entries.push({ character, field: 'skills', item }));
});

assert.strictEqual(entries.length, 19, 'all 6 positions and 13 skills must stay in the semantic-layout audit');

let renderedVariants = 0;
let largestSectionCount = 0;
entries.forEach(entry => {
  [entry.item, translatedItem(entry.item)].forEach((item, localeIndex) => {
    const text = localeIndex === 1 ? translated(entry.item.description) : entry.item.description;
    if (!String(text || '').trim()) return;
    const sections = context.characterAbilityRuleSections(text, item);
    const rendered = context.characterAbilityRulesHtml(text, item);
    assert.ok(sections.length > 0, `${entry.character.name}: description must produce semantic sections`);
    assert.match(rendered, /char-ability-rule-section tone-/, `${entry.character.name}: semantic section markup must be present`);
    assert.doesNotMatch(rendered, /char-ability-rule-line tone-/, `${entry.character.name}: authored lines must not become separate colored cards`);
    assert.doesNotMatch(rendered, /<script|onerror=|onclick=/i, `${entry.character.name}: description markup must stay escaped`);
    largestSectionCount = Math.max(largestSectionCount, sections.length);
    renderedVariants += 1;
  });
});

const melissa = entries.find(entry => /Не причиняй лишнего/.test(entry.item.name || ''));
assert.ok(melissa, 'Melissa position fixture must exist');
const melissaRu = context.characterAbilityRuleSections(melissa.item.description, melissa.item);
assert.deepStrictEqual(Array.from(melissaRu, section => section.tone), ['neutral', 'benefit', 'danger'], 'Melissa position must become three meaningful sections instead of one card per line');

const melissaUkItem = translatedItem(melissa.item);
const melissaUkText = translated(melissa.item.description);
const melissaUk = context.characterAbilityRuleSections(melissaUkText, melissaUkItem);
assert.deepStrictEqual(Array.from(melissaUk, section => section.tone), ['neutral', 'benefit', 'danger'], 'the Ukrainian Melissa card must use the same semantic hierarchy');
assert.doesNotMatch(context.characterAbilityCleanDescription(melissaUkText, melissaUkItem), /^🌿\s*Не завдавай зайвого/m, 'translated duplicate title must be removed from the body');

const bread = entries.find(entry => /Хлеб всему голова/.test(entry.item.name || ''));
assert.ok(bread, 'Evan bread ability fixture must exist');
const breadClean = context.characterAbilityCleanDescription(bread.item.description, bread.item);
assert.doesNotMatch(breadClean, /ДОЛГИЙ НАВЫК|Хлеб всему голова/, 'split type and title lines must not repeat inside Evan ability body');
const breadHtml = context.characterAbilityRulesHtml(bread.item.description, bread.item);
assert.match(breadHtml, /tone-check[\s\S]*outcome-benefit[\s\S]*outcome-danger/, 'a check and both outcomes must stay in one readable semantic section');

assert.ok(largestSectionCount <= 8, `no authored ability should explode into more than 8 semantic cards (got ${largestSectionCount})`);
assert.match(html, /var ZG_APP_VERSION = '2026-08-27\.1'/, 'the interface refinement must have a visible app version');
assert.match(html, /v: '2026-08-27\.1'[\s\S]*?notes:[\s\S]*?notesUk:/, 'the current changelog entry must contain Russian and Ukrainian variants');

console.log(`Character ability description layout: OK (${entries.length} entries, ${renderedVariants} RU/UA variants, max ${largestSectionCount} sections)`);
