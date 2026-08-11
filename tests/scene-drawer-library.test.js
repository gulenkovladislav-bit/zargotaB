'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /Главная библиотека[\s\S]*?Сцены · редактор/, 'scene drawer is presented as the primary library and editor');
assert.match(html, /w\.zgSceneDrawerSelect=function\(id\)\{sceneDrawerSelectedId=String\(id\|\|''\);renderScenes\(\);\}/, 'selecting a scene stays inside the library');
assert.match(html, /class="zg-scene-drawer-actions"[\s\S]*?>✎ Редактировать<[\s\S]*?>Открыть<[\s\S]*?>Игрокам<[\s\S]*?>Название<[\s\S]*?>Копия<[\s\S]*?>Версии<[\s\S]*?>Экспорт<[\s\S]*?>Удалить</, 'selected scenes expose complete editing and deletion actions');
assert.match(html, /zgSceneDrawerEditSelected\(\)[^<]*<\/button>/, 'the drawer footer opens the selected scene in the extended editor');
assert.match(html, /w\.zgSceneDrawerEdit=function\(id\)[\s\S]*?applyGmWorkspaceMode\('edit',true\)[\s\S]*?zgSceneTab\('scene'\)/, 'edit switches workspace mode and opens scene controls');
assert.match(html, /w\.zgSceneLibDelete=function\(id\)[\s\S]*?window\.confirm\(warning\)[\s\S]*?ZargotaLib\.remove/, 'scene deletion requires explicit confirmation');
assert.match(html, /\.zg-scene-drawer-item\.selected \.zg-scene-drawer-actions\{display:grid\}/, 'expanded actions only occupy space for the selected scene');
assert.match(html, /\.zg-scene-drawer\{position:fixed;z-index:9600/, 'the scene library stays above editor panels and combat chrome');
assert.match(html, /\.zg-scene-drawer-item\{[^}]*border:1\.5px solid #4c381b/, 'scene cards keep a clear authored border');
assert.match(html, /\.zg-scene-drawer-grid\{[^}]*grid-auto-rows:max-content/, 'card rows cannot shrink and overlap their text or action controls');
assert.match(html, /selectedDrawerItem\.scrollIntoView\(\{block:'nearest',inline:'nearest'\}\)/, 'expanded actions are automatically kept inside the visible library viewport');

console.log('scene drawer library contracts passed');
