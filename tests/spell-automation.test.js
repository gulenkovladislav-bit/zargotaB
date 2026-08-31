'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var automation = require('../spell-automation.js');

var profile = automation.resolve({ name: '✴\u202fЖар Пальцев' });
assert.ok(profile, 'Жар Пальцев has an automation profile');
assert.strictEqual(profile.automationKey, 'finger-heat-v1');
assert.strictEqual(profile.actionCost, 'long');
assert.strictEqual(profile.resolutionMode, 'attack');
assert.strictEqual(profile.usesAttackRoll, true);
assert.strictEqual(profile.attackStat, 'int');
assert.strictEqual(profile.targetRequired, true);
assert.strictEqual(profile.targetMode, 'target');
assert.strictEqual(profile.targetCount, 1);
assert.strictEqual(profile.rangeCells, 1);
assert.strictEqual(profile.damageFormula, '1d6');
assert.strictEqual(profile.damageType, 'fire');
assert.strictEqual(profile.maxUses, 1);
assert.strictEqual(profile.resourceScopeKind, 'battle');
assert.strictEqual(profile.animationKey, 'finger-heat-v1');
assert.strictEqual(profile.soundProfile, 'magic-fire');
assert.strictEqual(profile.iconAsset, 'images/ui/combat-generated/spell-finger-heat.png');
assert.strictEqual(profile.resolutionPlan.staged, true, 'the staged roll sequence is data, not a modal-only special case');
assert.deepStrictEqual(profile.resolutionPlan.steps.map(function(step){ return step.key; }), ['attack','damage']);
var effectPlan = automation.effectPlan(profile);
assert.deepStrictEqual(effectPlan.prescribed.map(function(effect){ return effect.key; }), ['fire-damage','ignite-flammable']);
assert.strictEqual(effectPlan.prescribed[0].required, true, 'the combat effect from the catalog is shown as canonical');
assert.strictEqual(effectPlan.prescribed[1].kind, 'scene', 'environment ignition is not mislabeled as a creature condition');
assert.deepStrictEqual(effectPlan.gmAdditions.kinds, ['status']);
assert.strictEqual(effectPlan.gmAdditions.max, 6);
assert.deepStrictEqual(automation.prescribedStatusKeys(profile), [], 'Finger Heat does not silently invent Burning for creatures');
assert.deepStrictEqual(profile.nonCombat.targets, ['torch', 'oil', 'candle', 'campfire']);
assert.strictEqual(profile.nonCombat.manual, true, 'environment ignition remains explicit instead of silently mutating the scene');
assert.strictEqual(automation.canonicalStatusKeys.length, 23, 'spell automation reuses exactly the 23 canonical Manual statuses');
assert.ok(!automation.canonicalStatusKeys.includes('dead'), 'Dead is derived from HP/death saves and cannot be prescribed by a spell');
automation.catalog().forEach(function (candidate) {
  var audit = automation.statusPolicyAudit(candidate);
  assert.strictEqual(audit.valid, true, candidate.automationKey + ' must pass the official-status gate: ' + audit.errors.join(', '));
  var learningAudit = automation.learningPlanAudit(candidate);
  assert.strictEqual(learningAudit.valid, true, candidate.automationKey + ' must define its real learning check: ' + learningAudit.errors.join(', '));
  var resolutionAudit = automation.resolutionPlanAudit(candidate);
  assert.strictEqual(resolutionAudit.valid, true, candidate.automationKey + ' must define every staged step and die owner: ' + resolutionAudit.errors.join(', '));
});
assert.deepStrictEqual(automation.statusPolicyAudit(automation.resolve({automationKey:'lightning-lasso-v1'})).decisions, [
  {key:'restrain',mode:'canonical'}
]);
assert.strictEqual(automation.statusPolicyAudit(automation.resolve({automationKey:'heaven-piercing-spear-v1'})).decisions[0].mechanics.cantReact, true);
assert.strictEqual(automation.statusPolicyAudit(automation.resolve({automationKey:'heaven-piercing-spear-v1'})).decisions[0].mechanics.cantAct, false, 'reaction lock must not silently become Stun or Paralysis');
assert.deepStrictEqual(automation.learningPlan(profile).checks[0], {statOptions:['int'],dc:12,successesRequired:1});
var retaliation = automation.resolve({name:'🛡Ответный Шип'});
assert.ok(retaliation, 'the first level-one catalog ability has an automation profile');
assert.strictEqual(retaliation.automationKey, 'retaliation-spike-v1');
assert.strictEqual(retaliation.triggeredOnly, true, 'the counterattack cannot be submitted as an ordinary cast');
assert.strictEqual(retaliation.actionCost, 'reaction');
assert.strictEqual(retaliation.maxUses, 2);
assert.strictEqual(retaliation.resourceScopeKind, 'battle');
assert.strictEqual(retaliation.weaponMode, 'main');
assert.strictEqual(retaliation.nextTurnLongActionDebt, 1);
assert.deepStrictEqual(retaliation.learningPlan.checks[0], {statOptions:['con'],dc:12,successesRequired:2});
assert.deepStrictEqual(retaliation.learningPlan.failure.consequenceChoices.map(function(choice){return choice.key;}), ['fatigue-next-check','overstrain-hp']);
assert.deepStrictEqual(automation.statusPolicy(retaliation), {mode:'none',keys:[],removes:[]}, 'action-economy debt must not become an unofficial condition');
var sweeping = automation.resolve({automationKey:'sweeping-strike-v1'});
assert.ok(sweeping, 'the second level-one catalog ability has an automation profile');
assert.strictEqual(sweeping.catalogId, '1773672646696');
assert.strictEqual(sweeping.actionCost, 'long');
assert.strictEqual(sweeping.targetMode, 'enemy');
assert.strictEqual(sweeping.targetCount, 2, 'Sweeping Strike requires exactly two targets');
assert.strictEqual(sweeping.weaponMode, 'two-handed-melee');
assert.strictEqual(sweeping.damageSplit, 'ceil-half-per-target');
assert.deepStrictEqual(sweeping.learningPlan.checks[0], {statOptions:['str'],dc:12,successesRequired:2});
assert.strictEqual(sweeping.learningPlan.retry.kind, 'immediate');
assert.deepStrictEqual(sweeping.learningPlan.failure.temporaryEffects.map(function(effect){return [effect.kind,effect.amount,effect.until];}), [
  ['attack-penalty',-1,'next-attack'],['initiative-penalty',-1,'rest']
]);
assert.deepStrictEqual(automation.statusPolicy(sweeping), {mode:'none',keys:[],removes:[]}, 'the narrowly defined learning fatigue is not promoted to canonical Exhaustion');
assert.ok(!automation.prescribedStatusKeys(sweeping).includes('exhausted'));

var sweepingWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(sweeping, {
  casterUid:'caster', targets:[{key:'enemy-a',uid:'enemy-a-owner'},{key:'enemy-b'}]
}));
assert.strictEqual(sweepingWorkflow.assignments.length, 2, 'one shared attack and one shared damage assignment cover both targets');
assert.strictEqual(sweepingWorkflow.activeAssignmentId, 'attack:enemy-a');
assert.strictEqual(sweepingWorkflow.assignments[0].shared, true);
sweepingWorkflow = automation.recordResolutionResult(sweepingWorkflow, sweepingWorkflow.activeAssignmentId, {roll:14,rolls:[14],modifier:2,total:16,dc:10,success:true,rolledAt:1}).workflow;
assert.strictEqual(sweepingWorkflow.activeAssignmentId, 'damage');
sweepingWorkflow = automation.recordResolutionResult(sweepingWorkflow, sweepingWorkflow.activeAssignmentId, {formula:'1d6',rolls:[5],total:5,rolledAt:2}).workflow;
assert.strictEqual(sweepingWorkflow.status, 'ready-to-apply');
var sweepingWorkflowResult = automation.resolutionWorkflowResults(sweeping, sweepingWorkflow, ['enemy-a','enemy-b']);
assert.deepStrictEqual(sweepingWorkflowResult.results.map(function(result){return result.damage;}), [3,3], 'odd shared weapon damage is halved separately and rounded up for each hit');
assert.deepStrictEqual(sweepingWorkflowResult.results[0].rolls, sweepingWorkflowResult.results[1].rolls, 'both targets inherit the same attack die');

