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
      speed: Number(character.speed || 0)
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
