const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync('story-timeline.js','utf8'),ctx);const api=ctx.window.ZargotaStoryTimeline,reply={text:'abcdefghij'},cue={at:5,duration:6,revealDuration:4,textAnimation:'typewriter'};
assert.equal(api.textFrame(cue,reply,5).visible,'');assert.equal(api.textFrame(cue,reply,7).visible,'abcde');assert.equal(api.textFrame(cue,reply,9).visible,reply.text);assert.equal(api.textFrame(cue,reply,6).visible,'ab');
assert.equal(api.textFrame({...cue,textAnimation:'fade'},reply,7).progress,.5);assert.equal(api.textFrame({...cue,textAnimation:'none'},reply,5).visible,reply.text);assert.equal(api.textFrame({...cue,revealDuration:0},reply,5).visible,reply.text);
const half=api.textFrame(cue,reply,7);assert.equal(half.visible+half.rest,reply.text);
assert.equal(api.textFrame(cue,{text:'😀😀😀😀'},7).visible,'😀😀');
console.log('PASS: audio-timed letters, fade, instant text, backwards seeking, reserved layout and Unicode');
