'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cursorPath = path.join(root, 'images', 'vtt-actions', 'cursors', 'spell-triad.png');

assert.ok(fs.existsSync(cursorPath), 'selected spell cursor asset exists');
assert.ok(fs.statSync(cursorPath).size > 10_000, 'spell cursor is a real production asset');
assert.match(html, /ability:'images\/vtt-actions\/cursors\/spell-triad\.png'/, 'ability action and targeting cursor use the selected triad artwork');
assert.match(html, /tool:'ability',targetHovered:!!targetHovered/, 'spell targeting still drives the range endpoint and hover expansion');
assert.match(html, /limit:range/, 'spell targeting still displays and enforces its range');
assert.match(html, /\.zg-tool-range-vector\[data-tool="ability"\] \.range-vortex\{width:54px;height:54px/, 'spell cursor has a compact map state');
assert.match(html, /\.zg-tool-range-vector\[data-tool="ability"\]\.on-token \.range-vortex\{width:68px;height:68px/, 'spell cursor expands over a target token');

console.log('Ability cursor artwork contract passed');
