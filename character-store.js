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

  function stableTextHash(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function stableInventoryItemId(characterId, kind, index, item) {
    if (item && item.itemId != null && String(item.itemId).trim()) return String(item.itemId).trim();
    var characterPart = String(characterId == null ? 'character' : characterId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'character';
    var source = clone(item) || item || '';
    if (source && typeof source === 'object') delete source.itemId;
    try { source = JSON.stringify(source); } catch (error) { source = String(source); }
    return 'zg-item-' + characterPart + '-' + (kind === 'equip' ? 'e' : 'i') + '-' + stableTextHash(String(index) + '|' + source);
  }

  function collectionValues(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === 'object') return Object.keys(value).map(function (key) { return value[key]; });
    if (typeof value === 'string' && value.trim()) return [value];
    return [];
  }

  function legacyInventoryItems(value) {
    return String(value == null ? '' : value).split(/\r?\n|;/).map(function (row) {
      var text = row.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim();
      if (!text) return null;
      var quantity = 1;
      var leading = text.match(/^(\d+)\s*[xх×]\s*(.+)$/i);
      var trailing = text.match(/^(.+?)\s*[xх×]\s*(\d+)$/i);
      if (leading) {
        quantity = Math.max(1, Number(leading[1]) || 1);
        text = leading[2].trim();
      } else if (trailing) {
        quantity = Math.max(1, Number(trailing[2]) || 1);
        text = trailing[1].trim();
      }
      return text ? { name:text, qty:quantity, icon:'📦', description:'', migratedFrom:'inventory-text' } : null;
    }).filter(Boolean);
  }

  function normalizeInventoryList(characterId, kind, value) {
    return collectionValues(value).map(function (entry, index) {
      var item;
      if (typeof entry === 'string') item = { name:entry.trim(), icon:kind === 'equip' ? '🗃️' : '📦', description:'' };
      else item = entry && typeof entry === 'object' ? entry : { name:String(entry == null ? '' : entry) };
      if (!item.name && item.text) item.name = String(item.text);
      if (!item.icon) item.icon = kind === 'equip' ? '🗃️' : '📦';
      if (item.description === undefined) item.description = '';
      if (kind === 'inventory') item.qty = Math.max(1, Number(item.qty) || 1);
      item.itemId = stableInventoryItemId(characterId, kind, index, item);
      return item;
    }).filter(function (item) { return !!(item.name || item.description || item.image || item.icon); });
  }

  function normalizeCharacterInventory(character) {
    if (!character || typeof character !== 'object') return { changed:false, migratedLegacyText:false };
    var before;
    try { before = JSON.stringify({ inventoryItems:character.inventoryItems, equipItems:character.equipItems }); }
    catch (error) { before = ''; }
    var inventory = collectionValues(character.inventoryItems);
    var migratedLegacyText = false;
    if (!inventory.length && typeof character.inventory === 'string' && character.inventory.trim()) {
      inventory = legacyInventoryItems(character.inventory);
      migratedLegacyText = inventory.length > 0;
    }
    character.inventoryItems = normalizeInventoryList(character.id, 'inventory', inventory);
    var normalizedEquipment = normalizeInventoryList(character.id, 'equip', character.equipItems);
    var collapsedEquipmentCopies = 0;
    character.equipItems = normalizedEquipment.filter(function (equipment) {
      var source = character.inventoryItems.filter(function (item) {
        return item && equipment && item.itemId === equipment.itemId;
      })[0] || (equipment && equipment._sourceInventoryIndex != null
        ? character.inventoryItems[Number(equipment._sourceInventoryIndex)]
        : null);
      if (!source) return true;
      ['name','icon','description','image','type','category','rarity','damage','damageFormula','damageType','acBonus','weight'].forEach(function (field) {
        if ((source[field] == null || source[field] === '') && equipment[field] != null) source[field] = equipment[field];
      });
      source.equipped = equipment.equipped !== false;
      if (equipment.slot) source.slot = equipment.slot;
      collapsedEquipmentCopies += 1;
      return false;
    });
    var after;
    try { after = JSON.stringify({ inventoryItems:character.inventoryItems, equipItems:character.equipItems }); }
    catch (error2) { after = before; }
    return { changed:before !== after, migratedLegacyText:migratedLegacyText, collapsedEquipmentCopies:collapsedEquipmentCopies };
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
    var removedIds = [];
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
      if (!seen[id]) {
        removedIds.push(id);
        delete savedSignatures[id];
      }
    });
    return { changedIds: changedIds, removedIds: removedIds, timestamp: timestamp };
  }

  function markCollectionSaveFailed(characterIds) {
    (Array.isArray(characterIds) ? characterIds : []).forEach(function (id) {
      delete savedSignatures[String(id)];
    });
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

  function upsertCharacter(collection, characterId, patch) {
    var result = parseCollection(collection);
    var id = String(characterId);
    var update = clone(patch) || {};
    var found = false;
    result = result.map(function (character) {
      if (!character || character.id === undefined || character.id === null || String(character.id) !== id) return character;
      found = true;
      return Object.assign({}, character, update, { id:character.id });
    });
    if (!found) {
      if (update.id === undefined || update.id === null) update.id = characterId;
      result.push(update);
    }
    return result;
  }

  function writeCharacterIdb(characterId, patch, fallbackCharacters, localRaw) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var settled = false;
        var savedCharacters = null;
        function finish(result) {
          if (settled) return;
          settled = true;
          try { db.close(); } catch (error) {}
          resolve(result);
        }
        try {
          var transaction = db.transaction(STORE_NAME, 'readwrite');
          var store = transaction.objectStore(STORE_NAME);
          var request = store.get(COLLECTION_KEY);
          request.onsuccess = function () {
            var fallbackMerged = mergeStoredCollections(fallbackCharacters, localRaw);
            var current = mergeStoredCollections(fallbackMerged, request.result);
            savedCharacters = upsertCharacter(current, characterId, patch);
            store.put(JSON.stringify(savedCharacters), COLLECTION_KEY);
          };
          request.onerror = function () {
            try { transaction.abort(); } catch (error) {}
            finish({ ok:false, error:request.error || new Error('IndexedDB character read failed') });
          };
          transaction.oncomplete = function () { finish({ ok:true, characters:savedCharacters }); };
          transaction.onerror = function () { finish({ ok:false, error:transaction.error || new Error('IndexedDB character write failed') }); };
          transaction.onabort = function () { finish({ ok:false, error:transaction.error || new Error('IndexedDB character write aborted') }); };
        } catch (error) {
          finish({ ok:false, error:error });
        }
      });
    }).catch(function (error) {
      return { ok:false, error:error };
    });
  }

  function saveCharacter(characterId, patch, fallbackCharacters) {
    if (characterId === undefined || characterId === null || !patch || typeof patch !== 'object') {
      return Promise.resolve({ ok:false, indexedDB:false, localStorage:false, error:new Error('Invalid character update') });
    }
    var safePatch = clone(patch);
    if (!safePatch) {
      return Promise.resolve({ ok:false, indexedDB:false, localStorage:false, error:new Error('Character update is not serializable') });
    }
    writeQueue = writeQueue.catch(function () { return null; }).then(function () {
      var localRaw = storageGet(COLLECTION_KEY);
      return writeCharacterIdb(characterId, safePatch, fallbackCharacters, localRaw).then(function (idbResult) {
        var characters = idbResult.ok
          ? idbResult.characters
          : upsertCharacter(mergeStoredCollections(fallbackCharacters, localRaw), characterId, safePatch);
        var json;
        try { json = JSON.stringify(characters); }
        catch (error) {
          return { ok:false, indexedDB:!!idbResult.ok, localStorage:false, error:error };
        }
        var lsOk = storageSet(COLLECTION_KEY, json);
        return {
          ok: !!idbResult.ok || lsOk,
          indexedDB: !!idbResult.ok,
          localStorage: lsOk,
          character: clone(characters.filter(function (candidate) {
            return candidate && candidate.id !== undefined && candidate.id !== null &&
              String(candidate.id) === String(characterId);
          })[0] || null),
          error: idbResult.ok || lsOk ? null : idbResult.error || new Error('Character save failed')
        };
      });
    });
    return writeQueue;
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
    stableInventoryItemId: stableInventoryItemId,
    normalizeCharacterInventory: normalizeCharacterInventory,
    characterContentSignature: characterContentSignature,
    mergeStoredCollections: mergeStoredCollections,
    mergeStarterHeroes: mergeStarterHeroes,
    rememberCollection: rememberCollection,
    prepareCollectionForSave: prepareCollectionForSave,
    markCollectionSaveFailed: markCollectionSaveFailed,
    ensureMigrationBackup: ensureMigrationBackup,
    getMigrationBackup: getMigrationBackup,
    restoreMigrationBackup: restoreMigrationBackup,
    loadAndSeed: loadAndSeed,
    markStarterHeroDeleted: markStarterHeroDeleted,
    persistCollection: persistCollection,
    persistCollectionBestEffort: persistCollectionBestEffort,
    saveCharacter: saveCharacter,
    readConfirmedCharacter: readConfirmedCharacter
  };
});
