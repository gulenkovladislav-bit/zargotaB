const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(reduced=false){
 const animations=[],children=[];
 const make=()=>({style:{cssText:''},removeAttribute(){},setAttribute(){},decode:()=>Promise.resolve(),cloneNode:()=>make(),remove(){this.removed=true;},animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};animations.push(a);return a;}});
 const c={window:{matchMedia:()=>({matches:reduced})}};vm.createContext(c);vm.runInContext(fs.readFileSync('story-image-reveal.js','utf8'),c);
 return{play:c.window.ZargotaStoryImageReveal.play,art:make(),view:{appendChild(x){children.push(x);}},animations,children};
}
test('paired reveal decodes, shares drift and cancels cleanly',async()=>{const s=setup(),stop=s.play(s.view,s.art,{imageRevealFrom:'dust.png'});await new Promise(setImmediate);assert.equal(s.children[0].src,'dust.png');assert.equal(s.animations.length,3);assert.equal(s.animations[2].options.duration,2600);stop();assert.ok(s.animations.every(a=>a.cancelled));assert.ok(s.children[0].removed);});
test('cancel before decode cannot restart animation',async()=>{const s=setup(),stop=s.play(s.view,s.art,{imageRevealFrom:'dust.png'});stop();await new Promise(setImmediate);assert.equal(s.animations.length,0);});
test('reduced motion shows final image without moving or ghost layer',()=>{const s=setup(true);s.play(s.view,s.art,{imageRevealFrom:'dust.png'});assert.equal(s.children.length,0);assert.equal(s.animations.length,0);});
test('three authored finales preserve quest links and contain bilingual short pages',()=>{const f=JSON.parse(fs.readFileSync('output/fragment-import/telphi-visuals.json'));assert.equal(f.replaceNodes.length,3);for(const {before,after} of f.replaceNodes){assert.deepEqual(after.links,before.links);assert.equal(after.id,before.id);assert.equal(after.slides.length,3);for(const p of [after,...after.slides]){assert.ok(p.text&&p.textUk);assert.ok(p.text.length<150);assert.equal(p.showPortrait,false);assert.ok(fs.existsSync(p.image));}assert.equal(after.imageSequence,true);}});
