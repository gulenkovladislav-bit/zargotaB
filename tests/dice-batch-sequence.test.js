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

const addStart = dice.indexOf('function freeRollDiceMixBlocked(sides)');
const addEnd = dice.indexOf('function clearSelectedDice()', addStart);
const notices = [];
const selectionContext = {
  MAX_DICE_BATCH: 12,
  freeRollMode: false,
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
assert.equal(selectionContext.selectedDice['20'], 1, 'ordinary d20 selection is limited to one die');
assert.equal(selectionContext.removeSelectedDieRef(20), true, 'right-click removal accepts a selected die');
assert.equal(selectionContext.selectedDice['20'], undefined, 'removing the last die clears its selected state');
assert.equal(selectionContext.removeSelectedDieRef(20), false, 'right click on an unselected die is a harmless no-op');
selectionContext.selectedDice = {};
selectionContext.freeRollMode = true;
assert.equal(selectionContext.addSelectedDieRef(20), true, 'a free d20 can be selected on its own');
assert.equal(selectionContext.addSelectedDieRef(6), false, 'damage dice cannot be mixed into a selected free d20');
assert.equal(selectionContext.selectedDice['20'], 1, 'the rejected damage die leaves the selected d20 intact');
assert.equal(selectionContext.selectedDice['6'], undefined, 'the rejected damage die is not added');
selectionContext.selectedDice = {};
assert.equal(selectionContext.addSelectedDieRef(6), true, 'a free damage die can be selected on its own');
assert.equal(selectionContext.addSelectedDieRef(20), false, 'a d20 cannot be mixed into selected free damage dice');
assert.equal(selectionContext.selectedDice['6'], 1, 'the rejected d20 leaves existing damage dice intact');
assert.equal(selectionContext.selectedDice['20'], undefined, 'the rejected d20 is not added');
assert.ok(notices.some(message => /d20 кидается отдельно/.test(message)), 'the incompatible free-roll mix explains why it was rejected');
selectionContext.freeRollMode = false;
assert.match(dice, /var isFreeRoll=freeRollMode,d20Included=false;sidesList=.*?\.filter\(function\(sides\)/, 'the throw boundary removes repeated ordinary d20 values defensively');
assert.match(dice, /isFreeRoll&&sidesList\.some[\s\S]*?Number\(sides\)===20[\s\S]*?sidesList\.some[\s\S]*?Number\(sides\)!==20/, 'the throw boundary defensively rejects a mixed free d20 batch');
assert.match(dice, /count>0&&!singleD20\?String\(count\):''/, 'the single d20 does not display a misleading quantity badge');
assert.match(dice, /contextmenu[\s\S]*?\.zg-dice-row button\[data-die\][\s\S]*?removeSelectedDie/, 'right click is routed from a die texture to decrement logic');
assert.match(dice, /ЛКМ добавить · ПКМ убрать/, 'the palette explains both mouse controls');

const scoreKindStart = dice.indexOf('function dicePanelScoreKind(rolls,isFreeRoll)');
const scoreKindEnd = dice.indexOf('function animateRoll(', scoreKindStart);
const scoreKindContext = { Array, Number };
vm.runInNewContext(`${dice.slice(scoreKindStart, scoreKindEnd)};dicePanelScoreKindRef=dicePanelScoreKind;`, scoreKindContext);
assert.equal(scoreKindContext.dicePanelScoreKindRef([{ sides: 4 }, { sides: 4 }, { sides: 4 }], true), 'damage', 'Plan B damage dice use Huge Tom semantics');
assert.equal(scoreKindContext.dicePanelScoreKindRef([{ sides: 20 }], true), 'normal', 'a free d20 remains a check-style roll');
assert.equal(scoreKindContext.dicePanelScoreKindRef([{ sides: 6 }], false), 'normal', 'the ordinary palette does not silently relabel a roll as damage');

assert.match(render, /function shuffledDiceTotalEntries\(rolls\)/, 'the count builds a randomized die order');
assert.match(render, /Math\.floor\(Math\.random\(\)\*\(i\+1\)\)/, 'the order uses a Fisher-Yates shuffle');
assert.match(render, /function launchNextTotalNumber\(\)/, 'one recursive sequence owns number flights');
assert.match(render, /function launchDiceTotalNumber\(die,totalNode,text,flightDuration,onArrive,resultLayer\)/, 'one shared helper owns flights into the final result');
assert.match(render, /setTimeout\(function\(\)\{if\(flight\.parentNode\)flight\.remove\(\);onArrive\(\);\},flightDuration\)/, 'the next addition waits until the current number reaches the total');
assert.match(render, /flightHost\.appendChild\(flight\)/, 'number flights stay inside the scene-bound result layer');
assert.match(render, /flightHost\.appendChild\(flight\);die\.classList\.add\('number-counted'\)/, 'the original face number disappears in the same step that launches its flying copy');
assert.match(html, /\.zg-token-roll\.number-counted b\{opacity:0!important/, 'a counted die keeps its texture but no longer repeats the transferred number');
assert.match(render, /else setTimeout\(launchNextTotalNumber,flightGap\)/, 'only one number is launched after the previous arrival');
assert.match(render, /else if\(isContest\)[\s\S]*?launchDiceTotalNumber\(contestDie,totalNode,contestRoll\.value/, 'the kept advantage or disadvantage face flies into the final total');
assert.match(render, /scoreFx\.step\(roll\.id,sequenceIndex,running,entry\.value\)/, 'sound and particles follow the randomized counting order');
assert.match(render, /function diceTotalSequenceTiming\(index,count,isDamage\)/, 'batch size, sequence progress and damage semantics own the counting tempo');
assert.match(render, /function diceTotalFinalDelay\(settleDelay,isContest,count,isDamage,hidden\)/, 'one helper predicts the exact visual impact frame for final audio');
assert.match(render, /function diceTotalDisplayLifetime\(rollLifetime,finalDelayMs,extendOrdinary\)/, 'ordinary result digits own a separate post-impact lifetime');
assert.match(render, /timing=diceTotalSequenceTiming\(sequenceIndex,totalEntries\.length,roll\.scoreKind==='damage'\)/, 'every damage number flight receives its softer progressive timing');
assert.match(render, /rollLifetime=isContest\?baseRollLifetime:Math\.max\(baseRollLifetime,settleDelay\+620\+rolls\.length\*360\+900\)/, 'large batches remain visible through the slower opening and later acceleration');
assert.match(html, /animation:zgRollNumberFlight var\(--number-flight-duration,\.62s\)/, 'each number flight has a controllable synchronized duration');

const shuffleEnd = html.indexOf('  function renderRollAnimations()', renderStart);
const shuffleSource = html.slice(renderStart, shuffleEnd);
const context = { Array, Number, Math: Object.create(Math) };
const randomValues = [0, 0.25, 0.75, 0.1, 0.6, 0.35, 0.9, 0.2, 0.8, 0.45, 0.7];
let randomIndex = 0;
context.Math.random = () => randomValues[randomIndex++ % randomValues.length];
vm.runInNewContext(`${shuffleSource};shuffled=shuffledDiceTotalEntries(Array.from({length:12},(_,index)=>({value:index+1,total:index+1})));firstTiming=diceTotalSequenceTiming(0,12);secondTiming=diceTotalSequenceTiming(1,12);thirdTiming=diceTotalSequenceTiming(2,12);fourthTiming=diceTotalSequenceTiming(3,12);middleTiming=diceTotalSequenceTiming(5,12);lastTiming=diceTotalSequenceTiming(11,12);damageFirstTiming=diceTotalSequenceTiming(0,12,true);damageSecondTiming=diceTotalSequenceTiming(1,12,true);damageLastTiming=diceTotalSequenceTiming(11,12,true);damageFinalDelay=diceTotalFinalDelay(1580,false,12,true,false);contestFinalDelay=diceTotalFinalDelay(2133,true,2,false,false);contestTimeline=diceContestTimeline(1580,2);contestHighRank=diceContestRevealRank([{value:4},{value:17}],1);contestLowRank=diceContestRevealRank([{value:4},{value:17}],0);ordinaryDisplayLifetime=diceTotalDisplayLifetime(5100,2373,true);criticalDisplayLifetime=diceTotalDisplayLifetime(5100,2373,false);singleTiming=diceTotalSequenceTiming(0,1);smallFirstTiming=diceTotalSequenceTiming(0,3);smallLastTiming=diceTotalSequenceTiming(2,3);`, context);
const indices = Array.from(context.shuffled, entry => entry.index);
assert.deepEqual(indices.slice().sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index), 'random ordering keeps every die exactly once');
assert.notDeepEqual(indices, Array.from({ length: 12 }, (_, index) => index), 'the deterministic shuffle demonstrates non-simultaneous random order');
assert.deepEqual({ duration: context.firstTiming.duration, gap: context.firstTiming.gap }, { duration: 400, gap: 70 }, 'a large batch starts at a calm readable speed');
assert.ok(context.secondTiming.duration < context.firstTiming.duration && context.secondTiming.gap < context.firstTiming.gap, 'smooth acceleration is already perceptible on the second addition');
assert.ok(context.thirdTiming.duration < context.secondTiming.duration && context.fourthTiming.duration < context.thirdTiming.duration, 'every early addition becomes progressively faster without a threshold jump');
assert.ok(context.middleTiming.duration < context.fourthTiming.duration && context.middleTiming.gap < context.fourthTiming.gap, 'later additions continue the same acceleration curve');
assert.deepEqual({ duration: context.lastTiming.duration, gap: context.lastTiming.gap }, { duration: 160, gap: 14 }, 'the twelfth die receives the strongest gradual acceleration');
assert.deepEqual({ duration: context.damageFirstTiming.duration, gap: context.damageFirstTiming.gap }, { duration: 400, gap: 70 }, 'damage counting keeps the same calm first addition');
assert.deepEqual({ duration: context.damageLastTiming.duration, gap: context.damageLastTiming.gap }, { duration: 280, gap: 42 }, 'damage acceleration spans exactly half the previous speed range');
assert.ok(context.damageSecondTiming.duration < context.damageFirstTiming.duration && context.damageSecondTiming.duration > context.secondTiming.duration, 'damage still accelerates from the second die but with a softer step');
let expectedDamageFinalDelay = 1580 + 300 + 93;
for (let index = 0; index < 12; index += 1) {
  const timing = context.diceTotalSequenceTiming ? context.diceTotalSequenceTiming(index, 12, true) : null;
  expectedDamageFinalDelay += timing ? timing.duration + (index < 11 ? timing.gap : 0) : 0;
}
assert.equal(context.damageFinalDelay, expectedDamageFinalDelay, 'final sound timing includes every visible number flight and gap');
assert.equal(context.contestHighRank, 0, 'the larger contest d20 reveals first regardless of which die was thrown first');
assert.equal(context.contestLowRank, 1, 'the smaller contest d20 waits for the second reveal beat');
assert.deepEqual({ revealGap:context.contestTimeline.revealGap, lastRevealDelay:context.contestTimeline.lastRevealDelay, resolveDelay:context.contestTimeline.resolveDelay, totalLaunchDelay:context.contestTimeline.totalLaunchDelay }, { revealGap:620, lastRevealDelay:2200, resolveDelay:2720, totalLaunchDelay:3770 }, 'contest reveal owns a slower readable suspense timeline');
assert.equal(context.contestFinalDelay, 4816, 'advantage and disadvantage final audio follows the later kept-number impact frame');
assert.equal(context.ordinaryDisplayLifetime, 5918, 'an ordinary result digit remains visible thirty percent longer after its impact');
assert.equal(context.criticalDisplayLifetime, 5100, 'critical outcomes retain their dedicated lifetime unchanged');
assert.deepEqual({ duration: context.singleTiming.duration, gap: context.singleTiming.gap }, { duration: 400, gap: 70 }, 'a single die remains readable instead of receiving batch acceleration');
assert.ok(context.smallLastTiming.duration < context.smallFirstTiming.duration && context.smallLastTiming.duration > context.lastTiming.duration, 'small batches accelerate gently rather than reaching the large-batch extreme');

console.log('twelve-die batch and sequential random total passed');
