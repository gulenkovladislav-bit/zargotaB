const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8');
const made=[];let enabled=true;
class Audio {constructor(src){this.src=src;made.push(this);}play(){this.played=true;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){this.unloaded=true;}}
const ctx={Audio,Set,base:'assets/'};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function eventAudio('),source.indexOf('  function match(')),ctx);
const sound=ctx.eventAudio(()=>enabled);
sound.play('turn','turn1');sound.play('turn','turn1');assert.equal(made.length,1);
assert.equal(made[0].src,'assets/audio/approved/turn.mp3');
sound.play('combination','reveal1');assert.equal(made.length,2);assert(made[0].paused&&made[0].unloaded);
sound.stop();assert(made[1].paused);enabled=false;sound.play('loss','loss1');assert.equal(made.length,2);
enabled=true;sound.play('loss','loss1');assert.equal(made.length,2,'muted events must not replay later');
sound.play('strong','reveal2');made[2].onended();assert(made[2].paused&&made[2].unloaded);
for(const name of ['turn','loss','combination','strong'])assert(fs.statSync('assets/stories/cards/tower-claw/audio/approved/'+name+'.mp3').size>0);
const render=source.slice(source.indexOf('    function render(){'),source.indexOf('      if(game.done&&!revealComplete)timeout='));
assert(!render.includes('sounds.play(')&&!render.includes('turnSound();')&&!render.includes('revealSound();'),'render must not emit sounds');
console.log('Audio: event deduplication, muted events, stop/cleanup, four assets and no render-triggered playback passed. Playback mocked; no browser test.');
