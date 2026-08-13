'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
assert.doesNotMatch(html, /actionKind\s*[:=]\s*['"]combat-spell/, 'palette does not introduce a parallel Firebase combat-spell command');

console.log('combat spell palette contract passed');
