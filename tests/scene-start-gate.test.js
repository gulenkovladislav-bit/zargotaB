'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const helperStart = network.indexOf('  function hasPublishedScene(');
const helperEnd = network.indexOf('\n  }', helperStart) + 4;
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'published-scene gate helper must exist');

const context = { Array, Number };
vm.runInNewContext(network.slice(helperStart, helperEnd), context);

assert.strictEqual(context.hasPublishedScene(null), false, 'missing scene must remain blocked');
assert.strictEqual(context.hasPublishedScene({}), false, 'unpublished object must remain blocked');
assert.strictEqual(context.hasPublishedScene({ revision: 42, publishedAt: 42 }), true, 'blank Firebase scene is valid after empty arrays are omitted');
assert.strictEqual(context.hasPublishedScene({ tokens: [{ id: 'hero-1' }] }), true, 'token-only Firebase scene is valid without layers');
assert.strictEqual(context.hasPublishedScene({ layers: [{ id: 'legacy-bg' }] }), true, 'legacy layered scene remains valid');
assert.strictEqual(context.hasPublishedScene({ revision: 42 }), false, 'local revision without publication marker must remain blocked');

const startGameStart = network.indexOf('    startGame: function ()');
const startGameEnd = network.indexOf('\n    publishScene: function', startGameStart);
const startGameBlock = network.slice(startGameStart, startGameEnd);
assert.match(startGameBlock, /if \(!hasPublishedScene\(room\.scene\)\)/);
assert.doesNotMatch(startGameBlock, /room\.scene\.layers\.length/, 'start gate must not require a background layer');

const loadingStart = html.indexOf("    var loading=el('zg-vtt-loading');");
const loadingEnd = html.indexOf('\n    if(!isMaster&&overlay', loadingStart);
const loadingBlock = html.slice(loadingStart, loadingEnd);
assert.ok(loadingStart >= 0 && loadingEnd > loadingStart, 'player scene-loading gate must exist');
assert.match(loadingBlock, /publishedScene=snapshot\.room\.scene/);
assert.match(loadingBlock, /Number\(publishedScene\.revision\)>0&&publishedScene\.publishedAt!=null/,
  'a published grid-only scene must release the player canvas');
assert.doesNotMatch(loadingBlock, /draft\.layers/,
  'player input must not stay blocked merely because a playable scene has no background layer');

const launchStart = html.indexOf('  w.zgStartPlayers = function()');
const launchEnd = html.indexOf('\n  // Combat and other VTT modules', launchStart);
const launchBlock = html.slice(launchStart, launchEnd);
assert.ok(launchBlock.indexOf('ZargotaRooms.publishScene(draft)') < launchBlock.indexOf('ZargotaRooms.startGame()'), 'launch must publish before checking the scene gate');
assert.match(launchBlock, /roomSnapshot\.room\.phase==='playing' \|\| roomSnapshot\.room\.gameStartedAt/,
  'an already launched room must reject repeated start actions');
assert.match(html, /onclick="zgPrimarySessionAction\(\)"/, 'primary session control routes Workshop back to the live room');
assert.match(html, /showPage\('home'\)/, 'Workshop opened without a live room still has a working close path');
assert.match(html, /Закрыть мастерскую/, 'Workshop without a live room does not advertise a dead live-room action');
assert.match(html, /startButton\.textContent=localWorkshop\?\(workshopHasLive\?'← В живую сессию':'← Закрыть мастерскую'\)/, 'Workshop always exposes the correct primary escape action');
assert.match(html, /launchComplete\?'✓ Игроки на сцене':'Запустить игроков'/,
  'the launch action becomes a clear completed status after players enter');
assert.match(html, /startButton\.disabled=launchBusy\|\|launchComplete/,
  'the completed launch status cannot be pressed again');

console.log('scene start gate contract passed');
