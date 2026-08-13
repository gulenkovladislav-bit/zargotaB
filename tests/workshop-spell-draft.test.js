'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('var workshopHeroSpellDrafts={}');
const end = html.indexOf('function combatNodeForKey', start);

assert.ok(start >= 0 && end > start, 'workshop spell draft implementation exists');
const source = html.slice(start, end);

assert.match(source, /baseSpellRefs:base\.slice\(\),spellRefs:base\.slice\(\)/, 'draft owns defensive base and next spell lists');
assert.match(source, /workshopHeroSpellDraftDiff/, 'draft exposes a before/after diff');
assert.match(source, /getCharacterSpellCatalogEntries/, 'draft uses the existing spell catalog');
assert.match(source, /member\.workshopCopy/, 'only defensive workshop heroes can receive drafts');
assert.match(source, /Безопасная область/, 'UI explains the protected update boundary');
assert.doesNotMatch(source, /saveChars\s*\(/, 'draft never saves a real character');
assert.match(source, /gmProposeCharacterPatch\(liveMember\.uid,\{field:'spellRefs',value:value/, 'draft sends only the spellRefs field through the existing proposal channel');
assert.match(source, /workshopHeroSpellDraftPatchValue\(draft,liveMember\.character\)/, 'proposal is rebased on the live player list');
assert.match(source, /diff\.removed\.forEach/, 'explicit removals are retained while rebasing');
assert.match(source, /liveCharacter&&liveCharacter\.spellRefs/, 'unrelated spell refs added by the player are preserved');
assert.match(source, /workshopHeroSpellDraftProtectedRemovals/, 'learned or prepared spells cannot be orphaned by this first safe patch');
assert.doesNotMatch(source, /ZargotaRooms\.(?:update|set|saveCharacter)|firebase\.(?:update|set)/, 'workshop never writes a full character or Firebase node directly');
for (const forbidden of ['hpCur', 'tempHp', 'spellCD', 'abilityUsage', 'inventoryItems']) {
  assert.ok(!source.includes(forbidden), `draft excludes runtime field ${forbidden}`);
}
assert.match(html, />Черновик<\/button>/, 'workshop hero card opens the draft');
assert.match(source, /Отправить подключённому игроку/, 'GM has an explicit proposal action');

console.log('workshop spell draft contract passed');
