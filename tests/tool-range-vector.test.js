'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function movementBudgetCells\(actor\)/, 'movement range uses the live remaining movement budget');
assert.match(html, /function renderToolRangeVector\(config\)/, 'movement and attacks share one range renderer');
assert.match(html, /function scheduleToolRangeVector\(config\)/, 'pointer previews are coalesced by a scheduler');
assert.match(html, /if\(toolRangeFrame\)return/, 'only one range RAF may be active at a time');
assert.match(html, /var movementLayerRect=null,toolRangeLayerRect=null;/, 'pointer and range layers cache their board geometry independently');
assert.match(html, /rect = movementLayerRect = \{layer:layer,left:bounds\.left,top:bounds\.top,width:bounds\.width,height:bounds\.height\}/, 'the cached targeting geometry comes from one layout read');
assert.match(html, /function applyCamera\(\)\{\s*invalidateToolPointerMetrics\(\);/, 'camera changes invalidate cached targeting geometry');
var movementPointStart=html.indexOf('  function movementPoint(ev)');
var movementPointEnd=html.indexOf('  function movementBudgetCells',movementPointStart);
assert.ok(movementPointStart>=0&&movementPointEnd>movementPointStart,'movement point helper must remain extractable');
assert.doesNotMatch(html.slice(movementPointStart,movementPointEnd),/offsetWidth|offsetHeight/,'high-frequency pointer events must not force extra layout reads');
assert.match(html, /w\.requestAnimationFrame/, 'range rendering uses requestAnimationFrame');
assert.match(html, /class="range-overflow overflow-core"/, 'range beyond the limit has a distinct overflow segment');
assert.match(html, /vector\.setAttribute\('data-tool',toolKey\)/, 'every supported action keeps its own endpoint artwork key');
assert.match(html, /vector\.classList\.toggle\('on-token',\(toolKey==='attack'\|\|toolKey==='ability'\)&&!!config\.targetHovered\)/, 'attack and ability targeting expose an expanded endpoint state over tokens');
assert.match(html, /attackPreview\.targetHovered=!!hoveredTarget/, 'the scene pointer distinguishes a target token from empty map space');
assert.match(html, /class="range-vortex"><img alt="" aria-hidden="true">/, 'the line endpoint renders the selected cursor artwork instead of the old reticle');
assert.match(html, /cursorIcon=actionCursorIcons\[toolKey\]\|\|actionCursorIcons\.custom/, 'the shared renderer resolves movement, attack and action cursor assets through one map');
assert.doesNotMatch(html, /class="range-move-icon"/, 'the endpoint artwork replaces the duplicate movement symbol inside the distance badge');
assert.match(html, /\.range-distance-value\{font-size:13\.5px;/, 'movement distance numbers are enlarged by fifty percent');
assert.match(html, /function toolRangeStraightPath\(from,to\)/, 'high-frequency targeting owns a constant-cost straight SVG path');
assert.match(html, /directThread=abilityThread\|\|movementThread/, 'movement and spell targeting share the lightweight path mode');
assert.match(html, /allowedPath=directThread\?toolRangeStraightPath\(origin,geometry\.allowedPoint\)/, 'movement and ability targeting bypass decorative curve sampling on every pointer frame');
assert.match(html, /overflowPath=geometry\.over\?\(directThread\?toolRangeStraightPath\(geometry\.allowedPoint,point\)/, 'their out-of-range segment also uses the constant-cost path');
assert.match(html, /Math\.sin\(ratio\*Math\.PI\*5/, 'the spectral thread combines a visible secondary wave instead of drawing a rigid line');
assert.match(html, /attackControlA=.*attackControlB=/, 'attack targeting bends through two opposing controls instead of a rigid line');
assert.match(html, /ornamentalThread=attackThread/, 'only attack targeting retains the decorative cubic curve');
assert.match(html, /threadScale=attackThread\?2\.6:1/, 'only the attack path retains amplified ornamental wave sampling');
assert.match(html, /@keyframes zgGhostThreadFlow/, 'the spectral thread texture flows along the action path');
assert.match(html, /\.zg-tool-range-vector \.range-vortex::before\{display:none\}/, 'all endpoint cursor artwork renders without a generic dark circular plate');
assert.doesNotMatch(html, /\.range-vortex::before\{[^}]*background:radial-gradient/, 'no action endpoint can restore the old dark circular background');
assert.match(html, /\.zg-action-cursor-glyph::before\{display:none\}/, 'all free cursor artwork renders without a generic dark circular plate');
assert.match(html, /attackPreview\.tool='attack';attackPreview\.targetHovered=!!hoveredTarget;scheduleToolRangeVector\(attackPreview\)/, 'attack pointer movement and hover state reach the shared renderer');
assert.match(html, /function scheduleAbilityTargetPreview\(ev\)/, 'spell and skill targeting coalesces high-frequency pointer input');
assert.match(html, /function flushAbilityTargetPreview\(frameAt\)/, 'ability targeting owns one throttled frame flusher');
assert.doesNotMatch(html, /now-abilityTargetPreviewAt<30/, 'ability targeting is no longer artificially capped near thirty frames per second');
assert.doesNotMatch(html, /abilityTargetPreviewAt/, 'the old low-FPS targeting clock is removed completely');
assert.match(html, /if\(point\)updateAbilityPointPreview\(point,!!pending\.hover\)/, 'the latest coalesced spell pointer position reaches the shared range renderer');
assert.match(html, /--zg-ability-point-x/, 'AOE targeting moves through compositor-friendly CSS coordinates');
assert.match(html, /transform:translate3d\(var\(--zg-ability-point-x,0\),var\(--zg-ability-point-y,0\),0\)/, 'the AOE preview uses a GPU transform instead of moving left and top every frame');
assert.match(html, /--zg-tool-point-x/, 'the range endpoint and distance badge share one compositor coordinate');
assert.doesNotMatch(html, /preview\.style\.left=pending\.previewPoint|preview\.style\.top=pending\.previewPoint/,'the hidden legacy movement preview receives no pointer-frame layout writes');
assert.match(html, /\.zg-tool-range-underlay\[data-tool="movement"\] path\{animation:none;filter:none\}/, 'movement targeting avoids animated SVG filters');
assert.match(html, /movementPreviewOrigin=on&&actor\?\{x:Number\(actor\.x\)\|\|0/, 'movement caches its actor origin and budget when targeting begins');
var scenePointerStart=html.indexOf("      scene.addEventListener('pointermove', function(ev){");
var scenePointerEnd=html.indexOf("      scene.addEventListener('pointerleave'",scenePointerStart);
assert.ok(scenePointerStart>=0&&scenePointerEnd>scenePointerStart,'scene movement pointer handler remains extractable');
assert.doesNotMatch(html.slice(scenePointerStart,scenePointerEnd),/movementActorToken\(\)|movementBudgetCells\(/,'pointer movement must not rescan all tokens or combat entries');
assert.match(html, /\.zg-action-cursor\[data-tool="ability"\]\.range-active \.zg-action-cursor-glyph\{opacity:1\}/, 'the lightweight 60 FPS cursor remains visible while the range line is active');
assert.match(html, /\.zg-tool-range-vector\[data-tool="ability"\] \.range-vortex\{display:none\}/, 'the slower duplicate endpoint is removed for ability targeting');
assert.match(html, /tool:'ability'/, 'spell and skill targeting keeps a dedicated line and endpoint style');
assert.match(html, /limit:range/, 'ability range drives the distance limit instead of a decorative-only line');
assert.match(html, /underlay\.setAttribute\('data-tool',toolKey\)/, 'the SVG underlay exposes the active tool for spell-specific styling');
assert.match(html, /abilityThread=toolKey==='ability'/, 'ability targeting receives its own ornamental curve mode');
assert.match(html, /\.zg-tool-range-underlay\[data-tool="ability"\] \.thread-low\{stroke:#af79df/, 'ability line carries a restrained arcane accent strand');
assert.match(html, /\.zg-tool-range-underlay\[data-tool="ability"\] path\{animation:none;filter:none\}/, 'ability pointer paths avoid animated SVG filters during cursor movement');
assert.match(html, /\.zg-vtt-scene\.ability-targeting \.zg-vtt-status-vfx[^\n]+animation-play-state:paused!important/, 'background status animations pause only while the player aims a spell');
assert.match(html, /body:has\(\.zg-vtt-scene\.ability-targeting\) \.zg-vtt-status-vfx/, 'portrait status animations pause together with scene tokens while a spell is aimed');
assert.match(html, /html\.zg-movement-targeting \.zg-vtt-status-vfx/, 'status animations pause while a movement point is aimed');
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
