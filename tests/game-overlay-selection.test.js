const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  html,
  /\.zg-game-overlay\{[^}]*-webkit-user-select:none;user-select:none\}/,
  'game overlay must prevent accidental text selection'
);
assert.match(
  html,
  /\.zg-game-overlay input,\.zg-game-overlay textarea,\.zg-game-overlay \[contenteditable="true"\],\.zg-game-overlay \[contenteditable="plaintext-only"\]\{[^}]*-webkit-user-select:text;user-select:text\}/,
  'editable controls must keep normal text selection'
);

console.log('game overlay selection contract passed');
