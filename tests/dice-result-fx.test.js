'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const soundCues = [];
global.ZargotaSound = { diceScoreCue(cue) { soundCues.push(cue); } };
const fx = require('../dice-result-fx.js');

const perfectD4 = fx.grade([{ sides: 4, value: 4, total: 4 }], 4);
assert.equal(perfectD4.tier, 'perfect', 'maximum on a d4 is celebrated even in the smallest total band');
assert.equal(perfectD4.band, 1, 'a total of four remains below the first power threshold');
assert.equal(perfectD4.quality, 1, 'maximum relative quality is normalized to one');
assert.equal(perfectD4.combinationChance, 1 / 4, 'a single d4 maximum keeps its one-in-four combination chance');

const exceptionalTwoD4 = fx.grade(Array.from({ length: 2 }, () => ({ sides: 4, value: 4, total: 4 })), 8);
assert.equal(exceptionalTwoD4.tier, 'exceptional', 'two maximum d4 faces form a rarer one-in-sixteen result');
assert.equal(exceptionalTwoD4.combinationChance, 1 / 16);

const legendaryThreeD4 = fx.grade(Array.from({ length: 3 }, () => ({ sides: 4, value: 4, total: 4 })), 12);
assert.equal(legendaryThreeD4.tier, 'legendary', 'three maximum d4 faces receive the strongest rare-combination treatment');
assert.equal(legendaryThreeD4.combinationChance, 1 / 64, 'three maximum d4 faces are a one-in-sixty-four result');
assert.equal(legendaryThreeD4.surpriseBits, 6, 'one-in-sixty-four is recorded as six bits of surprise');
assert.equal(legendaryThreeD4.band, 2, 'the exact sum places twelve in the 10+ power band');
assert.ok(legendaryThreeD4.magnitude > perfectD4.magnitude, 'the exact total continuously increases visual scale');

const exceptionalD20 = fx.grade([{ sides: 20, value: 20, total: 20 }], 20);
assert.equal(exceptionalD20.tier, 'exceptional', 'a natural twenty remains rarer than a maximum on one d4');

const fiveD6 = fx.grade(Array.from({ length: 5 }, () => ({ sides: 6, value: 5, total: 5 })), 25);
assert.equal(fiveD6.tier, 'strong', 'five d6 showing five produce a strong relative result');
assert.equal(fiveD6.band, 3, 'a total of twenty-five uses the 20+ power band');
assert.ok(Math.abs(fiveD6.quality - 0.8) < 0.0001, 'quality is based on possible raw dice range');
assert.ok(fiveD6.magnitude > legendaryThreeD4.magnitude, 'twenty-five has a larger physical scale than twelve independent of rarity');

assert.equal(fx.grade([{ sides: 20, value: 10 }], 9).bandLabel, '1–9');
assert.equal(fx.grade([{ sides: 20, value: 10 }], 10).bandLabel, '10–19');
assert.equal(fx.grade([{ sides: 20, value: 10 }], 20).bandLabel, '20–29');
assert.equal(fx.grade([{ sides: 20, value: 10 }], 30).bandLabel, '30–39');
assert.equal(fx.grade([{ sides: 20, value: 10 }], 40).bandLabel, '40–49');
const might = fx.grade([{ sides: 20, value: 10 }], 50);
assert.equal(might.bandLabel, '50+');
assert.equal(might.powerLabel, 'МОГУЩЕСТВО', 'fifty and above earns a dedicated final title');
assert.equal(fx.grade([{ sides: 20, value: 10 }], 49).powerLabel, '', 'the might title starts exactly at fifty');

const modifiedLow = fx.grade([{ sides: 20, value: 2, total: 10 }], 10);
assert.equal(modifiedLow.tier, 'low', 'modifiers do not turn a weak die face into a lucky roll');
assert.equal(modifiedLow.band, 2, 'modifiers still contribute to the visible 10+ total scale');
assert.ok(fx.grade([{ sides: 20, value: 2 }], 10).magnitude < fx.grade([{ sides: 20, value: 2 }], 11).magnitude, 'scale follows the exact total rather than jumping only at band boundaries');

const contest = fx.grade([
  { sides: 20, value: 3, total: 3, rollMode: 'advantage', kept: false },
  { sides: 20, value: 18, total: 18, rollMode: 'advantage', kept: true }
], 18);
assert.equal(contest.raw, 18, 'advantage quality uses only the kept die');
assert.equal(contest.count, 1, 'discarded contest dice do not add score notes');

