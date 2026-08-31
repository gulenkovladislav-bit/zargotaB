'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /id="zg-scene-gm-note-toggle"[^>]*aria-label="Памятка мастера для активной сцены"[^>]*hidden/, 'the compact note tab must live beside the active-scene rail and start hidden');
assert.match(html, /id="zg-scene-gm-note"[^>]*role="dialog"[^>]*aria-label="Памятка мастера об активной сцене"/, 'the GM note opens as an accessible compact panel');
assert.match(html, /id="zg-scene-gm-note"[^>]*aria-hidden="true"/, 'the closed panel stays out of the accessibility tree');
assert.match(html, /panel\.setAttribute\('aria-hidden',open\?'false':'true'\)/, 'opening and closing keep accessibility state aligned with the visual panel');
assert.match(html, /data-scene-note-tab="description"[\s\S]*data-scene-note-tab="temperature"[\s\S]*data-scene-note-tab="environment"[\s\S]*data-scene-note-tab="scent"[\s\S]*data-scene-note-tab="important"/, 'the panel separates narration, climate, environment, scent, and important details');
assert.match(html, /function normalizeSceneGmNotes\(value\)[\s\S]*SCENE_GM_NOTE_FIELDS/, 'scene notes are normalized through a bounded field schema');
assert.match(html, /function persistSceneGmNotes\(sceneId,notes\)[\s\S]*w\.ZargotaLib\.get\(sceneId[\s\S]*record\.gmNotes=notes[\s\S]*w\.ZargotaLib\.put\(record/, 'notes save into the fresh scene-library record instead of overwriting a stale scene');
assert.match(html, /gmNotes:normalizeSceneGmNotes\(existing&&libCache\[activeSceneId\]/, 'normal scene saves preserve note edits already cached for the active scene');
assert.match(html, /gmNotes:normalizeSceneGmNotes\(hydrated\.gmNotes\)/, 'duplicating a scene carries its GM notes');
assert.match(html, /gmNotes:normalizeSceneGmNotes\(version\.gmNotes\)/, 'restoring a scene version carries its GM notes');
assert.match(html, /scene:\{[\s\S]*?gmNotes:normalizeSceneGmNotes\(record\.gmNotes\)/, 'scene exports include the private GM notes for backup and transfer');

const copyStart = html.indexOf('function copyScene(scene)');
const copyEnd = html.indexOf('function compactSceneVisualValue', copyStart);
const copySceneBlock = html.slice(copyStart, copyEnd);
assert.strictEqual(copySceneBlock.includes('gmNotes'), false, 'GM notes must not enter the publishable scene payload seen by players');

assert.match(html, /\.zg-scene-gm-note-toggle\{position:absolute;[^}]*top:39px;[^}]*width:22px;[^}]*height:13px/, 'the launcher is a restrained framed check below the active scene');
assert.match(html, /\.zg-scene-gm-note\{position:fixed;[^}]*width:390px;[^}]*opacity:0;[^}]*pointer-events:none/, 'the note stays compact and non-blocking while closed');
assert.match(html, /\.zg-scene-gm-note\.open\{opacity:1;pointer-events:auto;/, 'the panel becomes interactive only while open');
assert.match(html, /var panelWidth=Math\.min\(440,Math\.max\(310,w\.innerWidth-16\)\)/, 'the readable panel remains compact and viewport-bounded');
assert.match(html, /\.zg-scene-gm-note\{width:440px;[^}]*color:#cdbb8c\}/, 'the GM note has a wider readable layout');
assert.match(html, /\.zg-scene-gm-note textarea\{height:132px;[^}]*font-size:16px;/, 'the actual note text is comfortably readable');
assert.match(html, /nav button:nth-child\(2\)\{--note-accent:#70c9e8/, 'climate has its own blue color code');
assert.match(html, /nav button:nth-child\(3\)\{--note-accent:#79c982/, 'environment has its own green color code');
assert.match(html, /nav button:nth-child\(4\)\{--note-accent:#c28be2/, 'scent has its own violet color code');
assert.match(html, /nav button:nth-child\(5\)\{--note-accent:#ef775e/, 'important notes have their own warning color code');
assert.match(html, /if\(!isMaster\|\|!activeSceneGmRecord\(\)\)return;/, 'players cannot open or edit the GM note');
assert.match(html, /sceneGmNotePending=\{sceneId:String\(sceneId\|\|''\),notes:normalizeSceneGmNotes\(notes\)\}/, 'autosave captures the originating scene so switching scenes cannot redirect a pending note');

assert.match(html, /onclick="zgSceneGmAiCopyPrompt\(event\)"[\s\S]*Скопировать промпт/, 'the GM can copy a ready AI prompt without a native dialog');
assert.match(html, /id="zg-scene-gm-note-ai-toggle"[\s\S]*Вставить ответ ИИ/, 'the GM can open a styled AI response importer');
assert.match(html, /Верни ТОЛЬКО один корректный JSON-объект[\s\S]*"description"[\s\S]*"temperature"[\s\S]*"environment"[\s\S]*"scent"[\s\S]*"important"/, 'the copied prompt defines the exact five-field interchange format');
const promptStart = html.indexOf('function buildSceneGmAiPrompt(record)');
const promptEnd = html.indexOf('function sceneGmAiFieldKey(value)', promptStart);
const promptBlock = html.slice(promptStart, promptEnd);
assert.match(promptBlock, /ЭТО ЖЕ СООБЩЕНИЕ голосовым описанием/, 'the copied prompt must explain the same-message voice workflow');
assert.match(promptBlock, /ОБЯЗАТЕЛЬНО заполни все пять полей/, 'the prompt must require a complete five-section note');
assert.match(promptBlock, /=== НАЧАЛО ГОЛОСОВОГО ОПИСАНИЯ ===/, 'the voice transcript must have an unambiguous final boundary');
assert.strictEqual(promptBlock.includes('[Вставь сюда'), false, 'a placeholder must not merge with the dictated material');
assert.match(html, /function copySceneGmText\(value\)[\s\S]*navigator\.clipboard\.writeText[\s\S]*document\.execCommand\('copy'\)/, 'copying uses the clipboard with a non-native fallback');
assert.match(html, /function parseSceneGmAiResponse\(value\)[\s\S]*JSON\.parse[\s\S]*fromHeadings/, 'the importer accepts both strict JSON and readable headed text');
assert.match(html, /record\.gmNotes=notes[\s\S]*scheduleSceneGmNoteSave\(activeSceneId,notes\)/, 'accepted AI fields reuse the existing bounded scene-note autosave path');
assert.match(html, /Object\.keys\(SCENE_GM_NOTE_FIELDS\)\.some[\s\S]*?ИИ заполнил не все пять разделов/, 'an incomplete AI response must not erase the existing online note');
assert.match(html, /\.zg-scene-gm-note>\.zg-scene-gm-note-ai\[hidden\]\{display:none\}/, 'the custom importer remains compact while closed');

const parserStart = html.indexOf('function sceneGmAiFieldKey(value)');
const parserEnd = html.indexOf('function copySceneGmText(value)', parserStart);
const parserContext = {};
vm.runInNewContext(html.slice(parserStart, parserEnd) + `
  jsonResult = parseSceneGmAiResponse('{"description":"Каменный зал","temperature":"Холодно","important":"Рычаг за алтарём"}');
  headingResult = parseSceneGmAiResponse('Речь: Тёмный проход\\nКлимат: Сыро\\nСреда: Капает вода\\nЗапах: Плесень\\nВажно: Дверь заперта');
`, parserContext);
assert.strictEqual(parserContext.jsonResult.description, 'Каменный зал', 'JSON AI response must map to narration');
assert.strictEqual(parserContext.jsonResult.important, 'Рычаг за алтарём', 'JSON AI response must map GM-only facts');
assert.strictEqual(parserContext.headingResult.temperature, 'Сыро', 'Russian headed text must map to climate');
assert.strictEqual(parserContext.headingResult.scent, 'Плесень', 'Russian headed text must map to scent');

console.log('scene GM note contracts passed');
