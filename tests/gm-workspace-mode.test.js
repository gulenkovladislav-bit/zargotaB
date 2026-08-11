'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(html, /zg_gm_workspace_mode_v1/);
assert.match(html, /data-gm-workspace-mode="run"[^>]*>Ведение</);
assert.match(html, /data-gm-workspace-mode="edit"[^>]*>Редактор</);
assert.match(html, /overlay\.classList\.toggle\('gm-edit-mode'/);
assert.match(html, /overlay\.classList\.toggle\('gm-run-mode'/);
assert.match(html, /applyGmWorkspaceMode\(gmWorkspaceMode,false\)/);
assert.match(html, /gm:not\(\.gm-vision\) \.zg-gm-actions>:not\(\.zg-vision-gear\):not\(\.zg-gm-mode-switch\)/);
assert.match(html, /\.gm-run-mode \.zg-scene-settings[^}]+display:none!important/);
assert.match(html, /\.gm-run-mode \.zg-zones-panel[^}]+display:none!important/);
assert.match(html, /\.gm-run-mode \.zg-scene-drawer-foot\{display:none\}/);
assert.match(html, /\.gm-run-mode \.zg-scene-quick-save[^}]+display:none/);
assert.match(html, /if\(gmWorkspaceMode!=='edit'\)\{sceneNotice\('Переключитесь в «Редактирование сцены»'/);
assert.match(html, /if\(gmWorkspaceMode!=='edit'\)\{sceneNotice\('Зоны доступны в режиме редактирования'/);
assert.match(html, /id="zg-scene-published-state"[^>]*>Статус публикации неизвестен</);
assert.match(html, /scenePublicationState==='published'\?'Игрокам показано'/);
assert.match(html, /gmWorkspaceMode!=='run'[^;]+publishScene/);
assert.match(html, /function markDirty\(message\)\{[^}]*scenePublicationState='changed'/);
assert.strictEqual(html.indexOf('syncDirtyUi()'), -1, 'publishing must not call the removed dirty UI helper');
var livePublishStart = html.indexOf('function scheduleLivePublish');
var livePublishEnd = html.indexOf('function markDirty', livePublishStart);
assert.strictEqual(html.slice(livePublishStart, livePublishEnd).indexOf('dirty=false'), -1, 'Firebase publish must not masquerade as local save');
var explicitPublishStart = html.indexOf('w.zgScenePublish = function');
var explicitPublishEnd = html.indexOf('function currentRegion', explicitPublishStart);
assert.match(html.slice(explicitPublishStart, explicitPublishEnd), /scenePublicationState='published'/);

var visionStart = html.indexOf('w.zgSceneToggleVision = function');
var visionEnd = html.indexOf('w.zgSceneTab = function', visionStart);
assert.strictEqual(html.slice(visionStart, visionEnd).indexOf('gmWorkspaceMode'), -1, 'player preview must not change workspace mode');

function classList() {
  var values = {};
  return {
    toggle:function(name,on){values[name]=!!on;},
    remove:function(name){values[name]=false;},
    contains:function(name){return !!values[name];}
  };
}

var overlay = {classList:classList()};
var scenePanel = {classList:classList()};
var zonesPanel = {classList:classList()};
scenePanel.classList.toggle('open', true);
zonesPanel.classList.toggle('open', true);
var buttons = [
  {mode:'run',classList:classList(),attrs:{},getAttribute:function(){return this.mode;},setAttribute:function(k,v){this.attrs[k]=v;}},
  {mode:'edit',classList:classList(),attrs:{},getAttribute:function(){return this.mode;},setAttribute:function(k,v){this.attrs[k]=v;}}
];
var storedMode = '';
var deactivated = 0;
var cleared = 0;
var context = {
  gmWorkspaceMode:'edit',
  isMaster:true,
  localStorage:{setItem:function(key,value){storedMode=value;}},
  document:{querySelectorAll:function(){return buttons;}},
  el:function(id){return id==='zg-game-overlay'?overlay:(id==='zg-scene-settings'?scenePanel:(id==='zg-zones-panel'?zonesPanel:null));},
  clearGroupSel:function(){cleared++;},
  w:{
    zgObjectAddToggle:function(){},
    zgVttDeactivateTools:function(){deactivated++;},
    ZargotaSound:null
  }
};
var modeStart = html.indexOf('function applyGmWorkspaceMode');
var modeEnd = html.indexOf('w.zgSceneToggleVision = function', modeStart);
vm.runInNewContext(html.slice(modeStart, modeEnd), context);

context.w.zgGmWorkspaceMode('run');
assert.strictEqual(storedMode, 'run');
assert.strictEqual(overlay.classList.contains('gm-run-mode'), true);
assert.strictEqual(overlay.classList.contains('gm-edit-mode'), false);
assert.strictEqual(buttons[0].attrs['aria-pressed'], 'true');
assert.strictEqual(buttons[1].attrs['aria-pressed'], 'false');
assert.strictEqual(scenePanel.classList.contains('open'), false);
assert.strictEqual(zonesPanel.classList.contains('open'), false);
assert.strictEqual(deactivated, 1);
assert.strictEqual(cleared, 1);

context.w.zgGmWorkspaceMode('edit');
assert.strictEqual(storedMode, 'edit');
assert.strictEqual(overlay.classList.contains('gm-edit-mode'), true);
assert.strictEqual(overlay.classList.contains('gm-run-mode'), false);
assert.strictEqual(deactivated, 1, 'entering edit mode must not cancel operational tools again');

console.log('gm workspace mode tests passed');