assert.ok(fx.begin('roll-a', [{ sides: 4, value: 4 }], 4, null, {}), 'first score sequence starts');
assert.equal(fx.begin('roll-a', [{ sides: 4, value: 4 }], 4, null, {}), false, 'duplicate sequence cannot start');
assert.equal(fx.step('roll-a', 0, 4, 4), true, 'first total step plays');
assert.equal(fx.step('roll-a', 0, 4, 4), false, 'the same total step cannot play twice');
assert.ok(fx.finish('roll-a'), 'sequence finishes once');
assert.equal(fx.finish('roll-a'), false, 'finished sequence cannot replay');
assert.deepEqual(soundCues.map(cue => cue.phase), ['begin', 'step', 'final'], 'score audio has one rising step and one final cue');
assert.deepEqual(soundCues.map(cue => cue.id), ['roll-a', 'roll-a', 'roll-a'], 'every score cue carries the stable roll id');
assert.deepEqual(soundCues.map(cue => cue.soundKind), ['normal', 'normal', 'normal'], 'ordinary rolls explicitly carry the normal final-sound kind');
assert.deepEqual(soundCues.map(cue => cue.resultSound), ['normal', 'normal', 'normal'], 'ordinary rolls also carry an explicit neutral d20 outcome sound');

const criticalCueStart = soundCues.length;
assert.ok(fx.begin('roll-critical', [{ sides: 20, value: 20, outcome: 'critical-success' }], 20, null, {}));
fx.finish('roll-critical');
assert.deepEqual(soundCues.slice(criticalCueStart).map(cue => cue.resultSound), ['critical-success', 'critical-success'], 'critical outcome is inferred from the decisive die even when a caller omits options');

const powerCueStart = soundCues.length;
const activeClasses = new Set();
const visualNode = {
  classList: {
    add(...names) { names.forEach(name => activeClasses.add(name)); },
    remove(...names) { names.forEach(name => activeClasses.delete(name)); }
  },
  dataset: {},
  style: { setProperty() {} }
};
assert.ok(fx.begin('roll-power', Array.from({ length: 12 }, () => ({ sides: 6, value: 5 })), 60, visualNode, {}));
assert.equal(visualNode.dataset.scoreBand, '1', 'a large total begins its visible count in the first color band');
fx.step('roll-power', 0, 5, 5);
assert.equal(visualNode.dataset.scoreBand, '1');
fx.step('roll-power', 1, 25, 20);
assert.equal(visualNode.dataset.scoreBand, '3', 'the number color advances when the running total crosses twenty');
fx.step('roll-power', 2, 60, 35);
assert.equal(visualNode.dataset.scoreBand, '6', 'the running number reaches burgundy at fifty and above');
fx.finish('roll-power');
assert.deepEqual(soundCues.slice(powerCueStart).map(cue => [cue.phase, cue.band]), [['begin', 6], ['step', 1], ['step', 3], ['step', 6], ['final', 6]], 'counting and final sound cues climb through the live score bands');

