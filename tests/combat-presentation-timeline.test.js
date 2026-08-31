const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');
const start = html.indexOf('  function combatPresentationEntry(');
const end = html.indexOf('  function combatEntryForToken(', start);
assert.ok(start >= 0 && end > start, 'combat presentation helper must remain extractable');

const context = {Date:{now:()=>2000},Number,String,Object,Math,roomSnapshot:null,w:{}};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

const resolvedEntry = {key:'enemy-1',hp:3,hpMax:12,tempHp:0,zeroHp:null};
context.roomSnapshot = {room:{combatEvent:{
  id:'combat-damage-1',kind:'combat-damage',targetKey:'enemy-1',
  beforeHp:9,beforeTempHp:2,hpDamage:6,tempHpAbsorbed:2,revealAt:5000
}}};
let presented = context.combatPresentationEntry(resolvedEntry, 3000);
assert.strictEqual(presented.hp, 9, 'HP stays at its pre-damage value while damage dice animate');
assert.strictEqual(presented.tempHp, 2, 'temporary HP stays visible until the reveal boundary');
assert.notStrictEqual(presented, resolvedEntry, 'presentation gating must not mutate Firebase state');

presented = context.combatPresentationEntry(resolvedEntry, 5000);
assert.strictEqual(presented, resolvedEntry, 'resolved Firebase values become visible at revealAt');

const spellTarget = {key:'enemy-1',hp:4,hpMax:12,tempHp:0,statuses:['vulnerable'],statusEffects:[{statusKey:'vulnerable'}],zeroHp:null};
context.roomSnapshot.room.combatEvent = {kind:'combat-ability',revealAt:5000,results:[{
  key:'enemy-1',beforeHp:9,beforeTempHp:1,beforeStatuses:[],beforeStatusEffects:[],hp:4,tempHp:0
}]};
presented = context.combatPresentationEntry(spellTarget, 3000);
assert.strictEqual(presented.hp, 9, 'spell HP stays unchanged while its die or cast reveal is pending');
assert.strictEqual(presented.tempHp, 1, 'spell temporary HP uses the same reveal boundary');
assert.deepStrictEqual(Array.from(presented.statuses), [], 'spell statuses do not appear before the cast result');
assert.strictEqual(context.combatPresentationEntry(spellTarget, 5000), spellTarget, 'spell HP and statuses appear together at revealAt');

const downedEntry = {key:'hero-1',hp:0,hpMax:10,tempHp:0,zeroHp:{pending:true}};
context.roomSnapshot.room.combatEvent = {kind:'combat-damage',targetKey:'hero-1',beforeHp:4,beforeTempHp:0,revealAt:5000};
presented = context.combatPresentationEntry(downedEntry, 3000);
assert.strictEqual(presented.hp, 4);
assert.strictEqual(presented.zeroHp, null, 'downed state must not appear before damage reveal');

const deathEntry = {key:'hero-1',hp:0,hpMax:10,zeroHp:{pending:false,state:'stabilized',successes:4,failures:1,lastRoll:18,lastRollRound:6,lastOutcome:'success'}};
context.roomSnapshot.room.combatEvent = {kind:'combat-stabilized',targetKey:'hero-1',beforeDeathState:'death-saves',beforeSuccesses:3,beforeFailures:1,beforeLastRoll:12,beforeLastRollRound:5,beforeLastOutcome:'success',revealAt:5000};
presented = context.combatPresentationEntry(deathEntry, 3000);
assert.strictEqual(presented.zeroHp.state, 'death-saves', 'final death-save state stays hidden while the die animates');
assert.strictEqual(presented.zeroHp.successes, 3, 'death-save counters stay at their previous values before revealAt');
assert.strictEqual(context.combatPresentationEntry(deathEntry, 5000), deathEntry, 'death-save result becomes visible at revealAt');

