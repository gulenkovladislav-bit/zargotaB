'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../functions/character-domain');
const {mergePatch, applyPatch} = require('../scripts/character-patch.cjs');

const clone = value => JSON.parse(JSON.stringify(value));
const hero = () => ({
  id: 1778221143711, campaignKey: 'lin-yin', name: "Лин'Ин", hpCur: 9,
  stats: {str: {base: 1, cur: 2}},
  inventoryItems: [{id: 'potion', name: 'Potion', qty: 3}],
  skills: [{id: 'veil', name: 'Veil', description: 'Before', cdMax: 3, cdUsed: 2}],
  mastery: [], journalEntries: []
});
const patch = operations => ({characterId: 1778221143711, campaignKey: 'lin-yin', operations: operations || [
  {collection: 'skills', match: {id: 'veil'}, set: {description: 'After', image: 'images/veil.png'}}
]});

function fixture(options = {}) {
  const id = 'sheet_lin_in';
  let sheet = D.initial(hero(), 'master_uid', 'player_uid', 'fixture-code', 100);
  const calls = [], reads = [];
  const transport = {
    list: async () => ({[id]: 'master', player_sheet: 'player', ...(options.duplicate ? {duplicate_sheet: 'master'} : {})}),
    read: async sheetId => {reads.push(sheetId); return clone(sheet.state);},
    history: async () => options.missingHistory ? {} : clone(sheet.history),
    call: async input => {
      calls.push(clone(input));
      if (options.beforeSave) {const fn = options.beforeSave; delete options.beforeSave; sheet = fn(sheet);}
      sheet = D.commit(sheet, 'master_uid', input, 300);
      if (options.loseResponse) {delete options.loseResponse; throw Error('connection-lost-after-save');}
      return {state: clone(sheet.state)};
    }
  };
  return {id, transport, calls, reads, get sheet() {return clone(sheet);}};
}

test('entry edits preserve identity, cooldown use, player data and input objects', () => {
  const current = hero(), before = clone(current), request = patch(), original = clone(request);
  const result = mergePatch(current, request);
  assert.equal(result.skills[0].description, 'After');
  assert.equal(result.skills[0].image, 'images/veil.png');
  assert.equal(result.skills[0].cdUsed, 2);
  assert.deepEqual(result.stats, before.stats);
  assert.deepEqual(result.inventoryItems, before.inventoryItems);
  assert.deepEqual(current, before);
  assert.deepEqual(request, original);
});

test('both stable character identities must match before edits', () => {
  for (const mismatch of [{characterId: 5}, {campaignKey: 'other'}, {characterId: undefined}, {campaignKey: undefined}]) {
    assert.throws(() => mergePatch(hero(), {...patch(), ...mismatch}));
  }
  assert.equal(mergePatch(hero(), {...patch(), characterId: String(hero().id)}).id, hero().id);
});

test('legacy exact names may edit an entry but never ambiguously match or create one', () => {
  const request = patch([{collection: 'skills', match: {name: 'Veil'}, set: {description: 'New'}}]);
  assert.equal(mergePatch(hero(), request).skills[0].description, 'New');
  assert.throws(() => mergePatch({...hero(), skills: [...hero().skills, {...hero().skills[0], id: 'other'}]}, request));
  assert.throws(() => mergePatch(hero(), patch([{collection: 'skills', match: {name: 'Absent'}, set: {description: 'New'}, create: {name: 'Absent'}}])));
});

test('new passive is inserted by stable ID once; subsequent edits preserve runtime fields', () => {
  const request = patch([{collection: 'skills', match: {id: 'chaos-passive'}, create: {name: 'Chaos', type: 'Пассивная черта', cdUsed: 0, cdMax: 0}, set: {description: 'Passive rules'}}]);
  const once = mergePatch(hero(), request);
  assert.equal(once.skills.length, 2);
  assert.equal(once.skills[1].id, 'chaos-passive');
  once.skills[1].cdUsed = 1;
  const twice = mergePatch(once, request);
  assert.equal(twice.skills.length, 2);
  assert.equal(twice.skills[1].cdUsed, 1);
});

