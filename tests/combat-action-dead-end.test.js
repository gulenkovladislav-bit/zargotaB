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
assert.match(html, /effectKind:\['damage','heal','temp_hp','buff','summon','movement','utility'\]/, 'VTT ability profiles preserve summon semantics');
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
assert.match(network, /effectKind:\['damage','heal','temp_hp','buff','summon','movement','utility'\]/,
  'Firebase ability requests preserve compatible summon metadata');
assert.match(network, /name:'Призыв · '\+String\(effect\.name\|\|'Существо'\)/,
  'an approved summon creates a visible GM-owned placeholder instead of ending silently');

console.log('combat action anti-dead-end contracts passed');
