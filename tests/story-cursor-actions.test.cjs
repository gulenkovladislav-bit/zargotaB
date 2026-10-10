const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-cursor.js','utf8'),ctx);const action=ctx.window.ZargotaStoryCursor.action;
assert.equal(action({sceneId:'shop'}).travel,true);
assert.equal(action({pickup:{itemId:'coin'}}).take,true);
assert.equal(action({inspectImage:'art.png'}).inspect,true);
assert.equal(action({entryId:'talk'}).inspect,true);
assert.equal(Object.keys(action({sceneId:'shop',enabled:false})).length,0);
assert.equal(Object.keys(action({pickup:{},visible:false})).length,0);
assert.equal(action({pickup:{},sceneId:'shop'}).take,true);
const css=fs.readFileSync('story-cursor.css','utf8');
assert.match(css,/\[data-mode=take\] svg\{overflow:visible\}/);
assert.match(css,/translate\(-4px,-31px\) scale\(1\.2\)/);
assert.match(css,/@keyframes zg-cursor-take-in\{from\{opacity:\.2\}to\{opacity:1\}\}/);
// Approximate fingertip in the original 48-unit PNG canvas maps to the 3px hotspot.
assert.ok(Math.abs((6*1.2-4)*42/48-3)<1);
assert.ok(Math.abs((28.5*1.2-31)*42/48-3)<1);
console.log('PASS cursor actions: transition, pickup, inspection, disabled/hidden targets and pickup priority.');