test('duplicate IDs, missing entries, identity replacement and unsafe content are rejected', () => {
  assert.throws(() => mergePatch({...hero(), skills: [...hero().skills, clone(hero().skills[0])]}, patch()));
  for (const operation of [
    {collection: 'skills', match: {id: 'missing'}, set: {name: 'Absent'}},
    {collection: 'skills', match: {id: 'veil'}, set: {id: 'replacement'}},
    {collection: 'stats', match: {id: 'veil'}, set: {description: 'No'}},
    {collection: 'skills', match: {id: 'veil'}, set: {image: 'javascript:alert(1)'}},
    {collection: 'skills', match: {}, set: {description: 'No'}}
  ]) assert.throws(() => mergePatch(hero(), patch([operation])));
});

test('preview uniquely resolves owner sheet and makes no save', async () => {
  const f = fixture();
  const result = await applyPatch(f.transport, patch(), {write: false});
  assert.equal(result.status, 'preview');
  assert.equal(result.sheetId, f.id);
  assert.equal(result.revision, 1);
  assert.ok(result.changes.length);
  assert.equal(f.calls.length, 0);
  assert.ok(!f.reads.includes('player_sheet'));
});

test('ambiguous owner sheets stop without mutation', async () => {
  const f = fixture({duplicate: true});
  await assert.rejects(applyPatch(f.transport, patch(), {write: true}));
  assert.equal(f.calls.length, 0);
});

test('save uses canonical revision and existing domain history, then rerun is a no-op', async () => {
  const f = fixture();
  const result = await applyPatch(f.transport, patch(), {write: true});
  assert.equal(result.status, 'saved');
  assert.equal(result.revision, 2);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].action, 'save');
  assert.equal(f.calls[0].sheetId, f.id);
  assert.equal(f.calls[0].expectedRevision, 1);
  assert.equal(f.calls[0].source, 'sheet');
  assert.match(f.calls[0].operationId, /^[a-zA-Z0-9_-]{8,100}$/);
  const event = f.sheet.history['000000000002'];
  assert.equal(event.actorRole, 'master');
  assert.equal(event.source, 'sheet');
  const changes = JSON.parse(event.changesJson);
  assert.deepEqual(changes.map(item => item.field), ['skills']);
  assert.deepEqual(changes[0].before.value, hero().skills);
  assert.equal(changes[0].after.value[0].description, 'After');
  const rerun = await applyPatch(f.transport, patch(), {write: true});
  assert.equal(rerun.status, 'unchanged');
  assert.equal(f.calls.length, 1);
});

test('concurrent player save rejects stale write; retry merges into fresh state', async () => {
  const f = fixture({beforeSave: sheet => {
    const current = JSON.parse(sheet.state.characterJson);
    current.hpCur = 5;
    current.skills[0].cdUsed = 3;
    return D.commit(sheet, 'player_uid', {character: current, expectedRevision: 1, operationId: 'player_edit_001'}, 200);
  }});
  await assert.rejects(applyPatch(f.transport, patch(), {write: true}), /revision-conflict/);
  assert.equal(f.sheet.state.revision, 2);
  const retry = await applyPatch(f.transport, patch(), {write: true});
  assert.equal(retry.status, 'saved');
  assert.equal(retry.revision, 3);
  const saved = JSON.parse(f.sheet.state.characterJson);
  assert.equal(saved.hpCur, 5);
  assert.equal(saved.skills[0].cdUsed, 3);
  assert.equal(saved.skills[0].description, 'After');
  assert.equal(f.calls[1].expectedRevision, 2);
});

test('retry after lost acknowledgement never creates a second mutation', async () => {
  const f = fixture({loseResponse: true});
  const recovered = await applyPatch(f.transport, patch(), {write: true});
  assert.equal(recovered.status, 'saved', 'a matching canonical operation ID verifies the lost response');
  assert.equal(f.sheet.state.revision, 2);
  assert.equal((await applyPatch(f.transport, patch(), {write: true})).status, 'unchanged');
  assert.equal(f.calls.length, 1);
  assert.equal(Object.keys(f.sheet.history).length, 1);
});

test('missing server history prevents a successful verification claim', async () => {
  const f = fixture({missingHistory: true});
  await assert.rejects(applyPatch(f.transport, patch(), {write: true}));
});
