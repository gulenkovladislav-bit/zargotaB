// Apply only the exchange return correction to the supplied author export.
const fs=require('node:fs'),assert=require('node:assert/strict');
const [source,destination]=process.argv.slice(2);assert(source&&destination,'Pass source and a new output path');
const doc=JSON.parse(fs.readFileSync(source,'utf8')),e=doc.episode;
const street='scene-mu7f8tk1-6m4a',yard='scene-evan-green-courtyard';
const record=e.scenes.find(r=>r.id===street),court=e.scenes.find(r=>r.id===yard);assert(record&&court);
const gate=record.scene.story.zones.find(z=>z.id==='evan-green-entrance');assert(gate&&gate.sceneId===yard);
gate.x=72;gate.y=27;
record.scene.story.arrivals=Object.assign({},record.scene.story.arrivals,{[yard]:{x:72,y:40}});
court.scene.story.arrivals=Object.assign({},court.scene.story.arrivals,{[street]:{x:47,y:75}});
const leave=e.nodes.find(n=>n.id==='evan-exchange-leave');assert(leave);
leave.afterWorldActions=leave.afterWorldActions||[];
assert(!leave.afterWorldActions.some(a=>a.actionId==='exchange-keep-return-open'),'Already patched');
leave.afterWorldActions.push({actionId:'exchange-keep-return-open',type:'reveal',sceneId:street,kind:'zones',id:gate.id});
for(const id of ['evan-yard-meet-quest','evan-yard-game-quest']){
 const q=e.quests.find(q=>q.id===id);assert(q);q.displayStates=q.displayStates||[];
 q.displayStates.unshift({sceneId:street,requires:'evan-exchange-errand',title:'Разменять серебро',titleUk:'Розміняти срібло',objective:'Разменять серебро у прохожих и вернуться к ребятам во двор.',objectiveUk:'Розміняти срібло в перехожих і повернутися до хлопців у двір.'});
}
if(e.activeSceneId===street)e.scene=structuredClone(record.scene);
if(e.activeSceneId===yard)e.scene=structuredClone(court.scene);
fs.writeFileSync(destination,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
console.log(destination);
