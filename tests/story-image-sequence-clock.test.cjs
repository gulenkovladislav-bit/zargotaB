const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const w={};vm.runInNewContext(fs.readFileSync('story-image-reveal.js','utf8'),{window:w});
const phase=(c,t)=>JSON.parse(JSON.stringify(w.ZargotaStoryImageReveal.phase(c,t)));
const cfg={frames:[{image:'a'},{image:'b'},{image:'c'}],holdMs:3000,fadeMs:3000,loop:true};
test('wave phases follow the audio position including wrapped and skipped frames',()=>{
 assert.deepEqual(phase(cfg,0),{from:0,to:0,mix:0});
 assert.deepEqual(phase(cfg,4500),{from:0,to:1,mix:.5});
 assert.deepEqual(phase(cfg,7000),{from:1,to:1,mix:0});
 assert.deepEqual(phase(cfg,10500),{from:1,to:2,mix:.5});
 assert.deepEqual(phase(cfg,13000),{from:2,to:2,mix:0});
 assert.deepEqual(phase(cfg,16500),{from:2,to:0,mix:.5});
 assert.deepEqual(phase(cfg,18000*50+4500),phase(cfg,4500));
});
test('one-shot sequence holds the final frame; per-frame timings are respected',()=>{
 assert.deepEqual(phase({...cfg,loop:false},60000),{from:2,to:2,mix:0});
 const custom={frames:[{image:'a',holdMs:1000},{image:'b',fadeMs:1000}],holdMs:3000,fadeMs:3000};
 assert.deepEqual(phase(custom,1500),{from:0,to:1,mix:.5});
});
