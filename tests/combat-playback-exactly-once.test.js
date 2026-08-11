const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');
const start = html.indexOf('  function combatPlaybackDiagnostics()');
const end = html.indexOf('  function animateCombatAbilityVisual(', start);
assert.ok(start >= 0 && end > start, 'combat playback registry must remain extractable');

const context = {
  Date: { now: () => 5000 },
  Object,
  String,
  Number,
  w: {},
  combatPlaybackDirector: null,
  combatPlaybackRegistry: Object.create(null)
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

const attack = {id:'combat-attack-1',kind:'combat-attack',ts:1000,revealAt:4000};
assert.strictEqual(context.claimCombatPlaybackEvent(attack, 'visual', 5000), true, 'first visual claim must play');
assert.strictEqual(context.claimCombatPlaybackEvent(attack, 'visual', 5001), false, 'repeated Firebase render must not replay the visual');
assert.strictEqual(context.claimCombatPlaybackEvent(attack, 'sound', 5002), true, 'channels are independently exactly-once');
assert.strictEqual(context.claimCombatPlaybackEvent(attack, 'sound', 5003), false, 'sound must not replay for the same event');

const stale = {id:'combat-damage-old',kind:'combat-damage',ts:1000,revealAt:2000};
assert.strictEqual(context.claimCombatPlaybackEvent(stale, 'visual', 15001), false, 'stale snapshot events must not replay after reconnect');

const diagnostics = context.w.zgCombatPlaybackDiagnostics();
assert.strictEqual(diagnostics.claimed, 2);
assert.strictEqual(diagnostics.duplicates, 2);
assert.strictEqual(diagnostics.stale, 1);
assert.strictEqual(diagnostics.channels['claim:visual'], 1);
assert.strictEqual(diagnostics.channels['claim:sound'], 1);

const visualStart = html.indexOf('  function animateCombatVisual()');
const visualEnd = html.indexOf('  function animateGmAdjustmentVisual()', visualStart);
const visualBlock = html.slice(visualStart, visualEnd);
assert.match(visualBlock, /playCombatOutcomeSound\(event,isDamage,hideResult\)/, 'attack reveal and damage impact use the semantic exactly-once router without leaking hidden outcomes');
assert.match(visualBlock, /if\(combatAttackRequestAwaitingResult\(event\)\)return;[\s\S]*?scheduleCombatPresentationReveal\(event\)/, 'an approved attack cannot queue its token impact before the dice-result stage is released');
assert.doesNotMatch(visualBlock, /if\(hit&&w\.ZargotaSound&&w\.ZargotaSound\.damage\)/, 'hit confirmation must not play damage audio before damage dice');
assert.match(visualBlock, /playLabel=claimCombatPlaybackEvent\(event,'label'\),playHitFx=claimCombatPlaybackEvent\(event,'hitFx'\)/, 'labels and hit FX must own independent exactly-once channels');
assert.match(html, /claimCombatPlaybackEvent\(event,'damage-impact-sound'\)/, 'damage impact owns an explicit exactly-once channel');
assert.match(visualBlock, /if\(isDamage&&!canvasPlayed&&sessionCombatMotionMode\(\)!=='minimal'&&claimCombatPlaybackEvent\(event,'particles'\)\)/, 'minimal mode skips the DOM fallback and normal mode deduplicates it');
assert.match(html, /html\.zg-reduced-effects \.zg-game-overlay \.zg-token-roll/, 'reduced motion must disable die animations');
assert.match(html, /html\.zg-reduced-effects \.zg-game-overlay \.zg-combat-impact/, 'reduced motion must disable combat label motion');
assert.match(html, /html\.zg-combat-motion-anchored \.zg-vtt-token\.combat-hit/, 'anchored mode must keep the token itself stationary');
['death-save','combat-save'].forEach(function(prefix){
  assert.match(network, new RegExp("id:'"+prefix+"-'\\+stamp\\+'-'\\+Math\\.random\\(\\)"), prefix+' events need collision-resistant ids');
});
assert.match(network, /attackEventId='combat-hit-result-'\+attackOperationId/, 'attack playback id is stable for exactly-once retries');
assert.match(network, /damageEventId='combat-damage-result-'\+damageOperationId/, 'damage playback id is stable and separate from the hit phase');
assert.match(network, /roomUpdate\['combatEvent\/revealAt'\]=Math\.max\(Number\(resultEvent\.revealAt\)\|\|0,finishedAt\+resultDelay\)/, 'approved attack reveal timing is re-anchored to the finished request update');
assert.match(html, /finishApprovedAttackRoll:function[\s\S]*?event\.revealAt=Math\.max\(Number\(event\.revealAt\)\|\|0,finishedAt\+resultDelay\)/, 'local combat QA preserves the same dice-before-impact request order');
assert.match(network, /abilityEventId='combat-ability-'\+stamp\+'-'\+Math\.random\(\)/, 'combat-ability events need collision-resistant ids');
['combat-action','combat-prepare','combat-concentration'].forEach(function(prefix){
  assert.match(network, new RegExp("eventId='"+prefix+"-'\\+stamp\\+'-'\\+Math\\.random\\(\\)"), prefix+' events need collision-resistant ids');
});
assert.match(network, /id:'combat-trigger-'\+String\(prepared\.requestId\|\|stamp\)/, 'prepared trigger retries must retain one stable event id');

console.log('combat playback exactly-once passed');
