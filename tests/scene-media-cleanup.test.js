'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var helperStart = html.indexOf('  function sceneMediaReferences(record,referenced)');
var helperEnd = html.indexOf('  w.ZargotaLib={', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'scene media reference collector must exist');

var context = {};
vm.runInNewContext(html.slice(helperStart,helperEnd),context);
var referenced = {};
context.sceneMediaReferences({
  category:'scene-version',thumbAssetId:'media-thumb',
  scene:{
    layers:[{imageAssetId:'media-background'},{image:'legacy-inline'}],
    tokens:[{imageAssetId:'media-token'}]
  }
},referenced);
assert.deepStrictEqual(Object.keys(referenced).sort(),['media-background','media-thumb','media-token']);
context.sceneMediaReferences({category:'scene',thumbAssetId:'scene-thumb',scene:{layers:[{imageAssetId:'scene-background'}]}},referenced);
assert.strictEqual(referenced['scene-thumb'],true);
assert.strictEqual(referenced['scene-background'],true);

var apiStart = html.indexOf('  w.ZargotaLib={', helperEnd);
var apiEnd = html.indexOf('})(window);', apiStart);
var apiBlock = html.slice(apiStart,apiEnd);
assert.match(apiBlock,/findUnusedSceneMedia:function/);
assert.match(apiBlock,/removeUnusedSceneMedia:function/);
assert.match(apiBlock,/store\('readwrite'/);
assert.match(apiBlock,/record&&record\.category==='scene-media'&&requested/);
assert.match(apiBlock,/Date\.now\(\)-120000/);
assert.match(apiBlock,/record\.lastUsed\|\|record\.created/);
assert.match(apiBlock,/if\(!referenced\[id\]\)\{os\.delete\(id\)/);
assert.strictEqual(/category==='bg'.*delete|category==='npc'.*delete/.test(apiBlock),false);

var previewStart = html.indexOf('function zgSceneMediaCleanupPreview()');
var previewEnd = html.indexOf('// Скачать всё хранилище', previewStart);
var previewBlock = html.slice(previewStart,previewEnd);
assert.match(previewBlock,/findUnusedSceneMedia/);
assert.match(previewBlock,/Неиспользуемые общие ассеты/);
assert.match(previewBlock,/последние две минуты/);
assert.match(previewBlock,/items\.map\(function\(item\)/);
assert.match(previewBlock,/confirm\('Удалить '/);
assert.match(previewBlock,/removeUnusedSceneMedia/);
assert.match(previewBlock,/Проверяем ссылки/);

console.log('scene media cleanup tests passed');
