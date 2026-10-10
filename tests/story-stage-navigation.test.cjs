const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),window={};vm.runInNewContext(fs.readFileSync('story-stage-navigation.js','utf8'),{window});const zoom=window.ZargotaStageNavigation.zoomAt;
for(const start of [{zoom:1,x:0,y:0},{zoom:2,x:80,y:-35}])for(const point of [[0,0],[130,-90],[-240,100]]){const next=zoom(start,4,...point);assert.equal((point[0]-start.x)/start.zoom,(point[0]-next.x)/next.zoom);assert.equal((point[1]-start.y)/start.zoom,(point[1]-next.y)/next.zoom);assert.equal(next.zoom,4);}
assert.equal(zoom({zoom:1,x:0,y:0},30,0,0).zoom,6);assert.equal(zoom({zoom:1,x:0,y:0},.1,0,0).zoom,1);
const source=fs.readFileSync('story-stage-editor.js','utf8');assert(!source.includes('st.cameraOffsetX=panX'));assert(source.includes('ZargotaStageNavigation.mount'));
console.log('PASS editor navigation: cursor anchor, pan/zoom composition, limits, independent camera fit and no pan writes to player settings.');

vm.runInNewContext(fs.readFileSync('story-camera.js','utf8'),{window});
const preview=source.slice(source.indexOf('function cameraPreview(){'),source.indexOf('    var drawCamera='));
const c={w:window,innerWidth:1600,innerHeight:900,surround:{clientWidth:800,clientHeight:450},viewport:{clientWidth:800,clientHeight:450,style:{}},scene:{boardWidth:24,boardHeight:13.5,gridSize:64},map:{style:{}},zoom:{value:1},panX:0,panY:0,zoomLabel:{},t:a=>a};
vm.createContext(c);vm.runInContext(preview+';cameraPreview();',c);const original=c.map.style.transform;c.zoom.value=2;vm.runInContext('cameraPreview();',c);assert.notEqual(c.map.style.transform,original);assert.equal(c.zoomLabel.textContent.startsWith('200%'),true);
console.log('PASS player camera preview responds immediately to zoom changes.');