const damageCueStart = soundCues.length;
assert.ok(fx.begin('roll-damage', [{ sides: 8, value: 6 }], 6, null, { soundKind: 'damage' }));
fx.step('roll-damage', 0, 6, 6);
fx.finish('roll-damage');
assert.deepEqual(soundCues.slice(damageCueStart).map(cue => cue.soundKind), ['damage', 'damage', 'damage'], 'the explicit damage kind survives from counting through the final cue');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');
assert.match(html, /dice-result-fx\.js\?v=/, 'result effect module is loaded by the game');
assert.match(html, /dice-result-fx\.js\?v=2026-08-11\.7/, 'the fixed outcome router has a fresh browser cache key');
assert.match(html, /zargota-network\.js\?v=2026-08-11\.1/, 'the fixed Firebase outcome transport has a fresh browser cache key');
assert.match(html, /diceScoreCue: function\(cue\)/, 'the shared sound engine owns recorded score cues');
assert.match(html, /diceScoreGearClick:'audio\/vtt-actions\/dice-score-gear-click\.mp3'/, 'counting uses the selected Gear Click recording');
assert.match(html, /diceScoreThresholdRise:'audio\/vtt-actions\/dice-score-threshold-rise\.mp3'/, 'ordinary finals use the selected Rise Ding recording');
assert.match(html, /diceScoreFinalTom:'audio\/vtt-actions\/dice-score-final-tom\.mp3'/, 'damage finals use the selected acoustic tom recording');
assert.match(html, /d20CriticalSuccess:'audio\/vtt-actions\/d20-critical-success-fairy\.wav'/, 'critical successes use the selected fairy recording');
assert.match(html, /d20CriticalFailure:'audio\/vtt-actions\/d20-critical-failure-gong\.mp3'/, 'critical failures use the selected gong recording');
assert.match(html, /d20CheckFailure:'audio\/vtt-actions\/d20-check-failure-wood\.mp3'/, 'ordinary failed checks use the selected wood recording');
assert.match(html, /d20AttackMiss:'audio\/vtt-actions\/d20-attack-miss-sword\.mp3'/, 'ordinary physical misses use the selected sword recording');
const scoreCueSource = html.slice(html.indexOf('diceScoreCue: function(cue)'), html.indexOf('// Негромкое раскрытие', html.indexOf('diceScoreCue: function(cue)')));
assert.doesNotMatch(scoreCueSource, /\btone\(/, 'the score phrase no longer synthesizes oscillators');
assert.match(scoreCueSource, /stepRate=\.92\+progress\*\.22/, 'Gear Click accelerates gradually with the count');
assert.doesNotMatch(scoreCueSource, /phase==='threshold'|phase==='band'/, 'the count has no redundant middle rising phase');
assert.match(scoreCueSource, /damageFinal\?sampleSources\.diceScoreFinalTom:resultSound==='critical-success'\?sampleSources\.d20CriticalSuccess/, 'damage and critical results choose mutually exclusive semantic finals');
assert.match(scoreCueSource, /resultSound==='critical-fail'\?\.27/, 'the critical-failure gong is intentionally quieter');
assert.match(scoreCueSource, /resultSound==='silent'\)return/, 'ordinary attack misses can defer their sound to the semantic combat event');
assert.match(scoreCueSource, /maxDuration:finalDuration,playbackRate:1/, 'all recorded finals preserve their natural pitch');
[
  'dice-score-gear-click.mp3',
  'dice-score-threshold-rise.mp3',
  'dice-score-final-tom.mp3',
  'd20-critical-success-fairy.wav',
  'd20-critical-failure-gong.mp3',
  'd20-check-failure-wood.mp3',
  'd20-attack-miss-sword.mp3'
].forEach(name => {
  const sample = path.join(__dirname, '..', 'audio', 'vtt-actions', name);
  assert.ok(fs.statSync(sample).size > 10000, `${name} is bundled as a non-empty recorded sample`);
});
assert.match(html, /scoreFx\.step\(roll\.id,sequenceIndex,running,entry\.value\)/, 'each sequential visible addition advances the score phrase');
assert.match(html, /finishScoreFx\(\)/, 'the final displayed total resolves the score phrase');
assert.match(html, /scoreFx\.begin\(roll\.id,rolls,total,totalNode,\{hidden:hideResult,contest:isContest,soundKind:roll\.scoreKind,resultSound:diceResultSoundKind\(roll\.resultSound,rolls\)\}\)/, 'the renderer forwards score and decisive-die outcome semantics into the effect');
assert.match(html, /function dicePanelResultSoundKind\(rolls\)/, 'the dice panel owns its outcome helper inside the same isolated module');
assert.match(html, /batchSoundOptions=\{resultSound:dicePanelResultSoundKind\(rolls\)\}/, 'free and batch throws explicitly choose their result sound');
const dicePanelStart = html.lastIndexOf('(function(w){', html.indexOf('  function ownChar(){'));
const dicePanelEnd = html.indexOf('})(window);', html.indexOf('  function ownChar(){'));
const dicePanelSource = html.slice(dicePanelStart, dicePanelEnd);
assert.doesNotMatch(dicePanelSource, /\bdiceResultSoundKind\(/, 'the dice panel cannot call the private helper from the preceding VTT module');
assert.doesNotMatch(html.slice(html.indexOf('  function animateRoll('), html.indexOf('  function alignDicePanel', html.indexOf('  function animateRoll('))), /ZargotaSound&&w\.ZargotaSound\.diceResult/, 'single panel rolls no longer stack the old synthetic common finale');
assert.match(html, /damageRollOptions=Object\.assign\(\{\},rollOptions\|\|\{\},\{scoreKind:'damage'\}\)/, 'combat damage explicitly marks its roll instead of inferring from labels');
assert.match(network, /scoreKind:String\(options\.scoreKind\|\|''\)\.toLowerCase\(\)==='damage'\?'damage':'normal'/, 'Firebase transports the semantic score kind for remote viewers');
assert.match(network, /resultSound:\['success','fail','critical-success','critical-fail','silent'\]/, 'Firebase transports the validated d20 outcome sound for remote viewers');

const source = fs.readFileSync(path.join(__dirname, '..', 'dice-result-fx.js'), 'utf8');
assert.match(source, /dice-score-band-6[^{]*\{--dice-score-color:#941f3f/, 'the highest total band shifts the result into burgundy');
assert.match(source, /dice-score-active b\{color:var\(--dice-score-color[^}]*!important/, 'the active total number itself follows the score-band color');
assert.match(source, /Math\.min\(52,6\+result\.band\*3/, 'particle density scales through every ten-point power band');
assert.match(source, /title\.textContent=result\.powerLabel/, 'the might title is attached only after the final score effect resolves');
assert.match(source, /dice-score-title\{position:absolute;left:50%;top:50%[\s\S]*?font:900 20px/, 'the might title replaces the final digits in the centre at a larger size');
assert.match(source, /ready\.dice-score-might-title b\{animation:zgDicePowerNumberYield 1\.2s[^}]* \.22s both!important\}/, 'the large result is held before its slower fade');
assert.match(source, /ready\.dice-score-might-title em\{animation:zgDicePowerMetaYield \.55s ease \.72s both!important\}/, 'the ordinary total caption leaves the centre smoothly');
assert.match(source, /zgDicePowerNumberYield\{0%,55%\{opacity:1;visibility:visible[\s\S]*?99%,100%\{opacity:0;visibility:hidden/, 'the final number remains fully visible through more than half of its transition');
assert.match(source, /zgDicePowerTitle 1\.6s[^}]* 1\.52s both/, 'the might title waits for a clean pause after the number');

console.log('dice result sound and particles passed');
