const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [];
class AudioStub {
  constructor(src) { this.src = src; calls.push(this); }
  play() { this.played = true; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
}
function element() { return {style:{setProperty(){}},appendChild(){},setAttribute(){},remove(){this.removed=true;}}; }
const context = {window:{}, Audio:AudioStub, document:{createElement:element}, Set};
vm.runInNewContext(fs.readFileSync('story-environment.js','utf8'),context);
const api = context.window.ZargotaStoryEnvironment;
const wall={id:'wall',x:50,y:50,radius:2,blocked:true,blockedMessage:'Cliff'};
assert.equal(api.blockedZone([wall],{x:10,y:50},{x:90,y:50},{}).id,'wall','whole segment tested');
assert.equal(api.blockedZone([wall],{x:10,y:60},{x:90,y:60},{}),null);
assert.equal(api.blockedZone([{...wall,requires:'closed'}],{x:10,y:50},{x:90,y:50},{}),null);
assert.equal(api.blockedZone([wall],{x:50,y:50},{x:60,y:50},{}),null,'allow escape if editor spawned hero inside');
assert.equal(api.entered([wall],{x:50,y:50},{inside:{},fired:{}},{}).length,0,'blocking zones are not event triggers');
const zone = {id:'wind', x:50, y:50, radius:5, once:false};
let memory={inside:{},fired:{}};
assert.equal(api.entered([zone],{x:50,y:50},memory,{}).length,1);
assert.equal(api.entered([zone],{x:51,y:50},memory,{}).length,0,'no per-frame replay');
api.entered([zone],{x:80,y:50},memory,{});
assert.equal(api.entered([zone],{x:50,y:50},memory,{}).length,1,'reentry replay');
memory={inside:{},fired:{}};
const once={...zone,once:true,requires:'met_brother'};
assert.equal(api.entered([once],{x:50,y:50},memory,{}).length,0);
api.entered([once],{x:80,y:50},memory,{});
assert.equal(api.entered([once],{x:50,y:50},memory,{met_brother:true}).length,1);
api.entered([once],{x:80,y:50},memory,{});
assert.equal(api.entered([once],{x:50,y:50},memory,{met_brother:true}).length,0,'once only');
assert.equal(api.entered([{...zone,mode:'click'}],{x:50,y:50},{inside:{},fired:{}},{}).length,0);
assert.equal(api.entered([{...zone,mode:'click'}],{x:50,y:50},{inside:{},fired:{}},{},'wind').length,1);
const runtime=api.create();
runtime.scene({ambience:'wind.mp3'},element());
assert.equal(calls.length,0,'starts muted');
runtime.setSound(true);
assert.equal(calls[0].loop,true);
runtime.play('crows.mp3');
runtime.setVolume(.2);
assert.equal(calls[1].volume,.2);
runtime.scene({ambience:'rain.mp3'},element());
assert.equal(calls[0].paused,true);
assert.equal(calls[1].paused,true);
assert.equal(calls[2].src,'rain.mp3');
runtime.setSound(false);
assert.equal(calls[2].paused,true);
runtime.setSound(true);
runtime.dispose();
const stable=api.create();
const stableScene={ambience:'stable.mp3',zones:[{id:'one',x:50,y:50,radius:5,once:true}]};
stable.scene(stableScene,element(),'same-location');stable.setSound(true);
const originalAmbient=calls.at(-1),originalCount=calls.length;
assert.equal(stable.check({x:50,y:50},{}).length,1);
stable.scene(JSON.parse(JSON.stringify(stableScene)),element(),'same-location');
assert.equal(calls.length,originalCount,'object redraw does not restart background');
assert.equal(originalAmbient.paused,undefined);
assert.equal(stable.check({x:50,y:50},{}).length,0,'object redraw preserves once-only zone state');
stable.scene(stableScene,element(),'different-location');
assert.equal(originalAmbient.paused,true);
assert.equal(stable.check({x:50,y:50},{}).length,1,'new location has fresh zone state');
stable.dispose();
assert.equal(calls[3].paused,true);
runtime.scene({zones:[{...zone,sound:'wind.mp3',loop:true}]},element());
runtime.playZone({...zone,sound:'wind.mp3',loop:true,volume:.5});
const localWind=calls[calls.length-1];
assert.equal(localWind.loop,true);
assert.equal(localWind.volume,.1,'individual gain multiplies master gain');
runtime.check({x:90,y:90},{});
assert.equal(localWind.paused,true,'leaving the zone stops local loop');
console.log('Story environment: zone edges, conditions, once, click, audio mute and scene cleanup passed');
const polygon={id:'poly',blocked:true,points:[[20,20],[40,20],[40,40],[20,40]]};
assert.equal(api.blockedZone([polygon],{x:10,y:30},{x:50,y:30},{}).id,'poly');
assert.equal(api.blockedZone([{...polygon,enabled:false}],{x:10,y:30},{x:50,y:30},{}),null);
assert.equal(api.contains({x:50,y:50,radiusCells:2,boardWidth:40,boardHeight:20},{x:54,y:50}),true);
assert.equal(api.contains({x:50,y:50,radiusCells:2,boardWidth:40,boardHeight:20},{x:56,y:50}),false);
  runtime.scene({boardWidth:20,boardHeight:20,zones:[{id:'local',spatial:true,sound:'local.mp3',radiusCells:4,x:50,y:50,resume:true,loop:true}]},element());
runtime.check({x:50,y:50},{});const source=calls.at(-1);source.currentTime=12;
runtime.check({x:60,y:50},{});assert.equal(source.volume,.1,'half radius = half gain times master .2');
runtime.check({x:90,y:50},{});assert.equal(source.paused,true);assert.equal(source.currentTime,12);
runtime.check({x:50,y:50},{});assert.equal(calls.at(-1),source,'reuses the same audio object');assert.equal(source.currentTime,12);
  runtime.dispose();
const oneShot=api.create(),oneShotScene={boardWidth:20,boardHeight:20,zones:[{id:'bell',spatial:true,sound:'bell.mp3',radiusCells:4,x:50,y:50,loop:false}]};oneShot.scene(oneShotScene,element(),'one-shot');oneShot.position({x:90,y:50},{});oneShot.setSound(true);const beforeBell=calls.length;oneShot.check({x:50,y:50},{});assert.equal(calls.length,beforeBell+1,'non-looping spatial sound starts on entry');assert.equal(calls.at(-1).loop,false);oneShot.check({x:51,y:50},{});oneShot.check({x:52,y:50},{});oneShot.scene(JSON.parse(JSON.stringify(oneShotScene)),element(),'one-shot');oneShot.position({x:52,y:50},{});assert.equal(calls.length,beforeBell+1,'standing inside and same-scene redraw do not restart non-looping spatial sound');oneShot.check({x:90,y:50},{});oneShot.check({x:50,y:50},{});assert.equal(calls.length,beforeBell+2,'non-looping spatial sound starts once again after exit and reentry');oneShot.dispose();
