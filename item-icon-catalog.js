(function (global) {
  'use strict';

  var BASE = 'images/ui/item-icons/';
  var DEFINITIONS = [
    ['sword','Меч','Оружие'],['dagger','Кинжал','Оружие'],['axe','Топор','Оружие'],['bow','Лук','Оружие'],
    ['crossbow','Арбалет','Оружие'],['spear','Копьё','Оружие'],['hammer','Молот','Оружие'],['pickaxe','Кирка','Инструменты'],
    ['staff','Посох','Магия'],['wand','Жезл','Магия'],['shield','Щит','Снаряжение'],['armor','Доспех','Снаряжение'],
    ['helmet','Шлем','Снаряжение'],['boots','Сапоги','Снаряжение'],['gloves','Перчатки','Снаряжение'],['bracer','Наручи','Снаряжение'],
    ['cloak','Плащ','Снаряжение'],['mask','Маска','Снаряжение'],['ring','Кольцо','Украшения'],['amulet','Амулет','Украшения'],
    ['gemstone','Самоцвет','Магия'],['magic-crystal','Магический кристалл','Магия'],['spellbook','Книга магии','Документы'],['scroll','Свиток','Документы'],
    ['map-case','Карты и письма','Документы'],['key','Ключ','Инструменты'],['coin-pouch','Монеты','Разное'],['toolkit','Набор инструментов','Инструменты'],
    ['lantern','Фонарь','Инструменты'],['tinderbox','Огниво','Инструменты'],['rope','Верёвка','Инструменты'],['chain','Цепь','Инструменты'],
    ['hook','Крюк','Инструменты'],['net','Сеть','Инструменты'],['waterskin','Бурдюк','Провиант'],['rations','Провиант','Провиант'],
    ['meal-pack','Походный рацион','Провиант'],['potion','Зелье','Расходники'],['vial','Флакон','Расходники'],['bandage','Бинты','Расходники'],
    ['herbs','Травы','Материалы'],['material-pouch','Материалы','Материалы'],['weapon-oil','Масло для оружия','Расходники'],['bomb','Бомба','Расходники'],
    ['candle','Свеча','Разное'],['arrows','Стрелы','Боеприпасы'],['bolas','Боласы','Оружие'],['whistle','Свисток','Инструменты'],
    ['instrument','Лютня','Инструменты'],['drum','Барабан','Инструменты'],['flute','Флейта','Инструменты'],['backpack','Рюкзак','Разное'],
    ['crowbar','Лом','Инструменты']
  ];
  var catalog = DEFINITIONS.map(function (entry) {
    return { key:entry[0], label:entry[1], group:entry[2], path:BASE + entry[0] + '.png' };
  });
  var byKey = Object.create(null);
  catalog.forEach(function (entry) { byKey[entry.key] = entry; });

  var legacy = {
    '📦':'backpack','🗃️':'toolkit','⚔️':'sword','⚔':'sword','🗡️':'dagger','🏹':'bow','🪓':'axe','🔨':'hammer','🔱':'spear',
    '🛡️':'shield','🛡':'shield','🧥':'armor','🥋':'armor','⛑️':'helmet','🧤':'gloves','👢':'boots','🧣':'cloak',
    '💍':'ring','📿':'amulet','💎':'gemstone','🔮':'magic-crystal','📖':'spellbook','📜':'scroll','🗺️':'map-case','🔑':'key','🗝️':'key',
    '💰':'coin-pouch','🪙':'coin-pouch','🧰':'toolkit','🏮':'lantern','🏮️':'lantern','🕯️':'candle','🪢':'rope','🔗':'chain',
    '🪝':'hook','🕸️':'net','🧪':'potion','⚗️':'vial','🩹':'bandage','🌿':'herbs','🌱':'herbs','💣':'bomb',
    '🍞':'rations','🥖':'rations','🧀':'rations','🍎':'rations','🍇':'rations','🍄':'herbs','🍷':'vial','🍺':'vial','🍯':'rations',
    '🪶':'arrows','🪕':'instrument','🎺':'instrument','🪈':'flute','🎻':'instrument','🥁':'drum','💀':'mask','☠️':'mask','🦴':'material-pouch','🪨':'material-pouch'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function keyFromValue(value) {
    var raw = String(value || '');
    var art = /^art:([a-z0-9-]+)$/.exec(raw);
    if (art && byKey[art[1]]) return art[1];
    var path = /(?:^|\/)item-icons\/([a-z0-9-]+)\.png(?:[?#].*)?$/.exec(raw);
    if (path && byKey[path[1]]) return path[1];
    return legacy[raw] || '';
  }
  function guessKey(item) {
    item = item || {};
    var explicit = keyFromValue(item.icon || item.iconKey || '');
    if (explicit) return explicit;
    var category = String(item.category || item.cat || '').toLowerCase();
    var slot = String(item.slot || '').toLowerCase();
    var hay = [item.name,item.title,item.type,item.description,item.desc,item.effects,item.effect].join(' ').toLowerCase();
    var rules = [
      [/арбалет|crossbow/,'crossbow'],[/лук|bow/,'bow'],[/кинжал|нож|стилет|dagger/,'dagger'],[/копь|пик|трезуб|spear/,'spear'],[/молот|булав|дубин|hammer|mace/,'hammer'],[/топор|секир|axe/,'axe'],
      [/кирк|pickaxe/,'pickaxe'],[/посох|staff/,'staff'],[/жезл|wand/,'wand'],[/щит|shield/,'shield'],[/шлем|helmet/,'helmet'],[/перчат|рукавиц|glove/,'gloves'],[/сапог|ботин|boot/,'boots'],
      [/плащ|мант|cloak/,'cloak'],[/наруч|bracer/,'bracer'],[/маск|mask/,'mask'],[/кольц|ring/,'ring'],[/амулет|кулон|ожерел|amulet/,'amulet'],[/кристалл|самоцвет|gem/,'magic-crystal'],
      [/гримуар|книга|book/,'spellbook'],[/свиток|scroll/,'scroll'],[/карт|письм|документ|map/,'map-case'],[/ключ|key/,'key'],[/монет|coin/,'coin-pouch'],[/фонар|lantern/,'lantern'],
      [/огнив|tinder/,'tinderbox'],[/вер[её]в|канат|rope/,'rope'],[/цеп|chain/,'chain'],[/крюк|багор|hook/,'hook'],[/сеть|net/,'net'],[/бурдюк|waterskin/,'waterskin'],
      [/зель|эликсир|настой|potion/,'potion'],[/флакон|vial/,'vial'],[/бинт|bandage/,'bandage'],[/трав|герб|herb/,'herbs'],[/бомб|гранат|bomb/,'bomb'],[/стрел|боеприпас|arrow/,'arrows'],
      [/свист|whistle/,'whistle'],[/лютн|instrument/,'instrument'],[/барабан|drum/,'drum'],[/флейт|flute/,'flute'],[/рюкзак|сумк|pack/,'backpack'],[/рацион|провиант|еда|хлеб|пирог|food/,'rations']
    ];
    for (var index = 0; index < rules.length; index += 1) if (rules[index][0].test(hay)) return rules[index][1];
    if (/head/.test(slot)) return 'helmet';
    if (/glove|hand/.test(slot) && category !== 'weapon') return 'gloves';
    if (/boot|feet|leg/.test(slot)) return 'boots';
    if (/cloak/.test(slot)) return 'cloak';
    if (/amulet/.test(slot)) return 'amulet';
    if (/ring/.test(slot)) return 'ring';
    if (category === 'weapon') return 'sword';
    if (/armor|clothing/.test(category)) return 'armor';
    if (category === 'shield') return 'shield';
    if (/consumable|food/.test(category)) return 'potion';
    if (/material/.test(category)) return 'material-pouch';
    if (/tool/.test(category)) return 'toolkit';
    if (/artifact|magic/.test(category)) return 'magic-crystal';
    return 'backpack';
  }
  function resolveKey(valueOrItem) {
    return typeof valueOrItem === 'object' && valueOrItem ? guessKey(valueOrItem) : (keyFromValue(valueOrItem) || 'backpack');
  }
  function valueFor(valueOrItem) { return 'art:' + resolveKey(valueOrItem); }
  function pathFor(valueOrItem) { return BASE + resolveKey(valueOrItem) + '.png'; }
  function markup(valueOrItem, options) {
    options = options || {};
    var item = typeof valueOrItem === 'object' && valueOrItem ? valueOrItem : null;
    var source = item && String(item.imageThumb || item.image || '');
    if (!source) source = pathFor(valueOrItem);
    var label = item && (item.name || item.title) || byKey[resolveKey(valueOrItem)].label || 'Предмет';
    return '<img src="' + esc(source) + '" alt="' + esc(options.alt === false ? '' : label) + '" loading="' + (options.eager ? 'eager' : 'lazy') + '" decoding="async" style="width:100%;height:100%;object-fit:' + (options.fit || 'contain') + ';display:block;' + esc(options.style || '') + '">';
  }

  global.ZargotaItemIcons = {
    catalog:catalog,
    byKey:byKey,
    resolveKey:resolveKey,
    valueFor:valueFor,
    pathFor:pathFor,
    markup:markup
  };
})(typeof window !== 'undefined' ? window : globalThis);
