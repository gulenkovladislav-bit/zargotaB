(function (w) {
  'use strict';

  var SESSION_KEY = 'zargota_vtt_session_v3';
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
  var roomUnsubscribe = null;
  var connected = false;
  var initError = null;

  function now() { return Date.now(); }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function normalizePlayerCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }

  function readSession() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return parsed && parsed.code ? parsed : null;
    } catch (e) { return null; }
  }

  function saveSession(session) {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
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
    }).filter(Boolean);
  }

  function characterSnapshot(character) {
    function clean(value, fallback) {
      try { return JSON.parse(JSON.stringify(value == null ? fallback : value)); }
      catch (e) { return fallback; }
    }
    return {
      id: String(character.id),
      name: character.name || 'Без имени',
      portrait: character.portrait || '',
      race: character.race || '',
      klasse: character.klasse || '',
      level: Number(character.level || 1),
      hpCur: Number(character.hpCur != null ? character.hpCur : character.hpMax || 0),
      hpMax: Number(character.hpMax || 0),
      ac: Number(character.ac || 10),
      speed: Number(character.speed || 0),
      stats: clean(character.stats, {}),
      statuses: clean(character.statuses || character.conditions, []),
      inventoryItems: clean(character.inventoryItems, []).slice(0, 80),
      equipItems: clean(character.equipItems, []).slice(0, 40),
      arenaEquipSlots: clean(character.arenaEquipSlots, {}),
      notes: clean(character.notes || character.journal || character.quests, [])
    };
  }

  function emit() {
    var snapshot = api.getSnapshot();
    listeners.slice().forEach(function (listener) {
      try { listener(snapshot); } catch (e) { console.error(e); }
    });
    try { w.dispatchEvent(new CustomEvent('zargota-room-state', { detail: snapshot })); } catch (e) {}
  }

  function stopWatchingRoom() {
    if (roomUnsubscribe) {
      try { roomUnsubscribe(); } catch (e) {}
      roomUnsubscribe = null;
    }
    currentRoom = null;
  }

  function syncSessionRole(room) {
    var session = readSession();
    if (!session || !auth || !auth.currentUser) return;
    var member = room && room.members && room.members[auth.currentUser.uid];
    if (member && member.role === 'player' && session.role !== 'player') {
      session.role = 'player';
      session.uid = auth.currentUser.uid;
      session.playerCode = member.playerCode || session.playerCode || '';
      saveSession(session);
    }
  }

  function watchRoom(code) {
    stopWatchingRoom();
    if (!code || !firebase || !db) return;
    roomUnsubscribe = firebase.onValue(firebase.ref(db, 'rooms/' + code), function (snapshot) {
      currentRoom = snapshot.exists() ? snapshot.val() : null;
      syncSessionRole(currentRoom);
      emit();
    }, function (error) {
      console.error('Zargota room listener:', error);
      emit();
    });
  }

  function setPresence(session) {
    if (!session || !auth || !auth.currentUser || !firebase || !db) return Promise.resolve();
    var uid = auth.currentUser.uid;
    var target = session.role === 'pending' && session.playerCode
      ? 'rooms/' + session.code + '/pending/' + session.playerCode
      : 'rooms/' + session.code + '/members/' + uid;
    var targetRef = firebase.ref(db, target);
    var values = { online: true, lastSeen: firebase.serverTimestamp() };
    return firebase.update(targetRef, values).then(function () {
      return firebase.onDisconnect(targetRef).update({ online: false, lastSeen: firebase.serverTimestamp() });
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
        fit: ['cover','contain','stretch'].indexOf(layer.fit) >= 0 ? layer.fit : 'cover',
        scale: Math.max(0.5, Math.min(3, Number(layer.scale) || 1)),
        x: Math.max(-100, Math.min(100, Number(layer.x) || 0)),
        y: Math.max(-100, Math.min(100, Number(layer.y) || 0)),
        brightness: Math.max(0.25, Math.min(2, Number(layer.brightness) || 1)),
        saturation: Math.max(0, Math.min(2, Number(layer.saturation == null ? 1 : layer.saturation)))
      };
    }).filter(function (layer) { return !!layer.image; });
    if (!layers.length && scene.background) {
      layers.push({ id:'legacy-background', name:'Фон', image:String(scene.background), visible:true, opacity:1, fit:'cover', scale:1, x:0, y:0, brightness:1, saturation:1 });
    }
    var tokens = (Array.isArray(scene.tokens) ? scene.tokens : []).slice(0, 60).map(function (token, index) {
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
        opacity: Math.max(0.15, Math.min(1, Number(token.opacity == null ? 1 : token.opacity))),
        memberUid: String(token.memberUid || '').slice(0, 128),
        name: token.type === 'note' ? 'GM' : String(token.name || 'Жетон').slice(0, 80),
        image: (token.type === 'custom' || token.type === 'object') ? String(token.image || '') : '',
        x: Math.max(0, Math.min(100, Number(token.x == null ? 50 : token.x))),
        y: Math.max(0, Math.min(100, Number(token.y == null ? 50 : token.y))),
        size: Math.max(24, Math.min(240, Number(token.size) || 64)),
        visible: token.visible !== false,
        z: Math.max(0, Math.min(99, Number(token.z) || index + 1))
      };
    });
    var mediaSize = layers.reduce(function (sum, layer) { return sum + layer.image.length; }, 0) +
      tokens.reduce(function (sum, token) { return sum + token.image.length; }, 0);
    if (mediaSize > 3400000) throw roomError('Изображения сцены слишком большие. Удалите слой или выберите более лёгкие изображения.', 'scene-too-large');
    return {
      layers: layers,
      tokens: tokens,
      grid: scene.grid !== false,
      gridSize: Math.max(24, Math.min(160, Number(scene.gridSize) || 64)),
      boardWidth: Math.max(8, Math.min(80, Number(scene.boardWidth) || 32)),
      boardHeight: Math.max(8, Math.min(80, Number(scene.boardHeight) || 20)),
      gridAboveTokens: !!scene.gridAboveTokens,
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
      return ensureReady().then(function (user) {
        return uniqueRoomCode().then(function (code) {
          var room = {
            code: code,
            phase: 'pairing',
            maxPlayers: MAX_PLAYERS,
            masterUid: user.uid,
            createdAt: now(),
            updatedAt: now(),
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
      }).catch(function (error) {
        if (error && error.code && String(error.code).indexOf('room-') === 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    prepareJoin: function (rawCode) {
      var code = normalizeRoomCode(rawCode);
      return ensureReady().then(function (user) {
        return readRoom(code).then(function (room) {
          if (!room) throw roomError('Комната с таким кодом не найдена.', 'room-not-found');
          if (room.phase !== 'pairing') throw roomError('Мастер уже начал выбор героев.', 'room-started');
          var existing = room.members && room.members[user.uid];
          if (existing && existing.role === 'player') {
            var existingSession = { code: code, role: 'player', uid: user.uid, playerCode: existing.playerCode || '' };
            saveSession(existingSession);
            currentRoom = room;
            watchRoom(code);
            setPresence(existingSession);
            return api.getSnapshot();
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
        if (!session || session.role !== 'master') throw roomError('Подтверждать игроков может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var pending = room.pending && room.pending[playerCode];
          if (!pending) throw roomError('Игрок с таким кодом пока не подключался.', 'player-not-found');
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
        if (error && ['master-only','room-not-found','player-not-found','slot-busy'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    startCharacterSelection: function (options) {
      var testMode = options === true || !!(options && options.testMode);
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Начать игру может только мастер.', 'master-only');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          if (room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
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
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var member = room.members && room.members[user.uid];
          if (!member) throw roomError('Мастер ещё не подтвердил подключение.', 'not-approved');
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
            characterId: String(character.id),
            character: characterSnapshot(character),
            gmReady: false,
            name: character.name || member.name,
            lastSeen: firebase.serverTimestamp(),
            online: true
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['room-not-found','not-approved'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
    },

    syncCharacter: function (character) {
      if (!character || character.id == null) return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || !firebase || !db) return api.getSnapshot();
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        if (!member || String(member.characterId || '') !== String(character.id)) return api.getSnapshot();
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          character: characterSnapshot(character), name: character.name || member.name, lastSeen: firebase.serverTimestamp()
        }).then(function () { return refreshRoom(session.code); }).then(function () { return api.getSnapshot(); });
      }).catch(function () { return api.getSnapshot(); });
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
            return member.role === 'master' ? !(member.gmReady || member.characterId) : !member.characterId;
          })) {
            throw roomError('Не все участники выбрали персонажей.', 'characters-pending');
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
          var payload = sanitizeScene(scene);
          payload.revision = now();
          payload.publishedAt = firebase.serverTimestamp();
          return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/scene'), payload).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','scene-too-large'].indexOf(error.code) >= 0) throw error;
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
          var payload = sanitizeScene(scene);
          payload.revision = now();
          payload.publishedAt = firebase.serverTimestamp();
          return firebase.set(firebase.ref(db, 'rooms/' + session.code + '/zones/' + zoneId), payload).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','scene-too-large','zone-missing'].indexOf(error.code) >= 0) throw error;
        throw friendlyFirebaseError(error);
      });
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
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), { movementRequest: request }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['player-only','room-not-found','token-missing'].indexOf(error.code) >= 0) throw error;
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
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + requestUid), { movementRequest: request }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','player-missing','token-missing'].indexOf(error.code) >= 0) throw error;
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
              duration: Math.max(700, Math.min(2800, Math.round(distance * 38))),
              startedAt: now()
            };
          }
          updates.updatedAt = now();
          return firebase.update(roomRef(session.code), updates).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','request-missing','token-missing'].indexOf(error.code) >= 0) throw error;
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
          var speaker = session.role === 'master' && speakerUid && room.members && room.members[speakerUid] || member;
          var id = 'msg-' + now() + '-' + Math.random().toString(36).slice(2, 6);
          var payload = {
            id: id, uid: user.uid, kind: isWorld ? 'world' : (session.role === 'master' && !speakerUid ? 'gm' : 'chat'),
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

    beginRoll: function (sides, speakerUid, value, total, outcome, statLabel) {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session || !firebase || !db) return null;
        var member = currentRoom && currentRoom.members && currentRoom.members[user.uid];
        var speaker = session.role === 'master' && speakerUid && currentRoom && currentRoom.members && currentRoom.members[speakerUid] || member;
        var activeRoll = {
          id: 'roll-' + now() + '-' + Math.random().toString(36).slice(2, 6),
          ts: now(),
          duration: 1100,
          sides: Math.max(2, Math.min(100, Number(sides) || 20)),
          value: Math.max(1, Number(value) || 1),
          total: Number(total == null ? value : total) || 0,
          outcome: outcome === 'critical-success' || outcome === 'critical-fail' ? outcome : '',
          statLabel: String(statLabel || '').slice(0, 30),
          speakerUid: speaker && speaker.uid || user.uid,
          name: speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок'
        };
        if (member) { member.activeRoll = activeRoll; emit(); }
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          activeRoll: activeRoll
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    },

    beginRollBatch: function (rolls, speakerUid) {
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
        var activeRoll = { id:'roll-'+now()+'-'+Math.random().toString(36).slice(2,6), ts:now(), duration:1250, rolls:rolls,
          speakerUid:speaker && speaker.uid || user.uid, name:speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок' };
        if (member) { member.activeRoll = activeRoll; emit(); }
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
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) return;
        var operation;
        if (session.role === 'master') {
          operation = firebase.remove(roomRef(session.code));
        } else if (session.role === 'pending' && session.playerCode) {
          operation = firebase.remove(firebase.ref(db, 'rooms/' + session.code + '/pending/' + session.playerCode));
        } else {
          operation = firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
            online: false,
            lastSeen: firebase.serverTimestamp()
          });
        }
        return operation.catch(function () {}).then(function () {
          saveSession(null);
          stopWatchingRoom();
          emit();
        });
      });
    },

    getSnapshot: function () {
      var session = readSession();
      var member = currentRoom && session && currentRoom.members ? currentRoom.members[session.uid] || null : null;
      return {
        mode: api.mode,
        networkReady: !!(auth && auth.currentUser && !initError),
        online: connected,
        connected: !!currentRoom,
        approved: !!(member && member.role === 'player'),
        session: session,
        room: currentRoom,
        players: membersOf(currentRoom, 'player'),
        pending: pendingOf(currentRoom),
        error: initError ? initError.message : ''
      };
    },

    subscribe: function (listener) {
      if (typeof listener !== 'function') return function () {};
      listeners.push(listener);
      listener(api.getSnapshot());
      return function () {
        listeners = listeners.filter(function (item) { return item !== listener; });
      };
    },

    normalizeCode: normalizeRoomCode,
    normalizePlayerCode: normalizePlayerCode
  };

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
      set: databaseModule.set,
      update: databaseModule.update,
      remove: databaseModule.remove,
      onValue: databaseModule.onValue,
      onDisconnect: databaseModule.onDisconnect,
      serverTimestamp: databaseModule.serverTimestamp
    };
    return authModule.setPersistence(auth, authModule.browserSessionPersistence).then(function () {
      if (auth.currentUser) return auth.currentUser;
      return authModule.signInAnonymously(auth).then(function (credential) { return credential.user; });
    }).then(function (user) {
      firebase.onValue(firebase.ref(db, '.info/connected'), function (snapshot) {
        connected = snapshot.val() === true;
        if (connected) setPresence(readSession());
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
