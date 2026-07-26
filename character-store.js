(function (root, factory) {
  'use strict';
  var api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaCharacterStore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var DB_NAME = 'zargota_chars';
  var DB_VERSION = 1;
  var STORE_NAME = 'data';
  var COLLECTION_KEY = 'grimoire_chars';
  var BACKUP_KEY = 'grimoire_chars_migration_backup_v1';
  var BACKUP_MARKER_KEY = 'zargota_character_migration_backup_v1_created_at';
  var RESTORE_SAFETY_KEY = 'grimoire_chars_before_migration_restore_v1';
  var SEED_VERSION_KEY = 'zargota_starter_heroes_seed_version';
  var TOMBSTONES_KEY = 'zargota_starter_hero_tombstones_v1';
  var TEMPLATE_URL = 'data/campaign-heroes.v1.json';
  var LEGACY_CAMPAIGN_KEYS = {
    '1776627463516': 'evan',
    '1776626039651': 'melissa',
    '1776463717210': 'esteros',
    '1778221131899': 'vrotik',
    '1778221143711': 'lin-yin'
  };
  var loadPromise = null;
  var writeQueue = Promise.resolve();
  var savedSignatures = Object.create(null);

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return null; }
  }

  function parseCollection(value) {
    if (Array.isArray(value)) return clone(value) || [];
    if (!value) return [];
    try {
      var parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function storageGet(key) {
    try { return root.localStorage ? root.localStorage.getItem(key) : null; }
    catch (error) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      var request;
      try { request = root.indexedDB.open(DB_NAME, DB_VERSION); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = function (event) { resolve(event.target.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB open failed')); };
    });
  }

  function readIdb(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var settled = false;
        function finish(value) {
          if (settled) return;
          settled = true;
          try { db.close(); } catch (error) {}
          resolve(value);
        }
        try {
          var transaction = db.transaction(STORE_NAME, 'readonly');
          var request = transaction.objectStore(STORE_NAME).get(key);
          request.onsuccess = function () { finish(request.result == null ? null : request.result); };
          request.onerror = function () { finish(null); };
          transaction.onabort = function () { finish(null); };
        } catch (error) {
          finish(null);
        }
      });
    }).catch(function () { return null; });
  }

  function writeIdb(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var settled = false;
        function finish(ok) {
          if (settled) return;
          settled = true;
          try { db.close(); } catch (error) {}
          resolve(!!ok);
        }
        try {
          var transaction = db.transaction(STORE_NAME, 'readwrite');
          transaction.objectStore(STORE_NAME).put(value, key);
          transaction.oncomplete = function () { finish(true); };
          transaction.onerror = function () { finish(false); };
          transaction.onabort = function () { finish(false); };
        } catch (error) {
          finish(false);
        }
      });
    }).catch(function () { return false; });
  }

  function recordTimestamp(record) {
    return Math.max(0, Number(record && record._updatedAt) || 0);
  }

  function characterContentSignature(character) {
    var copy = clone(character) || {};
    delete copy._updatedAt;
    delete copy.revision;
    return JSON.stringify(copy);
  }

  function rememberCollection(characters) {
    savedSignatures = Object.create(null);
    (Array.isArray(characters) ? characters : []).forEach(function (character) {
      if (!character || character.id === undefined || character.id === null) return;
      savedSignatures[String(character.id)] = characterContentSignature(character);
    });
  }

  function prepareCollectionForSave(characters, options) {
    options = options || {};
    var timestamp = Math.max(1, Number(options.now) || Date.now());
    var changedIds = [];
    var seen = Object.create(null);
    (Array.isArray(characters) ? characters : []).forEach(function (character) {
      if (!character || character.id === undefined || character.id === null) return;
      var id = String(character.id);
      var signature = characterContentSignature(character);
      seen[id] = true;
      if (savedSignatures[id] !== signature) {
        if (!options.preserveRevision) {
          character.revision = Math.max(0, Number(character.revision) || 0) + 1;
        } else if (!isFinite(Number(character.revision))) {
          character.revision = 0;
        }
        character._updatedAt = timestamp;
        changedIds.push(id);
      }
      savedSignatures[id] = signature;
    });
    Object.keys(savedSignatures).forEach(function (id) {
      if (!seen[id]) delete savedSignatures[id];
    });
    return { changedIds: changedIds, timestamp: timestamp };
  }

  function mergeStoredCollections(localCharacters, idbCharacters) {
    var byId = Object.create(null);
    var order = [];
    function consider(record, fromIdb) {
      if (!record || record.id === undefined || record.id === null) return;
      var key = String(record.id);
      if (!byId[key]) {
        byId[key] = record;
        order.push(key);
        return;
      }
      var previous = byId[key];
      var previousTimestamp = recordTimestamp(previous);
      var currentTimestamp = recordTimestamp(record);
      if (currentTimestamp > previousTimestamp || (currentTimestamp === previousTimestamp && fromIdb)) {
        byId[key] = record;
      }
    }
    parseCollection(localCharacters).forEach(function (record) { consider(record, false); });
    parseCollection(idbCharacters).forEach(function (record) { consider(record, true); });
    return order.map(function (key) { return byId[key]; });
  }

  function readTombstones() {
    var raw = storageGet(TOMBSTONES_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function campaignKeyFor(character) {
    if (!character) return '';
    return String(character.campaignKey || LEGACY_CAMPAIGN_KEYS[String(character.id)] || '');
  }

  function mergeStarterHeroes(existingCharacters, templateBundle, tombstones, timestamp) {
    var result = parseCollection(existingCharacters);
    var templates = templateBundle && Array.isArray(templateBundle.heroes) ? templateBundle.heroes : [];
    var version = String(templateBundle && templateBundle.templateVersion || '');
    var deleted = tombstones && typeof tombstones === 'object' ? tombstones : {};
    var knownKeys = Object.create(null);
    var knownIds = Object.create(null);
    var added = [];

    result.forEach(function (character) {
      var key = campaignKeyFor(character);
      if (key) knownKeys[key] = true;
      if (character && character.id !== undefined && character.id !== null) knownIds[String(character.id)] = true;
    });

    templates.forEach(function (template) {
      var key = campaignKeyFor(template);
      var id = template && template.id !== undefined && template.id !== null ? String(template.id) : '';
      if (!key || deleted[key] || knownKeys[key] || (id && knownIds[id])) return;
      var character = clone(template);
      if (!character) return;
      character.campaignKey = key;
      character.starterTemplateVersion = version;
      if (!isFinite(Number(character.revision))) character.revision = 0;
      character._updatedAt = Math.max(1, Number(timestamp) || Date.now());
      result.push(character);
      knownKeys[key] = true;
      if (id) knownIds[id] = true;
      added.push(key);
    });

    return { characters: result, added: added, templateVersion: version };
  }

  function loadTemplateBundle(fetchImpl) {
    var fetcher = fetchImpl || root.fetch;
    if (typeof fetcher !== 'function') return Promise.reject(new Error('Fetch unavailable'));
    return fetcher(TEMPLATE_URL, { cache: 'no-store' }).then(function (response) {
      if (!response || response.ok === false) throw new Error('Starter heroes HTTP error');
      return typeof response.json === 'function' ? response.json() : response;
    }).then(function (bundle) {
      if (!bundle || !Array.isArray(bundle.heroes) || bundle.heroes.length !== 5) {
        throw new Error('Starter heroes bundle is invalid');
      }
      return bundle;
    });
  }

  function ensureMigrationBackup(localRaw, idbRaw) {
    return Promise.all([readIdb(BACKUP_KEY), Promise.resolve(storageGet(BACKUP_KEY))]).then(function (existing) {
      if (existing[0] || existing[1]) return { ok: true, existing: true };
      var hasData = !!localRaw || !!idbRaw;
      var createdAt = Date.now();
      var payload = {
        schemaVersion: 1,
        createdAt: createdAt,
        localStorage: localRaw || null,
        indexedDB: idbRaw || null
      };
      var lsOk = localRaw ? storageSet(BACKUP_KEY, localRaw) : true;
      return writeIdb(BACKUP_KEY, payload).then(function (idbOk) {
        var ok = !hasData || idbOk || lsOk;
        if (ok) storageSet(BACKUP_MARKER_KEY, String(createdAt));
        return { ok: ok, existing: false, localStorage: lsOk, indexedDB: idbOk };
      });
    });
  }

  function getMigrationBackup() {
    return Promise.all([readIdb(BACKUP_KEY), Promise.resolve(storageGet(BACKUP_KEY))]).then(function (stored) {
      var idbBackup = stored[0], localBackup = stored[1];
      var payload = idbBackup && typeof idbBackup === 'object' && !Array.isArray(idbBackup) ? idbBackup : {};
      var localCharacters = parseCollection(payload.localStorage || localBackup);
      var idbCharacters = parseCollection(payload.indexedDB || (typeof idbBackup === 'string' ? idbBackup : null));
      var characters = mergeStoredCollections(localCharacters, idbCharacters);
      return {
        exists: !!characters.length,
        createdAt: Math.max(0, Number(payload.createdAt) || Number(storageGet(BACKUP_MARKER_KEY)) || 0),
        characters: characters,
        sources: { localStorage: !!(payload.localStorage || localBackup), indexedDB: !!(payload.indexedDB || idbBackup) }
      };
    });
  }

  function restoreMigrationBackup() {
    return getMigrationBackup().then(function (backup) {
      if (!backup.exists) return { ok: false, error: new Error('Migration backup not found') };
      var currentLocalRaw = storageGet(COLLECTION_KEY);
      return readIdb(COLLECTION_KEY).then(function (currentIdbRaw) {
        var createdAt = Date.now();
        var safetyPayload = {
          schemaVersion: 1,
          createdAt: createdAt,
          localStorage: currentLocalRaw || null,
          indexedDB: currentIdbRaw || null
        };
        return Promise.all([readIdb(RESTORE_SAFETY_KEY), Promise.resolve(storageGet(RESTORE_SAFETY_KEY))]).then(function (existingSafety) {
          var safetyLocalOk = existingSafety[1] ? true : (currentLocalRaw ? storageSet(RESTORE_SAFETY_KEY, currentLocalRaw) : true);
          var safetyWrite = existingSafety[0] ? Promise.resolve(true) : writeIdb(RESTORE_SAFETY_KEY, safetyPayload);
          return safetyWrite.then(function (safetyIdbOk) {
          if ((currentLocalRaw || currentIdbRaw) && !safetyLocalOk && !safetyIdbOk) {
            return { ok: false, error: new Error('Could not back up current characters before restore') };
          }
          return persistCollection(backup.characters).then(function (saved) {
            if (!saved.ok) return { ok: false, error: saved.error || new Error('Could not restore migration backup'), storage: saved };
            rememberCollection(backup.characters);
            return {
              ok: true,
              characters: clone(backup.characters) || [],
              restoredFrom: backup.createdAt,
              safetyBackupKey: RESTORE_SAFETY_KEY,
              storage: saved
            };
          });
          });
        });
      });
    });
  }

  function persistCollection(characters) {
    var json;
    try { json = JSON.stringify(Array.isArray(characters) ? characters : []); }
    catch (error) { return Promise.resolve({ ok: false, indexedDB: false, localStorage: false, error: error }); }
    writeQueue = writeQueue.catch(function () { return null; }).then(function () {
      return writeIdb(COLLECTION_KEY, json).then(function (idbOk) {
        var lsOk = storageSet(COLLECTION_KEY, json);
        return { ok: idbOk || lsOk, indexedDB: idbOk, localStorage: lsOk };
      });
    });
    return writeQueue;
  }

  function persistCollectionBestEffort(characters) {
    var json;
    try { json = JSON.stringify(Array.isArray(characters) ? characters : []); }
    catch (error) { return { ok: false, indexedDB: false, localStorage: false, error: error }; }
    var lsOk = storageSet(COLLECTION_KEY, json);
    writeQueue = writeQueue.catch(function () { return null; }).then(function () {
      return writeIdb(COLLECTION_KEY, json);
    });
    return { ok: lsOk, indexedDB: 'pending', localStorage: lsOk };
  }

  function readConfirmedCharacter(characterId, campaignKey) {
    var requestedId = characterId === undefined || characterId === null ? '' : String(characterId);
    var requestedKey = String(campaignKey || '');
    return writeQueue.catch(function () { return null; }).then(function () {
      return Promise.all([readIdb(COLLECTION_KEY), Promise.resolve(storageGet(COLLECTION_KEY))]);
    }).then(function (stored) {
      var merged = mergeStoredCollections(stored[1], stored[0]);
      var character = null;
      if (requestedId) {
        character = merged.filter(function (candidate) {
          return candidate && candidate.id !== undefined && candidate.id !== null &&
            String(candidate.id) === requestedId;
        })[0] || null;
      }
      if (!character && requestedKey) {
        character = merged.filter(function (candidate) {
          return campaignKeyFor(candidate) === requestedKey;
        })[0] || null;
      }
      return clone(character);
    });
  }

  function loadAndSeed(fallbackCharacters, options) {
    options = options || {};
    if (loadPromise && !options.force) return loadPromise;
    var localRaw = storageGet(COLLECTION_KEY);
    var operation = readIdb(COLLECTION_KEY).then(function (idbRaw) {
      var localCharacters = localRaw ? parseCollection(localRaw) : parseCollection(fallbackCharacters);
      var merged = mergeStoredCollections(localCharacters, idbRaw);
      var tombstones = readTombstones();
      merged = merged.filter(function (character) {
        var key = campaignKeyFor(character);
        return !key || !tombstones[key];
      });
      var storesNeedReconcile = JSON.stringify(merged) !== JSON.stringify(localCharacters);
      return ensureMigrationBackup(localRaw, idbRaw).then(function (backup) {
        if (!backup.ok) {
          return { characters: merged, added: [], changed: false, backup: backup, error: 'migration-backup-failed' };
        }
        return loadTemplateBundle(options.fetch).then(function (bundle) {
          var seeded = mergeStarterHeroes(merged, bundle, tombstones, options.now || Date.now());
          storageSet(SEED_VERSION_KEY, seeded.templateVersion);
          if (!seeded.added.length && !storesNeedReconcile) {
            return { characters: seeded.characters, added: [], changed: false, backup: backup, templateVersion: seeded.templateVersion };
          }
          return persistCollection(seeded.characters).then(function (saved) {
            return {
              characters: seeded.characters,
              added: seeded.added,
              changed: true,
              backup: backup,
              storage: saved,
              templateVersion: seeded.templateVersion
            };
          });
        }).catch(function (error) {
          return { characters: merged, added: [], changed: false, backup: backup, error: error && error.message || 'starter-load-failed' };
        });
      });
    });
    loadPromise = operation.then(function (result) {
      loadPromise = null;
      return result;
    }, function (error) {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  }

  function markStarterHeroDeleted(character) {
    var key = campaignKeyFor(character);
    if (!key) return false;
    var tombstones = readTombstones();
    tombstones[key] = { deletedAt: Date.now(), characterId: String(character && character.id || '') };
    return storageSet(TOMBSTONES_KEY, JSON.stringify(tombstones));
  }

  return {
    config: {
      collectionKey: COLLECTION_KEY,
      backupKey: BACKUP_KEY,
      restoreSafetyKey: RESTORE_SAFETY_KEY,
      seedVersionKey: SEED_VERSION_KEY,
      tombstonesKey: TOMBSTONES_KEY,
      templateUrl: TEMPLATE_URL
    },
    campaignKeyFor: campaignKeyFor,
    characterContentSignature: characterContentSignature,
    mergeStoredCollections: mergeStoredCollections,
    mergeStarterHeroes: mergeStarterHeroes,
    rememberCollection: rememberCollection,
    prepareCollectionForSave: prepareCollectionForSave,
    ensureMigrationBackup: ensureMigrationBackup,
    getMigrationBackup: getMigrationBackup,
    restoreMigrationBackup: restoreMigrationBackup,
    loadAndSeed: loadAndSeed,
    markStarterHeroDeleted: markStarterHeroDeleted,
    persistCollection: persistCollection,
    persistCollectionBestEffort: persistCollectionBestEffort,
    readConfirmedCharacter: readConfirmedCharacter
  };
});
