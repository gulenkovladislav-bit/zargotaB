'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var transferStart = html.indexOf("var SCENE_TRANSFER_FORMAT='zargota-scene'");
var transferEnd = html.indexOf('w.zgSceneExport=function', transferStart);

assert.ok(transferStart >= 0 && transferEnd > transferStart, 'scene transfer helpers must exist');

var context = { result:null };
vm.runInNewContext(
  'function sceneForLibrary(scene){return JSON.parse(JSON.stringify(scene));}' +
  html.slice(transferStart, transferEnd) +
  ';result={' +
    'payload:buildSceneExportPackage({' +
      'id:"local-only-id",name:"Храм / ночь",folder:"Глава 1",created:42,revision:3,updatedAt:84,updatedByDevice:"device-a",' +
      'scene:{layers:[{id:"bg-1",image:"data:image/png;base64,AAAA"},{id:"bg-2",image:"images/maps/temple.webp"}],tokens:[{id:"npc-1",type:"custom",image:"data:image/webp;base64,BBBB"}]}' +
    '},"2026-07-27T12:00:00.000Z"),' +
    'fileName:sceneExportFileName("Храм / ночь:*?"),' +
    'smallSize:formatSceneExportSize(1536),' +
    'largeSize:formatSceneExportSize(2*1024*1024),' +
    'valid:validateSceneImportPackage({format:"zargota-scene",schemaVersion:1,scene:{data:{layers:[]}}}),' +
    'validCollection:validateSceneImportPackage({format:"zargota-scene-collection",schemaVersion:1,scenes:[{data:{layers:[]}}]}),' +
    'emptyCollection:validateSceneImportPackage({format:"zargota-scene-collection",schemaVersion:1,scenes:[]}),' +
    'wrongVersion:validateSceneImportPackage({format:"zargota-scene",schemaVersion:2,scene:{data:{layers:[]}}}),' +
    'wrongFormat:validateSceneImportPackage({format:"other",schemaVersion:1,scene:{data:{layers:[]}}}),' +
    'uniqueName:uniqueSceneImportName("Храм",[{name:"храм"},{name:"Храм (импорт)"}]),' +
    'collection:buildSceneCollectionExportPackage([' +
      '{name:"Первая",folder:"Акт",scene:{layers:[{id:"one",image:"data:image/png;base64,A"}],tokens:[]}},' +
      '{name:"Вторая",folder:"Акт",scene:{layers:[{id:"two",image:"images/two.webp"}],tokens:[]}}' +
    '],"album","Акт","2026-07-27T12:00:00.000Z")' +
  '};',
  context
);

assert.strictEqual(context.result.payload.format, 'zargota-scene');
assert.strictEqual(context.result.payload.schemaVersion, 1);
assert.strictEqual(context.result.payload.exportedAt, '2026-07-27T12:00:00.000Z');
assert.strictEqual(context.result.payload.scene.name, 'Храм / ночь');
assert.strictEqual(context.result.payload.scene.folder, 'Глава 1');
assert.strictEqual(context.result.payload.scene.created, 42);
assert.strictEqual(context.result.payload.scene.revision, 3);
assert.strictEqual(context.result.payload.scene.updatedAt, 84);
assert.strictEqual(context.result.payload.scene.updatedByDevice, 'device-a');
assert.strictEqual(context.result.payload.scene.id, undefined, 'a local IndexedDB id must not become an import identity');
assert.strictEqual(context.result.payload.assets.embeddedCount, 2);
assert.strictEqual(context.result.payload.assets.externalCount, 1);
assert.strictEqual(context.result.payload.assets.references[0].source, '', 'embedded data must not be duplicated in the manifest');
assert.strictEqual(context.result.payload.assets.references[1].source, 'images/maps/temple.webp');
assert.strictEqual(context.result.fileName, 'Храм_-_ночь_zargota_scene.json');
assert.strictEqual(context.result.smallSize, '1.5 КБ');
assert.strictEqual(context.result.largeSize, '2.00 МБ');
assert.strictEqual(context.result.valid.ok, true);
assert.strictEqual(context.result.validCollection.ok, true);
assert.strictEqual(context.result.emptyCollection.ok, false);
assert.strictEqual(context.result.wrongVersion.ok, false);
assert.match(context.result.wrongVersion.error, /не поддерживается/);
assert.strictEqual(context.result.wrongFormat.ok, false);
assert.strictEqual(context.result.uniqueName, 'Храм (импорт 2)');
assert.strictEqual(context.result.collection.format, 'zargota-scene-collection');
assert.strictEqual(context.result.collection.scope, 'album');
assert.strictEqual(context.result.collection.album, 'Акт');
assert.strictEqual(context.result.collection.scenes.length, 2);
assert.strictEqual(context.result.collection.assets.embeddedCount, 1);
assert.strictEqual(context.result.collection.assets.externalCount, 1);

