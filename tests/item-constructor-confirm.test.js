const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function openItemConstructor');
const end = html.indexOf('// ── Interactions ──', start);

assert.ok(start >= 0 && end > start, 'item constructor block must exist');

const editor = html.slice(start, end);

assert.match(editor, /function itemEditorConfirm\(options\)/, 'item constructor must provide an in-app confirmation dialog');
assert.match(editor, /role', 'alertdialog'/, 'confirmation dialog must expose alertdialog semantics');
assert.match(editor, /itemEditorConfirm\(\{[\s\S]*?kicker: 'Удаление предмета'/, 'item deletion must use the in-app confirmation dialog');
assert.match(editor, /itemEditorConfirm\(\{[\s\S]*?kicker: 'Несохранённые изменения'/, 'dirty close must use the in-app confirmation dialog');
assert.doesNotMatch(editor, /\bconfirm\s*\(/, 'item constructor must not invoke the browser-native confirm dialog');

console.log('item constructor confirmation contract passed');
