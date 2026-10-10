const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const window={};vm.runInNewContext(fs.readFileSync('story-coins.js','utf8'),{window});
for(const m of ['copper','silver','gold','platinum']){const path=window.ZargotaStoryCoins.detail({itemId:'evan-'+m+'-coin'});assert.equal(path,'images/shop/zargota-coin-'+m+'.webp');assert.ok(fs.existsSync(path));}
assert.equal(window.ZargotaStoryCoins.detail({itemId:'silver-sword'}),'');
const source=fs.readFileSync('story-player.js','utf8'),radius=source.slice(source.indexOf('function interactionRadius('),source.indexOf('\n',source.indexOf('function interactionRadius(')));
let moved,called=0;const ctx={Math,Number,state:{position:{x:0,y:0}},root:{},interactionRadius:null,movementBlock:()=>'',cancelAnimationFrame(){},frame:0,settleWalk(){},hint(){},move(to){moved=to;}};vm.createContext(ctx);vm.runInContext(radius+'\n'+source.slice(source.indexOf('function approach(token,done)'),source.indexOf('  function move(to,done)')),ctx);
ctx.approach({x:40,y:0,interactionRadiusScale:2},()=>called++);assert.ok(Math.abs(40-moved.x-15.2)<.001);
ctx.state.position={x:24,y:0};moved=null;ctx.approach({x:40,y:0,interactionRadiusScale:2},()=>called++);assert.equal(called,1);assert.equal(moved,null);
assert.match(fs.readFileSync('story-secrets.js','utf8'),/ZargotaStoryCoins\?\.detail\(result.item\)/);
console.log('PASS detailed coin art for all four metals; radius boundary and approach distance');
