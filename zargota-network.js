(function (w) {
  'use strict';

  var SESSION_KEY = 'zargota_vtt_session_v4';
  var CAMPAIGN_ID = 'zargota-main';
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
  var campaignUnsubscribe = null;
  var connected = false;
  var initError = null;
  var createRoomPromise = null;
  var campaignMirrorSignatures = {};

  try {
    var navigationEntry=w.performance&&w.performance.getEntriesByType&&w.performance.getEntriesByType('navigation')[0];
    if(!navigationEntry||navigationEntry.type!=='reload')sessionStorage.removeItem(SESSION_KEY);
  } catch(e) {}

  function now() { return Date.now(); }

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
    var from = combatEntryToken(room, attacker), to = combatEntryToken(room, target);
    if (!from || !to) return null;
    return movementCells(room.scene || {}, from.x, from.y, to.x, to.y);
  }

  function combatEntryPoint(room, entry) {
    var token = combatEntryToken(room, entry), scene = room && room.scene || {};
    if (!token) return null;
    return { x:Number(token.x) * Math.max(1, Number(scene.boardWidth) || 32) / 100, y:Number(token.y) * Math.max(1, Number(scene.boardHeight) || 20) / 100 };
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

  function combatHeroEntry(room, uid) {
    var combat = room && room.combat, order = combat && Array.isArray(combat.order) ? combat.order : [];
    var index = order.findIndex(function (entry) { return entry && entry.uid === uid; });
    return { combat:combat, order:order, index:index, entry:index >= 0 ? order[index] : null };
  }

  function combatStatusKeys(entry) {
    return (Array.isArray(entry && entry.statuses) ? entry.statuses : []).map(function (status) {
      if (typeof status === 'string') return status;
      return status && (status.key || status.statusKey || status.id) || '';
    }).filter(Boolean);
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
    var exhaustion = (Array.isArray(entry && entry.statuses) ? entry.statuses : []).filter(function (status) {
      return status && typeof status === 'object' && (status.key === 'exhausted' || status.statusKey === 'exhausted');
    })[0];
    var exhaustionLevel = Math.max(0, Number(exhaustion && (exhaustion.level || exhaustion.stacks)) || 0);
    if (exhaustionLevel >= 2) {
      blocked.reaction = true;
      reasons.push('Истощение II: реакции недоступны');
    }
    if (exhaustionLevel >= 5) {
      blocked.long = blocked.short = blocked.movement = true;
      reasons.push('Истощение V: герой без сознания');
    }
    return { blocked:blocked, slowed:has('slow'), prone:has('prone'), reasons:reasons };
  }

  function combatTurnMovement(entry) {
    var restrictions = combatRestrictions(entry);
    if (restrictions.blocked.movement) return 0;
    var base = Math.max(0, Number(entry && entry.economy && entry.economy.movementMax) || 7);
    if (restrictions.slowed) base = Math.floor(base / 2);
    return base;
  }

  function combatStatusEffects(entry) {
    return (Array.isArray(entry && entry.statusEffects) ? entry.statusEffects : []).filter(function (effect) {
      return effect && effect.type === 'status' && (effect.unit !== 'rounds' || Number(effect.remaining) > 0);
    }).map(function (effect) { return Object.assign({}, effect); });
  }

  function rollDie(sides) { return Math.floor(Math.random() * Math.max(2, Number(sides) || 4)) + 1; }

  function combatStat(entry, key) {
    var stat = entry && entry.stats && entry.stats[key] || {};
    if (typeof stat === 'number') return Number(stat) || 0;
    return Number(stat.cur != null && stat.cur !== 0 ? stat.cur : stat.base) || 0;
  }

  function rollFormula(formula, critical) {
    var match = String(formula || '1d4').replace(/\s+/g, '').match(/^(\d{1,2})d(\d{1,3})([+-]\d+)?$/i);
    var count = match ? Math.max(1, Math.min(20, Number(match[1]) || 1)) : 1;
    var sides = match ? Math.max(2, Math.min(100, Number(match[2]) || 4)) : 4;
    var bonus = match ? Number(match[3] || 0) : 0, rolls = [], total = bonus;
    for (var i = 0; i < count * (critical ? 2 : 1); i += 1) { var value = rollDie(sides); rolls.push(value); total += value; }
    return { total:total, rolls:rolls, formula:count+'d'+sides+(bonus?(bonus>0?'+':'')+bonus:'') };
  }

  function statusTurnTick(entry) {
    var effects = combatStatusEffects(entry), keys = combatStatusKeys(entry), seen = {}, changes = [];
    effects.forEach(function (effect) {
      if (effect.statusKey && keys.indexOf(effect.statusKey) < 0) keys.push(effect.statusKey);
    });
    var hpMax = Math.max(0, Number(entry && entry.hpMax) || 0);
    var hp = Math.max(0, Number(entry && entry.hp != null ? entry.hp : hpMax) || 0);
    var tempHp = Math.max(0, Number(entry && entry.tempHp) || 0);
    keys.forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      var effect = effects.filter(function (item) { return item.statusKey === key; })[0];
      var delta = effect && effect.tickType === 'hp' && Number(effect.tickValue) ? Number(effect.tickValue) : 0;
      if (!delta && ['burn','poison','bleed'].indexOf(key) >= 0) delta = -rollDie(4);
      if (!delta && key === 'regen') delta = rollDie(4);
      if (!delta) return;
      var before = hp, absorbed = 0;
      if (delta < 0 && tempHp > 0) {
        absorbed = Math.min(tempHp, Math.abs(delta));
        tempHp -= absorbed;
        delta += absorbed;
      }
      hp = delta > 0 ? Math.min(hpMax || hp + delta, hp + delta) : Math.max(0, hp + delta);
      var labels = { burn:'Горит', poison:'Отравлен', bleed:'Кровотечение', regen:'Регенерация' };
      changes.push((labels[key] || effect && effect.value || key) + ': ' + (delta > 0 ? '+' : '') + delta + ' HP' + (absorbed ? ' (🛡 поглощено ' + absorbed + ')' : ''));
      if (before === hp && !absorbed) changes.pop();
    });
    return { hp:hp, tempHp:tempHp, changes:changes };
  }

  function expireTurnStatuses(entry) {
    var effects = combatStatusEffects(entry), expired = [], active = [];
    effects.forEach(function (effect) {
      if (effect.unit === 'rounds') {
        effect.remaining = Math.max(0, Number(effect.remaining) - 1);
        if (!effect.remaining) { expired.push(effect); return; }
      }
      active.push(effect);
    });
    var statuses = combatStatusKeys(entry).filter(function (key) {
      return !expired.some(function (effect) { return effect.statusKey === key; }) || active.some(function (effect) { return effect.statusKey === key; });
    });
    return { effects:active, statuses:statuses, expired:expired };
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function normalizePlayerCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY) || 'null';
      var parsed = JSON.parse(raw);
      return parsed && parsed.code ? parsed : null;
    } catch (e) { return null; }
  }

  function saveSession(session) {
    try {
      if (session) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
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
    var directItems = [].concat(Array.isArray(character.equipItems) ? character.equipItems : [], Array.isArray(character.inventoryItems) ? character.inventoryItems : []);
    var armoryItems = [];
    try { if (typeof w.loadArmoryItems === 'function') armoryItems = w.loadArmoryItems() || []; } catch (e) {}
    Object.keys(character.arenaEquipSlots || {}).forEach(function (slot) {
      var id = character.arenaEquipSlots[slot], item = armoryItems.filter(function (candidate) { return candidate && String(candidate.id) === String(id); })[0];
      if (item) directItems.push(Object.assign({}, item, { equipped:true, slot:slot }));
    });
    var weaponProfiles = [], weaponSeen = {};
    directItems.forEach(function (item) {
      if (!item || item.equipped === false || String(item.category || item.cat || '').toLowerCase() !== 'weapon') return;
      var formula = String(item.damageFormula || item.damage || '').match(/\d+d\d+(?:\s*[+-]\s*\d+)?/i);
      if (!formula) return;
      var key = String(item.id || item.name || formula[0]); if (weaponSeen[key]) return; weaponSeen[key] = true;
      weaponProfiles.push({ id:key, name:item.name || 'Оружие', damageFormula:formula[0].replace(/\s+/g,''), damageType:item.damageType || '', range:item.range || '1 клетка', stat:item.attackStat || item.stat || '' });
    });
    if (!weaponProfiles.length) weaponProfiles.push({ id:'improvised', name:'Импровизированная атака', damageFormula:'1d4', damageType:'Дробящий', range:'1 клетка', stat:'str' });
    var hpMax = Math.max(0, Number(character.hpMax || 0));
    var effectTempHp = (Array.isArray(character.tempEffects) ? character.tempEffects : []).reduce(function (sum, effect) {
      if (!effect || effect.type !== 'hp') return sum;
      return sum + Math.max(0, Number(effect.value) || 0);
    }, 0);
    var tempHp = Math.max(0, Number(character.tempHp == null ? effectTempHp : character.tempHp) || 0);
    tempHp = Math.min(Math.floor(hpMax * 0.5), tempHp);
    var abilityUsage = {};
    (Array.isArray(character.spellRefs) ? character.spellRefs : []).slice(0, 80).forEach(function (id) {
      var state = character.spellCD && character.spellCD[id] || {}, key = 'spell-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
      abilityUsage[key] = { used:Math.max(0, Number(state.used) || 0), max:Math.max(0, Number(state.max) || 0) };
    });
    return {
      id: String(character.id),
      campaignKey: campaignKeyFor(character),
      name: character.name || 'Без имени',
      portrait: /^data:/i.test(String(character.portrait || '')) ? '' : (character.portrait || ''),
      race: character.race || '',
      klasse: character.klasse || '',
      level: Number(character.level || 1),
      hpCur: Number(character.hpCur != null ? character.hpCur : character.hpMax || 0),
      hpMax: hpMax,
      tempHp: tempHp,
      ac: Number(character.ac || 10),
      initiative: Number(character.initiative || 0),
      speed: Number(character.speed || 0),
      stats: clean(character.stats, {}),
      mastery: clean(Array.isArray(character.mastery) ? character.mastery : [], []).slice(0, 40),
      weaponProfiles: clean(weaponProfiles, []).slice(0, 12),
      resistances: clean(character.resistances || character.damageResistances, []),
      vulnerabilities: clean(character.vulnerabilities || character.damageVulnerabilities, []),
      immunities: clean(character.immunities || character.damageImmunities, []),
      statuses: clean(character.statuses || character.conditions, []),
      statusEffects: clean((character.tempEffects || []).filter(function (effect) { return effect && effect.type === 'status'; }), []).slice(0, 40),
      abilityUsage: clean(abilityUsage, {}),
      inventoryItems: clean(character.inventoryItems, []).slice(0, 80),
      equipItems: clean(character.equipItems, []).slice(0, 40),
      arenaEquipSlots: clean(character.arenaEquipSlots, {}),
      notes: clean(character.notes || character.journal || character.quests, [])
    };
  }

  function campaignKeyFor(character) {
    if (!character) return '';
    return String(character.campaignKey || CAMPAIGN_HERO_KEYS[String(character.id)] || '').slice(0, 40);
  }

  function campaignProfileSnapshot(character) {
    var copy;
    try { copy=JSON.parse(JSON.stringify(character||{})); } catch(e) { copy={}; }
    var runtimeKeys=['hpCur','hpMax','tempHp','statuses','tempEffects','statusEffects','abilityUsage','inventoryItems','equipItems','deathSaves','combatRound','battleEcho'];
    runtimeKeys.forEach(function(key){delete copy[key];});
    delete copy.heroArt;
    if(/^data:/i.test(String(copy.portrait||'')))copy.portrait='';
    copy.id=String(copy.id||'');copy.campaignKey=campaignKeyFor(character);
    return copy;
  }

  function campaignRuntimeSnapshot(character) {
    var snap=characterSnapshot(character);
    return {hpCur:snap.hpCur,hpMax:snap.hpMax,tempHp:snap.tempHp,statuses:snap.statuses,statusEffects:snap.statusEffects,abilityUsage:snap.abilityUsage,inventoryItems:snap.inventoryItems,equipItems:snap.equipItems,updatedAt:now()};
  }

  function campaignHeroPayload(character,ownerUid) {
    return {campaignKey:campaignKeyFor(character),ownerUid:String(ownerUid||''),profile:campaignProfileSnapshot(character),runtime:campaignRuntimeSnapshot(character),updatedAt:now()};
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

  function watchCampaign() {
    if(campaignUnsubscribe){try{campaignUnsubscribe();}catch(e){}campaignUnsubscribe=null;}
    if(!firebase||!db)return;
    campaignUnsubscribe=firebase.onValue(firebase.ref(db,'campaigns/'+CAMPAIGN_ID),function(snapshot){currentCampaign=snapshot.exists()?snapshot.val():null;emit();},function(){currentCampaign=null;emit();});
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
      if (!currentRoom) {
        var missingSession=readSession();
        if(missingSession&&missingSession.code===code)saveSession(null);
      }
      syncSessionRole(currentRoom);
      mirrorRoomCampaign(currentRoom);
      emit();
    }, function (error) {
      console.error('Zargota room listener:', error);
      emit();
    });
  }

  function mirrorRoomCampaign(room) {
    var session=readSession();if(!room||!session||session.role!=='master'||!auth||!auth.currentUser||room.masterUid!==auth.currentUser.uid)return;
    Object.keys(room.members||{}).forEach(function(uid){
      var member=room.members[uid],character=member&&member.character,key=campaignKeyFor(character);if(!character||!key)return;
      var signature=JSON.stringify(character);if(campaignMirrorSignatures[key]===signature)return;campaignMirrorSignatures[key]=signature;
      firebase.update(firebase.ref(db,'campaigns/'+CAMPAIGN_ID+'/heroes/'+key),{runtime:campaignRuntimeSnapshot(character),updatedAt:now()}).catch(function(){});
    });
  }

  function setPresence(session) {
    if (!session || !auth || !auth.currentUser || !firebase || !db) return Promise.resolve();
    var uid = auth.currentUser.uid;
    if (session.role === 'master') {
      var masterMemberRef=firebase.ref(db,'rooms/'+session.code+'/members/'+uid);
      return firebase.update(masterMemberRef,{online:true,lastSeen:firebase.serverTimestamp()}).then(function(){
        return firebase.onDisconnect(roomRef(session.code)).remove();
      }).catch(function(){});
    }
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

  function ensureCampaign(user) {
    var target=firebase.ref(db,'campaigns/'+CAMPAIGN_ID);
    return firebase.get(target).then(function(snapshot){
      var campaign=snapshot.exists()?snapshot.val():null;
      if(campaign&&campaign.masterUid&&campaign.masterUid!==user.uid)return campaign;
      var updates={masterUid:user.uid,updatedAt:now()},chars=Array.isArray(w.characters)?w.characters:[];
      chars.forEach(function(character){var key=campaignKeyFor(character);if(key&&!(campaign&&campaign.heroes&&campaign.heroes[key]))updates['heroes/'+key]=campaignHeroPayload(character,'');});
      return firebase.update(target,updates).then(function(){watchCampaign();return true;});
    }).catch(function(){return null;});
  }

  function writeCampaignCharacter(character,user,allowClaim) {
    var key=campaignKeyFor(character);if(!key)return Promise.resolve(null);
    var target=firebase.ref(db,'campaigns/'+CAMPAIGN_ID+'/heroes/'+key);
    return firebase.get(target).then(function(snapshot){
      var existing=snapshot.exists()?snapshot.val():null,owner=existing&&existing.ownerUid||'';
      var payload=campaignHeroPayload(character,allowClaim?user.uid:(owner||user.uid));
      return firebase.set(target,payload).then(function(){return payload;});
    }).catch(function(){return null;});
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
          compactSceneImageCache[key]=data;resolve(data);
        }catch(error){resolve(source);}
      };
      image.onerror=function(){resolve(source);};image.src=source;
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
        z: Math.max(0, Math.min(99, Number(token.z) || index + 1))
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
      view:{fog:view.fog!==false,visionMode:view.visionMode==='individual'?'individual':'party',rememberExplored:view.rememberExplored!==false,cinematic:!!view.cinematic,showOtherRequests:!!view.showOtherRequests,statusVisibility:statusVisibility,minZoom:Math.max(.4,Math.min(2,Number(view.minZoom)||.6)),maxZoom:Math.max(.6,Math.min(3,Number(view.maxZoom)||2.2)),panLimit:Math.max(10,Math.min(100,Number(view.panLimit)||45))},
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
            return firebase.remove(roomRef(saved.code)).then(function(){return null;});
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
            ensureCampaign(user);
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
          var existing = room.members && room.members[user.uid];
          if (existing && existing.role === 'player') {
            var existingSession = { code: code, role: 'player', uid: user.uid, playerCode: existing.playerCode || '' };
            saveSession(existingSession);
            currentRoom = room;
            watchRoom(code);
            setPresence(existingSession);
            return api.getSnapshot();
          }
          if (room.phase !== 'pairing') throw roomError('Мастер уже начал выбор героев.', 'room-started');
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
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var member = room.members && room.members[user.uid];
          if (!member) throw roomError('Мастер ещё не подтвердил подключение.', 'not-approved');
          return writeCampaignCharacter(character,user,true).then(function(campaignResult){
            if(campaignKeyFor(character)&&!campaignResult)throw roomError('Этот герой уже закреплён за другим игроком.','hero-taken');
            return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
              characterId: String(character.id),character:characterSnapshot(character),campaignKey:campaignKeyFor(character),gmReady:false,
              name:character.name||member.name,lastSeen:firebase.serverTimestamp(),online:true
            });
          }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['room-not-found','not-approved','hero-taken'].indexOf(error.code) >= 0) throw error;
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
        var roomWrite=firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          character: characterSnapshot(character), name: character.name || member.name, lastSeen: firebase.serverTimestamp()
        });
        return Promise.all([roomWrite,writeCampaignCharacter(character,user,false)]).then(function () { return refreshRoom(session.code); }).then(function () { return api.getSnapshot(); });
      }).catch(function () { return api.getSnapshot(); });
    },

    persistCampaignCharacter: function(character) {
      return ensureReady().then(function(user){return writeCampaignCharacter(character,user,false);}).catch(function(){return null;});
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
        if (error && ['player-only','room-not-found','token-missing','combat-not-turn','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
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
        if (error && ['master-only','room-not-found','player-missing','token-missing','combat-not-turn','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
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
        if (error && ['master-only','room-not-found','request-missing','token-missing','combat-not-turn','combat-movement-spent','combat-status-blocked'].indexOf(error.code) >= 0) throw error;
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
      if (!text) return Promise.resolve(api.getSnapshot());
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var targetUid = session.role === 'master' && speakerUid ? speakerUid : user.uid;
          var member = room.members && room.members[targetUid];
          if (!member || member.role !== 'player') throw roomError('Герой не найден в комнате.', 'player-missing');
          if (member.actionRequest && member.actionRequest.status === 'pending') throw roomError('Предыдущая заявка ещё ждёт решения мастера.', 'request-pending');
          var request = {
            id: 'action-' + targetUid.slice(0, 10) + '-' + now(), uid: targetUid,
            name: member.character && member.character.name || member.name || 'Герой',
            portrait: member.character && member.character.portrait || '',
            text: text, actionKind: actionKind, status: 'pending', createdAt: now(),
            testByMaster: session.role === 'master'
          };
          if (details && actionKind !== 'ability') {
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
            var usage=member.character&&member.character.abilityUsage&&member.character.abilityUsage[request.ability.resourceKey];
            if(request.ability.resourceMax&&usage&&Number(usage.used)>=request.ability.resourceMax)throw roomError('Заряды этой способности закончились.','ability-exhausted');
          }
          return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + targetUid), { actionRequest: request }).then(function () {
            return refreshRoom(session.code).then(function () { return api.getSnapshot(); });
          });
        });
      }).catch(function (error) {
        if (error && ['room-required','room-not-found','player-missing','request-pending','ability-exhausted'].indexOf(error.code) >= 0) throw error;
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
          var updates = {};
          updates['members/' + requestUid + '/actionRequest/status'] = accepted ? 'approved' : 'rejected';
          updates['members/' + requestUid + '/actionRequest/resolvedAt'] = resolvedAt;
          if (accepted && request.actionKind === 'combat-attack') {
            updates['members/' + requestUid + '/actionRequest/details/mode'] = ['advantage','disadvantage'].indexOf(resolution.mode) >= 0 ? resolution.mode : 'normal';
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
        if (error && ['master-only','room-not-found','request-missing'].indexOf(error.code) >= 0) throw error;
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
          var nextRequest=Object.assign({},request,{status:'damage-roll-requested',rollRequestedAt:now(),rollError:null});
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
            var option=heroOptions[member.uid]||{},bonus = Number(member.character.initiative || 0), mode=['advantage','disadvantage'].indexOf(option.mode)>=0?option.mode:'normal';
            var speed = Math.max(0, Number(member.character.speed) || 7);
            var entry = { key:'member:'+member.uid, kind:'hero', uid:member.uid, name:member.character.name || member.name || 'Герой', portrait:member.character.portrait || '', roll:null, rolls:[], rollMode:mode, bonus:bonus, total:null, initiativeGroup:'hero:'+member.uid, hp:Number(member.character.hpCur||0), hpMax:Number(member.character.hpMax||0), tempHp:Math.max(0,Number(member.character.tempHp)||0), ac:Number(member.character.ac||10), stats:member.character.stats||{}, mastery:member.character.mastery||[], weaponProfiles:member.character.weaponProfiles||[], resistances:member.character.resistances||[], vulnerabilities:member.character.vulnerabilities||[], immunities:member.character.immunities||[], statuses:Array.isArray(member.character.statuses)?member.character.statuses:[], statusEffects:Array.isArray(member.character.statusEffects)?member.character.statusEffects:[], economy:{ long:1, short:1, reaction:1, movement:speed, movementMax:speed } };
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
              level:Math.max(1,Math.min(99,Number(participant.level)||1)),
              roll:null, rolls:[], rollMode:mode, bonus:bonus, total:null, initiativeGroup:String(participant.group||participant.name||('group-'+index)).trim().slice(0,80), hp:participant.hp == null ? null : Math.max(0, Number(participant.hp) || 0),
              hpMax:participant.hpMax == null ? null : Math.max(0, Number(participant.hpMax) || 0), orderHint:index,
              tempHp:Math.min(Math.floor(Math.max(0,Number(participant.hpMax)||0)*0.5),Math.max(0,Number(participant.tempHp)||0)),
              ac:Math.max(0,Number(participant.ac)||10),stats:participant.stats||{},mastery:participant.mastery||[],weaponProfiles:Array.isArray(participant.weaponProfiles)?participant.weaponProfiles.slice(0,12):[],resistances:participant.resistances||[],vulnerabilities:participant.vulnerabilities||[],immunities:participant.immunities||[],
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
          var opening=order[0],tick=statusTurnTick(opening),stamp=now();opening.hp=tick.hp;order[0]=opening;
          var updates={combat:{active:true,phase:'active',round:1,turnIndex:0,order:order,startedAt:combat.startedAt||stamp,battleStartedAt:stamp,updatedAt:stamp},combatEvent:{id:'combat-start-'+stamp,kind:'combat',name:'Мир Зарготы',text:'Бой! Ход: '+(opening.name||'участник')+'.'+(tick.changes.length?' '+tick.changes.join('; '):''),ts:stamp},updatedAt:stamp};
          if(opening.uid)updates['members/'+opening.uid+'/character/hpCur']=Number(opening.hp||0);
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code);}).then(function(){return api.getSnapshot();});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','initiative-closed','initiative-pending'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    advanceCombat: function () {
      return ensureReady().then(function (user) {
        var session = readSession();
        if (!session) throw roomError('Сессия не найдена.', 'session-missing');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var combat = room.combat, order = combat && Array.isArray(combat.order) ? combat.order : [];
          if (!combat || !combat.active || !order.length) throw roomError('Сейчас нет активного боя.', 'combat-missing');
          var previous = Math.max(0, Math.min(order.length - 1, Number(combat.turnIndex) || 0));
          var activeEntry = order[previous];
          if (session.role !== 'master' && (!activeEntry || String(activeEntry.uid || '') !== String(user.uid))) throw roomError('Сейчас не ваш ход.', 'turn-owner-only');
          if (session.role === 'master' && room.masterUid !== user.uid) throw roomError('Эта комната принадлежит другому мастеру.', 'master-only');
          var next = (previous + 1) % order.length;
          var round = Number(combat.round || 1) + (next === 0 ? 1 : 0), stamp = now(), updates = {}, phaseNotes = [];
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
          var current = order[next], tick = statusTurnTick(current);
          current.hp = tick.hp;
          current.tempHp = tick.tempHp;
          order[next] = current;
          if (tick.changes.length) phaseNotes.push(tick.changes.join('; '));
          [ending,current].forEach(function (entry) {
            if (!entry || !entry.uid || !room.members || !room.members[entry.uid]) return;
            updates['members/'+entry.uid+'/character/statuses'] = entry.statuses || [];
            updates['members/'+entry.uid+'/character/statusEffects'] = entry.statusEffects || [];
            if (entry === current) {
              updates['members/'+entry.uid+'/character/hpCur'] = Number(entry.hp || 0);
              updates['members/'+entry.uid+'/character/tempHp'] = Math.max(0, Number(entry.tempHp) || 0);
            }
          });
          updates['combat/turnIndex']=next;updates['combat/round']=round;updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          updates.combatEvent={ id:'combat-turn-'+stamp, kind:'combat', name:'Мир Зарготы', text:'Ход: '+(current.name || 'участник')+'. Раунд '+round+'.'+(phaseNotes.length?' '+phaseNotes.join(' · '):''), ts:stamp };
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code), updates).then(function () { return refreshRoom(session.code).then(function () { return api.getSnapshot(); }); });
        });
      }).catch(function (error) {
        if (error && ['master-only','room-not-found','combat-missing'].indexOf(error.code) >= 0) throw error;
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
          var amount=Math.max(0,Math.min(9999,Math.floor(Number(operation.amount)||0))),text='';
          if(kind==='damage'){
            if(!amount)throw roomError('Укажите урон больше нуля.','adjust-invalid');
            var absorbed=Math.min(tempHp,amount);tempHp-=absorbed;hp=Math.max(0,hp-(amount-absorbed));text='Мастер наносит '+name+' '+amount+' урона'+(absorbed?' ('+absorbed+' поглощено временными HP)':'')+'.';
          }else if(kind==='heal'){
            if(!amount)throw roomError('Укажите лечение больше нуля.','adjust-invalid');
            hp=hpMax?Math.min(hpMax,hp+amount):hp+amount;text='Мастер восстанавливает '+name+' '+amount+' HP.';
          }else if(kind==='status'){
            var statusKey=String(operation.statusKey||'').toLowerCase();if(!/^[a-z0-9_-]{1,40}$/.test(statusKey))throw roomError('Выберите корректный эффект.','adjust-invalid');
            var active=statuses.some(function(status){return String(typeof status==='string'?status:status&&(status.statusKey||status.key||status.id)||'').toLowerCase()===statusKey;});
            var enable=operation.enable==null?!active:!!operation.enable;
            statuses=statuses.filter(function(status){return String(typeof status==='string'?status:status&&(status.statusKey||status.key||status.id)||'').toLowerCase()!==statusKey;});
            statusEffects=statusEffects.filter(function(effect){return String(effect&&(effect.statusKey||effect.key||effect.id)||'').toLowerCase()!==statusKey;});
            if(enable){statuses.push(statusKey);text='Мастер назначает '+name+' эффект «'+String(operation.label||statusKey).slice(0,60)+'».';}else{text='Мастер снимает с '+name+' эффект «'+String(operation.label||statusKey).slice(0,60)+'».';}
          }else throw roomError('Неизвестное действие пульта.','adjust-invalid');
          var updates={},stamp=now();
          function writeToken(path){if(kind==='damage'||kind==='heal'){updates[path+'/hp']=hp;updates[path+'/tempHp']=tempHp;}else{updates[path+'/statuses']=statuses;updates[path+'/statusEffects']=statusEffects;}}
          if(sceneIndex>=0)writeToken('scene/tokens/'+sceneIndex);
          Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===tokenId)writeToken('zones/'+zoneId+'/tokens/'+index);});});
          if(entry){if(kind==='damage'||kind==='heal'){entry.hp=hp;entry.tempHp=tempHp;}else{entry.statuses=statuses;entry.statusEffects=statusEffects;}order[combatIndex]=entry;updates['combat/order']=order;updates['combat/updatedAt']=stamp;}
          if(member){if(kind==='damage'||kind==='heal'){updates['members/'+memberUid+'/character/hpCur']=hp;updates['members/'+memberUid+'/character/tempHp']=tempHp;}else{updates['members/'+memberUid+'/character/statuses']=statuses;updates['members/'+memberUid+'/character/statusEffects']=statusEffects;}}
          var event={id:'gm-adjust-'+stamp,kind:kind==='heal'?'gm-heal':kind==='damage'?'gm-damage':'gm-status',name:'Мир Зарготы',text:text,targetKey:entry&&entry.key||'',targetTokenId:tokenId,targetUid:memberUid,amount:amount,hp:hp,tempHp:tempHp,statuses:statuses,ts:stamp};
          if(combat&&combat.active)updates.combatEvent=event;else Object.keys(room.members||{}).forEach(function(uid){updates['members/'+uid+'/messages/'+event.id]={id:event.id,uid:user.uid,kind:'world',name:'Мир Зарготы',portrait:'',text:text,ts:stamp};});
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','entity-missing','adjust-invalid'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
    },

    resolveCombatAttack: function (targetKey, options, participantKey) {
      options = options || {}; targetKey = String(targetKey || '').slice(0, 160); participantKey = String(participantKey || '').slice(0, 160);
      return ensureReady().then(function (user) {
        var session = readSession(); if (!session) throw roomError('Сначала войдите в комнату.', 'room-required');
        return readRoom(session.code).then(function (room) {
          if (!room) throw roomError('Комната больше недоступна.', 'room-not-found');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Сейчас нет активного боя.','combat-missing');
          var turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0)),attackerIndex=-1;
          if(session.role==='master')attackerIndex=participantKey?order.findIndex(function(entry){return entry&&entry.key===participantKey;}):turnIndex;
          else attackerIndex=order.findIndex(function(entry){return entry&&entry.uid===user.uid;});
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
          var keys=combatStatusKeys(attacker),mode=String(options.mode||'normal'),forcedDisadvantage=['stun','blind','fear'].some(function(key){return keys.indexOf(key)>=0;});
          if(forcedDisadvantage)mode='disadvantage';
          var first=rollDie(20),second=mode==='normal'?null:rollDie(20),natural=second==null?first:(mode==='advantage'?Math.max(first,second):Math.min(first,second));
          var attackTotal=natural+statBonus+masteryBonus,targetAc=Math.max(0,Number(target.ac)||10),critical=natural===20,failed=natural===1,hit=!failed&&(critical||attackTotal>=targetAc);
          economy.long=0;if(restrictions.slowed)economy.short=0;attacker.economy=economy;order[attackerIndex]=attacker;
          var stamp=now(),updates={},statLabels={str:'Сила',dex:'Ловкость',int:'Интеллект',cha:'Харизма',per:'Восприятие',con:'Выносливость'};
          updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          var rollText=second==null?String(natural):(first+' / '+second+' → '+natural),resultText=failed?'автопромах':(critical?'КРИТ':(hit?'попадание':'промах'));
          updates.combatEvent={id:'combat-attack-'+stamp,kind:critical?'combat-critical':'combat-attack',name:attacker.name||'Участник',portrait:attacker.portrait||'',text:'Атакует «'+(weapon.name||'оружием')+'» цель '+(target.name||'цель')+'. d20 '+rollText+' + '+statLabels[statKey]+' '+statBonus+(masteryBonus?' + мастерство '+masteryBonus:'')+' = '+attackTotal+' против AC '+targetAc+' — '+resultText+(hit?'. Ожидание урона.':''),attackRoll:natural,attackRolls:second==null?[first]:[first,second],rollMode:mode,attackTotal:attackTotal,targetAc:targetAc,hit:hit,critical:critical,damageFormula:String(weapon.damageFormula||'1d4'),damageStatBonus:statBonus,damageType:String(weapon.damageType||''),distanceCells:distance,rangeCells:rangeCells,targetKey:target.key,weapon:weapon.name||'Оружие',ts:stamp,revealAt:stamp+3200};
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','room-not-found','combat-missing','combat-not-turn','combat-target-invalid','combat-target-range','combat-zero-hp','combat-status-blocked','combat-action-spent'].indexOf(error.code)>=0)throw error;
        throw friendlyFirebaseError(error);
      });
    },

    resolveCombatDamage: function (targetKey, options, participantKey) {
      options=options||{};targetKey=String(targetKey||'').slice(0,160);participantKey=String(participantKey||'').slice(0,160);
      return ensureReady().then(function(user){
        var session=readSession();if(!session)throw roomError('Сначала войдите в комнату.','room-required');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
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
          var critical=!!options.critical;
          var damageResult=rollFormula(weapon.damageFormula||'1d4',critical);
          var rawDamage=Math.max(0,damageResult.total+statBonus),damage=rawDamage,damageType=String(weapon.damageType||''),resisted=combatHasDamageTrait(target.resistances,damageType),vulnerable=combatHasDamageTrait(target.vulnerabilities,damageType),immune=combatHasDamageTrait(target.immunities,damageType);
          if(immune)damage=0;else if(resisted&&!vulnerable)damage=Math.floor(damage/2);else if(vulnerable&&!resisted)damage*=2;
          var before=Math.max(0,Number(target.hp==null?target.hpMax:target.hp)||0),tempBefore=Math.max(0,Number(target.tempHp)||0),absorbed=Math.min(tempBefore,damage),hpDamage=Math.max(0,damage-absorbed),after=Math.max(0,before-hpDamage),tempAfter=Math.max(0,tempBefore-absorbed),reachedZero=before>0&&after===0;
          target.hp=after;target.tempHp=tempAfter;if(reachedZero)target.zeroHp={pending:true,reachedAt:now(),source:attacker.key};order[targetIndex]=target;
          var stamp=now(),updates={};
          updates['combat/order']=order;updates['combat/updatedAt']=stamp;
          if(target.uid){updates['members/'+target.uid+'/character/hpCur']=after;updates['members/'+target.uid+'/character/tempHp']=tempAfter;}
          if(target.tokenId){
            (room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+index+'/hp']=after;updates['scene/tokens/'+index+'/tempHp']=tempAfter;}});
            Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+index+'/hp']=after;updates['zones/'+zoneId+'/tokens/'+index+'/tempHp']=tempAfter;}});});
          }
          var damageNote=immune?' · иммунитет':(resisted&&!vulnerable?' · сопротивление':(vulnerable&&!resisted?' · уязвимость':(resisted&&vulnerable?' · сопротивление и уязвимость нейтрализованы':'')));
          updates.combatEvent={id:'combat-damage-'+stamp,kind:'combat-damage',name:attacker.name||'Участник',portrait:attacker.portrait||'',text:'Наносит урон оружием «'+(weapon.name||'оружие')+'» цели '+(target.name||'цель')+'. Урон '+damage+' ('+damageResult.formula+(critical?' ×2 кубы':'')+damageNote+').'+(absorbed?' Временные HP поглощают '+absorbed+(hpDamage?' — в здоровье проходит '+hpDamage+'.':'.'):'')+(reachedZero?' Цель достигает 0 HP — исход определяет мастер.':''),damage:damage,damageRolls:damageResult.rolls||[],damageFormula:damageResult.formula||String(weapon.damageFormula||'1d4'),damageStatBonus:statBonus,hpDamage:hpDamage,tempHpAbsorbed:absorbed,tempHpRemaining:tempAfter,rawDamage:rawDamage,damageType:damageType,targetKey:target.key,weapon:weapon.name||'Оружие',zeroHp:reachedZero,ts:stamp,revealAt:stamp+3200};
          updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){
        if(error&&['room-required','room-not-found','combat-missing','combat-participant-missing','combat-target-invalid'].indexOf(error.code)>=0)throw error;
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
          var keys = combatStatusKeys(target);
          var exhausted = (target.statuses || []).filter(function (status) { return status && typeof status === 'object' && (status.key === 'exhausted' || status.statusKey === 'exhausted'); })[0];
          if ((statKey === 'dex' && keys.indexOf('restrain') >= 0) || Number(exhausted && (exhausted.level || exhausted.stacks)) >= 3) mode = 'disadvantage';
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
          if (target.uid && success && removeKey) {
            updates['members/'+target.uid+'/character/statuses'] = target.statuses;
            updates['members/'+target.uid+'/character/statusEffects'] = target.statusEffects;
          }
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
      return ensureReady().then(function(user){
        var session=readSession();if(!session||session.role!=='master')throw roomError('Разыгрывать способности может только мастер.','master-only');
        return readRoom(session.code).then(function(room){
          if(!room)throw roomError('Комната больше недоступна.','room-not-found');
          var member=room.members&&room.members[requestUid],request=member&&member.actionRequest,ability=request&&request.ability;
          if(!request||request.status!=='pending'||!ability)throw roomError('Заявка способности уже обработана.','request-missing');
          var combat=room.combat,order=combat&&Array.isArray(combat.order)?combat.order.slice():[];
          if(!combat||!combat.active||!order.length)throw roomError('Разыграть способность можно только в активном бою.','combat-missing');
          var actorIndex=order.findIndex(function(entry){return entry&&entry.uid===requestUid;}),targetIndexes=targetKeys.map(function(key){return order.findIndex(function(entry){return entry&&entry.key===key;});});
          if(actorIndex<0)throw roomError('Участник способности не найден.','combat-participant-missing');
          var actor=combatEntryWithRoomStatuses(room,Object.assign({},order[actorIndex]));
          function safeFormula(value){value=String(value||'').trim().slice(0,18);return /^\d{1,2}d(?:4|6|8|10|12|20|100)(?:\s*[+-]\s*\d{1,3})?$/.test(value)?value.replace(/\s+/g,''):'';}
          function safeStat(value,fallback){value=String(value||'').toLowerCase();return ['str','dex','int','cha','per','con'].indexOf(value)>=0?value:fallback;}
          var effect=Object.assign({},ability),allowedModes=['utility','attack','save'],baseStatuses=Array.isArray(effect.statuses)?effect.statuses:String(effect.statuses||'').split(',');effect.resolutionMode=allowedModes.indexOf(overrides.resolutionMode)>=0?overrides.resolutionMode:(allowedModes.indexOf(effect.resolutionMode)>=0?effect.resolutionMode:'utility');effect.attackStat=safeStat(overrides.attackStat,effect.attackStat||'int');effect.saveStat=safeStat(overrides.saveStat,effect.saveStat||'con');effect.saveDC=overrides.saveDC===''||overrides.saveDC==null?effect.saveDC:Math.max(1,Math.min(99,Number(overrides.saveDC)||10));effect.damageFormula=safeFormula(overrides.damageFormula==null?effect.damageFormula:overrides.damageFormula);effect.healFormula=safeFormula(overrides.healFormula==null?effect.healFormula:overrides.healFormula);effect.damageType=String(overrides.damageType==null?effect.damageType:overrides.damageType).trim().slice(0,32);effect.halfOnSave=overrides.halfOnSave==null?!!effect.halfOnSave:!!overrides.halfOnSave;effect.durationRounds=Math.max(0,Math.min(99,Number(overrides.durationRounds==null?effect.durationRounds:overrides.durationRounds)||0));effect.concentration=overrides.concentration==null?!!effect.concentration:!!overrides.concentration;effect.statuses=Array.isArray(overrides.statuses)?overrides.statuses:String(overrides.statuses==null?baseStatuses.join(','):overrides.statuses).split(',');effect.statuses=effect.statuses.map(function(key){return String(key||'').trim().slice(0,48);}).filter(Boolean).slice(0,12);effect.areaMode=['circle','line','cone'].indexOf(overrides.areaMode)>=0?overrides.areaMode:'manual';effect.areaRadius=Math.max(1,Math.min(30,Number(overrides.areaRadius)||Number(effect.aoeRadius)||1));effect.areaWidth=Math.max(1,Math.min(12,Number(overrides.areaWidth)||1));effect.areaAnchorKey=String(overrides.areaAnchorKey||'').slice(0,160);
          var areaAnchorIndex=-1;if(effect.areaMode!=='manual'){areaAnchorIndex=order.findIndex(function(entry){return entry&&entry.key===effect.areaAnchorKey;});if(areaAnchorIndex<0||!combatEntryToken(room,order[areaAnchorIndex]))throw roomError('Центр или направление области не найдено на карте.','combat-area-anchor');targetIndexes=order.map(function(entry,index){if(effect.areaMode!=='circle'&&index===actorIndex)return-1;return combatAreaContains(room,effect.areaMode,order[actorIndex],order[areaAnchorIndex],entry,effect.areaRadius,effect.areaWidth)?index:-1;}).filter(function(index){return index>=0;});targetKeys=targetIndexes.map(function(index){return order[index].key;});}
          if(!targetIndexes.length||targetIndexes.some(function(index){return index<0;}))throw roomError('Цели способности не найдены.','combat-participant-missing');
          var resourceKey=String(effect.resourceKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100),resourceMax=Math.max(0,Math.min(99,Number(effect.resourceMax)||0)),abilityUsage=member.character&&member.character.abilityUsage||{},resourceState=resourceKey&&abilityUsage[resourceKey]||{},resourceUsed=Math.max(Number(resourceState.used)||0,Number(effect.resourceUsed)||0);if(resourceMax&&resourceUsed>=resourceMax)throw roomError('Заряды этой способности закончились.','ability-exhausted');
          var cost=['long','short','reaction','free'].indexOf(effect.actionCost)>=0?effect.actionCost:'long',turnIndex=Math.max(0,Math.min(order.length-1,Number(combat.turnIndex)||0));
          if((cost==='long'||cost==='short')&&actorIndex!==turnIndex)throw roomError('Долгие и короткие способности применяются только в свой ход.','combat-not-turn');
          var economy=Object.assign({long:1,short:1,reaction:1},actor.economy||{}),restrictions=combatRestrictions(actor);
          if(cost!=='free'&&restrictions.blocked[cost])throw roomError(restrictions.reasons[0]||'Текущее состояние запрещает способность.','combat-status-blocked');
          if(cost!=='free'&&Number(economy[cost]||0)<1)throw roomError('Нужное действие уже израсходовано.','combat-action-spent');
          var castStamp=now(),effectSource='ability-'+requestUid+'-'+castStamp,concentrationTouched=[];
          if(effect.concentration&&actor.concentration&&actor.concentration.sourceId){var previousSource=String(actor.concentration.sourceId);order=order.map(function(entry,index){entry=Object.assign({},entry);var beforeEffects=Array.isArray(entry.statusEffects)?entry.statusEffects:[],removed=beforeEffects.filter(function(item){return item&&String(item.sourceId||'')===previousSource;});if(!removed.length)return entry;entry.statusEffects=beforeEffects.filter(function(item){return !item||String(item.sourceId||'')!==previousSource;});var activeKeys=entry.statusEffects.map(function(item){return item&&(item.statusKey||item.key)||'';});entry.statuses=combatStatusKeys(entry).filter(function(key){return !removed.some(function(item){return (item.statusKey||item.key)===key;})||activeKeys.indexOf(key)>=0;});concentrationTouched.push(index);return entry;});actor=Object.assign({},order[actorIndex]);}
          var range=Math.max(0,Number(effect.rangeCells)||0),rangeIndexes=effect.areaMode==='circle'?[areaAnchorIndex]:(effect.areaMode==='manual'?targetIndexes:[]);if((effect.areaMode==='line'||effect.areaMode==='cone')&&range&&effect.areaRadius>range)throw roomError('Длина области '+effect.areaRadius+' кл. превышает дальность способности '+range+' кл.','combat-target-range');rangeIndexes.forEach(function(targetIndex){var distance=combatEntryDistance(room,actor,order[targetIndex]);if(range&&distance!=null&&distance>range)throw roomError((effect.areaMode!=='manual'?'Точка области':(order[targetIndex].name||'Цель'))+' слишком далеко: '+distance+' кл., дальность способности '+range+' кл.','combat-target-range');});
          var mode=effect.resolutionMode,results=[],damageType=String(effect.damageType||'');
          targetIndexes.forEach(function(targetIndex){
            var target=concentrationTouched.indexOf(targetIndex)>=0?Object.assign({},order[targetIndex]):combatEntryWithRoomStatuses(room,Object.assign({},order[targetIndex])),natural=null,rolls=[],modifier=0,total=null,success=true,dc=null;
            if(mode==='attack'){modifier=combatStat(actor,effect.attackStat);natural=rollDie(20);rolls=[natural];total=natural+modifier;dc=Math.max(0,Number(target.ac)||10);success=natural===20||(natural!==1&&total>=dc);}
            if(mode==='save'){modifier=combatStat(target,effect.saveStat);natural=rollDie(20);rolls=[natural];dc=effect.saveDC==null?10+combatStat(actor,effect.attackStat):Math.max(1,Number(effect.saveDC)||10);total=natural+modifier;success=natural===20||(natural!==1&&total>=dc);}
            var damageRoll=effect.damageFormula?rollFormula(effect.damageFormula,natural===20&&mode==='attack'):{total:0,formula:''},healRoll=effect.healFormula?rollFormula(effect.healFormula,false):{total:0,formula:''},damage=Math.max(0,Number(damageRoll.total)||0);if(mode==='attack'&&!success)damage=0;if(mode==='save'&&success)damage=effect.halfOnSave?Math.floor(damage/2):0;
            var immune=combatHasDamageTrait(target.immunities,damageType),resisted=combatHasDamageTrait(target.resistances,damageType),vulnerable=combatHasDamageTrait(target.vulnerabilities,damageType);if(immune)damage=0;else if(resisted&&!vulnerable)damage=Math.floor(damage/2);else if(vulnerable&&!resisted)damage*=2;
            var before=Math.max(0,Number(target.hp==null?target.hpMax:target.hp)||0),tempBefore=Math.max(0,Number(target.tempHp)||0),absorbed=Math.min(tempBefore,damage),hpDamage=Math.max(0,damage-absorbed),heal=Math.max(0,Number(healRoll.total)||0),after=Math.min(Math.max(before,Number(target.hpMax)||before),Math.max(0,before-hpDamage+heal));target.hp=after;target.tempHp=Math.max(0,tempBefore-absorbed);
            var applyStatuses=mode==='save'?!success:success;if(applyStatuses&&effect.statuses.length){target.statuses=Array.isArray(target.statuses)?target.statuses.slice():[];target.statusEffects=Array.isArray(target.statusEffects)?target.statusEffects.slice():[];effect.statuses.forEach(function(key){if(combatStatusKeys(target).indexOf(key)<0)target.statuses.push(key);if(effect.durationRounds||effect.concentration){target.statusEffects=target.statusEffects.filter(function(item){return !item||String(item.sourceId||'')!==effectSource||String(item.statusKey||item.key||'')!==key;});target.statusEffects.push({type:'status',statusKey:key,label:key,value:key,unit:effect.durationRounds?'rounds':'concentration',duration:effect.durationRounds||null,remaining:effect.durationRounds||null,sourceId:effectSource,sourceActorKey:actor.key,concentration:effect.concentration});}});}
            order[targetIndex]=target;results.push({key:target.key,name:target.name||'Цель',roll:natural,rolls:rolls,modifier:modifier,total:total,dc:dc,success:success,damage:damage,heal:heal,absorbed:absorbed,hp:after,tempHp:target.tempHp,statuses:applyStatuses?effect.statuses:[]});
          });
          if(cost!=='free')economy[cost]=Math.max(0,Number(economy[cost]||0)-1);if(restrictions.slowed&&(cost==='long'||cost==='short')){economy.long=0;economy.short=0;}order[actorIndex].economy=economy;if(effect.concentration)order[actorIndex].concentration={sourceId:effectSource,abilityKey:effect.key||'',name:effect.name||'Способность',startedAt:castStamp,durationRounds:effect.durationRounds||0};
          var stamp=now(),updates={};updates['combat/order']=order;updates['combat/updatedAt']=stamp;updates['members/'+requestUid+'/actionRequest/status']='approved';updates['members/'+requestUid+'/actionRequest/resolvedAt']=stamp;
          if(resourceKey&&resourceMax){updates['members/'+requestUid+'/character/abilityUsage/'+resourceKey]={used:resourceUsed+1,max:resourceMax,updatedAt:stamp};}
          targetIndexes.forEach(function(targetIndex,listIndex){var target=order[targetIndex],result=results[listIndex];if(target.uid){updates['members/'+target.uid+'/character/hpCur']=result.hp;updates['members/'+target.uid+'/character/tempHp']=result.tempHp;updates['members/'+target.uid+'/character/statuses']=target.statuses||[];updates['members/'+target.uid+'/character/statusEffects']=target.statusEffects||[];}if(target.tokenId){(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+index+'/hp']=result.hp;updates['scene/tokens/'+index+'/tempHp']=result.tempHp;updates['scene/tokens/'+index+'/statuses']=target.statuses||[];updates['scene/tokens/'+index+'/statusEffects']=target.statusEffects||[];}});Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,index){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+index+'/hp']=result.hp;updates['zones/'+zoneId+'/tokens/'+index+'/tempHp']=result.tempHp;updates['zones/'+zoneId+'/tokens/'+index+'/statuses']=target.statuses||[];updates['zones/'+zoneId+'/tokens/'+index+'/statusEffects']=target.statusEffects||[];}});});}});
          concentrationTouched.forEach(function(index){if(targetIndexes.indexOf(index)>=0)return;var target=order[index];if(target.uid){updates['members/'+target.uid+'/character/statuses']=target.statuses||[];updates['members/'+target.uid+'/character/statusEffects']=target.statusEffects||[];}if(target.tokenId){(room.scene&&Array.isArray(room.scene.tokens)?room.scene.tokens:[]).forEach(function(token,tokenIndex){if(token&&String(token.id)===String(target.tokenId)){updates['scene/tokens/'+tokenIndex+'/statuses']=target.statuses||[];updates['scene/tokens/'+tokenIndex+'/statusEffects']=target.statusEffects||[];}});Object.keys(room.zones||{}).forEach(function(zoneId){var tokens=room.zones[zoneId]&&room.zones[zoneId].tokens||[];tokens.forEach(function(token,tokenIndex){if(token&&String(token.id)===String(target.tokenId)){updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statuses']=target.statuses||[];updates['zones/'+zoneId+'/tokens/'+tokenIndex+'/statusEffects']=target.statusEffects||[];}});});}});
          var summaries=results.map(function(result){var outcome=mode==='save'?(result.success?'спасся':'провалил спасбросок'):mode==='attack'?(result.success?'попадание':'промах'):'эффект применён';return result.name+': '+outcome+(result.damage?' · урон '+result.damage:'')+(result.heal?' · лечение '+result.heal:'')+(result.statuses.length?' · '+result.statuses.join(', '):'');});var firstRoll=results.filter(function(result){return result.roll!=null;})[0]||{};
          updates.combatEvent={id:'combat-ability-'+stamp,kind:'combat-ability',name:actor.name||request.name||'Участник',portrait:actor.portrait||'',text:'Применяет «'+(effect.name||'способность')+'»'+(effect.areaMode!=='manual'?' по области «'+({circle:'круг',line:'линия',cone:'конус'}[effect.areaMode]||effect.areaMode)+'» длиной '+effect.areaRadius+' кл.':'')+'. '+summaries.join('; ')+'.'+(effect.durationRounds?' Длительность: '+effect.durationRounds+' р.':'')+(effect.concentration?' Требует концентрации.':''),ability:effect.name||'',abilityKey:effect.key||'',targetKeys:targetKeys,results:results,areaMode:effect.areaMode,areaRadius:effect.areaMode!=='manual'?effect.areaRadius:0,areaWidth:effect.areaMode==='line'?effect.areaWidth:0,areaAnchorKey:effect.areaMode!=='manual'?effect.areaAnchorKey:'',concentration:effect.concentration,durationRounds:effect.durationRounds,roll:firstRoll.roll==null?null:firstRoll.roll,rolls:firstRoll.rolls||[],total:firstRoll.total==null?null:firstRoll.total,dc:firstRoll.dc==null?null:firstRoll.dc,success:results.every(function(result){return result.success;}),damage:results.reduce(function(sum,result){return sum+result.damage;},0),heal:results.reduce(function(sum,result){return sum+result.heal;},0),ts:stamp,revealAt:stamp+(firstRoll.roll!=null?3200:500)};updates.updatedAt=stamp;
          return firebase.update(roomRef(session.code),updates).then(function(){return refreshRoom(session.code).then(function(){return api.getSnapshot();});});
        });
      }).catch(function(error){if(error&&['master-only','room-not-found','request-missing','combat-missing','combat-participant-missing','combat-area-anchor','combat-not-turn','combat-status-blocked','combat-action-spent','combat-target-range','ability-exhausted'].indexOf(error.code)>=0)throw error;throw friendlyFirebaseError(error);});
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

    beginRoll: function (sides, speakerUid, value, total, outcome, statLabel, clientRollId) {
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
          name: speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок'
        };
        if (member) { member.activeRoll = activeRoll; emit(); }
        try { window.dispatchEvent(new CustomEvent('zg-local-roll',{detail:{ownerUid:user.uid,roll:activeRoll}})); } catch(e) {}
        return firebase.update(firebase.ref(db, 'rooms/' + session.code + '/members/' + user.uid), {
          activeRoll: activeRoll
        }).catch(function () { return null; });
      }).catch(function () { return null; });
    },

    beginRollBatch: function (rolls, speakerUid, clientRollId) {
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
          speakerUid:speaker && speaker.uid || user.uid, name:speaker && speaker.character && speaker.character.name || speaker && speaker.name || 'Игрок' };
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
        return operation.then(function () {
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
        campaign: currentCampaign,
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
    try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
    return authModule.setPersistence(auth, authModule.browserSessionPersistence).then(function () {
      if(!readSession()&&auth.currentUser)return authModule.signOut(auth).then(function(){return authModule.signInAnonymously(auth).then(function(credential){return credential.user;});});
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
      watchCampaign();
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
