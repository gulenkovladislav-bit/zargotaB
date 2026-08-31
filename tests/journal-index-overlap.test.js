const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /\.zg-journal3-index\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\) 18px 39px;[\s\S]*?container-type:inline-size/, 'journal header and filters must size to their contents');
assert.match(html, /@container \(max-width:210px\)\{[\s\S]*?\.zg-journal3-index>nav\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'narrow journal filters must switch to a readable two-column grid');
assert.match(html, /class="zg-journal3-patch"[\s\S]*?>⇄ <span>Обновить лист<\/span><\/button>/, 'the narrow patch action must retain an icon-only presentation hook');
assert.match(html, /\.zg-journal3-patch span\{display:none\}/, 'the long patch label must not collide with the journal title in a narrow index');

console.log('journal index overlap passed');
