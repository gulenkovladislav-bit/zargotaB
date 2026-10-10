// Artwork-only continuation of v27: preserve dialogue/economy and all other locations.
const fs=require('node:fs'),assert=require('node:assert/strict');
const [source,destination]=process.argv.slice(2);assert.ok(source&&destination,'Usage: node scripts/build-evan-campus-v28.cjs v27.json output.json');
const out=JSON.parse(fs.readFileSync(source)),e=out.episode,base='assets/stories/Evan/university/cards/';
const table=e.minigames?.towerClawTables?.find(c=>c.tableId==='engineering');assert.ok(table,'Engineering table required');
for(const [index,file] of [[0,'artist'],[5,'expert'],[3,'student-a'],[4,'student-b']]){
 const tokenId='campus26-engineering-person-'+index,speakerId=tokenId+'-speaker',portrait=base+file+'-v1.png';
 assert.ok(fs.existsSync(portrait));const speaker=e.speakers[speakerId];assert.ok(speaker);
 speaker.portrait=portrait;speaker.position='50% 40%';speaker.zoom=1;delete speaker.appearanceTemplate;
 speaker.appearanceSource='generated-campus-v28';
 for(const view of [e.scene,...e.scenes.map(s=>s.scene)])for(const token of view?.tokens||[])if(token.id===tokenId)token.image=portrait;
}
table.tableVisual={background:base+'workbench-v1.png',prop:'gear',propImage:base+'cog-v1.png',propSound:'assets/stories/cards/tower-claw/audio/candidates/interface/click_001.mp3',durationMs:1800,volume:.4};
fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log('v28: four original portraits, workbench background, clickable animated gear; all dialogue and money unchanged. '+destination);
