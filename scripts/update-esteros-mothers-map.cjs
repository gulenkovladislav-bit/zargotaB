// Apply only to a freshly read exchange envelope. Does not submit to the editor.
const fs=require('node:fs'),assert=require('node:assert/strict');
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/update-esteros-mothers-map.cjs WORKING_FILE');
const envelope=JSON.parse(fs.readFileSync(file)),e=envelope.episode;
assert.equal(envelope.projectId,'episode-mvcthpuv-iwom');
const content=JSON.parse(fs.readFileSync('story-content/esteros/mothers-map-v1.json'));
const copy=x=>JSON.parse(JSON.stringify(x));
const shore=e.scenes.find(s=>s.id==='scene-mvctoydb');assert.ok(shore);
const speaker=e.speakers['esteros-child-thoughts'];assert.ok(speaker);
const portrait='assets/stories/portraits/Portraits/ChatGPT Image 9 сент. 2026 г., 21_24_20 (1).png';
speaker.portrait=portrait;
speaker.position='50% 50%';speaker.zoom=1;
speaker.emotions={...(speaker.emotions||{}),'map-sad':{name:'Печаль',nameUk:'Сум',portrait:'assets/stories/portraits/Portraits/ChatGPT Image 9 сент. 2026 г., 21_24_21 (3).png',position:'50% 50%',zoom:1}};
// Preserve authored opening lines, frame size and background animation.
for(const n of e.nodes)for(const page of [n,...(n.slides||[])])if(page.speaker==='esteros-child-thoughts'){
 page.showPortrait=true;
 page.portraitOverride=false;
 delete page.portraitFrame;
 page.emotion=n.id==='dialog-1'?'map-sad':'';
}
e.storyItems=e.storyItems||[];
if(!e.storyItems.some(i=>i.itemId===content.item.itemId))e.storyItems.push(copy(content.item));
e.player=e.player||{name:'Эстерос',nameUk:'Естерос',portrait,hp:10,hpMax:10,ac:10,speed:7,initiative:0,level:1,stats:{str:0,dex:0,int:0,cha:0,per:0,con:0}};
e.player.inventoryItems=e.player.inventoryItems||[];
if(!e.player.inventoryItems.some(i=>i.itemId===content.item.itemId))e.player.inventoryItems.push(copy(content.item));
for(const n of content.nodes){
 assert.ok(!e.nodes.some(x=>x.id===n.id),'Already installed: '+n.id);
 for(const page of [n,...n.slides]){page.portraitOverride=false;delete page.portraitFrame;page.emotion=n.id==='esteros-map-memory'?'map-sad':'';}
 e.nodes.push(n);
}
shore.scene.layers=[{id:'esteros-walkable-shore-background',image:'assets/stories/backgrounds/esteros-shore/walkable-shore-v1.png',visible:true,opacity:1,fit:'cover'}];
shore.scene.story={...shore.scene.story,spawnX:50,spawnY:67,cameraZoom:1,
 walkable:[[21,46],[30,42],[43,45],[56,48],[67,49],[76,57],[75,70],[62,77],[57,94],[43,94],[42,78],[28,69],[19,57]],
 blockedMessage:'Здесь вода или густые заросли. Лучше идти по открытому берегу.',
 blockedMessageUk:'Тут вода або густі зарості. Краще йти відкритим берегом.'};
const hero=shore.scene.tokens.find(t=>t.id===e.heroTokenId);assert.ok(hero);
Object.assign(hero,{image:portrait,x:50,y:67,size:80,visible:true,opacity:1,hidden:false});
if(e.activeSceneId===shore.id)e.scene=copy(shore.scene);
fs.writeFileSync(file,JSON.stringify(envelope,null,2)+'\n');
fs.writeFileSync('story-content/esteros/episode-1-mothers-map-v1.json',JSON.stringify({format:'zargota-story',version:1,episode:e},null,2)+'\n');
console.log('Prepared map item, 14 dialogue blocks and walkable shore; original dialogue wording retained.');
