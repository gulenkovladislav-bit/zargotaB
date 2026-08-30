'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

var helperStart = network.indexOf('  function combatParticipantIsDead(entry)');
var helperEnd = network.indexOf('  function beginCombatActionOperation(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'round-skip helpers remain independently testable');
var context = {};
vm.runInNewContext(network.slice(helperStart, helperEnd) + '\nthis.skips=combatParticipantSkipsRound;this.nextIndex=combatNextRoundIndex;this.nextState=combatNextRoundState;', context);

assert.strictEqual(context.nextIndex([{key:'a'},{key:'b',skipRounds:true},{key:'c'}], 0), 2, 'the cursor bypasses a skipped participant');
assert.strictEqual(context.nextIndex([{key:'a',skipRounds:true},{key:'b'},{key:'c'}], 2), 1, 'wrapping finds the first enabled participant, not necessarily index zero');
assert.strictEqual(context.nextIndex([{key:'a',skipRounds:true},{key:'b',skipRounds:true}], 0), -1, 'an all-skipped round is rejected explicitly');
assert.strictEqual(context.nextIndex([{key:'legacy-a'},{key:'legacy-b'}], 0), 1, 'legacy entries without the flag keep participating');
assert.strictEqual(context.skips({key:'dead-legacy',zeroHp:{state:'dead'}}), true, 'a confirmed death is skipped even when an old snapshot has no explicit flag');
assert.strictEqual(context.nextIndex([{key:'a'},{key:'dead',zeroHp:{state:'dead'}},{key:'c'}], 0), 2, 'the cursor automatically bypasses a confirmed death');
assert.strictEqual(context.nextIndex([{key:'a'},{key:'dead',zeroHp:{state:'dead'},deadRoundOverride:true},{key:'c'}], 0), 1, 'the GM can explicitly return a dead participant to the round');
assert.strictEqual(context.nextIndex([{key:'hero',uid:'player-1'},{key:'defeated-creature',uid:'',hp:0,zeroHp:{state:'awaiting-gm'}},{key:'living-creature',uid:'',hp:5}], 0), 2, 'a defeated creature awaiting GM fate cannot trap the player turn');
assert.strictEqual(context.nextIndex([{key:'hero',uid:'player-1'},{key:'defeated-creature',uid:'',hp:0,zeroHp:{state:'awaiting-gm'},deadRoundOverride:true},{key:'living-creature',uid:'',hp:5}], 0), 1, 'the GM can explicitly return a defeated creature before choosing its final fate');
assert.strictEqual(context.nextIndex([{key:'a'},{key:'dead',zeroHp:{state:'dead'},deadRoundOverride:true,skipRounds:true},{key:'c'}], 0), 2, 'manual skipping still wins over the dead-participant override');
assert.strictEqual(context.nextState([{key:'a'},{key:'summon',summonExpiresRound:2},{key:'c'}], 0, 2, true).index, 2, 'an expired summon is skipped by the authoritative cursor');
assert.strictEqual(context.nextState([{key:'a'},{key:'summon',summonExpiresRound:2}], 1, 1, true).round, 2, 'round rollover is still derived from the selected eligible cursor');

assert.match(network, /setCombatParticipantSkipped: function \(participantKey, skipped\)/, 'the network API owns the shared round flag');
assert.match(network, /firebase\.runTransaction\(roomRef\(session\.code\)/, 'the GM toggle is atomic');
assert.match(network, /session\.role!=='master'.*master-only/, 'players cannot change initiative participation');
assert.match(network, /var startsNewRound=nextState\.startsNewRound/, 'round rollover follows the selected eligible cursor');
assert.match(network, /entry\.deadRoundOverride=combatParticipantNeedsRoundOverride\(entry\)\?!skipped:false/, 'returning a defeated participant records an explicit GM override');
assert.match(network, /if\(!survives\)\{entry\.skipRounds=true;entry\.deadRoundOverride=false;/, 'a confirmed or repeated death restores automatic skipping');
assert.match(network, /combat-no-active-participants/, 'advancement reports an explicit all-skipped state');

assert.match(html, /class="zg-party-round-gear"/, 'the GM control is anchored over each combat portrait');
assert.match(html, /class="zg-combat-round-switch /, 'the gear opens a visual switch rather than a form table');
assert.match(html, /role="switch" aria-checked=/, 'the visual control exposes its state accessibly');
assert.match(html, /roundApi\.setCombatParticipantSkipped/, 'the UI calls the shared network operation');
assert.match(html, /class="zg-party-slot'\+\(skipped\?' round-skipped'/, 'skipped portraits remain visible in the initiative strip');
assert.match(html, /noRoundParticipants/, 'the Next button explains when everybody is skipped');
assert.match(html, /if\(combatEntrySkipsRound\(candidateEntry\)\)continue/, 'the local Workshop cursor skips dead and manually disabled participants');
assert.match(html, /entry\.deadRoundOverride=combatEntryNeedsRoundOverride\(entry\)\?!entry\.skipRounds:false/, 'the Workshop GM toggle preserves the same defeated-participant override');
assert.match(html, /if\(!survives\)\{entry\.skipRounds=true;entry\.deadRoundOverride=false;/, 'Workshop parity also resets the override after a confirmed death');
assert.match(html, /У раунді не залишилося активних учасників/, 'the no-participants fallback is available in Ukrainian');
assert.match(html, /v: '2026-08-28\.14'.*notesUk:/, 'the release note is present in both supported locales');

console.log('combat round-skip contract passed');
