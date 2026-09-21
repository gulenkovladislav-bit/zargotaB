const fs=require('fs'),vm=require('vm'),assert=require('assert');const c={window:{}};vm.createContext(c);for(const file of ['story-sidequests.js','story-fragments.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const e=JSON.parse(fs.readFileSync('/Users/merkov/Downloads/episode-mu0xaq1u-w00y (22).json')).episode;
const result=c.window.ZargotaStoryFragments.compile(e,fs.readFileSync('output/fragment-import/telphi-sidequest.json','utf8')),data=result.next,api=c.window.ZargotaStorySideQuests;
const q=data.quests.find(q=>q.id==='silver-question');
for(const outcome of q.endNodeIds){const s={quests:{active:'main',done:[]}};
assert.equal(api.route(data,s,'karven-hello'),'karven-hello');api.complete(data,s,q.startNodeId);
assert.equal(api.route(data,s,'telphi-hello'),'silver-wait-road');
api.complete(data,s,outcome);assert(!api.status(s,q.id).done,'Cannot finish without preparation');
for(const step of q.steps){assert.equal(api.route(data,s,step.entryIds[0]),step.nodeId);api.complete(data,s,step.nodeId);api.complete(data,s,step.nodeId);assert.equal(api.route(data,s,step.entryIds[0]),step.entryIds[0]);}
assert.equal(api.status(s,q.id).steps.length,4);assert.equal(api.route(data,s,'telphi-repeat'),'silver-ready');
api.complete(data,s,outcome);assert(api.status(s,q.id).done);assert(api.status(s,q.id).consumed);assert.equal(api.route(data,s,'telphi-hello'),'silver-done');api.complete(data,s,q.startNodeId);assert(!api.status(s,q.id).active);assert.equal(s.quests.active,'main');assert.equal(s.quests.done.length,0);
const restored=JSON.parse(JSON.stringify(s));assert.equal(api.route(data,restored,'telphi-repeat'),'silver-done');}
assert.equal(result.counts[1],1);console.log('PASS: fragment, all three outcomes, early returns, unique steps, single reading, main quest preserved');
