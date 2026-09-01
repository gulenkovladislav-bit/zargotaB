const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'arena-v2-workspace.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'arena-v2-workspace.css'), 'utf8');

assert(html.includes('arena-v2-workspace.css?v=2026-09-01.18'), 'Arena workspace stylesheet must be loaded');
assert(html.includes('arena-v2-workspace.js?v=2026-09-01.18'), 'Arena workspace controller must be loaded');
assert(html.includes("global.zgArenaWorkspaceOpen==='function'"), 'Arena tab must open the battlefield workspace directly');
assert(html.includes('w.zgArenaV2Launch=function(config)'), 'VTT must expose the local Arena launch adapter');
assert(html.includes('w.zgArenaV2AddParticipant=function(participant,position)'), 'Arena must add participants directly to the live field');
assert(html.includes('w.zgArenaV2GetState=function()'), 'Arena must export its current state for full battle presets');
assert(html.includes('w.zgArenaV2OpenTokenBag=function(tokenId,panel)'), 'Arena creature tokens must open the existing bag');
assert(html.includes("w.zgLocalArenaV2Active&&(!drawer||!drawer.classList.contains('open'))"), 'Clicking an Arena creature must open its bag even when the drawer was closed');
assert(html.includes("member.role==='scene-token'&&member.sceneTokenId&&w.zgLocalArenaV2Active"), 'Arena creature inventory must be editable only in the local Arena copy');
assert(html.includes("getData('text/zargota-arena-item')"), 'Existing bag must accept Arena catalog drops');
assert(html.includes('w.zgVttInventoryCatalogAdd=function(catalogId)'), 'Catalog plus button and drop must share one bag-add path');
assert(html.includes('function inventoryClone(value,fallback)') && html.includes('item=inventoryClone(source,{})'), 'Bag catalog path must clone inside the drawer module scope');
assert(html.includes('item.equipped=false'), 'Catalog drops must enter the bag unequipped');
assert(html.includes("member.role==='scene-token'&&member.sceneTokenId&&w.zgLocalArenaV2Active") && html.includes("detail:{kind:'magic',tokenId:arenaTokenId}"), 'Arena token spell editing must update the local scene copy and combat entry');
assert(html.includes("pendingAbilityCast.masterActorKey=arenaCaster?String(arenaEntry&&arenaEntry.key") && html.includes("String(arenaTurn.tokenId||'')===String(pending.casterTokenId||'')") && html.includes('arenaVttAbilityTargetKeys(payload,selection,arenaCasterKey)') && html.includes("payload.playbackMode='instant'") && html.includes("updatedBy:'arena-master'"), 'Arena token spells must cast from the bag and consume the local copy resource');
assert(html.includes('profile.resourceMax=Math.max(0,Number(selectedProfile.resourceMax)||Number(selectedCard.limit)||0)') && html.includes('profile.resourceUsed=Math.max(0,Number(selectedProfile.resourceUsed)||Number(selectedCard.used)||0)'), 'Arena casts must preserve the visible spell card charge state in the battle profile');
assert(html.includes("cooldownMatch=String(source&&source.cd||'').match") && html.includes('profile.resourceMax=Math.max(0,Number(profile.resourceMax)||canonicalLimit'), 'Arena spell requests must recover their canonical charge limit even without a live card model');
assert(html.includes('resolvedResourceKey=String(payload.resourceKey||resolvedCard.key||pending.key') && html.includes('holder.spellCD[resolvedSpellId]') && html.includes("[resolvedActor,resolvedToken].forEach") && html.includes('scopeKey:resolvedScopeKey') && html.includes('battleUsed:Math.max(resolvedBattleUsed') && html.includes("w.zgArenaV2SyncSnapshot(snapshot)") && html.includes("w.zgVttApplyTestSnapshot(snapshot)"), 'Arena cast result must synchronize scoped charges to both the combat entry, scene token, and visible bag state');
assert(html.includes('w.zgArenaV2GetActorPatch=function(tokenId)') && html.includes("arenaPatch=w.zgLocalArenaV2Active") && html.includes('spellCD:arenaPatch.spellCD'), 'Arena bag must read the latest local spell charge patch after a cast');
assert(html.includes("Заклинание можно применить только в ход этого участника") && html.includes("masterControlled&&!w.zgLocalArenaV2Active"), 'Arena bag must guard the visible current turn while the online resolver keeps its own turn check');
assert(html.includes('function syncTokenEffectSize(node)') && html.includes("node.style.setProperty('--zg-token-size'"), 'Defeated token playback must size its local visual effects without throwing');
assert(html.includes("sourceSnapshot=sourceSnapshot&&sourceSnapshot.room?sourceSnapshot:roomSnapshot") && html.includes('var activeSnapshot=arenaV2SyncedSnapshot') && html.includes('arenaV2SyncedSnapshot=null;arenaV2ActorPatches={}') && html.includes("w.zgArenaV2SyncSnapshot=function(snapshot)"), 'Arena presets and combat actions must use the latest synchronized Arena snapshot and clear stale cache on launch');
assert(html.includes('abilityUsage:raw.abilityUsage||{}') && html.includes('spellCD:raw.spellCD||{}') && html.includes('spellCD:primarySource.spellCD||{}') && html.includes('spellCD:token.spellCD||{}'), 'Arena presets must preserve local spell and skill charges');
assert(html.includes("['character','npc','beast','spell-summon','construct']") && html.includes('spellRefs: Array.isArray(token.spellRefs)') && html.includes('equipItems: Array.isArray(token.equipItems)'), 'Scene token normalization must preserve Arena character links, magic, and equipment');
assert(html.includes("roomState(snapshot);if(typeof w.zgArenaV2SyncSnapshot==='function')w.zgArenaV2SyncSnapshot(snapshot);applyScene()"), 'Arena launch and participant placement must immediately synchronize the complete local snapshot');
assert(html.includes("w.zgArenaV2ApplyActorPatch=function(tokenId,patch)") && html.includes("arenaV2ActorPatches[String(token.id||'')]") && html.includes("w.zgArenaV2ApplyActorPatch(arenaTokenId,{spellRefs:"), 'Arena presets must merge local token magic patches into the saved actor copy');
assert(html.includes("document.body.classList.remove('zg-arena-v2')"), 'Leaving Arena must clean up its presentation mode');

