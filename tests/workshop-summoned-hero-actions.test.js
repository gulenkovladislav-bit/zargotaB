'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var helperStart = html.indexOf('  function combatQaStatusIsDead(status){');
var assertStart = html.indexOf('  function combatQaAssertMemberCanSubmit(room,uid,member){', helperStart);
var apiStart = html.indexOf('  var combatQaApi={', assertStart);

assert.ok(helperStart >= 0 && assertStart > helperStart && apiStart > assertStart, 'Workshop action guard must remain locally auditable');

var source = html.slice(helperStart, apiStart) + '\nthis.combatQaStatusIsDead=combatQaStatusIsDead;this.combatQaAssertMemberCanSubmit=combatQaAssertMemberCanSubmit;';
var context = {};
vm.runInNewContext(source, context);

assert.strictEqual(context.combatQaStatusIsDead('dead'), true);
assert.strictEqual(context.combatQaStatusIsDead('☠ Мёртв'), true);
assert.strictEqual(context.combatQaStatusIsDead({statusKey:'погибший'}), true);
assert.strictEqual(context.combatQaStatusIsDead('poison'), false);

var livingMember = {role:'player', character:{hpCur:11, statuses:[], statusEffects:[]}};
assert.doesNotThrow(function(){
  context.combatQaAssertMemberCanSubmit({combat:{order:[{uid:'hero-1',hp:11}]}}, 'hero-1', livingMember);
}, 'a living summoned hero must be allowed to move and submit actions');

assert.throws(function(){
  context.combatQaAssertMemberCanSubmit({combat:{order:[{uid:'hero-1',hp:11}]}}, 'hero-1', {role:'player',character:{hpCur:11,statuses:['dead']}});
}, /Мёртвый герой/, 'the local guard must still block dead heroes');

var qaStart = html.indexOf('  var combatQaApi={', helperStart);
var qaEnd = html.indexOf('  w.ZargotaCombatQa=combatQaApi;', qaStart);
var qaBlock = html.slice(helperStart, qaEnd);
assert.doesNotMatch(qaBlock, /normalizeStatusDisplayKey/, 'Workshop combat must not call a private helper from another IIFE');
assert.match(qaBlock, /requestMovementAs:function/, 'the fixed guard must protect Workshop movement');
assert.match(qaBlock, /requestAction:function/, 'the fixed guard must protect Workshop combat requests');
var applyStart = html.indexOf('  function combatQaApply(change){');
var applyBlock = html.slice(applyStart, helperStart);
assert.match(applyBlock, /snapshot\.room\.scene=visibleScene/, 'Workshop commands must use the visible draft containing summoned hero tokens');
assert.match(applyBlock, /state=snapshot;roomSnapshot=snapshot/, 'Workshop commands must publish their updated snapshot to the GM request surface');

var requestStart = html.indexOf('  function combatRequestAction(', applyStart);
var requestEnd = html.indexOf('  function combatQaRollFormula', requestStart);
var requestBlock = html.slice(requestStart, requestEnd);
assert.ok(requestStart >= 0 && requestEnd > requestStart, 'the Workshop action bridge remains locally auditable');
assert.match(requestBlock, /if\(kind==='combat-attack'\)return combatQaApi\.resolveAction/, 'only the locally automated attack may resolve immediately');
assert.doesNotMatch(requestBlock, /request\.status==='approved'/, 'ordinary Workshop actions must remain pending for the GM instead of silently auto-approving');
assert.match(requestBlock, /return snapshot;/, 'the pending Workshop request is returned for the GM request panel');

console.log('workshop summoned hero actions contract passed');
