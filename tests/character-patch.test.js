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
const oldPortrait = 'images/portraits/char_1778221143711.png';
const newPortrait = 'images/portraits/defaults/lin-yin-2026-11.png';
const portraitPatch = () => ({characterId: 1778221143711, campaignKey: 'lin-yin', portrait: {from: oldPortrait, to: newPortrait}});

function fixture(options = {}) {
  const id = 'sheet_lin_in';
  let sheet = D.initial(options.character || hero(), 'master_uid', 'player_uid', 'fixture-code', 100);
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

test('portrait-only replacement preserves the rest of the sheet and clears only old focus', () => {
  const current = {...hero(), portrait: oldPortrait, portraitFocusX: 61, portraitFocusY: 43};
  const before = clone(current), request = portraitPatch(), original = clone(request);
  const expected = {...hero(), portrait: newPortrait};
  assert.deepEqual(mergePatch(current, request), expected);
  assert.deepEqual(mergePatch(current, {...request, operations: []}), expected);
  assert.deepEqual(current, before);
  assert.deepEqual(request, original);
  const combined = mergePatch(current, {...patch(), portrait: request.portrait});
  assert.equal(combined.portrait, newPortrait);
  assert.equal(combined.skills[0].description, 'After');
  assert.equal(combined.skills[0].cdUsed, 2);
});

test('portrait replacement refuses personal media, explicit choices and changed source paths', () => {
  for (const extra of [
    {portraitThumb: 'data:image/png;base64,cGVyc29uYWw='},
    {portraitChoice: oldPortrait},
    {portrait: 'images/heroart/LinIn.png'},
    {portrait: 'images/portraits/defaults/lin-yin-classic.png'},
    {portrait: 'images/portraits/custom_1778221143711_123.png'}
  ]) {
    const current = {...hero(), portrait: oldPortrait, ...extra}, before = clone(current);
    assert.throws(() => mergePatch(current, portraitPatch()), /portrait|Portrait/);
    assert.deepEqual(current, before);
  }
});

test('portrait rerun retains focus and any later explicit choice when already at the target', () => {
  const current = {...hero(), portrait: newPortrait, portraitFocusX: 47, portraitFocusY: 29,
    portraitChoice: newPortrait, portraitThumb: 'data:image/png;base64,cGVyc29uYWw='};
  assert.deepEqual(mergePatch(current, portraitPatch()), current);
});

test('portrait operation accepts only exact from/to project image paths and valid operation arrays', () => {
  const current = {...hero(), portrait: oldPortrait};
  for (const unsafe of ['https://example.com/a.png', '//example.com/a.png', '/images/a.png',
    '../images/a.png', 'images/../a.png', 'images/./a.png', 'images//a.png', 'images/%2e%2e/a.png',
    'images/a.png?v=1', 'images/a.png#part', 'images/a\\b.png', 'data:image/png;base64,YQ==',
    'images/a.html', 'images/a.png" onerror="alert(1)']) {
    for (const key of ['from', 'to']) assert.throws(() => mergePatch(current,
      {...portraitPatch(), portrait: {...portraitPatch().portrait, [key]: unsafe}}), /project-relative/);
  }
  for (const invalid of [null, {}, {from: oldPortrait}, {from: oldPortrait, to: newPortrait, portraitChoice: ''}]) {
    assert.throws(() => mergePatch(current, {...portraitPatch(), portrait: invalid}));
  }
  for (const operations of [null, {}, 'all', Array(101).fill({})]) {
    assert.throws(() => mergePatch(current, {...portraitPatch(), operations}), /Invalid operations/);
  }
  assert.throws(() => mergePatch(current, {...patch(), operations: []}), /Invalid operations/);
  assert.throws(() => mergePatch(current, {...patch(), operations: undefined}), /Invalid operations/);
});

test('portrait preview/save reuse revision, backup and master history; repeated save is a no-op', async () => {
  const original = {...hero(), portrait: oldPortrait, portraitFocusX: 61, portraitFocusY: 43};
  const f = fixture({character: original}), backups = [];
  const preview = await applyPatch(f.transport, portraitPatch());
  assert.equal(preview.status, 'preview');
  assert.equal(f.calls.length, 0);
  const saved = await applyPatch(f.transport, portraitPatch(), {write: true, backup: async value => backups.push(clone(value))});
  assert.equal(saved.status, 'saved');
  assert.equal(saved.revision, 2);
  assert.equal(f.calls[0].expectedRevision, 1);
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(backups[0].state.characterJson), original);
  assert.deepEqual(backups[0].input, f.calls[0]);
  assert.deepEqual(JSON.parse(f.sheet.state.characterJson), {...hero(), portrait: newPortrait});
  const event = f.sheet.history['000000000002'];
  assert.equal(event.actorRole, 'master');
  assert.equal(event.source, 'sheet');
  assert.deepEqual(JSON.parse(event.changesJson).map(change => change.field).sort(), ['portrait', 'portraitFocusX', 'portraitFocusY']);
  assert.equal((await applyPatch(f.transport, portraitPatch(), {write: true})).status, 'unchanged');
  assert.equal(f.calls.length, 1);
  assert.equal(Object.keys(f.sheet.history).length, 1);
});

test('a concurrent player portrait change rejects stale save and is preserved on retry', async () => {
  const custom = 'images/portraits/custom_1778221143711_456.png';
  const f = fixture({character: {...hero(), portrait: oldPortrait}, beforeSave: sheet => {
    const current = JSON.parse(sheet.state.characterJson);
    current.portrait = custom;
    current.hpCur = 5;
    return D.commit(sheet, 'player_uid', {character: current, expectedRevision: 1, operationId: 'player_portrait_001'}, 200);
  }});
  await assert.rejects(applyPatch(f.transport, portraitPatch(), {write: true}), /revision-conflict/);
  await assert.rejects(applyPatch(f.transport, portraitPatch(), {write: true}), /Portrait changed/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.sheet.state.revision, 2);
  assert.equal(JSON.parse(f.sheet.state.characterJson).portrait, custom);
  assert.equal(JSON.parse(f.sheet.state.characterJson).hpCur, 5);
});
