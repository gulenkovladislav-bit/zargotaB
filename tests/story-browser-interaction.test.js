const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../story-player.js'), 'utf8');

test('gameplay suppresses browser actions but preserves editable fields', () => {
  const handlers = {};
  const code = source.match(/function preventBrowserInteraction\(e\)\{[^\n]+\n(?:\s*root\.addEventListener\([^\n]+\n){3}/)[0];
  vm.runInNewContext(code, {root: {addEventListener: (name, handler) => {handlers[name] = handler;}}});
  for (const name of ['contextmenu', 'selectstart', 'dragstart']) {
    for (const editable of [false, true]) {
      let prevented = false;
      handlers[name]({target: {closest: () => editable}, preventDefault: () => {prevented = true;}});
      assert.equal(prevented, !editable, name);
    }
  }
});
