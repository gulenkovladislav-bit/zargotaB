'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  html,
  /id="zg-adv-view-format"[\s\S]*?zgAdvChooseMode\('online'\)[\s\S]*?Онлайн-игра[\s\S]*?zgAdvChooseMode\('irl'\)[\s\S]*?Реальная игра/,
  'creating a game must present online and real-life formats before any room action'
);

const showCreate = html.match(/w\.zgAdvShowCreate = function\(\) \{[\s\S]*?\n  \};/);
assert.ok(showCreate, 'create-game format handler must exist');
assert.match(showCreate[0], /showView\('zg-adv-view-format'/, 'Create Game must open the format chooser');
assert.doesNotMatch(showCreate[0], /createRoom/, 'opening the format chooser must not create a Firebase room');

const createGame = html.match(/w\.zgAdvCreateGame = function\(\) \{[\s\S]*?\n  \};/);
assert.ok(createGame, 'mode-aware create handler must exist');
assert.match(createGame[0], /entered!==\'777\'.*entered!==\'7777\'/, 'the requested 777 master password must work while keeping the previous code compatible');
assert.match(createGame[0], /createGameMode===\'irl\'[\s\S]*?showPage\('gm-table'\)[\s\S]*?return;/, 'real-life mode must open the local GM table and stop before networking');
assert.match(createGame[0], /createGameMode!==\'online\'[\s\S]*?ZargotaRooms\.createRoom\(\)/, 'Firebase room creation must be guarded by explicit online mode');

const gmTable = html.match(/id="page-gm-table"[\s\S]*?<\/div>\s*<\/div>/);
assert.ok(gmTable, 'real-life mode must have a GM workspace');
assert.match(gmTable[0], /zg-irl-table-back[\s\S]*?На главную/, 'the empty workspace must keep only a Home escape hatch');
assert.doesNotMatch(gmTable[0], /Пространство готово|Стол мастера|zg-irl-empty/, 'the workspace itself must stay visually empty');
assert.match(html, /body\.zg-irl-table-view #header, #header\[hidden\] \{ display:none!important; \}/, 'the global site header must stay hidden on the GM table');
assert.match(html, /id="zg-irl-session-bridge"[\s\S]*?Вернуться к игре[\s\S]*?zgIrlSessionEndRequest/, 'an active IRL session must expose fast return and explicit finish controls elsewhere');
assert.match(html, /ACTIVE_KEY='zg_irl_session_v1'[,\s\S]*?localStorage\.setItem\(ACTIVE_KEY/, 'IRL session state and future workspace data must persist locally');
assert.match(html, /zgIrlSessionSaveData=function\(key,value\)/, 'IRL workspace modules must have a durable data-saving bridge');
assert.match(html, /archive\.unshift\(state\)[\s\S]*?localStorage\.removeItem\(ACTIVE_KEY\)/, 'finishing must archive data before clearing the active session');
const irlStart = html.match(/w\.zgIrlSessionStart=function\(\)[\s\S]*?\};/);
assert.ok(irlStart, 'IRL local-session starter must exist');
assert.doesNotMatch(irlStart[0], /Firebase|ZargotaRooms|createRoom/, 'starting an IRL session must remain completely local');

console.log('adventure mode choice contracts passed');
