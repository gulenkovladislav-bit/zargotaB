'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

var detailStart = html.indexOf('w.zgVttAbilityOpen=function(key)');
var detailEnd = html.indexOf('w.zgVttAbilityExpand=', detailStart);
var detail = html.slice(detailStart, detailEnd);
assert(detailStart >= 0 && detailEnd > detailStart, 'ability detail renderer must exist');
assert.match(detail, /activeCombat=.*combat\.active/);
assert.match(detail, /freePlay=!activeCombat/);
assert.match(detail, /СВОБОДНЫЙ РЕЖИМ/);
assert.match(detail, /Применить вне боя/);
assert.match(detail, /Нижняя боевая панель не открывается/);
assert.match(detail, /unprepared=card\.group==='spells'&&card\.learned===true&&!card\.prepared/);
assert.match(detail, /useContext=!viewOnly&&!gmCanPropose&&!card\.passive&&!disabled&&!unknown&&!unprepared&&!exhausted/);
assert.match(detail, /primaryDisabled=.*unprepared/);
assert.match(detail, /Сначала подготовьте/);

var requestStart = html.indexOf('w.zgVttRequestAbility=function(key)');
var requestEnd = html.indexOf('w.zgVttAbilityTargetCancelled=', requestStart);
var request = html.slice(requestStart, requestEnd);
assert(requestStart >= 0 && requestEnd > requestStart, 'ability request handler must exist');
assert.match(request, /Сначала подготовьте это заклинание в Сумке героя/);
assert.match(request, /requestAction\('Хочет применить «'\+label\+'»','ability'/);
assert.match(request, /return beginVttSpellCast\(key,label,profile\)/, 'configured and ready spells enter the shared targeting flow');
assert.doesNotMatch(request, /startCombat|combat\.active\s*=\s*true/);

var beginCastStart = html.indexOf('function beginVttSpellCast(key,label,profile)');
var beginCastEnd = html.indexOf('w.zgVttSpellCastConfigure=', beginCastStart);
assert.ok(beginCastStart >= 0 && beginCastEnd > beginCastStart, 'shared targeting initializer must remain extractable');
assert.match(html.slice(beginCastStart, beginCastEnd), /pendingAbilityCast=\{key:key,label:label,profile:profile\}/, 'targeted free-play casts retain their pending request until a target is selected');

var gmStart = html.indexOf('w.zgAbilityResolveOpen=function(uid,preserve)');
var gmEnd = html.indexOf('w.zgAbilityResolveClose=', gmStart);
var gmResolution = html.slice(gmStart, gmEnd);
assert(gmStart >= 0 && gmEnd > gmStart, 'GM ability decision handler must exist');
assert.match(gmResolution, /if\(!combat\|\|!combat\.active\)\{w\.zgActionResolve\(uid,true\);return true;\}/, 'outside combat the GM approves the existing request without opening the combat resolver');

assert.match(network, /abilityOperationId/);
assert.match(network, /actionKind === 'ability'/);
assert.match(network, /queueGameplayOperation\('ability-request', abilityOperationId/);
assert.match(network, /String\(member\.actionRequest\.id \|\| ''\) === abilityOperationId/);

console.log('free-play ability cast contract passed');
