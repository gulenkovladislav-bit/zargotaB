(function(w){
 'use strict';
 // Infer legacy membership without rewriting or deleting any dialogue.
 function nodes(data,id){
  var all=data.nodes||[],records=data.scenes||[],owners=new Map(),byId=new Map(all.map(function(n){return[n.id,n];}));
  function visit(nodeId,sceneId){var n=byId.get(nodeId);if(!n)return;var set=owners.get(nodeId)||new Set();if(set.has(sceneId))return;set.add(sceneId);owners.set(nodeId,set);(n.links||[]).forEach(function(l){visit(l.to,l.sceneId||sceneId);});}
  visit(data.entryId,data.startSceneId||records[0]?.id||id);
  records.forEach(function(r){var s=r.id===data.activeSceneId?data.scene:r.scene;((s||{}).tokens||[]).forEach(function(token){var interaction=(data.interactions||{})[token.id];visit(token.entryId||interaction&&interaction.entryId,r.id);});(((s||{}).story||{}).zones||[]).forEach(function(z){visit(z.entryId,z.sceneId||r.id);});});
  return all.filter(function(n){return n.editorSceneId?n.editorSceneId===id:owners.has(n.id)?owners.get(n.id).has(id):id===(data.startSceneId||records[0]?.id||id);});
 }
 w.ZargotaStoryLocationDialogues={nodes:nodes};
})(window);
