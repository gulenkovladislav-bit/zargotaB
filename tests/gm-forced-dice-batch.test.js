'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function forcedRoll(sides)');
const end = html.indexOf('  function dragMove(ev)', start);
const dice = html.slice(start, end);

assert.ok(start >= 0 && end > start, 'GM dice batch code remains extractable');
assert.match(dice, /function resultFor\(sides\)\{return forcedRoll\(sides\)\|\|roll\(sides\);\}/, 'one permission-aware resolver owns forced and random results');
assert.match(dice, /var a=resultFor\(20\),b=resultFor\(20\)/, 'advantage and disadvantage apply the GM result to both d20 dice');
assert.match(dice, /sidesList\.slice\(0,MAX_DICE_BATCH\)\.forEach\(function\(sides\)\{var value=resultFor\(sides\)/, 'every die in a mixed or repeated batch resolves the GM setting');
assert.doesNotMatch(dice, /forcedUsed|firstForced/, 'the old first-die-only guard cannot return');
assert.match(html, /Применяется к каждому кубику:/, 'the GM control explains that the setting covers the complete batch');
assert.match(html, /id="zg-dice-force"[^>]*placeholder="для каждого"/, 'the input visibly reinforces per-die behavior');

const resolverEnd = html.indexOf('  w.zgDiceClearForced=', start);
const resolverSource = html.slice(start, resolverEnd);
const input = { value: '20' };
const context = {
  w: { ZargotaRooms: { getSnapshot() { return { session: { role: 'master' } }; } } },
  el(id) { return id === 'zg-dice-force' ? input : null; },
  roll() { throw new Error('forced batch unexpectedly used randomness'); },
  Math,
  Number
};
vm.runInNewContext(`${resolverSource};results=[resultFor(4),resultFor(6),resultFor(8),resultFor(10),resultFor(12),resultFor(20)];`, context);
assert.deepEqual(Array.from(context.results), [4, 6, 8, 10, 12, 20], 'one exact GM value is clamped and applied independently to every die type');

input.value = '15-20';
vm.runInNewContext('rangeResults=[resultFor(4),resultFor(6),resultFor(20)];', context);
assert.equal(context.rangeResults[0], 4, 'a range above d4 produces the d4 maximum');
assert.equal(context.rangeResults[1], 6, 'a range above d6 produces the d6 maximum');
assert.ok(context.rangeResults[2] >= 15 && context.rangeResults[2] <= 20, 'a configured range is resolved independently for a compatible die');

console.log('GM forced result applies to every batch die');
