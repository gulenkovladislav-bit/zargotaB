'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
const domain = require('../functions/character-domain');
const core = require('../persistent-character-core');

const clientSource = fs.readFileSync(path.join(__dirname, '../persistent-characters.js'), 'utf8');
const sheetId = 'table-hero';
const hero = {id: 72, campaignKey: 'hero-72', name: 'Ada', hpCur: 12, hpMax: 14, notes: 'original'};
const drain = () => new Promise(resolve => setImmediate(resolve));

async function fixture(uid = 'gm', accountRole = 'admin', sheetRole = 'master') {
  let sheet = domain.initial(hero, 'gm', 'player', 'local-test', 1);
  let notify, presence;
  const writes = [], toasts = [];
  const emptyWatch = () => () => {};
  const api = {
    uid: () => uid,
    account: async () => ({role: accountRole}),
    list: async () => ({[sheetId]: sheetRole}),
    meta: async () => sheet.meta,
    watch: (_, fn) => { notify = fn; return () => {}; },
    watchMeta: emptyWatch, watchLastSeen: emptyWatch, watchActivity: emptyWatch,
    presence: (_, fn) => { presence = fn; return () => {}; },
    read: async () => sheet.state,
    call: async request => {
      writes.push(request);
      sheet = domain.commit(sheet, uid, request, sheet.state.revision + 1);
      return {state: sheet.state};
    }
  };
  const window = {
    characters: [], crypto: webcrypto, addEventListener() {}, showToast: msg => toasts.push(msg),
    ZargotaPersistentTransport: {start: async () => api},
    ZargotaPersistentCore: core,
    ZargotaCharacterStatus: require('../character-status-operations'),
    zgGmStatusCatalog: () => [{key:'bleed',label:'Кровотечение',icon:'✦',color:'#c02020'},{key:'fear',label:'Страх',icon:'✦',color:'#9060c0'}],
    ZargotaPersistentCache: {read: async () => undefined, write: async () => {}},
    ZargotaCharacterStore: {saveCharacter: async () => ({ok: true})}
  };
  const navigator = {onLine: true};
  const document = {addEventListener() {}, getElementById: () => null, querySelector: () => null};
  vm.runInNewContext(clientSource, {window, document, navigator, localStorage: {getItem: () => null}, setTimeout, clearTimeout});
  const table = window.ZargotaPersistentCharacters;
  await table.start();
  async function deliver(packet = sheet.state) { notify(packet); await drain(); }
  await deliver();
  presence({gm: {laptop: {online: true}}, player: {phone: {online: true}}});
  return {
    window, navigator, table, writes, toasts, presence, deliver, server: () => sheet,
    playerEdits(patch) {
      const prior = JSON.parse(sheet.state.characterJson);
      sheet = domain.commit(sheet, 'player', {
        character: {...prior, ...patch}, expectedRevision: sheet.state.revision,
        operationId: 'player_edit_' + sheet.state.revision
      }, sheet.state.revision + 1);
    }
  };
}

test('the GM table uses confirmed HP and keeps unrelated local changes off the server', async () => {
  const f = await fixture();
  Object.assign(f.window.characters[0], {hpCur: 1, notes: 'private unsaved draft'});
  const [row] = f.table.tableHeroes();
  assert.equal(row.ready, true);
  assert.equal(row.online, true);
  assert.equal(row.character.hpCur, 12);
  assert.equal(f.table.tableHp(hero.id, -1), true);
  assert.equal(f.table.tableHp(hero.id, -1), false, 'a second tap cannot repeat the in-flight change');
  await drain();
  assert.equal(f.table.tableHeroes()[0].character.hpCur, 11);
  assert.equal(JSON.parse(f.server().state.characterJson).notes, 'original');
  assert.equal(f.writes[0].expectedRevision, 1);
});