var stormArrow = automation.resolve({automationKey:'storm-arrow-v1'});
assert.ok(stormArrow, 'the third level-one catalog ability has an automation profile');
assert.strictEqual(stormArrow.automationKey, 'storm-arrow-v1');
assert.strictEqual(stormArrow.weaponMode, 'ranged');
assert.strictEqual(stormArrow.targetCount, 2);
assert.strictEqual(stormArrow.attackRollMode, 'disadvantage');
assert.strictEqual(stormArrow.damageRollMode, 'disadvantage');
assert.strictEqual(stormArrow.lockRemainingTurn, true);
assert.deepStrictEqual(stormArrow.learningPlan.checks[0], {statOptions:['dex','per'],choose:'best',dc:11,successesRequired:2});
assert.strictEqual(stormArrow.learningPlan.retry.kind, 'break');
assert.deepStrictEqual(stormArrow.learningPlan.failure.temporaryEffects.map(function(effect){return [effect.kind,effect.stat||'',effect.amount,effect.until];}), [
  ['learning-check-penalty','dex',-1,'next-learning-check'],
  ['learning-check-penalty','per',-1,'next-learning-check'],
  ['range-penalty','',-1,'next-battle']
]);
assert.deepStrictEqual(automation.statusPolicy(stormArrow), {mode:'none',keys:[],removes:[]}, 'training strain and turn economy are not unofficial statuses');

var stormWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(stormArrow, {
  casterUid:'archer', targets:[{key:'enemy-a'},{key:'enemy-b'}]
}));
assert.strictEqual(stormWorkflow.assignments.length, 2, 'one shared disadvantaged attack and one shared disadvantaged damage assignment cover both arrows');
assert.strictEqual(stormWorkflow.assignments[0].compare, 'multi-target-ac');
assert.strictEqual(stormWorkflow.assignments[0].rollMode, 'disadvantage');
assert.strictEqual(stormWorkflow.assignments[1].rollMode, 'disadvantage');
stormWorkflow = automation.recordResolutionResult(stormWorkflow, stormWorkflow.activeAssignmentId, {roll:9,rolls:[15,9],rollMode:'disadvantage',modifier:2,total:11,dc:10,success:true,rolledAt:1}).workflow;
stormWorkflow = automation.recordResolutionResult(stormWorkflow, stormWorkflow.activeAssignmentId, {formula:'1d6',rolls:[4],discardedRolls:[6],rollMode:'disadvantage',total:6,rolledAt:2}).workflow;
var stormWorkflowResult = automation.resolutionWorkflowResults(stormArrow, stormWorkflow, ['enemy-a','enemy-b']);
assert.deepStrictEqual(stormWorkflowResult.results.map(function(result){return result.damage;}), [6,6], 'each hit receives the full shared lower damage result rather than a split');
assert.deepStrictEqual(stormWorkflowResult.results[0].rolls, [15,9], 'both targets inherit the same disadvantaged attack pair');

var rotRay = automation.resolve({automationKey:'rot-ray-v1'});
assert.ok(rotRay, 'the fourth level-one spell has an automation profile');
assert.deepStrictEqual([rotRay.catalogId,rotRay.attackStat,rotRay.saveStat,rotRay.saveDC,rotRay.rangeCells,rotRay.damageFormula,rotRay.damageType], ['1773702048611','cha','con',13,3,'1d6','poison']);
assert.deepStrictEqual([rotRay.maxUses,rotRay.resourceScopeKind,rotRay.maxUsesPerBattle,rotRay.concentration], [2,'long-rest',1,false]);
assert.deepStrictEqual(rotRay.learningPlan.checks[0], {statOptions:['cha'],dc:11,successesRequired:1});
assert.deepStrictEqual(rotRay.learningPlan.prerequisites.anyMinStats, {int:2,cha:2});
assert.deepStrictEqual(rotRay.learningPlan.failure.temporaryEffects.map(function(effect){return [effect.kind,effect.until];}), [['one-eye-blind','rest'],['spell-disabled','rest']]);
assert.deepStrictEqual(automation.statusPolicy(rotRay), {mode:'canonical',keys:['poison'],removes:[]}, 'Rot Ray reuses the official Poisoned status');
assert.ok(automation.canonicalStatusKeys.includes('poison'), 'the official Poisoned key remains part of the Manual status catalog');
assert.deepStrictEqual(rotRay.resolutionPlan.steps.map(function(step){return step.key;}), ['attack','damage','save','status-duration','apply']);

var rotWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(rotRay, {
  casterUid:'warlock', targets:[{key:'enemy',uid:'enemy-owner',name:'Цель'}]
}));
assert.strictEqual(rotWorkflow.activeAssignmentId, 'attack:enemy');
rotWorkflow = automation.recordResolutionResult(rotWorkflow, rotWorkflow.activeAssignmentId, {roll:15,rolls:[15],modifier:3,total:18,dc:12,success:true,rolledAt:1}).workflow;
assert.strictEqual(rotWorkflow.activeAssignmentId, 'damage');
rotWorkflow = automation.recordResolutionResult(rotWorkflow, rotWorkflow.activeAssignmentId, {formula:'1d6',rolls:[4],total:4,rolledAt:2}).workflow;
assert.strictEqual(rotWorkflow.activeAssignmentId, 'save:enemy');
assert.strictEqual(rotWorkflow.assignments.find(function(step){return step.id==='save:enemy';}).ownerUid, 'enemy-owner', 'a player target owns the post-hit CON save');
rotWorkflow = automation.recordResolutionResult(rotWorkflow, rotWorkflow.activeAssignmentId, {roll:5,rolls:[5],modifier:1,total:6,dc:13,success:false,rolledAt:3}).workflow;
assert.strictEqual(rotWorkflow.activeAssignmentId, 'status-duration');
rotWorkflow = automation.recordResolutionResult(rotWorkflow, rotWorkflow.activeAssignmentId, {formula:'1d6',rolls:[5],total:5,rolledAt:4}).workflow;
var rotWorkflowResult = automation.resolutionWorkflowResults(rotRay, rotWorkflow, ['enemy']).results[0];
assert.strictEqual(rotWorkflowResult.damage, 4);
assert.strictEqual(rotWorkflowResult.conditionalSave.success, false);
assert.strictEqual(rotWorkflowResult.statusDuration, 3, 'visible d6 is mapped to 1d3 by rounding half upward');
assert.deepStrictEqual(rotWorkflowResult.statuses, ['poison']);

var rotSaveSuccessWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(rotRay, {casterUid:'warlock',targets:[{key:'enemy'}]}));
rotSaveSuccessWorkflow = automation.recordResolutionResult(rotSaveSuccessWorkflow, rotSaveSuccessWorkflow.activeAssignmentId, {roll:15,total:18,dc:12,success:true}).workflow;
rotSaveSuccessWorkflow = automation.recordResolutionResult(rotSaveSuccessWorkflow, rotSaveSuccessWorkflow.activeAssignmentId, {rolls:[3],total:3}).workflow;
rotSaveSuccessWorkflow = automation.recordResolutionResult(rotSaveSuccessWorkflow, rotSaveSuccessWorkflow.activeAssignmentId, {roll:18,total:19,dc:13,success:true}).workflow;
assert.strictEqual(rotSaveSuccessWorkflow.assignments.find(function(step){return step.stepKey==='status-duration';}).status, 'skipped', 'successful CON save skips the duration die');
assert.deepStrictEqual(automation.resolutionWorkflowResults(rotRay, rotSaveSuccessWorkflow, ['enemy']).results[0].statuses, []);

var rotMissWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(rotRay, {casterUid:'warlock',targets:[{key:'enemy'}]}));
rotMissWorkflow = automation.recordResolutionResult(rotMissWorkflow, rotMissWorkflow.activeAssignmentId, {roll:2,total:5,dc:12,success:false}).workflow;
assert.deepStrictEqual(rotMissWorkflow.assignments.slice(1).map(function(step){return step.status;}), ['skipped','skipped','skipped'], 'a miss skips damage, CON save, and duration without spending extra rolls');

var rotPreviewRolls = [.8,.3,0,.99];
var rotPreview = automation.buildPreview(rotRay, {actor:{stats:{cha:3}},targets:[{key:'enemy',ac:12,hp:12,hpMax:12,stats:{con:1}}]}, function(){return rotPreviewRolls.shift();}).results[0];
assert.strictEqual(rotPreview.success, true);
assert.strictEqual(rotPreview.damage, 2);
assert.strictEqual(rotPreview.conditionalSave.success, false);
assert.strictEqual(rotPreview.statusDuration, 3);
assert.deepStrictEqual(rotPreview.statuses, ['poison']);
var rotImmuneRolls = [.8,.3,0];
var rotImmunePreview = automation.buildPreview(rotRay, {actor:{stats:{cha:3}},targets:[{key:'immune',ac:12,hp:12,hpMax:12,stats:{con:0},immunities:['poison']}]}, function(){return rotImmuneRolls.shift();}).results[0];
assert.strictEqual(rotImmunePreview.damage, 0);
assert.deepStrictEqual(rotImmunePreview.statuses, [], 'poison immunity blocks both the damage and the condition');

