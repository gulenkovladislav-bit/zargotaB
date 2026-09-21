const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync('story-timeline.js','utf8'),ctx);const api=ctx.window.ZargotaStoryTimeline;
const c={src:'a',altSrc:'b',at:10,duration:30,pairTiming:{firstHold:2,secondHold:3,fade:1,loop:false}};
assert.equal(api.imagePair(c,11).mix,0);assert.equal(api.imagePair(c,12.5).mix,.5);assert.equal(api.imagePair(c,13).mix,1);assert.equal(api.imagePair(c,39).mix,1);
c.pairTiming.loop=true;assert.equal(api.imagePair(c,16.5).mix,.5);assert.equal(api.imagePair(c,17).mix,0);assert.equal(api.imagePair(c,12.5).mix,.5);
const old={src:'a',altSrc:'b',at:0,fps:.2};assert.equal(api.imagePair(old,2.5).mix,.5);assert.equal(api.imagePair(old,5).mix,1);assert.equal(api.imagePair(old,10).mix,0);
c.pairTiming.fade=0;assert.equal(api.imagePair(c,12).mix,1);assert.equal(api.imagePair(c,15).mix,0);
assert.equal(api.imagePair({altSrc:'a',at:0},4).first,'a');
console.log('PASS: seconds-based holds and fades, once/loop, zero fade, backward seek and legacy timing');
