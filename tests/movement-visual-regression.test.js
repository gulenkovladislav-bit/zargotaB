'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function animateLastMovement(movementOverride)');
const end = html.indexOf('  function applyCamera()', start);
const movement = html.slice(start, end);

assert.ok(start >= 0 && end > start, 'movement renderer remains extractable');
assert.match(movement, /foot\.className='zg-move-footprint '/, 'movement creates the established alternating boot prints');
assert.match(movement, /foot\.innerHTML='<i><\/i>'/, 'footprints keep the original boot-print asset node');
assert.match(movement, /foot\.dataset\.progress=String\(progress\)/, 'each print appears only after the token reaches it');
assert.match(movement, /foot\.style\.animation='zgFootprintTrail 2\.15s ease-out both'/, 'footprints keep their original reveal and fade animation');
assert.doesNotMatch(movement, /playLiveMovementCanvas\(/, 'a dotted Canvas route cannot replace the boot prints');

assert.match(movement, /walkingMotion=!reducedEffects&&combatMotionMode!=='minimal'/, 'walking sway is enabled in normal client modes');
assert.match(movement, /walkAngle=walkingMotion\?-1\.4\*Math\.cos/, 'walking keeps the original 1.4 degree rocking amplitude');
assert.match(movement, /walkLift=walkingMotion\?\(-1\.5\+1\.5\*Math\.cos/, 'walking keeps the original three-pixel step lift');
assert.match(movement, /\(\(now-started\)%280\)\/280/, 'walking keeps the original 280ms step cycle');
assert.match(movement, /walkEnvelope=walkingMotion\?Math\.min\(1,Math\.max\(0,\(1-progress\)\/\.14\)\):0/, 'walking reaches a neutral pose instead of jerking on its final frame');
assert.match(movement, /translate3d\(.*rotate\('\+walkAngle\+'deg\) translateY\('\+walkLift\+'px\)'/, 'sway is composed into the optimized transform instead of being disabled');

assert.match(html, /\.zg-move-footprint i\{[^}]*boot-print\.png/, 'the visible trail still uses the authored boot-print image');

console.log('movement visual regression contract passed');