var sweepingLedger = automation.spellModifierLedger(sweeping, [{instanceId:'greatsword',name:'Двуручный меч',effects:[
  {id:'accuracy',operation:'add-attack-bonus',value:2,frequency:'passive'},
  {id:'flame',operation:'add-damage-dice',dice:'1d6',frequency:'combat',charges:1},
  {id:'conditional',operation:'add-flat-damage',value:3,frequency:'passive',condition:'против крупных целей'},
  {id:'spell-only',operation:'add-die-to-spell-attack-roll',dice:'1d4',frequency:'passive'}
]}]);
assert.deepStrictEqual(sweepingLedger.entries.map(function(entry){return [entry.effectId,entry.stage,entry.optional,entry.value,entry.dice,entry.condition];}), [
  ['accuracy','attack',false,2,'',''],
  ['flame','damage',true,0,'1d6',''],
  ['conditional','damage',true,3,'','против крупных целей']
], 'weapon accuracy, damage dice and conditional bonuses use explicit stages while spell-only attack bonuses do not leak into a weapon swing');
assert.deepStrictEqual(automation.resolutionPlan(automation.resolve({automationKey:'fire-projectile-v1'})).steps.map(function (step) { return [step.key,step.actor]; }), [
  ['saves','target-owner'],['damage','caster-owner'],['apply','resolver']
]);
assert.strictEqual(automation.resolutionPlan(automation.resolve({automationKey:'heaven-piercing-spear-v1'})).steps.filter(function (step) { return step.kind === 'save'; }).length, 2, 'the spear keeps both the DEX and severe-failure CON saves');

var fireWorkflow = automation.createResolutionWorkflow(automation.resolve({automationKey:'fire-projectile-v1'}), {
  casterUid:'caster',
  targets:[{key:'member:target',uid:'target',name:'Цель игрока'},{key:'token:goblin',name:'Гоблин'}]
});
assert.strictEqual(automation.resolutionWorkflowAudit(automation.resolve({automationKey:'fire-projectile-v1'}), fireWorkflow).valid, true);
fireWorkflow = automation.advanceResolutionWorkflow(fireWorkflow);
assert.strictEqual(fireWorkflow.activeAssignmentId, 'saves:member:target', 'the first player-owned save is assigned to its target');
assert.strictEqual(fireWorkflow.assignments[0].ownerUid, 'target');
var firstSave = automation.recordResolutionResult(fireWorkflow, fireWorkflow.activeAssignmentId, {roll:15,total:17,dc:13,success:true,rolledAt:1});
assert.strictEqual(firstSave.valid, true);
assert.strictEqual(firstSave.workflow.activeAssignmentId, 'saves:token:goblin', 'a creature save remains a separate GM-owned stage');
assert.strictEqual(firstSave.workflow.assignments[1].ownerRole, 'master');
var secondSave = automation.recordResolutionResult(firstSave.workflow, firstSave.workflow.activeAssignmentId, {roll:4,total:5,dc:13,success:false,rolledAt:2});
assert.strictEqual(secondSave.workflow.activeAssignmentId, 'damage', 'shared damage is rolled only after every target save');
assert.strictEqual(secondSave.workflow.assignments[2].ownerUid, 'caster');
var fireDone = automation.recordResolutionResult(secondSave.workflow, 'damage', {formula:'3d6',rolls:[2,3,4],total:9,rolledAt:3});
assert.strictEqual(fireDone.workflow.status, 'ready-to-apply');

var spearWorkflow = automation.advanceResolutionWorkflow(automation.createResolutionWorkflow(automation.resolve({automationKey:'heaven-piercing-spear-v1'}), {
  casterUid:'caster', targets:[{key:'member:target',uid:'target'}]
}));
assert.strictEqual(spearWorkflow.activeAssignmentId, 'line-clear', 'the GM confirms that no thick stone or strong magical barrier blocks the lightning line');
spearWorkflow = automation.recordResolutionResult(spearWorkflow, spearWorkflow.activeAssignmentId, {approved:true,rolledAt:1}).workflow;
spearWorkflow = automation.recordResolutionResult(spearWorkflow, spearWorkflow.activeAssignmentId, {roll:4,total:6,dc:17,success:false,rolledAt:1}).workflow;
assert.strictEqual(spearWorkflow.activeAssignmentId, 'fail-damage', 'the success damage pool is skipped when every DEX save failed');
spearWorkflow = automation.recordResolutionResult(spearWorkflow, spearWorkflow.activeAssignmentId, {formula:'7d8',rolls:[1,2,3,4,5,6,7],total:28,rolledAt:2}).workflow;
assert.strictEqual(spearWorkflow.activeAssignmentId, 'secondary-saves:member:target', 'a failure by five or more schedules the target CON save');

