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
assert.match(html, /vector\.setAttribute\('data-tool',toolKey\)/, 'every supported action keeps its own endpoint artwork key');
assert.match(html, /vector\.classList\.toggle\('on-token',\(toolKey==='attack'\|\|toolKey==='ability'\)&&!!config\.targetHovered\)/, 'attack and ability targeting expose an expanded endpoint state over tokens');
assert.match(html, /attackPreview\.targetHovered=!!hoveredTarget/, 'the scene pointer distinguishes a target token from empty map space');
assert.match(html, /class="range-vortex"><img alt="" aria-hidden="true">/, 'the line endpoint renders the selected cursor artwork instead of the old reticle');
assert.match(html, /cursorIcon=actionCursorIcons\[toolKey\]\|\|actionCursorIcons\.custom/, 'the shared renderer resolves movement, attack and action cursor assets through one map');
assert.doesNotMatch(html, /class="range-move-icon"/, 'the endpoint artwork replaces the duplicate movement symbol inside the distance badge');
assert.match(html, /\.range-distance-value\{font-size:13\.5px;/, 'movement distance numbers are enlarged by fifty percent');
assert.match(html, /var steps=attackThread\?28:\(abilityThread\?24:16\)/, 'attack and ability threads use extra samples for their ornamental curves');
assert.match(html, /Math\.sin\(ratio\*Math\.PI\*5/, 'the spectral thread combines a visible secondary wave instead of drawing a rigid line');
assert.match(html, /attackControlA=.*attackControlB=/, 'attack targeting bends through two opposing controls instead of a rigid line');
assert.match(html, /if\(ornamentalThread\)return\{x:inv\*inv\*inv/, 'attack and ability targeting follow a smooth cubic S-curve');
assert.match(html, /threadScale=attackThread\?2\.6:\(abilityThread\?1\.85:1\)/, 'attack and ability targeting receive distinct ornamental waves');
assert.match(html, /@keyframes zgGhostThreadFlow/, 'the spectral thread texture flows along the action path');
assert.match(html, /\.zg-tool-range-vector \.range-vortex::before\{display:none\}/, 'all endpoint cursor artwork renders without a generic dark circular plate');
assert.doesNotMatch(html, /\.range-vortex::before\{[^}]*background:radial-gradient/, 'no action endpoint can restore the old dark circular background');
assert.match(html, /\.zg-action-cursor-glyph::before\{display:none\}/, 'all free cursor artwork renders without a generic dark circular plate');
assert.match(html, /attackPreview\.tool='attack';attackPreview\.targetHovered=!!hoveredTarget;scheduleToolRangeVector\(attackPreview\)/, 'attack pointer movement and hover state reach the shared renderer');
assert.match(html, /updateAbilityPointPreview\(abilityPoint,!!abilityHover\)/, 'spell and skill targeting sends every pointer position into the shared range renderer');
assert.match(html, /tool:'ability'/, 'spell and skill targeting keeps a dedicated line and endpoint style');
assert.match(html, /limit:range/, 'ability range drives the distance limit instead of a decorative-only line');
assert.match(html, /underlay\.setAttribute\('data-tool',toolKey\)/, 'the SVG underlay exposes the active tool for spell-specific styling');
assert.match(html, /abilityThread=toolKey==='ability'/, 'ability targeting receives its own ornamental curve mode');
assert.match(html, /\.zg-tool-range-underlay\[data-tool="ability"\] \.thread-low\{stroke:#af79df/, 'ability line carries a restrained arcane accent strand');
assert.match(html, /function clearAbilityTargetVisuals\(\)[\s\S]*?clearToolRangeVector\(\)/, 'cancelling a cast removes its range line and pending frame');
assert.match(html, /clearToolRangeVector\(\);var abilityPreview/, 'leaving the scene clears the local SVG and pending RAF');
assert.match(html, /\.combat-target-valid/, 'valid targets have visible feedback');
assert.match(html, /\.combat-target-out/, 'out-of-range targets have visible feedback');
assert.match(html, /\.combat-target-selected/, 'selected targets have a persistent visible ring');
assert.match(html, /\.combat-target-lock/, 'confirmed targets have visible lock feedback');
assert.match(html, /\.combat-target-rejected/, 'rejected targets have visible feedback');
assert.doesNotMatch(html, /@keyframes zgRangeVortexSpin/, 'the selected static artwork is not replaced by a rotating generic reticle');

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
