const assert = require('assert');
const playback = require('../combat-playback.js');

let clock = 1000;
let activeTimer = null;
let timerCreates = 0;
const director = playback.createDirector({
  now: () => clock,
  setTimer: (callback, delay) => {
    timerCreates += 1;
    activeTimer = {callback, at: clock + delay};
    return timerCreates;
  },
  clearTimer: () => { activeTimer = null; }
});

const event = {id:'damage-1',kind:'combat-damage',ts:1000,revealAt:2000};
const cues = [];
assert.strictEqual(director.schedule(event, 'presentation-reveal', 2020, () => cues.push('reveal'), {lane:'combat-presentation',replaceLane:true}), true);
assert.strictEqual(director.schedule(event, 'presentation-reveal', 2020, () => cues.push('duplicate'), {lane:'combat-presentation',replaceLane:true}), false, 'same event cue is scheduled once without cancelling its pending reveal');
assert.strictEqual(director.pendingCount(), 1);
assert.ok(activeTimer, 'director owns one wake-up timer');

clock = 2020;
activeTimer.callback();
assert.deepStrictEqual(cues, ['reveal']);
assert.strictEqual(director.pendingCount(), 0);

const next = {id:'damage-2',kind:'combat-damage',ts:2020,revealAt:3000};
const latest = {id:'damage-3',kind:'combat-damage',ts:2020,revealAt:3100};
director.schedule(next, 'presentation-reveal', 3020, () => cues.push('old'), {lane:'combat-presentation',replaceLane:true});
director.schedule(latest, 'presentation-reveal', 3120, () => cues.push('latest'), {lane:'combat-presentation',replaceLane:true});
assert.strictEqual(director.pendingCount(), 1, 'new Firebase event replaces the obsolete reveal in the same lane');
clock = 3120;
activeTimer.callback();
assert.deepStrictEqual(cues, ['reveal','latest']);

const diagnostics = director.snapshot();
assert.strictEqual(diagnostics.executed, 2);
assert.strictEqual(diagnostics.cancelled, 1);
assert.strictEqual(diagnostics.duplicates, 1);
assert.strictEqual(playback.normalizeMotionMode('unknown'), 'anchored');

director.reset();
clock = 5000;
const ordered = [];
const planned = director.scheduleTimeline(
  {id:'damage-plan',kind:'combat-damage',targetKey:'enemy',damageRolls:[4],ts:5000,revealAt:6000},
  {result:() => ordered.push('result'),impact:() => ordered.push('impact'),audio:() => ordered.push('audio')},
  {lanePrefix:'primary-combat'}
);
assert.strictEqual(planned.scheduled, 3);
assert.strictEqual(director.pendingCount(), 3);
clock = 6000;
activeTimer.callback();
assert.deepStrictEqual(ordered, ['result','impact','audio'], 'same-time cues retain the declared phase order');
assert.strictEqual(director.snapshot().maxPending, 3, 'diagnostics record peak queue pressure');
assert.strictEqual(director.snapshot().lateCues, 0);

director.schedule({id:'late-cue',kind:'combat-action',ts:6000}, 'result', 6100, () => ordered.push('late'));
clock = 6200;
activeTimer.callback();
assert.strictEqual(director.snapshot().lateCues, 1, 'a delayed browser wake-up is observable');
assert.strictEqual(director.snapshot().maxCueLatenessMs, 100);

const rejected = director.scheduleTimeline({id:'broken-plan',kind:'combat-damage',ts:7000,revealAt:6500}, {result:() => ordered.push('broken')});
assert.strictEqual(rejected.scheduled, 0);
assert.strictEqual(director.snapshot().invalid, 1);

director.schedule({id:'disconnect-a',kind:'combat-action',ts:7000}, 'result', 7200, () => ordered.push('disconnect-a'));
director.schedule({id:'disconnect-b',kind:'combat-action',ts:7000}, 'result', 7300, () => ordered.push('disconnect-b'));
assert.strictEqual(director.cancelAll('reconnect'), 2, 'reconnect clears every pending cue with one timer shutdown');
assert.strictEqual(director.pendingCount(), 0);
assert.strictEqual(activeTimer, null);

console.log('combat playback director passed');
