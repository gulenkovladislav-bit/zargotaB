(function (w) {
  'use strict';

  var STORAGE_KEY = 'zargota_vtt_rooms_v2';
  var SESSION_KEY = 'zargota_vtt_session_v2';
  var CLIENT_KEY = 'zargota_vtt_client_id';
  var CHANNEL_NAME = 'zargota_vtt_rooms_v2';
  var MAX_PLAYERS = 5;
  var listeners = [];
  var channel = null;

  function now() { return Date.now(); }
  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }
  function normalizePlayerCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }
  function randomId(prefix) {
    var bytes = new Uint8Array(10);
    if (w.crypto && w.crypto.getRandomValues) w.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return prefix + Array.prototype.map.call(bytes, function (n) {
      return n.toString(16).padStart(2, '0');
    }).join('');
  }
  function clientId() {
    var id = '';
    try { id = sessionStorage.getItem(CLIENT_KEY) || ''; } catch (e) {}
    if (!id) {
      id = randomId('client_');
      try { sessionStorage.setItem(CLIENT_KEY, id); } catch (e) {}
    }
    return id;
  }
  function readRooms() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
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
  function writeRooms(rooms, code) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    if (channel) channel.postMessage({ type: 'room-update', code: code || '' });
    emit();
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
  function roomError(message, code) {
    var err = new Error(message);
    err.code = code || 'room-error';
    return err;
  }
  function membersOf(room, role) {
    return Object.keys((room && room.members) || {}).map(function (id) {
      return room.members[id];
    }).filter(function (member) { return member && (!role || member.role === role); });
  }
  function pendingOf(room) {
    return Object.keys((room && room.pending) || {}).map(function (code) {
      return room.pending[code];
    });
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

  var api = {
    mode: 'local',
    maxPlayers: MAX_PLAYERS,

    createRoom: function () {
      return Promise.resolve().then(function () {
        var rooms = readRooms();
        var code = generatedCode(5, rooms);
        var uid = clientId();
        rooms[code] = {
          code: code,
          phase: 'pairing',
          maxPlayers: MAX_PLAYERS,
          masterUid: uid,
          createdAt: now(),
          updatedAt: now(),
          members: {},
          pending: {},
          slots: {}
        };
        rooms[code].members[uid] = {
          uid: uid,
          role: 'master',
          name: 'Гейм-мастер',
          online: true,
          joinedAt: now(),
          lastSeen: now()
        };
        saveSession({ code: code, role: 'master', uid: uid });
        writeRooms(rooms, code);
        return api.getSnapshot();
      });
    },

    prepareJoin: function (rawCode) {
      return Promise.resolve().then(function () {
        var code = normalizeRoomCode(rawCode);
        var rooms = readRooms();
        var room = rooms[code];
        if (!room) throw roomError('Комната с таким кодом не найдена.', 'room-not-found');
        if (room.phase !== 'pairing') throw roomError('Мастер уже начал выбор героев.', 'room-started');
        var uid = clientId();
        var existing = room.members && room.members[uid];
        if (existing && existing.role === 'player') {
          saveSession({ code: code, role: 'player', uid: uid, playerCode: existing.playerCode });
          return api.getSnapshot();
        }
        var ownPendingCode = '';
        Object.keys(room.pending || {}).some(function (key) {
          if (room.pending[key].uid === uid) { ownPendingCode = key; return true; }
          return false;
        });
        if (!ownPendingCode) {
          if (membersOf(room, 'player').length + pendingOf(room).length >= MAX_PLAYERS) {
            throw roomError('Все пять мест уже заняты или ожидают подтверждения.', 'room-full');
          }
          ownPendingCode = generatedCode(4, room.pending || {});
          room.pending[ownPendingCode] = {
            uid: uid,
            playerCode: ownPendingCode,
            online: true,
            createdAt: now()
          };
          room.updatedAt = now();
          writeRooms(rooms, code);
        }
        saveSession({ code: code, role: 'pending', uid: uid, playerCode: ownPendingCode });
        emit();
        return api.getSnapshot();
      });
    },

    approvePlayer: function (rawPlayerCode, slotIndex) {
      return Promise.resolve().then(function () {
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Подтверждать игроков может только мастер.', 'master-only');
        var rooms = readRooms();
        var room = rooms[session.code];
        if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
        var playerCode = normalizePlayerCode(rawPlayerCode);
        var pending = room.pending[playerCode];
        if (!pending) throw roomError('Игрок с таким кодом пока не подключался.', 'player-not-found');
        var slot = Math.max(0, Math.min(MAX_PLAYERS - 1, Number(slotIndex) || 0));
        if (room.slots[slot] && room.slots[slot].uid !== pending.uid) {
          throw roomError('Эта ячейка уже занята.', 'slot-busy');
        }
        Object.keys(room.slots || {}).forEach(function (key) {
          if (room.slots[key] && room.slots[key].uid === pending.uid) delete room.slots[key];
        });
        room.members[pending.uid] = {
          uid: pending.uid,
          role: 'player',
          name: 'Игрок',
          playerCode: playerCode,
          approved: true,
          online: true,
          joinedAt: pending.createdAt || now(),
          lastSeen: now()
        };
        room.slots[slot] = { uid: pending.uid, playerCode: playerCode };
        delete room.pending[playerCode];
        room.updatedAt = now();
        writeRooms(rooms, session.code);
        return api.getSnapshot();
      });
    },

    startCharacterSelection: function (options) {
      return Promise.resolve().then(function () {
        var testMode = options === true || !!(options && options.testMode);
        var session = readSession();
        if (!session || session.role !== 'master') throw roomError('Начать игру может только мастер.', 'master-only');
        var rooms = readRooms();
        var room = rooms[session.code];
        if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
        if (!testMode && !membersOf(room, 'player').length) throw roomError('Подтвердите хотя бы одного игрока.', 'no-players');
        room.testMode = testMode;
        room.phase = 'character-select';
        room.updatedAt = now();
        writeRooms(rooms, session.code);
        return api.getSnapshot();
      });
    },

    attachCharacter: function (character) {
      return Promise.resolve().then(function () {
        if (!character || character.id == null) throw roomError('Персонаж не выбран.', 'character-required');
        var session = readSession();
        if (!session) return api.getSnapshot();
        var rooms = readRooms();
        var room = rooms[session.code];
        if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
        var member = room.members[session.uid];
        if (!member) throw roomError('Мастер ещё не подтвердил подключение.', 'not-approved');
        member.characterId = String(character.id);
        member.character = characterSnapshot(character);
        member.name = character.name || member.name;
        member.lastSeen = now();
        room.updatedAt = now();
        writeRooms(rooms, session.code);
        return api.getSnapshot();
      });
    },

    leaveRoom: function () {
      var session = readSession();
      if (!session) return Promise.resolve();
      var rooms = readRooms();
      var room = rooms[session.code];
      if (room) {
        if (session.role === 'pending' && session.playerCode) delete room.pending[session.playerCode];
        if (room.members && room.members[session.uid]) delete room.members[session.uid];
        Object.keys(room.slots || {}).forEach(function (key) {
          if (room.slots[key] && room.slots[key].uid === session.uid) delete room.slots[key];
        });
        room.updatedAt = now();
        writeRooms(rooms, session.code);
      }
      saveSession(null);
      emit();
      return Promise.resolve();
    },

    getSnapshot: function () {
      var session = readSession();
      var room = session ? readRooms()[session.code] || null : null;
      var member = room && session && room.members ? room.members[session.uid] || null : null;
      return {
        mode: api.mode,
        connected: !!room,
        approved: !!(member && member.role === 'player'),
        session: session,
        room: room,
        players: membersOf(room, 'player'),
        pending: pendingOf(room)
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

  try {
    if ('BroadcastChannel' in w) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = function () { emit(); };
    }
  } catch (e) { channel = null; }
  w.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) emit();
  });
  w.ZargotaRooms = api;
})(window);
