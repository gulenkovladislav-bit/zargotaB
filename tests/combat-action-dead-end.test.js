'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

function block(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `${startNeedle} must remain inspectable`);
  return source.slice(start, end);
}

const actionUi = block(html, '  var combatActionBusy=false;', '  var combatAttackTargetKey=');
assert.match(actionUi, /if\(combatActionBusy\|\|!actionApi\|\|!actionApi\.useCombatAction\)/, 'rapid repeat clicks are ignored while an action is pending');
assert.match(actionUi, /actionApi=combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms/, 'offline Workshop actions stay inside the local combat adapter');
assert.match(actionUi, /if\(snapshot\)state=snapshot;renderCombat\(\)/, 'action success applies its returned state immediately');
assert.match(actionUi, /if\(w\.showToast\)w\.showToast\(labels\[type\]/, 'action success always has visible feedback');
assert.match(actionUi, /catch\(function\(error\)\{if\(w\.showToast\)/, 'action failure always has visible feedback');
assert.match(actionUi, /combatActionBusy=false/, 'action completion unlocks the controls');

const qaAdapter = block(html, '  function combatQaApply(change){', '  function combatQaRollFormula');
const combatRuntime = html.slice(html.indexOf('  w.zgVttApplyTestSnapshot='));
assert.match(html, /w\.zgManualCheckActionKind=manualCheckActionKind;/, 'the scene owner exports the shared manual-check predicate');
assert.doesNotMatch(combatRuntime, /(^|[^.\w])manualCheckActionKind\(/m, 'the combat module never calls the scene-private predicate directly');
assert.match(html, /zgVttGetTestRoomSnapshot=function\(\)\{return roomSnapshot&&roomSnapshot\.room&&roomSnapshot\.room\.code==='TEST'\?roomSnapshot:null;\}/, 'the VTT owner exposes only its reserved local TEST snapshot');
assert.match(html, /function combatQaSnapshot\(\)\{[\s\S]*w\.zgVttGetTestRoomSnapshot&&w\.zgVttGetTestRoomSnapshot\(\)/, 'Workshop actions recover the active TEST snapshot through the module boundary');
assert.match(qaAdapter, /return Promise\.resolve\(\)\.then\(function\(\)\{/, 'local adapter must turn synchronous transition failures into rejected promises');
assert.match(qaAdapter, /var current=combatQaActive\(\)&&combatQaSnapshot\(\)/, 'local mutations use the recovered TEST snapshot instead of a stale session snapshot');
assert.match(qaAdapter, /catch\(renderError\)\{w\.zgLocalCombatQaPresentationError=renderError;\}/, 'a local presentation exception cannot strand an already-applied request transition');
assert.match(html, /function combatRequestAction\(api,text,kind,uid,details,resolution\)/, 'represented hero actions use one guarded request helper');
assert.match(html, /return api\.requestAction\(text,kind,uid,details\);/, 'represented-player requests return their pending snapshot to the GM request panel');
assert.doesNotMatch(html, /function combatRequestAction[\s\S]*?combatQaApi\.resolveAction\(uid,true,resolution\|\|null\)/, 'the guarded helper leaves the represented hero action pending for the GM');
assert.doesNotMatch(html, /combatQaActive\(\)\?'Атака разрешена · перетащите d20'/, 'local represented players are not falsely told that the GM already approved their attack');
assert.match(html, /План вне дистанции отправлен мастеру/, 'out-of-range player attacks confirm only that the request was sent');
assert.match(html, /rangeOverride:combatAttack\.outOfRange===true/, 'approving an out-of-range request carries the GM exception into the eventual attack roll');
assert.match(network, /actionRequest\/details\/rangeOverride'[\s\S]*request\.details && request\.details\.outOfRange === true && resolution\.rangeOverride === true/, 'Firebase persists the explicit GM range exception for the player roll');
assert.match(network, /outOfRange: details\.outOfRange === true,[\s\S]*distanceCells:[\s\S]*rangeCells:/, 'Firebase request sanitization preserves the measured out-of-range context for GM approval');
assert.match(html, /approvedAttackDetails=Object\.assign\(\{\},request\.details,\{rangeOverride:request\.details\.rangeOverride===true\|\|request\.details\.outOfRange===true\}\)/, 'the GM execution path preserves the approved range exception even if the nested Firebase field arrives one render late');
assert.match(html, /onclick="'\+clickHandler\+'" aria-label="Перетащить кубик для броска"/, 'attack, damage, spell, and creature dice keep a click fallback when pointer drag is unavailable');
assert.match(html, /else\{drag\.node\.classList\.add\('returning'\);drag\.node\.click\(\);\}/, 'a tap or short drag activates the same guarded roll path instead of returning silently');

const saveUi = block(html, '  var combatSaveTargetKey=', '  function renderCombatPrepare');
assert.match(saveUi, /combatStartDeadline\(Promise\.resolve\(\)\.then\(function\(\)\{return assignToPlayer\?saveApi\.requestCombatSavingThrow/, 'saving throw assignment catches synchronous failures and has a timeout');
assert.match(saveUi, /combatSaveBusy=false;renderCombatSave\(\);renderCombat\(\)/, 'saving throw assignment always unlocks and restores the button');

const reactionUi = block(html, '  var combatReactionBusy=false,combatConcentrationBusy=false;', '  w.zgCombatConfirmEnd=');
['zgCombatPrepareSubmit','zgCombatPreparedTrigger'].forEach((name) => {
  assert.match(reactionUi, new RegExp('w\\.' + name + '=function'), `${name} remains wired`);
});
assert.match(reactionUi, /if\(combatReactionBusy\|\|/, 'prepared reaction clicks share one in-flight guard');
assert.match(reactionUi, /Реакция подготовлена — ожидает условия/, 'preparation explains the next state');
assert.match(reactionUi, /Подготовленная реакция сработала/, 'triggering reports a terminal state');
assert.match(reactionUi, /combatReactionBusy=false/, 'reaction controls unlock after success or failure');
assert.match(reactionUi, /if\(combatConcentrationBusy\|\|/, 'concentration stop ignores repeat clicks while pending');
assert.match(reactionUi, /Концентрация прекращена/, 'concentration stop reports completion');
assert.match(reactionUi, /combatConcentrationBusy=false/, 'concentration controls unlock after success or failure');

const targetingUi = block(html, '  w.zgVttRequestAbility=function(key){', '  var actionRequestBusy=false;');
assert.match(targetingUi, /w\.zgVttAbilityTargetCancelled=function\(\)\{pendingAbilityCast=null;\}/, 'canceling targeting clears the pending cast');
assert.match(targetingUi, /catch\(function\(error\)[\s\S]*Не удалось отправить заявку/, 'targeted cast failures have visible feedback');
assert.match(targetingUi, /then\(function\(\)\{abilityRequestBusy=false;renderDrawer\(\);\}/, 'targeted casts unlock their UI after either outcome');
assert.match(html, /if\(profile\.effectKind==='summon'\)return'point'/, 'summon spells request an explicit scene point');
assert.match(html, /effectKind:\['damage','heal','temp_hp','buff','control','cleanse','summon','movement','utility'\]/, 'VTT ability profiles preserve control, cleanse, and summon semantics');
assert.match(html, /w\.zgSceneQaActiveCombat=function\(sceneParticipants,heroOptions\)/, 'local QA exposes a selectable active combat fixture without Firebase');
assert.match(html, /reserveId='qa-linked-summon-reserve'/, 'the QA fixture provides one source-linked summon outside initiative');
assert.match(html, /token\.id!==reserveId/, 'the reserved summon stays outside the initial QA order');
assert.match(html, /room\.code!=='TEST'/, 'the offline active combat fixture cannot run in a live room');
assert.match(html, /id:'qa-combat-join-'/, 'the local join control finishes with an explicit QA event');
assert.match(html, /добавлен один раз без Firebase/, 'local QA confirms that its join simulation has no network side effect');

[
  ['combat-action', /eventId='combat-action-'\+stamp\+'-'\+Math\.random\(\)/],
  ['combat-prepare', /eventId='combat-prepare-'\+stamp\+'-'\+Math\.random\(\)/],
  ['combat-concentration', /eventId='combat-concentration-'\+stamp\+'-'\+Math\.random\(\)/]
].forEach(([kind, pattern]) => {
  assert.match(network, pattern, `${kind} events need collision-resistant playback ids`);
});
assert.match(network, /id:'combat-trigger-'\+String\(prepared\.requestId\|\|stamp\)/,
  'prepared trigger retries keep one stable playback id');
assert.match(network, /concentrationName=actor&&actor\.concentration&&actor\.concentration\.name\|\|'эффекте'/, 'concentration name is captured before state cleanup');
assert.match(network, /text:'Прекращает концентрацию на «'\+concentrationName\+'»\.'/,
  'concentration completion keeps the original ability name');
assert.match(network, /effectKind:\['damage','heal','temp_hp','buff','control','cleanse','summon','movement','utility'\]/,
  'Firebase ability requests preserve compatible control, cleanse, and summon metadata');
assert.match(network, /defaultName='Призыв · '\+String\(effect\.name\|\|'Существо'\)/,
  'an approved summon still creates a visible GM-owned placeholder instead of ending silently');

console.log('combat action anti-dead-end contracts passed');