const tickEntry = {key:'hero-1',hp:6,hpMax:10,tempHp:0,statuses:[],statusEffects:[],zeroHp:null};
context.roomSnapshot.room.combatEvent = {kind:'combat',targetKey:'hero-1',statusTicks:[{type:'damage',amount:3}],statusRemoved:['burn'],beforeHp:9,beforeTempHp:1,beforeStatuses:['burn'],beforeStatusEffects:[{statusKey:'burn'}],revealAt:5000};
presented = context.combatPresentationEntry(tickEntry, 3000);
assert.strictEqual(presented.hp, 9, 'status tick HP stays unchanged before its reveal boundary');
assert.strictEqual(presented.tempHp, 1, 'status tick temporary HP is committed at the same boundary');
assert.deepStrictEqual(Array.from(presented.statuses), ['burn'], 'automatic save removal stays hidden until the cleanse cue');
assert.strictEqual(context.combatPresentationEntry(tickEntry, 5000), tickEntry, 'status tick HP and statuses commit together');

assert.match(network, /beforeHp:before,beforeTempHp:vitalsResult\.beforeTempHp/, 'damage event must carry additive pre-damage presentation values');
assert.match(network, /beforeHp:beforeHp,beforeTempHp:beforeTempHp,beforeStatuses:beforeStatuses,beforeStatusEffects:beforeStatusEffects/, 'ability results carry additive pre-cast presentation values');
assert.match(network, /beforeSuccesses:previous\.successes/, 'death-save event must carry additive pre-roll presentation values');
assert.match(network, /statusTicks:tick\.impacts,statusRemoved:tick\.removedStatuses,beforeHp:/, 'turn events carry additive structured status presentation data');
assert.match(html, /var revealPresentation=function\(\)\{if\(typeof w\.zgPatchTokenRuntime==='function'\)w\.zgPatchTokenRuntime\(\);renderParty\(\);renderCombat\(\);animateCombatVisual\(\);\}/, 'the declarative result cue reveals presentation through the public token patch bridge');
assert.doesNotMatch(html.slice(html.indexOf('function animateCombatVisual()'),html.indexOf('function animateGmAdjustmentVisual()')), /animateCombatVisual\.timer/, 'combat reveal must not create a second parallel timer');
assert.match(html, /w\.zgCombatApprovedDamageRoll=function\(\)/, 'damage dice drag must have a live UI handler');
assert.match(html, /requestApprovedDamageRoll\(request\.id,combatLabPlayerUid\(\)\)/, 'damage dice UI must enter the existing Firebase damage-roll phase for a real or GM-controlled player');
assert.match(html, /w\.zgCombatPresentationEntry=function\(entry,event,clock\)/, 'scene presentation gate is exported for the session renderer');
assert.match(html, /function sessionCombatPresentationEntry\(entry,clock\)[\s\S]*w\.zgCombatPresentationEntry\(entry,event,clock\)/, 'session snapshots use the shared reveal gate without crossing an IIFE scope boundary');
assert.doesNotMatch(html.slice(html.indexOf('  function renderParty(){'),html.indexOf('  function renderJournal(){')), /\bcombatPresentationEntry\(/, 'party renderer must not call a helper from another IIFE directly');
assert.match(html, /w\.zgPatchTokenRuntime=patchTokenRuntime/, 'token patcher is explicitly exported for the session reveal callback');
assert.match(html, /w\.zgActionCursorIcon=function\(kind\)/, 'cursor asset lookup is explicitly exported for the session attack tool');
assert.doesNotMatch(html.slice(html.indexOf('  function setCombatAttackTool('),html.indexOf('  function selectCombatMapTarget(')), /actionCursorIcons\[/, 'session attack tool must not read cursor assets from another IIFE directly');
const sessionIifeStart = html.indexOf('//   КАРКАС VTT');
const sessionIifeEnd = html.indexOf('})(window);', sessionIifeStart);
const sessionIife = html.slice(sessionIifeStart, sessionIifeEnd);
assert.match(sessionIife, /function clamp\(value,min,max\)/, 'session combat and area FX must own their numeric clamp helper');
assert.strictEqual((sessionIife.match(/\bclamp\(/g)||[]).length, 8, 'combat, free-room menu, prepared-action pages and area FX clamp calls stay inside the session scope');

console.log('combat presentation timeline passed');
