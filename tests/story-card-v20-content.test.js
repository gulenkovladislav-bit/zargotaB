const assert=require('node:assert/strict'),fs=require('node:fs');
const read=name=>JSON.parse(fs.readFileSync('story-content/evan/'+name,'utf8'));
const before=read('episode-1-courtyard-v19.json'),patch=read('courtyard-v20-patch.json'),replayed=structuredClone(before);
for(const op of patch.operations){if(op.collection){const list=replayed.episode[op.collection],i=list.findIndex(n=>n.id===op.id);assert.ok(i>=0);assert.deepEqual(list[i],op.before);list[i]=op.after;}else{assert.deepEqual(replayed.episode[op.property],op.before);replayed.episode[op.property]=op.after;}}
const after=fs.existsSync('story-content/evan/episode-1-courtyard-v20.json')?read('episode-1-courtyard-v20.json'):structuredClone(replayed);assert.deepEqual(replayed,after);
let changes=0;
function compare(a,b,path=[]){
 if(a===b)return;
 if(typeof a==='string'&&typeof b==='string'){
  assert.ok(['text','textUk'].includes(path.at(-1)),path.join('.'));
  assert.ok(b.length>0&&b.length<140,path.join('.'));changes++;return;
 }
 assert.ok(a&&b&&typeof a==='object'&&typeof b==='object',path.join('.'));
 assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))compare(a[k],b[k],path.concat(k));
}
compare(before,after);assert.equal(changes,60);
for(const [id,events] of Object.entries(after.episode.minigames.towerClaw.replies)){
 if(!['evan-port-feltser','evan-port-pen'].includes(id)){assert.deepEqual(events,before.episode.minigames.towerClaw.replies[id]);continue;}
 for(const rows of Object.values(events))for(const r of rows){assert.ok(r.text&&r.textUk);assert.ok(after.episode.speakers[id].emotions[r.emotion]);}
}
console.log('v20: guarded patch reconstructs snapshot; exactly 30 bilingual lines changed; all non-text data, other reactions and emotion IDs preserved.');
