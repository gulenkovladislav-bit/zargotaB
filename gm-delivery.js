(function (w) {
  'use strict';

  var STORAGE_KEY = 'zargota_gm_delivery_library_v1';
  var MAX_IMAGE_BYTES = 250 * 1024;
  var snapshot = null;
  var activeKind = 'item';
  var activeMood = 'calm';
  var activeImage = '';
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
        acBonus:node('zg-gm-delivery-ac') && node('zg-gm-delivery-ac').value
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

  function kindLabel(kind) {
    return {item:'Предмет', quest:'Задание', text:'Текст', image:'Изображение'}[kind] || 'Сообщение';
  }

  function kindIcon(kind) {
    return {item:'▣', quest:'◇', text:'✎', image:'▧'}[kind] || '✦';
  }

  function renderPanel() {
    ensureUi();
    var host = node('zg-gm-delivery-body');
    if (!host) return;
    var members = playerMembers();
    var fields = activeKind === 'item'
      ? '<div class="zg-gm-delivery-row compact"><label>Иконка<input id="zg-gm-delivery-icon" maxlength="20" value="📦"></label><label>Количество<input id="zg-gm-delivery-qty" type="number" min="1" max="999" value="1"></label><label>Категория<select id="zg-gm-delivery-category"><option value="other">Другое</option><option value="weapon">Оружие</option><option value="armor">Броня</option><option value="shield">Щит</option><option value="consumable">Расходник</option><option value="material">Материал</option><option value="key">Ключ</option></select></label></div>' +
        '<div class="zg-gm-delivery-row compact"><label>Урон<input id="zg-gm-delivery-damage" maxlength="40" placeholder="1d6+2"></label><label>Тип урона<input id="zg-gm-delivery-damage-type" maxlength="80" placeholder="Рубящий"></label><label>Бонус AC<input id="zg-gm-delivery-ac" type="number" min="-99" max="99" value="0"></label></div>' +
        '<label>Эффекты предмета<input id="zg-gm-delivery-effects" maxlength="2000" placeholder="+1 к скорости, +2 к Силе…"></label>'
      : '';
    var templates = library[activeKind] || [];
    host.innerHTML =
      '<label>Получатель<select id="zg-gm-delivery-target">' +
        (members.length ? members.map(function (member) {
          return '<option value="' + esc(member.uid) + '">' + esc(member.character.name || member.name || 'Игрок') + '</option>';
        }).join('') : '<option value="">Нет готовых игроков</option>') +
      '</select></label>' +
      '<nav class="zg-gm-delivery-tabs">' +
        ['item','quest','text','image'].map(function (kind) {
          return '<button type="button" class="' + (activeKind === kind ? 'active' : '') + '" onclick="zgGmDeliveryKind(\'' + kind + '\')"><i>' + kindIcon(kind) + '</i>' + kindLabel(kind) + '</button>';
        }).join('') +
      '</nav>' +
      '<label>Название<input id="zg-gm-delivery-title" maxlength="180" placeholder="' + (activeKind === 'quest' ? 'Главная цель' : activeKind === 'item' ? 'Название предмета' : 'Заголовок') + '"></label>' +
      '<label>Текст<textarea id="zg-gm-delivery-text" maxlength="6000" rows="5" placeholder="Что увидит игрок"></textarea></label>' +
      fields +
      '<label>Изображение<input id="zg-gm-delivery-image" maxlength="350000" placeholder="URL или загруженный файл" value="' + esc(activeImage) + '"></label>' +
      '<div class="zg-gm-delivery-upload"><input id="zg-gm-delivery-file" type="file" accept="image/*" hidden><button type="button" onclick="document.getElementById(\'zg-gm-delivery-file\').click()">Загрузить изображение</button><small>До 250 КБ</small></div>' +
      '<fieldset class="zg-gm-delivery-moods"><legend>Настроение показа</legend>' +
        '<button type="button" class="' + (activeMood === 'calm' ? 'active' : '') + '" data-mood="calm" onclick="zgGmDeliveryMood(\'calm\')">Спокойное</button>' +
        '<button type="button" class="' + (activeMood === 'solemn' ? 'active' : '') + '" data-mood="solemn" onclick="zgGmDeliveryMood(\'solemn\')">Торжественное</button>' +
        '<button type="button" class="' + (activeMood === 'ominous' ? 'active' : '') + '" data-mood="ominous" onclick="zgGmDeliveryMood(\'ominous\')">Тревожное</button>' +
      '</fieldset>' +
      '<label class="zg-gm-delivery-check"><input id="zg-gm-delivery-popup-toggle" type="checkbox" checked><span>Показать игроку большое уведомление</span></label>' +
      '<div class="zg-gm-delivery-actions"><button type="button" onclick="zgGmDeliverySaveTemplate()">Сохранить в библиотеку</button><button type="button" class="primary" onclick="zgGmDeliverySend()" ' + (!members.length || busy ? 'disabled' : '') + '>' + (busy ? 'Отправляем…' : 'Выдать') + '</button></div>' +
      '<section class="zg-gm-delivery-library"><header><b>Библиотека ГМ · ' + kindLabel(activeKind) + '</b><span>' + templates.length + '</span></header>' +
        (templates.length ? templates.map(function (template) {
          return '<div><button type="button" onclick="zgGmDeliveryUseTemplate(\'' + esc(template.id) + '\')"><i>' + kindIcon(activeKind) + '</i><span><b>' + esc(template.title) + '</b><small>' + esc(template.text || 'Без описания') + '</small></span></button><button type="button" class="remove" onclick="zgGmDeliveryRemoveTemplate(\'' + esc(template.id) + '\')" aria-label="Удалить">×</button></div>';
        }).join('') : '<p>Сохраните первую заготовку для быстрой выдачи.</p>') +
      '</section>';
    var file = node('zg-gm-delivery-file');
    if (file) file.addEventListener('change', readImageFile);
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
      ['zg-gm-delivery-damage-type','damageType'],['zg-gm-delivery-ac','acBonus']
    ].forEach(function (pair) {
      var input = node(pair[0]);
      if (input && payload[pair[1]] != null) input.value = payload[pair[1]];
    });
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
    activeKind = ['item','quest','text','image'].indexOf(kind) >= 0 ? kind : 'text';
    activeImage = '';
    renderPanel();
  };

  w.zgGmDeliveryMood = function (mood) {
    activeMood = ['calm','solemn','ominous'].indexOf(mood) >= 0 ? mood : 'calm';
    var buttons = document.querySelectorAll('.zg-gm-delivery-moods button');
    for (var i = 0; i < buttons.length; i += 1) buttons[i].classList.toggle('active', buttons[i].getAttribute('data-mood') === activeMood);
  };

  w.zgGmDeliverySaveTemplate = function () {
    var value = currentForm();
    if (!value.title) {
      if (w.showToast) w.showToast('Укажите название');
      return;
    }
    value.id = 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
    value.createdAt = Date.now();
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
    activeMood = value.mood || 'calm';
    renderPanel();
    fillForm(value);
    var toggle = node('zg-gm-delivery-popup-toggle');
    if (toggle) toggle.checked = value.showPopup !== false;
  };

  w.zgGmDeliveryRemoveTemplate = function (id) {
    library[activeKind] = (library[activeKind] || []).filter(function (item) { return item && item.id !== id; });
    saveLibrary(library);
    renderPanel();
  };

  w.zgGmDeliverySend = function () {
    if (busy || !w.ZargotaRooms || !w.ZargotaRooms.gmSendDelivery) return;
    var target = node('zg-gm-delivery-target');
    var value = currentForm();
    if (!target || !target.value || !value.title) {
      if (w.showToast) w.showToast(!target || !target.value ? 'Выберите игрока' : 'Укажите название');
      return;
    }
    busy = true;
    renderPanel();
    w.ZargotaRooms.gmSendDelivery(target.value, value).then(function () {
      if (w.showToast) w.showToast('Выдача отправлена игроку');
      var title = node('zg-gm-delivery-title'), text = node('zg-gm-delivery-text');
      if (title) title.value = '';
      if (text) text.value = '';
      activeImage = '';
    }).catch(function (error) {
      if (w.showToast) w.showToast(error && error.message || 'Не удалось отправить выдачу');
    }).then(function () {
      busy = false;
      renderPanel();
    });
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
      var source = delivery.payload && delivery.payload.item || {};
      var itemId = 'gm-' + deliveryId.replace(/[^a-zA-Z0-9_-]/g, '');
      var inventory = Array.isArray(character.inventoryItems) ? character.inventoryItems.slice() : [];
      var itemExists = inventory.some(function (item) { return item && String(item.itemId || '') === itemId; });
      if (!itemExists) {
        if (inventory.length >= 80) return Promise.reject(new Error('Инвентарь заполнен: предмет ГМ пока не применён.'));
        inventory.push({
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
          qty:Math.max(1, Number(source.qty) || 1),
          equipped:false,
          receivedFromGm:true,
          receivedAt:Number(delivery.createdAt) || Date.now()
        });
        character.inventoryItems = inventory;
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
    popupOpen = true;
    popup.className = 'zg-player-delivery-popup open mood-' + (delivery.mood || 'calm');
    host.innerHTML =
      '<small>' + esc(popupTitle(delivery)) + '</small>' +
      (delivery.image ? '<img src="' + esc(delivery.image) + '" alt="">' : '<i>' + kindIcon(delivery.kind) + '</i>') +
      '<h2>' + esc(delivery.title || 'Получено') + '</h2>' +
      (delivery.text ? '<p>' + esc(delivery.text) + '</p>' : '') +
      (delivery.kind === 'item' && delivery.payload && delivery.payload.item
        ? '<div class="zg-delivery-popup-meta"><span>' + esc(delivery.payload.item.icon || '📦') + '</span><b>Количество: ' + Math.max(1, Number(delivery.payload.item.qty) || 1) + '</b></div>'
        : '');
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
