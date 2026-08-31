'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const networkPath = path.join(root, 'zargota-network.js');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const syncOutbox = require(path.join(root, 'character-sync-outbox.js'));
const spellAutomation = require(path.join(root, 'spell-automation.js'));
const worldData = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const catalogEntries = worldData && worldData.catalog && Array.isArray(worldData.catalog.entries) ? worldData.catalog.entries : [];
const originalNetwork = fs.readFileSync(networkPath, 'utf8');
const readyStart = originalNetwork.indexOf('  var ready = Promise.all([');
const readyEnd = originalNetwork.indexOf('\n\n  w.ZargotaRooms = api;', readyStart);
assert.ok(readyStart > 0 && readyEnd > readyStart, 'network bootstrap must remain injectable for the two-client harness');
assert.match(indexHtml, /combatAttackTargetTokenId/, 'combat targeting must preserve the selected scene token identity');
assert.match(indexHtml, /combatAttackTargetUid/, 'combat targeting must preserve the selected hero identity');
assert.match(indexHtml, /findCombatAttackTarget\(order,entry,token\)/, 'a scene click must be remapped to the current combat snapshot');
assert.match(indexHtml, /target=findCombatAttackTarget\(order\)/, 'attack submission must resolve the target from the current combat snapshot');
assert.match(indexHtml, /zgSceneSourceAddToCombat/, 'a source-linked scene token needs a visible GM control for joining active combat');
const network = originalNetwork.slice(0, readyStart) +
  '  firebase=w.__testFirebase;auth=w.__testAuth;db=w.__testDb;connected=true;var ready=Promise.resolve(auth.currentUser);\n' +
  originalNetwork.slice(readyEnd);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function findUndefinedPath(value, prefix) {
  if (value === undefined) return prefix || '<root>';
  if (typeof value === 'number' && !Number.isFinite(value)) return prefix || '<root>';
  if (!value || typeof value !== 'object') return '';
  for (const key of Object.keys(value)) {
    if (!key || /[.#$\[\]\/]/.test(key)) return prefix ? `${prefix}.${key}` : key;
    const found = findUndefinedPath(value[key], prefix ? `${prefix}.${key}` : key);
    if (found) return found;
  }
  return '';
}

function splitPath(value) {
  return String(value || '').split('/').filter(Boolean);
}

function readAt(rootValue, valuePath) {
  let current = rootValue;
  for (const key of splitPath(valuePath)) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

function writeAt(rootValue, valuePath, value) {
  const parts = splitPath(valuePath);
  if (!parts.length) throw new Error('The fake Firebase root cannot be replaced');
  let current = rootValue;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  }
  const key = parts[parts.length - 1];
  if (value === null || value === undefined) delete current[key];
  else if (value && value.__increment != null) current[key] = (Number(current[key]) || 0) + Number(value.__increment);
  else current[key] = clone(value);
}

function memoryStorage(initial) {
  const values = Object.assign({}, initial || {});
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
    clear() { Object.keys(values).forEach((key) => delete values[key]); }
  };
}

function createSharedFirebase(seed) {
  const data = clone(seed);
  const writes = [];
  function snapshot(value) {
    const stored = clone(value);
    return { exists: () => stored !== undefined && stored !== null, val: () => clone(stored) };
  }
  function client(uid) {
    function ref(_db, valuePath) { return { path:String(valuePath || '') }; }
    function set(target, value) {
      writeAt(data, target.path, value);
      writes.push({ uid, kind:'set', path:target.path });
      return Promise.resolve();
    }
    function update(target, values) {
      const updatePaths = Object.keys(values || {}).sort();
      const invalidUpdatePath = updatePaths.find((relativePath) => relativePath.split('/').some((key) => !key || /[.#$\[\]]/.test(key)));
      if (invalidUpdatePath) return Promise.reject(new Error(`Firebase update contains invalid path ${invalidUpdatePath}`));
      const undefinedPath = updatePaths.map((relativePath) => findUndefinedPath(values[relativePath], `update.${relativePath}`)).find(Boolean);
      if (undefinedPath) return Promise.reject(new Error(`Firebase update contains invalid data at ${undefinedPath}`));
      for (let index = 1; index < updatePaths.length; index += 1) {
        if (updatePaths[index].startsWith(`${updatePaths[index - 1]}/`)) {
          return Promise.reject(new Error(`Firebase update path overlap: ${updatePaths[index - 1]} and ${updatePaths[index]}`));
        }
      }
      Object.keys(values || {}).forEach((relativePath) => {
        writeAt(data, [target.path, relativePath].filter(Boolean).join('/'), values[relativePath]);
      });
      writes.push({ uid, kind:'update', path:target.path, keys:Object.keys(values || {}) });
      return Promise.resolve();
    }
    function runTransaction(target, mutator) {
      const next = mutator(clone(readAt(data, target.path)));
      if (next === undefined) return Promise.resolve({ committed:false, snapshot:snapshot(readAt(data, target.path)) });
      writeAt(data, target.path, next);
      writes.push({ uid, kind:'transaction', path:target.path });
      return Promise.resolve({ committed:true, snapshot:snapshot(next) });
    }
    return {
      ref,
      get: (target) => Promise.resolve(snapshot(readAt(data, target.path))),
      set,
      update,
      runTransaction,
      increment: (amount) => ({ __increment:Number(amount) || 0 }),
      remove: (target) => set(target, null),
      onValue(target, listener) {
        listener(snapshot(readAt(data, target.path)));
        return function unsubscribe() {};
      },
      onDisconnect() {
        return {
          update: () => Promise.resolve(),
          remove: () => Promise.resolve(),
          cancel: () => Promise.resolve()
        };
      },
      serverTimestamp: () => Date.now()
    };
  }
  return { data, writes, client };
}

const deterministicRandomValues = [];

function queueDeterministicRandom(...values) {
  deterministicRandomValues.push(...values.map((value) => Math.max(0, Math.min(0.999999, Number(value) || 0))));
}

function deterministicMath() {
  const result = Object.create(Math);
  result.random = () => deterministicRandomValues.length ? deterministicRandomValues.shift() : 0.5;
  return result;
}

function createClient(shared, uid, role, roomCode) {
  const sessionKey = 'zargota_vtt_session_v4';
  const sessionStorage = memoryStorage({
    [sessionKey]: JSON.stringify({ code:roomCode, uid, role })
  });
  const context = {
    console,
    Promise,
    Date,
    JSON,
    Math:deterministicMath(),
    Blob,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage:memoryStorage(),
    sessionStorage,
    navigator:{ onLine:true },
    location:{ href:'http://localhost:4173/index.html' },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    __testAuth:{ currentUser:{ uid } },
    __testDb:{},
    __testFirebase:shared.client(uid),
    ZargotaSyncOutbox:syncOutbox,
    ZargotaSpellAutomation:spellAutomation,
    getStatusMechanics:() => [{key:'poison',label:'Отравлен',labelUk:'Отруєний',icon:'☠',color:'#7ea34b',durationUnit:'manual',attackDisadvantage:true,abilityCheckDisadvantage:true,autoRemove:'save_dc',saveDC:14,saveStat:'con'}]
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(network, context, { filename:'zargota-network.js', timeout:10000 });
  return context.ZargotaRooms;
}

const roomCode = 'DUEL1';
const masterUid = 'gm-1';
const playerUid = 'player-1';
const enemyTokenId = 'enemy-1';
const shared = createSharedFirebase({
  rooms: {
    [roomCode]: {
      code:roomCode,
      phase:'session',
      masterUid,
      members: {
        [masterUid]: { uid:masterUid, role:'master', name:'ГМ' },
        [playerUid]: {
          uid:playerUid,
          role:'player',
          name:'Игрок',
          characterId:'hero-1',
          character:{
            id:'hero-1',
            name:'Испытатель',
            hpCur:14,
            hpMax:14,
            tempHp:2,
            ac:10,
            initiative:50,
            speed:7,
            revision:1,
            stats:{ str:2, dex:1, int:0, cha:0, per:0, con:1 },
            weaponProfiles:[{
              id:'hero-blade',
              name:'Испытательный клинок',
              damageFormula:'1d6',
              damageType:'Рубящий',
              range:'1 клетка',
              stat:'str'
            },{
              id:'hero-bow',
              name:'Испытательный лук',
              damageFormula:'1d8',
              damageType:'Колющий',
              range:'8 клеток',
              stat:'dex'
            }],
            spellRefs:[
              'spell-two-client-mark','spell-finger-heat','spell-finger-heat-cancelled','spell-two-client-silenced',
              'spell-two-client-heal','spell-two-client-concentration','spell-two-client-summon','spell-two-client-before-zero-hp','spell-two-client-zero-hp'
            ],
            spellsLearned:{
              'spell-two-client-mark':true,'spell-finger-heat':true,'spell-finger-heat-cancelled':true,'spell-two-client-silenced':true,
              'spell-two-client-heal':true,'spell-two-client-concentration':true,'spell-two-client-summon':true,'spell-two-client-before-zero-hp':true,'spell-two-client-zero-hp':true
            },
            preparedSpells:{
              kodex:['spell-two-client-mark','spell-finger-heat','spell-finger-heat-cancelled'],
              folio:['spell-two-client-silenced','spell-two-client-heal','spell-two-client-concentration'],
              obrad:['spell-two-client-summon','spell-two-client-before-zero-hp','spell-two-client-zero-hp']
            },
            statuses:[],
            statusEffects:[]
          }
        }
      },
      scene:{
        gridSize:72,
        layers:[{ id:'published-background', image:'images/maps/training.webp', opacity:0.85 }],
        tokens:[{
          id:enemyTokenId,
          type:'custom',
          disposition:'enemy',
          name:'Учебный противник',
          hp:12,
          hpMax:12,
          tempHp:0,
          ac:0,
          x:50,
          y:50,
          statuses:[],
          statusEffects:[]
        }]
      },
      zones:{},
      updatedAt:1
    }
  }
});

const master = createClient(shared, masterUid, 'master', roomCode);
const player = createClient(shared, playerUid, 'player', roomCode);

async function expectCode(operation, code) {
  let thrown = null;
  try { await operation(); } catch (error) { thrown = error; }
  assert.ok(thrown, `operation must reject with ${code}`);
  assert.strictEqual(thrown.code, code);
}

(async function run() {
  const liveEnemyToken = {
    id:'enemy-live-added',
    type:'custom',
    disposition:'enemy',
    name:'Серый волк',
    hp:9,
    hpMax:9,
    ac:12,
    x:42,
    y:46,
    snap:false,
    statuses:[],
    statusEffects:[]
  };
  let snapshot = await master.upsertSceneToken(liveEnemyToken);
  assert.ok(snapshot.room.scene.tokens.some((token) => token && token.id === liveEnemyToken.id), 'a token added after joining must enter the published scene');
  assert.ok(shared.data.rooms[roomCode].scene.tokens.some((token) => token && token.id === liveEnemyToken.id), 'the live token must be written to Firebase scene data');
  assert.strictEqual(shared.data.rooms[roomCode].scene.gridSize, 72, 'a live token update must preserve unpublished scene settings');
  assert.strictEqual(shared.data.rooms[roomCode].scene.layers[0].id, 'published-background', 'a live token update must preserve the published background');
  const liveWrite = shared.writes.find((write) => write.kind === 'update' && write.path === `rooms/${roomCode}/scene` && write.keys.includes('tokens'));
  assert.ok(liveWrite, 'a live token must use a targeted scene update');
  assert.deepStrictEqual(liveWrite.keys.slice().sort(), ['publishedAt','revision','tokens'], 'live insertion must not replace the whole scene');
  await expectCode(() => player.upsertSceneToken(Object.assign({}, liveEnemyToken, { id:'player-forbidden-token' })), 'master-only');

  snapshot = await master.moveMasterToken(liveEnemyToken.id, 47, 48, {
    x:44,
    y:45,
    visualId:'manual-drag-origin-test'
  });
  assert.strictEqual(snapshot.room.lastMovement.fromX, 44, 'GM movement must start at the latest local drag position, even before its scene write is observed');
  assert.strictEqual(snapshot.room.lastMovement.fromY, 45, 'GM movement must preserve the latest dragged Y coordinate');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === liveEnemyToken.id).x, 47, 'GM movement must persist the target X coordinate');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === liveEnemyToken.id).y, 48, 'GM movement must persist the target Y coordinate');

  snapshot = await master.gmAddInventoryItem(playerUid, {
    itemId:'gm-test-sword',
    name:'Клинок двух клиентов',
    icon:'⚔',
    category:'weapon',
    damageFormula:'1d8',
    damageType:'Рубящий',
    attackStat:'str',
    slot:'weapon',
    qty:1
  });
  assert.strictEqual(snapshot.room.members[playerUid].character.inventoryItems.length, 1);
  assert.strictEqual(snapshot.room.members[playerUid].character.inventoryItems[0].name, 'Клинок двух клиентов');

  snapshot = await master.gmAddJournalEntry(playerUid, {
    journalId:'gm-test-journal',
    title:'Запись двух клиентов',
    text:'Эта запись должна сохраниться, отобразиться и удалиться через синхронизацию героя.',
    icon:'✎',
    kind:'note',
    image:'images/journal/test.webp'
  });
  assert.strictEqual(snapshot.room.members[playerUid].character.journalEntries.length, 1);
  assert.strictEqual(snapshot.room.members[playerUid].character.journalEntries[0].image, 'images/journal/test.webp');

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, { kind:'damage', amount:5 });
  assert.strictEqual(snapshot.room.members[playerUid].character.hpCur, 11, 'temporary HP must absorb damage before regular HP');
  assert.strictEqual(snapshot.room.members[playerUid].character.tempHp, 0);
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, { kind:'heal', amount:3 });
  assert.strictEqual(snapshot.room.members[playerUid].character.hpCur, 14, 'GM healing must clamp at maximum HP');
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, { kind:'temp-hp', amount:2 });
  assert.strictEqual(snapshot.room.members[playerUid].character.tempHp, 2);

  const hpMaxBeforeInjury = snapshot.room.members[playerUid].character.hpMax;
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'injury',action:'add',
    injury:{id:'inj-two-client-arm',roll:1,key:'broken-arm',icon:'🦴',name:'Сломанная рука',severity:'Тяжёлая',effect:'−1 к атакам',treatment:'Шина',createdAt:1786300500000,source:'gm-d20'}
  });
  assert.strictEqual(snapshot.room.members[playerUid].character.injuries.length, 1, 'GM injury must persist through the real room operation');
  assert.strictEqual(snapshot.room.members[playerUid].character.hpMax, Math.floor(hpMaxBeforeInjury * 0.9), 'one injury reduces maximum HP by ten percent');
  assert.strictEqual(snapshot.room.manualEvent.kind, 'gm-injury');
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'injury',action:'remove',injuryId:'inj-two-client-arm',injuryIndex:0
  });
  assert.strictEqual(snapshot.room.members[playerUid].character.injuries.length, 0, 'GM injury removal must clear the same injury once');
  assert.strictEqual(snapshot.room.members[playerUid].character.hpMax, hpMaxBeforeInjury, 'removing the last injury restores base maximum HP');
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, { kind:'heal', amount:hpMaxBeforeInjury });
  assert.strictEqual(snapshot.room.members[playerUid].character.hpCur, hpMaxBeforeInjury, 'the scenario restores HP before continuing unrelated combat checks');

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'frozen',
    label:'Заморожен',
    enable:true,
    effect:{ durationUnit:'rounds', durationValue:2, icon:'❄', color:'#4aa8ff', cantMove:true }
  });
  assert.ok(snapshot.room.members[playerUid].character.statuses.includes('frozen'));
  assert.strictEqual(snapshot.room.members[playerUid].character.statusEffects[0].remainingRounds, 2);
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'frozen',
    label:'Заморожен',
    enable:false
  });
  assert.ok(!snapshot.room.members[playerUid].character.statuses.includes('frozen'));

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'curse',
    label:'Скрытое проклятие',
    enable:true,
    effect:{ durationUnit:'manual', visibility:'gm', icon:'◇' }
  });
  assert.strictEqual(snapshot.room.manualEvent.visibility, 'gm', 'a hidden manual status keeps its GM-only presentation scope');
  Object.keys(snapshot.room.members).forEach((uid) => {
    assert.ok(!snapshot.room.members[uid].messages[snapshot.room.manualEvent.id], 'a hidden status is not copied into any player inbox');
  });
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',statusKey:'curse',label:'Скрытое проклятие',enable:false
  });
  assert.strictEqual(snapshot.room.manualEvent.visibility, 'gm', 'removing a hidden status remains private');

  snapshot = await master.gmBroadcastVisual({ memberUid:playerUid }, {
    type:'particle',
    effect:'frost',
    intensity:'strong'
  });
  assert.strictEqual(snapshot.room.visualEvent.effect, 'frost');
  assert.strictEqual(snapshot.room.visualEvent.targetUid, playerUid);

  const deliveries = [
    {
      operationId:'two-client-text',
      kind:'text',
      mood:'solemn',
      title:'Послание мастера',
      text:'Текстовая выдача для проверки.',
      showPopup:true
    },
    {
      operationId:'two-client-image',
      kind:'image',
      mood:'ominous',
      title:'Найденное изображение',
      text:'Изображение должно дойти до клиента.',
      image:'images/journal/test.webp',
      presentation:'cinematic',
      showPopup:true
    },
    {
      operationId:'two-client-quest',
      kind:'quest',
      mood:'calm',
      title:'Испытательная цель',
      text:'Проверить доставку задания.',
      image:'images/journal/quest.webp',
      payload:{ quest:{ questId:'two-client-quest', status:'active', importance:'main', icon:'⚑' } },
      showPopup:true
    },
    {
      operationId:'two-client-item',
      kind:'item',
      mood:'calm',
      title:'Набор снабжения',
      text:'Предметная выдача.',
      payload:{ item:{ name:'Зелье двух клиентов', icon:'🧪', category:'consumable', qty:2 } },
      showPopup:true
    }
  ];
  for (const delivery of deliveries) {
    snapshot = await master.gmSendDelivery(playerUid, delivery);
    const deliveryId = `gm-delivery-${delivery.operationId}-0`;
    const record = snapshot.room.members[playerUid].gmDeliveries[deliveryId];
    assert.strictEqual(record.status, 'pending');
    assert.strictEqual(record.kind, delivery.kind);
    if (delivery.kind === 'image') {
      assert.strictEqual(record.presentation, 'cinematic');
      assert.strictEqual(record.image, 'images/journal/test.webp');
    }
    snapshot = await player.acknowledgeGmDelivery(deliveryId, 'applied');
    assert.strictEqual(snapshot.room.members[playerUid].gmDeliveries[deliveryId].status, 'applied');
  }

  snapshot = await master.upsertSceneToken({
    id:enemyTokenId,
    type:'custom',
    disposition:'enemy',
    name:'Учебный противник',
    image:'images/test/enemy.webp',
    hidden:false,
    x:50,
    y:50,
    size:64,
    hp:12,
    hpMax:12,
    ac:0,
    stats:{ str:0, dex:0 }
  });
  snapshot = await master.startCombat([{
    tokenId:enemyTokenId,
    kind:'enemy',
    name:'Учебный противник',
    group:'training-enemy',
    bonus:-20,
    hp:12,
    hpMax:12,
    tempHp:0,
    ac:0,
    stats:{ str:2, dex:0 },
    weaponProfiles:[{
      id:'enemy-claw',
      name:'Коготь',
      damageFormula:'1d4+1',
      damageType:'Рубящий',
      range:'1 клетка',
      stat:'str'
    },{
      id:'enemy-finisher',
      name:'Смертельный удар',
      damageFormula:'1d20+20',
      damageType:'Рубящий',
      range:'1 клетка',
      stat:'str'
    },{
      id:'enemy-bow',
      name:'Учебный лук',
      damageFormula:'1d6',
      damageType:'Колющий',
      range:'8 клеток',
      stat:'dex'
    }]
  }], {});
  assert.strictEqual(snapshot.room.combat.phase, 'initiative');
  assert.strictEqual(snapshot.room.combat.order.length, 2);
  assert.ok(snapshot.room.scene.tokens.some((token) => token.id === enemyTokenId), 'combat start must preserve the already published live token');
  assert.strictEqual(snapshot.room.scene.layers[0].id, 'published-background', 'combat start must preserve published scene layers');

  await player.rollInitiative();
  await master.rollInitiative('training-enemy');
  snapshot = await master.beginCombatTurns();
  assert.strictEqual(snapshot.room.combat.active, true);
  assert.strictEqual(snapshot.room.combat.round, 1);
  assert.strictEqual(snapshot.room.combat.order[0].uid, playerUid, 'the player owns the opening turn');
  const enemyKey = snapshot.room.combat.order.find((entry) => entry.uid !== playerUid).key;
  const heroKey = snapshot.room.combat.order.find((entry) => entry.uid === playerUid).key;
  await expectCode(() => player.setCombatParticipantSkipped(enemyKey, true), 'master-only');
  snapshot = await master.setCombatParticipantSkipped(enemyKey, true);
  assert.strictEqual(snapshot.room.combat.order.find((entry) => entry.key === enemyKey).skipRounds, true, 'the shared initiative flag reaches both clients');
  snapshot = await master.setCombatParticipantSkipped(enemyKey, false);
  assert.strictEqual(snapshot.room.combat.order.find((entry) => entry.key === enemyKey).skipRounds, false, 'the GM can return a participant without removing its initiative entry');

  const freeBefore = clone(snapshot.room.combat.order[0].economy);
  snapshot = await player.useCombatAction('free', heroKey);
  assert.strictEqual(snapshot.room.combatEvent.kind, 'combat-action');
  assert.strictEqual(snapshot.room.combatEvent.actionType, 'free');
  assert.match(snapshot.room.combatEvent.text, /свободное действие/i, 'a free action must end with visible combat feedback');
  assert.deepStrictEqual(snapshot.room.combat.order[0].economy, freeBefore, 'a free action must not consume the limited economy');

  const deletedJournal = clone(snapshot.room.members[playerUid].character);
  deletedJournal.journalEntries[0].deletedAt = Date.now();
  deletedJournal.journalEntries[0].updatedAt = Date.now();
  snapshot = await player.syncCharacter(deletedJournal, { reason:'journal-remove' });
  assert.ok(snapshot.room.members[playerUid].character.journalEntries[0].deletedAt > 0, 'player journal deletion must reach the shared character');

  snapshot = await player.requestMovement(49, 50, { x:48, y:50, tokenId:'hero-player-1' });
  const movementId = snapshot.room.members[playerUid].movementRequest.id;
  snapshot = await master.resolveMovement(playerUid, true);
  const heroToken = snapshot.room.scene.tokens.find((token) => token && token.memberUid === playerUid);
  assert.ok(heroToken, 'approved movement must create the missing hero token');
  assert.strictEqual(heroToken.x, 49);
  assert.strictEqual(heroToken.y, 50);
  assert.ok(snapshot.room.combat.order[0].economy.movement < snapshot.room.combat.order[0].economy.movementMax);
  snapshot = await player.acknowledgeMovement(movementId);
  assert.strictEqual(snapshot.room.members[playerUid].movementRequest, undefined);

  snapshot = await player.requestAction('Применяет испытательную метку', 'ability', '', {
    operationId:'two-client-spell-1',
    key:'spell-two-client-mark',
    sourceId:'spell-two-client-mark',
    name:'Испытательная метка',
    kind:'spell',
    actionCost:'short',
    resolutionMode:'automatic',
    attackStat:'int',
    rangeCells:10,
    targetCount:1,
    damageFormula:'1d4',
    damageType:'Магический',
    targetMode:'target',
    durationRounds:2,
    statuses:['marked'],
    resourceKey:'spell-two-client-mark',
    resourceMax:3,
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey, targetName:'Учебный противник' }
  });
  const spellRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.resolveCombatAbility(playerUid, [enemyKey], {});
  assert.strictEqual(snapshot.room.combatEvent.damage, 3, 'spell damage must be resolved by the master and remain non-zero');
  assert.ok(snapshot.room.combat.order[1].statuses.includes('marked'));
  assert.strictEqual(snapshot.room.combat.order[1].hp, 9);
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 1);
  await player.acknowledgeAction(spellRequestId);

  snapshot = await player.requestAction('Применяет тестовый Жар Пальцев', 'ability', '', {
    operationId:'two-client-finger-heat-approved',
    key:'spell-finger-heat', sourceId:'spell-finger-heat', name:'Жар Пальцев', kind:'spell',
    automationKey:'finger-heat-v1', animationKey:'finger-heat-v1', soundProfile:'magic-fire',
    actionCost:'free', resolutionMode:'attack', attackStat:'int', rangeCells:10, targetCount:1,
    damageFormula:'1d6', damageType:'fire', targetMode:'target',
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey, targetName:'Учебный противник' }
  });
  const fingerHeatRequestId = snapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(snapshot.room.combat.order[1].hp, 9, 'opening the GM verdict must not mutate HP');
  snapshot = await master.prepareCombatAbilityRoll(playerUid, enemyKey, 'attack');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-attack-ready', 'the GM must explicitly assign the d20');
  assert.strictEqual(snapshot.room.combat.order[1].hp, 9, 'assigning the d20 must not mutate HP');
  queueDeterministicRandom(0.74);
  snapshot = await player.rollCombatAbilityStage(fingerHeatRequestId);
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-attack-result');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.abilityResolution.attack.roll, 15, 'the player d20 must be stored before the GM verdict');
  assert.strictEqual(snapshot.room.combat.order[1].hp, 9, 'the attack roll must not mutate HP');
  snapshot = await master.prepareCombatAbilityRoll(playerUid, enemyKey, 'damage');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-damage-ready', 'a hit must explicitly request the damage die');
  queueDeterministicRandom(0.01);
  snapshot = await player.rollCombatAbilityStage(fingerHeatRequestId);
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-damage-result');
  assert.deepStrictEqual(Array.from(snapshot.room.members[playerUid].actionRequest.abilityResolution.damage.rolls), [1]);
  assert.strictEqual(snapshot.room.combat.order[1].hp, 9, 'the damage roll must still wait for GM confirmation');
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status', statusKey:'silence', label:'Немота', enable:true,
    effect:{ durationUnit:'rounds', durationValue:1, icon:'🔇' }
  });
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-damage-result', 'a new silence effect must not erase the already rolled spell result');
  snapshot = await master.resolveCombatAbility(playerUid, [enemyKey], { approvedResults:[{
    key:enemyKey, roll:15, rolls:[15], rollMode:'normal', modifier:0, total:15, dc:10,
    success:true, damage:1, damageRolls:[1], statuses:['spell-scar','arcane-glow','dead','spell-scar']
  }] });
  assert.ok(snapshot.room.combat.order[0].statuses.includes('silence'), 'final application completes while the later silence remains active');
  assert.strictEqual(snapshot.room.combat.order[1].hp, 8, 'the authoritative resolver applies the exact GM-approved damage');
  assert.deepStrictEqual(Array.from(snapshot.room.combat.order[1].statuses).filter(status => status === 'spell-scar' || status === 'arcane-glow'), ['spell-scar','arcane-glow'], 'the GM can add several normalized conditions to the spell result');
  assert.ok(!snapshot.room.combat.order[1].statuses.includes('dead'), 'the spell result cannot add the reserved death state');
  assert.strictEqual(snapshot.room.combatEvent.roll, 15, 'the event preserves the approved attack die');
  assert.deepStrictEqual(Array.from(snapshot.room.combatEvent.damageRolls), [1], 'the approved damage die reaches synchronized playback');
  await expectCode(() => master.resolveCombatAbility(playerUid, [enemyKey], { approvedResults:[] }), 'request-missing');
  assert.strictEqual(shared.data.rooms[roomCode].combat.order[1].hp, 8, 'a confirmed spell result cannot apply twice');
  await player.acknowledgeAction(fingerHeatRequestId);
  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status', statusKey:'silence', label:'Немота', enable:false
  });

  snapshot = await player.requestAction('Начинает отменяемый Жар Пальцев', 'ability', '', {
    operationId:'two-client-finger-heat-cancelled',
    key:'spell-finger-heat-cancelled', sourceId:'spell-finger-heat-cancelled', name:'Жар Пальцев', kind:'spell',
    automationKey:'finger-heat-v1', actionCost:'free', resolutionMode:'attack', attackStat:'int', rangeCells:10,
    damageFormula:'1d6', damageType:'fire', targetMode:'target',
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey, targetName:'Учебный противник' }
  });
  const cancelledFingerHeatRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.prepareCombatAbilityRoll(playerUid, enemyKey, 'attack');
  queueDeterministicRandom(0.74);
  snapshot = await player.rollCombatAbilityStage(cancelledFingerHeatRequestId);
  snapshot = await master.prepareCombatAbilityRoll(playerUid, enemyKey, 'damage');
  queueDeterministicRandom(0.2);
  snapshot = await player.rollCombatAbilityStage(cancelledFingerHeatRequestId);
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'ability-damage-result');
  const hpBeforeCancelledSpell = snapshot.room.combat.order[1].hp;
  snapshot = await master.resolveAction(playerUid, false);
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'rejected', 'the GM can cancel a staged spell after the damage roll');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.stage, 'cancelled');
  assert.strictEqual(snapshot.room.combat.order[1].hp, hpBeforeCancelledSpell, 'cancelling the staged spell must not apply its rolled damage');
  await player.acknowledgeAction(cancelledFingerHeatRequestId);

  snapshot = await player.requestAction('Просит потратить заряд «Испытательная метка»', 'ability-resource', '', {
    resourceKey:'spell-two-client-mark', delta:1, max:3, name:'Испытательная метка'
  });
  const spendChargeRequestId = snapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.resourceAdjustment.delta, 1);
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 1, 'a player charge click must not mutate Firebase before GM approval');
  snapshot = await master.resolveAction(playerUid, true);
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 2, 'GM approval applies the requested charge exactly once');
  await expectCode(() => master.resolveAction(playerUid, true), 'request-missing');
  await player.acknowledgeAction(spendChargeRequestId);

  snapshot = await player.requestAction('Просит вернуть заряд «Испытательная метка»', 'ability-resource', '', {
    resourceKey:'spell-two-client-mark', delta:-1, max:3, name:'Испытательная метка'
  });
  const restoreChargeRequestId = snapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 2, 'a restore request must also wait for the GM');
  snapshot = await master.resolveAction(playerUid, true);
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 1, 'GM can approve restoring one charge');
  await player.acknowledgeAction(restoreChargeRequestId);

  snapshot = await player.requestAction('Просит потратить заряд «Испытательная метка»', 'ability-resource', '', {
    resourceKey:'spell-two-client-mark', delta:1, max:3, name:'Испытательная метка'
  });
  const rejectedChargeRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.resolveAction(playerUid, false);
  assert.strictEqual(snapshot.room.members[playerUid].character.abilityUsage['spell-two-client-mark'].used, 1, 'a rejected charge request must not change the resource');
  await player.acknowledgeAction(rejectedChargeRequestId);

  await expectCode(
    () => player.resolveCombatAttack(`token:${enemyTokenId}`, {
      weaponId:'hero-blade',
      statKey:'str',
      mode:'normal'
    }, `member:${playerUid}`),
    'master-only'
  );
  await expectCode(
    () => player.resolveCombatDamage(`token:${enemyTokenId}`, {
      weaponId:'hero-blade',
      statKey:'str'
    }, `member:${playerUid}`),
    'master-only'
  );

  snapshot = await player.requestAction(
    'Просит атаковать учебного противника',
    'combat-attack',
    '',
    { targetKey:`token:${enemyTokenId}`, weaponId:'hero-bow', statKey:'dex', masteryBonus:0, mode:'normal' }
  );
  const requestId = snapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'pending');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.details.weaponId, 'hero-bow', 'the player request must preserve a non-first selected weapon');

  await master.resolveAction(playerUid, true, { mode:'normal' });
  await master.requestApprovedAttackRoll(requestId, playerUid);
  snapshot = await master.resolveCombatAttack(`token:${enemyTokenId}`, {
    weaponId:'hero-bow',
    statKey:'dex',
    masteryBonus:0,
    mode:'normal'
  }, `member:${playerUid}`);
  assert.strictEqual(snapshot.room.combatEvent.hit, true);
  snapshot = await master.finishApprovedAttackRoll(
    playerUid,
    requestId,
    true,
    snapshot.room.combatEvent.id,
    '',
    true,
    false
  );
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.status, 'damage-requested', 'a hit must pause before the separate damage roll');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.resultEventId, snapshot.room.combatEvent.id, 'the player receives the hit event before damage dice');
  assert.ok(snapshot.room.combatEvent.revealAt >= snapshot.room.members[playerUid].actionRequest.resolvedAt + 2750, 'the hit reaction must remain after the approved d20 final result');
  snapshot = await master.requestApprovedDamageRoll(requestId, playerUid);
  assert.ok(snapshot.room.members[playerUid].actionRequest.damageRollRequestedAt > 0, 'damage roll has its own timestamp and cannot reuse the hit roll timer');
  snapshot = await master.resolveCombatDamage(`token:${enemyTokenId}`, {
    weaponId:'hero-bow',
    statKey:'dex'
  }, `member:${playerUid}`);
  assert.strictEqual(snapshot.room.combatEvent.damage, 6, '1d8 + 1 Dexterity must produce six deterministic damage');
  assert.strictEqual(snapshot.room.combat.order[1].hp, 2, 'enemy combat HP must decrease after spells and weapon damage');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === enemyTokenId).hp, 2, 'enemy token HP must stay synchronized');
  await master.finishApprovedDamageRoll(playerUid, requestId, true, snapshot.room.combatEvent.id, '');

  shared.data.rooms[roomCode].combat.order[0].economy.long = 1;
  queueDeterministicRandom(0.1, 0.8);
  snapshot = await master.resolveCombatAttack(`token:${enemyTokenId}`, {
    operationId:'two-client-advantage-batch',
    weaponId:'hero-bow',
    statKey:'dex',
    mode:'advantage'
  }, `member:${playerUid}`);
  assert.deepStrictEqual(Array.from(snapshot.room.combatEvent.attackRolls), [3, 17], 'advantage must preserve both independent d20 values');
  assert.strictEqual(snapshot.room.combatEvent.attackKeptIndex, 1, 'advantage must identify the higher visible die');
  assert.strictEqual(snapshot.room.combatEvent.attackRoll, 17, 'advantage uses the higher d20 result');
  await master.configurePendingCombatDamage({ cancel:true });

  shared.data.rooms[roomCode].combat.order[0].economy.long = 1;
  queueDeterministicRandom(0.8, 0.1);
  snapshot = await master.resolveCombatAttack(`token:${enemyTokenId}`, {
    operationId:'two-client-disadvantage-batch',
    weaponId:'hero-bow',
    statKey:'dex',
    mode:'disadvantage'
  }, `member:${playerUid}`);
  assert.deepStrictEqual(Array.from(snapshot.room.combatEvent.attackRolls), [17, 3], 'disadvantage must preserve both independent d20 values');
  assert.strictEqual(snapshot.room.combatEvent.attackKeptIndex, 1, 'disadvantage must identify the lower visible die');
  assert.strictEqual(snapshot.room.combatEvent.attackRoll, 3, 'disadvantage uses the lower d20 result');
  assert.strictEqual(snapshot.room.combatEvent.hit, false, 'the lower disadvantage die must decide the miss');

  shared.data.rooms[roomCode].combat.order[0].economy.long = 1;
  queueDeterministicRandom(0.5, 0, 0.2, 0.4, 0.6);
  snapshot = await master.resolveCombatAttack(`token:${enemyTokenId}`, {
    operationId:'two-client-extra-damage-batch',
    weaponId:'hero-bow',
    statKey:'dex',
    mode:'normal',
    bonusDiceCount:3,
    bonusDieSides:6
  }, `member:${playerUid}`);
  snapshot = await master.resolveCombatDamage(`token:${enemyTokenId}`, {}, `member:${playerUid}`);
  assert.deepStrictEqual(Array.from(snapshot.room.combatEvent.damageRolls), [1, 2, 3, 4], 'base and three bonus dice must retain four independent visible values');
  assert.strictEqual(snapshot.room.combatEvent.baseDamageRollCount, 1, 'the renderer must know where bonus dice begin');
  assert.strictEqual(snapshot.room.combatEvent.bonusDieSides, 6, 'bonus dice preserve their own geometry');
  const expectedVisibleDamage = snapshot.room.combatEvent.damageRolls.reduce((sum, value) => sum + value, 0)
    + Number(snapshot.room.combatEvent.damageStatBonus || 0)
    + Number(snapshot.room.combatEvent.damageStatusBonus || 0);
  assert.strictEqual(snapshot.room.combatEvent.damage, expectedVisibleDamage, 'damage is the sum of every visible die plus explicit flat bonuses, not one die multiplied');
  const restoredEnemyEntry = shared.data.rooms[roomCode].combat.order.find((entry) => entry.key === enemyKey);
  restoredEnemyEntry.hp = 3;
  delete restoredEnemyEntry.zeroHp;
  const restoredEnemyToken = shared.data.rooms[roomCode].scene.tokens.find((token) => token.id === enemyTokenId);
  restoredEnemyToken.hp = 3;
  delete restoredEnemyToken.zeroHp;

  const afterPlayerDamage = restoredEnemyEntry.hp;
  snapshot = await player.advanceCombat({ operationId:'player-turn-1' });
  assert.strictEqual(snapshot.room.combat.turnIndex, 1, 'player can finish their own turn');
  const duplicateTurn = await player.advanceCombat({ operationId:'player-turn-1' });
  assert.strictEqual(duplicateTurn.room.combat.turnIndex, 1, 'retry cannot advance the turn twice');
  await expectCode(
    () => player.advanceCombat({ operationId:'player-illegal-turn' }),
    'turn-owner-only'
  );

  snapshot = await master.useCombatAction('short', enemyKey);
  assert.strictEqual(snapshot.room.combatEvent.actionType, 'short');
  assert.match(snapshot.room.combatEvent.text, /короткое действие/i, 'a short action must end with visible combat feedback');
  assert.strictEqual(snapshot.room.combat.order[1].economy.short, 0, 'the selected short action is consumed exactly once');
  await expectCode(() => master.useCombatAction('short', enemyKey), 'combat-action-spent');

  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    weaponId:'enemy-claw',
    statKey:'str',
    masteryBonus:0,
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.hit, true);
  snapshot = await master.resolveCombatDamage(`member:${playerUid}`, {
    weaponId:'enemy-claw',
    statKey:'str'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.damage, 4, 'an explicit +1 in a creature formula must not add Strength a second time');
  assert.strictEqual(snapshot.room.combat.order[0].tempHp, 0, 'temporary HP absorbs creature damage first');
  assert.strictEqual(snapshot.room.combat.order[0].hp, 12, 'remaining creature damage reaches hero HP');
  assert.strictEqual(
    snapshot.room.members[playerUid].character.hpCur,
    snapshot.room.combat.order[0].hp,
    'combat damage must update the player character'
  );

  shared.data.rooms[roomCode].combat.order[1].economy.long = 1;
  const hpBeforeRangedMiss = shared.data.rooms[roomCode].combat.order[0].hp;
  queueDeterministicRandom(0);
  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    operationId:'two-client-ranged-miss',
    weaponId:'enemy-bow',
    statKey:'dex',
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.hit, false, 'a natural 1 must finish as an explicit miss');
  assert.ok(snapshot.room.combatEvent.rangeCells > 1, 'the ranged miss keeps its projectile presentation contract');
  assert.ok(!snapshot.room.combat.pendingDamage, 'a miss must not open the damage-roll phase');
  assert.strictEqual(snapshot.room.combat.order[0].hp, hpBeforeRangedMiss, 'a miss cannot mutate HP');
  const rangedMissEventId = snapshot.room.combatEvent.id;
  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    operationId:'two-client-ranged-miss',
    weaponId:'enemy-bow',
    statKey:'dex',
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.id, rangedMissEventId, 'retrying a ranged miss keeps one result event');
  assert.ok(!snapshot.room.combat.pendingDamage, 'retrying a miss still cannot create pending damage');

  shared.data.rooms[roomCode].combat.order[1].economy.long = 1;
  queueDeterministicRandom(0.999999);
  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    operationId:'two-client-critical-hit',
    weaponId:'enemy-claw',
    statKey:'str',
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.kind, 'combat-critical', 'a natural 20 has one explicit critical result');
  assert.strictEqual(snapshot.room.combatEvent.critical, true);
  assert.strictEqual(snapshot.room.combat.pendingDamage.critical, true, 'the separate damage phase inherits the critical flag');
  const criticalEventId = snapshot.room.combatEvent.id;
  const criticalPendingId = snapshot.room.combat.pendingDamage.id;
  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    operationId:'two-client-critical-hit',
    weaponId:'enemy-claw',
    statKey:'str',
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.id, criticalEventId, 'retrying a critical cannot emit a second result');
  assert.strictEqual(snapshot.room.combat.pendingDamage.id, criticalPendingId, 'retrying a critical preserves one damage handoff');
  snapshot = await master.configurePendingCombatDamage({ cancel:true });
  assert.ok(!snapshot.room.combat.pendingDamage, 'the test critical can be cancelled without applying HP');

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',statusKey:'poison',label:'Отравлен',enable:true,
    effect:{ durationUnit:'rounds',durationValue:1,tickType:'damage',tickValue:1 }
  });
  snapshot = await master.advanceCombat({ operationId:'enemy-turn-1' });
  assert.strictEqual(snapshot.room.combat.round, 2);
  assert.strictEqual(snapshot.room.combat.turnIndex, 0);
  assert.strictEqual(snapshot.room.combat.order[0].economy.long, 1, 'the player receives a fresh long action at the start of the next turn');
  assert.strictEqual(snapshot.room.combat.order[0].economy.short, 1, 'the player receives a fresh short action at the start of the next turn');
  assert.strictEqual(snapshot.room.combatEvent.statusTicks.length, 1, 'authoritative turn event exposes one structured status impact');
  assert.strictEqual(snapshot.room.combatEvent.statusTicks[0].statusKey, 'poison');
  assert.strictEqual(snapshot.room.combatEvent.targetKey, `member:${playerUid}`);
  assert.strictEqual(snapshot.room.combatEvent.beforeHp, 12, 'presentation event preserves HP until its reveal boundary');
  assert.ok(snapshot.room.combatEvent.revealAt > snapshot.room.combatEvent.ts);
  assert.strictEqual(snapshot.room.combat.order[0].hp, 11, 'status damage is committed once in authoritative combat state');
  assert.strictEqual(snapshot.room.combat.order[1].statusEffects[0].remainingRounds, 1, 'round status duration must decrease at the end of the affected turn');

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'silence',
    label:'Немота',
    enable:true,
    effect:{ durationUnit:'rounds', durationValue:1, icon:'🔇' }
  });
  await expectCode(() => player.requestAction('Пытается колдовать под немотой', 'ability', '', {
    operationId:'two-client-spell-silenced',
    key:'spell-two-client-silenced',
    sourceId:'spell-two-client-silenced',
    name:'Запрещённая искра',
    kind:'spell',
    actionCost:'short',
    resolutionMode:'automatic',
    rangeCells:10,
    targetCount:1,
    damageFormula:'1d4',
    targetMode:'target',
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey }
  }), 'combat-status-blocked');
  assert.notStrictEqual(String(shared.data.rooms[roomCode].members[playerUid].actionRequest&&shared.data.rooms[roomCode].members[playerUid].actionRequest.id||''),'two-client-spell-silenced','silence rejects the spell before creating a stale GM request');
  await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'silence',
    label:'Немота',
    enable:false
  });

  snapshot = await player.requestAction('Применяет восстановление', 'ability', '', {
    operationId:'two-client-spell-heal',
    key:'spell-two-client-heal',
    sourceId:'spell-two-client-heal',
    name:'Восстановление',
    kind:'spell',
    actionCost:'short',
    resolutionMode:'automatic',
    rangeCells:0,
    targetCount:1,
    healFormula:'1d4',
    targetMode:'self',
    resourceKey:'spell-two-client-heal',
    resourceMax:2,
    targeting:{ mode:'self', targetKey:heroKey }
  });
  const healRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.resolveCombatAbility(playerUid, [heroKey], {});
  assert.strictEqual(snapshot.room.combatEvent.heal, 3);
  assert.strictEqual(snapshot.room.combat.order[0].hp, 14, 'approved healing spell must synchronize hero HP');
  await player.acknowledgeAction(healRequestId);

  snapshot = await player.requestAction('Поддерживает испытательное поле', 'ability', '', {
    operationId:'two-client-spell-concentration',
    key:'spell-two-client-concentration',
    sourceId:'spell-two-client-concentration',
    name:'Испытательное поле',
    kind:'spell',
    actionCost:'free',
    resolutionMode:'utility',
    rangeCells:10,
    targetCount:1,
    targetMode:'target',
    durationRounds:2,
    concentration:true,
    statuses:['vulnerable'],
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey }
  });
  const concentrationRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.resolveCombatAbility(playerUid, [enemyKey], {});
  assert.strictEqual(snapshot.room.combat.order[0].concentration.name, 'Испытательное поле');
  assert.ok(snapshot.room.combat.order[1].statuses.includes('vulnerable'), 'a utility concentration spell must produce a visible applied effect');
  assert.match(snapshot.room.combatEvent.text, /эффект применён/i, 'a utility spell cannot finish with an empty result');
  await player.acknowledgeAction(concentrationRequestId);
  snapshot = await player.stopCombatConcentration(heroKey);
  assert.strictEqual(snapshot.room.combat.order[0].concentration, null);
  assert.ok(!snapshot.room.combat.order[1].statuses.includes('vulnerable'), 'stopping concentration removes only its sourced effect');
  assert.match(snapshot.room.combatEvent.text, /Испытательное поле/, 'concentration completion keeps the spell name after clearing state');
  await expectCode(() => player.stopCombatConcentration(heroKey), 'combat-concentration-missing');

  const tokensBeforeSummon = snapshot.room.scene.tokens.length;
  snapshot = await player.requestAction('Призывает испытательного спутника', 'ability', '', {
    operationId:'two-client-spell-summon',
    key:'spell-two-client-summon',
    sourceId:'spell-two-client-summon',
    name:'Испытательный спутник',
    kind:'spell',
    effectKind:'summon',
    actionCost:'free',
    resolutionMode:'utility',
    rangeCells:6,
    targetCount:1,
    targetMode:'target',
    targeting:{ mode:'point', x:54, y:53, distanceCells:2 }
  });
  const summonRequestId = snapshot.room.members[playerUid].actionRequest.id;
  snapshot = await master.resolveCombatAbility(playerUid, [heroKey], {});
  assert.strictEqual(snapshot.room.combatEvent.effectKind, 'summon');
  assert.deepStrictEqual(snapshot.room.combatEvent.summonPoint, { x:54, y:53 });
  assert.strictEqual(snapshot.room.scene.tokens.length, tokensBeforeSummon + 1, 'an approved summon creates one GM-owned scene placeholder');
  const summonToken = snapshot.room.scene.tokens.find((token) => token && token.id === snapshot.room.combatEvent.summonToken.id);
  assert.ok(summonToken, 'both clients receive the summoned scene placeholder');
  assert.strictEqual(summonToken.disposition, 'ally');
  assert.strictEqual(summonToken.name, 'Призыв · Испытательный спутник');
  assert.strictEqual(summonToken.x, 54);
  assert.strictEqual(summonToken.y, 53);
  assert.match(snapshot.room.combatEvent.text, /Точка призыва отмечена/, 'summoning cannot end in an empty utility result');
  await player.acknowledgeAction(summonRequestId);

  const orderBeforeSummonJoin = snapshot.room.combat.order.map((entry) => ({ key:entry.key, total:entry.total }));
  const turnBeforeSummonJoin = snapshot.room.combat.turnIndex;
  const roundBeforeSummonJoin = snapshot.room.combat.round;
  const linkedSummonToken = Object.assign({}, summonToken, {
    name:'Испытательный фамильяр',
    sourceRef:{ type:'beast', id:'beast-test-familiar', name:'Испытательный фамильяр', revision:1 },
    hp:7,
    hpMax:7,
    ac:11,
    initiative:3,
    speed:5,
    weaponProfiles:[{ id:'bite', name:'Укус', damageFormula:'1d4', damageType:'Колющий' }]
  });
  await expectCode(() => master.addCombatParticipant(summonToken), 'combat-participant-source-required');
  await expectCode(() => player.addCombatParticipant(linkedSummonToken), 'master-only');
  const simultaneousSummonJoins = await Promise.allSettled([
    master.addCombatParticipant(linkedSummonToken),
    master.addCombatParticipant(linkedSummonToken)
  ]);
  assert.strictEqual(simultaneousSummonJoins.filter((result) => result.status === 'fulfilled').length, 1, 'two GM tabs can commit the summoned participant only once');
  assert.strictEqual(simultaneousSummonJoins.filter((result) => result.status === 'rejected' && result.reason && result.reason.code === 'combat-participant-exists').length, 1, 'the racing GM tab receives an exactly-once rejection');
  snapshot = simultaneousSummonJoins.find((result) => result.status === 'fulfilled').value;
  assert.strictEqual(snapshot.room.combat.order.length, orderBeforeSummonJoin.length + 1, 'a linked summon joins the active combat exactly once');
  assert.deepStrictEqual(snapshot.room.combat.order.slice(0, orderBeforeSummonJoin.length).map((entry) => ({ key:entry.key, total:entry.total })), orderBeforeSummonJoin, 'joining must not reroll or reorder existing initiative');
  assert.strictEqual(snapshot.room.combat.turnIndex, turnBeforeSummonJoin, 'joining must not move the active turn cursor');
  assert.strictEqual(snapshot.room.combat.round, roundBeforeSummonJoin, 'joining must not reset the current round');
  const joinedSummon = snapshot.room.combat.order[snapshot.room.combat.order.length - 1];
  assert.strictEqual(joinedSummon.tokenId, summonToken.id);
  assert.strictEqual(joinedSummon.hp, 7);
  assert.strictEqual(joinedSummon.economy.movementMax, 5);
  assert.match(snapshot.room.combatEvent.text, /в конце текущей очереди/i, 'joining has an explicit visible terminal event');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === summonToken.id).sourceRef.id, 'beast-test-familiar', 'linking and joining publish the same source-backed token atomically');
  await expectCode(() => master.addCombatParticipant(linkedSummonToken), 'combat-participant-exists');

  const longBeforePrepare = snapshot.room.combat.order[0].economy.long;
  snapshot = await player.prepareCombatReaction({
    triggerKind:'enemy-in-range',
    triggerText:'Враг входит в дальность',
    actionKind:'custom',
    actionText:'Отступить к двери',
    detail:'Когда враг приблизится — отступаю к двери'
  }, heroKey);
  const prepareRequestId = snapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.actionKind, 'combat-prepare');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.stage, 'pending-gm');
  assert.strictEqual(snapshot.room.combat.order[0].economy.long, longBeforePrepare, 'submitting preparation does not spend an action before GM approval');
  assert.ok(!snapshot.room.combat.order[0].preparedReaction, 'unapproved preparation does not enter the combat order');
  snapshot = await master.resolveAction(playerUid, true);
  assert.strictEqual(snapshot.room.combat.order[0].economy.long, longBeforePrepare - 1, 'GM approval consumes one long action exactly once');
  assert.strictEqual(snapshot.room.combat.order[0].preparedReaction.triggerKind, 'enemy-in-range');
  assert.strictEqual(snapshot.room.members[playerUid].actionRequest.stage, 'prepared');
  const preparedEventId = snapshot.room.combatEvent.id;
  await expectCode(() => master.resolveAction(playerUid, true), 'request-missing');
  assert.strictEqual(shared.data.rooms[roomCode].combat.order[0].economy.long, longBeforePrepare - 1, 'repeated approval cannot consume the action twice');
  snapshot = await player.acknowledgeAction(prepareRequestId);
  snapshot = await master.triggerPreparedReaction(heroKey);
  assert.strictEqual(snapshot.room.combat.order[0].economy.reaction, 0, 'triggering consumes one reaction');
  assert.strictEqual(snapshot.room.combat.order[0].preparedReaction, null, 'triggering clears the pending prepared action');
  assert.match(snapshot.room.combatEvent.text, /Срабатывает подготовленная реакция/, 'triggering has an explicit visible terminal event');
  assert.notStrictEqual(snapshot.room.combatEvent.id, preparedEventId, 'rapid prepare and trigger events require distinct playback ids');
  await expectCode(() => master.triggerPreparedReaction(heroKey), 'combat-reaction-missing');

  shared.data.rooms[roomCode].combat.order[0].economy.reaction = 1;
  snapshot = await master.requestCombatReaction(playerUid, {
    actionKind:'defense', actionText:'Закрыться щитом', targetKey:heroKey, targetName:'Тестовый герой'
  });
  const declinedReactionId = snapshot.room.members[playerUid].reactionRequest.id;
  assert.strictEqual(snapshot.room.combat.order[0].economy.reaction, 1, 'the GM prompt does not spend a reaction before the player answers');
  snapshot = await player.answerCombatReaction(declinedReactionId, false);
  assert.strictEqual(snapshot.room.combat.order[0].economy.reaction, 1, 'declining does not spend the reaction');
  assert.ok(!snapshot.room.combat.pendingReactionAction, 'declining does not create a manual resolution handoff');
  snapshot = await player.acknowledgeCombatReaction(declinedReactionId);
  assert.ok(!snapshot.room.members[playerUid].reactionRequest, 'the declined prompt clears only after player acknowledgement');

  snapshot = await master.requestCombatReaction(playerUid, {
    actionKind:'defense', actionText:'Отразить летящие обломки', targetKey:heroKey, targetName:'Тестовый герой'
  });
  const acceptedReactionId = snapshot.room.members[playerUid].reactionRequest.id;
  snapshot = await master.answerCombatReaction(acceptedReactionId, true, playerUid);
  const pendingReactionId = snapshot.room.combat.pendingReactionAction.id;
  assert.strictEqual(snapshot.room.combat.order[0].economy.reaction, 0, 'accepting spends the reaction exactly once');
  snapshot = await player.answerCombatReaction(acceptedReactionId, true);
  assert.strictEqual(snapshot.room.combat.order[0].economy.reaction, 0, 'replaying the accepted answer cannot spend a second reaction');
  assert.strictEqual(snapshot.room.combat.pendingReactionAction.id, pendingReactionId, 'replaying the answer preserves one resolution handoff');
  snapshot = await master.finishPendingReaction(pendingReactionId, 'Защита разыграна вручную');
  assert.ok(!snapshot.room.combat.pendingReactionAction, 'the GM explicitly closes the accepted reaction');
  await expectCode(() => master.finishPendingReaction(pendingReactionId, ''), 'combat-reaction-resolution-missing');
  snapshot = await master.acknowledgeCombatReaction(acceptedReactionId, playerUid);
  assert.ok(!snapshot.room.members[playerUid].reactionRequest, 'the accepted prompt clears after the result is visible to the player');

  snapshot = await player.advanceCombat({ operationId:'player-turn-2' });
  assert.strictEqual(snapshot.room.combat.turnIndex, 1, 'player can finish a later turn after receiving damage');
  assert.strictEqual(snapshot.room.combat.order[1].hp, afterPlayerDamage, 'turn changes do not reset enemy HP');

  snapshot = await player.requestAction('Готовит заклинание до смертельного удара', 'ability', '', {
    operationId:'two-client-spell-before-zero-hp',
    key:'spell-two-client-before-zero-hp',
    sourceId:'spell-two-client-before-zero-hp',
    name:'Отложенная искра',
    kind:'spell',
    actionCost:'short',
    resolutionMode:'automatic',
    rangeCells:10,
    targetCount:1,
    damageFormula:'1d4',
    targetMode:'target',
    targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey }
  });
  const beforeZeroHpRequestId = snapshot.room.members[playerUid].actionRequest.id;

  snapshot = await master.resolveCombatAttack(`member:${playerUid}`, {
    weaponId:'enemy-finisher',
    statKey:'str',
    masteryBonus:0,
    mode:'normal'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combatEvent.hit, true);
  snapshot = await master.resolveCombatDamage(`member:${playerUid}`, {
    weaponId:'enemy-finisher',
    statKey:'str'
  }, `token:${enemyTokenId}`);
  assert.strictEqual(snapshot.room.combat.order[0].hp, 0, 'lethal damage must clamp HP to zero');
  assert.strictEqual(snapshot.room.members[playerUid].character.hpCur, 0, 'zero HP must synchronize to the character');
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.pending, true, 'zero HP must create the pending death-state decision');

  snapshot = await master.advanceCombat({ operationId:'enemy-turn-2' });
  assert.strictEqual(snapshot.room.combat.round, 2);
  assert.strictEqual(snapshot.room.combat.turnIndex, 2, 'the joined summon receives its appended turn without disturbing earlier actors');
  snapshot = await master.advanceCombat({ operationId:'summon-turn-2' });
  assert.strictEqual(snapshot.room.combat.round, 3);
  assert.strictEqual(snapshot.room.combat.turnIndex, 0);
  assert.ok(!snapshot.room.combat.order[1].statuses.includes('marked'), 'expired round status must be removed');
  await expectCode(
    () => player.advanceCombat({ operationId:'zero-hp-before-death-save' }),
    'death-save-required'
  );
  snapshot = await player.rollDeathSave(heroKey);
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.lastRoll, 2, 'death coin is tossed only after the player presses the control');
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.successes, 1);
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.failures, 0);
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.lastRollRound, 3);
  assert.strictEqual(snapshot.room.members[playerUid].character.deathSaves.successes, 1, 'death-save progress must synchronize to the character and GM client');
  assert.strictEqual(snapshot.room.combatEvent.kind, 'death-save');
  await expectCode(() => player.rollDeathSave(heroKey), 'death-save-already-rolled');
  await expectCode(() => master.resolveCombatAbility(playerUid, [enemyKey], {}), 'combat-zero-hp');
  await master.resolveAction(playerUid, false, {});
  await player.acknowledgeAction(beforeZeroHpRequestId);

  await expectCode(
    () => player.requestMovement(50, 50, { x:49, y:50, tokenId:'hero-player-1' }),
    'hero-incapacitated'
  );
  await expectCode(
    () => player.requestAction('Пытается колдовать при нуле HP', 'ability', '', {
      operationId:'two-client-spell-zero-hp',
      key:'spell-two-client-zero-hp',
      sourceId:'spell-two-client-zero-hp',
      name:'Искра при нуле HP',
      kind:'spell',
      actionCost:'short',
      resolutionMode:'automatic',
      rangeCells:10,
      targetCount:1,
      damageFormula:'1d4',
      targetMode:'target',
      targeting:{ mode:'token', tokenId:enemyTokenId, targetKey:enemyKey }
    }),
    'hero-incapacitated'
  );
  await expectCode(
    () => master.resolveCombatAttack(`token:${enemyTokenId}`, {
      weaponId:'hero-blade',
      statKey:'str',
      mode:'normal'
    }, `member:${playerUid}`),
    'combat-zero-hp'
  );
  snapshot = await player.advanceCombat({ operationId:'zero-hp-pass-turn' });
  assert.strictEqual(snapshot.room.combat.turnIndex, 1, 'a zero-HP player can still pass the turn');

  snapshot = await master.gmAdjustEntity({ tokenId:enemyTokenId }, { kind:'life-state', state:'dead' });
  assert.strictEqual(snapshot.room.combat.order[1].zeroHp.state, 'dead', 'GM can explicitly mark a creature corpse during combat');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === enemyTokenId).zeroHp.state, 'dead', 'corpse state reaches the scene token before combat ends');

  await expectCode(() => player.endCombat(), 'master-only');
  snapshot = await master.endCombat();
  assert.ok(snapshot.room.combat == null, 'only the master ends combat');
  assert.strictEqual(snapshot.room.scene.tokens.find((token) => token.id === enemyTokenId).zeroHp.state, 'dead', 'corpse state survives combat deletion');
  assert.strictEqual(snapshot.room.members[playerUid].character.deathSaves.successes, 1, 'hero death-save progress survives combat deletion');
  await expectCode(() => master.addCombatParticipant(linkedSummonToken), 'combat-missing');
  assert.ok(shared.data.rooms[roomCode].combat == null, 'a late summon join cannot recreate a partial combat after it ended');

  assert.ok(shared.writes.some((write) => write.uid === playerUid), 'the player client performed Firebase writes');
  assert.ok(shared.writes.some((write) => write.uid === masterUid), 'the master client performed Firebase writes');

  const intentRoomCode = 'INTENT1';
  const intentShared = createSharedFirebase({rooms:{[intentRoomCode]:{
    code:intentRoomCode,phase:'session',masterUid,
    members:{
      [masterUid]:{uid:masterUid,role:'master',name:'ГМ'},
      [playerUid]:{uid:playerUid,role:'player',name:'Игрок',character:{id:'intent-hero',name:'Испытатель намерений',hpCur:12,hpMax:12,stats:{str:2,dex:1,int:0,cha:0,per:0,con:1},statuses:[],statusEffects:[]}}
    },
    combat:{active:true,phase:'combat',round:1,turnIndex:0,order:[
      {key:'member:'+playerUid,uid:playerUid,name:'Испытатель намерений',hp:12,hpMax:12,stats:{str:2,dex:1},economy:{long:1,short:1,reaction:1,movement:7,movementMax:7}},
      {key:'token:intent-enemy',tokenId:'intent-enemy',name:'Манекен',hp:10,hpMax:10,stats:{str:0,dex:0},economy:{long:1,short:1,reaction:1,movement:7,movementMax:7}}
    ]},updatedAt:1
  }}});
  const intentMaster = createClient(intentShared, masterUid, 'master', intentRoomCode);
  const intentPlayer = createClient(intentShared, playerUid, 'player', intentRoomCode);
  let intentSnapshot = await intentPlayer.requestAction('Хочет сбить манекен с ног', 'combat-intent', '', {
    intentKind:'prone',intentLabel:'Сбить с ног',targetKey:'token:intent-enemy',targetName:'Манекен',detail:'Подсечка'
  });
  const intentRequestId = intentSnapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'pending', 'short action reaches the GM as a pending request');
  intentSnapshot = await intentMaster.configureCombatIntent(playerUid, {mode:'contest',actorStat:'str',targetStat:'dex'});
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'roll-requested', 'GM decision reaches the player as a roll request');
  assert.strictEqual(intentSnapshot.room.combat.order[0].economy.short, 0, 'short-action economy is consumed exactly when the GM requests the roll');
  queueDeterministicRandom(0.8, 0.2);
  intentSnapshot = await intentMaster.rollCombatIntent(intentRequestId, playerUid);
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'roll-result', 'the player result returns to the GM');
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.result.success, true);
  intentSnapshot = await intentMaster.finishCombatIntent(playerUid, true);
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'approved', 'the GM can finish the short action after its roll');
  assert.strictEqual(intentSnapshot.room.combatEvent.kind, 'combat-intent-applied', 'the flow ends with a visible combat event');
  delete intentShared.data.rooms[intentRoomCode].members[playerUid].actionRequest;
  delete intentShared.data.rooms[intentRoomCode].combat.order[0].uid;
  intentSnapshot = await intentMaster.requestCombatSavingThrow('member:'+playerUid, {
    statKey:'dex', dc:14, bonus:1, mode:'advantage'
  });
  const savingThrowRequestId = intentSnapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'roll-requested', 'the GM saving throw reaches the player as a roll request');
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.resolution.statKey, 'dex', 'the saving throw preserves the selected characteristic');
  queueDeterministicRandom(0.2, 0.8);
  intentSnapshot = await intentPlayer.rollCombatSavingThrow(savingThrowRequestId);
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.status, 'resolved', 'the real player client resolves its assigned saving throw');
  assert.deepStrictEqual(Array.from(intentSnapshot.room.members[playerUid].actionRequest.result.saveRolls), [5, 17], 'advantage uses both player d20 rolls');
  assert.strictEqual(intentSnapshot.room.members[playerUid].actionRequest.result.total, 19, 'the assigned stat and bonus are included exactly once');
  assert.strictEqual(intentSnapshot.room.combatEvent.kind, 'combat-save-success', 'the saving throw publishes one visible combat result');
  const savingThrowEventId = intentSnapshot.room.combatEvent.id;
  await expectCode(() => intentPlayer.rollCombatSavingThrow(savingThrowRequestId), 'request-missing');
  assert.strictEqual(intentShared.data.rooms[intentRoomCode].combatEvent.id, savingThrowEventId, 'a repeated click cannot publish or apply the same saving throw twice');
  intentShared.data.rooms[intentRoomCode].combat.order[0].uid = playerUid;
  intentSnapshot = await intentMaster.prepareCombatReaction({
    triggerKind:'attacked',triggerText:'Меня атакуют',actionKind:'custom',actionText:'Уклониться',detail:'Подготовка мастером для текущего участника'
  }, 'member:'+playerUid);
  assert.strictEqual(intentSnapshot.room.combat.order[0].preparedReaction.triggerKind, 'attacked', 'the GM can directly prepare the current actor reaction without sending a request to himself');
  assert.strictEqual(intentSnapshot.room.combat.order[0].economy.long, 0, 'GM preparation consumes the current actor long action exactly once');
  intentSnapshot = await intentMaster.useMasterCombatReaction('token:intent-enemy', {actionKind:'defense',actionText:'Закрыться щитом',targetKey:'member:'+playerUid,targetName:'Испытатель намерений'});
  assert.strictEqual(intentSnapshot.room.combat.order[1].economy.reaction, 0, 'a GM creature spends its own reaction immediately');
  assert.strictEqual(intentSnapshot.room.combat.pendingReactionAction.participantKey, 'token:intent-enemy', 'the GM creature reaction remains visible until its manual effect is resolved');
  intentSnapshot = await intentMaster.finishPendingReaction(intentSnapshot.room.combat.pendingReactionAction.id, 'Защита учтена');
  assert.strictEqual(intentSnapshot.room.combat.pendingReactionAction, null, 'the GM can explicitly finish its creature reaction');

  const spellRoomCode = 'SPELLS1';
  const spellHeroKey = `member:${playerUid}`;
  const spellEnemyAKey = 'token:spell-enemy-a';
  const spellEnemyBKey = 'token:spell-enemy-b';
  const reviewedSpellIds = spellAutomation.catalog().map((profile) => String(profile.catalogId));
  const reviewedCatalogEntries = new Map(catalogEntries.filter((entry) => reviewedSpellIds.includes(String(entry.id))).map((entry) => [String(entry.id), entry]));
  const reviewedLearnedSpells = Object.fromEntries(reviewedSpellIds.map((spellId) => [spellId, false]));
  assert.strictEqual(reviewedCatalogEntries.size, reviewedSpellIds.length, 'all automated spell profiles resolve to real catalog entries');
  const spellShared = createSharedFirebase({rooms:{[spellRoomCode]:{
    code:spellRoomCode,phase:'session',masterUid,
    members:{
      [masterUid]:{uid:masterUid,role:'master',name:'ГМ'},
      [playerUid]:{uid:playerUid,role:'player',name:'Игрок',characterId:'spell-hero',character:{
        id:'spell-hero',name:'Арканист',hpCur:12,hpMax:16,ac:12,stats:{str:0,dex:1,int:2,cha:1,per:0,con:1},
        weaponProfiles:[
          {id:'spell-hero-blade',name:'Учебный двуручный меч',damageFormula:'1d6',damageType:'Рубящий',range:'1 клетка',stat:'str',slot:'mainHand',handsRequired:2},
          {id:'spell-hero-crossbow',name:'Учебный арбалет',nameUk:'Навчальний арбалет',damageFormula:'1d8',damageType:'Колющий',range:'8 клеток',stat:'dex',slot:'ranged',handsRequired:2,family:'crossbow'}
        ],
        spellRefs:reviewedSpellIds,spellsLearned:reviewedLearnedSpells,preparedSpells:{kodex:[],folio:[],obrad:[]},
        abilityUsage:{},statuses:[],statusEffects:[]
      }}
    },
    scene:{boardWidth:32,boardHeight:20,tokens:[
      {id:'spell-hero-token',type:'hero',memberUid:playerUid,disposition:'ally',name:'Арканист',x:20,y:50,hp:12,hpMax:16,ac:12,statuses:[],statusEffects:[]},
      {id:'spell-ally',type:'custom',disposition:'ally',name:'Союзный разведчик',nameUk:'Союзний розвідник',x:22,y:55,hp:4,hpMax:20,ac:11,stats:{str:1,dex:2,con:1},statuses:[],statusEffects:[]},
      {id:'spell-enemy-a',type:'custom',disposition:'enemy',name:'Латник',x:23,y:50,hp:30,hpMax:30,ac:10,stats:{str:0,dex:0},statuses:[],statusEffects:[]},
      {id:'spell-enemy-b',type:'custom',disposition:'enemy',name:'Ловкач',x:38,y:50,hp:30,hpMax:30,ac:12,stats:{str:1,dex:0},statuses:[],statusEffects:[]}
    ]},
    zones:{},
    combat:{active:true,phase:'combat',round:1,turnIndex:0,battleStartedAt:1787904000000,order:[
      {key:spellHeroKey,uid:playerUid,tokenId:'spell-hero-token',kind:'hero',name:'Арканист',hp:12,hpMax:16,ac:12,stats:{str:0,dex:1,int:2,cha:1,per:0,con:1},weaponProfiles:[
        {id:'spell-hero-blade',name:'Учебный двуручный меч',damageFormula:'1d6',damageType:'Рубящий',range:'1 клетка',stat:'str',slot:'mainHand',handsRequired:2},
        {id:'spell-hero-crossbow',name:'Учебный арбалет',nameUk:'Навчальний арбалет',damageFormula:'1d8',damageType:'Колющий',range:'8 клеток',stat:'dex',slot:'ranged',handsRequired:2,family:'crossbow'}
      ],statuses:[],statusEffects:[],economy:{long:1,short:1,reaction:1,movement:6,movementMax:6}},
      {key:'token:spell-ally',tokenId:'spell-ally',kind:'ally',name:'Союзный разведчик',nameUk:'Союзний розвідник',hp:4,hpMax:20,ac:11,stats:{str:1,dex:2,con:1},statuses:[],statusEffects:[],economy:{long:1,short:1,reaction:1,movement:6,movementMax:6}},
      {key:spellEnemyAKey,tokenId:'spell-enemy-a',kind:'enemy',name:'Латник',hp:30,hpMax:30,ac:10,stats:{str:0,dex:0},statuses:[],statusEffects:[],economy:{long:1,short:1,reaction:1,movement:5,movementMax:5}},
      {key:spellEnemyBKey,tokenId:'spell-enemy-b',kind:'enemy',name:'Ловкач',hp:30,hpMax:30,ac:12,stats:{str:1,dex:0},statuses:[],statusEffects:[],economy:{long:1,short:1,reaction:1,movement:6,movementMax:6}}
    ]},updatedAt:1
  }}});
  const spellMaster = createClient(spellShared, masterUid, 'master', spellRoomCode);
  const spellPlayer = createClient(spellShared, playerUid, 'player', spellRoomCode);
  let reviewedSpellCastIndex = 0;
  const reviewedPlayerCasts = new Set();
  const reviewedLearningApprovals = new Set();
  const reviewedPlayerPreparations = new Set();
  function reviewedSpellDetails(automationKey, overrides) {
    const profile = spellAutomation.catalog().find((item) => item.automationKey === automationKey);
    assert.ok(profile, `reviewed profile ${automationKey} exists`);
    return Object.assign({}, profile, {
      key:`spell-${profile.catalogId}`,
      sourceId:profile.catalogId,
      resourceKey:`spell-${profile.catalogId}`,
      resourceMax:profile.maxUses,
      resourceUsed:0,
      operationId:`reviewed-${profile.automationKey}`,
      playbackMode:'instant'
    }, overrides || {});
  }
  async function learnReviewedSpell(profile) {
    const spellId = String(profile.catalogId);
    const catalogEntry = reviewedCatalogEntries.get(spellId);
    assert.ok(catalogEntry, `${profile.automationKey} has a real catalog learning record`);
    const currentCharacter = spellShared.data.rooms[spellRoomCode].members[playerUid].character;
    if (currentCharacter.spellsLearned && currentCharacter.spellsLearned[spellId] === true) return;
    const successesRequired = Math.max(1, Number(profile.learningPlan && profile.learningPlan.checks && profile.learningPlan.checks[0] && profile.learningPlan.checks[0].successesRequired) || 1);
    let next;
    for (let attempt = 1; attempt <= successesRequired; attempt += 1) {
      next = await spellPlayer.requestAction(`Хочет изучить «${profile.name}»`, 'spell-learning', '', {
        spellId,
        name:profile.name,
        nameUk:profile.nameUk,
        learnType:catalogEntry.learnType,
        learnText:catalogEntry.learnText
      });
      const request = next.room.members[playerUid].actionRequest;
      assert.strictEqual(request.actionKind, 'spell-learning', `${profile.automationKey} uses the legacy player learning request`);
      assert.strictEqual(request.status, 'pending', `${profile.automationKey} waits for the GM decision`);
      assert.strictEqual(request.learning.spellId, spellId, `${profile.automationKey} keeps the selected catalog spell id`);
      assert.strictEqual(request.testByMaster, false, `${profile.automationKey} learning is submitted by the player rather than forged by the GM`);
      next = await spellMaster.resolveAction(playerUid, true);
      assert.strictEqual(next.room.members[playerUid].actionRequest.status, 'learning-roll-ready', `${profile.automationKey} receives a real learning check after GM approval`);
      if (attempt > 1 && profile.learningPlan.retry && profile.learningPlan.retry.kind === 'break') {
        assert.ok(next.room.members[playerUid].actionRequest.learning.breakConfirmedAt, `${profile.automationKey} records the GM-confirmed break between checks`);
      }
      next = await spellPlayer.rollSpellLearning(request.id);
      let learningRequest = next.room.members[playerUid].actionRequest;
      if (learningRequest.status === 'learning-failure-choice') {
        const failure = learningRequest.learning.plan.failure || {};
        const selected = (failure.damageFormulaChoices || [])[0] || ((failure.consequenceChoices || [])[0] || {}).key;
        next = await spellMaster.prepareSpellLearningFailure(playerUid, selected);
        learningRequest = next.room.members[playerUid].actionRequest;
      }
      if (learningRequest.status === 'learning-failure-roll-ready') {
        next = await spellPlayer.rollSpellLearning(request.id);
        learningRequest = next.room.members[playerUid].actionRequest;
      }
      assert.ok(['learning-roll-result','learning-failure-result'].includes(learningRequest.status), `${profile.automationKey} records the learning roll before applying it`);
      next = await spellMaster.resolveSpellLearning(playerUid, {success:true});
      if (attempt < successesRequired) {
        assert.strictEqual(next.room.members[playerUid].actionRequest.status, 'learning-progress', `${profile.automationKey} keeps the first success as progress rather than learning early`);
        assert.strictEqual(next.room.members[playerUid].character.spellsLearned[spellId], false, `${profile.automationKey} still needs the remaining successful check`);
        assert.strictEqual(next.room.members[playerUid].character.spellLearningProgress[spellId].successCount, attempt);
        next = await spellPlayer.acknowledgeAction(request.id);
      } else {
        assert.strictEqual(next.room.members[playerUid].actionRequest.status, 'approved', `${profile.automationKey} receives the reviewed learning outcome`);
        await spellPlayer.acknowledgeAction(request.id);
      }
    }
    assert.strictEqual(next.room.members[playerUid].character.spellsLearned[spellId], true, `${profile.automationKey} becomes learned only after the staged check`);
    const approvalMessages = Object.values(next.room.members[playerUid].messages || {}).filter((message) => message && message.kind === 'action-approved' && String(message.text || '').includes('Заклинание изучено:') && String(message.text || '').includes(profile.name));
    assert.strictEqual(approvalMessages.length, 1, `${profile.automationKey} publishes one learning approval`);
    assert.strictEqual(spellShared.data.rooms[spellRoomCode].members[playerUid].actionRequest, undefined, `${profile.automationKey} learning request clears after player acknowledgement`);
    reviewedLearningApprovals.add(profile.automationKey);
  }
  async function prepareReviewedSpell(profile) {
    const spellId = String(profile.catalogId);
    const catalogEntry = reviewedCatalogEntries.get(spellId);
    const spellType = String(catalogEntry && catalogEntry.spellType || '');
    assert.ok(['kodex','folio','obrad'].includes(spellType), `${profile.automationKey} has a canonical preparation family`);
    const currentCharacter = clone(spellShared.data.rooms[spellRoomCode].members[playerUid].character);
    currentCharacter.preparedSpells = {kodex:[],folio:[],obrad:[]};
    currentCharacter.preparedSpells[spellType] = [spellId];
    const next = await spellPlayer.syncCharacter(currentCharacter, {reason:'spell-preparation',prepared:true});
    const roomCharacter = next.room.members[playerUid].character;
    assert.strictEqual(roomCharacter.spellsLearned[spellId], true, `${profile.automationKey} remains learned during player preparation sync`);
    assert.deepStrictEqual(Array.from(roomCharacter.preparedSpells[spellType]), [spellId], `${profile.automationKey} is prepared by the player in its real spell family`);
    reviewedPlayerPreparations.add(profile.automationKey);
  }
  async function readyReviewedSpell(profile) {
    await learnReviewedSpell(profile);
    const prepared = spellShared.data.rooms[spellRoomCode].members[playerUid].character.preparedSpells || {};
    if (!Object.values(prepared).some((ids) => Array.isArray(ids) && ids.map(String).includes(String(profile.catalogId)))) {
      await prepareReviewedSpell(profile);
    }
  }
  async function castReviewedSpell(automationKey, targetKeys, details, overrides, randomValues) {
    const profile = spellAutomation.catalog().find((item) => item.automationKey === automationKey);
    await readyReviewedSpell(profile);
    spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long = 1;
    spellShared.data.rooms[spellRoomCode].combat.order[0].economy.short = 1;
    deterministicRandomValues.length = 0;
    queueDeterministicRandom(...(randomValues || []));
    const ability = reviewedSpellDetails(automationKey, details);
    ability.operationId = `reviewed-${automationKey}-${++reviewedSpellCastIndex}`;
    let next = await spellPlayer.requestAction(`Применяет «${ability.name}»`, 'ability', '', ability);
    reviewedPlayerCasts.add(automationKey);
    const requestId = next.room.members[playerUid].actionRequest.id;
    assert.strictEqual(next.room.members[playerUid].actionRequest.testByMaster, false, `${automationKey} is submitted by the real player client`);
    if (automationKey === 'finger-heat-v1') {
      next = await spellMaster.prepareCombatAbilityRoll(playerUid, targetKeys[0], 'attack');
      next = await spellPlayer.rollCombatAbilityStage(requestId);
      if (next.room.members[playerUid].actionRequest.abilityResolution.attack.success) {
        next = await spellMaster.prepareCombatAbilityRoll(playerUid, targetKeys[0], 'damage');
        next = await spellPlayer.rollCombatAbilityStage(requestId);
      }
      const staged = next.room.members[playerUid].actionRequest.abilityResolution;
      const attack = staged.attack;
      const damage = staged.damage;
      overrides = Object.assign({}, overrides || {}, {approvedResults:[{
        key:targetKeys[0],roll:attack.roll,rolls:attack.rolls,rollMode:attack.rollMode,modifier:attack.modifier,total:attack.total,dc:attack.dc,
        success:attack.success,damage:damage && damage.damage || 0,damageRolls:damage && damage.rolls || [],statuses:[]
      }]});
    }
    next = await spellMaster.resolveCombatAbility(playerUid, targetKeys, overrides || {});
    await spellPlayer.acknowledgeAction(requestId);
    return next;
  }

  const fingerProfile = reviewedSpellDetails('finger-heat-v1', {
    actionCost:'free',damageFormula:'99d100',rangeCells:100,
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:1}
  });
  await expectCode(() => spellPlayer.requestAction('Пытается применить неизученное заклинание', 'ability', '', fingerProfile), 'spell-not-learned');
  const fingerCatalogProfile = spellAutomation.catalog().find((profile) => profile.automationKey === 'finger-heat-v1');
  await learnReviewedSpell(fingerCatalogProfile);
  await expectCode(() => spellPlayer.requestAction('Пытается применить неподготовленное заклинание', 'ability', '', fingerProfile), 'spell-not-prepared');
  await prepareReviewedSpell(fingerCatalogProfile);
  let canonicalSnapshot = await spellPlayer.requestAction('Проверяет канонический профиль «Жар Пальцев»', 'ability', '', fingerProfile);
  const canonicalRequest = canonicalSnapshot.room.members[playerUid].actionRequest;
  assert.strictEqual(canonicalRequest.ability.actionCost, 'long', 'the network restores the catalog action cost instead of trusting the browser');
  assert.strictEqual(canonicalRequest.ability.damageFormula, '1d6', 'the network restores the catalog damage formula instead of trusting the browser');
  assert.strictEqual(canonicalRequest.ability.rangeCells, 1, 'the network restores the reviewed catalog range');
  await spellMaster.resolveAction(playerUid, false);
  await spellPlayer.acknowledgeAction(canonicalRequest.id);

  const retaliationProfile = spellAutomation.catalog().find((profile) => profile.automationKey === 'retaliation-spike-v1');
  const retaliationCatalogEntry = reviewedCatalogEntries.get(String(retaliationProfile.catalogId));
  let retaliationLearning = await spellPlayer.requestAction('Пробует изучить «Ответный Шип»', 'spell-learning', '', {
    spellId:String(retaliationProfile.catalogId),name:retaliationProfile.name,nameUk:retaliationProfile.nameUk,learnType:retaliationCatalogEntry.learnType,learnText:retaliationCatalogEntry.learnText
  });
  const failedRetaliationLearningId = retaliationLearning.room.members[playerUid].actionRequest.id;
  retaliationLearning = await spellMaster.resolveAction(playerUid, true);
  queueDeterministicRandom(0);
  retaliationLearning = await spellPlayer.rollSpellLearning(failedRetaliationLearningId);
  assert.strictEqual(retaliationLearning.room.members[playerUid].actionRequest.status, 'learning-failure-choice', 'a failed Retaliation Spike check waits for the catalog consequence choice');
  retaliationLearning = await spellMaster.prepareSpellLearningFailure(playerUid, 'fatigue-next-check');
  assert.strictEqual(retaliationLearning.room.members[playerUid].actionRequest.status, 'learning-roll-result', 'the non-damage consequence does not invent an extra die');
  retaliationLearning = await spellMaster.resolveSpellLearning(playerUid, {success:false});
  assert.strictEqual(retaliationLearning.room.members[playerUid].character.hpCur, 12, 'choosing fatigue does not also apply the alternative HP loss');
  assert.strictEqual(retaliationLearning.room.members[playerUid].character.spellLearningEffects[0].amount, -1, 'fatigue applies -1 to the next learning check');
  await spellPlayer.acknowledgeAction(failedRetaliationLearningId);
  retaliationLearning = await spellPlayer.requestAction('Повторяет обучение после перерыва', 'spell-learning', '', {
    spellId:String(retaliationProfile.catalogId),name:retaliationProfile.name,nameUk:retaliationProfile.nameUk,learnType:retaliationCatalogEntry.learnType,learnText:retaliationCatalogEntry.learnText
  });
  const overstrainLearningId = retaliationLearning.room.members[playerUid].actionRequest.id;
  retaliationLearning = await spellMaster.resolveAction(playerUid, true);
  queueDeterministicRandom(0);
  retaliationLearning = await spellPlayer.rollSpellLearning(overstrainLearningId);
  assert.strictEqual(retaliationLearning.room.members[playerUid].actionRequest.learningResult.modifier, 0, 'the next CON learning check includes the one-shot -1 fatigue penalty');
  assert.ok(!retaliationLearning.room.members[playerUid].character.spellLearningEffects.some((effect) => effect && effect.until === 'next-learning-check'), 'the one-shot learning penalty is consumed after that check');
  retaliationLearning = await spellMaster.prepareSpellLearningFailure(playerUid, 'overstrain-hp');
  retaliationLearning = await spellMaster.resolveSpellLearning(playerUid, {success:false});
  assert.strictEqual(retaliationLearning.room.members[playerUid].character.hpCur, 11, 'choosing overstrain applies exactly the alternative 1 HP loss');
  assert.strictEqual(retaliationLearning.room.members[playerUid].character.spellLearningEffects.length, 0, 'the HP consequence does not also apply fatigue');
  await spellPlayer.acknowledgeAction(overstrainLearningId);
  await readyReviewedSpell(retaliationProfile);
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningProgress[String(retaliationProfile.catalogId)].successCount, 2, 'two separate CON successes are required');
  assert.ok(!spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects.some((effect) => effect && effect.until === 'next-learning-check'), 'the fatigue penalty is consumed exactly by the next learning check');
  await expectCode(() => spellPlayer.requestAction('Пытается вручную применить «Ответный Шип»', 'ability', '', reviewedSpellDetails('retaliation-spike-v1')), 'spell-trigger-only');

  spellShared.data.rooms[spellRoomCode].combat.order[0].hp = 16;
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.hpCur = 16;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-hero-token').hp = 16;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 23;
  async function enemyHitsRetaliationHero(operationSuffix) {
    spellShared.data.rooms[spellRoomCode].combat.turnIndex = 2;
    const enemy = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey);
    const hero = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellHeroKey);
    enemy.economy.long = 1;
    hero.economy.reaction = 1;
    queueDeterministicRandom(0.75);
    let next = await spellMaster.resolveCombatAttack(spellHeroKey, {operationId:`retaliation-enemy-hit-${operationSuffix}`,weaponId:'unarmed',statKey:'str'}, spellEnemyAKey);
    assert.strictEqual(next.room.combatEvent.hit, true, 'the incoming hit reaches the damage trigger');
    queueDeterministicRandom(0.25);
    return spellMaster.resolveCombatDamage(spellHeroKey, {operationId:`retaliation-enemy-damage-${operationSuffix}`,weaponId:'unarmed',statKey:'str'}, spellEnemyAKey);
  }
  let retaliationSnapshot = await enemyHitsRetaliationHero('first');
  const firstRetaliationRequest = retaliationSnapshot.room.members[playerUid].reactionRequest;
  assert.strictEqual(firstRetaliationRequest.automationKey, 'retaliation-spike-v1', 'actual post-mitigation damage opens the automatic player choice');
  assert.strictEqual(firstRetaliationRequest.weaponId, 'spell-hero-blade', 'the reaction selects the main-hand weapon rather than the unarmed fallback');
  assert.strictEqual(firstRetaliationRequest.targetKey, spellEnemyAKey, 'the counterattack points back to the damage source');
  assert.ok(!retaliationSnapshot.room.members[playerUid].character.abilityUsage['spell-1773672381766'], 'the prompt does not spend a use before player consent');
  await expectCode(() => spellMaster.advanceCombat({operationId:'retaliation-blocked-turn'}), 'reaction-decision-required');
  const firstPromptId = firstRetaliationRequest.id;
  retaliationSnapshot = await spellMaster.resolveCombatDamage(spellHeroKey, {operationId:'retaliation-enemy-damage-first',weaponId:'unarmed',statKey:'str'}, spellEnemyAKey);
  assert.strictEqual(retaliationSnapshot.room.members[playerUid].reactionRequest.id, firstPromptId, 'replaying the same damage operation does not create a second prompt');
  retaliationSnapshot = await spellPlayer.answerCombatReaction(firstPromptId, true);
  const firstExecutionId = retaliationSnapshot.room.combat.pendingPreparedAction.id;
  assert.strictEqual(retaliationSnapshot.room.members[playerUid].character.abilityUsage['spell-1773672381766'].used, 1, 'accepting atomically spends one battle use');
  assert.strictEqual(retaliationSnapshot.room.combat.order[0].economy.reaction, 0, 'accepting atomically spends the round reaction');
  assert.strictEqual(retaliationSnapshot.room.combat.order[0].longActionDebt.count, 1, 'accepting records the next-turn action debt without a fake status');
  retaliationSnapshot = await spellPlayer.answerCombatReaction(firstPromptId, true);
  assert.strictEqual(retaliationSnapshot.room.members[playerUid].character.abilityUsage['spell-1773672381766'].used, 1, 'a duplicate accepted answer cannot spend another use');
  assert.strictEqual(retaliationSnapshot.room.combat.pendingPreparedAction.id, firstExecutionId, 'a duplicate answer preserves one counterattack execution');
  queueDeterministicRandom(0.75);
  retaliationSnapshot = await spellMaster.resolveCombatAttack(spellEnemyAKey, {operationId:'retaliation-counter-hit',preparedExecutionId:firstExecutionId,weaponId:'unarmed',statKey:'str'}, spellHeroKey);
  assert.strictEqual(retaliationSnapshot.room.combatEvent.weapon, 'Учебный двуручный меч', 'the resolver keeps the canonical main weapon even if another weapon is submitted');
  assert.strictEqual(retaliationSnapshot.room.combat.order[0].economy.long, 1, 'the off-turn counterattack does not spend the current long-action pool');
  queueDeterministicRandom(0.5);
  const enemyHpBeforeCounter = retaliationSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).hp;
  retaliationSnapshot = await spellMaster.resolveCombatDamage(spellEnemyAKey, {operationId:'retaliation-counter-damage',weaponId:'unarmed',statKey:'str'}, spellHeroKey);
  assert.ok(retaliationSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).hp < enemyHpBeforeCounter, 'the accepted reaction completes the ordinary weapon damage path');
  await spellPlayer.acknowledgeCombatReaction(firstPromptId);
  retaliationSnapshot = await spellMaster.advanceCombat({operationId:'retaliation-to-enemy-b'});
  retaliationSnapshot = await spellMaster.advanceCombat({operationId:'retaliation-to-hero'});
  assert.strictEqual(retaliationSnapshot.room.combat.order[0].economy.long, 0, 'the next own turn loses its main action');
  assert.strictEqual(retaliationSnapshot.room.combat.order[0].longActionDebt, null, 'the action debt is consumed once and is not stored as a lasting condition');

  retaliationSnapshot = await enemyHitsRetaliationHero('second');
  const secondRetaliationRequest = retaliationSnapshot.room.members[playerUid].reactionRequest;
  retaliationSnapshot = await spellPlayer.answerCombatReaction(secondRetaliationRequest.id, true);
  assert.strictEqual(retaliationSnapshot.room.members[playerUid].character.abilityUsage['spell-1773672381766'].used, 2, 'the second accepted trigger reaches the 2-per-battle limit');
  await spellMaster.cancelPendingPreparedAction(retaliationSnapshot.room.combat.pendingPreparedAction.id);
  await spellPlayer.acknowledgeCombatReaction(secondRetaliationRequest.id);
  retaliationSnapshot = await enemyHitsRetaliationHero('exhausted');
  assert.ok(!retaliationSnapshot.room.members[playerUid].reactionRequest, 'a third damage event in the same battle does not offer an exhausted reaction');
  reviewedPlayerCasts.add('retaliation-spike-v1');
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = 0;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;

  const sweepingProfile = spellAutomation.catalog().find((profile) => profile.automationKey === 'sweeping-strike-v1');
  const sweepingCatalogEntry = reviewedCatalogEntries.get(String(sweepingProfile.catalogId));
  let sweepingSnapshot = await spellPlayer.requestAction('Пробует изучить «Размашистый удар»', 'spell-learning', '', {
    spellId:String(sweepingProfile.catalogId),name:sweepingProfile.name,nameUk:sweepingProfile.nameUk,learnType:sweepingCatalogEntry.learnType,learnText:sweepingCatalogEntry.learnText
  });
  const failedSweepingLearningId = sweepingSnapshot.room.members[playerUid].actionRequest.id;
  sweepingSnapshot = await spellMaster.resolveAction(playerUid, true);
  queueDeterministicRandom(0);
  sweepingSnapshot = await spellPlayer.rollSpellLearning(failedSweepingLearningId);
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.status, 'learning-roll-result', 'the failed STR check has no invented consequence choice');
  sweepingSnapshot = await spellMaster.resolveSpellLearning(playerUid, {success:false});
  const sweepingFailureEffects = sweepingSnapshot.room.members[playerUid].character.spellLearningEffects;
  assert.deepStrictEqual(Array.from(sweepingFailureEffects).map((effect) => [effect.kind,effect.amount,effect.until]), [
    ['attack-penalty',-1,'next-attack'],['initiative-penalty',-1,'rest']
  ], 'the catalog learning failure applies its two narrow temporary effects');
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].character.spellLearningProgress[String(sweepingProfile.catalogId)].retryBlocked, false, 'the next learning check is immediately available as written');
  assert.ok(!sweepingSnapshot.room.members[playerUid].character.statuses.includes('exhausted'), 'the narrow initiative penalty does not become canonical Exhaustion');
  assert.ok(!sweepingSnapshot.room.combat.order[0].statuses.includes('exhausted'), 'combat status synchronization also remains free of invented Exhaustion');
  assert.match(sweepingSnapshot.room.combatEvent.text, /−1 к следующей атаке.*Следующую проверку можно выполнить сразу/, 'the Russian public result explains both penalties and the immediate retry');
  assert.match(sweepingSnapshot.room.combatEvent.textUk, /−1 до наступної атаки.*Наступну перевірку можна виконати одразу/, 'the Ukrainian public result explains both penalties and the immediate retry');
  assert.strictEqual(sweepingSnapshot.room.combatEvent.temporaryEffects.length, 2);
  await spellPlayer.acknowledgeAction(failedSweepingLearningId);
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0.75, 0.75);
  await readyReviewedSpell(sweepingProfile);
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningProgress[String(sweepingProfile.catalogId)].successCount, 2, 'two successful STR checks are required after the failed attempt');

  const spellCharacter = spellShared.data.rooms[spellRoomCode].members[playerUid].character;
  spellCharacter.equipItems = [{instanceId:'sweep-charm',id:'sweep-charm',name:'Балансир клинка',equipped:true,effects:[
    {id:'balance',operation:'add-attack-bonus',value:1,frequency:'passive'},
    {id:'heavy-edge',operation:'add-damage-dice',dice:'1d4',frequency:'combat',charges:1}
  ]}];
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long = 1;
  const forgedSweepingDetails = reviewedSpellDetails('sweeping-strike-v1', {
    weaponId:'spell-hero-blade',weaponName:'Поддельное оружие',attackStat:'int',damageFormula:'99d100',damageType:'void',
    targeting:{mode:'token',tokenIds:['spell-enemy-a','spell-enemy-b'],targetKeys:[spellEnemyAKey,spellEnemyBKey],targetNames:['Латник','Ловкач']}
  });
  sweepingSnapshot = await spellPlayer.requestAction('Проверяет дальние цели «Размашистого удара»', 'ability', '', forgedSweepingDetails);
  const invalidSweepingRequestId = sweepingSnapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.ability.weaponName, 'Учебный двуручный меч', 'Firebase restores the equipped weapon instead of trusting submitted labels');
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.ability.attackStat, 'str');
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.ability.damageFormula, '1d6');
  await expectCode(() => spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey, spellEnemyBKey], {}), 'combat-target-invalid');
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long, 1, 'invalid target geometry does not spend the long action');
  assert.ok(!spellShared.data.rooms[spellRoomCode].members[playerUid].character.abilityUsage['spell-1773672646696'], 'invalid target geometry does not spend the battle use');
  await spellMaster.resolveAction(playerUid, false);
  await spellPlayer.acknowledgeAction(invalidSweepingRequestId);

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 23;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 21;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyBKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').hp = 30;
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long = 1;
  forgedSweepingDetails.operationId = 'reviewed-sweeping-strike-valid';
  sweepingSnapshot = await spellPlayer.requestAction('Применяет «Размашистый удар»', 'ability', '', forgedSweepingDetails);
  const sweepingRequestId = sweepingSnapshot.room.members[playerUid].actionRequest.id;
  sweepingSnapshot = await spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey, spellEnemyBKey], {
    formulaOverrides:{damage:'2d6'},itemModifierIds:['item-effect-sweep-charm-heavy-edge']
  });
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.status, 'ability-workflow-roll-ready');
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0.5);
  sweepingSnapshot = await spellPlayer.rollCombatAbilityStage(sweepingRequestId);
  const sharedAttack = sweepingSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'attack').result;
  assert.strictEqual(sharedAttack.roll, 11);
  assert.strictEqual(sharedAttack.learningAttackPenalty, -1, 'the failed-learning attack penalty is included in the first real attack');
  assert.strictEqual(sharedAttack.itemBonus, 1, 'the equipped passive weapon accuracy bonus is included exactly once');
  assert.strictEqual(sharedAttack.total, 11, 'the visible attack total includes both the penalty and item bonus');
  assert.ok(!sweepingSnapshot.room.members[playerUid].character.spellLearningEffects.some((effect) => effect.until === 'next-attack'), 'the one-shot attack penalty is consumed by the shared attack roll');
  assert.ok(sweepingSnapshot.room.members[playerUid].character.spellLearningEffects.some((effect) => effect.kind === 'initiative-penalty' && effect.until === 'rest'), 'the initiative penalty remains until a real rest');
  sweepingSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0.34, 0.5, 0.25);
  sweepingSnapshot = await spellPlayer.rollCombatAbilityStage(sweepingRequestId);
  const sharedDamage = sweepingSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'damage').result;
  assert.strictEqual(sharedDamage.formula, '2d6', 'the GM can explicitly increase the weapon damage dice before rolling');
  assert.deepStrictEqual(Array.from(sharedDamage.baseRolls), [3,4]);
  assert.deepStrictEqual(Array.from(sharedDamage.rolls), [3,4,2], 'the synchronized roll list includes both base and item dice');
  assert.deepStrictEqual(Array.from(sharedDamage.bonusRolls), [2], 'the selected once-per-battle item die is auditable separately');
  assert.strictEqual(sharedDamage.total, 9);
  sweepingSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].actionRequest.status, 'ability-workflow-result');
  sweepingSnapshot = await spellMaster.resolveCombatAbility(playerUid, [spellEnemyAKey, spellEnemyBKey], {});
  const sweepingResults = sweepingSnapshot.room.combatEvent.results;
  assert.strictEqual(sweepingSnapshot.room.combatEvent.automationKey, 'sweeping-strike-v1');
  assert.strictEqual(sweepingSnapshot.room.combatEvent.weapon, 'Учебный двуручный меч');
  assert.deepStrictEqual(Array.from(sweepingSnapshot.room.combatEvent.targetKeys), [spellEnemyAKey,spellEnemyBKey]);
  assert.strictEqual(sweepingSnapshot.room.combatEvent.sharedDamageRoll.total, 9);
  assert.deepStrictEqual(Array.from(sweepingSnapshot.room.combatEvent.sharedDamageRoll.rolls), [3,4,2]);
  assert.strictEqual(sweepingResults.find((result) => result.key === spellEnemyAKey).success, true, 'the shared total hits AC 10');
  assert.strictEqual(sweepingResults.find((result) => result.key === spellEnemyAKey).damage, 5, 'odd shared damage is halved and rounded up for the hit target');
  assert.strictEqual(sweepingResults.find((result) => result.key === spellEnemyBKey).success, false, 'the same shared total separately misses AC 12');
  assert.strictEqual(sweepingResults.find((result) => result.key === spellEnemyBKey).damage, 0);
  assert.strictEqual(sweepingSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).hp, 25);
  assert.strictEqual(sweepingSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyBKey).hp, 30);
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].character.abilityUsage['spell-1773672646696'].used, 1);
  assert.strictEqual(sweepingSnapshot.room.combat.order[0].economy.long, 0);
  assert.strictEqual(sweepingSnapshot.room.members[playerUid].character.abilityUsage['item-effect-sweep-charm-heavy-edge'].used, 1, 'the selected item die is consumed exactly once in the same Firebase transaction');
  assert.deepStrictEqual(Array.from(sweepingSnapshot.room.combatEvent.itemModifiers).map((item) => item.id).sort(), ['item-effect-sweep-charm-balance','item-effect-sweep-charm-heavy-edge']);
  assert.deepStrictEqual(Array.from(sweepingSnapshot.room.combatEvent.results).flatMap((result) => result.statuses), [], 'the strike applies no invented statuses');
  assert.strictEqual(sweepingSnapshot.room.combatEvent.animationKey, 'sweeping-strike-v1');
  assert.strictEqual(sweepingSnapshot.room.combatEvent.soundProfile, 'weapon-impact');
  assert.match(sweepingSnapshot.room.combatEvent.textUk, /спільну шкоду/, 'the synchronized result carries Ukrainian playback text');
  reviewedPlayerCasts.add('sweeping-strike-v1');
  await spellPlayer.acknowledgeAction(sweepingRequestId);
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 38;

  const stormProfile = spellAutomation.catalog().find((profile) => profile.automationKey === 'storm-arrow-v1');
  const stormCatalogEntry = reviewedCatalogEntries.get(String(stormProfile.catalogId));
  let stormSnapshot = await spellPlayer.requestAction('Пробует изучить «Стрелу-бурю»', 'spell-learning', '', {
    spellId:String(stormProfile.catalogId),name:stormProfile.name,nameUk:stormProfile.nameUk,learnType:stormCatalogEntry.learnType,learnText:stormCatalogEntry.learnText
  });
  const failedStormLearningId = stormSnapshot.room.members[playerUid].actionRequest.id;
  stormSnapshot = await spellMaster.resolveAction(playerUid, true);
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0);
  stormSnapshot = await spellPlayer.rollSpellLearning(failedStormLearningId);
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.learningResult.stat, 'dex', 'storm learning chooses the better DEX/PER modifier');
  stormSnapshot = await spellMaster.resolveSpellLearning(playerUid, {success:false});
  const stormFailureEffects = stormSnapshot.room.members[playerUid].character.spellLearningEffects.filter((effect) => String(effect.spellId) === String(stormProfile.catalogId));
  assert.deepStrictEqual(Array.from(stormFailureEffects).map((effect) => [effect.kind,effect.stat,effect.amount,effect.until]), [
    ['learning-check-penalty','dex',-1,'next-learning-check'],
    ['learning-check-penalty','per',-1,'next-learning-check'],
    ['range-penalty','',-1,'next-battle']
  ], 'the failed lesson records narrow check and next-battle range penalties without inventing a status');
  assert.deepStrictEqual(Array.from(stormSnapshot.room.combat.order[0].statuses), [], 'storm learning consequences do not enter the official condition list');
  const stormRangeEffect = stormFailureEffects.find((effect) => effect.kind === 'range-penalty');
  await spellPlayer.acknowledgeAction(failedStormLearningId);
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0.75,0.75);
  await readyReviewedSpell(stormProfile);
  assert.ok(!spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects.some((effect) => effect && effect.until === 'next-learning-check'), 'both one-shot learning penalties are consumed by the next DEX/PER check');
  assert.ok(spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects.some((effect) => effect && effect.kind === 'range-penalty'), 'the range penalty waits for the next battle rather than the next lesson');
  spellShared.data.rooms[spellRoomCode].combat.battleStartedAt = Number(stormRangeEffect.createdAt) + 1;
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = 0;
  const stormHero = spellShared.data.rooms[spellRoomCode].combat.order[0];
  stormHero.economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};
  const stormEnemyAToken = spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a');
  const stormEnemyBToken = spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b');
  stormEnemyAToken.x = 44;stormEnemyAToken.y = 50;stormEnemyBToken.x = 44;stormEnemyBToken.y = 55;
  const forgedStormDetails = reviewedSpellDetails('storm-arrow-v1', {
    operationId:'reviewed-storm-arrow-range-check',weaponId:'spell-hero-crossbow',weaponName:'Поддельный лук',attackStat:'int',damageFormula:'99d100',damageType:'void',rangeCells:100,
    targeting:{mode:'token',tokenIds:['spell-enemy-a','spell-enemy-b'],targetKeys:[spellEnemyAKey,spellEnemyBKey],targetNames:['Латник','Ловкач']}
  });
  stormSnapshot = await spellPlayer.requestAction('Проверяет штраф дальности «Стрелы-бури»', 'ability', '', forgedStormDetails);
  const invalidStormRequestId = stormSnapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.ability.weaponName, 'Учебный арбалет', 'Firebase restores the equipped ranged weapon rather than trusting a forged bow label');
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.ability.damageFormula, '1d8');
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.ability.attackStat, 'dex');
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.ability.rangeCells, 8, 'the canonical request keeps the weapon base range before combat context');
  await expectCode(() => spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey,spellEnemyBKey], {}), 'combat-target-invalid');
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long, 1, 'the next-battle range rejection does not spend the long action');
  await spellMaster.resolveAction(playerUid, false);
  await spellPlayer.acknowledgeAction(invalidStormRequestId);

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 41;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').y = 50;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 41;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').y = 55;
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};
  forgedStormDetails.operationId = 'reviewed-storm-arrow-valid';
  stormSnapshot = await spellPlayer.requestAction('Применяет «Стрелу-бурю» из арбалета', 'ability', '', forgedStormDetails);
  const stormRequestId = stormSnapshot.room.members[playerUid].actionRequest.id;
  stormSnapshot = await spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey,spellEnemyBKey], {formulaOverrides:{damage:'2d8'}});
  assert.strictEqual(stormSnapshot.room.members[playerUid].actionRequest.ability.rangeCells, 7, 'the -1 range consequence applies only after the next battle begins');
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0.4,0.8);
  stormSnapshot = await spellPlayer.rollCombatAbilityStage(stormRequestId);
  const stormAttack = stormSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'attack').result;
  assert.deepStrictEqual(Array.from(stormAttack.rolls), [9,17], 'the shared storm attack rolls two d20');
  assert.strictEqual(stormAttack.roll, 9, 'disadvantage keeps the lower d20');
  assert.strictEqual(stormAttack.rollMode, 'disadvantage');
  assert.strictEqual(stormAttack.itemBonus, 1, 'the equipped passive accuracy bonus is included once in the shared attack');
  assert.strictEqual(stormAttack.total, 11);
  stormSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  deterministicRandomValues.length = 0;
  queueDeterministicRandom(0,0.125,0.75,0.875);
  stormSnapshot = await spellPlayer.rollCombatAbilityStage(stormRequestId);
  const stormDamage = stormSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'damage').result;
  assert.strictEqual(stormDamage.formula, '2d8', 'the GM can increase the storm weapon damage dice before the player rolls');
  assert.deepStrictEqual(Array.from(stormDamage.baseRolls), [1,2]);
  assert.deepStrictEqual(Array.from(stormDamage.discardedRolls), [7,8], 'the larger damage pool stays visible as discarded');
  assert.strictEqual(stormDamage.rollMode, 'disadvantage');
  assert.strictEqual(stormDamage.total, 4, 'DEX is added once after choosing the lower damage pool');
  stormSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  stormSnapshot = await spellMaster.resolveCombatAbility(playerUid, [spellEnemyAKey,spellEnemyBKey], {});
  const stormResults = stormSnapshot.room.combatEvent.results;
  assert.strictEqual(stormSnapshot.room.combatEvent.weapon, 'Учебный арбалет');
  assert.strictEqual(stormSnapshot.room.combatEvent.attackRollMode, 'disadvantage');
  assert.strictEqual(stormSnapshot.room.combatEvent.damageRollMode, 'disadvantage');
  assert.deepStrictEqual(Array.from(stormSnapshot.room.combatEvent.sharedDamageRoll.rolls), [1,2]);
  assert.deepStrictEqual(Array.from(stormSnapshot.room.combatEvent.sharedDamageRoll.discardedRolls), [7,8]);
  assert.strictEqual(stormResults.find((result) => result.key === spellEnemyAKey).success, true, 'the shared attack independently hits AC 10');
  assert.strictEqual(stormResults.find((result) => result.key === spellEnemyAKey).damage, 4, 'the hit target receives the full lower pool, not half');
  assert.strictEqual(stormResults.find((result) => result.key === spellEnemyBKey).success, false, 'the same shared attack independently misses AC 12');
  assert.strictEqual(stormResults.find((result) => result.key === spellEnemyBKey).damage, 0);
  assert.deepStrictEqual(Array.from(stormResults).flatMap((result) => result.statuses), [], 'storm arrow applies no custom or legacy condition');
  assert.deepStrictEqual(stormSnapshot.room.combat.order[0].economy, {long:0,short:0,reaction:1,movement:0,movementMax:6}, 'absolute focus spends the long action and locks every remaining non-reaction option');
  assert.strictEqual(stormSnapshot.room.combatEvent.turnLocked, true);
  assert.strictEqual(stormSnapshot.room.combatEvent.animationKey, 'storm-arrow-v1');
  assert.strictEqual(stormSnapshot.room.combatEvent.soundProfile, 'arrow');
  assert.match(stormSnapshot.room.combatEvent.textUk, /Решту ходу заблоковано/, 'the synchronized result explains the turn lock in Ukrainian');
  reviewedPlayerCasts.add('storm-arrow-v1');
  await spellPlayer.acknowledgeAction(stormRequestId);

  const rotProfile = spellAutomation.catalog().find((profile) => profile.automationKey === 'rot-ray-v1');
  const rotCatalogEntry = reviewedCatalogEntries.get(String(rotProfile.catalogId));
  const rotCharacter = spellShared.data.rooms[spellRoomCode].members[playerUid].character;
  rotCharacter.stats.int = 1;rotCharacter.stats.cha = 1;
  await expectCode(() => spellPlayer.requestAction('Пытается изучить «Луч Гнили» без нужной характеристики', 'spell-learning', '', {
    spellId:String(rotProfile.catalogId),name:rotProfile.name,nameUk:rotProfile.nameUk,learnType:rotCatalogEntry.learnType,learnText:rotCatalogEntry.learnText
  }), 'spell-learning-prerequisite');
  rotCharacter.stats.int = 2;
  let rotSnapshot = await spellPlayer.requestAction('Проводит первый ритуал «Луча Гнили»', 'spell-learning', '', {
    spellId:String(rotProfile.catalogId),name:rotProfile.name,nameUk:rotProfile.nameUk,learnType:rotCatalogEntry.learnType,learnText:rotCatalogEntry.learnText
  });
  const failedRotLearningId = rotSnapshot.room.members[playerUid].actionRequest.id;
  rotSnapshot = await spellMaster.resolveAction(playerUid, true);
  deterministicRandomValues.length = 0;queueDeterministicRandom(0);
  rotSnapshot = await spellPlayer.rollSpellLearning(failedRotLearningId);
  assert.strictEqual(rotSnapshot.room.members[playerUid].actionRequest.learningResult.success, false, 'the failed CHA ritual is recorded before consequences');
  rotSnapshot = await spellMaster.resolveSpellLearning(playerUid, {success:false});
  const rotFailureEffects = rotSnapshot.room.members[playerUid].character.spellLearningEffects.filter((effect) => String(effect.spellId) === String(rotProfile.catalogId));
  assert.deepStrictEqual(Array.from(rotFailureEffects).map((effect) => [effect.kind,effect.until]), [['one-eye-blind','rest'],['spell-disabled','rest']], 'the ritual failure records narrow rest-scoped consequences');
  assert.ok(!rotSnapshot.room.combat.order[0].statuses.includes('blind'), 'one blind eye does not silently become the full official Blinded status');
  await spellPlayer.acknowledgeAction(failedRotLearningId);
  deterministicRandomValues.length = 0;queueDeterministicRandom(0.75);
  await readyReviewedSpell(rotProfile);
  await expectCode(() => spellPlayer.requestAction('Пытается применить «Луч Гнили» до отдыха', 'ability', '', reviewedSpellDetails('rot-ray-v1')), 'spell-disabled-until-rest');
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects = spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects.filter((effect) => !effect || String(effect.spellId) !== String(rotProfile.catalogId) || String(effect.until) !== 'rest');
  spellShared.data.rooms[spellRoomCode].combat.order[0].spellLearningEffects = spellShared.data.rooms[spellRoomCode].members[playerUid].character.spellLearningEffects.slice();
  const rotEnemy = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey);
  const rotEnemyToken = spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a');
  rotEnemy.hp = 30;rotEnemy.statuses = [];rotEnemy.statusEffects = [];rotEnemyToken.hp = 30;rotEnemyToken.x = 28;rotEnemyToken.y = 50;
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};
  const forgedRotDetails = reviewedSpellDetails('rot-ray-v1', {
    operationId:'reviewed-rot-ray-valid',attackStat:'int',saveStat:'dex',saveDC:99,damageFormula:'99d100',damageType:'void',rangeCells:100,maxUsesPerBattle:99,statuses:['blind'],
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:3}
  });
  rotSnapshot = await spellPlayer.requestAction('Применяет «Луч Гнили»', 'ability', '', forgedRotDetails);
  const rotRequestId = rotSnapshot.room.members[playerUid].actionRequest.id;
  const canonicalRot = rotSnapshot.room.members[playerUid].actionRequest.ability;
  assert.deepStrictEqual([canonicalRot.attackStat,canonicalRot.saveStat,canonicalRot.saveDC,canonicalRot.damageFormula,canonicalRot.damageType,canonicalRot.maxUsesPerBattle], ['cha','con',13,'1d6','poison',1], 'Firebase restores every security-sensitive Rot Ray rule');
  assert.deepStrictEqual(Array.from(canonicalRot.statuses), ['poison'], 'a forged legacy status is replaced by official Poisoned');
  rotSnapshot = await spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey], {formulaOverrides:{damage:'2d6'}});
  deterministicRandomValues.length = 0;queueDeterministicRandom(0.7);
  rotSnapshot = await spellPlayer.rollCombatAbilityStage(rotRequestId);
  rotSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  deterministicRandomValues.length = 0;queueDeterministicRandom(0.2,0.75);
  rotSnapshot = await spellPlayer.rollCombatAbilityStage(rotRequestId);
  const rotDamageRoll = rotSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'damage').result;
  assert.strictEqual(rotDamageRoll.formula, '2d6', 'the GM can increase the poison damage pool before the caster rolls');
  assert.deepStrictEqual(Array.from(rotDamageRoll.rolls), [2,5]);
  rotSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  deterministicRandomValues.length = 0;queueDeterministicRandom(0);
  rotSnapshot = await spellMaster.rollCombatAbilityStage(rotRequestId, playerUid);
  const rotSaveRoll = rotSnapshot.room.members[playerUid].actionRequest.abilityResolution.workflow.assignments.find((assignment) => assignment.stepKey === 'save').result;
  assert.strictEqual(rotSaveRoll.success, false, 'the GM rolls the post-hit CON save for its creature');
  rotSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  deterministicRandomValues.length = 0;queueDeterministicRandom(0.99);
  rotSnapshot = await spellMaster.rollCombatAbilityStage(rotRequestId, playerUid);
  rotSnapshot = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {accepted:true});
  assert.strictEqual(rotSnapshot.room.members[playerUid].actionRequest.status, 'ability-workflow-result');
  rotSnapshot = await spellMaster.resolveCombatAbility(playerUid, [spellEnemyAKey], {});
  const rotResult = rotSnapshot.room.combatEvent.results[0];
  const appliedPoison = rotSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).statusEffects.find((effect) => effect.statusKey === 'poison');
  assert.strictEqual(rotResult.damage, 7, 'the conditional save does not erase damage already dealt by the hit');
  assert.strictEqual(rotResult.conditionalSave.success, false);
  assert.strictEqual(rotResult.statusDuration, 3, 'd6 6 becomes a visible three-round poison duration');
  assert.deepStrictEqual(Array.from(rotResult.statuses), ['poison']);
  assert.deepStrictEqual([appliedPoison.duration,appliedPoison.remainingRounds,appliedPoison.tickValue,appliedPoison.attackDisadvantage,appliedPoison.abilityCheckDisadvantage,appliedPoison.saveDC], [3,3,1,true,true,14], 'the spell instance uses the official Poisoned mechanics and its rolled maximum duration');
  assert.strictEqual(rotSnapshot.room.members[playerUid].character.abilityUsage['spell-1773702048611'].used, 1);
  assert.strictEqual(rotSnapshot.room.members[playerUid].character.abilityUsage['spell-1773702048611'].battleUsed, 1);
  assert.strictEqual(rotSnapshot.room.combatEvent.animationKey, 'rot-ray-v1');
  assert.strictEqual(rotSnapshot.room.combatEvent.soundProfile, 'magic-poison');
  assert.match(rotSnapshot.room.combatEvent.textUk, /CON 1 проти СК 13.*Отруєний на 3 р\./, 'the synchronized Ukrainian result contains the save and duration');
  reviewedPlayerCasts.add('rot-ray-v1');
  await spellPlayer.acknowledgeAction(rotRequestId);
  const rotUsageBeforeLimit = clone(spellShared.data.rooms[spellRoomCode].members[playerUid].character.abilityUsage['spell-1773702048611']);
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long = 1;
  await expectCode(() => spellPlayer.requestAction('Пытается второй раз применить «Луч Гнили» в том же бою', 'ability', '', Object.assign({},forgedRotDetails,{operationId:'reviewed-rot-ray-same-battle'})), 'ability-battle-limit');
  assert.deepStrictEqual(spellShared.data.rooms[spellRoomCode].members[playerUid].character.abilityUsage['spell-1773702048611'], rotUsageBeforeLimit, 'same-battle rejection spends neither the second daily charge nor another battle use');
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].combat.order[0].economy.long, 1, 'same-battle rejection does not spend the long action');

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 23;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').y = 50;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 38;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').y = 50;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyBKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').hp = 30;
  spellShared.data.rooms[spellRoomCode].combat.order[0].economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};

  let reviewedSnapshot = await castReviewedSpell('finger-heat-v1', [spellEnemyAKey], {
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:1}
  }, {}, [0.75,0.5,0.5]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.automationKey, 'finger-heat-v1');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.damage, 4, 'instant Жар Пальцев uses the caster INT attack and applies 1d6 fire damage');
  assert.strictEqual(reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).hp, 26);

  spellShared.data.rooms[spellRoomCode].combat.order[0].hp = 6;
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.hpCur = 6;
  reviewedSnapshot = await castReviewedSpell('salvation-touch-v1', [spellHeroKey], {
    targeting:{mode:'token',tokenId:'spell-hero-token',targetKey:spellHeroKey,targetName:'Арканист',distanceCells:0}
  }, {}, [0,0.25,0.5]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.heal, 3, 'Касание Спасения rolls exactly 2d4 without inventing an attack');
  assert.strictEqual(reviewedSnapshot.room.combat.order[0].hp, 9);
  assert.strictEqual(reviewedSnapshot.room.members[playerUid].character.hpCur, 9, 'instant healing synchronizes the character sheet');

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 35;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyBKey).hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').hp = 30;
  reviewedSnapshot = await castReviewedSpell('fire-projectile-v1', [spellEnemyAKey, spellEnemyBKey], {
    targeting:{mode:'point',x:36.5,y:50,distanceCells:6}
  }, {areaMode:'circle',areaRadius:2,areaAnchorPoint:{x:36.5,y:50}}, [0,0,0,0,0.99]);
  const fireResults = reviewedSnapshot.room.combatEvent.results;
  assert.strictEqual(fireResults.length, 2, 'Огненный снаряд resolves every combatant inside the two-cell area');
  assert.strictEqual(fireResults.find((result) => result.key === spellEnemyAKey).damage, 3, 'failed DEX save takes full 3d6 result');
  assert.strictEqual(fireResults.find((result) => result.key === spellEnemyBKey).damage, 1, 'successful DEX save takes half rounded down');
  assert.deepStrictEqual(fireResults[0].damageRolls, fireResults[1].damageRolls, 'every target uses the same fireball damage dice');
  assert.deepStrictEqual(reviewedSnapshot.room.combatEvent.damageRolls, [1,1,1], 'the public event publishes the shared AOE damage roll only once');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.areaRadius, 2);

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 38;
  reviewedSnapshot = await castReviewedSpell('lightning-lasso-v1', [spellEnemyAKey], {
    playbackVariant:'pull',pullCells:2,statuses:[],saveRollMode:'disadvantage',targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:6}
  }, {saveRollMode:'disadvantage'}, [0.9,0]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.movements.length, 1, 'Лассо Молнии publishes one synchronized pull movement');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.results[0].rollMode, 'disadvantage', 'metal armour applies the reviewed save disadvantage');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.results[0].rolls.length, 2);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.movements[0].cells, 2);
  assert.ok(reviewedSnapshot.room.scene.tokens.find((token) => token.id === 'spell-enemy-a').x < 38, 'the target token actually moves toward the caster');
  assert.deepStrictEqual(reviewedSnapshot.room.combatEvent.results[0].statuses, [], 'the pull variant does not also apply restrained');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.resolutionMode, 'save', 'the public lasso event identifies a save instead of reporting a hit or miss');

  const spellAllyKey = 'token:spell-ally';
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellAllyKey).tempHp = 0;
  reviewedSnapshot = await castReviewedSpell('pseudo-life-v1', [spellAllyKey], {
    playbackVariant:'stable',targeting:{mode:'token',tokenId:'spell-ally',targetKey:spellAllyKey,targetName:'Союзный разведчик',distanceCells:1}
  }, {}, [0.5]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.tempHp, 4, 'Псевдожизнь keeps the player-selected stable four temporary HP variant');
  assert.strictEqual(reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellAllyKey).tempHp, 4);

  reviewedSnapshot = await castReviewedSpell('energy-protection-v1', [spellAllyKey], {
    energyResistance:'acid',targeting:{mode:'token',tokenId:'spell-ally',targetKey:spellAllyKey,targetName:'Союзный разведчик',distanceCells:1}
  }, {}, [0.5]);
  const energyEffect = reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellAllyKey).statusEffects.find((effect) => effect.statusKey === 'energy-ward');
  assert.ok(energyEffect, 'Защита от Энергии creates a real timed status in shared combat');
  assert.strictEqual(energyEffect.resistanceType, 'acid', 'the selected energy type survives the player request and network canonicalization');
  assert.match(reviewedSnapshot.room.combatEvent.textUk, /Кислот|кислот/i, 'the real player cast publishes a Ukrainian event');

  reviewedSnapshot = await castReviewedSpell('silence-seal-v1', [], {
    targeting:{mode:'point',x:45,y:50,distanceCells:8}
  }, {areaMode:'circle',areaRadius:5,areaAnchorPoint:{x:45,y:50}}, [0.5]);
  assert.ok(reviewedSnapshot.room.combat.spellZones.some((zone) => zone.kind === 'silence'), 'Печать Молчания persists as one synchronized Firebase combat zone');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.spellZone.kind, 'silence');

  const heroTokenBeforeMist = reviewedSnapshot.room.scene.tokens.find((token) => token.id === 'spell-hero-token');
  const mistStartX = heroTokenBeforeMist.x;
  reviewedSnapshot = await castReviewedSpell('misty-transition-v1', [spellHeroKey], {
    targeting:{mode:'point',x:30,y:50,distanceCells:3}
  }, {}, [0.5]);
  assert.ok(reviewedSnapshot.room.scene.tokens.find((token) => token.id === 'spell-hero-token').x > mistStartX, 'Туманный Переход moves the real hero token to the selected point');
  assert.strictEqual(reviewedSnapshot.room.lastMovement.kind, 'teleport');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.movements[0].kind, 'teleport');
  spellShared.data.rooms[spellRoomCode].combat.spellZones = [];

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 42;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').y = 50;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 44;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').y = 50;
  reviewedSnapshot = await castReviewedSpell('gravity-center-v1', [], {
    targeting:{mode:'point',x:43,y:50,distanceCells:4}
  }, {areaMode:'circle',areaRadius:5,areaAnchorPoint:{x:43,y:50},pullTowardPoint:true,pullCells:5}, Array(20).fill(0));
  assert.ok(reviewedSnapshot.room.combatEvent.movements.length >= 2, 'Центр Притяжения publishes every affected token movement');
  assert.ok(reviewedSnapshot.room.combatEvent.movements.every((movement) => movement.kind === 'gravity'));

  reviewedSnapshot = await castReviewedSpell('psychic-screech-v1', [spellEnemyAKey], {
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:4}
  }, {}, [0,0.5]);
  const psychicResult = reviewedSnapshot.room.combatEvent.results.find((result) => result.key === spellEnemyAKey);
  assert.ok(psychicResult.statuses.includes('psychic-screech'), 'Психический Визг synchronizes its reviewed next-attack penalty status');
  assert.ok(psychicResult.attackPenalty > 0, 'the psychic penalty is rolled and recorded once');
  const psychicEffect = reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyAKey).statusEffects.find((effect) => effect.statusKey === 'psychic-screech');
  assert.strictEqual(psychicEffect.consumeOnAttack, true, 'the synchronized psychic penalty survives normalization as a one-attack effect');

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 40;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 42;
  reviewedSnapshot = await castReviewedSpell('hypnotic-pattern-v1', [], {
    targeting:{mode:'point',x:41,y:50,distanceCells:4}
  }, {areaMode:'square',areaRadius:2,areaWidth:4,areaAnchorPoint:{x:41,y:50}}, Array(12).fill(0));
  assert.strictEqual(reviewedSnapshot.room.combatEvent.areaMode, 'square', 'Гипнотический Узор keeps its reviewed square geometry');
  assert.ok(reviewedSnapshot.room.combatEvent.results.length >= 2, 'the square resolves every token inside it');
  assert.ok(reviewedSnapshot.room.combatEvent.results.every((result) => result.statuses.includes('hypnotic-trance')));
  assert.ok(reviewedSnapshot.room.combat.order.filter((entry) => reviewedSnapshot.room.combatEvent.results.some((result) => result.key === entry.key)).every((entry) => entry.statusEffects.some((effect) => effect.statusKey === 'hypnotic-trance' && effect.breakOnDamage === true && effect.grantMeleeAdvantageToAttackers === true)), 'hypnotic trance keeps its damage-break and melee-advantage mechanics after synchronization');
  spellShared.data.rooms[spellRoomCode].combat.order[0].statuses = [];
  spellShared.data.rooms[spellRoomCode].combat.order[0].statusEffects = [];
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.statuses = [];
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.statusEffects = [];

  const sharedAlly = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellAllyKey);
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-ally').x = 42;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-ally').y = 52;
  sharedAlly.statuses = ['curse'];
  sharedAlly.statusEffects = [{statusKey:'curse',label:'Проклятие'}];
  reviewedSnapshot = await castReviewedSpell('remove-curse-v1', [spellAllyKey], {
    targeting:{mode:'token',tokenId:'spell-ally',targetKey:spellAllyKey,targetName:'Союзный разведчик',distanceCells:1}
  }, {}, [0.5]);
  assert.ok(!reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellAllyKey).statuses.includes('curse'), 'Снятие Проклятья removes the canonical curse and no other state');
  assert.deepStrictEqual(Array.from(reviewedSnapshot.room.combatEvent.removedStatuses), ['curse']);

  spellShared.data.rooms[spellRoomCode].combat.order[0].hp = 12;
  spellShared.data.rooms[spellRoomCode].members[playerUid].character.hpCur = 12;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellAllyKey).hp = 2;
  reviewedSnapshot = await castReviewedSpell('life-transfer-v1', [spellAllyKey], {
    targeting:{mode:'token',tokenId:'spell-ally',targetKey:spellAllyKey,targetName:'Союзный разведчик',distanceCells:1}
  }, {}, [0,0]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.sourceDamage, 4, 'Передача Жизни rolls 2d8 + INT against the caster exactly once');
  assert.strictEqual(reviewedSnapshot.room.combat.order[0].hp, 8, 'the caster payment is synchronized to the hero sheet and combatant');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.heal, 8, 'the living ally receives twice the actually paid HP');

  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').x = 45;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').y = 50;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').x = 58;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').y = 50;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).heavyArmor = true;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp = 7;
  spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyBKey).hp = 7;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 7;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').hp = 7;
  reviewedSnapshot = await castReviewedSpell('heaven-piercing-spear-v1', [], {
    targeting:{mode:'point',x:65,y:50,distanceCells:11}
  }, {areaMode:'line',areaRadius:18,areaWidth:0.5,areaAnchorPoint:{x:65,y:50}}, Array(30).fill(0));
  assert.strictEqual(reviewedSnapshot.room.combatEvent.areaMode, 'line', 'Копьё Небесного Прорыва remains an 18-cell line in the network result');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.results.length, 2, 'both creatures on the line resolve their own save');
  assert.ok(reviewedSnapshot.room.combatEvent.results.every((result) => result.damage === 7 && result.statuses.includes('reaction-lock')));
  assert.strictEqual(reviewedSnapshot.room.combatEvent.results.find((result) => result.key === spellEnemyAKey).rollMode, 'disadvantage', 'metal armour automatically imposes disadvantage on the synchronized save');
  assert.ok([spellEnemyAKey,spellEnemyBKey].every((key) => {
    const entry = reviewedSnapshot.room.combat.order.find((item) => item.key === key);
    return entry.hp === 0 && entry.zeroHp && entry.zeroHp.state === 'awaiting-gm';
  }), 'the line spell leaves defeated creatures waiting for the GM fate decision');
  reviewedSnapshot = await spellPlayer.advanceCombat({operationId:'player-turn-after-heavenly-spear'});
  assert.ok([spellEnemyAKey,spellEnemyBKey].indexOf(reviewedSnapshot.room.combat.order[reviewedSnapshot.room.combat.turnIndex].key) < 0, 'the player can finish the spell turn and the cursor skips defeated creatures');
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = 0;
  [spellEnemyAKey,spellEnemyBKey].forEach((key) => {
    const entry = spellShared.data.rooms[spellRoomCode].combat.order.find((item) => item.key === key);
    entry.hp = 30;
    entry.skipRounds = false;
    entry.deadRoundOverride = false;
    delete entry.zeroHp;
  });
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-a').hp = 30;
  spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b').hp = 30;

  const orderBeforeReviewedSummon = reviewedSnapshot.room.combat.order.map((entry) => entry.key);
  reviewedSnapshot = await castReviewedSpell('raise-undead-v1', [spellHeroKey], {
    summonVariant:'skeleton',summonName:'Скелет',summonNameUk:'Скелет',summonCount:3,summonHp:10,summonAc:11,summonSpeed:6,summonInitiative:0,summonChargeCost:3,
    summonRequirementsConfirmed:true,
    targeting:{mode:'point',x:25,y:55,distanceCells:2}
  }, {}, [0.5]);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.summonTokens.length, 3, 'Призыв Нежити creates three real scene tokens');
  assert.doesNotMatch(reviewedSnapshot.room.combatEvent.text, /Арканист: эффект применён/, 'the public summon result never exposes the workflow placeholder target');
  assert.strictEqual(reviewedSnapshot.room.combat.order.length, orderBeforeReviewedSummon.length + 3, 'all three skeletons join the existing initiative order');
  assert.deepStrictEqual(reviewedSnapshot.room.combat.order.slice(0, orderBeforeReviewedSummon.length).map((entry) => entry.key), orderBeforeReviewedSummon, 'summoning preserves all existing initiative positions');
  assert.ok(reviewedSnapshot.room.combatEvent.summonTokens.every((token) => token.hp === 10 && token.ac === 11 && token.sourceRef.type === 'spell-summon'));
  assert.strictEqual(reviewedSnapshot.room.members[playerUid].character.abilityUsage['spell-1775568519798'].used, 3, 'three skeletons consume all three spell charges exactly once');
  assert.match(reviewedSnapshot.room.combatEvent.textUk, /скелети/, 'the synchronized summon result includes Ukrainian public text');
  const summonExpiryRound = reviewedSnapshot.room.combatEvent.summonTokens[0].summonExpiresRound;
  const creatureCaster = reviewedSnapshot.room.combat.order.find((entry) => entry && entry.summonedByUid === playerUid);
  assert.ok(creatureCaster && creatureCaster.tokenId, 'a summoned creature has an addressable combat and scene identity');
  const controlledSummonToken = spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === creatureCaster.tokenId);
  assert.strictEqual(controlledSummonToken.summonedByUid, playerUid, 'the scene token keeps the player control identity');
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = spellShared.data.rooms[spellRoomCode].combat.order.findIndex((entry) => entry.key === creatureCaster.key);
  const summonMoveX = Math.min(99, Number(controlledSummonToken.x) + 1);
  reviewedSnapshot = await spellPlayer.requestMovement(summonMoveX, controlledSummonToken.y, {
    x:controlledSummonToken.x,
    y:controlledSummonToken.y,
    tokenId:controlledSummonToken.id,
    participantKey:creatureCaster.key
  });
  const summonMovementRequestId = reviewedSnapshot.room.members[playerUid].movementRequest.id;
  assert.strictEqual(reviewedSnapshot.room.members[playerUid].movementRequest.participantKey, creatureCaster.key, 'the movement request addresses the summoned combatant rather than the hero');
  reviewedSnapshot = await spellMaster.resolveMovement(playerUid, true);
  assert.strictEqual(reviewedSnapshot.room.scene.tokens.find((token) => token.id === controlledSummonToken.id).x, summonMoveX, 'the GM approval moves the exact summoned token');
  assert.strictEqual(reviewedSnapshot.room.combat.order.find((entry) => entry.key === creatureCaster.key).economy.movement, 5, 'only the summoned creature movement economy is spent');
  assert.strictEqual(reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellHeroKey).economy.movement, 6, 'the summoner hero movement economy remains untouched');
  await spellPlayer.acknowledgeMovement(summonMovementRequestId);

  const summonTarget = spellShared.data.rooms[spellRoomCode].scene.tokens.find((token) => token.id === 'spell-enemy-b');
  summonTarget.x = Math.min(99, summonMoveX + 1);
  summonTarget.y = controlledSummonToken.y;
  queueDeterministicRandom(0.99);
  reviewedSnapshot = await spellPlayer.requestAction('Скелет атакует ржавым клинком', 'combat-attack', '', {
    participantKey:creatureCaster.key,
    targetKey:spellEnemyBKey,
    weaponId:'undead-strike',
    statKey:'str',
    masteryBonus:0,
    mode:'normal'
  });
  const summonAttackRequestId = reviewedSnapshot.room.members[playerUid].actionRequest.id;
  assert.strictEqual(reviewedSnapshot.room.members[playerUid].actionRequest.name, creatureCaster.name, 'the player request is shown as the summoned attacker');
  assert.strictEqual(reviewedSnapshot.room.members[playerUid].actionRequest.details.participantKey, creatureCaster.key, 'the attack request preserves the summoned participant key');
  reviewedSnapshot = await spellMaster.resolveAction(playerUid, true, {mode:'normal'});
  reviewedSnapshot = await spellPlayer.requestApprovedAttackRoll(summonAttackRequestId);
  reviewedSnapshot = await spellMaster.resolveCombatAttack(spellEnemyBKey, {
    operationId:'player-controlled-undead-hit',
    weaponId:'undead-strike',
    statKey:'str',
    masteryBonus:0,
    mode:'normal'
  }, creatureCaster.key);
  assert.strictEqual(reviewedSnapshot.room.combatEvent.actorKey, creatureCaster.key, 'the synchronized attack is attributed to the summoned creature');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.creatureRoll, false, 'a player-controlled summon uses the visible player roll flow');
  assert.strictEqual(reviewedSnapshot.room.combatEvent.hit, true, 'the summoned creature can complete its attack roll');
  reviewedSnapshot = await spellMaster.finishApprovedAttackRoll(playerUid, summonAttackRequestId, true, reviewedSnapshot.room.combatEvent.id, '', true, false);
  reviewedSnapshot = await spellPlayer.requestApprovedDamageRoll(summonAttackRequestId);
  queueDeterministicRandom(0.5);
  const targetHpBeforeSummonDamage = reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyBKey).hp;
  reviewedSnapshot = await spellMaster.resolveCombatDamage(spellEnemyBKey, {
    operationId:'player-controlled-undead-damage',
    weaponId:'undead-strike',
    statKey:'str'
  }, creatureCaster.key);
  assert.ok(reviewedSnapshot.room.combat.order.find((entry) => entry.key === spellEnemyBKey).hp < targetHpBeforeSummonDamage, 'the summon damage is applied to the selected target');
  reviewedSnapshot = await spellMaster.finishApprovedDamageRoll(playerUid, summonAttackRequestId, true, reviewedSnapshot.room.combatEvent.id, '');
  reviewedSnapshot = await spellPlayer.advanceCombat({operationId:'player-controlled-undead-turn'});
  assert.notStrictEqual(reviewedSnapshot.room.combat.order[reviewedSnapshot.room.combat.turnIndex].key, creatureCaster.key, 'the summoning player can finish the undead turn');
  spellShared.data.rooms[spellRoomCode].combat.round = summonExpiryRound - 1;
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = spellShared.data.rooms[spellRoomCode].combat.order.length - 1;
  reviewedSnapshot = await spellMaster.advanceCombat({operationId:'expire-reviewed-undead'});
  assert.ok(!reviewedSnapshot.room.combat.order.some((entry) => entry && entry.summonedByUid === playerUid), 'expired undead leave the combat order');
  assert.ok(!reviewedSnapshot.room.scene.tokens.some((token) => token && token.summonedByUid === playerUid), 'expired undead tokens are removed from the scene');
  assert.match(reviewedSnapshot.room.combatEvent.textUk, /нежить зникла/, 'summon expiry is announced bilingually');

  const originalAutomatedSpells = spellAutomation.catalog().slice(4);
  assert.strictEqual(originalAutomatedSpells.length, 15, 'the condition matrix covers the fifteen original automated spells separately from the four newer level-one profiles');
  const conditionCharacter = spellShared.data.rooms[spellRoomCode].members[playerUid].character;
  const conditionActor = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellHeroKey);
  function prepareOnlyConditionSpell(profile) {
    const catalogEntry = reviewedCatalogEntries.get(String(profile.catalogId));
    assert.ok(catalogEntry && ['kodex','folio','obrad'].includes(catalogEntry.spellType), `${profile.automationKey} has a preparation family for the condition matrix`);
    conditionCharacter.preparedSpells = {kodex:[],folio:[],obrad:[]};
    conditionCharacter.preparedSpells[catalogEntry.spellType] = [String(profile.catalogId)];
  }
  function conditionSpellDetails(profile, suffix) {
    return reviewedSpellDetails(profile.automationKey, {
      operationId:`condition-${profile.automationKey}-${suffix}`,
      targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:1},
      summonRequirementsConfirmed:true
    });
  }
  async function expectDetailedSpellCode(operation, code, profile, reason) {
    let thrown = null;
    try { await operation(); } catch (error) { thrown = error; }
    assert.ok(thrown, `${profile.automationKey} must reject ${reason}`);
    assert.strictEqual(thrown.code, code, `${profile.automationKey} returns the stable ${reason} code`);
    assert.ok(String(thrown.message || '').trim().length >= 8, `${profile.automationKey} explains ${reason} to the acting client`);
  }
  for (const profile of originalAutomatedSpells) {
    const spellId = String(profile.catalogId);
    const resourceKey = `spell-${spellId}`;
    const savedRefs = conditionCharacter.spellRefs.slice();
    const savedLearned = conditionCharacter.spellsLearned[spellId];
    const savedPrepared = clone(conditionCharacter.preparedSpells);
    const savedUsage = clone(conditionCharacter.abilityUsage[resourceKey]);
    delete conditionCharacter.abilityUsage[resourceKey];

    conditionCharacter.spellRefs = conditionCharacter.spellRefs.filter((id) => String(id) !== spellId);
    await expectDetailedSpellCode(() => spellPlayer.requestAction('Проверка отсутствующего заклинания', 'ability', '', conditionSpellDetails(profile, 'not-owned')), 'spell-not-owned', profile, 'not-owned');
    assert.strictEqual(conditionCharacter.actionRequest, undefined, `${profile.automationKey} does not notify the GM about a request rejected before submission`);
    conditionCharacter.spellRefs = savedRefs;

    conditionCharacter.spellsLearned[spellId] = false;
    await expectDetailedSpellCode(() => spellPlayer.requestAction('Проверка неизученного заклинания', 'ability', '', conditionSpellDetails(profile, 'not-learned')), 'spell-not-learned', profile, 'not-learned');
    conditionCharacter.spellsLearned[spellId] = true;

    conditionCharacter.preparedSpells = {kodex:[],folio:[],obrad:[]};
    await expectDetailedSpellCode(() => spellPlayer.requestAction('Проверка неподготовленного заклинания', 'ability', '', conditionSpellDetails(profile, 'not-prepared')), 'spell-not-prepared', profile, 'not-prepared');
    prepareOnlyConditionSpell(profile);

    conditionActor.statuses = ['silence'];
    conditionActor.statusEffects = [{statusKey:'silence',label:'Магическая немота'}];
    conditionCharacter.statuses = ['silence'];
    conditionCharacter.statusEffects = [{statusKey:'silence',label:'Магическая немота'}];
    await expectDetailedSpellCode(() => spellPlayer.requestAction('Проверка немоты', 'ability', '', conditionSpellDetails(profile, 'silenced')), 'combat-status-blocked', profile, 'silenced');
    conditionActor.statuses = [];
    conditionActor.statusEffects = [];
    conditionCharacter.statuses = [];
    conditionCharacter.statusEffects = [];

    const battleScopeKey = `battle-${spellShared.data.rooms[spellRoomCode].combat.battleStartedAt}`;
    conditionCharacter.abilityUsage[resourceKey] = {
      used:Math.max(1, Number(profile.maxUses) || 1),
      max:Math.max(1, Number(profile.maxUses) || 1),
      scopeKey:profile.resourceScopeKind === 'battle' ? battleScopeKey : '',
      scopeKind:profile.resourceScopeKind,
      availableAt:profile.resourceScopeKind === 'two-days' ? Date.now() + 86400000 : 0
    };
    await expectDetailedSpellCode(() => spellPlayer.requestAction('Проверка исчерпанного ресурса', 'ability', '', conditionSpellDetails(profile, 'exhausted')), 'ability-exhausted', profile, 'exhausted');

    conditionCharacter.spellRefs = savedRefs;
    conditionCharacter.spellsLearned[spellId] = savedLearned;
    conditionCharacter.preparedSpells = savedPrepared;
    if (savedUsage === undefined) delete conditionCharacter.abilityUsage[resourceKey];
    else conditionCharacter.abilityUsage[resourceKey] = savedUsage;
  }

  const staleStatusProfile = originalAutomatedSpells.find((profile) => profile.automationKey === 'salvation-touch-v1');
  prepareOnlyConditionSpell(staleStatusProfile);
  delete conditionCharacter.abilityUsage[`spell-${staleStatusProfile.catalogId}`];
  conditionActor.economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};
  spellShared.data.rooms[spellRoomCode].combat.turnIndex = spellShared.data.rooms[spellRoomCode].combat.order.findIndex((entry) => entry.key === spellHeroKey);
  const staleStatusDetails = conditionSpellDetails(staleStatusProfile, 'status-changed-after-request');
  staleStatusDetails.targeting = {mode:'token',tokenId:'spell-ally',targetKey:'token:spell-ally',targetName:'Союзный разведчик',distanceCells:1};
  let staleStatusSnapshot = await spellPlayer.requestAction('Проверяет состояние перед финальным применением', 'ability', '', staleStatusDetails);
  const staleStatusRequestId = staleStatusSnapshot.room.members[playerUid].actionRequest.id;
  const staleStatusCharacter = spellShared.data.rooms[spellRoomCode].members[playerUid].character;
  const staleStatusActor = spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellHeroKey);
  staleStatusActor.statuses = ['silence'];
  staleStatusActor.statusEffects = [{statusKey:'silence',label:'Магическая немота'}];
  staleStatusCharacter.statuses = ['silence'];
  staleStatusCharacter.statusEffects = [{statusKey:'silence',label:'Магическая немота'}];
  await expectDetailedSpellCode(() => spellMaster.prepareCombatAbilityWorkflow(playerUid, ['token:spell-ally'], {}), 'combat-status-blocked', staleStatusProfile, 'status-changed-before-first-roll');
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellEnemyAKey).hp, 30, 'a newly silenced caster applies no spell damage');
  assert.strictEqual(spellShared.data.rooms[spellRoomCode].members[playerUid].character.abilityUsage[`spell-${staleStatusProfile.catalogId}`], undefined, 'a newly silenced caster spends no charge');
  staleStatusActor.statuses = [];
  staleStatusActor.statusEffects = [];
  staleStatusCharacter.statuses = [];
  staleStatusCharacter.statusEffects = [];
  await spellMaster.resolveAction(playerUid, false);
  await spellPlayer.acknowledgeAction(staleStatusRequestId);

  async function expectSpellResolveRestriction(automationKey, targetKeys, detailOverrides, resolveOverrides, expectedCode, mutateRoom) {
    const profile = originalAutomatedSpells.find((candidate) => candidate.automationKey === automationKey);
    assert.ok(profile, `${automationKey} belongs to the original fifteen-spell restriction matrix`);
    const room = spellShared.data.rooms[spellRoomCode];
    const character = room.members[playerUid].character;
    const actor = room.combat.order.find((entry) => entry.key === spellHeroKey);
    const catalogEntry = reviewedCatalogEntries.get(String(profile.catalogId));
    character.spellRefs = Array.from(new Set([].concat(character.spellRefs || [], String(profile.catalogId))));
    character.spellsLearned[String(profile.catalogId)] = true;
    character.preparedSpells = {kodex:[],folio:[],obrad:[]};
    character.preparedSpells[catalogEntry.spellType] = [String(profile.catalogId)];
    delete character.abilityUsage[`spell-${profile.catalogId}`];
    character.statuses = [];
    character.statusEffects = [];
    actor.statuses = [];
    actor.statusEffects = [];
    actor.hp = Math.max(1, Number(actor.hp) || Number(actor.hpMax) || 1);
    actor.economy = {long:1,short:1,reaction:1,movement:6,movementMax:6};
    room.combat.turnIndex = room.combat.order.findIndex((entry) => entry.key === spellHeroKey);
    const restore = typeof mutateRoom === 'function' ? mutateRoom(room) : null;
    const details = Object.assign(conditionSpellDetails(profile, `restriction-${expectedCode}`), detailOverrides || {});
    const requested = await spellPlayer.requestAction(`Проверяет ограничение «${profile.name}»`, 'ability', '', details);
    const requestId = requested.room.members[playerUid].actionRequest.id;
    const beforeEconomy = clone(spellShared.data.rooms[spellRoomCode].combat.order.find((entry) => entry.key === spellHeroKey).economy);
    await expectDetailedSpellCode(() => spellMaster.resolveCombatAbility(playerUid, targetKeys, resolveOverrides || {}), expectedCode, profile, expectedCode);
    const rejectedRoom = spellShared.data.rooms[spellRoomCode];
    assert.deepStrictEqual(rejectedRoom.combat.order.find((entry) => entry.key === spellHeroKey).economy, beforeEconomy, `${automationKey} rejection spends no action`);
    assert.strictEqual(rejectedRoom.members[playerUid].character.abilityUsage[`spell-${profile.catalogId}`], undefined, `${automationKey} rejection spends no charge`);
    if (typeof restore === 'function') restore(rejectedRoom);
    await spellMaster.resolveAction(playerUid, false);
    await spellPlayer.acknowledgeAction(requestId);
  }

  const fingerRestrictionProfile = originalAutomatedSpells.find((profile) => profile.automationKey === 'finger-heat-v1');
  {
    const room = spellShared.data.rooms[spellRoomCode];
    const character = room.members[playerUid].character;
    const actor = room.combat.order.find((entry) => entry.key === spellHeroKey);
    const catalogEntry = reviewedCatalogEntries.get(String(fingerRestrictionProfile.catalogId));
    character.preparedSpells = {kodex:[],folio:[],obrad:[]};
    character.preparedSpells[catalogEntry.spellType] = [String(fingerRestrictionProfile.catalogId)];
    delete character.abilityUsage[`spell-${fingerRestrictionProfile.catalogId}`];
    actor.economy.long = 1;
    const farToken = room.scene.tokens.find((token) => token.id === 'spell-enemy-a');
    const previousPoint = {x:farToken.x,y:farToken.y};
    farToken.x = 90;
    farToken.y = 50;
    const details = conditionSpellDetails(fingerRestrictionProfile, 'restriction-range');
    details.targeting = {mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Латник',distanceCells:20};
    const requested = await spellPlayer.requestAction('Проверяет дальность «Жара Пальцев»', 'ability', '', details);
    const requestId = requested.room.members[playerUid].actionRequest.id;
    await expectDetailedSpellCode(() => spellMaster.prepareCombatAbilityRoll(playerUid, spellEnemyAKey, 'attack'), 'combat-target-range', fingerRestrictionProfile, 'one-cell-range');
    const currentRoom = spellShared.data.rooms[spellRoomCode];
    currentRoom.scene.tokens.find((token) => token.id === 'spell-enemy-a').x = previousPoint.x;
    currentRoom.scene.tokens.find((token) => token.id === 'spell-enemy-a').y = previousPoint.y;
    await spellMaster.resolveAction(playerUid, false);
    await spellPlayer.acknowledgeAction(requestId);
  }

  await expectSpellResolveRestriction('salvation-touch-v1', [spellEnemyAKey], {
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Нежить',distanceCells:1}
  }, {}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === spellEnemyAKey);
    const previous = target.name;
    target.name = 'Нежить-страж';
    return (latestRoom) => { latestRoom.combat.order.find((entry) => entry.key === spellEnemyAKey).name = previous; };
  });
  await expectSpellResolveRestriction('fire-projectile-v1', [], {
    targeting:{mode:'point',x:90,y:50,distanceCells:20}
  }, {areaMode:'circle',areaRadius:2,areaAnchorPoint:{x:90,y:50}}, 'combat-target-range', (room) => {
    const token = room.scene.tokens.find((item) => item.id === 'spell-enemy-a');
    const previous = {x:token.x,y:token.y};
    token.x = 90;
    token.y = 50;
    return (latestRoom) => { const latest = latestRoom.scene.tokens.find((item) => item.id === 'spell-enemy-a'); latest.x = previous.x; latest.y = previous.y; };
  });
  await expectSpellResolveRestriction('lightning-lasso-v1', [spellEnemyAKey], {
    playbackVariant:'restrain',targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Призрак',distanceCells:1}
  }, {}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === spellEnemyAKey);
    const previous = target.name;
    target.name = 'Призрак дозорного';
    return (latestRoom) => { latestRoom.combat.order.find((entry) => entry.key === spellEnemyAKey).name = previous; };
  });
  await expectSpellResolveRestriction('raise-undead-v1', [spellHeroKey], {
    summonRequirementsConfirmed:false,targeting:{mode:'point',x:22,y:52,distanceCells:1}
  }, {}, 'summon-requirements');
  await expectSpellResolveRestriction('pseudo-life-v1', [spellEnemyAKey], {
    playbackVariant:'stable',targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Враг',distanceCells:1}
  }, {}, 'combat-target-invalid');
  await expectSpellResolveRestriction('energy-protection-v1', [spellEnemyAKey], {
    energyResistance:'fire',targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Враг',distanceCells:1}
  }, {}, 'combat-target-invalid');
  await expectSpellResolveRestriction('silence-seal-v1', [], {
    targeting:{mode:'point',x:90,y:50,distanceCells:20}
  }, {areaMode:'circle',areaRadius:5,areaAnchorPoint:{x:90,y:50}}, 'combat-target-range');
  await expectSpellResolveRestriction('misty-transition-v1', [spellHeroKey], {
    targeting:{mode:'point',x:90,y:50,distanceCells:20}
  }, {}, 'combat-target-range');
  await expectSpellResolveRestriction('gravity-center-v1', [], {
    targeting:{mode:'point',x:23,y:50,distanceCells:1}
  }, {areaMode:'circle',areaRadius:5,areaAnchorPoint:{x:23,y:50},pullTowardPoint:true,pullCells:5}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === spellEnemyAKey);
    const token = room.scene.tokens.find((entry) => entry.id === 'spell-enemy-a');
    const previous = {sizeCategory:target.sizeCategory,creatureSize:target.creatureSize,sourceRef:clone(target.sourceRef),x:token.x,y:token.y};
    target.sizeCategory = 'huge';
    target.creatureSize = 'huge';
    target.sourceRef = Object.assign({}, target.sourceRef || {}, {size:'huge'});
    token.x = 23;
    token.y = 50;
    return (latestRoom) => { const latest = latestRoom.combat.order.find((entry) => entry.key === spellEnemyAKey); latest.sizeCategory = previous.sizeCategory; latest.creatureSize = previous.creatureSize; latest.sourceRef = previous.sourceRef; const latestToken = latestRoom.scene.tokens.find((entry) => entry.id === 'spell-enemy-a'); latestToken.x = previous.x; latestToken.y = previous.y; };
  });
  await expectSpellResolveRestriction('psychic-screech-v1', [spellEnemyAKey], {
    targeting:{mode:'token',tokenId:'spell-enemy-a',targetKey:spellEnemyAKey,targetName:'Конструкт',distanceCells:1}
  }, {}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === spellEnemyAKey);
    const previous = target.name;
    target.name = 'Безразумный конструкт';
    return (latestRoom) => { latestRoom.combat.order.find((entry) => entry.key === spellEnemyAKey).name = previous; };
  });
  await expectSpellResolveRestriction('hypnotic-pattern-v1', [], {
    targeting:{mode:'point',x:23,y:50,distanceCells:1}
  }, {areaMode:'square',areaRadius:2,areaWidth:4,areaAnchorPoint:{x:23,y:50}}, 'combat-target-invalid', (room) => {
    const touched = room.combat.order.map((entry) => ({key:entry.key,statuses:clone(entry.statuses),statusEffects:clone(entry.statusEffects)}));
    room.combat.order.forEach((entry) => { entry.statuses = ['blind']; entry.statusEffects = [{statusKey:'blind'}]; });
    room.members[playerUid].character.statuses = ['blind'];
    room.members[playerUid].character.statusEffects = [{statusKey:'blind'}];
    return (latestRoom) => {
      touched.forEach((saved) => { const entry = latestRoom.combat.order.find((item) => item.key === saved.key); if (entry) { entry.statuses = saved.statuses; entry.statusEffects = saved.statusEffects; } });
      latestRoom.members[playerUid].character.statuses = [];
      latestRoom.members[playerUid].character.statusEffects = [];
    };
  });
  await expectSpellResolveRestriction('remove-curse-v1', ['token:spell-ally'], {
    targeting:{mode:'token',tokenId:'spell-ally',targetKey:'token:spell-ally',targetName:'Союзный разведчик',distanceCells:1}
  }, {}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === 'token:spell-ally');
    const previous = {statuses:clone(target.statuses),statusEffects:clone(target.statusEffects)};
    target.statuses = [];
    target.statusEffects = [];
    return (latestRoom) => { const latest = latestRoom.combat.order.find((entry) => entry.key === 'token:spell-ally'); latest.statuses = previous.statuses; latest.statusEffects = previous.statusEffects; };
  });
  await expectSpellResolveRestriction('life-transfer-v1', ['token:spell-ally'], {
    targeting:{mode:'token',tokenId:'spell-ally',targetKey:'token:spell-ally',targetName:'Конструкт-союзник',distanceCells:1}
  }, {}, 'combat-target-invalid', (room) => {
    const target = room.combat.order.find((entry) => entry.key === 'token:spell-ally');
    const previous = target.name;
    target.name = 'Конструкт-союзник';
    return (latestRoom) => { latestRoom.combat.order.find((entry) => entry.key === 'token:spell-ally').name = previous; };
  });

  {
    const profile = originalAutomatedSpells.find((candidate) => candidate.automationKey === 'heaven-piercing-spear-v1');
    const room = spellShared.data.rooms[spellRoomCode];
    const character = room.members[playerUid].character;
    const catalogEntry = reviewedCatalogEntries.get(String(profile.catalogId));
    character.preparedSpells = {kodex:[],folio:[],obrad:[]};
    character.preparedSpells[catalogEntry.spellType] = [String(profile.catalogId)];
    delete character.abilityUsage[`spell-${profile.catalogId}`];
    room.combat.order.find((entry) => entry.key === spellHeroKey).economy.long = 1;
    const details = conditionSpellDetails(profile, 'restriction-line-gate');
    details.targeting = {mode:'point',x:65,y:50,distanceCells:11};
    const requested = await spellPlayer.requestAction('Проверяет преграду «Копья Небесного Прорыва»', 'ability', '', details);
    const requestId = requested.room.members[playerUid].actionRequest.id;
    const gated = await spellMaster.prepareCombatAbilityWorkflow(playerUid, [spellEnemyAKey], {});
    assert.strictEqual(gated.room.members[playerUid].actionRequest.status, 'ability-workflow-gate-ready', 'the spear cannot start saves before the GM confirms the line barrier gate');
    assert.strictEqual(gated.room.members[playerUid].actionRequest.abilityResolution.workflow.activeAssignmentId, 'line-clear');
    assert.strictEqual(gated.room.members[playerUid].character.abilityUsage[`spell-${profile.catalogId}`], undefined, 'the line gate spends no charge before confirmation');
    const cancelled = await spellMaster.advanceCombatAbilityWorkflow(playerUid, {cancel:true});
    assert.strictEqual(cancelled.room.members[playerUid].actionRequest.status, 'rejected');
    await spellPlayer.acknowledgeAction(requestId);
  }

  reviewedSnapshot = await spellMaster.endCombat();
  assert.ok(!reviewedSnapshot.room.members[playerUid].character.spellLearningEffects.some((effect) => effect && effect.kind === 'range-penalty' && effect.until === 'next-battle'), 'the range penalty is consumed when that next battle ends');
  assert.strictEqual(reviewedLearningApprovals.size, spellAutomation.catalog().length, 'all nineteen spells and abilities complete the player learning request and GM approval');
  assert.strictEqual(reviewedPlayerPreparations.size, spellAutomation.catalog().length, 'all nineteen spells and abilities are prepared through the real player character sync');
  assert.strictEqual(reviewedPlayerCasts.size, spellAutomation.catalog().length, 'all nineteen reviewed profiles complete their real player → Firebase → GM flow');

  const customRoomCode = 'CUSTOM1';
  const customShared = createSharedFirebase({rooms:{[customRoomCode]:{
    code:customRoomCode,phase:'session',masterUid,
    members:{
      [masterUid]:{uid:masterUid,role:'master',name:'ГМ'},
      [playerUid]:{uid:playerUid,role:'player',name:'Игрок',character:{id:'custom-hero',name:'Исследователь',hpCur:10,hpMax:10,stats:{str:0,dex:1,int:2,cha:0,per:3,con:1},statuses:[],statusEffects:[]}}
    },updatedAt:1
  }}});
  const customMaster = createClient(customShared, masterUid, 'master', customRoomCode);
  const customPlayer = createClient(customShared, playerUid, 'player', customRoomCode);
  const longCustomText = 'Пытается внимательно разобрать древний механизм, сопоставляя потёртые руны, положение шестерёнок и следы недавнего вмешательства. '.repeat(4).trim();
  let customSnapshot = await customPlayer.requestAction(longCustomText, 'custom', '', {x:48,y:36,tokenId:'ancient-device'});
  const customRequestId = customSnapshot.room.members[playerUid].actionRequest.id;
  assert.ok(customSnapshot.room.members[playerUid].actionRequest.text.length > 300, 'custom action text survives beyond the old 300-character limit');
  customSnapshot = await customMaster.configureCombatIntent(playerUid, {mode:'check',actorStat:'per',dc:15});
  assert.strictEqual(customSnapshot.room.members[playerUid].actionRequest.status, 'roll-requested', 'the GM can request a characteristic check outside combat');
  assert.strictEqual(customSnapshot.room.members[playerUid].actionRequest.resolution.actorStat, 'per');
  assert.ok(customSnapshot.room.combat == null, 'a free-room custom check does not create or require combat state');
  queueDeterministicRandom(0.7);
  customSnapshot = await customPlayer.rollCombatIntent(customRequestId);
  assert.strictEqual(customSnapshot.room.members[playerUid].actionRequest.status, 'roll-result', 'the free-room player result returns to the same request');
  assert.strictEqual(customSnapshot.room.members[playerUid].actionRequest.result.actorModifier, 3, 'the check uses the requested character stat');
  customSnapshot = await customMaster.finishCombatIntent(playerUid, true);
  assert.strictEqual(customSnapshot.room.members[playerUid].actionRequest.status, 'approved', 'the GM can accept the free-room check result');
  console.log('two-client combat scenario passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
