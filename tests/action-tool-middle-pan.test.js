const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const handlerStart = html.indexOf("document.addEventListener('pointerdown',function(ev){", html.indexOf('function cancelActiveSceneTool'));
const handlerEnd = html.indexOf("},true);", handlerStart);
const handler = html.slice(handlerStart, handlerEnd + 8);

assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'the active scene-tool pointer handler must exist');
assert.match(handler, /if\(ev\.button===1\)/, 'middle-button input has an explicit branch before generic tool cancellation');
assert.match(handler, /closest\('#zg-vtt-scene'\)/, 'middle-button panning is limited to the game scene');
assert.match(handler, /drag=\{px:ev\.clientX,py:ev\.clientY,x:draft\.x,y:draft\.y,id:ev\.pointerId,local:!isMaster,middle:true\}/, 'middle-button input starts the shared camera drag state');
assert.match(handler, /classList\.add\('dragging','middle-pan'\)/, 'the scene enters its middle-pan visual state');
assert.match(handler, /return;[\s\S]*if\(cancelActiveSceneTool\(\)\)/, 'middle-button scene input returns before the selected action can be cancelled');
assert.doesNotMatch(handler, /setActionTool\(''\)/, 'middle-button panning never clears the selected free-room action');

console.log('free-room action middle-pan contract passed');
