'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const soundStart = html.indexOf('//  ZARGOTA SOUND ENGINE v2');
const soundEnd = html.indexOf('})(window);', soundStart);
const sound = html.slice(soundStart, soundEnd);

assert.match(sound,/diceRoll:'audio\/vtt-actions\/dice-roll\.mp3'/,'the bundled licensed dice sample stays canonical');
assert.match(sound,/audio\.playbackRate=Math\.max\(\.85,Math\.min\(1\.15,Number\(options\.playbackRate\)\|\|1\)\)/,'file mode applies the requested lower pitch');
assert.match(sound,/src\.playbackRate\.value=Math\.max\(\.85,Math\.min\(1\.15,Number\(options\.playbackRate\)\|\|1\)\)/,'WebAudio mode applies the same pitch');
assert.match(sound,/combatDiceRoll:[\s\S]*?sampleSources\.diceRoll[\s\S]*?playbackRate:\.94/,'every roll uses the slightly lower custom sample');
assert.match(sound,/diceRoll: function\(result, options\) \{[\s\S]*?Sound\.combatDiceRoll\(\)/,'legacy Arena rolls route through the custom sample too');

assert.doesNotMatch(html,/try\{if\(w\.ZargotaSound&&w\.ZargotaSound\.diceRollStart\)/,'no live roll path may prefer the synthetic rolling sound');
[
  "function renderRollAnimations()",
  "function animateInitiativeRoll(groupKey)",
  "function playCombatDiceSound(event,phase,result,sides,settleDelay,startAlreadyPlayed)",
  "function animateRoll(sides, finalHtml",
  "function throwDiceBatch(sidesList,throwMotion)"
].forEach(function(marker){
  const at=html.indexOf(marker);
  assert.ok(at>=0,marker+' must exist');
  assert.match(html.slice(at,at+5500),/ZargotaSound\.combatDiceRoll/,'custom sample must cover '+marker);
});
assert.match(html,/w\.zgVttRoll = function\(sides\)[\s\S]*?ZargotaSound\.combatDiceRoll/,'compact VTT rolls use the custom sample');

console.log('all dice sound routing passed');
