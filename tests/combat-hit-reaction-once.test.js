const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const rule = html.match(/\.zg-vtt-token\.combat-hit\{animation:([^}]*)\}/);

assert(rule, 'combat hit reaction CSS rule must exist');
assert.match(rule[1], /zgCombatHit\s+\.48s\s+ease\s+1(?:\s|$)/, 'one hit event must move the target exactly once');
assert.doesNotMatch(rule[1], /zgCombatHit\s+\.48s\s+ease\s+2(?:\s|$)/, 'hit reaction must not repeat the same shake twice');
assert.match(html, /playHitFx=claimCombatPlaybackEvent\(event,'hitFx'\)/, 'Firebase rerenders remain guarded by the exactly-once hitFx claim');

console.log('combat hit reaction once test passed');
