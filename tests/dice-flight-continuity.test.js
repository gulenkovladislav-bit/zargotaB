'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const renderStart = html.indexOf('  function renderRollAnimations()');
const renderEnd = html.indexOf('  w.zgRenderLocalDiceThrow=', renderStart);
const render = html.slice(renderStart, renderEnd);
const styleStart = html.indexOf('  .zg-token-roll{');
const styleEnd = html.indexOf('  .zg-roll-number-flight{', styleStart);
const styles = html.slice(styleStart, styleEnd);

assert.ok(renderStart >= 0 && renderEnd > renderStart, 'dice renderer remains extractable');
assert.ok(styleStart >= 0 && styleEnd > styleStart, 'dice motion styles remain extractable');

assert.match(render, /--local-throw-mid-x/, 'physical throws receive an arc midpoint');
assert.match(render, /--local-throw-mid-y/, 'the arc rises above the straight release path');
assert.match(render, /--local-bounce-y/, 'physical throws receive a first rebound');
assert.match(render, /--local-second-bounce-y/, 'physical throws receive a smaller settling rebound');
assert.match(render, /--local-third-bounce-y/, 'physical throws receive a third final rebound');
assert.match(render, /finalSpin=startSpin\+spinDirection\*\(1620\+index\*109\)/, 'physical dice keep spinning for at least four and a half turns');
assert.match(render, /criticalDurationScale=hasCritical\?1\.35:1/, 'critical success and failure own one exact thirty-five-percent duration scale');
assert.match(render, /baseSettleDelay=localThrow\?1580:[\s\S]*?settleDelay=Math\.round\(baseSettleDelay\*criticalDurationScale\)/, 'critical physical flight is thirty-five percent longer while ordinary flight stays unchanged');
assert.match(render, /baseRollLifetime=hasCritical\?Math\.round\(7000\*criticalDurationScale\)/, 'the complete critical result remains visible for the matching longer lifetime');
assert.match(render, /releaseX\+localThrow\.x\*1\.35/, 'the horizontal throw vector travels thirty-five percent farther');
assert.match(render, /releaseY\+localThrow\.y\*1\.35/, 'the vertical throw vector travels thirty-five percent farther');
assert.match(render, /--dice-flight-duration',settleDelay\+'ms'/, 'visual flight and result reveal share one duration');

const spinOrder = [
  '--dice-spin-start',
  '--dice-spin-mid',
  '--dice-spin-impact',
  '--dice-spin-rebound',
  '--dice-spin-second',
  '--dice-spin-third',
  '--dice-spin-fourth',
  '--dice-spin-fifth',
  '--dice-spin-settle',
  '--dice-spin-final'
];
let previous = -1;
for (const variable of spinOrder) {
  const index = render.indexOf(variable);
  assert.ok(index > previous, `${variable} follows the continuous spin sequence`);
  previous = index;
}

assert.match(styles, /animation:zgDieFlight var\(--dice-flight-duration,1\.25s\) linear both/, 'ordinary dice use one finite synchronized flight instead of an endless spin');
assert.doesNotMatch(styles, /zgDieSpin[^}]*infinite|animation:zgDieSpin/, 'ordinary dice cannot be interrupted at an arbitrary rotation');
assert.match(styles, /@keyframes zgLocalDieThrow\{0%[\s\S]*24%[\s\S]*46%[\s\S]*56%[\s\S]*64%[\s\S]*72%[\s\S]*80%[\s\S]*87%[\s\S]*94%[\s\S]*100%/, 'physical flight has a faster arc, impact and three progressively smaller rebounds');
assert.match(styles, /@keyframes zgLocalNumberThrow\{0%[\s\S]*--dice-spin-start[\s\S]*24%[\s\S]*--dice-spin-mid[\s\S]*100%[\s\S]*--dice-spin-final/, 'the visible number follows the same flight and rotation as the die texture');
assert.match(styles, /@keyframes zgNumberLand\{0%\{transform:rotate\(var\(--dice-spin-final/, 'the result number preserves its landing angle instead of snapping upright');
assert.match(styles, /@keyframes zgContestWinnerNumber\{0%\{transform:rotate\(var\(--dice-spin-final/, 'contest numbers preserve the same final angle');
assert.match(render, /classList\.add\('landed'\);setTimeout\(function\(\)\{if\(die\.parentNode\)die\.classList\.add\('number-landed'\);\},96\)/, 'the result pulse waits for the shared final rotation frame');
assert.match(styles, /\.zg-token-roll\.number-landed b\{animation:zgNumberLand/, 'the delayed result class owns the number pulse');
assert.doesNotMatch(styles, /78%[^}]*--dice-spin-second[^}]*88%[^}]*--dice-spin-second/, 'the old end-of-flight rotation pause is removed');
assert.match(styles, /\.zg-token-roll\.landed img\{filter:/, 'landing only changes the glow and does not restart rotation');
assert.match(styles, /zgCritSuccessDie[\s\S]*rotate\(var\(--dice-spin-final/, 'critical success starts from the actual landing angle');
assert.match(styles, /zgCritFailDie[\s\S]*rotate\(var\(--dice-spin-final/, 'critical failure starts from the actual landing angle');
assert.match(styles, /critical-success img\{animation:zgCritSuccessDie 1\.22s/, 'critical-success landing motion is extended by thirty-five percent');
assert.match(styles, /critical-fail img\{animation:zgCritFailDie \.97s/, 'critical-failure landing motion is extended by thirty-five percent');
assert.match(styles, /zgContestWinner[\s\S]*rotate\(var\(--dice-spin-final/, 'advantage winner preserves the actual landing angle');
assert.match(styles, /zgContestLoser[\s\S]*rotate\(var\(--dice-spin-final/, 'advantage loser preserves the actual landing angle');
assert.match(styles, /world-roll\.local-thrown\.contest-resolve\.contest-winner img\{animation:zgContestWinner/, 'the kept local die texture overrides the completed throw and travels with its number');
assert.match(styles, /world-roll\.local-thrown\.critical-fail\.contest-resolve\.contest-winner img\{animation:zgContestWinnerFail/, 'the local critical-failure texture keeps its longer contest motion');
assert.match(styles, /world-roll\.local-thrown\.critical-success\.contest-resolve\.contest-winner img\{animation:zgContestWinner/, 'the local critical-success texture keeps its longer contest motion');

console.log('dice flight continuity passed');
