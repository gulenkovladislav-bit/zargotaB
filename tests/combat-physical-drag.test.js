'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  var approvedAttackBusy=false');
const end = html.indexOf('  var masterAttackRolls={};', start);
assert.ok(start >= 0 && end > start, 'physical combat drag block remains extractable');

const listeners = {};
let requestCount = 0;
const request = {id:'request-1',status:'approved',actionKind:'combat-attack',details:{targetKey:'enemy-1'}};
const context = {
  Math,
  Object,
  Promise,
  approvedCombatThrowMotions:{},
  masterCombatThrowMotions:{},
  testMember:{actionRequest:request},
  document:{addEventListener(type,handler){listeners[type]=handler;}},
  w:{
    ZargotaRooms:{requestApprovedAttackRoll(){requestCount += 1;return Promise.resolve(null);}},
    ZargotaSound:{dicePick(){}},
    showToast(){}
  }
};
context.ownMember = () => context.testMember;
context.combatLabPlayerUid = () => '';
context.el = () => null;
context.roomState = () => {};
context.renderCombat = () => {};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

function dieNode(){
  const classes = new Set();
  return {
    classList:{add(value){classes.add(value);},remove(value){classes.delete(value);}},
    style:{transform:'',setProperty(){},removeProperty(){}},
    setPointerCapture(){},
    classes
  };
}

const node = dieNode();
context.w.zgCombatAttackDragStart({button:0,pointerId:7,clientX:10,clientY:10,currentTarget:node,preventDefault(){}});
listeners.pointermove({pointerId:7,clientX:55,clientY:10});
listeners.pointerup({pointerId:7});
listeners.pointerup({pointerId:7});

assert.strictEqual(requestCount, 1, 'one physical throw starts one Firebase request even if pointerup repeats');
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.w.zgCombatDragDiagnostics())), {
  active:false,busy:true,starts:1,moves:1,releases:1,throws:1,returns:0,attackRequests:1,damageRequests:0,lastDistance:45
});
assert.strictEqual(node.style.transform, '', 'the compositor transform is cleared after release');

console.log('combat physical drag exactly-once passed');
