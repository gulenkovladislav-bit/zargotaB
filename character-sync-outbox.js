(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaSyncOutbox = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var STORAGE_KEY = 'zargota_character_sync_outbox_v1';
  var CONFLICTS_KEY = 'zargota_character_sync_conflicts_v1';
  var MAX_ENTRIES = 20;
  var MAX_CONFLICTS = 10;

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return null; }
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    var result = {};
    Object.keys(value).sort().forEach(function (key) {
      result[key] = stableValue(value[key]);
    });
    return result;
  }

  function stripHeavyData(value) {
    if (typeof value === 'string') return /^data:/i.test(value) || /^blob:/i.test(value) ? '' : value;
    if (Array.isArray(value)) return value.map(stripHeavyData);
    if (!value || typeof value !== 'object') return value;
    var result = {};
    Object.keys(value).forEach(function (key) {
      if (key === 'heroArt' || key === 'cinematicArt') return;
      result[key] = stripHeavyData(value[key]);
    });
    return result;
  }

  function contentSignature(character) {
    var value = clone(character) || {};
    delete value.revision;
    delete value.updatedAt;
    delete value.updatedBy;
    delete value.source;
    delete value.syncOperationId;
    return JSON.stringify(stableValue(value));
  }

  function fieldSignature(value) {
    return JSON.stringify(stableValue(stripHeavyData(value == null ? null : value)));
  }

  function createInventoryOperations(baseCharacter, nextCharacter, fields) {
    fields = Array.isArray(fields) ? fields : [];
    var operations = [];
    for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      var field = String(fields[fieldIndex] || '');
      if (field !== 'inventoryItems' && field !== 'equipItems') return null;
      var baseList = Array.isArray(baseCharacter && baseCharacter[field]) ? baseCharacter[field] : [];
      var nextList = Array.isArray(nextCharacter && nextCharacter[field]) ? nextCharacter[field] : [];
      var baseById = {}, nextById = {}, invalid = false;
      baseList.forEach(function (item) {
        var id = item && typeof item === 'object' ? String(item.itemId || '') : '';
        if (!id || baseById[id]) invalid = true;
        else baseById[id] = item;
      });
      nextList.forEach(function (item) {
        var id = item && typeof item === 'object' ? String(item.itemId || '') : '';
        if (!id || nextById[id]) invalid = true;
        else nextById[id] = item;
      });
      if (invalid) return null;
      nextList.forEach(function (item) {
        var id = String(item.itemId);
        if (!baseById[id]) {
          operations.push({ type:'add', field:field, itemId:id, item:stripHeavyData(clone(item)) });
        } else if (fieldSignature(baseById[id]) !== fieldSignature(item)) {
          operations.push({
            type:'update',
            field:field,
            itemId:id,
            baseSignature:fieldSignature(baseById[id]),
            item:stripHeavyData(clone(item))
          });
        }
      });
      baseList.forEach(function (item) {
        var id = String(item.itemId);
        if (!nextById[id]) {
          operations.push({ type:'remove', field:field, itemId:id, baseSignature:fieldSignature(item) });
        }
      });
    }
    return operations;
  }

  function applyInventoryOperations(roomCharacter, operations, metadata) {
    if (!roomCharacter || typeof roomCharacter !== 'object') return { ok:false, error:'character-missing' };
    if (!Array.isArray(operations)) return { ok:false, error:'operations-missing' };
    var merged = clone(roomCharacter) || {};
    for (var index = 0; index < operations.length; index += 1) {
      var operation = operations[index] || {};
      var field = String(operation.field || '');
      var itemId = String(operation.itemId || '');
      if ((field !== 'inventoryItems' && field !== 'equipItems') || !itemId) {
        return { ok:false, error:'operation-invalid' };
      }
      var list = Array.isArray(merged[field]) ? merged[field].slice() : [];
      var matches = [];
      list.forEach(function (item, itemIndex) {
        if (item && String(item.itemId || '') === itemId) matches.push(itemIndex);
      });
      if (matches.length > 1) return { ok:false, conflict:true, field:field, itemId:itemId };
      var currentIndex = matches.length ? matches[0] : -1;
      var currentItem = currentIndex >= 0 ? list[currentIndex] : null;
      if (operation.type === 'add') {
        if (currentItem) {
          if (fieldSignature(currentItem) !== fieldSignature(operation.item)) {
            return { ok:false, conflict:true, field:field, itemId:itemId };
          }
        } else {
          list.push(stripHeavyData(clone(operation.item)));
        }
      } else if (operation.type === 'update') {
        if (!currentItem) return { ok:false, conflict:true, field:field, itemId:itemId };
        if (fieldSignature(currentItem) === fieldSignature(operation.item)) {
          // The same operation was already applied before an acknowledgement was received.
        } else if (fieldSignature(currentItem) === String(operation.baseSignature || '')) {
          list[currentIndex] = stripHeavyData(clone(operation.item));
        } else {
          return { ok:false, conflict:true, field:field, itemId:itemId };
        }
      } else if (operation.type === 'remove') {
        if (currentItem) {
          if (fieldSignature(currentItem) !== String(operation.baseSignature || '')) {
            return { ok:false, conflict:true, field:field, itemId:itemId };
          }
          list.splice(currentIndex, 1);
        }
      } else {
        return { ok:false, error:'operation-invalid' };
      }
      merged[field] = list;
    }
    merged.revision = Math.max(
      Math.max(0, Number(roomCharacter.revision) || 0) + 1,
      Math.max(0, Number(metadata && metadata.revision) || 0)
    );
    merged.updatedAt = metadata && metadata.updatedAt != null ? metadata.updatedAt : Date.now();
    merged.updatedBy = String(metadata && metadata.updatedBy || '');
    merged.source = String(metadata && metadata.source || 'inventory-operation');
    merged.syncOperationId = String(metadata && metadata.operationId || '');
    return { ok:true, character:merged };
  }

  function createOperationId(scope, timestamp, revision) {
    return scope + ':' + timestamp + ':' + Math.max(0, Number(revision) || 0) + ':' +
      Math.random().toString(36).slice(2, 10);
  }

  function read() {
    try {
      var rows = JSON.parse(root.localStorage && root.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(function (row) { return row && row.id && row.roomCode && row.uid && row.characterId; }) : [];
    } catch (error) {
      return [];
    }
  }

  function write(rows) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify((Array.isArray(rows) ? rows : []).slice(-MAX_ENTRIES)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function scopeKey(value) {
    return [String(value && value.roomCode || ''), String(value && value.uid || ''), String(value && value.characterId || '')].join(':');
  }

  function enqueue(input) {
    input = clone(input) || {};
    var scope = scopeKey(input);
    if (!input.roomCode || !input.uid || !input.characterId || !input.snapshot) {
      return { ok:false, error:'invalid-entry', size:read().length };
    }
    var rows = read(), existingIndex = -1;
    rows.some(function (row, index) {
      if (scopeKey(row) === scope) { existingIndex = index; return true; }
      return false;
    });
    var existing = existingIndex >= 0 ? rows[existingIndex] : null;
    var timestamp = Math.max(1, Number(input.updatedAt) || Date.now());
    var snapshot = stripHeavyData(input.snapshot);
    var sameContent = !!(existing && contentSignature(existing.snapshot) === contentSignature(snapshot));
    var inputFields = Array.isArray(input.changedFields) ? input.changedFields.map(String).filter(Boolean) : [];
    var existingFields = existing && Array.isArray(existing.changedFields) ? existing.changedFields : [];
    var changedFields = existing
      ? (existingFields.length && inputFields.length
        ? existingFields.concat(inputFields).filter(function (field, index, list) { return list.indexOf(field) === index; })
        : [])
      : inputFields;
    var operationId = String(
      input.operationId ||
      sameContent && existing.operationId ||
      createOperationId(scope, timestamp, input.revision)
    );
    snapshot.syncOperationId = operationId;
    var baseFieldSignatures = existing && existing.baseFieldSignatures
      ? clone(existing.baseFieldSignatures) || {}
      : clone(input.baseFieldSignatures) || {};
    var baseFieldValues = existing && existing.baseFieldValues
      ? stripHeavyData(clone(existing.baseFieldValues)) || {}
      : stripHeavyData(clone(input.baseFieldValues)) || {};
    if (existing && existingFields.length && inputFields.length) {
      inputFields.forEach(function (field) {
        if (baseFieldSignatures[field] === undefined && input.baseFieldSignatures) {
          baseFieldSignatures[field] = String(input.baseFieldSignatures[field] || '');
        }
      });
    }
    var entry = {
      id: existing && existing.id || scope + ':' + timestamp,
      operationId: operationId,
      roomCode: String(input.roomCode),
      uid: String(input.uid),
      characterId: String(input.characterId),
      campaignKey: String(input.campaignKey || ''),
      revision: Math.max(0, Number(input.revision) || 0),
      reason: String(input.reason || 'edit').slice(0, 30),
      queuedAt: existing && existing.queuedAt || timestamp,
      updatedAt: timestamp,
      attempts: Math.max(0, Number(existing && existing.attempts) || 0),
      baseRoomRevision: existing ? Math.max(0, Number(existing.baseRoomRevision) || 0) : Math.max(0, Number(input.baseRoomRevision) || 0),
      baseRoomSignature: existing ? String(existing.baseRoomSignature || '') : String(input.baseRoomSignature || ''),
      changedFields: changedFields,
      baseFieldSignatures: baseFieldSignatures,
      baseFieldValues: baseFieldValues,
      inventoryOperations: changedFields.length && changedFields.every(function (field) {
        return field === 'inventoryItems' || field === 'equipItems';
      }) && changedFields.every(function (field) {
        return Object.prototype.hasOwnProperty.call(baseFieldValues, field);
      })
        ? createInventoryOperations(baseFieldValues, snapshot, changedFields)
        : null,
      snapshot: snapshot
    };
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    rows.push(entry);
    rows = rows.slice(-MAX_ENTRIES);
    return { ok:write(rows), entry:entry, size:rows.length };
  }

  function peek(scope) {
    var key = scopeKey(scope);
    return read().filter(function (row) { return scopeKey(row) === key; })[0] || null;
  }

  function markAttempt(id) {
    var rows = read(), changed = false;
    rows.forEach(function (row) {
      if (String(row.id) === String(id)) {
        row.attempts = Math.max(0, Number(row.attempts) || 0) + 1;
        row.lastAttemptAt = Date.now();
        changed = true;
      }
    });
    return !changed || write(rows);
  }

  function remove(id) {
    var rows = read(), next = rows.filter(function (row) { return String(row.id) !== String(id); });
    return next.length === rows.length || write(next);
  }

  function rebase(id, baseRoomSignature, baseRoomRevision, roomCharacter) {
    var rows = read(), changed = false;
    rows.forEach(function (row) {
      if (String(row.id) === String(id)) {
        row.baseRoomSignature = String(baseRoomSignature || '');
        row.baseRoomRevision = Math.max(0, Number(baseRoomRevision) || 0);
        if (roomCharacter && Array.isArray(row.changedFields) && row.changedFields.length) {
          row.baseFieldValues = {};
          row.baseFieldSignatures = {};
          row.changedFields.forEach(function (field) {
            row.baseFieldValues[field] = stripHeavyData(clone(roomCharacter[field]));
            row.baseFieldSignatures[field] = fieldSignature(roomCharacter[field]);
          });
          row.inventoryOperations = createInventoryOperations(row.baseFieldValues, row.snapshot, row.changedFields);
        }
        changed = true;
      }
    });
    return !changed || write(rows);
  }

  function mergeChangedFields(id, roomCharacter) {
    var rows = read(), mergedEntry = null, conflictField = '';
    rows.forEach(function (row) {
      if (String(row.id) !== String(id) || !Array.isArray(row.changedFields) || !row.changedFields.length) return;
      var baseFields = row.baseFieldSignatures || {};
      row.changedFields.some(function (field) {
        if (String(baseFields[field] || '') !== fieldSignature(roomCharacter && roomCharacter[field])) {
          conflictField = field;
          return true;
        }
        return false;
      });
      if (conflictField) return;
      var merged = clone(roomCharacter) || {};
      row.changedFields.forEach(function (field) {
        merged[field] = stripHeavyData(clone(row.snapshot && row.snapshot[field]));
      });
      merged.revision = Math.max(
        Math.max(0, Number(roomCharacter && roomCharacter.revision) || 0) + 1,
        Math.max(0, Number(row.snapshot && row.snapshot.revision) || 0)
      );
      merged.syncOperationId = row.operationId || row.snapshot && row.snapshot.syncOperationId || '';
      row.snapshot = merged;
      row.revision = merged.revision;
      row.baseRoomRevision = Math.max(0, Number(roomCharacter && roomCharacter.revision) || 0);
      row.baseRoomSignature = contentSignature(roomCharacter || {});
      row.baseFieldSignatures = {};
      row.changedFields.forEach(function (field) {
        row.baseFieldSignatures[field] = fieldSignature(roomCharacter && roomCharacter[field]);
      });
      mergedEntry = row;
    });
    if (conflictField) return { ok:false, conflict:true, field:conflictField };
    if (!mergedEntry) return { ok:false, error:'entry-not-mergeable' };
    return { ok:write(rows), entry:mergedEntry };
  }

  function clearScope(scope) {
    var key = scopeKey(scope), rows = read();
    return write(rows.filter(function (row) { return scopeKey(row) !== key; }));
  }

  function matchesApplied(entry, roomCharacter) {
    if (!entry || !entry.snapshot || !roomCharacter) return false;
    var operationId = String(entry.operationId || entry.snapshot.syncOperationId || '');
    var appliedOperationId = String(roomCharacter.syncOperationId || '');
    if (operationId && appliedOperationId && operationId === appliedOperationId) return true;
    return contentSignature(entry.snapshot) === contentSignature(roomCharacter);
  }

  function readConflicts() {
    try {
      var rows = JSON.parse(root.localStorage && root.localStorage.getItem(CONFLICTS_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(function (row) {
        return row && row.id && row.localSnapshot && row.roomSnapshot;
      }) : [];
    } catch (error) {
      return [];
    }
  }

  function recordConflict(entry, roomCharacter) {
    if (!entry || !entry.snapshot || !roomCharacter) return false;
    var timestamp = Date.now();
    var fingerprint = [
      scopeKey(entry),
      String(entry.operationId || entry.snapshot.syncOperationId || ''),
      contentSignature(stripHeavyData(roomCharacter))
    ].join('|');
    var record = {
      id: scopeKey(entry) + ':' + timestamp,
      fingerprint: fingerprint,
      createdAt: timestamp,
      roomCode: String(entry.roomCode || ''),
      uid: String(entry.uid || ''),
      characterId: String(entry.characterId || ''),
      campaignKey: String(entry.campaignKey || ''),
      reason: String(entry.reason || 'edit').slice(0, 30),
      localRevision: Math.max(0, Number(entry.snapshot.revision) || 0),
      roomRevision: Math.max(0, Number(roomCharacter.revision) || 0),
      localSnapshot: stripHeavyData(entry.snapshot),
      roomSnapshot: stripHeavyData(roomCharacter)
    };
    try {
      if (!root.localStorage) return false;
      var rows = readConflicts();
      if (rows.some(function (row) { return String(row.fingerprint || '') === fingerprint; })) return true;
      rows.push(record);
      root.localStorage.setItem(CONFLICTS_KEY, JSON.stringify(rows.slice(-MAX_CONFLICTS)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function diagnostics() {
    return read().map(function (row) {
      return {
        id: row.id,
        operationId: row.operationId || row.snapshot && row.snapshot.syncOperationId || '',
        roomCode: row.roomCode,
        uid: row.uid,
        characterId: row.characterId,
        campaignKey: row.campaignKey,
        revision: row.revision,
        reason: row.reason,
        queuedAt: row.queuedAt,
        updatedAt: row.updatedAt,
        attempts: row.attempts,
        changedFields: Array.isArray(row.changedFields) ? row.changedFields.slice() : [],
        inventoryOperationCount: Array.isArray(row.inventoryOperations) ? row.inventoryOperations.length : 0
      };
    });
  }

  return {
    config: { storageKey:STORAGE_KEY, conflictsKey:CONFLICTS_KEY, maxEntries:MAX_ENTRIES, maxConflicts:MAX_CONFLICTS },
    contentSignature: contentSignature,
    fieldSignature: fieldSignature,
    createInventoryOperations: createInventoryOperations,
    applyInventoryOperations: applyInventoryOperations,
    stripHeavyData: stripHeavyData,
    read: read,
    enqueue: enqueue,
    peek: peek,
    markAttempt: markAttempt,
    remove: remove,
    rebase: rebase,
    mergeChangedFields: mergeChangedFields,
    clearScope: clearScope,
    matchesApplied: matchesApplied,
    readConflicts: readConflicts,
    recordConflict: recordConflict,
    diagnostics: diagnostics
  };
});
