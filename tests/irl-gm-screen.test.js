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

['clue', 'item', 'social', 'weather', 'danger', 'encounter', 'reward', 'opportunity', 'complication', 'magic'].forEach((type) => {
  assert.match(workspaceBlock[0], new RegExp(`${type}:\\{label:`), `missing semantic event type: ${type}`);
});
const eventTypesBlock = workspaceBlock[0].match(/var EVENT_TYPES=\{[\s\S]*?\n  \};/);
assert.ok(eventTypesBlock, 'event type registry must exist');
assert.match(workspaceBlock[0], /id="zg-irl-event-type"[\s\S]*?id="zg-irl-event-text"[\s\S]*?Сохранить в сцену/, 'events must use one concise text field after the semantic type');
assert.doesNotMatch(workspaceBlock[0], /id="zg-irl-event-summary"|id="zg-irl-event-details"/, 'the live event form must not make the GM fill redundant summary and details fields');
assert.match(workspaceBlock[0], /sceneIds:\[scene\.id\]/, 'new events must belong to the current scene');
assert.match(workspaceBlock[0], /function eventTypeIcon\(key,className\)[\s\S]*?<svg class="zg-event-icon-svg/, 'event types must use drawn SVG icons instead of emoji labels');
assert.doesNotMatch(eventTypesBlock[0], /icon:'(?:⚠|◆|✦|◇|⌕)'/, 'semantic event types must not fall back to emoji or text glyphs');
assert.match(workspaceBlock[0], /function buildIrlEventAiPrompt\(scene\)[\s\S]*?ЭТО ЖЕ СООБЩЕНИЕ голосовым описанием события[\s\S]*?item — найденная вещь[\s\S]*?social — разговор[\s\S]*?weather — погода[\s\S]*?=== НАЧАЛО ГОЛОСОВОГО ОПИСАНИЯ СОБЫТИЯ ===/, 'event AI prompt must classify same-message voice material into explicit semantic types');
assert.match(workspaceBlock[0], /function parseIrlEventAiResponse\(value\)[\s\S]*?JSON\.parse[\s\S]*?eventTypeKey\(parsed\.type\)[\s\S]*?ИИ заполнил не все поля события/, 'event importer must validate JSON, type and every required field');
const eventTypeKeySource = workspaceBlock[0].match(/function eventTypeKey\(value\)\{[\s\S]*?\}\n  function eventAiValue/);
const eventAiValueSource = workspaceBlock[0].match(/function eventAiValue\(value\)\{[\s\S]*?\}\n  function parseIrlEventAiResponse/);
const eventParserSource = workspaceBlock[0].match(/function parseIrlEventAiResponse\(value\)\{[\s\S]*?return result;\}/);
assert.ok(eventTypeKeySource && eventAiValueSource && eventParserSource, 'event parser helpers must be extractable for runtime regression checks');
const parseEventResponse = new Function('tr', `${eventTypesBlock[0]}\n${eventTypeKeySource[0].replace(/\n  function eventAiValue$/, '')}\n${eventAiValueSource[0].replace(/\n  function parseIrlEventAiResponse$/, '')}\n${eventParserSource[0]}\nreturn parseIrlEventAiResponse;`)((value) => value);
const parsedWeather = parseEventResponse('```json\n{"type":"weather","title":"Красный дождь","summary":"Дождь начинается над площадью.","trigger":"Когда герои войдут на площадь.","outcome":"Следы на камне становятся видимыми.","gmNote":"Дождь не причиняет урона."}\n```');
assert.deepStrictEqual(parsedWeather, {type:'weather', title:'Красный дождь', summary:'Дождь начинается над площадью.', trigger:'Когда герои войдут на площадь.', outcome:'Следы на камне становятся видимыми.', gmNote:'Дождь не причиняет урона.'}, 'complete weather JSON must survive the importer unchanged');
assert.strictEqual(parseEventResponse('{"type":"Находка","title":"Серебряный ключ","summary":"Ключ лежит под доской.","trigger":"После успешного поиска.","outcome":"Он открывает старый сундук.","gmNote":"Отдельного секрета нет."}').type, 'item', 'Russian AI type labels must normalize to stable event keys');
assert.throws(() => parseEventResponse('{"type":"social","title":"Спор у ворот","summary":"Стража не пускает героев."}'), /ИИ заполнил не все поля события/, 'incomplete AI JSON must not create a partial event');
assert.match(workspaceBlock[0], /w\.zgIrlEventAiApply=function\(event\)[\s\S]*?trigger:imported\.trigger[\s\S]*?gmNote:imported\.gmNote[\s\S]*?sceneIds:\[scene\.id\][\s\S]*?save\(state\)/, 'a complete imported event must save all structured fields into the current scene');
assert.match(workspaceBlock[0], /stored\.events=.*?trigger:String\(item\.trigger\|\|''\).*?outcome:String\(item\.outcome\|\|''\).*?gmNote:String\(item\.gmNote\|\|''\)/, 'legacy events must normalize safely when structured AI fields are absent');
assert.match(workspaceBlock[0], /sections=\[\['Завязка',event\.trigger[\s\S]*?\['Развитие',event\.outcome[\s\S]*?\['Мастеру',event\.gmNote[\s\S]*?zg-irl-event-card-detail/, 'the pinned event card must expose its playable structure without mixing the GM note into the public summary');

assert.match(workspaceBlock[0], /w\.zgImageStore\.put\(file,'irl-scenes'/, 'scene backgrounds must use the existing local image store');
assert.match(workspaceBlock[0], /getBlobUrl\(source/, 'stored scene backgrounds must resolve after reload');
assert.match(workspaceBlock[0], /background:String\(scene\.background\|\|''\)/, 'each scene must persist its own background reference');
assert.match(workspaceBlock[0], /backgroundScale:clampNumber\(scene\.backgroundScale,100,160,100\)/, 'each scene must persist a bounded background scale');
assert.match(workspaceBlock[0], /backgroundDim:clampNumber\(scene\.backgroundDim,0,80,38\)/, 'each scene must persist a bounded background dim level');
assert.match(workspaceBlock[0], /zgIrlSceneBackgroundAdjust=function\(kind,value,commit\)[\s\S]*?applySceneBackground\(state,scene\)[\s\S]*?if\(commit\)save\(state\)/, 'background tuning must preview live and persist only the committed value');

assert.match(html, /id="zg-irl-scene-memo"[^>]*data-irl-window-key="scene-memo"/, 'the active scene memo must stay visible in the top-right workspace and remain movable');
assert.match(workspaceBlock[0], /gmNotes:normalizeIrlSceneNotes\(scene\.gmNotes\)/, 'each physical scene must own the same five-part GM note schema');
assert.match(workspaceBlock[0], /IRL_SCENE_NOTE_FIELDS=\{[\s\S]*?description:[\s\S]*?temperature:[\s\S]*?environment:[\s\S]*?scent:[\s\S]*?important:/, 'the live scene memo must mirror the established five sections');
assert.match(workspaceBlock[0], /description:\{icon:'✦',color:'#efc65d'[\s\S]*?temperature:\{icon:'◒',color:'#66c6e5'[\s\S]*?environment:\{icon:'⌁',color:'#79c982'[\s\S]*?scent:\{icon:'≈',color:'#c28be2'[\s\S]*?important:\{icon:'!',color:'#ef765d'/, 'all five memo categories must have stable and distinct color accents');
assert.match(workspaceBlock[0], /function renderSceneMemo\(\)[\s\S]*?role="tab"[\s\S]*?aria-selected[\s\S]*?zg-irl-scene-memo-tabs[\s\S]*?zg-irl-scene-memo-pane[\s\S]*?activeText\|\|tr\('Раздел пока не заполнен\.'/,
  'the compact memo must render five selectable tabs and only one active full-text panel');
assert.doesNotMatch(workspaceBlock[0], /function renderSceneMemo\(\)[\s\S]*?shortText\(notes\[key\],220\)/, 'the selected compact memo section must no longer truncate its text');
assert.match(workspaceBlock[0], /w\.zgIrlSceneMemoTab=function\(key,event\)[\s\S]*?irlSceneMemoTab=key;irlSceneNoteTab=key;renderSceneMemo\(\)/, 'switching the compact memo must stay synchronized with the editor category');
assert.match(workspaceBlock[0], /w\.zgIrlSceneNoteTab=function\(key,event\)[\s\S]*?irlSceneNoteTab=key;irlSceneMemoTab=key;renderNote\(\);renderSceneMemo\(\)/, 'switching the editor must update the compact memo category too');
assert.match(html, /\.zg-irl-scene-memo-tabs button\.active\{[^}]*border-color:var\(--memo-accent\)[^}]*background:linear-gradient/, 'the compact memo selected tab must visibly use its category color');
assert.match(html, /\.zg-irl-scene-memo-pane\{[^}]*border-left:3px solid var\(--memo-accent\)/, 'the full selected memo text must carry the same category accent');
assert.match(workspaceBlock[0], /function buildIrlSceneNotePrompt\(scene\)[\s\S]*?"description"[\s\S]*?"important"/, 'the scene settings must provide the established AI prompt interchange');
assert.match(workspaceBlock[0], /ЭТО ЖЕ СООБЩЕНИЕ голосовым описанием[\s\S]*?ОБЯЗАТЕЛЬНО заполни все пять полей[\s\S]*?=== НАЧАЛО ГОЛОСОВОГО ОПИСАНИЯ ===/, 'the physical-table prompt must support complete same-message voice input');
assert.doesNotMatch(workspaceBlock[0], /\[Вставь сюда описание сцены/, 'the physical-table prompt must not glue a placeholder to the voice transcript');
assert.match(workspaceBlock[0], /function parseIrlSceneNoteResponse\(value\)[\s\S]*?JSON\.parse[\s\S]*?fromHeadings/, 'the live scene importer must accept JSON and headed prose');
assert.match(html, /id="zg-irl-note-panel" class="zg-scene-gm-note zg-irl-scene-note-dialog"/, 'the IRL memo must reuse the established online memo component instead of a custom drawer');
assert.match(html, /id="zg-irl-note-panel"[\s\S]*?data-irl-scene-note-tab="description"[\s\S]*?data-irl-scene-note-tab="important"[\s\S]*?class="zg-scene-gm-note-tools"/, 'the IRL dialog must keep the same tab and AI-tool structure as the online memo');
assert.doesNotMatch(workspaceBlock[0], /zg-irl-scene-note-editor[\s\S]*?host\.innerHTML/, 'scene settings must not retain the duplicate embedded memo editor');
assert.match(workspaceBlock[0], /w\.zgIrlSceneNoteOpen=function\(\)\{openPanel='note'/, 'the floating memo edit action must open the shared-style note dialog');
assert.match(workspaceBlock[0], /w\.zgIrlSceneNoteAiApply=function\(event\)[\s\S]*?scene\.gmNotes=notes[\s\S]*?save\(state\)/, 'an imported memo must save into the current physical scene');
assert.match(workspaceBlock[0], /Object\.keys\(IRL_SCENE_NOTE_FIELDS\)\.some[\s\S]*?ИИ заполнил не все пять разделов/, 'an incomplete AI response must not erase the existing physical-table note');
assert.match(workspaceBlock[0], /stored\.note\.trim\(\)&&!stored\.legacyNoteMigrated[\s\S]*?migrationTarget\.gmNotes\.important/, 'the retired free draft must migrate into Important without dropping its text');
assert.match(html, /\.zg-irl-scene-switch:hover:not\(:disabled\)[^{]*\{transform:translateX\(-50%\)/, 'hovering the centered current-scene button must preserve its centering transform');

assert.match(html, /\.zg-irl-character-card\{[^}]*top:66px[^}]*height:min\(700px,calc\(100dvh - 188px\)\)/, 'the character window must stay inside the viewport above the portrait dock');
assert.match(html, /data-irl-window-key="character"/, 'the character window must be draggable');
['names', 'saved-names', 'npc-drawer', 'event-drawer', 'scene-drawer'].forEach((key) => {
  assert.match(html, new RegExp(`data-irl-window-key="${key}"`), `missing draggable window: ${key}`);
});
assert.match(html, /\.zg-irl-scene-note-dialog\.open\{transform:translate\(-50%,-50%\)\}/, 'the online-style IRL memo must open as a centered modal');
assert.match(html, /data-irl-window-key="pin-npc"[\s\S]*?data-irl-drag-handle/, 'pinned NPC notes must be draggable');
assert.match(html, /data-irl-window-key="pin-event"[\s\S]*?data-irl-drag-handle/, 'pinned event notes must be draggable');
assert.match(html, /data-irl-window-key="attention-menu-'\+esc\(key\)\+'"[\s\S]*?data-irl-drag-handle/, 'attention timer settings must be draggable');
assert.match(html, /data-irl-window-key="attention-due-'\+esc\(key\)\+'"[\s\S]*?data-irl-drag-handle/, 'attention reminders must be draggable');
assert.match(html, /STORAGE_KEY='zg_irl_window_positions_v2'[\s\S]*?document\.addEventListener\('pointerdown',down,true\)/, 'drag positions must persist for the current browser tab and support pointer input');
assert.match(html, /function origin\(node\)[\s\S]*?closest\('\.zg-irl-character-dock'\)[\s\S]*?point\.x-base\.x/, 'nested attention windows must translate viewport coordinates through the centred portrait dock');
assert.match(html, /function reset\(node\)[\s\S]*?node\.style\.removeProperty/, 'windows without a saved position must return to the safe default layout');
assert.match(html, /\.zg-irl-pinned-card\.npc \.zg-irl-pinned-head \.zg-irl-npc-avatar\{width:84px;height:84px\}/, 'the pinned NPC card must use a larger portrait without enlarging event icons');
assert.match(html, /\.zg-irl-pinned-card\{[^}]*min-height:min-content[^}]*overflow:hidden/, 'a resized pinned card must keep its complete content inside its own frame');
assert.match(html, /\.zg-irl-pinned-head>span\{min-width:0\}/, 'long pinned NPC headings must be allowed to wrap inside the grid column');
assert.match(html, /\.zg-irl-pinned-card \.zg-irl-behavior\{[^}]*white-space:normal!important[^}]*overflow-wrap:anywhere/, 'long NPC behavior cues must wrap instead of escaping the pinned card');
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
  "'ПАМЯТКА СЦЕНЫ': 'ПАМ’ЯТКА СЦЕНИ'",
  "'Памятка мастера об активной сцене': 'Пам’ятка Майстра про активну сцену'",
  "'Разделы памятки сцены': 'Розділи пам’ятки сцени'",
  "'Раздел пока не заполнен.': 'Розділ поки не заповнений.'",
  "'Затемнение': 'Затемнення'",
  "'Что произойдёт или что найдут?': 'Що станеться або що знайдуть?'",
  "'Сохранить в сцену': 'Зберегти до сцени'",
  "'Находка': 'Знахідка'",
  "'Социальная сцена': 'Соціальна сцена'",
  "'Погодное явление': 'Погодне явище'",
  "'Скопировать AI-промпт': 'Скопіювати AI-промпт'",
  "'Создать событие': 'Створити подію'",
  "'ИИ заполнил не все поля события. Повторите запрос с тем же промптом.': 'ШІ заповнив не всі поля події. Повторіть запит із тим самим промптом.'",
  "'Вставьте и продолжите голосом': 'Вставте й продовжте голосом'",
  "'Промпт скопирован — вставьте его и продолжите это же сообщение голосом': 'Промпт скопійовано — вставте його й продовжте це саме повідомлення голосом'",
  "'ИИ заполнил не все пять разделов. Повторите запрос с тем же промптом.': 'ШІ заповнив не всі п’ять розділів. Повторіть запит із тим самим промптом.'",
  "'Фон сцены сохранён на этом устройстве.': 'Тло сцени збережене на цьому пристрої.'"
].forEach((entry) => assert.ok(i18n.includes(entry), `missing bilingual GM screen copy: ${entry}`));

assert.match(html, /v: '2026-08-31\.1'[\s\S]*?цветокодированные вкладки[\s\S]*?вкладки з кольоровим кодуванням/, 'the current update log must describe compact memo tabs in Russian and Ukrainian');

console.log('IRL GM screen: ok');
