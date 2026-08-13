'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperStart = html.indexOf('  function syncAuthoritativeMovementDestination(');
const helperEnd = html.indexOf('  function animateLastMovement(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'authoritative destination helper remains extractable');

const context = {
  draft:{tokens:[{id:'npc-1',type:'custom',x:24,y:30},{id:'npc-2',type:'custom',x:70,y:70}]},
  clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));},
  Array,String,Number,Math
};
vm.createContext(context);
vm.runInContext(html.slice(helperStart, helperEnd), context);

assert.strictEqual(context.syncAuthoritativeMovementDestination(
  {tokens:[{id:'npc-1',type:'custom',x:51,y:46}]},
  {id:'gm-move-1',tokenId:'npc-1',fromX:24,fromY:30,toX:51,toY:46}
),true,'an acknowledged GM movement must update the local draft destination');
assert.deepStrictEqual(Array.from([context.draft.tokens[0].x,context.draft.tokens[0].y]),[51,46], 'a later render cannot send the NPC back to its origin');
assert.deepStrictEqual(Array.from([context.draft.tokens[1].x,context.draft.tokens[1].y]),[70,70], 'unrelated NPC coordinates remain untouched');

context.draft.tokens[0].x=24;context.draft.tokens[0].y=30;
assert.strictEqual(context.syncAuthoritativeMovementDestination(
  {tokens:[{id:'npc-1',type:'custom',x:65,y:60}]},
  {id:'stale-move',tokenId:'npc-1',fromX:20,fromY:20,toX:51,toY:46}
),false,'a stale movement event cannot overwrite a newer authoritative coordinate');
assert.deepStrictEqual(Array.from([context.draft.tokens[0].x,context.draft.tokens[0].y]),[24,30]);

const roomStateStart = html.indexOf('  function roomState(');
const roomStateEnd = html.indexOf('\n  function applyGmWorkspaceMode(', roomStateStart);
const roomState = html.slice(roomStateStart, roomStateEnd);
assert.match(roomState, /applyAuthoritativeMovementOverride\(src,snapshot\.room\.lastMovement\);\s*syncAuthoritativeMovementDestination\(src,snapshot\.room\.lastMovement\)/, 'every authoritative room snapshot settles the local destination before later token renders');

const animateStart = html.indexOf('  function animateLastMovement(');
const animateEnd = html.indexOf('  function applyCamera()', animateStart);
const animate = html.slice(animateStart, animateEnd);
assert.match(animate, /walkEnvelope=walkingMotion\?Math\.min\(1,Math\.max\(0,\(1-progress\)\/\.14\)\):0/, 'walking sway fades to neutral before the destination');
assert.match(animate, /walkAngle=walkingMotion\?-1\.4\*Math\.cos\([^;]+\)\*walkEnvelope:0/, 'the final frame cannot retain a non-zero rocking angle');
assert.match(animate, /walkLift=walkingMotion\?\(-1\.5\+1\.5\*Math\.cos\([^;]+\)\)\*walkEnvelope:0/, 'the final frame cannot retain a non-zero vertical step offset');
const frameAnchor = "node.style.left=fromX+'%';node.style.top=fromY+'%';";
const frameTransform = "node.style.transform='translate(-50%,-50%) translate3d('";
assert.ok(animate.indexOf(frameAnchor) >= 0, 'every movement frame re-anchors a connected GM token at the event origin');
assert.ok(animate.indexOf(frameAnchor) < animate.indexOf(frameTransform, animate.indexOf(frameAnchor)), 'the base coordinate is restored before the compositor delta, preventing a one-frame double destination');
assert.match(animate, /if\(node&&progress<1\)/, 'the terminal RAF never writes the completed compositor delta');
assert.match(animate, /settleMovementNode\(node,toX,toY\)/, 'completion uses the shared atomic destination settle');

const settleStart = html.indexOf('  function settleMovementNode(');
const settleEnd = html.indexOf('  function cancelActiveMovementPlayback(', settleStart);
const settle = html.slice(settleStart, settleEnd);
assert.ok(settleStart >= 0 && settleEnd > settleStart, 'movement settle helper remains extractable');
assert.ok(settle.indexOf("node.style.removeProperty('transform')") < settle.indexOf("node.style.left=clamp(x,0,100)+'%'"), 'the compositor delta is removed before destination coordinates, preventing a double-distance frame');
const settleContext={
  clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));},
  syncTokenStatusPortal(node){if(node)node.statusPortalSyncs=(node.statusPortalSyncs||0)+1;}
};
vm.createContext(settleContext);vm.runInContext(settle,settleContext);
const settleOps=[],settleStyle={transform:'translate3d(320px,0,0)',removeProperty(name){settleOps.push('remove:'+name);delete this[name];}};
Object.defineProperty(settleStyle,'left',{set(value){settleOps.push('left:'+value+':transform='+(this.transform||'none'));}});
Object.defineProperty(settleStyle,'top',{set(value){settleOps.push('top:'+value+':transform='+(this.transform||'none'));}});
const settleNode={isConnected:true,style:settleStyle,classList:{remove(){settleOps.push('classes');}}};
Object.defineProperty(settleNode,'offsetWidth',{get(){settleOps.push('layout');return 64;}});
settleContext.settleMovementNode(settleNode,64,42);
assert.strictEqual(settleNode.statusPortalSyncs,1,'the detached status surface follows the authoritative destination settle');
assert.ok(settleOps.indexOf('remove:transform') < settleOps.findIndex(item=>item.indexOf('left:64%')===0), 'runtime settle removes the old delta before writing left');
assert.ok(settleOps.includes('left:64%:transform=none'), 'destination cannot coexist with the completed movement delta');
assert.ok(settleOps.indexOf('layout') > settleOps.findIndex(item=>item.indexOf('left:64%')===0),'the no-transition destination is committed before normal transitions return');
assert.ok(settleOps.indexOf('layout') < settleOps.indexOf('remove:transition'),'normal hover transitions return only after the destination style flush');

const cancelStart = html.indexOf('  function cancelActiveMovementPlayback(');
const cancelEnd = html.indexOf('  w.zgCancelActiveMovementPlayback=', cancelStart);
const cancel = html.slice(cancelStart, cancelEnd);
assert.match(cancel, /settleMovementNode\(previousNode,settleAtDestination\?previous\.toX:previous\.currentX,settleAtDestination\?previous\.toY:previous\.currentY\)/, 'replacement and interruption use the same no-overshoot settle path');

console.log('movement authoritative settle passed');
