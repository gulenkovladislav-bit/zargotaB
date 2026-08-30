'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = index.indexOf(startMarker);
  const end = index.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing source block: ${startMarker}`);
  return index.slice(start, end);
}

const signatureSource = sourceBetween('function abilityResolveRollRefreshValues', 'function abilityRequestOpenError');
const refreshSource = sourceBetween('function refreshOpenAbilityResolve', 'function abilityApprovedDice');
const requestRenderSource = sourceBetween('function renderMovementOverlays', 'function movementFeedback');

assert.doesNotMatch(signatureSource, /updatedAt|room\.updated|combat\.updated/, 'heartbeat timestamps must not invalidate the open ability form');
assert.match(signatureSource, /abilityResolveRollRefreshValues/, 'the resolver signature must normalize only the roll fields that can change the visible verdict');
assert.doesNotMatch(signatureSource, /Number\(entry&&entry\.hp\)|Number\(entry&&entry\.ac\)/, 'ordinary HP and armour snapshots must not rebuild an open editing form');
assert.match(requestRenderSource, /refreshOpenAbilityResolve\(\);/, 'room snapshots must use the guarded ability refresh');
assert.doesNotMatch(requestRenderSource, /zgAbilityResolveOpen\(abilityResolveUid,true\)/, 'room snapshots must not rebuild the ability form unconditionally');

const request = {
  id: 'ability-1',
  actionKind: 'ability',
  status: 'pending',
  stage: 'gm-decision',
  ability: { name: 'Танец костей', damageFormula: '2d6+3', resolutionMode: 'utility' },
  target: { mode: 'selected', targetKey: 'hero:yarvik' },
  abilityResolution: { targetKey: 'hero:yarvik', updatedAt: 1, rollItems: [] }
};
const combat = {
  active: true,
  order: [{ key: 'hero:yarvik', uid: 'qa-player', name: 'Ярвик Плакса', hp: 15, hpMax: 15, ac: 12 }]
};
const room = { updatedAt: 1, members: { 'qa-player': { actionRequest: request } }, combat };
const body = { __zgAbilityResolveSignature: '' };
const panel = { classList: { contains(value) { return value === 'open'; } } };
let opens = 0;
let closes = 0;
const context = {
  JSON, String, Number, Array,
  abilityResolveUid: 'qa-player',
  currentAbilityRequest() { return { room, request: room.members['qa-player'].actionRequest }; },
  el(id) { return id === 'zg-combat-ability-resolve' ? panel : id === 'zg-combat-ability-body' ? body : null; },
  w: {
    zgAbilityResolveOpen() { opens += 1; return true; },
    zgAbilityResolveClose() { closes += 1; }
  }
};
vm.runInNewContext(`${signatureSource}\n${refreshSource}`, context, { filename: 'ability-resolve-refresh-stability.js' });

body.__zgAbilityResolveSignature = context.abilityResolveRefreshSignature('qa-player', request, combat);
for (let tick = 2; tick <= 8; tick += 1) {
  room.updatedAt = tick;
  combat.order[0].hp = 15 - tick;
  combat.order[0].ac = 12 + tick;
  request.abilityResolution = tick % 2
    ? { rollItems: [{ transient: tick }], updatedAt: tick, targetKey: 'hero:yarvik' }
    : { targetKey: 'hero:yarvik', updatedAt: tick, rollItems: [] };
  assert.strictEqual(context.refreshOpenAbilityResolve(), false, 'an unrelated room heartbeat must preserve the existing modal DOM');
}
assert.strictEqual(opens, 0, 'stable snapshots must not reopen or rebuild the form');
assert.strictEqual(closes, 0, 'stable snapshots must not close the form');

request.status = 'ability-attack-result';
request.stage = 'attack-result';
request.abilityResolution = {
  targetKey: 'hero:yarvik',
  attack: { roll: 14, rolls: [14], rollMode: 'normal', modifier: 2, total: 16, dc: 12, success: true, rolledAt: 100 }
};
assert.strictEqual(context.refreshOpenAbilityResolve(), true, 'a real request stage and roll result change must refresh the form');
assert.strictEqual(opens, 1, 'the changed request must refresh exactly once');
body.__zgAbilityResolveSignature = context.abilityResolveRefreshSignature('qa-player', request, combat);

request.abilityResolution.attack.rolledAt = 200;
request.abilityResolution.updatedAt = 201;
assert.strictEqual(context.refreshOpenAbilityResolve(), false, 'roll timestamps alone must not rebuild the visible verdict');
assert.strictEqual(opens, 1, 'technical result metadata must preserve the existing form');

request.abilityResolution.attack.total = 17;
assert.strictEqual(context.refreshOpenAbilityResolve(), true, 'a changed visible roll total must refresh the verdict');
assert.strictEqual(opens, 2, 'the new visible roll result must refresh exactly once');
body.__zgAbilityResolveSignature = context.abilityResolveRefreshSignature('qa-player', request, combat);

combat.order.push({ key: 'token:qa-rat', tokenId: 'qa-rat', name: 'QA Крыса', hp: 12, hpMax: 12, ac: 10 });
assert.strictEqual(context.refreshOpenAbilityResolve(), true, 'a changed participant list must refresh the target controls');
assert.strictEqual(opens, 3, 'the target list change must refresh exactly once');

room.members['qa-player'].actionRequest = null;
assert.strictEqual(context.refreshOpenAbilityResolve(), false, 'a removed request must stop the open resolver');
assert.strictEqual(closes, 1, 'a removed request must close the stale form');

console.log('ability resolve refresh stability contract passed');
