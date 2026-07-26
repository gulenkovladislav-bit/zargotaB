(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaSyncOutbox = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var STORAGE_KEY = 'zargota_character_sync_outbox_v1';
  var MAX_ENTRIES = 20;

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
    var operationId = String(
      input.operationId ||
      sameContent && existing.operationId ||
      createOperationId(scope, timestamp, input.revision)
    );
    snapshot.syncOperationId = operationId;
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

  function rebase(id, baseRoomSignature, baseRoomRevision) {
    var rows = read(), changed = false;
    rows.forEach(function (row) {
      if (String(row.id) === String(id)) {
        row.baseRoomSignature = String(baseRoomSignature || '');
        row.baseRoomRevision = Math.max(0, Number(baseRoomRevision) || 0);
        changed = true;
      }
    });
    return !changed || write(rows);
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
        attempts: row.attempts
      };
    });
  }

  return {
    config: { storageKey:STORAGE_KEY, maxEntries:MAX_ENTRIES },
    contentSignature: contentSignature,
    stripHeavyData: stripHeavyData,
    read: read,
    enqueue: enqueue,
    peek: peek,
    markAttempt: markAttempt,
    remove: remove,
    rebase: rebase,
    clearScope: clearScope,
    matchesApplied: matchesApplied,
    diagnostics: diagnostics
  };
});
