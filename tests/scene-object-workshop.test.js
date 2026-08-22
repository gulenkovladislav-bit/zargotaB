'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const furniture = ['bed','table','chair','chest','bookshelf','desk','bench','supplies'];

assert.match(html, /id="zg-object-search"/, 'object workshop needs one shared search field');
assert.match(html, /id="zg-object-scene-button"[^>]+aria-selected="true"/, 'object workshop must expose a clear placed-object mode');
assert.match(html, /id="zg-object-add-button"[^>]+aria-selected="false"/, 'object workshop must expose a clear catalog mode');
assert.match(html, /function syncObjectFilterCounts\(catalogMode\)/, 'filter counters must follow the active scene or catalog mode');
assert.match(html, /\.zg-obj-filters\{display:grid;grid-template-columns:1fr 1fr/, 'object filters must fit the drawer without horizontal scrolling');
assert.match(html, /\.zg-object-catalog\{display:grid;grid-template-columns:1fr 1fr/, 'catalog cards must use a compact readable grid');
['tokens','furniture','lights','notes','markers'].forEach((filter) => {
  assert.match(html, new RegExp(`data-filter="${filter}"`), `missing ${filter} object filter`);
});
assert.match(html, /SCENE_OBJECT_PRESETS=\{/, 'generated furniture must be exposed through a data-driven preset registry');
assert.match(html, /function renderObjectCatalog\(\)/, 'catalog cards must be generated from the registry');
assert.match(html, /w\.zgSceneAddPresetObject=function/, 'furniture cards must add scene objects directly');
assert.match(html, /editableObjects=draft\.tokens\.filter\(function\(token\)\{return !isHeroSlot\(token\);\}\)/, 'technical hero anchors must not clutter the object workshop');

furniture.forEach((name) => {
  const file = path.join(root, 'images', 'vtt-objects', `furniture-${name}.png`);
  assert.ok(fs.existsSync(file), `missing generated furniture asset ${name}`);
  const png = fs.readFileSync(file);
  assert.strictEqual(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.ok(png.readUInt32BE(16) >= 380 && png.readUInt32BE(20) >= 380, `${name} asset is too small`);
  assert.strictEqual(png[25], 6, `${name} asset must preserve RGBA transparency`);
  const webpFile = path.join(root, 'images', 'vtt-objects', `furniture-${name}.webp`);
  const webp = fs.readFileSync(webpFile);
  assert.strictEqual(webp.subarray(0, 4).toString('ascii'), 'RIFF', `${name} runtime asset must be WebP`);
  assert.ok(webp.length < 140000, `${name} runtime asset must stay lightweight`);
  assert.match(html, new RegExp(`images/vtt-objects/furniture-${name}\\.webp`), `${name} catalog entry must use optimized media`);
});
const brazier = fs.readFileSync(path.join(root, 'images', 'vtt-objects', 'effect-brazier.png'));
assert.strictEqual(brazier[25], 6, 'brazier must preserve RGBA transparency');
const brazierWebp = fs.readFileSync(path.join(root, 'images', 'vtt-objects', 'effect-brazier.webp'));
assert.strictEqual(brazierWebp.subarray(0, 4).toString('ascii'), 'RIFF', 'brazier runtime asset must be WebP');
assert.ok(brazierWebp.length < 70000, 'brazier runtime asset must stay lightweight');

const renderStart = html.indexOf('function renderTokens()');
const renderEnd = html.indexOf('function patchTokenRuntime()', renderStart);
const renderBlock = html.slice(renderStart, renderEnd);
assert.match(renderBlock, /\.slice\(0,6\)/, 'lighting work must be capped to six sources per render');
assert.doesNotMatch(renderBlock, /requestAnimationFrame/, 'lighting must not add a continuous JavaScript render loop');
assert.match(renderBlock, /zg-token-cast-shadow/, 'nearby character tokens need a lightweight directional shadow');
assert.match(renderBlock, /zg-scene-flame/, 'flame sources need a CSS visual');
assert.match(html, /zg-reduced-effects \.zg-vtt-token-light/, 'reduced-effects mode must disable flame/light animation');

assert.match(html, /w\.zgSceneNoteOpen=function/, 'GM notes need a dedicated editor');
assert.match(html, /w\.zgSceneNoteSave=function/, 'GM note edits need an explicit save action');
assert.match(renderBlock, /token\.hidden && !viewerGm && !isLightSource/, 'hidden notes must not render for players');
assert.match(html, /token\.type==='note'\|\|workshopHeroUid/, 'GM notes must skip single-token live publication');

assert.match(html, /\.zg-vtt-grid\{position:absolute;inset:0;z-index:4;/, 'grid must render above scene objects');
assert.match(html, /\.zg-vtt-object-layer\{position:absolute;inset:0;z-index:2\}/, 'scene objects must stay below the grid');
assert.match(html, /\.zg-vtt-token-layer\{position:absolute;inset:0;z-index:5\}/, 'creatures and markers must stay readable above the grid');
assert.match(html, /\.zg-fog-cloud-layer\{position:absolute;inset:0;z-index:6;/, 'fog must render above the grid');
assert.match(renderBlock, /\(isObj \? objectLayer : layer\)\.appendChild\(node\)/, 'object tokens must render in their dedicated layer');
assert.match(html, /grid\.style\.zIndex = '4'/, 'runtime scene application must preserve the layer order');
assert.match(html, /Предметы → сетка → туман/, 'scene settings must explain the fixed layer order');

const sanitizeStart = network.indexOf('function sanitizeScene(scene)');
const sanitizeEnd = network.indexOf('var api =', sanitizeStart);
const context = {roomError:(message) => new Error(message), isFinite:isFinite};
vm.runInNewContext(network.slice(sanitizeStart, sanitizeEnd), context);
const sanitized = context.sanitizeScene({tokens:[{
  id:'gm-note',type:'note',name:'Запах серы',noteText:'После второго шага погасить свет.',hidden:false,x:42,y:57
}]});
assert.strictEqual(sanitized.tokens.length, 0, 'GM note title and body must never enter the shared room payload');

console.log('scene object workshop tests passed');
