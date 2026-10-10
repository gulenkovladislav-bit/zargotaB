const fs=require('node:fs'),assert=require('node:assert/strict');
const [source,destination]=process.argv.slice(2);if(!source||!destination)throw Error('Expected source and destination');
const doc=JSON.parse(fs.readFileSync(source,'utf8')),p=doc.episode||doc;
assert.equal(p.minigames?.towerClaw?.afterNodeId,'evan-port-at-circle');
const university=p.minigames.towerClawTables?.find(t=>t.tableId==='engineering');assert(university,'Engineering table not found');
p.minigames.towerClaw.ante=1;university.ante=2;
fs.writeFileSync(destination,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
const check=JSON.parse(fs.readFileSync(destination,'utf8')).episode;assert.equal(check.minigames.towerClaw.ante,1);assert.equal(check.minigames.towerClawTables.find(t=>t.tableId==='engineering').ante,2);
console.log('Saved: courtyard ante 1; engineering courtyard ante 2. '+destination);