['Создать героя','Створити героя','Противники','Предметы','Предмети','Пресеты боя','Пресети бою'].forEach((copy) => {
  assert(workspace.includes(copy), `Arena workspace must include bilingual copy: ${copy}`);
});
assert(workspace.includes("navButton('hero'") && workspace.includes("navButton('opponents'") && workspace.includes("navButton('items'") && workspace.includes("navButton('presets'"), 'Left rail must expose the four requested sections');
assert(workspace.includes("state.opponentTab==='bestiary'") && workspace.includes("state.opponentTab==='custom'"), 'Opponent drawer must offer Bestiary and custom creation');
assert(workspace.includes("text('Гуманоид второго уровня','Гуманоїд другого рівня')"), 'Custom opponent must include the level-two humanoid preset');
assert(workspace.includes('draggable="true" data-arena-item'), 'Item catalog cards must be draggable');
assert(workspace.includes('data-arena-item-add'), 'Item catalog cards must also expose a direct add button');
assert(workspace.includes("global.zgVttInventoryCatalogAdd(button.dataset.arenaItemAdd)"), 'Direct add button must use the existing bag catalog path');
assert(workspace.includes("event.dataTransfer.setData('text/zargota-arena-item',id)"), 'Item dragging must use the Arena-to-bag MIME contract');
assert(!workspace.includes('loadArmorySets') && !workspace.includes('Комплект снаряжения') && !workspace.includes('Комплект спорядження'), 'Arena drawers must not implement a second equipment/loadout form');
assert(workspace.includes('actors:clone(current.actors,[])'), 'Battle presets must store the full current actor copies');
assert(workspace.includes('while(occupied[key]&&step<8)') && workspace.includes("key=Math.round(x*10)+'|'+Math.round(y*10)"), 'Preset loading must separate participants that occupy the same position');
assert(css.includes('.zg-arena-drawer[data-panel="items"]') && css.includes('--arena-drawer-width:510px'), 'Items drawer must be wider than compact drawers');
assert(css.includes('#zg-game-overlay.arena-v2-mode .zg-vtt-drawer{z-index:23}'), 'Existing right bag must stay above Arena drawers');
assert(css.includes('#zg-game-overlay.arena-v2-mode .zg-vtt-drawer.backpack-skin') && css.includes('--bag-rest-transform:translate(0,-50%)'), 'Desktop Arena bag must remain fully inside the viewport');
assert(css.includes('#zg-game-overlay.arena-v2-mode #zg-world-clock') && css.includes('#zg-game-overlay.arena-v2-mode #zg-vtt-journal'), 'Arena must hide time and session chat');
assert(html.includes("notesUk: 'Локальну Арену повністю переперевірено"), 'Arena changelog must include Ukrainian copy');

console.log('arena-v2.test.js: OK');
