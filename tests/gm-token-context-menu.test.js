'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const dragStart = html.indexOf('  function beginTokenDrag(');
const dragEnd = html.indexOf('  function moveToken(', dragStart);
assert.ok(dragStart >= 0 && dragEnd > dragStart, 'GM token drag handler remains extractable');
const dragBlock = html.slice(dragStart, dragEnd);
assert.match(dragBlock, /var contextMoveArmed=String\(gmTokenMoveArmedId\|\|''\)===String\(token\.id\|\|''\)/, 'an explicit context-menu move command arms exactly one token');
assert.match(dragBlock, /if\(gmWorkspaceMode!==['"]edit['"]&&!contextMoveArmed\)return;/, 'run mode still blocks accidental dragging until the context action is armed');
assert.match(dragBlock, /if \(token\.locked\)[\s\S]*return;/, 'locked tokens remain protected in edit mode too');
assert.match(dragBlock, /tokenDrag = \{ token:token/, 'edit mode still reaches the existing drag implementation');

const renderStart = html.indexOf('  function renderTokens()');
const renderEnd = html.indexOf('  function patchTokenRuntime()', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'token renderer remains extractable');
const renderer = html.slice(renderStart, renderEnd);
assert.match(renderer, /if \(gmWorkspaceMode===['"]edit['"]&&!token\.locked\)/, 'resize handle only appears in edit mode');
assert.doesNotMatch(renderer, /zg-vtt-token-actions/, 'legacy emoji action strip is removed instead of competing with the context menu');
assert.match(renderer, /node\.addEventListener\('contextmenu'/, 'each GM token exposes a custom right-click menu');
assert.match(renderer, /if\(ev\.shiftKey\)\{toggleGroupSel\(token\);closeGmTokenContextMenu\(\);return;\}/, 'Shift+right click only toggles group selection and never opens a token menu');
assert.match(renderer, /selectGmToken\(token,node\);\s*openGmTokenContextMenu\(ev,token\);/, 'plain right click opens actions for exactly the clicked token');
assert.doesNotMatch(renderer, /else\{if\(groupSel\.length\)clearGroupSel/, 'plain right click does not silently destroy an existing group selection');
assert.match(renderer, /openGmTokenContextMenu\(ev,token\)/, 'right click opens the custom GM token menu');

const menuStart = html.indexOf('  function openGmTokenContextMenu(');
const menuEnd = html.indexOf('\n\n  function el(', menuStart);
assert.ok(menuStart >= 0 && menuEnd > menuStart, 'context menu implementation remains extractable');
const menuBlock = html.slice(menuStart, menuEnd);
assert.match(menuBlock, /Открыть лист/, 'single-token menu explains sheet access');
assert.match(menuBlock, /Скрыть от игроков/, 'menu exposes token visibility');
assert.match(menuBlock, /Закрепить на сцене/, 'menu exposes accidental-movement protection');
assert.match(menuBlock, /Переместить жетон/, 'menu exposes an explicit one-token drag mode without switching the whole workshop to edit mode');
assert.match(menuBlock, /gmTokenMoveArmedId=String\(token\.id\)/, 'move action arms the selected token only');
assert.match(menuBlock, /Перейти через портал/, 'portal navigation remains available after removing the legacy action strip');
assert.match(menuBlock, /Shift \+ ПКМ/, 'menu teaches group selection in place');
assert.match(menuBlock, /deleteTokenContextTargets/, 'deletion uses an explicit confirmation state');
assert.doesNotMatch(menuBlock, /groupMode/, 'single-token context menu no longer turns into a duplicate group menu');
assert.doesNotMatch(menuBlock, /Перейти в Редактор|Вернуться к ведению/, 'global editor mode is not mixed into token actions');

const groupStart = html.indexOf('  // ── Групповое выделение ──');
const groupEnd = html.indexOf('  // Контекстное управление жетонами', groupStart);
assert.ok(groupStart >= 0 && groupEnd > groupStart, 'group controls remain extractable');
const groupBlock = html.slice(groupStart, groupEnd);
assert.match(groupBlock, /function applyGmTokenAction\(tokens,action,value,message\)/, 'single and grouped token mutations share one implementation');
assert.match(groupBlock, /visibility\.state===['"]mixed['"]/, 'mixed visibility opens an explicit choice instead of guessing');
assert.match(groupBlock, /bar\.classList\.toggle\(['"]single['"],count===1\)/, 'one selected token uses the compact group hint state');
assert.match(groupBlock, /zgGroupDeleteRequest/, 'group deletion has a custom confirmation step');

assert.match(html, /class="zg-group-single-hint">Shift \+ ПКМ — добавить ещё/, 'the compact one-token chip teaches how to extend the group');
assert.match(html, /id="zg-group-visibility-button" onclick="zgGroupVisibility\(\)"/, 'group bar exposes one dynamic visibility control');
assert.match(html, /id="zg-group-lock-button" onclick="zgGroupLock\(\)"/, 'group bar exposes one dynamic lock control');
assert.match(html, /id="zg-group-delete-label"/, 'group bar owns its confirmation UI');

assert.match(html, /\.zg-token-context-menu\{position:fixed;z-index:220000/, 'menu stays above tokens and session surfaces');
assert.match(html, /\.zg-game-overlay\.gm\.gm-run-mode \.zg-vtt-token\{cursor:pointer\}/, 'run mode cursor communicates selection rather than dragging');
assert.match(html, /\.zg-game-overlay\.gm\.gm-edit-mode \.zg-vtt-token:not\(\.locked\)\{cursor:grab\}/, 'edit mode cursor communicates draggable tokens');
assert.match(html, /\.zg-game-overlay\.gm \.zg-vtt-token\.context-move-armed,\.zg-game-overlay\.gm\.gm-run-mode \.zg-vtt-token\.context-move-armed\{cursor:grab\}/, 'the armed token clearly advertises its temporary drag state even while selected in run mode');

console.log('GM token context menu tests passed');
