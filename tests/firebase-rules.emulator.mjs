import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  get,
  ref,
  set,
  update
} from 'firebase/database';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '..');
const rules = fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8');
const emulatorAddress = String(process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000');
const separator = emulatorAddress.lastIndexOf(':');
const host = separator >= 0 ? emulatorAddress.slice(0, separator) : emulatorAddress;
const port = separator >= 0 ? Number(emulatorAddress.slice(separator + 1)) : 9000;

const testEnv = await initializeTestEnvironment({
  projectId: 'zargota-vtt-rules-test',
  database: { rules, host, port }
});

const roomCode = 'RULES1';
const roomPath = `rooms/${roomCode}`;
const masterUid = 'master-1';
const playerUid = 'player-1';
const otherUid = 'player-2';
const outsiderUid = 'outsider-1';

const seedRoom = {
  masterUid,
  phase: 'combat',
  updatedAt: 1,
  worldClock: { totalMinutes:0, day:1, minuteOfDay:0, revision:0 },
  members: {
    [masterUid]: { uid: masterUid, role: 'master', name: 'ГМ' },
    [playerUid]: {
      uid: playerUid,
      role: 'player',
      name: 'Игрок 1',
      characterId: 'hero-1',
      character: { id: 'hero-1', name: 'Герой 1', hpCur: 10, hpMax: 10 }
    },
    [otherUid]: {
      uid: otherUid,
      role: 'player',
      name: 'Игрок 2',
      characterId: 'hero-2',
      character: { id: 'hero-2', name: 'Герой 2', hpCur: 12, hpMax: 12 }
    }
  },
  combat: {
    active: true,
    turnIndex: 0,
    round: 1,
    order: [
      { key: 'member:player-1', uid: playerUid, hp: 10 },
      { key: 'member:player-2', uid: otherUid, hp: 12 }
    ]
  }
};

try {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), roomPath), seedRoom);
  });

  const unauthenticated = testEnv.unauthenticatedContext().database();
  const master = testEnv.authenticatedContext(masterUid).database();
  const player = testEnv.authenticatedContext(playerUid).database();
  const outsider = testEnv.authenticatedContext(outsiderUid).database();

  await assertFails(get(ref(unauthenticated, roomPath)));
  await assertFails(set(ref(unauthenticated, `${roomPath}/updatedAt`), 2));

  await assertSucceeds(get(ref(master, roomPath)));
  await assertSucceeds(get(ref(player, roomPath)));
  await assertSucceeds(get(ref(outsider, roomPath)));

  const privateDeliveryPath = `privateDeliveries/${roomCode}/${playerUid}/private-1`;
  await assertSucceeds(set(ref(master, privateDeliveryPath), {
    id: 'private-1',
    kind: 'text',
    mood: 'ominous',
    presentation: 'card',
    privateDelivery: true,
    showPopup: true,
    title: 'Только для тебя',
    text: 'Остальные игроки этого не видят.',
    image: '',
    status: 'pending',
    createdAt: 1,
    createdBy: masterUid
  }));
  await assertSucceeds(get(ref(master, privateDeliveryPath)));
  await assertSucceeds(get(ref(player, privateDeliveryPath)));
  await assertFails(get(ref(testEnv.authenticatedContext(otherUid).database(), privateDeliveryPath)));
  await assertFails(get(ref(outsider, privateDeliveryPath)));
  await assertFails(set(ref(player, `privateDeliveries/${roomCode}/${playerUid}/private-forged`), {
    id: 'private-forged',
    kind: 'text',
    mood: 'calm',
    presentation: 'card',
    privateDelivery: true,
    showPopup: true,
    title: 'Подделка',
    text: 'Игрок не может создавать скрытые сообщения.',
    status: 'pending',
    createdAt: 1,
    createdBy: masterUid
  }));
  await assertFails(update(ref(testEnv.authenticatedContext(otherUid).database(), privateDeliveryPath), {
    status: 'applied',
    resolvedAt: 2
  }));
  await assertFails(update(ref(player, privateDeliveryPath), {
    title: 'Игрок не может менять текст'
  }));
  await assertSucceeds(update(ref(player, privateDeliveryPath), {
    status: 'applied',
    resolvedAt: 2
  }));

  await assertSucceeds(update(ref(master, roomPath), {
    [`members/${playerUid}/gmDeliveries/delivery-1`]: {
      id: 'delivery-1',
      kind: 'item',
      title: 'Награда',
      status: 'pending'
    },
    [`members/${otherUid}/character/hpCur`]: 8,
    'combat/updatedAt': 2,
    updatedAt: 2
  }));
  await assertSucceeds(update(ref(master, `${roomPath}/worldClock`), {
    totalMinutes: 60,
    day: 1,
    minuteOfDay: 60,
    revision: 1,
    updatedAt: 2,
    updatedBy: masterUid,
    appliedOperationIds: { 'world-time-rules': 2 },
    lastOperation: {
      operationId: 'world-time-rules',
      beforeMinutes: 0,
      afterMinutes: 60,
      deltaMinutes: 60,
      uid: masterUid,
      ts: 2
    }
  }));
  await assertFails(set(ref(player, `${roomPath}/worldClock/totalMinutes`), 120));

  await assertSucceeds(set(ref(player, `${roomPath}/members/${playerUid}/actionRequest`), {
    id: 'ability-1',
    uid: playerUid,
    actionKind: 'ability',
    status: 'pending'
  }));
  await assertSucceeds(update(ref(player, `${roomPath}/members/${playerUid}`), {
    'gmDeliveries/delivery-1/status': 'accepted'
  }));
  await assertSucceeds(set(ref(player, `${roomPath}/members/${playerUid}/character/hpCur`), 9));
  await assertFails(set(ref(player, `${roomPath}/members/${playerUid}/role`), 'master'));
  await assertFails(set(ref(player, `${roomPath}/members/${otherUid}/actionRequest`), {
    id: 'forbidden-request',
    uid: otherUid,
    status: 'pending'
  }));

  // Current shared combat flow deliberately allows an authenticated room
  // member to write a character subtree and the combat state. This preserves
  // player HP/healing updates and ending a turn; tightening it requires a
  // separate product decision and a server-authoritative command layer.
  await assertSucceeds(set(ref(player, `${roomPath}/members/${otherUid}/character/hpCur`), 7));
  await assertSucceeds(update(ref(player, `${roomPath}/combat`), {
    turnIndex: 1,
    updatedAt: 3
  }));
  await assertSucceeds(set(ref(player, `${roomPath}/updatedAt`), 3));
  await assertSucceeds(set(ref(player, `${roomPath}/ping`), {
    id: 'ping-player',
    uid: playerUid,
    x: 40,
    y: 60,
    focus: false,
    zoom: 1,
    createdAt: 3
  }));
  await assertFails(set(ref(player, `${roomPath}/ping`), {
    id: 'ping-player-focus',
    uid: playerUid,
    x: 40,
    y: 60,
    focus: true,
    zoom: 1,
    createdAt: 4
  }));
  await assertSucceeds(set(ref(master, `${roomPath}/ping`), {
    id: 'ping-master-focus',
    uid: masterUid,
    x: 50,
    y: 50,
    focus: true,
    zoom: 1.5,
    createdAt: 5
  }));

  await assertFails(set(ref(outsider, `${roomPath}/updatedAt`), 4));
  await assertFails(set(ref(outsider, `${roomPath}/combat/turnIndex`), 0));
  await assertFails(set(ref(outsider, `${roomPath}/members/${playerUid}/character/hpCur`), 1));
  await assertFails(update(ref(player, roomPath), {
    scene: { id: 'forbidden-scene' }
  }));

  const finalRoom = (await get(ref(master, roomPath))).val();
  assert.equal(finalRoom.members[playerUid].gmDeliveries['delivery-1'].status, 'accepted');
  assert.equal(finalRoom.members[playerUid].character.hpCur, 9);
  assert.equal(finalRoom.members[otherUid].character.hpCur, 7);
  assert.equal(finalRoom.combat.turnIndex, 1);
  assert.equal(finalRoom.worldClock.totalMinutes, 60);
  const finalPrivateDelivery = (await get(ref(master, privateDeliveryPath))).val();
  assert.equal(finalPrivateDelivery.status, 'applied');
  assert.equal(finalPrivateDelivery.resolvedAt, 2);
  await assertSucceeds(set(ref(master, `privateDeliveries/${roomCode}`), null));

  console.log('firebase realtime database rules emulator matrix passed');
} finally {
  await testEnv.cleanup();
}
