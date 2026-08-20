'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /class=\"zg-gm-target-portrait\" onclick=\"zgGmTargetPickerToggle\(event\)\"/, 'GM portrait opens the scene-entity picker');
assert.match(html, /aria-label=\"Выбрать сущность для пульта ГМ\" aria-expanded=/, 'portrait exposes its dropdown state');
assert.match(html, /entities=\(draft\.tokens\|\|\[\]\)\.filter\(function\(item\)\{return item&&\['note','spawn'\]\.indexOf\(item\.type\)<0;\}\)/, 'picker lists every scene entity while excluding editor-only notes and spawn points');
assert.doesNotMatch(html, /entities=\(draft\.tokens\|\|\[\]\)\.filter\(function\(item\)\{return item&&item\.hidden!==true/, 'hidden GM entities remain selectable');
assert.match(html, /id=\"zg-gm-target-picker-search\" type=\"search\" placeholder=\"Найти сущность…\"/, 'picker includes a compact search field');
assert.match(html, /class=\"zg-gm-target-option /, 'scene entities render as direct selection rows');
assert.match(html, /<mark>'\+itemVitals\.hp\+\(itemVitals\.hpMax\?' \/ '\+itemVitals\.hpMax:''\)\+' HP<\/mark>/, 'each option shows current and maximum HP');
assert.match(html, /w\.zgGmTargetPickerSearch=function\(value\)/, 'search has a dedicated filtering handler');
assert.match(html, /gmTargetPickerOpen=typeof force==='boolean'\?force:!gmTargetPickerOpen;\s*renderGmIntervention\(\);/, 'picker toggle rerenders the active card');
assert.match(html, /option\.hidden=!match;if\(match\)visible\+\+/, 'search filters rows without rebuilding the panel or losing focus');
assert.match(html, /w\.zgGmTargetPickerSelect=function\(tokenId\)[\s\S]*?zgGmInterventionOpenToken\(tokenId,gmInterventionTab\)/, 'selection reuses the existing safe GM target bridge and preserves the active tab');
assert.match(html, /w\.zgGmInterventionToggle\(null,true,true\)/, 'explicit picker targets are not overwritten by the map selection');
assert.match(html, /document\.addEventListener\('click',function\(ev\)\{[\s\S]*?closest\('\.zg-gm-target-switcher'\)/, 'outside click closes the dropdown');
assert.match(html, /\.zg-gm-target-picker\{position:absolute;[^}]*width:min\(320px/, 'picker stays compact and anchored to the portrait');
assert.match(html, /\.zg-gm-target-options\{[^}]*max-height:240px;overflow:auto/, 'long entity lists scroll inside the dropdown');
assert.match(html, /\.zg-gm-target-option\[hidden\],\.zg-gm-target-picker-empty\[hidden\]\{display:none\}/, 'filtered rows and the empty state are visually hidden');

console.log('GM target portrait picker contract passed');
