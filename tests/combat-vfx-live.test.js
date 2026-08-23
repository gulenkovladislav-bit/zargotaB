const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');

assert.match(network, /distanceCells:distance,rangeCells:rangeCells,actorKey:attacker\.key,targetKey:target\.key/, 'attack event carries additive scene anchors');
assert.match(network, /damageType:damageType,critical:critical,actorKey:attacker\.key,targetKey:target\.key/, 'damage event carries the attacker and critical presentation state');
assert.match(network, /updates\.combatEvent\.actorKey=actor\.key\|\|''/, 'ability event carries the caster scene anchor without replacing its Firebase shape');

const helperStart = html.indexOf('  function liveCombatCanvasPreset(event,hideResult)');
const helperEnd = html.indexOf('  function combatPlaybackDiagnostics()', helperStart);
const helper = html.slice(helperStart, helperEnd);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'live Canvas helper remains extractable');
assert.match(helper, /Number\(event\.distanceCells\)>1\|\|Number\(event\.rangeCells\)>1\)return'projectile'/, 'only ranged attacks resolve to a projectile');
assert.match(helper, /event\.hit===false&&!hideResult\?'miss':''/, 'a visible melee miss receives a miss stroke without leaking hidden outcomes');
assert.match(helper, /reaction==='block'.*reaction==='parry'.*tempHpAbsorbed/s, 'block, parry and full temporary-HP absorption share a shield reaction contract');
assert.match(helper, /\/огн\|fire\|плам\//, 'fire damage resolves to the fire preset');
assert.match(helper, /event\.critical\?'critical':'slash'/, 'weapon damage retains critical and ordinary impact variants');
assert.match(helper, /claimCombatPlaybackEvent\(event,channel\)/, 'live Canvas lanes are exactly-once');
assert.match(helper, /scope:'public',channel:'live-'/, 'live effects are distinct from local preview handles');
assert.match(helper, /actorPoint\.x\/100\*width/, 'client-local pixels derive from normalized scene coordinates');
assert.match(helper, /event\.hit===false&&!hideResult/, 'hidden attack results cannot leak through a miss trajectory');
assert.match(helper, /schedulePlaybackCleanup\(event,'live-canvas-'/, 'live Canvas cleanup uses the playback director');
assert.doesNotMatch(helper, /setTimeout\(|setInterval\(/, 'live Canvas adds no private timers');

const presetStart = html.indexOf('  function combatAuthoredImpactFamily(event)');
const presetEnd = html.indexOf('  function playLiveCombatCanvas(event,hideResult)', presetStart);
const presetContext = { String:String, Number:Number };
require('vm').runInNewContext(html.slice(presetStart, presetEnd), presetContext);
assert.strictEqual(presetContext.liveCombatCanvasPreset({kind:'combat-attack',hit:false,distanceCells:5,rangeCells:8}, false), 'projectile', 'a ranged miss uses only the projectile family');
assert.strictEqual(presetContext.liveCombatCanvasPreset({kind:'combat-attack',hit:false,distanceCells:1,rangeCells:1}, false), 'miss', 'a melee miss uses its miss stroke');
assert.strictEqual(presetContext.liveCombatCanvasPreset({kind:'combat-damage',critical:true,damageType:'Рубящий',distanceCells:1,rangeCells:1,weapon:'Топор'}, false), '', 'melee damage delegates to authored cleave art instead of drawing a second Canvas slash');
assert.strictEqual(presetContext.liveCombatCanvasPreset({kind:'combat-damage',critical:true,damageType:'Рубящий',distanceCells:5,rangeCells:8,weapon:'Метательный молот'}, false), 'critical', 'unclassified ranged damage keeps the bounded Canvas fallback');

const abilityHelperStart = html.indexOf('  function liveCombatAbilityPreset(event,tone)');
const abilityHelperEnd = html.indexOf('  function animateCombatAbilityVisual(event)', abilityHelperStart);
const abilityHelper = html.slice(abilityHelperStart, abilityHelperEnd);
assert.ok(abilityHelperStart >= 0 && abilityHelperEnd > abilityHelperStart, 'ability Canvas helper remains extractable');
assert.match(abilityHelper, /tone==='heal'\)return'heal'/, 'healing abilities use the healing preset');
assert.match(abilityHelper, /\/огн\|fire\|плам\//, 'fire abilities use the fire preset');
assert.match(abilityHelper, /return'arcane'/, 'other abilities have a stable arcane fallback');
assert.match(abilityHelper, /channel='ability-particles'.*claimCombatPlaybackEvent\(event,channel\)/s, 'ability particles are exactly-once');
assert.match(abilityHelper, /var targetPoint=points\[0\]/, 'one bounded Canvas burst supplements readable multi-target DOM markers');
assert.match(abilityHelper, /scope:'public',channel:'live-'/, 'ability effects share a public deterministic lane on both clients');
assert.match(abilityHelper, /schedulePlaybackCleanup\(event,'live-canvas-ability'/, 'ability Canvas cleanup uses the playback director');
assert.doesNotMatch(abilityHelper, /setTimeout\(|setInterval\(/, 'ability Canvas adds no private timers');

const abilityVisualStart = html.indexOf('  function animateCombatAbilityVisual(event)');
const abilityVisualEnd = html.indexOf('  function animateCombatVisual()', abilityVisualStart);
const abilityVisual = html.slice(abilityVisualStart, abilityVisualEnd);
assert.match(abilityVisual, /playLiveCombatAbilityCanvas\(event,actorPoint,targetPoints\.length\?targetPoints:\(anchor\?\[anchor\]:\[\]\),tone\)/, 'confirmed ability events enter the shared runtime');
assert.match(abilityVisual, /schedulePlaybackCleanup\(event,'combat-ability-dom',1900/, 'spell DOM readability layer shares the director');
assert.match(abilityVisual, /combatAbilityPublicAnnouncement\(event\)/, 'confirmed ability events build a public caster, spell, and result announcement');
assert.match(abilityVisual, /ensureDiceResultLayer\(layer\)/, 'the public spell announcement renders above scene tokens in the shared result layer');
assert.match(abilityVisual, /zg-combat-spell-announcement/, 'the public spell announcement has a dedicated readable presentation layer');
assert.match(abilityVisual, /schedulePlaybackCleanup\(event,'combat-ability-announcement',2900/, 'the public announcement cleanup shares the playback director');
assert.doesNotMatch(abilityVisual, /setTimeout\(/, 'spell cleanup has no private timer');

const saveHelperStart = html.indexOf('  function playLiveCombatSaveCanvas(event)');
const saveHelperEnd = html.indexOf('  function animateCombatVisual()', saveHelperStart);
const saveHelper = html.slice(saveHelperStart, saveHelperEnd);
assert.ok(saveHelperStart >= 0 && saveHelperEnd > saveHelperStart, 'save cleanse Canvas helper remains extractable');
assert.match(saveHelper, /event\.removedStatus/, 'failed saves do not imply a cleanse effect');
assert.match(saveHelper, /claimCombatPlaybackEvent\(event,'particles'\)/, 'save cleanse particles are exactly-once');
assert.match(saveHelper, /begin\(event,'cleanse'.*scope:'public',channel:'live-save-cleanse'/s, 'save cleanse uses the public shared preset');
assert.match(saveHelper, /schedulePlaybackCleanup\(event,'live-canvas-save-cleanse'/, 'save cleanse cleanup uses the playback director');
assert.doesNotMatch(saveHelper, /setTimeout\(|setInterval\(/, 'save cleanse adds no private timer');

const tickHelperStart = html.indexOf('  function liveStatusTickPreset(event)');
const tickHelperEnd = html.indexOf('  function animateCombatVisual()', tickHelperStart);
const tickHelper = html.slice(tickHelperStart, tickHelperEnd);
assert.ok(tickHelperStart >= 0 && tickHelperEnd > tickHelperStart, 'status tick Canvas helper remains extractable');
assert.match(tickHelper, /tick\.statusKey==='burn'.*return'fire'/s, 'burn ticks retain a distinct fire silhouette');
assert.match(tickHelper, /tick\.type==='heal'.*return'heal'/s, 'healing ticks retain a support silhouette');
['particles','label','hitFx','sound'].forEach(channel => assert.match(tickHelper, new RegExp("claimCombatPlaybackEvent\\(event,'"+channel+"'\\)"), 'status tick owns exactly-once '+channel));
assert.match(tickHelper, /scope:'public',channel:'live-status-tick'/, 'status ticks render through one public runtime command');
assert.match(tickHelper, /schedulePlaybackCleanup\(event,'status-tick-impact'/, 'status tick DOM cleanup uses the director');
assert.doesNotMatch(tickHelper, /setTimeout\(|setInterval\(/, 'status tick adds no private timer');

const gmHelperStart = html.indexOf('  function liveGmAdjustmentPreset(event)');
const gmHelperEnd = html.indexOf('  function animateGmAdjustmentVisual()', gmHelperStart);
const gmHelper = html.slice(gmHelperStart, gmHelperEnd);
assert.ok(gmHelperStart >= 0 && gmHelperEnd > gmHelperStart, 'GM adjustment Canvas helper remains extractable');
assert.match(gmHelper, /gm-damage.*return'slash'/s, 'manual damage uses a weapon impact preset');
assert.match(gmHelper, /gm-heal'.*gm-temp-hp'.*return'heal'/s, 'manual healing and temporary HP use support particles');
assert.match(gmHelper, /!event\.statusEnabled.*return'cleanse'/s, 'manual status removal uses cleanse particles');
assert.match(gmHelper, /gm-damage'\?1450:0/, 'manual damage receives a deliberately slower presentation timeline');
assert.match(gmHelper, /scope:'public',channel:'live-gm-particles'/, 'GM adjustments render through the same public runtime on both clients');
assert.match(gmHelper, /handle\.command\.durationMs\+120/, 'GM Canvas cleanup follows the effective overridden duration');
assert.match(gmHelper, /schedulePlaybackCleanup\(event,'live-canvas-gm-adjustment'/, 'GM Canvas cleanup uses the playback director');
assert.doesNotMatch(gmHelper, /setTimeout\(|setInterval\(/, 'GM Canvas adds no private timers');

const visualStart = html.indexOf('  function animateCombatVisual()');
const visualEnd = html.indexOf('  function animateGmAdjustmentVisual()', visualStart);
const visual = html.slice(visualStart, visualEnd);
assert.match(visual, /canvasPlayed=playLiveCombatCanvas\(event,hideResult\)/, 'confirmed combat events enter the shared runtime');
assert.match(visual, /if\(isDamage&&target\)playAuthoredMeleeImpact\(event,target,attackingToken,critical\)/, 'melee damage uses authored cleave art inside the exactly-once hitFx claim');
assert.match(visual, /playLiveCombatSaveCanvas\(event\)/, 'successful status-removing saves enter the shared runtime');
assert.match(visual, /isStatusTick=.*event\.statusTicks/s, 'structured turn ticks are recognized independently from the legacy combat kind');
assert.match(visual, /animateCombatStatusTickVisual\(event\)/, 'status tick presentation waits for the shared reveal path');
assert.match(visual, /isDamage&&!canvasPlayed&&sessionCombatMotionMode\(\)!=='minimal'/, 'legacy DOM particles remain a renderer fallback only');
assert.match(visual, /schedulePlaybackCleanup\(event,'combat-impact',1800/, 'hit labels and reaction cleanup share the director');
assert.doesNotMatch(visual, /setTimeout\(/, 'attack/damage visual cleanup has no private timer');

console.log('combat VFX live contract passed');
