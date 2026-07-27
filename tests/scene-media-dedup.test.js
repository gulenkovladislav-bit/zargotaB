'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var helpersStart = html.indexOf('  function sceneVersionRecord(record,stamp)');
var helpersEnd = html.indexOf('  function pruneSceneVersions(sceneId)', helpersStart);
assert.ok(helpersStart >= 0 && helpersEnd > helpersStart, 'scene media helpers must exist');

var records = new Map();
var writes = [];
var context = {
  Promise:Promise,Date:Date,Math:Math,Object:Object,JSON:JSON,Error:Error,
  console:{error:function(){}},
  sceneForLibrary:function(scene){return JSON.parse(JSON.stringify(scene));},
  copyScene:function(scene){return JSON.parse(JSON.stringify(scene));},
  w:{ZargotaLib:{
    get:function(id,done){setTimeout(function(){done(records.get(id)||null);},0);},
    put:function(record,done){setTimeout(function(){writes.push(record.category);records.set(record.id,JSON.parse(JSON.stringify(record)));done(record);},0);}
  }}
};
vm.runInNewContext(html.slice(helpersStart,helpersEnd),context);

(async function(){
  var image='data:image/webp;base64,'+'A'.repeat(12000);
  var record={
    id:'scene-1',name:'Храм',revision:3,updatedAt:50,updatedByDevice:'device-a',
    thumb:image,scene:{layers:[{id:'bg',image:image}],tokens:[{id:'npc',image:image}]}
  };
  var first=await context.externalizeSceneVersion(record,100);
  var second=await context.externalizeSceneVersion(record,200);
  var media=Array.from(records.values()).filter(function(item){return item.category==='scene-media';});
  assert.strictEqual(media.length,1,'identical image must have one shared media record');
  assert.strictEqual(first.scene.layers[0].image,'');
  assert.strictEqual(first.scene.tokens[0].image,'');
  assert.strictEqual(first.scene.layers[0].imageAssetId,first.scene.tokens[0].imageAssetId);
  assert.strictEqual(first.scene.layers[0].imageAssetId,second.scene.layers[0].imageAssetId);
  assert.strictEqual(first.thumb,'');
  assert.strictEqual(first.thumbAssetId,first.scene.layers[0].imageAssetId);
  assert.strictEqual(media[0].kinds.background,true);
  assert.strictEqual(media[0].kinds.token,true);
  assert.ok(media[0].lastUsed>0);

  var otherImage='data:image/png;base64,'+'B'.repeat(12000);
  var occupiedId=context.sceneMediaId(otherImage);
  records.set(occupiedId,{id:occupiedId,category:'scene',dataUrl:otherImage,name:'Не перезаписывать'});
  var collisionVersion=await context.externalizeSceneVersion({
    id:'scene-2',name:'Башня',revision:1,scene:{layers:[{id:'bg',image:otherImage}],tokens:[]}
  },250);
  assert.strictEqual(records.get(occupiedId).category,'scene');
  assert.notStrictEqual(collisionVersion.scene.layers[0].imageAssetId,occupiedId);

  var hydrated=await context.hydrateSceneMedia(first.scene);
  assert.strictEqual(hydrated.layers[0].image,image);
  assert.strictEqual(hydrated.tokens[0].image,image);
  var hydratedRecord=await context.hydrateSceneRecordMedia({
    id:'scene-linked',category:'scene',thumb:'',thumbAssetId:first.thumbAssetId,scene:first.scene
  });
  assert.strictEqual(hydratedRecord.scene.layers[0].image,image);
  assert.strictEqual(hydratedRecord.scene.tokens[0].image,image);
  assert.strictEqual(hydratedRecord.thumb,image,'linked scene thumbnail must hydrate from shared media');

  records.delete(first.scene.layers[0].imageAssetId);
  await assert.rejects(context.hydrateSceneMedia(first.scene),/Общий ассет версии сцены не найден/);

  records.clear();writes.length=0;
  await new Promise(function(resolve,reject){
    context.saveSceneVersion(record,300,function(saved){if(saved)resolve();else reject(new Error('version was not saved'));});
  });
  assert.strictEqual(writes[0],'scene-media','shared media must persist before the version');
  assert.strictEqual(writes[writes.length-1],'scene-version','version must persist only after its media');

  console.log('scene media dedup tests passed');
})().catch(function(error){
  console.error(error);
  process.exitCode=1;
});
