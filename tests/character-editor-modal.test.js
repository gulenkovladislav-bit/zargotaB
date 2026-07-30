const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('window.openSkillCardPopup = function');
const end = html.indexOf('function buildEquipList', start);

assert.ok(start >= 0 && end > start, 'skill/mastery editor block must exist');

const editor = html.slice(start, end);

assert.match(
  editor,
  /popup\.querySelector\('\.sc-close-x'\)\.onclick = closeAll/,
  'the explicit close button must close the editor'
);
assert.match(
  editor,
  /popup\.querySelector\('\.sc-cancel-btn'\)\.onclick = closeAll/,
  'the cancel button must close the editor'
);
assert.doesNotMatch(
  editor,
  /e\.target\s*===\s*backdrop[^}]*closeAll/,
  'clicking the backdrop must not close the editor'
);
assert.match(
  editor,
  /if \(e\.key !== 'Escape'\) return;[\s\S]*?e\.preventDefault\(\);[\s\S]*?e\.stopPropagation\(\);/,
  'Escape must be consumed without closing the editor'
);

console.log('character editor modal dismissal contract passed');
