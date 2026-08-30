'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'zargota-i18n.js'), 'utf8');

assert.strictEqual((html.match(/class="zg-irl-tool-rail"/g) || []).length, 1, 'the live GM screen needs one permanent tool rail');
['zg-irl-name-tool', 'zg-irl-npc-tool', 'zg-irl-event-tool', 'zg-irl-scene-tool', 'zg-irl-note-tool'].forEach((id) => {
  assert.strictEqual((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `missing permanent GM tool: ${id}`);
});
assert.match(html, /w\.zgIrlRulesOpen=function\(\)\{[\s\S]*?w\.showPage\('manual'\)/, 'Rules must route to the existing Manual page');

const workspaceBlock = html.match(/<script>\s*\(function\(w\)\{\s*'use strict';\s*var ACTIVE_KEY='zg_irl_session_v1',openPanel=[\s\S]*?\}\)\(window\);\s*<\/script>/);
assert.ok(workspaceBlock, 'the IRL workspace controller must exist');
assert.match(workspaceBlock[0], /state\.data\.tableWorkspace|zgIrlSessionSaveData\('tableWorkspace'/, 'scene tools must stay inside the active IRL session');
assert.doesNotMatch(workspaceBlock[0], /Firebase|ZargotaRooms|updateRoom|setRoom/, 'the physical-table workspace must not write to the online room');

assert.match(workspaceBlock[0], /typeof w\.zgNpcLoad==='function'\?w\.zgNpcLoad\(\)/, 'NPC drawer must reuse the canonical NPC registry');
assert.match(workspaceBlock[0], /typeof w\.zgNpcView==='function'\)w\.zgNpcView/, 'full NPC cards must reuse the canonical NPC sheet');
assert.match(workspaceBlock[0], /npcIds:Array\.isArray\(scene\.npcIds\)/, 'every physical scene must keep its own NPC shortlist');
assert.match(workspaceBlock[0], /pinnedNpcId[\s\S]*?npcGoal\(n\)[\s\S]*?npcCue\(n\)/, 'pinned NPC card must show a separate goal and current acting cue');
assert.match(workspaceBlock[0], /<small>'\+esc\(npcGoal\(n\)\)/, 'the narrow NPC drawer must prioritize the actionable goal from the approved concept');

['clue', 'danger', 'reward', 'opportunity', 'complication'].forEach((type) => {
  assert.match(workspaceBlock[0], new RegExp(`${type}:\\{label:`), `missing semantic event type: ${type}`);
});
assert.match(workspaceBlock[0], /Событие — это не только враг/, 'the interface must explain that events are broader than enemies');
assert.match(workspaceBlock[0], /sceneIds:\[scene\.id\]/, 'new events must belong to the current scene');

assert.match(workspaceBlock[0], /w\.zgImageStore\.put\(file,'irl-scenes'/, 'scene backgrounds must use the existing local image store');
assert.match(workspaceBlock[0], /getBlobUrl\(source/, 'stored scene backgrounds must resolve after reload');
assert.match(workspaceBlock[0], /background:String\(scene\.background\|\|''\)/, 'each scene must persist its own background reference');

assert.match(html, /\.zg-irl-character-card\{[^}]*top:66px[^}]*height:min\(700px,calc\(100dvh - 188px\)\)/, 'the character window must stay inside the viewport above the portrait dock');
assert.match(html, /data-irl-window-key="character"/, 'the character window must be draggable');
['names', 'saved-names', 'npc-drawer', 'event-drawer', 'scene-drawer', 'note-drawer'].forEach((key) => {
  assert.match(html, new RegExp(`data-irl-window-key="${key}"`), `missing draggable window: ${key}`);
});
assert.match(html, /data-irl-window-key="pin-npc"[\s\S]*?data-irl-drag-handle/, 'pinned NPC notes must be draggable');
assert.match(html, /data-irl-window-key="pin-event"[\s\S]*?data-irl-drag-handle/, 'pinned event notes must be draggable');
assert.match(html, /data-irl-window-key="attention-menu-'\+esc\(key\)\+'"[\s\S]*?data-irl-drag-handle/, 'attention timer settings must be draggable');
assert.match(html, /data-irl-window-key="attention-due-'\+esc\(key\)\+'"[\s\S]*?data-irl-drag-handle/, 'attention reminders must be draggable');
assert.match(html, /STORAGE_KEY='zg_irl_window_positions_v2'[\s\S]*?document\.addEventListener\('pointerdown',down,true\)/, 'drag positions must persist for the current browser tab and support pointer input');
assert.match(html, /function origin\(node\)[\s\S]*?closest\('\.zg-irl-character-dock'\)[\s\S]*?point\.x-base\.x/, 'nested attention windows must translate viewport coordinates through the centred portrait dock');
assert.match(html, /function reset\(node\)[\s\S]*?node\.style\.removeProperty/, 'windows without a saved position must return to the safe default layout');
assert.match(html, /\.zg-irl-pinned-card\.npc \.zg-irl-pinned-head \.zg-irl-npc-avatar\{width:84px;height:84px\}/, 'the pinned NPC card must use a larger portrait without enlarging event icons');
assert.match(html, /function ensureGrip\(node\)[\s\S]*?data-irl-resize-handle/, 'every draggable IRL window must receive a resize grip');
assert.match(html, /function size\(node,width,height,persist\)[\s\S]*?Math\.max\(96[\s\S]*?Math\.max\(64[\s\S]*?maxWidth='none'[\s\S]*?maxHeight='none'/, 'window resizing must have no upper cap while retaining a recoverable minimum');
assert.match(html, /function resizeDown\(event\)[\s\S]*?function resizeMove\(event\)[\s\S]*?function resizeUp\(event\)/, 'IRL windows must resize continuously through pointer input');
assert.match(html, /stored\.w=Math\.round\(nextWidth\);stored\.h=Math\.round\(nextHeight\);save\(\)/, 'resized dimensions must persist alongside window positions');
assert.match(html, /visibleWindows=new WeakSet\(\)[\s\S]*?if\(newlyVisible\)focus\(node\)/, 'a newly opened IRL window must rise above an already open character card');
assert.match(html, /function focusDown\(event\)[\s\S]*?closest\('\[data-irl-draggable\]'\)[\s\S]*?document\.addEventListener\('pointerdown',focusDown,true\)/, 'pressing any visible IRL window must bring it to the front');
assert.match(workspaceBlock[0], /function syncPanels\(\)[\s\S]*?zgIrlWindowsFocus\(panel\)/, 'an explicitly opened workspace drawer must stay above cards recreated during the same render');
assert.match(html, /w\.zgIrlWindowsFocus=focus/, 'the workspace controller must be able to focus its newly opened drawer');
assert.match(html, /\.zg-irl-pin-layer\{z-index:auto/, 'pinned cards must not be trapped below the character-window stacking context');
assert.match(html, /function focus\(node\)[\s\S]*?closest&&node\.closest\('\.zg-irl-character-dock'\)[\s\S]*?dock\.style\.zIndex=layer/, 'attention popovers must bring their portrait dock stacking context to the front');
assert.match(html, /function positionKey\(node\)[\s\S]*?innerWidth<=760\?'@compact':'@wide'/, 'mobile and desktop window sizes must use separate responsive layouts');
assert.match(html, /@media\(max-width:760px\)\{[^}]*\.zg-irl-drawer\{[^}]*left:88px[\s\S]*?\.zg-irl-character-card,[^}]*\{left:88px;top:64px;width:calc\(100vw - 98px\)/, 'the mobile character card must leave the permanent GM tool rail tappable');

[
  "'События': 'Події'",
  "'NPC сцены': 'NPC сцени'",
  "'Сцены и фон': 'Сцени та тло'",
  "'Добавить в текущую сцену': 'Додати до поточної сцени'",
  "'Загрузить фон': 'Завантажити тло'",
  "'Фон сцены сохранён на этом устройстве.': 'Тло сцени збережене на цьому пристрої.'"
].forEach((entry) => assert.ok(i18n.includes(entry), `missing bilingual GM screen copy: ${entry}`));

assert.match(html, /v: '2026-08-30\.3'[\s\S]*?notesUk:/, 'the current update log must include Russian and Ukrainian notes');

console.log('IRL GM screen: ok');
