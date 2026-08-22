(function (w) {
  'use strict';

  var STORAGE_KEY = 'zargota_gm_delivery_library_v1';
  var FOLDERS_KEY = 'zargota_gm_delivery_folders_v1';
  var PANEL_WIDTH_KEY = 'zargota_gm_delivery_panel_width_v1';
  var HISTORY_KEY = 'zargota_gm_delivery_history_v1';
  var PRESENTED_KEY = 'zargota_gm_delivery_presented_v1';
  var MAX_IMAGE_BYTES = 250 * 1024;
  var MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
  var snapshot = null;
  var activeKind = 'item';
  var activeMood = 'calm';
  var DELIVERY_SOUND_LIBRARY = [
    {id:'auto',icon:'◇',title:'По типу',note:'Предмет или весть'},
    {id:'none',icon:'∅',title:'Без звука',note:'Тихая выдача'},
    {id:'paper',icon:'▤',title:'Шорох письма',note:'Бумага и сообщение',method:'playerDeliveryReceived'},
    {id:'seal',icon:'✒',title:'Печать мастера',note:'Короткое подтверждение',method:'gmDeliverySent'},
    {id:'reward',icon:'◆',title:'Получение вещи',note:'Награда и находка',method:'itemReward'},
    {id:'mystic',icon:'✦',title:'Мистический знак',note:'Магия и откровение',method:'statusCleanse'}
  ];
  var activeImage = '';
  var activeTarget = '';
  var activeTargets = [];
  var targetSelectionReady = false;
  var activeShelf = 'library';
  var activeDrawer = '';
  var activeView = 'home';
  var librarySearch = '';
  var libraryCategory = 'all';
  var librarySort = 'recent';
  var libraryFolder = 'all';
  var storageKind = 'all';
  var importSource = '';
  var importSearch = '';
  var importCategory = 'all';
  var importEquip = 'all';
  var itemBundle = [];
  var itemDeliveryMode = 'single';
  var itemEditorOpen = false;
  var drafts = Object.create(null);
  var activeTemplateIds = Object.create(null);
  var assetLibrary = [];
  var assetLibraryLoaded = false;
  var assetLibraryLoading = false;
  var assetSearch = '';
  var assetFilter = 'deliveries';
  var assetVisibleLimit = 24;
  var assetCleanupOpen = false;
  var assetCleanupPending = null;
  var assetCleanupBusy = false;
  var historyCleanupPending = null;
  var busy = false;
  var applying = Object.create(null);
  var popupQueue = [];
  var popupOpen = false;
  var sentNoticeTimer = 0;
  var presentedDeliveries = Object.create(null);
  var pendingMasterPanelRefresh = false;
  var masterPanelSnapshotSignature = '';
  var panelPointerActive = false;
  var panelResize = null;
  var shareDraft = null;
  var shareTargets = [];
  var shareBusy = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function node(id) { return document.getElementById(id); }

  function shareIconMarkup() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.3 10.9 7.4-4.4M8.3 13.1l7.4 4.4"></path></svg>';
  }
  w.zgShareIconMarkup = shareIconMarkup;

  function safeQuestId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  }

  function newQuestId() {
    var suffix = '';
    try {
      if (w.crypto && w.crypto.getRandomValues) {
        var values = new Uint32Array(2);
        w.crypto.getRandomValues(values);
        suffix = values[0].toString(36) + values[1].toString(36);
      }
    } catch (error) {}
    if (!suffix) suffix = Math.random().toString(36).slice(2);
    return safeQuestId('quest-' + Date.now().toString(36) + '-' + suffix);
  }

  function questStatus(value) {
    return ['new','active','completed','failed'].indexOf(value) >= 0 ? value : 'new';
  }

  function questImportance(value) {
    return value === 'secondary' ? 'secondary' : 'main';
  }

  function textDeliveryMode(value, saveToJournal) {
    value = String(value || '');
    if (['message','letter','place'].indexOf(value) >= 0) return value;
    return saveToJournal === false ? 'message' : 'letter';
  }

  function textDeliveryModeLabel(value, saveToJournal) {
    return {message:'Сообщение',letter:'Письмо',place:'Место'}[textDeliveryMode(value, saveToJournal)] || 'Письмо';
  }

  function textDeliveryModeIcon(value, saveToJournal) {
    return {message:'◌',letter:'✉',place:'⌖'}[textDeliveryMode(value, saveToJournal)] || '✉';
  }

  function textDeliveryDestination(value, saveToJournal) {
    return {
      message:'Только уведомление · после просмотра не сохраняется',
      letter:'Журнал героя → Заметки · письмо останется у игрока',
      place:'Журнал героя → Места · описание останется у игрока'
    }[textDeliveryMode(value, saveToJournal)] || 'Журнал героя → Заметки';
  }

  var QUEST_ICONS = [
    {icon:'✦',label:'Цель'},
    {icon:'⚔',label:'Бой'},
    {icon:'⚑',label:'Поручение'},
    {icon:'⛨',label:'Защита'},
    {icon:'◈',label:'Тайна'},
    {icon:'☩',label:'Святыня'}
  ];

  function questIcon(value) {
    value = String(value || '');
    return QUEST_ICONS.some(function (option) { return option.icon === value; }) ? value : '✦';
  }

  function questIconOptions(value) {
    value = questIcon(value);
    return QUEST_ICONS.map(function (option) {
      return '<option value="' + esc(option.icon) + '"' + selected(value,option.icon) + '>' + esc(option.icon + ' ' + option.label) + '</option>';
    }).join('');
  }

  function emptyLibrary() {
    return { item:[], quest:[], text:[], image:[] };
  }

  function loadLibrary() {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      var result = emptyLibrary();
      Object.keys(result).forEach(function (kind) {
        result[kind] = Array.isArray(value[kind]) ? value[kind].slice(0, 80) : [];
      });
      return result;
    } catch (error) { return emptyLibrary(); }
  }

  function loadHistory() {
    try {
      var value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(value) ? value.filter(function (entry) {
        return entry && entry.id && entry.value && entry.value.kind;
      }).slice(0, 100) : [];
    } catch (error) { return []; }
  }

  function loadFolders() {
    try {
      var rows = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter(function (folder) { return folder && folder.id && folder.name; }).slice(0, 12) : [];
    } catch (error) { return []; }
  }

  function saveFolders() {
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(libraryFolders.slice(0, 12))); return true; }
    catch (error) { if (w.showToast) w.showToast('Не удалось сохранить папки'); return false; }
  }

  function saveLibrary(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      if (w.showToast) w.showToast('Не удалось сохранить библиотеку ГМ');
      return false;
    }
  }

  var library = loadLibrary();
  var libraryFolders = loadFolders();
  var history = loadHistory();

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
      return true;
    } catch (error) {
      if (w.showToast) w.showToast('Не удалось сохранить историю выдач');
      return false;
    }
  }

  function ensureUi() {
    if (!document.body || node('zg-gm-delivery-panel')) return;
    var panel = document.createElement('aside');
    panel.id = 'zg-gm-delivery-panel';
    panel.className = 'zg-gm-delivery-panel';
    panel.setAttribute('aria-label', 'Выдача игрокам');
    panel.innerHTML =
      '<button type="button" class="zg-gm-delivery-resize" aria-label="Изменить ширину окна" title="Потяните, чтобы изменить ширину"></button>' +
      '<header><div><small>ВЕДЕНИЕ ИГРЫ</small><b>Выдать игроку</b></div><button type="button" onclick="zgGmDeliveryToggle(false)" aria-label="Закрыть">×</button></header>' +
      '<div id="zg-gm-delivery-body"></div>';
    document.body.appendChild(panel);
    try {
      var savedWidth = Math.min(Math.round(Number(localStorage.getItem(PANEL_WIDTH_KEY)) || 0), Math.max(560, window.innerWidth - 28));
      if (savedWidth >= 560) { panel.style.width = savedWidth + 'px'; panel.classList.add('user-sized'); }
    } catch (ignore) {}
    var resizeHandle = panel.querySelector('.zg-gm-delivery-resize');
    resizeHandle.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || matchMedia('(max-width:620px)').matches) return;
      event.preventDefault();
      panelResize = { id:event.pointerId, startX:event.clientX, startWidth:panel.getBoundingClientRect().width };
      panel.classList.add('resizing');
      try { resizeHandle.setPointerCapture(event.pointerId); } catch (ignore) {}
    });
    resizeHandle.addEventListener('pointermove', function (event) {
      if (!panelResize || event.pointerId !== panelResize.id) return;
      var width = Math.max(560, Math.min(window.innerWidth - 28, panelResize.startWidth + panelResize.startX - event.clientX));
      panel.style.width = Math.round(width) + 'px';panel.classList.add('user-sized');
    });
    function finishResize(event) {
      if (!panelResize || event && event.pointerId !== panelResize.id) return;
      panelResize = null;panel.classList.remove('resizing');
      try { localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(panel.getBoundingClientRect().width))); } catch (ignore) {}
    }
    resizeHandle.addEventListener('pointerup', finishResize);
    resizeHandle.addEventListener('pointercancel', finishResize);
    function finishPanelInteraction() {
      panelPointerActive = false;
      setTimeout(flushPendingMasterPanelRefresh, 0);
    }
    panel.addEventListener('pointerdown', function () { panelPointerActive = true; }, true);
    panel.addEventListener('pointerup', finishPanelInteraction, true);
    panel.addEventListener('pointercancel', finishPanelInteraction, true);
    panel.addEventListener('focusout', function () { setTimeout(flushPendingMasterPanelRefresh, 0); });

    var sentNotice = document.createElement('div');
    sentNotice.id = 'zg-gm-delivery-sent-notice';
    sentNotice.className = 'zg-gm-delivery-sent-notice';
    sentNotice.setAttribute('role', 'status');
    sentNotice.setAttribute('aria-live', 'polite');
    document.body.appendChild(sentNotice);

    var popup = document.createElement('div');
    popup.id = 'zg-player-delivery-popup';
    popup.className = 'zg-player-delivery-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.innerHTML = '<article><button type="button" class="zg-delivery-popup-close" onclick="zgGmDeliveryClosePopup()" aria-label="Закрыть">×</button><div id="zg-player-delivery-popup-body"></div><button type="button" class="zg-delivery-popup-done" onclick="zgGmDeliveryClosePopup()">Продолжить</button></article>';
    document.body.appendChild(popup);

    var shareMenu = document.createElement('div');
    shareMenu.id = 'zg-player-share-menu';
    shareMenu.className = 'zg-player-share-menu';
    shareMenu.setAttribute('role', 'dialog');
    shareMenu.setAttribute('aria-modal', 'true');
    shareMenu.setAttribute('aria-label', 'Показать участникам');
    shareMenu.innerHTML = '<article><header><i>' + shareIconMarkup() + '</i><span><small>ПОКАЗАТЬ УЧАСТНИКАМ</small><b>Кому открыть карточку?</b></span><button type="button" onclick="zgSharePresentationClose()" aria-label="Закрыть">×</button></header><div id="zg-player-share-targets"></div><footer><button type="button" onclick="zgSharePresentationClose()">Выйти</button><button id="zg-player-share-send" type="button" onclick="zgSharePresentationSend()">Поделиться</button></footer></article>';
    shareMenu.addEventListener('click', function (event) { if (event.target === shareMenu) w.zgSharePresentationClose(); });
    document.body.appendChild(shareMenu);
  }

  function shareRecipients() {
    var room = snapshot && snapshot.room || {}, session = snapshot && snapshot.session || {}, rows = [], seen = {};
    function add(uid, member, role) {
      uid = String(uid || '');
      if (!uid || uid === String(session.uid || '') || seen[uid]) return;
      seen[uid] = true;
      member = member || {};
      var character = member.character || {};
      rows.push({uid:uid, role:role, name:character.name || member.name || (role === 'master' ? 'Гейм-мастер' : 'Игрок'), portrait:character.portrait || character.image || character.avatar || ''});
    }
    if (room.masterUid) add(room.masterUid, room.members && room.members[room.masterUid], 'master');
    Object.keys(room.members || {}).forEach(function (uid) {
      var member = room.members[uid] || {};
      if (member.role === 'player' && member.online !== false) add(uid, member, 'player');
    });
    return rows;
  }

  function renderShareMenu() {
    ensureUi();
    var host = node('zg-player-share-targets'), send = node('zg-player-share-send');
    if (!host) return;
    var recipients = shareRecipients();
    host.innerHTML = recipients.length ? recipients.map(function (member) {
      var active = shareTargets.indexOf(member.uid) >= 0;
      var art = member.portrait ? '<img src="' + esc(member.portrait) + '" alt="">' : '<i class="portrait-fallback">' + esc(member.role === 'master' ? 'ГМ' : String(member.name || '?').slice(0,1)) + '</i>';
      return '<button type="button" class="zg-player-share-target' + (active ? ' active' : '') + '" data-share-uid="' + esc(member.uid) + '" onclick="zgSharePresentationToggle(this.dataset.shareUid)" aria-pressed="' + active + '">' + art + '<span><b>' + esc(member.name) + '</b><small>' + esc(member.role === 'master' ? 'Гейм-мастер' : 'Подключённый герой') + '</small></span><i class="selection-mark">✓</i></button>';
    }).join('') : '<p class="zg-player-share-empty"><b>Никого нет в комнате</b><br><span>Подключённые участники появятся здесь.</span></p>';
    if (send) {
      send.disabled = shareBusy || !shareDraft || !shareTargets.length;
      send.textContent = shareBusy ? 'Отправляем…' : 'Поделиться';
    }
  }

  w.zgSharePresentationOpen = function (value, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!snapshot || !snapshot.session || snapshot.session.role !== 'player') {
      if (w.showToast) w.showToast('Показывать карточки может подключённый игрок.');
      return;
    }
    shareDraft = value && typeof value === 'object' ? value : null;
    shareTargets = [];
    shareBusy = false;
    renderShareMenu();
    var menu = node('zg-player-share-menu');
    if (menu) requestAnimationFrame(function () { menu.classList.add('open'); });
  };
  w.zgSharePresentationToggle = function (uid) {
    uid = String(uid || '');
    var index = shareTargets.indexOf(uid);
    if (index >= 0) shareTargets.splice(index, 1); else if (uid) shareTargets.push(uid);
    renderShareMenu();
  };
  w.zgSharePresentationClose = function () {
    var menu = node('zg-player-share-menu');
    if (menu) menu.classList.remove('open');
    shareDraft = null; shareTargets = []; shareBusy = false;
  };
  w.zgSharePresentationSend = function () {
    if (shareBusy || !shareDraft || !shareTargets.length || !w.ZargotaRooms || typeof w.ZargotaRooms.sharePresentation !== 'function') return;
    shareBusy = true; renderShareMenu();
    w.ZargotaRooms.sharePresentation(shareTargets, shareDraft).then(function () {
      if (w.showToast) w.showToast('Карточка показана выбранным участникам.');
      w.zgSharePresentationClose();
    }).catch(function (error) {
      shareBusy = false; renderShareMenu();
      if (w.showToast) w.showToast(error && error.message || 'Не удалось показать карточку.');
    });
  };

  function showGmSentNotice(value, members, queued) {
    ensureUi();
    var notice = node('zg-gm-delivery-sent-notice');
    if (!notice) return;
    var names = (Array.isArray(members) ? members : []).map(function (member) {
      return member && member.character && member.character.name || member && member.name || 'Игрок';
    });
    var target = names.length > 1 ? 'Вся группа · ' + names.length : names[0] || 'Игрок';
    var detail = queued ? 'Нет связи — выдача сохранена и отправится автоматически · ' + target : (value && value.title || kindLabel(value && value.kind)) + ' → ' + target;
    clearTimeout(sentNoticeTimer);
    notice.className = 'zg-gm-delivery-sent-notice' + (queued ? ' queued' : '');
    notice.innerHTML = '<i>' + (queued ? '⌛' : '✓') + '</i><span><small>' + esc(queued ? 'ОЖИДАЕТ СОЕДИНЕНИЯ' : 'ВЫДАЧА ДОСТАВЛЕНА В КОМНАТУ') + '</small><b>' + esc(queued ? 'Карточка сохранена' : 'Карточка отправлена') + '</b><em>' + esc(detail) + '</em></span>';
    requestAnimationFrame(function () { notice.classList.add('open'); });
    sentNoticeTimer = setTimeout(function () { notice.classList.remove('open'); }, queued ? 3000 : 2400);
  }

  function claimDeliveryPresentation(deliveryId) {
    deliveryId = String(deliveryId || '');
    if (!deliveryId || presentedDeliveries[deliveryId]) return false;
    var ids = [];
    try {
      ids = JSON.parse(sessionStorage.getItem(PRESENTED_KEY) || '[]');
      if (!Array.isArray(ids)) ids = [];
    } catch (error) { ids = []; }
    if (ids.indexOf(deliveryId) >= 0) {
      presentedDeliveries[deliveryId] = true;
      return false;
    }
    presentedDeliveries[deliveryId] = true;
    ids.push(deliveryId);
    try { sessionStorage.setItem(PRESENTED_KEY, JSON.stringify(ids.slice(-120))); } catch (error) {}
    return true;
  }

  function playerMembers() {
    var room = snapshot && snapshot.room;
    return Object.keys(room && room.members || {}).map(function (uid) {
      var member = room.members[uid] || {};
      if (!member.uid) member.uid = uid;
      return member;
    }).filter(function (member) {
      return member.role === 'player' && member.characterId && member.character;
    });
  }

  function deliveryEditorActive() {
    var active = document.activeElement;
    return !!(active && active.closest && active.closest('#zg-gm-delivery-body input, #zg-gm-delivery-body textarea, #zg-gm-delivery-body select, #zg-gm-delivery-body [contenteditable="true"]'));
  }

  function deliveryPanelInteractionActive() {
    if (panelPointerActive || deliveryEditorActive()) return true;
    var active = document.activeElement;
    return !!(active && active.closest && active.closest('#zg-gm-delivery-body button'));
  }

  function flushPendingMasterPanelRefresh() {
    var panel = node('zg-gm-delivery-panel');
    if (!pendingMasterPanelRefresh || deliveryPanelInteractionActive() || !panel || !panel.classList.contains('open')) return;
    pendingMasterPanelRefresh = false;
    renderPanel();
  }

  // The delivery composer only depends on recipient identity. Combat snapshots
  // may change HP, statuses, turns and timestamps several times per second; none
  // of those changes should replace the composer's DOM or cancel a button click.
  function masterPanelDataSignature(nextSnapshot) {
    var room = nextSnapshot && nextSnapshot.room || {};
    var members = Object.keys(room.members || {}).map(function (uid) {
      var member = room.members[uid] || {}, character = member.character || {};
      return {
        uid:String(member.uid || uid),
        role:String(member.role || ''),
        characterId:String(member.characterId || character.id || character.campaignKey || ''),
        memberName:String(member.name || ''),
        characterName:String(character.name || ''),
        portrait:String(character.portrait || character.image || character.avatar || character.portraitUrl || '')
      };
    }).filter(function (member) {
      return member.role === 'player' && member.characterId;
    }).sort(function (first, second) {
      return first.uid < second.uid ? -1 : first.uid > second.uid ? 1 : 0;
    });
    return JSON.stringify({roomCode:String(room.code || ''),members:members});
  }

  function currentForm() {
    var title = node('zg-gm-delivery-title');
    var text = node('zg-gm-delivery-text');
    if (activeKind === 'item' && !title) {
      var stored = JSON.parse(JSON.stringify(draftForKind('item')));
      stored.mood = activeMood;
      stored.soundId = deliverySoundId(node('zg-gm-delivery-sound') && node('zg-gm-delivery-sound').value || stored.soundId);
      stored.showPopup = !!(node('zg-gm-delivery-popup-toggle') && node('zg-gm-delivery-popup-toggle').checked);
      stored.payload = stored.payload || {};
      stored.payload.rarity = itemRarity(node('zg-gm-delivery-rarity') && node('zg-gm-delivery-rarity').value || stored.payload.rarity);
      stored.payload.presentationFx = itemPresentationFx(node('zg-gm-delivery-fx') && node('zg-gm-delivery-fx').value || stored.payload.presentationFx);
      return stored;
    }
    var payload = {};
    if (activeKind === 'item') {
      payload = {
        name:title && title.value,
        icon:node('zg-gm-delivery-icon') && node('zg-gm-delivery-icon').value,
        category:node('zg-gm-delivery-category') && node('zg-gm-delivery-category').value,
        qty:node('zg-gm-delivery-qty') && node('zg-gm-delivery-qty').value,
        description:text && text.value,
        effects:node('zg-gm-delivery-effects') && node('zg-gm-delivery-effects').value,
        damageFormula:node('zg-gm-delivery-damage') && node('zg-gm-delivery-damage').value,
        damageType:node('zg-gm-delivery-damage-type') && node('zg-gm-delivery-damage-type').value,
        acBonus:node('zg-gm-delivery-ac') && node('zg-gm-delivery-ac').value,
        attackStat:node('zg-gm-delivery-attack-stat') && node('zg-gm-delivery-attack-stat').value,
        range:node('zg-gm-delivery-range') && node('zg-gm-delivery-range').value,
        weight:node('zg-gm-delivery-weight') && node('zg-gm-delivery-weight').value,
        slot:node('zg-gm-delivery-slot') && node('zg-gm-delivery-slot').value,
        rarity:itemRarity(node('zg-gm-delivery-rarity') && node('zg-gm-delivery-rarity').value),
        presentationFx:itemPresentationFx(node('zg-gm-delivery-fx') && node('zg-gm-delivery-fx').value)
      };
    } else if (activeKind === 'quest') {
      payload = {
        questId:safeQuestId(node('zg-gm-delivery-quest-id') && node('zg-gm-delivery-quest-id').value) || newQuestId(),
        icon:questIcon(node('zg-gm-delivery-quest-icon') && node('zg-gm-delivery-quest-icon').value),
        status:questStatus(node('zg-gm-delivery-quest-status') && node('zg-gm-delivery-quest-status').value),
        importance:questImportance(node('zg-gm-delivery-quest-importance') && node('zg-gm-delivery-quest-importance').value),
        playerCanDelete:!!(node('zg-gm-delivery-player-delete') && node('zg-gm-delivery-player-delete').checked)
      };
    } else if (activeKind === 'image') {
      payload = {
        saveToJournal:!!(node('zg-gm-delivery-save-journal') && node('zg-gm-delivery-save-journal').checked),
        playerCanDelete:!!(node('zg-gm-delivery-player-delete') && node('zg-gm-delivery-player-delete').checked),
        compression:['compact','balanced','quality'].indexOf(node('zg-gm-delivery-compression') && node('zg-gm-delivery-compression').value) >= 0
          ? node('zg-gm-delivery-compression').value
          : 'balanced'
      };
    } else if (activeKind === 'text') {
      var textMode = textDeliveryMode(node('zg-gm-delivery-text-mode') && node('zg-gm-delivery-text-mode').value);
      payload = {
        journalMode:textMode,
        saveToJournal:textMode !== 'message',
        playerCanDelete:textMode === 'message' || !!(node('zg-gm-delivery-player-delete') && node('zg-gm-delivery-player-delete').checked)
      };
    }
    return {
      kind:activeKind,
      mood:activeMood,
      soundId:deliverySoundId(node('zg-gm-delivery-sound') && node('zg-gm-delivery-sound').value || draftForKind(activeKind).soundId),
      presentation:activeKind === 'image' && node('zg-gm-delivery-presentation') && node('zg-gm-delivery-presentation').value === 'cinematic' ? 'cinematic' : 'card',
      privateDelivery:activeKind === 'text' && !!(node('zg-gm-delivery-private') && node('zg-gm-delivery-private').checked),
      showPopup:!!(node('zg-gm-delivery-popup-toggle') && node('zg-gm-delivery-popup-toggle').checked),
      title:String(title && title.value || '').trim(),
      text:String(text && text.value || '').trim(),
      image:String(node('zg-gm-delivery-image') && node('zg-gm-delivery-image').value || activeImage || '').trim(),
      payload:payload
    };
  }

  function rememberPanelDraft() {
    if (!node('zg-gm-delivery-title') && !(activeKind === 'item' && !itemEditorOpen)) return;
    drafts[activeKind] = currentForm();
  }

  function draftForKind(kind) {
    var value = drafts[kind];
    if (value) return value;
    value = {
      kind:kind,mood:activeMood,soundId:'auto',presentation:'card',privateDelivery:false,showPopup:true,title:'',text:'',image:'',
      payload:kind === 'item'
        ? {icon:'📦',qty:1,category:'other',acBonus:0,attackStat:'str',range:'1 клетка',weight:0,slot:'',rarity:'common',presentationFx:'none'}
        : kind === 'quest'
          ? {questId:newQuestId(),icon:'✦',status:'new',importance:'main',playerCanDelete:true}
          : kind === 'image'
            ? {saveToJournal:false,compression:'balanced',playerCanDelete:true}
          : kind === 'text'
            ? {journalMode:'letter',saveToJournal:true,playerCanDelete:true}
            : {}
    };
    drafts[kind] = value;
    return value;
  }

  function selected(value, expected) {
    return String(value == null ? '' : value) === String(expected) ? ' selected' : '';
  }

  function deliverySoundId(value) {
    value = String(value || 'auto').toLowerCase();
    return DELIVERY_SOUND_LIBRARY.some(function (sound) { return sound.id === value; }) ? value : 'auto';
  }

  function deliverySound(value) {
    var id = deliverySoundId(value);
    return DELIVERY_SOUND_LIBRARY.filter(function (sound) { return sound.id === id; })[0] || DELIVERY_SOUND_LIBRARY[0];
  }

  function playDeliverySound(delivery) {
    delivery = delivery || {};
    var sound = deliverySound(delivery.soundId);
    if (sound.id === 'none') return false;
    if (sound.id === 'auto') {
      if (delivery.kind === 'item' && w.ZargotaSound && typeof w.ZargotaSound.itemReward === 'function') {
        w.ZargotaSound.itemReward();
        return true;
      }
      if (w.ZargotaSound && typeof w.ZargotaSound.playerDeliveryReceived === 'function') {
        w.ZargotaSound.playerDeliveryReceived();
        return true;
      }
      return false;
    }
    if (!sound.method || !w.ZargotaSound || typeof w.ZargotaSound[sound.method] !== 'function') return false;
    w.ZargotaSound[sound.method]();
    return true;
  }

  function deliverySoundLibraryMarkup(value) {
    if (['item','quest','text'].indexOf(activeKind) < 0) return '';
    var activeId = deliverySoundId(value);
    var activeSound = deliverySound(activeId);
    return '<section class="zg-gm-delivery-sounds"><input id="zg-gm-delivery-sound" type="hidden" value="' + esc(activeId) + '">' +
      '<header><span><small>ЗВУК ПОЛУЧЕНИЯ</small><b>' + esc(activeSound.title) + '</b></span><button type="button" onclick="zgGmDeliverySoundPreview()" ' + (activeId === 'none' ? 'disabled' : '') + ' aria-label="Прослушать выбранный звук">▶ Прослушать</button></header>' +
      '<div>' + DELIVERY_SOUND_LIBRARY.map(function (sound) {
        return '<button type="button" class="' + (sound.id === activeId ? 'active' : '') + '" data-sound-id="' + esc(sound.id) + '" onclick="zgGmDeliverySound(\'' + esc(sound.id) + '\')"><i>' + esc(sound.icon) + '</i><span><b>' + esc(sound.title) + '</b><small>' + esc(sound.note) + '</small></span></button>';
      }).join('') + '</div></section>';
  }

  function itemCategoryLabel(category) {
    return {all:'Все категории',other:'Другое',weapon:'Оружие',armor:'Броня',shield:'Щит',consumable:'Расходник',material:'Материал',key:'Ключ'}[category] || 'Другое';
  }

  function itemRarity(value) {
    value = String(value || '').toLowerCase();
    return ['common','uncommon','rare','epic','legendary'].indexOf(value) >= 0 ? value : 'common';
  }

  function itemRarityLabel(value) {
    return {common:'Обычный',uncommon:'Необычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'}[itemRarity(value)];
  }

  function itemPresentationFx(value) {
    value = String(value || '').toLowerCase();
    return ['none','dust','embers','arcane'].indexOf(value) >= 0 ? value : 'none';
  }

  function filteredTemplates() {
    var query = librarySearch.trim().toLowerCase();
    var result = (library[activeKind] || []).filter(function (template) {
      if (!template) return false;
      if (libraryFolder === 'unfiled' && template.folderId) return false;
      if (libraryFolder !== 'all' && libraryFolder !== 'unfiled' && String(template.folderId || '') !== libraryFolder) return false;
      if (activeKind === 'item' && libraryCategory !== 'all' && String(template.payload && template.payload.category || 'other') !== libraryCategory) return false;
      if (!query) return true;
      return [template.title,template.text,template.payload && template.payload.effects,template.payload && template.payload.damageType]
        .join(' ').toLowerCase().indexOf(query) >= 0;
    });
    result.sort(function (first, second) {
      if (librarySort === 'title') return String(first.title || '').localeCompare(String(second.title || ''), 'ru');
      if (librarySort === 'category') return String(first.payload && first.payload.category || '').localeCompare(String(second.payload && second.payload.category || ''), 'ru') || String(first.title || '').localeCompare(String(second.title || ''), 'ru');
      return Number(second.updatedAt || second.createdAt || 0) - Number(first.updatedAt || first.createdAt || 0);
    });
    return result;
  }

  function folderOptions(value) {
    return '<option value=""' + selected(value,'') + '>Без папки</option>' + libraryFolders.map(function (folder) {
      return '<option value="' + esc(folder.id) + '"' + selected(value,folder.id) + '>' + esc(folder.name) + '</option>';
    }).join('');
  }

  function folderTabsMarkup() {
    function count(folderId) { return (library[activeKind] || []).filter(function (item) { return folderId === 'all' || folderId === 'unfiled' ? !item.folderId : item.folderId === folderId; }).length; }
    var tabs = '<button type="button" class="' + (libraryFolder === 'all' ? 'active' : '') + '" onclick="zgGmDeliveryLibraryFolder(\'all\')">Все <i>' + (library[activeKind] || []).length + '</i></button>' +
      '<button type="button" class="' + (libraryFolder === 'unfiled' ? 'active' : '') + '" onclick="zgGmDeliveryLibraryFolder(\'unfiled\')">Без папки <i>' + count('unfiled') + '</i></button>' +
      libraryFolders.map(function (folder) { return '<button type="button" class="' + (libraryFolder === folder.id ? 'active' : '') + '" onclick="zgGmDeliveryLibraryFolder(\'' + esc(folder.id) + '\')">' + esc(folder.name) + ' <i>' + count(folder.id) + '</i></button>'; }).join('');
    return '<nav class="zg-gm-delivery-folders">' + tabs + '<button type="button" class="add" onclick="zgGmDeliveryFolderAdd()">＋ Папка</button>' + (libraryFolder !== 'all' && libraryFolder !== 'unfiled' ? '<button type="button" class="remove" onclick="zgGmDeliveryFolderRemove()" aria-label="Удалить папку">×</button>' : '') + '</nav>';
  }

  function externalCategory(value) {
    value = String(value || '').toLowerCase();
    if (value === 'weapon') return 'weapon';
    if (value === 'armor') return 'armor';
    if (value === 'shield') return 'shield';
    if (value === 'potion' || value === 'food' || value === 'consumable') return 'consumable';
    if (value === 'material') return 'material';
    if (value === 'key') return 'key';
    return 'other';
  }

  function externalSlot(value, category) {
    value = String(value || '').toLowerCase();
    if (['main_hand','off_hand','two_hand'].indexOf(value) >= 0 || category === 'weapon') return 'weapon';
    if (value === 'body' || category === 'armor' || category === 'shield') return 'armor';
    if (value === 'head') return 'head';
    if (value === 'cloak') return 'cloak';
    if (value === 'gloves') return 'hands';
    if (value === 'boots') return 'legs';
    if (['amulet','ring','artifact','accessory'].indexOf(value) >= 0) return 'accessory1';
    return '';
  }

  function normalizeExternalItem(raw, source, index) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var category = externalCategory(raw.category || raw.cat || raw.type);
    var armorBonus = raw.acBonus != null ? raw.acBonus : raw.defense != null ? raw.defense : raw.armorAc ? Math.max(0, Number(raw.armorAc) - 10) : 0;
    return {
      id:source + '-' + String(raw.id || raw.key || index).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100),
      externalSource:source,
      externalId:String(raw.id || raw.key || index),
      kind:'item',mood:'calm',showPopup:true,
      title:String(raw.name || raw.title || 'Предмет').slice(0, 180),
      text:String(raw.description || raw.desc || raw.text || raw.effect || '').slice(0, 6000),
      // The catalog already provides small 192px JPEG thumbnails.  Delivery cards use
      // those instead of decoding the full shop illustration in a long picker.
      image:String(raw.imageThumb || raw.image || '').slice(0, 350000),
      payload:{
        name:String(raw.name || raw.title || 'Предмет').slice(0, 200),
        icon:w.ZargotaItemIcons ? w.ZargotaItemIcons.valueFor(raw) : String(raw.icon || 'art:backpack').slice(0, 40),
        category:category,qty:1,
        description:String(raw.description || raw.desc || raw.text || raw.effect || '').slice(0, 4000),
        effects:String(raw.effects || raw.effect || '').slice(0, 2000),
        damageFormula:String(raw.damageFormula || raw.damage || '').slice(0, 40),
        damageType:String(raw.damageType || '').slice(0, 80),
        acBonus:Number(armorBonus) || 0,
        attackStat:String(raw.attackStat || raw.stat || (raw.name && /рапир|лук|кинжал/i.test(raw.name) ? 'dex' : 'str')),
        range:String(raw.range || '').slice(0, 80),
        weight:Math.max(0, Number(raw.weight || raw.mass) || 0),
        slot:externalSlot(raw.slot, category),
        rarity:itemRarity(raw.rarity),
        presentationFx:itemPresentationFx(raw.presentationFx)
      },
      createdAt:Number(raw.createdAt) || Date.now(),
      updatedAt:Date.now()
    };
  }

  function externalItems(source, ignoreSearch) {
    var rows = [];
    try {
      if (source === 'armory') rows = typeof w.loadArmoryItems === 'function' ? w.loadArmoryItems() : JSON.parse(localStorage.getItem('zargota_armory_v1') || '[]');
      if (source === 'shop') rows = typeof w.loadShopItems === 'function' ? w.loadShopItems() : JSON.parse(localStorage.getItem('zargota_shop_v1') || '[]');
      if (source === 'quest') rows = typeof w.loadQuestShopItems === 'function' ? w.loadQuestShopItems() : JSON.parse(localStorage.getItem('zargota_gm_quest_items_v1') || '[]');
    } catch (error) { rows = []; }
    return (Array.isArray(rows) ? rows : []).map(function (item, index) { return normalizeExternalItem(item, source, index); }).filter(function (item) {
      var query = ignoreSearch ? '' : importSearch.trim().toLowerCase();
      if (!ignoreSearch && importCategory !== 'all' && item.payload.category !== importCategory) return false;
      if (!ignoreSearch && importEquip === 'equipment' && !item.payload.slot) return false;
      if (!ignoreSearch && importEquip === 'backpack' && item.payload.slot) return false;
      return !query || (item.title + ' ' + item.text + ' ' + item.payload.category).toLowerCase().indexOf(query) >= 0;
    }).slice(0, 120);
  }

  function externalItemById(id) {
    return externalItems(importSource, true).filter(function (item) {
      return item && item.id === id;
    })[0] || null;
  }

  function itemValueForBundle(value) {
    value = value || {};
    return {
      name:value.title || value.payload && value.payload.name || 'Предмет',
      title:value.title || value.payload && value.payload.name || 'Предмет',
      text:value.text || value.payload && value.payload.description || '',
      image:value.image || '',
      icon:value.payload && value.payload.icon || 'art:backpack',
      category:value.payload && value.payload.category || 'other',
      qty:Math.max(1, Number(value.payload && value.payload.qty) || 1),
      description:value.payload && value.payload.description || value.text || '',
      effects:value.payload && value.payload.effects || '',
      damageFormula:value.payload && value.payload.damageFormula || '',
      damageType:value.payload && value.payload.damageType || '',
      acBonus:Number(value.payload && value.payload.acBonus) || 0,
      attackStat:value.payload && value.payload.attackStat || '',
      range:value.payload && value.payload.range || '',
      weight:Math.max(0, Number(value.payload && value.payload.weight) || 0),
      slot:value.payload && value.payload.slot || '',
      rarity:itemRarity(value.payload && value.payload.rarity),
      presentationFx:itemPresentationFx(value.payload && value.payload.presentationFx)
    };
  }

  function bundledSendValue(value) {
    if (itemDeliveryMode !== 'bundle') return value;
    return {
      kind:'item',mood:value.mood,soundId:deliverySoundId(value.soundId),showPopup:value.showPopup,
      title:'Набор предметов · ' + itemBundle.length,
      text:'Мастер передаёт набор предметов.',
      image:'',
      payload:{items:itemBundle.map(function (item) { return itemValueForBundle(item); })}
    };
  }

  function addBundleItem(value) {
    if (!value || value.kind !== 'item' || !value.title) {
      if (w.showToast) w.showToast('Сначала укажите предмет');
      return false;
    }
    var incoming = JSON.parse(JSON.stringify(value));
    var incomingKey = String(incoming.externalSource || '') + ':' + String(incoming.externalId || incoming.id || '');
    var existing = itemBundle.filter(function (item) {
      var itemKey = String(item.externalSource || '') + ':' + String(item.externalId || item.id || '');
      return incomingKey !== ':' && itemKey === incomingKey;
    })[0];
    if (existing) {
      existing.payload = existing.payload || {};
      existing.payload.qty = Math.min(999, Math.max(1, Number(existing.payload.qty) || 1) + Math.max(1, Number(incoming.payload && incoming.payload.qty) || 1));
      return true;
    }
    if (itemBundle.length >= 20) {
      if (w.showToast) w.showToast('В одной выдаче может быть до 20 разных предметов');
      return false;
    }
    itemBundle.push(incoming);
    return true;
  }

  function previewMarkup(value) {
    value = value || draftForKind(activeKind);
    var payload = value.payload || {}, icon = payload.icon || kindIcon(value.kind);
    var textMode = value.kind === 'text' ? textDeliveryMode(payload.journalMode, payload.saveToJournal) : '';
    if (textMode) icon = textDeliveryModeIcon(textMode);
    if (value.kind === 'item' && itemDeliveryMode === 'bundle') {
      return '<article class="zg-gm-delivery-preview-card bundle-summary"><i>▦</i><div><small>Набор предметов</small><b>' +
        esc(itemBundle.length ? 'Подготовлено: ' + itemBundle.length : 'Набор пока пуст') + '</b><p>' +
        esc(itemBundle.length ? 'Игрок получит все позиции одной аккуратной сводкой.' : 'Добавьте предметы из хранилища или каталога.') +
        '</p></div></article>';
    }
    var tags = [];
    if (value.kind === 'item') {
      tags.push(itemRarityLabel(payload.rarity));
      if (payload.category) tags.push(itemCategoryLabel(payload.category));
      if (payload.damageFormula) tags.push(payload.damageFormula + (payload.damageType ? ' · ' + payload.damageType : ''));
      if (Number(payload.acBonus)) tags.push('AC ' + (Number(payload.acBonus) > 0 ? '+' : '') + Number(payload.acBonus));
      if (payload.range) tags.push(payload.range);
      if (Number(payload.weight)) tags.push('Вес ' + Number(payload.weight));
      tags.push('×' + Math.max(1, Number(payload.qty) || 1));
    }
    if (value.kind === 'text') {
      tags.push(textMode === 'message' ? 'Не сохраняется' : textMode === 'place' ? 'Журнал · Места' : 'Журнал · Заметки');
      if (value.privateDelivery) tags.push('Скрытый канал');
    }
    return '<article class="zg-gm-delivery-preview-card mood-' + esc(value.mood || activeMood) + ' rarity-' + esc(itemRarity(payload.rarity)) + ' fx-' + esc(itemPresentationFx(payload.presentationFx)) + '">' +
      (value.image ? '<img src="' + esc(value.image) + '" alt="">' : value.kind === 'item' && w.ZargotaItemIcons ? '<i>' + w.ZargotaItemIcons.markup(payload) + '</i>' : '<i>' + esc(icon) + '</i>') +
      '<div><small>' + esc(textMode ? textDeliveryModeLabel(textMode) : kindLabel(value.kind)) + '</small><b>' + esc(value.title || 'Название') + '</b>' +
      '<p>' + esc(value.text || payload.description || 'Описание появится здесь.') + '</p>' +
      (tags.length ? '<footer>' + tags.map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '</footer>' : '') +
      '</div></article>';
  }

  function artworkMarkup(value, fallback, extraClass) {
    value = value || {};
    var payload = value.payload || {};
    var image = String(value.image || payload.imageThumb || payload.image || '');
    var className = extraClass ? ' class="' + esc(extraClass) + '"' : '';
    if (!image && (value.kind === 'item' || activeKind === 'item') && w.ZargotaItemIcons) {
      return '<i' + className + '>' + w.ZargotaItemIcons.markup(payload) + '</i>';
    }
    return image
      ? '<img' + className + ' src="' + esc(image) + '" alt="" loading="lazy" decoding="async">'
      : '<i' + className + '>' + esc(fallback || payload.icon || '📦') + '</i>';
  }

  function historyTargetNames(entry) {
    return Array.isArray(entry.targetNames) && entry.targetNames.length ? entry.targetNames.join(', ') : 'Игрок';
  }

  function historyShelfMarkup() {
    var confirm = '';
    if (historyCleanupPending) {
      var count = historyCleanupPending.mode === 'all' ? history.length : 1;
      confirm = '<section class="zg-gm-delivery-history-confirm"><small>Очистка журнала</small><b>' +
        esc(historyCleanupPending.mode === 'all' ? 'Удалить всю историю выдач?' : 'Удалить эту запись из истории?') +
        '</b><p>Заготовки в хранилище и уже выданные игрокам предметы, задания или изображения останутся без изменений.</p><strong>' + count + ' ' + (count === 1 ? 'запись' : 'записей') +
        '</strong><div><button type="button" onclick="zgGmDeliveryHistoryCleanupCancel()">Отмена</button><button type="button" class="danger" onclick="zgGmDeliveryHistoryCleanupConfirm()">Удалить</button></div></section>';
    }
    var rows = history.length ? history.slice(0, 50).map(function (entry) {
      var archivedImage = entry.value && entry.value.image || '';
      var archivedMode = entry.value && entry.value.kind === 'text' ? textDeliveryMode(entry.value.payload && entry.value.payload.journalMode, entry.value.payload && entry.value.payload.saveToJournal) : '';
      return '<article class="' + esc(entry.status || 'sent') + '">' +
        (archivedImage ? '<img src="' + esc(archivedImage) + '" alt="">' : '<i>' + (archivedMode ? textDeliveryModeIcon(archivedMode) : kindIcon(entry.value.kind)) + '</i>') +
        '<div><small>' + esc(archivedMode ? textDeliveryModeLabel(archivedMode) : kindLabel(entry.value.kind)) + ' · ' + esc(historyTargetNames(entry)) + '</small><b>' + esc(entry.value.title || 'Выдача') + '</b><span>' + new Date(Number(entry.createdAt) || Date.now()).toLocaleString('ru-RU') + (entry.value.imageOmittedFromHistory ? ' · изображение не сохранено' : '') + '</span></div>' +
        '<footer><button type="button" onclick="zgGmDeliveryArchive(\'' + esc(entry.id) + '\')">Сохранить как заготовку</button><button type="button" onclick="zgGmDeliveryRepeat(\'' + esc(entry.id) + '\')" ' + (busy ? 'disabled' : '') + '>Повторить</button><button type="button" class="remove" onclick="zgGmDeliveryHistoryDeleteRequest(\'' + esc(entry.id) + '\')" aria-label="Удалить из истории">Удалить</button></footer></article>';
    }).join('') : '<p>Отправленные выдачи появятся здесь.</p>';
    return '<section class="zg-gm-delivery-history"><header><span><small>Журнал мастера</small><b>' + history.length + ' записей</b></span><button type="button" onclick="zgGmDeliveryHistoryClearRequest()" ' + (history.length ? '' : 'disabled') + '>Очистить историю</button></header>' + confirm + rows + '</section>';
  }

  function bundleMarkup() {
    if (activeKind !== 'item' || itemDeliveryMode !== 'bundle') return '';
    return '<section class="zg-gm-delivery-bundle"><header><div><small>Одна выдача</small><b>Набор предметов</b></div><span>' + itemBundle.length + ' / 20</span></header>' +
      (itemBundle.length ? '<div>' + itemBundle.map(function (item, index) {
        var payload = item.payload || {};
        return '<article>' + artworkMarkup(item, payload.icon || '📦', 'zg-gm-delivery-item-art') + '<span><b>' + esc(item.title || payload.name || 'Предмет') + '</b><small>' + esc(itemCategoryLabel(payload.category || 'other')) + ' · ×' + Math.max(1, Number(payload.qty) || 1) + '</small></span><button type="button" onclick="zgGmDeliveryBundleRemove(' + index + ')" aria-label="Убрать из набора">×</button></article>';
      }).join('') + '</div><button type="button" class="clear" onclick="zgGmDeliveryBundleClear()">Очистить набор</button>' : '<p>Добавьте текущий предмет или заготовки из библиотеки.</p>') +
      '<button type="button" class="add" onclick="zgGmDeliveryBundleAddCurrent()">＋ Добавить текущий предмет</button></section>';
  }

  function itemModeMarkup() {
    if (activeKind !== 'item') return '';
    return '<section class="zg-gm-delivery-item-mode"><header><small>ФОРМАТ ВЫДАЧИ</small><b>Что получит игрок</b></header><div>' +
      '<button type="button" class="' + (itemDeliveryMode === 'single' ? 'active' : '') + '" onclick="zgGmDeliveryItemMode(\'single\')"><i>◆</i><span><b>Один предмет</b><small>Большая карточка с полной информацией</small></span></button>' +
      '<button type="button" class="' + (itemDeliveryMode === 'bundle' ? 'active' : '') + '" onclick="zgGmDeliveryItemMode(\'bundle\')"><i>▦</i><span><b>Набор</b><small>Несколько вещей одной выдачей</small></span></button>' +
      '</div></section>';
  }

  function itemPresentationMarkup(payload) {
    if (activeKind !== 'item' || itemDeliveryMode !== 'single') return '';
    payload = payload || {};
    return '<fieldset class="zg-gm-delivery-item-look"><legend>Оформление получения</legend>' +
      '<label>Редкость<select id="zg-gm-delivery-rarity"><option value="common"' + selected(itemRarity(payload.rarity),'common') + '>Обычный</option><option value="uncommon"' + selected(itemRarity(payload.rarity),'uncommon') + '>Необычный</option><option value="rare"' + selected(itemRarity(payload.rarity),'rare') + '>Редкий</option><option value="epic"' + selected(itemRarity(payload.rarity),'epic') + '>Эпический</option><option value="legendary"' + selected(itemRarity(payload.rarity),'legendary') + '>Легендарный</option></select></label>' +
      '<label>Частицы<select id="zg-gm-delivery-fx"><option value="none"' + selected(itemPresentationFx(payload.presentationFx),'none') + '>Без частиц</option><option value="dust"' + selected(itemPresentationFx(payload.presentationFx),'dust') + '>Золотая пыль</option><option value="embers"' + selected(itemPresentationFx(payload.presentationFx),'embers') + '>Искры и угли</option><option value="arcane"' + selected(itemPresentationFx(payload.presentationFx),'arcane') + '>Магические огни</option></select></label>' +
      '</fieldset>';
  }

  function previewHeaderMarkup() {
    if (activeKind === 'item') return '<header><small>ТАК УВИДИТ ИГРОК</small><b>' + (itemDeliveryMode === 'bundle' ? 'Сводка набора' : 'Карточка одного предмета') + '</b></header>';
    return '<header><small>ТАК УВИДИТ ИГРОК</small><b>Карточка выдачи</b></header>';
  }

  function importMarkup() {
    if (!importSource || activeKind !== 'item') return '';
    var rows = externalItems(importSource);
    var sourceLabel = importSource === 'quest' ? 'Квестовые вещи ГМ' : 'Товары';
    var sourceCaption = importSource === 'quest' ? 'ЗАКРЫТОЕ ХРАНИЛИЩЕ МАСТЕРА' : 'ЕДИНЫЙ КАТАЛОГ';
    return '<section class="zg-gm-delivery-import"><header><div><small>' + sourceCaption + '</small><b>' + sourceLabel + '</b></div><button type="button" onclick="zgGmDeliveryImportClose()">×</button></header>' +
      '<input type="search" value="' + esc(importSearch) + '" placeholder="Найти в источнике" oninput="zgGmDeliveryImportSearch(this.value)">' +
      '<div class="zg-gm-delivery-import-filters"><select onchange="zgGmDeliveryImportCategory(this.value)"><option value="all"' + selected(importCategory,'all') + '>Все категории</option><option value="weapon"' + selected(importCategory,'weapon') + '>Оружие</option><option value="armor"' + selected(importCategory,'armor') + '>Броня</option><option value="shield"' + selected(importCategory,'shield') + '>Щиты</option><option value="consumable"' + selected(importCategory,'consumable') + '>Расходники</option><option value="material"' + selected(importCategory,'material') + '>Материалы</option><option value="key"' + selected(importCategory,'key') + '>Ключи</option><option value="other"' + selected(importCategory,'other') + '>Другое</option></select><select onchange="zgGmDeliveryImportEquip(this.value)"><option value="all"' + selected(importEquip,'all') + '>Любое назначение</option><option value="equipment"' + selected(importEquip,'equipment') + '>Экипируемое</option><option value="backpack"' + selected(importEquip,'backpack') + '>В рюкзак</option></select></div>' +
      '<div>' + (rows.length ? rows.map(function (item) {
        return '<article>' + artworkMarkup(item, item.payload.icon || '📦', 'zg-gm-delivery-item-art') + '<span><b>' + esc(item.title) + '</b><small>' + esc(itemCategoryLabel(item.payload.category) + (item.payload.damageFormula ? ' · ' + item.payload.damageFormula : '') + (item.payload.acBonus ? ' · AC +' + item.payload.acBonus : '')) + '</small></span><button type="button" onclick="zgGmDeliveryImportOne(\'' + esc(item.id) + '\')">Выбрать один</button><button type="button" onclick="zgGmDeliveryImportBundle(\'' + esc(item.id) + '\')" aria-label="Добавить в набор">＋</button></article>';
      }).join('') : '<p>В этом источнике пока нет предметов.</p>') + '</div></section>';
  }

  function requestAssetLibrary(force) {
    if ((!force && (assetLibraryLoaded || assetLibraryLoading)) || !w.zgImageStore || typeof (w.zgImageStore.listMetadata || w.zgImageStore.listAll) !== 'function') return;
    assetLibraryLoading = true;
    (w.zgImageStore.listMetadata || w.zgImageStore.listAll)(function (items) {
      assetLibrary = (Array.isArray(items) ? items : []).filter(function (item) {
        return item && item.path && /^images\//i.test(String(item.path));
      }).sort(function (first, second) {
        return Number(second.createdAt || 0) - Number(first.createdAt || 0);
      });
      assetLibraryLoaded = true;
      assetLibraryLoading = false;
      var panel = node('zg-gm-delivery-panel');
      if (panel && panel.classList.contains('open') && (activeKind === 'image' || activeKind === 'quest')) {
        if (deliveryEditorActive()) pendingMasterPanelRefresh = true;
        else renderPanel();
      }
    });
  }

  function formatAssetBytes(bytes) {
    bytes = Math.max(0, Number(bytes) || 0);
    if (bytes < 1024) return Math.round(bytes) + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' МБ';
  }

  function assetBytes(asset) {
    return Math.max(0, Number(asset && (asset.size || asset.blob && asset.blob.size)) || 0);
  }

  function deliveryValueUsesAsset(value, path) {
    if (!value || !path) return false;
    if (String(value.image || '') === path) return true;
    var payload = value.payload || {};
    if (payload.item && String(payload.item.image || '') === path) return true;
    if (payload.quest && String(payload.quest.image || '') === path) return true;
    return (Array.isArray(payload.items) ? payload.items : []).some(function (item) { return item && String(item.image || '') === path; });
  }

  function assetReferenced(path) {
    path = String(path || '');
    if (!path) return false;
    var imageInput = node('zg-gm-delivery-image');
    if (String(activeImage || '') === path || imageInput && String(imageInput.value || '') === path) return true;
    if (Object.keys(drafts).some(function (kind) { return deliveryValueUsesAsset(drafts[kind], path); })) return true;
    if (Object.keys(library).some(function (kind) { return (library[kind] || []).some(function (value) { return deliveryValueUsesAsset(value, path); }); })) return true;
    if (history.some(function (entry) { return deliveryValueUsesAsset(entry && entry.value, path); })) return true;
    return itemBundle.some(function (value) { return deliveryValueUsesAsset(value, path); });
  }

  function assetVisibleItems() {
    var query = assetSearch.trim().toLowerCase();
    return assetLibrary.filter(function (asset) {
      var path = String(asset && asset.path || ''), published = asset && asset.published === true;
      if (assetFilter === 'deliveries' && path.indexOf('images/deliveries/') !== 0) return false;
      if (assetFilter === 'local' && published) return false;
      if (assetFilter === 'published' && !published) return false;
      return !query || path.toLowerCase().indexOf(query) >= 0;
    });
  }

  function assetRemoveAllowed(asset) {
    var path = String(asset && asset.path || '');
    if (!path || path.indexOf('images/deliveries/') !== 0) return false;
    if (asset.published === true) return true;
    return !assetReferenced(path);
  }

  function assetCardsMarkup() {
    var filtered = assetVisibleItems(), visible = filtered.slice(0, assetVisibleLimit);
    var cards = visible.map(function (asset) {
      var path = String(asset.path || ''), published = asset.published === true, removable = assetRemoveAllowed(asset);
      var name = path.split('/').pop() || 'Иллюстрация', encoded = encodeURIComponent(path), size = formatAssetBytes(assetBytes(asset));
      var removeTitle = removable ? (published ? 'Удалить локальный кэш опубликованного файла' : 'Удалить иллюстрацию с этого устройства') : 'Файл используется или управляется другим разделом';
      return '<article class="' + (published ? 'published' : 'local') + '"><button type="button" class="pick" ' +
        (published ? 'onclick="zgGmDeliveryUseAsset(decodeURIComponent(\'' + encoded + '\'))"' : 'disabled') +
        ' title="' + esc(published ? 'Выбрать иллюстрацию' : 'Сначала опубликуйте медиа-пакет') + '">' +
        '<img src="' + esc(path) + '" alt="" loading="lazy" decoding="async"><span><b>' + esc(name) + '</b><small>' + (published ? 'Готово игрокам' : 'Только на этом устройстве') + ' · ' + size + '</small></span></button>' +
        '<button type="button" class="remove" onclick="zgGmDeliveryAssetDeleteRequest(decodeURIComponent(\'' + encoded + '\'))" title="' + esc(removeTitle) + '" aria-label="Удалить ' + esc(name) + '" ' + (removable ? '' : 'disabled') + '>×</button></article>';
    }).join('');
    var empty = assetLibraryLoading ? '<em>Читаем библиотеку…</em>' : '<em>' + (assetFilter === 'deliveries' ? 'Иллюстраций выдачи пока нет. Переключите фильтр на «Все», чтобы использовать изображения из других разделов.' : 'По этому фильтру ничего не найдено.') + '</em>';
    return (cards || empty) + (filtered.length > visible.length ? '<button type="button" class="more" onclick="zgGmDeliveryAssetMore()">Показать ещё · ' + (filtered.length - visible.length) + '</button>' : '');
  }

  function assetLibraryMeta() {
    var filtered = assetVisibleItems(), bytes = filtered.reduce(function (total, asset) { return total + assetBytes(asset); }, 0);
    return filtered.length + ' из ' + assetLibrary.length + ' · ' + formatAssetBytes(bytes);
  }

  function assetCleanupCandidates(mode) {
    if (mode === 'published') return assetLibrary.filter(function (asset) {
      return asset && asset.published === true && String(asset.path || '').indexOf('images/deliveries/') === 0;
    });
    return assetLibrary.filter(function (asset) {
      var path = String(asset && asset.path || '');
      return asset && asset.published !== true && path.indexOf('images/deliveries/') === 0 && !assetReferenced(path);
    });
  }

  function assetCleanupMarkup() {
    if (!assetCleanupOpen) return '';
    var published = assetCleanupCandidates('published'), local = assetCleanupCandidates('local');
    var publishedBytes = published.reduce(function (sum, asset) { return sum + assetBytes(asset); }, 0), localBytes = local.reduce(function (sum, asset) { return sum + assetBytes(asset); }, 0);
    var pending = assetCleanupPending, pendingItems = pending && pending.paths || [];
    if (pending) return '<section class="zg-gm-delivery-cleanup confirm"><small>Подтверждение очистки</small><b>' + esc(pending.title) + '</b><p>' + esc(pending.note) + '</p><strong>' + pendingItems.length + ' файлов · ' + formatAssetBytes(pendingItems.reduce(function (sum, path) { var asset = assetLibrary.filter(function (item) { return item.path === path; })[0]; return sum + assetBytes(asset); }, 0)) + '</strong><div><button type="button" onclick="zgGmDeliveryAssetCleanupCancel()">Отмена</button><button type="button" class="danger" onclick="zgGmDeliveryAssetCleanupConfirm()" ' + (assetCleanupBusy ? 'disabled' : '') + '>' + (assetCleanupBusy ? 'Удаляем…' : 'Удалить') + '</button></div></section>';
    return '<section class="zg-gm-delivery-cleanup"><header><span><small>Безопасная очистка</small><b>Что убрать с устройства</b></span><button type="button" onclick="zgGmDeliveryAssetCleanupToggle(false)">×</button></header><div><button type="button" onclick="zgGmDeliveryAssetCleanupRequest(\'published\')" ' + (published.length ? '' : 'disabled') + '><i>✓</i><span><b>Кэш опубликованных</b><small>Файлы проекта останутся доступны</small></span><strong>' + published.length + ' · ' + formatAssetBytes(publishedBytes) + '</strong></button><button type="button" class="danger" onclick="zgGmDeliveryAssetCleanupRequest(\'local\')" ' + (local.length ? '' : 'disabled') + '><i>⌫</i><span><b>Неиспользуемые выдачи</b><small>Только локальные файлы папки deliveries</small></span><strong>' + local.length + ' · ' + formatAssetBytes(localBytes) + '</strong></button></div><p>Портреты, магазин, активные карточки и используемые иллюстрации очистка не затронет.</p></section>';
  }

  function assetLibraryMarkup() {
    if (activeKind !== 'image' && activeKind !== 'quest') return '';
    return '<section class="zg-gm-delivery-assets"><header><div><small>Вне игровой комнаты</small><b>Библиотека иллюстраций</b><em id="zg-gm-delivery-assets-meta">' + assetLibraryMeta() + '</em></div><span><button type="button" onclick="zgGmDeliveryRefreshAssets()">Обновить</button><button type="button" class="cleanup" onclick="zgGmDeliveryAssetCleanupToggle()">Очистить</button></span></header>' +
      '<p>Крупные файлы сохраняются отдельно и отправляются игрокам только ссылкой. Локальный файл станет доступен после публикации медиа-пакета.</p>' +
      '<div class="zg-gm-delivery-assets-tools"><input id="zg-gm-delivery-assets-search" type="search" value="' + esc(assetSearch) + '" placeholder="Найти по имени…" oninput="zgGmDeliveryAssetSearch(this.value)"><select onchange="zgGmDeliveryAssetFilter(this.value)"><option value="deliveries"' + selected(assetFilter,'deliveries') + '>Файлы выдачи</option><option value="all"' + selected(assetFilter,'all') + '>Все изображения</option><option value="local"' + selected(assetFilter,'local') + '>Только локальные</option><option value="published"' + selected(assetFilter,'published') + '>Опубликованные</option></select></div>' +
      assetCleanupMarkup() + '<div class="zg-gm-delivery-assets-list">' + assetCardsMarkup() + '</div>' +
      '<input id="zg-gm-delivery-asset-file" type="file" accept="image/*" hidden><button type="button" class="add" onclick="document.getElementById(\'zg-gm-delivery-asset-file\').click()">＋ Добавить крупную иллюстрацию</button></section>';
  }

  function kindLabel(kind) {
    return {item:'Предмет', spell:'Заклинание', ability:'Способность', quest:'Задание', text:'Журнал', image:'Изображение'}[kind] || 'Сообщение';
  }

  function kindIcon(kind) {
    return {item:'▣', spell:'✧', ability:'✦', quest:'◇', text:'✉', image:'▧'}[kind] || '✦';
  }

  function textModeMarkup(payload) {
    var mode = textDeliveryMode(payload && payload.journalMode, payload && payload.saveToJournal);
    return '<section class="zg-gm-delivery-text-mode"><header><small>КУДА ПОПАДЁТ КАРТОЧКА</small><b>Выберите назначение</b></header>' +
      '<input id="zg-gm-delivery-text-mode" type="hidden" value="' + esc(mode) + '"><div>' +
        [['message','◌','Сообщение','Показать один раз'],['letter','✉','Письмо','Сохранить в заметках'],['place','⌖','Место','Сохранить в местах']].map(function (option) {
          return '<button type="button" class="' + (mode === option[0] ? 'active' : '') + '" onclick="zgGmDeliveryTextMode(\'' + option[0] + '\')"><i>' + option[1] + '</i><span><b>' + option[2] + '</b><small>' + option[3] + '</small></span></button>';
        }).join('') +
      '</div><p><i>' + textDeliveryModeIcon(mode) + '</i><span><small>ПОСЛЕ ВЫДАЧИ</small><b>' + esc(textDeliveryDestination(mode)) + '</b></span></p></section>';
  }

  function allPreparedArtifacts() {
    return Object.keys(emptyLibrary()).reduce(function (rows, kind) {
      return rows.concat((library[kind] || []).map(function (entry) {
        var copy = Object.assign({}, entry || {});
        copy.kind = kind;
        return copy;
      }));
    }, []).sort(function (first, second) {
      return Number(second.updatedAt || second.createdAt || 0) - Number(first.updatedAt || first.createdAt || 0);
    });
  }

  function reconcileTargetSelection(members) {
    var valid = members.map(function (member) { return String(member.uid); });
    if (!targetSelectionReady) {
      if (activeTarget === '__all__') activeTargets = valid.slice();
      else if (valid.indexOf(String(activeTarget || '')) >= 0) activeTargets = [String(activeTarget)];
      else activeTargets = valid.length ? [valid[0]] : [];
      targetSelectionReady = true;
    } else {
      activeTargets = activeTargets.filter(function (uid, index, list) {
        return valid.indexOf(String(uid)) >= 0 && list.indexOf(uid) === index;
      });
    }
    activeTarget = activeTargets.length > 1 && activeTargets.length === valid.length ? '__all__' : activeTargets[0] || '';
  }

  function memberPortrait(member) {
    var character = member && member.character || {};
    return String(character.portrait || character.image || character.avatar || character.portraitUrl || '');
  }

  function targetCardsMarkup(members) {
    if (!members.length) return '<p class="zg-gm-delivery-target-empty">Нет подключённых игроков с выбранными героями.</p>';
    var allSelected = activeTargets.length === members.length;
    return '<section class="zg-gm-delivery-targets"><header><span><small>ПОЛУЧАТЕЛИ</small><b>Кому выдать карточку</b></span>' +
      (members.length > 1 ? '<button type="button" class="' + (allSelected ? 'active' : '') + '" onclick="zgGmDeliveryTargetAll()"><i>✓</i> Вся группа</button>' : '') + '</header><div>' +
      members.map(function (member) {
        var uid = String(member.uid || '');
        var chosen = activeTargets.indexOf(uid) >= 0;
        var portrait = memberPortrait(member);
        return '<button type="button" class="zg-gm-delivery-target-card ' + (chosen ? 'selected' : '') + '" onclick="zgGmDeliveryTargetToggle(\'' + esc(uid) + '\')" aria-pressed="' + (chosen ? 'true' : 'false') + '">' +
          (portrait ? '<img src="' + esc(portrait) + '" alt="" loading="lazy" decoding="async">' : '<i class="portrait">♟</i>') +
          '<span><b>' + esc(member.character.name || member.name || 'Игрок') + '</b><small>Готов к получению</small></span><i class="check">✓</i></button>';
      }).join('') + '</div></section>';
  }

  function storageButtonMarkup() {
    var total = allPreparedArtifacts().length;
    return '<button type="button" class="zg-gm-delivery-storage" onclick="zgGmDeliveryOpenStorage()"><i>▦</i><span><small>ХРАНИЛИЩЕ СЕССИИ</small><b>Подготовленные карточки</b><em>Открыть отдельный каталог заготовок</em></span><strong>' + total + '</strong></button>';
  }

  function composeRoute(kind, payload) {
    kind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'text';
    var textMode = kind === 'text' ? textDeliveryMode(payload && payload.journalMode, payload && payload.saveToJournal) : '';
    if (kind === 'item') return {icon:'▣',eyebrow:'ПЕРЕДАЧА СНАРЯЖЕНИЯ',title:'Выдать предмет',note:'Выберите одну вещь или соберите набор. Результат попадёт прямо в инвентарь героя.',send:itemDeliveryMode === 'bundle' ? 'Выдать набор' : 'Выдать предмет',save:'Сохранить предмет'};
    if (kind === 'quest') return {icon:'◇',eyebrow:'ЦЕЛЬ ДЛЯ ЖУРНАЛА',title:'Назначить задание',note:'Создайте цель со статусом и ролью. Она появится у игрока в разделе заданий.',send:'Добавить задание',save:'Сохранить задание'};
    if (kind === 'image') return {icon:'▧',eyebrow:'ВИЗУАЛЬНАЯ КАРТОЧКА',title:'Показать изображение',note:'Покажите иллюстрацию карточкой или как полноэкранную сцену.',send:'Показать изображение',save:'Сохранить иллюстрацию'};
    return {icon:textDeliveryModeIcon(textMode),eyebrow:'ЗАПИСЬ ИЛИ СООБЩЕНИЕ',title:'Передать запись',note:'Сначала выберите: разовое сообщение, письмо в заметках или постоянное место.',send:textMode === 'message' ? 'Отправить сообщение' : textMode === 'place' ? 'Открыть место' : 'Отправить письмо',save:'Сохранить запись'};
  }

  function composeIdentityMarkup(route) {
    return '<section class="zg-gm-delivery-route kind-' + esc(activeKind) + '"><i>' + route.icon + '</i><span><small>' + route.eyebrow + '</small><b>' + route.title + '</b><p>' + route.note + '</p></span><em>Отдельный сценарий выдачи</em></section>';
  }

  function storageFilterRows() {
    var all = allPreparedArtifacts();
    return storageKind === 'all' ? all : all.filter(function (entry) { return entry.kind === storageKind; });
  }

  function renderStorageHub(host) {
    var rows = storageFilterRows();
    var counts = {all:allPreparedArtifacts().length,item:(library.item || []).length,quest:(library.quest || []).length,text:(library.text || []).length,image:(library.image || []).length};
    var cards = rows.length ? rows.map(function (entry) {
      var mode = entry.kind === 'text' ? textDeliveryMode(entry.payload && entry.payload.journalMode, entry.payload && entry.payload.saveToJournal) : '';
      var label = mode ? textDeliveryModeLabel(mode) : kindLabel(entry.kind);
      var fallback = mode ? textDeliveryModeIcon(mode) : entry.payload && entry.payload.icon || kindIcon(entry.kind);
      return '<article class="kind-' + esc(entry.kind) + '">' + artworkMarkup(entry, fallback, 'zg-gm-delivery-item-art') + '<span><small>' + esc(label) + '</small><b>' + esc(entry.title || 'Без названия') + '</b><p>' + esc(entry.text || entry.payload && entry.payload.description || 'Без описания') + '</p></span><button type="button" onclick="zgGmDeliveryHomeTemplate(\'' + esc(entry.kind) + '\',\'' + esc(entry.id) + '\')">Открыть</button></article>';
    }).join('') : '<p class="zg-gm-delivery-storage-empty">В этом разделе пока нет заготовок. Создайте первую карточку одной из кнопок ниже.</p>';
    host.innerHTML = '<section class="zg-gm-delivery-storage-hub"><header><button type="button" class="zg-gm-delivery-back" onclick="zgGmDeliveryHome()">← К выбору действия</button><span><small>ХРАНИЛИЩЕ СЕССИИ</small><h3>Подготовленные карточки</h3><p>Здесь только готовые заготовки. Открытие карточки ведёт сразу в её собственный сценарий выдачи.</p></span></header>' +
      '<nav>' + [['all','Все'],['item','Предметы'],['quest','Задания'],['text','Записи'],['image','Иллюстрации']].map(function (option) { return '<button type="button" class="' + (storageKind === option[0] ? 'active' : '') + '" onclick="zgGmDeliveryStorageFilter(\'' + option[0] + '\')">' + option[1] + '<i>' + counts[option[0]] + '</i></button>'; }).join('') + '</nav>' +
      '<div class="zg-gm-delivery-storage-grid">' + cards + '</div>' +
      '<footer><small>СОЗДАТЬ НОВУЮ ЗАГОТОВКУ</small><div>' + ['item','quest','text','image'].map(function (kind) { return '<button type="button" onclick="zgGmDeliveryStart(\'' + kind + '\')"><i>' + kindIcon(kind) + '</i>' + kindLabel(kind) + '</button>'; }).join('') + '</div></footer></section>';
  }

  function renderHistoryHub(host) {
    host.innerHTML = '<section class="zg-gm-delivery-history-hub"><header><button type="button" class="zg-gm-delivery-back" onclick="zgGmDeliveryHome()">← К выбору действия</button><span><small>ИСТОРИЯ ОТПРАВЛЕНИЙ</small><h3>Что уже получили игроки</h3><p>Повторите прежнюю выдачу или сохраните её как заготовку, не открывая общий редактор.</p></span></header>' + historyShelfMarkup() + '</section>';
  }

  function renderHome(host, members) {
    host.innerHTML =
      '<section class="zg-gm-delivery-home">' +
        '<header><small>ПОСЫЛКИ МАСТЕРА</small><h3>Что передать игроку</h3><p>Любая выдача — предмет, письмо, цель или изображение — сохраняется как карточка, которую можно открыть и отправить снова.</p><button type="button" class="zg-gm-delivery-history-open" onclick="zgGmDeliveryOpenHistory()">История отправлений <span>' + history.length + '</span></button></header>' +
        storageButtonMarkup() +
        targetCardsMarkup(members) +
        '<nav class="zg-gm-delivery-home-actions">' +
          ['item','quest','text','image'].map(function (kind) {
            var note = {item:'В инвентарь героя',quest:'В раздел заданий',text:'Сообщение, письмо или место',image:'Карточка или сцена'}[kind];
            return '<button type="button" class="kind-' + kind + '" onclick="zgGmDeliveryStart(\'' + kind + '\')"><i>' + kindIcon(kind) + '</i><b>' + kindLabel(kind) + '</b><small>' + note + '</small></button>';
          }).join('') +
        '</nav>' +
      '</section>';
  }

  function renderPanel(options) {
    options = options || {};
    pendingMasterPanelRefresh = false;
    ensureUi();
    var host = node('zg-gm-delivery-body');
    if (!host) return;
    if (!options.skipRemember) rememberPanelDraft();
    var members = playerMembers();
    reconcileTargetSelection(members);
    if (activeView === 'home') {
      renderHome(host, members);
      return;
    }
    if (activeView === 'storage') {
      renderStorageHub(host);
      return;
    }
    if (activeView === 'history') {
      renderHistoryHub(host);
      return;
    }
    var draft = draftForKind(activeKind), payload = draft.payload || {};
    if ((activeKind === 'image' || activeKind === 'quest') && !assetLibraryLoaded) requestAssetLibrary(false);
    activeMood = draft.mood || activeMood;
    activeImage = draft.image || '';
    var fields = '';
    if (activeKind === 'item') {
      var iconValue = w.ZargotaItemIcons ? w.ZargotaItemIcons.valueFor(payload) : payload.icon || '';
      fields = '<div class="zg-gm-delivery-row compact">' + itemIconPickerMarkup(iconValue) + '<label>Количество<input id="zg-gm-delivery-qty" type="number" min="1" max="999" value="' + Math.max(1, Number(payload.qty) || 1) + '"></label><label>Категория<select id="zg-gm-delivery-category"><option value="other"' + selected(payload.category,'other') + '>Другое</option><option value="weapon"' + selected(payload.category,'weapon') + '>Оружие</option><option value="armor"' + selected(payload.category,'armor') + '>Броня</option><option value="shield"' + selected(payload.category,'shield') + '>Щит</option><option value="consumable"' + selected(payload.category,'consumable') + '>Расходник</option><option value="material"' + selected(payload.category,'material') + '>Материал</option><option value="key"' + selected(payload.category,'key') + '>Ключ</option></select></label></div>' +
        '<div class="zg-gm-delivery-row compact"><label>Урон<input id="zg-gm-delivery-damage" maxlength="40" placeholder="1d6+2" value="' + esc(payload.damageFormula || '') + '"></label><label>Тип урона<input id="zg-gm-delivery-damage-type" maxlength="80" placeholder="Рубящий" value="' + esc(payload.damageType || '') + '"></label><label>Характеристика<select id="zg-gm-delivery-attack-stat"><option value="str"' + selected(payload.attackStat,'str') + '>Сила</option><option value="dex"' + selected(payload.attackStat,'dex') + '>Ловкость</option><option value="int"' + selected(payload.attackStat,'int') + '>Интеллект</option><option value="cha"' + selected(payload.attackStat,'cha') + '>Харизма</option><option value="per"' + selected(payload.attackStat,'per') + '>Восприятие</option></select></label></div>' +
        '<div class="zg-gm-delivery-row compact"><label>Бонус AC<input id="zg-gm-delivery-ac" type="number" min="-99" max="99" value="' + (Number(payload.acBonus) || 0) + '"></label><label>Дальность<input id="zg-gm-delivery-range" maxlength="80" placeholder="1 клетка" value="' + esc(payload.range || '1 клетка') + '"></label><label>Вес<input id="zg-gm-delivery-weight" type="number" min="0" max="9999" step="0.1" value="' + (Number(payload.weight) || 0) + '"></label></div>' +
        '<div class="zg-gm-delivery-row"><label>Слот экипировки<select id="zg-gm-delivery-slot"><option value=""' + selected(payload.slot,'') + '>Определить по предмету</option><option value="weapon"' + selected(payload.slot,'weapon') + '>Оружие</option><option value="head"' + selected(payload.slot,'head') + '>Голова</option><option value="armor"' + selected(payload.slot,'armor') + '>Доспех</option><option value="cloak"' + selected(payload.slot,'cloak') + '>Плащ</option><option value="hands"' + selected(payload.slot,'hands') + '>Руки</option><option value="legs"' + selected(payload.slot,'legs') + '>Ноги</option><option value="accessory1"' + selected(payload.slot,'accessory1') + '>Аксессуар</option></select></label></div>' +
        '<label>Эффекты предмета<input id="zg-gm-delivery-effects" maxlength="2000" placeholder="+1 к скорости, +2 к Силе…" value="' + esc(payload.effects || '') + '"></label>';
    } else if (activeKind === 'quest') {
      fields = '<input id="zg-gm-delivery-quest-id" type="hidden" value="' + esc(safeQuestId(payload.questId) || newQuestId()) + '">' +
        '<div class="zg-gm-delivery-row compact"><label>Иконка<select id="zg-gm-delivery-quest-icon">' + questIconOptions(payload.icon) + '</select></label><label>Статус<select id="zg-gm-delivery-quest-status"><option value="new"' + selected(questStatus(payload.status),'new') + '>Новое</option><option value="active"' + selected(questStatus(payload.status),'active') + '>Активное</option><option value="completed"' + selected(questStatus(payload.status),'completed') + '>Завершённое</option><option value="failed"' + selected(questStatus(payload.status),'failed') + '>Проваленное</option></select></label><label>Роль в журнале<select id="zg-gm-delivery-quest-importance"><option value="main"' + selected(questImportance(payload.importance),'main') + '>Главная цель</option><option value="secondary"' + selected(questImportance(payload.importance),'secondary') + '>Дополнительная цель</option></select></label></div>';
    } else if (activeKind === 'image') {
      fields = '<div class="zg-gm-delivery-row compact"><label>Показ<select id="zg-gm-delivery-presentation"><option value="card"' + selected(draft.presentation,'card') + '>Карточка</option><option value="cinematic"' + selected(draft.presentation,'cinematic') + '>Кинематографический на весь экран</option></select></label><label>Качество<select id="zg-gm-delivery-compression"><option value="compact"' + selected(payload.compression,'compact') + '>Компактное</option><option value="balanced"' + selected(payload.compression || 'balanced','balanced') + '>Сбалансированное</option><option value="quality"' + selected(payload.compression,'quality') + '>Высокое</option></select></label></div>' +
        '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-save-journal" type="checkbox" ' + (payload.saveToJournal ? 'checked' : '') + '><span>Сохранить изображение в журнале героя</span></label>';
    } else if (activeKind === 'text') {
      fields = '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-private" type="checkbox" ' + (draft.privateDelivery ? 'checked' : '') + '><span>Скрытый канал · карточка доступна только выбранному игроку и ГМ</span></label>';
    }
    var templates = filteredTemplates();
    var shelf = activeDrawer === 'library' ? '<section class="zg-gm-delivery-library zg-gm-delivery-drawer"><header><span><small>ХРАНИЛИЩЕ СЕССИИ</small><b>Подготовлено · ' + kindLabel(activeKind) + '</b></span><button type="button" onclick="zgGmDeliveryDrawer(\'\')">×</button></header>' +
          folderTabsMarkup() +
          '<div class="zg-gm-delivery-library-tools"><input type="search" value="' + esc(librarySearch) + '" placeholder="Найти заготовку" oninput="zgGmDeliveryLibrarySearch(this.value)">' +
            (activeKind === 'item' ? '<select onchange="zgGmDeliveryLibraryCategory(this.value)"><option value="all"' + selected(libraryCategory,'all') + '>Все категории</option><option value="weapon"' + selected(libraryCategory,'weapon') + '>Оружие</option><option value="armor"' + selected(libraryCategory,'armor') + '>Броня</option><option value="shield"' + selected(libraryCategory,'shield') + '>Щиты</option><option value="consumable"' + selected(libraryCategory,'consumable') + '>Расходники</option><option value="material"' + selected(libraryCategory,'material') + '>Материалы</option><option value="key"' + selected(libraryCategory,'key') + '>Ключи</option><option value="other"' + selected(libraryCategory,'other') + '>Другое</option></select>' : '') +
            '<select onchange="zgGmDeliveryLibrarySort(this.value)"><option value="recent"' + selected(librarySort,'recent') + '>Сначала новые</option><option value="title"' + selected(librarySort,'title') + '>По названию</option>' + (activeKind === 'item' ? '<option value="category"' + selected(librarySort,'category') + '>По категории</option>' : '') + '</select></div>' +
          '<div class="zg-gm-delivery-template-grid">' + (templates.length ? templates.map(function (template) {
            var category = activeKind === 'item' ? itemCategoryLabel(template.payload && template.payload.category || 'other') : '';
            return '<article class="zg-gm-delivery-template-card"><button type="button" class="pick" onclick="zgGmDeliveryUseTemplate(\'' + esc(template.id) + '\')">' + artworkMarkup(template, template.payload && template.payload.icon || kindIcon(activeKind), 'zg-gm-delivery-item-art') + '<span><b>' + esc(template.title) + '</b><small>' + esc((category ? category + ' · ' : '') + (template.text || 'Без описания')) + '</small></span></button><footer><select aria-label="Папка заготовки" onchange="zgGmDeliveryTemplateFolder(\'' + esc(template.id) + '\',this.value)">' + folderOptions(template.folderId || '') + '</select>' + (activeKind === 'item' ? '<button type="button" class="bundle" onclick="zgGmDeliveryBundleAddTemplate(\'' + esc(template.id) + '\')">＋</button>' : '') + '<button type="button" class="remove" onclick="zgGmDeliveryRemoveTemplate(\'' + esc(template.id) + '\')" aria-label="Удалить">×</button></footer></article>';
          }).join('') : '<p>По этому фильтру заготовок нет.</p>') + '</div></section>' : '';
    var itemSources = activeKind === 'item' ? '<section class="zg-gm-delivery-sources"><header><small>ДОБАВИТЬ ИЗ ДРУГИХ РАЗДЕЛОВ</small><b>Источник предмета</b></header><div><button type="button" onclick="zgGmDeliveryImportOpen(\'quest\')"><i>◆</i><span><b>Квестовые вещи</b><small>Закрытое хранилище ГМ из раздела «Товары»</small></span></button><button type="button" onclick="zgGmDeliveryImportOpen(\'shop\')"><i>▦</i><span><b>Товары</b><small>Единый коммерческий каталог</small></span></button><button type="button" onclick="zgGmDeliveryNewCustom()"><i>＋</i><span><b>Свой предмет</b><small>Создать с нуля</small></span></button></div></section>' : '';
    var textMode = activeKind === 'text' ? textDeliveryMode(payload.journalMode, payload.saveToJournal) : '';
    var route = composeRoute(activeKind, payload);
    var titleLabel = activeKind === 'text' ? (textMode === 'place' ? 'Название места' : textMode === 'letter' ? 'Тема письма' : 'Заголовок сообщения') : 'Название';
    var textLabel = activeKind === 'text' ? (textMode === 'place' ? 'Описание и ориентиры' : textMode === 'letter' ? 'Текст письма' : 'Сообщение') : 'Текст';
    var titlePlaceholder = activeKind === 'quest' ? 'Главная цель' : activeKind === 'item' ? 'Название предмета' : activeKind === 'text' ? (textMode === 'place' ? 'Старый мост у тракта' : textMode === 'letter' ? 'Письмо из обители' : 'Важная весть') : 'Заголовок';
    var textPlaceholder = activeKind === 'text' ? (textMode === 'place' ? 'Что это за место, как его найти и почему оно важно…' : textMode === 'letter' ? 'Что написано в письме…' : 'Что увидит игрок сейчас…') : 'Что увидит игрок';
    var editorFields = activeKind === 'item' ? '<details class="zg-gm-delivery-advanced"><summary><span><b>Характеристики предмета</b><small>Урон, броня, вес и экипировка</small></span><i>⌄</i></summary><div>' + fields + '</div></details>' : fields;
    var editorMarkup = '<section class="zg-gm-delivery-editor">' +
      (activeKind === 'item' ? '<header class="zg-gm-delivery-editor-head"><span><small>СВОЙ ПРЕДМЕТ</small><b>Конструктор карточки</b></span><button type="button" onclick="zgGmDeliveryCloseItemEditor()">Свернуть</button></header>' : '') +
      (activeKind === 'text' ? textModeMarkup(payload) : '') +
      '<label>' + titleLabel + '<input id="zg-gm-delivery-title" maxlength="180" value="' + esc(draft.title || '') + '" placeholder="' + titlePlaceholder + '"></label>' +
      '<label>' + textLabel + '<textarea id="zg-gm-delivery-text" maxlength="6000" rows="4" placeholder="' + textPlaceholder + '">' + esc(draft.text || '') + '</textarea></label>' +
      editorFields +
      '<label>Изображение<input id="zg-gm-delivery-image" maxlength="350000" placeholder="URL или загруженный файл" value="' + esc(draft.image || '') + '"></label>' +
      '<div class="zg-gm-delivery-upload"><input id="zg-gm-delivery-file" type="file" accept="image/*" hidden><button type="button" onclick="document.getElementById(\'zg-gm-delivery-file\').click()">Загрузить изображение</button><small>До 12 МБ · автоматически сожмётся для комнаты</small></div>' +
      assetLibraryMarkup() + '</section>';
    if (activeKind === 'item' && !itemEditorOpen) {
      editorMarkup = '<section class="zg-gm-delivery-editor-launch">' +
        '<i>' + (draft.title ? '◆' : '＋') + '</i><span><small>' + (draft.title ? 'ВЫБРАН ПРЕДМЕТ' : 'КОНСТРУКТОР СКРЫТ') + '</small><b>' + esc(draft.title || 'Выберите готовый предмет') + '</b><p>' + esc(draft.title ? (draft.text || 'Карточка готова к выдаче.') : 'Откройте хранилище или товары. Свой предмет создаётся только по отдельной кнопке.') + '</p></span>' +
        '<button type="button" onclick="zgGmDeliveryOpenItemEditor()">' + (draft.title ? 'Изменить' : 'Создать свой') + '</button></section>';
    }
    host.innerHTML =
      '<section class="zg-gm-delivery-compose kind-' + esc(activeKind) + '"><header class="zg-gm-delivery-compose-nav"><button type="button" class="zg-gm-delivery-back" onclick="zgGmDeliveryHome()">← Другой тип выдачи</button><div><button type="button" class="' + (activeDrawer === 'library' ? 'active' : '') + '" onclick="zgGmDeliveryDrawer(\'library\')">▦ Заготовки · ' + kindLabel(activeKind) + ' <span>' + (library[activeKind] || []).length + '</span></button><button type="button" onclick="zgGmDeliveryOpenHistory()">↶ История <span>' + history.length + '</span></button></div></header>' +
      composeIdentityMarkup(route) + targetCardsMarkup(members) + shelf +
      '<div class="zg-gm-delivery-workspace ' + (activeKind === 'item' && !itemEditorOpen ? 'item-editor-closed' : '') + '">' + editorMarkup + '<aside class="zg-gm-delivery-side">' +
      itemModeMarkup() +
      '<fieldset class="zg-gm-delivery-moods"><legend>Настроение показа</legend>' +
        '<button type="button" class="' + (activeMood === 'calm' ? 'active' : '') + '" data-mood="calm" onclick="zgGmDeliveryMood(\'calm\')">Спокойное</button>' +
        '<button type="button" class="' + (activeMood === 'solemn' ? 'active' : '') + '" data-mood="solemn" onclick="zgGmDeliveryMood(\'solemn\')">Торжественное</button>' +
        '<button type="button" class="' + (activeMood === 'ominous' ? 'active' : '') + '" data-mood="ominous" onclick="zgGmDeliveryMood(\'ominous\')">Тревожное</button>' +
      '</fieldset>' +
      deliverySoundLibraryMarkup(draft.soundId) +
      '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-popup-toggle" type="checkbox" ' + (draft.showPopup === false ? '' : 'checked') + '><span>Показать игроку большое уведомление</span></label>' +
      itemPresentationMarkup(payload) +
      ((activeKind === 'quest' || (activeKind === 'image' && payload.saveToJournal) || (activeKind === 'text' && textMode !== 'message')) ? '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-player-delete" type="checkbox" ' + (payload.playerCanDelete === false ? '' : 'checked') + '><span>Игрок может удалить запись из журнала</span></label>' : '') +
      '<section id="zg-gm-delivery-preview" class="zg-gm-delivery-preview">' + previewHeaderMarkup() + previewMarkup(draft) + '</section>' +
      bundleMarkup() + '</aside></div>' + itemSources + importMarkup() +
      '<div class="zg-gm-delivery-actions"><button type="button" onclick="zgGmDeliverySaveTemplate()">' + (activeTemplateIds[activeKind] ? 'Обновить заготовку' : route.save + ' как заготовку') + '</button><button type="button" class="primary" onclick="zgGmDeliverySend()" ' + (!members.length || !activeTargets.length || busy ? 'disabled' : '') + '>' + (busy ? 'Отправляем…' : route.send + (activeTargets.length > 1 ? ' · ' + activeTargets.length + ' игрокам' : '')) + '</button></div></section>';
    var file = node('zg-gm-delivery-file');
    if (file) file.addEventListener('change', readImageFile);
    var assetFile = node('zg-gm-delivery-asset-file');
    if (assetFile) assetFile.addEventListener('change', readAssetFile);
    host.oninput = function (event) {
      if (event.target && event.target.closest && event.target.closest('.zg-gm-delivery-compose')) refreshDeliveryPreview();
    };
    host.onchange = function (event) {
      if (event.target && event.target.closest && event.target.closest('.zg-gm-delivery-compose')) refreshDeliveryPreview();
    };
  }

  function refreshDeliveryPreview() {
    var host = node('zg-gm-delivery-preview');
    if (!host) return;
    host.innerHTML = previewHeaderMarkup() + previewMarkup(currentForm());
  }

  function itemIconPickerMarkup(value) {
    var catalog = w.ZargotaItemIcons ? w.ZargotaItemIcons.catalog : [];
    var normalized = w.ZargotaItemIcons ? w.ZargotaItemIcons.valueFor(value) : String(value || 'art:backpack');
    var key = w.ZargotaItemIcons ? w.ZargotaItemIcons.resolveKey(normalized) : 'backpack';
    var current = w.ZargotaItemIcons && w.ZargotaItemIcons.byKey[key] || {label:'Предмет',group:'Разное'};
    return '<div class="zg-gm-delivery-icon-field"><small>ИКОНКА</small><input id="zg-gm-delivery-icon" type="hidden" value="' + esc(normalized) + '">' +
      '<button id="zg-gm-delivery-icon-current" type="button" class="zg-gm-delivery-icon-current" onclick="zgGmDeliveryIconPickerToggle()"><i>' + (w.ZargotaItemIcons ? w.ZargotaItemIcons.markup(normalized) : '◇') + '</i><span><b>' + esc(current.label) + '</b><em>' + esc(current.group) + '</em></span><strong>▾</strong></button>' +
      '<div id="zg-gm-delivery-icon-grid" class="zg-gm-delivery-icon-grid" hidden>' + catalog.map(function (icon) {
        var iconValue = 'art:' + icon.key;
        return '<button type="button" data-icon="' + esc(iconValue) + '" title="' + esc(icon.label) + '" class="' + (iconValue === normalized ? 'selected' : '') + '" onclick="zgGmDeliveryIconPick(\'' + esc(iconValue) + '\')">' + w.ZargotaItemIcons.markup(iconValue,{alt:false}) + '<span>' + esc(icon.label) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function syncItemIconPicker(value) {
    if (!w.ZargotaItemIcons) return;
    var normalized = w.ZargotaItemIcons.valueFor(value);
    var input = node('zg-gm-delivery-icon');
    if (input) input.value = normalized;
    var key = w.ZargotaItemIcons.resolveKey(normalized), entry = w.ZargotaItemIcons.byKey[key];
    var current = node('zg-gm-delivery-icon-current');
    if (current && entry) current.innerHTML = '<i>' + w.ZargotaItemIcons.markup(normalized) + '</i><span><b>' + esc(entry.label) + '</b><em>' + esc(entry.group) + '</em></span><strong>▾</strong>';
    var buttons = document.querySelectorAll('#zg-gm-delivery-icon-grid button');
    for (var index = 0; index < buttons.length; index += 1) buttons[index].classList.toggle('selected', buttons[index].getAttribute('data-icon') === normalized);
  }

  w.zgGmDeliveryIconPickerToggle = function () {
    var grid = node('zg-gm-delivery-icon-grid');
    if (grid) grid.hidden = !grid.hidden;
  };

  w.zgGmDeliveryIconPick = function (value) {
    syncItemIconPicker(value);
    var grid = node('zg-gm-delivery-icon-grid');
    if (grid) grid.hidden = true;
    refreshDeliveryPreview();
  };

  function fillForm(value) {
    value = value || {};
    var title = node('zg-gm-delivery-title'), text = node('zg-gm-delivery-text'), image = node('zg-gm-delivery-image');
    if (title) title.value = value.title || '';
    if (text) text.value = value.text || '';
    activeImage = value.image || '';
    if (image) image.value = activeImage;
    var payload = value.payload || {};
    [
      ['zg-gm-delivery-icon','icon'],['zg-gm-delivery-category','category'],['zg-gm-delivery-qty','qty'],
      ['zg-gm-delivery-effects','effects'],['zg-gm-delivery-damage','damageFormula'],
      ['zg-gm-delivery-damage-type','damageType'],['zg-gm-delivery-ac','acBonus'],
      ['zg-gm-delivery-attack-stat','attackStat'],['zg-gm-delivery-range','range'],
      ['zg-gm-delivery-weight','weight'],['zg-gm-delivery-slot','slot'],
      ['zg-gm-delivery-rarity','rarity'],['zg-gm-delivery-fx','presentationFx'],
      ['zg-gm-delivery-quest-id','questId'],['zg-gm-delivery-quest-icon','icon'],['zg-gm-delivery-quest-status','status'],
      ['zg-gm-delivery-quest-importance','importance']
    ].forEach(function (pair) {
      var input = node(pair[0]);
      if (input && payload[pair[1]] != null) input.value = payload[pair[1]];
    });
    if (activeKind === 'item') syncItemIconPicker(payload.icon || payload);
    var playerDelete = node('zg-gm-delivery-player-delete');
    if (playerDelete) playerDelete.checked = payload.playerCanDelete !== false;
    refreshDeliveryPreview();
  }

  function readImageFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\//i.test(String(file.type || '')) || file.size > MAX_SOURCE_IMAGE_BYTES) {
      if (w.showToast) w.showToast('Нужен файл изображения до 12 МБ');
      event.target.value = '';
      return;
    }
    if (w.showToast) w.showToast(file.size > MAX_IMAGE_BYTES ? 'Сжимаем изображение для игровой комнаты…' : 'Подготавливаем изображение…');
    function finish(data) {
      activeImage = String(data || '');
      if (!activeImage) {
        if (w.showToast) w.showToast('Не удалось подготовить изображение');
        event.target.value = '';
        return;
      }
      var input = node('zg-gm-delivery-image');
      if (input) input.value = activeImage;
      drafts[activeKind] = currentForm();
      refreshDeliveryPreview();
      if (w.showToast) w.showToast('Изображение готово к отправке');
    }
    if (w.zgImageStore && typeof w.zgImageStore.makePortable === 'function') {
      var compression = node('zg-gm-delivery-compression') && node('zg-gm-delivery-compression').value || 'balanced';
      var compressionOptions = {
        compact:{maxSide:320,maxChars:110000},
        balanced:{maxSide:480,maxChars:180000},
        quality:{maxSide:720,maxChars:300000}
      };
      w.zgImageStore.makePortable(file, compressionOptions[compression] || compressionOptions.balanced, finish);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      if (w.showToast) w.showToast('Автоматическое сжатие сейчас недоступно');
      event.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () { finish(reader.result); };
    reader.onerror = function () { finish(''); };
    reader.readAsDataURL(file);
  }

  function readAssetFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\//i.test(String(file.type || '')) || file.size > 12 * 1024 * 1024) {
      if (w.showToast) w.showToast('Нужен файл изображения до 12 МБ');
      event.target.value = '';
      return;
    }
    if (!w.zgImageStore || typeof w.zgImageStore.put !== 'function') {
      if (w.showToast) w.showToast('Локальная библиотека изображений недоступна');
      return;
    }
    var idHint = 'gm_delivery_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
    w.zgImageStore.put(file, 'deliveries', idHint, function (path) {
      if (!path) {
        if (w.showToast) w.showToast('Не удалось сохранить иллюстрацию');
        return;
      }
      activeImage = path;
      assetLibrary.unshift({path:path,published:false,createdAt:Date.now()});
      var input = node('zg-gm-delivery-image');
      if (input) input.value = path;
      drafts[activeKind] = currentForm();
      assetLibraryLoaded = false;
      requestAssetLibrary(true);
      if (w.showToast) w.showToast('Иллюстрация сохранена локально. Опубликуйте медиа-пакет, чтобы отправлять её игрокам.');
    });
  }

  w.zgGmDeliveryToggle = function (force) {
    ensureUi();
    var panel = node('zg-gm-delivery-panel');
    if (!panel) return;
    var open = force == null ? !panel.classList.contains('open') : !!force;
    panel.classList.toggle('open', open);
    pendingMasterPanelRefresh = false;
    if (open) {
      activeView = 'home';
      activeDrawer = '';
      renderPanel();
    }
  };

  w.zgGmDeliveryOpenForMember = function (memberUid, kind) {
    rememberPanelDraft();
    activeTarget = String(memberUid || '');
    activeTargets = activeTarget ? [activeTarget] : [];
    targetSelectionReady = true;
    activeKind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'quest';
    if (activeKind === 'item') { itemDeliveryMode = 'single'; itemEditorOpen = false; }
    activeView = 'compose';
    var draft = draftForKind(activeKind);
    activeImage = draft.image || '';
    activeMood = draft.mood || 'calm';
    ensureUi();
    var panel = node('zg-gm-delivery-panel');
    if (!panel) return false;
    panel.classList.add('open');
    renderPanel({skipRemember:true});
    return true;
  };

  w.zgGmDeliveryHome = function () {
    rememberPanelDraft();
    activeView = 'home';
    activeDrawer = '';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryStart = function (kind) {
    activeKind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'text';
    if (activeKind === 'item') { itemDeliveryMode = 'single'; itemEditorOpen = false; }
    activeView = 'compose';
    activeDrawer = '';
    var draft = draftForKind(activeKind);
    activeImage = draft.image || '';
    activeMood = draft.mood || 'calm';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryHomeTemplate = function (kind, id) {
    kind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'item';
    var value = (library[kind] || []).filter(function (item) { return item && item.id === id; })[0];
    if (!value) return;
    activeKind = kind;
    if (activeKind === 'item') { itemDeliveryMode = 'single'; itemEditorOpen = false; }
    activeView = 'compose';
    activeMood = value.mood || 'calm';
    activeTemplateIds[kind] = value.id;
    drafts[kind] = JSON.parse(JSON.stringify(value));
    activeImage = value.image || '';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryOpenHistory = function () {
    rememberPanelDraft();
    activeView = 'history';
    activeDrawer = '';
    historyCleanupPending = null;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryOpenStorage = function () {
    rememberPanelDraft();
    activeView = 'storage';
    activeDrawer = '';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryStorageFilter = function (kind) {
    storageKind = ['all','item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'all';
    if (activeView !== 'storage') activeView = 'storage';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryRefreshAssets = function () {
    rememberPanelDraft();
    assetLibraryLoaded = false;
    requestAssetLibrary(true);
    renderPanel({skipRemember:true});
  };

  function refreshAssetListDom() {
    var list = document.querySelector('.zg-gm-delivery-assets-list');
    var meta = node('zg-gm-delivery-assets-meta');
    if (list) list.innerHTML = assetCardsMarkup();
    if (meta) meta.textContent = assetLibraryMeta();
  }

  w.zgGmDeliveryAssetSearch = function (value) {
    assetSearch = String(value || '').slice(0, 160);
    assetVisibleLimit = 24;
    refreshAssetListDom();
  };

  w.zgGmDeliveryAssetFilter = function (value) {
    assetFilter = ['all','deliveries','local','published'].indexOf(value) >= 0 ? value : 'deliveries';
    assetVisibleLimit = 24;
    refreshAssetListDom();
  };

  w.zgGmDeliveryAssetMore = function () {
    assetVisibleLimit = Math.min(assetLibrary.length, assetVisibleLimit + 24);
    refreshAssetListDom();
  };

  w.zgGmDeliveryAssetCleanupToggle = function (force) {
    assetCleanupOpen = force == null ? !assetCleanupOpen : !!force;
    assetCleanupPending = null;
    renderPanel();
  };

  w.zgGmDeliveryAssetCleanupRequest = function (mode) {
    mode = mode === 'published' ? 'published' : 'local';
    var paths = assetCleanupCandidates(mode).map(function (asset) { return String(asset.path || ''); }).filter(Boolean);
    if (!paths.length) {
      if (w.showToast) w.showToast('Здесь уже нечего очищать');
      return;
    }
    assetCleanupPending = {
      mode: mode,
      paths: paths,
      title: mode === 'published' ? 'Удалить кэш опубликованных файлов?' : 'Удалить неиспользуемые локальные выдачи?',
      note: mode === 'published'
        ? 'Оригиналы в проекте останутся доступны, при необходимости браузер загрузит их снова.'
        : 'Эти локальные оригиналы ещё не опубликованы и будут безвозвратно удалены с этого устройства.'
    };
    assetCleanupOpen = true;
    renderPanel();
  };

  w.zgGmDeliveryAssetDeleteRequest = function (path) {
    path = String(path || '');
    var asset = assetLibrary.filter(function (item) { return item && String(item.path || '') === path; })[0];
    if (!asset || !assetRemoveAllowed(asset)) {
      if (w.showToast) w.showToast(asset && path.indexOf('images/deliveries/') !== 0 ? 'Этим файлом управляет другой раздел' : 'Иллюстрация сейчас используется');
      return;
    }
    var name = path.split('/').pop() || 'иллюстрацию';
    assetCleanupPending = {
      mode: 'one',
      paths: [path],
      title: 'Удалить «' + name + '»?',
      note: asset.published === true
        ? 'Удалится только локальный кэш. Опубликованный оригинал останется в проекте.'
        : 'Локальный оригинал ещё не опубликован и будет безвозвратно удалён с этого устройства.'
    };
    assetCleanupOpen = true;
    renderPanel();
  };

  w.zgGmDeliveryAssetCleanupCancel = function () {
    if (assetCleanupBusy) return;
    assetCleanupPending = null;
    renderPanel();
  };

  function removeAssetPaths(paths, done) {
    var unique = [], seen = {};
    (Array.isArray(paths) ? paths : []).forEach(function (path) {
      path = String(path || '');
      if (path && !seen[path]) { seen[path] = true; unique.push(path); }
    });
    var index = 0;
    function next() {
      if (index >= unique.length) { done(unique); return; }
      w.zgImageStore.remove(unique[index++], next);
    }
    next();
  }

  w.zgGmDeliveryAssetCleanupConfirm = function () {
    if (assetCleanupBusy || !assetCleanupPending || !w.zgImageStore || typeof w.zgImageStore.remove !== 'function') return;
    var paths = assetCleanupPending.paths.slice();
    assetCleanupBusy = true;
    renderPanel();
    removeAssetPaths(paths, function (removedPaths) {
      var removed = {};
      removedPaths.forEach(function (path) { removed[path] = true; });
      assetLibrary = assetLibrary.filter(function (asset) { return !removed[String(asset && asset.path || '')]; });
      assetCleanupBusy = false;
      assetCleanupPending = null;
      assetCleanupOpen = false;
      assetLibraryLoaded = true;
      assetVisibleLimit = 24;
      renderPanel();
      if (w.showToast) w.showToast('Удалено файлов: ' + removedPaths.length);
    });
  };

  w.zgGmDeliveryUseAsset = function (path) {
    path = String(path || '');
    var asset = assetLibrary.filter(function (item) { return item && String(item.path) === path; })[0];
    if (!asset || asset.published !== true) {
      if (w.showToast) w.showToast('Сначала опубликуйте эту иллюстрацию');
      return;
    }
    activeImage = path;
    var input = node('zg-gm-delivery-image');
    if (input) input.value = path;
    drafts[activeKind] = currentForm();
    refreshDeliveryPreview();
  };

  w.zgGmDeliveryKind = function (kind) {
    rememberPanelDraft();
    activeKind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'text';
    if (activeKind === 'item') itemEditorOpen = false;
    var draft = draftForKind(activeKind);
    activeImage = draft.image || '';
    activeMood = draft.mood || 'calm';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryTextMode = function (mode) {
    if (activeKind !== 'text') return;
    rememberPanelDraft();
    mode = textDeliveryMode(mode);
    var draft = draftForKind('text');
    draft.payload = draft.payload || {};
    draft.payload.journalMode = mode;
    draft.payload.saveToJournal = mode !== 'message';
    if (mode !== 'message' && draft.payload.playerCanDelete == null) draft.payload.playerCanDelete = true;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryMood = function (mood) {
    activeMood = ['calm','solemn','ominous'].indexOf(mood) >= 0 ? mood : 'calm';
    var draft = currentForm();
    draft.mood = activeMood;
    drafts[activeKind] = draft;
    var buttons = document.querySelectorAll('.zg-gm-delivery-moods button');
    for (var i = 0; i < buttons.length; i += 1) buttons[i].classList.toggle('active', buttons[i].getAttribute('data-mood') === activeMood);
    refreshDeliveryPreview();
  };

  w.zgGmDeliverySound = function (soundId) {
    var draft = currentForm();
    draft.soundId = deliverySoundId(soundId);
    drafts[activeKind] = draft;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliverySoundPreview = function () {
    var soundId = deliverySoundId(node('zg-gm-delivery-sound') && node('zg-gm-delivery-sound').value || draftForKind(activeKind).soundId);
    if (!playDeliverySound({kind:activeKind,soundId:soundId}) && soundId !== 'none' && w.showToast) {
      w.showToast('Звук сейчас недоступен');
    }
  };

  w.zgGmDeliveryShelf = function (shelf) {
    rememberPanelDraft();
    if (shelf === 'history') {
      activeView = 'history';
      activeDrawer = '';
      historyCleanupPending = null;
      renderPanel({skipRemember:true});
      return;
    }
    activeShelf = 'library';
    activeDrawer = 'library';
    historyCleanupPending = null;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryDrawer = function (drawer) {
    rememberPanelDraft();
    if (drawer === 'history') {
      activeView = 'history';
      activeDrawer = '';
      historyCleanupPending = null;
      renderPanel({skipRemember:true});
      return;
    }
    if (activeView === 'home' && drawer === 'library') {
      activeView = 'storage';
      activeDrawer = '';
      renderPanel({skipRemember:true});
      return;
    }
    drawer = drawer === 'history' ? 'history' : drawer === 'library' ? 'library' : '';
    activeDrawer = activeDrawer === drawer ? '' : drawer;
    activeShelf = drawer || activeShelf;
    historyCleanupPending = null;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryTargetToggle = function (memberUid) {
    rememberPanelDraft();
    memberUid = String(memberUid || '');
    var index = activeTargets.indexOf(memberUid);
    if (index >= 0) activeTargets.splice(index, 1);
    else activeTargets.push(memberUid);
    targetSelectionReady = true;
    reconcileTargetSelection(playerMembers());
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryTargetAll = function () {
    rememberPanelDraft();
    var members = playerMembers();
    activeTargets = activeTargets.length === members.length ? [] : members.map(function (member) { return String(member.uid); });
    targetSelectionReady = true;
    reconcileTargetSelection(members);
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryNewCustom = function () {
    rememberPanelDraft();
    activeKind = 'item';
    delete drafts.item;
    delete activeTemplateIds.item;
    activeImage = '';
    itemDeliveryMode = 'single';
    itemEditorOpen = true;
    activeDrawer = '';
    importSource = '';
    draftForKind('item');
    renderPanel({skipRemember:true});
    setTimeout(function () { var input = node('zg-gm-delivery-title'); if (input) input.focus(); }, 0);
  };

  w.zgGmDeliveryHistoryDeleteRequest = function (historyId) {
    var entry = history.filter(function (item) { return item && item.id === historyId; })[0];
    if (!entry) return;
    historyCleanupPending = {mode:'one', id:historyId};
    renderPanel();
  };

  w.zgGmDeliveryHistoryClearRequest = function () {
    if (!history.length) return;
    historyCleanupPending = {mode:'all'};
    renderPanel();
  };

  w.zgGmDeliveryHistoryCleanupCancel = function () {
    historyCleanupPending = null;
    renderPanel();
  };

  w.zgGmDeliveryHistoryCleanupConfirm = function () {
    if (!historyCleanupPending) return;
    var previous = history.slice(), removed = 0, saved;
    if (historyCleanupPending.mode === 'all') {
      removed = history.length;
      history = [];
    } else {
      var id = historyCleanupPending.id;
      history = history.filter(function (item) {
        var keep = !item || item.id !== id;
        if (!keep) removed += 1;
        return keep;
      });
    }
    saved = saveHistory();
    if (!saved) history = previous;
    historyCleanupPending = null;
    renderPanel({skipRemember:true});
    if (saved && removed && w.showToast) w.showToast(removed === 1 ? 'Запись удалена из истории' : 'История выдач очищена');
  };

  w.zgGmDeliveryLibrarySearch = function (value) {
    rememberPanelDraft();
    librarySearch = String(value || '').slice(0, 120);
    renderPanel({skipRemember:true});
    var search = document.querySelector('.zg-gm-delivery-library-tools input[type="search"]');
    if (search) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
  };

  w.zgGmDeliveryLibraryCategory = function (value) {
    rememberPanelDraft();
    libraryCategory = ['all','other','weapon','armor','shield','consumable','material','key'].indexOf(value) >= 0 ? value : 'all';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryLibrarySort = function (value) {
    rememberPanelDraft();
    librarySort = ['recent','title','category'].indexOf(value) >= 0 ? value : 'recent';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryLibraryFolder = function (value) {
    rememberPanelDraft();
    libraryFolder = value === 'all' || value === 'unfiled' || libraryFolders.some(function (folder) { return folder.id === value; }) ? value : 'all';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryFolderAdd = function () {
    var name = String(w.prompt ? w.prompt('Название папки', 'Сессия') || '' : '').trim().slice(0, 40);
    if (!name) return;
    var id = 'folder-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,5);
    libraryFolders.push({id:id,name:name});
    if (saveFolders()) { libraryFolder = id; renderPanel({skipRemember:true}); }
  };

  w.zgGmDeliveryFolderRemove = function () {
    rememberPanelDraft();
    var folder = libraryFolders.filter(function (item) { return item.id === libraryFolder; })[0];
    if (!folder || w.confirm && !w.confirm('Удалить папку «' + folder.name + '»? Карточки останутся без папки.')) return;
    Object.keys(library).forEach(function (kind) { (library[kind] || []).forEach(function (item) { if (item.folderId === folder.id) delete item.folderId; }); });
    libraryFolders = libraryFolders.filter(function (item) { return item.id !== folder.id; });
    libraryFolder = 'unfiled';saveFolders();saveLibrary(library);renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryTemplateFolder = function (id,folderId) {
    rememberPanelDraft();
    var template = (library[activeKind] || []).filter(function (item) { return item && item.id === id; })[0];
    if (!template) return;
    if (folderId && libraryFolders.some(function (folder) { return folder.id === folderId; })) template.folderId = folderId;
    else delete template.folderId;
    template.updatedAt = Date.now();saveLibrary(library);renderPanel({skipRemember:true});
  };

  w.zgGmDeliverySaveTemplate = function () {
    var value = currentForm();
    if (!value.title) {
      if (w.showToast) w.showToast('Укажите название');
      return;
    }
    var existingId = activeTemplateIds[activeKind];
    var existingIndex = (library[activeKind] || []).findIndex(function (item) { return item && item.id === existingId; });
    var stamp = Date.now();
    value.id = existingIndex >= 0 ? existingId : 'tpl-' + stamp.toString(36) + '-' + Math.random().toString(36).slice(2,6);
    value.createdAt = existingIndex >= 0 ? Number(library[activeKind][existingIndex].createdAt) || stamp : stamp;
    value.folderId = existingIndex >= 0 ? library[activeKind][existingIndex].folderId || '' : libraryFolder !== 'all' && libraryFolder !== 'unfiled' ? libraryFolder : '';
    if (!value.folderId) delete value.folderId;
    value.updatedAt = stamp;
    if (existingIndex >= 0) library[activeKind].splice(existingIndex, 1);
    library[activeKind].unshift(value);
    activeTemplateIds[activeKind] = value.id;
    library[activeKind] = library[activeKind].slice(0, 80);
    if (saveLibrary(library)) {
      renderPanel();
      if (w.showToast) w.showToast(existingIndex >= 0 ? 'Заготовка обновлена' : 'Сохранено в библиотеку ГМ');
    }
  };

  w.zgGmDeliveryUseTemplate = function (id) {
    var value = (library[activeKind] || []).filter(function (item) { return item && item.id === id; })[0];
    if (!value) return;
    rememberPanelDraft();
    activeMood = value.mood || 'calm';
    activeTemplateIds[activeKind] = value.id;
    drafts[activeKind] = JSON.parse(JSON.stringify(value));
    activeImage = value.image || '';
    if (activeKind === 'item') { itemDeliveryMode = 'single'; itemEditorOpen = false; }
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryItemMode = function (mode) {
    rememberPanelDraft();
    itemDeliveryMode = mode === 'bundle' ? 'bundle' : 'single';
    if (itemDeliveryMode === 'bundle') itemEditorOpen = false;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryOpenItemEditor = function () {
    itemDeliveryMode = 'single';
    itemEditorOpen = true;
    renderPanel({skipRemember:true});
    setTimeout(function () { var input = node('zg-gm-delivery-title'); if (input) input.focus(); }, 0);
  };

  w.zgGmDeliveryCloseItemEditor = function () {
    if (activeKind !== 'item') return;
    rememberPanelDraft();
    itemEditorOpen = false;
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryRemoveTemplate = function (id) {
    library[activeKind] = (library[activeKind] || []).filter(function (item) { return item && item.id !== id; });
    if (activeTemplateIds[activeKind] === id) delete activeTemplateIds[activeKind];
    saveLibrary(library);
    renderPanel();
  };

  w.zgGmDeliveryImportOpen = function (source) {
    rememberPanelDraft();
    importSource = source === 'quest' ? 'quest' : 'shop';
    importSearch = '';
    importCategory = 'all';
    importEquip = 'all';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryImportClose = function () {
    rememberPanelDraft();
    importSource = '';
    importSearch = '';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryImportSearch = function (value) {
    rememberPanelDraft();
    importSearch = String(value || '').slice(0, 120);
    renderPanel({skipRemember:true});
    var search = document.querySelector('.zg-gm-delivery-import>input[type="search"]');
    if (search) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
  };

  w.zgGmDeliveryImportCategory = function (value) {
    rememberPanelDraft();
    importCategory = ['all','other','weapon','armor','shield','consumable','material','key'].indexOf(value) >= 0 ? value : 'all';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryImportEquip = function (value) {
    rememberPanelDraft();
    importEquip = ['all','equipment','backpack'].indexOf(value) >= 0 ? value : 'all';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryImportOne = function (id) {
    var item = externalItemById(id);
    if (!item) return;
    var duplicate = library.item.filter(function (entry) {
      return entry && entry.externalSource === item.externalSource && String(entry.externalId) === String(item.externalId);
    })[0];
    var selectedItem = duplicate || item;
    if (!duplicate) {
      library.item.unshift(JSON.parse(JSON.stringify(item)));
      library.item = library.item.slice(0, 80);
      saveLibrary(library);
    }
    drafts.item = JSON.parse(JSON.stringify(selectedItem));
    activeTemplateIds.item = selectedItem.id;
    activeImage = selectedItem.image || '';
    itemDeliveryMode = 'single';
    itemEditorOpen = false;
    importSource = '';
    renderPanel({skipRemember:true});
    if (w.showToast) w.showToast(duplicate ? 'Предмет выбран' : 'Предмет выбран и сохранён в хранилище');
  };

  w.zgGmDeliveryImportBundle = function (id) {
    var item = externalItemById(id);
    if (!item || !addBundleItem(item)) return;
    itemDeliveryMode = 'bundle';
    itemEditorOpen = false;
    renderPanel();
    if (w.showToast) w.showToast('Предмет добавлен в набор');
  };

  w.zgGmDeliveryBundleAddCurrent = function () {
    var value = currentForm();
    if (!addBundleItem(value)) return;
    drafts.item = value;
    itemDeliveryMode = 'bundle';
    itemEditorOpen = false;
    renderPanel({skipRemember:true});
    if (w.showToast) w.showToast('Предмет добавлен в набор');
  };

  w.zgGmDeliveryBundleAddTemplate = function (id) {
    var item = (library.item || []).filter(function (entry) { return entry && entry.id === id; })[0];
    if (!item || !addBundleItem(item)) return;
    itemDeliveryMode = 'bundle';
    itemEditorOpen = false;
    renderPanel();
    if (w.showToast) w.showToast('Заготовка добавлена в набор');
  };

  w.zgGmDeliveryBundleRemove = function (index) {
    index = Number(index);
    if (!Number.isInteger(index) || index < 0 || index >= itemBundle.length) return;
    rememberPanelDraft();
    itemBundle.splice(index, 1);
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryBundleClear = function () {
    rememberPanelDraft();
    itemBundle = [];
    renderPanel({skipRemember:true});
  };

  function targetMembers(selection) {
    var members = playerMembers();
    if (Array.isArray(selection)) return members.filter(function (member) { return selection.indexOf(String(member.uid)) >= 0; });
    if (selection === '__all__') return members;
    return members.filter(function (member) { return String(member.uid) === String(selection); });
  }

  function historySafeValue(value) {
    var copy;
    try { copy = JSON.parse(JSON.stringify(value)); } catch (error) { copy = {kind:value.kind,title:value.title,text:value.text,mood:value.mood,soundId:deliverySoundId(value.soundId),showPopup:value.showPopup,payload:value.payload || {}}; }
    if (copy.image && /^data:image\//i.test(copy.image) && copy.image.length > 300000) {
      copy.image = '';
      copy.imageOmittedFromHistory = true;
      if (copy.payload && copy.payload.item) copy.payload.item.image = '';
      if (copy.payload && copy.payload.quest) copy.payload.quest.image = '';
    }
    if (copy.payload && Array.isArray(copy.payload.items)) {
      var bundleDataImageSize = copy.payload.items.reduce(function (total, item) {
        return total + (item && /^data:image\//i.test(item.image || '') ? String(item.image).length : 0);
      }, 0);
      copy.payload.items.forEach(function (item) {
        if (item && item.image && /^data:image\//i.test(item.image) && (item.image.length > 300000 || bundleDataImageSize > 300000)) {
          item.image = '';
          copy.imageOmittedFromHistory = true;
        }
      });
    }
    return copy;
  }

  function appendHistory(value, members, status, errorText, repeatedFrom) {
    var stamp = Date.now();
    history.unshift({
      id:'history-' + stamp.toString(36) + '-' + Math.random().toString(36).slice(2,6),
      value:historySafeValue(value),
      memberUids:members.map(function (member) { return member.uid; }),
      targetNames:members.map(function (member) { return member.character && member.character.name || member.name || 'Игрок'; }),
      status:status,
      error:String(errorText || '').slice(0, 300),
      repeatedFrom:repeatedFrom || '',
      createdAt:stamp
    });
    var retainedPortableImages = 0;
    history.forEach(function (entry) {
      var archived = entry && entry.value;
      if (!archived || !/^data:image\//i.test(String(archived.image || ''))) return;
      retainedPortableImages += 1;
      if (retainedPortableImages > 8) {
        archived.image = '';
        archived.imageOmittedFromHistory = true;
        if (archived.payload && archived.payload.item) archived.payload.item.image = '';
        if (archived.payload && archived.payload.quest) archived.payload.quest.image = '';
      }
    });
    history = history.slice(0, 100);
    saveHistory();
  }

  function sendDelivery(value, members, repeatedFrom) {
    if (busy || !members.length || !w.ZargotaRooms) return;
    var memberUids = members.map(function (member) { return member.uid; });
    var operation;
    busy = true;
    renderPanel({skipRemember:true});
    if (w.ZargotaRooms.gmSendDeliveries) operation = w.ZargotaRooms.gmSendDeliveries(memberUids, value);
    else if (memberUids.length === 1 && w.ZargotaRooms.gmSendDelivery) operation = w.ZargotaRooms.gmSendDelivery(memberUids[0], value);
    else operation = Promise.reject(new Error('Групповая выдача недоступна в этой версии комнаты.'));
    operation.then(function (snapshot) {
      var queued = !!(snapshot && snapshot.queuedOperation);
      appendHistory(value, members, queued ? 'queued' : 'sent', '', repeatedFrom);
      showGmSentNotice(value, members, queued);
      if (!queued && w.ZargotaSound && w.ZargotaSound.gmDeliverySent) w.ZargotaSound.gmDeliverySent();
      if (!queued && !repeatedFrom) {
        delete drafts[activeKind];
        delete activeTemplateIds[activeKind];
        activeImage = '';
        if (value.kind === 'item' && value.payload && Array.isArray(value.payload.items)) itemBundle = [];
      }
    }).catch(function (error) {
      appendHistory(value, members, 'failed', error && error.message, repeatedFrom);
      if (w.showToast) w.showToast(error && error.message || 'Не удалось отправить выдачу');
    }).then(function () {
      busy = false;
      renderPanel({skipRemember:true});
    });
  }

  w.zgGmDeliverySend = function () {
    if (busy || !w.ZargotaRooms) return;
    var form = currentForm();
    if (activeKind === 'item' && itemDeliveryMode === 'bundle' && !itemBundle.length) {
      if (w.showToast) w.showToast('Добавьте хотя бы один предмет в набор');
      return;
    }
    var value = bundledSendValue(form);
    if (!activeTargets.length || !value.title) {
      if (w.showToast) w.showToast(!activeTargets.length ? 'Выберите хотя бы одного игрока' : 'Укажите название');
      return;
    }
    var selectedAsset = assetLibrary.filter(function (asset) {
      return asset && String(asset.path || '') === String(value.image || '');
    })[0];
    if (selectedAsset && selectedAsset.published !== true) {
      if (w.showToast) w.showToast('Эта иллюстрация пока есть только на вашем устройстве. Сначала опубликуйте медиа-пакет.');
      return;
    }
    var members = targetMembers(activeTargets);
    if (!members.length) {
      if (w.showToast) w.showToast('Выбранные игроки больше не подключены');
      return;
    }
    if (value.privateDelivery && members.length !== 1) {
      if (w.showToast) w.showToast('Скрытый текст можно отправить только одному игроку');
      return;
    }
    activeTarget = activeTargets.length > 1 && activeTargets.length === playerMembers().length ? '__all__' : activeTargets[0] || '';
    drafts[activeKind] = form;
    sendDelivery(value, members, '');
  };

  w.zgGmDeliveryRepeat = function (historyId) {
    if (busy) return;
    var entry = history.filter(function (item) { return item && item.id === historyId; })[0];
    if (!entry) return;
    if (entry.value && entry.value.kind === 'image' && entry.value.imageOmittedFromHistory) {
      if (w.showToast) w.showToast('Изображение уже очищено из локальной истории. Загрузите исходник заново или используйте заготовку из хранилища.');
      return;
    }
    var available = playerMembers(), members = available.filter(function (member) {
      return entry.memberUids.indexOf(member.uid) >= 0;
    });
    if (!members.length) {
      if (w.showToast) w.showToast('Получатели этой выдачи сейчас недоступны');
      return;
    }
    sendDelivery(entry.value, members, entry.id);
  };

  w.zgGmDeliveryArchive = function (historyId) {
    var entry = history.filter(function (item) { return item && item.id === historyId; })[0];
    if (!entry || !entry.value || !entry.value.kind) return;
    if (entry.value.kind === 'image' && entry.value.imageOmittedFromHistory) {
      if (w.showToast) w.showToast('Изображение уже удалено из локальной истории. Откройте исходник и сохраните новую карточку.');
      return;
    }
    var kind = entry.value.kind;
    if (!library[kind]) library[kind] = [];
    var archived = JSON.parse(JSON.stringify(entry.value));
    archived.id = 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
    archived.createdAt = Date.now();
    archived.updatedAt = archived.createdAt;
    delete archived.imageOmittedFromHistory;
    library[kind].unshift(archived);
    library[kind] = library[kind].slice(0, 80);
    if (saveLibrary(library) && w.showToast) w.showToast('Карточка сохранена как заготовка в хранилище');
    renderPanel({skipRemember:true});
  };

  function localCharacter(member) {
    if (!member || !member.characterId || !Array.isArray(w.characters)) return null;
    return w.characters.filter(function (character) {
      return character && String(character.id) === String(member.characterId);
    })[0] || null;
  }

  function appliedIds(character) {
    return Array.isArray(character && character._gmDeliveryIds) ? character._gmDeliveryIds : [];
  }

  function upsertQuestJournalEntry(journal, delivery) {
    journal = Array.isArray(journal) ? journal.slice() : [];
    delivery = delivery && typeof delivery === 'object' ? delivery : {};
    var quest = delivery.payload && delivery.payload.quest && typeof delivery.payload.quest === 'object'
      ? delivery.payload.quest
      : {};
    var deliveryId = String(delivery.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    var questId = safeQuestId(quest.questId) || safeQuestId('delivery-' + deliveryId);
    var journalId = safeQuestId('gm-quest-' + questId);
    var existingIndex = journal.findIndex(function (entry) {
      return entry && (
        String(entry.questId || '') === questId ||
        String(entry.journalId || '') === journalId
      );
    });
    var incomingQuestAt = Math.max(0, Number(delivery.createdAt) || Date.now());
    var existing = existingIndex >= 0 ? journal[existingIndex] : null;
    if (existing && Math.max(0, Number(existing.questUpdatedAt) || 0) > incomingQuestAt) {
      return { journal:journal, changed:false, mode:'stale', questId:questId, journalId:journalId };
    }
    if (!existing && journal.length >= 80) {
      return { journal:journal, changed:false, mode:'full', questId:questId, journalId:journalId };
    }
    var stamp = Date.now();
    var next = Object.assign({}, existing || {}, {
      journalId:journalId,
      questId:questId,
      title:quest.title || delivery.title || 'Новая цель',
      text:quest.text || delivery.text || '',
      image:quest.image || delivery.image || '',
      imageFit:quest.imageFit === 'cover' ? 'cover' : 'contain',
      icon:questIcon(quest.icon),
      kind:'quest',
      status:questStatus(quest.status),
      importance:questImportance(quest.importance),
      questUpdatedAt:incomingQuestAt,
      createdAt:existing ? Math.max(0, Number(existing.createdAt) || incomingQuestAt) : incomingQuestAt,
      updatedAt:stamp,
      updatedBy:'gm',
      playerCanDelete:delivery.payload && delivery.payload.playerCanDelete !== false
    });
    if (existingIndex >= 0) journal[existingIndex] = next;
    else journal.push(next);
    return {
      journal:journal,
      changed:true,
      mode:existing ? 'updated' : 'created',
      questId:questId,
      journalId:journalId
    };
  }

  function upsertImageJournalEntry(journal, delivery) {
    journal = Array.isArray(journal) ? journal.slice() : [];
    var deliveryId = String(delivery && delivery.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    var journalId = safeQuestId('gm-image-' + deliveryId);
    var existingIndex = journal.findIndex(function (entry) {
      return entry && String(entry.journalId || '') === journalId;
    });
    if (existingIndex < 0 && journal.length >= 80) return {journal:journal,changed:false,mode:'full'};
    var stamp = Date.now(), existing = existingIndex >= 0 ? journal[existingIndex] : null;
    var next = Object.assign({}, existing || {}, {
      journalId:journalId,
      title:delivery.title || 'Изображение мастера',
      text:delivery.text || '',
      image:delivery.image || '',
      imageFit:'contain',
      icon:'▧',
      kind:'image',
      createdAt:existing ? Number(existing.createdAt) || stamp : Number(delivery.createdAt) || stamp,
      updatedAt:stamp,
      updatedBy:'gm',
      playerCanDelete:delivery.payload && delivery.payload.playerCanDelete !== false
    });
    if (existingIndex >= 0) journal[existingIndex] = next;
    else journal.push(next);
    return {journal:journal,changed:true,mode:existing ? 'updated' : 'created'};
  }

  function upsertTextJournalEntry(journal, delivery) {
    journal = Array.isArray(journal) ? journal.slice() : [];
    var mode = textDeliveryMode(delivery && delivery.payload && delivery.payload.journalMode, delivery && delivery.payload && delivery.payload.saveToJournal);
    var deliveryId = String(delivery && delivery.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    var journalId = safeQuestId((mode === 'place' ? 'gm-place-' : 'gm-letter-') + deliveryId);
    var existingIndex = journal.findIndex(function (entry) {
      return entry && String(entry.journalId || '') === journalId;
    });
    if (existingIndex < 0 && journal.length >= 80) return {journal:journal,changed:false,mode:'full'};
    var stamp = Date.now(), existing = existingIndex >= 0 ? journal[existingIndex] : null;
    var next = Object.assign({}, existing || {}, {
      journalId:journalId,
      title:delivery.title || (mode === 'place' ? 'Место, открытое мастером' : 'Письмо мастера'),
      text:delivery.text || '',
      image:delivery.image || '',
      imageFit:mode === 'place' ? 'cover' : 'contain',
      icon:textDeliveryModeIcon(mode),
      kind:mode === 'place' ? 'place' : 'note',
      createdAt:existing ? Number(existing.createdAt) || stamp : Number(delivery.createdAt) || stamp,
      updatedAt:stamp,
      updatedBy:'gm',
      playerCanDelete:delivery.payload && delivery.payload.playerCanDelete !== false
    });
    if (existingIndex >= 0) journal[existingIndex] = next;
    else journal.push(next);
    return {journal:journal,changed:true,mode:existing ? 'updated' : 'created'};
  }

  function applyDelivery(delivery, member) {
    var character = localCharacter(member);
    var persistImage = delivery.kind === 'image' && delivery.payload && delivery.payload.saveToJournal === true;
    var persistText = delivery.kind === 'text' && delivery.payload && delivery.payload.saveToJournal === true;
    var persists = delivery.kind === 'item' || delivery.kind === 'quest' || persistImage || persistText;
    if (persists && !character) {
      return Promise.reject(new Error('Локальный лист выбранного героя не найден.'));
    }
    var deliveryId = String(delivery.id || '');
    var already = character && appliedIds(character).indexOf(deliveryId) >= 0;
    var rollback = null;
    var changed = false;
    var saveReason = delivery.kind === 'item' ? 'inventory-add' : 'journal-add';
    if (character && !already && persists) {
      rollback = {
        inventoryItems:character.inventoryItems,
        journalEntries:character.journalEntries,
        deliveryIds:character._gmDeliveryIds
      };
    }
    if (!already && delivery.kind === 'item') {
      var rawItems = delivery.payload && Array.isArray(delivery.payload.items) && delivery.payload.items.length
        ? delivery.payload.items.slice(0, 20)
        : [delivery.payload && delivery.payload.item || {}];
      var safeDeliveryId = deliveryId.replace(/[^a-zA-Z0-9_-]/g, '');
      var inventory = Array.isArray(character.inventoryItems) ? character.inventoryItems.slice() : [];
      var additions = [];
      rawItems.forEach(function (source, index) {
        source = source && typeof source === 'object' ? source : {};
        var itemId = 'gm-' + safeDeliveryId + (rawItems.length > 1 ? '-' + index : '');
        var itemExists = inventory.concat(additions).some(function (item) {
          return item && String(item.itemId || '') === itemId;
        });
        if (itemExists) return;
        additions.push({
          itemId:itemId,
          name:source.name || delivery.title || 'Предмет',
          icon:source.icon || '📦',
          image:source.image || delivery.image || '',
          category:source.category || 'other',
          description:source.description || delivery.text || '',
          effects:source.effects || '',
          damageFormula:source.damageFormula || '',
          damageType:source.damageType || '',
          acBonus:Number(source.acBonus) || 0,
          attackStat:source.attackStat || '',
          range:source.range || '',
          weight:Math.max(0, Number(source.weight) || 0),
          preferredSlot:source.slot || '',
          rarity:source.rarity || 'common',
          qty:Math.max(1, Number(source.qty) || 1),
          equipped:false,
          receivedFromGm:true,
          receivedAt:Number(delivery.createdAt) || Date.now()
        });
      });
      if (inventory.length + additions.length > 80) {
        return Promise.reject(new Error('В инвентаре недостаточно места: набор ГМ пока не применён.'));
      }
      if (additions.length) {
        character.inventoryItems = inventory.concat(additions);
        changed = true;
      }
    }
    if (!already && delivery.kind === 'quest') {
      var questResult = upsertQuestJournalEntry(character.journalEntries, delivery);
      if (questResult.mode === 'full') return Promise.reject(new Error('Журнал заполнен: цель ГМ пока не применена.'));
      if (questResult.changed) {
        character.journalEntries = questResult.journal;
        saveReason = questResult.mode === 'updated' ? 'journal-update' : 'journal-add';
        changed = true;
      }
    }
    if (!already && persistImage) {
      var imageResult = upsertImageJournalEntry(character.journalEntries, delivery);
      if (imageResult.mode === 'full') return Promise.reject(new Error('Журнал заполнен: изображение ГМ пока не сохранено.'));
      if (imageResult.changed) {
        character.journalEntries = imageResult.journal;
        saveReason = imageResult.mode === 'updated' ? 'journal-update' : 'journal-add';
        changed = true;
      }
    }
    if (!already && persistText) {
      var textResult = upsertTextJournalEntry(character.journalEntries, delivery);
      if (textResult.mode === 'full') return Promise.reject(new Error('Журнал заполнен: письмо ГМ пока не сохранено.'));
      if (textResult.changed) {
        character.journalEntries = textResult.journal;
        saveReason = textResult.mode === 'updated' ? 'journal-update' : 'journal-add';
        changed = true;
      }
    }
    var save = Promise.resolve({ok:true});
    if (character && !already && persists) {
      character._gmDeliveryIds = appliedIds(character).concat(deliveryId).slice(-120);
      changed = true;
    }
    if (character && changed) {
      save = typeof w.saveChars === 'function'
        ? Promise.resolve(w.saveChars({reason:saveReason}))
        : Promise.reject(new Error('Хранилище персонажей недоступно.'));
    }
    return save.then(function (result) {
      if (!result || result.ok === false) throw result && result.error || new Error('Не удалось сохранить получение.');
      return w.ZargotaRooms.acknowledgeGmDelivery(delivery.id, 'applied');
    }).catch(function (error) {
      if (character && rollback) {
        character.inventoryItems = rollback.inventoryItems;
        character.journalEntries = rollback.journalEntries;
        character._gmDeliveryIds = rollback.deliveryIds;
      }
      throw error;
    });
  }

  function popupTitle(delivery) {
    if (delivery && delivery.previewOnly) return (delivery.senderName || 'Игрок') + ' показывает';
    if (delivery && delivery.kind === 'quest') {
      var status = questStatus(delivery.payload && delivery.payload.quest && delivery.payload.quest.status);
      return {new:'Новая цель',active:'Цель обновлена',completed:'Цель завершена',failed:'Цель провалена'}[status];
    }
    if (delivery && delivery.kind === 'text') {
      var mode = textDeliveryMode(delivery.payload && delivery.payload.journalMode, delivery.payload && delivery.payload.saveToJournal);
      return {message:'Послание мастера',letter:'Новое письмо',place:'Открыто новое место'}[mode];
    }
    return {item:'Получен предмет', image:'Открыт образ'}[delivery.kind] || 'Получено';
  }

  function enqueuePopup(delivery) {
    popupQueue.push(delivery);
    showNextPopup();
  }

  function itemPopupDetails(item) {
    item = item || {};
    var facts = ['<span><small>Редкость</small><b>' + esc(itemRarityLabel(item.rarity)) + '</b></span>'];
    if (item.damageFormula) facts.push('<span><small>Урон</small><b>' + esc(item.damageFormula + (item.damageType ? ' · ' + item.damageType : '')) + '</b></span>');
    if (Number(item.acBonus)) facts.push('<span><small>Броня</small><b>AC ' + (Number(item.acBonus) > 0 ? '+' : '') + esc(Number(item.acBonus)) + '</b></span>');
    if (item.range) facts.push('<span><small>Дальность</small><b>' + esc(item.range) + '</b></span>');
    facts.push('<span><small>Количество</small><b>×' + Math.max(1, Number(item.qty) || 1) + '</b></span>');
    return '<div class="zg-delivery-popup-item-facts">' + facts.join('') + '</div>' +
      (item.effects ? '<div class="zg-delivery-popup-item-effect"><small>СВОЙСТВА</small><p>' + esc(item.effects) + '</p></div>' : '');
  }

  function itemPopupParticles(effect) {
    effect = itemPresentationFx(effect);
    if (effect === 'none') return '';
    var particles = '';
    for (var index = 0; index < 14; index += 1) particles += '<i style="left:' + (5 + index * 6.8) + '%;animation-delay:-' + (index * 0.19).toFixed(2) + 's"></i>';
    return '<div class="zg-delivery-popup-particles fx-' + esc(effect) + '" aria-hidden="true">' + particles + '</div>';
  }

  function showNextPopup() {
    if (popupOpen || !popupQueue.length) return;
    ensureUi();
    var delivery = popupQueue.shift();
    var popup = node('zg-player-delivery-popup'), host = node('zg-player-delivery-popup-body');
    if (!popup || !host) return;
    var deliveredItems = delivery.kind === 'item' && delivery.payload && Array.isArray(delivery.payload.items)
      ? delivery.payload.items.slice(0, 20)
      : [];
    var singleItem = delivery.kind === 'item' && delivery.payload && delivery.payload.item || null;
    var itemMeta = deliveredItems.length
      ? '<div class="zg-delivery-popup-bundle"><b>Получено предметов: ' + deliveredItems.length + '</b>' + deliveredItems.map(function (item) {
          return '<span>' + (item.image ? '<img src="' + esc(item.image) + '" alt="" loading="eager" decoding="async">' : w.ZargotaItemIcons ? '<i>' + w.ZargotaItemIcons.markup(item,{eager:true}) + '</i>' : '<i>' + esc(item.icon || 'Предмет') + '</i>') + '<em>' + esc(item.name || item.title || 'Предмет') + '</em><strong>×' + Math.max(1, Number(item.qty) || 1) + '</strong></span>';
        }).join('') + '</div>'
      : singleItem
        ? itemPopupDetails(singleItem)
        : '';
    popupOpen = true;
    popup.className = 'zg-player-delivery-popup open mood-' + (delivery.mood || 'calm') +
      (delivery.previewOnly ? ' shared-preview' : '') +
      (singleItem ? ' item-single rarity-' + itemRarity(singleItem.rarity) + ' fx-' + itemPresentationFx(singleItem.presentationFx) : '') +
      (delivery.kind === 'image' && delivery.presentation === 'cinematic' ? ' presentation-cinematic' : '');
    var popupIcon = singleItem ? singleItem.icon || '📦' : delivery.kind === 'quest' && delivery.payload && delivery.payload.quest
      ? questIcon(delivery.payload.quest.icon)
      : delivery.kind === 'text' ? textDeliveryModeIcon(delivery.payload && delivery.payload.journalMode, delivery.payload && delivery.payload.saveToJournal)
      : kindIcon(delivery.kind);
    var popupArtwork = delivery.image || (deliveredItems[0] && deliveredItems[0].image) || (delivery.payload && delivery.payload.item && delivery.payload.item.image) || '';
    host.innerHTML =
      (singleItem ? itemPopupParticles(singleItem.presentationFx) : '') +
      '<small>' + esc(popupTitle(delivery)) + '</small>' +
      (popupArtwork ? '<img src="' + esc(popupArtwork) + '" alt="">' : singleItem && w.ZargotaItemIcons ? '<i>' + w.ZargotaItemIcons.markup(singleItem,{eager:true}) + '</i>' : '<i>' + esc(popupIcon) + '</i>') +
      '<h2>' + esc(delivery.title || 'Получено') + '</h2>' +
      (delivery.text ? '<p>' + esc(delivery.text) + '</p>' : '') +
      itemMeta;
    requestAnimationFrame(function () { popup.classList.add('revealed'); });
  }

  w.zgGmDeliveryClosePopup = function () {
    var popup = node('zg-player-delivery-popup');
    if (popup) {
      popup.classList.remove('revealed');
      setTimeout(function () {
        popup.className = 'zg-player-delivery-popup';
        popupOpen = false;
        showNextPopup();
      }, 260);
    } else {
      popupOpen = false;
      showNextPopup();
    }
  };

  function handleDelivery(delivery, member) {
    if (!delivery || delivery.status !== 'pending' || applying[delivery.id]) return;
    applying[delivery.id] = true;
    applyDelivery(delivery, member).then(function () {
      var present = claimDeliveryPresentation(delivery.id);
      if (present) playDeliverySound(delivery);
      if (present && delivery.showPopup !== false) enqueuePopup(delivery);
      else if (present && w.showToast) w.showToast('Получено: ' + (delivery.title || kindLabel(delivery.kind)));
      if (w.zgVttRefreshDrawer) w.zgVttRefreshDrawer();
    }).catch(function (error) {
      if (w.showToast) w.showToast(error && error.message || 'Не удалось применить выдачу ГМ');
    }).then(function () {
      delete applying[delivery.id];
    });
  }

  function syncSharedPresentations() {
    var room = snapshot && snapshot.room || {}, session = snapshot && snapshot.session || {}, ownUid = String(session.uid || ''), now = Date.now();
    Object.keys(room.members || {}).forEach(function (uid) {
      if (String(uid) === ownUid) return;
      var delivery = room.members[uid] && room.members[uid].sharedPresentation;
      if (!delivery || delivery.previewOnly !== true || !delivery.id) return;
      if (delivery.expiresAt && Number(delivery.expiresAt) < now) return;
      if (!Array.isArray(delivery.recipientUids) || delivery.recipientUids.map(String).indexOf(ownUid) < 0) return;
      if (!claimDeliveryPresentation(delivery.id)) return;
      if (w.ZargotaSound && w.ZargotaSound.playerDeliveryReceived) w.ZargotaSound.playerDeliveryReceived();
      enqueuePopup(delivery);
    });
  }

  function sync(nextSnapshot) {
    snapshot = nextSnapshot || snapshot;
    if (!snapshot || !snapshot.session || !snapshot.room) return;
    ensureUi();
    syncSharedPresentations();
    if (snapshot.session.role === 'master') {
      var nextSignature = masterPanelDataSignature(snapshot);
      var recipientDataChanged = nextSignature !== masterPanelSnapshotSignature;
      masterPanelSnapshotSignature = nextSignature;
      var panel = node('zg-gm-delivery-panel');
      if (recipientDataChanged && panel && panel.classList.contains('open')) {
        if (deliveryPanelInteractionActive()) pendingMasterPanelRefresh = true;
        else renderPanel();
      }
      return;
    }
    var member = snapshot.room.members && snapshot.room.members[snapshot.session.uid];
    var deliveries = member && member.gmDeliveries || {};
    Object.keys(deliveries).map(function (id) { return deliveries[id]; }).filter(Boolean).sort(function (a,b) {
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    }).forEach(function (delivery) { handleDelivery(delivery, member); });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var popup = node('zg-player-delivery-popup');
    var panel = node('zg-gm-delivery-panel');
    var shareMenu = node('zg-player-share-menu');
    if (shareMenu && shareMenu.classList.contains('open')) {
      w.zgSharePresentationClose();
      event.preventDefault();
    } else if (popup && popup.classList.contains('open')) {
      w.zgGmDeliveryClosePopup();
      event.preventDefault();
    } else if (panel && panel.classList.contains('open')) {
      w.zgGmDeliveryToggle(false);
      event.preventDefault();
    }
  });

  function init() {
    ensureUi();
    if (w.ZargotaRooms && w.ZargotaRooms.subscribe) w.ZargotaRooms.subscribe(sync);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
