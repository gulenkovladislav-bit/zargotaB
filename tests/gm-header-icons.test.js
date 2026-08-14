'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

['run','edit','eye','overview','zones','gm','delivery','lab','combat','link','gear','map'].forEach((name) => {
  assert.match(html, new RegExp('--zg-icon-' + name + ':url\\("data:image/svg\\+xml,'), `${name} uses the shared lightweight SVG-mask system`);
});
assert.match(html, /-webkit-mask:var\(--zg-service-icon\) center\/contain no-repeat;mask:var\(--zg-service-icon\) center\/contain no-repeat/, 'all service icons share one crisp scalable renderer');
assert.match(html, /\.zg-vision-gear\{--zg-service-icon:var\(--zg-icon-eye\)/, 'master/player view uses the shared eye icon');
assert.match(html, /\.zg-combat-toggle\{--zg-service-icon:var\(--zg-icon-combat\)/, 'combat uses the shared crossed-weapons icon');
assert.match(html, /\.zg-game-overlay\.gm\.gm-edit-mode \.zg-scene-tools-button\{[^}]*color:#e0b260/, 'combined overview and zones tool receives an intentional editing state');
assert.doesNotMatch(html, /id="zg-combat-lab-toggle"/, 'player control no longer consumes a GM header slot');
assert.match(html, /\.zg-combat-toggle\.active\{[^}]*color:#f1b099/, 'active combat keeps its intentional red state');
assert.doesNotMatch(html, /\.zg-overview-button:before\{content:'◉'\}/, 'legacy mixed-font toolbar glyphs are removed');

console.log('GM header icon system contracts passed');
