'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));

assert.match(html, /id="zg-ping-toggle"/);
assert.match(html, /id="zg-ping-layer"/);
assert.match(html, /pingMode\|\|ev\.altKey/);
assert.match(html, /setTimeout\(function\(\)\{if\(marker\.parentNode\).*1800\)/);
assert.match(html, /setPingColorVars\(marker,pingUid\)/);
assert.match(html, /Date\.now\(\)-createdAt>5000/);
assert.match(html, /Math\.abs\(hash\)%360/);
assert.match(html, /playRoomPing\(snapshot\.room\.ping\)/);
assert.match(html, /playRoomPingTrail\(snapshot\.room\.pingTrail\)/);
assert.match(html, /if\(except!=='ping'&&w\.zgPingMode\)/);
assert.match(html, /pingTrailDrag=\{id:'trail-'/);
assert.match(html, /lowPingTrailQuality\?320:200/);
assert.match(html, /stamp-drag\.startedAt>4500/);
assert.match(html, /lowPingTrailQuality\?3:8/);
assert.match(html, /Math\.ceil\(distance\/1\.8\)/);
assert.match(html, /setTimeout\(function\(\)\{if\(dot\.parentNode\).*1100/);
assert.match(html, /prefers-reduced-motion:reduce/);
assert.match(html, /id="zg-camera-focus-offer"/);
assert.match(html, /zgCameraFocusAccept/);
assert.match(html, /zgCameraFocusDismiss/);
assert.match(html, /focus:\!\!\(isMaster&&ev\.shiftKey\)/);
assert.match(html, /if\(view\.cinematic\)\{closeCameraFocusOffer\(\);performCameraFocus\(cue\);return;\}/);
assert.match(html, /pendingCameraFocus\.source==='cameraCue'&&cue\.source==='ping'/);
assert.match(html, /playerCameraFocus=\{revision:Number\(draft\.revision\|\|0\),zoom:draft\.zoom,x:draft\.x,y:draft\.y\}/);
assert.match(html, /Date\.now\(\)-createdAt>10000/);

assert.match(network, /sendPing: function \(x, y, options\)/);
assert.match(network, /now\(\) - lastPingWriteAt < 600/);
assert.match(network, /'rooms\/' \+ session\.code \+ '\/ping'/);
assert.doesNotMatch(network.slice(network.indexOf('sendPing: function'), network.indexOf('publishZone: function')), /\/scene/);
assert.match(network, /sendPingTrail: function \(x, y, trailId, sequence\)/);
assert.match(network, /now\(\) - lastPingTrailWriteAt < 170/);
assert.doesNotMatch(network.slice(network.indexOf('sendPingTrail: function'), network.indexOf('publishZone: function')), /readRoom\(/);
assert.match(network, /'\/pingTrail\/' \+ user\.uid/);

var pingRules = rules.rules.rooms.$room.ping;
assert.ok(pingRules, 'Firebase rules must define the transient ping channel');
assert.match(pingRules['.write'], /members.*auth\.uid/);
assert.match(pingRules['.write'], /newData\.child\('uid'\)\.val\(\) === auth\.uid/);
assert.match(pingRules['.validate'], /newData\.child\('x'\)\.isNumber\(\)/);
assert.match(pingRules['.validate'], /newData\.child\('y'\)\.isNumber\(\)/);
assert.match(pingRules['.validate'], /newData\.child\('focus'\)\.isBoolean\(\)/);
assert.match(pingRules['.validate'], /masterUid.*auth\.uid/);
var pingTrailRules = rules.rules.rooms.$room.pingTrail.$uid;
assert.match(pingTrailRules['.write'], /\$uid === auth\.uid/);
assert.match(pingTrailRules['.validate'], /newData\.child\('sequence'\)\.isNumber\(\)/);

var trailLayer = {
  children:[],
  appendChild:function(node){node.parentNode=this;this.children.push(node);},
  removeChild:function(node){this.children=this.children.filter(function(item){return item!==node;});node.parentNode=null;}
};
var timers = [];
var trailContext = {
  w:{},lowPingTrailQuality:false,pingTrailSeen:{},pingTrailPrevious:{},
  roomSnapshot:null,pingMode:false,
  el:function(id){return id==='zg-ping-layer'?trailLayer:null;},
  clamp:function(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));},
  setPlayerColorVars:function(){},
  document:{createElement:function(){return{className:'',style:{setProperty:function(){}},parentNode:null};}},
  setTimeout:function(callback){timers.push(callback);return timers.length;},
  Date:Date,Math:Math,Object:Object,String:String,Number:Number
};
var trailStart = html.indexOf('function setPingColorVars');
var trailEnd = html.indexOf('function ownHeroToken', trailStart);
vm.runInNewContext(html.slice(trailStart, trailEnd), trailContext);
trailContext.playRoomPingTrailPoint({id:'trail-a',uid:'player-a',sequence:1,x:10,y:10,createdAt:Date.now()});
trailContext.playRoomPingTrailPoint({id:'trail-a',uid:'player-a',sequence:2,x:20,y:10,createdAt:Date.now()});
assert.strictEqual(trailLayer.children.length, 7, 'remote points should be interpolated into a short visual trail');
timers.forEach(function(callback){callback();});
assert.strictEqual(trailLayer.children.length, 0, 'trail dots should remove themselves');

console.log('vtt ping contract passed');
