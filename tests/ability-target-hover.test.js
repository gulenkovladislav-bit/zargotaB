'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /targetHover: function\(\) \{[\s\S]*?vol:0\.045[\s\S]*?group:'ui'/, 'ability hover uses a dedicated quiet local UI cue');
assert.match(html, /if\(nextId===abilityHoverTokenId\)return;/, 'pointer movement over the same token cannot replay the cue');
assert.match(html, /if\(now-abilityHoverSoundAt<120\)return;/, 'rapid movement across crowded targets is rate limited');
assert.match(html, /node\.classList\.add\('zg-ability-target-hover'\)/, 'the hovered valid token receives an explicit visual state');
assert.match(html, /abilityTargetPreviewPending=\{clientX:ev\.clientX,clientY:ev\.clientY,hover:ev\.target&&ev\.target\.closest&&ev\.target\.closest\('\.zg-vtt-token\.zg-ability-target-valid'\)\}/, 'ability targeting captures the actual valid token under the pointer');
assert.match(html, /syncAbilityTargetHover\(pending\.hover\)/, 'the coalesced targeting frame synchronizes that token once');
assert.match(html, /syncAbilityTargetHover\(null\);\s*clearToolRangeVector/, 'leaving the scene clears the hover state');
assert.match(html, /\.zg-vtt-token\.zg-ability-target-hover\{[^}]*animation:zgAbilityTargetHover/, 'hovered targets use the new pulse animation');
assert.match(html, /@keyframes zgAbilityTargetHover\{[^}]*scale\(1\.065\)[\s\S]*?scale\(1\.105\)/, 'the optimized pulse remains a subtle token enlargement');

console.log('ability target hover contract passed');
