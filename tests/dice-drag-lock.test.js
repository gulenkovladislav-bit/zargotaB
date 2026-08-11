'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('//   КУБИК СНИЗУ');
const end = html.indexOf('})(window);', start) + '})(window);'.length;
const dice = html.slice(start, end > start ? end : html.length);

assert.match(dice, /diceThrowLockUntil=0,diceThrowUnlockTimer=0/, 'dice palette owns one shared throw lock and one unlock timer');
assert.match(dice, /if\(!sidesList\.length\|\|Date\.now\(\)<diceThrowLockUntil\)return false/, 'batch producer rejects a second throw during flight');
assert.match(dice, /lockDuration=throwMotion\?1850:1450/, 'lock covers the fast physical roll and result sound without waiting for the decorative fade');
assert.match(dice, /if\(diceThrowUnlockTimer\)clearTimeout\(diceThrowUnlockTimer\)/, 'rearming cannot leave parallel unlock timers');
assert.match(dice, /panel\.setAttribute\('aria-busy','true'\)/, 'assistive clients receive the same in-flight state as the visual palette');
assert.match(dice, /zgDiceDragStart=function\(ev,sides\)[\s\S]*Date\.now\(\)<diceThrowLockUntil/, 'pointer input is rejected before a second drag ghost is allocated');
assert.match(html, /\.zg-dice-pop\.roll-busy \.zg-dice-row button\{pointer-events:none/, 'the lock has visible and semantic UI feedback');

console.log('dice drag in-flight lock passed');
