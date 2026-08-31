'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');
const submitStart = html.indexOf('  w.zgCombatAttackSubmit=function()');
const dragStart = html.indexOf('  w.zgCombatMasterAttackDragStart=function(');
const rollStart = html.indexOf('  w.zgCombatMasterAttackRoll=function()');
assert.ok(submitStart >= 0 && dragStart > submitStart && rollStart > dragStart, 'GM creature hit-die stages remain available');

const submit = html.slice(submitStart, html.indexOf('\n  };', submitStart) + 5);
assert.match(submit, /masterPendingAttackRoll=\{id:'gm-attack-drag-'/, 'confirming a creature attack creates a local pending hit roll');
assert.doesNotMatch(submit, /resolveCombatAttack\(/, 'confirming the attack must not roll the d20 automatically');
assert.match(submit, /gmRangeInfo\.outOfRange&&!combatAttackRangeOverride/, 'an out-of-range creature attack is blocked before a d20 is created');
assert.match(submit, /rangeOverride:gmRangeInfo\.outOfRange&&combatAttackRangeOverride/, 'explicit GM range approval reaches the authoritative attack options');

const attackUiStart = html.indexOf('  function renderCombatAttack(force)');
const attackUiEnd = html.indexOf('  w.zgCombatAttackToggle=', attackUiStart);
const attackUi = html.slice(attackUiStart, attackUiEnd);
assert.match(attackUi, /id="zg-combat-range-override" type="checkbox"/, 'out-of-range creature selection exposes an explicit GM checkbox');
assert.match(attackUi, /gmAttackDisabled=!combatAttackTargetKey\|\|combatAttackBusy\|\|selectedRangeInfo\.outOfRange&&!combatAttackRangeOverride/, 'the confirm button stays disabled until range approval');
assert.match(attackUi, /Без разрешения d20 недоступен\./, 'the warning explains that the die is unavailable before approval');

assert.match(html, /if\(distance!=null&&distance>rangeCells&&!rangeOverride\)return Promise\.reject/, 'local QA enforces the same range gate as Firebase');
assert.match(network, /if\(distance!=null&&distance>rangeCells&&!rangeOverride\)throw roomError\([^;]+,'combat-target-range'\)/, 'Firebase rejects an out-of-range attack without explicit approval');
assert.match(network, /rangeOverride:rangeOverride/, 'Firebase publishes the approval flag in the combat result');
assert.match(network, /мастер разрешил атаку вне дистанции/, 'Firebase journal text records the GM exception');

const promptStart = html.indexOf('  function renderCombat()');
const promptEnd = html.indexOf('  function combatBusy(', promptStart);
const prompt = html.slice(promptStart, promptEnd);
assert.match(prompt, /showMasterAttack=!!\(active&&masterSurface/, 'the pending creature attack exposes a master-only roll prompt');
assert.doesNotMatch(prompt, /showMasterAttack=!!\(active&&session&&session\.role==='master'/, 'player preview cannot expose the GM creature roll prompt through the underlying session role');
assert.match(prompt, /showMasterAttack\?'zgCombatMasterAttackDragStart\(event\)'/, 'the d20 prompt starts the physical GM drag path');
assert.match(prompt, /АТАКА СУЩЕСТВА · БРОСЬТЕ d20/, 'the prompt clearly distinguishes the hit roll from damage');

const drag = html.slice(dragStart, html.indexOf('\n  };', dragStart) + 5);
assert.match(drag, /beginApprovedDiceDrag\(ev,node,\{isMasterAttack:true/, 'creature hit d20 uses the shared optimized drag ghost');
const releaseStart = html.indexOf('  function endApprovedAttackDie(');
const releaseEnd = html.indexOf("  document.addEventListener('pointermove'", releaseStart);
const release = html.slice(releaseStart, releaseEnd);
assert.match(release, /if\(drag\.isMasterAttack\)[\s\S]*?w\.zgCombatMasterAttackRoll\(\)/, 'only releasing a thrown d20 resolves the creature attack');
assert.match(release, /clientX:drag\.lastX,clientY:drag\.lastY/, 'the resolved die inherits the last visible drag position instead of teleporting to the screen centre');
assert.match(release, /diceSoundStarted:true/, 'the rolling sample starts on physical release');
assert.match(release, /finishApprovedDiceGhost\(\);if\(drag\.isMasterAttack\)/, 'the flat drag texture is removed before the creature attack resolves');
assert.doesNotMatch(html, /launchApprovedDiceGhost|zgApprovedDiceLaunch|zg-dice-drag\.launching/, 'no flat launch animation may precede the physical result die');
assert.match(html, /if\(motion&&typeof finishApprovedDiceGhost==='function'\)finishApprovedDiceGhost\(\)/, 'the physical renderer defensively removes any held drag texture');
assert.match(html, /var attackPrompt=showAttackRoll\?\(isPending\?'<div class="zg-approved-attack roll-summary">/, 'an in-flight hit or damage roll shows text only instead of a second prompt die');
assert.match(html, /intentWaiting\?'<div class="zg-approved-attack combat-intent-roll roll-summary">/, 'an in-flight short-action check also avoids a duplicate prompt die');

const roll = html.slice(rollStart, html.indexOf('\n  };', rollStart) + 5);
assert.match(roll, /masterAttackApi\.resolveCombatAttack\(pending\.targetKey,pending\.options\|\|\{\},pending\.attackerKey\)/, 'die release preserves the existing authoritative attack resolver and data format');
assert.match(roll, /animateCombatAttackResult\(snapshot,'',combatRollOptions\(attacker\),motion\)/, 'the hit result reuses the physical throw vector');

const pendingResultStart = html.indexOf('  function processMasterPendingDamageResult()');
const pendingResultEnd = html.indexOf('  function approvedDamageDiceHtml(', pendingResultStart);
assert.ok(pendingResultStart >= 0 && pendingResultEnd > pendingResultStart, 'GM pending hit playback remains extractable');
let receivedMotion = null;
const earlyMotion = {clientX:840,clientY:510,x:170,y:0,spin:12};
const earlyContext = {
  String,
  Promise,
  state:{session:{role:'master'},room:{combat:{pendingDamage:{sourceEventId:'hit-event-1',attackerKey:'npc-1'},combatEvent:null,order:[{key:'npc-1',uid:''}]},combatEvent:{id:'hit-event-1'}}},
  masterCombatThrowMotions:{'gm-drag-1':{attack:earlyMotion}},
  masterPendingAttackRoll:{id:'gm-drag-1'},
  lastMasterAttackStageResult:'',
  masterAttackStageAnimating:'',
  animateCombatAttackResult(snapshot,speaker,options,motion){receivedMotion=motion;return Promise.resolve();},
  combatRollOptions(){return{};},
  renderCombat(){},
  w:{showToast(){}},
  console
};
vm.createContext(earlyContext);
vm.runInContext(html.slice(pendingResultStart,pendingResultEnd),earlyContext);
earlyContext.processMasterPendingDamageResult();
assert.strictEqual(receivedMotion,earlyMotion,'re-entrant QA/Firebase render recovers the drag vector from the still-pending GM request');

console.log('GM creature hit drag contract passed');
