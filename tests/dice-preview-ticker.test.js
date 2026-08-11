const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tickerStart = html.indexOf('  var dicePreviewTasks=Object.create(null)');
const tickerEnd = html.indexOf('  var localRollVisuals = {};', tickerStart);
const tickerSource = html.slice(tickerStart, tickerEnd);
assert.ok(tickerStart >= 0 && tickerEnd > tickerStart, 'shared dice ticker remains extractable');
assert.doesNotMatch(tickerSource, /setInterval\(|clearInterval\(/, 'shared dice ticker owns no interval per die');
assert.match(tickerSource, /dicePreviewTimer=setTimeout\(runDicePreviewTicker/, 'all number previews share one pending wakeup');

let clock = 0;
let sequence = 0;
const timers = new Map();
const context = {
  Object,Math,Number,String,Infinity,
  performance:{now:() => clock},
  setTimeout(callback,delay){const id=++sequence;timers.set(id,{callback,delay});return id;},
  clearTimeout(id){timers.delete(id);},
  w:{}
};
vm.createContext(context);
vm.runInContext(tickerSource, context);
let firstCalls = 0;
let secondCalls = 0;
context.startDicePreview('die:a',80,() => {firstCalls += 1; return firstCalls < 3;});
context.startDicePreview('die:b',95,() => {secondCalls += 1; return secondCalls < 2;});
assert.strictEqual(timers.size, 1, 'two dice still keep exactly one scheduled ticker');
assert.strictEqual(context.w.zgDicePreviewDiagnostics().active, 2);
clock = 100;
const scheduled = Array.from(timers.values())[0];timers.clear();scheduled.callback();
assert.strictEqual(secondCalls, 2);
assert.strictEqual(context.w.zgDicePreviewDiagnostics().active, 1, 'completed previews leave the shared queue');
clock = 200;
const finalScheduled = Array.from(timers.values())[0];timers.clear();finalScheduled.callback();
assert.strictEqual(firstCalls, 3);
assert.strictEqual(context.w.zgDicePreviewDiagnostics().active, 0);
assert.strictEqual(timers.size, 0, 'ticker sleeps when every die has landed');
assert.strictEqual(context.w.zgDicePreviewDiagnostics().maxActive, 2);

const rollStart = html.indexOf('  function renderRollAnimations()');
const rollEnd = html.indexOf('  w.zgRenderLocalDiceThrow=', rollStart);
assert.doesNotMatch(html.slice(rollStart, rollEnd), /setInterval\(|clearInterval\(/, 'world dice and totals use the shared ticker');
const initiativeStart = html.indexOf('  function animateInitiativeRoll(groupKey)');
const initiativeEnd = html.indexOf('  w.zgInitiativeDragStart=', initiativeStart);
assert.doesNotMatch(html.slice(initiativeStart, initiativeEnd), /setInterval\(|clearInterval\(/, 'initiative preview uses the shared ticker');
const panelStart = html.indexOf('  function animateRoll(sides, finalHtml');
const panelEnd = html.indexOf('  function alignDicePanel()', panelStart);
assert.doesNotMatch(html.slice(panelStart, panelEnd), /setInterval\(|clearInterval\(/, 'dice panel preview uses the shared ticker');

console.log('shared dice preview ticker passed');
