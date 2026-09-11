const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const w={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../story-camera.js'),'utf8'),{window:w});
const fit=w.ZargotaStoryCamera.layout(1600,900,1500,1000,1,100,100);assert.equal(fit.scale,.9);assert.equal(fit.x,0);assert.equal(fit.y,0);
const zoom=w.ZargotaStoryCamera.layout(1600,900,1500,1000,2,9999,-9999);assert.equal(zoom.x,550);assert.equal(zoom.y,-450);console.log('Camera fit and zoom boundaries passed');
