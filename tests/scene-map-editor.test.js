'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /id="zg-scene-size-summary-board"/);
assert.match(html, /id="zg-scene-size-summary-view"/);
assert.match(html, /id="zg-scene-size-summary-image"/);
assert.match(html, /Игровое поле: '\+cellsW\+' × '\+cellsH\+' клеток/);
assert.match(html, /Math\.round\(cellsW\*cell\)/);
assert.match(html, /probe\.naturalWidth/);
assert.match(html, /Масштаб слоя:/);
assert.match(html, /zgSceneBoardPreset\(24,16,48\)/);
assert.match(html, /zgSceneBoardPreset\(32,20,64\)/);
assert.match(html, /zgSceneBoardPreset\(48,30,64\)/);
assert.match(html, /id="zg-scene-grid-color"/);
assert.match(html, /id="zg-scene-grid-opacity"/);
assert.match(html, /id="zg-scene-grid-thickness"/);
assert.match(html, /id="zg-scene-grid-contrast"/);
assert.match(html, /id="zg-scene-grid-saturation"/);
assert.match(html, /grid\.style\.backgroundImage = 'linear-gradient/);
assert.match(html, /grid\.style\.filter = 'contrast\('/);
assert.match(html, /id="zg-layer-contrast"/);
assert.match(html, /id="zg-layer-darken"/);
assert.match(html, /id="zg-layer-locked"/);
assert.match(html, /id="zg-layer-reset"/);
assert.match(html, /option value="custom">Свой размер/);
assert.match(html, /layer\.fit === 'custom' \? 'auto'/);
assert.match(html, /layer\.locked\)return/);
['gridColor','gridOpacity','gridThickness','gridContrast','gridSaturation','snap','gridOx','gridOy'].forEach(function(field){
  assert.match(network, new RegExp('\\b'+field+':'), field+' must survive Firebase scene sanitization');
});

var sanitizeStart = network.indexOf('function sanitizeScene(scene)');
var sanitizeEnd = network.indexOf('var api =', sanitizeStart);
var sanitizeContext = {
  roomError:function(message){return new Error(message);},
  isFinite:isFinite
};
vm.runInNewContext(network.slice(sanitizeStart, sanitizeEnd), sanitizeContext);
var legacyScene = sanitizeContext.sanitizeScene({});
assert.strictEqual(legacyScene.gridColor, '#cab270');
assert.strictEqual(legacyScene.gridOpacity, .1);
assert.strictEqual(legacyScene.gridThickness, 1);
assert.strictEqual(legacyScene.gridContrast, 1);
assert.strictEqual(legacyScene.gridSaturation, 1);
assert.strictEqual(legacyScene.snap, true);
assert.strictEqual(legacyScene.gridOx, 0);
assert.strictEqual(legacyScene.gridOy, 0);
var customScene = sanitizeContext.sanitizeScene({
  gridColor:'#336699',gridOpacity:.36,gridThickness:2.5,gridContrast:1.4,
  gridSaturation:0,snap:false,gridOx:17,gridOy:29,
  layers:[{
    id:'background',name:'Map',image:'images/boards/map.webp',fit:'custom',
    contrast:1.35,saturation:0,darken:.45,locked:true
  }]
});
assert.strictEqual(customScene.gridColor, '#336699');
assert.strictEqual(customScene.gridOpacity, .36);
assert.strictEqual(customScene.gridThickness, 2.5);
assert.strictEqual(customScene.gridContrast, 1.4);
assert.strictEqual(customScene.gridSaturation, 0);
assert.strictEqual(customScene.snap, false);
assert.strictEqual(customScene.gridOx, 17);
assert.strictEqual(customScene.gridOy, 29);
assert.strictEqual(customScene.layers[0].fit, 'custom');
assert.strictEqual(customScene.layers[0].contrast, 1.35);
assert.strictEqual(customScene.layers[0].saturation, 0);
assert.strictEqual(customScene.layers[0].darken, .45);
assert.strictEqual(customScene.layers[0].locked, true);
var legacyBackground = sanitizeContext.sanitizeScene({background:'images/boards/legacy.webp'});
assert.strictEqual(legacyBackground.layers[0].contrast, 1);
assert.strictEqual(legacyBackground.layers[0].darken, 0);
assert.strictEqual(legacyBackground.layers[0].locked, false);

var nodes = {
  'zg-scene-board-w':{value:32},
  'zg-scene-board-h':{value:20},
  'zg-scene-size':{value:64},
  'zg-scene-zoom':{value:1},
  'zg-scene-grid':{checked:true},
  'zg-scene-grid-top':{checked:false},
  'zg-scene-mode':{value:'normal'},
  'zg-scene-snap':{checked:true},
  'zg-scene-grid-color':{value:'#cab270'},
  'zg-scene-grid-opacity':{value:.1},
  'zg-scene-grid-thickness':{value:1},
  'zg-scene-grid-contrast':{value:1},
  'zg-scene-grid-saturation':{value:1},
  'zg-scene-ox':{value:0},
  'zg-scene-oy':{value:0},
  'zg-scene-size-out':{textContent:''},
  'zg-scene-zoom-out':{textContent:''},
  'zg-scene-ox-out':{textContent:''},
  'zg-scene-oy-out':{textContent:''}
};
var draft = {
  boardWidth:32,boardHeight:20,gridSize:64,zoom:1,grid:true,gridAboveTokens:false,
  mode:'normal',snap:true,gridOx:0,gridOy:0,gridColor:'#cab270',gridOpacity:.1,
  gridThickness:1,gridContrast:1,gridSaturation:1,tokens:[{id:'hero',x:37,y:62}]
};
var dirtyCalls = 0;
var controlContext = {
  isMaster:true,
  gmWorkspaceMode:'edit',
  draft:draft,
  w:{},
  el:function(id){return nodes[id]||null;},
  clamp:function(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));},
  updateGridAppearanceOutputs:function(){},
  updateSceneSizeSummary:function(){},
  markDirty:function(){dirtyCalls++;}
};
var controlStart = html.indexOf('w.zgSceneControl = function');
var controlEnd = html.indexOf('function prepareImage', controlStart);
vm.runInNewContext(html.slice(controlStart, controlEnd), controlContext);

