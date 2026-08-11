'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperStart = html.indexOf('  function coalescedMovementStart(');
const helperEnd = html.indexOf('  function cancelActiveMovementPlayback(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'movement coalescing helper remains extractable');

const context = {String,clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}};
vm.createContext(context);
vm.runInContext(html.slice(helperStart, helperEnd), context);

let start = context.coalescedMovementStart({tokenId:'hero-1',fromX:10,fromY:20},{tokenId:'hero-1',currentX:37.5,currentY:42.25,toX:60,toY:70});
assert.deepStrictEqual(JSON.parse(JSON.stringify(start)), {x:37.5,y:42.25,continued:true}, 'a replacement snapshot continues from the currently displayed point');

start = context.coalescedMovementStart({tokenId:'hero-2',fromX:12,fromY:18},{tokenId:'hero-1',currentX:37.5,currentY:42.25});
assert.deepStrictEqual(JSON.parse(JSON.stringify(start)), {x:12,y:18,continued:false}, 'a different token keeps its authoritative origin');

const cancelStart = helperEnd;
const cancelEnd = html.indexOf('  function animateLastMovement(', cancelStart);
const cancelBlock = html.slice(cancelStart, cancelEnd);
assert.match(cancelBlock, /cancelAnimationFrame\(activeMovementFrame\)/, 'replacement cancels the previous movement RAF');
assert.match(cancelBlock, /engine\.cancel\(previous\.id,reason\)/, 'replacement cancels the previous Canvas trail');
assert.match(cancelBlock, /combatVfxRuntime\.cancelEvent\(previous\.id,reason\)/, 'replacement releases the previous runtime handle');
assert.match(cancelBlock, /previous\.currentX/, 'replacement settles at the current displayed position instead of the old destination');

console.log('movement snapshot coalescing passed');
