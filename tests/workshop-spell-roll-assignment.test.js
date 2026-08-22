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
const handlerSource = sourceBetween('function abilityResolveSafeOpen', 'function openAbilityTargetEntity');
const qaDistanceSource = sourceBetween('function combatQaAbilityPoint', 'function combatQaApply');
const qaPrepareSource = sourceBetween('prepareCombatAbilityRoll:function', 'rollCombatAbilityStage:function');

function makeContext(options) {
  options = options || {};
  const calls = [];
  const opens = [];
  const toasts = [];
  const errors = [];
  const snapshots = [];
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
  const localApi = {
    active: () => true,
    prepareCombatAbilityRoll(uid, targetKey, phase, forceHit) {
      calls.push({ uid, targetKey, phase, forceHit });
      if (options.apiError) throw options.apiError;
      return Promise.resolve(readySnapshot);
    }
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
    roomState(snapshot) { snapshots.push(snapshot); }
  };
  vm.runInNewContext(`${helperSource}\n${handlerSource}`, context, { filename: 'workshop-spell-roll-handler.js' });
  return { context, calls, opens, toasts, errors, snapshots, readySnapshot };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

(async function run() {
  const qaDistanceContext = { isFinite, Math, Number, String, Array };
  vm.runInNewContext(`${qaDistanceSource}\nresult=combatQaAbilityDistance({boardWidth:32,boardHeight:20,tokens:[{id:'actor-token',x:50,y:50},{id:'target-token',x:53,y:50}]},{tokenId:'actor-token'},{tokenId:'target-token'});`, qaDistanceContext, { filename: 'workshop-spell-distance.js' });
  assert.strictEqual(qaDistanceContext.result, 1, 'the Workshop API must calculate one-cell range from its own TEST-scene tokens');
  assert.match(qaPrepareSource, /combatQaAbilityDistance\(room\.scene\|\|\{\},actor,target\)/, 'the real Workshop API must use a helper from its own module');
  assert.doesNotMatch(qaPrepareSource, /abilityCellDistance|abilityEntryToken/, 'the real Workshop API must not reference private helpers from the verdict module');
  assert.doesNotMatch(handlerSource, /combatStartDeadline/, 'the staged spell verdict must not reference the private combat-module deadline helper');
  assert.match(handlerSource, /function abilityResolveDeadline/, 'the staged spell verdict must own its timeout and unlock lifecycle');

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

  console.log('Workshop staged spell d20 assignment and unlock recovery passed');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
