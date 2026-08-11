'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

// The temporary token-click QA panel was superseded by the settings playback
// lab. Keep the legacy assertions below for old builds, while verifying that
// the replacement owns one shared runtime instead of restoring a second DOM FX
// pipeline beside the production Canvas renderer.
if (/id='zg-combat-fx-browser'|overlay\.id='zg-combat-fx-browser'/.test(html)) {
  assert.doesNotMatch(html, /id="zg-qa-fx-panel"/, 'the superseded GM-only sandbox must not coexist with the playback lab');
  assert.match(html, /class="zg-combat-fx-open" onclick="zgCombatFxBrowserOpen\(\)"/, 'settings expose the replacement animation lab');
  assert.match(html, /ZargotaCombatVfxRuntime\.createRuntime\(\)/, 'preview and live effects share the bounded runtime');
  assert.match(html, /ZargotaCombatVfxCanvas\.createEngine/, 'mass particles and projectiles use the shared Canvas engine');
  assert.match(html, /zgSchedulePlaybackCleanup\(event,'settings-preview'/, 'preview cleanup uses the shared timer director');
  assert.match(html, /w\.zgGmVisualIntensity=function\(intensity\)\{if\(\['soft','normal','strong'\]/, 'GM preview keeps all three intensity levels');
  console.log('QA effects playback-lab replacement contract passed');
  process.exit(0);
}

assert.match(html, /id="zg-qa-fx-panel"/, 'the temporary effects sandbox must exist');
assert.match(html, /id="zg-gm-qa-tools"[^>]*onclick="zgQaFxOpenFromGmPanel\(event\)"/, 'the sandbox must open from the GM panel gear');
assert.doesNotMatch(html, /id="zg-game-qa-tools"/, 'regular player-facing settings must not contain the GM effects sandbox entry');
assert.doesNotMatch(html, /id="zg-qa-fx-toggle"/, 'the sandbox must not leave a second floating launcher beside the GM panel');
assert.match(html, /function qaFxEnabled\(\)\{try\{return !!\(state&&state\.session&&state\.session\.role==='master'\)/, 'the sandbox must remain master-only while being available outside qa_scene');
assert.doesNotMatch(html, /function qaFxEnabled\(\)[^{]*\{[^}]*qa_scene/, 'GM access to the effects sandbox must not depend on a QA URL flag');
assert.match(html, /w\.zgQaFxAccessSync=function/, 'role changes must immediately remove unauthorized QA controls and selection art');
assert.match(html, /id="zg-gm-qa-tools"[^>]*hidden/, 'the GM-panel gear must be hidden before the master QA role is confirmed');
assert.match(html, /#zg-gm-qa-tools\[hidden\]\{display:none!important\}/, 'GM header display rules must not override the hidden attribute');
assert.match(html, /w\.zgQaFxOpenFromGmPanel=function\(event\)/, 'the GM panel must own the QA sandbox launcher');
assert.match(html, /zgGmInterventionMinimize\(null,true\)/, 'opening the sandbox must collapse the GM panel into its movable orb');
assert.match(html, /button\.hidden=visible/, 'the top GM launcher must disappear while the movable panel or orb is active');
assert.match(html, /\.zg-gm-intervention-button\[hidden\]\{display:none!important\}/, 'compact GM toolbar styles must respect the single-launcher hidden state');
assert.match(html, /onclick="zgGmInterventionLaunch\(event\)"/, 'the top GM launcher must convert into the movable orb instead of opening a duplicate control');
assert.match(html, /w\.zgGmInterventionLaunch=function\(ev\)[\s\S]*zgGmInterventionToggle\(null,true\);[\s\S]*zgGmInterventionMinimize\(null,true\)/, 'launching the GM panel must immediately enter its single movable-orb state');
assert.match(html, /w\.zgQaFxRememberAttacker=function/, 'the sandbox must keep a separate attacker slot');
assert.match(html, /w\.zgQaFxAction=function/, 'the sandbox must expose reusable effect actions');
assert.match(html, /document\.addEventListener\('pointerdown'.*\.zg-vtt-token/s, 'an open sandbox must select map tokens directly');
assert.match(html, /zgQaFxAction\('downed'\)/);
assert.match(html, /zgQaFxAction\('revive'\)/);
assert.match(html, /zgQaFxAction\('life'\)/);
assert.match(html, /zgQaFxAction\('death'\)/);
assert.match(html, /zgQaFxAction\('roll-20'\)/);
assert.match(html, /id="zg-qa-fx-status"/, 'the sandbox must expose the status preview selector');
assert.match(html, /w\.zgQaFxPreviewStatus=function/, 'status previews must reuse the token visual layer');
assert.match(html, /function qaFxSelectedNode\(\)/, 'status previews must recover the selected map token after a scene rerender');
assert.match(html, /classList\.add\('qa-fx-status-preview','is-vfx-visible'\)/, 'repeating a status must start its visual immediately without waiting for observer timing');
assert.match(html, /w\.zgPreviewTokenStatusVisual=function/, 'the scene renderer must publish one safe status-preview bridge');
assert.match(html, /w\.zgPreviewTokenStatusVisual&&w\.zgPreviewTokenStatusVisual\(node,qaFxStatusPreviewKey\)/, 'the QA sandbox must call the public bridge instead of private scene helpers');
assert.match(html, /var qaFxSelectedRef=null,qaFxAttackerRef=null,qaFxStatusPreviewKey=''/, 'the selected local status must survive routine scene patches');
assert.match(html, /w\.zgQaFxRestoreStatusPreview=function/, 'the scene runtime must be able to restore a selected preview after token DOM replacement');
assert.match(html, /\.zg-vtt-token-status-visuals:not\(\.qa-fx-status-preview\)/, 'persistent status refresh must not delete the local QA preview');
assert.match(html, /if\(w\.zgQaFxRestoreStatusPreview\)w\.zgQaFxRestoreStatusPreview\(node,token\)/, 'runtime token patches must reattach the local preview when needed');
assert.match(html, /Сначала кликните по жетону на карте/, 'a missing QA target must be explained instead of failing silently');
assert.match(html, /id="zg-qa-fx-projectile"/, 'the sandbox must expose ranged, thrown and magic effects');
assert.match(html, /w\.zgQaFxProjectile=function/, 'the sandbox must play the full attacker-to-target projectile sequence');
assert.match(html, /w\.zgQaFxMagicCast=function/, 'the sandbox must preview casting separately');
[
  'stun','freeze','paralyze','restrain','prone','fear','blind','charm','dominate','confusion',
  'burn','poison','bleed','slow','curse','exhausted','silence','anchor','invisible','regen','shield','rage','fly'
].forEach(function(key){ assert.match(html,new RegExp('<option value="'+key+'">'),key+' must be available in the QA selector'); });
assert.doesNotMatch(html, /images\/vtt-effects\/status-overlays\//, 'discarded status artwork must not remain wired');
assert.match(html, /images\/vtt-effects\/hits-v3\/cleave-a\.png/, 'first cleave variant must be wired');
assert.match(html, /images\/vtt-effects\/hits-v3\/cleave-b\.png/, 'second cleave variant must be wired');
assert.match(html, /images\/vtt-effects\/hits-v3\/cleave-c\.png/, 'third cleave variant must be wired');
assert.match(html, /function hitFxHash\(/, 'networked hits must derive a deterministic direction locally');
assert.match(html, /\(hash>>>8\)%HIT_FX_ASSETS\.length/, 'the event hash must also select the same art variant on both clients');
assert.match(html, /function hitFxIncomingAngle\(attacker,node,hash\).*getBoundingClientRect/s, 'hit direction must follow the attacker-to-target screen vector');
assert.match(html, /@keyframes zgHitFxSlash[^}]*clip-path:inset\(0 100% 0 0\)/, 'the cleave must reveal from the attacker-facing side instead of appearing as a static overlay');
assert.match(html, /--hit-scale-x/, 'each hit must receive a small deterministic deformation');
assert.match(html, /index<4/, 'each hit may add only four lightweight sparks');
assert.match(html, /while\(active\.length>=8\)/, 'hit effects must cap concurrent DOM nodes');
assert.match(html, /while\(active\.length>=10\)/, 'projectile effects must cap concurrent DOM nodes');
assert.match(html, /function combatProjectileDescriptor\(/, 'live combat must infer ranged and magic visuals from existing event data');
assert.match(html, /выстрел\|стрел\|болт/, 'ranged inference must recognize common Russian weapon names in both attack and damage events');
assert.match(html, /playProjectileFx\(attacker,target,projectile\.family/, 'live ranged attacks must fly from attacker to target');
assert.match(html, /function playProjectileDamageFx\(/, 'ranged damage must use a directional puncture response instead of a melee cleave');
assert.match(html, /if\(damageProjectile\)playProjectileDamageFx/, 'the damage phase must preserve the ranged visual family');
assert.doesNotMatch(html, /family==='physical'&&options\.strong\)playHitFx/, 'critical arrows must not add a melee heavy slash after impact');
assert.match(html, /КРИТИЧЕСКИЙ ВЫСТРЕЛ/, 'the QA label must describe a ranged critical rather than a generic melee blow');
assert.match(html, /playProjectileFx\(actorNode,target,'magic'/, 'live abilities must use the magic cast-flight-impact sequence');
assert.doesNotMatch(html, /event\.id\+'\:attack\:'/,'the hit-confirmation phase must not play a physical impact before damage dice');
assert.ok(html.includes("String(event.targetKey||''),attacker)"), 'networked attack and damage visuals must pass their attacker into the hit renderer');
assert.match(html, /damageLight: function/, 'light damage must have a distinct sound');
assert.match(html, /damageMedium: function/, 'medium damage must have a distinct sound');
assert.match(html, /damageHeavy: function/, 'heavy damage must have a distinct sound');
assert.match(html, /function claimCombatVisualEvent\(eventId\)/, 'live combat visuals must retain a bounded registry of recently handled event ids');
assert.match(html, /if\(!claimCombatVisualEvent\(event\.id\)\)/, 'a delayed watcher must not replay an older combat event');
assert.match(html, /if\(isDamage&&!event\.zeroHp&&!damageProjectile\)/, 'lethal and projectile damage must not stack a second generic impact sound');
assert.match(html, /function combatDamagePresentationGate\(snapshot\)/, 'damage presentation must have an explicit reveal-time gate');
assert.match(html, /processOwnApprovedAttackResult\(\);[\s\S]*requestAnimationFrame\(renderRollAnimations\);[\s\S]*return;/, 'the damage die must animate while HP and blood rendering remain deferred');
assert.match(html, /projectile=!isDamage&&!hit\?attackProjectile:null/, 'a confirmed hit must defer projectile impact until the damage phase');
assert.match(html, /attacker&&!isDamage&&hit&&!attackProjectile/, 'ranged hits must not stack the melee lunge after their projectile');
assert.match(html, /projectileLaunch: function\(family,key,strong\)/, 'projectiles must have a launch sound selected by family');
assert.match(html, /projectileImpact: function\(family,key,strong\)/, 'projectiles must have a non-metallic impact sound selected by family and key');
assert.match(html, /projectileMiss: function\(family\)/, 'projectile misses must not reuse a melee impact');
var soundOutcomeBlock=html.slice(html.indexOf('// ═══ Исходы атаки ═══'),html.indexOf('// ═══ Heal / Damage ═══'));
assert.doesNotMatch(soundOutcomeBlock,/hit: function\(\) \{\s*playSample\('hitArmor'/, 'ordinary hits must not always sound like metal armor');
assert.match(html, /combat-damage-light/);
assert.match(html, /combat-damage-medium/);
assert.match(html, /combat-damage-heavy/);

var qaStart = html.indexOf('var qaFxSelectedRef=');
var qaEnd = html.indexOf('function animateCombatVisual()', qaStart);
assert.ok(qaStart >= 0 && qaEnd > qaStart, 'QA effect implementation must remain locally auditable');
var qaBlock = html.slice(qaStart, qaEnd);
assert.doesNotMatch(qaBlock, /ZargotaRooms|firebase|roomRef|updateRoom/, 'QA effects must never write shared room state');
assert.doesNotMatch(qaBlock, /normalizeStatusDisplayKey|statusDisplayDefinition|appendTokenStatusVisuals|tokenStatusVisualObserver/, 'the QA sandbox must not reach into another module private scope');
assert.match(qaBlock, /zgRenderLocalDiceThrow/, 'QA dice must use the client-only visual renderer');
assert.doesNotMatch(qaBlock, /createElement\('i'\).*particle/s, 'QA hit effects must not build per-hit particle clouds');

var projectileAssets={
  'physical.png':[1024,512],
  'magic-cast.png':[1024,512],
  'magic-flight-impact.png':[1024,1024]
};
Object.keys(projectileAssets).forEach(function(name){
  var assetPath=path.resolve(__dirname,'..','images','vtt-effects','projectiles-v1',name),png=fs.readFileSync(assetPath),expected=projectileAssets[name];
  assert.strictEqual(png.toString('ascii',1,4),'PNG',name+' must be a PNG');
  assert.strictEqual(png.readUInt32BE(16),expected[0]);
  assert.strictEqual(png.readUInt32BE(20),expected[1]);
  assert.strictEqual(png[25],6,name+' must retain RGBA transparency');
  assert.match(html,new RegExp('images/vtt-effects/projectiles-v1/'+name.replace('.','\\.')));
});
['arrow','bolt','shot','javelin','knife','axe','flask','shard'].forEach(function(key){assert.match(html,new RegExp("'"+key+"'"));});
['fire','frost','lightning','acid','shadow','radiant','arcane','nature'].forEach(function(key){assert.match(html,new RegExp("'"+key+"'"));});

['arrow','bolt','javelin','knife'].forEach(function(key){
  ['flight','impact'].forEach(function(phase){
    var name=key+'-'+phase+'.png',assetPath=path.resolve(__dirname,'..','images','vtt-effects','projectiles-v2',name),png=fs.readFileSync(assetPath);
    assert.strictEqual(png.toString('ascii',1,4),'PNG',name+' must be a PNG');
    assert.strictEqual(png.readUInt32BE(16),512,name+' width');
    assert.strictEqual(png.readUInt32BE(20),256,name+' height');
    assert.strictEqual(png[25],6,name+' must retain RGBA transparency');
    assert.match(html,new RegExp('images/vtt-effects/projectiles-v2/'));
  });
});
assert.match(html, /class="zg-projectile-lodged"/, 'a successful physical projectile must remain visibly embedded during impact');
assert.match(html, /--impact-angle/, 'the embedded projectile must follow the real attacker-to-target angle');
assert.match(html, /function tokenEffectSize\(node\)/, 'all token effects must share one token-size metric');
assert.match(html, /node\.style\.setProperty\('--zg-token-size',Math\.max\(24,Number\(token\.size\)\|\|64\)\+'px'\)/, 'rendered tokens must publish their actual diameter to child effects');
assert.match(html, /sizeDrag\.node\.style\.setProperty\('--zg-token-size',ns\+'px'\)/, 'effect scale must follow live token resizing');
assert.match(html, /root\.style\.setProperty\('--zg-fx-token-size',effectTokenSize\+'px'\)/, 'flight art must scale from the participating tokens');
assert.match(html, /impact\.style\.setProperty\('--zg-fx-token-size',to\.size\+'px'\)/, 'impact art must scale from the target token');
assert.match(html, /\.zg-vtt-token \.zg-death-coin-result\{width:calc\(var\(--zg-token-size\) \* 1\.12\)/, 'death result art must remain proportional to the token');
assert.match(html, /\.zg-projectile-lodged\{width:calc\(var\(--zg-fx-token-size,64px\) \* 1\.85\)/, 'embedded projectiles must remain compact and proportional to the target token');

console.log('QA effects sandbox contract passed');
