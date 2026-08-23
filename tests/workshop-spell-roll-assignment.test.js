'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = index.indexOf(startMarker);
  const end = index.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing source block: ${startMarker}`);
  return index.slice(start, end);
}

const helperSource = sourceBetween('function abilityResolutionApi()', 'function automatedAbilityRequest');
const effectPlanSource = sourceBetween('function abilityRenderEffectPlan', 'function abilityRenderAutomated');
const automatedVerdictSource = sourceBetween('function abilityRenderAutomated', 'w.zgAbilityPreviewOutcome');
const handlerSource = sourceBetween('function abilityResolveSafeOpen', 'function openAbilityTargetEntity');
const openHandlerSource = sourceBetween('w.zgAbilityResolveOpen=function', 'function abilityResolveCurrentRoom');
const applyHandlerSource = sourceBetween('function abilityResolveCurrentRoom', 'w.zgMovementRequestsToggle');
const qaDistanceSource = sourceBetween('function combatQaAbilityPoint', 'function combatQaApply');
const qaPrepareSource = sourceBetween('prepareCombatAbilityRoll:function', 'rollCombatAbilityStage:function');
const qaSyncTargetSource = sourceBetween('function combatQaSyncTarget', 'function combatQaSyncZeroHp');
const qaNormalizeSource = sourceBetween('function combatQaNormalizeStatusKey', 'var combatQaApi=');
const qaResolveSource = sourceBetween('resolveCombatAbility:function', 'requestCombatSavingThrow:function');
const stageUiSource = sourceBetween('function abilityRequestStageUi', 'function renderMovementOverlays');
const requestCardSource = sourceBetween('function renderMovementOverlays', 'function movementFeedback');

function makeContext(options) {
  options = options || {};
  const calls = [];
  const opens = [];
  const toasts = [];
  const errors = [];
  const snapshots = [];
  const closes = [];
  const removedClasses = [];
  const nodes = {
    'zg-combat-ability-resolve': { classList: { remove(value) { removedClasses.push(value); } } },
    'zg-ability-area-layer': { innerHTML: 'preview' },
    'zg-combat-roll-prompt': {
      offsetWidth: 200,
      classList: {
        contains(value) { return value === 'open'; },
        remove(value) { removedClasses.push(value); },
        add(value) { removedClasses.push(`add:${value}`); }
      }
    }
  };
  const readySnapshot = options.snapshot || {
    room: {
      code: 'TEST',
      members: {
        'qa-player': {
          actionRequest: { status: 'ability-attack-ready', stage: 'waiting-attack-roll' }
        }
      }
    }
  };
  const applySnapshot = options.applySnapshot || {
    room: {
      code: 'TEST',
      members: { 'qa-player': { actionRequest: { status: 'resolved', resultText: '3 урона' } } },
      combat: { order: [{ key: 'token:qa-rat', hp: 7, hpMax: 10 }] }
    }
  };
  const localApi = {
    active: () => true,
    prepareCombatAbilityRoll(uid, targetKey, phase, forceHit) {
      calls.push({ uid, targetKey, phase, forceHit });
      if (options.apiError) throw options.apiError;
      return Promise.resolve(readySnapshot);
    },
    resolveCombatAbility(uid, targetKeys, resolveOptions) {
      calls.push({ kind: 'resolve', uid, targetKeys: Array.from(targetKeys), resolveOptions });
      if (options.resolveError) throw options.resolveError;
      return Promise.resolve(applySnapshot);
    }
  };
  const request = options.request || {
    actionKind: 'ability',
    status: 'ability-damage-result',
    abilityResolution: { targetKey: 'token:qa-rat' }
  };
  const currentRoom = options.currentRoom || {
    code: 'TEST',
    members: { 'qa-player': { actionRequest: request } }
  };
  const context = {
    Promise,
    setTimeout(callback, timeout) {
      if (options.deadlineError) throw options.deadlineError;
      return setTimeout(callback, timeout);
    },
    clearTimeout,
    w: {
      ZargotaCombatQa: localApi,
      ZargotaRooms: {
        prepareCombatAbilityRoll() {
          throw new Error('Workshop click incorrectly reached the live Firebase API');
        }
      },
      zgAbilityResolveOpen(uid, preserve) {
        opens.push({ uid, preserve });
        if (options.firstRenderError && opens.length === 1) throw options.firstRenderError;
      },
      zgAbilityResolveClose() { closes.push(true); },
      zgLocalCombatQaActive() { return options.localHandoff === true; },
      showToast(message) { toasts.push(message); },
      console: { error() { errors.push(Array.from(arguments)); } }
    },
    abilityResolveUid: 'qa-player',
    abilityResolveTargets: ['token:qa-rat'],
    abilityResolveBusy: false,
    abilityResolveRollToken: 0,
    abilityResolveError: '',
    abilityResolveOutcomeOverride: null,
    abilityResolveDamageOverride: null,
    abilityResolveStatusOverrides: [],
    abilityResolveDraft: { damageType: 'fire' },
    abilityResolvePreview: {
      results: [{
        key: 'token:qa-rat', roll: 9, rolls: [9], rollMode: 'normal', modifier: 2,
        total: 11, dc: 11, success: true, damage: 3, damageRolls: [3], statuses: ['burn']
      }]
    },
    roomSnapshot: { room: currentRoom },
    abilityCommitPendingStatusSelection() { return false; },
    collectAbilityDraft() {
      if (options.draftError) throw options.draftError;
    },
    roomState(snapshot) { snapshots.push(snapshot); },
    el(id) { return nodes[id] || null; }
  };
  vm.runInNewContext(`${helperSource}\n${handlerSource}\n${applyHandlerSource}`, context, { filename: 'workshop-spell-roll-handler.js' });
  return { context, calls, opens, toasts, errors, snapshots, closes, readySnapshot, applySnapshot, nodes, removedClasses };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

(async function run() {
  const stageContext = { String, Number, Math };
  vm.runInNewContext(stageUiSource, stageContext, { filename: 'workshop-spell-request-stages.js' });
  const ability = { damageFormula: '1d6' };
  const pendingStage = stageContext.abilityRequestStageUi({ status: 'pending', ability });
  const waitingAttackStage = stageContext.abilityRequestStageUi({ status: 'ability-attack-ready', ability });
  const hitStage = stageContext.abilityRequestStageUi({ status: 'ability-attack-result', ability, abilityResolution: { attack: { roll: 14, modifier: 2, total: 16, dc: 11, success: true } } });
  const missStage = stageContext.abilityRequestStageUi({ status: 'ability-attack-result', ability, abilityResolution: { attack: { roll: 4, modifier: 2, total: 6, dc: 11, success: false } } });
  const waitingDamageStage = stageContext.abilityRequestStageUi({ status: 'ability-damage-ready', ability });
  const damageResultStage = stageContext.abilityRequestStageUi({ status: 'ability-damage-result', ability, abilityResolution: { damage: { rolls: [5], rolledTotal: 5, damage: 5 } } });
  assert.deepStrictEqual(Array.from([pendingStage, waitingAttackStage, hitStage, waitingDamageStage, damageResultStage], (stage) => stage.action), ['Начать розыгрыш','Открыть этап d20','Назначить 1D6','Открыть этап 1D6','Проверить и применить'], 'the GM request button must name the actual spell stage instead of always saying Play');
  assert.match(hitStage.detail, /d20 14 \+ 2 = 16 против КД 11/, 'the hit card must explain the actual attack result to the GM');
  assert.match(missStage.title, /Промах/, 'a miss must be visibly distinguished before the GM opens the verdict');
  assert.match(waitingAttackStage.detail, /уже назначен/, 'the waiting card must warn the GM not to assign the d20 again');
  assert.match(waitingDamageStage.detail, /HP цели ещё не изменены/, 'the damage waiting card must explain that no damage has been applied yet');
  assert.match(damageResultStage.detail, /5 урона/, 'the final card must expose the rolled damage before application');
  assert.match(requestCardSource, /abilityRequestStageUi\(request\)/, 'the live request card must render from the staged UI model');
  assert.match(requestCardSource, /play\.textContent=stage\.action/, 'the live request button must be updated after each synchronized state change');

  const qaDistanceContext = { isFinite, Math, Number, String, Array };
  vm.runInNewContext(`${qaDistanceSource}\nresult=combatQaAbilityDistance({boardWidth:32,boardHeight:20,tokens:[{id:'actor-token',x:50,y:50},{id:'target-token',x:53,y:50}]},{tokenId:'actor-token'},{tokenId:'target-token'});`, qaDistanceContext, { filename: 'workshop-spell-distance.js' });
  assert.strictEqual(qaDistanceContext.result, 1, 'the Workshop API must calculate one-cell range from its own TEST-scene tokens');
  assert.match(qaPrepareSource, /combatQaAbilityDistance\(room\.scene\|\|\{\},actor,target\)/, 'the real Workshop API must use a helper from its own module');
  assert.doesNotMatch(qaPrepareSource, /abilityCellDistance|abilityEntryToken/, 'the real Workshop API must not reference private helpers from the verdict module');
  assert.match(qaResolveSource, /map\(combatQaNormalizeStatusKey\)/, 'the final Workshop apply must normalize effects through a helper in its own module');
  assert.doesNotMatch(qaResolveSource, /map\(normalizeStatusDisplayKey\)/, 'the final Workshop apply must not reference a private helper from another module');
  assert.doesNotMatch(handlerSource, /combatStartDeadline/, 'the staged spell verdict must not reference the private combat-module deadline helper');
  assert.match(handlerSource, /function abilityResolveDeadline/, 'the staged spell verdict must own its timeout and unlock lifecycle');
  assert.match(automatedVerdictSource, /Перейти к броску d20/, 'a reopened Workshop verdict must offer the assigned d20 instead of a dead grey button');
  assert.match(automatedVerdictSource, /Перейти к броску d6/, 'the Workshop damage stage must offer the assigned d6 instead of a dead grey button');
  assert.match(automatedVerdictSource, /onclick="zgAbilityResolveSubmit\(\)"/, 'the final confirmation button must call the tested apply handler');
  assert.match(effectPlanSource, /id="zg-spell-extra-status-select" onchange="zgAbilityExtraStatusAdd\(\)"/, 'choosing an extra GM status must immediately add it to the final result');
  assert.match(automatedVerdictSource, /data-ability-target="'\+esc\(entry\.key\)\+'" onclick="zgAbilityResolveTarget\(this\.dataset\.abilityTarget\)"/, 'target buttons must pass opaque combat keys through data attributes');
  assert.doesNotMatch(automatedVerdictSource, /onclick="zgAbilityResolveTarget\('\+JSON\.stringify\(entry\.key\)\+'\)"/, 'quoted combat keys must never be embedded into an inline handler');
  assert.match(openHandlerSource, /requestedTargetTokenId=request\.target&&String\(request\.target\.tokenId\|\|''\)/, 'the verdict must map the token selected by the player back to its combat participant key');
  assert.match(openHandlerSource, /requestedTargetKey=String\(request\.abilityResolution&&request\.abilityResolution\.targetKey\|\|request\.target&&request\.target\.targetKey/, 'an empty staged resolution must fall through to the target chosen by the player');
  assert.doesNotMatch(openHandlerSource, /request\.abilityResolution&&String\(request\.abilityResolution\.targetKey/, 'a missing staged target must not become the truthy string "undefined"');
  assert.doesNotMatch(applyHandlerSource, /\bstate&&state\.room\b/, 'the final apply handler must not read the combat module private state variable');
  assert.match(applyHandlerSource, /abilityCommitPendingStatusSelection\(\)/, 'final confirmation must retain the currently selected status even if the select change event was interrupted');

  const happy = makeContext();
  happy.context.w.zgAbilityPrepareRoll('attack');
  await flush();

  assert.deepStrictEqual(happy.calls, [{
    uid: 'qa-player',
    targetKey: 'token:qa-rat',
    phase: 'attack',
    forceHit: false
  }], 'the Workshop button must assign one d20 stage to the selected target');
  assert.strictEqual(happy.snapshots[0], happy.readySnapshot, 'the prepared TEST snapshot must become current UI state');
  assert.strictEqual(happy.context.abilityResolveBusy, false, 'the GM verdict must unlock after the assignment');
  assert.strictEqual(happy.context.abilityResolveRollToken, 0, 'the completed assignment must clear its operation token');
  assert.strictEqual(happy.opens.length, 2, 'the verdict must show busy state and then the waiting-for-d20 state');
  assert.ok(happy.toasts.includes('Игроку назначен бросок d20'), 'the GM must receive assignment confirmation');

  const handoff = makeContext({ localHandoff: true });
  handoff.context.w.zgAbilityPrepareRoll('attack');
  await flush();
  assert.strictEqual(handoff.opens.length, 1, 'the Workshop verdict must not reopen over the assigned player die');
  assert.ok(handoff.removedClasses.includes('open'), 'the Workshop verdict closes after the d20 is assigned');
  assert.strictEqual(handoff.nodes['zg-ability-area-layer'].innerHTML, '', 'the spell targeting preview must release the board before the drag');
  assert.ok(handoff.removedClasses.includes('add:handoff'), 'the assigned player die receives a visible handoff animation');
  assert.ok(handoff.toasts.includes('Бросок назначен · перетащите d20'), 'the local GM receives an actionable drag instruction');

  const renderFailure = makeContext({ firstRenderError: new Error('heavy verdict render failed') });
  renderFailure.context.w.zgAbilityPrepareRoll('attack');
  await flush();
  assert.strictEqual(renderFailure.calls.length, 1, 'a presentation failure must not prevent the Workshop API call');
  assert.strictEqual(renderFailure.snapshots[0], renderFailure.readySnapshot, 'the d20 assignment must still update the QA snapshot after a render failure');
  assert.strictEqual(renderFailure.context.abilityResolveBusy, false, 'a presentation failure must not leave the d20 button grey');
  assert.strictEqual(renderFailure.opens.length, 2, 'the handler retries the verdict after the snapshot is accepted');
  assert.strictEqual(renderFailure.errors.length, 1, 'the recoverable presentation failure is logged once');

  const syncFailure = makeContext({ apiError: new Error('QA assignment rejected') });
  syncFailure.context.w.zgAbilityPrepareRoll('attack');
  await flush();
  assert.strictEqual(syncFailure.context.abilityResolveBusy, false, 'a synchronous QA error must unlock the d20 button');
  assert.strictEqual(syncFailure.context.abilityResolveRollToken, 0, 'a synchronous QA error must clear its operation token');
  assert.strictEqual(syncFailure.context.abilityResolveError, 'QA assignment rejected', 'the synchronous QA error must remain visible in the verdict');
  assert.ok(syncFailure.toasts.includes('QA assignment rejected'), 'the GM must see why the assignment failed');

  const deadlineFailure = makeContext({ deadlineError: new Error('deadline setup failed') });
  deadlineFailure.context.w.zgAbilityPrepareRoll('attack');
  await flush();
  assert.strictEqual(deadlineFailure.context.abilityResolveBusy, false, 'a deadline setup failure must unlock the d20 button');
  assert.strictEqual(deadlineFailure.context.abilityResolveError, 'deadline setup failed', 'deadline failures must be shown instead of leaving a grey button');

  const applyHappy = makeContext();
  const applyResult = await applyHappy.context.w.zgAbilityResolveSubmit();
  const applyCall = applyHappy.calls.find((call) => call.kind === 'resolve');
  assert.ok(applyCall, 'the final confirmation click must call the Workshop resolve API');
  assert.deepStrictEqual(applyCall.targetKeys, ['token:qa-rat'], 'the final confirmation must preserve the selected target');
  assert.strictEqual(applyCall.resolveOptions.approvedResults[0].damage, 3, 'the GM-approved damage must reach the apply API');
  assert.deepStrictEqual(Array.from(applyCall.resolveOptions.approvedResults[0].statuses), ['burn'], 'the GM-approved effects must reach the apply API');
  assert.strictEqual(applyResult, applyHappy.applySnapshot, 'the click promise must resolve with the applied TEST snapshot');
  assert.strictEqual(applyHappy.snapshots[0], applyHappy.applySnapshot, 'the applied HP snapshot must become current UI state');
  assert.strictEqual(applyHappy.context.abilityResolveBusy, false, 'the final confirmation must unlock after application');
  assert.strictEqual(applyHappy.closes.length, 1, 'the verdict must close only after HP and effects are applied');
  assert.ok(applyHappy.toasts.includes('Урон и эффекты применены · заявка завершена'), 'the GM must receive an explicit completion message');

  const applyRenderFailure = makeContext({ firstRenderError: new Error('busy verdict render failed') });
  await applyRenderFailure.context.w.zgAbilityResolveSubmit();
  assert.strictEqual(applyRenderFailure.calls.filter((call) => call.kind === 'resolve').length, 1, 'a busy-state render failure must not swallow the final apply click');
  assert.strictEqual(applyRenderFailure.snapshots[0], applyRenderFailure.applySnapshot, 'the final apply must still update HP after a presentation failure');
  assert.strictEqual(applyRenderFailure.context.abilityResolveBusy, false, 'a presentation failure must never leave the final button grey');
  assert.strictEqual(applyRenderFailure.errors.length, 1, 'the recoverable apply render failure is logged once');

  const applyFailure = makeContext({ resolveError: new Error('QA apply rejected') });
  const failedResult = await applyFailure.context.w.zgAbilityResolveSubmit();
  assert.strictEqual(failedResult, false, 'a rejected apply operation must be reported as unsuccessful');
  assert.strictEqual(applyFailure.context.abilityResolveBusy, false, 'a rejected apply operation must unlock the final button');
  assert.strictEqual(applyFailure.context.abilityResolveError, 'QA apply rejected', 'the rejection reason must remain visible in the verdict');
  assert.ok(applyFailure.toasts.some((message) => /кнопка снова доступна/.test(message)), 'the GM must be told that retry is available');

  const doubleApply = makeContext();
  const firstApply = doubleApply.context.w.zgAbilityResolveSubmit();
  const secondApply = doubleApply.context.w.zgAbilityResolveSubmit();
  assert.strictEqual(secondApply, false, 'a second click while applying must be ignored explicitly');
  await firstApply;
  assert.strictEqual(doubleApply.calls.filter((call) => call.kind === 'resolve').length, 1, 'double-clicking must never apply spell damage twice');

  const realQaSnapshot = {
    room: {
      members: {
        'qa-player': {
          actionRequest: {
            id: 'qa-ability-request',
            actionKind: 'ability',
            status: 'ability-damage-result',
            name: "Лин'Ин",
            ability: {
              automationKey: 'finger-heat-v1', name: 'Жар Пальцев', actionCost: 'long',
              damageFormula: '1d6', damageType: 'fire', resourceMax: 1, resourceUsed: 0
            },
            abilityResolution: {
              targetKey: 'token:qa-rat',
              attack: { roll: 18, modifier: 2, total: 20, dc: 10, success: true },
              damage: { rolls: [6], rolledTotal: 6, damage: 6 }
            }
          }
        }
      },
      combat: {
        active: true,
        order: [
          { key: 'member:qa-player', uid: 'qa-player', name: "Лин'Ин", economy: { long: 1, short: 1, reaction: 1 } },
          { key: 'token:qa-rat', tokenId: 'qa-rat', name: 'QA Крыса', hp: 12, hpMax: 12, tempHp: 0, statuses: [] }
        ]
      },
      scene: { tokens: [{ id: 'qa-rat', name: 'QA Крыса', hp: 12, hpMax: 12, tempHp: 0, statuses: [], statusEffects: [] }] }
    }
  };
  const realQaContext = {
    Promise, Date, Math, Number, String, Array, Object,
    w: {
      ZargotaSpellAutomation: { prescribedStatusKeys() { return []; } },
      zgGmStatusCatalog() { return [{ key: 'burn', label: 'Горит' }]; }
    },
    combatQaApply(change) { change(realQaSnapshot); return Promise.resolve(realQaSnapshot); },
    combatQaRollFormula() { return { total: 1, rolls: [1], formula: '1d6' }; },
    combatQaSyncZeroHp() {}
  };
  const qaResolveMethod = qaResolveSource.trim().replace(/,$/, '');
  vm.runInNewContext(`${qaSyncTargetSource}\n${qaNormalizeSource}\napi={${qaResolveMethod}};`, realQaContext, { filename: 'workshop-real-final-apply.js' });
  const realQaResult = await realQaContext.api.resolveCombatAbility('qa-player', ['token:qa-rat'], {
    approvedResults: [{ key: 'token:qa-rat', roll: 18, rolls: [18], modifier: 2, total: 20, dc: 10, success: true, damage: 6, damageRolls: [6], statuses: ['burn'] }]
  });
  const realActor = realQaResult.room.combat.order[0];
  const realTarget = realQaResult.room.combat.order[1];
  const realRequest = realQaResult.room.members['qa-player'].actionRequest;
  assert.strictEqual(realTarget.hp, 6, 'the real Workshop final apply must change target HP exactly once');
  assert.strictEqual(realActor.economy.long, 0, 'the real Workshop final apply must spend the long action');
  assert.strictEqual(realRequest.ability.resourceUsed, 1, 'the real Workshop final apply must spend the spell charge');
  assert.strictEqual(realRequest.status, 'resolved', 'the real Workshop final apply must close the staged request');
  assert.deepStrictEqual(Array.from(realTarget.statuses), ['burn'], 'the real Workshop final apply must retain canonical spell effects');
  assert.deepStrictEqual(Array.from(realQaResult.room.scene.tokens[0].statuses), ['burn'], 'the real Workshop final apply must synchronize the approved status to the visible scene token');
  assert.strictEqual(realQaResult.room.combatEvent.damage, 6, 'the real Workshop final apply must publish the approved damage result');
  assert.strictEqual(realQaResult.room.combatEvent.ability, 'Жар Пальцев', 'the public combat event must identify the cast spell');
  assert.match(realQaResult.room.combatEvent.text, /Лин'Ин применяет «Жар Пальцев»/, 'everyone must receive a public cast announcement with the caster and spell name');
  assert.match(realQaResult.room.combatEvent.text, /QA Крыса: попадание · 6 урона · Горит/, 'the public cast announcement must include target, outcome, damage, and applied status');

  console.log('Workshop staged spell roll assignment, final apply, and unlock recovery passed');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