var modifierLedger = automation.spellModifierLedger(profile, [{id:'ring',name:'Кольцо',effects:[{id:'edge',operation:'add-die-to-spell-attack-roll',dice:'1d4',frequency:'combat',charges:1}]}]);
assert.deepStrictEqual(modifierLedger.entries.map(function (entry) { return [entry.id,entry.effectId,entry.stage,entry.dice]; }), [['item-effect-ring-edge','edge','attack','1d4']], 'equipped spell effects become an explicit audit ledger with a source-unique row id');
var duplicateEffectLedger = automation.spellModifierLedger(profile, [{instanceId:'ring-1',name:'Кольцо',effects:[{id:'edge',operation:'add-die-to-spell-attack-roll',dice:'1d4'}]},{instanceId:'ring-2',name:'Второе кольцо',effects:[{id:'edge',operation:'add-die-to-spell-attack-roll',dice:'1d6'}]}]);
assert.deepStrictEqual(duplicateEffectLedger.entries.map(function (entry) { return entry.id; }), ['item-effect-ring-1-edge','item-effect-ring-2-edge'], 'same-named effects from different item instances never collide in the workflow selector');
var spentLedger = automation.spellModifierLedger(profile, [{instanceId:'ring-1',id:'ring',name:'Кольцо',effects:[{id:'edge',operation:'add-die-to-spell-attack-roll',dice:'1d4',frequency:'combat',charges:1}]}], {usage:{'item-effect-ring-1-edge':{used:1,scopeKey:'battle-7'}},battleScopeKey:'battle-7'});
assert.strictEqual(spentLedger.entries[0].available, false, 'a charged item bonus cannot be consumed twice in the same battle scope');
var resetLedger = automation.spellModifierLedger(profile, [{instanceId:'ring-1',id:'ring',name:'Кольцо',effects:[{id:'edge',operation:'add-die-to-spell-attack-roll',dice:'1d4',frequency:'combat',charges:1}]}], {usage:{'item-effect-ring-1-edge':{used:1,scopeKey:'battle-6'}},battleScopeKey:'battle-7'});
assert.strictEqual(resetLedger.entries[0].available, true, 'a combat-scoped item bonus resets in the next battle');

var removeCurse = automation.resolve({automationKey:'remove-curse-v1'});
assert.strictEqual(removeCurse.resourceScopeKind, 'two-days');
assert.strictEqual(removeCurse.cooldownMs, 172800000, 'Remove Curse enforces the catalog 48-hour cooldown');
var psychic = automation.resolve({automationKey:'psychic-screech-v1'});
assert.strictEqual(psychic.rangePolicy, 'visible-unlimited');
assert.strictEqual(automation.resolutionPlan(psychic).steps[0].key, 'visible-target', 'visibility and sentience are an explicit GM gate before the target save');
var gravity = automation.resolve({automationKey:'gravity-center-v1'});
assert.strictEqual(gravity.maxTargetSize, 'large');
assert.strictEqual(gravity.catalogInterpretation, 'save-success-holds-position', 'the contradictory catalog success line has a documented deterministic interpretation');

assert.strictEqual(automation.resolve({ name: 'Искры' }), null, 'the removed Sparks prototype is not automated');
assert.strictEqual(automation.resolve({ name: 'Искры света' }), null, 'partial names must not accidentally inherit automation');
assert.strictEqual(automation.resolve({ automationKey:'finger-heat-v1' }).name, 'Жар Пальцев', 'synchronized requests resolve their canonical profile by stable key');
assert.strictEqual(automation.normalizeName(' ✴\u200BЖАР\u202fПАЛЬЦЕВ '), 'жар пальцев');

