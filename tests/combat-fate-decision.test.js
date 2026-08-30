'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(network, /if\(!entry\.uid\)\{entry\.zeroHp\.state='awaiting-gm';entry\.zeroHp\.pending=true;entry\.zeroHp\.gmOutcome='pending-creature';\}/, 'creatures at zero HP wait for the GM instead of rolling death saves');
assert.match(network, /if\(!entry\.uid\)throw roomError\('Судьбу существа при 0 HP определяет мастер без бросков борьбы за жизнь\.'/);
assert.match(network, /\['death','instant-death','injury-unconscious','creature-spared','creature-death'\]/, 'network accepts the additive hero and creature fate outcomes');
assert.match(network, /outcome==='instant-death'\?'Истинная смерть: нить души оборвана, воскрешение невозможно\.'/);
assert.match(network, /fateOutcome:outcome/);
assert.match(network, /trueDeath:outcome==='instant-death'/);
assert.match(network, /zeroHp\.unconscious=outcome==='injury-unconscious'/, 'injury survival persists the unconscious fate state');
assert.match(network, /unconscious:outcome==='injury-unconscious'/, 'the live event exposes the same unconscious state to both clients');
assert.match(network, /injuries\.push\(injuryResult\);entry\.injuries=injuries/, 'injury fate is stored on the selected combat entry');
assert.match(network, /members\/'\+entry\.uid\+'\/character\/injuries/, 'injury fate is mirrored into the hero sheet');
assert.match(network, /entry&&entry\.uid&&entry\.zeroHp&&entry\.zeroHp\.state==='awaiting-gm'/, 'only an unresolved hero fate blocks turn advancement');
assert.match(network, /fate-decision-required/, 'the unresolved hero fate still owns an explicit server error');
assert.match(html, /fateResolutionRequired=order\.some\(function\(entry\)\{return entry&&entry\.uid&&entry\.zeroHp&&entry\.zeroHp\.state==='awaiting-gm';\}\)/, 'the visible turn control follows the same hero-only gate');

assert.match(html, /СУДЬБА СУЩЕСТВА/);
assert.match(html, /Оставить сражённым/);
assert.match(html, /☠ Погибло/);
assert.match(html, /Тяжёлая травма/);
assert.match(html, /w\.zgGmDeathInjuryOpen=function/, 'the GM can open the shared injury catalog from the fate panel');
assert.match(html, /w\.zgGmDeathInjuryRandom=function/, 'the GM can assign one random d20 injury');
assert.match(html, /w\.zgGmDeathInjuryApply=function/, 'the GM can choose one concrete injury');
assert.match(html, /w\.ZARGOTA_INJURY_TABLE\|\|\[\]/, 'the fate panel reuses the existing GM injury catalog');
assert.match(html, /function fateInjuryIconMarkup\(definition\)/, 'the fate picker has a module-safe injury icon adapter');
assert.match(html, /typeof w\.zgInjuryIconMarkup==='function'/, 'the fate picker calls the shared injury renderer through window');
assert.match(html, /fateInjuryIconMarkup\(injury\)/, 'every fate injury row uses the module-safe adapter');
assert.doesNotMatch(html.slice(html.indexOf('w.zgGmDeathInjuryOpen=function'),html.indexOf('w.zgGmDeathInjuryApply=function')),/[^.\w]injuryIconMarkup\(/,'the fate picker cannot call an out-of-scope private renderer');

var fateUiStart=html.indexOf('  function fateInjuryPayload(');
var fateUiEnd=html.indexOf('  w.zgGmDeathInjuryApply=function',fateUiStart);
assert.ok(fateUiStart>=0&&fateUiEnd>fateUiStart,'the fate injury picker must remain runtime-testable');
var appendedModal=null,focused=false;
var fakeModal={id:'',className:'',dataset:{},innerHTML:'',setAttribute:function(){},remove:function(){},querySelector:function(){return{focus:function(){focused=true;}};}};
var fateContext={
  w:{ZARGOTA_INJURY_TABLE:[{roll:1,icon:'🦴',iconPath:'images/vtt-injuries/broken-arm.png',name:'Сломанная рука',effect:'−1 к атакам',severity:'Тяжёлая'}],zgInjuryIconMarkup:function(injury){return '<img class="zg-injury-icon" src="'+injury.iconPath+'" alt="">';}},
  document:{createElement:function(){return fakeModal;},body:{appendChild:function(node){appendedModal=node;}}},
  el:function(){return null;},esc:function(value){return String(value==null?'':value);},Date:Date,Math:Math
};
vm.runInNewContext(html.slice(fateUiStart,fateUiEnd),fateContext);
assert.doesNotThrow(function(){fateContext.w.zgGmDeathInjuryOpen('member:hero-1');},'clicking Heavy injury must open the picker without a cross-module ReferenceError');
assert.strictEqual(appendedModal,fakeModal,'the injury picker is appended above the combat UI');
assert.match(fakeModal.innerHTML,/images\/vtt-injuries\/broken-arm\.png/,'the open picker renders the shared injury art');
assert.strictEqual(fakeModal.dataset.participantKey,'member:hero-1');
assert.strictEqual(focused,true,'keyboard focus moves into the opened picker');
assert.match(html, /Смерть · душа покидает тело/);
assert.match(html, /Истинная смерть · без воскрешения/);
assert.match(html, /Судьба ещё не открыта…/, 'player-facing wait copy does not disclose the GM decision');
assert.doesNotMatch(html.slice(html.indexOf("var title=death.state==='dead'"), html.indexOf('var shownSuccesses=', html.indexOf("var title=death.state==='dead'"))), /пока мастер определяет|Мастер решает исход/, 'player fate copy must not leak that the GM is choosing');
assert.match(html, /combatQaSyncZeroHp\(target,before,stamp\)/, 'Workshop damage mirrors the zero-HP state machine');
assert.match(html, /gmResolveDeathOutcome:function\(key,outcome,details\)/, 'Workshop can resolve the same fate choices without a second client');
assert.match(html, /resolveGmDeathOutcome\(key,'injury-unconscious',\{injury:fateInjuryPayload\(definition\)\}\)/, 'the selected hero receives one concrete injury payload atomically');

var deathVisualStart = html.indexOf('  function animateDeathSaveVisual(event)');
var deathVisualEnd = html.indexOf('  function animateCombatVisual()', deathVisualStart);
var deathVisual = html.slice(deathVisualStart, deathVisualEnd);
var creatureDeathStart = html.indexOf('  function animateCreatureDeathVisual(event)');
var creatureDeathEnd = deathVisualStart;
var creatureDeathVisual = html.slice(creatureDeathStart, creatureDeathEnd);
assert.ok(creatureDeathStart>=0&&creatureDeathEnd>creatureDeathStart,'creature death owns a compact presentation adapter');
assert.match(creatureDeathVisual, /zg-death-coin-result death dead fate-decision creature-local/, 'creature death remains on the token and party portrait');
assert.doesNotMatch(creatureDeathVisual, /zg-death-ritual/, 'creature death cannot create the fullscreen ritual');
assert.match(deathVisual, /if\(combatCreatureDeathEvent\(event\)\)\{animateCreatureDeathVisual\(event\);return;\}/, 'creature death exits before the hero ritual is built');
assert.match(deathVisual, /fateDecision=!!event\.fateOutcome/);
assert.match(deathVisual, /!fateDecision&&w\.ZargotaSound&&w\.ZargotaSound\.deathCoinToss/, 'a GM fate result never replays the coin toss');
assert.match(deathVisual, /!fateDecision&&w\.ZargotaSound&&w\.ZargotaSound\.deathCoinReveal/, 'a GM fate result never replays the coin reveal');
assert.match(deathVisual, /ПОЛУЧЕНА ТЯЖЁЛАЯ ТРАВМА/, 'injury fate has its own explicit result label');

console.log('combat fate-decision contract passed');
