const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /\.char-inventory-sort\{[^}]*-webkit-appearance:none!important;[^}]*appearance:none!important;/, 'inventory sorting must suppress Safari native select chrome');

const inlineStart = html.indexOf('function buildCharacterInventoryLauncher');
const inlineEnd = html.indexOf('function charOpenInventoryPanel', inlineStart);
const panelStart = html.indexOf('function charRenderInventoryPanel');
const panelEnd = html.indexOf('// ── New helpers ──', panelStart);

assert.ok(inlineStart >= 0 && inlineEnd > inlineStart, 'inline inventory launcher must exist');
assert.ok(panelStart >= 0 && panelEnd > panelStart, 'inventory panel renderer must exist');
assert.match(html.slice(inlineStart, inlineEnd), /select class="char-inventory-sort"/, 'inline inventory sorting must use the normalized control');
assert.match(html.slice(panelStart, panelEnd), /select class="char-inventory-sort"/, 'full inventory sorting must use the normalized control');

console.log('character inventory Safari controls contract passed');
