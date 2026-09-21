const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-timeline-editor.js','utf8');
let listener,draws=0,prevented=0;
const ctx={scroll:{scrollLeft:450,clientLeft:0,clientHeight:300,getBoundingClientRect:()=>({left:100}),addEventListener(type,fn,opts){assert.equal(type,'wheel');assert.equal(opts.passive,false);listener=fn;}},zoom:{value:45},dragging:false,scale(){return Number(ctx.zoom.value);},draw(){draws++;},Math};
vm.runInNewContext(source.match(/  scroll\.addEventListener\('wheel'.*/)[0],ctx);
function wheel(deltaY,ctrlKey=true){listener({ctrlKey,deltaY,deltaMode:0,clientX:300,preventDefault(){prevented++;},stopPropagation(){}});}
wheel(100,false);assert.equal(draws,0);assert.equal(prevented,0);
const anchor=(450+200)/45;wheel(100);assert(ctx.zoom.value<45);assert(Math.abs((ctx.scroll.scrollLeft+200)/ctx.zoom.value-anchor)<1e-9);
wheel(-100);assert(Math.abs(ctx.zoom.value-45)<1e-9);
for(let i=0;i<20;i++)wheel(500);assert.equal(ctx.zoom.value,5);
for(let i=0;i<20;i++)wheel(-500);assert.equal(ctx.zoom.value,300);
const volume={value:25},control={audio:{volume:.8,currentTime:12,paused:false}},volumeValue={};
vm.runInNewContext(source.match(/volume\.oninput=\(\)=>\{[^\n]+?\};/)[0],{volume,control,volumeValue,Math,Number});
volume.oninput();assert.equal(control.audio.volume,.25);assert.equal(volumeValue.textContent,'25%');volume.value=0;volume.oninput();assert.equal(control.audio.volume,0);volume.value=100;volume.oninput();assert.equal(control.audio.volume,1);assert.equal(control.audio.currentTime,12);assert.equal(control.audio.paused,false);
console.log('PASS: Ctrl-wheel, pointer anchor, zoom limits, live volume and mute without playback interruption');
