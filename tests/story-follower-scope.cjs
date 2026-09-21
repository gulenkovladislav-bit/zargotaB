const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const w={};const ctx=vm.createContext({window:w,clearTimeout,setTimeout});
for(const file of ['story-followers.js','story-quest-actions.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);
const source={tokens:[{id:'skif',x:20,y:20}]};
for(const scope of [undefined,'all','current','selected']){
 const state={},api=w.ZargotaStoryQuestActions,f=w.ZargotaStoryFollowers;
 const context={state,records:[{id:'a',scene:source}],view:r=>r.scene,redraw:()=>{}};
 api.run([{type:'follow',id:'skif',sceneId:'a',followScope:scope,followSceneIds:['a','b']}],context,()=>{});
 const visit=id=>f.prepare({tokens:[]},state,id,'hero',{x:50,y:50});
 assert.equal(visit('a').tokens.length,1);
 assert.equal(visit('b').tokens.length,scope==='current'?0:1);
 assert.equal(visit('c').tokens.length,['current','selected'].includes(scope)?0:1);
 assert.equal(visit('a').tokens.length,1);
 visit('b');
 const lastScene=state.followers.skif.sceneId;
 api.run([{type:'unfollow',id:'skif',sceneId:'c'}],context,()=>{});
 assert.equal(Object.keys(state.followers).length,0);
 assert.equal(api.apply({tokens:[]},lastScene,state).tokens[0].id,'skif');
 assert.equal(visit('c').tokens.length,0);
}
console.log('PASS: legacy/all/current/selected scopes, pause/resume, cross-location stop preserves token');
