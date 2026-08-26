'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const catalogSource = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'irl-name-catalog.js'), 'utf8');
const match = html.match(/<script>\s*(\(function\(w\)\{\s*var ACTIVE_KEY='zg_irl_session_v1'[\s\S]*?\}\)\(window\);)\s*<\/script>/);
assert.ok(match, 'IRL session runtime must be extractable');

const values = new Map();
const classes = new Set();
const nodes = {
  header: { hidden: false },
  'zg-irl-session-bridge': { hidden: true },
  'zg-irl-end-overlay': { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } }
};
const pageChanges = [];
const context = {
  Date,
  JSON,
  localStorage: {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  },
  document: {
    readyState: 'complete',
    getElementById: id => nodes[id] || null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } }
  },
  showPage: page => pageChanges.push(page),
  showToast() {}
};
context.window = context;
vm.runInNewContext(catalogSource, context);
vm.runInNewContext(match[1], context);

const started = context.zgIrlSessionStart();
assert.strictEqual(started.active, true, 'starting creates an active local IRL session');
assert.strictEqual(nodes['zg-irl-session-bridge'].hidden, true, 'return bridge stays hidden while already at the table');

context.zgIrlSessionPageChanged('catalog');
assert.strictEqual(nodes['zg-irl-session-bridge'].hidden, false, 'return bridge appears in another site section');
context.zgIrlSessionPageChanged('gm-table');
assert.strictEqual(nodes.header.hidden, true, 'global header is hidden on the IRL table');
assert.strictEqual(context.zgIrlSessionSaveData('gm-notes', { weather: 'cold' }), true, 'workspace data is persisted');
assert.strictEqual(nodes.header.hidden, true, 'saving table data must not make the global header return');

context.zgIrlSessionReturn();
assert.strictEqual(pageChanges.pop(), 'gm-table', 'one action returns to the IRL table');
context.zgIrlSessionEndRequest();
assert.strictEqual(classes.has('open'), true, 'finish request opens a custom confirmation');
context.zgIrlSessionEndConfirm();

assert.strictEqual(values.has('zg_irl_session_v1'), false, 'confirmed finish clears only the active marker');
const archive = JSON.parse(values.get('zg_irl_session_archive_v1'));
assert.strictEqual(archive.length, 1, 'finished session is archived');
assert.deepStrictEqual(archive[0].data['gm-notes'], { weather: 'cold' }, 'saved workspace data survives in the archive');
assert.ok(archive[0].endedAt, 'archive records when the session ended');
assert.strictEqual(pageChanges.pop(), 'home', 'finishing returns to the main site');

console.log('IRL session persistence: ok');
