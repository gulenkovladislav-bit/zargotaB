'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /⚒ Мастерская/, 'home screen should expose the combat workshop directly');
assert.match(html, /onclick="zgWorkshopModeOpen\(\)"/, 'the workshop button should ask for a mode before opening');
assert.match(html, /id="zg-workshop-mode"/, 'the workshop should expose a combat/free-room chooser');
assert.match(html, /zgWorkshopModeChoose\('combat'\)/, 'the chooser should offer immediate combat');
assert.match(html, /zgWorkshopModeChoose\('free'\)/, 'the chooser should offer a free-room test');
assert.match(html, /w\.zgLocalCombatQaEnabled = false/, 'combat QA must start disabled in ordinary sessions');
assert.match(html, /w\.zgOpenDiceTestScene = function\(mode\)\{[\s\S]*?w\.zgLocalCombatQaEnabled = true;/, 'the selected workshop mode must enable local QA without a URL flag');
assert.match(html, /if\(settings&&!settings\.classList\.contains\('open'\)&&w\.zgGameSettings\)w\.zgGameSettings\(\)/, 'the home button should expose the combat lab controls immediately');
assert.match(html, /if\(mode==='combat'&&w\.zgCombatToggle\)w\.zgCombatToggle\(\)/, 'combat mode should open the common participant picker');
assert.match(html, /if\(mode==='free'&&w\.zgQaSessionFreeRoom\)w\.zgQaSessionFreeRoom\(\)/, 'free-room mode should explicitly clear combat state');
assert.match(html, /host\.hidden=!isMaster\|\|!inWorkshop\|\|!\(w\.zgLocalCombatQaActive&&w\.zgLocalCombatQaActive\(\)\)/, 'QA controls should require both the isolated TEST room and local QA state, and remain unavailable to players');
assert.match(html, /w\.zgCombatFxBrowserOpen=function\(\)\{\s*if\(!isMaster\)return false;/, 'the live effects laboratory is GM-only even when called directly');
assert.match(html, /room\.code==='TEST'/, 'the battle adapter must remain restricted to the isolated TEST room');
assert.match(html, /images\/vtt-test\/combat-workshop\.webp/, 'the workshop should use its dedicated optimized battlefield');
assert.match(html, /w\.zgQaWorkshopBackground=function\(kind\)/, 'the workshop should allow switching its background');
assert.match(html, /w\.zgQaWorkshopUploadBackground=function\(\)/, 'the workshop should allow a custom local background');
assert.match(html, /function qaWorkshopFixtureReady\(scene\)[\s\S]*?scene\.layers[\s\S]*?qa-rat-melee[\s\S]*?qa-archer-range/, 'the workshop should validate its background and both QA creatures');
assert.match(html, /w\.zgQaWorkshopEnsure=function\(\)[\s\S]*?room\.code!=='TEST'[\s\S]*?zgSceneBuildQaCombat\(\)[\s\S]*?qaWorkshopFixtureReady\(draft\)/, 'an incomplete local TEST fixture should be repaired before combat');
assert.match(html, /w\.zgCombatToggle=function\(\)[\s\S]*?combatQaActive\(\)[\s\S]*?zgQaWorkshopEnsure\(\)[\s\S]*?renderCombatParticipants\(\)/, 'the header combat button should repair the offline workshop and open the participant picker');
assert.match(html, /w\.zgGmVisionMode=gmVision/, 'the scene module should expose GM vision without leaking a closure-local variable');
assert.match(html, /function ownDeathSaveCombatEntry\(\)[\s\S]*?w\.zgGmVisionMode==='players'[\s\S]*?w\.zgPossessedPlayerUid/, 'session death ambience should consume the shared vision state without a ReferenceError');

console.log('home combat lab button contract passed');
