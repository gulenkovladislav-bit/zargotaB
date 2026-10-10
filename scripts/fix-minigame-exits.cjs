const fs=require('node:fs');
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Expected source and destination');
const doc=JSON.parse(fs.readFileSync(source,'utf8')),p=doc.episode||doc;
let removed=0,marked=0;
for(const n of p.nodes||[]){
 const links=n.links||[];
 n.links=links.filter(l=>{
  if(!l.id?.startsWith('v29-depart-')||l.to!=='evan-v21-decline')return true;
  const plain=x=>!x.requires&&!x.unless&&!x.requiresItemId&&!x.effect&&!x.sceneId;
  if(plain(l)&&links.some(other=>other!==l&&!other.id?.startsWith('v29-depart-')&&other.to===l.to&&plain(other))){removed++;return false;}return true;
 });
 for(const l of n.links)if(l.to==='evan-v21-decline'){l.minigameExit=true;marked++;}
}
fs.writeFileSync(destination,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({removed,marked,destination}));
