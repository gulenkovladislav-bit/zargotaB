'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function cancelSessionPlayback(reason)');
const end = html.indexOf('  function render(snapshot)', start);
const cancel = html.slice(start, end);
assert.ok(start >= 0 && end > start, 'session playback cancellation remains extractable');
assert.match(cancel, /zgCancelActiveMovementPlayback/, 'reconnect cancels token movement');
assert.match(cancel, /combatLiveFxCanvas\.clear\(reason\)/, 'reconnect clears Canvas effects and their RAF');
assert.match(cancel, /liveCombatVfxRuntime\.cancelAll\(reason\)/, 'reconnect releases every VFX handle');
assert.match(cancel, /combatPlaybackDirector\.cancelAll\(reason\)/, 'reconnect clears pending phase cues');
assert.match(cancel, /scheduleCombatPresentationReveal\.timer/, 'reconnect clears the fallback reveal timer');
assert.match(cancel, /Object\.keys\(dicePreviewTasks\)/, 'reconnect stops shared dice preview tasks');
assert.match(cancel, /\.zg-combat-impact/, 'reconnect removes transient DOM labels instead of leaving frozen FX');

const renderStart = end;
const renderEnd = html.indexOf('  w.zgVttApplyTestSnapshot=', renderStart);
const render = html.slice(renderStart, renderEnd);
assert.match(render, /snapshot\.online===false&&sessionPlaybackOnline!==false\)cancelSessionPlayback\('reconnect'\)/, 'disconnect transition triggers cleanup exactly once');
assert.match(render, /nextRoomCode!==sessionPlaybackRoomCode\)cancelSessionPlayback\('room-changed'\)/, 'changing rooms cannot inherit old effects');

console.log('playback reconnect cancellation contract passed');
