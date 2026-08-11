'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf("  w.zgCombatLabPlayerUid = '';");
const end = html.indexOf('  function fullLocalCharacter(member)', start);
assert.ok(start >= 0 && end > start, 'GM player-context helpers remain extractable');

const hero = {uid:'hero-1',role:'player',character:{name:'Герой'}};
const master = {uid:'gm-1',role:'master'};
const context = {
  String,
  Array,
  w:{zgCombatLabPlayerUid:'',zgPossessedPlayerUid:''},
  state:{session:{uid:'gm-1',role:'master'},room:{members:{'gm-1':master,'hero-1':hero},combat:{active:true,turnIndex:0,order:[{key:'hero-entry',uid:'hero-1'}]}}},
  roomMembers(){return [master,hero];}
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

assert.strictEqual(context.gmControlledPlayerUid(), 'hero-1', 'GM automatically represents the current hero');
assert.strictEqual(context.combatPlayerContext(), true, 'hero turn uses the player request pipeline');
assert.strictEqual(context.ownMember().uid, 'hero-1', 'short actions and attacks write to the current hero member');

context.state.room.combat.order[0] = {key:'rat-entry',tokenId:'rat'};
assert.strictEqual(context.gmControlledPlayerUid(), '', 'creature turn remains direct GM control');
assert.strictEqual(context.combatPlayerContext(), false);

context.w.zgPossessedPlayerUid = 'hero-1';
assert.strictEqual(context.gmControlledPlayerUid(), '', 'a stale selected hero cannot hijack an active creature turn');
assert.strictEqual(context.combatPlayerContext(), false, 'creature actions stay on the direct GM pipeline');

context.state.room.combat.active = false;
assert.strictEqual(context.gmControlledPlayerUid(), 'hero-1', 'an explicit selected hero remains supported outside active turn routing');

const submitStart = html.indexOf('  w.zgCombatAttackSubmit=function()');
const submitEnd = html.indexOf('\n  };', submitStart);
const submit = html.slice(submitStart, submitEnd);
assert.match(submit, /if\(combatPlayerContext\(\)\)[\s\S]*?requestApi\.requestAction\(/, 'current-hero attack creates a GM-visible player request');
assert.match(html, /intentApi\.requestAction\(text,'combat-intent',combatLabPlayerUid\(\)/, 'current-hero short action creates a GM-visible player request');

console.log('automatic GM current-player routing passed');
