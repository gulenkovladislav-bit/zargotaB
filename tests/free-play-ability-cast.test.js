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
assert.match(detail, /useContext=triggeredOnly\?/);
assert.match(detail, /:!viewOnly&&!gmCanPropose&&!card\.passive&&!disabled&&!unknown&&!unprepared&&!exhausted/);
assert.match(detail, /primaryDisabled=.*triggeredOnly/);
assert.match(detail, /primaryDisabled=.*unprepared/);
assert.match(detail, /Сначала подготовьте/);
assert.match(detail, /innateDetail=card\.group==='skills'/, 'session skill details must have their own compact presentation mode');
assert.match(detail, /characterAbilityDisplayName\(card\.name\)/, 'session skill titles reuse the compact Character-sheet name');
assert.match(detail, /zg-innate-ability-backdrop/, 'session skill details can sit higher than the large spell dialog');
assert.match(detail, /zg-innate-ability-modal/, 'session skill details receive the Character-sheet visual treatment');
assert.match(detail, /detailPanel\.scrollTop=0[\s\S]*?detailClose\.focus\(\{preventScroll:true\}\)/, 'ability details always open at the heading instead of inheriting the focused card scroll position');
var sectionsStart = html.indexOf('function abilityDetailSections(card)');
var sectionsEnd = html.indexOf('w.zgVttAbilityOpen=function(key)', sectionsStart);
var sections = html.slice(sectionsStart, sectionsEnd);
assert.match(sections, /characterAbilityCleanDescription\(innateDescription,innateItem\)/, 'session skills reuse Character-sheet description cleanup');
assert.match(sections, /characterAbilityRulesHtml\(innateDescription,innateItem\)/, 'session skills reuse Character-sheet semantic rule cards');
assert.match(sections, /class="zg-innate-ability-rules"/, 'session skill rules keep a layout wrapper without inheriting the middle editor panel');
assert.doesNotMatch(sections, /zg-innate-ability-rules sc-ability-rules/, 'session skill details must not nest an extra framed rules cloud');
assert.match(html, /\.zg-ability-modal\.zg-innate-ability-modal\{[^}]*width:min\(620px,[^}]*max-height:min\(86vh,780px\)/, 'innate detail stays compact instead of inheriting the stretched spell dialog');
assert.match(html, /\.zg-ability-modal-backdrop\.zg-innate-ability-backdrop\{[^}]*place-items:start center[^}]*padding-top:clamp/, 'innate detail is lifted toward the top of the viewport');
assert.match(html, /\.zg-innate-ability-rules\{margin:12px 0 14px\}/, 'session skill rules use the modal itself as their only outer cloud');
assert.match(html, /\.zg-innate-ability-modal \.char-ability-rule-paragraph,\.zg-innate-ability-modal \.char-ability-rule-copy ul\{font-size:15px;line-height:1\.62\}/, 'removing the middle cloud gives authored skill text a larger readable scale');

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
