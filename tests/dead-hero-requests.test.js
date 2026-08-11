'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var start = network.indexOf('  function combatHeroEntry(room, uid) {');
var end = network.indexOf('  var COMBAT_STATUS_ALIASES=', start);
assert.ok(start >= 0 && end > start, 'life restriction helpers must remain extractable');

var context = {
  Array:Array,
  Number:Number,
  Object:Object,
  String:String,
  isFinite:isFinite,
  normalizeCombatStatusKey:function(status){
    return String(typeof status === 'string' ? status : status && (status.statusKey || status.key || status.id) || '').toLowerCase();
  },
  roomError:function(message, code){ var error = new Error(message); error.code = code; return error; }
};
vm.runInNewContext(network.slice(start, end), context);

function roomWith(character, entry) {
  return {
    members:{hero:{role:'player',character:character}},
    combat:{active:false,order:entry ? [Object.assign({uid:'hero'}, entry)] : []}
  };
}

assert.strictEqual(context.memberLifeRestriction(roomWith({hpCur:8}, null), 'hero', {character:{hpCur:8}}).blocked, false);
assert.strictEqual(context.memberLifeRestriction(roomWith({hpCur:0}, null), 'hero', {character:{hpCur:0}}).blocked, true, '0 HP must block free-room requests');
assert.strictEqual(context.memberLifeRestriction(roomWith({hpCur:0,deathSaves:{state:'dead'}}, null), 'hero', {character:{hpCur:0,deathSaves:{state:'dead'}}}).dead, true);
assert.strictEqual(context.memberLifeRestriction(roomWith({hpCur:5,statuses:['dead']}, null), 'hero', {character:{hpCur:5,statuses:['dead']}}).dead, true, 'explicit dead status must also block requests');
assert.strictEqual(context.memberLifeRestriction(roomWith({}, {hp:0,zeroHp:{state:'awaiting-gm'}}), 'hero', {character:{}}).blocked, true, 'persisted combat fate must block after leaving combat');
assert.throws(function(){
  context.assertMemberCanSubmit(roomWith({hpCur:0,deathSaves:{state:'dead'}}, null), 'hero', {character:{hpCur:0,deathSaves:{state:'dead'}}});
}, function(error){ return error && error.code === 'hero-incapacitated'; });

['requestMovement: function','requestMovementAs: function','resolveMovement: function','requestAction: function'].forEach(function(marker){
  var markerAt = network.indexOf(marker);
  assert.ok(markerAt >= 0, marker + ' must exist');
  var next = network.indexOf('\n    },', markerAt);
  assert.match(network.slice(markerAt, next > markerAt ? next + 7 : markerAt + 5000), /assertMemberCanSubmit\(/, marker + ' must reject dead or downed heroes');
});
assert.match(network, /'hero-incapacitated'/, 'the network guard must preserve a stable error code');
assert.match(html, /function combatQaAssertMemberCanSubmit\(/, 'Workshop must use the same life-state guard');
assert.match(html, /requestMovementAs:function\([^]*combatQaAssertMemberCanSubmit\(room,uid,member\)/, 'Workshop movement must be blocked');
assert.match(html, /requestAction:function\([^]*combatQaAssertMemberCanSubmit\(snapshot\.room,uid,member\)/, 'Workshop actions must be blocked');

console.log('dead hero request tests passed');
