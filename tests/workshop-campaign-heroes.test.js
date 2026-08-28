'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function workshopCampaignHeroCharacters\(\)/, 'workshop has a dedicated campaign-roster projection');
for (const campaignKey of ['evan','melissa','esteros','vrotik','lin-yin']) {
  assert.ok(html.includes(`'${campaignKey}'`), `workshop roster includes ${campaignKey}`);
}
assert.match(html, /JSON\.parse\(JSON\.stringify\(sourceHero\)\)/, 'workshop receives defensive character copies');
assert.match(html, /copy\.workshopCopy=true/, 'workshop copies are explicitly marked');
assert.match(html, /status:'local-workshop-copy'/, 'workshop snapshot is identified as local and non-networked');
assert.match(html, /online:false,workshopCopy:true/, 'campaign heroes are offline fixtures rather than fake connected clients');
assert.match(html, /member&&member\.workshopCopy\)return\{key:'workshop'/, 'offline workshop copies have a dedicated local presence instead of looking disconnected');
assert.match(html, /\.zg-party-card\.presence-workshop\{opacity:1;filter:none\}/, 'workshop portraits stay fully visible');
assert.match(html, /possessionChanged=!!\(selectedMember&&heroToken&&w\.zgPossessPlayer&&w\.zgPossessPlayer/, 'clicking any placed allied portrait assigns direct GM control, including workshop heroes');
assert.match(html, /if\(token\.type==='hero'&&w\.zgPossessPlayer\)w\.zgPossessPlayer\(token\.memberUid\)/, 'clicking a hero token in run mode assigns control without dragging it');
assert.match(html, /directWorkshopHero[\s\S]{0,260}movementApi\.requestMovementAs\(actorUid,point\.x,point\.y,origin\)\.then\(function\(\)\{return movementApi\.resolveMovement\(actorUid,true\);\}\)/, 'GM workshop movement is resolved locally instead of creating a request to oneself');
assert.match(html, /if\(w\.zgVttEnableTestHero\)w\.zgVttEnableTestHero\(\[\]\)/, 'Workshop opens without automatically summoning campaign heroes');
assert.match(html, /zgQaCampaignHeroSummon/, 'campaign heroes are summoned explicitly from the Workshop roster');
assert.match(html, /zgQaCampaignHeroesMapSet/, 'Workshop can explicitly summon or remove the complete campaign party');
assert.match(html, /roomSnapshot\.room\.code==='TEST'/, 'local Workshop state is identified by a hard TEST-room boundary');
assert.match(html, /roomSnapshot\.room\.code==='TEST'\|\|roomSnapshot\.room\.phase/, 'automatic scene publishing refuses the TEST room');
assert.match(html, /roomSnapshot\.room\.code==='TEST' \|\| !w\.ZargotaRooms/, 'manual scene publishing refuses the TEST room');
assert.match(html, /roomSnapshot\.room\.code==='TEST' \|\| !w\.ZargotaRooms \|\| !w\.ZargotaRooms\.startGame/, 'player launch refuses the TEST room');
assert.match(html, /workshopHeroUid\(token\.memberUid\)/, 'technical Workshop hero tokens are recognized before token publishing');
assert.match(html, /leakedWorkshopHeroes\.push\(String\(token\.id\)\)/, 'leaked Workshop hero tokens are collected narrowly from a live scene');
assert.match(html, /ZargotaRooms\.removeSceneTokens\(cleanupTokenIds\)/, 'legacy Workshop token cleanup uses the narrow network operation');
assert.match(html, /id="zg-qa-campaign-heroes"/, 'workshop settings expose the campaign roster');
assert.match(html, /id="zg-workshop-launcher"/, 'GM settings expose an explicit launcher while the Workshop is closed');
assert.match(html, /workshopAvailable=!!\(overlay&&overlay\.classList\.contains\('gm'\)\)/, 'settings resolve the GM role from their own overlay instead of an out-of-scope runtime variable');
assert.match(html, /↩ Вернуться в живую сессию/, 'Workshop exposes an explicit return to the live session');
assert.match(html, /zgPrimarySessionAction/, 'top GM action changes from player launch to live-room return inside Workshop');
assert.match(html, /zgQaCampaignHeroOpen/, 'GM can inspect a chosen workshop hero sheet or magic section');
assert.match(html, /var workshopHiddenHeroUids = Object\.create\(null\)/, 'workshop map visibility is kept in local tab state');
assert.match(html, /isWorkshopHeroLocallyHidden\(token\)/, 'hidden workshop heroes are omitted from the map renderer');
assert.match(html, /w\.zgSceneSetTestHeroHidden/, 'a single workshop hero can be hidden without deleting it');
assert.match(html, /w\.zgSceneSetAllTestHeroesHidden/, 'all workshop heroes can be hidden or restored together');
assert.match(html, /zgQaCampaignHeroMapToggle/, 'each campaign hero card exposes a map visibility toggle');
assert.match(html, /zg-qa-hero-stage-control/, 'workshop exposes a compact hero pack and unpack widget');
assert.match(html, /zgQaCampaignHeroesMapSet/, 'hero staging widget explicitly packs or unpacks the roster');
assert.match(html, /host\.__zgWorkshopHeroesHtml!==markup/, 'frequent session renders do not rebuild an unchanged workshop roster');
assert.match(html, /Управление включено/, 'workshop roster clearly marks the controlled hero');
assert.match(html, /function heroSlotCampaignKey\(token\)/, 'saved hero positions carry a stable campaign identity');
assert.match(html, /heroSlotName\(index,campaignKey\)/, 'campaign identity is encoded into the existing hero-slot model');
assert.match(html, /!key\|\|!occupiedKeys\[key\]/, 'saving a partially occupied scene preserves absent campaign hero slots');
assert.match(html, /heroSlotCampaignKey\(candidate\)===memberKey/, 'a real connected hero claims the matching campaign slot');
assert.doesNotMatch(html, /if\(!slot\)slot=slots\.find\(function\(candidate\)\{return !claimedSlots\[candidate\.id\];\}\)/, 'a campaign hero never falls back into another keyed hero slot');
assert.match(html, /if\(isHeroSlot\(token\)\)return;[\s\S]{0,120}if \(!token\.visible\) return;/, 'technical hero position anchors never render on the map');
assert.doesNotMatch(html, /zgSceneSetTestHeroHidden[\s\S]{0,900}(?:publishScene|upsertSceneToken|gmProposeCharacterPatch)/, 'local workshop visibility never publishes a scene or character patch');
assert.doesNotMatch(html, /persistCampaignCharacter\(copy\)|syncCampaignHeroes\(heroes\)/, 'workshop roster never revives the legacy whole-character campaign sync');
assert.match(html, /function combatHeroRoster\(\)/, 'combat picker has a shared campaign hero roster');
assert.match(html, /var heroes=combatHeroRoster\(\),tokens=combatSceneTokens\(\)/, 'combat picker renders summoned campaign heroes rather than only online room members');
assert.match(html, /data-hero-index=/, 'combat hero rows retain a stable link to their roster candidate');
assert.match(html, /function combatWorkshopHeroCandidates\(\)/, 'Workshop combat picker exposes unsummoned campaign heroes');
assert.match(html, /zg-combat-summon-grid/, 'Workshop combat picker renders a dedicated summon roster');
assert.match(html, /w\.zgCombatSummonCampaignHero=function\(uid\)/, 'Workshop combat picker has an explicit summon action');
assert.match(html, /zgQaCampaignHeroSummon\(String\(uid\|\|''\),true\)/, 'combat picker reuses the established local Workshop summon adapter');
assert.doesNotMatch(html, /zgCombatSummonCampaignHero=function\(uid\)[\s\S]{0,650}(?:ZargotaRooms|startCombat|syncCampaignHeroes)/, 'combat picker summon action does not write through Firebase or legacy whole-character sync');
assert.match(html, /controlledHero=!!\(controlled&&controlled\.kind==='hero'\)/, 'summoned campaign heroes keep the hero sheet toolbar while taking a combat turn');
assert.match(html, /if\(localQa\)\{if\(!w\.zgSceneQaActiveCombat\)/, 'Workshop starts selected participants through its local adapter');
assert.doesNotMatch(html, /if\(localQa\)[\s\S]{0,260}ZargotaRooms\.startCombat/, 'Workshop participant start never writes to Firebase');

console.log('workshop campaign heroes contract passed');
