'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function movementBudgetCells\(actor\)/, 'movement range uses the live remaining movement budget');
assert.match(html, /function renderToolRangeVector\(config\)/, 'movement and attacks share one range renderer');
assert.match(html, /function scheduleToolRangeVector\(config,previewPoint\)/, 'pointer previews are coalesced by a scheduler');
assert.match(html, /if\(toolRangeFrame\)return/, 'only one range RAF may be active at a time');
assert.match(html, /w\.requestAnimationFrame/, 'range rendering uses requestAnimationFrame');
assert.match(html, /class="range-overflow overflow-core"/, 'range beyond the limit has a distinct overflow segment');
assert.match(html, /data-tool',config\.tool==='attack'\?'attack':'movement'/, 'movement and attack receive distinct endpoints');
assert.match(html, /attackPreview\.tool='attack';scheduleToolRangeVector\(attackPreview\)/, 'attack pointer movement reaches the shared renderer');
assert.match(html, /clearToolRangeVector\(\);var abilityPreview/, 'leaving the scene clears the local SVG and pending RAF');
assert.match(html, /\.combat-target-valid/, 'valid targets have visible feedback');
assert.match(html, /\.combat-target-out/, 'out-of-range targets have visible feedback');
assert.match(html, /\.combat-target-selected/, 'selected targets have a persistent visible ring');
assert.match(html, /\.combat-target-lock/, 'confirmed targets have visible lock feedback');
assert.match(html, /\.combat-target-rejected/, 'rejected targets have visible feedback');
assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{\.zg-tool-range-vector/, 'endpoint animation respects reduced motion');

const geometryStart = html.indexOf('  function toolRangeGridGeometry(origin,point,limit)');
const geometryEnd = html.indexOf('  function renderToolRangeVector(config)', geometryStart);
assert.ok(geometryStart >= 0 && geometryEnd > geometryStart, 'range geometry remains independently testable');
const context = {
  draft:{gridSize:64,boardWidth:20,boardHeight:14},
  clamp:(value,min,max) => Math.max(min,Math.min(max,Number(value)))
};
vm.runInNewContext(html.slice(geometryStart, geometryEnd) + '\nresult=toolRangeGridGeometry({x:10,y:50},{x:90,y:50},7);', context);
assert.strictEqual(context.result.distance, 16, 'distance is measured in scene cells');
assert.strictEqual(context.result.limitPoint.x, 45, 'the gold segment ends at the exact seven-cell limit');
assert.strictEqual(context.result.over, true, 'cursor beyond weapon range enters overflow state');
assert.strictEqual((context.result.limitPoint.x - 10) / 100 * context.result.boardPixelWidth, 7 * 64, 'grid pixel size and cell limit stay aligned');

context.draft.gridSize = 32;
vm.runInNewContext('result=toolRangeGridGeometry({x:10,y:50},{x:90,y:50},7);', context);
assert.strictEqual((context.result.limitPoint.x - 10) / 100 * context.result.boardPixelWidth, 7 * 32, 'changing grid size preserves seven cells');

console.log('shared movement and combat range-vector contract passed');
