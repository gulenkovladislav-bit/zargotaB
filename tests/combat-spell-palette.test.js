'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function buildAbilityCards\(member,character,localCharacter,readOnly\)/, 'bag and combat palette share one ability-card builder');
assert.match(html, /combatLongActionChoiceHtml\('long-action','Атака','оружие или приём','attack'/, 'long action menu exposes the existing attack flow');
assert.match(html, /combatLongActionChoiceHtml\('codex','Заклинание','подготовленная магия','spells'/, 'long action menu exposes prepared spells');
assert.match(html, /combatLongActionChoiceHtml\('innate','Сложный навык','активный врождённый навык','skills'/, 'long action menu exposes active innate skills');
assert.match(html, /card\.group==='spells'&&card\.prepared&&card\.learned!==false/, 'combat spell palette only reads prepared, usable spell cards');
assert.match(html, /card\.activeInnate&&!card\.passive/, 'complex-skill palette excludes passive entries, masteries and positions');
assert.match(html, /combatLongActionMode==='spells'\|\|combatLongActionMode==='skills'\?combatLongActionPaletteHtml/, 'temporary palette replaces the normal combat toolbar');
assert.match(html, /zgCombatLongAbilityOpen/, 'palette cards open the existing shared ability detail');
assert.match(html, /if\(collection\.member&&collection\.member\.uid\)drawerMemberUid=String\(collection\.member\.uid\)/, 'ability detail is pinned to the current combat hero, not a previously inspected ally');
assert.match(html, /if\(w\.zgCombatAttackBeginTargeting\)w\.zgCombatAttackBeginTargeting\(\)/, 'attack choice continues through the existing attack targeter');
assert.match(html, /if\(w\.zgVttAbilityOpen\)w\.zgVttAbilityOpen\(key\)/, 'spells and skills continue through the existing ability request flow');
assert.match(html, /zgCombatLongActionToggle\(false\)/, 'palette has an explicit return to the normal toolbar');
assert.ok(html.includes("zgCombatLongActionChoose(\\'menu\\')"), 'nested ability palettes return to the long-action menu');
assert.match(html, /ev\.key==='Escape'&&w\.zgCombatLongActionActive&&w\.zgCombatLongActionActive\(\)/, 'Escape closes the temporary long-action palette');
assert.match(html, /zgCombatLongAbilityBag/, 'empty or full palette can open the existing Magic bag section');
assert.match(html, /pageSize=w\.innerWidth<=900\?2:4/, 'prepared actions use two cards on narrow screens and four on wide screens');
assert.match(html, /cards:cards\.slice\(page\*pageSize,page\*pageSize\+pageSize\)/, 'only the current prepared-action page is rendered');
assert.match(html, /zgCombatLongAbilityPage\(-1\)/, 'prepared-action palette exposes an explicit previous-page button');
assert.match(html, /zgCombatLongAbilityPage\(1\)/, 'prepared-action palette exposes an explicit next-page button');
assert.match(html, /\.zg-combat-ability-browser \.zg-combat-ability-strip\{[^}]*overflow:hidden/, 'prepared-action cards do not rely on their native horizontal scrollbar');
assert.match(html, /qaMagicPrepared=\{kodex:\['1773672863195'\],folio:\[[^\]]+\],obrad:\[[^\]]+\]\}/, 'magic arena keeps Storm Arrow prepared and contains enough spells to exercise a second palette page');
assert.match(html, /character\.spellRefs=qaMagicPrepared\.kodex\.concat\(qaMagicPrepared\.folio,qaMagicPrepared\.obrad\)/, 'magic arena exposes prepared codex spells in the shared spell reference list');
assert.doesNotMatch(html, /actionKind\s*[:=]\s*['"]combat-spell/, 'palette does not introduce a parallel Firebase combat-spell command');

const pageModelStart = html.indexOf('  function combatAbilityPalettePageModel');
const pageModelEnd = html.indexOf('  function combatLongActionPaletteHtml', pageModelStart);
assert.ok(pageModelStart >= 0 && pageModelEnd > pageModelStart, 'prepared-action page model source can be isolated');
const sandbox = {
  w: { innerWidth: 1280 },
  combatAbilityPalettePages: { spells: 0, skills: 0 },
  clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
};
vm.runInNewContext(html.slice(pageModelStart, pageModelEnd), sandbox);
const cards = Array.from({ length: 9 }, (_, index) => ({ index }));
let page = sandbox.combatAbilityPalettePageModel(cards, 'spells');
assert.deepStrictEqual({ size: page.cards.length, page: page.page, pages: page.pages, total: page.total }, { size: 4, page: 0, pages: 3, total: 9 }, 'wide palette starts with four of nine prepared actions');
sandbox.combatAbilityPalettePages.spells = 2;
page = sandbox.combatAbilityPalettePageModel(cards, 'spells');
assert.deepStrictEqual({ size: page.cards.length, page: page.page, pages: page.pages }, { size: 1, page: 2, pages: 3 }, 'last wide page keeps the remaining prepared action');
sandbox.w.innerWidth = 800;
sandbox.combatAbilityPalettePages.spells = 1;
page = sandbox.combatAbilityPalettePageModel(cards, 'spells');
assert.deepStrictEqual({ size: page.cards.length, page: page.page, pages: page.pages }, { size: 2, page: 1, pages: 5 }, 'narrow palette pages through prepared actions two at a time');

console.log('combat spell palette contract passed');