controlContext.w.zgSceneBoardPreset(24,16,48);
assert.strictEqual(draft.boardWidth, 24);
assert.strictEqual(draft.boardHeight, 16);
assert.strictEqual(draft.gridSize, 48);
assert.strictEqual(draft.zoom, 1);
assert.strictEqual(draft.tokens[0].x, 37);
assert.strictEqual(draft.tokens[0].y, 62);
assert.strictEqual(dirtyCalls, 1);

nodes['zg-scene-grid-color'].value = '#336699';
nodes['zg-scene-grid-opacity'].value = .36;
nodes['zg-scene-grid-thickness'].value = 2.5;
nodes['zg-scene-grid-contrast'].value = 1.4;
nodes['zg-scene-grid-saturation'].value = 0;
controlContext.w.zgSceneControl();
assert.strictEqual(draft.gridColor, '#336699');
assert.strictEqual(draft.gridOpacity, .36);
assert.strictEqual(draft.gridThickness, 2.5);
assert.strictEqual(draft.gridContrast, 1.4);
assert.strictEqual(draft.gridSaturation, 0);
assert.strictEqual(draft.tokens[0].x, 37);
assert.strictEqual(draft.tokens[0].y, 62);
assert.strictEqual(dirtyCalls, 2);

var layer = {
  id:'background',name:'Map',fit:'cover',opacity:1,scale:1,x:0,y:0,
  brightness:1,contrast:1,saturation:1,darken:0,locked:false
};
var layerNodes = {
  'zg-layer-name':{value:'Night map'},
  'zg-layer-fit':{value:'custom'},
  'zg-layer-opacity':{value:.8},
  'zg-layer-scale':{value:1.3},
  'zg-layer-x':{value:12},
  'zg-layer-y':{value:-8},
  'zg-layer-brightness':{value:.75},
  'zg-layer-contrast':{value:1.35},
  'zg-layer-saturation':{value:.6},
  'zg-layer-darken':{value:.4},
  'zg-layer-locked':{checked:false}
};
var layerDirtyCalls = 0;
var layerContext = {
  w:{},isMaster:true,gmWorkspaceMode:'edit',
  currentLayer:function(){return layer;},
  el:function(id){return layerNodes[id]||null;},
  clamp:function(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));},
  updateLayerOutputs:function(){},updateSceneSizeSummary:function(){},
  syncLayerEditor:function(){},syncControls:function(){},
  markDirty:function(){layerDirtyCalls++;},
  draft:{layers:[layer]}
};
var layerControlStart = html.indexOf('w.zgSceneLayerControl=function');
var layerControlEnd = html.indexOf('w.zgSceneAddCustomToken=function', layerControlStart);
vm.runInNewContext(html.slice(layerControlStart, layerControlEnd), layerContext);
layerContext.w.zgSceneLayerControl();
assert.strictEqual(layer.fit, 'custom');
assert.strictEqual(layer.contrast, 1.35);
assert.strictEqual(layer.darken, .4);
layerNodes['zg-layer-locked'].checked = true;
layerContext.w.zgSceneLayerLock();
assert.strictEqual(layer.locked, true);
layerNodes['zg-layer-x'].value = 70;
layerContext.w.zgSceneLayerControl();
assert.strictEqual(layer.x, 12, 'locked layer must ignore editor changes');
layerNodes['zg-layer-locked'].checked = false;
layerContext.w.zgSceneLayerLock();
layerContext.w.zgSceneLayerReset();
assert.strictEqual(layer.fit, 'cover');
assert.strictEqual(layer.scale, 1);
assert.strictEqual(layer.x, 0);
assert.strictEqual(layer.y, 0);
assert.strictEqual(layer.brightness, 1);
assert.strictEqual(layer.contrast, 1);
assert.strictEqual(layer.saturation, 1);
assert.strictEqual(layer.darken, 0);
assert.strictEqual(layerDirtyCalls, 4);

var summaryNodes = {
  'zg-scene-size-summary-board':{textContent:''},
  'zg-scene-size-summary-view':{textContent:''},
  'zg-scene-size-summary-image':{textContent:'',removeAttribute:function(){},setAttribute:function(){},getAttribute:function(){return '';}}
};
var summaryContext = {
  draft:{boardWidth:24,boardHeight:16,gridSize:48,zoom:1.25,layers:[]},
  el:function(id){return summaryNodes[id]||null;},
  Object:Object,
  Image:function(){}
};
var summaryStart = html.indexOf('var sceneImageMetricsCache=');
var summaryEnd = html.indexOf('function syncControls()', summaryStart);
vm.runInNewContext(html.slice(summaryStart, summaryEnd)+';updateSceneSizeSummary();', summaryContext);
assert.strictEqual(summaryNodes['zg-scene-size-summary-board'].textContent, 'Игровое поле: 24 × 16 клеток · 1152 × 768 px');
assert.strictEqual(summaryNodes['zg-scene-size-summary-view'].textContent, 'Клетка: 48 px · Камера: 125%');
assert.strictEqual(summaryNodes['zg-scene-size-summary-image'].textContent, 'Фоновое изображение не выбрано');

console.log('scene map editor tests passed');
