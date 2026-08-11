'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const cancelStart = html.indexOf('  function cancelActiveMovementPlayback(');
const animateStart = html.indexOf('  function animateLastMovement(', cancelStart);
const interruptionBlock = html.slice(cancelStart, animateStart);
assert.match(interruptionBlock, /settleActiveMovementForEditorDrag/);
assert.match(interruptionBlock, /token\.x=x;token\.y=y/);
assert.match(interruptionBlock, /sceneOverridesActiveMovement/);
assert.match(interruptionBlock, /incomingMovement\.id!==lastMovementSeen/);
assert.match(interruptionBlock, /if\(incomingTargetsToken\)return false/);
assert.match(interruptionBlock, /Math\.abs\(Number\(token\.x\)-Number\(active\.toX\)\)/);

const overrideStart = html.indexOf('  function sceneOverridesActiveMovement(', cancelStart);
const overrideEnd = html.indexOf('\n  }', overrideStart) + 4;
const overrideContext = {
  activeMovementVisual:{ tokenId:'hero-1', uid:'player-1', toX:60, toY:50 },
  lastMovementSeen:'move-old',
  Array, String, Number, Math
};
vm.runInNewContext(html.slice(overrideStart, overrideEnd), overrideContext);
assert.strictEqual(overrideContext.sceneOverridesActiveMovement({tokens:[{id:'hero-1',x:70,y:55}]},{id:'move-new',tokenId:'hero-1',toX:70,toY:55}),false,'new movement event must continue through coalescing');
assert.strictEqual(overrideContext.sceneOverridesActiveMovement({tokens:[{id:'hero-1',x:70,y:55}]},{id:'move-old',tokenId:'hero-1',toX:60,toY:50}),true,'direct authoritative coordinate change must cancel the stale tween');
assert.strictEqual(overrideContext.sceneOverridesActiveMovement({tokens:[{id:'hero-1',x:60,y:50}]},null),false,'unrelated snapshot at the current destination must keep the tween');
assert.strictEqual(overrideContext.sceneOverridesActiveMovement({tokens:[]},null),true,'token removal must cancel its tween');
assert.match(interruptionBlock, /function applyAuthoritativeMovementOverride/);
assert.match(interruptionBlock, /localToken\.x=clamp\(sourceToken\.x,0,100\);localToken\.y=clamp\(sourceToken\.y,0,100\)/);
const applyOverrideStart = html.indexOf('  function applyAuthoritativeMovementOverride(', overrideEnd);
const applyOverrideEnd = html.indexOf('\n  }', applyOverrideStart) + 4;
let cancelReason = '';
const applyOverrideContext = {
  activeMovementVisual:{tokenId:'hero-1'},
  draft:{tokens:[{id:'hero-1',x:50,y:50},{id:'hero-2',x:20,y:20}]},
  sceneOverridesActiveMovement:()=>true,
  cancelActiveMovementPlayback:reason=>{cancelReason=reason;return true;},
  clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0)),
  Array, String
};
vm.runInNewContext(html.slice(applyOverrideStart, applyOverrideEnd), applyOverrideContext);
assert.strictEqual(applyOverrideContext.applyAuthoritativeMovementOverride({tokens:[{id:'hero-1',x:32,y:70}]},null),true);
assert.strictEqual(cancelReason,'authoritative-position');
assert.deepStrictEqual(Array.from([applyOverrideContext.draft.tokens[0].x,applyOverrideContext.draft.tokens[0].y]),[32,70]);
assert.deepStrictEqual(Array.from([applyOverrideContext.draft.tokens[1].x,applyOverrideContext.draft.tokens[1].y]),[20,20],'unrelated GM draft tokens must remain untouched');

const animateEnd = html.indexOf('  function applyCamera()', animateStart);
const animateBlock = html.slice(animateStart, animateEnd);
assert.match(animateBlock, /motionLayer&&motionLayer\.offsetWidth/);
assert.match(animateBlock, /motionLayer&&motionLayer\.offsetHeight/);
assert.doesNotMatch(animateBlock, /motionLayer&&motionLayer\.getBoundingClientRect/, 'movement delta must stay in unscaled local coordinates');

const dragStart = html.indexOf('  function finishTokenDrag(');
const dragEnd = html.indexOf('  function moveToken(', dragStart);
const dragBlock = html.slice(dragStart, dragEnd);
assert.match(dragBlock, /ev&&ev\.type==='pointercancel'/);
assert.match(dragBlock, /item\.t\.x=item\.x0;item\.t\.y=item\.y0/);
assert.ok(dragBlock.indexOf('if(cancelled)') < dragBlock.indexOf("markDirty('Жетон перемещён')"), 'cancel rollback must happen before persistence');
assert.match(dragBlock, /settleActiveMovementForEditorDrag\(movableGroup\.map/);
assert.match(dragBlock, /settleActiveMovementForEditorDrag\(\[token\.id\]/);

const roomStateStart = html.indexOf('  function roomState(');
const roomStateEnd = html.indexOf('\n  function applyGmWorkspaceMode(', roomStateStart);
const roomStateBlock = html.slice(roomStateStart, roomStateEnd);
assert.match(roomStateBlock, /applyAuthoritativeMovementOverride\(src,snapshot\.room\.lastMovement\)/);

console.log('movement interruption contract passed');
