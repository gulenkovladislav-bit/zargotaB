(function (w) {
  'use strict';

  var STORAGE_KEY = 'zargota_gm_delivery_library_v1';
  var HISTORY_KEY = 'zargota_gm_delivery_history_v1';
  var MAX_IMAGE_BYTES = 250 * 1024;
  var snapshot = null;
  var activeKind = 'item';
  var activeMood = 'calm';
  var activeImage = '';
  var activeTarget = '';
  var activeShelf = 'library';
  var librarySearch = '';
  var libraryCategory = 'all';
  var librarySort = 'recent';
  var importSource = '';
  var importSearch = '';
  var itemBundle = [];
  var drafts = Object.create(null);
  var busy = false;
  var applying = Object.create(null);
  var popupQueue = [];
  var popupOpen = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function node(id) { return document.getElementById(id); }

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
      '<header><div><small>ВЕДЕНИЕ ИГРЫ</small><b>Выдать игроку</b></div><button type="button" onclick="zgGmDeliveryToggle(false)" aria-label="Закрыть">×</button></header>' +
      '<div id="zg-gm-delivery-body"></div>';
    document.body.appendChild(panel);

    var popup = document.createElement('div');
    popup.id = 'zg-player-delivery-popup';
    popup.className = 'zg-player-delivery-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.innerHTML = '<article><button type="button" class="zg-delivery-popup-close" onclick="zgGmDeliveryClosePopup()" aria-label="Закрыть">×</button><div id="zg-player-delivery-popup-body"></div><button type="button" class="zg-delivery-popup-done" onclick="zgGmDeliveryClosePopup()">Продолжить</button></article>';
    document.body.appendChild(popup);
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

  function currentForm() {
    var title = node('zg-gm-delivery-title');
    var text = node('zg-gm-delivery-text');
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
        slot:node('zg-gm-delivery-slot') && node('zg-gm-delivery-slot').value
      };
    }
    return {
      kind:activeKind,
      mood:activeMood,
      showPopup:!!(node('zg-gm-delivery-popup-toggle') && node('zg-gm-delivery-popup-toggle').checked),
      title:String(title && title.value || '').trim(),
      text:String(text && text.value || '').trim(),
      image:String(node('zg-gm-delivery-image') && node('zg-gm-delivery-image').value || activeImage || '').trim(),
      payload:payload
    };
  }

  function rememberPanelDraft() {
    if (!node('zg-gm-delivery-title')) return;
    drafts[activeKind] = currentForm();
    var target = node('zg-gm-delivery-target');
    if (target) activeTarget = target.value;
  }

  function draftForKind(kind) {
    var value = drafts[kind];
    if (value) return value;
    return {
      kind:kind,mood:activeMood,showPopup:true,title:'',text:'',image:'',
      payload:kind === 'item' ? {icon:'📦',qty:1,category:'other',acBonus:0,attackStat:'str',range:'1 клетка',weight:0,slot:''} : {}
    };
  }

  function selected(value, expected) {
    return String(value == null ? '' : value) === String(expected) ? ' selected' : '';
  }

  function itemCategoryLabel(category) {
    return {all:'Все категории',other:'Другое',weapon:'Оружие',armor:'Броня',shield:'Щит',consumable:'Расходник',material:'Материал',key:'Ключ'}[category] || 'Другое';
  }

  function filteredTemplates() {
    var query = librarySearch.trim().toLowerCase();
    var result = (library[activeKind] || []).filter(function (template) {
      if (!template) return false;
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
      image:String(raw.image || '').slice(0, 350000),
      payload:{
        name:String(raw.name || raw.title || 'Предмет').slice(0, 200),
        icon:String(raw.icon || (category === 'weapon' ? '⚔️' : category === 'armor' || category === 'shield' ? '🛡️' : '📦')).slice(0, 20),
        category:category,qty:1,
        description:String(raw.description || raw.desc || raw.text || raw.effect || '').slice(0, 4000),
        effects:String(raw.effects || raw.effect || '').slice(0, 2000),
        damageFormula:String(raw.damageFormula || raw.damage || '').slice(0, 40),
        damageType:String(raw.damageType || '').slice(0, 80),
        acBonus:Number(armorBonus) || 0,
        attackStat:String(raw.attackStat || raw.stat || (raw.name && /рапир|лук|кинжал/i.test(raw.name) ? 'dex' : 'str')),
        range:String(raw.range || '').slice(0, 80),
        weight:Math.max(0, Number(raw.weight || raw.mass) || 0),
        slot:externalSlot(raw.slot, category)
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
    } catch (error) { rows = []; }
    return (Array.isArray(rows) ? rows : []).map(function (item, index) { return normalizeExternalItem(item, source, index); }).filter(function (item) {
      var query = ignoreSearch ? '' : importSearch.trim().toLowerCase();
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
      icon:value.payload && value.payload.icon || '📦',
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
      slot:value.payload && value.payload.slot || ''
    };
  }

  function bundledSendValue(value) {
    if (!itemBundle.length) return value;
    return {
      kind:'item',mood:value.mood,showPopup:value.showPopup,
      title:value.title || 'Набор предметов · ' + itemBundle.length,
      text:value.text || 'Мастер передаёт набор предметов.',
      image:value.image || '',
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
    var tags = [];
    if (value.kind === 'item') {
      if (payload.category) tags.push(itemCategoryLabel(payload.category));
      if (payload.damageFormula) tags.push(payload.damageFormula + (payload.damageType ? ' · ' + payload.damageType : ''));
      if (Number(payload.acBonus)) tags.push('AC ' + (Number(payload.acBonus) > 0 ? '+' : '') + Number(payload.acBonus));
      if (payload.range) tags.push(payload.range);
      if (Number(payload.weight)) tags.push('Вес ' + Number(payload.weight));
      tags.push('×' + Math.max(1, Number(payload.qty) || 1));
    }
    return '<article class="zg-gm-delivery-preview-card mood-' + esc(value.mood || activeMood) + '">' +
      (value.image ? '<img src="' + esc(value.image) + '" alt="">' : '<i>' + esc(icon) + '</i>') +
      '<div><small>' + esc(kindLabel(value.kind)) + '</small><b>' + esc(value.title || 'Название') + '</b>' +
      '<p>' + esc(value.text || payload.description || 'Описание появится здесь.') + '</p>' +
      (tags.length ? '<footer>' + tags.map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '</footer>' : '') +
      '</div></article>';
  }

  function historyTargetNames(entry) {
    return Array.isArray(entry.targetNames) && entry.targetNames.length ? entry.targetNames.join(', ') : 'Игрок';
  }

  function bundleMarkup() {
    if (activeKind !== 'item') return '';
    return '<section class="zg-gm-delivery-bundle"><header><div><small>Одна выдача</small><b>Набор предметов</b></div><span>' + itemBundle.length + ' / 20</span></header>' +
      (itemBundle.length ? '<div>' + itemBundle.map(function (item, index) {
        var payload = item.payload || {};
        return '<article><i>' + esc(payload.icon || '📦') + '</i><span><b>' + esc(item.title || payload.name || 'Предмет') + '</b><small>' + esc(itemCategoryLabel(payload.category || 'other')) + ' · ×' + Math.max(1, Number(payload.qty) || 1) + '</small></span><button type="button" onclick="zgGmDeliveryBundleRemove(' + index + ')" aria-label="Убрать из набора">×</button></article>';
      }).join('') + '</div><button type="button" class="clear" onclick="zgGmDeliveryBundleClear()">Очистить набор</button>' : '<p>Добавьте текущий предмет или заготовки из библиотеки.</p>') +
      '<button type="button" class="add" onclick="zgGmDeliveryBundleAddCurrent()">＋ Добавить текущий предмет</button></section>';
  }

  function importMarkup() {
    if (!importSource || activeKind !== 'item') return '';
    var rows = externalItems(importSource);
    return '<section class="zg-gm-delivery-import"><header><div><small>Источник данных</small><b>' + (importSource === 'armory' ? 'Оружейная' : 'Магазин') + '</b></div><button type="button" onclick="zgGmDeliveryImportClose()">×</button></header>' +
      '<input type="search" value="' + esc(importSearch) + '" placeholder="Найти в источнике" oninput="zgGmDeliveryImportSearch(this.value)">' +
      '<div>' + (rows.length ? rows.map(function (item) {
        return '<article><i>' + esc(item.payload.icon || '📦') + '</i><span><b>' + esc(item.title) + '</b><small>' + esc(itemCategoryLabel(item.payload.category) + (item.payload.damageFormula ? ' · ' + item.payload.damageFormula : '') + (item.payload.acBonus ? ' · AC +' + item.payload.acBonus : '')) + '</small></span><button type="button" onclick="zgGmDeliveryImportOne(\'' + esc(item.id) + '\')">В библиотеку</button><button type="button" onclick="zgGmDeliveryImportBundle(\'' + esc(item.id) + '\')" aria-label="Добавить в набор">＋</button></article>';
      }).join('') : '<p>В этом источнике пока нет предметов.</p>') + '</div></section>';
  }

  function kindLabel(kind) {
    return {item:'Предмет', quest:'Задание', text:'Текст', image:'Изображение'}[kind] || 'Сообщение';
  }

  function kindIcon(kind) {
    return {item:'▣', quest:'◇', text:'✎', image:'▧'}[kind] || '✦';
  }

  function renderPanel(options) {
    options = options || {};
    ensureUi();
    var host = node('zg-gm-delivery-body');
    if (!host) return;
    if (!options.skipRemember) rememberPanelDraft();
    var members = playerMembers();
    var validTargets = members.map(function (member) { return member.uid; });
    if (members.length > 1) validTargets.unshift('__all__');
    if (validTargets.indexOf(activeTarget) < 0) activeTarget = validTargets[0] || '';
    var draft = draftForKind(activeKind), payload = draft.payload || {};
    activeMood = draft.mood || activeMood;
    activeImage = draft.image || '';
    var fields = activeKind === 'item'
      ? '<div class="zg-gm-delivery-row compact"><label>Иконка<input id="zg-gm-delivery-icon" maxlength="20" value="' + esc(payload.icon || '📦') + '"></label><label>Количество<input id="zg-gm-delivery-qty" type="number" min="1" max="999" value="' + Math.max(1, Number(payload.qty) || 1) + '"></label><label>Категория<select id="zg-gm-delivery-category"><option value="other"' + selected(payload.category,'other') + '>Другое</option><option value="weapon"' + selected(payload.category,'weapon') + '>Оружие</option><option value="armor"' + selected(payload.category,'armor') + '>Броня</option><option value="shield"' + selected(payload.category,'shield') + '>Щит</option><option value="consumable"' + selected(payload.category,'consumable') + '>Расходник</option><option value="material"' + selected(payload.category,'material') + '>Материал</option><option value="key"' + selected(payload.category,'key') + '>Ключ</option></select></label></div>' +
        '<div class="zg-gm-delivery-row compact"><label>Урон<input id="zg-gm-delivery-damage" maxlength="40" placeholder="1d6+2" value="' + esc(payload.damageFormula || '') + '"></label><label>Тип урона<input id="zg-gm-delivery-damage-type" maxlength="80" placeholder="Рубящий" value="' + esc(payload.damageType || '') + '"></label><label>Характеристика<select id="zg-gm-delivery-attack-stat"><option value="str"' + selected(payload.attackStat,'str') + '>Сила</option><option value="dex"' + selected(payload.attackStat,'dex') + '>Ловкость</option><option value="int"' + selected(payload.attackStat,'int') + '>Интеллект</option><option value="cha"' + selected(payload.attackStat,'cha') + '>Харизма</option><option value="per"' + selected(payload.attackStat,'per') + '>Восприятие</option></select></label></div>' +
        '<div class="zg-gm-delivery-row compact"><label>Бонус AC<input id="zg-gm-delivery-ac" type="number" min="-99" max="99" value="' + (Number(payload.acBonus) || 0) + '"></label><label>Дальность<input id="zg-gm-delivery-range" maxlength="80" placeholder="1 клетка" value="' + esc(payload.range || '1 клетка') + '"></label><label>Вес<input id="zg-gm-delivery-weight" type="number" min="0" max="9999" step="0.1" value="' + (Number(payload.weight) || 0) + '"></label></div>' +
        '<div class="zg-gm-delivery-row"><label>Слот экипировки<select id="zg-gm-delivery-slot"><option value=""' + selected(payload.slot,'') + '>Определить по предмету</option><option value="weapon"' + selected(payload.slot,'weapon') + '>Оружие</option><option value="head"' + selected(payload.slot,'head') + '>Голова</option><option value="armor"' + selected(payload.slot,'armor') + '>Доспех</option><option value="cloak"' + selected(payload.slot,'cloak') + '>Плащ</option><option value="hands"' + selected(payload.slot,'hands') + '>Руки</option><option value="legs"' + selected(payload.slot,'legs') + '>Ноги</option><option value="accessory1"' + selected(payload.slot,'accessory1') + '>Аксессуар</option></select></label></div>' +
        '<label>Эффекты предмета<input id="zg-gm-delivery-effects" maxlength="2000" placeholder="+1 к скорости, +2 к Силе…" value="' + esc(payload.effects || '') + '"></label>'
      : '';
    var templates = filteredTemplates();
    var shelf = activeShelf === 'history'
      ? '<section class="zg-gm-delivery-history">' +
          (history.length ? history.slice(0, 50).map(function (entry) {
            return '<article class="' + esc(entry.status || 'sent') + '"><i>' + kindIcon(entry.value.kind) + '</i><div><small>' + esc(kindLabel(entry.value.kind)) + ' · ' + esc(historyTargetNames(entry)) + '</small><b>' + esc(entry.value.title || 'Выдача') + '</b><span>' + new Date(Number(entry.createdAt) || Date.now()).toLocaleString('ru-RU') + '</span></div><button type="button" onclick="zgGmDeliveryRepeat(\'' + esc(entry.id) + '\')" ' + (busy ? 'disabled' : '') + '>Повторить</button></article>';
          }).join('') : '<p>Отправленные выдачи появятся здесь.</p>') +
        '</section>'
      : '<section class="zg-gm-delivery-library"><header><b>Библиотека ГМ · ' + kindLabel(activeKind) + '</b><span>' + templates.length + ' / ' + (library[activeKind] || []).length + '</span></header>' +
          '<div class="zg-gm-delivery-library-tools"><input type="search" value="' + esc(librarySearch) + '" placeholder="Найти заготовку" oninput="zgGmDeliveryLibrarySearch(this.value)">' +
            (activeKind === 'item' ? '<select onchange="zgGmDeliveryLibraryCategory(this.value)"><option value="all"' + selected(libraryCategory,'all') + '>Все категории</option><option value="weapon"' + selected(libraryCategory,'weapon') + '>Оружие</option><option value="armor"' + selected(libraryCategory,'armor') + '>Броня</option><option value="shield"' + selected(libraryCategory,'shield') + '>Щиты</option><option value="consumable"' + selected(libraryCategory,'consumable') + '>Расходники</option><option value="material"' + selected(libraryCategory,'material') + '>Материалы</option><option value="key"' + selected(libraryCategory,'key') + '>Ключи</option><option value="other"' + selected(libraryCategory,'other') + '>Другое</option></select>' : '') +
            '<select onchange="zgGmDeliveryLibrarySort(this.value)"><option value="recent"' + selected(librarySort,'recent') + '>Сначала новые</option><option value="title"' + selected(librarySort,'title') + '>По названию</option>' + (activeKind === 'item' ? '<option value="category"' + selected(librarySort,'category') + '>По категории</option>' : '') + '</select></div>' +
          (activeKind === 'item' ? '<div class="zg-gm-delivery-import-actions"><button type="button" onclick="zgGmDeliveryImportOpen(\'armory\')">Импорт из оружейной</button><button type="button" onclick="zgGmDeliveryImportOpen(\'shop\')">Импорт из магазина</button></div>' : '') +
          (templates.length ? templates.map(function (template) {
            var category = activeKind === 'item' ? itemCategoryLabel(template.payload && template.payload.category || 'other') : '';
            return '<div class="zg-gm-delivery-template-row"><button type="button" onclick="zgGmDeliveryUseTemplate(\'' + esc(template.id) + '\')"><i>' + esc(template.payload && template.payload.icon || kindIcon(activeKind)) + '</i><span><b>' + esc(template.title) + '</b><small>' + esc((category ? category + ' · ' : '') + (template.text || 'Без описания')) + '</small></span></button>' + (activeKind === 'item' ? '<button type="button" class="bundle" onclick="zgGmDeliveryBundleAddTemplate(\'' + esc(template.id) + '\')" aria-label="Добавить в набор">＋</button>' : '') + '<button type="button" class="remove" onclick="zgGmDeliveryRemoveTemplate(\'' + esc(template.id) + '\')" aria-label="Удалить">×</button></div>';
          }).join('') : '<p>По этому фильтру заготовок нет.</p>') +
        '</section>' + importMarkup();
    host.innerHTML =
      '<section class="zg-gm-delivery-compose"><label>Получатель<select id="zg-gm-delivery-target">' +
        (members.length > 1 ? '<option value="__all__"' + selected(activeTarget,'__all__') + '>✦ Вся группа · ' + members.length + '</option>' : '') +
        (members.length ? members.map(function (member) {
          return '<option value="' + esc(member.uid) + '"' + selected(activeTarget,member.uid) + '>' + esc(member.character.name || member.name || 'Игрок') + '</option>';
        }).join('') : '<option value="">Нет готовых игроков</option>') +
      '</select></label>' +
      '<nav class="zg-gm-delivery-tabs">' +
        ['item','quest','text','image'].map(function (kind) {
          return '<button type="button" class="' + (activeKind === kind ? 'active' : '') + '" onclick="zgGmDeliveryKind(\'' + kind + '\')"><i>' + kindIcon(kind) + '</i>' + kindLabel(kind) + '</button>';
        }).join('') +
      '</nav>' +
      '<label>Название<input id="zg-gm-delivery-title" maxlength="180" value="' + esc(draft.title || '') + '" placeholder="' + (activeKind === 'quest' ? 'Главная цель' : activeKind === 'item' ? 'Название предмета' : 'Заголовок') + '"></label>' +
      '<label>Текст<textarea id="zg-gm-delivery-text" maxlength="6000" rows="5" placeholder="Что увидит игрок">' + esc(draft.text || '') + '</textarea></label>' +
      fields +
      '<label>Изображение<input id="zg-gm-delivery-image" maxlength="350000" placeholder="URL или загруженный файл" value="' + esc(draft.image || '') + '"></label>' +
      '<div class="zg-gm-delivery-upload"><input id="zg-gm-delivery-file" type="file" accept="image/*" hidden><button type="button" onclick="document.getElementById(\'zg-gm-delivery-file\').click()">Загрузить изображение</button><small>До 250 КБ</small></div>' +
      '<fieldset class="zg-gm-delivery-moods"><legend>Настроение показа</legend>' +
        '<button type="button" class="' + (activeMood === 'calm' ? 'active' : '') + '" data-mood="calm" onclick="zgGmDeliveryMood(\'calm\')">Спокойное</button>' +
        '<button type="button" class="' + (activeMood === 'solemn' ? 'active' : '') + '" data-mood="solemn" onclick="zgGmDeliveryMood(\'solemn\')">Торжественное</button>' +
        '<button type="button" class="' + (activeMood === 'ominous' ? 'active' : '') + '" data-mood="ominous" onclick="zgGmDeliveryMood(\'ominous\')">Тревожное</button>' +
      '</fieldset>' +
      '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-popup-toggle" type="checkbox" ' + (draft.showPopup === false ? '' : 'checked') + '><span>Показать игроку большое уведомление</span></label>' +
      '<section id="zg-gm-delivery-preview" class="zg-gm-delivery-preview"><header>Предпросмотр карточки игрока</header>' + previewMarkup(draft) + '</section>' +
      bundleMarkup() +
      '<div class="zg-gm-delivery-actions"><button type="button" onclick="zgGmDeliverySaveTemplate()">Сохранить в библиотеку</button><button type="button" class="primary" onclick="zgGmDeliverySend()" ' + (!members.length || busy ? 'disabled' : '') + '>' + (busy ? 'Отправляем…' : activeTarget === '__all__' ? 'Выдать группе' : 'Выдать') + '</button></div></section>' +
      '<nav class="zg-gm-delivery-shelves"><button type="button" class="' + (activeShelf === 'library' ? 'active' : '') + '" onclick="zgGmDeliveryShelf(\'library\')">Библиотека</button><button type="button" class="' + (activeShelf === 'history' ? 'active' : '') + '" onclick="zgGmDeliveryShelf(\'history\')">История <span>' + history.length + '</span></button></nav>' +
      shelf;
    var file = node('zg-gm-delivery-file');
    if (file) file.addEventListener('change', readImageFile);
    host.oninput = function (event) {
      if (event.target && event.target.closest && event.target.closest('.zg-gm-delivery-compose')) refreshDeliveryPreview();
    };
    host.onchange = function (event) {
      if (event.target && event.target.id === 'zg-gm-delivery-target') activeTarget = event.target.value;
      if (event.target && event.target.closest && event.target.closest('.zg-gm-delivery-compose')) refreshDeliveryPreview();
    };
  }

  function refreshDeliveryPreview() {
    var host = node('zg-gm-delivery-preview');
    if (!host) return;
    host.innerHTML = '<header>Предпросмотр карточки игрока</header>' + previewMarkup(currentForm());
  }

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
      ['zg-gm-delivery-weight','weight'],['zg-gm-delivery-slot','slot']
    ].forEach(function (pair) {
      var input = node(pair[0]);
      if (input && payload[pair[1]] != null) input.value = payload[pair[1]];
    });
    refreshDeliveryPreview();
  }

  function readImageFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      if (w.showToast) w.showToast('Изображение больше 250 КБ');
      event.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      activeImage = String(reader.result || '');
      var input = node('zg-gm-delivery-image');
      if (input) input.value = activeImage;
      refreshDeliveryPreview();
      if (w.showToast) w.showToast('Изображение готово к отправке');
    };
    reader.readAsDataURL(file);
  }

  w.zgGmDeliveryToggle = function (force) {
    ensureUi();
    var panel = node('zg-gm-delivery-panel');
    if (!panel) return;
    var open = force == null ? !panel.classList.contains('open') : !!force;
    panel.classList.toggle('open', open);
    if (open) renderPanel();
  };

  w.zgGmDeliveryKind = function (kind) {
    rememberPanelDraft();
    activeKind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'text';
    var draft = draftForKind(activeKind);
    activeImage = draft.image || '';
    activeMood = draft.mood || 'calm';
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

  w.zgGmDeliveryShelf = function (shelf) {
    rememberPanelDraft();
    activeShelf = shelf === 'history' ? 'history' : 'library';
    renderPanel({skipRemember:true});
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

  w.zgGmDeliverySaveTemplate = function () {
    var value = currentForm();
    if (!value.title) {
      if (w.showToast) w.showToast('Укажите название');
      return;
    }
    value.id = 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
    value.createdAt = Date.now();
    value.updatedAt = value.createdAt;
    library[activeKind].unshift(value);
    library[activeKind] = library[activeKind].slice(0, 80);
    if (saveLibrary(library)) {
      renderPanel();
      if (w.showToast) w.showToast('Сохранено в библиотеку ГМ');
    }
  };

  w.zgGmDeliveryUseTemplate = function (id) {
    var value = (library[activeKind] || []).filter(function (item) { return item && item.id === id; })[0];
    if (!value) return;
    rememberPanelDraft();
    activeMood = value.mood || 'calm';
    drafts[activeKind] = JSON.parse(JSON.stringify(value));
    activeImage = value.image || '';
    renderPanel({skipRemember:true});
  };

  w.zgGmDeliveryRemoveTemplate = function (id) {
    library[activeKind] = (library[activeKind] || []).filter(function (item) { return item && item.id !== id; });
    saveLibrary(library);
    renderPanel();
  };

  w.zgGmDeliveryImportOpen = function (source) {
    rememberPanelDraft();
    importSource = source === 'shop' ? 'shop' : 'armory';
    importSearch = '';
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

  w.zgGmDeliveryImportOne = function (id) {
    var item = externalItemById(id);
    if (!item) return;
    var duplicate = library.item.filter(function (entry) {
      return entry && entry.externalSource === item.externalSource && String(entry.externalId) === String(item.externalId);
    })[0];
    if (duplicate) {
      if (w.showToast) w.showToast('Этот предмет уже есть в библиотеке ГМ');
      return;
    }
    library.item.unshift(JSON.parse(JSON.stringify(item)));
    library.item = library.item.slice(0, 80);
    if (saveLibrary(library)) {
      renderPanel({skipRemember:true});
      if (w.showToast) w.showToast('Предмет импортирован в библиотеку');
    }
  };

  w.zgGmDeliveryImportBundle = function (id) {
    var item = externalItemById(id);
    if (!item || !addBundleItem(item)) return;
    renderPanel();
    if (w.showToast) w.showToast('Предмет добавлен в набор');
  };

  w.zgGmDeliveryBundleAddCurrent = function () {
    var value = currentForm();
    if (!addBundleItem(value)) return;
    drafts.item = value;
    renderPanel({skipRemember:true});
    if (w.showToast) w.showToast('Предмет добавлен в набор');
  };

  w.zgGmDeliveryBundleAddTemplate = function (id) {
    var item = (library.item || []).filter(function (entry) { return entry && entry.id === id; })[0];
    if (!item || !addBundleItem(item)) return;
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
    if (selection === '__all__') return members;
    return members.filter(function (member) { return String(member.uid) === String(selection); });
  }

  function historySafeValue(value) {
    var copy;
    try { copy = JSON.parse(JSON.stringify(value)); } catch (error) { copy = {kind:value.kind,title:value.title,text:value.text,mood:value.mood,showPopup:value.showPopup,payload:value.payload || {}}; }
    if (copy.image && /^data:image\//i.test(copy.image) && copy.image.length > 80000) {
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
        if (item && item.image && /^data:image\//i.test(item.image) && (item.image.length > 80000 || bundleDataImageSize > 80000)) {
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
      if (w.showToast) w.showToast(queued
        ? 'Нет связи — выдача сохранена и отправится автоматически'
        : memberUids.length > 1 ? 'Выдача отправлена всей группе' : 'Выдача отправлена игроку');
      if (!queued && !repeatedFrom) {
        delete drafts[activeKind];
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
    var target = node('zg-gm-delivery-target');
    var form = currentForm();
    var value = bundledSendValue(form);
    if (!target || !target.value || !value.title) {
      if (w.showToast) w.showToast(!target || !target.value ? 'Выберите игрока' : 'Укажите название');
      return;
    }
    var members = targetMembers(target.value);
    if (!members.length) {
      if (w.showToast) w.showToast('Выбранные игроки больше не подключены');
      return;
    }
    activeTarget = target.value;
    drafts[activeKind] = form;
    sendDelivery(value, members, '');
  };

  w.zgGmDeliveryRepeat = function (historyId) {
    if (busy) return;
    var entry = history.filter(function (item) { return item && item.id === historyId; })[0];
    if (!entry) return;
    var available = playerMembers(), members = available.filter(function (member) {
      return entry.memberUids.indexOf(member.uid) >= 0;
    });
    if (!members.length) {
      if (w.showToast) w.showToast('Получатели этой выдачи сейчас недоступны');
      return;
    }
    sendDelivery(entry.value, members, entry.id);
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

  function applyDelivery(delivery, member) {
    var character = localCharacter(member);
    if ((delivery.kind === 'item' || delivery.kind === 'quest') && !character) {
      return Promise.reject(new Error('Локальный лист выбранного героя не найден.'));
    }
    var deliveryId = String(delivery.id || '');
    var already = character && appliedIds(character).indexOf(deliveryId) >= 0;
    var rollback = null;
    var changed = false;
    if (character && !already && (delivery.kind === 'item' || delivery.kind === 'quest')) {
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
      var quest = delivery.payload && delivery.payload.quest || {};
      var journalId = 'gm-' + deliveryId.replace(/[^a-zA-Z0-9_-]/g, '');
      var journal = Array.isArray(character.journalEntries) ? character.journalEntries.slice() : [];
      var questExists = journal.some(function (entry) { return entry && String(entry.journalId || '') === journalId; });
      if (!questExists) {
        if (journal.length >= 80) return Promise.reject(new Error('Журнал заполнен: цель ГМ пока не применена.'));
        journal.push({
          journalId:journalId,
          title:quest.title || delivery.title || 'Новая цель',
          text:quest.text || delivery.text || '',
          image:quest.image || delivery.image || '',
          kind:'quest',
          createdAt:Number(delivery.createdAt) || Date.now(),
          updatedAt:Number(delivery.createdAt) || Date.now(),
          updatedBy:'gm'
        });
        character.journalEntries = journal;
        changed = true;
      }
    }
    var save = Promise.resolve({ok:true});
    if (character && !already && (delivery.kind === 'item' || delivery.kind === 'quest')) {
      character._gmDeliveryIds = appliedIds(character).concat(deliveryId).slice(-120);
      changed = true;
    }
    if (character && changed) {
      save = typeof w.saveChars === 'function'
        ? Promise.resolve(w.saveChars({reason:delivery.kind === 'item' ? 'inventory-add' : 'journal-add'}))
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
    return {item:'Получен предмет', quest:'Новая цель', text:'Послание мастера', image:'Открыт образ'}[delivery.kind] || 'Получено';
  }

  function enqueuePopup(delivery) {
    popupQueue.push(delivery);
    showNextPopup();
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
    var itemMeta = deliveredItems.length
      ? '<div class="zg-delivery-popup-bundle"><b>Получено предметов: ' + deliveredItems.length + '</b>' + deliveredItems.map(function (item) {
          return '<span><i>' + esc(item.icon || '📦') + '</i><em>' + esc(item.name || item.title || 'Предмет') + '</em><strong>×' + Math.max(1, Number(item.qty) || 1) + '</strong></span>';
        }).join('') + '</div>'
      : delivery.kind === 'item' && delivery.payload && delivery.payload.item
        ? '<div class="zg-delivery-popup-meta"><span>' + esc(delivery.payload.item.icon || '📦') + '</span><b>Количество: ' + Math.max(1, Number(delivery.payload.item.qty) || 1) + '</b></div>'
        : '';
    popupOpen = true;
    popup.className = 'zg-player-delivery-popup open mood-' + (delivery.mood || 'calm');
    host.innerHTML =
      '<small>' + esc(popupTitle(delivery)) + '</small>' +
      (delivery.image ? '<img src="' + esc(delivery.image) + '" alt="">' : '<i>' + kindIcon(delivery.kind) + '</i>') +
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
      if (delivery.showPopup !== false) enqueuePopup(delivery);
      else if (w.showToast) w.showToast('Получено: ' + (delivery.title || kindLabel(delivery.kind)));
      if (w.zgVttRefreshDrawer) w.zgVttRefreshDrawer();
    }).catch(function (error) {
      if (w.showToast) w.showToast(error && error.message || 'Не удалось применить выдачу ГМ');
    }).then(function () {
      delete applying[delivery.id];
    });
  }

  function sync(nextSnapshot) {
    snapshot = nextSnapshot || snapshot;
    if (!snapshot || !snapshot.session || !snapshot.room) return;
    ensureUi();
    if (snapshot.session.role === 'master') {
      var panel = node('zg-gm-delivery-panel');
      if (panel && panel.classList.contains('open')) renderPanel();
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
    if (popup && popup.classList.contains('open')) {
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
