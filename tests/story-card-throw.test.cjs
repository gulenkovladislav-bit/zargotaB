const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('story-card-game.js','utf8');let started=0,closed=0,played=0;
class Context{
 constructor(){this.sampleRate=8000;this.currentTime=0;}
 createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}
 createBufferSource(){return {connect(){},start(){started++;}};}
 createGain(){return {gain:{value:0},connect(){}};}
 createBiquadFilter(){return {Q:{value:0},frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
 resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}
}
const ctx={w:{AudioContext:Context},Math,closed:false,soundEnabled:true,storyAudio:null,crunchContext:null,storyFx:{play(action){played++;return Promise.resolve();}}};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('    function stopStorySound('),source.indexOf('    function decorateStory(')),ctx);
vm.runInContext(source.slice(source.indexOf('    function storyAction('),source.indexOf('    function ',source.indexOf('    function storyAction(')+10)),ctx);
ctx.storyAction({kind:'stone'});assert.equal(started,1);assert.equal(played,1);
ctx.soundEnabled=false;ctx.storyAction({kind:'stone'});assert.equal(started,1);assert.equal(closed,1);assert.equal(played,2);
console.log('PASS stone whoosh once per action; mute stops existing sound and starts none.');
