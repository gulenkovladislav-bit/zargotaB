'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const automation = require('../spell-automation.js');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'zargota-i18n.js'), 'utf8');

function sequence(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const profiles = automation.catalog();
assert.strictEqual(automation.version, 8);
assert.strictEqual(profiles.length, 19, 'the playback catalog contains nineteen reviewed spells and abilities');
assert.strictEqual(new Set(profiles.map(profile => profile.catalogId)).size, 19, 'every playback spell points to a different catalog entry');

const finger = automation.resolve({name:'✴ Жар Пальцев'});
const heal = automation.resolve({name:'🖐️ Касание Спасения'});
const fireball = automation.resolve({name:'✴ Огненный снаряд'});
const lasso = automation.resolve({name:'✴ Лассо Молнии'});
const summon = automation.resolve({name:'☠ Призыв Нежити'});
const pseudoLife = automation.resolve({name:'Псевдожизнь'});
const energyWard = automation.resolve({name:'Защита от Энергии'});
const silence = automation.resolve({name:'Печать Молчания'});
const mist = automation.resolve({name:'Туманный Переход'});
const gravity = automation.resolve({name:'Центр Притяжения'});
const psychic = automation.resolve({name:'Психический Визг'});
const hypnosis = automation.resolve({name:'Гипнотический Узор'});
const removeCurse = automation.resolve({name:'Снятие Проклятья'});
const lifeTransfer = automation.resolve({name:'Передача Жизни'});
const heavenlySpear = automation.resolve({name:'Копьё Небесного Прорыва'});
const retaliationSpike = automation.resolve({name:'🛡Ответный Шип'});
const sweepingStrike = automation.resolve({name:'⚔️ Размашистый удар'});
const stormArrow = automation.resolve({name:'🌪 Стрела-буря'});
const rotRay = automation.resolve({name:'☠ Луч Гнили'});
assert.deepStrictEqual([finger.effectKind, heal.effectKind, fireball.targetMode, lasso.effectKind, summon.effectKind], ['damage','heal','area','control','summon']);
assert.deepStrictEqual([pseudoLife.effectKind, energyWard.effectKind, silence.zoneKind, mist.effectKind, gravity.saveStat], ['temp_hp','buff','silence','movement','str']);
assert.deepStrictEqual([psychic.actionCost, hypnosis.areaMode, removeCurse.effectKind, lifeTransfer.sourceDamageFormula, heavenlySpear.areaMode], ['short','square','cleanse','2d8','line']);
assert.deepStrictEqual([retaliationSpike.triggeredOnly,retaliationSpike.actionCost,retaliationSpike.maxUses,retaliationSpike.weaponMode,retaliationSpike.nextTurnLongActionDebt], [true,'reaction',2,'main',1]);
assert.deepStrictEqual(retaliationSpike.learningPlan.checks[0], {statOptions:['con'],dc:12,successesRequired:2});
assert.deepStrictEqual(retaliationSpike.statuses, [], 'the lost next action is combat economy debt, not a legacy status');
assert.deepStrictEqual([sweepingStrike.targetCount,sweepingStrike.weaponMode,sweepingStrike.damageSplit,sweepingStrike.maxUses], [2,'two-handed-melee','ceil-half-per-target',1]);
assert.deepStrictEqual(sweepingStrike.learningPlan.failure.temporaryEffects.map(effect => [effect.kind,effect.until]), [['attack-penalty','next-attack'],['initiative-penalty','rest']]);
assert.deepStrictEqual(automation.statusPolicy(sweepingStrike), {mode:'none',keys:[],removes:[]}, 'the learning penalties do not become an unofficial or overbroad condition');
assert.deepStrictEqual([stormArrow.targetCount,stormArrow.weaponMode,stormArrow.attackRollMode,stormArrow.damageRollMode,stormArrow.lockRemainingTurn,stormArrow.maxUses], [2,'ranged','disadvantage','disadvantage',true,1]);
assert.deepStrictEqual(stormArrow.learningPlan.checks[0], {statOptions:['dex','per'],choose:'best',dc:11,successesRequired:2});
assert.deepStrictEqual(automation.statusPolicy(stormArrow), {mode:'none',keys:[],removes:[]}, 'storm arrow uses action economy and learning effects, not a fake combat condition');
assert.deepStrictEqual([rotRay.attackStat,rotRay.saveStat,rotRay.saveDC,rotRay.rangeCells,rotRay.maxUses,rotRay.maxUsesPerBattle], ['cha','con',13,3,2,1]);
assert.deepStrictEqual(automation.statusPolicy(rotRay), {mode:'canonical',keys:['poison'],removes:[]}, 'rot ray reuses the official Poisoned status');
assert.match(network, /createRetaliationSpikeRequest\(room,combat,attacker,target,damage,damageEventId,stamp\)/, 'real weapon damage is the trigger source for Retaliation Spike');
assert.match(network, /applyAbilityUsageDomainOperation\(member\.character\.abilityUsage,RETALIATION_SPIKE_KEY[\s\S]*?scopeKind:'battle'/, 'accepting the reaction spends the battle-scoped use atomically');
assert.match(network, /updated\.longActionDebt[\s\S]*?economy\.long=0/, 'the next-turn cost is modeled as one-shot action economy debt');
assert.match(html, /automaticReactionDecisionRequired[\s\S]*?автоматическую реакцию/, 'the combat turn cannot advance past the player reaction choice');
assert.match(html, /АВТОМАТИЧЕСКАЯ РЕАКЦИЯ[\s\S]*?АВТОМАТИЧНА РЕАКЦІЯ/, 'the triggered-only ability is explained in both interface locales');
profiles.forEach(profile => {
  assert.ok(profile.nameUk, profile.name + ' has a Ukrainian name');
  assert.ok(profile.playbackSummary && profile.playbackSummaryUk, profile.name + ' has bilingual playback guidance');
});

const fingerResult = automation.buildPreview(finger, {
  actor:{key:'hero',name:'Маг',stats:{int:3}},
  targets:[{key:'enemy',name:'Враг',ac:12,hp:10,hpMax:10}]
}, sequence([0.85, 0.5])).results[0];
assert.strictEqual(fingerResult.success, true);
assert.strictEqual(fingerResult.total, 21, 'INT is included in the spell attack');
assert.strictEqual(fingerResult.damage, 4);

const healResult = automation.buildPreview(heal, {
  actor:{key:'hero',stats:{int:2}},
  targets:[{key:'ally',name:'Союзник',hp:4,hpMax:10}]
}, sequence([0, 0.25])).results[0];
assert.strictEqual(healResult.roll, null, 'healing does not invent an attack roll');
assert.strictEqual(healResult.heal, 3);
assert.strictEqual(healResult.hp, 7);

const failedSave = automation.buildPreview(fireball, {
  actor:{key:'hero',stats:{int:3}},
  targets:[{key:'enemy',name:'Враг',stats:{dex:0},hp:20,hpMax:20}]
}, sequence([0, 0, 0, 0])).results[0];
assert.strictEqual(failedSave.success, false, 'success means the target passed its save');
assert.strictEqual(failedSave.damage, 3);
const passedSave = automation.buildPreview(fireball, {
  actor:{key:'hero',stats:{int:3}},
  targets:[{key:'enemy',name:'Враг',stats:{dex:0},hp:20,hpMax:20}]
}, sequence([0, 0, 0, 0.99])).results[0];
assert.strictEqual(passedSave.success, true);
assert.strictEqual(passedSave.damage, 1, 'a successful DEX save halves fireball damage');
const sharedBlast = automation.buildPreview(fireball, {
  actor:{key:'hero',stats:{int:3}},
  targets:[
    {key:'enemy-a',name:'Первая цель',stats:{dex:0},hp:20,hpMax:20},
    {key:'enemy-b',name:'Вторая цель',stats:{dex:0},hp:20,hpMax:20}
  ]
}, sequence([0, 0.2, 0.4, 0, 0.99])).results;
assert.deepStrictEqual(sharedBlast[0].damageRolls, sharedBlast[1].damageRolls, 'one AOE explosion shares a single damage roll across every target');
assert.strictEqual(sharedBlast[0].damage, 6);
assert.strictEqual(sharedBlast[1].damage, 3, 'the successful save halves the same shared explosion roll');

const lassoResult = automation.buildPreview(lasso, {
  actor:{key:'hero',stats:{int:3}},
  targets:[{key:'enemy',name:'Враг',stats:{str:0},hp:12,hpMax:12}]
}, sequence([0])).results[0];
assert.strictEqual(lassoResult.success, false);
assert.deepStrictEqual(lassoResult.statuses, ['restrain']);
assert.strictEqual(lasso.playbackVariants.find(variant => variant.key === 'pull').pullCells, 2);
assert.deepStrictEqual(summon.summonVariants.map(variant => [variant.key, variant.maxCount]), [['skeleton',3],['fresh-undead',1]]);

const rotResult = automation.buildPreview(rotRay, {
  actor:{key:'hero',stats:{cha:3}},
  targets:[{key:'enemy',name:'Враг',ac:12,stats:{con:0},hp:12,hpMax:12}]
}, sequence([.8,.3,0,.99])).results[0];
assert.strictEqual(rotResult.success, true, 'rot ray first resolves the CHA attack');
assert.strictEqual(rotResult.damage, 2);
assert.strictEqual(rotResult.conditionalSave.success, false, 'the target then fails its own CON save');
assert.strictEqual(rotResult.statusDuration, 3, 'the visible d6 duration roll is converted to 1d3 by rounding up');
assert.deepStrictEqual(rotResult.statuses, ['poison']);

const stableShell = automation.buildPreview(Object.assign({}, pseudoLife, {tempHpFormula:'',tempHpFixed:4}), {
  actor:{key:'hero'}, targets:[{key:'ally',name:'Союзник',hp:8,hpMax:10,tempHp:2}]
}, sequence([0])).results[0];
assert.strictEqual(stableShell.tempHp, 4);
assert.strictEqual(stableShell.tempHpGain, 2, 'stable pseudolife replaces a weaker shell');
const weakerShell = automation.buildPreview(Object.assign({}, pseudoLife, {tempHpFormula:'',tempHpFixed:4}), {
  actor:{key:'hero'}, targets:[{key:'ally',name:'Союзник',hp:8,hpMax:10,tempHp:5}]
}, sequence([0])).results[0];
assert.strictEqual(weakerShell.tempHp, 5, 'pseudolife never replaces stronger temporary HP');
const rolledShell = automation.buildPreview(pseudoLife, {
  actor:{key:'hero'}, targets:[{key:'ally',name:'Союзник',hp:8,hpMax:10,tempHp:0}]
}, sequence([0, .99])).results[0];
assert.strictEqual(rolledShell.tempHp, 5, '2d4 uses the actual two-die roll');
assert.deepStrictEqual(rolledShell.tempHpRolls, [1,4]);
const cappedShell = automation.buildPreview(pseudoLife, {
  actor:{key:'hero'}, targets:[{key:'ally',name:'Союзник',hp:8,hpMax:10,tempHp:0}]
}, sequence([.99, .99])).results[0];
assert.strictEqual(cappedShell.tempHp, 5, 'temporary HP obey the global 50% maximum-HP cap');
assert.deepStrictEqual(energyWard.energyOptions.map(option => option.key), ['fire','cold','elec','acid','poison','sound']);
assert.strictEqual(energyWard.concentration, true);
assert.strictEqual(silence.durationRounds, 10);
assert.strictEqual(silence.aoeRadius, 5);
assert.strictEqual(mist.actionCost, 'short');
assert.strictEqual(mist.teleportCells, 10);
assert.strictEqual(gravity.collisionDamageFormula, '1d6');
assert.strictEqual(gravity.pullCells, 5);
assert.deepStrictEqual(automation.statusPolicy(lasso), {mode:'canonical',keys:['restrain'],removes:[]}, 'lasso reuses the manual immobilized status');
assert.deepStrictEqual(automation.statusPolicy(silence), {mode:'canonical',keys:['silence'],removes:[]}, 'silence seal reuses magical silence');
assert.deepStrictEqual(automation.statusPolicy(removeCurse), {mode:'canonical',removes:['curse'],keys:[]}, 'remove curse targets the canonical curse status');
assert.deepStrictEqual(
  [energyWard,mist,psychic,hypnosis].map(profile => {
    const decision = automation.statusPolicyAudit(profile).decisions[0];
    return [decision.mode, decision.key, decision.closestCanonical, decision.reason];
  }).concat(automation.statusPolicyAudit(heavenlySpear).decisions.map(decision => [decision.mode,decision.key,decision.closestCanonical,decision.reason])),
  [
    ['custom','energy-ward','shield','elemental-resistance-not-ac'],
    ['custom','smoke-disadvantage','blind','attack-disadvantage-only'],
    ['custom','psychic-screech','curse','single-rolled-attack-penalty'],
    ['custom','hypnotic-trance','stun','breaks-on-damage-and-melee-only-advantage'],
    ['custom','reaction-lock','stun','reaction-only-lock'],
    ['custom','electric-spell-lock','silence','electric-spells-only']
  ],
  'every custom spell status records why the closest manual status would change its rules'
);

const psychicResult = automation.buildPreview(psychic, {
  actor:{key:'hero',stats:{int:3}}, targets:[{key:'enemy',stats:{int:0},hp:12,hpMax:12}]
}, sequence([0,.5])).results[0];
assert.strictEqual(psychicResult.success, false);
assert.strictEqual(psychicResult.attackPenalty, 4, 'psychic screech records one concrete next-attack penalty');
assert.deepStrictEqual(psychicResult.statuses, ['psychic-screech']);

const hypnosisResult = automation.buildPreview(hypnosis, {
  actor:{key:'hero',stats:{int:3}}, targets:[{key:'enemy',stats:{int:1,cha:4},hp:12,hpMax:12}]
}, sequence([.4])).results[0];
assert.strictEqual(hypnosisResult.saveStatUsed, 'cha', 'hypnotic pattern uses the target’s better INT/CHA save');
assert.strictEqual(hypnosisResult.success, true);

const cleanseResult = automation.buildPreview(removeCurse, {
  actor:{key:'hero'}, targets:[{key:'ally',statuses:['curse'],hp:8,hpMax:10}]
}, sequence([0])).results[0];
assert.deepStrictEqual(cleanseResult.removedStatuses, ['curse']);

const lifePreview = automation.buildPreview(lifeTransfer, {
  actor:{key:'hero',hp:12,hpMax:12,stats:{int:2}}, targets:[{key:'ally',hp:2,hpMax:20}]
}, sequence([0,0]));
assert.strictEqual(lifePreview.sourceDamage, 4, 'life transfer pays 2d8 + INT from the caster');
assert.strictEqual(lifePreview.sourceAfterHp, 8);
assert.strictEqual(lifePreview.results[0].heal, 8, 'the ally receives twice the HP actually paid');

const spearResult = automation.buildPreview(heavenlySpear, {
  actor:{key:'hero',stats:{int:3}}, targets:[{key:'armored',heavyArmor:true,stats:{dex:0,con:0},hp:30,hpMax:30}]
}, sequence(Array(11).fill(0).concat([.5,0,.99]))).results[0];
assert.strictEqual(spearResult.rollMode, 'disadvantage', 'metal armour automatically imposes disadvantage');
assert.strictEqual(spearResult.damage, 7, 'a failed save uses the reviewed 7d8 damage pool');
assert.ok(spearResult.secondarySave, 'failure by five or more triggers the secondary CON save');

assert.match(html, /id="zg-spell-playback-toggle"/, 'Session mode exposes one compact GM playback button');
assert.match(html, /zg-spell-playback-info-toggle/, 'every GM playback card exposes an explicit read-only details button');
assert.match(html, /w\.zgSpellPlaybackInfo=function/, 'spell details can be toggled without arming or resolving the spell');
assert.match(html, /Ровно 2 соседних врага · не AOE[\s\S]*?С одной целью приём завершить нельзя[\s\S]*?Рівно 2 сусідніх вороги · не AOE[\s\S]*?З однією ціллю прийом завершити не можна/, 'Sweeping Strike explains that it is a two-target technique rather than an AOE');
assert.match(html, /storm-arrow-v1'\)return spellPlaybackText\('По выбранному дальнобойному оружию','За обраною далекобійною зброєю'\)/, 'Storm Arrow help derives range from the selected ranged weapon in both locales');
assert.match(html, /function abilityTargetAvailability\(token,actor,profile,selections\)/, 'target eligibility and its explanation use one shared decision');
assert.match(html, /У этой цели нет второго соседнего врага в пределах дальности/, 'Storm Arrow explains why an isolated first target is unavailable');
assert.match(html, /data-zg-target-reason/, 'every dimmed target retains its exact rejection reason');
assert.match(html, /playbackTargetCount>1\?spellPlaybackText\('Выбрать '\+playbackTargetCount\+' цели','Обрати '\+playbackTargetCount\+' цілі'\)/, 'GM playback asks for the actual multi-target count');
assert.match(html, /Начать проверки и броски','Почати перевірки та кидки/, 'the staged workflow button names the concrete next action in both locales');
assert.match(html, /Полный текст из каталога','Повний текст із каталогу/, 'the details view can reveal the full bilingual catalog text');
assert.match(html, /СПРАВКА · БЕЗ РОЗЫГРЫША','ДОВІДКА · БЕЗ РОЗІГРАШУ/, 'opening help is clearly separated from casting in both locales');
assert.match(html, /w\.zgSpellPlaybackTarget=function/, 'the targeting reticle has a dedicated GM completion path');
assert.match(html, /profile\.playbackMode='instant'/, 'temporary playback deliberately bypasses the future player-die handoff');
assert.match(html, /options\.areaMode=profile\.areaMode\|\|'circle'/, 'AOE playback passes its reviewed circle, square, or line geometry to the canonical resolver');
assert.match(html, /spellPlaybackTargetRestriction/, 'healing restrictions are checked before the room mutation');
assert.match(html, /spellPlaybackResourceState/, 'the panel shows authoritative remaining charges before targeting');
assert.match(html, /summonRequirementsConfirmed/, 'undead playback requires an explicit remains and reagents confirmation');
assert.match(html, /lassoMetalArmor/, 'the lasso flow exposes its metal-armour save disadvantage');
assert.match(html, /function syncDraftCombatRuntimeTokens\(scene,combat,lastMovement,combatEvent\)/, 'authoritative summon and every spell movement can enter the protected GM draft without replacing it');
assert.match(html, /combatEvent&&Array\.isArray\(combatEvent\.movements\)/, 'multi-target gravity movement synchronizes every affected token, not only the first animation');
assert.match(html, /sourceRef\.type==='spell-summon'/, 'summon identity survives scene-token copying');
assert.match(network, /String\(entry\.summonedByUid\|\|''\)===uid/, 'network ownership includes creatures summoned by the player');
assert.match(network, /combatPlayerEntry\(room, user\.uid, requestedParticipantKey\)/, 'movement resolves the exact player-controlled combat participant');
assert.match(network, /participantKey: requestedParticipantKey/, 'movement and action requests preserve the summon participant key');
assert.match(network, /!combatEntryControlledByUid\(activeEntry,user\.uid\)/, 'the summoning player can finish the undead turn');
assert.match(html, /function playerCombatEntry\(order,session,preferTurn,turnIndex\)/, 'the player interface can switch its controlled actor to the active summon');
assert.match(html, /player-summon-controlled/, 'the active player summon receives a visible map selection state');
assert.match(html, /ТВОЙ ПРИЗЫВ','ТВІЙ ПРИКЛИК/, 'the summon control badge is bilingual');
assert.match(html, /participantKey:String\(attacker&&attacker\.key\|\|''\)/, 'player attack requests identify the summoned attacker rather than the hero');
assert.match(html, /id='zg-combat-spell-announcement-layer'/, 'spell announcements render in their own upper overlay layer');
assert.match(html, /'＋'\+tempHp/, 'temporary HP publishes a numeric token label');
assert.match(html, /resolutionMode:publicResolutionMode/, 'QA playback preserves attack, save, and utility result semantics');
assert.match(html, /masterActorKey/, 'the GM spell player accepts an active creature as the caster');
assert.match(html, /currentKey&&currentKey!==spellPlaybackTurnKey/, 'the spell caster follows combat turn changes instead of remaining stuck on the previous creature');
assert.match(html, /network&&network\.room\?network:null/, 'the playback panel has a safe empty snapshot before a room is ready');
assert.doesNotMatch(html.match(/function spellPlaybackSnapshot\(\)[\s\S]*?\n  }/)?.[0] || '', /:state/, 'the scene module cannot fall through to an out-of-scope state variable');
assert.match(network, /playbackMode:String\(details\.playbackMode/, 'Firebase requests preserve the explicit instant-playback mode');
assert.match(network, /member&&member\.character&&member\.character\.abilityUsage/, 'direct GM creature casting does not dereference a missing player member');
assert.match(network, /summonCount:Math\.max\(1,Math\.min\(3/, 'summon count is bounded at the network boundary');
assert.match(network, /summonEntries\.push\(summonEntry\)/, 'reviewed undead summons join the active combat order');
assert.match(network, /abilityPullMovements/, 'lightning pull produces a real synchronized token movement');
assert.match(network, /resolutionMode:mode/, 'Firebase combat events preserve result semantics for public announcements');
assert.match(network, /nameUk:target\.nameUk\|\|target\.name/, 'Firebase results preserve Ukrainian target names');
assert.match(network, /playbackMode==='instant'\?180/, 'instant GM playback reveals without the former multi-second pause');
assert.match(network, /automationKey\|\|''\)===\'salvation-touch-v1\'/, 'healing restrictions are enforced again at the synchronized room boundary');
assert.match(network, /combat-target-invalid/, 'invalid undead or dead healing targets have a stable room error code');
assert.match(network, /combatNextRoundState/, 'turn advancement skips and removes summons after their reviewed duration');
assert.match(network, /sharedAreaDamage/, 'the synchronized resolver rolls area damage once per effect');
assert.match(network, /combatSpellZoneContains/, 'silence persists as a real scene zone');
assert.match(network, /statusOptions\.resistanceType=effect\.energyResistance/, 'energy protection keeps its selected damage type in synchronized status data');
assert.match(network, /sameEnergyType/, 'localized damage names still match the selected energy resistance');
assert.match(network, /misty-transition-v1/, 'mist teleport and its origin smoke are handled by the authoritative resolver');
assert.match(network, /kind:mistTeleport\?'teleport'/, 'the synchronized movement event preserves teleport identity for every client');
assert.match(network, /collisionDamageFormula/, 'gravity collisions are rolled by the authoritative resolver');
assert.match(network, /collidingMovements=abilityPullMovements\.filter/, 'every creature in one gravity collision cluster takes the shared collision roll once');
assert.match(network, /consumeOnAttack=true/, 'the psychic penalty is consumed by the target’s next attack');
assert.match(network, /breakOnDamage=true/, 'hypnotic trance is marked to break on damage');
assert.match(network, /consumeOnAttack:!!effect\.consumeOnAttack,breakOnDamage:!!effect\.breakOnDamage/, 'custom one-shot and break-on-damage flags survive synchronized status normalization');
assert.match(network, /grantMeleeAdvantageToAttackers:!!effect\.grantMeleeAdvantageToAttackers/, 'hypnotic melee advantage survives synchronized status normalization');
assert.match(network, /effect\.areaMode=\['circle','square','line','cone'\]/, 'the synchronized resolver accepts square spell areas');
assert.match(network, /sourceDamageRoll=workflowApproval&&workflowApproval\.sourceDamage\?workflowApproval\.sourceDamage:\(effect\.sourceDamageFormula/, 'life transfer pays caster HP from the staged roll inside the authoritative transaction');
assert.match(network, /effect\.metalArmorDisadvantage/, 'the heavenly spear detects metal armour at the authoritative boundary');
assert.match(html, /animation==='heaven-piercing-spear-v1'\)return'lightning-spear'/, 'the new spear uses its own readable VFX preset');
assert.match(html, /animation==='fire-projectile-v1'\)return'fire-projectile'/, 'the fire projectile uses a travel-before-impact renderer');
assert.match(html, /projectileImpactDelay=\['fire-projectile-v1','storm-arrow-v1'\]\.indexOf\(String\(event\.animationKey\|\|''\)\)>=0\?760:0/, 'damage labels wait until either projectile reaches its impact point');
assert.match(html, /areaMode!=='manual'&&anchorPoint\?\[anchorPoint\]/, 'large areas render one shared primary particle effect instead of one full burst per target');
assert.match(html, /function scheduleAbilityTargetPreview\(ev\)/, 'spell targeting coalesces pointer movement into one animation frame');
assert.match(html, /abilityTargetLayerRect=\{left:targetRect\.left/, 'spell targeting caches the stable token-layer geometry');
assert.match(html, /if\(mode==='token'\)\(draft\.tokens\|\|\[\]\)\.forEach/, 'point, line, and area spells do not decorate every scene token as an individual target');
assert.match(html, /\.zg-vtt-token\.zg-ability-target-valid>img,\.zg-vtt-token\.zg-ability-target-valid>\.zg-vtt-token-ph\{[^}]*outline:0!important;[^}]*box-shadow:0 0 0 2px/, 'single-target spells draw the selection ring on the circular portrait instead of the square token container');
assert.match(html, /\.zg-ability-point-preview\.line line\{[^}]*animation:none\}/, 'line spells keep a stable non-animated direction preview while the cursor moves');
assert.doesNotMatch(html, /zg-vtt-token\.zg-ability-target-valid\{[^}]*filter:/, 'every valid target no longer owns a continuously animated GPU filter');
assert.match(html, /\.zg-spell-cast-config>\.zg-spell-playback-setup select\{[\s\S]*?-webkit-appearance:none!important;appearance:none!important;[\s\S]*?background-image:linear-gradient/, 'player spell choices replace the browser-native select chrome with the Zargota theme');
assert.match(html, /\.zg-spell-cast-config>\.zg-spell-playback-setup label\.zg-spell-playback-check input\[type="checkbox"\]\{[\s\S]*?-webkit-appearance:none!important;appearance:none!important;/, 'player ritual confirmation replaces the browser-native checkbox');
assert.match(html, /input\[type="checkbox"\]:checked\{[\s\S]*?background-image:url\("data:image\/svg\+xml/, 'the themed checkbox exposes a visible checked state without native controls');
assert.match(html, /preset=String\(movement\.kind\|\|''\)==='teleport'.*\?'mist-teleport':'movement'/, 'mist teleport selects the dedicated smoke trail preset');
assert.match(html, /function animateTeleportMovement\(node,token,movement,duration\)/, 'mist teleport has disappearance and reappearance timing separate from ordinary walking');
assert.match(html, /spellPlaybackActionState/, 'the panel checks the actual short or long action cost of every spell');
assert.match(html, /function spellPlaybackCasterBlock\(snapshot,caster,profile\)/, 'the spell panel has an early caster-state gate');
assert.match(html, /function spellPlaybackRangeCells\(value\)/, 'the spell panel owns its weapon-range parser instead of reaching into the later combat module');
const playbackModuleSource = html.match(/function spellPlaybackRangeCells\(value\)[\s\S]*?document\.addEventListener\('zargota:localechange'/)?.[0] || '';
assert.doesNotMatch(playbackModuleSource, /combatClientRangeCells/, 'manual spell playback does not call a helper outside its module scope');
assert.match(html, /casterReady=!!\([\s\S]*?!castBlock/, 'a silenced caster is visibly blocked before targeting');
const armSource = html.match(/w\.zgSpellPlaybackArm=function\(\)\{[\s\S]*?\n  \};/)?.[0] || '';
assert.ok(armSource.indexOf('spellPlaybackCasterBlock') >= 0, 'arming a spell checks silence');
assert.ok(armSource.indexOf('spellPlaybackCasterBlock') < armSource.indexOf('pendingSpellPlayback='), 'silence is checked before targeting state is created');
assert.match(html, /w\.zgWorkshopModeChoose=function\(mode\)[\s\S]*?mode==='magic'/, 'the Workshop launcher exposes the magic mode');
assert.match(html, /w\.zgSceneBuildQaMagicArena=function/, 'the dedicated magic arena has its own fixture builder');
assert.match(html, /member\.character\.abilityUsage\[resourceKey\]=Object\.assign\([^;]*battleScopeKey/, 'the local magic arena persists both rest charges and battle usage in the hero sheet like the network path');
assert.match(html, /spellPlaybackLastError\?'<p class="zg-spell-inline-error" role="alert">'/, 'a failed manual playback keeps its exact reason visible in the spell panel');
assert.match(html, /targetResource=spellPlaybackResourceState\(snapshot,caster,profile\)[\s\S]*?profile\.resourceMax=caster&&caster\.uid/, 'target confirmation rehydrates the authoritative resource fields after the targeting tool returns');
assert.match(html, /id:'qa-magic-cursed-ally'[\s\S]*?x:25,y:57/, 'the cursed ally starts within the touch spell range of the QA caster');
assert.match(html, /id:'qa-magic-hero'[\s\S]*?statuses:\['silence'\]/, 'the magic hero starts silenced on the very first frame');
assert.match(html, /id:'qa-magic-greatsword'[\s\S]*?handsRequired:2/, 'the magic arena hero has a valid two-handed melee weapon for sweeping strike playback');
assert.match(html, /id:'qa-magic-sweeping-low'[\s\S]*?x:25,y:50[\s\S]*?id:'qa-magic-sweeping-high'[\s\S]*?x:25,y:57/, 'the magic arena includes two adjacent sweeping-strike targets next to the caster');
assert.match(html, /id:'qa-magic-silence-zone'[\s\S]*?kind:'silence'/, 'the magic hero also starts inside a persistent silence zone');
assert.match(html, /id:'qa-magic-fire-resistant'[\s\S]*?resistances:\['fire'\]/, 'the arena includes a fire-resistant target');
assert.match(html, /id:'qa-magic-blunt-vulnerable'[\s\S]*?vulnerabilities:\['blunt'\]/, 'the arena includes a blunt-vulnerable target');
assert.match(html, /id:'qa-magic-undead'[\s\S]*?type:'spell-summon'/, 'the arena includes an undead target for healing restrictions');
assert.match(html, /id:'qa-magic-wounded-ally'[\s\S]*?hp:8,hpMax:24/, 'the arena includes a wounded ally for healing tests');
assert.match(html, /id:'qa-magic-cursed-ally'[\s\S]*?statuses:\['curse'\]/, 'the arena includes a cursed ally for cleanse testing');
assert.match(html, /id:'qa-magic-metal-armored'[\s\S]*?heavyArmor:true/, 'the arena includes a metal-armoured line target');
assert.match(html, /id:'qa-magic-mindless'[\s\S]*?type:'construct'/, 'the arena includes a mindless construct for psychic restrictions');
assert.match(html, /w\.zgQaMagicSilenceToggle=function/, 'the arena can toggle both silence fixtures without rebuilding');
assert.match(html, /enable\?zone\.id!==['"]qa-magic-silence-zone['"]:zone\.kind!==['"]silence['"]/, 'disabling the QA silence fixture also clears silence zones created by a real spell cast');
assert.match(html, /if\(!enable\)\{[\s\S]*?\(draft\.tokens\|\|\[\]\)\.forEach\(setSilence\);[\s\S]*?\(snapshot\.room\.combat\.order\|\|\[\]\)\.forEach\(setSilence\)/, 'the QA reset clears propagated silence from every arena token and combat entry');
assert.match(html, /actorEnemy===targetEnemy/, 'ally targeting is relative to the caster and works for creature spellcasters too');
assert.match(html, /zgMovementRequestsToggle=function\(force\)/, 'opening spell playback can explicitly close the requests panel instead of toggling it open');
assert.match(html, /movementPanelPinned=typeof force==='boolean'\?force:!movementPanelPinned/, 'the requests panel honours the requested closed state while targeting');
assert.match(html, /movementPanelPinned&&w\.zgSpellPlaybackToggle\)w\.zgSpellPlaybackToggle\(false\)/, 'opening player requests closes spell playback so its cards cannot cover GM approval controls');
assert.match(html, /'ВИБІР '\+\(mode==='point'\?'ТОЧКИ':'ЦІЛЕЙ'\)\+countText/, 'the localized Ukrainian targeting HUD also shows multi-target progress');
assert.match(html, /journalUk&&event&&event\.textUk/, 'the Ukrainian journal uses the localized spell event instead of its Russian fallback');
assert.match(html, /document\.addEventListener\('zargota:localechange',function\(\)\{renderJournal\(\);\}\)/, 'changing locale immediately rerenders the combat journal');
assert.match(html, /spellPlaybackText\(weapon\.name,weapon\.nameUk\).*spellPlaybackText\(weapon\.damageType,weapon\.damageTypeUk\)/, 'the manual weapon selector renders both authored locales');
assert.match(html, /zg-combat-spell-zone-layer/, 'persistent spell zones have a dedicated map layer');
assert.match(html, /@media\(max-width:1100px\)\{[\s\S]*?\.zg-game-overlay\.gm \.zg-performance-badge\{right:119px;top:70px\}[\s\S]*?\.zg-spell-playback-toggle\{right:64px;top:68px\}/, 'the GM FPS badge keeps a separate responsive slot instead of covering the spell-playback toggle');
assert.match(html, /combatQaHasEnergyResistance\(target,ability\.damageType\)/, 'the local Workshop applies the selected energy resistance to automated spell damage');
assert.match(html, /combatQaHasEnergyResistance\(target,weapon\.damageType\)/, 'the local Workshop also applies the ward to ordinary weapon damage of that type');
assert.match(html, /sourceId:qaEffectSource/, 'Workshop timed and concentration effects retain their source identity');
assert.match(html, /expiredStatusEffects/, 'Workshop turn advancement expires timed spell statuses instead of leaving them forever');
assert.match(html, /combatQaHasDamageTrait\(target,'vulnerabilities',ability\.damageType\)/, 'Workshop spell damage respects ordinary vulnerabilities as well as energy wards');
assert.match(html, /qaSweepingSharedAttack[\s\S]*?qaSweepingSharedDamage[\s\S]*?damageSplit='ceil-half-per-target'/, 'Workshop manual playback uses one shared sweeping attack and one shared damage roll');
assert.match(html, /qaSweepingAdjacency==null\|\|qaSweepingAdjacency>1/, 'Workshop manual playback validates target adjacency before spending the action');
assert.match(html, /qaStormSharedAttack[\s\S]*?qaStormSharedDamage[\s\S]*?attackRollMode='disadvantage'[\s\S]*?damageRollMode='disadvantage'/, 'Workshop playback preserves both disadvantaged storm-arrow pools');
assert.match(html, /qaStormAdjacency==null\|\|qaStormAdjacency>1/, 'Workshop playback validates the two storm-arrow targets are adjacent');
assert.match(html, /function combatClientWeaponIsRanged\(weapon\)/, 'the local combat module owns its ranged-weapon classifier');
assert.match(html, /qaStormWeapon=[\s\S]*?combatClientWeaponIsRanged\(weapon\)/, 'Workshop storm-arrow resolution uses the classifier available in its own runtime scope');
assert.match(html, /profile\.weaponOptions=[\s\S]*?filter\(combatClientWeaponIsRanged\)/, 'player storm-arrow setup uses the same in-scope ranged-weapon classifier');
assert.match(html, /actor\.economy\.short=0;actor\.economy\.movement=0/, 'storm arrow locks the remaining short action and movement after the long action is spent');
assert.match(html, /animation==='storm-arrow-v1'\)return'projectile'/, 'storm arrow uses the synchronized projectile renderer');
assert.match(html, /animation==='rot-ray-v1'\)return'rot-ray'/, 'rot ray uses its own synchronized marsh-green beam');
assert.match(html, /Кубики урона','Кубики шкоди'[\s\S]*id="zg-spell-playback-damage-formula"/, 'instant GM playback exposes a bilingual editable damage pool');
assert.match(html, /profile\.manualDamageFormulaInvalid=!\/\^\\d\{1,2\}d/, 'instant GM damage overrides accept only bounded dice formulas');
assert.match(html, /\['fire-projectile-v1','storm-arrow-v1'\]/, 'storm-arrow damage labels wait for projectile impact');
assert.match(network, /function combatWeaponIsRanged\(profile\)/, 'Firebase classifies ranged weapons from canonical profile data');
assert.match(network, /combatLearningRangePenalty\(actor,combat\)/, 'Firebase applies the next-battle learning range penalty to ranged actions');
assert.match(network, /canonical\.automationKey === 'storm-arrow-v1'[\s\S]*?resolved\.weaponMode = 'ranged'/, 'Firebase restores storm-arrow weapon mechanics instead of trusting the browser payload');
assert.match(network, /maxUsesPerBattle:Math\.max\(0,Math\.min\(99,Number\(details\.maxUsesPerBattle/, 'Firebase preserves the reviewed per-battle spell cap');
assert.match(network, /statusBlockedByDamageImmunity:details\.statusBlockedByDamageImmunity===true/, 'Firebase preserves the reviewed poison-immunity gate');
assert.match(network, /approvedStatusDuration/, 'Firebase applies the staged status duration instead of inventing a fixed value');
assert.match(network, /directConditionalSave=\{stat:conditionalStat[\s\S]*?directStatusDuration=Math\.max\(1,Math\.ceil\(durationDie\/2\)\)/, 'instant GM playback resolves the post-hit save and visible 1d3 status duration too');
assert.match(network, /targetTokenId=String\(target\.tokenId\|\|target\.uid&&\('hero-'\+target\.uid\)/, 'hero HP and statuses are synchronized back to the scene token after spell resolution');
assert.match(network, /sceneTokenId=String\(entry\.tokenId\|\|entry\.uid&&\('hero-'\+entry\.uid\)/, 'turn ticks and status expiry synchronize hero state back to the scene token too');
assert.match(network, /writeScene:!expiredSummons\.length&&\(masterAdvance\|\|String\(ending\.uid\|\|''\)===String\(user\.uid\)\)/, 'a player turn writes only the ending player hero token back to the scene');
assert.match(network, /spell-disabled-until-rest/, 'the failed Rot Ray ritual blocks only that spell until rest');
assert.match(html, /String\(effect\.kind\|\|''\)==='spell-disabled'/, 'the local Workshop mirrors the failed-ritual cast block');
assert.match(network, /collisionTraits=combatStatusDamageTraits\(target,damageType\)/, 'gravity collision damage respects synchronized damage traits');
assert.match(network, /collisionRollTotal/, 'gravity keeps the shared raw collision roll separate from target-specific damage adjustments');
assert.match(network, /cappedTempHp=requestedTempHp\?Math\.min\(tempHpLimit\|\|requestedTempHp,requestedTempHp\)/, 'the synchronized resolver uses the same temporary-HP cap as its preview');
assert.match(network, /concentrationSource[\s\S]*?entry\.concentration=null/, 'turn advancement clears concentration after its last timed effect expires');
assert.match(network, /messageUk/, 'new network errors can expose their Ukrainian counterpart');
assert.match(network, /function canonicalizeRequestedSpell\(member, details\)/, 'the Firebase request boundary validates real character spell state');
assert.match(network, /spell-not-owned/, 'a spell outside the hero book has a stable terminal error');
assert.match(network, /spell-not-learned/, 'an owned but unlearned spell has a stable terminal error');
assert.match(network, /spell-not-prepared/, 'an unprepared spell has a stable terminal error');
assert.match(network, /automatedSpellProfileById/, 'automated spell formulas are restored by catalog id instead of trusting player payloads');
assert.match(network, /areaMode:\['circle','square','line','cone'\]/, 'the real player request preserves reviewed square and line geometry');
assert.match(html, /function vttSpellNeedsConfiguration\(profile\)/, 'complex choices are available from the real hero spell card');
assert.match(html, /id="zg-vtt-spell-requirements"/, 'real undead casting requires explicit remains and reagent confirmation');
assert.match(html, /zgVttSpellSummonVariantChange/, 'fresh undead immediately locks the real cast count to one');
assert.match(html, /explicitMode=\['circle','square','line','cone'\]/, 'the GM resolver opens with the reviewed area shape from the player request');
assert.match(html, /if\(shape==='square'\)return Math\.abs/, 'square target selection uses square geometry instead of a line fallback');
assert.match(i18n, /'Проигрывание заклинаний': 'Розігрування заклять'/);
assert.match(i18n, /'Магическая арена': 'Магічна арена'/);

console.log('Session spell playback contracts passed');
