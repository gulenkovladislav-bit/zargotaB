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

const biographyPatch = () => ({characterId: hero().id, campaignKey: hero().campaignKey,
  biography: {from: '', fromUk: null, ru: 'Approved history.', uk: 'Approved translated history.'}});

test('biography pair replaces only exact expected prose and preserves other live fields', () => {
  const current = {...hero(), biography: '', currentGoal: 'Player goal', notes: 'Player notes'}, before = clone(current);
  const result = mergePatch(current, biographyPatch());
  assert.equal(result.biography, biographyPatch().biography.ru);
  assert.equal(result.biographyUk, biographyPatch().biography.uk);
  assert.equal(result.currentGoal, current.currentGoal);
  assert.equal(result.notes, current.notes);
  assert.deepEqual(result.skills, current.skills);
  assert.deepEqual(current, before);
  assert.deepEqual(mergePatch(result, biographyPatch()), result, 'repeating an accepted pair is a no-op');
  assert.throws(() => mergePatch({...current, biography: 'Player replacement'}, biographyPatch()), /Biography changed/);
  assert.throws(() => mergePatch({...current, biographyUk: 'Player translation'}, biographyPatch()), /Biography changed/);
  assert.throws(() => mergePatch({...result, biographyUk: 'Newer translation'}, biographyPatch()), /Biography changed/);
});

test('biography sources distinguish absent text from empty text and require both locales', () => {
  const absent = {...biographyPatch(), biography: {...biographyPatch().biography, from: null}};
  assert.equal(mergePatch(hero(), absent).biography, absent.biography.ru);
  assert.equal(mergePatch({...hero(), biography: null, biographyUk: null}, absent).biographyUk, absent.biography.uk);
  assert.throws(() => mergePatch({...hero(), biography: ''}, absent), /Biography changed/);
  for (const biography of [null, {}, {from: '', ru: 'x', uk: 'y'},
    {from: '', fromUk: null, ru: 'x'}, {from: '', fromUk: null, ru: 'x', uk: 4},
    {...biographyPatch().biography, currentGoal: 'Overwrite'},
    {...biographyPatch().biography, from: 42}]) {
    assert.throws(() => mergePatch({...hero(), biography: ''}, {...biographyPatch(), biography}), /Biography needs/);
  }
  assert.throws(() => mergePatch({...hero(), biography: ''}, {...biographyPatch(),
    biography: {...biographyPatch().biography, uk: '<script>bad()</script>'}}), /unsafe-character-content/);
});

test('biography save records both locales in existing master history and rerun makes no write', async () => {
  const f = fixture({character: {...hero(), biography: '', currentGoal: 'Keep this'}}), backups = [];
  assert.equal((await applyPatch(f.transport, biographyPatch())).status, 'preview');
  assert.equal(f.calls.length, 0);
  assert.equal((await applyPatch(f.transport, biographyPatch(), {write: true, backup: async x => backups.push(clone(x))})).status, 'saved');
  assert.equal(backups.length, 1);
  assert.equal(JSON.parse(backups[0].state.characterJson).biography, '');
  assert.deepEqual(JSON.parse(f.sheet.history['000000000002'].changesJson).map(c => c.field).sort(), ['biography', 'biographyUk']);
  assert.equal(JSON.parse(f.sheet.state.characterJson).currentGoal, 'Keep this');
  assert.equal((await applyPatch(f.transport, biographyPatch(), {write: true})).status, 'unchanged');
  assert.equal(f.calls.length, 1);
});

