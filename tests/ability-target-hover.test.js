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
assert.match(html, /configureTargetCount=Math\.max\(1,Number\(profile\.targetCount\)\|\|1\)[\s\S]*?'Выбрать '\+configureTargetCount\+' цели'/, 'multi-target spell setup states that two targets are required before selection begins');
assert.match(html, /function abilityTargetAvailability\(token,actor,profile,selections\)[\s\S]*?if\(firstToken&&abilityTargetDistance\(firstToken,token\)>1\)return\{available:false/, 'after the first sweeping or storm target only adjacent second targets remain available');
assert.match(html, /if\(!firstToken\)\{var partnerReady=\(draft\.tokens\|\|\[\]\)\.some[\s\S]*?if\(!partnerReady\)return\{available:false/, 'an isolated token is not offered as the first target of a required adjacent pair');
assert.match(html, /__zgAbilityTargetClickBound[\s\S]*?completeAbilityTarget\(\{x:clamp\(target\.x,0,100\),y:clamp\(target\.y,0,100\)\},target\)/, 'each target token keeps a direct click fallback when transformed scene bubbling is unreliable');
assert.match(html, /class="zg-ability-target-quick"[\s\S]*?zgSceneAbilityPickToken\(this\.dataset\.tokenId\)/, 'the second-target stage exposes fixed-screen buttons that do not depend on transformed map hit testing');
assert.match(html, /w\.zgSceneAbilityPickToken=function\(tokenId\)[\s\S]*?completeAbilityTarget/, 'fixed-screen target buttons resolve the exact token through the shared target flow');
assert.match(html, /Нет подходящей пары: нужны два соседних врага в пределах дальности/, 'the targeting HUD explains when no valid adjacent pair exists');
assert.match(html, /Первая цель: '[^]*после 2\/2 заявка сразу уйдёт мастеру/, 'the targeting HUD explains why the request is not sent after the first target');
assert.match(html, /Первая цель выбрана: '[^]*после 2\/2 заявка уйдёт мастеру/, 'the first target also produces an explicit player notice');
assert.match(html, /2\/2 цели выбраны · отправляем заявку мастеру/, 'the completed pair immediately reports request delivery');
assert.match(html, /\.zg-ability-target-hud\.awaiting-second\{[^}]*border-color:#71ca92/, 'the second-target stage is visually distinct');
assert.match(html, /\.zg-ability-target-hud\.unavailable\{[^}]*border-color:#bb7147/, 'the no-valid-pair state is visually distinct');
assert.match(html, /spellRestriction=abilityTargeting&&abilityTargeting\.source==='spell-playback'\?spellPlaybackTargetRestriction/, 'manual spell targeting dims targets rejected by the spell-specific rules before selection');
assert.match(html, /abilityTargeting\.lastError=targetError;renderAbilityTargeting\(\);setStatus\(targetError\)/, 'an invalid target keeps its exact reason in the targeting HUD and scene status');
assert.match(html, /if\(noPairAvailable\|\|abilityTargeting\.lastError\)hud\.classList\.add\('unavailable'\)/, 'persistent target errors receive the visible unavailable HUD treatment');
assert.match(html, /function updateAbilityAreaTargets\(point,actor,profile,preview\)/, 'point targeting computes a live preview of every token inside the AOE shape');
assert.match(html, /node\.classList\.add\(allowed\?'zg-ability-area-included':'zg-ability-area-excluded'\)/, 'AOE preview visibly distinguishes affected and excluded tokens');
assert.match(html, /class="zg-ability-area-count" aria-live="polite"/, 'the targeting HUD exposes a live accessible AOE target count');
assert.match(html, /abilityTargeting\.lastError=rangeError;renderAbilityTargeting\(\);setStatus\(rangeError\)/, 'an out-of-range point leaves an explicit persistent reason instead of failing silently');
assert.match(html, /\.zg-ability-point-preview\.out-of-range\{[^}]*border-color:#d56f52/, 'an out-of-range AOE preview is visually distinct');

console.log('ability target hover contract passed');
