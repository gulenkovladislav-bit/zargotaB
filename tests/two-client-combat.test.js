'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const networkPath = path.join(root, 'zargota-network.js');
const syncOutbox = require(path.join(root, 'character-sync-outbox.js'));
const originalNetwork = fs.readFileSync(networkPath, 'utf8');
const readyStart = originalNetwork.indexOf('  var ready = Promise.all([');
const readyEnd = originalNetwork.indexOf('\n\n  w.ZargotaRooms = api;', readyStart);
assert.ok(readyStart > 0 && readyEnd > readyStart, 'network bootstrap must remain injectable for the two-client harness');
const network = originalNetwork.slice(0, readyStart) +
  '  firebase=w.__testFirebase;auth=w.__testAuth;db=w.__testDb;connected=true;var ready=Promise.resolve(auth.currentUser);\n' +
  originalNetwork.slice(readyEnd);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
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

function deterministicMath() {
  const result = Object.create(Math);
  result.random = () => 0.5;
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
    ZargotaSyncOutbox:syncOutbox
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
            statuses:[],
            statusEffects:[]
          }
        }
      },
      scene:{
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
  let snapshot = await master.gmAddInventoryItem(playerUid, {
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
    stats:{ str:0, dex:0 },
    weaponProfiles:[{
      id:'enemy-claw',
      name:'Коготь',
      damageFormula:'1d4',
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
    }]
  }], {});
  assert.strictEqual(snapshot.room.combat.phase, 'initiative');
  assert.strictEqual(snapshot.room.combat.order.length, 2);

  await player.rollInitiative();
  await master.rollInitiative('training-enemy');
  snapshot = await master.beginCombatTurns();
  assert.strictEqual(snapshot.room.combat.active, true);
  assert.strictEqual(snapshot.room.combat.round, 1);
  assert.strictEqual(snapshot.room.combat.order[0].uid, playerUid, 'the player owns the opening turn');
  const enemyKey = snapshot.room.combat.order.find((entry) => entry.uid !== playerUid).key;
  const heroKey = snapshot.room.combat.order.find((entry) => entry.uid === playerUid).key;

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
  await player.requestApprovedAttackRoll(requestId);
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
  snapshot = await player.requestApprovedDamageRoll(requestId);
  assert.ok(snapshot.room.members[playerUid].actionRequest.damageRollRequestedAt > 0, 'damage roll has its own timestamp and cannot reuse the hit roll timer');
  snapshot = await master.resolveCombatDamage(`token:${enemyTokenId}`, {
    weaponId:'hero-bow',
    statKey:'dex'
  }, `member:${playerUid}`);
  assert.strictEqual(snapshot.room.combatEvent.damage, 6, '1d8 + 1 Dexterity must produce six deterministic damage');
  assert.strictEqual(snapshot.room.combat.order[1].hp, 3, 'enemy combat HP must decrease after spell and weapon damage');
  assert.strictEqual(snapshot.room.scene.tokens[0].hp, 3, 'enemy token HP must stay synchronized');
  await master.finishApprovedDamageRoll(playerUid, requestId, true, snapshot.room.combatEvent.id, '');

  const afterPlayerDamage = snapshot.room.combat.order[1].hp;
  snapshot = await player.advanceCombat({ operationId:'player-turn-1' });
  assert.strictEqual(snapshot.room.combat.turnIndex, 1, 'player can finish their own turn');
  const duplicateTurn = await player.advanceCombat({ operationId:'player-turn-1' });
  assert.strictEqual(duplicateTurn.room.combat.turnIndex, 1, 'retry cannot advance the turn twice');
  await expectCode(
    () => player.advanceCombat({ operationId:'player-illegal-turn' }),
    'turn-owner-only'
  );

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
  assert.strictEqual(snapshot.room.combatEvent.damage, 3, '1d4 creature damage must remain non-zero');
  assert.strictEqual(snapshot.room.combat.order[0].tempHp, 0, 'temporary HP absorbs creature damage first');
  assert.strictEqual(snapshot.room.combat.order[0].hp, 13, 'remaining creature damage reaches hero HP');
  assert.strictEqual(
    snapshot.room.members[playerUid].character.hpCur,
    snapshot.room.combat.order[0].hp,
    'combat damage must update the player character'
  );

  snapshot = await master.advanceCombat({ operationId:'enemy-turn-1' });
  assert.strictEqual(snapshot.room.combat.round, 2);
  assert.strictEqual(snapshot.room.combat.turnIndex, 0);
  assert.strictEqual(snapshot.room.combat.order[1].statusEffects[0].remainingRounds, 1, 'round status duration must decrease at the end of the affected turn');

  snapshot = await master.gmAdjustEntity({ memberUid:playerUid }, {
    kind:'status',
    statusKey:'silence',
    label:'Немота',
    enable:true,
    effect:{ durationUnit:'rounds', durationValue:1, icon:'🔇' }
  });
  snapshot = await player.requestAction('Пытается колдовать под немотой', 'ability', '', {
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
  });
  const silencedRequestId = snapshot.room.members[playerUid].actionRequest.id;
  await expectCode(() => master.resolveCombatAbility(playerUid, [enemyKey], {}), 'combat-status-blocked');
  await master.resolveAction(playerUid, false, {});
  await player.acknowledgeAction(silencedRequestId);
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
  assert.strictEqual(snapshot.room.combat.round, 3);
  assert.strictEqual(snapshot.room.combat.turnIndex, 0);
  assert.ok(!snapshot.room.combat.order[1].statuses.includes('marked'), 'expired round status must be removed');
  await expectCode(
    () => player.advanceCombat({ operationId:'zero-hp-before-death-save' }),
    'death-save-required'
  );
  snapshot = await player.rollDeathSave(heroKey);
  assert.strictEqual(snapshot.room.combat.order[0].zeroHp.lastRoll, 11, 'death save is rolled only after the player presses the die');
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
    'combat-zero-hp'
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
    'combat-zero-hp'
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

  await expectCode(() => player.endCombat(), 'master-only');
  snapshot = await master.endCombat();
  assert.ok(snapshot.room.combat == null, 'only the master ends combat');

  assert.ok(shared.writes.some((write) => write.uid === playerUid), 'the player client performed Firebase writes');
  assert.ok(shared.writes.some((write) => write.uid === masterUid), 'the master client performed Firebase writes');
  console.log('two-client combat scenario passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
