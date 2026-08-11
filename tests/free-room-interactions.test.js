'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var menuStart = html.indexOf("var freeRoomContextTokenId=''");
var menuEnd = html.indexOf('w.zgVttCloseDrawer = function', menuStart);
assert.ok(menuStart >= 0 && menuEnd > menuStart, 'free-room token interaction module must exist');
var menuBlock = html.slice(menuStart, menuEnd);

assert.match(menuBlock, /session\.role!=='player'/, 'context actions must only open for a player');
assert.match(menuBlock, /combat&&combat\.active/, 'context actions must stay out of active combat');
assert.match(menuBlock, /action==='move'/, 'own hero must expose movement');
assert.match(menuBlock, /action==='character'/, 'own hero must expose the character sheet');
assert.match(menuBlock, /action==='inventory'/, 'own hero must expose inventory');
assert.match(menuBlock, /action==='view-character'/, 'allies must expose the public character view');
assert.match(menuBlock, /\['inspect','interact','take','search','speak','attack'\]/, 'world interactions must reuse supported request kinds');
assert.match(menuBlock, /sendActionRequest\(action,target\)/, 'world interaction must use the existing action request transport');
assert.match(menuBlock, /tokenId:token\.id/, 'a request must retain the exact target token');
assert.match(menuBlock, /targetName:tokenName\(token\)/, 'a request must include a readable target name');
assert.doesNotMatch(menuBlock, /firebase|updateRoom|setRoom|roomRef/i, 'the local menu must not introduce a second Firebase write path');

var clickStart = html.indexOf("scene.addEventListener('click', function(ev)");
var clickEnd = html.indexOf('// Рамка выделения', clickStart);
assert.ok(clickStart >= 0 && clickEnd > clickStart, 'scene click handler must exist');
var clickBlock = html.slice(clickStart, clickEnd);
assert.match(clickBlock, /!isMaster&&ev\.button===0&&!movementMode&&!actionToolKind&&!abilityTargeting/, 'plain player click must not steal active tools');
assert.match(clickBlock, /w\.zgOpenFreeRoomTokenMenu\(freeRoomTarget,freeRoomTargetNode\)/, 'plain player click must use the published cross-module target-action bridge');
assert.ok(clickBlock.indexOf("if(actionToolKind&&ev.button===0)") < clickBlock.indexOf('w.zgOpenFreeRoomTokenMenu(freeRoomTarget,freeRoomTargetNode)'), 'explicit tools must resolve before the free-room menu');
assert.match(menuBlock, /w\.zgOpenFreeRoomTokenMenu=openFreeRoomTokenMenu/, 'the free-room interaction module must publish its opener');

assert.match(html, /ev\.key==='Escape'&&el\('zg-free-token-menu'\)/, 'Escape must close the free-room menu');
assert.match(html, /if\(active&&w\.zgFreeRoomTokenClose\)w\.zgFreeRoomTokenClose\(\)/, 'combat activation must dismiss the free-room menu');
assert.match(html, /freeRoomInteractable=.*!isMaster.*!\(combatState&&combatState\.active\)/, 'only non-combat player tokens must look interactive');

console.log('free-room interactions: ok');
