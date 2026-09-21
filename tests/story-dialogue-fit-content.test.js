const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-dialogue-layout.js','utf8'),context={window:{}};
vm.runInNewContext(source,context);
let scale=.7;
const panel={style:{setProperty(k,v){assert.equal(k,'--dialogue-fit');scale=Number(v);}}};
for(let i=0;i<10;i++){context.window.ZargotaStoryDialogueLayout.fitContent(panel);assert.equal(scale,1);}
assert(!source.includes('MutationObserver'));assert(!source.includes('ResizeObserver'));
console.log('PASS: stable text scale, no content-driven resize observers');