test('concurrent biography editing blocks stale write and retry without touching player changes', async () => {
  const f = fixture({character: {...hero(), biography: ''}, beforeSave: sheet => {
    const current = JSON.parse(sheet.state.characterJson);
    current.biographyUk = 'Player wrote this meanwhile';
    current.hpCur = 7;
    return D.commit(sheet, 'player_uid', {character: current, expectedRevision: 1, operationId: 'player_biography_001'}, 200);
  }});
  await assert.rejects(applyPatch(f.transport, biographyPatch(), {write: true}), /revision-conflict/);
  await assert.rejects(applyPatch(f.transport, biographyPatch(), {write: true}), /Biography changed/);
  assert.equal(f.calls.length, 1);
  assert.equal(JSON.parse(f.sheet.state.characterJson).biographyUk, 'Player wrote this meanwhile');
  assert.equal(JSON.parse(f.sheet.state.characterJson).hpCur, 7);
});

test('family insert and status edits use stable IDs and preserve other people and their notes', async () => {
  const existing = {id: 'friend', name: 'Friend', note: 'Personal memory', lifeStatus: 'unknown', customFlag: true};
  const current = {...hero(), biography: '', family: [existing]};
  const request = {...biographyPatch(), operations: [
    {collection: 'family', match: {id: 'friend'}, set: {lifeStatus: 'dead', dead: true}},
    {collection: 'family', match: {id: 'mother'}, create: {parentId: 'root', dir: 'other', relationshipLevel: ''},
      set: {name: 'Mother', nameUk: 'Translated mother', relation: 'Parent', relationUk: 'Translated parent',
        knownInfo: 'Known biography', knownInfoUk: 'Translated known biography', lifeStatus: 'unknown', dead: false}}
  ]};
  const f = fixture({character: current});
  const result = await applyPatch(f.transport, request, {write: true});
  assert.equal(result.status, 'saved');
  const saved = JSON.parse(f.sheet.state.characterJson);
  assert.equal(saved.family.length, 2);
  assert.deepEqual(saved.family[0], {...existing, lifeStatus: 'dead', dead: true});
  assert.equal(saved.family[1].nameUk, 'Translated mother');
  assert.equal(saved.family[1].parentId, 'root');
  assert.equal(saved.family[1].dead, false);
  assert.equal(saved.biographyUk, request.biography.uk);
  assert.deepEqual(current.family, [existing]);
  assert.equal((await applyPatch(f.transport, request, {write: true})).status, 'unchanged');
  assert.equal(f.calls.length, 1);
});

test('family mutations reject ambiguous identity, invalid status, unsupported fields and graph cycles', () => {
  const current = {...hero(), family: [{id: 'mother', name: 'Mother', parentId: 'root'}]};
  const operation = {collection: 'family', match: {id: 'mother'}, set: {lifeStatus: 'dead'}};
  for (const bad of [
    {...operation, match: {name: 'Mother'}},
    {...operation, set: {lifeStatus: 'deceased'}},
    {...operation, set: {dead: 'true'}},
    {...operation, set: {dead: 0}},
    {...operation, set: {knownInfoUk: {uk: 'Wrong shape'}}},
    {...operation, set: {relationshipLevel: 'best'}},
    {...operation, set: {parentId: 'mother'}},
    {...operation, match: {id: 'new'}, create: {name: 'New', unsupported: 'bad'}},
    {...operation, match: {id: 'new'}, create: {}},
    {...operation, match: {id: 'new'}, create: {name: 'Mother'}}
  ]) assert.throws(() => mergePatch(current, patch([bad])));
  assert.throws(() => mergePatch({...current, family: [...current.family, clone(current.family[0])]}, patch([operation])), /Ambiguous/);
  for (const lifeStatus of ['alive', 'dead', 'unknown', 'undead']) {
    assert.equal(mergePatch(current, patch([{...operation, set: {lifeStatus}}])).family[0].lifeStatus, lifeStatus);
  }
  assert.equal(mergePatch(current, patch([{...operation, match: {id: 'new'}, set: {name: 'New'}, create: {dead: false}}])).family[1].dead, false);
  assert.throws(() => mergePatch(current, patch([{...operation, match: {id: 'new'}, set: {name: 'New'}, create: {dead: null}}])), /boolean/);
});
