(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaGameplayOutbox = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var STORAGE_KEY = 'zargota_gameplay_operation_outbox_v1';
  var MAX_ENTRIES = 24;
  var MAX_ATTEMPTS = 8;
  var MAX_OPERATION_BYTES = 380000;
  var MAX_TOTAL_BYTES = 950000;
  var TYPES = ['gm-delivery','ability-request'];

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return null; }
  }

  function byteSize(value) {
    try { return JSON.stringify(value == null ? null : value).length; }
    catch (error) { return MAX_OPERATION_BYTES + 1; }
  }

  function safeId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
  }

  function read() {
    try {
      var rows = JSON.parse(root.localStorage && root.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(function (row) {
        return row && TYPES.indexOf(row.type) >= 0 && row.operationId && row.roomCode && row.uid && row.role && row.payload;
      }) : [];
    } catch (error) {
      return [];
    }
  }

  function write(rows) {
    rows = Array.isArray(rows) ? rows.slice(-MAX_ENTRIES) : [];
    if (byteSize(rows) > MAX_TOTAL_BYTES) return false;
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      return true;
    } catch (error) {
      return false;
    }
  }

  function enqueue(input) {
    input = clone(input) || {};
    input.type = TYPES.indexOf(input.type) >= 0 ? input.type : '';
    input.operationId = safeId(input.operationId);
    input.roomCode = String(input.roomCode || '').slice(0, 12);
    input.uid = String(input.uid || '').slice(0, 160);
    input.role = ['master','player'].indexOf(input.role) >= 0 ? input.role : '';
    input.tabId = safeId(input.tabId).slice(0, 120);
    if (!input.type || !input.operationId || !input.roomCode || !input.uid || !input.role || !input.payload) {
      return {ok:false,error:'invalid-entry',size:read().length};
    }
    if (byteSize(input.payload) > MAX_OPERATION_BYTES) {
      return {ok:false,error:'operation-too-large',size:read().length};
    }
    var rows = read();
    var existing = rows.filter(function (row) {
      return String(row.operationId) === input.operationId;
    })[0];
    if (existing) return {ok:true,duplicate:true,entry:existing,size:rows.length};
    if (rows.length >= MAX_ENTRIES) return {ok:false,error:'queue-full',size:rows.length};
    var stamp = Math.max(1, Number(input.createdAt) || Date.now());
    var entry = {
      id: input.type + ':' + input.operationId,
      operationId: input.operationId,
      type: input.type,
      roomCode: input.roomCode,
      uid: input.uid,
      role: input.role,
      tabId: input.tabId,
      payload: input.payload,
      createdAt: stamp,
      updatedAt: stamp,
      attempts: 0,
      lastAttemptAt: 0,
      lastError: ''
    };
    rows.push(entry);
    if (!write(rows)) {
      return {ok:false,error:byteSize(rows) > MAX_TOTAL_BYTES ? 'queue-size-limit' : 'storage-error',size:rows.length - 1};
    }
    return {ok:true,entry:entry,size:rows.length};
  }

  function remove(operationId) {
    operationId = safeId(operationId);
    var rows = read(), next = rows.filter(function (row) {
      return String(row.operationId) !== operationId;
    });
    return next.length === rows.length || write(next);
  }

  function markAttempt(operationId) {
    operationId = safeId(operationId);
    var rows = read(), changed = false;
    rows.forEach(function (row) {
      if (String(row.operationId) !== operationId) return;
      row.attempts = Math.max(0, Number(row.attempts) || 0) + 1;
      row.lastAttemptAt = Date.now();
      row.updatedAt = row.lastAttemptAt;
      changed = true;
    });
    return !changed || write(rows);
  }

  function markError(operationId, error) {
    operationId = safeId(operationId);
    var rows = read(), changed = false;
    rows.forEach(function (row) {
      if (String(row.operationId) !== operationId) return;
      row.lastError = String(error && (error.message || error) || '').slice(0, 300);
      row.updatedAt = Date.now();
      changed = true;
    });
    return !changed || write(rows);
  }

  function forSession(scope) {
    var roomCode = String(scope && scope.roomCode || '');
    var uid = String(scope && scope.uid || '');
    var role = String(scope && scope.role || '');
    return read().filter(function (row) {
      return row.roomCode === roomCode && row.uid === uid && row.role === role && Number(row.attempts || 0) < MAX_ATTEMPTS;
    }).sort(function (a, b) {
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
  }

  function diagnostics() {
    return read().map(function (row) {
      return {
        operationId: row.operationId,
        type: row.type,
        roomCode: row.roomCode,
        uid: row.uid,
        role: row.role,
        tabId: row.tabId || '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        attempts: row.attempts,
        lastAttemptAt: row.lastAttemptAt,
        lastError: row.lastError,
        bytes: byteSize(row.payload)
      };
    });
  }

  return {
    config: {
      storageKey: STORAGE_KEY,
      maxEntries: MAX_ENTRIES,
      maxAttempts: MAX_ATTEMPTS,
      maxOperationBytes: MAX_OPERATION_BYTES,
      maxTotalBytes: MAX_TOTAL_BYTES
    },
    read: read,
    enqueue: enqueue,
    remove: remove,
    markAttempt: markAttempt,
    markError: markError,
    forSession: forSession,
    diagnostics: diagnostics
  };
});
