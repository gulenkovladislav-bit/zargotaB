const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync('story-object-tools.js','utf8'),line=source.split('\n').find(l=>l.includes("Array.from(o.menu.querySelectorAll('button'))"));assert.ok(line);
let clicked=0;const handler=()=>clicked++;const buttons=['＋ Облако PNG','＋ Огонь','＋ Лампа'].map(textContent=>({textContent,onclick:handler,classList:{add(){}},style:{setProperty(){}},setAttribute(){},prepend(){}}));
const summary={textContent:'✦ Анимации и эффекты'},details={children:[summary,...buttons]};
vm.runInNewContext(line,{o:{menu:{children:[details],querySelectorAll:s=>{assert.equal(s,'button');return buttons;}}},toolPaths:Array(9).fill('path'),document:{createElementNS:()=>({setAttribute(){},appendChild(){}})}});
assert.equal(details.children[0],summary);assert.equal(summary.textContent,'✦ Анимации и эффекты');buttons.forEach(b=>b.onclick());assert.equal(clicked,3);
const css=fs.readFileSync('story-workspace.css','utf8');assert.ok(css.includes('.zg-stage-palette-open>summary'));assert.ok(!css.includes('.zg-stage-palette-open summary{display:none}'));assert.ok(css.includes('.zg-stage-effects-menu:not([open])>div{display:none}'));
console.log('Effects menu: summary and handlers preserved; only buttons decorated; nested summary remains visible.');
