const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('story-dialogue-pages.js','utf8'),context);
const node={id:'image',kind:'image',speaker:'npc',image:'landscape.png',text:'First',textUk:'Перша',emotion:'happy',textSpeed:24,pageDelayMs:4000,showPortrait:true,links:[{id:'go',to:'end'}],slides:[{text:'Second',textUk:'Друга'},{speaker:'@player',emotion:'',text:'Third',showPortrait:false}]};
const snapshot=JSON.stringify(node),pages=context.window.ZargotaStoryPages.pages(node);
assert.equal(pages.length,3);assert.equal(pages[1].image,'landscape.png');assert.equal(pages[1].emotion,'happy');assert.equal(pages[1].textSpeed,24);assert.equal(pages[1].textUk,'Друга');assert.equal(pages[2].speaker,'@player');assert.equal(pages[2].emotion,'');assert.equal(pages[2].showPortrait,false);assert.equal(pages[2].links[0].to,'end');assert.equal(JSON.stringify(node),snapshot);
assert.equal(context.window.ZargotaStoryPages.pages({text:'Legacy'}).length,1);
console.log('Dialogue pages: legacy compatibility, background/style inheritance, per-page actor/emotion/portrait overrides and non-mutating resolution passed');
