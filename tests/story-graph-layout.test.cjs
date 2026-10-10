const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const w={};vm.runInNewContext(fs.readFileSync('story-graph-layout.js','utf8'),{window:w});
const arrange=w.ZargotaStoryGraphLayout.arrange;
const graph=fs.readFileSync('story-graph.js','utf8');assert.match(graph,/slider.min=\.07/);assert.match(graph,/next=Math.max\(\.07/);assert(!graph.includes('7800'));assert.match(graph,/Math.max\(12300/);
function check(nodes){const original=JSON.stringify(nodes),p=arrange(nodes,nodes[0]?.id);assert.equal(p.size,nodes.length);assert.equal(JSON.stringify(nodes),original);assert.equal(JSON.stringify([...p]),JSON.stringify([...arrange(nodes,nodes[0]?.id)]));
for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=p.get(nodes[i].id),b=p.get(nodes[j].id),ha=108+Math.max(1,nodes[i].links?.length||0)*32,hb=108+Math.max(1,nodes[j].links?.length||0)*32;assert(a.x+220<=b.x||b.x+220<=a.x||a.y+ha+40<=b.y||b.y+hb+40<=a.y,'overlap '+nodes[i].id+' '+nodes[j].id);}return p;}
const chain=[{id:'a',links:[{to:'b'}]},{id:'b',links:[{to:'c'}]},{id:'c',links:[]}],p=check(chain);assert(p.get('a').x<p.get('b').x);assert.equal(p.get('a').y,p.get('c').y);
for(const point of p.values()){assert(point.x>=1000);assert(point.y>=1000);}
const branch=[{id:'a',links:[{to:'b'},{to:'c'}]},{id:'b',links:[{to:'d'}]},{id:'c',links:[{to:'d'}]},{id:'d',links:[]},{id:'alone',links:[]}],q=check(branch);assert.equal(q.get('b').x,q.get('c').x);assert(q.get('d').x>q.get('c').x);
check([{id:'a',links:[{to:'b'}]},{id:'b',links:[{to:'a'},{to:'b'},{to:'missing'}]}]);check([]);
if(process.argv[2]){const d=JSON.parse(fs.readFileSync(process.argv[2])).episode;vm.runInNewContext(fs.readFileSync('story-location-dialogues.js','utf8'),{window:w});for(const s of d.scenes){const nodes=w.ZargotaStoryLocationDialogues.nodes(d,s.id);check(nodes);console.log(s.id+': '+nodes.length+' nodes, no overlaps');}}
console.log('PASS chains, forks, joins, cycles, disconnected nodes, deterministic layout, coordinate-only output');
