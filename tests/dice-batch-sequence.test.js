'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');
const diceStart = html.indexOf('//   КУБИК СНИЗУ');
const diceEnd = html.indexOf('// ═══════════════════════════════════════════════════════════════════', diceStart + 80);
const dice = html.slice(diceStart, diceEnd);
const renderStart = html.indexOf('  function shuffledDiceTotalEntries(rolls)');
const renderEnd = html.indexOf('  w.zgRenderLocalDiceThrow=', renderStart);
const render = html.slice(renderStart, renderEnd);

assert.ok(diceStart >= 0 && diceEnd > diceStart, 'dice palette remains extractable');
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'dice total renderer remains extractable');
assert.match(dice, /var MAX_DICE_BATCH=12;/, 'the palette exposes one twelve-die limit');
assert.match(dice, /sidesList\.slice\(0,MAX_DICE_BATCH\)/, 'the local batch producer keeps all twelve dice');
assert.match(dice, /diceDrag\.held=held\.slice\(0,MAX_DICE_BATCH\)/, 'the drag ghost carries the same complete batch');
assert.match(dice, /spacing=Math\.min\(22,148\/Math\.max\(1,diceDrag\.held\.length-1\)\)/, 'the drag fan expands for dense twelve-die textures');
assert.match(dice, /За один бросок можно выбрать до '\+MAX_DICE_BATCH\+' кубиков/, 'selection beyond twelve gives a clear limit notice');
assert.match(network, /beginRollBatch:[\s\S]*?slice\(0, 12\)\.map/, 'Firebase transports all twelve dice instead of truncating the batch');

const addStart = dice.indexOf('function addSelectedDie(sides)');
const addEnd = dice.indexOf('function clearSelectedDice()', addStart);
const notices = [];
const selectionContext = {
  MAX_DICE_BATCH: 12,
  selectedDice: {},
  Object,
  Number,
  w: { showToast(message) { notices.push(message); } },
  updateDiceSelection() {}
};
selectionContext.document = { addEventListener() {} };
vm.runInNewContext(`${dice.slice(addStart, addEnd)};addSelectedDieRef=addSelectedDie;removeSelectedDieRef=removeSelectedDie;`, selectionContext);
for (let index = 0; index < 12; index += 1) selectionContext.addSelectedDieRef(6);
assert.equal(selectionContext.selectedDice['6'], 12, 'one texture type can be selected twelve times');
assert.equal(selectionContext.addSelectedDieRef(4), false, 'a thirteenth mixed die is rejected');
assert.match(notices[0], /до 12 кубиков/, 'the rejected thirteenth die explains the limit');
selectionContext.selectedDice = {};
for (let index = 0; index < 12; index += 1) selectionContext.addSelectedDieRef(20);
assert.equal(selectionContext.selectedDice['20'], 12, 'd20 is no longer artificially limited to one die');
assert.equal(selectionContext.removeSelectedDieRef(20), true, 'right-click removal accepts a selected die');
assert.equal(selectionContext.selectedDice['20'], 11, 'right-click removal subtracts exactly one die');
for (let index = 0; index < 11; index += 1) selectionContext.removeSelectedDieRef(20);
assert.equal(selectionContext.selectedDice['20'], undefined, 'removing the last die clears its selected state');
assert.equal(selectionContext.removeSelectedDieRef(20), false, 'right click on an unselected die is a harmless no-op');
assert.match(dice, /contextmenu[\s\S]*?\.zg-dice-row button\[data-die\][\s\S]*?removeSelectedDie/, 'right click is routed from a die texture to decrement logic');
assert.match(dice, /ЛКМ добавить · ПКМ убрать/, 'the palette explains both mouse controls');

assert.match(render, /function shuffledDiceTotalEntries\(rolls\)/, 'the count builds a randomized die order');
assert.match(render, /Math\.floor\(Math\.random\(\)\*\(i\+1\)\)/, 'the order uses a Fisher-Yates shuffle');
assert.match(render, /function launchNextTotalNumber\(\)/, 'one recursive sequence owns number flights');
assert.match(render, /setTimeout\(function\(\)\{if\(flight\.parentNode\)flight\.remove\(\);arrive\(\);\},flightDuration\)/, 'the next addition waits until the current number reaches the total');
assert.match(render, /else setTimeout\(launchNextTotalNumber,flightGap\)/, 'only one number is launched after the previous arrival');
assert.match(render, /scoreFx\.step\(roll\.id,sequenceIndex,running,entry\.value\)/, 'sound and particles follow the randomized counting order');
assert.match(render, /function diceTotalSequenceTiming\(index,count\)/, 'batch size and sequence progress own the counting tempo');
assert.match(render, /timing=diceTotalSequenceTiming\(sequenceIndex,totalEntries\.length\)/, 'every number flight receives its progressively faster timing');
assert.match(render, /rollLifetime=isContest\?baseRollLifetime:Math\.max\(baseRollLifetime,settleDelay\+620\+rolls\.length\*317\+900\)/, 'large batches remain visible through the faster sequential count');
assert.match(html, /animation:zgRollNumberFlight var\(--number-flight-duration,\.62s\)/, 'each number flight has a controllable synchronized duration');

const shuffleEnd = html.indexOf('  function renderRollAnimations()', renderStart);
const shuffleSource = html.slice(renderStart, shuffleEnd);
const context = { Array, Number, Math: Object.create(Math) };
const randomValues = [0, 0.25, 0.75, 0.1, 0.6, 0.35, 0.9, 0.2, 0.8, 0.45, 0.7];
let randomIndex = 0;
context.Math.random = () => randomValues[randomIndex++ % randomValues.length];
vm.runInNewContext(`${shuffleSource};shuffled=shuffledDiceTotalEntries(Array.from({length:12},(_,index)=>({value:index+1,total:index+1})));firstTiming=diceTotalSequenceTiming(0,12);middleTiming=diceTotalSequenceTiming(5,12);lastTiming=diceTotalSequenceTiming(11,12);singleTiming=diceTotalSequenceTiming(0,1);`, context);
const indices = Array.from(context.shuffled, entry => entry.index);
assert.deepEqual(indices.slice().sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index), 'random ordering keeps every die exactly once');
assert.notDeepEqual(indices, Array.from({ length: 12 }, (_, index) => index), 'the deterministic shuffle demonstrates non-simultaneous random order');
assert.deepEqual({ duration: context.firstTiming.duration, gap: context.firstTiming.gap }, { duration: 280, gap: 37 }, 'a large batch starts at the readable base counting speed');
assert.ok(context.middleTiming.duration < context.firstTiming.duration && context.middleTiming.gap < context.firstTiming.gap, 'the middle of a large batch is already faster than its first die');
assert.deepEqual({ duration: context.lastTiming.duration, gap: context.lastTiming.gap }, { duration: 150, gap: 12 }, 'the twelfth die receives the strongest gradual acceleration');
assert.deepEqual({ duration: context.singleTiming.duration, gap: context.singleTiming.gap }, { duration: 280, gap: 37 }, 'a single die does not receive unnecessary acceleration');

console.log('twelve-die batch and sequential random total passed');