var sceneForLibraryStart = html.indexOf('function sceneForLibrary(scene)');
var sceneForLibraryEnd = html.indexOf('function migrateLoadedHeroes', sceneForLibraryStart);
var sceneForLibraryBlock = html.slice(sceneForLibraryStart, sceneForLibraryEnd);
assert.match(sceneForLibraryBlock, /token\.type!=='hero'/);
assert.match(sceneForLibraryBlock, /type:'spawn'/);

var exportStart = html.indexOf('w.zgSceneExport=function');
var exportEnd = html.indexOf('function migrateLoadedHeroes', exportStart);
var exportBlock = html.slice(exportStart, exportEnd);
assert.ok(exportBlock.indexOf('w.confirm(message)') < exportBlock.indexOf('URL.createObjectURL(blob)'), 'size confirmation must happen before download');
assert.match(exportBlock, /rec\.id===activeSceneId&&dirty/);
assert.match(exportBlock, /Несохранённые изменения редактора не войдут в файл/);
assert.match(exportBlock, /w\.ZargotaLib\.get\(id,function\(rec\)/);
assert.match(html, /onclick="zgSceneExport\(&#39;'\+r\.id\+'&#39;\)"/);
assert.match(html, /id="zg-scene-import-file"[^>]+accept="\.json,application\/json"/);
assert.match(html, /w\.zgSceneImportFile=function/);
assert.match(html, /file\.size>50\*1024\*1024/);
assert.match(html, /prepared=sceneImportEntries\(payload\)\.map/);
assert.match(html, /copyName=uniqueSceneImportName\(entry\.name,namePool\)/);
assert.match(html, /id:'a'\+\(now\+index\)\.toString\(36\)/);
assert.match(html, /w\.zgSceneExportCollection=function/);
assert.match(html, /sceneAlbum\?items\.filter/);
assert.match(html, /class="export" onclick="zgSceneExportCollection\(\)"/);

var assetPrepareStart = html.indexOf('function sceneAssetToDataUrl');
var assetPrepareEnd = html.indexOf('w.zgSceneExport=function', assetPrepareStart);
var assetPrepareBlock = html.slice(assetPrepareStart, assetPrepareEnd);
assert.match(assetPrepareBlock, /w\.fetch\(source,\{cache:'force-cache'\}\)/);
assert.match(assetPrepareBlock, /reader\.readAsDataURL\(blob\)/);
assert.match(assetPrepareBlock, /cache\[source\]=sceneAssetToDataUrl\(source\)/);
assert.match(assetPrepareBlock, /target\.image=dataUrl/);
assert.strictEqual(assetPrepareBlock.indexOf('ZargotaLib.put') >= 0, false, 'asset embedding must not mutate the scene library');
assert.ok(exportBlock.indexOf('prepareSceneRecordsForExport([rec])') < exportBlock.indexOf('buildSceneExportPackage(prepared[0])'));
assert.match(html, /prepareSceneRecordsForExport\(selected\)\.then/);
assert.match(html, /\.finally\(function\(\)\{sceneExportBusy=false;\}\)/);

var importRunStart = html.indexOf('function runPreparedSceneImport');
var importRunEnd = html.indexOf('function finishPreparedSceneImport', importRunStart);
var importRunBlock = html.slice(importRunStart, importRunEnd);
assert.match(importRunBlock, /mode==='replace'&&collision&&collision\.id!==activeSceneId/);
assert.match(importRunBlock, /hydrateSceneRecordMedia\(collision\)/);
assert.ok(importRunBlock.indexOf('putSceneImportRecord(backupRecord)') < importRunBlock.indexOf('putSceneImportRecord(replacement)'), 'backup must be confirmed before replacement');
assert.match(importRunBlock, /if\(!backupSaved\)throw new Error/);
assert.match(html.slice(html.indexOf('function putSceneImportRecord'), importRunStart), /saveLinkedSceneRecord\(record,record&&record\.updatedAt/);
assert.match(html, /id="zg-scene-import-choice"/);
assert.match(html, /zgSceneImportDecision\('copy'\)/);
assert.match(html, /zgSceneImportDecision\('replace'\)/);
assert.match(html, /pendingSceneImport=\{prepared:prepared,items:items\}/);

var versionHelpersStart = html.indexOf("var sceneDeviceIdCache = ''");
var versionHelpersEnd = html.indexOf('function renderScenes()', versionHelpersStart);
var versionContext = {
  result:null,
  localStorage:{
    value:'',
    getItem:function(){return this.value;},
    setItem:function(key,value){this.value=value;}
  },
  w:{crypto:{randomUUID:function(){return 'test-uuid';}}},
  sceneForLibrary:function(scene){return JSON.parse(JSON.stringify(scene));}
};
vm.runInNewContext(
  html.slice(versionHelpersStart, versionHelpersEnd) +
  ';result={device:sceneDeviceId(),version:sceneVersionRecord({id:"scene-1",name:"Храм",scene:{layers:[]},revision:4,updatedAt:50,updatedByDevice:"old-device"},100)};',
  versionContext
);
assert.strictEqual(versionContext.result.device, 'device-test-uuid');
assert.strictEqual(versionContext.result.version.category, 'scene-version');
assert.strictEqual(versionContext.result.version.sceneId, 'scene-1');
assert.strictEqual(versionContext.result.version.revision, 4);
assert.strictEqual(versionContext.result.version.sourceUpdatedAt, 50);
assert.strictEqual(versionContext.result.version.sourceDevice, 'old-device');

var sceneSaveStart = html.indexOf('w.zgSceneSave=function');
var sceneSaveEnd = html.indexOf('w.zgSceneLoad=function', sceneSaveStart);
var sceneSaveBlock = html.slice(sceneSaveStart, sceneSaveEnd);
assert.match(sceneSaveBlock, /currentRevision!==activeSceneRevision/);
assert.match(sceneSaveBlock, /saveSceneVersion\(previous,stamp,function\(savedVersion\)/);
assert.ok(sceneSaveBlock.indexOf('saveSceneVersion(previous') < sceneSaveBlock.lastIndexOf('commit();'), 'previous version must persist before current scene');
assert.match(sceneSaveBlock, /activeSceneRevision=saved\.revision/);
assert.match(sceneSaveBlock, /updatedByDevice:sceneDeviceId\(\)/);
assert.match(sceneSaveBlock, /pruneSceneVersions\(saved\.id\)/);
assert.match(html, /\.slice\(5\)\.forEach/);
assert.match(html, /function sceneMetaLine\(record\)/);
assert.match(html, /Последнее устройство:/);
assert.match(html, /onclick="zgSceneVersionsOpen\(&#39;'\+r\.id\+'&#39;\)"/);
assert.match(html, /id="zg-scene-versions-list"/);
assert.match(network, /function compactSceneTokenImage\(source,targetChars\)/);
assert.doesNotMatch(html, /updateSceneStatus\(\)/, 'combat start must not call a missing scene status helper');
assert.match(html, /scenePublicationState='published';updateScenePublicationUi\(\)/, 'combat start refreshes the real publication UI helper');
assert.match(network, /var maxSide=192/);
assert.match(network, /setTimeout\(function\(\)\{finish\(source\);\},2500\)/, 'broken custom portraits must not block scene publishing forever');
assert.match(network, /function prepareSceneMedia\(scene\)/);
assert.match(network, /prepareSceneMedia\(scene\)\.then\(function\(preparedScene\)/);
assert.match(network, /var payload = sanitizeScene\(preparedScene\)/);
var versionRestoreStart = html.indexOf('w.zgSceneVersionsOpen=function');
var versionRestoreEnd = html.indexOf('function migrateLoadedHeroes', versionRestoreStart);
var versionRestoreBlock = html.slice(versionRestoreStart, versionRestoreEnd);
assert.match(versionRestoreBlock, /ZargotaLib\.list\('scene-version'/);
assert.match(versionRestoreBlock, /w\.zgSceneVersionRestore=function/);
assert.match(versionRestoreBlock, /category!=='scene-version'/);
assert.match(versionRestoreBlock, /hydrateSceneMedia\(version\.scene\)/);
assert.match(versionRestoreBlock, /общий ассет не найден/);
assert.match(versionRestoreBlock, /id:'a'\+stamp\.toString\(36\)/);
assert.match(versionRestoreBlock, /saveLinkedSceneRecord\(rec,stamp/);
assert.match(versionRestoreBlock, /Версия восстановлена отдельной сценой/);
assert.strictEqual(versionRestoreBlock.indexOf('activeSceneId=') >= 0, false, 'restoring a version must not switch or overwrite the active scene');

var duplicateStart = html.indexOf('w.zgSceneDuplicate=function');
var duplicateEnd = html.indexOf('w.zgSceneLibDelete=function', duplicateStart);
var duplicateBlock = html.slice(duplicateStart, duplicateEnd);
assert.match(duplicateBlock, /hydrateSceneRecordMedia\(r\)/);
assert.match(duplicateBlock, /saveLinkedSceneRecord\(copy,stamp/);

var importHelpersStart = html.indexOf('function uniqueSceneImportName');
var importHelpersEnd = html.indexOf('function sceneAssetToDataUrl', importHelpersStart);
var importWrites = [];
var hydratedImportIds = [];
var importContext = {
  Promise:Promise,
  activeSceneId:'',
  libCache:{},
  sceneDeviceId:function(){return 'test-device';},
  sceneForLibrary:function(scene){return JSON.parse(JSON.stringify(scene));},
  hydrateSceneRecordMedia:function(record){hydratedImportIds.push(record.id);return Promise.resolve(Object.assign({},record,{scene:JSON.parse(JSON.stringify(record.scene))}));},
  saveLinkedSceneRecord:function(record,stamp,done){importWrites.push(JSON.parse(JSON.stringify(record)));done(record);},
  w:{ZargotaLib:{}}
};
vm.runInNewContext(
  html.slice(importHelpersStart, importHelpersEnd) +
  ';result=runPreparedSceneImport([{name:"Храм",folder:"Новый",scene:{layers:[{id:"new",image:"new"}],tokens:[]}}],[{id:"old",name:"Храм",folder:"Старый",scene:{layers:[{id:"old-bg",image:"old"}],tokens:[]},created:10,order:3}],"replace");',
  importContext
);

importContext.result.then(function(result) {
  assert.strictEqual(importWrites.length, 2);
  assert.notStrictEqual(importWrites[0].id, 'old');
  assert.match(importWrites[0].name, /резерв перед импортом/);
  assert.strictEqual(importWrites[0].scene.layers[0].image, 'old');
  assert.strictEqual(importWrites[1].id, 'old');
  assert.strictEqual(importWrites[1].scene.layers[0].image, 'new');
  assert.strictEqual(result.replaced, 1);
  assert.strictEqual(result.backups, 1);
  assert.deepStrictEqual(hydratedImportIds, ['old'], 'replacement must hydrate the existing scene before creating its backup');

  var activeWrites = [];
  var activeContext = {
    Promise:Promise,
    activeSceneId:'old',
    libCache:{},
    sceneDeviceId:function(){return 'test-device';},
    sceneForLibrary:function(scene){return JSON.parse(JSON.stringify(scene));},
    hydrateSceneRecordMedia:function(record){return Promise.resolve(record);},
    saveLinkedSceneRecord:function(record,stamp,done){activeWrites.push(record);done(record);},
    w:{ZargotaLib:{}}
  };
  vm.runInNewContext(
    html.slice(importHelpersStart, importHelpersEnd) +
    ';result=runPreparedSceneImport([{name:"Храм",scene:{layers:[],tokens:[]}}],[{id:"old",name:"Храм",scene:{layers:[],tokens:[]}}],"replace");',
    activeContext
  );
  return activeContext.result.then(function(activeResult) {
    assert.strictEqual(activeWrites.length, 1);
    assert.notStrictEqual(activeWrites[0].id, 'old', 'an active scene must only be imported as a copy');
    assert.strictEqual(activeResult.replaced, 0);
    assert.strictEqual(activeResult.saved, 1);
  }).then(function() {
    var failedWrites = [];
    var failedContext = {
      Promise:Promise,
      activeSceneId:'',
      libCache:{},
      sceneDeviceId:function(){return 'test-device';},
      sceneForLibrary:function(scene){return JSON.parse(JSON.stringify(scene));},
      hydrateSceneRecordMedia:function(record){return Promise.resolve(record);},
      saveLinkedSceneRecord:function(record,stamp,done){failedWrites.push(record);done(null);},
      w:{ZargotaLib:{}}
    };
    vm.runInNewContext(
      html.slice(importHelpersStart, importHelpersEnd) +
      ';result=runPreparedSceneImport([{name:"Храм",scene:{layers:[],tokens:[]}}],[{id:"old",name:"Храм",scene:{layers:[],tokens:[]}}],"replace");',
      failedContext
    );
    return failedContext.result.then(function() {
      throw new Error('replacement must stop when backup persistence fails');
    }, function(error) {
      assert.match(error.message, /исходная сцена не изменена/);
      assert.strictEqual(failedWrites.length, 1, 'replacement write must not start after backup failure');
    });
  });
}).then(function() {
  console.log('scene transfer tests passed');
}).catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
