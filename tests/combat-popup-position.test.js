'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const popupStart = html.indexOf('  .zg-combat-attack{display:none;');
const popupEnd = html.indexOf('  .zg-combat-attack-main{', popupStart);
const popupStyles = html.slice(popupStart, popupEnd);

assert.ok(popupStart >= 0 && popupEnd > popupStart, 'combat popup styles remain inspectable');
assert.match(popupStyles, /\.zg-combat-attack\.open,\.zg-combat-prepare\.open,\.zg-combat-reaction-prompt\.open\{[^}]*animation:zgCombatPopupIn/, 'all centered combat toolbar surfaces share the dedicated popup animation');
assert.match(popupStyles, /@keyframes zgCombatPopupIn\{0%\{opacity:0;transform:translateX\(-50%\) translateY\(18px\) scale\(\.965\)\}/, 'the first frame is centered before it becomes visible');
assert.match(popupStyles, /100%\{opacity:1;transform:translateX\(-50%\) translateY\(0\) scale\(1\)\}/, 'the final frame preserves the same horizontal anchor');
assert.doesNotMatch(popupStyles, /zgPopIn/, 'centered toolbar popups cannot inherit the global transform-replacing animation');
assert.match(popupStyles, /prefers-reduced-motion:reduce[^}]*transform:translateX\(-50%\)/, 'reduced motion remains centered without animation');

const attackToggleStart = html.indexOf('  w.zgCombatAttackToggle=function(force)');
const attackToggleEnd = html.indexOf('  w.zgCombatAttackTarget=', attackToggleStart);
assert.match(html.slice(attackToggleStart, attackToggleEnd), /renderCombatAttack\(\);panel\.classList\.add\('open'\)/, 'attack content is laid out before the popup animation starts');

console.log('combat toolbar popup positioning passed');
