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
assert.match(html, /w\.zgSceneEnableTestHeroes\(heroes\)/, 'all campaign heroes enter the existing local TEST room');
assert.match(html, /id="zg-qa-campaign-heroes"/, 'workshop settings expose the campaign roster');
assert.match(html, /zgQaCampaignHeroOpen/, 'GM can inspect a chosen workshop hero sheet or magic section');
assert.match(html, /var workshopHiddenHeroUids = Object\.create\(null\)/, 'workshop map visibility is kept in local tab state');
assert.match(html, /isWorkshopHeroLocallyHidden\(token\)/, 'hidden workshop heroes are omitted from the map renderer');
assert.match(html, /w\.zgSceneSetTestHeroHidden/, 'a single workshop hero can be hidden without deleting it');
assert.match(html, /w\.zgSceneSetAllTestHeroesHidden/, 'all workshop heroes can be hidden or restored together');
assert.match(html, /zgQaCampaignHeroMapToggle/, 'each campaign hero card exposes a map visibility toggle');
assert.match(html, /zg-qa-hero-stage-control/, 'workshop exposes a compact hero pack and unpack widget');
assert.match(html, /zgQaCampaignHeroesMapSet/, 'hero staging widget explicitly packs or unpacks the roster');
assert.match(html, /function heroSlotCampaignKey\(token\)/, 'saved hero positions carry a stable campaign identity');
assert.match(html, /heroSlotName\(index,campaignKey\)/, 'campaign identity is encoded into the existing hero-slot model');
assert.match(html, /!key\|\|!occupiedKeys\[key\]/, 'saving a partially occupied scene preserves absent campaign hero slots');
assert.match(html, /heroSlotCampaignKey\(candidate\)===memberKey/, 'a real connected hero claims the matching campaign slot');
assert.doesNotMatch(html, /if\(!slot\)slot=slots\.find\(function\(candidate\)\{return !claimedSlots\[candidate\.id\];\}\)/, 'a campaign hero never falls back into another keyed hero slot');
assert.doesNotMatch(html, /zgSceneSetTestHeroHidden[\s\S]{0,900}(?:publishScene|upsertSceneToken|gmProposeCharacterPatch)/, 'local workshop visibility never publishes a scene or character patch');
assert.doesNotMatch(html, /persistCampaignCharacter\(copy\)|syncCampaignHeroes\(heroes\)/, 'workshop roster never revives the legacy whole-character campaign sync');
assert.match(html, /function combatHeroRoster\(\)/, 'combat picker has a shared campaign hero roster');
assert.match(html, /var heroes=combatHeroRoster\(\),tokens=combatSceneTokens\(\)/, 'combat picker renders summoned campaign heroes rather than only online room members');
assert.match(html, /data-hero-index=/, 'combat hero rows retain a stable link to their roster candidate');
assert.match(html, /controlledHero=!!\(controlled&&controlled\.kind==='hero'\)/, 'summoned campaign heroes keep the hero sheet toolbar while taking a combat turn');
assert.match(html, /if\(localQa\)\{if\(!w\.zgSceneQaActiveCombat\)/, 'Workshop starts selected participants through its local adapter');
assert.doesNotMatch(html, /if\(localQa\)[\s\S]{0,260}ZargotaRooms\.startCombat/, 'Workshop participant start never writes to Firebase');

console.log('workshop campaign heroes contract passed');
