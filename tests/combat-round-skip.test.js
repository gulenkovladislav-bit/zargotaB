'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

var helperStart = network.indexOf('  function combatParticipantSkipsRound(entry)');
var helperEnd = network.indexOf('  function beginCombatActionOperation(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'round-skip helpers remain independently testable');
var context = {};
vm.runInNewContext(network.slice(helperStart, helperEnd) + '\nthis.nextIndex=combatNextRoundIndex;', context);

assert.strictEqual(context.nextIndex([{key:'a'},{key:'b',skipRounds:true},{key:'c'}], 0), 2, 'the cursor bypasses a skipped participant');
assert.strictEqual(context.nextIndex([{key:'a',skipRounds:true},{key:'b'},{key:'c'}], 2), 1, 'wrapping finds the first enabled participant, not necessarily index zero');
assert.strictEqual(context.nextIndex([{key:'a',skipRounds:true},{key:'b',skipRounds:true}], 0), -1, 'an all-skipped round is rejected explicitly');
assert.strictEqual(context.nextIndex([{key:'legacy-a'},{key:'legacy-b'}], 0), 1, 'legacy entries without the flag keep participating');

assert.match(network, /setCombatParticipantSkipped: function \(participantKey, skipped\)/, 'the network API owns the shared round flag');
assert.match(network, /firebase\.runTransaction\(roomRef\(session\.code\)/, 'the GM toggle is atomic');
assert.match(network, /session\.role!=='master'.*master-only/, 'players cannot change initiative participation');
assert.match(network, /var startsNewRound=next<=previous/, 'round rollover follows the selected eligible cursor');
assert.match(network, /if\(!survives\)\{entry\.skipRounds=true;/, 'a confirmed death defaults to skipping future turns');
assert.match(network, /combat-no-active-participants/, 'advancement reports an explicit all-skipped state');

assert.match(html, /class="zg-party-round-gear"/, 'the GM control is anchored over each combat portrait');
assert.match(html, /class="zg-combat-round-switch /, 'the gear opens a visual switch rather than a form table');
assert.match(html, /role="switch" aria-checked=/, 'the visual control exposes its state accessibly');
assert.match(html, /roundApi\.setCombatParticipantSkipped/, 'the UI calls the shared network operation');
assert.match(html, /class="zg-party-slot'\+\(skipped\?' round-skipped'/, 'skipped portraits remain visible in the initiative strip');
assert.match(html, /noRoundParticipants/, 'the Next button explains when everybody is skipped');
assert.match(html, /if\(!survives\)\{entry\.skipRounds=true;/, 'Workshop parity also defaults a confirmed death to skipped');

console.log('combat round-skip contract passed');
