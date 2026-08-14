'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.doesNotMatch(html, /Боевая лаборатория/, 'the old blocking player-simulation panel is removed');
assert.doesNotMatch(html, /id="zg-combat-lab-toggle"/, 'the old Test toolbar button is removed');
assert.doesNotMatch(html, /zg-gm-control-inline|id="zg-gm-player-control"/, 'GM player control does not inject duplicate panels around the character sheet');
assert.doesNotMatch(html, /ГМ ИГРАЕТ ЗА|УПРАВЛЕНИЕ ГЕРОЕМ|Сейчас вы играете за этого героя|▶ Играть за героя/, 'the removed top and inner control banners stay absent');
assert.match(html, /function gmControlledPlayerUid\(\)[\s\S]*?if\(combat&&combat\.active\)return String\(turn&&turn\.uid\|\|''\)/, 'active combat turn overrides stale manual player identity');
assert.match(html, /w\.zgPossessedPlayerUid = uid; w\.zgCombatLabPlayerUid = uid/, 'all existing player action routes receive the same selected identity');
assert.match(html, /w\.zgReleasePlayerControl=function\(\)[\s\S]*?zgPossessedPlayerUid=''[\s\S]*?zgCombatLabPlayerUid=''/, 'release clears the identity without changing room data');
assert.match(html, /requestApprovedAttackRoll\(request\.id,combatLabPlayerUid\(\)\)/, 'approved hit rolls use the permanently selected hero');
assert.match(html, /requestApprovedDamageRoll\(request\.id,combatLabPlayerUid\(\)\)/, 'approved damage rolls use the permanently selected hero');
assert.match(html, /answerCombatReaction\(request\.id,accepted===true,combatLabPlayerUid\(\)\)/, 'reaction answers use the permanently selected hero');
assert.match(html, /isMaster && movementApi\.requestMovementAs[\s\S]*?movementApi\.requestMovementAs\(actorUid,point\.x,point\.y,origin\)/, 'GM-controlled hero movement stays on the selected local or network adapter');
assert.match(html, /movementResolveApi=w\.ZargotaCombatQa[\s\S]*?movementResolveApi\.resolveMovement\(uid, !!accepted\)/, 'the same adapter resolves the represented player movement');
assert.match(html, /var actionApi=typeof combatQaActive==='function'&&combatQaActive\(\)\?combatQaApi:w\.ZargotaRooms;[\s\S]*?combatRequestAction\(actionApi,labels\[kind\]/, 'scene commands from the represented player stay in the guarded workshop adapter');
assert.doesNotMatch(html, /zgGmPlayerControlRender|renderGmPlayerControl\(/, 'obsolete banner rendering is no longer called');

console.log('always-available GM player control contracts passed');
