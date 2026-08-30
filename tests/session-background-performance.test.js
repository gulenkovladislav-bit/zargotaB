'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(
  html,
  /body:has\(#zg-game-overlay\.open:not\(\.manual-bridge-hidden\)\) #page-home \.home-particles\s*\{\s*display:\s*none;/,
  'an open full-screen session must stop the hidden home particle layer'
);
assert.match(
  html,
  /#page-home\.particles-live \.home-particle\s*\{\s*animation-play-state:\s*running,\s*running,\s*running;/,
  'home particles must still run when the full-screen session is not covering them'
);
assert.match(
  html,
  /v:\s*'2026-08-29\.16',[^\n]*notes:[^\n]*47 декоративных анимаций[^\n]*notesUk:[^\n]*47 декоративних анімацій/,
  'the performance fix must be documented in both locales'
);
assert.match(
  html,
  /\.zg-vtt-scene\.ability-targeting \.zg-vtt-status-vfx[^\n]+animation-play-state:paused!important;will-change:auto!important/,
  'status VFX must stop consuming animation frames while the targeting surface is active'
);
assert.match(
  html,
  /body:has\(\.zg-vtt-scene\.ability-targeting\) \.zg-vtt-status-vfx/,
  'portrait status VFX must pause together with scene tokens while the player aims'
);
assert.match(
  html,
  /html\.zg-movement-targeting \.zg-vtt-status-vfx/,
  'status VFX must pause while the player aims a movement destination'
);
assert.match(
  html,
  /v:\s*'2026-08-29\.24',[^\n]*notes:[^\n]*большим количеством жетонов[^\n]*notesUk:[^\n]*великою кількістю жетонів/,
  'the dense-scene movement fix must be documented in Russian and Ukrainian'
);
assert.match(
  html,
  /v:\s*'2026-08-29\.23',[^\n]*notes:[^\n]*GPU-transform[^\n]*notesUk:[^\n]*GPU-transform/,
  'the targeting performance fix must be documented in Russian and Ukrainian'
);

console.log('session-background-performance.test.js: all assertions passed');
