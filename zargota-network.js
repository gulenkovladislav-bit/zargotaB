(function (w) {
  'use strict';

  var SESSION_KEY = 'zargota_vtt_session_v4';
  var TAB_ID_KEY = 'zargota_vtt_tab_id_v1';
  var TAB_STARTED_KEY = 'zargota_vtt_tab_started_v1';
  var TAB_CHANNEL_NAME = 'zargota-session-tabs-v1';
  var SYNC_LOG_KEY = 'zargota_sync_events_v1';
  var CAMPAIGN_HERO_KEYS = {
    '1776627463516':'evan','1776626039651':'melissa','1776463717210':'esteros','1778221131899':'vrotik','1778221143711':'lin-yin'
  };
  var MAX_PLAYERS = 5;
  var FIREBASE_VERSION = '12.16.0';
  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyANMOAF1EtUSeMbjCTD_pcT8oHZFdzGRIA',
    authDomain: 'zargota-vtt.firebaseapp.com',
    databaseURL: 'https://zargota-vtt-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'zargota-vtt',
    storageBucket: 'zargota-vtt.firebasestorage.app',
    messagingSenderId: '921606613052',
    appId: '1:921606613052:web:59b1814c23c68d0ea2fb39'
  };

  var listeners = [];
  var firebase = null;
  var auth = null;
  var db = null;
  var currentRoom = null;
  var currentCampaign = null;
  var roomUnsubscribe = null;
  var privateDeliveriesUnsubscribe = null;
  var currentPrivateDeliveries = {};
  var connected = false;
  var initError = null;
  var createRoomPromise = null;
  var lastPingWriteAt = 0;
  var lastPingTrailWriteAt = 0;
  var combatEquipmentReconcileTimer = 0;
  var combatEquipmentReconcileBusy = false;
  var combatEquipmentReconcilePending = false;
  var networkPerformance = {
    writes:[], writeBytes:0, roomSnapshots:[], roomSnapshotBytes:0, roomSnapshotMaxBytes:0,
    writeKinds:{},
    roomWatchStarts:0, roomWatchStops:0, activeRoomWatches:0, maxRoomWatches:0,
    duplicateListenerAdds:0, maxApiListeners:0, connectionSubscriptions:0
  };
  var leaveRoomPromise = null;
  var outboxFlushPromise = null;
  var gameplayOutboxFlushPromise = null;
  var tabChannel = null;
  var tabPeers = Object.create(null);
  var tabHeartbeatTimer = 0;
  var tabWasSecondary = false;
  var presenceDisconnectHandles = [];
  var characterSync = {
    status: 'local',
    direction: '',
    reason: '',
    revision: 0,
    characterId: '',
    lastLocalAt: 0,
    lastAttemptAt: 0,
    lastAckAt: 0,
    error: ''
  };
  // Пока игрок прикрепляет героя к комнате, локальный лист является единственным
  // источником истины. Это защищает свежие правки от старого снимка комнаты.
  var characterEntryUpload = null;
  var characterInboundSession = null;

  function now() { return Date.now(); }

  function jsonBytes(value) {
    try { return new Blob([JSON.stringify(value == null ? null : value)]).size; }
    catch (error) { try { return JSON.stringify(value == null ? null : value).length; } catch (error2) { return 0; } }
  }

  function trimPerformanceRows(rows, cutoff) {
    while (rows.length && rows[0].time < cutoff) rows.shift();
  }

  function recordFirebaseWrite(kind, value, payloadKnown) {
    var time=now(),bytes=payloadKnown===false?0:jsonBytes(value);networkPerformance.writes.push({time:time,kind:kind,bytes:bytes});networkPerformance.writeBytes+=bytes;
    networkPerformance.writeKinds[kind]=(networkPerformance.writeKinds[kind]||0)+1;
    trimPerformanceRows(networkPerformance.writes,time-60000);
  }

  function trackedFirebaseWrite(kind, fn, valueIndex) {
    if(valueIndex==null)valueIndex=1;
    return function () {
      if (!tabCanWrite()) return Promise.reject(roomError('Эта сессия управляется другой вкладкой. Перехватите управление перед изменением данных.', 'tab-read-only'));
      recordFirebaseWrite(kind,valueIndex>=0&&arguments.length>valueIndex?arguments[valueIndex]:null,valueIndex>=0);
      return fn.apply(null, arguments);
    };
  }

  function performanceSnapshot() {
    var time=now();trimPerformanceRows(networkPerformance.writes,time-60000);trimPerformanceRows(networkPerformance.roomSnapshots,time-60000);
    return {
      writesPerMinute:networkPerformance.writes.length,
      writeBytesPerMinute:networkPerformance.writes.reduce(function(sum,row){return sum+row.bytes;},0),
      writeBytesTotal:networkPerformance.writeBytes,
      writeKinds:Object.assign({},networkPerformance.writeKinds),
      roomSnapshotsPerMinute:networkPerformance.roomSnapshots.length,
      roomSnapshotBytes:networkPerformance.roomSnapshotBytes,
      roomSnapshotMaxBytes:networkPerformance.roomSnapshotMaxBytes,
      subscriptions:{
        roomStarts:networkPerformance.roomWatchStarts,roomStops:networkPerformance.roomWatchStops,
        activeRoom:networkPerformance.activeRoomWatches,maxRoom:networkPerformance.maxRoomWatches,
        apiListeners:listeners.length,maxApiListeners:networkPerformance.maxApiListeners,
        duplicateListenerAdds:networkPerformance.duplicateListenerAdds,
        connection:networkPerformance.connectionSubscriptions
      }
    };
  }

  function syncIdentity(character) {
    return {
      characterId: String(character && character.id || ''),
      campaignKey: campaignKeyFor(character),
      revision: Math.max(0, Number(character && character.revision) || 0)
    };
  }

  function appendDiagnosticEvent(event) {
    try {
      var rows = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
      if (!Array.isArray(rows)) rows = [];
      rows.push(event);
      localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(rows.slice(-160)));
    } catch (e) {}
    return event;
  }

  function appendSyncEvent(character, direction, reason, result, error) {
    var session = readSession(), identity = syncIdentity(character);
    var event = {
      time: now(),
      category: 'character-sync',
      uid: String(session && session.uid || auth && auth.currentUser && auth.currentUser.uid || ''),
      roomCode: String(session && session.code || ''),
      characterId: identity.characterId,
      campaignKey: identity.campaignKey,
      direction: direction || '',
      reason: reason || '',
      revision: identity.revision,
      result: result || '',
      error: error ? String(error.message || error).slice(0, 300) : ''
    };
    return appendDiagnosticEvent(event);
  }

  function appendOperationEvent(operationType, operationId, phase, metadata, error) {
    var session = readSession();
    metadata = metadata && typeof metadata === 'object' ? metadata : {};
    return appendDiagnosticEvent({
      time: now(),
      category: 'gameplay-operation',
      uid: String(session && session.uid || auth && auth.currentUser && auth.currentUser.uid || ''),
      roomCode: String(session && session.code || ''),
      operationType: String(operationType || '').slice(0, 40),
      operationId: String(operationId || '').slice(0, 180),
      phase: String(phase || '').slice(0, 40),
      kind: String(metadata.kind || '').slice(0, 60),
      name: String(metadata.name || '').slice(0, 160),
      targetUid: String(metadata.targetUid || '').slice(0, 160),
      targetCount: Math.max(0, Math.min(99, Number(metadata.targetCount) || 0)),
      targetKeys: (Array.isArray(metadata.targetKeys) ? metadata.targetKeys : []).slice(0, 12).map(function (key) {
        return String(key || '').slice(0, 160);
      }),
      damage: Math.max(0, Number(metadata.damage) || 0),
      heal: Math.max(0, Number(metadata.heal) || 0),
      result: String(metadata.result || '').slice(0, 120),
      error: error ? String(error.message || error).slice(0, 300) : ''
    });
  }

  function rememberActionOperation(existing, operationId, timestamp) {
    operationId = String(operationId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
    var source = existing && typeof existing === 'object' ? existing : {};
    var rows = Object.keys(source).filter(function (key) {
      return /^[a-zA-Z0-9_-]{1,180}$/.test(key);
    }).map(function (key) {
      return {key:key,time:Math.max(0,Number(source[key])||0)};
    });
    if (operationId && !rows.some(function (row) { return row.key === operationId; })) {
      rows.push({key:operationId,time:Math.max(1,Number(timestamp)||now())});
    }
    rows.sort(function (a,b) { return b.time-a.time; });
    var result = {};
    rows.slice(0,40).forEach(function (row) { result[row.key]=row.time; });
    return result;
  }

  function beginCombatTurnOperation(combat, operationId, timestamp, uid) {
    combat = combat && typeof combat === 'object' ? combat : {};
    operationId = String(operationId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
    var applied = combat.appliedTurnOperationIds && typeof combat.appliedTurnOperationIds === 'object'
      ? combat.appliedTurnOperationIds
      : {};
    if (operationId && applied[operationId]) return { duplicate:true, combat:combat, operationId:operationId };
    var next = Object.assign({}, combat);
    next.appliedTurnOperationIds = rememberActionOperation(applied, operationId, timestamp);
    next.lastTurnOperation = {
      operationId:operationId,
      uid:String(uid || '').slice(0, 128),
      ts:Math.max(0, Number(timestamp) || 0),
      fromRound:Math.max(1, Number(combat.round) || 1),
      fromTurn:Math.max(0, Number(combat.turnIndex) || 0)
    };
    return { duplicate:false, combat:next, operationId:operationId };
  }

  function setCharacterSync(status, character, direction, reason, error) {
    var identity = syncIdentity(character), timestamp = now();
    characterSync.status = status;
    characterSync.direction = direction || characterSync.direction || '';
    characterSync.reason = reason || characterSync.reason || '';
    characterSync.revision = identity.revision || characterSync.revision || 0;
    characterSync.characterId = identity.characterId || characterSync.characterId || '';
    characterSync.error = error ? String(error.message || error).slice(0, 300) : '';
    if (status === 'local') characterSync.lastLocalAt = timestamp;
    if (status === 'sending') characterSync.lastAttemptAt = timestamp;
    if (status === 'synced') characterSync.lastAckAt = timestamp;
  }

  function cloneCharacterSync() {
    return JSON.parse(JSON.stringify(characterSync));
  }

  function syncOutbox() {
    return w.ZargotaSyncOutbox || null;
  }

  function gameplayOutbox() {
    return w.ZargotaGameplayOutbox || null;
  }

  function gameplayOperationSnapshot(type, operationId) {
    var snapshot = api.getSnapshot();
    snapshot.queuedOperation = {
      type: String(type || ''),
      operationId: String(operationId || ''),
      queued: true
    };
    return snapshot;
  }

  function queueGameplayOperation(type, operationId, payload) {
    var store = gameplayOutbox(), session = readSession();
    if (!store || !session || !auth || !auth.currentUser || !tabCanWrite()) return {ok:false,skipped:true};
    return store.enqueue({
      type:type,
      operationId:operationId,
      roomCode:session.code,
      uid:auth.currentUser.uid,
      role:session.role,
      tabId:sessionTabId(),
      payload:payload,
      createdAt:now()
    });
  }

  function removeGameplayOperation(operationId) {
    var store = gameplayOutbox();
    return !store || store.remove(operationId);
  }

  function markGameplayOperationError(operationId, error) {
    var store = gameplayOutbox();
    return !store || store.markError(operationId, error);
  }

  function terminalGameplayError(error) {
    var code = String(error && error.code || '');
    return [
      'room-required','room-not-found','player-missing','member-required','master-only',
      'delivery-title-required','delivery-image-large','character-missing',
      'ability-exhausted','combat-zero-hp','spell-learning-invalid','spell-already-learned'
    ].indexOf(code) >= 0 || code.indexOf('permission-denied') >= 0;
  }

  function flushGameplayOutbox() {
    if (gameplayOutboxFlushPromise) return gameplayOutboxFlushPromise;
    var store = gameplayOutbox(), session = readSession();
    if (!store || !connected || !session || !auth || !auth.currentUser || !currentRoom || !tabCanWrite()) {
      return Promise.resolve(api.getSnapshot());
    }
    var entries = store.forSession({
      roomCode:session.code,
      uid:auth.currentUser.uid,
      role:session.role
    });
    if (!entries.length) return Promise.resolve(api.getSnapshot());
    function flushAt(index) {
      if (index >= entries.length || !connected || !tabCanWrite()) return Promise.resolve(api.getSnapshot());
      var entry = entries[index], payload = entry.payload || {}, operation;
      store.markAttempt(entry.operationId);
      appendOperationEvent(entry.type === 'gm-delivery' ? 'gm-delivery' : 'ability-cast', entry.operationId, 'retrying', {
        kind:payload.value && payload.value.kind || payload.details && payload.details.kind || '',
        name:payload.value && payload.value.title || payload.details && payload.details.name || '',
        targetCount:Array.isArray(payload.memberUids) ? payload.memberUids.length : 1
      });
      if (entry.type === 'gm-delivery') {
        operation = api.gmSendDeliveries(payload.memberUids || [], Object.assign({}, payload.value || {}, {
          operationId:entry.operationId,
          fromOutbox:true
        }));
      } else {
        operation = api.requestAction(payload.text || '', 'ability', payload.speakerUid || '', Object.assign({}, payload.details || {}, {
          operationId:entry.operationId,
          fromOutbox:true
        }));
      }
      return Promise.resolve(operation).then(function (snapshot) {
        if (snapshot && snapshot.queuedOperation) {
          store.markError(entry.operationId, 'Connection lost during retry');
          return flushAt(index + 1);
        }
        store.remove(entry.operationId);
        appendOperationEvent(entry.type === 'gm-delivery' ? 'gm-delivery' : 'ability-cast', entry.operationId, 'retry-acked', {
          targetCount:Array.isArray(payload.memberUids) ? payload.memberUids.length : 1
        });
        return flushAt(index + 1);
      }, function (error) {
        store.markError(entry.operationId, error);
        if (terminalGameplayError(error)) store.remove(entry.operationId);
        return flushAt(index + 1);
      });
    }
    gameplayOutboxFlushPromise = flushAt(0).then(function (snapshot) {
      gameplayOutboxFlushPromise = null;
      return snapshot;
    }, function () {
      gameplayOutboxFlushPromise = null;
      return api.getSnapshot();
    });
    return gameplayOutboxFlushPromise;
  }

  function outboxScope(session, characterId) {
    return {
      roomCode:String(session && session.code || ''),
      uid:String(session && session.uid || auth && auth.currentUser && auth.currentUser.uid || ''),
      characterId:String(characterId || '')
    };
  }

  function clearCharacterOutbox(session, characterId) {
    var store = syncOutbox();
    if (!store || !session || characterId == null) return false;
    return store.clearScope(outboxScope(session, characterId));
  }

  function clearLocalUnsynced(characterId) {
    if (!w._zgUnsyncedCharacterIds || characterId == null) return;
    delete w._zgUnsyncedCharacterIds[String(characterId)];
  }

  function queueCharacterSync(character, reason) {
    var store = syncOutbox(), session = readSession();
    if (!store || !session || session.role !== 'player' || !character || character.id == null) return { ok:false, skipped:true };
    if (!tabCanWrite()) return { ok:false, skipped:true, readOnly:true };
    var member = currentRoom && currentRoom.members && currentRoom.members[session.uid];
    if (!member || String(member.characterId || '') !== String(character.id)) return { ok:false, skipped:true };
    var syncReason = String(reason || 'edit');
    var changedFields = /^inventory-/.test(syncReason)
      ? ['inventoryItems','equipItems']
      : /^journal-/.test(syncReason)
        ? ['journalEntries']
        : [];
    var baseFieldSignatures = {};
    var baseFieldValues = {};
    changedFields.forEach(function (field) {
      var roomValue = member.character && member.character[field];
      var value = field === 'journalEntries' ? roomValue : (Array.isArray(roomValue) ? roomValue : []);
      baseFieldSignatures[field] = store.fieldSignature(value);
      baseFieldValues[field] = value;
    });
    var snapshot = characterSnapshot(character);
    snapshot.revision = Math.max(0, Number(character.revision) || 0);
    var queued = store.enqueue({
      roomCode:session.code,
      uid:session.uid,
      characterId:String(character.id),
      campaignKey:campaignKeyFor(character),
      revision:snapshot.revision,
      reason:syncReason,
      baseRoomRevision:Math.max(0, Number(member.character && member.character.revision) || 0),
      baseRoomSignature:store.contentSignature(member.character || {}),
      changedFields:changedFields,
      baseFieldSignatures:baseFieldSignatures,
      baseFieldValues:baseFieldValues,
      snapshot:snapshot,
      updatedAt:now()
    });
    if (queued.ok) {
      setCharacterSync(connected ? 'local' : 'offline', character, 'local→room', reason || 'edit');
      appendSyncEvent(character, 'local→room', reason || 'edit', 'queued');
      emit();
    }
    return queued;
  }

  function flushCharacterOutbox() {
    if (outboxFlushPromise) return outboxFlushPromise;
    var store = syncOutbox(), session = readSession();
    if (!store || !connected || !session || session.role !== 'player' || !auth || !auth.currentUser || !currentRoom || !tabCanWrite()) {
      return Promise.resolve(api.getSnapshot());
    }
    var member = currentRoom.members && currentRoom.members[session.uid];
    if (!member || !member.characterId || !member.character) return Promise.resolve(api.getSnapshot());
    var scope = outboxScope(session, member.characterId);
    var entry = store.peek(scope);
    if (!entry) return Promise.resolve(api.getSnapshot());
    if (!canApplyIncomingCharacter(session, member.character, { allowQueued:true })) return Promise.resolve(api.getSnapshot());
    var currentSignature = store.contentSignature(member.character);
    if (store.matchesApplied && store.matchesApplied(entry, member.character)) {
      if (!store.remove(entry.id)) {
        setCharacterSync('storage-error', entry.snapshot, 'local→room', entry.reason || 'edit', 'Outbox ack could not be persisted');
        appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'outbox-remove-error', 'Outbox ack could not be persisted');
        emit();
        return Promise.resolve(api.getSnapshot());
      }
      clearLocalUnsynced(entry.characterId);
      setCharacterSync('synced', member.character, 'local→room', entry.reason || 'edit');
      appendSyncEvent(member.character, 'local→room', entry.reason || 'edit', 'outbox-already-acked');
      emit();
      return Promise.resolve(api.getSnapshot());
    }
    var hasItemOperations = !!(Array.isArray(entry.inventoryOperations) && store.applyInventoryOperations);
    if (!hasItemOperations && entry.baseRoomSignature && currentSignature !== entry.baseRoomSignature && entry.changedFields && entry.changedFields.length && store.mergeChangedFields) {
      var fieldMerge = store.mergeChangedFields(entry.id, member.character);
      if (fieldMerge && fieldMerge.ok) {
        entry = fieldMerge.entry;
        currentSignature = store.contentSignature(member.character);
        appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'field-merge');
      } else if (fieldMerge && !fieldMerge.conflict) {
        setCharacterSync('storage-error', entry.snapshot, 'local→room', entry.reason || 'edit', fieldMerge.error || 'Outbox field merge could not be persisted');
        appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'outbox-merge-error', fieldMerge.error || 'Outbox field merge could not be persisted');
        emit();
        return Promise.resolve(api.getSnapshot());
      }
    }
    if (!hasItemOperations && entry.baseRoomSignature && currentSignature !== entry.baseRoomSignature) {
      var conflictArchived = !store.recordConflict || store.recordConflict(entry, member.character);
      setCharacterSync('conflict', entry.snapshot, 'local→room', entry.reason || 'edit', 'Room character changed while local edits were queued');
      appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'conflict', 'Room character changed while local edits were queued');
      if (!conflictArchived) appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'conflict-archive-error', 'Both versions remain in room and outbox, but the extra conflict archive could not be saved');
      emit();
      return Promise.resolve(api.getSnapshot());
    }
    store.markAttempt(entry.id);
    var shouldContinue = false;
    outboxFlushPromise = api.syncCharacter(entry.snapshot, {
      prepared:true,
      reason:entry.reason || 'edit',
      changedFields:Array.isArray(entry.changedFields) ? entry.changedFields.slice() : [],
      inventoryOperations:hasItemOperations ? entry.inventoryOperations.slice() : null,
      outboxEntry:entry
    }).then(function (snapshot) {
      var latest = store.peek(scope);
      var ackStored = true;
      if (snapshot && snapshot.characterSync && snapshot.characterSync.status === 'synced') {
        if (!latest || String(latest.id) !== String(entry.id) || Number(latest.updatedAt) <= Number(entry.updatedAt)) {
          if (store.remove(entry.id)) {
            clearLocalUnsynced(entry.characterId);
          } else {
            ackStored = false;
            setCharacterSync('storage-error', entry.snapshot, 'local→room', entry.reason || 'edit', 'Outbox ack could not be persisted');
            appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'outbox-remove-error', 'Outbox ack could not be persisted');
          }
        } else {
          var refreshedMember = currentRoom && currentRoom.members && currentRoom.members[session.uid];
          store.rebase(
            entry.id,
            store.contentSignature(refreshedMember && refreshedMember.character || {}),
            Math.max(0, Number(refreshedMember && refreshedMember.character && refreshedMember.character.revision) || 0),
            refreshedMember && refreshedMember.character
          );
          shouldContinue = true;
        }
        if (ackStored) appendSyncEvent(entry.snapshot, 'local→room', entry.reason || 'edit', 'outbox-ack');
      }
      return snapshot;
    }).then(function (result) {
      outboxFlushPromise = null;
      var remaining = store.peek(scope);
      if (remaining && connected && shouldContinue) return flushCharacterOutbox();
      return result;
    }, function (error) {
      outboxFlushPromise = null;
      return api.getSnapshot();
    });
    return outboxFlushPromise;
  }

  function beginCharacterEntryUpload(session, user, character) {
    characterInboundSession = null;
    characterEntryUpload = {
      code: String(session && session.code || ''), uid: String(user && user.uid || ''),
      characterId: String(character && character.id || ''), campaignKey: campaignKeyFor(character)
    };
  }

  function enableCharacterInbound(session, user, character) {
    characterInboundSession = {
      code: String(session && session.code || ''),
      uid: String(user && user.uid || ''),
      characterId: String(character && character.id || ''),
      campaignKey: campaignKeyFor(character)
    };
  }

  function matchesCharacterIdentity(identity, character) {
    if (!identity || !character) return false;
    var key = campaignKeyFor(character);
    return !!(
      (key && String(key) === String(identity.campaignKey || '')) ||
      String(character.id || '') === String(identity.characterId || '')
    );
  }

  function isCharacterEntryUpload(session, character) {
    if (!characterEntryUpload || !session) return false;
    if (String(characterEntryUpload.code) !== String(session.code || '') || String(characterEntryUpload.uid) !== String(session.uid || '')) return false;
    if (!character) return characterEntryUpload;
    var key=campaignKeyFor(character);
    return (key && String(key)===String(characterEntryUpload.campaignKey||'')) || String(character.id||'')===String(characterEntryUpload.characterId||'') ? characterEntryUpload : false;
  }

  function canApplyIncomingCharacter(session, character, options) {
    options = options || {};
    if (!session || !character || isCharacterEntryUpload(session, character)) return false;
    if (!currentRoom || String(currentRoom.code || '') !== String(session.code || '')) return false;
    var member = currentRoom.members && currentRoom.members[session.uid];
    if (!member || !member.character || String(member.characterId || '') !== String(character.id || '')) return false;
    if (!options.allowQueued) {
      var store = syncOutbox();
      var pending = store && store.peek(outboxScope(session, member.characterId));
      var localUnsynced = !!(w._zgUnsyncedCharacterIds && w._zgUnsyncedCharacterIds[String(member.characterId)]);
      if (localUnsynced || pending && !(store.matchesApplied && store.matchesApplied(pending, member.character))) return false;
    }
    if (currentRoom.phase !== 'pairing' && currentRoom.phase !== 'character-select') return true;
    if (!characterInboundSession) return false;
    return String(characterInboundSession.code) === String(session.code || '') &&
      String(characterInboundSession.uid) === String(session.uid || '') &&
      matchesCharacterIdentity(characterInboundSession, character);
  }

  function nextCharacterSnapshot(character, member, user, source, prepared) {
    var snapshot = prepared ? JSON.parse(JSON.stringify(character || {})) : characterSnapshot(character);
    var localRevision = Math.max(0, Number(character && character.revision) || 0);
    var roomRevision = Math.max(0, Number(member && member.character && member.character.revision) || 0);
    snapshot.revision = Math.max(localRevision, roomRevision) + 1;
    snapshot.updatedAt = firebase.serverTimestamp();
    snapshot.updatedBy = String(user && user.uid || '');
    snapshot.source = source || 'edit';
    return snapshot;
  }

  function equipmentBonusTotals(value) {
    value = value && typeof value === 'object' ? value : {};
    var stats = value.statBonuses && typeof value.statBonuses === 'object' ? value.statBonuses : {};
    return {
      acBonus:Number(value.acBonus) || 0,
      hpBonus:Number(value.hpBonus) || 0,
      speedBonus:Number(value.speedBonus) || 0,
      initiativeBonus:Number(value.initiativeBonus) || 0,
      statBonuses:{
        str:Number(stats.str) || 0,dex:Number(stats.dex) || 0,int:Number(stats.int) || 0,
        cha:Number(stats.cha) || 0,per:Number(stats.per) || 0,con:Number(stats.con) || 0
      }
    };
  }

  function applyEquipmentDerivedSnapshot(current, snapshot) {
    current = current && typeof current === 'object' ? Object.assign({}, current) : {};
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var hadPrevious = !!(current.equipmentBonuses && typeof current.equipmentBonuses === 'object');
    var previous = equipmentBonusTotals(current.equipmentBonuses);
    var next = equipmentBonusTotals(snapshot.equipmentBonuses);
    var previousHpMax = Math.max(0, Number(current.hpMax) || 0);
    var nextHpMax = hadPrevious
      ? Math.max(1, previousHpMax + next.hpBonus - previous.hpBonus)
      : Math.max(1, Number(snapshot.hpMax) || previousHpMax || 1);
    var hpDelta = nextHpMax - previousHpMax;
    current.hpMax = nextHpMax;
    current.hpCur = Math.max(0, Math.min(nextHpMax, (Number(current.hpCur) || 0) + hpDelta));
    current.ac = hadPrevious ? (Number(current.ac) || 0) + next.acBonus - previous.acBonus : Number(snapshot.ac) || 0;
    current.initiative = hadPrevious ? (Number(current.initiative) || 0) + next.initiativeBonus - previous.initiativeBonus : Number(snapshot.initiative) || 0;
    current.speed = Math.max(0, hadPrevious ? (Number(current.speed) || 0) + next.speedBonus - previous.speedBonus : Number(snapshot.speed) || 0);
    if (hadPrevious) {
      var stats = current.stats && typeof current.stats === 'object' ? Object.assign({}, current.stats) : {};
      Object.keys(next.statBonuses).forEach(function (key) {
        var value = stats[key], delta = next.statBonuses[key] - previous.statBonuses[key];
        if (value && typeof value === 'object') {
          value = Object.assign({}, value);
          value.cur = (Number(value.cur) || 0) + delta;
          stats[key] = value;
        } else {
          stats[key] = (Number(value) || 0) + delta;
        }
      });
      current.stats = stats;
    } else if (snapshot.stats && typeof snapshot.stats === 'object') {
      current.stats = JSON.parse(JSON.stringify(snapshot.stats));
    }
    current.weaponProfiles = Array.isArray(snapshot.weaponProfiles) ? snapshot.weaponProfiles.slice(0, 12) : [];
    current.equipmentBonuses = snapshot.equipmentBonuses && typeof snapshot.equipmentBonuses === 'object'
      ? JSON.parse(JSON.stringify(snapshot.equipmentBonuses))
      : next;
    return current;
  }

  function pointInPolygon(x, y, points) {
    var inside = false;
    points = Array.isArray(points) ? points : [];
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var a = points[i], b = points[j];
      if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 0.00001) + a.x)) inside = !inside;
    }
    return inside;
  }

  function movementCells(scene, fromX, fromY, toX, toY) {
    scene = scene || {};
    var width = Math.max(1, Number(scene.boardWidth) || 32);
    var height = Math.max(1, Number(scene.boardHeight) || 20);
    var dx = Math.abs(Number(toX) - Number(fromX)) * width / 100;
    var dy = Math.abs(Number(toY) - Number(fromY)) * height / 100;
    return Math.max(0, Math.ceil(Math.max(dx, dy) - 0.001));
  }

  function combatRangeCells(value) {
    var text = String(value || '').toLowerCase();
    if (/касани|ближн/.test(text) && !/\d/.test(text)) return 1;
    var matches = text.match(/\d+(?:[.,]\d+)?/g);
    if (!matches || !matches.length) return 1;
    return Math.max(1, Math.floor(Math.max.apply(Math, matches.map(function (item) { return Number(item.replace(',', '.')) || 0; }))));
  }

  function combatTokenSources(room) {
    var sources = [];
    if (room && room.scene && Array.isArray(room.scene.tokens)) sources = sources.concat(room.scene.tokens);
    Object.keys(room && room.zones || {}).forEach(function (zoneId) {
      var zone = room.zones[zoneId];
      if (zone && Array.isArray(zone.tokens)) sources = sources.concat(zone.tokens);
    });
    return sources;
  }

  function combatEntryToken(room, entry) {
    return combatTokenSources(room).filter(function (token) {
      if (!token || !entry) return false;
      if (entry.tokenId && String(token.id) === String(entry.tokenId)) return true;
      return entry.uid && token.type === 'hero' && String(token.memberUid) === String(entry.uid);
    })[0] || null;
  }

  function combatEntryDistance(room, attacker, target) {
    var from = combatEntryScenePoint(room, attacker), to = combatEntryScenePoint(room, target);
    if (!from || !to) return null;
    return movementCells(room.scene || {}, from.x, from.y, to.x, to.y);
  }

  function combatEntryScenePoint(room, entry) {
    var direct=entry&&entry.scenePoint,token=direct?null:combatEntryToken(room,entry);
    if(!direct&&!token)return null;
    var x=direct&&direct.x!=null?Number(direct.x):token&&Number(token.x),y=direct&&direct.y!=null?Number(direct.y):token&&Number(token.y);
    if(!isFinite(x)||!isFinite(y))return null;
    return{x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y))};
  }

  function combatEntryPoint(room, entry) {
    var point=combatEntryScenePoint(room,entry),scene = room && room.scene || {};
    if (!point) return null;
    return { x:point.x * Math.max(1, Number(scene.boardWidth) || 32) / 100, y:point.y * Math.max(1, Number(scene.boardHeight) || 20) / 100 };
  }

  function combatAreaContains(room, shape, originEntry, anchorEntry, targetEntry, length, width) {
    var origin=combatEntryPoint(room,originEntry),anchor=combatEntryPoint(room,anchorEntry),target=combatEntryPoint(room,targetEntry);
    if(!anchor||!target)return false;length=Math.max(.5,Number(length)||1);width=Math.max(.5,Number(width)||1);
    if(shape==='circle'){var cx=target.x-anchor.x,cy=target.y-anchor.y;return Math.sqrt(cx*cx+cy*cy)<=length+.001;}
    if(!origin)return false;var dx=anchor.x-origin.x,dy=anchor.y-origin.y,mag=Math.sqrt(dx*dx+dy*dy);if(!mag)return false;dx/=mag;dy/=mag;
    var tx=target.x-origin.x,ty=target.y-origin.y,along=tx*dx+ty*dy,side=Math.abs(tx*(-dy)+ty*dx);if(along<-.001||along>length+.001)return false;
    return shape==='cone'?side<=along*Math.tan(Math.PI/6)+.35:side<=width/2+.35;
  }

  function combatDamageTraits(value) {
    if (!Array.isArray(value)) value = value ? [value] : [];
    return value.map(function (item) { return String(item && (item.name || item.type || item.value) || item || '').trim().toLowerCase(); }).filter(Boolean);
  }

  function combatHasDamageTrait(list, damageType) {
    var needle = String(damageType || '').trim().toLowerCase();
    if (!needle) return false;
    return combatDamageTraits(list).some(function (item) { return item === needle || item.indexOf(needle) >= 0 || needle.indexOf(item) >= 0; });
  }

  function combatNumber(value, fallback) {
    if (typeof value === 'number' && isFinite(value)) return value;
    var match = String(value == null ? '' : value).match(/-?\d+(?:[.,]\d+)?/);
    var parsed = match ? Number(match[0].replace(',', '.')) : Number(fallback);
    return isFinite(parsed) ? parsed : 0;
  }

  function applyVitalsDomainOperation(state, operation) {
    state=state||{};operation=operation||{};
    var hpMax=Math.max(0,combatNumber(state.hpMax,0)),beforeHp=Math.max(0,combatNumber(state.hp==null?state.hpCur:state.hp,0)),beforeTempHp=Math.max(0,combatNumber(state.tempHp,0));
    var damage=Math.max(0,combatNumber(operation.damage,0)),heal=Math.max(0,combatNumber(operation.heal,0)),absorbed=Math.min(beforeTempHp,damage),hpDamage=Math.max(0,damage-absorbed);
    var tempHp=Math.max(0,beforeTempHp-absorbed),afterDamage=Math.max(0,beforeHp-hpDamage),healCap=hpMax||afterDamage+heal;
    if(operation.preserveOverMax)healCap=Math.max(beforeHp,healCap);
    var hp=heal?Math.min(healCap,afterDamage+heal):afterDamage;
    if(operation.setTempHp!=null){
      var tempLimit=hpMax?Math.floor(hpMax*.5):9999;
      tempHp=Math.min(tempLimit,Math.max(0,combatNumber(operation.setTempHp,0)));
    }
    return{hp:hp,hpMax:hpMax,tempHp:tempHp,beforeHp:beforeHp,beforeTempHp:beforeTempHp,damage:damage,heal:heal,absorbed:absorbed,hpDamage:hpDamage,reachedZero:beforeHp>0&&hp===0,changed:hp!==beforeHp||tempHp!==beforeTempHp};
  }

  function applyStatusDomainOperation(state, operation) {
    state=state||{};operation=operation||{};
    var key=String(operation.statusKey||operation.key||'').toLowerCase(),enable=operation.enable!==false;
    var statuses=Array.isArray(state.statuses)?state.statuses.slice():[],effects=Array.isArray(state.statusEffects)?state.statusEffects.slice():[];
    function statusKey(value){return String(typeof value==='string'?value:value&&(value.statusKey||value.key||value.id)||'').toLowerCase();}
    var active=statuses.some(function(status){return statusKey(status)===key;});
    if(!enable){
      statuses=statuses.filter(function(status){return statusKey(status)!==key;});
      effects=effects.filter(function(effect){return statusKey(effect)!==key;});
    }else{
      if(!active)statuses.push(key);
      if(operation.effect&&typeof operation.effect==='object'){
        var sourceId=String(operation.effect.sourceId||'');
        effects=effects.filter(function(effect){return !effect||statusKey(effect)!==key||(sourceId&&String(effect.sourceId||'')!==sourceId);});
        effects.push(Object.assign({},operation.effect,{statusKey:key}));
      }
    }
    return{statuses:statuses,statusEffects:effects,enabled:enable,changed:enable?!active||!!operation.effect:active};
  }

  function normalizeStatusDurationUnit(value, fallback) {
    value=String(value||fallback||'manual').toLowerCase();
    return ['rounds','minutes','hours','days','manual','concentration'].indexOf(value)>=0?value:'manual';
  }

  function stableStatusEffectId(effect, key) {
    effect=effect&&typeof effect==='object'?effect:{};
    var provided=String(effect.effectId||'').replace(/[^a-zA-Z0-9:_-]/g,'').slice(0,160);
    if(provided)return provided;
    key=String(key||'status').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40)||'status';
    var source=String(effect.sourceId||'legacy:'+key).slice(0,160),identity=key+'|'+source,hash=2166136261;
    for(var index=0;index<identity.length;index+=1){hash^=identity.charCodeAt(index);hash=Math.imul(hash,16777619);}
    return'status-'+key+'-'+('00000000'+(hash>>>0).toString(16)).slice(-8);
  }

  function normalizeStatusEffectInput(effect, key, label) {
    effect=effect&&typeof effect==='object'?effect:{};
    var rawDuration=effect.durationValue!=null?effect.durationValue:(effect.duration!=null?effect.duration:(effect.remainingRounds!=null?effect.remainingRounds:effect.remaining));
    var duration=Math.max(0,Math.min(999,Math.floor(Number(rawDuration)||0)));
    var unit=normalizeStatusDurationUnit(effect.durationUnit||effect.unit,duration?'rounds':'manual');
    if(unit==='manual'||unit==='concentration')duration=0;
    else if(!duration)duration=1;
    var rawRemaining=unit==='rounds'&&effect.remainingRounds!=null?effect.remainingRounds:effect.remaining;
    var remaining=unit==='manual'||unit==='concentration'?null:Math.max(0,Math.min(duration,Math.floor(Number(rawRemaining==null?duration:rawRemaining)||0)));
    var minuteFactor=unit==='days'?1440:(unit==='hours'?60:(unit==='minutes'?1:0));
    var durationMinutes=minuteFactor?Math.max(1,Math.min(1438560,Math.floor(Number(effect.durationMinutes)||duration*minuteFactor))):null;
    var remainingMinutes=minuteFactor?Math.max(0,Math.min(durationMinutes,Math.floor(Number(effect.remainingMinutes==null?remaining*minuteFactor:effect.remainingMinutes)||0))):null;
    var tickType=['damage','heal'].indexOf(effect.tickType)>=0?effect.tickType:'none';
    var tickDice=effect.tickDice?normalizeCombatFormula(effect.tickDice):'';
    var tickValue=Math.max(0,Math.min(9999,Number(effect.tickValue)||0));
    if(key==='burn'){tickType='damage';tickDice='1d4';tickValue=0;}
    if(key==='poison'||key==='bleed'){tickType='damage';tickDice='';tickValue=1;}
    var sourceId=String(effect.sourceId||'gm-manual:'+key).slice(0,120);
    return{
      effectId:stableStatusEffectId(Object.assign({},effect,{sourceId:sourceId}),key),
      type:'status',statusKey:key,label:String(effect.label||label||key).slice(0,60),value:String(effect.value||effect.label||label||key).slice(0,80),
      icon:String(effect.icon||'✦').slice(0,20),color:/^#[0-9a-f]{3,8}$/i.test(String(effect.color||''))?String(effect.color):'#a88b55',
      unit:unit,durationUnit:unit,duration:duration||null,durationValue:duration||null,remaining:remaining,remainingRounds:unit==='rounds'?remaining:null,
      durationMinutes:durationMinutes,remainingMinutes:remainingMinutes,
      sourceId:sourceId,sourceActorKey:String(effect.sourceActorKey||'').slice(0,160),
      stacks:Math.max(1,Math.min(20,Math.floor(Number(effect.stacks)||1))),visibility:effect.visibility==='gm'?'gm':'public',
      acMod:Math.max(-99,Math.min(99,Number(effect.acMod)||0)),attackMod:Math.max(-99,Math.min(99,Number(effect.attackMod)||0)),
      damageMod:Math.max(-99,Math.min(99,Number(effect.damageMod)||0)),speedMod:Math.max(-99,Math.min(99,Number(effect.speedMod)||0)),
      cantAct:!!effect.cantAct,cantMove:!!effect.cantMove,cantReact:!!effect.cantReact,hasDisadvantage:!!effect.hasDisadvantage,attackDisadvantage:!!effect.attackDisadvantage,saveDisadvantage:!!effect.saveDisadvantage,dexSaveDisadvantage:!!effect.dexSaveDisadvantage,abilityCheckDisadvantage:!!effect.abilityCheckDisadvantage,grantAdvantageToAttackers:!!effect.grantAdvantageToAttackers,
      tickType:tickType,tickDice:tickDice,tickValue:tickValue,damageType:String(effect.damageType||'').slice(0,40),
      autoRemove:['never','end_of_turn','save_dc'].indexOf(effect.autoRemove)>=0?effect.autoRemove:'never',
      saveDC:Math.max(0,Math.min(40,Number(effect.saveDC)||0)),saveStat:['str','dex','int','cha','per','con'].indexOf(effect.saveStat)>=0?effect.saveStat:'con'
    };
  }

  function normalizeAbilityTargeting(targeting) {
    targeting=targeting&&typeof targeting==='object'?targeting:null;
    if(!targeting)return null;
    var hasX=targeting.x!==null&&targeting.x!==undefined&&targeting.x!=='',hasY=targeting.y!==null&&targeting.y!==undefined&&targeting.y!=='';
    var tokenId=String(targeting.tokenId||'').slice(0,120),targetKey=String(targeting.targetKey||'').slice(0,160);
    if(!tokenId&&!targetKey&&!hasX&&!hasY)return null;
    var mode=['token','point','self'].indexOf(targeting.mode)>=0?targeting.mode:(tokenId||targetKey?'token':'point');
    return{
      mode:mode,
      x:hasX?Math.max(0,Math.min(100,Number(targeting.x)||0)):null,
      y:hasY?Math.max(0,Math.min(100,Number(targeting.y)||0)):null,
      tokenId:tokenId,
      targetKey:targetKey,
      targetName:String(targeting.targetName||'').slice(0,160),
      tokenType:String(targeting.tokenType||'').slice(0,40),
      distanceCells:Math.max(0,Math.min(200,Number(targeting.distanceCells)||0))
    };
  }

  function applyAbilityUsageDomainOperation(usage, resourceKey, operation) {
    usage=usage&&typeof usage==='object'?Object.assign({},usage):{};operation=operation||{};
    resourceKey=String(resourceKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
    var previous=resourceKey&&usage[resourceKey]&&typeof usage[resourceKey]==='object'?usage[resourceKey]:{};
    var previousMax=Math.max(0,Math.min(99,Number(previous.max)||0)),requestedMax=Math.max(0,Math.min(99,Number(operation.max)||0));
    var max=operation.preserveExistingMax===false&&requestedMax?requestedMax:Math.max(previousMax,requestedMax);
    var previousUsed=Math.max(Math.max(0,Number(previous.used)||0),Math.max(0,Number(operation.minimumUsed)||0));
    previousUsed=Math.min(max||99,previousUsed);
    var used=Math.max(0,Math.min(max||99,previousUsed+(Number(operation.delta)||0)));
    var nextState=Object.assign({},previous,{used:used,max:max});
    if(operation.updatedAt!=null)nextState.updatedAt=operation.updatedAt;
    if(operation.updatedBy)nextState.updatedBy=String(operation.updatedBy);
    if(resourceKey)usage[resourceKey]=nextState;
    return{usage:usage,state:nextState,resourceKey:resourceKey,previousUsed:previousUsed,used:used,max:max,changed:!!resourceKey&&used!==previousUsed};
  }

  function combatHeroEntry(room, uid) {
    var combat = room && room.combat, order = combat && Array.isArray(combat.order) ? combat.order : [];
    var index = order.findIndex(function (entry) { return entry && entry.uid === uid; });
    return { combat:combat, order:order, index:index, entry:index >= 0 ? order[index] : null };
  }

  function combatEntryCurrentHp(entry) {
    if (!entry) return 0;
    return Math.max(0, Number(entry.hp == null ? entry.hpMax : entry.hp) || 0);
  }

  var COMBAT_STATUS_ALIASES={
    'оглушён':'stun','оглушен':'stun','горит':'burn','отравлен':'poison','заморожен':'freeze','страх':'fear','ослеплён':'blind','ослеплен':'blind',
    'опрокинут':'prone','кровотечение':'bleed','магическая немота':'silence','магический якорь':'anchor','очарован':'charm','подчинён':'dominate',
    'подчинен':'dominate','паралич':'paralyze','обездвижен':'restrain','замедлен':'slow','проклят':'curse','истощён':'exhausted','истощен':'exhausted',
    'невидим':'invisible','регенерация':'regen','защитный щит':'shield','ярость':'rage','полёт':'fly','полет':'fly','замешательство':'confusion'
  };
  function normalizeCombatStatusKey(status) {
    var raw=typeof status==='string'?status:status&&(status.key||status.statusKey||status.id)||'';
    var key=String(raw||'').trim().toLowerCase();
    return COMBAT_STATUS_ALIASES[key]||key;
  }

  function collectActiveStatusEffects(source, options) {
    source=source&&typeof source==='object'?source:{};options=options&&typeof options==='object'?options:{};
    var includeHidden=options.includeHidden!==false,effects=[],keys=[],byKey={},rawByKey={},levelsByKey={},reservedKeys={},identities={};
    var structured=[]
      .concat(Array.isArray(source.statusEffects)?source.statusEffects:[])
      .concat((Array.isArray(source.tempEffects)?source.tempEffects:[]).filter(function(effect){return effect&&effect.type==='status';}));
    structured.forEach(function(effect){
      if(!effect||typeof effect!=='object'||(effect.type&&effect.type!=='status'))return;
      var key=normalizeCombatStatusKey(effect);if(!key)return;
      reservedKeys[key]=true;
      var unit=normalizeStatusDurationUnit(effect.durationUnit||effect.unit,effect.remainingRounds!=null?'rounds':'manual');
      var remaining=unit==='rounds'&&effect.remainingRounds!=null?Number(effect.remainingRounds):Number(effect.remaining);
      var remainingMinutes=Number(effect.remainingMinutes);
      var inactive=(unit==='rounds'&&Number.isFinite(remaining)&&remaining<=0)
        ||(['minutes','hours','days'].indexOf(unit)>=0&&((Number.isFinite(remainingMinutes)&&remainingMinutes<=0)||(!Number.isFinite(remainingMinutes)&&Number.isFinite(remaining)&&remaining<=0)));
      if(inactive||(!includeHidden&&effect.visibility==='gm'))return;
      var normalized=Object.assign({},effect,{effectId:stableStatusEffectId(effect,key),statusKey:key});
      if(identities[normalized.effectId])return;
      identities[normalized.effectId]=true;effects.push(normalized);
      if(!byKey[key])byKey[key]=normalized;
      var statusLevel=Math.max(1,Math.min(20,Math.floor(Number(normalized.level||normalized.stacks)||1)));
      levelsByKey[key]=key==='bleed'
        ? Math.min(20,(levelsByKey[key]||0)+statusLevel)
        : Math.max(levelsByKey[key]||0,statusLevel);
      if(keys.indexOf(key)<0)keys.push(key);
    });
    (Array.isArray(source.statuses)?source.statuses:[]).forEach(function(status){
      var key=normalizeCombatStatusKey(status);if(!key||reservedKeys[key]||keys.indexOf(key)>=0)return;
      if(!includeHidden&&status&&typeof status==='object'&&status.visibility==='gm')return;
      keys.push(key);rawByKey[key]=status;levelsByKey[key]=Math.max(1,Math.min(20,Math.floor(Number(status&&status.level||status&&status.stacks)||1)));
    });
    return{keys:keys,effects:effects,byKey:byKey,rawByKey:rawByKey,levelsByKey:levelsByKey,reservedKeys:reservedKeys};
  }
  if(typeof w!=='undefined')w.zgCollectActiveStatusEffects=collectActiveStatusEffects;

  function combatStatusKeys(entry) {
    return collectActiveStatusEffects(entry,{includeHidden:true}).keys;
  }

  function combatStatusLevel(entry,key) {
    key=normalizeCombatStatusKey(key);
    return collectActiveStatusEffects(entry,{includeHidden:true}).levelsByKey[key]||0;
  }

  function combatEntryWithRoomStatuses(room, entry) {
    if (!entry || !entry.uid || !room || !room.members || !room.members[entry.uid] || !room.members[entry.uid].character) return entry;
    return Object.assign({}, entry, {
      statuses:Array.isArray(room.members[entry.uid].character.statuses) ? room.members[entry.uid].character.statuses : [],
      statusEffects:Array.isArray(room.members[entry.uid].character.statusEffects) ? room.members[entry.uid].character.statusEffects : (Array.isArray(entry.statusEffects) ? entry.statusEffects : [])
    });
  }

  // Ограничения следуют актуальному Мануалу; Arena остаётся только редактором статусов.
  function combatRestrictions(entry) {
    var keys = combatStatusKeys(entry), has = function (key) { return keys.indexOf(key) >= 0; };
    var modifiers = combatStatusModifiers(entry);
    var blocked = { long:false, short:false, reaction:false, movement:false };
    var reasons = [];
    if (has('paralyze')) {
      blocked.long = blocked.short = blocked.reaction = blocked.movement = true;
      reasons.push('Паралич: действия, реакции и движение недоступны');
    } else if (has('dominate')) {
      blocked.long = blocked.short = blocked.reaction = true;
      reasons.push('Подчинён: собственные действия недоступны');
    } else if (has('freeze')) {
      blocked.long = blocked.short = blocked.movement = true;
      reasons.push('Заморожен: действия и движение недоступны');
    }
    if (has('stun')) {
      blocked.long = blocked.reaction = true;
      reasons.push('Оглушён: долгое действие и реакция недоступны');
    }
    if (has('restrain')) {
      blocked.movement = true;
      reasons.push('Обездвижен: скорость равна 0');
    }
    var exhaustionLevel = combatStatusLevel(entry,'exhausted');
    if (exhaustionLevel >= 2) {
      blocked.reaction = true;
      reasons.push('Истощение II: реакции недоступны');
    }
    if (exhaustionLevel >= 5) {
      blocked.long = blocked.short = blocked.movement = true;
      reasons.push('Истощение V: герой без сознания');
    }
    if (modifiers.cantAct && !has('stun')) {
      if (!blocked.long || !blocked.short) reasons.push('Состояние запрещает действия');
      blocked.long = blocked.short = true;
    }
    if (modifiers.cantMove) {
      if (!blocked.movement) reasons.push('Состояние запрещает движение');
      blocked.movement = true;
    }
    if (modifiers.cantReact) {
      if (!blocked.reaction) reasons.push('Состояние запрещает реакции');
      blocked.reaction = true;
    }
    return { blocked:blocked, slowed:has('slow'), prone:has('prone'), reasons:reasons };
  }

  function combatTurnMovement(entry) {
    var restrictions = combatRestrictions(entry);
    if (restrictions.blocked.movement) return 0;
    var base = Math.max(0, Number(entry && entry.economy && entry.economy.movementMax) || 7);
    var modifiers = combatStatusModifiers(entry);
    var slowSpeedMod = modifiers.byKey.slow ? Number(modifiers.byKey.slow.speedMod) || 0 : 0;
    base = Math.max(0, base + modifiers.speedMod - slowSpeedMod);
    if (restrictions.slowed) base = Math.floor(base / 2);
    if (combatStatusLevel(entry,'exhausted') >= 2) base = Math.floor(base / 2);
    return base;
  }

  function reconcileCombatEquipmentEntry(entry, character, phase) {
    if (!entry || !character) return entry;
    var next = Object.assign({}, entry);
    var previousHpMax = Math.max(0, combatNumber(entry.hpMax, 0));
    var previousHp = Math.max(0, combatNumber(entry.hp, previousHpMax));
    var missingHp = Math.max(0, previousHpMax - previousHp);
    var nextHpMax = Math.max(1, combatNumber(character.hpMax, previousHpMax || 1));
    var previousEconomy = Object.assign({long:1,short:1,reaction:1,movement:0,movementMax:7}, entry.economy || {});
    var previousAllowance = combatTurnMovement(Object.assign({}, entry, {economy:previousEconomy}));
    var previousRemaining = Math.max(0, combatNumber(previousEconomy.movement, 0));
    var movementSpent = Math.max(0, previousAllowance - previousRemaining);

    next.hpMax = nextHpMax;
    next.hp = Math.max(0, Math.min(nextHpMax, nextHpMax - missingHp));
    next.ac = Math.max(0, combatNumber(character.ac, entry.ac == null ? 10 : entry.ac));
    next.stats = character.stats && typeof character.stats === 'object'
      ? JSON.parse(JSON.stringify(character.stats))
      : {};
    next.mastery = Array.isArray(character.mastery) ? JSON.parse(JSON.stringify(character.mastery)).slice(0, 40) : [];
    next.weaponProfiles = Array.isArray(character.weaponProfiles) ? JSON.parse(JSON.stringify(character.weaponProfiles)).slice(0, 12) : [];
    next.equipmentBonuses = character.equipmentBonuses && typeof character.equipmentBonuses === 'object'
      ? JSON.parse(JSON.stringify(character.equipmentBonuses))
      : {};
    next.bonus = combatNumber(character.initiative, entry.bonus || 0);
    if (phase === 'initiative' && entry.roll != null) next.total = combatNumber(entry.roll, 0) + next.bonus;

    var nextEconomy = Object.assign({}, previousEconomy, {
      movementMax:Math.max(0, combatNumber(character.speed, previousEconomy.movementMax || 7))
    });
    next.economy = nextEconomy;
    var nextAllowance = combatTurnMovement(next);
    nextEconomy.movement = Math.max(0, nextAllowance - movementSpent);
    return next;
  }

  function reconcileCombatEquipmentOrder(room, orderOverride) {
    var combat = room && room.combat || {};
    var order = Array.isArray(orderOverride) ? orderOverride : (Array.isArray(combat.order) ? combat.order : []);
    var members = room && room.members || {};
    var changed = false;
    var nextOrder = order.map(function (entry) {
      var member = entry && entry.uid && members[entry.uid];
      if (!entry || entry.kind !== 'hero' || !member || !member.character) return entry;
      var next = reconcileCombatEquipmentEntry(entry, member.character, combat.phase);
      if (JSON.stringify(next) !== JSON.stringify(entry)) changed = true;
      return next;
    });
    return { changed:changed, order:nextOrder };
  }

  function combatStatusEffects(entry) {
    return collectActiveStatusEffects(entry,{includeHidden:true}).effects;
  }

  function combatStatusModifiers(entry) {
    var result={acMod:0,attackMod:0,damageMod:0,speedMod:0,cantAct:false,cantMove:false,cantReact:false,hasDisadvantage:false,attackDisadvantage:false,saveDisadvantage:false,dexSaveDisadvantage:false,abilityCheckDisadvantage:false,grantAdvantageToAttackers:false,byKey:{}};
    var effects=combatStatusEffects(entry),mechanics=[];
    try{mechanics=typeof w.getStatusMechanics==='function'?w.getStatusMechanics():[];}catch(error){mechanics=[];}
    combatStatusKeys(entry).forEach(function(key){
      key=normalizeCombatStatusKey(key);if(!key||result.byKey[key])return;
      var fallback=(Array.isArray(mechanics)?mechanics:[]).filter(function(rule){return rule&&rule.key===key;})[0]||{};
      var effect=effects.filter(function(item){return item&&normalizeCombatStatusKey(item)===key;})[0]||{};
      var rule=Object.assign({},fallback,effect);
      if(key==='poison'){rule.attackDisadvantage=true;rule.abilityCheckDisadvantage=true;}
      if(rule.enabled===false)return;result.byKey[key]=rule;
      result.acMod+=Number(rule.acMod)||0;result.attackMod+=Number(rule.attackMod)||0;result.damageMod+=Number(rule.damageMod)||0;result.speedMod+=Number(rule.speedMod)||0;
      if(rule.cantAct)result.cantAct=true;if(rule.cantMove)result.cantMove=true;if(rule.cantReact)result.cantReact=true;
      if(rule.hasDisadvantage)result.hasDisadvantage=true;if(rule.attackDisadvantage)result.attackDisadvantage=true;if(rule.saveDisadvantage)result.saveDisadvantage=true;if(rule.dexSaveDisadvantage)result.dexSaveDisadvantage=true;if(rule.abilityCheckDisadvantage)result.abilityCheckDisadvantage=true;if(rule.grantAdvantageToAttackers)result.grantAdvantageToAttackers=true;
    });
    return result;
  }

  function combatStatusEffectForKey(key, options) {
    options=options&&typeof options==='object'?options:{};
    var rule={};
    try {
      var mechanics=typeof w.getStatusMechanics==='function'?w.getStatusMechanics():[];
      rule=(Array.isArray(mechanics)?mechanics:[]).filter(function(item){return item&&item.key===key;})[0]||{};
    } catch (error) { rule={}; }
    var input=Object.assign({},rule,options,{
      tickType:options.tickType||rule.tickType||rule.startOfTurnEffect||'none',
      tickDice:options.tickDice!=null?options.tickDice:(rule.tickDice!=null?rule.tickDice:rule.startOfTurnDice),
      tickValue:options.tickValue!=null?options.tickValue:(rule.tickValue!=null?rule.tickValue:rule.startOfTurnValue)
    });
    var normalized=normalizeStatusEffectInput(input,key,options.label||rule.label||key);
    normalized.unit=normalized.duration?'rounds':(options.concentration?'concentration':'manual');
    normalized.durationUnit=normalized.unit;
    normalized.concentration=!!options.concentration;
    return normalized;
  }

  function combatRollMode(requested, hasAdvantage, hasDisadvantage) {
    var mode=['advantage','disadvantage'].indexOf(requested)>=0?requested:'normal';
    if(mode==='advantage')hasAdvantage=true;
    if(mode==='disadvantage')hasDisadvantage=true;
    if(hasAdvantage&&hasDisadvantage)return'normal';
    if(hasAdvantage)return'advantage';
    if(hasDisadvantage)return'disadvantage';
    return'normal';
  }

  function queueCombatEntryState(room, updates, entry, includeVitals, options) {
    if (!entry) return;
    options = options && typeof options === 'object' ? options : {};
    var writeMember = options.writeMember !== false;
    var writeScene = options.writeScene !== false;
    var statuses = Array.isArray(entry.statuses) ? entry.statuses : [];
    var statusEffects = Array.isArray(entry.statusEffects) ? entry.statusEffects : [];
    function write(path) {
      updates[path+'/statuses'] = statuses;
      updates[path+'/statusEffects'] = statusEffects;
      if (includeVitals) {
        updates[path+'/hp'] = Math.max(0, combatNumber(entry.hp, 0));
        updates[path+'/tempHp'] = Math.max(0, combatNumber(entry.tempHp, 0));
      }
    }
    if (writeMember && entry.uid && room && room.members && room.members[entry.uid]) {
      updates['members/'+entry.uid+'/character/statuses'] = statuses;
      updates['members/'+entry.uid+'/character/statusEffects'] = statusEffects;
      updates['members/'+entry.uid+'/character/deathSaves'] = entry.zeroHp || null;
      if (includeVitals) {
        updates['members/'+entry.uid+'/character/hpCur'] = Math.max(0, combatNumber(entry.hp, 0));
        updates['members/'+entry.uid+'/character/tempHp'] = Math.max(0, combatNumber(entry.tempHp, 0));
      }
    }
    if (!writeScene || !entry.tokenId || !room) return;
    (room.scene && Array.isArray(room.scene.tokens) ? room.scene.tokens : []).forEach(function (token, index) {
      if (token && String(token.id) === String(entry.tokenId)) write('scene/tokens/'+index);
    });
    Object.keys(room.zones || {}).forEach(function (zoneId) {
      var tokens = room.zones[zoneId] && room.zones[zoneId].tokens || [];
      tokens.forEach(function (token, index) {
        if (token && String(token.id) === String(entry.tokenId)) write('zones/'+zoneId+'/tokens/'+index);
      });
    });
  }

  function rollDie(sides) { return Math.floor(Math.random() * Math.max(2, Number(sides) || 4)) + 1; }

  function combatZeroHpState(previous, source, stamp) {
    previous=previous&&typeof previous==='object'?previous:{};
    var state=String(previous.state||'death-saves');
    if(['death-saves','stabilized','dead'].indexOf(state)<0)state='death-saves';
    return {
      pending:state==='death-saves',
      state:state,
      successes:Math.max(0,Math.min(4,Math.floor(Number(previous.successes)||0))),
      failures:Math.max(0,Math.min(4,Math.floor(Number(previous.failures)||0))),
      reachedAt:Math.max(0,Number(previous.reachedAt)||Number(stamp)||now()),
      source:String(previous.source||source||'').slice(0,160),
      lastRoll:previous.lastRoll==null?null:Math.max(1,Math.min(20,Math.floor(Number(previous.lastRoll)||1))),
      lastRollRound:Math.max(0,Math.floor(Number(previous.lastRollRound)||0)),
      lastOutcome:String(previous.lastOutcome||'').slice(0,40),
      updatedAt:Math.max(0,Number(previous.updatedAt)||Number(stamp)||now())
    };
  }

  function syncCombatZeroHp(entry, beforeHp, source, stamp) {
    if (!entry) return entry;
    var currentHp=Math.max(0,combatNumber(entry.hp,0)),previousHp=Math.max(0,combatNumber(beforeHp,currentHp));
    if(currentHp>0){entry.zeroHp=null;return entry;}
    if(previousHp>0||!entry.zeroHp)entry.zeroHp=combatZeroHpState(null,source,stamp);
    else entry.zeroHp=combatZeroHpState(entry.zeroHp,source,stamp);
    return entry;
  }

  function resolveDeathSaveState(previous, roll, round, stamp) {
    var state=combatZeroHpState(previous,'',stamp),natural=Math.max(1,Math.min(20,Math.floor(Number(roll)||1)));
    var successDelta=natural===20?2:(natural>=10?1:0),failureDelta=natural===1?2:(natural<10?1:0);
    state.successes=Math.min(4,state.successes+successDelta);
    state.failures=Math.min(4,state.failures+failureDelta);
    state.lastRoll=natural;
    state.lastRollRound=Math.max(1,Math.floor(Number(round)||1));
    state.lastOutcome=successDelta?(natural===20?'critical-success':'success'):(natural===1?'critical-failure':'failure');
    state.updatedAt=Math.max(0,Number(stamp)||now());
    if(state.successes>=4){state.successes=4;state.pending=false;state.state='stabilized';}
    else if(state.failures>=4){state.failures=4;state.pending=false;state.state='dead';}
    else{state.pending=true;state.state='death-saves';}
    return state;
  }

  function combatStat(entry, key) {
    var stat = entry && entry.stats && entry.stats[key] || {};
    if (typeof stat === 'number') return combatNumber(stat, 0);
    return combatNumber(stat.cur != null && stat.cur !== 0 ? stat.cur : stat.base, 0);
  }

  function normalizeCombatFormula(formula) {
    var source=String(formula||'').toLowerCase().replace(/[дd]/g,'d').replace(/[−–—]/g,'-').replace(/\s+/g,'');
    var match=source.match(/(\d{1,2})d(\d{1,3})([+-]\d+)?/i);
    return match ? match[1]+'d'+match[2]+(match[3]||'') : '1d4';
  }

  function rollFormula(formula, critical) {
    var normalized=normalizeCombatFormula(formula),match=normalized.match(/^(\d{1,2})d(\d{1,3})([+-]\d+)?$/i);
    var count = match ? Math.max(1, Math.min(20, Number(match[1]) || 1)) : 1;
    var sides = match ? Math.max(2, Math.min(100, Number(match[2]) || 4)) : 4;
    var bonus = match ? Number(match[3] || 0) : 0, rolls = [], total = bonus;
    for (var i = 0; i < count * (critical ? 2 : 1); i += 1) { var value = rollDie(sides); rolls.push(value); total += value; }
    return { total:total, rolls:rolls, formula:count+'d'+sides+(bonus?(bonus>0?'+':'')+bonus:'') };
  }

  function statusTurnTick(entry) {
    var effects = combatStatusEffects(entry), keys = combatStatusKeys(entry), seen = {}, changes = [], saves = [], removedKeys = {};
    effects.forEach(function (effect) {
      var effectKey=normalizeCombatStatusKey(effect);if(effectKey&&keys.indexOf(effectKey)<0)keys.push(effectKey);
    });
    var hpMax = Math.max(0, combatNumber(entry && entry.hpMax, 0));
    var hp = Math.max(0, combatNumber(entry && entry.hp != null ? entry.hp : hpMax, 0));
    var tempHp = Math.max(0, combatNumber(entry && entry.tempHp, 0));
    keys.forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      var keyEffects=effects.filter(function(item){return normalizeCombatStatusKey(item)===key;}),effect=keyEffects[0];
      var delta = 0;
      if(key==='burn'){
        delta=-rollDie(4);
      }else if(key==='poison'){
        delta=-1;
      }else if(key==='bleed'){
        var bleedStacks=keyEffects.length
          ? keyEffects.reduce(function(total,item){return Math.min(20,total+Math.max(1,Math.min(20,Math.floor(Number(item.stacks)||1))));},0)
          : Math.max(1,combatStatusLevel(entry,key));
        delta=-Math.max(1,Math.min(20,bleedStacks));
      }else if (effect && (effect.tickType === 'damage' || effect.tickType === 'heal')) {
        var tickTotal=0,tickStacks=Math.max(1,Math.min(20,Math.floor(Number(effect.stacks)||1)));
        for(var stackIndex=0;stackIndex<tickStacks;stackIndex+=1)tickTotal+=Number(effect.tickValue)>0?Number(effect.tickValue):rollFormula(effect.tickDice || '1d4', false).total;
        delta = effect.tickType === 'heal' ? tickTotal : -tickTotal;
      } else if (effect && effect.tickType === 'hp' && Number(effect.tickValue)) {
        delta = Number(effect.tickValue);
      }
      if (!delta && key === 'regen') delta = rollDie(4);
      if (!delta) return;
      var before=hp,vitalsResult=applyVitalsDomainOperation({hp:hp,hpMax:hpMax,tempHp:tempHp},delta<0?{damage:Math.abs(delta)}:{heal:delta}),absorbed=vitalsResult.absorbed;
      hp=vitalsResult.hp;tempHp=vitalsResult.tempHp;delta=hp-before;
      var labels = { burn:'Горит', poison:'Отравлен', bleed:'Кровотечение', regen:'Регенерация' };
      changes.push((labels[key] || effect && effect.value || key) + ': ' + (delta > 0 ? '+' : '') + delta + ' HP' + (absorbed ? ' (🛡 поглощено ' + absorbed + ')' : ''));
      if (before === hp && !absorbed) changes.pop();
    });
    var modifiers=combatStatusModifiers(Object.assign({},entry,{statuses:keys,statusEffects:effects}));
    var statLabels={str:'Сила',dex:'Ловкость',int:'Интеллект',cha:'Харизма',per:'Восприятие',con:'Выносливость'};
    keys.forEach(function(key){
      var effect=effects.filter(function(item){return item&&normalizeCombatStatusKey(item)===key;})[0],rule=effect||modifiers.byKey[key]||{};
      if(rule.autoRemove!=='save_dc'||Number(rule.saveDC)<=0)return;
      var stat=['str','dex','int','cha','per','con'].indexOf(rule.saveStat)>=0?rule.saveStat:'con';
      var mode=combatRollMode('normal',false,modifiers.hasDisadvantage||modifiers.saveDisadvantage||(stat==='dex'&&modifiers.dexSaveDisadvantage)),first=rollDie(20),second=mode==='normal'?null:rollDie(20);
      var natural=second==null?first:(mode==='advantage'?Math.max(first,second):Math.min(first,second)),bonus=combatStat(entry,stat),total=natural+bonus,success=natural===20||(natural!==1&&total>=Number(rule.saveDC));
      saves.push({statusKey:key,label:rule.label||rule.value||key,statKey:stat,roll:natural,rolls:second==null?[first]:[first,second],mode:mode,bonus:bonus,total:total,dc:Number(rule.saveDC),success:success});
      changes.push((rule.label||rule.value||key)+': спасбросок '+statLabels[stat]+' '+total+' против DC '+Number(rule.saveDC)+' — '+(success?'успех, состояние снято':'провал'));
      if(success)removedKeys[key]=true;
    });
    if(Object.keys(removedKeys).length){
      keys=keys.filter(function(key){return !removedKeys[key];});
      effects=effects.filter(function(effect){return !effect||!removedKeys[normalizeCombatStatusKey(effect)];});
    }
    return { hp:hp, tempHp:tempHp, statuses:keys, statusEffects:effects, changes:changes, saves:saves };
  }

  function expireTurnStatuses(entry) {
    var effects = combatStatusEffects(entry), expired = [], active = [];
    effects.forEach(function (effect) {
      if (effect.autoRemove === 'end_of_turn') { expired.push(effect); return; }
      var unit=normalizeStatusDurationUnit(effect.durationUnit||effect.unit,'manual');
      if (unit === 'rounds') {
        effect.remaining = Math.max(0, Number(effect.remainingRounds!=null?effect.remainingRounds:effect.remaining) - 1);
        effect.remainingRounds=effect.remaining;
        effect.unit='rounds';
        effect.durationUnit='rounds';
        if (!effect.remaining) { expired.push(effect); return; }
      }
      active.push(effect);
    });
    var statuses = combatStatusKeys(entry).filter(function (key) {
      return !expired.some(function (effect) { return normalizeCombatStatusKey(effect) === key; }) || active.some(function (effect) { return normalizeCombatStatusKey(effect) === key; });
    });
    return { effects:active, statuses:statuses, expired:expired };
  }

  function normalizeWorldClock(clock) {
    clock=clock&&typeof clock==='object'?clock:{};
    var totalMinutes=Math.max(0,Math.min(525600000,Math.floor(Number(clock.totalMinutes)||0)));
    return{
      calendarId:String(clock.calendarId||'zargota-lvk').slice(0,40),
      displayMode:clock.displayMode==='phase'?'phase':'exact',
      totalMinutes:totalMinutes,
      day:Math.floor(totalMinutes/1440)+1,
      minuteOfDay:totalMinutes%1440,
      revision:Math.max(0,Math.floor(Number(clock.revision)||0)),
      updatedAt:Math.max(0,Number(clock.updatedAt)||0),
      updatedBy:String(clock.updatedBy||'').slice(0,128),
      appliedOperationIds:clock.appliedOperationIds&&typeof clock.appliedOperationIds==='object'?clock.appliedOperationIds:{},
      lastOperation:clock.lastOperation&&typeof clock.lastOperation==='object'?clock.lastOperation:null
    };
  }

  function advanceWorldTimedStatusEffects(source, deltaMinutes) {
    source=source&&typeof source==='object'?source:{};
    deltaMinutes=Math.max(0,Math.floor(Number(deltaMinutes)||0));
    var effects=Array.isArray(source.statusEffects)?source.statusEffects:[],expiredKeys={},changed=false;
    var nextEffects=effects.reduce(function(result,effect){
      if(!effect||typeof effect!=='object'){result.push(effect);return result;}
      var unit=normalizeStatusDurationUnit(effect.durationUnit||effect.unit,'manual');
      var factor=unit==='days'?1440:(unit==='hours'?60:(unit==='minutes'?1:0));
      if(!factor||!deltaMinutes){result.push(effect);return result;}
      var remainingUnits=Math.max(0,Number(effect.remaining==null?effect.duration:effect.remaining)||0);
      var beforeMinutes=Math.max(0,Math.floor(Number(effect.remainingMinutes==null?remainingUnits*factor:effect.remainingMinutes)||0));
      var afterMinutes=Math.max(0,beforeMinutes-deltaMinutes),key=normalizeCombatStatusKey(effect);
      if(afterMinutes<=0){changed=true;if(key)expiredKeys[key]=true;return result;}
      if(afterMinutes!==beforeMinutes){
        var next=Object.assign({},effect);
        next.unit=unit;next.durationUnit=unit;next.remainingMinutes=afterMinutes;
        next.durationMinutes=Math.max(afterMinutes,Math.floor(Number(effect.durationMinutes)||Math.max(1,Number(effect.duration)||1)*factor));
        next.remaining=Math.ceil(afterMinutes/factor);
        next.remainingRounds=null;
        result.push(next);changed=true;return result;
      }
      result.push(effect);return result;
    },[]);
    var statuses=Array.isArray(source.statuses)?source.statuses:[],nextStatuses=statuses;
    if(Object.keys(expiredKeys).length){
      var surviving={};
      nextEffects.forEach(function(effect){var key=normalizeCombatStatusKey(effect);if(key)surviving[key]=true;});
      nextStatuses=statuses.filter(function(status){
        var key=normalizeCombatStatusKey(status);
        return !expiredKeys[key]||surviving[key];
      });
      if(nextStatuses.length!==statuses.length)changed=true;
    }
    if(!changed)return{value:source,changed:false,expiredKeys:[]};
    return{
      value:Object.assign({},source,{statusEffects:nextEffects,statuses:nextStatuses}),
      changed:true,
      expiredKeys:Object.keys(expiredKeys)
    };
  }

  function advanceRoomWorldTimeState(room, deltaMinutes, operationId, uid, timestamp) {
    if(!room||typeof room!=='object')return{room:room,changed:false,duplicate:false,expiredCount:0};
    deltaMinutes=Math.floor(Number(deltaMinutes)||0);
    operationId=String(operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
    timestamp=Math.max(1,Number(timestamp)||now());
    var clock=normalizeWorldClock(room.worldClock);
    if(operationId&&clock.appliedOperationIds[operationId])return{room:room,changed:false,duplicate:true,expiredCount:0,beforeMinutes:clock.totalMinutes,afterMinutes:clock.totalMinutes};
    var next=Object.assign({},room),expiredCount=0,projectionChanged=false;
    function advanceContainer(source){
      var result=advanceWorldTimedStatusEffects(source,deltaMinutes);
      if(result.changed){projectionChanged=true;expiredCount+=result.expiredKeys.length;}
      return result.value;
    }
    var members=room.members&&typeof room.members==='object'?Object.assign({},room.members):{};
    Object.keys(members).forEach(function(memberUid){
      var member=members[memberUid];if(!member||!member.character)return;
      var character=advanceContainer(member.character);if(character===member.character)return;
      character=Object.assign({},character,{
        revision:Math.max(0,Number(character.revision)||0)+1,
        updatedAt:timestamp,updatedBy:uid,source:'gm-world-time',syncOperationId:operationId
      });
      members[memberUid]=Object.assign({},member,{character:character});
    });
    next.members=members;
    if(room.scene&&Array.isArray(room.scene.tokens)){
      var sceneChanged=false,sceneTokens=room.scene.tokens.map(function(token){var advanced=advanceContainer(token);if(advanced!==token)sceneChanged=true;return advanced;});
      if(sceneChanged)next.scene=Object.assign({},room.scene,{tokens:sceneTokens});
    }
    if(room.zones&&typeof room.zones==='object'){
      var zones=Object.assign({},room.zones),zonesChanged=false;
      Object.keys(zones).forEach(function(zoneId){
        var zone=zones[zoneId];if(!zone||!Array.isArray(zone.tokens))return;
        var zoneChanged=false,tokens=zone.tokens.map(function(token){var advanced=advanceContainer(token);if(advanced!==token)zoneChanged=true;return advanced;});
        if(zoneChanged){zones[zoneId]=Object.assign({},zone,{tokens:tokens});zonesChanged=true;}
      });
      if(zonesChanged)next.zones=zones;
    }
    if(room.combat&&Array.isArray(room.combat.order)){
      var combatChanged=false,order=room.combat.order.map(function(entry){var advanced=advanceContainer(entry);if(advanced!==entry)combatChanged=true;return advanced;});
      if(combatChanged)next.combat=Object.assign({},room.combat,{order:order,updatedAt:timestamp});
    }
    var beforeMinutes=clock.totalMinutes,afterMinutes=Math.min(525600000,beforeMinutes+deltaMinutes);
    next.worldClock=Object.assign({},clock,{
      totalMinutes:afterMinutes,
      day:Math.floor(afterMinutes/1440)+1,
      minuteOfDay:afterMinutes%1440,
      revision:clock.revision+1,
      updatedAt:timestamp,
      updatedBy:String(uid||'').slice(0,128),
      appliedOperationIds:rememberActionOperation(clock.appliedOperationIds,operationId,timestamp),
      lastOperation:{operationId:operationId,beforeMinutes:beforeMinutes,afterMinutes:afterMinutes,deltaMinutes:deltaMinutes,uid:String(uid||'').slice(0,128),ts:timestamp,expiredCount:expiredCount}
    });
    next.updatedAt=timestamp;
    return{room:next,changed:true,duplicate:false,expiredCount:expiredCount,beforeMinutes:beforeMinutes,afterMinutes:afterMinutes,projectionChanged:projectionChanged};
  }

  function setRoomWorldClockState(room, targetTotalMinutes, displayMode, operationId, uid, timestamp) {
    if(!room||typeof room!=='object')return{room:room,changed:false,duplicate:false,expiredCount:0};
    targetTotalMinutes=Math.max(0,Math.min(525600000,Math.floor(Number(targetTotalMinutes)||0)));
    displayMode=displayMode==='phase'?'phase':'exact';operationId=String(operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);timestamp=Math.max(1,Number(timestamp)||now());
    var clock=normalizeWorldClock(room.worldClock);
    if(operationId&&clock.appliedOperationIds[operationId])return{room:room,changed:false,duplicate:true,expiredCount:0,beforeMinutes:clock.totalMinutes,afterMinutes:clock.totalMinutes};
    var beforeMinutes=clock.totalMinutes,forwardDelta=Math.max(0,targetTotalMinutes-beforeMinutes),result;
    if(forwardDelta){
      result=advanceRoomWorldTimeState(room,forwardDelta,operationId,uid,timestamp);
      var advancedClock=normalizeWorldClock(result.room&&result.room.worldClock);
      result.room.worldClock=Object.assign({},advancedClock,{calendarId:'zargota-lvk',displayMode:displayMode,totalMinutes:targetTotalMinutes,day:Math.floor(targetTotalMinutes/1440)+1,minuteOfDay:targetTotalMinutes%1440,lastOperation:Object.assign({},advancedClock.lastOperation,{kind:'set',displayMode:displayMode})});
      result.afterMinutes=targetTotalMinutes;return result;
    }
    var next=Object.assign({},room);
    next.worldClock=Object.assign({},clock,{
      calendarId:'zargota-lvk',displayMode:displayMode,totalMinutes:targetTotalMinutes,
      day:Math.floor(targetTotalMinutes/1440)+1,minuteOfDay:targetTotalMinutes%1440,
      revision:clock.revision+1,updatedAt:timestamp,updatedBy:String(uid||'').slice(0,128),
      appliedOperationIds:rememberActionOperation(clock.appliedOperationIds,operationId,timestamp),
      lastOperation:{kind:'set',operationId:operationId,beforeMinutes:beforeMinutes,afterMinutes:targetTotalMinutes,deltaMinutes:targetTotalMinutes-beforeMinutes,displayMode:displayMode,uid:String(uid||'').slice(0,128),ts:timestamp,expiredCount:0}
    });
    next.updatedAt=timestamp;
    return{room:next,changed:true,duplicate:false,expiredCount:0,beforeMinutes:beforeMinutes,afterMinutes:targetTotalMinutes,projectionChanged:false};
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function normalizePlayerCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }

  function sessionTabId() {
    try {
      var existing = String(sessionStorage.getItem(TAB_ID_KEY) || '');
      if (/^tab-[a-zA-Z0-9_-]{8,120}$/.test(existing)) return existing;
      var suffix = '';
      if (w.crypto && typeof w.crypto.randomUUID === 'function') suffix = w.crypto.randomUUID().replace(/-/g, '');
      else if (w.crypto && typeof w.crypto.getRandomValues === 'function') {
        var bytes = new Uint32Array(3);
        w.crypto.getRandomValues(bytes);
        suffix = Array.prototype.map.call(bytes, function (value) { return value.toString(36); }).join('');
      }
      if (!suffix) suffix = Date.now().toString(36) + Math.random().toString(36).slice(2);
      var created = 'tab-' + suffix.slice(0, 120);
      sessionStorage.setItem(TAB_ID_KEY, created);
      return created;
    } catch (error) {
      return 'tab-memory-' + Math.random().toString(36).slice(2, 14);
    }
  }

  function sessionTabStartedAt() {
    try {
      var existing = Math.max(0, Number(sessionStorage.getItem(TAB_STARTED_KEY)) || 0);
      if (existing) return existing;
      var created = now();
      sessionStorage.setItem(TAB_STARTED_KEY, String(created));
      return created;
    } catch (error) {
      return now();
    }
  }

  function tabCoordinationMessage(type, session) {
    if (!tabChannel) return;
    session = session || readSession();
    if (!session || !session.code) return;
    try {
      tabChannel.postMessage({
        type:type || 'heartbeat',
        tabId:sessionTabId(),
        startedAt:sessionTabStartedAt(),
        roomCode:String(session.code || ''),
        uid:String(session.uid || ''),
        role:String(session.role || ''),
        claimedAt:Math.max(0, Number(session.tabClaimedAt) || 0),
        time:now()
      });
    } catch (error) {}
  }

  function pruneTabPeers() {
    // Background tabs may throttle timers to roughly one callback per minute.
    // A longer lease avoids accidental dual ownership; explicit release and
    // takeover remain immediate.
    var cutoff = now() - 120000, changed = false;
    Object.keys(tabPeers).forEach(function (tabId) {
      if (!tabPeers[tabId] || Number(tabPeers[tabId].time) < cutoff) {
        delete tabPeers[tabId];
        changed = true;
      }
    });
    return changed;
  }

  function tabCoordinationState() {
    pruneTabPeers();
    var session = readSession(), ownId = sessionTabId(), roomCode = String(session && session.code || ''), uid = String(session && session.uid || '');
    var roomPeers = Object.keys(tabPeers).map(function (tabId) { return tabPeers[tabId]; }).filter(function (peer) {
      return roomCode && peer && String(peer.roomCode || '') === roomCode && String(peer.tabId || '') !== ownId;
    });
    var peers = roomPeers.filter(function (peer) {
      return uid && String(peer.uid || '') === uid;
    });
    var candidates = session && uid ? peers.concat([{
      tabId:ownId,
      startedAt:sessionTabStartedAt(),
      claimedAt:Math.max(0, Number(session.tabClaimedAt) || 0)
    }]) : [];
    candidates.sort(function (a, b) {
      var claimDifference = Number(b.claimedAt || 0) - Number(a.claimedAt || 0);
      if (claimDifference) return claimDifference;
      return Number(a.startedAt || 0) - Number(b.startedAt || 0) || String(a.tabId || '').localeCompare(String(b.tabId || ''));
    });
    var owner = candidates[0] || null;
    return {
      available:!!tabChannel,
      tabId:ownId,
      roomCode:roomCode,
      active:session ? peers.length + 1 : 0,
      roomActive:session ? roomPeers.length + 1 : 0,
      isSecondary:!!(session && owner && String(owner.tabId || '') !== ownId),
      ownerTabId:String(owner && owner.tabId || ''),
      canTakeover:!!(session && uid && owner && String(owner.tabId || '') !== ownId)
    };
  }

  function tabCanWrite() {
    var session = readSession();
    return !session || !tabCoordinationState().isSecondary;
  }

  function resumePrimaryTab(session) {
    session = session || readSession();
    if (!connected || !session || !tabCanWrite()) return Promise.resolve();
    return Promise.all([
      Promise.resolve(setPresence(session)),
      Promise.resolve(flushCharacterOutbox()),
      Promise.resolve(flushGameplayOutbox())
    ]).catch(function () {});
  }

  function notifyTabCoordination() {
    var resumePromise = Promise.resolve();
    if (typeof api !== 'undefined' && api && api.getSnapshot) {
      var state = tabCoordinationState(), wasSecondary = tabWasSecondary;
      tabWasSecondary = !!state.isSecondary;
      if (tabWasSecondary) clearPresenceDisconnectHandles();
      else if (wasSecondary && connected) resumePromise = resumePrimaryTab(readSession());
      emit();
    }
    return resumePromise;
  }

  function initTabCoordination() {
    if (!w || typeof w.BroadcastChannel !== 'function' || tabChannel) return;
    try {
      tabChannel = new w.BroadcastChannel(TAB_CHANNEL_NAME);
      tabChannel.onmessage = function (event) {
        var data = event && event.data || {}, ownId = sessionTabId();
        if (!data.tabId || String(data.tabId) === ownId) return;
        if (data.type === 'release') {
          if (tabPeers[data.tabId]) {
            var releasedPeer=tabPeers[data.tabId], session=readSession();
            var reassertPresence=typeof api!=='undefined'&&api&&connected&&!tabWasSecondary&&session&&
              String(releasedPeer.roomCode||'')===String(session.code||'')&&String(releasedPeer.uid||'')===String(session.uid||'');
            delete tabPeers[data.tabId];
            notifyTabCoordination();
            if(reassertPresence&&tabCanWrite())setPresence(session);
          }
          return;
        }
        if (data.type !== 'heartbeat' && data.type !== 'probe' && data.type !== 'takeover') return;
        tabPeers[data.tabId] = {
          tabId:String(data.tabId),
          startedAt:Math.max(0, Number(data.startedAt) || 0),
          roomCode:String(data.roomCode || ''),
          uid:String(data.uid || ''),
          role:String(data.role || ''),
          claimedAt:Math.max(0, Number(data.claimedAt) || 0),
          time:now()
        };
        if (data.type === 'probe') tabCoordinationMessage('heartbeat');
        notifyTabCoordination();
      };
      tabChannel.postMessage({type:'probe',tabId:sessionTabId(),time:now()});
      tabCoordinationMessage('heartbeat');
      tabHeartbeatTimer = setInterval(function () {
        var changed = pruneTabPeers();
        tabCoordinationMessage('heartbeat');
        if (changed) notifyTabCoordination();
      }, 4000);
      w.addEventListener('pagehide', function () {
        tabCoordinationMessage('release');
        if (!tabCanWrite()) clearPresenceDisconnectHandles();
        clearInterval(tabHeartbeatTimer);
        tabHeartbeatTimer = 0;
        try { tabChannel.close(); } catch (error) {}
        tabChannel = null;
      }, {once:true});
    } catch (error) {
      tabChannel = null;
    }
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || 'null';
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.code) return null;
      if (!parsed.tabId) {
        parsed.tabId = sessionTabId();
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) { return null; }
  }

  function saveSession(session) {
    try {
      if (session) {
        session.tabId = sessionTabId();
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        tabCoordinationMessage('heartbeat', session);
      } else {
        var previousRaw = sessionStorage.getItem(SESSION_KEY);
        var previous = null;
        try { previous = previousRaw ? JSON.parse(previousRaw) : null; } catch (error) {}
        tabCoordinationMessage('release', previous);
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }

  function takeOverTab() {
    var session = readSession(), state = tabCoordinationState();
    if (!session || !state.isSecondary || !state.canTakeover) {
      return Promise.reject(roomError('Другая вкладка с этой игровой идентичностью не найдена.', 'tab-takeover-unavailable'));
    }
    var latestClaim = Object.keys(tabPeers).reduce(function (maximum, tabId) {
      var peer = tabPeers[tabId];
      if (!peer || String(peer.roomCode || '') !== String(session.code || '') || String(peer.uid || '') !== String(session.uid || '')) return maximum;
      return Math.max(maximum, Math.max(0, Number(peer.claimedAt) || 0));
    }, Math.max(0, Number(session.tabClaimedAt) || 0));
    session.tabClaimedAt = Math.max(now(), latestClaim + 1);
    saveSession(session);
    tabCoordinationMessage('takeover', session);
    return Promise.resolve(notifyTabCoordination()).then(function () {
      return api.getSnapshot();
    });
  }

  function generatedCode(length, used) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var attempt = 0; attempt < 50; attempt++) {
      var code = '';
      var bytes = new Uint8Array(length);
      if (w.crypto && w.crypto.getRandomValues) w.crypto.getRandomValues(bytes);
      else for (var i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
      for (var j = 0; j < length; j++) code += alphabet[bytes[j] % alphabet.length];
      if (!used[code]) return code;
    }
    throw roomError('Не удалось создать уникальный код.', 'code-failed');
  }

  function roomError(message, code, cause) {
    var err = new Error(message);
    err.code = code || 'room-error';
    if (cause) err.cause = cause;
    return err;
  }

  function friendlyFirebaseError(error) {
    var code = error && error.code || '';
    if (code === 'tab-read-only') return error;
    if (code.indexOf('permission-denied') >= 0) return roomError('Firebase отклонил действие. Обновите страницу и попробуйте снова.', code, error);
    if (code.indexOf('network-request-failed') >= 0) return roomError('Нет связи с Firebase. Проверьте интернет.', code, error);
    return roomError('Сетевая комната временно недоступна.', code || 'firebase-error', error);
  }

  function membersOf(room, role) {
    return Object.keys((room && room.members) || {}).map(function (id) {
      return room.members[id];
    }).filter(function (member) { return member && (!role || member.role === role); });
  }

  function pendingOf(room) {
    return Object.keys((room && room.pending) || {}).map(function (code) {
      return room.pending[code];
    }).filter(function (pending) {
      return pending && String(pending.uid || '') !== String(room && room.masterUid || '');
    });
  }

  function mergeAppliedDeliveryIds(first, second) {
    var result = [], seen = Object.create(null);
    [].concat(Array.isArray(first) ? first : [], Array.isArray(second) ? second : []).forEach(function (rawId) {
      var id = String(rawId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
      if (!id || seen[id]) return;
      seen[id] = true;
      result.push(id);
    });
    return result.slice(-120);
  }

  function portableImageData(value, maxLength) {
    var data = String(value || '');
    var max = Math.max(24000, Number(maxLength) || 120000);
    return data.length <= max && /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(data) ? data : '';
  }

  function sharedImageSource(source, thumbnail, maxLength) {
    var portable = portableImageData(thumbnail, maxLength) || portableImageData(source, maxLength);
    if (portable) return portable;
    var path = String(source || '').trim().slice(0, 2000);
    return /^(?:https?:\/\/|\/?(?:images|assets)\/)[^"'<>]*$/i.test(path) ? path : '';
  }

  function characterSnapshot(character) {
    function portableImageData(value, maxLength) {
      var data = String(value || '');
      var max = Math.max(24000, Number(maxLength) || 120000);
      return data.length <= max && /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(data) ? data : '';
    }
    function sharedImageSource(source, thumbnail, maxLength) {
      var portable = portableImageData(thumbnail, maxLength) || portableImageData(source, maxLength);
      if (portable) return portable;
      var path = String(source || '').trim().slice(0, 2000);
      return /^(?:https?:\/\/|\/?(?:images|assets)\/)[^"'<>]*$/i.test(path) ? path : '';
    }
    function metricNumber(value, fallback) {
      var match = String(value == null ? '' : value).match(/-?\d+(?:[.,]\d+)?/);
      var parsed = match ? Number(match[0].replace(',', '.')) : Number(fallback);
      return isFinite(parsed) ? parsed : 0;
    }
    function sessionDamageFormula(value) {
      var source=String(value||'').toLowerCase().replace(/[дd]/g,'d').replace(/[−–—]/g,'-').replace(/\s+/g,'');
      var match=source.match(/(\d{1,2})d(\d{1,3})([+-]\d+)?/i);
      return match ? match[1]+'d'+match[2]+(match[3]||'') : '1d4';
    }
    function stripHeavy(value) {
      if (typeof value === 'string') return /^(?:data|blob):/i.test(value) ? '' : value;
      if (Array.isArray(value)) return value.map(stripHeavy);
      if (!value || typeof value !== 'object') return value;
      var result = {};
      Object.keys(value).forEach(function (key) {
        if (key === 'heroArt' || key === 'cinematicArt') return;
        result[key] = stripHeavy(value[key]);
      });
      return result;
    }
    function clean(value, fallback) {
      try { return stripHeavy(JSON.parse(JSON.stringify(value == null ? fallback : value))); }
      catch (e) { return fallback; }
    }
    function cleanText(value, limit) {
      var text = String(value == null ? '' : value);
      if (/^(?:data|blob):/i.test(text)) return '';
      return text.slice(0, limit || 2000);
    }
    function cleanJournalImage(value) {
      var image = String(value == null ? '' : value).trim().slice(0, 2000);
      return /^(?:https?:\/\/|\/?(?:images|assets)\/)[^"'<>]*$/i.test(image) ? image : '';
    }
    function displayEntry(value) {
      if (typeof value === 'string') return cleanText(value, 2000);
      if (!value || typeof value !== 'object') return null;
      var entry = {};
      ['id','skillId','name','title','label','type','icon','description','desc','effect','text','usages','cd'].forEach(function (key) {
        if (value[key] != null) entry[key] = cleanText(value[key], key === 'description' || key === 'desc' || key === 'effect' || key === 'text' ? 4000 : 500);
      });
      ['cdMax','cdUsed'].forEach(function (key) {
        if (value[key] != null) entry[key] = Math.max(0, Math.min(99, Math.floor(Number(value[key]) || 0)));
      });
      return Object.keys(entry).length ? entry : null;
    }
    function displayList(value, limit) {
      return (Array.isArray(value) ? value : []).slice(0, limit || 40).map(displayEntry).filter(Boolean);
    }
    function sessionItems(value, limit) {
      var sourceItems = Array.isArray(value) ? value : [];
      return clean(sourceItems, []).slice(0, limit).map(function (item, index) {
        if (!item || typeof item !== 'object') return item;
        var next = Object.assign({}, item);
        var sourceItem = sourceItems[index] && typeof sourceItems[index] === 'object' ? sourceItems[index] : {};
        next.image = sharedImageSource(sourceItem.image, sourceItem.imageThumb, 90000);
        delete next.imageThumb;
        delete next.heroArt;
        delete next.cinematicArt;
        return next;
      });
    }
    function sessionJournalEntries(value) {
      var seen = Object.create(null);
      return (Array.isArray(value) ? value : []).slice().sort(function (a, b) {
        return Number(a && (a.updatedAt || a.createdAt) || 0) - Number(b && (b.updatedAt || b.createdAt) || 0);
      }).slice(-80).map(function (raw) {
        if (!raw || typeof raw !== 'object') return null;
        var journalId = cleanText(raw.journalId, 120).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!journalId || seen[journalId]) return null;
        seen[journalId] = true;
        return {
          journalId:journalId,
          questId:cleanText(raw.questId, 100).replace(/[^a-zA-Z0-9_-]/g, ''),
          title:cleanText(raw.title, 200),
          text:cleanText(raw.text, 12000),
          icon:cleanText(raw.icon, 12),
          image:cleanJournalImage(raw.image),
          imageFit:String(raw.imageFit || '') === 'cover' ? 'cover' : 'contain',
          kind:cleanText(raw.kind, 40),
          status:['new','active','completed','failed'].indexOf(String(raw.status || '')) >= 0 ? String(raw.status) : '',
          importance:String(raw.importance || '') === 'secondary' ? 'secondary' : raw.kind === 'quest' ? 'main' : '',
          questUpdatedAt:Math.max(0, Number(raw.questUpdatedAt) || 0),
          createdAt:Math.max(0, Number(raw.createdAt) || 0),
          updatedAt:Math.max(0, Number(raw.updatedAt) || 0),
          updatedBy:cleanText(raw.updatedBy, 120),
          deletedAt:Math.max(0, Number(raw.deletedAt) || 0)
        };
      }).filter(Boolean);
    }
    function sessionProgressionPlan(value) {
      if (!value || typeof value !== 'object') return null;
      var levels = {}, rawLevels = value.levels && typeof value.levels === 'object' ? value.levels : {};
      Object.keys(rawLevels).slice(0, 11).forEach(function (rawLevel) {
        var level = Math.max(1, Math.min(11, Math.floor(Number(rawLevel) || 0)));
        if (!level || String(level) !== String(rawLevel)) return;
        var entry = rawLevels[rawLevel] && typeof rawLevels[rawLevel] === 'object' ? rawLevels[rawLevel] : {};
        var stats = {};
        ['str','dex','int','cha','per','con'].forEach(function (key) {
          stats[key] = Math.max(0, Math.min(20, Math.floor(Number(entry.stats && entry.stats[key]) || 0)));
        });
        levels[String(level)] = {
          stats:stats,
          spellIds:(Array.isArray(entry.spellIds) ? entry.spellIds : []).slice(0, 30).filter(function (id) {
            return typeof id === 'string' || typeof id === 'number';
          }),
          items:(Array.isArray(entry.items) ? entry.items : []).slice(0, 30).map(function (item) {
            if (!item || typeof item !== 'object') return null;
            return {
              id:cleanText(item.id, 120),
              name:cleanText(item.name, 200),
              icon:cleanText(item.icon, 20),
              qty:Math.max(1, Math.min(999, Math.floor(Number(item.qty) || 1)))
            };
          }).filter(Boolean),
          gold:(Array.isArray(entry.gold) ? entry.gold : []).slice(0, 20).map(function (gold) {
            return {
              amount:Math.max(-1000000, Math.min(1000000, Number(gold && gold.amount) || 0)),
              note:cleanText(gold && gold.note, 300)
            };
          }).filter(function (gold) { return gold.amount; }),
          notes:(Array.isArray(entry.notes) ? entry.notes : []).slice(0, 20).map(function (note) {
            return cleanText(note, 1000);
          }).filter(Boolean),
          appliedAt:Math.max(0, Number(entry.appliedAt) || 0)
        };
      });
      return {
        version:Math.max(1, Math.min(10, Math.floor(Number(value.version) || 1))),
        baselineLevel:Math.max(1, Math.min(11, Math.floor(Number(value.baselineLevel) || 1))),
        selectedLevel:Math.max(1, Math.min(11, Math.floor(Number(value.selectedLevel) || 1))),
        levels:levels
      };
    }
    var directItems = [];
    (Array.isArray(character.equipItems) ? character.equipItems : []).forEach(function (item) {
      if (item) directItems.push(Object.assign({}, item, { _sessionEquipped:item.equipped !== false }));
    });
    (Array.isArray(character.inventoryItems) ? character.inventoryItems : []).forEach(function (item) {
      if (item) directItems.push(Object.assign({}, item, { _sessionEquipped:item.equipped === true }));
    });
    var armoryItems = [];
    try { if (typeof w.loadArmoryItems === 'function') armoryItems = w.loadArmoryItems() || []; } catch (e) {}
    Object.keys(character.arenaEquipSlots || {}).forEach(function (slot) {
      var id = character.arenaEquipSlots[slot], item = armoryItems.filter(function (candidate) { return candidate && String(candidate.id) === String(id); })[0];
      if (item) directItems.push(Object.assign({}, item, { equipped:true, _sessionEquipped:true, slot:slot }));
    });
    var weaponProfiles = [], weaponSeen = {};
    directItems.forEach(function (item) {
      var equipmentRules=w.ZargotaEquipmentRules||{};
      var weaponKind=typeof equipmentRules.equipmentKind==='function'
        ?equipmentRules.equipmentKind(item)
        :String(item&&item.category||item&&item.cat||'').toLowerCase();
      if (!item || !item._sessionEquipped || weaponKind !== 'weapon') return;
      var formula = sessionDamageFormula(item.damageFormula || item.damage || '');
      var key = String(item.itemId || item.id || item.name || formula); if (weaponSeen[key]) return; weaponSeen[key] = true;
      var weaponSlot=typeof equipmentRules.normalizedEquipmentSlot==='function'?equipmentRules.normalizedEquipmentSlot(item):(item.slot||'mainHand');
      var handsRequired=typeof equipmentRules.itemHandsRequired==='function'?equipmentRules.itemHandsRequired(item):Math.max(1,Math.min(2,Number(item.handsRequired)||1));
      weaponProfiles.push({ id:key, name:item.name || 'Оружие', damageFormula:formula, damageType:item.damageType || '', range:item.range || '1 клетка', stat:item.attackStat || item.stat || '', slot:weaponSlot, handsRequired:handsRequired });
    });
    if (!weaponProfiles.length) weaponProfiles.push({ id:'improvised', name:'Импровизированная атака', damageFormula:'1d4', damageType:'Дробящий', range:'1 клетка', stat:'str', slot:'mainHand', handsRequired:1 });
    var rawEquipmentCache = character._equipBonusCache || character.equipmentBonuses || {};
    var rawEquipmentStatBonuses = rawEquipmentCache.statBonuses && typeof rawEquipmentCache.statBonuses === 'object'
      ? rawEquipmentCache.statBonuses
      : {};
    var rawEquipmentBonuses = {
      acBonus:Number(rawEquipmentCache.acBonus) || 0,
      hpBonus:Number(rawEquipmentCache.hpBonus) || 0,
      speedBonus:Number(rawEquipmentCache.speedBonus) || 0,
      initiativeBonus:Number(rawEquipmentCache.initiativeBonus) || 0,
      statBonuses:{
        str:Number(rawEquipmentStatBonuses.str) || 0,dex:Number(rawEquipmentStatBonuses.dex) || 0,
        int:Number(rawEquipmentStatBonuses.int) || 0,cha:Number(rawEquipmentStatBonuses.cha) || 0,
        per:Number(rawEquipmentStatBonuses.per) || 0,con:Number(rawEquipmentStatBonuses.con) || 0
      }
    };
    var rawEquipmentSources = character._equipBonusCache && Array.isArray(character._equipBonusCache.sources)
      ? character._equipBonusCache.sources
      : character.equipmentBonuses && Array.isArray(character.equipmentBonuses.sources)
        ? character.equipmentBonuses.sources
        : [];
    rawEquipmentBonuses.sources = rawEquipmentSources.slice(0, 24).map(function (source) {
      source = source && typeof source === 'object' ? source : {};
      return {
        id:cleanText(source.id, 160),
        source:cleanText(source.source, 30),
        slot:cleanText(source.slot, 40),
        name:cleanText(source.name, 200),
        bonuses:clean(source.bonuses, {})
      };
    });
    var hpMax = Math.max(0, metricNumber(character.hpMax, 0));
    var effectTempHp = (Array.isArray(character.tempEffects) ? character.tempEffects : []).reduce(function (sum, effect) {
      if (!effect || effect.type !== 'hp') return sum;
      return sum + Math.max(0, Number(effect.value) || 0);
    }, 0);
    var tempHp = Math.max(0, Number(character.tempHp == null ? effectTempHp : character.tempHp) || 0);
    tempHp = Math.min(Math.floor(hpMax * 0.5), tempHp);
    var spellRefs = (Array.isArray(character.spellRefs) ? character.spellRefs : []).slice(0, 80).filter(function (id) {
      return typeof id === 'string' || typeof id === 'number';
    });
    var abilityUsage = {}, spellsLearned = {};
    spellRefs.forEach(function (id) {
      var resourceId = String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
      if (resourceId) {
        var state = character.spellCD && character.spellCD[id] || {};
        abilityUsage['spell-' + resourceId] = { used:Math.max(0, Number(state.used) || 0), max:Math.max(0, Number(state.max) || 0) };
      }
      var learnedKey = String(id).slice(0, 80);
      if (learnedKey && !/[.#$\[\]\/\u0000-\u001F\u007F]/.test(learnedKey) && ['__proto__','prototype','constructor'].indexOf(learnedKey) < 0) {
        spellsLearned[learnedKey] = !!(character.spellsLearned && character.spellsLearned[id] === true);
      }
    });
    return {
      id: String(character.id),
      campaignKey: campaignKeyFor(character),
      name: character.name || 'Без имени',
      portrait: sharedImageSource(character.portrait, character.portraitThumb, 140000),
      race: character.race || '',
      klasse: character.klasse || '',
      level: Number(character.level || 1),
      hpCur: Math.max(0, metricNumber(character.hpCur != null ? character.hpCur : character.hpMax, 0)),
      hpMax: hpMax,
      tempHp: tempHp,
      ac: Math.max(0, metricNumber(character.ac, 10)),
      initiative: metricNumber(character.initiative, 0),
      speed: Math.max(0, metricNumber(character.speed, 0)),
      stats: clean(character.stats, {}),
      mastery: clean(Array.isArray(character.mastery) ? character.mastery : [], []).slice(0, 40),
      skills: displayList(character.skills || character.abilities, 40),
      traits: displayList(character.traits, 40),
      spellRefs: spellRefs,
      spellsLearned: clean(spellsLearned, {}),
      weaponProfiles: clean(weaponProfiles, []).slice(0, 12),
      equipmentBonuses: clean(rawEquipmentBonuses, {}),
      resistances: clean(character.resistances || character.damageResistances, []),
      vulnerabilities: clean(character.vulnerabilities || character.damageVulnerabilities, []),
      immunities: clean(character.immunities || character.damageImmunities, []),
      statuses: clean(character.statuses || character.conditions, []),
      statusEffects: clean((character.tempEffects || []).filter(function (effect) { return effect && effect.type === 'status'; }), []).slice(0, 40),
      abilityUsage: clean(abilityUsage, {}),
      inventoryItems: sessionItems(character.inventoryItems, 80),
      equipItems: sessionItems(character.equipItems, 40),
      arenaEquipSlots: clean(character.arenaEquipSlots, {}),
      notes: clean(character.notes || character.journal || character.quests, []),
      battleEcho: cleanText(character.battleEcho, 12000),
      family: clean(Array.isArray(character.family) ? character.family : [], []).slice(0, 80),
      journalEntries: sessionJournalEntries(character.journalEntries),
      appliedDeliveryIds: mergeAppliedDeliveryIds(character._gmDeliveryIds, []),
      biography: cleanText(character.biography || character.bio, 12000),
      quote: cleanText(character.quote, 1000),
      origin: cleanText(character.origin, 500),
      symbol: cleanText(character.symbol, 500),
      god: cleanText(character.god, 500),
      age: cleanText(character.age, 100),
      currentGoal: cleanText(character.currentGoal, 2000),
      progressionPlan: sessionProgressionPlan(character.progressionPlan)
    };
  }

  function campaignKeyFor(character) {
    if (!character) return '';
    return String(character.campaignKey || CAMPAIGN_HERO_KEYS[String(character.id)] || '').slice(0, 40);
  }

  function normalizeSkillUpdateValue(value) {
    if (typeof value === 'string') value = { name:value };
    value = value && typeof value === 'object' ? value : {};
    return {
      name:String(value.name || value.title || '').trim().slice(0, 200),
      type:String(value.type || '').trim().slice(0, 80),
      icon:String(value.icon || '').trim().slice(0, 20),
      description:String(value.description || value.desc || value.effect || value.text || '').slice(0, 4000),
      usages:String(value.usages || value.cd || '').slice(0, 500),
      cdMax:Math.max(0, Math.min(99, Math.floor(Number(value.cdMax) || 0)))
    };
  }

  function skillUpdateSignature(value) {
    return JSON.stringify(normalizeSkillUpdateValue(value));
  }

  function stableSkillId(value, index) {
    var existing = value && typeof value === 'object' && (value.skillId || value.id);
    if (existing) return String(existing).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    var text = normalizeSkillUpdateValue(value).name.toLocaleLowerCase('ru'), hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'skill-' + (hash >>> 0).toString(36) + '-' + Math.max(0, Math.floor(Number(index) || 0));
  }

  function applySkillUpdatePatch(currentSkill, patch, skillId) {
    var normalized = normalizeSkillUpdateValue(patch), next = typeof currentSkill === 'string'
      ? { name:currentSkill }
      : Object.assign({}, currentSkill || {});
    next.skillId = String(skillId || next.skillId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    next.name = normalized.name;
    next.type = normalized.type;
    next.icon = normalized.icon;
    next.description = normalized.description;
    next.usages = normalized.usages;
    next.cdMax = normalized.cdMax;
    if (next.cdUsed != null) next.cdUsed = Math.max(0, Math.min(normalized.cdMax || 99, Math.floor(Number(next.cdUsed) || 0)));
    return next;
  }

  var CHARACTER_FIELD_PATCH_LIMITS = {
    battleEcho:12000,
    notes:12000,
    currentGoal:2000,
    family:80
  };

  function normalizeCharacterFieldPatch(field, value) {
    field = String(field || '');
    if (!Object.prototype.hasOwnProperty.call(CHARACTER_FIELD_PATCH_LIMITS, field)) return undefined;
    if (field === 'family') return clean(Array.isArray(value) ? value : [], []).slice(0, CHARACTER_FIELD_PATCH_LIMITS.family);
    return cleanText(value, CHARACTER_FIELD_PATCH_LIMITS[field]);
  }

  function characterFieldPatchSignature(field, value) {
    var normalized = normalizeCharacterFieldPatch(field, value);
    return normalized === undefined ? '' : JSON.stringify(normalized);
  }

  function normalizeInventoryOperationItem(item, fallbackId) {
    item = item && typeof item === 'object' ? item : {};
    var itemId = String(item.itemId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    if (!itemId) itemId = String(fallbackId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    return {
      itemId:itemId,
      name:String(item.name || '').trim().slice(0, 200),
      qty:Math.max(1, Math.min(999, Math.floor(Number(item.qty) || 1))),
      icon:String(item.icon || '📦').slice(0, 20),
      image:(function () {
        var thumb=String(item.imageThumb||''),source=String(item.image||'');
        if(thumb.length<=90000&&/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(thumb))return thumb;
        if(source.length<=90000&&/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(source))return source;
        return /^(?:https?:\/\/|\/?(?:images|assets)\/)[^"'<>]*$/i.test(source)?source.slice(0,2000):'';
      })(),
      description:String(item.description || '').slice(0, 4000),
      category:String(item.category || 'other').slice(0, 40),
      effects:String(item.effects || item.effect || '').slice(0, 1000),
      damageFormula:String(item.damageFormula || item.damage || '').slice(0, 40),
      damageType:String(item.damageType || '').slice(0, 80),
      acBonus:Math.max(-99, Math.min(99, Number(item.acBonus) || 0)),
      hpBonus:Math.max(-999, Math.min(999, Number(item.hpBonus) || 0)),
      speedBonus:Math.max(-99, Math.min(99, Number(item.speedBonus) || 0)),
      initiativeBonus:Math.max(-99, Math.min(99, Number(item.initiativeBonus) || 0)),
      statBonuses:{
        str:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.str)||0)),
        dex:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.dex)||0)),
        int:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.int)||0)),
        cha:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.cha)||0)),
        per:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.per)||0)),
        con:Math.max(-99,Math.min(99,Number(item.statBonuses&&item.statBonuses.con)||0))
      },
      attackStat:['str','dex','int','cha','per','con'].indexOf(String(item.attackStat || '')) >= 0 ? String(item.attackStat) : 'str',
      range:String(item.range || '').slice(0, 80),
      weight:Math.max(0, Math.min(9999, Number(item.weight) || 0)),
      slot:String(item.slot || '').slice(0, 40),
      equipped:false
    };
  }

  function normalizeJournalOperationEntry(entry, fallbackId, metadata) {
    entry = entry && typeof entry === 'object' ? entry : {};
    var journalId = String(entry.journalId || fallbackId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    var stamp = Math.max(0, Number(metadata && metadata.updatedAt) || now());
    var image = String(entry.image || '').trim().slice(0, 2000);
    if (!/^(?:https?:\/\/|\/?(?:images|assets)\/)[^"'<>]*$/i.test(image)) image = '';
    return {
      journalId:journalId,
      questId:String(entry.questId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100),
      title:String(entry.title || '').trim().slice(0, 200),
      text:String(entry.text || '').slice(0, 12000),
      icon:String(entry.icon || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 12),
      image:image,
      kind:String(entry.kind || '').slice(0, 40),
      status:['new','active','completed','failed'].indexOf(String(entry.status || '')) >= 0 ? String(entry.status) : '',
      importance:String(entry.importance || '') === 'secondary' ? 'secondary' : entry.kind === 'quest' ? 'main' : '',
      questUpdatedAt:Math.max(0, Number(entry.questUpdatedAt) || 0),
      createdAt:Math.max(0, Number(entry.createdAt) || stamp),
      updatedAt:stamp,
      updatedBy:String(metadata && metadata.updatedBy || entry.updatedBy || '').slice(0, 120),
      deletedAt:Math.max(0, Number(entry.deletedAt) || 0)
    };
  }

  function applyJournalDomainOperation(current, operation, metadata) {
    if (!current || typeof current !== 'object') return { ok:false, error:'character-missing' };
    operation=operation||{};
    var journal = Array.isArray(current.journalEntries) ? current.journalEntries.slice() : [];
    if(operation.type==='add'){
      var entry=operation.entry;
      if (journal.some(function (item) { return item && String(item.journalId || '') === String(entry && entry.journalId || ''); })) {
        return { ok:true, duplicate:true, character:current };
      }
      if (journal.length >= 80) return { ok:false, error:'journal-full' };
      journal.push(Object.assign({}, entry));
    }else if(operation.type==='replace'){
      journal=(Array.isArray(operation.entries)?operation.entries:[]).slice(-80).map(function(entry){return entry&&typeof entry==='object'?Object.assign({},entry):entry;});
    }else{
      return {ok:false,error:'journal-operation-invalid'};
    }
    var next = Object.assign({}, current);
    next.journalEntries = journal;
    next.revision = Math.max(Math.max(0, Number(current.revision) || 0) + 1,Math.max(0,Number(metadata&&metadata.revision)||0));
    next.updatedAt = Number(metadata && metadata.updatedAt) || now();
    next.updatedBy = String(metadata && metadata.updatedBy || '');
    next.source = String(metadata && metadata.source || 'journal-operation');
    next.syncOperationId = String(metadata && metadata.operationId || '');
    return { ok:true, duplicate:false, character:next };
  }

  function emit() {
    var snapshot = api.getSnapshot();
    listeners.slice().forEach(function (listener) {
      try { listener(snapshot); } catch (e) { console.error(e); }
    });
    try { w.dispatchEvent(new CustomEvent('zargota-room-state', { detail: snapshot })); } catch (e) {}
  }

  function stopWatchingRoom() {
    if (combatEquipmentReconcileTimer) {
      clearTimeout(combatEquipmentReconcileTimer);
      combatEquipmentReconcileTimer = 0;
    }
    combatEquipmentReconcilePending = false;
    if (roomUnsubscribe) {
      try { roomUnsubscribe(); } catch (e) {}
      roomUnsubscribe = null;
      networkPerformance.roomWatchStops++;
      networkPerformance.activeRoomWatches=Math.max(0,networkPerformance.activeRoomWatches-1);
    }
    if (privateDeliveriesUnsubscribe) {
      try { privateDeliveriesUnsubscribe(); } catch (e) {}
      privateDeliveriesUnsubscribe = null;
    }
    currentPrivateDeliveries = {};
    currentRoom = null;
    characterInboundSession = null;
  }

  function syncSessionRole(room) {
    var session = readSession();
    if (!session || !auth || !auth.currentUser) return;
    if (room && room.masterUid === auth.currentUser.uid) {
      if (session.role !== 'master' || session.uid !== auth.currentUser.uid || session.code !== room.code) {
        session.role = 'master';
        session.uid = auth.currentUser.uid;
        session.code = room.code || session.code;
        delete session.playerCode;
        saveSession(session);
      }
      return;
    }
    var member = room && room.members && room.members[auth.currentUser.uid];
    if (member && member.role === 'player' && (session.role !== 'player' || session.uid !== auth.currentUser.uid || session.code !== room.code)) {
      session.role = 'player';
      session.uid = auth.currentUser.uid;
      session.code = room.code || session.code;
      session.playerCode = member.playerCode || session.playerCode || '';
      saveSession(session);
    }
  }

  function restoreCharacterInboundFromRoom(room) {
    var session = readSession();
    if (!session || session.role !== 'player' || !room || isCharacterEntryUpload(session)) return;
    var member = room.members && room.members[session.uid];
    if (!member || !member.character || member.characterId == null) return;
    if (String(member.characterId) !== String(member.character.id || '')) return;
    enableCharacterInbound(session, { uid:session.uid }, member.character);
  }

  function scheduleMasterCombatEquipmentReconcile(room) {
    var session = readSession();
    var preview = reconcileCombatEquipmentOrder(room);
    if (!room || !room.combat || !Array.isArray(room.combat.order) || !room.combat.order.length || !preview.changed) return;
    if (!session || session.role !== 'master' || !auth || !auth.currentUser || room.masterUid !== auth.currentUser.uid || !tabCanWrite()) return;
    combatEquipmentReconcilePending = true;
    if (combatEquipmentReconcileTimer) clearTimeout(combatEquipmentReconcileTimer);
    combatEquipmentReconcileTimer = setTimeout(function runEquipmentReconcile() {
      combatEquipmentReconcileTimer = 0;
      if (combatEquipmentReconcileBusy) return;
      var latestRoom = currentRoom, latestSession = readSession();
      if (!combatEquipmentReconcilePending || !latestRoom || !latestSession || latestSession.role !== 'master' || !auth || !auth.currentUser || latestRoom.masterUid !== auth.currentUser.uid || !tabCanWrite()) return;
      var latestPreview = reconcileCombatEquipmentOrder(latestRoom);
      combatEquipmentReconcilePending = false;
      if (!latestPreview.changed) return;
      combatEquipmentReconcileBusy = true;
      var combatRef = firebase.ref(db, 'rooms/' + latestSession.code + '/combat');
      firebase.runTransaction(combatRef, function (combat) {
        if (!combat || !Array.isArray(combat.order) || !combat.order.length) return;
        var basis = Object.assign({}, latestRoom, {combat:combat});
        var result = reconcileCombatEquipmentOrder(basis, combat.order);
        if (!result.changed) return;
        var nextCombat = Object.assign({}, combat);
        nextCombat.order = result.order;
        nextCombat.updatedAt = now();
        nextCombat.equipmentSyncedAt = nextCombat.updatedAt;
        return nextCombat;
      }).then(function () {
        combatEquipmentReconcileBusy = false;
        if (combatEquipmentReconcilePending && currentRoom) scheduleMasterCombatEquipmentReconcile(currentRoom);
      }, function (error) {
        combatEquipmentReconcileBusy = false;
        console.warn('Zargota combat equipment reconcile:', error);
        if (combatEquipmentReconcilePending && currentRoom) scheduleMasterCombatEquipmentReconcile(currentRoom);
      });
    }, 120);
  }

  function watchPrivateDeliveries(code) {
    var watchedSession = readSession();
    if (privateDeliveriesUnsubscribe || !code || !firebase || !db || !watchedSession || watchedSession.role !== 'player' || !watchedSession.uid) return;
    privateDeliveriesUnsubscribe = firebase.onValue(
      firebase.ref(db, 'privateDeliveries/' + code + '/' + watchedSession.uid),
      function (snapshot) {
        currentPrivateDeliveries = snapshot.exists() && snapshot.val() || {};
        emit();
      },
      function (error) {
        currentPrivateDeliveries = {};
        console.error('Zargota private delivery listener:', error);
        emit();
      }
    );
  }

  function watchRoom(code) {
    stopWatchingRoom();
    if (!code || !firebase || !db) return;
    watchPrivateDeliveries(code);
    networkPerformance.roomWatchStarts++;networkPerformance.activeRoomWatches++;networkPerformance.maxRoomWatches=Math.max(networkPerformance.maxRoomWatches,networkPerformance.activeRoomWatches);
    roomUnsubscribe = firebase.onValue(firebase.ref(db, 'rooms/' + code), function (snapshot) {
      currentRoom = snapshot.exists() ? snapshot.val() : null;
      var snapshotBytes=jsonBytes(currentRoom),snapshotTime=now();networkPerformance.roomSnapshotBytes=snapshotBytes;networkPerformance.roomSnapshotMaxBytes=Math.max(networkPerformance.roomSnapshotMaxBytes,snapshotBytes);networkPerformance.roomSnapshots.push({time:snapshotTime,bytes:snapshotBytes});trimPerformanceRows(networkPerformance.roomSnapshots,snapshotTime-60000);
      if (!currentRoom) {
        var missingSession=readSession();
        if(missingSession&&missingSession.code===code)saveSession(null);
      }
      syncSessionRole(currentRoom);
      watchPrivateDeliveries(code);
      restoreCharacterInboundFromRoom(currentRoom);
      scheduleMasterCombatEquipmentReconcile(currentRoom);
      emit();
      if (connected) {
        flushCharacterOutbox();
        flushGameplayOutbox();
      }
    }, function (error) {
      console.error('Zargota room listener:', error);
      emit();
    });
  }

  function clearPresenceDisconnectHandles() {
    var handles = presenceDisconnectHandles.slice();
    presenceDisconnectHandles = [];
    return Promise.all(handles.map(function (handle) {
      try {
        return handle && typeof handle.cancel === 'function'
          ? Promise.resolve(handle.cancel()).catch(function () {})
          : Promise.resolve();
      } catch (error) {
        return Promise.resolve();
      }
    }));
  }

  function setPresence(session) {
    if (!session || !auth || !auth.currentUser || !firebase || !db) return Promise.resolve();
    if (!tabCanWrite()) return clearPresenceDisconnectHandles();
    var uid = auth.currentUser.uid;
    return clearPresenceDisconnectHandles().then(function () {
      if (!tabCanWrite()) return;
      if (session.role === 'master') {
        var masterMemberRef=firebase.ref(db,'rooms/'+session.code+'/members/'+uid);
        var masterRoomRef=roomRef(session.code);
        return Promise.all([
          firebase.update(masterMemberRef,{online:true,lastSeen:firebase.serverTimestamp()}),
          firebase.update(masterRoomRef,{masterOnline:true,masterLastSeen:firebase.serverTimestamp()})
        ]).then(function(){
          if (!tabCanWrite()) return;
          var memberDisconnect=firebase.onDisconnect(masterMemberRef);
          var roomDisconnect=firebase.onDisconnect(masterRoomRef);
          presenceDisconnectHandles.push(memberDisconnect,roomDisconnect);
          return Promise.all([
            memberDisconnect.update({online:false,lastSeen:firebase.serverTimestamp()}),
            roomDisconnect.update({masterOnline:false,masterLastSeen:firebase.serverTimestamp()})
          ]);
        });
      }
      var target = session.role === 'pending' && session.playerCode
        ? 'rooms/' + session.code + '/pending/' + session.playerCode
        : 'rooms/' + session.code + '/members/' + uid;
      var targetRef = firebase.ref(db, target);
      var values = { online: true, lastSeen: firebase.serverTimestamp() };
      return firebase.update(targetRef, values).then(function () {
        if (!tabCanWrite()) return;
        var targetDisconnect=firebase.onDisconnect(targetRef);
        presenceDisconnectHandles.push(targetDisconnect);
        return targetDisconnect.update({ online: false, lastSeen: firebase.serverTimestamp() });
      });
    }).catch(function () {});
  }

  function ensureReady() {
    return ready.then(function () {
      if (initError) throw initError;
      if (!auth || !auth.currentUser) throw roomError('Не удалось получить сетевой ID.', 'auth-missing');
      return auth.currentUser;
    });
  }

  function roomRef(code) {
    return firebase.ref(db, 'rooms/' + code);
  }

  function privateDeliveriesRoomRef(code) {
    return firebase.ref(db, 'privateDeliveries/' + code);
  }

  function readRoom(code) {
    return firebase.get(roomRef(code)).then(function (snapshot) {
      return snapshot.exists() ? snapshot.val() : null;
    });
  }

  function refreshRoom(code) {
    return readRoom(code).then(function (room) {
      currentRoom = room;
      syncSessionRole(room);
      emit();
      return room;
    });
  }

  function uniqueRoomCode() {
    var attempts = 0;
    function next() {
      attempts += 1;
      if (attempts > 50) throw roomError('Не удалось создать уникальный код комнаты.', 'code-failed');
      var code = generatedCode(5, {});
      return firebase.get(roomRef(code)).then(function (snapshot) {
        return snapshot.exists() ? next() : code;
      });
    }
    return next();
  }

  var compactSceneImageCache = Object.create(null);
  function compactSceneImageKey(source) {
    return String(source.length)+'|'+source.slice(0,72)+'|'+source.slice(-72);
  }
  function compactSceneTokenImage(source,targetChars) {
    source=String(source||'');
    targetChars=Math.max(10000,Math.min(28000,Number(targetChars)||28000));
    if(!/^data:image\//i.test(source)||source.length<=targetChars||typeof Image==='undefined'||typeof document==='undefined')return Promise.resolve(source);
    var key=targetChars+'|'+compactSceneImageKey(source);if(compactSceneImageCache[key])return Promise.resolve(compactSceneImageCache[key]);
    return new Promise(function(resolve){
      var settled=false;
      function finish(value){
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        resolve(value);
      }
      // A corrupt/unsupported data URL must never block publishing the whole
      // scene (and therefore the transition to combat) indefinitely.
      var timeout=setTimeout(function(){finish(source);},2500);
      var image=new Image();
      image.onload=function(){
        try{
          var maxSide=192,scale=Math.min(1,maxSide/image.naturalWidth,maxSide/image.naturalHeight),canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
          var quality=.72,data=canvas.toDataURL('image/webp',quality);
          for(var attempt=0;data.length>targetChars&&attempt<7;attempt++){
            var shrink=Math.max(.62,Math.sqrt(targetChars/data.length)*.94),small=document.createElement('canvas');
            small.width=Math.max(1,Math.round(canvas.width*shrink));small.height=Math.max(1,Math.round(canvas.height*shrink));
            small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);canvas=small;quality=Math.max(.46,quality-.055);data=canvas.toDataURL('image/webp',quality);
          }
          compactSceneImageCache[key]=data;finish(data);
        }catch(error){finish(source);}
      };
      image.onerror=function(){finish(source);};image.src=source;
    });
  }
  function prepareSceneMedia(scene) {
    scene=scene||{};var copy=Object.assign({},scene),tokens=Array.isArray(scene.tokens)?scene.tokens:[];
    var layerChars=(Array.isArray(scene.layers)?scene.layers:[]).reduce(function(sum,layer){return sum+(/^data:image\//i.test(String(layer&&layer.image||''))?String(layer.image).length:0);},0);
    var imageCount=tokens.filter(function(token){return /^data:image\//i.test(String(token&&token.image||''));}).length;
    var tokenBudget=Math.max(10000,Math.min(28000,Math.floor(Math.max(600000,3200000-layerChars)/Math.max(1,imageCount))));
    return Promise.all(tokens.map(function(token){var next=Object.assign({},token);return compactSceneTokenImage(next.image,tokenBudget).then(function(image){next.image=image;return next;});})).then(function(prepared){copy.tokens=prepared;return copy;});
  }

  // Санитайзер сцены — общий для одиночной сцены и зон
  function sanitizeScene(scene) {
    scene = scene || {};
    var layers = (Array.isArray(scene.layers) ? scene.layers : []).slice(0, 4).map(function (layer, index) {
      return {
        id: String(layer.id || ('layer-' + index)).slice(0, 80),
        name: String(layer.name || ('Слой ' + (index + 1))).slice(0, 80),
        image: String(layer.image || ''),
        visible: layer.visible !== false,
        opacity: Math.max(0, Math.min(1, Number(layer.opacity == null ? 1 : layer.opacity))),
        fit: ['cover','contain','stretch','custom'].indexOf(layer.fit) >= 0 ? layer.fit : 'cover',
        scale: Math.max(0.5, Math.min(3, Number(layer.scale) || 1)),
        x: Math.max(-100, Math.min(100, Number(layer.x) || 0)),
        y: Math.max(-100, Math.min(100, Number(layer.y) || 0)),
        brightness: Math.max(0.25, Math.min(2, Number(layer.brightness) || 1)),
        contrast: Math.max(.5, Math.min(2, layer.contrast != null && isFinite(Number(layer.contrast)) ? Number(layer.contrast) : 1)),
        saturation: Math.max(0, Math.min(2, Number(layer.saturation == null ? 1 : layer.saturation))),
        darken: Math.max(0, Math.min(.85, layer.darken != null && isFinite(Number(layer.darken)) ? Number(layer.darken) : 0)),
        locked: !!layer.locked
      };
    }).filter(function (layer) { return !!layer.image; });
    if (!layers.length && scene.background) {
      layers.push({ id:'legacy-background', name:'Фон', image:String(scene.background), visible:true, opacity:1, fit:'cover', scale:1, x:0, y:0, brightness:1, contrast:1, saturation:1, darken:0, locked:false });
    }
    var tokens = (Array.isArray(scene.tokens) ? scene.tokens : []).slice(0, 60).map(function (token, index) {
      function safeList(value, limit) {
        if (!Array.isArray(value)) return [];
        try { return JSON.parse(JSON.stringify(value.slice(0, limit || 24))); } catch (e) { return []; }
      }
      return {
        id: String(token.id || ('token-' + index)).slice(0, 100),
        type: (['hero','custom','spawn','portal','text','object','note'].indexOf(token.type) >= 0 ? token.type : 'custom'),
        disposition: (token.type === 'hero' ? 'hero' : (['ally','enemy','neutral','npc'].indexOf(token.disposition) >= 0 ? token.disposition : 'neutral')),
        color: String(token.color || '#f0d896').slice(0, 20),
        hidden: token.type === 'hero' ? false : (token.type === 'note' ? true : !!token.hidden),
        locked: !!token.locked,
        rotation: Math.max(0, Math.min(359, Number(token.rotation) || 0)),
        hp: token.hp == null ? null : Math.max(0, Number(token.hp) || 0),
        hpMax: token.hpMax == null ? null : Math.max(0, Number(token.hpMax) || 0),
        tempHp: Math.min(Math.floor(Math.max(0, Number(token.hpMax) || 0) * 0.5), Math.max(0, Number(token.tempHp) || 0)),
        level: Math.max(1, Math.min(99, Number(token.level) || 1)),
        ac: Math.max(0, Math.min(99, Number(token.ac) || 10)),
        initiative: Math.max(-20, Math.min(20, Number(token.initiative) || 0)),
        speed: Math.max(0, Math.min(80, Number(token.speed) || 7)),
        sourceRef: token.sourceRef && ['npc','beast'].indexOf(token.sourceRef.type) >= 0 ? {
          type:String(token.sourceRef.type), id:String(token.sourceRef.id || '').slice(0, 120),
          name:String(token.sourceRef.name || '').slice(0, 80), revision:Number(token.sourceRef.revision) || 0
        } : null,
        stats: token.stats && typeof token.stats === 'object' ? token.stats : {},
        mastery: safeList(token.mastery, 40),
        weaponProfiles: safeList(token.weaponProfiles, 12),
        resistances: safeList(token.resistances, 24),
        vulnerabilities: safeList(token.vulnerabilities, 24),
        immunities: safeList(token.immunities, 24),
        statuses: safeList(token.statuses, 23),
        statusEffects: safeList(token.statusEffects, 40),
        opacity: Math.max(0.15, Math.min(1, Number(token.opacity == null ? 1 : token.opacity))),
        memberUid: String(token.memberUid || '').slice(0, 128),
        name: token.type === 'note' ? 'GM' : String(token.name || 'Жетон').slice(0, 80),
        image: (token.type === 'custom' || token.type === 'object') ? String(token.image || '') : '',
        x: Math.max(0, Math.min(100, Number(token.x == null ? 50 : token.x))),
        y: Math.max(0, Math.min(100, Number(token.y == null ? 50 : token.y))),
        size: Math.max(24, Math.min(240, Number(token.size) || 64)),
        visible: token.visible !== false,
        snap: token.snap !== false,
        z: Math.max(0, Math.min(99, Number(token.z) || index + 1)),
        light: token.light && typeof token.light === 'object' ? {
          enabled: !!token.light.enabled,
          type: String(token.light.type || 'campfire').slice(0, 20),
          radius: Math.max(20, Math.min(1000, Number(token.light.radius) || 120)),
          color: String(token.light.color || '#e8922a').slice(0, 20),
          intensity: Math.max(0, Math.min(1, Number(token.light.intensity) || 0.7)),
          flicker: !!token.light.flicker
        } : null
      };
    });
    var regions = (Array.isArray(scene.regions) ? scene.regions : []).slice(0, 60).map(function(region,index){
      return {id:String(region.id||('region-'+index)).slice(0,100),name:String(region.name||'Зона').slice(0,80),kind:region.kind==='place'?'place':'fog',shape:['polygon','rect','circle'].indexOf(region.shape)>=0?region.shape:'polygon',tooltip:String(region.tooltip||'').slice(0,180),opacity:Math.max(.08,Math.min(.95,Number(region.opacity==null ? .76 : region.opacity))),visible:region.visible!==false,points:(Array.isArray(region.points)?region.points:[]).slice(0,32).map(function(point){return{x:Math.max(0,Math.min(100,Number(point.x)||0)),y:Math.max(0,Math.min(100,Number(point.y)||0))};})};
    }).filter(function(region){return region.points.length>=3;});
    var view=scene.view||{};
    var statusVisibility={};
    Object.keys(view.statusVisibility||{}).slice(0,40).forEach(function(key){
      if(/^[a-z0-9_-]{1,40}$/.test(key))statusVisibility[key]=view.statusVisibility[key]!==false;
    });
    var mediaSize = layers.reduce(function (sum, layer) { return sum + (/^data:image\//i.test(String(layer.image)) ? layer.image.length : 0); }, 0) +
      tokens.reduce(function (sum, token) { return sum + (/^data:image\//i.test(String(token.image)) ? token.image.length : 0); }, 0);
    if (mediaSize > 3400000) throw roomError('Изображения сцены слишком большие. Удалите слой или выберите более лёгкие изображения.', 'scene-too-large');
    return {
      layers: layers,
      tokens: tokens,
      regions: regions,
      view:{fog:view.fog!==false,visionMode:view.visionMode==='individual'?'individual':'party',rememberExplored:view.rememberExplored!==false,cinematic:!!view.cinematic,showOtherRequests:!!view.showOtherRequests,allowPlayerInspectAllies:view.allowPlayerInspectAllies!==false,showPublicStatuses:view.showPublicStatuses!==false,showPublicInjuries:!!view.showPublicInjuries,worldClockWidget:['always','brief','hidden'].indexOf(view.worldClockWidget)>=0?view.worldClockWidget:'always',statusVisibility:statusVisibility,minZoom:Math.max(.4,Math.min(2,Number(view.minZoom)||.6)),maxZoom:Math.max(.6,Math.min(3,Number(view.maxZoom)||2.2)),panLimit:Math.max(10,Math.min(100,Number(view.panLimit)||45))},
      grid: scene.grid !== false,
      gridSize: Math.max(24, Math.min(160, Number(scene.gridSize) || 64)),
      boardWidth: Math.max(8, Math.min(80, Number(scene.boardWidth) || 32)),
      boardHeight: Math.max(8, Math.min(80, Number(scene.boardHeight) || 20)),
      gridAboveTokens: !!scene.gridAboveTokens,
      gridColor: /^#[0-9a-f]{6}$/i.test(String(scene.gridColor || '')) ? String(scene.gridColor) : '#cab270',
      gridOpacity: Math.max(.02, Math.min(.8, scene.gridOpacity != null && isFinite(Number(scene.gridOpacity)) ? Number(scene.gridOpacity) : .1)),
      gridThickness: Math.max(.5, Math.min(4, scene.gridThickness != null && isFinite(Number(scene.gridThickness)) ? Number(scene.gridThickness) : 1)),
      gridContrast: Math.max(.5, Math.min(2, scene.gridContrast != null && isFinite(Number(scene.gridContrast)) ? Number(scene.gridContrast) : 1)),
      gridSaturation: Math.max(0, Math.min(2, scene.gridSaturation != null && isFinite(Number(scene.gridSaturation)) ? Number(scene.gridSaturation) : 1)),
      snap: scene.snap !== false,
      gridOx: Math.max(0, Math.min(160, Number(scene.gridOx) || 0)),
      gridOy: Math.max(0, Math.min(160, Number(scene.gridOy) || 0)),
      x: Math.max(-2000, Math.min(2000, Number(scene.x) || 0)),
      y: Math.max(-2000, Math.min(2000, Number(scene.y) || 0)),
      zoom: Math.max(0.5, Math.min(2.5, Number(scene.zoom) || 1)),
      mode: (['normal','nested'].indexOf(scene.mode) >= 0 ? scene.mode : 'normal')
    };
  }

  var api = {
    mode: 'firebase',
    maxPlayers: MAX_PLAYERS,

    createRoom: function () {
      if (createRoomPromise) return createRoomPromise;
      createRoomPromise = ensureReady().then(function (user) {
        var saved=readSession();
        if(!saved)return null;
        return readRoom(saved.code).then(function(existing){
          stopWatchingRoom();
          saveSession(null);
          currentRoom=null;
          emit();
          if(!existing)return null;
          if(saved.role==='master'&&existing.masterUid===user.uid){
            return firebase.remove(privateDeliveriesRoomRef(saved.code)).catch(function(){return null;}).then(function(){
              return firebase.remove(roomRef(saved.code)).then(function(){return null;});
            });
          }
          var cleanup={};
          if(existing.members&&existing.members[user.uid])cleanup['members/'+user.uid]=null;
          if(saved.playerCode&&existing.pending&&existing.pending[saved.playerCode])cleanup['pending/'+saved.playerCode]=null;
          Object.keys(existing.slots||{}).forEach(function(slot){if(existing.slots[slot]&&existing.slots[slot].uid===user.uid)cleanup['slots/'+slot]=null;});
          return Object.keys(cleanup).length?firebase.update(roomRef(saved.code),cleanup).then(function(){return null;}):null;
        });
      }).then(function(){
        return ensureReady().then(function (user) {
        return uniqueRoomCode().then(function (code) {
          var room = {
            code: code,
            phase: 'pairing',
            maxPlayers: MAX_PLAYERS,
            masterUid: user.uid,
            masterOnline: true,
            masterLastSeen: now(),
            createdAt: now(),
            updatedAt: now(),
            worldClock: {
              calendarId: 'zargota-lvk',
              displayMode: 'exact',
              totalMinutes: 0,
              day: 1,
              minuteOfDay: 0,
              revision: 0,
              appliedOperationIds: {}
            },
            members: {},
            pending: {},
            slots: {}
          };
          room.members[user.uid] = {
            uid: user.uid,
            role: 'master',
            name: 'Гейм-мастер',
            online: true,
            joinedAt: now(),
            lastSeen: now()
          };
          return firebase.set(roomRef(code), room).then(function () {
            var session = { code: code, role: 'master', uid: user.uid };
            saveSession(session);
            currentRoom = room;
            watchRoom(code);
            setPresence(session);
            emit();
            return api.getSnapshot();
          });
        });
        });
      }).catch(function (error) {
        if (error && (error.code==='active-room'||error.code&&String(error.code).indexOf('room-')===0)) throw error;
        throw friendlyFirebaseError(error);
      }).then(function(result){createRoomPromise=null;return result;},function(error){createRoomPromise=null;throw error;});
      return createRoomPromise;
    },

    prepareJoin: function (rawCode) {
      var code = normalizeRoomCode(rawCode);
      return ensureReady().then(function (user) {
        return readRoom(code).then(function (room) {
          if (!room) throw roomError('Комната с таким кодом не найдена.', 'room-not-found');
          if (room.masterUid === user.uid) {
            var masterSession = { code:code, role:'master', uid:user.uid };
            saveSession(masterSession);
            currentRoom = room;
            watchRoom(code);
            setPresence(masterSession);
            return api.getSnapshot();
          }
          var existing = room.members && room.members[user.uid];
          if (existing && existing.role === 'player') {
            var existingSession = { code: code, role: 'player', uid: user.uid, playerCode: existing.playerCode || '' };
            saveSession(existingSession);
            currentRoom = room;
            watchRoom(code);
            setPresence(existingSession);
            return api.getSnapshot();
          }
          if (['pairing','character-select'].indexOf(String(room.phase || '')) < 0) {
            throw roomError('Приключение уже началось. Переподключиться может только ранее подтверждённый игрок.', 'room-started');
          }
          var ownPendingCode = '';
          Object.keys(room.pending || {}).some(function (key) {
            if (room.pending[key] && room.pending[key].uid === user.uid) { ownPendingCode = key; return true; }
            return false;
          });
          if (!ownPendingCode) {
            if (membersOf(room, 'player').length + pendingOf(room).length >= MAX_PLAYERS) {
              throw roomError('Все пять мест уже заняты или ожидают подтверждения.', 'room-full');
            }
            ownPendingCode = generatedCode(4, room.pending || {});
          }
          var pending = {
            uid: user.uid,
            playerCode: ownPendingCode,
            online: true,
            createdAt: now(),
            lastSeen: now()
          };
          return firebase.set(firebase.ref(db, 'rooms/' + code + '/pending/' + ownPendingCode), pending).then(function () {
            var session = { code: code, role: 'pending', uid: user.uid, playerCode: ownPendingCode };
            saveSession(session);
            currentRoom = room;
            if (!currentRoom.pending) currentRoom.pending = {};
            currentRoom.pending[ownPendingCode] = pending;
            watchRoom(code);
            setPresence(session);
            emit();
            return api.getSnapshot();
          });
        });
      }).catch(function (error) {
        if (error && ['room-not-found','room-started','room-full'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    approvePlayer: function (rawPlayerCode, slotIndex) {
      var playerCode = normalizePlayerCode(rawPlayerCode);
      return ensureReady().then(function (user) {
        var session = readSession();
        var code = session && session.code || currentRoom && currentRoom.code;
        if (!code) throw roomError('Активная комната не найдена.', 'room-not-found');
        return readRoom(code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          session = { code: room.code || code, role: 'master', uid: user.uid };
          saveSession(session);
          var pending = room.pending && room.pending[playerCode];
          if (!pending) throw roomError('Игрок с таким кодом пока не подключался.', 'player-not-found');
          if (pending.uid === room.masterUid || room.members && room.members[pending.uid] && room.members[pending.uid].role === 'master') {
            throw roomError('Мастерская вкладка не может занимать место игрока. Откройте игрока в другом браузере или профиле.', 'identity-conflict');
          }
          var slot = Math.max(0, Math.min(MAX_PLAYERS - 1, Number(slotIndex) || 0));
          if (room.slots && room.slots[slot] && room.slots[slot].uid !== pending.uid) {
            throw roomError('Эта ячейка уже занята.', 'slot-busy');
          }
          var updates = {};
          Object.keys(room.slots || {}).forEach(function (key) {
            if (room.slots[key] && room.slots[key].uid === pending.uid) updates['slots/' + key] = null;
          });
          updates['members/' + pending.uid] = {
            uid: pending.uid,
            role: 'player',
            name: 'Игрок',
            playerCode: playerCode,
            approved: true,
            online: true,
            joinedAt: pending.createdAt || now(),
            lastSeen: now()
          };
          updates['slots/' + slot] = { uid: pending.uid, playerCode: playerCode };
          updates['pending/' + playerCode] = null;
          updates.updatedAt = now();
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','player-not-found','slot-busy','identity-conflict'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    releasePlayer: function (memberUid) {
      memberUid = String(memberUid || '');
      if (!memberUid) return Promise.reject(roomError('Игрок для освобождения не найден.', 'player-not-found'));
      return ensureReady().then(function (user) {
        var session = readSession();
        var code = session && session.code || currentRoom && currentRoom.code;
        if (!code) throw roomError('Активная комната не найдена.', 'room-not-found');
        return readRoom(code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Освобождать места может только мастер комнаты.', 'master-only');
          if (memberUid === room.masterUid) throw roomError('Место гейм-мастера нельзя освободить.', 'master-release-forbidden');
          if (['pairing','character-select'].indexOf(String(room.phase || '')) < 0) {
            throw roomError('Во время игры место сохраняется для безопасного переподключения игрока.', 'wrong-phase');
          }
          var member = room.members && room.members[memberUid];
          var occupiedSlots = Object.keys(room.slots || {}).filter(function (slot) {
            return room.slots[slot] && String(room.slots[slot].uid || '') === memberUid;
          });
          if (!member && !occupiedSlots.length) throw roomError('Игрок уже не занимает место.', 'player-not-found');
          if (member && member.role !== 'player') throw roomError('Это место нельзя освободить.', 'player-not-found');
          var lastSeen = Math.max(0, Number(member && member.lastSeen) || 0);
          if (member && member.online !== false && (!lastSeen || now() - lastSeen < 120000)) {
            throw roomError('Игрок ещё online. Освобождение доступно после отключения или двух минут без presence.', 'player-online');
          }
          var updates = {};
          if (member) {
            updates['releasedMembers/' + memberUid] = Object.assign({}, member, {
              releasedAt:now(),
              releasedBy:user.uid,
              releaseReason:'master-free-slot'
            });
            updates['members/' + memberUid] = null;
          }
          occupiedSlots.forEach(function (slot) { updates['slots/' + slot] = null; });
          Object.keys(room.pending || {}).forEach(function (playerCode) {
            if (room.pending[playerCode] && String(room.pending[playerCode].uid || '') === memberUid) updates['pending/' + playerCode] = null;
          });
          updates.updatedAt = now();
          return firebase.update(roomRef(code), updates).then(function () {
            return refreshRoom(code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','master-release-forbidden','room-not-found','player-not-found','player-online','wrong-phase'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    startCharacterSelection: function (options) {
      var testMode = options === true || !!(options && options.testMode);
      return ensureReady().then(function (user) {
        var session = readSession();
        var code = session && session.code || currentRoom && currentRoom.code;
        if (!code) throw roomError('Активная комната не найдена.', 'room-not-found');
        return readRoom(code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          session = { code: room.code || code, role: 'master', uid: user.uid };
          saveSession(session);
          if (!testMode && !membersOf(room, 'player').length) throw roomError('Подтвердите хотя бы одного игрока.', 'no-players');
          return firebase.update(roomRef(session.code), {
            testMode: testMode,
            phase: 'character-select',
            updatedAt: now()
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','no-players'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    attachCharacter: function (character) {
      if (!character || character.id == null) return Promise.reject(roomError('Персонаж не выбран.', 'character-required'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) return api.getSnapshot();
        beginCharacterEntryUpload(session,user,character);
        setCharacterSync('sending', character, 'local→room', 'entry');
        appendSyncEvent(character, 'local→room', 'entry', 'sending');
        emit();
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var member = room.members && room.members[user.uid];
          if (!member) throw roomError('Мастер ещё не подтвердил подключение.', 'not-approved');
          var characterKey = campaignKeyFor(character);
          var heroTaken = Object.keys(room.members || {}).some(function(uid) {
            if (String(uid) === String(user.uid)) return false;
            var other = room.members[uid];
            if (!other || other.characterId == null) return false;
            var otherKey = other.campaignKey || other.character && campaignKeyFor(other.character);
            return characterKey
              ? String(otherKey || '') === String(characterKey)
              : String(other.characterId || '') === String(character.id);
          });
          if (heroTaken) throw roomError('Этот герой уже выбран другим игроком.', 'hero-taken');
          var entrySnapshot = nextCharacterSnapshot(character, member, user, 'entry');
          var customHeroApproval = characterKey ? null : {
            status:'pending',
            requestedAt:now(),
            requestedBy:user.uid,
            characterId:String(character.id),
            characterName:String(character.name || 'Личный герой').slice(0, 200)
          };
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
            characterId: String(character.id),character:entrySnapshot,campaignKey:characterKey,gmReady:false,
            customHeroApproval:customHeroApproval,
            name:character.name||member.name,lastSeen:firebase.serverTimestamp(),online:true
          }).then(function () {
            enableCharacterInbound(session, user, entrySnapshot);
            clearCharacterOutbox(session, character.id);
            clearLocalUnsynced(character.id);
            setCharacterSync('synced', entrySnapshot, 'local→room', 'entry');
            appendSyncEvent(entrySnapshot, 'local→room', 'entry', 'ack');
            return refreshRoom(session.code).then(function () { characterEntryUpload=null; return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        characterEntryUpload=null;
        setCharacterSync(connected ? 'conflict' : 'offline', character, 'local→room', 'entry', error);
        appendSyncEvent(character, 'local→room', 'entry', 'error', error);
        emit();
        if (error && ['room-not-found','not-approved','hero-taken'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCustomHeroProposal: function (memberUid, accepted) {
      memberUid=String(memberUid||'').slice(0,128);accepted=accepted===true;
      if(!memberUid)return Promise.reject(roomError('Игрок не выбран.','member-required'));
      return ensureReady().then(function(user){
        var session=readSession();
        if(!session||session.role!=='master')throw roomError('Решение принимает только мастер комнаты.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var member=room.members&&room.members[memberUid],proposal=member&&member.customHeroApproval;
          if(!member||member.role!=='player'||!proposal||proposal.status!=='pending')throw roomError('Заявка героя уже обработана.','proposal-missing');
          var stamp=now(),updates={};
          updates['members/'+memberUid+'/customHeroApproval/status']=accepted?'approved':'rejected';
          updates['members/'+memberUid+'/customHeroApproval/resolvedAt']=stamp;
          updates['members/'+memberUid+'/customHeroApproval/resolvedBy']=user.uid;
          if(!accepted){
            updates['members/'+memberUid+'/characterId']=null;
            updates['members/'+memberUid+'/character']=null;
            updates['members/'+memberUid+'/campaignKey']=null;
          }
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(error&&['member-required','master-only','room-not-found','proposal-missing'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    syncCharacter: function (character, options) {
      options = options || {};
      if (!character || character.id == null) return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || !firebase || !db) return api.getSnapshot();
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        if (!member || String(member.characterId || '') !== String(character.id)) return api.getSnapshot();
        if (!canApplyIncomingCharacter(session, member.character, { allowQueued:true })) return api.getSnapshot();
        var syncReason = options.reason || 'edit';
        var liveSnapshot = nextCharacterSnapshot(character, member, user, syncReason, !!options.prepared);
        setCharacterSync('sending', liveSnapshot, 'local→room', syncReason);
        appendSyncEvent(liveSnapshot, 'local→room', syncReason, 'sending');
        emit();
        var memberUpdates = {
          name:character.name || member.name,
          lastSeen:firebase.serverTimestamp()
        };
        var scopedFields = Array.isArray(options.changedFields) ? options.changedFields.filter(function (field) {
          return field === 'inventoryItems' || field === 'equipItems';
        }) : [];
        var store = syncOutbox();
        var itemOperations = Array.isArray(options.inventoryOperations) ? options.inventoryOperations : null;
        var journalOperation = /^journal-/.test(String(syncReason));
        var roomWrite;
        if (journalOperation) {
          var journalOperationId = String(options.outboxEntry && options.outboxEntry.operationId || liveSnapshot.syncOperationId || '');
          var journalBaseSignature = String(options.outboxEntry && options.outboxEntry.baseFieldSignatures && options.outboxEntry.baseFieldSignatures.journalEntries || '');
          var journalConflict = null;
          var journalCharacterRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid + '/character');
          roomWrite = firebase.runTransaction(journalCharacterRef, function (current) {
            if (!current || typeof current !== 'object') return;
            journalConflict = null;
            if (journalBaseSignature && store && store.fieldSignature(current.journalEntries) !== journalBaseSignature) {
              journalConflict = JSON.parse(JSON.stringify(current));
              return;
            }
            var applied=applyJournalDomainOperation(current,{type:'replace',entries:liveSnapshot.journalEntries},{
              revision:liveSnapshot.revision,updatedAt:now(),updatedBy:user.uid,source:syncReason,operationId:journalOperationId
            });
            if(applied.ok)applied.character.appliedDeliveryIds=mergeAppliedDeliveryIds(current.appliedDeliveryIds,liveSnapshot.appliedDeliveryIds);
            return applied.ok?applied.character:undefined;
          }).then(function (result) {
            if (!result || !result.committed) {
              if (journalConflict) {
                var archived = !store || !store.recordConflict || store.recordConflict(options.outboxEntry, journalConflict);
                setCharacterSync('conflict', character, 'local→room', syncReason, 'Journal changed in room while local edits were queued');
                appendSyncEvent(character, 'local→room', syncReason, 'conflict', 'Journal changed in room while local edits were queued');
                if (!archived) appendSyncEvent(character, 'local→room', syncReason, 'conflict-archive-error', 'Both journal versions remain in room and outbox');
                emit();
                return { journalConflict:true };
              }
              throw roomError('Журнал героя недоступен. Повторите попытку.', 'journal-operation-failed');
            }
            liveSnapshot = result.snapshot && result.snapshot.val ? result.snapshot.val() : liveSnapshot;
            return { journalConflict:false };
          });
        } else if (itemOperations && store && store.applyInventoryOperations) {
          var operationConflict = null;
          var operationConflictField = '';
          var operationConflictItemId = '';
          var operationFailure = '';
          var operationId = String(options.outboxEntry && options.outboxEntry.operationId || liveSnapshot.syncOperationId || '');
          var characterRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid + '/character');
          roomWrite = firebase.runTransaction(characterRef, function (current) {
            operationConflict = null;
            operationConflictField = '';
            operationConflictItemId = '';
            operationFailure = '';
            var applied = store.applyInventoryOperations(current, itemOperations, {
              revision:liveSnapshot.revision,
              updatedAt:now(),
              updatedBy:user.uid,
              source:syncReason,
              operationId:operationId
            });
            if (!applied.ok) {
              operationFailure = applied.error || 'inventory-operation-conflict';
              if (applied.conflict) {
                operationConflict = JSON.parse(JSON.stringify(current || {}));
                operationConflictField = applied.field;
                operationConflictItemId = applied.itemId;
              }
              return;
            }
            applied.character = applyEquipmentDerivedSnapshot(applied.character, liveSnapshot);
            applied.character.appliedDeliveryIds=mergeAppliedDeliveryIds(current&&current.appliedDeliveryIds,liveSnapshot.appliedDeliveryIds);
            return applied.character;
          }).then(function (result) {
            if (!result || !result.committed) {
              if (operationConflict) {
                var conflictArchived = !store.recordConflict || store.recordConflict(options.outboxEntry, operationConflict);
                var conflictMessage = 'Inventory item changed in room: ' + String(operationConflictItemId || 'unknown') + ' (' + String(operationConflictField || 'inventory') + ')';
                setCharacterSync('conflict', character, 'local→room', syncReason, conflictMessage);
                appendSyncEvent(character, 'local→room', syncReason, 'conflict', conflictMessage);
                if (!conflictArchived) appendSyncEvent(character, 'local→room', syncReason, 'conflict-archive-error', 'Both versions remain in room and outbox');
                emit();
                return { inventoryConflict:true };
              }
              throw roomError('Не удалось применить операцию инвентаря: ' + operationFailure, 'inventory-operation-failed');
            }
            liveSnapshot = result.snapshot && result.snapshot.val ? result.snapshot.val() : liveSnapshot;
            return { inventoryConflict:false };
          });
        } else if (scopedFields.length) {
          var scopedCharacterRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid + '/character');
          roomWrite=firebase.runTransaction(scopedCharacterRef, function (current) {
            if (!current || typeof current !== 'object') return;
            var next = Object.assign({}, current);
            scopedFields.forEach(function (field) {
              next[field] = liveSnapshot[field] == null ? [] : liveSnapshot[field];
            });
            next = applyEquipmentDerivedSnapshot(next, liveSnapshot);
            next.revision = liveSnapshot.revision;
            next.updatedAt = now();
            next.updatedBy = liveSnapshot.updatedBy;
            next.source = liveSnapshot.source;
            next.syncOperationId = liveSnapshot.syncOperationId || '';
            return next;
          }).then(function (result) {
            if (!result || !result.committed) throw roomError('Лист героя недоступен для пересчёта снаряжения.', 'inventory-character-missing');
            liveSnapshot = result.snapshot && result.snapshot.val ? result.snapshot.val() : liveSnapshot;
            return result;
          });
        } else {
          memberUpdates.character = liveSnapshot;
          roomWrite=firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), memberUpdates);
        }
        return roomWrite.then(function (writeResult) {
          if (writeResult && (writeResult.inventoryConflict || writeResult.journalConflict)) {
            return refreshRoom(session.code).catch(function () { return currentRoom; }).then(function () { return api.getSnapshot(); });
          }
          setCharacterSync('synced', liveSnapshot, 'local→room', syncReason);
          appendSyncEvent(liveSnapshot, 'local→room', syncReason, 'ack');
          return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
        });
      }).catch(function (error) {
        setCharacterSync(connected ? 'conflict' : 'offline', character, 'local→room', options.reason || 'edit', error);
        appendSyncEvent(character, 'local→room', options.reason || 'edit', 'error', error);
        emit();
        return api.getSnapshot();
      });
    },

    persistCampaignCharacter: function(character) {
      // Legacy no-op facade. Shared campaign snapshots are read-only history.
      return Promise.resolve(null);
    },

    syncCampaignHeroes: function(localCharacters) {
      // Legacy no-op facade. Only the active room character is synchronized.
      return Promise.resolve(null);
    },

    attachGameMaster: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Этот вход доступен только создателю комнаты.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          if (room.phase !== 'character-select') throw roomError('Выбор персонажей уже завершён.', 'wrong-phase');
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
            characterId: null,
            character: null,
            gmReady: true,
            name: 'Гейм-мастер',
            lastSeen: firebase.serverTimestamp(),
            online: true
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','wrong-phase'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    launchJourney: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Открыть путь может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          if (room.phase === 'journey') return room;
          if (room.phase !== 'character-select') throw roomError('Выбор персонажей ещё не начат.', 'wrong-phase');
          var members = membersOf(room);
          if (!members.length || members.some(function (member) {
            if (member.role === 'master') return !(member.gmReady || member.characterId);
            return !member.characterId ||
              member.customHeroApproval && member.customHeroApproval.status === 'pending';
          })) {
            throw roomError('Не все участники выбрали персонажей или мастер ещё не подтвердил личного героя.', 'characters-pending');
          }
          return firebase.update(roomRef(session.code), {
            phase: 'journey',
            journeyStartedAt: firebase.serverTimestamp(),
            updatedAt: firebase.serverTimestamp()
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','wrong-phase','characters-pending'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    startGame: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Запустить игроков может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          if (room.phase === 'playing') return room;
          if (room.phase !== 'character-select' && room.phase !== 'journey') throw roomError('Сначала откройте выбор персонажей.', 'wrong-phase');
          if (!room.scene || !Array.isArray(room.scene.layers) || !room.scene.layers.length) {
            throw roomError('Сначала выберите и покажите сцену.', 'scene-missing');
          }
          var players = membersOf(room, 'player');
          if (!room.testMode && (!players.length || players.some(function (member) { return !member.characterId; }))) {
            throw roomError('Не все игроки выбрали персонажей.', 'characters-pending');
          }
          return firebase.update(roomRef(session.code), {
            phase: 'playing',
            gameStartedAt: firebase.serverTimestamp(),
            updatedAt: firebase.serverTimestamp()
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','wrong-phase','scene-missing','characters-pending'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    publishScene: function (scene) {
      scene = scene || {};
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Настраивать сцену может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          return prepareSceneMedia(scene).then(function(preparedScene){
            var payload = sanitizeScene(preparedScene);
            payload.revision = now();
            payload.publishedAt = firebase.serverTimestamp();
            return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/scene'), payload);
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','scene-too-large'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    cueCamera: function (x, y, zoom) {
      x = Math.max(0, Math.min(100, Number(x) || 0));
      y = Math.max(0, Math.min(100, Number(y) || 0));
      zoom = Math.max(0.4, Math.min(3, Number(zoom) || 1));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Направлять обзор может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/cameraCue'), {
            id: 'camera-' + now() + '-' + Math.random().toString(36).slice(2, 7),
            x: x, y: y, zoom: zoom, createdAt: firebase.serverTimestamp()
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    sendPing: function (x, y, options) {
      options = options || {};
      x = Math.max(0, Math.min(100, Number(x) || 0));
      y = Math.max(0, Math.min(100, Number(y) || 0));
      if (now() - lastPingWriteAt < 600) return Promise.reject(roomError('Пинг можно отправлять не чаще двух раз в секунду.', 'ping-rate-limit'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (!room.members || !room.members[user.uid]) throw roomError('Участник больше не состоит в комнате.', 'member-required');
          lastPingWriteAt = now();
          var focus = !!options.focus && room.masterUid === user.uid;
          return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/ping'), {
            id: 'ping-' + lastPingWriteAt + '-' + Math.random().toString(36).slice(2, 7),
            uid: user.uid,
            x: x,
            y: y,
            focus: focus,
            zoom: Math.max(.4, Math.min(3, Number(options.zoom) || 1)),
            createdAt: firebase.serverTimestamp()
          });
        });
      }).catch(function (error) {
        if (error && ['ping-rate-limit','room-required','room-not-found','member-required'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    sendPingTrail: function (x, y, trailId, sequence) {
      x = Math.max(0, Math.min(100, Number(x) || 0));
      y = Math.max(0, Math.min(100, Number(y) || 0));
      trailId = String(trailId || '').slice(0, 80);
      sequence = Math.max(0, Math.min(10000, Math.floor(Number(sequence) || 0)));
      if (!trailId) return Promise.reject(roomError('Не задан идентификатор следа.', 'ping-trail-invalid'));
      if (now() - lastPingTrailWriteAt < 170) return Promise.reject(roomError('След пинга отправляется слишком часто.', 'ping-trail-rate-limit'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        if (!currentRoom) throw roomError('Комната больше недоступна.', 'room-not-found');
        if (!currentRoom.members || !currentRoom.members[user.uid]) throw roomError('Участник больше не состоит в комнате.', 'member-required');
        lastPingTrailWriteAt = now();
        return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/pingTrail/' + user.uid), {
          id: trailId,
          uid: user.uid,
          sequence: sequence,
          x: x,
          y: y,
          createdAt: firebase.serverTimestamp()
        });
      }).catch(function (error) {
        if (error && ['ping-trail-invalid','ping-trail-rate-limit','room-required','room-not-found','member-required'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    // Опубликовать сцену как отдельную зону rooms/{code}/zones/{zoneId}
    publishZone: function (zoneId, scene) {
      zoneId = String(zoneId || '').slice(0, 100);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Управлять зонами может только мастер.', 'master-only');
        if (!zoneId) throw roomError('Не задан идентификатор зоны.', 'zone-missing');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          return prepareSceneMedia(scene).then(function(preparedScene){
            var payload = sanitizeScene(preparedScene);
            payload.revision = now();
            payload.publishedAt = firebase.serverTimestamp();
            return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/zones/' + zoneId), payload);
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','scene-too-large','zone-missing'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    moveMasterToken: function (tokenId, targetX, targetY, origin) {
      origin=origin||{};tokenId=String(tokenId||'').slice(0,128);
      targetX=Math.max(0,Math.min(100,Number(targetX)||0));targetY=Math.max(0,Math.min(100,Number(targetY)||0));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Управлять существами может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var found=null,candidates=[{path:'scene',scene:room.scene}];
          Object.keys(room.zones||{}).forEach(function(zoneId){candidates.push({path:'zones/'+zoneId,scene:room.zones[zoneId]});});
          candidates.some(function(candidate){var tokens=candidate.scene&&Array.isArray(candidate.scene.tokens)?candidate.scene.tokens:[];var index=tokens.findIndex(function(token){return token&&String(token.id)===tokenId;});if(index<0)return false;found={path:candidate.path,scene:candidate.scene,tokens:tokens,index:index,token:tokens[index]};return true;});
          if(!found)throw roomError('Жетон существа не найден на опубликованной сцене.','token-missing');
          if(found.token.type==='hero')throw roomError('Для героя используется управление игрока.','token-invalid');
          var fromX=Math.max(0,Math.min(100,Number(found.token.x==null?origin.x:found.token.x)||0)),fromY=Math.max(0,Math.min(100,Number(found.token.y==null?origin.y:found.token.y)||0));
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[],entryIndex=-1,spent=movementCells(found.scene||room.scene,fromX,fromY,targetX,targetY);
          if(combat&&combat.active){
            entryIndex=order.findIndex(function(entry){return entry&&String(entry.tokenId||'')===tokenId;});
            if(entryIndex<0||entryIndex!==Number(combat.turnIndex||0))throw roomError('В бою можно двигать только активное существо.','combat-not-turn');
            var entry=combatEntryWithRoomStatuses(room,Object.assign({},order[entryIndex]));
            if(combatRestrictions(entry).blocked.movement)throw roomError('Текущее состояние не позволяет двигаться.','combat-status-blocked');
            var economy=Object.assign({movement:7,movementMax:7},entry.economy||{});if(spent>Number(economy.movement||0))throw roomError('Не хватает движения: нужно '+spent+', осталось '+Number(economy.movement||0)+' клеток.','combat-movement-spent');
            economy.movement=Math.max(0,Number(economy.movement||0)-spent);entry.economy=economy;order[entryIndex]=entry;
          }
          var stamp=now(),distance=Math.hypot(targetX-fromX,targetY-fromY),updates={};
          updates[found.path+'/tokens/'+found.index+'/x']=targetX;updates[found.path+'/tokens/'+found.index+'/y']=targetY;
          if(entryIndex>=0){updates['combat/order']=order;updates['combat/updatedAt']=stamp;}
          updates.lastMovement={id:String(origin.visualId||('gm-move-'+tokenId.slice(0,28)+'-'+stamp)).slice(0,160),uid:'',tokenId:tokenId,name:String(found.token.name||'Существо').slice(0,80),fromX:fromX,fromY:fromY,toX:targetX,toY:targetY,zoneId:found.path.indexOf('zones/')===0?found.path.slice(6):'',duration:Math.max(900,Math.min(4200,Math.round(distance*62))),startedAt:stamp};updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','token-missing','token-invalid','combat-not-turn','combat-status-blocked','combat-movement-spent'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    requestMovement: function (targetX, targetY, origin) {
      origin = origin || {};
      targetX = Math.max(0, Math.min(100, Number(targetX) || 0));
      targetY = Math.max(0, Math.min(100, Number(targetY) || 0));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'player') throw roomError('Движение доступно только игроку.', 'player-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var member = room.members && room.members[user.uid];
          if (!member || member.role !== 'player') throw roomError('Игрок не найден в комнате.', 'player-only');
          var zoneId = String(member.zone || '');
          var scene = zoneId && room.zones && room.zones[zoneId] ? room.zones[zoneId] : room.scene;
          var tokens = scene && Array.isArray(scene.tokens) ? scene.tokens : [];
          var token = tokens.filter(function (item) { return item && item.type === 'hero' && item.memberUid === user.uid; })[0];
          if (!token && (!isFinite(Number(origin.x)) || !isFinite(Number(origin.y)))) throw roomError('Мастер ещё не разместил ваш жетон на сцене.', 'token-missing');
          var request = {
            id: 'move-' + user.uid.slice(0, 10) + '-' + now(),
            uid: user.uid,
            name: member.character && member.character.name || member.name || 'Герой',
            fromX: Math.max(0, Math.min(100, Number(token ? token.x : origin.x) || 0)),
            fromY: Math.max(0, Math.min(100, Number(token ? token.y : origin.y) || 0)),
            tokenId: String(token && token.id || origin.tokenId || '').slice(0, 128),
            toX: targetX,
            toY: targetY,
            zoneId: zoneId,
            status: 'pending',
            createdAt: now()
          };
          var battle = combatHeroEntry(room, user.uid);
          if (battle.combat && battle.combat.active) {
            if (battle.index < 0 || battle.index !== Number(battle.combat.turnIndex || 0)) throw roomError('Передвигаться в бою можно только в свой ход.', 'combat-not-turn');
            if (combatEntryCurrentHp(battle.entry) <= 0) throw roomError('При 0 HP герой не может передвигаться.', 'combat-zero-hp');
            if (combatRestrictions(combatEntryWithRoomStatuses(room, battle.entry)).blocked.movement) throw roomError('Текущее состояние не позволяет двигаться.', 'combat-status-blocked');
            request.cells = movementCells(scene, request.fromX, request.fromY, request.toX, request.toY);
            var moveLeft = Number(battle.entry.economy && battle.entry.economy.movement);
            if (!isFinite(moveLeft)) moveLeft = Math.max(0, Number(member.character && member.character.speed) || 7);
            if (request.cells > moveLeft) throw roomError('Не хватает движения: нужно '+request.cells+', осталось '+moveLeft+' клеток.', 'combat-movement-spent');
          }
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), { movementRequest: request }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['player-only','room-not-found','token-missing','combat-not-turn','combat-zero-hp','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    requestMovementAs: function (requestUid, targetX, targetY, origin) {
      origin = origin || {};
      requestUid = String(requestUid || '').slice(0, 128);
      targetX = Math.max(0, Math.min(100, Number(targetX) || 0));
      targetY = Math.max(0, Math.min(100, Number(targetY) || 0));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Тестировать движение от имени героя может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var member = room.members && room.members[requestUid];
          if (!member || member.role !== 'player') throw roomError('Сначала выберите жетон героя.', 'player-missing');
          var zoneId = String(member.zone || '');
          var scene = zoneId && room.zones && room.zones[zoneId] ? room.zones[zoneId] : room.scene;
          var tokens = scene && Array.isArray(scene.tokens) ? scene.tokens : [];
          var token = tokens.filter(function (item) { return item && item.type === 'hero' && item.memberUid === requestUid; })[0];
          if (!token && (!isFinite(Number(origin.x)) || !isFinite(Number(origin.y)))) throw roomError('Жетон героя ещё не опубликован на сцене.', 'token-missing');
          var request = {
            id: 'move-' + requestUid.slice(0, 10) + '-' + now(), uid: requestUid,
            name: member.character && member.character.name || member.name || 'Герой',
            fromX: Math.max(0, Math.min(100, Number(token ? token.x : origin.x) || 0)), fromY: Math.max(0, Math.min(100, Number(token ? token.y : origin.y) || 0)),
            tokenId: String(token && token.id || origin.tokenId || '').slice(0, 128),
            toX: targetX, toY: targetY, zoneId: zoneId, status: 'pending', createdAt: now(), testByMaster: true
          };
          var battle = combatHeroEntry(room, requestUid);
          if (battle.combat && battle.combat.active) {
            if (battle.index < 0 || battle.index !== Number(battle.combat.turnIndex || 0)) throw roomError('Передвигаться в бою можно только в свой ход.', 'combat-not-turn');
            if (combatEntryCurrentHp(battle.entry) <= 0) throw roomError('При 0 HP герой не может передвигаться.', 'combat-zero-hp');
            if (combatRestrictions(combatEntryWithRoomStatuses(room, battle.entry)).blocked.movement) throw roomError('Текущее состояние не позволяет двигаться.', 'combat-status-blocked');
            request.cells = movementCells(scene, request.fromX, request.fromY, request.toX, request.toY);
            var moveLeft = Number(battle.entry.economy && battle.entry.economy.movement);
            if (!isFinite(moveLeft)) moveLeft = Math.max(0, Number(member.character && member.character.speed) || 7);
            if (request.cells > moveLeft) throw roomError('Не хватает движения: нужно '+request.cells+', осталось '+moveLeft+' клеток.', 'combat-movement-spent');
          }
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + requestUid), { movementRequest: request }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','player-missing','token-missing','combat-not-turn','combat-zero-hp','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveMovement: function (requestUid, accepted) {
      requestUid = String(requestUid || '').slice(0, 128);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Подтверждать движение может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var request = room.members && room.members[requestUid] && room.members[requestUid].movementRequest;
          if (!request || request.status !== 'pending') throw roomError('Этот запрос уже обработан.', 'request-missing');
          var requestPath = 'members/' + requestUid + '/movementRequest';
          var updates = {};
          updates[requestPath + '/status'] = accepted ? 'approved' : 'rejected';
          updates[requestPath + '/resolvedAt'] = now();
          if (accepted) {
            var zoneId = String(request.zoneId || '');
            var scene = zoneId && room.zones && room.zones[zoneId] ? room.zones[zoneId] : room.scene;
            var tokens = scene && Array.isArray(scene.tokens) ? scene.tokens : [];
            var tokenIndex = -1;
            tokens.some(function (token, index) {
              if (token && token.type === 'hero' && token.memberUid === requestUid) { tokenIndex = index; return true; }
              return false;
            });
            var scenePath = zoneId ? 'zones/' + zoneId : 'scene';
            var battle = combatHeroEntry(room, requestUid);
            if (battle.combat && battle.combat.active) {
              if (battle.index < 0 || battle.index !== Number(battle.combat.turnIndex || 0)) throw roomError('Ход этого героя уже завершён.', 'combat-not-turn');
              if (combatEntryCurrentHp(battle.entry) <= 0) throw roomError('При 0 HP герой не может передвигаться.', 'combat-zero-hp');
              if (combatRestrictions(combatEntryWithRoomStatuses(room, battle.entry)).blocked.movement) throw roomError('Текущее состояние не позволяет двигаться.', 'combat-status-blocked');
              var spent = request.cells == null ? movementCells(scene, request.fromX, request.fromY, request.toX, request.toY) : Math.max(0, Number(request.cells) || 0);
              var battleEntry = Object.assign({}, battle.entry), battleEconomy = Object.assign({ movement:7, movementMax:7 }, battleEntry.economy || {});
              if (spent > Number(battleEconomy.movement || 0)) throw roomError('У героя больше нет движения на этот путь.', 'combat-movement-spent');
              battleEconomy.movement = Math.max(0, Number(battleEconomy.movement || 0) - spent);
              battleEntry.economy = battleEconomy; battle.order[battle.index] = battleEntry;
              updates['combat/order'] = battle.order;
            }
            if (tokenIndex < 0) {
              var member = room.members && room.members[requestUid] || {};
              tokenIndex = tokens.length;
              updates[scenePath + '/tokens/' + tokenIndex] = { id:String(request.tokenId||('hero-'+requestUid)),type:'hero',disposition:'hero',memberUid:requestUid,name:member.character&&member.character.name||member.name||'Герой',x:Math.max(0,Math.min(100,Number(request.toX)||0)),y:Math.max(0,Math.min(100,Number(request.toY)||0)),size:58,z:tokenIndex+10,visible:true,hidden:false,locked:false,opacity:1 };
            } else {
              updates[scenePath + '/tokens/' + tokenIndex + '/x'] = Math.max(0, Math.min(100, Number(request.toX) || 0));
              updates[scenePath + '/tokens/' + tokenIndex + '/y'] = Math.max(0, Math.min(100, Number(request.toY) || 0));
            }
            var distance = Math.hypot(Number(request.toX) - Number(request.fromX), Number(request.toY) - Number(request.fromY));
            updates.lastMovement = {
              id: request.id,
              uid: requestUid,
              fromX: Number(request.fromX), fromY: Number(request.fromY),
              toX: Number(request.toX), toY: Number(request.toY),
              zoneId: zoneId,
              duration: Math.max(1400, Math.min(4800, Math.round(distance * 68))),
              startedAt: now()
            };
            var view = scene && scene.view || {};
            if (view.rememberExplored !== false) {
              (scene && Array.isArray(scene.regions) ? scene.regions : []).forEach(function (region) {
                if (!region || region.kind !== 'fog' || region.visible === false || !region.id || !pointInPolygon(Number(request.toX), Number(request.toY), region.points)) return;
                if (view.visionMode === 'individual') updates['members/' + requestUid + '/exploredRegions/' + region.id] = true;
                else updates['exploredRegions/' + region.id] = true;
              });
            }
          }
          updates.updatedAt = now();
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','request-missing','token-missing','combat-not-turn','combat-zero-hp','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    acknowledgeMovement: function (requestId) {
      requestId = String(requestId || '').slice(0, 160);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'player') return api.getSnapshot();
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var request = room.members && room.members[user.uid] && room.members[user.uid].movementRequest;
          if (!request || request.status === 'pending' || (requestId && request.id !== requestId)) return api.getSnapshot();
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), { movementRequest: null }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && error.code === 'room-not-found') throw error;
        throw friendlyFirebaseError(error);
      });
    },

    requestAction: function (text, actionKind, speakerUid, details) {
      text = String(text || '').trim().slice(0, 300);
      actionKind = String(actionKind || 'custom').slice(0, 40);
      speakerUid = String(speakerUid || '').slice(0, 128);
      details = details && typeof details === 'object' ? details : null;
      var abilityFromOutbox = !!(details && details.fromOutbox);
      var suppliedAbilityOperationId = String(details && details.operationId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
      var abilityOperationId = actionKind === 'ability'
        ? suppliedAbilityOperationId || 'action-ability-' + now() + '-' + Math.random().toString(36).slice(2, 8)
        : '';
      var abilityDiagnostic = null;
      var abilityRequestWritten = false;
      var abilityQueueResult = {ok:false,skipped:true};
      if (!text) return Promise.resolve(api.getSnapshot());
      if (actionKind === 'ability' && !tabCanWrite()) {
        return Promise.reject(roomError('Эта вкладка работает только для просмотра. Передайте управление ей перед отправкой заявки.', 'tab-read-only'));
      }
      if (actionKind === 'ability' && !abilityFromOutbox) {
        var queuedAbilityDetails = Object.assign({}, details || {});
        delete queuedAbilityDetails.operationId;
        delete queuedAbilityDetails.fromOutbox;
        abilityQueueResult = queueGameplayOperation('ability-request', abilityOperationId, {
          text:text,
          speakerUid:speakerUid,
          details:queuedAbilityDetails
        });
        if (!abilityQueueResult.ok && !connected) {
          return Promise.reject(roomError('Нет связи, а локальная очередь заявки недоступна.', abilityQueueResult.error || 'operation-queue-unavailable'));
        }
      }
      if (actionKind === 'ability' && !connected) {
        appendOperationEvent('ability-cast', abilityOperationId, 'queued-offline', {
          kind:details && details.kind || 'ability',
          name:details && details.name || ''
        });
        return Promise.resolve(gameplayOperationSnapshot('ability-request', abilityOperationId));
      }
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var targetUid = session.role === 'master' && speakerUid ? speakerUid : user.uid;
          var member = room.members && room.members[targetUid];
          if (!member || member.role !== 'player') throw roomError('Герой не найден в комнате.', 'player-missing');
          if (actionKind === 'ability') {
            var abilityBattle = combatHeroEntry(room, targetUid);
            if (abilityBattle.combat && abilityBattle.combat.active && abilityBattle.entry && Number(abilityBattle.entry.hp == null ? abilityBattle.entry.hpMax : abilityBattle.entry.hp) <= 0) {
              throw roomError('При 0 HP герой не может применять способности и заклинания.', 'combat-zero-hp');
            }
          }
          if (abilityOperationId && member.actionOperationIds && member.actionOperationIds[abilityOperationId]) {
            removeGameplayOperation(abilityOperationId);
            appendOperationEvent('ability-cast', abilityOperationId, 'already-resolved', {
              kind:details && details.kind || 'ability',
              name:details && details.name || '',
              targetUid:targetUid
            });
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          }
          if (member.actionRequest && abilityOperationId && String(member.actionRequest.id || '') === abilityOperationId) {
            removeGameplayOperation(abilityOperationId);
            appendOperationEvent('ability-cast', abilityOperationId, member.actionRequest.status === 'pending' ? 'already-pending' : 'already-resolved', {
              kind:member.actionRequest.ability && member.actionRequest.ability.kind || 'ability',
              name:member.actionRequest.ability && member.actionRequest.ability.name || '',
              targetUid:targetUid
            });
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          }
          if (member.actionRequest && (member.actionRequest.status === 'pending' || abilityFromOutbox)) {
            throw roomError('Предыдущая заявка ещё ждёт решения мастера.', 'request-pending');
          }
          var request = {
            id: abilityOperationId || 'action-' + targetUid.slice(0, 10) + '-' + now(), uid: targetUid,
            name: member.character && member.character.name || member.name || 'Герой',
            portrait: member.character && member.character.portrait || '',
            text: text, actionKind: actionKind, status: 'pending', createdAt: now(),
            testByMaster: session.role === 'master'
          };
          if (details && actionKind !== 'ability' && actionKind !== 'spell-learning') {
            request.details = {
              x: details.x == null ? null : Math.max(0, Math.min(100, Number(details.x) || 0)),
              y: details.y == null ? null : Math.max(0, Math.min(100, Number(details.y) || 0)),
              tokenId: String(details.tokenId || '').slice(0, 120),
              targetKey: String(details.targetKey || '').slice(0, 160),
              weaponId: String(details.weaponId || '').slice(0, 120),
              statKey: String(details.statKey || '').slice(0, 16),
              masteryBonus: Math.max(0, Math.min(3, Number(details.masteryBonus) || 0)),
              mode: ['normal','advantage','disadvantage'].indexOf(details.mode) >= 0 ? details.mode : 'normal'
            };
          }
          if (details && actionKind === 'ability') {
            request.ability = {
              key:String(details.key || '').slice(0,120), sourceId:String(details.sourceId || '').slice(0,120),
              name:String(details.name || '').slice(0,120), kind:String(details.kind || '').slice(0,60),
              actionCost:['long','short','reaction','free'].indexOf(details.actionCost)>=0?details.actionCost:'long',
              resolutionMode:['attack','save','automatic','utility'].indexOf(details.resolutionMode)>=0?details.resolutionMode:'utility',
              attackStat:['str','dex','int','cha','per','con'].indexOf(details.attackStat)>=0?details.attackStat:'',
              saveStat:['str','dex','int','cha','per','con'].indexOf(details.saveStat)>=0?details.saveStat:'',
              saveDC:details.saveDC==null?null:Math.max(1,Math.min(40,Number(details.saveDC)||10)),
              rangeCells:Math.max(0,Math.min(100,Number(details.rangeCells)||0)),
              aoeRadius:Math.max(0,Math.min(30,Number(details.aoeRadius)||0)),
              areaWidth:Math.max(1,Math.min(12,Number(details.areaWidth)||1)),
              targetCount:Math.max(1,Math.min(30,Number(details.targetCount)||1)),
              damageFormula:String(details.damageFormula || '').slice(0,24), damageType:String(details.damageType || '').slice(0,50),
              healFormula:String(details.healFormula || '').slice(0,24), halfOnSave:!!details.halfOnSave,
              targetMode:String(details.targetMode || 'target').slice(0,24),
              durationRounds:Math.max(0,Math.min(99,Number(details.durationRounds)||0)), concentration:!!details.concentration,
              cooldown:details.cooldown&&typeof details.cooldown==='object'?{kind:String(details.cooldown.kind||'').slice(0,30),rounds:Math.max(0,Math.min(99,Number(details.cooldown.rounds)||0)),label:String(details.cooldown.label||'').slice(0,80)}:null,
              resourceKey:String(details.resourceKey || '').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100),
              resourceMax:Math.max(0,Math.min(99,Number(details.resourceMax)||0)),
              resourceUsed:Math.max(0,Math.min(99,Number(details.resourceUsed)||0)),
              statuses:(Array.isArray(details.statuses)?details.statuses:[]).slice(0,8).map(function(status){return String(status&&typeof status==='object'&&(status.key||status.statusKey||status.id)||status||'').slice(0,60);}).filter(Boolean),
              description:String(details.description || '').slice(0,500)
            };
            request.target=normalizeAbilityTargeting(details.targeting);
            var usage=member.character&&member.character.abilityUsage&&member.character.abilityUsage[request.ability.resourceKey];
            if(request.ability.resourceMax&&usage&&Number(usage.used)>=request.ability.resourceMax)throw roomError('Заряды этой способности закончились.','ability-exhausted');
            abilityDiagnostic = {
              kind: request.ability.kind || 'ability',
              name: request.ability.name,
              targetUid: targetUid,
              targetCount: request.target && request.target.mode === 'self' ? 1 : (request.target && (request.target.targetKey || request.target.point) ? 1 : 0),
              targetKeys: request.target && request.target.targetKey ? [request.target.targetKey] : []
            };
          }
          if(details&&actionKind==='spell-learning'){
            var spellId=String(details.spellId||'').slice(0,80);
            if(!spellId||/[.#$\[\]\/\u0000-\u001F\u007F]/.test(spellId)||['__proto__','prototype','constructor'].indexOf(spellId)>=0)throw roomError('Некорректное заклинание для изучения.','spell-learning-invalid');
            var spellRefs=member.character&&Array.isArray(member.character.spellRefs)?member.character.spellRefs:[];
            if(!spellRefs.some(function(id){return String(id)===spellId;}))throw roomError('Заклинание отсутствует в книге героя.','spell-learning-invalid');
            if(member.character.spellsLearned&&member.character.spellsLearned[spellId]===true)throw roomError('Это заклинание уже изучено.','spell-already-learned');
            request.learning={spellId:spellId,name:String(details.name||'Заклинание').slice(0,120),learnType:String(details.learnType||'').slice(0,30),learnText:String(details.learnText||'').slice(0,500)};
          }
          if (abilityDiagnostic) appendOperationEvent('ability-cast', request.id, 'sending-request', abilityDiagnostic);
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + targetUid), { actionRequest: request }).then(function () {
            abilityRequestWritten = true;
            if (!removeGameplayOperation(request.id)) appendOperationEvent('ability-cast', request.id, 'queue-remove-failed', abilityDiagnostic);
            if (abilityDiagnostic) appendOperationEvent('ability-cast', request.id, 'pending-gm', abilityDiagnostic);
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (abilityOperationId) appendOperationEvent('ability-cast', abilityOperationId, abilityRequestWritten?'request-refresh-failed':'request-failed', abilityDiagnostic || {kind:'ability'}, error);
        if (abilityOperationId) markGameplayOperationError(abilityOperationId, error);
        if (abilityOperationId && terminalGameplayError(error)) removeGameplayOperation(abilityOperationId);
        if (abilityRequestWritten) return api.getSnapshot();
        if (!abilityFromOutbox && abilityQueueResult.ok && !terminalGameplayError(error)) {
          return gameplayOperationSnapshot('ability-request', abilityOperationId);
        }
        if (error && ['room-required','room-not-found','player-missing','request-pending','ability-exhausted','combat-zero-hp','spell-learning-invalid','spell-already-learned'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveAction: function (requestUid, accepted, resolution) {
      requestUid = String(requestUid || '').slice(0, 128);
      resolution = resolution && typeof resolution === 'object' ? resolution : {};
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Решать заявки может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var member = room.members && room.members[requestUid];
          var request = member && member.actionRequest;
          if (!request || request.status !== 'pending') throw roomError('Эта заявка уже обработана.', 'request-missing');
          var resolvedAt = now(), messageId = 'action-result-' + resolvedAt;
          if(accepted&&request.actionKind==='spell-learning'&&request.learning&&request.learning.spellId){
            var learnedId=String(request.learning.spellId).slice(0,80),learnOperationId='spell-learning-'+resolvedAt+'-'+Math.random().toString(36).slice(2,7),learnAbort='';
            return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+requestUid),function(current){
              var currentRequest=current&&current.actionRequest,character=current&&current.character;
              if(!currentRequest||currentRequest.id!==request.id||currentRequest.status!=='pending'){learnAbort='request-missing';return;}
              if(!character){learnAbort='character-missing';return;}
              var refs=Array.isArray(character.spellRefs)?character.spellRefs:[];
              if(!refs.some(function(id){return String(id)===learnedId;})){learnAbort='spell-learning-invalid';return;}
              character.spellsLearned=Object.assign({},character.spellsLearned||{});character.spellsLearned[learnedId]=true;
              character.revision=Math.max(0,Number(character.revision)||0)+1;
              character.updatedAt=resolvedAt;character.updatedBy=user.uid;character.source='spell-learning-approved';character.syncOperationId=learnOperationId;
              current.character=character;
              current.actionRequest=Object.assign({},currentRequest,{status:'approved',resolvedAt:resolvedAt});
              current.messages=Object.assign({},current.messages||{});
              current.messages[messageId]={id:messageId,uid:requestUid,kind:'action-approved',name:request.name||current.name||'Герой',portrait:request.portrait||'',text:'Мастер разрешает изучение: '+String(request.learning.name||request.text||'заклинание'),ts:resolvedAt};
              return current;
            }).then(function(result){
              if(!result||!result.committed){
                if(learnAbort==='character-missing')throw roomError('Лист игрока недоступен.','character-missing');
                if(learnAbort==='spell-learning-invalid')throw roomError('Заклинание больше не находится в книге героя.','spell-learning-invalid');
                throw roomError('Эта заявка уже обработана.','request-missing');
              }
              return firebase.update(roomRef(session.code),{updatedAt:resolvedAt}).catch(function(){return null;}).then(function(){
                appendSyncEvent(result.snapshot&&result.snapshot.val&&result.snapshot.val().character||member.character,'master→room','spell-learning-approved','ack');
                return refreshRoom(session.code).then(function(){return api.getSnapshot();});
              });
            });
          }
          if (accepted && request.actionKind === 'ability' && request.ability && request.ability.resourceKey && Number(request.ability.resourceMax) > 0) {
            var abilityKey=String(request.ability.resourceKey).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
            var abilityMax=Math.max(1,Math.min(99,Math.floor(Number(request.ability.resourceMax)||1)));
            var abortCode='',operationId='ability-approval-'+resolvedAt+'-'+Math.random().toString(36).slice(2,7);
            return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+requestUid),function(current){
              var currentRequest=current&&current.actionRequest;
              if(!current||!currentRequest||currentRequest.id!==request.id||currentRequest.status!=='pending'){abortCode='request-missing';return;}
              var character=current.character;if(!character){abortCode='character-missing';return;}
              var usageResult=applyAbilityUsageDomainOperation(character.abilityUsage,abilityKey,{delta:1,max:abilityMax,updatedAt:resolvedAt,updatedBy:user.uid});
              if(!usageResult.changed){abortCode='ability-exhausted';return;}
              character.abilityUsage=usageResult.usage;
              character.revision=Math.max(0,Number(character.revision)||0)+1;
              character.updatedAt=resolvedAt;character.updatedBy=user.uid;character.source='ability-approved';character.syncOperationId=operationId;
              current.character=character;
              current.actionRequest=Object.assign({},currentRequest,{status:'approved',resolvedAt:resolvedAt});
              current.actionOperationIds=rememberActionOperation(current.actionOperationIds,currentRequest.id,resolvedAt);
              current.messages=Object.assign({},current.messages||{});
              current.messages[messageId]={id:messageId,uid:requestUid,kind:'action-approved',name:request.name||current.name||'Герой',portrait:request.portrait||'',text:'Мастер разрешает: '+request.text,ts:resolvedAt};
              return current;
            }).then(function(result){
              if(!result||!result.committed){
                if(abortCode==='ability-exhausted')throw roomError('Все заряды этой способности уже потрачены.','ability-exhausted');
                if(abortCode==='character-missing')throw roomError('Лист игрока недоступен.','character-missing');
                throw roomError('Эта заявка уже обработана.','request-missing');
              }
              return firebase.update(roomRef(session.code),{updatedAt:resolvedAt}).catch(function(){return null;}).then(function(){
                appendSyncEvent(result.snapshot&&result.snapshot.val&&result.snapshot.val().character||member.character,'master→room','ability-approved','ack');
                return refreshRoom(session.code).then(function(){return api.getSnapshot();});
              });
            });
          }
          var updates = {};
          updates['members/' + requestUid + '/actionRequest/status'] = accepted ? 'approved' : 'rejected';
          updates['members/' + requestUid + '/actionRequest/resolvedAt'] = resolvedAt;
          if (request.actionKind === 'ability') {
            updates['members/' + requestUid + '/actionOperationIds'] = rememberActionOperation(member.actionOperationIds,request.id,resolvedAt);
          }
          if (accepted && request.actionKind === 'combat-attack') {
            updates['members/' + requestUid + '/actionRequest/details/mode'] = ['advantage','disadvantage'].indexOf(resolution.mode) >= 0 ? resolution.mode : 'normal';
            var bonusDieSides=[4,6,8,10,12,20].indexOf(Number(resolution.bonusDieSides))>=0?Number(resolution.bonusDieSides):0;
            var bonusDiceCount=bonusDieSides?Math.max(0,Math.min(5,Math.floor(Number(resolution.bonusDiceCount)||0))):0;
            updates['members/' + requestUid + '/actionRequest/details/bonusDieSides'] = bonusDieSides;
            updates['members/' + requestUid + '/actionRequest/details/bonusDiceCount'] = bonusDiceCount;
          }
          updates['members/' + requestUid + '/messages/' + messageId] = {
            id: messageId, uid: requestUid, kind: accepted ? 'action-approved' : 'action-rejected',
            name: request.name || member.name || 'Герой', portrait: request.portrait || '',
            text: (accepted ? 'Мастер разрешает: ' : 'Мастер отклоняет: ') + request.text, ts: resolvedAt
          };
          updates.updatedAt = resolvedAt;
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','request-missing','character-missing','ability-exhausted','spell-learning-invalid'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    acknowledgeAction: function (requestId) {
      requestId = String(requestId || '').slice(0, 160);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'player') return api.getSnapshot();
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var request = room.members && room.members[user.uid] && room.members[user.uid].actionRequest;
          if (!request || request.status === 'pending' || (requestId && request.id !== requestId)) return api.getSnapshot();
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), { actionRequest: null }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && error.code === 'room-not-found') throw error;
        throw friendlyFirebaseError(error);
      });
    },

    requestApprovedAttackRoll: function (requestId) {
      requestId = String(requestId || '').slice(0, 160);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'player') throw roomError('Бросок выполняет игрок.', 'player-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var request=room.members&&room.members[user.uid]&&room.members[user.uid].actionRequest;
          if(!request||request.id!==requestId||request.status!=='approved'||request.actionKind!=='combat-attack')throw roomError('Разрешённая атака не найдена.','request-missing');
          var nextRequest=Object.assign({},request,{status:'roll-requested',rollRequestedAt:now(),rollError:null});
          return firebase.update(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid),{actionRequest:nextRequest}).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['player-only','room-not-found','request-missing'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    requestApprovedDamageRoll: function (requestId) {
      requestId=String(requestId||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='player')throw roomError('Выполнять броски могут только игроки.','player-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var request=room.members&&room.members[user.uid]&&room.members[user.uid].actionRequest;
          if(!request||request.id!==requestId||request.status!=='damage-requested'||request.actionKind!=='combat-attack')throw roomError('Ожидание урона не найдено.','request-missing');
          var damageRollStamp=now(),nextRequest=Object.assign({},request,{status:'damage-roll-requested',rollRequestedAt:damageRollStamp,damageRollRequestedAt:damageRollStamp,rollError:null});
          return firebase.update(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid),{actionRequest:nextRequest}).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['player-only','room-not-found','request-missing'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    finishApprovedAttackRoll: function (requestUid, requestId, accepted, eventId, errorText, isHit, isCritical) {
      requestUid=String(requestUid||'').slice(0,128);requestId=String(requestId||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Завершить бросок может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var request=room.members&&room.members[requestUid]&&room.members[requestUid].actionRequest;
          if(!request||request.id!==requestId)return api.getSnapshot();
          var newStatus=accepted?(isHit?'damage-requested':'resolved'):'approved';
          var update={status:newStatus,resolvedAt:accepted?now():null,resultEventId:accepted?String(eventId||''):null,rollError:accepted?null:String(errorText||'Не удалось выполнить атаку').slice(0,180)};
          if(accepted&&isHit)update['details/critical']=!!isCritical;
          return firebase.update(firebase.ref(db,'rooms/'+session.code+'/members/'+requestUid+'/actionRequest'),update).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    startCombat: function (sceneParticipants, heroOptions) {
      sceneParticipants = Array.isArray(sceneParticipants) ? sceneParticipants.slice(0, 40) : [];
      heroOptions = heroOptions && typeof heroOptions === 'object' ? heroOptions : {};
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Начать бой может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          if (room.combat && room.combat.active) throw roomError('Бой уже идёт.', 'combat-active');
          var order = membersOf(room, 'player').filter(function (member) {
            return member.characterId && member.character && (!heroOptions[member.uid] || heroOptions[member.uid].selected !== false);
          }).map(function (member) {
            var option=heroOptions[member.uid]||{},bonus = combatNumber(member.character.initiative,0), mode=['advantage','disadvantage'].indexOf(option.mode)>=0?option.mode:'normal';
            var speed = Math.max(0, combatNumber(member.character.speed,7) || 7);
            var entry = { key:'member:'+member.uid, kind:'hero', uid:member.uid, name:member.character.name || member.name || 'Герой', portrait:member.character.portrait || '', roll:null, rolls:[], rollMode:mode, bonus:bonus, total:null, initiativeGroup:'hero:'+member.uid, hp:Math.max(0,combatNumber(member.character.hpCur,0)), hpMax:Math.max(0,combatNumber(member.character.hpMax,0)), tempHp:Math.max(0,combatNumber(member.character.tempHp,0)), ac:Math.max(0,combatNumber(member.character.ac,10)), stats:member.character.stats||{}, mastery:member.character.mastery||[], weaponProfiles:member.character.weaponProfiles||[], equipmentBonuses:member.character.equipmentBonuses||{}, resistances:member.character.resistances||[], vulnerabilities:member.character.vulnerabilities||[], immunities:member.character.immunities||[], statuses:Array.isArray(member.character.statuses)?member.character.statuses:[], statusEffects:Array.isArray(member.character.statusEffects)?member.character.statusEffects:[], economy:{ long:1, short:1, reaction:1, movement:speed, movementMax:speed } };
            var restrictions = combatRestrictions(entry);
            entry.economy.long = restrictions.blocked.long ? 0 : 1;
            entry.economy.short = restrictions.blocked.short ? 0 : 1;
            entry.economy.reaction = restrictions.blocked.reaction ? 0 : 1;
            entry.economy.movement = combatTurnMovement(entry);
            return entry;
          });
          sceneParticipants.forEach(function (participant, index) {
            if (!participant || !participant.tokenId) return;
            var name = String(participant.name || 'Существо').trim().slice(0, 80) || 'Существо';
            var bonus = Math.max(-20, Math.min(20, Number(participant.bonus) || 0));
            var mode=['advantage','disadvantage'].indexOf(participant.mode)>=0?participant.mode:'normal';
            var portrait = String(participant.portrait || '');
            if (/^data:/i.test(portrait) && portrait.length > 16000) portrait = '';
            order.push({
              key:'token:'+String(participant.tokenId).slice(0, 120), kind:participant.kind === 'ally' ? 'ally' : (participant.kind === 'npc' ? 'npc' : 'enemy'),
              tokenId:String(participant.tokenId).slice(0, 120), name:name, portrait:portrait.slice(0, 16000),
              sourceRef:participant.sourceRef&&['npc','beast'].indexOf(participant.sourceRef.type)>=0?{type:participant.sourceRef.type,id:String(participant.sourceRef.id||'').slice(0,120)}:null,
              level:Math.max(1,Math.min(99,combatNumber(participant.level,1)||1)),
              roll:null, rolls:[], rollMode:mode, bonus:bonus, total:null, initiativeGroup:String(participant.group||participant.name||('group-'+index)).trim().slice(0,80), hp:participant.hp == null ? null : Math.max(0,combatNumber(participant.hp,0)),
              hpMax:participant.hpMax == null ? null : Math.max(0,combatNumber(participant.hpMax,0)), orderHint:index,
              tempHp:Math.min(Math.floor(Math.max(0,combatNumber(participant.hpMax,0))*0.5),Math.max(0,combatNumber(participant.tempHp,0))),
              ac:Math.max(0,combatNumber(participant.ac,10)),stats:participant.stats||{},mastery:participant.mastery||[],weaponProfiles:Array.isArray(participant.weaponProfiles)?participant.weaponProfiles.slice(0,12):[],resistances:participant.resistances||[],vulnerabilities:participant.vulnerabilities||[],immunities:participant.immunities||[],
              statuses:Array.isArray(participant.statuses) ? participant.statuses.slice(0, 23) : [],
              statusEffects:Array.isArray(participant.statusEffects) ? participant.statusEffects.slice(0, 40) : [],
              economy:{ long:1, short:1, reaction:1, movement:7, movementMax:7 }
            });
          });
          order.forEach(function (entry) {
            var restrictions = combatRestrictions(entry);
            entry.economy.long = restrictions.blocked.long ? 0 : 1;
            entry.economy.short = restrictions.blocked.short ? 0 : 1;
            entry.economy.reaction = restrictions.blocked.reaction ? 0 : 1;
            entry.economy.movement = combatTurnMovement(entry);
          });
          if (!order.length) throw roomError('В комнате пока нет героев.', 'combat-empty');
          var stamp = now(), startUpdates = {};
          startUpdates.combat={ active:false, phase:'initiative', round:0, turnIndex:0, order:order, startedAt:stamp, updatedAt:stamp };
          startUpdates.combatEvent={ id:'initiative-start-'+stamp, kind:'combat', name:'Мир Зарготы', text:'Бросьте инициативу!', ts:stamp };
          startUpdates.updatedAt=stamp;
          return firebase.update(roomRef(session.code), startUpdates).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','combat-active','combat-empty'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    rollInitiative: function (groupKey) {
      return ensureReady().then(function (user) {
        var session=readSession();if(!session)throw roomError('Сессия не найдена.','session-missing');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order:[];
          if(!combat||combat.phase!=='initiative'||combat.active)throw roomError('Сбор инициативы уже завершён.','initiative-closed');
          var targets=[];
          if(session.role==='master'){
            var requested=String(groupKey||'');
            targets=order.map(function(entry,index){return{entry:entry,index:index};}).filter(function(row){return !row.entry.uid&&String(row.entry.initiativeGroup||row.entry.key)===requested;});
          }else targets=order.map(function(entry,index){return{entry:entry,index:index};}).filter(function(row){return row.entry.uid===user.uid;});
          if(!targets.length)throw roomError('Участник инициативы не найден.','initiative-missing');
          if(targets.every(function(row){return row.entry.total!=null;}))return api.getSnapshot();
          var mode=targets[0].entry.rollMode||'normal',first=Math.floor(Math.random()*20)+1,second=mode==='normal'?null:Math.floor(Math.random()*20)+1;
          var kept=second==null?first:(mode==='advantage'?Math.max(first,second):Math.min(first,second)),stamp=now(),updates={};
          targets.forEach(function(row){
            updates['combat/order/'+row.index+'/roll']=kept;
            updates['combat/order/'+row.index+'/rolls']=second==null?[first]:[first,second];
            updates['combat/order/'+row.index+'/total']=kept+Number(row.entry.bonus||0);
            updates['combat/order/'+row.index+'/rolledAt']=stamp;
          });
          if(session.role==='master'){
            updates['combat/updatedAt']=stamp;
            updates.combatEvent={id:'initiative-roll-'+stamp,kind:'combat',name:targets[0].entry.name||'Участник',portrait:targets[0].entry.portrait||'',text:'Бросает инициативу.',ts:stamp};
          }
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['session-missing','room-not-found','initiative-closed','initiative-missing'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    beginCombatTurns: function () {
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Начать бой может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||combat.phase!=='initiative'||combat.active)throw roomError('Инициатива уже завершена.','initiative-closed');
          if(!order.length||order.some(function(entry){return entry.total==null;}))throw roomError('Ещё не все участники бросили инициативу.','initiative-pending');
          order.sort(function(a,b){return Number(b.total)-Number(a.total)||Number(b.bonus)-Number(a.bonus)||Number(a.orderHint||0)-Number(b.orderHint||0)||String(a.name||'').localeCompare(String(b.name||''),'ru');});
          var opening=order[0],openingBeforeHp=opening.hp,tick=statusTurnTick(opening),stamp=now();opening.hp=tick.hp;opening.tempHp=tick.tempHp;opening.statuses=tick.statuses;opening.statusEffects=tick.statusEffects;syncCombatZeroHp(opening,openingBeforeHp,'status-turn',stamp);order[0]=opening;
          var updates={combat:{active:true,phase:'active',round:1,turnIndex:0,order:order,startedAt:combat.startedAt||stamp,battleStartedAt:stamp,updatedAt:stamp},combatEvent:{id:'combat-start-'+stamp,kind:'combat',name:'Мир Зарготы',text:'Бой! Ход: '+(opening.name||'участник')+'.'+(tick.changes.length?' '+tick.changes.join('; '):''),ts:stamp},updatedAt:stamp};
          queueCombatEntryState(room,updates,opening,true);
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','initiative-closed','initiative-pending'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    advanceCombat: function (operation) {
      operation=operation&&typeof operation==='object'?operation:{};
      var suppliedOperationId=String(operation.operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сессия не найдена.', 'session-missing');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var stamp=now(),operationId=suppliedOperationId||('combat-turn-'+stamp+'-'+Math.random().toString(36).slice(2,8));
          var combat = room.combat, turnOperation=beginCombatTurnOperation(combat,operationId,stamp,user.uid);
          if(turnOperation.duplicate){currentRoom=room;emit();return api.getSnapshot();}
          combat=turnOperation.combat;
          var order = combat && Array.isArray(combat.order) ? combat.order : [];
          if (!combat || !combat.active || !order.length) throw roomError('Сейчас нет активного боя.', 'combat-missing');
          var previous = Math.max(0, Math.min(order.length - 1, Number(combat.turnIndex) || 0));
          var activeEntry = order[previous];
          if (session.role !== 'master' && (!activeEntry || String(activeEntry.uid || '') !== String(user.uid))) throw roomError('Сейчас не ваш ход.', 'turn-owner-only');
          if (session.role === 'master' && room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var activeZeroHp=activeEntry&&Math.max(0,combatNumber(activeEntry.hp,0))<=0?combatZeroHpState(activeEntry.zeroHp,activeEntry.key,stamp):null;
          if(activeZeroHp&&activeZeroHp.pending&&activeZeroHp.lastRollRound!==Math.max(1,Number(combat.round)||1))throw roomError('Сначала выполните ручной бросок борьбы за жизнь.','death-save-required');
          var next = (previous + 1) % order.length;
          var round = Number(combat.round || 1) + (next === 0 ? 1 : 0), updates = {}, phaseNotes = [];
          order = order.map(function (entry) { return Object.assign({}, entry); });
          var ending = order[previous], expiry = expireTurnStatuses(ending);
          ending.statusEffects = expiry.effects;
          ending.statuses = expiry.statuses;
          if (expiry.expired.length) phaseNotes.push('Истекло: ' + expiry.expired.map(function (effect) { return effect.label || effect.value || effect.statusKey; }).join(', '));
          order[previous] = ending;
          order = order.map(function (entry, index) {
            if (entry && entry.uid && room.members && room.members[entry.uid] && room.members[entry.uid].character) {
              var memberCharacter = room.members[entry.uid].character;
              if (index !== previous) entry = Object.assign({}, entry, {
                statuses:Array.isArray(memberCharacter.statuses) ? memberCharacter.statuses : [],
                statusEffects:Array.isArray(memberCharacter.statusEffects) ? memberCharacter.statusEffects : []
              });
            }
            var economy = Object.assign({ long:1, short:1, reaction:1, movement:7, movementMax:7 }, entry.economy || {});
            var updated = Object.assign({}, entry, { economy:economy }), restrictions = combatRestrictions(updated);
            if (index === next) {
              economy.long = restrictions.blocked.long ? 0 : 1;
              economy.short = restrictions.blocked.short ? 0 : 1;
              economy.movement = combatTurnMovement(updated);
            }
            if (next === 0) economy.reaction = restrictions.blocked.reaction ? 0 : 1;
            return updated;
          });
          var current = order[next], currentBeforeHp=current.hp, tick = statusTurnTick(current);
          current.hp = tick.hp;
          current.tempHp = tick.tempHp;
          current.statuses = tick.statuses;
          current.statusEffects = tick.statusEffects;
          syncCombatZeroHp(current,currentBeforeHp,'status-turn',stamp);
          order[next] = current;
          if (tick.changes.length) phaseNotes.push(tick.changes.join('; '));
          // A player may advance the shared combat cursor, but must never be
          // forced to write master-owned scene tokens or another member's
          // character in the same atomic update. Firebase rejects the whole
          // update when even one of those paths is forbidden.
          var masterAdvance=session.role==='master';
          queueCombatEntryState(room,updates,ending,false,{
            writeMember:masterAdvance||String(ending.uid||'')===String(user.uid),
            writeScene:masterAdvance
          });
          queueCombatEntryState(room,updates,current,true,{
            writeMember:masterAdvance||String(current.uid||'')===String(user.uid),
            writeScene:masterAdvance
          });
          updates['combat/turnIndex']=next;updates['combat/round']=round;updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          updates['combat/appliedTurnOperationIds']=combat.appliedTurnOperationIds;
          updates['combat/lastTurnOperation']=Object.assign({},combat.lastTurnOperation,{toRound:round,toTurn:next});
          updates.combatEvent={ id:'combat-turn-'+operationId, kind:'combat', name:'Мир Зарготы', text:'Ход: '+(current.name || 'участник')+'. Раунд '+round+'.'+(phaseNotes.length?' '+phaseNotes.join(' · '):''), ts:stamp };
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code), updates).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['session-missing','master-only','room-not-found','combat-missing','turn-owner-only','death-save-required'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    rollDeathSave: function (participantKey) {
      participantKey=String(participantKey||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();
        if(!session)throw roomError('Сначала войдите в комнату.','room-required');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0)),index=-1;
          if(session.role==='master'){
            if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
            index=participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):turnIndex;
          }else index=order.findIndex(function(entry){return entry&&entry.uid===user.uid;});
          if(index<0||!order[index])throw roomError('Участник боя не найден.','combat-participant-missing');
          if(index!==turnIndex)throw roomError('Борьба за жизнь выполняется только в ход персонажа.','combat-not-turn');
          var entry=combatEntryWithRoomStatuses(room,Object.assign({},order[index]));
          if(Math.max(0,combatNumber(entry.hp,0))>0)throw roomError('Бросок борьбы за жизнь нужен только при 0 HP.','death-save-not-required');
          var round=Math.max(1,Math.floor(Number(combat.round)||1)),previous=combatZeroHpState(entry.zeroHp,entry.key,now());
          if(!previous.pending)throw roomError(previous.state==='dead'?'Персонаж уже погиб.':'Персонаж уже стабилизирован.','death-save-complete');
          if(previous.lastRollRound===round)throw roomError('В этом раунде бросок уже выполнен.','death-save-already-rolled');
          var roll=rollDie(20),stamp=now(),nextState=resolveDeathSaveState(previous,roll,round,stamp);
          entry.zeroHp=nextState;order[index]=entry;
          var success=nextState.lastOutcome==='success'||nextState.lastOutcome==='critical-success';
          var resultLabel=nextState.state==='stabilized'?'стабилизация':nextState.state==='dead'?'смерть':success?'успех':'провал';
          var updates={
            'combat/order':order,
            'combat/updatedAt':stamp,
            combatEvent:{
              id:'death-save-'+stamp,
              kind:nextState.state==='dead'?'combat-death':nextState.state==='stabilized'?'combat-stabilized':'death-save',
              name:entry.name||'Участник',
              portrait:entry.portrait||'',
              text:'Ручной бросок «Борьба за жизнь»: d20 = '+roll+' — '+resultLabel+'. Успехи '+nextState.successes+'/4, провалы '+nextState.failures+'/4.',
              targetKey:entry.key||'',
              roll:roll,
              total:roll,
              outcome:nextState.lastOutcome,
              successes:nextState.successes,
              failures:nextState.failures,
              deathState:nextState.state,
              ts:stamp,
              revealAt:stamp+2600
            },
            updatedAt:stamp
          };
          if(entry.uid&&room.members&&room.members[entry.uid]){
            updates['members/'+entry.uid+'/character/deathSaves']=nextState;
            updates['members/'+entry.uid+'/character/revision']=firebase.increment(1);
            updates['members/'+entry.uid+'/character/updatedAt']=stamp;
            updates['members/'+entry.uid+'/character/updatedBy']=user.uid;
            updates['members/'+entry.uid+'/character/source']='death-save';
            updates['members/'+entry.uid+'/character/syncOperationId']='death-save-'+stamp;
          }
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','room-not-found','master-only','combat-missing','combat-participant-missing','combat-not-turn','death-save-not-required','death-save-complete','death-save-already-rolled'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    useCombatAction: function (actionType, participantKey) {
      actionType = String(actionType || '').toLowerCase();
      participantKey = String(participantKey || '').slice(0, 160);
      if (['long','short','reaction','free'].indexOf(actionType) < 0) return Promise.reject(roomError('Неизвестный тип действия.', 'combat-action-invalid'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var combat = room.combat, order = combat && Array.isArray(combat.order) ? combat.order.slice() : [];
          if (!combat || !combat.active || !order.length) throw roomError('Сейчас нет активного боя.', 'combat-missing');
          var turnIndex = Math.max(0, Math.min(order.length - 1, Number(combat.turnIndex) || 0));
          var index = -1;
          if (session.role === 'master') {
            index = participantKey ? order.findIndex(function (entry) { return entry && entry.key === participantKey; }) : turnIndex;
          } else {
            index = order.findIndex(function (entry) { return entry && entry.uid === user.uid; });
          }
          if (index < 0) throw roomError('Участник боя не найден.', 'combat-participant-missing');
          if ((actionType === 'long' || actionType === 'short') && index !== turnIndex) throw roomError('Длинное и короткое действие доступны только в свой ход.', 'combat-not-turn');
          var entry = combatEntryWithRoomStatuses(room, Object.assign({}, order[index]));
          var economy = Object.assign({ long:1, short:1, reaction:1 }, entry.economy || {});
          var restrictions = combatRestrictions(entry);
          if (actionType !== 'free' && restrictions.blocked[actionType]) throw roomError(restrictions.reasons[0] || 'Текущее состояние запрещает это действие.', 'combat-status-blocked');
          if (actionType !== 'free' && Number(economy[actionType] || 0) < 1) throw roomError('Это действие уже израсходовано.', 'combat-action-spent');
          if (actionType !== 'free') economy[actionType] = Math.max(0, Number(economy[actionType] || 0) - 1);
          if (restrictions.slowed && actionType === 'long') economy.short = 0;
          if (restrictions.slowed && actionType === 'short') economy.long = 0;
          entry.economy = economy;
          order[index] = entry;
          var labels = { long:'длинное действие', short:'короткое действие', reaction:'реакцию', free:'свободное действие' };
          var stamp = now();
          return firebase.update(roomRef(session.code), {
            'combat/order':order, 'combat/updatedAt':stamp,
            combatEvent:{ id:'combat-action-'+stamp, kind:'combat-action', name:entry.name || 'Участник', portrait:entry.portrait || '', text:'Использует '+labels[actionType]+'.', actionType:actionType, ts:stamp },
            updatedAt:stamp
          }).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['room-required','room-not-found','combat-missing','combat-participant-missing','combat-not-turn','combat-action-spent','combat-action-invalid','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmAddInventoryItem: function (memberUid, item) {
      memberUid = String(memberUid || '').slice(0, 128);
      var stamp = now();
      var operationId = 'gm-inventory-add-' + stamp + '-' + Math.random().toString(36).slice(2, 9);
      var normalizedItem = normalizeInventoryOperationItem(item, 'zg-item-' + operationId);
      if (!memberUid) return Promise.reject(roomError('Герой для предмета не выбран.', 'member-required'));
      if (!normalizedItem.name) return Promise.reject(roomError('Укажите название предмета.', 'inventory-item-invalid'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Добавлять предметы может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var member = room.members && room.members[memberUid];
          if (!member || member.role !== 'player' || !member.character) throw roomError('Лист игрока пока недоступен.', 'character-missing');
          var store = syncOutbox();
          if (!store || !store.applyInventoryOperations) throw roomError('Обработчик инвентаря недоступен. Обновите страницу.', 'inventory-operation-unavailable');
          var abortCode = '';
          var characterRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + memberUid + '/character');
          return firebase.runTransaction(characterRef, function (current) {
            var applied = store.applyInventoryOperations(current, [{type:'add',field:'inventoryItems',itemId:normalizedItem.itemId,item:normalizedItem}], {
              updatedAt:stamp,
              updatedBy:user.uid,
              source:'gm-inventory-add',
              operationId:operationId
            });
            if (!applied.ok) {
              abortCode = applied.error;
              return;
            }
            return applied.character;
          }).then(function (result) {
            if (!result || !result.committed) {
              if (abortCode === 'inventory-full') throw roomError('В инвентаре уже 80 предметов.', 'inventory-full');
              throw roomError('Лист игрока изменился или недоступен. Повторите попытку.', 'character-missing');
            }
            var appliedCharacter = result.snapshot && result.snapshot.val ? result.snapshot.val() : null;
            appendSyncEvent(appliedCharacter || member.character, 'local→room', 'gm-inventory-add', 'ack');
            return refreshRoom(session.code).catch(function () { return currentRoom; }).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['member-required','master-only','room-not-found','character-missing','inventory-item-invalid','inventory-full','inventory-operation-unavailable'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmAddJournalEntry: function (memberUid, entry) {
      memberUid = String(memberUid || '').slice(0, 128);
      var stamp = now();
      var operationId = 'gm-journal-add-' + stamp + '-' + Math.random().toString(36).slice(2, 9);
      var normalizedEntry = normalizeJournalOperationEntry(entry, operationId, { updatedAt:stamp });
      if (!memberUid) return Promise.reject(roomError('Герой для записи не выбран.', 'member-required'));
      if (!normalizedEntry.title && !normalizedEntry.text.trim()) return Promise.reject(roomError('Заполните заголовок или текст записи.', 'journal-entry-invalid'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Добавлять записи может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var member = room.members && room.members[memberUid];
          if (!member || member.role !== 'player' || !member.character) throw roomError('Лист игрока пока недоступен.', 'character-missing');
          normalizedEntry.updatedBy = user.uid;
          var abortCode = '';
          var characterRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + memberUid + '/character');
          return firebase.runTransaction(characterRef, function (current) {
            var applied = applyJournalDomainOperation(current, {type:'add',entry:normalizedEntry}, {
              updatedAt:stamp,
              updatedBy:user.uid,
              source:'gm-journal-add',
              operationId:operationId
            });
            if (!applied.ok) {
              abortCode = applied.error;
              return;
            }
            return applied.character;
          }).then(function (result) {
            if (!result || !result.committed) {
              if (abortCode === 'journal-full') throw roomError('В журнале комнаты уже 80 записей.', 'journal-full');
              throw roomError('Лист игрока изменился или недоступен. Повторите попытку.', 'character-missing');
            }
            var appliedCharacter = result.snapshot && result.snapshot.val ? result.snapshot.val() : null;
            appendSyncEvent(appliedCharacter || member.character, 'master→room', 'gm-journal-add', 'ack');
            return refreshRoom(session.code).catch(function () { return currentRoom; }).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['member-required','master-only','room-not-found','character-missing','journal-entry-invalid','journal-full'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmSendDelivery: function (memberUid, value) {
      return api.gmSendDeliveries([memberUid],value);
    },

    gmSendDeliveries: function (memberUids, value) {
      memberUids=(Array.isArray(memberUids)?memberUids:[memberUids]).map(function(uid){return String(uid||'').slice(0,160);}).filter(Boolean).filter(function(uid,index,list){return list.indexOf(uid)===index;}).slice(0,40);
      value=value&&typeof value==='object'?value:{};
      var deliveryFromOutbox=!!value.fromOutbox;
      var suppliedDeliveryOperationId=String(value.operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,150);
      var deliveryOperationId=suppliedDeliveryOperationId||'gm-delivery-op-'+now()+'-'+Math.random().toString(36).slice(2,8);
      var queuedDeliveryValue;
      try{queuedDeliveryValue=JSON.parse(JSON.stringify(value));}catch(queueCloneError){queuedDeliveryValue={};}
      delete queuedDeliveryValue.operationId;
      delete queuedDeliveryValue.fromOutbox;
      var kind=['item','quest','text','image'].indexOf(value.kind)>=0?value.kind:'text';
      var mood=['calm','solemn','ominous'].indexOf(value.mood)>=0?value.mood:'calm';
      var presentation=kind==='image'&&value.presentation==='cinematic'?'cinematic':'card';
      var privateDelivery=kind==='text'&&value.privateDelivery===true;
      var title=String(value.title||'').trim().slice(0,180);
      var body=String(value.text||'').trim().slice(0,6000);
      var image=String(value.image||'').trim();
      var deliveryDiagnosticBatchId=deliveryOperationId;
      var deliveryDiagnostics=[];
      var deliveryWriteCommitted=false;
      var deliveryQueueResult={ok:false,skipped:true};
      if(!tabCanWrite())return Promise.reject(roomError('Эта вкладка работает только для просмотра. Передайте управление ей перед выдачей.','tab-read-only'));
      if(image.length>350000)return Promise.reject(roomError('Изображение слишком большое для игровой комнаты.','delivery-image-large'));
      if(image&&!/^(?:https?:|data:image\/|images\/|\.?\.?\/)/i.test(image))image='';
      if(!memberUids.length)return Promise.reject(roomError('Выберите хотя бы одного игрока.','member-required'));
      if(!title)return Promise.reject(roomError('Укажите название выдачи.','delivery-title-required'));
      if(value.privateDelivery===true&&!privateDelivery)return Promise.reject(roomError('Скрытый канал доступен только для текста.','delivery-private-kind'));
      if(privateDelivery&&memberUids.length!==1)return Promise.reject(roomError('Скрытый текст можно отправить только одному игроку.','delivery-private-target'));
      var rawPayload=value.payload&&typeof value.payload==='object'?value.payload:{},payload={};
      if(kind==='item'){
        var bundleImageSize=image.length;
        var normalizeDeliveryItem=function(source,fallbackTitle,fallbackBody,fallbackImage){
          source=source&&typeof source==='object'?source:{};
          var itemImage=String(source.imageThumb||source.image||fallbackImage||'').trim();
          if(itemImage&&!/^(?:https?:|data:image\/|images\/|\.?\.?\/)/i.test(itemImage))itemImage='';
          bundleImageSize+=itemImage===image?0:itemImage.length;
          return{
            name:String(source.name||source.title||fallbackTitle||'Предмет').trim().slice(0,200),
            icon:String(source.icon||'📦').slice(0,20),
            image:itemImage,
            category:String(source.category||source.cat||'other').trim().slice(0,80),
            description:String(source.description||source.desc||source.text||fallbackBody||'').trim().slice(0,4000),
            effects:String(source.effects||source.effect||'').trim().slice(0,2000),
            damageFormula:String(source.damageFormula||source.damage||'').trim().slice(0,40),
            damageType:String(source.damageType||'').trim().slice(0,80),
            acBonus:Math.max(-99,Math.min(99,Number(source.acBonus!=null?source.acBonus:source.defense)||0)),
            attackStat:['str','dex','int','cha','per','con'].indexOf(source.attackStat)>=0?source.attackStat:'',
            range:String(source.range||'').trim().slice(0,80),
            weight:Math.max(0,Math.min(9999,Number(source.weight)||0)),
            slot:['','weapon','head','armor','cloak','hands','legs','accessory1','accessory2','talisman','belt'].indexOf(source.slot)>=0?source.slot:'',
            qty:Math.max(1,Math.min(999,Math.floor(Number(source.qty)||1))),
            equipped:false
          };
        };
        var rawItems=Array.isArray(rawPayload.items)?rawPayload.items.slice(0,20):[];
        if(rawItems.some(function(source){return String(source&&source.image||'').length>350000;}))return Promise.reject(roomError('Изображение предмета слишком большое для игровой комнаты.','delivery-image-large'));
        if(rawItems.length)payload.items=rawItems.map(function(source){return normalizeDeliveryItem(source,title,body,'');});
        else payload.item=normalizeDeliveryItem(rawPayload,title,body,image);
        if(bundleImageSize>350000)return Promise.reject(roomError('Суммарный размер изображений набора слишком большой.','delivery-image-large'));
      }else if(kind==='quest'){
        var rawQuest=rawPayload.quest&&typeof rawPayload.quest==='object'?rawPayload.quest:rawPayload;
        var questId=String(rawQuest.questId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
        if(!questId)questId=('quest-'+deliveryOperationId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
        var questStatus=['new','active','completed','failed'].indexOf(String(rawQuest.status||''))>=0?String(rawQuest.status):'new';
        var questImportance=String(rawQuest.importance||'')==='secondary'?'secondary':'main';
        payload.quest={
          questId:questId,
          title:title,
          text:body,
          icon:String(rawQuest.icon||'✦').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,12),
          image:image,
          imageFit:String(rawQuest.imageFit||'')==='cover'?'cover':'contain',
          status:questStatus,
          importance:questImportance
        };
      }else if(kind==='image'){
        payload.saveToJournal=rawPayload.saveToJournal===true;
        payload.compression=['compact','balanced','quality'].indexOf(String(rawPayload.compression||''))>=0
          ? String(rawPayload.compression)
          : 'balanced';
      }
      if(!deliveryFromOutbox){
        deliveryQueueResult=queueGameplayOperation('gm-delivery',deliveryOperationId,{
          memberUids:memberUids.slice(),
          value:queuedDeliveryValue
        });
        if(!deliveryQueueResult.ok&&!connected){
          return Promise.reject(roomError('Нет связи, а локальная очередь выдачи недоступна.',deliveryQueueResult.error||'operation-queue-unavailable'));
        }
      }
      if(!connected){
        appendOperationEvent('gm-delivery',deliveryOperationId,'queued-offline',{kind:kind,name:title,targetCount:memberUids.length});
        return Promise.resolve(gameplayOperationSnapshot('gm-delivery',deliveryOperationId));
      }
      return ensureReady().then(function(user){
        var session=readSession();
        if(!session||session.role!=='master')throw roomError('Выдавать награды может только мастер.','master-only');
        var privateExistingPromise=privateDelivery
          ? firebase.get(firebase.ref(db,'privateDeliveries/'+session.code+'/'+memberUids[0])).then(function(snapshot){return snapshot.exists()&&snapshot.val()||{};})
          : Promise.resolve({});
        return Promise.all([readRoom(session.code),privateExistingPromise]).then(function(results){
          var room=results[0],privateExisting=results[1]||{};
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var members=memberUids.map(function(memberUid){var member=room.members&&room.members[memberUid];if(!member||member.role!=='player'||!member.characterId||!member.character)throw roomError('Лист одного из выбранных игроков недоступен.','character-missing');return{uid:memberUid,member:member};});
          var stamp=now(),updates={},privateUpdates={},newDeliveryCount=0;
          members.forEach(function(target,index){
            var deliveryId='gm-delivery-'+deliveryOperationId+'-'+index;
            var diagnostic={id:deliveryId,kind:kind,name:title,targetUid:target.uid,targetCount:1,targetKeys:[]};
            deliveryDiagnostics.push(diagnostic);
            var appliedDeliveryIds=target.member.character&&Array.isArray(target.member.character.appliedDeliveryIds)?target.member.character.appliedDeliveryIds:[];
            var targetDeliveries=privateDelivery?privateExisting:target.member.gmDeliveries||{};
            if(targetDeliveries&&targetDeliveries[deliveryId]||appliedDeliveryIds.indexOf(deliveryId)>=0){
              appendOperationEvent('gm-delivery',deliveryId,'already-pending',diagnostic);
              return;
            }
            newDeliveryCount++;
            appendOperationEvent('gm-delivery',deliveryId,'sending',diagnostic);
            var deliveryRecord={
              id:deliveryId,
              batchId:members.length>1?deliveryOperationId:'',
              kind:kind,
              mood:mood,
              presentation:presentation,
              privateDelivery:privateDelivery,
              showPopup:value.showPopup!==false,
              title:title,
              text:body,
              image:image,
              payload:payload,
              status:'pending',
              createdAt:stamp,
              createdBy:user.uid
            };
            if(privateDelivery)privateUpdates[deliveryId]=deliveryRecord;
            else updates['members/'+target.uid+'/gmDeliveries/'+deliveryId]=deliveryRecord;
            var deliveries=targetDeliveries,resolved=Object.keys(deliveries).filter(function(key){
              return deliveries[key]&&deliveries[key].status&&deliveries[key].status!=='pending';
            }).sort(function(a,b){return Number(deliveries[b].resolvedAt||deliveries[b].createdAt||0)-Number(deliveries[a].resolvedAt||deliveries[a].createdAt||0);});
            resolved.slice(30).forEach(function(key){
              if(privateDelivery)privateUpdates[key]=null;
              else updates['members/'+target.uid+'/gmDeliveries/'+key]=null;
            });
          });
          if(!newDeliveryCount){
            removeGameplayOperation(deliveryOperationId);
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          }
          var deliveryWrite;
          if(privateDelivery){
            deliveryWrite=firebase.update(firebase.ref(db,'privateDeliveries/'+session.code+'/'+members[0].uid),privateUpdates);
          }else{
            updates.updatedAt=stamp;
            deliveryWrite=firebase.update(roomRef(session.code),updates);
          }
          return deliveryWrite.then(function(){
            deliveryWriteCommitted=true;
            if(!removeGameplayOperation(deliveryOperationId))appendOperationEvent('gm-delivery',deliveryOperationId,'queue-remove-failed',{kind:kind,name:title,targetCount:memberUids.length});
            deliveryDiagnostics.forEach(function(diagnostic){
              appendOperationEvent('gm-delivery',diagnostic.id,'pending-player',diagnostic);
            });
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(deliveryDiagnostics.length){
          deliveryDiagnostics.forEach(function(diagnostic){
            appendOperationEvent('gm-delivery',diagnostic.id,deliveryWriteCommitted?'send-refresh-failed':'send-failed',diagnostic,error);
          });
        }else{
          appendOperationEvent('gm-delivery',deliveryDiagnosticBatchId,'send-failed',{kind:kind,name:title,targetCount:memberUids.length},error);
        }
        markGameplayOperationError(deliveryOperationId,error);
        if(terminalGameplayError(error))removeGameplayOperation(deliveryOperationId);
        if(deliveryWriteCommitted)return api.getSnapshot();
        if(!deliveryFromOutbox&&deliveryQueueResult.ok&&!terminalGameplayError(error)){
          return gameplayOperationSnapshot('gm-delivery',deliveryOperationId);
        }
        if(error&&['member-required','delivery-title-required','delivery-image-large','delivery-private-kind','delivery-private-target','master-only','room-not-found','character-missing'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    acknowledgeGmDelivery: function (deliveryId, status) {
      deliveryId=String(deliveryId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
      status=['applied','failed'].indexOf(status)>=0?status:'applied';
      var deliveryDiagnostic=null;
      var deliveryAckWritten=false;
      if(!deliveryId)return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function(user){
        var session=readSession();
        if(!session||session.role!=='player')return api.getSnapshot();
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[user.uid];
          var sharedDelivery=member&&member.gmDeliveries&&member.gmDeliveries[deliveryId];
          var privateDelivery=currentPrivateDeliveries&&currentPrivateDeliveries[deliveryId];
          var delivery=sharedDelivery||privateDelivery;
          if(!delivery||delivery.status!=='pending')return api.getSnapshot();
          deliveryDiagnostic={kind:delivery.kind||'',name:delivery.title||'',targetUid:user.uid,targetCount:1};
          appendOperationEvent('gm-delivery',deliveryId,'acknowledging',deliveryDiagnostic);
          var updates={};
          var targetRef;
          if(privateDelivery&&privateDelivery.privateDelivery===true){
            updates.status=status;
            updates.resolvedAt=now();
            targetRef=firebase.ref(db,'privateDeliveries/'+session.code+'/'+user.uid+'/'+deliveryId);
          }else{
            updates['gmDeliveries/'+deliveryId+'/status']=status;
            updates['gmDeliveries/'+deliveryId+'/resolvedAt']=now();
            targetRef=firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid);
          }
          return firebase.update(targetRef,updates).then(function(){
            deliveryAckWritten=true;
            appendOperationEvent('gm-delivery',deliveryId,status==='applied'?'applied':'player-failed',deliveryDiagnostic);
            if(privateDelivery&&privateDelivery.privateDelivery===true)return api.getSnapshot();
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(deliveryDiagnostic)appendOperationEvent('gm-delivery',deliveryId,deliveryAckWritten?'ack-refresh-failed':'ack-failed',deliveryDiagnostic,error);
        if(error&&error.code==='room-not-found')throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmProposeCharacterPatch: function (memberUid, operation) {
      memberUid=String(memberUid||'').slice(0,128);operation=operation||{};
      var field=String(operation.field||''),patch=normalizeCharacterFieldPatch(field,operation.value);
      var reason=String(operation.reason||'').trim().slice(0,1000);
      if(!memberUid)return Promise.reject(roomError('Сначала выберите героя.','member-required'));
      if(patch===undefined)return Promise.reject(roomError('Это поле нельзя обновлять предложением.','character-patch-invalid'));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Предлагать обновления может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var member=room.members&&room.members[memberUid];
          if(!member||member.role!=='player'||!member.character)throw roomError('Лист игрока пока недоступен.','character-missing');
          var proposalId='field-update-'+now()+'-'+Math.random().toString(36).slice(2,8),abortCode='',stamp=now();
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+memberUid),function(current){
            var character=current&&current.character;
            if(!current||current.role!=='player'||!character){abortCode='character-missing';return;}
            var existing=current.characterUpdateProposal;
            if(existing&&['pending','approved'].indexOf(existing.status)>=0){abortCode='proposal-pending';return;}
            var baseValue=normalizeCharacterFieldPatch(field,character[field]);
            current.characterUpdateProposal={
              id:proposalId,
              kind:'field-patch',
              status:'pending',
              field:field,
              baseRevision:Math.max(0,Number(character.revision)||0),
              baseSignature:characterFieldPatchSignature(field,baseValue),
              baseValue:baseValue,
              patchValue:patch,
              reason:reason,
              createdAt:stamp,
              createdBy:user.uid
            };
            current.messages=Object.assign({},current.messages||{});
            current.messages[proposalId]={
              id:proposalId,uid:memberUid,kind:'character-update',name:'Мир Зарготы',
              portrait:'',text:'Мастер предлагает точечное обновление листа героя.',ts:stamp
            };
            return current;
          }).then(function(result){
            if(!result||!result.committed){
              if(abortCode==='proposal-pending')throw roomError('Предыдущее обновление ещё ждёт решения игрока.','proposal-pending');
              throw roomError('Лист игрока изменился или недоступен.','character-missing');
            }
            return firebase.update(roomRef(session.code),{updatedAt:stamp}).catch(function(){return null;}).then(function(){
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
            });
          });
        });
      }).catch(function(error){
        if(error&&['member-required','master-only','room-not-found','character-missing','proposal-pending','character-patch-invalid'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCharacterPatchProposal: function (accepted) {
      accepted=accepted===true;
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='player')throw roomError('Решение принимает владелец героя.','player-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[user.uid],proposal=member&&member.characterUpdateProposal;
          if(!member||member.role!=='player'||!member.character)throw roomError('Лист игрока недоступен.','character-missing');
          if(!proposal||proposal.kind!=='field-patch'||proposal.status!=='pending')throw roomError('Предложение уже обработано.','proposal-missing');
          var stamp=now(),resolution='';
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid),function(current){
            var live=current&&current.characterUpdateProposal,character=current&&current.character;
            if(!live||live.id!==proposal.id||live.kind!=='field-patch'||live.status!=='pending'){resolution='missing';return;}
            if(!accepted){
              current.characterUpdateProposal=Object.assign({},live,{status:'rejected',resolvedAt:stamp,resolvedBy:user.uid});
              resolution='rejected';return current;
            }
            var field=String(live.field||''),patch=normalizeCharacterFieldPatch(field,live.patchValue);
            if(patch===undefined||characterFieldPatchSignature(field,character[field])!==String(live.baseSignature||'')){
              current.characterUpdateProposal=Object.assign({},live,{status:'conflict',resolvedAt:stamp,resolvedBy:user.uid,conflictReason:'field-changed'});
              resolution='conflict';return current;
            }
            character[field]=patch;
            character.revision=Math.max(0,Number(character.revision)||0)+1;
            character.updatedAt=stamp;character.updatedBy=user.uid;character.source='gm-field-patch-approved';character.syncOperationId=live.id;
            current.character=character;
            current.characterUpdateProposal=Object.assign({},live,{status:'approved',resolvedAt:stamp,resolvedBy:user.uid,appliedCharacterRevision:character.revision});
            current.messages=Object.assign({},current.messages||{});
            current.messages[live.id+'-approved']={id:live.id+'-approved',uid:user.uid,kind:'character-update-approved',name:character.name||current.name||'Герой',portrait:character.portrait||'',text:'Принимает точечное обновление листа.',ts:stamp};
            resolution='approved';return current;
          }).then(function(result){
            if(!result||!result.committed)throw roomError('Предложение уже обработано.','proposal-missing');
            return firebase.update(roomRef(session.code),{updatedAt:stamp}).catch(function(){return null;}).then(function(){
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){
                var snapshot=api.getSnapshot();snapshot.characterPatchResolution=resolution;return snapshot;
              });
            });
          });
        });
      }).catch(function(error){
        if(error&&['player-only','room-not-found','character-missing','proposal-missing'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmProposeSkillUpdate: function (memberUid, operation) {
      memberUid=String(memberUid||'').slice(0,128);operation=operation||{};
      var skillIndex=Math.max(0,Math.min(39,Math.floor(Number(operation.skillIndex)||0)));
      var patch=normalizeSkillUpdateValue(operation.patch),reason=String(operation.reason||'').trim().slice(0,1000);
      if(!memberUid)return Promise.reject(roomError('Сначала выберите героя.','member-required'));
      if(!patch.name)return Promise.reject(roomError('У навыка должно быть название.','skill-update-invalid'));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Предлагать улучшения может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var member=room.members&&room.members[memberUid];
          if(!member||member.role!=='player'||!member.character)throw roomError('Лист игрока пока недоступен.','character-missing');
          var proposalId='skill-update-'+now()+'-'+Math.random().toString(36).slice(2,8),abortCode='',stamp=now();
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+memberUid),function(current){
            var character=current&&current.character,skills=character&&Array.isArray(character.skills)?character.skills:null;
            if(!current||current.role!=='player'||!skills||!skills[skillIndex]){abortCode='skill-missing';return;}
            var existing=current.characterUpdateProposal;
            if(existing&&['pending','approved'].indexOf(existing.status)>=0){abortCode='proposal-pending';return;}
            var baseSkill=normalizeSkillUpdateValue(skills[skillIndex]),skillId=stableSkillId(skills[skillIndex],skillIndex);
            current.characterUpdateProposal={
              id:proposalId,
              kind:'skill-update',
              status:'pending',
              skillId:skillId,
              skillIndex:skillIndex,
              baseRevision:Math.max(0,Number(character.revision)||0),
              baseSignature:skillUpdateSignature(baseSkill),
              baseSkill:baseSkill,
              patch:patch,
              reason:reason,
              createdAt:stamp,
              createdBy:user.uid
            };
            current.messages=Object.assign({},current.messages||{});
            current.messages[proposalId]={
              id:proposalId,uid:memberUid,kind:'character-update',name:'Мир Зарготы',
              portrait:'',text:'Мастер предлагает улучшить навык «'+patch.name+'».',ts:stamp
            };
            return current;
          }).then(function(result){
            if(!result||!result.committed){
              if(abortCode==='skill-missing')throw roomError('Навык больше не найден в листе игрока.','skill-missing');
              if(abortCode==='proposal-pending')throw roomError('Предыдущее улучшение ещё ждёт решения игрока.','proposal-pending');
              throw roomError('Лист игрока изменился или недоступен.','character-missing');
            }
            return firebase.update(roomRef(session.code),{updatedAt:stamp}).catch(function(){return null;}).then(function(){
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
            });
          });
        });
      }).catch(function(error){
        if(error&&['member-required','master-only','room-not-found','character-missing','skill-missing','proposal-pending','skill-update-invalid'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveSkillUpdateProposal: function (accepted) {
      accepted=accepted===true;
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='player')throw roomError('Решить судьбу улучшения может только владелец героя.','player-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[user.uid],proposal=member&&member.characterUpdateProposal;
          if(!member||member.role!=='player'||!member.character)throw roomError('Лист игрока недоступен.','character-missing');
          if(!proposal||proposal.kind!=='skill-update'||proposal.status!=='pending')throw roomError('Предложение уже обработано.','proposal-missing');
          var stamp=now(),resolution='',appliedCharacter=null;
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid),function(current){
            var live=current&&current.characterUpdateProposal,character=current&&current.character;
            if(!live||live.id!==proposal.id||live.status!=='pending'){resolution='missing';return;}
            if(!accepted){
              current.characterUpdateProposal=Object.assign({},live,{status:'rejected',resolvedAt:stamp,resolvedBy:user.uid});
              resolution='rejected';return current;
            }
            var skills=character&&Array.isArray(character.skills)?character.skills:null,index=Math.max(0,Math.min(39,Math.floor(Number(live.skillIndex)||0)));
            if(!skills||!skills[index]){
              current.characterUpdateProposal=Object.assign({},live,{status:'conflict',resolvedAt:stamp,resolvedBy:user.uid,conflictReason:'skill-missing'});
              resolution='conflict';return current;
            }
            var currentSkill=skills[index];
            if(stableSkillId(currentSkill,index)!==String(live.skillId||'')||skillUpdateSignature(currentSkill)!==String(live.baseSignature||'')){
              current.characterUpdateProposal=Object.assign({},live,{status:'conflict',resolvedAt:stamp,resolvedBy:user.uid,conflictReason:'skill-changed'});
              resolution='conflict';return current;
            }
            var nextSkills=skills.slice(),nextSkill=applySkillUpdatePatch(currentSkill,live.patch,live.skillId);
            nextSkills[index]=nextSkill;character.skills=nextSkills;
            character.revision=Math.max(0,Number(character.revision)||0)+1;
            character.updatedAt=stamp;character.updatedBy=user.uid;character.source='gm-skill-update-approved';character.syncOperationId=live.id;
            current.character=character;
            current.characterUpdateProposal=Object.assign({},live,{status:'approved',resolvedAt:stamp,resolvedBy:user.uid,appliedCharacterRevision:character.revision});
            current.messages=Object.assign({},current.messages||{});
            current.messages[live.id+'-approved']={id:live.id+'-approved',uid:user.uid,kind:'character-update-approved',name:character.name||current.name||'Герой',portrait:character.portrait||'',text:'Принимает улучшение навыка «'+String(live.patch&&live.patch.name||'Навык')+'».',ts:stamp};
            resolution='approved';appliedCharacter=character;return current;
          }).then(function(result){
            if(!result||!result.committed)throw roomError('Предложение уже обработано.','proposal-missing');
            return firebase.update(roomRef(session.code),{updatedAt:stamp}).catch(function(){return null;}).then(function(){
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){
                var snapshot=api.getSnapshot();snapshot.skillUpdateResolution=resolution;snapshot.skillUpdateCharacter=appliedCharacter;return snapshot;
              });
            });
          });
        });
      }).catch(function(error){
        if(error&&['player-only','room-not-found','character-missing','proposal-missing'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    acknowledgeSkillUpdateProposal: function (proposalId, localStatus) {
      proposalId=String(proposalId||'').slice(0,160);
      localStatus=localStatus==='conflict'?'conflict':'saved';
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='player')return api.getSnapshot();
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var proposal=room.members&&room.members[user.uid]&&room.members[user.uid].characterUpdateProposal;
          if(!proposal||proposal.id!==proposalId||proposal.status!=='approved')return api.getSnapshot();
          return firebase.update(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid+'/characterUpdateProposal'),{
            status:localStatus==='saved'?'saved':'conflict',
            localStatus:localStatus,
            localSavedAt:now()
          }).then(function(){
            return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(error&&error.code==='room-not-found')throw error;
        throw friendlyFirebaseError(error);
      });
    },

    adjustOwnAbilityUsage: function (operation) {
      operation=operation||{};
      var resourceKey=String(operation.resourceKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
      var delta=Number(operation.delta)<0?-1:1,name=String(operation.name||'способность').slice(0,120);
      var requestedMax=Math.max(0,Math.min(99,Math.floor(Number(operation.max)||0)));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='player')throw roomError('Изменять собственный кулдаун может только игрок.','player-only');
        if(!resourceKey||!requestedMax)throw roomError('У способности нет изменяемого ресурса.','ability-resource-invalid');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[user.uid];if(!member||member.role!=='player'||!member.character)throw roomError('Лист игрока недоступен.','character-missing');
          var operationId='player-ability-'+now()+'-'+Math.random().toString(36).slice(2,7),appliedUsed=0,appliedMax=requestedMax,atBoundary=false;
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+user.uid+'/character'),function(current){
            if(!current)return;
            var usageResult=applyAbilityUsageDomainOperation(current.abilityUsage,resourceKey,{delta:delta,max:requestedMax,updatedAt:now(),updatedBy:user.uid});
            atBoundary=!usageResult.changed;appliedMax=usageResult.max;appliedUsed=usageResult.used;
            if(atBoundary)return;
            current.abilityUsage=usageResult.usage;
            current.revision=Math.max(0,Number(current.revision)||0)+1;
            current.updatedAt=now();current.updatedBy=user.uid;current.source='player-ability-resource';current.syncOperationId=operationId;
            return current;
          }).then(function(result){
            if(!result||!result.committed){
              if(atBoundary)throw roomError(delta<0?'Все заряды уже доступны.':'Все заряды уже потрачены.','ability-resource-boundary');
              throw roomError('Лист игрока изменился или недоступен. Повторите попытку.','character-missing');
            }
            var stamp=now(),messageId=operationId,text=(delta<0?'Возвращает заряд':'Отправляет в кулдаун')+' «'+name+'»: '+Math.max(0,appliedMax-appliedUsed)+' из '+appliedMax+' доступно.';
            var updates={updatedAt:stamp};updates['members/'+user.uid+'/messages/'+messageId]={id:messageId,uid:user.uid,kind:'world',name:member.character.name||member.name||'Герой',portrait:member.character.portrait||'',text:text,ts:stamp};
            return firebase.update(roomRef(session.code),updates).catch(function(){return null;}).then(function(){
              appendSyncEvent(result.snapshot&&result.snapshot.val?result.snapshot.val():member.character,'local→room','player-ability-resource','ack');
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
            });
          });
        });
      }).catch(function(error){
        if(error&&['player-only','room-not-found','character-missing','ability-resource-invalid','ability-resource-boundary'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmAdjustAbilityUsage: function (memberUid, operation) {
      memberUid=String(memberUid||'').slice(0,128);operation=operation||{};
      var resourceKey=String(operation.resourceKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
      var delta=Number(operation.delta)<0?-1:1,name=String(operation.name||'способность').slice(0,120);
      var requestedMax=Math.max(0,Math.min(99,Math.floor(Number(operation.max)||0)));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Ресурс способности может изменить только мастер.','master-only');
        if(!memberUid)throw roomError('Сначала выберите героя.','member-required');
        if(!resourceKey||!requestedMax)throw roomError('У способности нет изменяемого ресурса.','ability-resource-invalid');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var member=room.members&&room.members[memberUid];if(!member||!member.character)throw roomError('Лист игрока недоступен.','character-missing');
          var operationId='gm-ability-'+now()+'-'+Math.random().toString(36).slice(2,7),appliedUsed=0,appliedMax=requestedMax,atBoundary=false;
          return firebase.runTransaction(firebase.ref(db,'rooms/'+session.code+'/members/'+memberUid+'/character'),function(current){
            if(!current)return;
            var usageResult=applyAbilityUsageDomainOperation(current.abilityUsage,resourceKey,{delta:delta,max:requestedMax,updatedAt:now(),updatedBy:user.uid});
            atBoundary=!usageResult.changed;appliedMax=usageResult.max;appliedUsed=usageResult.used;
            if(atBoundary)return;
            current.abilityUsage=usageResult.usage;
            current.revision=Math.max(0,Number(current.revision)||0)+1;
            current.updatedAt=now();current.updatedBy=user.uid;current.source='gm-ability-resource';current.syncOperationId=operationId;
            return current;
          }).then(function(result){
            if(!result||!result.committed){
              if(atBoundary)throw roomError(delta<0?'Все заряды уже доступны.':'Все заряды уже потрачены.','ability-resource-boundary');
              throw roomError('Лист игрока изменился или недоступен. Повторите попытку.','character-missing');
            }
            var stamp=now(),text='Мастер '+(delta<0?'возвращает':'расходует')+' заряд «'+name+'»: '+Math.max(0,appliedMax-appliedUsed)+' из '+appliedMax+' доступно.',updates={updatedAt:stamp};
            Object.keys(room.members||{}).forEach(function(uid){updates['members/'+uid+'/messages/'+operationId]={id:operationId,uid:user.uid,kind:'world',name:'Мир Зарготы',portrait:'',text:text,ts:stamp};});
            return firebase.update(roomRef(session.code),updates).catch(function(){return null;}).then(function(){
              appendSyncEvent(result.snapshot&&result.snapshot.val?result.snapshot.val():member.character,'master→room','gm-ability-resource','ack');
              return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
            });
          });
        });
      }).catch(function(error){
        if(error&&['master-only','member-required','room-not-found','character-missing','ability-resource-invalid','ability-resource-boundary'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmAdjustEntity: function (targetRef, operation) {
      targetRef=targetRef||{};operation=operation||{};
      var tokenId=String(targetRef.tokenId||'').slice(0,120),memberUid=String(targetRef.memberUid||'').slice(0,128),kind=String(operation.kind||'');
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Ручной пульт доступен только мастеру.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var sceneTokens=room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[],sceneIndex=sceneTokens.findIndex(function(token){return token&&String(token.id)===tokenId;}),sceneToken=sceneIndex>=0?sceneTokens[sceneIndex]:null;
          if(!memberUid&&sceneToken&&sceneToken.memberUid)memberUid=String(sceneToken.memberUid);
          var member=memberUid&&room.members&&room.members[memberUid],combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[],combatIndex=order.findIndex(function(entry){return entry&&((tokenId&&String(entry.tokenId)===tokenId)||(memberUid&&String(entry.uid)===memberUid));}),entry=combatIndex>=0?Object.assign({},order[combatIndex]):null;
          if(!sceneToken&&!member&&!entry)throw roomError('Сначала выберите жетон или героя на сцене.','entity-missing');
          var source=entry||(member&&member.character)||sceneToken||{},name=String(source.name||member&&member.character&&member.character.name||member&&member.name||'Цель').slice(0,80),hpMax=Math.max(0,Number(source.hpMax)||0),hp=Math.max(0,Number(source.hp==null?source.hpCur:source.hp)||0),tempHp=Math.max(0,Number(source.tempHp)||0),statuses=Array.isArray(source.statuses)?source.statuses.slice(0,23):[],statusEffects=Array.isArray(source.statusEffects)?source.statusEffects.slice(0,40):[];
          var injurySource=Array.isArray(source.injuries)?source.injuries:(member&&member.character&&Array.isArray(member.character.injuries)?member.character.injuries:[]),injuries=injurySource.slice(0,4),baseHpMax=Math.max(0,Number(source.baseHpMax||source.hpMax)||0);
          if(injuries.length&&baseHpMax)hpMax=Math.max(1,Math.floor(baseHpMax*(100-Math.min(30,injuries.length*10))/100));
          var beforeHp=hp,amount=Math.max(0,Math.min(9999,Math.floor(Number(operation.amount)||0))),text='',statusKey='',statusEnabled=null,statusLabel='',vitalsResult=null,statusResult=null,injuryResult=null,injuryAction='',injuryIndex=-1;
          if(kind==='damage'){
            if(!amount)throw roomError('Укажите урон больше нуля.','adjust-invalid');
            vitalsResult=applyVitalsDomainOperation({hp:hp,hpMax:hpMax,tempHp:tempHp},{damage:amount});hp=vitalsResult.hp;tempHp=vitalsResult.tempHp;text='Мастер наносит '+name+' '+amount+' урона'+(vitalsResult.absorbed?' ('+vitalsResult.absorbed+' поглощено временными HP)':'')+'.';
          }else if(kind==='heal'){
            if(!amount)throw roomError('Укажите лечение больше нуля.','adjust-invalid');
            vitalsResult=applyVitalsDomainOperation({hp:hp,hpMax:hpMax,tempHp:tempHp},{heal:amount});hp=vitalsResult.hp;tempHp=vitalsResult.tempHp;text='Мастер восстанавливает '+name+' '+amount+' HP.';
          }else if(kind==='temp-hp'){
            vitalsResult=applyVitalsDomainOperation({hp:hp,hpMax:hpMax,tempHp:tempHp},{setTempHp:amount});hp=vitalsResult.hp;tempHp=vitalsResult.tempHp;text='Мастер устанавливает '+name+' временные HP: '+tempHp+'.';
          }else if(kind==='status'){
            statusKey=String(operation.statusKey||'').toLowerCase();if(!/^[a-z0-9_-]{1,40}$/.test(statusKey))throw roomError('Выберите корректный эффект.','adjust-invalid');
            var active=statuses.some(function(status){return String(typeof status==='string'?status:status&&(status.statusKey||status.key||status.id)||'').toLowerCase()===statusKey;});
            var enable=operation.enable==null?!active:!!operation.enable;
            statusEnabled=enable;statusLabel=String(operation.label||statusKey).slice(0,60);
            var normalizedEffect=enable?normalizeStatusEffectInput(operation.effect,statusKey,statusLabel):null;
            statusResult=applyStatusDomainOperation({statuses:statuses,statusEffects:statusEffects},{statusKey:statusKey,enable:enable,effect:normalizedEffect});statuses=statusResult.statuses;statusEffects=statusResult.statusEffects;
            if(enable){text='Мастер назначает '+name+' эффект «'+statusLabel+'».';}else{text='Мастер снимает с '+name+' эффект «'+statusLabel+'».';}
          }else if(kind==='injury'){
            injuryAction=operation.action==='remove'?'remove':'add';
            if(injuryAction==='add'){
              if(injuries.length>=4)throw roomError('У сущности уже четыре тяжёлые травмы.','injury-limit');
              var rawInjury=operation.injury&&typeof operation.injury==='object'?operation.injury:{},roll=Math.max(1,Math.min(20,Math.floor(Number(rawInjury.roll)||0)));
              if(!roll)throw roomError('Выберите результат таблицы d20.','adjust-invalid');
              injuryResult={
                id:String(rawInjury.id||('inj-'+now())).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80),
                roll:roll,key:String(rawInjury.key||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60),
                icon:String(rawInjury.icon||'✦').slice(0,8),name:String(rawInjury.name||'Тяжёлая травма').slice(0,80),
                severity:String(rawInjury.severity||'Тяжёлая').slice(0,30),effect:String(rawInjury.effect||'').slice(0,360),
                treatment:String(rawInjury.treatment||'').slice(0,360),note:String(rawInjury.note||'').slice(0,240),
                createdAt:Math.max(0,Number(rawInjury.createdAt)||now()),source:'gm-d20'
              };
              injuries.push(injuryResult);text='Мастер назначает '+name+' тяжёлую травму «'+injuryResult.name+'» (d20: '+injuryResult.roll+').';
            }else{
              var removeId=String(operation.injuryId||''),requestedIndex=Math.floor(Number(operation.injuryIndex));
              injuryIndex=injuries.findIndex(function(injury){return removeId&&String(injury&&injury.id||'')===removeId;});
              if(injuryIndex<0&&requestedIndex>=0&&requestedIndex<injuries.length)injuryIndex=requestedIndex;
              if(injuryIndex<0)throw roomError('Травма больше не найдена.','injury-missing');
              injuryResult=injuries[injuryIndex];injuries.splice(injuryIndex,1);text='Мастер снимает с '+name+' травму «'+String(injuryResult&&injuryResult.name||'Травма').slice(0,80)+'».';
            }
            hpMax=baseHpMax?Math.max(1,Math.floor(baseHpMax*(100-Math.min(30,injuries.length*10))/100)):hpMax;
            hp=Math.min(hp,hpMax||hp);
          }else throw roomError('Неизвестное действие пульта.','adjust-invalid');
          var updates={},stamp=now();
          function writeToken(path){if(kind==='damage'||kind==='heal'||kind==='temp-hp'){updates[path+'/hp']=hp;updates[path+'/tempHp']=tempHp;}else if(kind==='injury'){updates[path+'/injuries']=injuries;updates[path+'/hp']=hp;if(baseHpMax)updates[path+'/baseHpMax']=baseHpMax;}else{updates[path+'/statuses']=statuses;updates[path+'/statusEffects']=statusEffects;}}
          if(sceneIndex>=0)writeToken('scene/tokens/'+sceneIndex);
          Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===tokenId)writeToken('zones/'+zoneId+'/tokens/'+index);});});
          if(entry){if(kind==='damage'||kind==='heal'||kind==='temp-hp'){entry.hp=hp;entry.tempHp=tempHp;if(kind==='damage'||kind==='heal')syncCombatZeroHp(entry,beforeHp,'gm-adjust',stamp);}else if(kind==='injury'){entry.injuries=injuries;entry.hp=hp;if(baseHpMax)entry.baseHpMax=baseHpMax;}else{entry.statuses=statuses;entry.statusEffects=statusEffects;}order[combatIndex]=entry;updates['combat/order']=order;updates['combat/updatedAt']=stamp;}
          var eventId='gm-adjust-'+stamp;
          if(member){
            if(kind==='damage'||kind==='heal'||kind==='temp-hp'){updates['members/'+memberUid+'/character/hpCur']=hp;updates['members/'+memberUid+'/character/tempHp']=tempHp;if(entry)updates['members/'+memberUid+'/character/deathSaves']=entry.zeroHp||null;}else if(kind==='injury'){updates['members/'+memberUid+'/character/injuries']=injuries;updates['members/'+memberUid+'/character/hpCur']=hp;if(baseHpMax)updates['members/'+memberUid+'/character/baseHpMax']=baseHpMax;}else{updates['members/'+memberUid+'/character/statuses']=statuses;updates['members/'+memberUid+'/character/statusEffects']=statusEffects;}
            updates['members/'+memberUid+'/character/revision']=firebase.increment(1);
            updates['members/'+memberUid+'/character/updatedAt']=stamp;updates['members/'+memberUid+'/character/updatedBy']=user.uid;
            updates['members/'+memberUid+'/character/source']='gm-adjust-'+kind;updates['members/'+memberUid+'/character/syncOperationId']=eventId;
          }
          var event={id:eventId,kind:kind==='heal'?'gm-heal':kind==='damage'?'gm-damage':kind==='temp-hp'?'gm-temp-hp':kind==='injury'?'gm-injury':'gm-status',name:'Мир Зарготы',text:text,targetKey:entry&&entry.key||'',targetTokenId:tokenId,targetUid:memberUid,amount:amount,hp:hp,tempHp:tempHp,statuses:statuses,statusKey:statusKey,statusLabel:statusLabel,statusEnabled:statusEnabled,statusEffect:kind==='status'&&statusEnabled?statusEffects.filter(function(effect){return effect&&effect.statusKey===statusKey;})[0]||null:null,injuries:kind==='injury'?injuries:null,injury:kind==='injury'?injuryResult:null,injuryAction:injuryAction,ts:stamp};
          updates.manualEvent=event;
          if(combat&&combat.active)updates.combatEvent=event;else Object.keys(room.members||{}).forEach(function(uid){updates['members/'+uid+'/messages/'+event.id]={id:event.id,uid:user.uid,kind:'world',name:'Мир Зарготы',portrait:'',text:text,ts:stamp};});
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','entity-missing','adjust-invalid','injury-limit','injury-missing'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    gmAdvanceWorldTime: function (operation) {
      operation=operation&&typeof operation==='object'?operation:{};
      var deltaMinutes=Math.floor(Number(operation.deltaMinutes)||0);
      var operationId=String(operation.operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
      if(!operationId)return Promise.reject(roomError('Не удалось определить операцию времени.','world-time-operation-invalid'));
      if(deltaMinutes<1||deltaMinutes>525600)return Promise.reject(roomError('Можно продвинуть время от 1 минуты до 365 дней.','world-time-delta-invalid'));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Временем комнаты управляет только мастер.','master-only');
        var duplicate=false,summary=null,authorityMismatch=false,roomTarget=roomRef(session.code);
        appendOperationEvent('world-time',operationId,'started',{kind:'advance',name:String(deltaMinutes)});
        return firebase.runTransaction(roomTarget,function(room){
          if(!room)return;
          if(room.masterUid!==user.uid){authorityMismatch=true;return;}
          var result=advanceRoomWorldTimeState(room,deltaMinutes,operationId,user.uid,now());
          duplicate=result.duplicate;summary=result;
          return result.room;
        }).then(function(result){
          if(!result||!result.committed){
            if(authorityMismatch)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
            throw roomError('Комната изменилась или больше недоступна. Повторите попытку.','room-not-found');
          }
          appendOperationEvent('world-time',operationId,duplicate?'duplicate':'ack',{
            kind:'advance',name:String(deltaMinutes),result:duplicate?'already-applied':String(summary&&summary.afterMinutes||0)
          });
          return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){
        appendOperationEvent('world-time',operationId,'failed',{kind:'advance',name:String(deltaMinutes)},error);
        if(error&&['world-time-operation-invalid','world-time-delta-invalid','master-only','room-not-found'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmSetWorldClock: function (operation) {
      operation=operation&&typeof operation==='object'?operation:{};
      var targetTotalMinutes=Math.floor(Number(operation.targetTotalMinutes));
      var displayMode=operation.displayMode==='phase'?'phase':'exact';
      var operationId=String(operation.operationId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
      if(!operationId)return Promise.reject(roomError('Не удалось определить операцию календаря.','world-clock-operation-invalid'));
      if(!Number.isFinite(targetTotalMinutes)||targetTotalMinutes<0||targetTotalMinutes>525600000)return Promise.reject(roomError('Дата выходит за пределы календаря.','world-clock-target-invalid'));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Календарём комнаты управляет только мастер.','master-only');
        var duplicate=false,summary=null,authorityMismatch=false,roomTarget=roomRef(session.code);
        appendOperationEvent('world-clock-set',operationId,'started',{kind:'set',name:String(targetTotalMinutes)});
        return firebase.runTransaction(roomTarget,function(room){
          if(!room)return;
          if(room.masterUid!==user.uid){authorityMismatch=true;return;}
          var result=setRoomWorldClockState(room,targetTotalMinutes,displayMode,operationId,user.uid,now());
          duplicate=result.duplicate;summary=result;return result.room;
        }).then(function(result){
          if(!result||!result.committed){
            if(authorityMismatch)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
            throw roomError('Комната изменилась или больше недоступна. Повторите попытку.','room-not-found');
          }
          appendOperationEvent('world-clock-set',operationId,duplicate?'duplicate':'ack',{kind:'set',name:displayMode,result:String(summary&&summary.afterMinutes||0)});
          return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){
        appendOperationEvent('world-clock-set',operationId,'failed',{kind:'set',name:displayMode},error);
        if(error&&['world-clock-operation-invalid','world-clock-target-invalid','master-only','room-not-found'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmPulseWorldClock: function (durationMs) {
      durationMs=Math.max(3000,Math.min(30000,Math.floor(Number(durationMs)||10000)));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Показывать время игрокам может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var stamp=now(),pulse={
            id:'world-clock-pulse-'+stamp+'-'+Math.random().toString(36).slice(2,7),
            ts:stamp,
            expiresAt:stamp+durationMs,
            createdBy:user.uid
          };
          return firebase.update(roomRef(session.code),{worldClockPulse:pulse,updatedAt:stamp}).then(function(){
            return refreshRoom(session.code).catch(function(){return currentRoom;}).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(error&&['master-only','room-not-found'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    gmBroadcastVisual: function (targetRef, visual) {
      targetRef=targetRef||{};visual=visual||{};
      var tokenId=String(targetRef.tokenId||'').slice(0,120),memberUid=String(targetRef.memberUid||'').slice(0,128);
      var type=['particle','animation','scene'].indexOf(visual.type)>=0?visual.type:'particle';
      var intensity=['soft','normal','strong'].indexOf(visual.intensity)>=0?visual.intensity:'normal';
      var allowed={
        particle:['embers','frost','healing','shadow','poison','blood','arcane','lightning'],
        animation:['shake','pulse','levitate','blink','impact','dissolve'],
        scene:['flash','darkness','tremor','focus','storm','holy']
      };
      var effect=String(visual.effect||'').toLowerCase();
      if(allowed[type].indexOf(effect)<0)return Promise.reject(roomError('Выберите доступный визуальный эффект.','visual-invalid'));
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Визуальные эффекты запускает только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          if(type!=='scene'){
            var sceneToken=(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).some(function(token){return token&&String(token.id)===tokenId;});
            var member=memberUid&&room.members&&room.members[memberUid];
            var combatEntry=(room.combat&&Array.isArray(room.combat.order)?room.combat.order:[]).some(function(entry){return entry&&((tokenId&&String(entry.tokenId)===tokenId)||(memberUid&&String(entry.uid)===memberUid));});
            if(!sceneToken&&!member&&!combatEntry)throw roomError('Для этого эффекта выберите жетон на сцене.','entity-missing');
          }
          var stamp=now(),event={
            id:'gm-visual-'+stamp+'-'+Math.random().toString(36).slice(2,7),
            kind:'gm-visual',type:type,effect:effect,intensity:intensity,
            targetTokenId:tokenId,targetUid:memberUid,createdBy:user.uid,ts:stamp
          };
          return firebase.update(roomRef(session.code),{visualEvent:event,updatedAt:stamp}).then(function(){
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(error&&['visual-invalid','master-only','room-not-found','entity-missing'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCombatAttack: function (targetKey, options, participantKey) {
      options = options || {}; targetKey = String(targetKey || '').slice(0, 160); participantKey = String(participantKey || '').slice(0, 160);
      return ensureReady().then(function (user) {
        var session = readSession(); if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        if(session.role!=='master')throw roomError('Результат атаки применяет гейм-мастер.','master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0)),attackerIndex=participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):turnIndex;
          if(attackerIndex<0||attackerIndex!==turnIndex)throw roomError('Атаковать можно только в свой ход.','combat-not-turn');
          var targetIndex=order.findIndex(function(entry){return entry&&entry.key===targetKey;});
          if(targetIndex<0||targetIndex===attackerIndex)throw roomError('Выберите другую цель.','combat-target-invalid');
          var attacker=combatEntryWithRoomStatuses(room,Object.assign({},order[attackerIndex])),target=combatEntryWithRoomStatuses(room,Object.assign({},order[targetIndex]));
          if(Number(attacker.hp==null?attacker.hpMax:attacker.hp)<=0)throw roomError('Участник с 0 HP ожидает решения мастера и не может атаковать.','combat-zero-hp');
          var restrictions=combatRestrictions(attacker),economy=Object.assign({long:1,short:1,reaction:1},attacker.economy||{});
          if(restrictions.blocked.long)throw roomError(restrictions.reasons[0]||'Текущее состояние запрещает атаку.','combat-status-blocked');
          if(Number(economy.long||0)<1)throw roomError('Долгое действие уже израсходовано.','combat-action-spent');
          var profiles=Array.isArray(attacker.weaponProfiles)?attacker.weaponProfiles:[],weaponId=String(options.weaponId||''),weapon=profiles.filter(function(item){return item&&String(item.id)===weaponId;})[0]||profiles[0]||{id:'improvised',name:'Импровизированная атака',damageFormula:'1d4',damageType:'Дробящий'};
          var distance=combatEntryDistance(room,attacker,target),rangeCells=combatRangeCells(weapon.range||'1 клетка');
          if(distance!=null&&distance>rangeCells)throw roomError('Цель слишком далеко: '+distance+' кл., дальность оружия '+rangeCells+' кл.','combat-target-range');
          var statKey=['str','dex','int','cha','per','con'].indexOf(options.statKey)>=0?options.statKey:(weapon.stat||'str');
          var statBonus=combatStat(attacker,statKey),masteryBonus=Math.max(0,Math.min(3,Number(options.masteryBonus)||0));
          var keys=combatStatusKeys(attacker),attackerModifiers=combatStatusModifiers(attacker),targetModifiers=combatStatusModifiers(target);
          var forcedDisadvantage=['stun','blind','fear'].some(function(key){return keys.indexOf(key)>=0;})||attackerModifiers.hasDisadvantage||attackerModifiers.attackDisadvantage||combatStatusLevel(attacker,'exhausted')>=3;
          var mode=combatRollMode(String(options.mode||'normal'),targetModifiers.grantAdvantageToAttackers,forcedDisadvantage);
          var first=rollDie(20),second=mode==='normal'?null:rollDie(20),natural=second==null?first:(mode==='advantage'?Math.max(first,second):Math.min(first,second));
          var attackTotal=natural+statBonus+masteryBonus+attackerModifiers.attackMod,targetAc=Math.max(0,(Number(target.ac)||10)+targetModifiers.acMod),critical=natural===20,failed=natural===1,hit=!failed&&(critical||attackTotal>=targetAc);
          economy.long=0;if(restrictions.slowed)economy.short=0;attacker.economy=economy;order[attackerIndex]=attacker;
          var stamp=now(),updates={},statLabels={str:'Сила',dex:'Ловкость',int:'Интеллект',cha:'Харизма',per:'Восприятие',con:'Выносливость'};
          var creatureRoll=!attacker.uid,revealResult=!creatureRoll||!(room.scene&&room.scene.view&&room.scene.view.showCreatureRollTotals===false);
          updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          var rollText=second==null?String(natural):(first+' / '+second+' → '+natural),resultText=failed?'автопромах':(critical?'КРИТ':(hit?'попадание':'промах'));
          updates.combatEvent={id:'combat-attack-'+stamp,kind:critical?'combat-critical':'combat-attack',name:attacker.name||'Участник',portrait:attacker.portrait||'',text:'Атакует «'+(weapon.name||'оружием')+'» цель '+(target.name||'цель')+'. d20 '+rollText+' + '+statLabels[statKey]+' '+statBonus+(masteryBonus?' + мастерство '+masteryBonus:'')+(attackerModifiers.attackMod?' + состояния '+attackerModifiers.attackMod:'')+' = '+attackTotal+' против AC '+targetAc+' — '+resultText+(hit?'. Ожидание урона.':''),hiddenText:'Существо атакует цель '+(target.name||'цель')+'. Результат броска скрыт мастером.',creatureRoll:creatureRoll,revealResult:revealResult,attackRoll:natural,attackRolls:second==null?[first]:[first,second],rollMode:mode,attackTotal:attackTotal,statusAttackMod:attackerModifiers.attackMod,targetAc:targetAc,targetStatusAcMod:targetModifiers.acMod,hit:hit,critical:critical,damageFormula:String(weapon.damageFormula||'1d4'),damageStatBonus:statBonus,damageStatusBonus:attackerModifiers.damageMod,damageType:String(weapon.damageType||''),distanceCells:distance,rangeCells:rangeCells,targetKey:target.key,weapon:weapon.name||'Оружие',ts:stamp,revealAt:stamp+3200};
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','master-only','room-not-found','combat-missing','combat-not-turn','combat-target-invalid','combat-target-range','combat-zero-hp','combat-status-blocked','combat-action-spent'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCombatDamage: function (targetKey, options, participantKey) {
      options=options||{};targetKey=String(targetKey||'').slice(0,160);participantKey=String(participantKey||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session)throw roomError('Сначала войдите в комнату.','room-required');
        if(session.role!=='master')throw roomError('Урон применяет гейм-мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          if(room.masterUid!==user.uid)throw roomError('Эта комната принадлежит другому мастеру.','master-only');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var attackerIndex=participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):-1;
          if(attackerIndex<0)throw roomError('Участник не найден.','combat-participant-missing');
          var targetIndex=order.findIndex(function(entry){return entry&&entry.key===targetKey;});
          if(targetIndex<0||targetIndex===attackerIndex)throw roomError('Выберите другую цель.','combat-target-invalid');
          var attacker=combatEntryWithRoomStatuses(room,Object.assign({},order[attackerIndex])),target=combatEntryWithRoomStatuses(room,Object.assign({},order[targetIndex]));
          var profiles=Array.isArray(attacker.weaponProfiles)?attacker.weaponProfiles:[],weaponId=String(options.weaponId||''),weapon=profiles.filter(function(item){return item&&String(item.id)===weaponId;})[0]||profiles[0]||{id:'improvised',name:'Импровизированная атака',damageFormula:'1d4',damageType:'Дробящий'};
          var statKey=['str','dex','int','cha','per','con'].indexOf(options.statKey)>=0?options.statKey:(weapon.stat||'str');
          var statBonus=combatStat(attacker,statKey);
          var attackerModifiers=combatStatusModifiers(attacker);
          var critical=!!options.critical;
          var damageResult=rollFormula(weapon.damageFormula||'1d4',critical);
          var bonusDieSides=[4,6,8,10,12,20].indexOf(Number(options.bonusDieSides))>=0?Number(options.bonusDieSides):0;
          var bonusDiceCount=bonusDieSides?Math.max(0,Math.min(5,Math.floor(Number(options.bonusDiceCount)||0))):0;
          var bonusRolls=[],bonusRollCount=bonusDiceCount*(critical?2:1);
          for(var bonusIndex=0;bonusIndex<bonusRollCount;bonusIndex++)bonusRolls.push(Math.floor(Math.random()*bonusDieSides)+1);
          var bonusDamage=bonusRolls.reduce(function(sum,value){return sum+value;},0);
          var rawDamage=Math.max(0,damageResult.total+bonusDamage+statBonus+attackerModifiers.damageMod),damage=rawDamage,damageType=String(weapon.damageType||''),resisted=combatHasDamageTrait(target.resistances,damageType),vulnerable=combatHasDamageTrait(target.vulnerabilities,damageType),immune=combatHasDamageTrait(target.immunities,damageType);
          if(immune)damage=0;else if(resisted&&!vulnerable)damage=Math.floor(damage/2);else if(vulnerable&&!resisted)damage*=2;
          var vitalsResult=applyVitalsDomainOperation(target,{damage:damage}),before=vitalsResult.beforeHp,absorbed=vitalsResult.absorbed,hpDamage=vitalsResult.hpDamage,after=vitalsResult.hp,tempAfter=vitalsResult.tempHp,reachedZero=vitalsResult.reachedZero;
          var stamp=now(),creatureRoll=!attacker.uid,revealResult=!creatureRoll||!(room.scene&&room.scene.view&&room.scene.view.showCreatureRollTotals===false);
          target.hp=after;target.tempHp=tempAfter;syncCombatZeroHp(target,before,attacker.key,stamp);order[targetIndex]=target;
          var updates={};
          updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          if(target.uid){
            var damageOperationId='combat-damage-'+stamp;
            updates['members/'+target.uid+'/character/hpCur']=after;
            updates['members/'+target.uid+'/character/tempHp']=tempAfter;
            updates['members/'+target.uid+'/character/deathSaves']=target.zeroHp||null;
            updates['members/'+target.uid+'/character/revision']=firebase.increment(1);
            updates['members/'+target.uid+'/character/updatedAt']=stamp;
            updates['members/'+target.uid+'/character/updatedBy']=user.uid;
            updates['members/'+target.uid+'/character/source']='combat-damage';
            updates['members/'+target.uid+'/character/syncOperationId']=damageOperationId;
          }
          if(target.tokenId){
            (room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+index+'/hp']=after;updates['scene/tokens/'+index+'/tempHp']=tempAfter;}});
            Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+index+'/hp']=after;updates['zones/'+zoneId+'/tokens/'+index+'/tempHp']=tempAfter;}});});
          }
          var damageNote=immune?' · иммунитет':(resisted&&!vulnerable?' · сопротивление':(vulnerable&&!resisted?' · уязвимость':(resisted&&vulnerable?' · сопротивление и уязвимость нейтрализованы':'')));
          updates.combatEvent={id:'combat-damage-'+stamp,kind:'combat-damage',name:attacker.name||'Участник',portrait:attacker.portrait||'',text:'Наносит урон оружием «'+(weapon.name||'оружие')+'» цели '+(target.name||'цель')+'. Урон '+damage+' ('+damageResult.formula+(critical?' ×2 кубы':'')+(bonusDiceCount?' + '+bonusDiceCount+'d'+bonusDieSides+(critical?' ×2':''):'')+(attackerModifiers.damageMod?' · состояния '+attackerModifiers.damageMod:'')+damageNote+').'+(absorbed?' Временные HP поглощают '+absorbed+(hpDamage?' — в здоровье проходит '+hpDamage+'.':'.'):'')+(reachedZero?' Цель достигает 0 HP — на её ходу потребуется ручной бросок борьбы за жизнь.':''),hiddenText:'Существо наносит урон цели '+(target.name||'цель')+'. Значение броска скрыто мастером.',creatureRoll:creatureRoll,revealResult:revealResult,damage:damage,damageRolls:(damageResult.rolls||[]).concat(bonusRolls),baseDamageRollCount:(damageResult.rolls||[]).length,bonusDieSides:bonusDieSides,bonusDiceCount:bonusDiceCount,damageFormula:damageResult.formula||String(weapon.damageFormula||'1d4'),damageStatBonus:statBonus,damageStatusBonus:attackerModifiers.damageMod,hpDamage:hpDamage,tempHpAbsorbed:absorbed,tempHpRemaining:tempAfter,rawDamage:rawDamage,damageType:damageType,targetKey:target.key,weapon:weapon.name||'Оружие',zeroHp:reachedZero,ts:stamp,revealAt:stamp+3200};
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','master-only','room-not-found','combat-missing','combat-participant-missing','combat-target-invalid'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    finishApprovedDamageRoll: function (requestUid, requestId, accepted, eventId, errorText) {
      requestUid=String(requestUid||'').slice(0,128);requestId=String(requestId||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Завершить бросок может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var request=room.members&&room.members[requestUid]&&room.members[requestUid].actionRequest;
          if(!request||request.id!==requestId)return api.getSnapshot();
          var update={status:accepted?'resolved':'damage-requested',resolvedAt:accepted?now():null,resultEventId:accepted?String(eventId||''):null,rollError:accepted?null:String(errorText||'Не удалось нанести урон').slice(0,180)};
          return firebase.update(firebase.ref(db,'rooms/'+session.code+'/members/'+requestUid+'/actionRequest'),update).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    resolveCombatSavingThrow: function (targetKey, options) {
      targetKey = String(targetKey || '').slice(0, 160);
      options = options || {};
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Спасбросок назначает гейм-мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var combat = room.combat, order = combat && Array.isArray(combat.order) ? combat.order.slice() : [];
          if (!combat || !combat.active || !order.length) throw roomError('Сейчас нет активного боя.', 'combat-missing');
          var targetIndex = order.findIndex(function (entry) { return entry && entry.key === targetKey; });
          if (targetIndex < 0) throw roomError('Участник боя не найден.', 'combat-participant-missing');
          var target = combatEntryWithRoomStatuses(room, Object.assign({}, order[targetIndex]));
          var statKey = ['str','dex','int','cha','per','con'].indexOf(options.statKey) >= 0 ? options.statKey : 'con';
          var statLabels = {str:'Сила',dex:'Ловкость',int:'Интеллект',cha:'Харизма',per:'Восприятие',con:'Выносливость'};
          var dc = Math.max(1, Math.min(40, Number(options.dc) || 10));
          var bonus = Math.max(-10, Math.min(10, Number(options.bonus) || 0));
          var modifier = combatStat(target, statKey) + bonus;
          var mode = ['advantage','disadvantage'].indexOf(options.mode) >= 0 ? options.mode : 'normal';
          var statusModifiers = combatStatusModifiers(target);
          var keys = combatStatusKeys(target);
          var exhaustionLevel = combatStatusLevel(target,'exhausted');
          mode = combatRollMode(mode, false, statusModifiers.hasDisadvantage || statusModifiers.saveDisadvantage || (statKey === 'dex' && (statusModifiers.dexSaveDisadvantage || keys.indexOf('restrain') >= 0)) || exhaustionLevel >= 3);
          var first = rollDie(20), second = mode === 'normal' ? null : rollDie(20);
          var natural = second == null ? first : (mode === 'advantage' ? Math.max(first, second) : Math.min(first, second));
          var total = natural + modifier;
          var success = natural === 20 || (natural !== 1 && total >= dc);
          var removeKey = String(options.removeStatus || '').slice(0, 80);
          if (success && removeKey) {
            target.statuses = (target.statuses || []).filter(function (status) { return String(typeof status === 'string' ? status : status && (status.key || status.statusKey || status.id) || '') !== removeKey; });
            target.statusEffects = (target.statusEffects || []).filter(function (effect) { return String(effect && (effect.statusKey || effect.key || effect.id) || '') !== removeKey; });
          }
          order[targetIndex] = target;
          var stamp = now(), updates = {};
          updates['combat/order'] = order;
          updates['combat/updatedAt'] = stamp;
          if (success && removeKey) queueCombatEntryState(room, updates, target, false);
          var rolls = second == null ? [first] : [first, second];
          var rollText = second == null ? String(natural) : first+' / '+second+' → '+natural;
          updates.combatEvent = {
            id:'combat-save-'+stamp, kind:success?'combat-save-success':'combat-save-fail',
            name:target.name || 'Участник', portrait:target.portrait || '',
            text:'Спасбросок: '+statLabels[statKey]+'. d20 '+rollText+(modifier?' '+(modifier>0?'+ ':'- ')+Math.abs(modifier):'')+' = '+total+' против DC '+dc+' — '+(success?'успех':'провал')+(success&&removeKey?'. Состояние снято.':'.'),
            saveRoll:natural, saveRolls:rolls, rollMode:mode, statKey:statKey,
            modifier:modifier, total:total, dc:dc, success:success,
            targetKey:target.key, removedStatus:success?removeKey:'', ts:stamp, revealAt:stamp+3200
          };
          updates.updatedAt = stamp;
          return firebase.update(roomRef(session.code), updates).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','combat-missing','combat-participant-missing'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCombatAbility: function (requestUid, targetKeys, overrides) {
      requestUid=String(requestUid||'').slice(0,128);targetKeys=(Array.isArray(targetKeys)?targetKeys:[targetKeys]).map(function(key){return String(key||'').slice(0,160);}).filter(Boolean).filter(function(key,index,list){return list.indexOf(key)===index;}).slice(0,30);overrides=overrides&&typeof overrides==='object'?overrides:{};
      var castDiagnostic=null;
      var castWriteCommitted=false;
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Разыгрывать способности может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[requestUid],request=member&&member.actionRequest,ability=request&&request.ability;
          if(!request||request.status!=='pending'||!ability)throw roomError('Заявка способности уже обработана.','request-missing');
          castDiagnostic={id:String(request.id||''),kind:String(ability.kind||'ability'),name:String(ability.name||''),targetUid:requestUid,targetCount:targetKeys.length,targetKeys:targetKeys.slice()};
          appendOperationEvent('ability-cast',castDiagnostic.id,'resolving',castDiagnostic);
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Разыграть способность можно только в активном бою.','combat-missing');
          var actorIndex=order.findIndex(function(entry){return entry&&entry.uid===requestUid;}),targetIndexes=targetKeys.map(function(key){return order.findIndex(function(entry){return entry&&entry.key===key;});});
          if(actorIndex<0)throw roomError('Участник способности не найден.','combat-participant-missing');
          var actor=combatEntryWithRoomStatuses(room,Object.assign({},order[actorIndex]));
          if(Number(actor.hp==null?actor.hpMax:actor.hp)<=0)throw roomError('Участник с 0 HP не может применять способности и заклинания.','combat-zero-hp');
          function safeFormula(value){value=String(value||'').trim().slice(0,18);return /^\d{1,2}d(?:4|6|8|10|12|20|100)(?:\s*[+-]\s*\d{1,3})?$/.test(value)?value.replace(/\s+/g,''):'';}
          function safeStat(value,fallback){value=String(value||'').toLowerCase();return ['str','dex','int','cha','per','con'].indexOf(value)>=0?value:fallback;}
          var effect=Object.assign({},ability),allowedModes=['utility','attack','save'],baseStatuses=Array.isArray(effect.statuses)?effect.statuses:String(effect.statuses||'').split(',');effect.resolutionMode=allowedModes.indexOf(overrides.resolutionMode)>=0?overrides.resolutionMode:(allowedModes.indexOf(effect.resolutionMode)>=0?effect.resolutionMode:'utility');effect.attackStat=safeStat(overrides.attackStat,effect.attackStat||'int');effect.saveStat=safeStat(overrides.saveStat,effect.saveStat||'con');effect.saveDC=overrides.saveDC===''||overrides.saveDC==null?effect.saveDC:Math.max(1,Math.min(99,Number(overrides.saveDC)||10));effect.damageFormula=safeFormula(overrides.damageFormula==null?effect.damageFormula:overrides.damageFormula);effect.healFormula=safeFormula(overrides.healFormula==null?effect.healFormula:overrides.healFormula);effect.damageType=String(overrides.damageType==null?effect.damageType:overrides.damageType).trim().slice(0,32);effect.halfOnSave=overrides.halfOnSave==null?!!effect.halfOnSave:!!overrides.halfOnSave;effect.durationRounds=Math.max(0,Math.min(99,Number(overrides.durationRounds==null?effect.durationRounds:overrides.durationRounds)||0));effect.concentration=overrides.concentration==null?!!effect.concentration:!!overrides.concentration;effect.statuses=Array.isArray(overrides.statuses)?overrides.statuses:String(overrides.statuses==null?baseStatuses.join(','):overrides.statuses).split(',');effect.statuses=effect.statuses.map(function(key){return String(key||'').trim().slice(0,48);}).filter(Boolean).slice(0,12);effect.areaMode=['circle','line','cone'].indexOf(overrides.areaMode)>=0?overrides.areaMode:'manual';effect.areaRadius=Math.max(1,Math.min(30,Number(overrides.areaRadius)||Number(effect.aoeRadius)||1));effect.areaWidth=Math.max(1,Math.min(12,Number(overrides.areaWidth)||1));effect.areaAnchorKey=String(overrides.areaAnchorKey||'').slice(0,160);
          var rawAreaPoint=overrides.areaAnchorPoint&&typeof overrides.areaAnchorPoint==='object'?overrides.areaAnchorPoint:null;
          effect.areaAnchorPoint=rawAreaPoint&&rawAreaPoint.x!=null&&rawAreaPoint.y!=null?{x:Math.max(0,Math.min(100,Number(rawAreaPoint.x)||0)),y:Math.max(0,Math.min(100,Number(rawAreaPoint.y)||0))}:null;
          var areaAnchorIndex=-1,areaAnchorEntry=null;
          if(effect.areaMode!=='manual'){
            areaAnchorIndex=order.findIndex(function(entry){return entry&&entry.key===effect.areaAnchorKey;});
            areaAnchorEntry=effect.areaAnchorPoint?{scenePoint:effect.areaAnchorPoint}:(areaAnchorIndex>=0?order[areaAnchorIndex]:null);
            if(!areaAnchorEntry||!combatEntryPoint(room,areaAnchorEntry))throw roomError('Центр или направление области не найдено на карте.','combat-area-anchor');
            targetIndexes=order.map(function(entry,index){if(effect.areaMode!=='circle'&&index===actorIndex)return-1;return combatAreaContains(room,effect.areaMode,order[actorIndex],areaAnchorEntry,entry,effect.areaRadius,effect.areaWidth)?index:-1;}).filter(function(index){return index>=0;});
            targetKeys=targetIndexes.map(function(index){return order[index].key;});
          }
          if(!targetIndexes.length||targetIndexes.some(function(index){return index<0;}))throw roomError('Цели способности не найдены.','combat-participant-missing');
          var resourceKey=String(effect.resourceKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100),resourceMax=Math.max(0,Math.min(99,Number(effect.resourceMax)||0)),resourceMutation=resourceKey&&resourceMax?applyAbilityUsageDomainOperation(member.character&&member.character.abilityUsage,resourceKey,{delta:1,max:resourceMax,minimumUsed:effect.resourceUsed,preserveExistingMax:false}):null;if(resourceMax&&(resourceKey?!resourceMutation||!resourceMutation.changed:Math.max(0,Number(effect.resourceUsed)||0)>=resourceMax))throw roomError('Заряды этой способности закончились.','ability-exhausted');
          var cost=['long','short','reaction','free'].indexOf(effect.actionCost)>=0?effect.actionCost:'long',turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0));
          if((cost==='long'||cost==='short')&&actorIndex!==turnIndex)throw roomError('Долгие и короткие способности применяются только в свой ход.','combat-not-turn');
          var economy=Object.assign({long:1,short:1,reaction:1},actor.economy||{}),restrictions=combatRestrictions(actor);
          var isSpellAbility=/^spell-/.test(String(effect.key||''))||/^spell-/.test(String(effect.sourceId||''));
          if(isSpellAbility&&combatStatusKeys(actor).indexOf('silence')>=0)throw roomError('Магическая немота запрещает применять заклинания.','combat-status-blocked');
          if(isSpellAbility&&combatStatusLevel(actor,'exhausted')>=4)throw roomError('Истощение IV запрещает применять заклинания.','combat-status-blocked');
          if(cost!=='free'&&restrictions.blocked[cost])throw roomError(restrictions.reasons[0]||'Текущее состояние запрещает способность.','combat-status-blocked');
          if(cost!=='free'&&Number(economy[cost]||0)<1)throw roomError('Нужное действие уже израсходовано.','combat-action-spent');
          var castStamp=now(),effectSource='ability-'+requestUid+'-'+castStamp,concentrationTouched=[];
          if(effect.concentration&&actor.concentration&&actor.concentration.sourceId){var previousSource=String(actor.concentration.sourceId);order=order.map(function(entry,index){entry=Object.assign({},entry);var beforeEffects=Array.isArray(entry.statusEffects)?entry.statusEffects:[],removed=beforeEffects.filter(function(item){return item&&String(item.sourceId||'')===previousSource;});if(!removed.length)return entry;entry.statusEffects=beforeEffects.filter(function(item){return !item||String(item.sourceId||'')!==previousSource;});var activeKeys=entry.statusEffects.map(function(item){return item&&(item.statusKey||item.key)||'';});entry.statuses=combatStatusKeys(entry).filter(function(key){return !removed.some(function(item){return (item.statusKey||item.key)===key;})||activeKeys.indexOf(key)>=0;});concentrationTouched.push(index);return entry;});actor=Object.assign({},order[actorIndex]);}
          var range=Math.max(0,Number(effect.rangeCells)||0),rangeEntries=effect.areaMode==='circle'?[areaAnchorEntry]:(effect.areaMode==='manual'?targetIndexes.map(function(index){return order[index];}):[]);if((effect.areaMode==='line'||effect.areaMode==='cone')&&range&&effect.areaRadius>range)throw roomError('Длина области '+effect.areaRadius+' кл. превышает дальность способности '+range+' кл.','combat-target-range');rangeEntries.forEach(function(targetEntry){var distance=combatEntryDistance(room,actor,targetEntry);if(range&&distance!=null&&distance>range)throw roomError((effect.areaMode!=='manual'?'Точка области':(targetEntry.name||'Цель'))+' слишком далеко: '+distance+' кл., дальность способности '+range+' кл.','combat-target-range');});
          var mode=effect.resolutionMode,results=[],damageType=String(effect.damageType||''),actorModifiers=combatStatusModifiers(actor);
          targetIndexes.forEach(function(targetIndex){
            var target=concentrationTouched.indexOf(targetIndex)>=0?Object.assign({},order[targetIndex]):combatEntryWithRoomStatuses(room,Object.assign({},order[targetIndex])),natural=null,rolls=[],modifier=0,total=null,success=true,dc=null,rollMode='normal',targetModifiers=combatStatusModifiers(target);
            if(mode==='attack'){
              modifier=combatStat(actor,effect.attackStat)+actorModifiers.attackMod;
              rollMode=combatRollMode('normal',targetModifiers.grantAdvantageToAttackers,actorModifiers.hasDisadvantage||actorModifiers.attackDisadvantage||combatStatusLevel(actor,'exhausted')>=3);
              var attackFirst=rollDie(20),attackSecond=rollMode==='normal'?null:rollDie(20);
              natural=attackSecond==null?attackFirst:(rollMode==='advantage'?Math.max(attackFirst,attackSecond):Math.min(attackFirst,attackSecond));rolls=attackSecond==null?[attackFirst]:[attackFirst,attackSecond];
              total=natural+modifier;dc=Math.max(0,(Number(target.ac)||10)+targetModifiers.acMod);success=natural===20||(natural!==1&&total>=dc);
            }
            if(mode==='save'){
              modifier=combatStat(target,effect.saveStat);
              rollMode=combatRollMode('normal',false,targetModifiers.hasDisadvantage||targetModifiers.saveDisadvantage||(effect.saveStat==='dex'&&targetModifiers.dexSaveDisadvantage));
              var saveFirst=rollDie(20),saveSecond=rollMode==='normal'?null:rollDie(20);
              natural=saveSecond==null?saveFirst:(rollMode==='advantage'?Math.max(saveFirst,saveSecond):Math.min(saveFirst,saveSecond));rolls=saveSecond==null?[saveFirst]:[saveFirst,saveSecond];
              dc=effect.saveDC==null?10+combatStat(actor,effect.attackStat):Math.max(1,Number(effect.saveDC)||10);total=natural+modifier;success=natural===20||(natural!==1&&total>=dc);
            }
            var damageRoll=effect.damageFormula?rollFormula(effect.damageFormula,natural===20&&mode==='attack'):{total:0,formula:''},healRoll=effect.healFormula?rollFormula(effect.healFormula,false):{total:0,formula:''},damage=Math.max(0,(Number(damageRoll.total)||0)+(effect.damageFormula?actorModifiers.damageMod:0));if(mode==='attack'&&!success)damage=0;if(mode==='save'&&success)damage=effect.halfOnSave?Math.floor(damage/2):0;
            var immune=combatHasDamageTrait(target.immunities,damageType),resisted=combatHasDamageTrait(target.resistances,damageType),vulnerable=combatHasDamageTrait(target.vulnerabilities,damageType);if(immune)damage=0;else if(resisted&&!vulnerable)damage=Math.floor(damage/2);else if(vulnerable&&!resisted)damage*=2;
            var heal=Math.max(0,Number(healRoll.total)||0),vitalsResult=applyVitalsDomainOperation(target,{damage:damage,heal:heal,preserveOverMax:true}),absorbed=vitalsResult.absorbed,after=vitalsResult.hp;target.hp=after;target.tempHp=vitalsResult.tempHp;syncCombatZeroHp(target,vitalsResult.beforeHp,actor.key,castStamp);
            var applyStatuses=mode==='save'?!success:success;if(applyStatuses&&effect.statuses.length){effect.statuses.forEach(function(key){var statusEffect=combatStatusEffectForKey(key,{duration:effect.durationRounds||null,remaining:effect.durationRounds||null,sourceId:effectSource,sourceActorKey:actor.key,concentration:effect.concentration});var statusResult=applyStatusDomainOperation(target,{statusKey:key,enable:true,effect:statusEffect});target.statuses=statusResult.statuses;target.statusEffects=statusResult.statusEffects;});}
            order[targetIndex]=target;results.push({key:target.key,name:target.name||'Цель',roll:natural,rolls:rolls,rollMode:rollMode,modifier:modifier,total:total,dc:dc,success:success,damage:damage,heal:heal,absorbed:absorbed,hp:after,tempHp:target.tempHp,statuses:applyStatuses?effect.statuses:[]});
          });
          if(cost!=='free')economy[cost]=Math.max(0,Number(economy[cost]||0)-1);if(restrictions.slowed&&(cost==='long'||cost==='short')){economy.long=0;economy.short=0;}order[actorIndex].economy=economy;if(effect.concentration)order[actorIndex].concentration={sourceId:effectSource,abilityKey:effect.key||'',name:effect.name||'Способность',startedAt:castStamp,durationRounds:effect.durationRounds||0};
          var stamp=now(),updates={};updates['combat/order']=order;updates['combat/updatedAt']=stamp;updates['members/'+requestUid+'/actionRequest/status']='approved';updates['members/'+requestUid+'/actionRequest/resolvedAt']=stamp;updates['members/'+requestUid+'/actionOperationIds']=rememberActionOperation(member.actionOperationIds,request.id,stamp);
          if(resourceMutation&&resourceMutation.changed){updates['members/'+requestUid+'/character/abilityUsage/'+resourceKey]=Object.assign({},resourceMutation.state,{updatedAt:stamp});}
          targetIndexes.forEach(function(targetIndex,listIndex){var target=order[targetIndex],result=results[listIndex];if(target.uid){updates['members/'+target.uid+'/character/hpCur']=result.hp;updates['members/'+target.uid+'/character/tempHp']=result.tempHp;updates['members/'+target.uid+'/character/deathSaves']=target.zeroHp||null;updates['members/'+target.uid+'/character/statuses']=target.statuses||[];updates['members/'+target.uid+'/character/statusEffects']=target.statusEffects||[];}if(target.tokenId){(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+index+'/hp']=result.hp;updates['scene/tokens/'+index+'/tempHp']=result.tempHp;updates['scene/tokens/'+index+'/statuses']=target.statuses||[];updates['scene/tokens/'+index+'/statusEffects']=target.statusEffects||[];}});Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+index+'/hp']=result.hp;updates['zones/'+zoneId+'/tokens/'+index+'/tempHp']=result.tempHp;updates['zones/'+zoneId+'/tokens/'+index+'/statuses']=target.statuses||[];updates['zones/'+zoneId+'/tokens/'+index+'/statusEffects']=target.statusEffects||[];}});});}});
          concentrationTouched.forEach(function(index){if(targetIndexes.indexOf(index)>=0)return;var target=order[index];if(target.uid){updates['members/'+target.uid+'/character/statuses']=target.statuses||[];updates['members/'+target.uid+'/character/statusEffects']=target.statusEffects||[];}if(target.tokenId){(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,tokenIndex){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+tokenIndex+'/statuses']=target.statuses||[];updates['scene/tokens/'+tokenIndex+'/statusEffects']=target.statusEffects||[];}});Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,tokenIndex){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statuses']=target.statuses||[];updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statusEffects']=target.statusEffects||[];}});});}});
          var summaries=results.map(function(result){var outcome=mode==='save'?(result.success?'спасся':'провалил спасбросок'):mode==='attack'?(result.success?'попадание':'промах'):'эффект применён';return result.name+': '+outcome+(result.damage?' · урон '+result.damage:'')+(result.heal?' · лечение '+result.heal:'')+(result.statuses.length?' · '+result.statuses.join(', '):'');});var firstRoll=results.filter(function(result){return result.roll!=null;})[0]||{};
          updates.combatEvent={id:'combat-ability-'+stamp,kind:'combat-ability',name:actor.name||request.name||'Участник',portrait:actor.portrait||'',text:'Применяет «'+(effect.name||'способность')+'»'+(effect.areaMode!=='manual'?' по области «'+({circle:'круг',line:'линия',cone:'конус'}[effect.areaMode]||effect.areaMode)+'» длиной '+effect.areaRadius+' кл.':'')+'. '+summaries.join('; ')+'.'+(effect.durationRounds?' Длительность: '+effect.durationRounds+' р.':'')+(effect.concentration?' Требует концентрации.':''),ability:effect.name||'',abilityKey:effect.key||'',targetKeys:targetKeys,results:results,areaMode:effect.areaMode,areaRadius:effect.areaMode!=='manual'?effect.areaRadius:0,areaWidth:effect.areaMode==='line'?effect.areaWidth:0,areaAnchorKey:effect.areaMode!=='manual'?effect.areaAnchorKey:'',concentration:effect.concentration,durationRounds:effect.durationRounds,roll:firstRoll.roll==null?null:firstRoll.roll,rolls:firstRoll.rolls||[],total:firstRoll.total==null?null:firstRoll.total,dc:firstRoll.dc==null?null:firstRoll.dc,success:results.every(function(result){return result.success;}),damage:results.reduce(function(sum,result){return sum+result.damage;},0),heal:results.reduce(function(sum,result){return sum+result.heal;},0),ts:stamp,revealAt:stamp+(firstRoll.roll!=null?3200:500)};updates.updatedAt=stamp;
          updates.combatEvent.actorKey=actor.key||'';
          updates.combatEvent.areaAnchorPoint=effect.areaMode!=='manual'?effect.areaAnchorPoint:null;
          castDiagnostic.targetCount=targetKeys.length;
          castDiagnostic.targetKeys=targetKeys.slice();
          castDiagnostic.damage=updates.combatEvent.damage;
          castDiagnostic.heal=updates.combatEvent.heal;
          appendOperationEvent('ability-cast',castDiagnostic.id,'applying',castDiagnostic);
          return firebase.update(roomRef(session.code),updates).then(function(){
            castWriteCommitted=true;
            appendOperationEvent('ability-cast',castDiagnostic.id,'applied',castDiagnostic);
            return refreshRoom(session.code).then(function(){return api.getSnapshot();});
          });
        });
      }).catch(function(error){
        if(castDiagnostic)appendOperationEvent('ability-cast',castDiagnostic.id,castWriteCommitted?'resolve-refresh-failed':'resolve-failed',castDiagnostic,error);
        if(error&&['master-only','room-not-found','request-missing','combat-missing','combat-participant-missing','combat-area-anchor','combat-not-turn','combat-zero-hp','combat-status-blocked','combat-action-spent','combat-target-range','ability-exhausted'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    prepareCombatReaction: function (text, participantKey) {
      text = String(text || '').trim().slice(0, 220);
      participantKey = String(participantKey || '').slice(0, 160);
      if (!text) return Promise.reject(roomError('Опишите условие и действие реакции.', 'combat-reaction-empty'));
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0)),index=-1;
          if(session.role==='master')index=participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):turnIndex;
          else index=order.findIndex(function(entry){return entry&&entry.uid===user.uid;});
          if(index<0)throw roomError('Участник боя не найден.','combat-participant-missing');
          if(index!==turnIndex)throw roomError('Подготовить реакцию можно только в свой ход.','combat-not-turn');
          var entry=combatEntryWithRoomStatuses(room,Object.assign({},order[index])),economy=Object.assign({long:1,short:1,reaction:1},entry.economy||{});
          var restrictions=combatRestrictions(entry);
          if(restrictions.blocked.long)throw roomError(restrictions.reasons[0]||'Текущее состояние запрещает долгое действие.','combat-status-blocked');
          if(Number(economy.long||0)<1)throw roomError('Долгое действие уже израсходовано.','combat-action-spent');
          economy.long=Math.max(0,Number(economy.long||0)-1);
          if(restrictions.slowed)economy.short=0;
          entry.economy=economy;
          entry.preparedReaction={text:text,preparedAt:now(),round:Number(combat.round||1)};order[index]=entry;
          var stamp=now();
          return firebase.update(roomRef(session.code),{
            'combat/order':order,'combat/updatedAt':stamp,
            combatEvent:{id:'combat-prepare-'+stamp,kind:'combat-action',name:entry.name||'Участник',portrait:entry.portrait||'',text:'Готовит реакцию: «'+text+'».',actionType:'long',ts:stamp},updatedAt:stamp
          }).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['combat-reaction-empty','room-required','room-not-found','combat-missing','combat-participant-missing','combat-not-turn','combat-action-spent','combat-status-blocked'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    triggerPreparedReaction: function (participantKey) {
      participantKey=String(participantKey||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session)throw roomError('Сначала войдите в комнату.','room-required');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var index=session.role==='master'?(participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):Number(combat.turnIndex)||0):order.findIndex(function(entry){return entry&&entry.uid===user.uid;});
          if(index<0||!order[index])throw roomError('Участник боя не найден.','combat-participant-missing');
          var entry=combatEntryWithRoomStatuses(room,Object.assign({},order[index])),prepared=entry.preparedReaction;
          if(!prepared||!prepared.text)throw roomError('Подготовленной реакции нет.','combat-reaction-missing');
          var economy=Object.assign({reaction:1},entry.economy||{});
          var restrictions=combatRestrictions(entry);
          if(restrictions.blocked.reaction)throw roomError(restrictions.reasons[0]||'Текущее состояние запрещает реакцию.','combat-status-blocked');
          if(Number(economy.reaction||0)<1)throw roomError('Реакция в этом раунде уже израсходована.','combat-action-spent');
          economy.reaction=Math.max(0,Number(economy.reaction||0)-1);entry.economy=economy;entry.preparedReaction=null;order[index]=entry;
          var stamp=now();return firebase.update(roomRef(session.code),{
            'combat/order':order,'combat/updatedAt':stamp,
            combatEvent:{id:'combat-trigger-'+stamp,kind:'combat-action',name:entry.name||'Участник',portrait:entry.portrait||'',text:'Срабатывает подготовленная реакция: «'+prepared.text+'».',actionType:'reaction',ts:stamp},updatedAt:stamp
          }).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','room-not-found','combat-missing','combat-participant-missing','combat-reaction-missing','combat-action-spent','combat-status-blocked'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    stopCombatConcentration: function (participantKey) {
      participantKey=String(participantKey||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session)throw roomError('Сначала войдите в комнату.','room-required');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];if(!combat||!combat.active)throw roomError('Сейчас нет активного боя.','combat-missing');
          var actorIndex=session.role==='master'?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):order.findIndex(function(entry){return entry&&entry.uid===user.uid;});
          if(actorIndex<0)throw roomError('Участник боя не найден.','combat-participant-missing');var actor=order[actorIndex],source=actor&&actor.concentration&&actor.concentration.sourceId;if(!source)throw roomError('Участник ничего не поддерживает.','combat-concentration-missing');
          var updates={},touched=[];order=order.map(function(entry,index){entry=Object.assign({},entry);var effects=Array.isArray(entry.statusEffects)?entry.statusEffects:[],removed=effects.filter(function(effect){return effect&&String(effect.sourceId||'')===String(source);});if(!removed.length)return entry;entry.statusEffects=effects.filter(function(effect){return !effect||String(effect.sourceId||'')!==String(source);});var activeKeys=entry.statusEffects.map(function(effect){return effect&&(effect.statusKey||effect.key)||'';});entry.statuses=combatStatusKeys(entry).filter(function(key){return !removed.some(function(effect){return (effect.statusKey||effect.key)===key;})||activeKeys.indexOf(key)>=0;});touched.push(index);return entry;});
          order[actorIndex].concentration=null;touched.forEach(function(index){var entry=order[index];if(entry.uid){updates['members/'+entry.uid+'/character/statuses']=entry.statuses||[];updates['members/'+entry.uid+'/character/statusEffects']=entry.statusEffects||[];}if(entry.tokenId){(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,tokenIndex){if(token&&String(token.id)===String(entry.tokenId)){updates['scene/tokens/'+tokenIndex+'/statuses']=entry.statuses||[];updates['scene/tokens/'+tokenIndex+'/statusEffects']=entry.statusEffects||[];}});Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,tokenIndex){if(token&&String(token.id)===String(entry.tokenId)){updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statuses']=entry.statuses||[];updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statusEffects']=entry.statusEffects||[];}});});}});
          var stamp=now();updates['combat/order']=order;updates['combat/updatedAt']=stamp;updates.combatEvent={id:'combat-concentration-'+stamp,kind:'combat-ability',name:actor.name||'Участник',portrait:actor.portrait||'',text:'Прекращает концентрацию на «'+(actor.concentration&&actor.concentration.name||'эффекте')+'».',ts:stamp};updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){if(error&&['room-required','room-not-found','combat-missing','combat-participant-missing','combat-concentration-missing'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    endCombat: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Завершить бой может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room || room.masterUid !== user.uid) throw roomError('Комната больше недоступна.', 'room-not-found');
          var stamp = now();
          return firebase.update(roomRef(session.code), {
            combat:null,
            combatEvent:{ id:'combat-end-'+stamp, kind:'combat', name:'Мир Зарготы', text:'Бой завершён.', ts:stamp },
            updatedAt:stamp
          }).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resetExploration: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Сбрасывать исследование может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var updates = { exploredRegions: null, updatedAt: now() };
          Object.keys(room.members || {}).forEach(function (uid) { updates['members/' + uid + '/exploredRegions'] = null; });
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    publishMeasurement: function (measurement) {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        var room = currentRoom;
        if (!room || !room.members || !room.members[user.uid]) throw roomError('Комната больше недоступна.', 'room-not-found');
        var target = firebase.ref(db, 'rooms/' + session.code + '/liveMeasurements/' + user.uid);
        if (!measurement) return firebase.set(target, null).then(function () { return api.getSnapshot(); });
        var member = room.members[user.uid] || {};
        var payload = {
          uid: user.uid,
          name: String(member.character && member.character.name || member.name || (session.role === 'master' ? 'Гейм-мастер' : 'Игрок')).slice(0, 80),
          tool: ['ruler','line','circle','cone'].indexOf(measurement.tool) >= 0 ? measurement.tool : 'ruler',
          sx: Math.max(0, Math.min(100, Number(measurement.sx) || 0)),
          sy: Math.max(0, Math.min(100, Number(measurement.sy) || 0)),
          ex: Math.max(0, Math.min(100, Number(measurement.ex) || 0)),
          ey: Math.max(0, Math.min(100, Number(measurement.ey) || 0)),
          updatedAt: now()
        };
        return firebase.set(target, payload).then(function () { return api.getSnapshot(); });
      }).catch(function (error) {
        if (error && ['room-required','room-not-found'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    sendChat: function (text, kind, speakerUid) {
      text = String(text || '').trim().slice(0, 500);
      if (!text) return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var member = room.members && room.members[user.uid];
          if (!member) throw roomError('Участник не найден.', 'member-missing');
          var isWorld = session.role === 'master' && kind === 'world';
          var isAction = kind === 'action';
          var speaker = session.role === 'master' && speakerUid && room.members && room.members[speakerUid] || member;
          var id = 'msg-' + now() + '-' + Math.random().toString(36).slice(2, 6);
          var payload = {
            id: id, uid: user.uid, kind: isWorld ? 'world' : (isAction ? 'action' : (session.role === 'master' && !speakerUid ? 'gm' : 'chat')),
            name: isWorld ? 'Мир Зарготы' : (speaker.character && speaker.character.name || speaker.name || 'Игрок'),
            portrait: isWorld ? '' : (speaker.character && speaker.character.portrait || ''),
            text: text, ts: now()
          };
          var updates = {}; updates['messages/' + id] = payload;
          var old = Object.keys(member.messages || {}).map(function (key) { return member.messages[key]; }).filter(Boolean).sort(function (a,b) { return Number(a.ts)-Number(b.ts); });
          while (old.length >= 50) { updates['messages/' + old.shift().id] = null; }
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['room-required','room-not-found','member-missing'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    // Бросок хранится в записи участника: так игрок может публиковать его по существующим правилам доступа.
    announceRoll: function (text, speakerUid) {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || !firebase || !db) return null;
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        var speaker = session.role === 'master' && speakerUid && currentRoom && currentRoom.members && currentRoom.members[speakerUid] || member;
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          lastRoll: { ts: now(), uid: user.uid, name: speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок', text: String(text || '').slice(0, 140) }
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    },

    beginRoll: function (sides, speakerUid, value, total, outcome, statLabel, clientRollId, options) {
      options = options || {};
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || !firebase || !db) return null;
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        var speaker = session.role === 'master' && speakerUid && currentRoom && currentRoom.members && currentRoom.members[speakerUid] || member;
        var activeRoll = {
          id: String(clientRollId || ('roll-' + now() + '-' + Math.random().toString(36).slice(2, 6))).slice(0,120),
          ts: now(),
          duration: 1100,
          sides: Math.max(2, Math.min(100, Number(sides) || 20)),
          value: Math.max(1, Number(value) || 1),
          total: Number(total == null ? value : total) || 0,
          outcome: outcome === 'critical-success' || outcome === 'critical-fail' ? outcome : '',
          statLabel: String(statLabel || '').slice(0, 30),
          speakerUid: speaker && speaker.uid || user.uid,
          speakerTokenId: String(options.speakerTokenId || '').slice(0, 128),
          revealResult: options.revealResult !== false,
          name: String(options.name || speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок').slice(0, 120)
        };
        if (member) { member.activeRoll = activeRoll; emit(); }
        try { window.dispatchEvent(new CustomEvent('zg-local-roll',{detail:{ownerUid:user.uid,roll:activeRoll}})); } catch(e) {}
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          activeRoll: activeRoll
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    },

    beginRollBatch: function (rolls, speakerUid, clientRollId, options) {
      options = options || {};
      rolls = (Array.isArray(rolls) ? rolls : []).slice(0, 10).map(function (roll) {
        var sides = Math.max(2, Math.min(100, Number(roll && roll.sides) || 20));
        var value = Math.max(1, Math.min(sides, Number(roll && roll.value) || 1));
        return {
          sides: sides, value: value, total: Number(roll && roll.total == null ? value : roll.total) || 0,
          outcome: roll && (roll.outcome === 'critical-success' || roll.outcome === 'critical-fail') ? roll.outcome : '',
          statLabel: String(roll && roll.statLabel || '').slice(0, 30),
          kept: roll && typeof roll.kept === 'boolean' ? roll.kept : null,
          rollMode: roll && (roll.rollMode === 'advantage' || roll.rollMode === 'disadvantage') ? roll.rollMode : ''
        };
      });
      if (!rolls.length) return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function (user) {
        var session = readSession(); if (!session || !firebase || !db) return null;
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        var speaker = session.role === 'master' && speakerUid && currentRoom && currentRoom.members && currentRoom.members[speakerUid] || member;
        var activeRoll = { id:String(clientRollId||('roll-'+now()+'-'+Math.random().toString(36).slice(2,6))).slice(0,120), ts:now(), duration:1250, rolls:rolls,
          speakerUid:speaker && speaker.uid || user.uid, speakerTokenId:String(options.speakerTokenId||'').slice(0,128), revealResult:options.revealResult!==false,
          name:String(options.name||speaker && speaker.character && speaker.character.name||speaker && speaker.name||'Игрок').slice(0,120) };
        if (member) { member.activeRoll = activeRoll; emit(); }
        try { window.dispatchEvent(new CustomEvent('zg-local-roll',{detail:{ownerUid:user.uid,roll:activeRoll}})); } catch(e) {}
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          activeRoll: activeRoll
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    },

    // Назначить участникам текущую зону rooms/{code}/members/{uid}/zone
    sendToZone: function (zoneId, uids) {
      zoneId = String(zoneId || '');
      uids = Array.isArray(uids) ? uids : [];
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Перемещать игроков может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var updates = {};
          uids.forEach(function (uid) { if (uid) updates['members/' + uid + '/zone'] = zoneId; });
          if (!Object.keys(updates).length) return api.getSnapshot();
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    leaveRoom: function () {
      if (leaveRoomPromise) return leaveRoomPromise;
      leaveRoomPromise = ensureReady().then(function (user) {
        var session = readSession();
        if (!session) return;
        if (!tabCanWrite()) {
          return clearPresenceDisconnectHandles().then(function () {
            characterEntryUpload=null;
            characterInboundSession=null;
            saveSession(null);
            stopWatchingRoom();
            tabWasSecondary=false;
            emit();
            return api.getSnapshot();
          });
        }
        var finalPull = Promise.resolve();
        if (session.role === 'player') {
          var memberRef = firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid);
          finalPull = firebase.get(memberRef).then(function (snapshot) {
            if (!snapshot.exists()) throw roomError('Участник комнаты больше не найден. Локальный лист не изменён.', 'player-not-found');
            var member = snapshot.val(), roomCharacter = member && member.character;
            if (!roomCharacter) return;
            var expectedId = String(member.characterId || ''), actualId = String(roomCharacter.id || '');
            var expectedKey = String(member.campaignKey || ''), actualKey = campaignKeyFor(roomCharacter);
            if ((expectedId && actualId !== expectedId) || (expectedKey && actualKey && actualKey !== expectedKey)) {
              throw roomError('Итоговый лист комнаты относится к другому герою. Выход остановлен, локальные данные сохранены.', 'character-mismatch');
            }
            setCharacterSync('sending', roomCharacter, 'room→local', 'exit');
            appendSyncEvent(roomCharacter, 'room→local', 'exit', 'pulling');
            emit();
            if (typeof w.zgPersistFinalSessionCharacter !== 'function') {
              throw roomError('Локальное хранилище героя недоступно. Выход остановлен.', 'storage-missing');
            }
            if (!tabCanWrite()) throw roomError('Управление передано другой вкладке. Выход из этой копии остановлен без изменения локального героя.', 'tab-read-only');
            return Promise.resolve(w.zgPersistFinalSessionCharacter(roomCharacter, member)).then(function () {
              clearCharacterOutbox(session, member.characterId);
              setCharacterSync('synced', roomCharacter, 'room→local', 'exit');
              appendSyncEvent(roomCharacter, 'room→local', 'exit', 'saved');
            });
          });
        }
        return finalPull.then(function () {
          var secondary = !tabCanWrite();
          return clearPresenceDisconnectHandles().then(function () {
            var operation;
            if (secondary) {
              operation = Promise.resolve();
            } else if (session.role === 'master') {
              operation = firebase.remove(privateDeliveriesRoomRef(session.code)).catch(function(){return null;}).then(function(){
                return firebase.remove(roomRef(session.code));
              });
            } else if (session.role === 'pending' && session.playerCode) {
              operation = firebase.remove(firebase.ref(db, 'rooms/' + session.code + '/pending/' + session.playerCode));
            } else {
              operation = firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
                online: false,
                lastSeen: firebase.serverTimestamp()
              });
            }
            return operation.then(function () {
              characterEntryUpload=null;
              characterInboundSession=null;
              saveSession(null);
              stopWatchingRoom();
              tabWasSecondary=false;
              emit();
            });
          });
        });
      }).catch(function (error) {
        var session = readSession();
        var member = currentRoom && session && currentRoom.members && currentRoom.members[session.uid];
        var character = member && member.character;
        setCharacterSync(connected ? 'conflict' : 'offline', character, 'room→local', 'exit', error);
        appendSyncEvent(character, 'room→local', 'exit', 'error', error);
        if (session && tabCanWrite()) setPresence(session);
        emit();
        throw error;
      }).then(function (result) {
        leaveRoomPromise = null;
        return result;
      }, function (error) {
        leaveRoomPromise = null;
        throw error;
      });
      return leaveRoomPromise;
    },

    leaveRoomWithLocalCopy: function () {
      var session = readSession();
      if (!session) return Promise.resolve(api.getSnapshot());
      if (!tabCanWrite()) {
        clearPresenceDisconnectHandles();
        characterEntryUpload = null;
        characterInboundSession = null;
        saveSession(null);
        stopWatchingRoom();
        tabWasSecondary = false;
        emit();
        return Promise.resolve(api.getSnapshot());
      }
      if (session.role === 'master') {
        return Promise.reject(roomError('Гейм-мастер не может завершить общую комнату только локально.', 'master-local-exit-forbidden'));
      }
      var member = currentRoom && currentRoom.members && currentRoom.members[session.uid];
      var character = member && member.character;
      if (member && member.characterId != null) clearCharacterOutbox(session, member.characterId);
      appendSyncEvent(character, 'room→local', 'exit', 'local-copy');
      setCharacterSync('local', character, 'room→local', 'exit');
      if (firebase && db && auth && auth.currentUser && connected && tabCanWrite()) {
        var target = session.role === 'pending' && session.playerCode
          ? firebase.ref(db, 'rooms/' + session.code + '/pending/' + session.playerCode)
          : firebase.ref(db, 'rooms/' + session.code + '/members/' + auth.currentUser.uid);
        var bestEffort = session.role === 'pending'
          ? firebase.remove(target)
          : firebase.update(target, { online:false, lastSeen:firebase.serverTimestamp() });
        Promise.resolve(bestEffort).catch(function () {});
      }
      characterEntryUpload = null;
      characterInboundSession = null;
      clearPresenceDisconnectHandles();
      saveSession(null);
      stopWatchingRoom();
      tabWasSecondary = false;
      emit();
      return Promise.resolve(api.getSnapshot());
    },

    takeOverTab: function () {
      return takeOverTab();
    },

    getSnapshot: function () {
      var session = readSession();
      var snapshotRoom = currentRoom;
      if (currentRoom && session && session.role === 'player' && session.uid && Object.keys(currentPrivateDeliveries || {}).length) {
        var snapshotMembers = Object.assign({}, currentRoom.members || {});
        var ownMember = Object.assign({}, snapshotMembers[session.uid] || {});
        ownMember.gmDeliveries = Object.assign({}, ownMember.gmDeliveries || {}, currentPrivateDeliveries);
        snapshotMembers[session.uid] = ownMember;
        snapshotRoom = Object.assign({}, currentRoom, {members:snapshotMembers});
      }
      var member = snapshotRoom && session && snapshotRoom.members ? snapshotRoom.members[session.uid] || null : null;
      return {
        mode: api.mode,
        networkReady: !!(auth && auth.currentUser && !initError),
        online: connected,
        connected: !!currentRoom,
        approved: !!(member && member.role === 'player'),
        session: session,
        room: snapshotRoom,
        campaign: currentCampaign,
        players: membersOf(snapshotRoom, 'player'),
        pending: pendingOf(snapshotRoom),
        tabCoordination: tabCoordinationState(),
        characterSync: cloneCharacterSync(),
        error: initError ? initError.message : ''
      };
    },

    markLocalCharacterSaved: function (character, reason) {
      setCharacterSync(connected ? 'local' : 'offline', character, 'local→room', reason || 'edit');
      appendSyncEvent(character, 'local→room', reason || 'edit', connected ? 'saved-local' : 'saved-offline');
      emit();
      return cloneCharacterSync();
    },

    queueCharacterSync: function (character, reason) {
      return queueCharacterSync(character, reason);
    },

    flushCharacterOutbox: function () {
      return flushCharacterOutbox();
    },

    discardCharacterOutbox: function (characterId) {
      return clearCharacterOutbox(readSession(), characterId);
    },

    flushGameplayOutbox: function () {
      return flushGameplayOutbox();
    },

    markLocalCharacterSaveFailed: function (character, error) {
      setCharacterSync('storage-error', character, 'local', 'edit', error);
      appendSyncEvent(character, 'local', 'edit', 'storage-error', error);
      emit();
      return cloneCharacterSync();
    },

    recordIncomingCharacter: function (character, reason) {
      setCharacterSync('synced', character, 'room→local', reason || 'reconnect');
      appendSyncEvent(character, 'room→local', reason || 'reconnect', 'saved');
      return cloneCharacterSync();
    },

    getSyncDiagnostics: function () {
      var log = [];
      try {
        log = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
        if (!Array.isArray(log)) log = [];
      } catch (e) {}
      return {
        state: cloneCharacterSync(),
        uid: String(auth && auth.currentUser && auth.currentUser.uid || ''),
        session: readSession(),
        online: connected,
        outbox: syncOutbox() ? syncOutbox().diagnostics() : [],
        gameplayOutbox: gameplayOutbox() ? gameplayOutbox().diagnostics() : [],
        conflicts: syncOutbox() && syncOutbox().readConflicts ? syncOutbox().readConflicts() : [],
        performance: performanceSnapshot(),
        events: log.slice(-100)
      };
    },

    getPerformanceDiagnostics: performanceSnapshot,

    isCharacterEntryUpload: function (character) {
      return isCharacterEntryUpload(readSession(), character);
    },

    canApplyIncomingCharacter: function (character) {
      return canApplyIncomingCharacter(readSession(), character);
    },

    subscribe: function (listener) {
      if (typeof listener !== 'function') return function () {};
      if (listeners.indexOf(listener) >= 0) networkPerformance.duplicateListenerAdds++;
      listeners.push(listener);
      networkPerformance.maxApiListeners=Math.max(networkPerformance.maxApiListeners,listeners.length);
      listener(api.getSnapshot());
      return function () {
        listeners = listeners.filter(function (item) { return item !== listener; });
      };
    },

    normalizeCode: normalizeRoomCode,
    normalizePlayerCode: normalizePlayerCode
  };

  initTabCoordination();

  var ready = Promise.all([
    import('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-database.js')
  ]).then(function (modules) {
    var appModule = modules[0], authModule = modules[1], databaseModule = modules[2];
    var app = appModule.initializeApp(FIREBASE_CONFIG);
    auth = authModule.getAuth(app);
    db = databaseModule.getDatabase(app);
    firebase = {
      ref: databaseModule.ref,
      get: databaseModule.get,
      set: trackedFirebaseWrite('set', databaseModule.set),
      update: trackedFirebaseWrite('update', databaseModule.update),
      // Firebase вычисляет итоговое значение транзакции внутри SDK и может
      // повторно вызывать callback, поэтому считаем вызов, но не выдумываем байты.
      runTransaction: trackedFirebaseWrite('transaction', databaseModule.runTransaction, -1),
      increment: databaseModule.increment,
      remove: trackedFirebaseWrite('remove', databaseModule.remove, -1),
      onValue: databaseModule.onValue,
      onDisconnect: databaseModule.onDisconnect,
      serverTimestamp: databaseModule.serverTimestamp
    };
    try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
    return authModule.setPersistence(auth, authModule.browserLocalPersistence).then(function () {
      if (auth.currentUser) return auth.currentUser;
      return authModule.signInAnonymously(auth).then(function (credential) { return credential.user; });
    }).then(function (user) {
      networkPerformance.connectionSubscriptions++;
      firebase.onValue(firebase.ref(db, '.info/connected'), function (snapshot) {
        connected = snapshot.val() === true;
        if (connected) {
          setPresence(readSession());
          flushCharacterOutbox();
          flushGameplayOutbox();
        }
        emit();
      });
      var session = readSession();
      if (session) {
        session.uid = user.uid;
        saveSession(session);
        watchRoom(session.code);
        setPresence(session);
      }
      emit();
      return user;
    });
  }).catch(function (error) {
    console.error('Zargota Firebase init:', error);
    initError = roomError('Не удалось подключить Firebase. Проверьте интернет и обновите страницу.', 'firebase-init', error);
    emit();
    return null;
  });

  w.ZargotaRooms = api;
})(window);
