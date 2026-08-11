'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('    diceScoreCue: function(cue) {');
const end = html.indexOf('    // Негромкое раскрытие', start);
assert.ok(start >= 0 && end > start, 'recorded outcome selector must remain extractable');
const method = html.slice(start, end).trim().replace(/,$/, '');

const played = [];
const context = {
  Math, Number, String,
  location:{protocol:'http:'},
  diceScoreSoundState:Object.create(null),
  sampleSources:{
    diceScoreGearClick:'gear.mp3',
    diceScoreThresholdRise:'rise.mp3',
    diceScoreFinalTom:'tom.mp3',
    d20CriticalSuccess:'fairy.wav',
    d20CriticalFailure:'gong.mp3',
    d20CheckFailure:'wood.mp3'
  },
  ensure(){},
  stopToneGroup(){},
  stopSampleGroup(){},
  loadSample(){return Promise.resolve();},
  playSample(source, volume, fallback, options){played.push({source, volume, options});}
};
vm.createContext(context);
vm.runInContext(`handler={${method}}`, context);

function resolveFinal(id, resultSound, soundKind) {
  played.length = 0;
  const cue = {id, resultSound, soundKind:soundKind || 'normal', hidden:false, band:2, magnitude:1, count:1, total:12};
  context.handler.diceScoreCue(Object.assign({phase:'begin'}, cue));
  context.handler.diceScoreCue(Object.assign({phase:'final'}, cue));
  return played[played.length - 1] || null;
}

assert.equal(resolveFinal('normal', 'normal').source, 'rise.mp3', 'ordinary success keeps Rise Ding');
assert.equal(resolveFinal('fail', 'fail').source, 'wood.mp3', 'ordinary failed check chooses Wood Hit');
assert.equal(resolveFinal('critical-success', 'critical-success').source, 'fairy.wav', 'critical success chooses Fairy Sparkle Whoosh');
const criticalFailure = resolveFinal('critical-fail', 'critical-fail');
assert.equal(criticalFailure.source, 'gong.mp3', 'critical failure chooses Gong Bell');
assert.equal(criticalFailure.volume, 0.27, 'critical-failure gong remains intentionally quiet');
assert.equal(resolveFinal('damage', 'normal', 'damage').source, 'tom.mp3', 'damage owns Huge Tom instead of a d20 cue');
assert.equal(resolveFinal('silent', 'silent'), null, 'ordinary attack miss defers its sound to the semantic miss event');

assert.equal(new Set(['rise.mp3','wood.mp3','fairy.wav','gong.mp3','tom.mp3']).size, 5);
console.log('d20 outcome audio runtime selection passed');
