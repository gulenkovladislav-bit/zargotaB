(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaEquipmentRules = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var STAT_KEYS = ['str', 'dex', 'int', 'cha', 'per', 'con'];
  var STAT_PATTERNS = {
    str:[/([+-]?\d+)\s*(?:к\s*)?(?:сил[аеуы]|strength|str)/i, /(?:сил[аы]|strength|str).{0,12}?([+-]?\d+)/i],
    dex:[/([+-]?\d+)\s*(?:к\s*)?(?:ловк|dexterity|dex)/i, /(?:ловк|dexterity|dex).{0,12}?([+-]?\d+)/i],
    int:[/([+-]?\d+)\s*(?:к\s*)?(?:интеллект|intelligence|int)/i, /(?:интеллект|intelligence|int).{0,12}?([+-]?\d+)/i],
    cha:[/([+-]?\d+)\s*(?:к\s*)?(?:харизм|charisma|cha)/i, /(?:харизм|charisma|cha).{0,12}?([+-]?\d+)/i],
    per:[/([+-]?\d+)\s*(?:к\s*)?(?:восприят|perception|per)/i, /(?:восприят|perception|per).{0,12}?([+-]?\d+)/i],
    con:[/([+-]?\d+)\s*(?:к\s*)?(?:вынослив|constitution|con)/i, /(?:вынослив|constitution|con).{0,12}?([+-]?\d+)/i]
  };

  function finiteNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstNumber(source, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      var value = finiteNumber(source && source[keys[index]]);
      if (value !== null) return value;
    }
    return null;
  }

  function firstMatch(text, patterns) {
    for (var index = 0; index < patterns.length; index += 1) {
      var match = String(text || '').match(patterns[index]);
      if (match) return Number(match[1] || match[2]) || 0;
    }
    return 0;
  }

  function itemText(item) {
    return [item && item.effects, item && item.effect, item && item.description, item && item.text]
      .filter(Boolean).join(' · ');
  }

  function equipmentKind(item) {
    var hay = [
      item && item.slot,
      item && item.category,
      item && item.cat,
      item && item.type,
      item && item.name
    ].filter(Boolean).join(' ').toLowerCase();
    if (/shield|щит/.test(hay)) return 'shield';
    if (/weapon|оруж|меч|кинжал|рапир|топор|лук|арбалет|молот|булав|дубин|копь|алебард|посох/.test(hay)) return 'weapon';
    return 'other';
  }

  function itemHandsRequired(item) {
    var explicit = Number(item && item.handsRequired);
    if (explicit === 1 || explicit === 2) return explicit;
    if (equipmentKind(item) !== 'weapon') return 1;
    var hay = [
      item && item.grip,
      item && item.tags,
      item && item.type,
      item && item.category,
      item && item.name,
      item && item.description
    ].filter(Boolean).join(' ').toLowerCase();
    return /двуруч|две руки|two.?hand|greatsword|greataxe|longbow|длинн(?:ый|ого) лук|алебард|пик(?:а|и)\b/.test(hay) ? 2 : 1;
  }

  function normalizedEquipmentSlot(item) {
    var explicit = String(item && item.slot || '').trim();
    var lower = explicit.toLowerCase();
    if (lower === 'weapon' || lower === 'mainhand' || lower === 'main-hand' || lower === 'main_hand') return 'mainHand';
    if (lower === 'offhand' || lower === 'off-hand' || lower === 'off_hand') return 'offHand';
    if (equipmentKind(item) === 'shield') return 'offHand';
    if (equipmentKind(item) === 'weapon') return 'mainHand';
    return explicit;
  }

  function canEquipInSlot(item, requestedSlot) {
    var slot = normalizedEquipmentSlot({ slot:requestedSlot });
    var kind = equipmentKind(item);
    if (slot === 'mainHand') return kind === 'weapon';
    if (slot === 'offHand') return kind === 'shield' || kind === 'weapon' && itemHandsRequired(item) === 1;
    return true;
  }

  function planHandEquip(items, targetIndex, requestedSlot) {
    var list = Array.isArray(items) ? items.map(function (item) {
      return item && typeof item === 'object' ? Object.assign({}, item) : item;
    }) : [];
    var target = list[targetIndex];
    if (!target || typeof target !== 'object') return { ok:false, error:'item-missing', items:list };
    var slot = normalizedEquipmentSlot({ slot:requestedSlot || normalizedEquipmentSlot(target) });
    if (slot !== 'mainHand' && slot !== 'offHand') slot = normalizedEquipmentSlot(target);
    if (!canEquipInSlot(target, slot)) return { ok:false, error:'slot-incompatible', items:list };
    var required = itemHandsRequired(target);
    if (required === 2) slot = 'mainHand';
    list.forEach(function (item, index) {
      if (!item || typeof item !== 'object' || index === targetIndex || item.equipped !== true) return;
      var occupied = normalizedEquipmentSlot(item);
      var conflicts = required === 2
        ? occupied === 'mainHand' || occupied === 'offHand'
        : occupied === slot || itemHandsRequired(item) === 2 && occupied === 'mainHand';
      if (conflicts) {
        item.equipped = false;
        delete item.slot;
      }
    });
    target.equipped = true;
    target.slot = slot;
    target.handsRequired = required;
    return { ok:true, slot:slot, handsRequired:required, items:list };
  }

  function resolveHandSlots(items) {
    var result = { mainHand:null, offHand:null, twoHanded:false };
    (Array.isArray(items) ? items : []).forEach(function (item, index) {
      if (!item || typeof item !== 'object' || item.equipped !== true) return;
      var kind = equipmentKind(item);
      if (kind !== 'weapon' && kind !== 'shield') return;
      var slot = normalizedEquipmentSlot(item);
      if (itemHandsRequired(item) === 2) {
        if (!result.mainHand) {
          result.mainHand = { item:item, index:index };
          result.twoHanded = true;
          result.offHand = null;
        }
        return;
      }
      if (result.twoHanded) return;
      if (slot === 'offHand' && !result.offHand) result.offHand = { item:item, index:index };
      else if (!result.mainHand) result.mainHand = { item:item, index:index };
      else if (!result.offHand && kind === 'weapon') result.offHand = { item:item, index:index };
    });
    return result;
  }

  function itemIdentity(item, source, slot, index) {
    var stableId = item && (item.itemId || item.instanceId);
    if (stableId) return 'item:' + String(stableId);
    if (source === 'armory') return 'armory:' + String(item && item.id || index) + ':' + String(slot || '');
    return source + ':' + String(index);
  }

  function collectEquippedItems(character, armoryItems) {
    character = character && typeof character === 'object' ? character : {};
    armoryItems = Array.isArray(armoryItems) ? armoryItems : [];
    var records = [], seen = Object.create(null);

    function add(item, source, slot, index) {
      if (!item || typeof item !== 'object') return;
      var identity = itemIdentity(item, source, slot, index);
      if (seen[identity]) return;
      seen[identity] = true;
      records.push({ item:item, source:source, slot:slot || item.slot || '', identity:identity });
    }

    (Array.isArray(character.inventoryItems) ? character.inventoryItems : []).forEach(function (item, index) {
      if (item && item.equipped === true) add(item, 'inventory', item.slot, index);
    });
    (Array.isArray(character.equipItems) ? character.equipItems : []).forEach(function (item, index) {
      if (item && item.equipped !== false) add(item, 'legacy', item.slot, index);
    });
    Object.keys(character.arenaEquipSlots || {}).forEach(function (slot) {
      var itemId = character.arenaEquipSlots[slot];
      var item = armoryItems.filter(function (candidate) {
        return candidate && String(candidate.id) === String(itemId);
      })[0];
      if (item) add(item, 'armory', slot, slot);
    });
    return records;
  }

  function calculate(character, armoryItems) {
    var result = {
      acBonus:0,
      hpBonus:0,
      speedBonus:0,
      initiativeBonus:0,
      weapon:null,
      effects:[],
      statBonuses:{ str:0, dex:0, int:0, cha:0, per:0, con:0 },
      sources:[]
    };

    collectEquippedItems(character, armoryItems).forEach(function (record) {
      var item = record.item;
      var text = itemText(item);
      var kind = equipmentKind(item);
      var itemBonuses = {
        ac:firstNumber(item, ['acBonus', 'armorBonus', 'defense']),
        hp:firstNumber(item, ['hpBonus', 'maxHpBonus', 'healthBonus']),
        speed:firstNumber(item, ['speedBonus', 'movementBonus']),
        initiative:firstNumber(item, ['initiativeBonus', 'initBonus']),
        stats:{}
      };

      if (itemBonuses.ac === null) {
        itemBonuses.ac = firstMatch(text, [/\bAC\s*([+-]?\d+)/, /([+-]?\d+)\s*к\s*AC\b/i, /брон[ьи][^.]{0,15}?\s([+-]?\d+)(?:$|\s|[.,])/i]);
        if (!itemBonuses.ac && kind === 'shield') itemBonuses.ac = 2;
      }
      if (itemBonuses.hp === null) itemBonuses.hp = firstMatch(text, [/([+-]?\d+)\s*(?:к\s*)?(?:макс\.?\s*)?(?:hp|хп|здоров[ьяе])/i, /max\s*hp\s*([+-]?\d+)/i, /hp\s*max\s*([+-]?\d+)/i, /(?:макс|maximum|здоров[ьяе]|хп).{0,12}?([+-]?\d+)/i]);
      if (itemBonuses.speed === null) itemBonuses.speed = firstMatch(text, [/([+-]?\d+)\s*(?:к\s*)?(?:скорост|движени|speed)/i, /(?:скорост|движени|speed).{0,12}?([+-]?\d+)/i]);
      if (itemBonuses.initiative === null) itemBonuses.initiative = firstMatch(text, [/([+-]?\d+)\s*(?:к\s*)?(?:иниц|initiative)/i, /(?:иниц|initiative).{0,12}?([+-]?\d+)/i]);

      STAT_KEYS.forEach(function (stat) {
        var explicit = firstNumber(item.statBonuses, [stat]);
        if (explicit === null) explicit = firstNumber(item, [stat + 'Bonus']);
        itemBonuses.stats[stat] = explicit === null ? firstMatch(text, STAT_PATTERNS[stat]) : explicit;
        result.statBonuses[stat] += itemBonuses.stats[stat];
      });

      result.acBonus += itemBonuses.ac || 0;
      result.hpBonus += itemBonuses.hp || 0;
      result.speedBonus += itemBonuses.speed || 0;
      result.initiativeBonus += itemBonuses.initiative || 0;
      if (text) result.effects.push(text);

      if (!result.weapon && kind === 'weapon') {
        result.weapon = {
          id:String(item.itemId || item.id || record.identity),
          name:item.name || 'Оружие',
          damageFormula:item.damageFormula || item.damage || '1d4',
          damageType:item.damageType || '',
          range:item.range || '1 клетка',
          attackStat:item.attackStat || item.stat || 'str',
          slot:normalizedEquipmentSlot(Object.assign({},item,{slot:record.slot||item.slot})),
          handsRequired:itemHandsRequired(item)
        };
      }

      result.sources.push({
        id:record.identity,
        source:record.source,
        slot:record.slot,
        name:item.name || item.text || 'Предмет',
        bonuses:itemBonuses
      });
    });
    return result;
  }

  return {
    STAT_KEYS:STAT_KEYS.slice(),
    equipmentKind:equipmentKind,
    itemHandsRequired:itemHandsRequired,
    normalizedEquipmentSlot:normalizedEquipmentSlot,
    canEquipInSlot:canEquipInSlot,
    planHandEquip:planHandEquip,
    resolveHandSlots:resolveHandSlots,
    collectEquippedItems:collectEquippedItems,
    calculate:calculate
  };
});
