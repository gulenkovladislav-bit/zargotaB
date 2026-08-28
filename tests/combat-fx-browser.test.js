const assert = require('assert');
const fs = require('fs');
const path = require('path');
const presets = require('../combat-vfx-presets.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const catalogStart = html.indexOf('  var COMBAT_FX_PRESETS=w.ZargotaCombatVfxPresets');
const catalogEnd = html.indexOf('  applyReducedEffects();', catalogStart);
const browser = html.slice(catalogStart, catalogEnd);

assert.ok(catalogStart >= 0 && catalogEnd > catalogStart, 'animation browser must remain extractable');

const runtimeAssetVersions = [
  'combat-playback',
  'combat-vfx-presets',
  'combat-vfx-runtime',
  'combat-vfx-canvas'
].map(name => {
  const match = html.match(new RegExp(`<script src="${name}\\.js\\?v=([^"]+)"></script>`));
  assert.ok(match, `${name} must be loaded with an explicit cache key`);
  return match[1];
});
assert.deepStrictEqual(
  Array.from(new Set(runtimeAssetVersions)),
  ['2026-08-28.3'],
  'playback and VFX modules must advance together so clients cannot mix stale runtimes'
);

const presetKeys = presets.list().map(preset => preset.key);
assert.deepStrictEqual(presetKeys, [
  'slash', 'critical', 'projectile', 'fire-projectile', 'miss', 'block',
  'arcane', 'fire', 'lightning', 'psychic', 'hypnosis', 'curse-break',
  'blood-transfer', 'lightning-spear', 'necro', 'heal', 'cleanse', 'movement', 'mist-teleport'
], 'the settings catalog covers combat, spells, support, and movement');

assert.match(html, /class="zg-combat-fx-open" onclick="zgCombatFxBrowserOpen\(\)"/, 'settings expose the animation browser');
assert.match(browser, /var COMBAT_FX_PRESETS=w\.ZargotaCombatVfxPresets\?w\.ZargotaCombatVfxPresets\.list\(\):\[\]/, 'browser consumes the shared preset catalog');
assert.match(browser, /var combatVfxRuntime=w\.ZargotaCombatVfxRuntime\?w\.ZargotaCombatVfxRuntime\.createRuntime\(\):null/, 'browser uses the shared VFX runtime');
assert.match(browser, /var combatFxCanvas=combatVfxRuntime&&w\.ZargotaCombatVfxCanvas\?w\.ZargotaCombatVfxCanvas\.createEngine/, 'browser owns one shared Canvas engine');
assert.match(browser, /var combatFxPreview=\{key:'preset:slash',sound:false/, 'preview sound is opt-in and the selected item points at the live registry');
assert.match(browser, /function combatFxLiveCatalog\(\)/, 'the browser builds its list from live effect sources');
assert.match(browser, /gmStatusCatalog\(\).*type:'status'/s, 'active status definitions join the live catalog');
assert.match(browser, /GM_VISUAL_CATALOG.*type:'gm'/s, 'GM token and scene effects join the live catalog');
assert.match(browser, /type:'authored'.*playAuthoredMeleeImpact/s, 'authored melee artwork uses the same renderer as combat');

const previewStart = browser.indexOf('  w.zgCombatFxPreviewPlay=function()');
const previewEnd = browser.indexOf('  function renderCombatFxBrowser()', previewStart);
const preview = browser.slice(previewStart, previewEnd);
assert.match(preview, /quality=combatQualityResolve\('balanced'\)/, 'preview reads the effective live client quality');
assert.match(preview, /combatVfxRuntime\.begin\(event,preset\.id,\{quality:quality,scope:'local-preview',channel:'settings-preview'\}\)/, 'preview obtains every preset through the shared runtime');
assert.match(preview, /combatFxCanvas\.play\(handle,stage,/, 'all preset silhouettes use the same Canvas engine as live combat');
assert.match(preview, /appendTokenStatusVisuals\(target/, 'status previews mount the real status surface renderer');
assert.match(preview, /animateGmVisualEvent\(event,\{target:target,scene:stage,preview:true\}\)/, 'GM previews invoke the real presentation adapter against the local stage');
assert.match(preview, /playCombatTokenStrike\(event,actor,target\)/, 'melee previews reuse the live token strike movement');
assert.match(html, /function playCombatTokenStrike\(event,attacker,target\)/, 'token movement has one shared presentation adapter');
assert.match(html, /!isDamage&&hit&&target&&combatAuthoredImpactFamily\(event\)==='melee'\)playCombatTokenStrike\(event,attackingToken,target\)/, 'the same adapter drives live melee hits');
assert.doesNotMatch(browser, /function combatFxSampleMarkup/, 'the old parallel DOM imitation is removed');
assert.match(preview, /w\.zgSchedulePlaybackCleanup\(event,'settings-preview',2400/, 'preview cleanup uses the exported shared playback timer queue');
assert.doesNotMatch(preview, /setTimeout\(/, 'preview cannot create private cleanup timers');
assert.match(html, /w\.zgSchedulePlaybackCleanup=schedulePlaybackCleanup;/, 'shared cleanup scheduler is exported across the player and combat scopes');

assert.match(browser, /cue==='damage'.*ZargotaSound\.damage/s, 'damage preview keeps semantic sound routing');
assert.match(browser, /cue==='heal'.*ZargotaSound\.heal/s, 'healing preview keeps semantic sound routing');
assert.match(browser, /cue==='cleanse'.*ZargotaSound\.statusCleanse/s, 'cleanse preview keeps semantic sound routing');
assert.match(browser, /data-fx-quality="high".*data-fx-quality="balanced".*data-fx-quality="low"/s, 'high, balanced, and low are shown side by side');
assert.match(browser, /data-fx-motion="dynamic".*data-fx-motion="anchored".*data-fx-motion="minimal"/s, 'live motion modes are controlled from the lab');
assert.match(browser, /w\.zgCombatFxQuality=function\(value\)\{w\.zgCombatQualitySet\(value\)/, 'quality buttons change the actual client setting');
assert.match(browser, /w\.zgCombatFxMotion=function\(value\)\{w\.zgCombatMotionSet\(value\)/, 'motion buttons change the actual client setting');
const qualitySelectorStart = browser.indexOf('  w.zgCombatFxQuality=function(value)');
const qualitySelectorEnd = browser.indexOf('  w.zgCombatFxSoundToggle=', qualitySelectorStart);
assert.doesNotMatch(browser.slice(qualitySelectorStart, qualitySelectorEnd), /Firebase|ZargotaRooms|gmBroadcast|combatVisual/i, 'quality comparison cannot broadcast or mutate room state');

assert.match(html, /\.zg-combat-vfx-canvas\{position:absolute;z-index:4;/, 'Canvas is one isolated scene overlay');
assert.match(html, /@media\(max-width:720px\).*\.zg-combat-fx-layout\{grid-template-columns:1fr/s, 'browser adapts to narrow screens');
assert.match(html, /html\.zg-combat-motion-anchored \.zg-vtt-token\.combat-token-strike/, 'anchored motion keeps only a restrained strike response');
assert.match(html, /html\.zg-combat-motion-minimal \.zg-vtt-token\.combat-token-strike\{animation:none\}/, 'minimal motion disables the token lunge everywhere');
assert.doesNotMatch(browser, /<(?:video|img)\b/i, 'preview effects stay code-native and do not load heavy media');

console.log('combat FX browser contract passed');
