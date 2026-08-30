'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function raiseCombatLabelTarget\(target\)\{[^}]*classList\.add\('combat-label-active'\)/, 'combat labels raise their owning target');
assert.match(html, /function releaseCombatLabelTarget\(target\)\{[\s\S]*?querySelector\('\.zg-combat-impact,\.zg-gm-adjustment'\)[\s\S]*?classList\.remove\('combat-label-active'\)/, 'target stays raised until every overlapping label is gone');
assert.match(html, /visualTarget\.appendChild\(burst\);raiseCombatLabelTarget\(visualTarget\)/, 'hit, miss, and damage labels raise the map target');
assert.match(html, /target\.appendChild\(burst\);raiseCombatLabelTarget\(target\)/, 'status and GM damage labels use the same layer rule');
assert.match(html, /\.zg-vtt-token\.combat-label-active\{z-index:10000!important\}/, 'active label target wins against every sibling token');
assert.match(html, /\.zg-vtt-token-layer\{position:absolute;inset:0;z-index:5\}/, 'raised target remains inside the token stacking layer below routes and combat UI');
assert.match(html, /\.zg-move-layer\{position:absolute;inset:0;z-index:50/, 'routes and higher UI layers remain above combat text');
assert.match(html, /classList\.remove\('combat-hit','combat-miss','combat-label-active'/, 'session cleanup cannot leave a token permanently raised');

console.log('Combat impact label layer contract passed');