var untouched = automation.mergeMeta({ name: 'Неизвестное заклинание' }, { actionCost: 'short' });
assert.deepStrictEqual(untouched, { actionCost: 'short' }, 'unknown spells retain inferred catalog metadata');
var merged = automation.mergeMeta({ name: 'Жар Пальцев' }, { actionCost: 'short', damageFormula: '9d9' });
assert.strictEqual(merged.actionCost, 'long', 'the canonical automation profile wins over loose text inference');
assert.strictEqual(merged.damageFormula, '1d6');
assert.strictEqual(merged._source, 'automation:finger-heat-v1');

var rolls = [0.69, 0.49];
var preview = automation.buildPreview(profile, {
  actor:{ key:'hero', name:'Лин’Ин', stats:{ int:3 } },
  targets:[{ key:'rat', name:'QA Крыса', ac:12, hp:9, hpMax:9, tempHp:2 }]
}, function () { return rolls.shift(); });
assert.strictEqual(preview.results[0].roll, 14, 'preview rolls the attack once');
assert.strictEqual(preview.results[0].total, 17, 'preview adds the INT modifier');
assert.strictEqual(preview.results[0].success, true, 'preview compares the total with AC');
assert.strictEqual(preview.results[0].damage, 3, 'preview rolls 1d6 damage');
assert.strictEqual(preview.results[0].absorbed, 2, 'preview accounts for temporary HP');
assert.strictEqual(preview.results[0].hp, 8, 'preview projects HP without mutating the target');
assert.strictEqual(preview.results[0].tempHp, 0);

var resistantPreview = automation.buildPreview(profile, {
  actor:{ stats:{ int:0 } },
  targets:[{ key:'fire', ac:0, hp:10, resistances:['fire'] }]
}, function () { return .99; });
assert.strictEqual(resistantPreview.results[0].rawDamage, 12, 'critical attack doubles the damage dice');
assert.strictEqual(resistantPreview.results[0].damage, 6, 'fire resistance is reflected in the GM preview');

var missPreview = automation.buildPreview(profile, {
  actor:{ stats:{ int:0 } }, targets:[{ key:'miss', ac:20, hp:10 }]
}, function () { return 0; });
assert.strictEqual(missPreview.results[0].success, false);
assert.strictEqual(missPreview.results[0].damage, 0);
assert.strictEqual(missPreview.results[0].potentialDamage, 1, 'forcing a miss into a hit can restore the already rolled damage die');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var network = fs.readFileSync(path.resolve(__dirname, '..', 'zargota-network.js'), 'utf8');
assert.match(html, /spell-automation\.js\?v=/, 'the browser loads the spell automation registry before combat adapters');
assert.match(html, /ZargotaSpellAutomation\.mergeMeta/, 'catalog parsing merges the canonical automation profile');
assert.match(html, /\['battle','short-rest','long-rest','two-days'\]\.indexOf\(meta\.resourceScopeKind\)>=0/, 'every supported spell resource scope reaches combat requests');
assert.match(html, /cooldownMs:Math\.max\(0,Number\(meta\.cooldownMs\)\|\|0\)/, 'timed cooldown metadata reaches combat requests');
assert.match(network, /battleStartedAt>0\?'battle-'\+battleStartedAt:''/, 'battle-limited spell charges never collapse into battle-0');
assert.match(network, /animationKey:String\(details\.animationKey\|\|''\)/, 'requests preserve the automated visual key');
assert.match(network, /soundProfile:String\(details\.soundProfile\|\|''\)/, 'requests preserve the automated sound profile');
assert.match(network, /updates\.combatEvent\.animationKey=String\(effect\.animationKey\|\|''\)/, 'combat events preserve the automated visual key');
assert.match(network, /updates\.combatEvent\.soundProfile=String\(effect\.soundProfile\|\|''\)/, 'combat events preserve the automated sound profile');
assert.match(html, /automatedAbilityRequest\(request\)/, 'automated spells use the dedicated GM verdict instead of the generic builder');
assert.match(html, /Подтвердить и применить/, 'the GM receives an explicit apply boundary');
assert.doesNotMatch(html.slice(html.indexOf('w.zgAbilityResolveOpen=function'), html.indexOf('w.zgMovementRequestsToggle=function')), /openAbilityTargetEntity\(/, 'opening or selecting a spell target does not open the general GM panel');
assert.match(network, /approvedResults\[key\]/, 'the authoritative resolver accepts only the master-approved result map');
assert.match(network, /combat-ability-preview-invalid/, 'stale or incomplete approved previews are rejected');

console.log('Finger Heat spell automation contract passed');
