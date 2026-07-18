(function (w) {
  'use strict';

  var STORAGE_KEY = 'zargota_vtt_rooms_v1';
  var SESSION_KEY = 'zargota_vtt_session_v1';
  var CLIENT_KEY = 'zargota_vtt_client_id';
  var CHANNEL_NAME = 'zargota_vtt_rooms';
  var MAX_PLAYERS = 5;
  var listeners = [];
  var pendingCode = '';
  var channel = null;

  function now() { return Date.now(); }
  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
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
  function writeRooms(rooms, code) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    if (channel) channel.postMessage({ type: 'room-update', code: code || '' });
    emit();
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
  function generateCode(rooms) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var attempt = 0; attempt < 40; attempt++) {
      var code = '';
      var bytes = new Uint8Array(5);
      if (w.crypto && w.crypto.getRandomValues) w.crypto.getRandomValues(bytes);
      else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      for (var j = 0; j < bytes.length; j++) code += alphabet[bytes[j] % alphabet.length];
      if (!rooms[code]) return code;
    }
    throw new Error('Не удалось создать уникальный код комнаты.');
  }
  function roomForSession() {
    var session = readSession();
    if (!session) return null;
    return readRooms()[session.code] || null;
  }
  function playerMembers(room) {
    return Object.keys((room && room.members) || {}).map(function (id) {
      return room.members[id];
    }).filter(function (member) { return member && member.role === 'player'; });
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
  function error(message, code) {
    var err = new Error(message);
    err.code = code || 'room-error';
    return err;
  }

  var api = {
    mode: 'local',
    maxPlayers: MAX_PLAYERS,

    createRoom: function () {
      return Promise.resolve().then(function () {
        var rooms = readRooms();
        var code = generateCode(rooms);
        var uid = clientId();
        rooms[code] = {
          code: code,
          status: 'lobby',
          maxPlayers: MAX_PLAYERS,
          masterUid: uid,
          createdAt: now(),
          updatedAt: now(),
          members: {}
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
        pendingCode = '';
        writeRooms(rooms, code);
        return api.getSnapshot();
      });
    },

    prepareJoin: function (rawCode) {
      return Promise.resolve().then(function () {
        var code = normalizeCode(rawCode);
        var room = readRooms()[code];
        if (!room) throw error('Комната с таким кодом не найдена.', 'room-not-found');
        var uid = clientId();
        var existing = room.members && room.members[uid];
        if (!existing && playerMembers(room).length >= Number(room.maxPlayers || MAX_PLAYERS)) {
          throw error('В комнате уже заняты все пять мест игроков.', 'room-full');
        }
        pendingCode = code;
        return { code: code, room: room };
      });
    },

    attachCharacter: function (character) {
      return Promise.resolve().then(function () {
        if (!character || character.id == null) throw error('Персонаж не выбран.', 'character-required');
        var session = readSession();
        var code = pendingCode || (session && session.code) || '';
        if (!code) return api.getSnapshot();
        var rooms = readRooms();
        var room = rooms[code];
        if (!room) throw error('Комната больше недоступна.', 'room-not-found');
        var uid = clientId();
        var selectedId = String(character.id);
        var taken = playerMembers(room).some(function (member) {
          return member.uid !== uid && String(member.characterId || '') === selectedId;
        });
        if (taken) throw error('Этот герой уже выбран другим игроком.', 'character-taken');
        if (!room.members[uid] && playerMembers(room).length >= Number(room.maxPlayers || MAX_PLAYERS)) {
          throw error('В комнате уже заняты все пять мест игроков.', 'room-full');
        }
        room.members[uid] = {
          uid: uid,
          role: 'player',
          name: character.name || 'Игрок',
          characterId: selectedId,
          character: characterSnapshot(character),
          online: true,
          joinedAt: room.members[uid] ? room.members[uid].joinedAt : now(),
          lastSeen: now()
        };
        room.updatedAt = now();
        saveSession({ code: code, role: 'player', uid: uid, characterId: selectedId });
        pendingCode = '';
        writeRooms(rooms, code);
        return api.getSnapshot();
      });
    },

    leaveRoom: function () {
      var session = readSession();
      if (!session) return Promise.resolve();
      var rooms = readRooms();
      var room = rooms[session.code];
      if (room && room.members && room.members[session.uid]) {
        if (session.role === 'master') {
          room.members[session.uid].online = false;
          room.members[session.uid].lastSeen = now();
        } else {
          delete room.members[session.uid];
        }
        room.updatedAt = now();
        writeRooms(rooms, session.code);
      }
      saveSession(null);
      pendingCode = '';
      emit();
      return Promise.resolve();
    },

    getSnapshot: function () {
      var session = readSession();
      var room = session ? readRooms()[session.code] || null : null;
      return {
        mode: api.mode,
        connected: !!room,
        session: session,
        room: room,
        players: playerMembers(room)
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

    normalizeCode: normalizeCode
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