test('a competing phone update wins over a stale increment, even if an older packet arrives last', async () => {
  const f = await fixture();
  const earlierPacket = f.server().state;
  f.playerEdits({hpCur: 8, notes: 'from phone'});
  assert.equal(f.table.tableHp(hero.id, 1), true);
  await drain();
  assert.equal(f.toasts.length, 1);
  await f.deliver();
  await f.deliver(earlierPacket);
  assert.equal(f.table.tableHeroes()[0].character.hpCur, 8);
  assert.equal(f.table.tableHp(hero.id, 1), true);
  await drain();
  assert.equal(f.table.tableHeroes()[0].character.hpCur, 9);
  assert.equal(JSON.parse(f.server().state.characterJson).notes, 'from phone');
});

test('a disconnected master can read the last HP but cannot send a change', async () => {
  const f = await fixture();
  f.presence({});
  assert.equal(f.table.tableHeroes()[0].state, 'offline');
  assert.equal(f.table.tableHp(hero.id, -1), false);
  f.presence({gm: {laptop: {online: true}}});
  assert.equal(f.table.tableHeroes()[0].online, false, 'the master connection is separate from the player');
  f.navigator.onLine = false;
  assert.equal(f.table.tableHeroes()[0].character.hpCur, 12);
  assert.equal(f.table.tableHp(hero.id, -1), false);
  assert.equal(f.writes.length, 0);
});

test('only an admin who owns this sheet has access through the table', async () => {
  for (const identity of [['player', 'player', 'player'], ['other', 'admin', 'master'], ['gm', 'admin', 'player']]) {
    const f = await fixture(...identity);
    assert.equal(f.table.tableHeroes().length, 0);
    assert.equal(f.table.tableHp(hero.id, -1), false);
    assert.equal(f.writes.length, 0);
  }
});

test('table status writes share revision protection and do not publish unrelated local drafts',async()=>{
  const f=await fixture();f.window.characters[0].notes='unsaved private draft';
  const pending=f.table.tableStatus(hero.id,'bleed',{unit:'rounds',duration:3,id:12345});
  assert.equal((await f.table.tableStatus(hero.id,'bleed',{unit:'rounds',duration:3})).ok,false);
  const applied=await pending;assert.equal(applied.ok,true);
  const saved=JSON.parse(f.server().state.characterJson);
  assert.equal(saved.notes,'original');assert.deepEqual(saved.statuses,['bleed']);assert.equal(saved.tempEffects[0].tickValue,-1);
  assert.equal(f.writes[0].expectedRevision,1);
  assert.equal((await f.table.tableUndoStatus(hero.id,applied.receipt)).ok,true);
  assert.equal(JSON.parse(f.server().state.characterJson).tempEffects,undefined);
});
test('status conflicts never retry or overwrite a phone edit',async()=>{
  const f=await fixture();f.playerEdits({notes:'phone change'});
  const reply=await f.table.tableStatus(hero.id,'fear',{unit:'rounds',duration:2});
  assert.equal(reply.ok,false);assert.equal(reply.reason,'conflict');assert.equal(f.writes.length,1);
  assert.equal(JSON.parse(f.server().state.characterJson).notes,'phone change');
  assert.equal(JSON.parse(f.server().state.characterJson).statuses,undefined);
});
test('offline master and non-owner cannot send statuses; offline player can receive a saved status',async()=>{
  const f=await fixture();f.navigator.onLine=false;
  assert.equal((await f.table.tableStatus(hero.id,'fear',{unit:'rounds',duration:2})).ok,false);assert.equal(f.writes.length,0);
  f.navigator.onLine=true;f.presence({gm:{laptop:{online:true}}});
  assert.equal((await f.table.tableStatus(hero.id,'fear',{unit:'rounds',duration:2})).ok,true);
  for(const identity of [['player','player','player'],['other','admin','master']]){
    const blocked=await fixture(...identity);assert.equal((await blocked.table.tableStatus(hero.id,'fear',{unit:'rounds',duration:2})).ok,false);assert.equal(blocked.writes.length,0);
  }
});
