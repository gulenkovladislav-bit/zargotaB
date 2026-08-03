(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaItemEconomy = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var POWER_MODEL_VERSION = '0.1';

  var LEVEL_REQUIREMENTS = [
    { level:1, title:'Новички', worldRole:'Люди. Опасные, но люди. Могут умереть от трёх стрел.', compatibility:'1–2+ характеристика' },
    { level:2, title:'Обученные', worldRole:'Подготовленные люди с ремеслом или боевой школой.', compatibility:'2–3+ характеристика' },
    { level:3, title:'Специалисты', worldRole:'Уверенно решают задачи своей профессии.', compatibility:'3–4+ или тематический опыт' },
    { level:4, title:'Профессионалы', worldRole:'Город знает их имя.', compatibility:'4+ основная характеристика' },
    { level:5, title:'Элитные специалисты', worldRole:'Могут перевернуть бой пять на пять.', compatibility:'5+ или 4+/4+ комбинация' },
    { level:6, title:'Элита острова', worldRole:'Если они идут — кто-то умрёт.', compatibility:'5+ и особые условия' },
    { level:7, title:'Фактор региона', worldRole:'Меняют исход событий, но не уничтожают города и не являются архимагами империи.', compatibility:'6+ и ритуалы/сюжет' },
    { level:8, title:'Почти легенды', worldRole:'Их сила заметна далеко за пределами одной сцены.', compatibility:'6+ и тяжёлые последствия' },
    { level:9, title:'Аномальные личности', worldRole:'Исключения, существующие благодаря уникальному пути.', compatibility:'Только через уникальные условия' },
    { level:10, title:'Живые катастрофы', worldRole:'Сюжетные силы, меняющие мир вокруг себя.', compatibility:'Практически недоступно без сюжетного пути' }
  ];

  var EFFECT_TYPES = [
    'damage', 'defense', 'tempo', 'control',
    'support', 'scouting', 'world', 'risk'
  ];
  var STACKING_RULES = ['add', 'highest', 'unique-source', 'refresh', 'replace', 'stacks-capped'];
  var MARKETS = ['local-open', 'city', 'guild', 'licensed', 'secret', 'story'];
  var LEGALITIES = ['open', 'restricted', 'forbidden'];

  // Теоретические центральные ориентиры, а не жёсткие лимиты персонажа.
  // Их назначение — сравнивать предметы между собой до появления достаточной
  // статистики реальных боёв. Расовые крайности и боссы считаются отдельно.
  var LEVEL_BENCHMARKS = [
    { level:1, scope:'human', hp:11, ac:11, attackBonus:1, damagePerRound:3.5, expectedRounds:4 },
    { level:2, scope:'human', hp:15, ac:11, attackBonus:2, damagePerRound:4.5, expectedRounds:4 },
    { level:3, scope:'human', hp:20, ac:12, attackBonus:3, damagePerRound:5.5, expectedRounds:4 },
    { level:4, scope:'professional', hp:25, ac:13, attackBonus:4, damagePerRound:7, expectedRounds:4 },
    { level:5, scope:'elite-specialist', hp:31, ac:14, attackBonus:5, damagePerRound:8.5, expectedRounds:4 },
    { level:6, scope:'island-elite', hp:37, ac:15, attackBonus:6, damagePerRound:10, expectedRounds:4 },
    { level:7, scope:'regional-factor', hp:43, ac:16, attackBonus:7, damagePerRound:12, expectedRounds:4 },
    { level:8, scope:'near-legend', hp:49, ac:17, attackBonus:8, damagePerRound:14, expectedRounds:4 },
    { level:9, scope:'anomaly', hp:55, ac:18, attackBonus:9, damagePerRound:17, expectedRounds:4 },
    { level:10, scope:'living-catastrophe', hp:62, ac:19, attackBonus:10, damagePerRound:20, expectedRounds:4 }
  ];

  // Диапазоны нужны только для предупреждений автора. Предмет может выходить
  // за них, если причина записана в balanceNotes и подтверждена тестом.
  var POWER_TIER_BANDS = {
    0:{ min:0, max:3, priceMin:0.01, priceMax:10 },
    1:{ min:1.5, max:10, priceMin:0.1, priceMax:25 },
    2:{ min:4, max:18, priceMin:3, priceMax:60 },
    3:{ min:8, max:28, priceMin:15, priceMax:140 },
    4:{ min:14, max:40, priceMin:50, priceMax:300 },
    5:{ min:20, max:999, priceMin:120, priceMax:9999 }
  };

  var FOUNDATION_ITEMS = [
    {
      id:'shp_foundation_01', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Лук пограничного егеря', icon:'🏹', image:'images/shop/frontier-ranger-bow.png', imgSize:'square',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:2, tags:['bow','ranged','two-handed'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:3},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:1,zl:8,sr:0,md:0},
      damage:'1d6', damageFormula:'1d6', damageType:'Колющий', range:'Дальняя / 9 клеток',
      effect:'Двуручное · из укрытия дальность +2 клетки',
      effects:[{id:'cover-range',type:'scouting',trigger:'ranged-attack',operation:'add-range-cells',value:2,condition:'attacker-in-cover',frequency:'passive',stacking:'highest'}],
      desc:'Короткий тисовый лук с роговыми оконечниками. Его носят дозорные, которым важнее надёжность, чем парадный вид.'
    },
    {
      id:'shp_foundation_02', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Праща пастуха', icon:'🪨', image:'images/shop/shepherd-sling.png', imgSize:'square',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:1, tags:['sling','ranged','concealable'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:3},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:0,sr:3,md:0},
      damage:'1d4', damageFormula:'1d4', damageType:'Дробящий', range:'Дальняя / 6 клеток',
      effect:'Легко спрятать · подходящие камни служат боезапасом',
      effects:[{id:'improvised-ammo',type:'world',trigger:'prepare-ammunition',operation:'use-found-stones',value:1,condition:'suitable-stones-available',frequency:'scene',stacking:'replace'}],
      desc:'Плетёный ремень с широкой кожаной пятой. Почти ничего не стоит, не звенит и в умелых руках ломает кость.'
    },
    {
      id:'shp_foundation_03', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Посох дорожного наставника', icon:'🦯', image:'images/shop/road-mentor-staff.png', imgSize:'square',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:2, tags:['staff','melee','travel'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:3},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:1,sr:5,md:0},
      damage:'1d6', damageFormula:'1d6', damageType:'Дробящий', range:'Ближняя / 1–2 клетки',
      effect:'Двуручное · +1 против толчка на твёрдой земле',
      effects:[{id:'steady-stance',type:'defense',trigger:'resist-forced-movement',operation:'check-bonus',value:1,condition:'standing-on-solid-ground',frequency:'passive',stacking:'highest'}],
      desc:'Ясеневый дорожный посох с железным подпятником. Помогает держать шаг, искать брод и не подпускать зверя вплотную.'
    },
    {
      id:'shp_foundation_04', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Топор лесной артели', icon:'🪓', image:'images/shop/forestry-guild-axe.png', imgSize:'square',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:1, tags:['axe','melee','tool'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:3},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:4,sr:0,md:0},
      damage:'1d6', damageFormula:'1d6', damageType:'Рубящий', range:'Ближняя / 1 клетка',
      effect:'Рабочий инструмент · +2 против деревянных преград',
      effects:[{id:'woodworker',type:'world',trigger:'damage-object',operation:'check-bonus',value:2,condition:'target-made-of-wood',frequency:'passive',stacking:'highest'}],
      desc:'Короткий рабочий топор с клеймом лесной артели. Им валят сучья, вскрывают заклинившие двери и защищают лагерь.'
    },
    {
      id:'shp_foundation_05', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Рогатина зверобоя', icon:'🔱', image:'images/shop/monster-hunter-boar-spear.png', imgSize:'square',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:2, tags:['spear','melee','brace','two-handed'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:4},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:1,zl:2,sr:0,md:0},
      damage:'1d8', damageFormula:'1d8', damageType:'Колющий', range:'Ближняя / 1–2 клетки',
      effect:'Реакция: +1d4 против прямого натиска от 3 клеток',
      effects:[{id:'brace-charge',type:'damage',trigger:'enemy-enters-reach',operation:'add-damage-dice',dice:'1d4',condition:'enemy-moved-straight-at-least-3-cells',actionCost:'reaction',frequency:'round',stacking:'unique-source'}],
      desc:'Тяжёлая рогатина с поперечными упорами под лезвием. Она создана не для дуэли, а чтобы принять на себя разъярённую тушу.'
    },
    {
      id:'shp_foundation_06', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Комплект грибника', icon:'🍄', image:'images/shop/mushroom-gatherer-outfit.png', imgSize:'square',
      cat:'armor', category:'clothing', slot:'outfit', handsRequired:0, tags:['outfit','gathering','wetlands'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:3},
      access:{markets:['local-open'],legality:'open'}, price:{pl:0,zl:4,sr:0,md:0},
      effect:'+1 к сбору грибов · защищает одежду от сырости',
      effects:[{id:'mushroom-gathering',type:'world',trigger:'gather',operation:'check-bonus',value:1,condition:'gathering-mushrooms',frequency:'passive',stacking:'highest'}],
      desc:'Вощёный зелёный капюшон, штопаные штаны, перчатки и карманы для образцов. Одежда человека, который знает лес снизу.'
    },
    {
      id:'shp_foundation_07', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Комплект городского посыльного', icon:'📨', image:'images/shop/city-messenger-outfit.png', imgSize:'square',
      cat:'armor', category:'clothing', slot:'outfit', handsRequired:0, tags:['outfit','city','courier'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:4},
      access:{markets:['city'],legality:'open'}, price:{pl:0,zl:7,sr:0,md:0},
      effect:'+1 к поиску адресата · служебный вид в городе',
      effects:[{id:'find-addressee',type:'world',trigger:'search',operation:'check-bonus',value:1,condition:'finding-person-or-address-in-city',frequency:'passive',stacking:'highest'}],
      desc:'Сине-серый короткий сюртук, заметный шарф и сумка для бумаг. В таком виде проще пройти к воротам учреждения, но сложнее затеряться.'
    },
    {
      id:'shp_foundation_08', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Комплект докового рабочего', icon:'⚓', image:'images/shop/dockworker-outfit.png', imgSize:'square',
      cat:'armor', category:'clothing', slot:'outfit', handsRequired:0, tags:['outfit','labor','harbor'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:4},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'+1 к подъёму груза · устойчивость на мокрой палубе',
      effects:[
        {id:'labor-lift',type:'world',trigger:'lift-or-carry',operation:'check-bonus',value:1,condition:'manual-cargo-work',frequency:'passive',stacking:'highest'},
        {id:'wet-footing',type:'defense',trigger:'resist-prone',operation:'check-bonus',value:1,condition:'wet-deck-or-dock',frequency:'passive',stacking:'highest'}
      ],
      desc:'Грубая рубаха, промасленный жилет, усиленные штаны и верёвочный пояс. Всё приспособлено к соли, грузу и скользким доскам.'
    },
    {
      id:'shp_foundation_09', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Стёганка ночного дозора', icon:'🧥', image:'images/shop/night-watch-gambeson.png', imgSize:'square',
      cat:'armor', category:'armor', slot:'chest', handsRequired:0, tags:['light-armor','quiet','watch'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:4},
      access:{markets:['city'],legality:'open'}, price:{pl:0,zl:9,sr:0,md:0},
      defense:1, acBonus:1, effect:'+1 AC · без штрафа к скрытности',
      effects:[{id:'padded-armor',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'}],
      desc:'Тёмная стёганая куртка без металлических пластин. Смягчает случайный клинок и не выдаёт патруль звоном.'
    },
    {
      id:'shp_foundation_10', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Сапоги каменной тропы', icon:'🥾', image:'images/shop/stone-trail-boots.png', imgSize:'square',
      cat:'armor', category:'clothing', slot:'feet', handsRequired:0, tags:['boots','travel','mountain'],
      rarity:'common', powerTier:1, recommendedLevel:{min:1,max:5},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:6,sr:0,md:0},
      effect:'+1 против падения на камне и осыпи',
      effects:[{id:'stone-footing',type:'defense',trigger:'resist-prone',operation:'check-bonus',value:1,condition:'stone-scree-or-rubble',frequency:'passive',stacking:'highest'}],
      desc:'Тяжёлые кожаные сапоги с коваными носами и подбитыми гвоздями подошвами. Не быстрые, зато держат склон.'
    },
    {
      id:'shp_foundation_11', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Ученический комплект Лесорубки', icon:'🧗', image:'images/shop/lore-goods-05.png', imgSize:'square',
      cat:'tool', category:'tool', slot:'utility', handsRequired:0, tags:['climbing','rope','travel'],
      rarity:'common', powerTier:0, recommendedLevel:{min:1,max:6},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:9,sr:0,md:0},
      effect:'Заранее закреплённая страховка останавливает падение у последнего крюка, ломая одну деталь комплекта',
      effects:[{id:'lumberjack-student-belay',type:'defense',trigger:'fall-while-anchored',operation:'catch-at-last-anchor',value:1,condition:'anchor-prepared',actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'},{id:'lumberjack-student-breakage',type:'risk',trigger:'belay-catches-fall',operation:'consume-kit-part',value:1,frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Короткая пеньковая верёвка, широкий пояс и два мягких железных крюка. Дёшево спасает жизнь, но редко остаётся целым после рывка.'
    },
    {
      id:'shp_foundation_12', schemaVersion:SCHEMA_VERSION, definitionVersion:1,
      name:'Запечатанный дымовой горшок', icon:'🌫️', image:'images/shop/sealed-smoke-pot.png', imgSize:'square',
      cat:'tool', category:'consumable', slot:'utility', handsRequired:0, tags:['smoke','thrown','single-use'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:6},
      access:{markets:['city','guild'],legality:'restricted'}, price:{pl:0,zl:6,sr:0,md:0},
      range:'Метание / 4 клетки', effect:'Короткое действие · дым 2×2 клетки на 2 раунда · одноразовый',
      charges:1,
      effects:[{id:'smoke-screen',type:'control',trigger:'use',operation:'create-obscured-zone',areaCells:'2x2',durationRounds:2,rangeCells:4,actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Закопчённый глиняный сосуд с плотной пробкой и серой смесью. Даёт несколько секунд, когда глаза врага бесполезны.'
    }
  ];

  // Одноразовые предметы первой волны. Это не просто карточки магазина:
  // каждый эффект уже описан так, чтобы позже один и тот же ItemDefinition
  // использовали витрина, инвентарь героя и онлайн-бой Сессии.
  var CONSUMABLE_ITEMS = [
    {
      id:'shp_consumable_01', name:'Смоляной кровоостанавливающий бинт', icon:'🩹', image:'images/shop/resin-bandage.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:3,sr:0,md:0},
      effect:'Короткое действие · снимает Кровотечение',
      effects:[{id:'stop-bleeding',type:'support',trigger:'use-on-adjacent-creature',operation:'remove-status',status:'bleeding',actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Плотный льняной свёрток, пропитанный сосновой смолой. Закрывает рану быстро, но прилипает намертво.'
    },
    {
      id:'shp_consumable_02', name:'Мазь ледяного мха', icon:'❄️', image:'images/shop/cold-moss-salve.png',
      cat:'potion', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:4,sr:0,md:0},
      effect:'Короткое действие · следующий огненный урон −1d6 в этой сцене',
      effects:[{id:'cool-burn',type:'defense',trigger:'receive-fire-damage',operation:'reduce-damage-dice',dice:'1d6',damageType:'fire',duration:'scene-or-trigger',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Холодная зелёно-серая паста. Ею покрывают открытые участки кожи перед кузней, пожаром или охотой на огненного зверя.'
    },
    {
      id:'shp_consumable_03', name:'Настой гром-корня', icon:'⚡', image:'images/shop/thunder-root-draught.png',
      cat:'potion', rarity:'uncommon', powerTier:1, levels:[2,6], markets:['city','guild'], legality:'open', price:{pl:1,zl:0,sr:0,md:0},
      effect:'Короткое действие · скорость +2 на 2 раунда, затем −1 на 1 раунд',
      effects:[
        {id:'thunder-step',type:'tempo',trigger:'use',operation:'add-speed',value:2,durationRounds:2,actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'thunder-fatigue',type:'risk',trigger:'effect-ends',operation:'add-speed',value:-1,durationRounds:1,frequency:'charge',charges:1,stacking:'replace'}
      ],
      desc:'Горький коричневый настой резко разгоняет кровь. Ноги становятся быстрыми, но после рывка тяжелеют.'
    },
    {
      id:'shp_consumable_04', name:'Чай тихого разума', icon:'🍵', image:'images/shop/quiet-mind-tea.png',
      cat:'food', rarity:'common', powerTier:1, levels:[1,6], markets:['local-open','city'], legality:'open', price:{pl:0,zl:5,sr:0,md:0},
      effect:'10 минут приготовления · +1 против Страха и Очарования на сцену',
      effects:[{id:'quiet-mind',type:'defense',trigger:'prepare-and-drink',operation:'save-bonus',value:1,statuses:['fear','charm'],duration:'scene',actionCost:'long',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Смесь сухих трав и горькой коры. Не делает храбрее, но помогает отделить чужую волю от собственной.'
    },
    {
      id:'shp_consumable_05', name:'Жевательная кора марша', icon:'🌿', image:'images/shop/march-bark.png',
      cat:'food', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:2,sr:0,md:0},
      effect:'Игнорирует первое утомление от форсированного марша',
      effects:[{id:'march-endurance',type:'support',trigger:'gain-forced-march-fatigue',operation:'prevent-fatigue',value:1,frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Жёсткие полоски бодрящей коры. Жевать неприятно, зато ноги дольше помнят ритм дороги.'
    },
    {
      id:'shp_consumable_06', name:'Капсула светлячного масла', icon:'🟡', image:'images/shop/firefly-oil-capsule.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:3,sr:0,md:0},
      range:'Метание / 5 клеток', effect:'Короткое действие · светит в зоне 2 клетки 3 раунда',
      effects:[{id:'firefly-mark',type:'scouting',trigger:'throw',operation:'apply-light',areaRadiusCells:2,durationRounds:3,rangeCells:5,actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Хрупкий шарик с густым янтарным маслом. Разбившись, оставляет на полу или цели яркое липкое пятно.'
    },
    {
      id:'shp_consumable_07', name:'Мел возвращения', icon:'🪨', image:'images/shop/return-chalk.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,7], markets:['local-open','city'], legality:'open', price:{pl:0,zl:1,sr:0,md:0},
      effect:'Помеченный путь даёт +2 при возвращении по своему маршруту',
      effects:[{id:'marked-return',type:'world',trigger:'retrace-marked-route',operation:'navigation-bonus',value:2,condition:'marks-remain-visible',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Несколько жирных брусков в кожаном чехле. Метки хорошо видны на камне и переживают лёгкий дождь.'
    },
    {
      id:'shp_consumable_08', name:'Смоляная заплатка бронника', icon:'🛡️', image:'images/shop/armorer-resin-patch.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,5], markets:['city','guild'], legality:'open', price:{pl:0,zl:6,sr:0,md:0},
      effect:'1 минута · восстанавливает 1 потерянную AC повреждённой брони на сцену',
      effects:[{id:'field-armor-repair',type:'defense',trigger:'apply-to-damaged-armor',operation:'restore-ac',value:1,condition:'armor-lost-ac-from-damage',duration:'scene',actionCost:'long',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Слой ткани, сетки и быстросхватывающейся смолы. Не заменяет кузнеца, но удерживает треснувшую пластину до конца дела.'
    },
    {
      id:'shp_consumable_09', name:'Масло быстрой тетивы', icon:'🏹', image:'images/shop/bowstring-oil.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,6], markets:['local-open','city','guild'], legality:'open', price:{pl:0,zl:4,sr:0,md:0},
      effect:'1 минута · лук или арбалет игнорирует штраф сырости на сцену',
      effects:[{id:'weatherproof-string',type:'damage',trigger:'apply-to-ranged-weapon',operation:'ignore-penalty',penalty:'wet-or-rain',duration:'scene',actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Маленькая медная фляга с густым восковым маслом и кистью. Сохраняет натяжение там, где обычная тетива набухает.'
    },
    {
      id:'shp_consumable_10', name:'Калтропы дорожной стражи', icon:'🔻', image:'images/shop/road-guard-caltrops.png',
      cat:'tool', rarity:'uncommon', powerTier:2, levels:[2,6], markets:['city','licensed'], legality:'restricted', price:{pl:0,zl:5,sr:0,md:0},
      effect:'Короткое действие · опасная зона 2×2: 1 урон и скорость −2',
      effects:[{id:'caltrop-field',type:'control',trigger:'scatter',operation:'create-hazard-zone',areaCells:'2x2',damage:1,speedPenalty:2,duration:'scene-or-cleared',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Горсть четырёхгранных железных шипов. Как ни упадут, одно острие всегда смотрит вверх.'
    },
    {
      id:'shp_consumable_11', name:'Глиняная хлопушка', icon:'🏺', image:'images/shop/clay-noise-popper.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:1,sr:5,md:0},
      range:'Метание / 6 клеток', effect:'Короткое действие · создаёт резкий звук в выбранной точке',
      effects:[{id:'false-noise',type:'scouting',trigger:'throw',operation:'create-sound',rangeCells:6,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Обожжённый сосуд с натянутой мембраной. После рывка шнура хлопает так, будто рядом упала тяжёлая доска.'
    },
    {
      id:'shp_consumable_12', name:'Пыль следа', icon:'👣', image:'images/shop/track-dust.png',
      cat:'tool', rarity:'uncommon', powerTier:2, levels:[2,6], markets:['guild','licensed'], legality:'open', price:{pl:0,zl:8,sr:0,md:0},
      effect:'Короткое действие · проявляет свежие и невидимые следы в зоне 2×2 на 2 раунда',
      effects:[{id:'reveal-trail',type:'scouting',trigger:'scatter',operation:'reveal-tracks',areaCells:'2x2',durationRounds:2,actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Минеральный порошок в роговой перечнице. Прилипает к продавленной пыли, влажным отпечаткам и недавним магическим следам.'
    },
    {
      id:'shp_consumable_13', name:'Едкая соль кузнеца', icon:'🧂', image:'images/shop/smith-caustic-salt.png',
      cat:'contraband', rarity:'uncommon', powerTier:2, levels:[2,6], markets:['licensed','secret'], legality:'restricted', price:{pl:0,zl:9,sr:0,md:0},
      range:'Метание / 3 клетки', effect:'Короткое действие · AC бронированной цели −1 до конца её следующего хода',
      effects:[{id:'etch-armor',type:'control',trigger:'throw-at-armored-target',operation:'reduce-ac',value:1,durationRounds:1,rangeCells:3,actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Ржаво-красные кристаллы в усиленной ампуле. Реагируют с металлом быстрее, чем с кожей, и оставляют хрупкие борозды.'
    },
    {
      id:'shp_consumable_14', name:'Клеевая паутина', icon:'🕸️', image:'images/shop/glue-web-bundle.png',
      cat:'tool', rarity:'uncommon', powerTier:2, levels:[2,6], markets:['guild','licensed'], legality:'restricted', price:{pl:1,zl:2,sr:0,md:0},
      range:'Метание / 3 клетки', effect:'Длинное действие · Опутывает среднюю цель; Сила 12 для освобождения',
      effects:[{id:'glue-restraint',type:'control',trigger:'throw-at-creature',operation:'apply-status',status:'restrained',targetSizeMax:'medium',escapeCheck:{stat:'strength',difficulty:12},rangeCells:3,actionCost:'long',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Сложенная сеть, пропитанная тягучей смолой. Раскрывается плохо, зато пойманному приходится рвать каждую петлю.'
    },
    {
      id:'shp_consumable_15', name:'Согревающий уголь Верхземья', icon:'🔥', image:'images/shop/upperland-warming-coal.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,7], markets:['local-open','city'], legality:'open', price:{pl:0,zl:2,sr:0,md:0},
      effect:'1 минута · безопасное тепло лагеря на 8 часов, +1 против холода',
      effects:[{id:'safe-camp-heat',type:'world',trigger:'ignite-in-cage',operation:'safe-camp',value:1,durationHours:8,actionCost:'long',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Плотный уголь в латунной клетке. Тлеет всю ночь без открытого пламени и редко выдаёт лагерь издалека.'
    },
    {
      id:'shp_consumable_16', name:'Пакет горьких трав', icon:'🌱', image:'images/shop/bitter-beast-herbs.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,6], markets:['local-open','city'], legality:'open', price:{pl:0,zl:3,sr:0,md:0},
      effect:'1 минута · обычные звери избегают лагеря радиусом 2 клетки в течение часа',
      effects:[{id:'bitter-beast-repellent',type:'world',trigger:'hang-around-camp',operation:'repel-beasts',areaRadiusCells:2,durationHours:1,condition:'ordinary-beasts-not-provoked',actionCost:'long',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Сухие листья и резкие корни в грубом мешочке. Для человека пахнет аптекой, для зверя — причиной выбрать другую тропу.'
    },
    {
      id:'shp_consumable_17', name:'Воск тишины', icon:'🔇', image:'images/shop/silence-wax.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,6], markets:['city','guild'], legality:'open', price:{pl:0,zl:2,sr:5,md:0},
      effect:'1 минута · запечатывает щель и приглушает звук через неё на сцену',
      effects:[{id:'muffle-seal',type:'scouting',trigger:'seal-door-window-or-container',operation:'muffle-sound',duration:'scene',actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Тяжёлый сине-чёрный воск. Вдавленный в щель, он гасит дрожание досок, крышки или оконной рамы.'
    },
    {
      id:'shp_consumable_18', name:'Рыбацкая смазка', icon:'🫧', image:'images/shop/fisher-slip-grease.png',
      cat:'tool', rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:1,sr:5,md:0},
      effect:'Короткое действие · +2 к следующей попытке вырваться из захвата или пут',
      effects:[{id:'slip-free',type:'tempo',trigger:'attempt-escape',operation:'escape-bonus',value:2,actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Серая водостойкая смазка в плоской жестянке. Пахнет плохо, зато верёвка и пальцы противника перестают держать уверенно.'
    },
    {
      id:'shp_consumable_19', name:'Печать запасного дыхания', icon:'💨', image:'images/shop/reserve-breath-seal.png',
      cat:'magic', rarity:'uncommon', powerTier:2, levels:[3,7], markets:['guild','licensed'], legality:'restricted', price:{pl:1,zl:5,sr:0,md:0},
      effect:'Короткое действие · позволяет дышать под водой или в дурном воздухе 10 минут',
      effects:[{id:'reserve-breath',type:'support',trigger:'break-seal',operation:'grant-breath',environments:['underwater','bad-air'],durationMinutes:10,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Сложенная печать хранит один долгий магический выдох. После разрыва прохладный воздух держится у лица владельца.'
    },
    {
      id:'shp_consumable_20', name:'Рунный шов', icon:'🪡', image:'images/shop/runic-mending-stitch.png',
      cat:'magic', rarity:'rare', powerTier:2, levels:[3,7], markets:['guild','licensed','secret'], legality:'restricted', price:{pl:1,zl:8,sr:0,md:0},
      effect:'Реакция · один экипированный предмет не ломается и остаётся на 1 прочности',
      effects:[{id:'refuse-breakage',type:'defense',trigger:'equipped-item-would-break',operation:'prevent-item-break',remainingDurability:1,actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Медно-золотая нить и костяная игла. В миг поломки шов сам стягивает вещь, вспыхивает и превращается в пепел.'
    }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.category = 'consumable';
    item.slot = 'utility';
    item.handsRequired = 0;
    item.charges = 1;
    item.tags = ['consumable','single-use'].concat(item.tags || []);
    item.recommendedLevel = { min:item.levels[0], max:item.levels[1] };
    item.access = { markets:item.markets.slice(), legality:item.legality };
    delete item.levels;
    delete item.markets;
    delete item.legality;
    return item;
  });

  var WEAPON_ITEMS = [
    {
      id:'shp_weapon_01', name:'Боевой серп Полевого братства', icon:'🌙', image:'images/shop/field-brotherhood-war-sickle.png',
      rarity:'common', powerTier:1, levels:[1,4], markets:['local-open','city'], legality:'open', price:{pl:0,zl:4,sr:0,md:0}, hands:1,
      damage:'1d4', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['sickle','melee','hook'],
      effect:'+1 к попытке обезоружить после попадания',
      effects:[{id:'sickle-hook',type:'control',trigger:'attempt-disarm-after-hit',operation:'check-bonus',value:1,condition:'target-holds-an-item',frequency:'round',stacking:'highest'}],
      desc:'Короткий загнутый клинок с усиленной гардой. Цепляет ремень, кисть или древко лучше, чем рубит доспех.'
    },
    {
      id:'shp_weapon_02', name:'Кузнечный молот дозорного', icon:'🔨', image:'images/shop/watch-smith-hammer.png',
      rarity:'common', powerTier:1, levels:[1,4], markets:['local-open','city'], legality:'open', price:{pl:0,zl:5,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Дробящий', range:'Ближняя / 1 клетка', tags:['hammer','melee','tool'],
      effect:'+2 против замков и металлических преград',
      effects:[{id:'break-metalwork',type:'world',trigger:'strike-object',operation:'check-bonus',value:2,condition:'lock-or-metal-object',frequency:'passive',stacking:'highest'}],
      desc:'Укороченный кузнечный молот с боевым балансом. Им правят заклёпку, выбивают замок и останавливают драку.'
    },
    {
      id:'shp_weapon_03', name:'Клевец шахтной стражи', icon:'⛏️', image:'images/shop/mine-guard-war-pick.png',
      rarity:'common', powerTier:1, levels:[1,5], markets:['city','guild'], legality:'open', price:{pl:0,zl:8,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Колющий', range:'Ближняя / 1 клетка', tags:['war-pick','melee','armor-piercing'],
      effect:'+1 к атаке против тяжёлой брони',
      effects:[{id:'pick-armor-joint',type:'damage',trigger:'attack',operation:'add-attack-bonus',value:1,condition:'target-in-heavy-armor',frequency:'round',stacking:'highest'}],
      desc:'Узкий клюв входит в стык пластин и каменную трещину. Носить его в тесном штреке удобнее длинного оружия.'
    },
    {
      id:'shp_weapon_04', name:'Моргенштерн короткой цепи', icon:'⛓️', image:'images/shop/short-chain-morningstar.png',
      rarity:'uncommon', powerTier:2, levels:[2,5], markets:['city','licensed'], legality:'restricted', price:{pl:1,zl:6,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Дробящий', range:'Ближняя / 1 клетка', tags:['morningstar','chain','melee'],
      effect:'Игнорирует 1 AC, полученную от щита',
      effects:[{id:'chain-around-shield',type:'damage',trigger:'attack',operation:'ignore-shield-ac',value:1,condition:'target-uses-shield',frequency:'passive',stacking:'highest'}],
      desc:'Короткая цепь не даёт шару разогнаться бесконтрольно, но позволяет обойти край щита.'
    },
    {
      id:'shp_weapon_05', name:'Парные дубинки портовой стражи', icon:'🥢', image:'images/shop/harbor-watch-batons.png',
      rarity:'uncommon', powerTier:2, levels:[2,5], markets:['city','licensed'], legality:'open', price:{pl:1,zl:2,sr:0,md:0}, hands:2,
      damage:'1d4', damageType:'Дробящий', range:'Ближняя / 1 клетка', tags:['batons','paired','melee'],
      effect:'Короткое действие: вторая дубинка наносит 1d4 после попадания первой',
      effects:[{id:'paired-follow-up',type:'damage',trigger:'main-baton-hit',operation:'add-damage-dice',dice:'1d4',condition:'both-hands-hold-the-set',actionCost:'short',frequency:'combat',stacking:'unique-source'}],
      desc:'Пара тяжёлых боковых дубинок. Ими перехватывают удар, прижимают руку и отвечают вторым коротким движением.'
    },
    {
      id:'shp_weapon_06', name:'Длинный меч береговой сотни', icon:'🗡️', image:'images/shop/coastal-hundred-longsword.png',
      rarity:'common', powerTier:1, levels:[1,5], markets:['city','licensed'], legality:'open', price:{pl:1,zl:2,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['longsword','melee','versatile'],
      effect:'Универсальное: 1d10 при хвате двумя руками',
      effects:[{id:'versatile-grip',type:'damage',trigger:'attack',operation:'replace-damage-dice',fromDice:'1d8',toDice:'1d10',condition:'used-with-two-hands',frequency:'passive',stacking:'replace'}],
      desc:'Стандартный прямой меч береговой пехоты. Не изящен, зато одинаково надёжен со щитом и в двуручном хвате.'
    },
    {
      id:'shp_weapon_07', name:'Фальшион караванщика', icon:'🔪', image:'images/shop/caravan-guard-falchion.png',
      rarity:'common', powerTier:1, levels:[1,5], markets:['city','guild'], legality:'open', price:{pl:1,zl:0,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['falchion','melee','heavy-blade'],
      effect:'+1 урон против цели без брони',
      effects:[{id:'broad-edge',type:'damage',trigger:'damage',operation:'add-flat-damage',value:1,condition:'target-has-no-armor',frequency:'round',stacking:'highest'}],
      desc:'Широкий клинок рубит верёвку, куст и незащищённую цель одним тяжёлым движением.'
    },
    {
      id:'shp_weapon_08', name:'Бердыш воротной стражи', icon:'🪓', image:'images/shop/gate-guard-berdiche.png',
      rarity:'uncommon', powerTier:2, levels:[3,6], markets:['licensed'], legality:'restricted', price:{pl:2,zl:4,sr:0,md:0}, hands:2,
      damage:'1d10', damageType:'Рубящий', range:'Ближняя / 1–2 клетки', tags:['berdiche','polearm','melee','two-handed'],
      requirements:[{stat:'strength',min:3}], effect:'Реакция после добивания: 1d4 соседней цели',
      effects:[{id:'berdiche-cleave',type:'damage',trigger:'enemy-drops-from-this-hit',operation:'add-damage-dice',dice:'1d4',condition:'second-enemy-adjacent',actionCost:'reaction',frequency:'round',stacking:'unique-source'}],
      desc:'Длинное древко и тяжёлое полотно держат проход. Размах требует места, но строй противника чувствует каждый удар.'
    },
    {
      id:'shp_weapon_09', name:'Боевой цеп камышовых селений', icon:'🌾', image:'images/shop/reed-village-war-flail.png',
      rarity:'uncommon', powerTier:2, levels:[2,6], markets:['local-open','guild'], legality:'open', price:{pl:1,zl:1,sr:0,md:0}, hands:2,
      damage:'1d6', damageType:'Дробящий', range:'Ближняя / 1–2 клетки', tags:['war-flail','chain','melee','two-handed'],
      effect:'Игнорирует до 2 AC от щита, но требует две руки',
      effects:[{id:'flail-over-guard',type:'damage',trigger:'attack',operation:'ignore-shield-ac',value:2,condition:'target-uses-shield',frequency:'passive',stacking:'highest'}],
      desc:'Окованные била выросли из сельского инструмента. Щит ловит первое звено, а второе продолжает движение.'
    },
    {
      id:'shp_weapon_10', name:'Эсток гильдейского дуэлянта', icon:'🤺', image:'images/shop/guild-duelist-estoc.png',
      rarity:'rare', powerTier:2, levels:[3,6], markets:['guild','licensed'], legality:'restricted', price:{pl:3,zl:2,sr:0,md:0}, hands:2,
      damage:'1d8', damageType:'Колющий', range:'Ближняя / 1–2 клетки', tags:['estoc','thrusting','melee','two-handed'],
      requirements:[{stat:'dexterity',min:3}], effect:'+1 к атаке против средней и тяжёлой брони',
      effects:[{id:'estoc-thrust',type:'damage',trigger:'attack',operation:'add-attack-bonus',value:1,condition:'target-in-medium-or-heavy-armor',frequency:'passive',stacking:'highest'}],
      desc:'Жёсткий гранёный клинок почти не рубит. Его смысл — найти стык доспеха раньше, чем противник закончит замах.'
    },
    {
      id:'shp_weapon_11', name:'Метательный молот Узкого берега', icon:'🔨', image:'images/shop/narrow-shore-throwing-hammer.png',
      rarity:'common', powerTier:1, levels:[1,5], markets:['local-open','city'], legality:'open', price:{pl:0,zl:6,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Дробящий', range:'Дальняя / 5 клеток', tags:['throwing-hammer','ranged','thrown'],
      effect:'+2 к попытке сбить с ног после попадания',
      effects:[{id:'hammer-trip',type:'control',trigger:'attempt-prone-after-hit',operation:'check-bonus',value:2,condition:'target-size-medium-or-smaller',frequency:'round',stacking:'highest'}],
      desc:'Короткий молот с петлёй на рукояти. Баланс позволяет метнуть его головкой вперёд и сразу продолжить движение.'
    },
    {
      id:'shp_weapon_12', name:'Набор портовых метательных ножей', icon:'🔪', image:'images/shop/port-throwing-knives.png',
      rarity:'common', powerTier:1, levels:[1,5], markets:['city','secret'], legality:'restricted', price:{pl:0,zl:5,sr:0,md:0}, hands:1,
      damage:'1d4', damageType:'Колющий', range:'Дальняя / 5 клеток', tags:['throwing-knives','ranged','concealable'], ammo:3,
      effect:'Три ножа · один нож можно достать бесплатно раз в раунд',
      effects:[{id:'quick-draw-knife',type:'tempo',trigger:'draw-weapon',operation:'free-draw',value:1,condition:'a-knife-remains-in-set',frequency:'round',stacking:'unique-source'}],
      desc:'Три одинаково сбалансированных клинка в плоском чехле. Их легче спрятать, чем потом объяснить страже.'
    },
    {
      id:'shp_weapon_13', name:'Дротики болотного охотника', icon:'🎯', image:'images/shop/marsh-hunter-darts.png',
      rarity:'common', powerTier:1, levels:[1,6], markets:['local-open','guild'], legality:'open', price:{pl:0,zl:3,sr:0,md:0}, hands:1,
      damage:'1d4', damageType:'Колющий', range:'Дальняя / 8 клеток', tags:['darts','ranged','poisonable'], ammo:5,
      effect:'Пять дротиков · без штрафа доставляет нанесённый на наконечник состав',
      effects:[{id:'coated-dart',type:'support',trigger:'hit',operation:'deliver-applied-poison',condition:'tip-was-coated-before-attack',frequency:'round',stacking:'replace'}],
      desc:'Короткие тростниковые древки летят негромко. Малый урон компенсируется тем, что остаётся на наконечнике.'
    },
    {
      id:'shp_weapon_14', name:'Составной лук степного гостя', icon:'🏹', image:'images/shop/steppe-guest-composite-bow.png',
      rarity:'uncommon', powerTier:2, levels:[2,6], markets:['guild','licensed'], legality:'open', price:{pl:2,zl:8,sr:0,md:0}, hands:2,
      damage:'1d8', damageType:'Колющий', range:'Дальняя / 12 клеток', tags:['composite-bow','bow','ranged','two-handed'],
      requirements:[{stat:'strength',min:3}], effect:'+1 урон, если стрелок не двигался в этом ходу',
      effects:[{id:'set-feet-shot',type:'damage',trigger:'damage',operation:'add-flat-damage',value:1,condition:'attacker-did-not-move-this-turn',frequency:'round',stacking:'highest'}],
      desc:'Рог, дерево и сухожилие дают короткому луку силу длинного. Полный натяг требует привычки и крепкой спины.'
    },
    {
      id:'shp_weapon_15', name:'Ручной арбалет контрабандиста', icon:'🏹', image:'images/shop/smuggler-hand-crossbow.png',
      rarity:'rare', powerTier:2, levels:[3,7], markets:['secret'], legality:'forbidden', price:{pl:2,zl:5,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Колющий', range:'Дальняя / 6 клеток', tags:['hand-crossbow','ranged','concealable'],
      effect:'Одноручное · короткое действие на перезарядку · +2 чтобы скрыть',
      effects:[
        {id:'compact-crossbow',type:'scouting',trigger:'conceal-weapon',operation:'check-bonus',value:2,frequency:'passive',stacking:'highest'},
        {id:'hand-crossbow-reload',type:'risk',trigger:'reload',operation:'spend-action',actionCost:'short',frequency:'round',stacking:'replace'}
      ],
      desc:'Укороченный арбалет прячется под плащом и стреляет одной рукой. После выстрела его приходится взводить вручную.'
    },
    {
      id:'shp_weapon_16', name:'Духовая трубка травника', icon:'🪈', image:'images/shop/herbalist-blowgun.png',
      rarity:'common', powerTier:1, levels:[1,6], markets:['local-open','guild'], legality:'open', price:{pl:0,zl:4,sr:0,md:0}, hands:2,
      damage:'1d2', damageType:'Колющий', range:'Дальняя / 5 клеток', tags:['blowgun','ranged','silent','poisonable'], ammo:3,
      effect:'Тихое · доставляет нанесённый состав без потери дозы',
      effects:[{id:'blowgun-dose',type:'support',trigger:'hit',operation:'deliver-applied-poison',condition:'dart-was-coated-before-attack',frequency:'round',stacking:'replace'}],
      desc:'Длинная тёмная трубка почти не ранит сама. Настоящая угроза зависит от знания трав и того, чем смочен дротик.'
    },
    {
      id:'shp_weapon_17', name:'Гарпун ловца глубин', icon:'🪝', image:'images/shop/deepwater-hunter-harpoon.png',
      rarity:'uncommon', powerTier:2, levels:[2,6], markets:['local-open','guild'], legality:'open', price:{pl:1,zl:4,sr:0,md:0}, hands:2,
      damage:'1d8', damageType:'Колющий', range:'Метание / 5 клеток', tags:['harpoon','ranged','tethered','two-handed'],
      effect:'Короткое действие после попадания: состязание Силы, подтянуть на 1 клетку',
      effects:[{id:'harpoon-tether',type:'control',trigger:'short-action-after-hit',operation:'pull-cells',value:1,condition:'target-no-larger-than-one-size-above',actionCost:'short',frequency:'round',stacking:'highest'}],
      desc:'Зазубренный наконечник соединён с крепкой верёвкой. Противник решает, что хуже: натяжение или попытка вырвать металл.'
    },
    {
      id:'shp_weapon_18', name:'Трезубец приливной стражи', icon:'🔱', image:'images/shop/tide-guard-trident.png',
      rarity:'uncommon', powerTier:1, levels:[1,6], markets:['city','guild'], legality:'open', price:{pl:0,zl:9,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Колющий', range:'Ближняя / 1–2 клетки', tags:['trident','melee','versatile'],
      effect:'+1 к атаке против плывущей или стоящей в воде цели · 1d8 двумя руками',
      effects:[
        {id:'tide-fork',type:'damage',trigger:'attack',operation:'add-attack-bonus',value:1,condition:'target-swimming-or-waist-deep-in-water',frequency:'round',stacking:'highest'},
        {id:'trident-versatile',type:'damage',trigger:'attack',operation:'replace-damage-dice',fromDice:'1d6',toDice:'1d8',condition:'used-with-two-hands',frequency:'passive',stacking:'replace'}
      ],
      desc:'Боковые зубцы удерживают сеть, весло и противника. Стража причалов ценит его больше обычного копья.'
    },
    {
      id:'shp_weapon_19', name:'Алебарда казарменного образца', icon:'⚔️', image:'images/shop/barracks-pattern-halberd.png',
      rarity:'uncommon', powerTier:2, levels:[3,7], markets:['licensed'], legality:'restricted', price:{pl:3,zl:0,sr:0,md:0}, hands:2,
      damage:'1d10', damageType:'Рубящий', range:'Ближняя / 1–2 клетки', tags:['halberd','polearm','melee','two-handed'],
      requirements:[{stat:'strength',min:3}], effect:'Реакция: +1d4 против входящего в радиус врага',
      effects:[{id:'halberd-brace',type:'damage',trigger:'enemy-enters-reach',operation:'add-damage-dice',dice:'1d4',condition:'enemy-moved-at-least-2-cells',actionCost:'reaction',frequency:'round',stacking:'unique-source'}],
      desc:'Крюк, топор и остриё сведены в один строевой инструмент. Одиночке неудобна, шеренге — незаменима.'
    },
    {
      id:'shp_weapon_20', name:'Ритуальный клинок белого железа', icon:'✨', image:'images/shop/white-iron-ritual-blade.png',
      rarity:'rare', powerTier:2, levels:[3,7], markets:['guild','licensed','story'], legality:'restricted', price:{pl:4,zl:5,sr:0,md:0}, hands:1,
      damage:'1d6', damageType:'Колющий', range:'Ближняя / 1 клетка', tags:['ritual-blade','melee','spirit-hunting'],
      requirements:[{stat:'perception',min:3}], effect:'+1d4 против духов и нежити раз в раунд',
      effects:[{id:'white-iron-spirit-edge',type:'damage',trigger:'hit',operation:'add-damage-dice',dice:'1d4',condition:'target-is-spirit-or-undead',frequency:'round',stacking:'unique-source'}],
      desc:'Матовый светлый металл не серебро и не сталь. Он почти не блестит, но оставляет след на существах без живой плоти.'
    },
    {
      id:'shp_weapon_21', name:'Большой лук Верхоставского вала', icon:'🏹', image:'images/shop/weapon-greatbow-01.png',
      rarity:'uncommon', powerTier:2, levels:[3,7], markets:['guild','licensed'], legality:'open', price:{pl:3,zl:8,sr:0,md:0}, hands:2,
      damage:'1d10', damageType:'Колющий', range:'Дальняя / 16 клеток', tags:['greatbow','bow','ranged','two-handed','heavy'],
      requirements:[{stat:'strength',min:4}], effect:'Не двигаясь до выстрела, игнорирует низкое укрытие · после выстрела стрелок не может перемещаться до следующего хода · помеха в тесном помещении',
      effects:[
        {id:'upper-wall-greatbow-over-cover',type:'damage',trigger:'ranged-attack',operation:'ignore-low-cover',balanceOperation:'artifact-effect',value:1,condition:'attacker-did-not-move-this-turn',frequency:'round',stacking:'highest'},
        {id:'upper-wall-greatbow-rooted-shot',type:'risk',trigger:'after-ranged-attack',operation:'set-speed-to-zero',value:1,duration:'until-next-turn',frequency:'turn',stacking:'replace'},
        {id:'upper-wall-greatbow-cramped',type:'risk',trigger:'ranged-attack-in-cramped-space',operation:'impose-disadvantage',value:1,condition:'low-ceiling-or-tight-room',frequency:'turn',stacking:'highest'}
      ],
      desc:'Ростовой тисовый лук с толстыми роговыми концами. Его держат на башнях Верхостава: натяг пробивает дальний ветер, но забирает всё движение тела.'
    },
    {
      id:'shp_weapon_22', name:'Воротный арбалет Казад-Дрома', icon:'🏹', image:'images/shop/weapon-heavy-crossbow-01.png',
      rarity:'rare', powerTier:3, levels:[3,8], markets:['guild','licensed'], legality:'restricted', price:{pl:5,zl:8,sr:0,md:0}, hands:2,
      damage:'1d12', damageType:'Колющий', range:'Дальняя / 14 клеток', tags:['heavy-crossbow','crossbow','ranged','two-handed','heavy'],
      requirements:[{stat:'strength',min:3}], effect:'Против жёсткой брони или поднятого щита бросает урон дважды и выбирает лучший результат · длинная перезарядка',
      effects:[
        {id:'kazad-gate-crossbow-penetration',type:'damage',trigger:'ranged-hit',operation:'damage-roll-advantage',balanceOperation:'artifact-effect',value:1,condition:'target-wears-rigid-armor-or-raised-shield',frequency:'round',stacking:'highest'},
        {id:'kazad-gate-crossbow-windlass',type:'risk',trigger:'after-ranged-attack',operation:'require-reload-action',value:2,actionCost:'long',condition:'windlass-and-bolt-available',frequency:'turn',stacking:'refresh'}
      ],
      desc:'Толстое стальное плечо взводится съёмным воротом. Арбалет создавали для обороны шахтных ворот, где медленная перезарядка важит меньше одного решающего болта.'
    },
    {
      id:'shp_weapon_23', name:'Дуэльный меч «Девятый ответ»', icon:'🗡️', image:'images/shop/weapon-ninth-answer.png', imageThumb:'images/shop/thumbs/weapon-ninth-answer.jpg',
      rarity:'rare', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'open', price:{pl:18,zl:0,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['longsword','dueling','melee','riposte'], baseRegion:'root-valley', marketIds:['dorogograd-golden-measure','glupishche-last-rest'],
      requirements:[{stat:'dexterity',min:4}], effect:'Раз за сцену, когда видимый сосед промахивается по владельцу в ближнем бою, можно реакцией немедленно атаковать его этим мечом',
      effects:[{id:'ninth-answer-riposte',type:'damage',trigger:'visible-adjacent-melee-attack-misses-wielder',operation:'make-reaction-weapon-attack',balanceOperation:'artifact-effect',value:2,condition:'attacker-within-reach-and-wielder-can-see-it',actionCost:'reaction',frequency:'scene',stacking:'replace'}],
      desc:'Узкий корневой клинок с девятью загнутыми ветвями гарды. Его школа учит не опережать удар, а отвечать в оставленную промахом брешь.'
    },
    {
      id:'shp_weapon_24', name:'Полуторный меч «Горное эхо»', icon:'⚔️', image:'images/shop/weapon-mountain-echo.png', imageThumb:'images/shop/thumbs/weapon-mountain-echo.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'restricted', price:{pl:24,zl:0,sr:0,md:0}, hands:2,
      damage:'1d10', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['bastard-sword','melee','two-handed','shield-breaker'], baseRegion:'upperland', marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],
      requirements:[{stat:'strength',min:4}], effect:'Раз за сцену после попадания по цели с поднятым щитом клинок заклинивает его защиту до начала следующего хода владельца; до этого владелец тоже не может атаковать',
      effects:[
        {id:'mountain-echo-shield-wedge',type:'control',trigger:'hit-raised-shield',operation:'suppress-shield-defense',balanceOperation:'artifact-effect',value:2,condition:'target-uses-raised-shield',duration:'until-wielders-next-turn',frequency:'scene',stacking:'replace'},
        {id:'mountain-echo-wedged-blade',type:'risk',trigger:'shield-defense-suppressed',operation:'disable-weapon-attacks',value:1,condition:'this-sword-remains-wedged',duration:'until-wielders-next-turn',frequency:'scene',stacking:'replace'}
      ],
      desc:'Слоистая сталь Казад-Дрома и клиновидная гарда созданы для одного тяжёлого приёма: поймать край щита и на миг раскрыть строй.'
    },
    {
      id:'shp_weapon_25', name:'Сабля «Безлунный прилив»', icon:'🌊', image:'images/shop/weapon-moonless-tide.png', imageThumb:'images/shop/thumbs/weapon-moonless-tide.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['licensed','secret'], legality:'restricted', price:{pl:32,zl:0,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['saber','melee','tracking','levoshlak'], baseRegion:'levoshlak', marketIds:['levoshlak-tower-vault','strannograd-bog-guild'],
      requirements:[{stat:'perception',min:4}], effect:'Раз за сцену после попадания цель 2 раунда оставляет тёмный влажный след; невидимость сохраняется, но после движения или контакта становится видна занятая ею клетка',
      effects:[{id:'moonless-tide-trace',type:'scouting',trigger:'hit',operation:'mark-moving-target-cell',balanceOperation:'artifact-effect',value:2,condition:'target-can-bleed-or-leave-moisture;does-not-remove-invisible-status',durationRounds:2,frequency:'scene',stacking:'refresh'}],
      desc:'Левошлакская сабля с кольцевой гардой и тремя каплями морского стекла. Кромка не рассеивает незримое — она заставляет рану выдавать путь.'
    },
    {
      id:'shp_weapon_26', name:'Бородатый топор «Корневой залог»', icon:'🪓', image:'images/shop/weapon-root-pledge-axe.png', imageThumb:'images/shop/thumbs/weapon-root-pledge-axe.jpg',
      rarity:'rare', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'open', price:{pl:20,zl:0,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['bearded-axe','melee','hook','root-valley'], baseRegion:'root-valley', marketIds:['lesorubka-artel-yard','glupishche-last-rest'],
      requirements:[{stat:'strength',min:4}], effect:'Раз за сцену реакцией цепляет отходящего соседа и останавливает его после первой клетки; до следующего хода топор занят, а владелец не может отойти от цели дальше чем на 1 клетку',
      effects:[
        {id:'root-pledge-hook',type:'control',trigger:'adjacent-visible-enemy-moves-away',operation:'halt-after-first-move-cell',balanceOperation:'artifact-effect',value:2,condition:'axe-beard-can-catch-armor-clothing-or-gear',actionCost:'reaction',duration:'until-wielders-next-turn',frequency:'scene',stacking:'replace'},
        {id:'root-pledge-bind',type:'risk',trigger:'root-pledge-hook-succeeds',operation:'bind-wielder-to-target',value:1,condition:'wielder-does-not-release-the-axe',duration:'until-wielders-next-turn',frequency:'scene',stacking:'replace'}
      ],
      desc:'Лесорубские мастера Корневой Долины вытянули бороду топора в глубокий крюк. Он берёт не только древесину — зацепленный противник уходит лишь вместе с клинком.'
    },
    {
      id:'shp_weapon_27', name:'Секира «Каменный приговор»', icon:'🪓', image:'images/shop/weapon-stone-verdict-axe.png', imageThumb:'images/shop/thumbs/weapon-stone-verdict-axe.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'restricted', price:{pl:27,zl:0,sr:0,md:0}, hands:2,
      damage:'1d12', damageType:'Рубящий', range:'Ближняя / 1–2 клетки', tags:['greataxe','poleaxe','melee','two-handed','brace'], baseRegion:'upperland', marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],
      requirements:[{stat:'strength',min:4}], effect:'Раз за сцену реакцией встречает врага, вошедшего в радиус после движения минимум на 2 клетки: владелец немедленно атакует, а попадание обрывает оставшееся движение цели',
      effects:[{id:'stone-verdict-brace',type:'control',trigger:'enemy-enters-reach-after-moving-two-cells',operation:'make-reaction-attack-and-halt-on-hit',balanceOperation:'artifact-effect',value:2,condition:'wielder-can-see-target-and-holds-axe-with-two-hands',actionCost:'reaction',frequency:'scene',stacking:'replace'}],
      desc:'Высокая секира Казад-Дрома соединяет рубящую дугу, встречный рог и молотный обух. Её не разгоняют — её ставят там, где закончится чужой разгон.'
    },
    {
      id:'shp_weapon_28', name:'Абордажный топор «Мёртвый штиль»', icon:'⚓', image:'images/shop/weapon-dead-calm-axe.png', imageThumb:'images/shop/thumbs/weapon-dead-calm-axe.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['licensed','secret'], legality:'restricted', price:{pl:35,zl:0,sr:0,md:0}, hands:1,
      damage:'1d8', damageType:'Рубящий', range:'Ближняя / 1 клетка', tags:['boarding-axe','melee','hook','levoshlak'], baseRegion:'levoshlak', marketIds:['levoshlak-tower-vault','morelesie-lighthouse-market'],
      requirements:[{stat:'dexterity',min:4}], effect:'Раз за сцену после попадания крюк позволяет выбрать: подтянуть цель своего размера на 2 клетки или подтянуть владельца на 3 клетки к крупной цели либо закреплённой опоре',
      effects:[{id:'dead-calm-hook',type:'control',trigger:'hit',operation:'choose-pull-target-or-wielder',balanceOperation:'artifact-effect',value:2,targetPullCells:2,wielderPullCells:3,condition:'target-no-larger-than-wielder-or-hook-catches-large-target-or-fixed-anchor',frequency:'scene',stacking:'replace'}],
      desc:'Узкое лезвие и длинный крюк левошлакских абордажников одинаково уверенно берут канат, поручень и край доспеха. На палубе расстояние решает больше ширины клинка.'
    },
    {
      id:'shp_weapon_29', name:'Длинный лук «Тихая межа»', icon:'🏹', image:'images/shop/weapon-quiet-boundary-bow.png', imageThumb:'images/shop/thumbs/weapon-quiet-boundary-bow.jpg',
      rarity:'rare', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'open', price:{pl:19,zl:0,sr:0,md:0}, hands:2,
      damage:'1d8', damageType:'Колющий', range:'Дальняя / 15 клеток', tags:['longbow','bow','ranged','two-handed','ambush'], baseRegion:'root-valley', marketIds:['lesorubka-artel-yard','glupishche-last-rest'],
      requirements:[{stat:'perception',min:4}], effect:'Раз за сцену длинным действием выбирает видимую линию длиной до 3 клеток; до следующего хода первый вошедший в неё видимый враг может быть немедленно атакован реакцией',
      effects:[{id:'quiet-boundary-watch',type:'damage',trigger:'prepare-watched-line',operation:'attack-first-enemy-entering-line',balanceOperation:'artifact-effect',value:2,lineCells:3,condition:'enemy-is-visible-and-within-normal-bow-range',actionCost:'long',reactionCost:'reaction',duration:'until-wielders-next-turn',frequency:'scene',stacking:'replace'}],
      desc:'Высокий тисовый лук межевых егерей Корневой Долины. Три узла на тетиве помогают удерживать выбранный просвет, пока лес вокруг продолжает двигаться.'
    },
    {
      id:'shp_weapon_30', name:'Горный лук «Громовой склон»', icon:'🏹', image:'images/shop/weapon-thunder-slope-bow.png', imageThumb:'images/shop/thumbs/weapon-thunder-slope-bow.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'restricted', price:{pl:28,zl:0,sr:0,md:0}, hands:2,
      damage:'1d10', damageType:'Колющий', range:'Дальняя / 14 клеток', tags:['war-bow','bow','ranged','two-handed','high-ground'], baseRegion:'upperland', marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],
      requirements:[{stat:'strength',min:4}], effect:'Раз за сцену попадание с высоты минимум в 2 клетки отбрасывает цель на 2 клетки вниз по склону или от края; если путь сразу перекрыт, цель падает',
      effects:[{id:'thunder-slope-shot',type:'control',trigger:'ranged-hit-from-high-ground',operation:'push-downhill-or-knock-prone',balanceOperation:'artifact-effect',value:2,pushCells:2,condition:'wielder-is-at-least-two-cells-higher-than-target',frequency:'scene',stacking:'replace'}],
      desc:'Асимметричные плечи из горного рога и слоистой древесины гасят собственный рывок, но передают стреле вес крутого спуска.'
    },
    {
      id:'shp_weapon_31', name:'Абордажный лук «Нить отлива»', icon:'🪝', image:'images/shop/weapon-ebb-thread-bow.png', imageThumb:'images/shop/thumbs/weapon-ebb-thread-bow.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['licensed','secret'], legality:'restricted', price:{pl:36,zl:0,sr:0,md:0}, hands:2,
      damage:'1d8', damageType:'Колющий', range:'Дальняя / 10 клеток', tags:['recurve-bow','bow','ranged','two-handed','tether','levoshlak'], baseRegion:'levoshlak', marketIds:['levoshlak-tower-vault','morelesie-lighthouse-market'],
      requirements:[{stat:'dexterity',min:4}], effect:'Раз за сцену после попадания привязывает одежду или снаряжение цели к опоре в соседней клетке; цель не может отойти от опоры, пока не освободится коротким действием',
      effects:[{id:'ebb-thread-pin',type:'control',trigger:'ranged-hit',operation:'tether-target-to-adjacent-anchor',balanceOperation:'artifact-effect',value:2,condition:'solid-anchor-exists-adjacent-to-target-and-tether-arrow-is-loaded',actionCostToEscape:'short',duration:'until-freed-or-line-cut',frequency:'scene',stacking:'replace'}],
      desc:'Короткие роговые плечи удобны между мачтами, а катушка под рукоятью принимает тонкий смолёный линь. Левошлакские стрелки прибивают добычу к палубе, а не к легенде.'
    },
    {
      id:'shp_weapon_32', name:'Тяжёлый арбалет «Сквозной довод»', icon:'🏹', image:'images/shop/weapon-through-argument-crossbow.png', imageThumb:'images/shop/thumbs/weapon-through-argument-crossbow.jpg',
      rarity:'epic', powerTier:3, levels:[4,8], markets:['guild','licensed'], legality:'restricted', price:{pl:42,zl:0,sr:0,md:0}, hands:2,
      damage:'1d12', damageType:'Колющий', range:'Дальняя / 15 клеток', tags:['heavy-crossbow','crossbow','ranged','two-handed','penetrating','kazad-drom'], baseRegion:'upperland', marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],
      requirements:[{stat:'strength',min:4}], effect:'Раз за сцену при попадании болт проходит сквозь первую цель и наносит 1d8 второй цели прямо за ней в пределах 3 клеток · после сквозного выстрела требуется длинная перезарядка',
      effects:[
        {id:'through-argument-line-shot',type:'damage',trigger:'ranged-hit',operation:'pierce-aligned-second-target',balanceOperation:'artifact-effect',value:2,dice:'1d8',maxSecondTargetDistance:3,condition:'second-target-is-directly-behind-first-and-bolt-path-is-clear',frequency:'scene',stacking:'replace'},
        {id:'through-argument-reset',type:'risk',trigger:'piercing-shot-resolves',operation:'require-reload-action',value:2,actionCost:'long',condition:'windlass-and-heavy-bolt-available',frequency:'scene',stacking:'refresh'}
      ],
      desc:'Двойная направляющая Казад-Дрома удерживает тяжёлый болт после первого удара, не давая ему уйти в сторону. Механизм долго возвращать в боевое положение, зато строй перестаёт быть укрытием сам для себя.'
    }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.cat = 'weapon';
    item.category = 'weapon';
    item.slot = 'mainHand';
    item.handsRequired = item.hands;
    item.damageFormula = item.damage;
    item.imgSize = 'square';
    item.recommendedLevel = { min:item.levels[0], max:item.levels[1] };
    item.access = { markets:item.markets.slice(), legality:item.legality };
    delete item.hands;
    delete item.levels;
    delete item.markets;
    delete item.legality;
    return item;
  });

  // Специализированные товары для подготовленной охоты. Они не заменяют
  // знания из бестиария и не дают постоянный универсальный бонус: каждый
  // предмет работает только против указанного типа существа или после
  // отдельного исследования цели.
  var CREATURE_COUNTER_ITEMS = [
    {
      id:'shp_counter_01', name:'Свисток разрыва стаи', icon:'📯', image:'images/shop/packbreaker-whistle.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:1, tags:['creature-counter','beast','reusable','sound'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:6}, counterTargets:['beast'],
      access:{markets:['local-open','guild'],legality:'open'}, price:{pl:1,zl:2,sr:0,md:0},
      effect:'Короткое действие · звери в 4 клетках теряют выгоду стаи на 1 раунд · 1 раз за бой',
      effects:[{id:'break-the-pack',type:'control',trigger:'use',operation:'prevent-pack-support',areaCells:'radius-4',durationRounds:1,condition:'target-is-beast-and-can-hear',actionCost:'short',frequency:'combat',stacking:'refresh'}],
      desc:'Резкий ломаный тон сбивает сигналы вожака. Не пугает зверя сам по себе, зато на несколько ударов сердца превращает стаю в отдельных хищников.'
    },
    {
      id:'shp_counter_02', name:'Складная жаровня садовника', icon:'🔥', image:'images/shop/folding-gardener-brazier.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:2, tags:['creature-counter','plant','refillable','smoke'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:6}, counterTargets:['plant'], charges:3, maxCharges:3,
      access:{markets:['city','guild'],legality:'open'}, price:{pl:1,zl:8,sr:0,md:0},
      effect:'Длинное действие · дым 2×2 клетки на 2 раунда отключает регенерацию растений · 3 заправки',
      effects:[{id:'bitter-garden-smoke',type:'control',trigger:'deploy-and-light',operation:'suppress-regeneration',areaCells:'2x2',durationRounds:2,condition:'target-is-plant-and-remains-in-smoke',actionCost:'long',frequency:'scene',stacking:'refresh'}],
      desc:'Медная чашка тлеет горькими травами и смолой. Заправки расходуются, но сама складная жаровня служит годами.'
    },
    {
      id:'shp_counter_03', name:'Зеркальный фонарь последнего дыхания', icon:'🏮', image:'images/shop/last-breath-mirror-lantern.png',
      cat:'tool', category:'tool', slot:'offHand', handsRequired:1, tags:['creature-counter','undead','reusable','lantern'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['undead'], charges:4, maxCharges:4,
      access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:2,zl:5,sr:0,md:0},
      effect:'Короткое действие · конус 4 клетки проявляет скрытую или бесплотную нежить на 1 раунд · масло на 4 сцены',
      effects:[{id:'mirror-the-dead',type:'scouting',trigger:'open-mirror-shutter',operation:'reveal-creature',rangeCells:4,durationRounds:1,condition:'target-is-undead',actionCost:'short',frequency:'round',stacking:'refresh'}],
      desc:'Холодный огонь не освещает живых, зато серебряная заслонка ловит отражение того, чему уже нечем дышать.'
    },
    {
      id:'shp_counter_04', name:'Камертон сбойной частоты', icon:'🎼', image:'images/shop/fault-frequency-tuning-fork.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:1, tags:['creature-counter','construct','reusable','artificer'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['construct'],
      access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:2,zl:2,sr:0,md:0},
      effect:'Реакция после действия конструкта · его AC −1 до начала следующего хода · 1 раз за бой',
      effects:[{id:'fault-resonance',type:'control',trigger:'construct-completes-action-in-3-cells',operation:'reduce-ac',value:1,durationRounds:1,condition:'target-is-construct',actionCost:'reaction',frequency:'combat',stacking:'highest'}],
      desc:'Подвижный груз на зубце настраивают по звуку механизма. Верная нота не ломает машину — она на миг выдаёт зазор между пластинами.'
    },
    {
      id:'shp_counter_05', name:'Сеть метательная «Миротворец»', icon:'🕸️', image:'images/shop/peacekeeper-weighted-net.png',
      cat:'weapon', category:'weapon', slot:'mainHand', handsRequired:2, tags:['creature-counter','humanoid','reusable','nonlethal','thrown'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:6}, counterTargets:['humanoid'], range:'Метание / 4 клетки',
      access:{markets:['city','licensed'],legality:'open'}, price:{pl:1,zl:5,sr:0,md:0},
      effect:'Длинное действие · при попадании опутывает гуманоида до освобождения · сеть можно подобрать и починить',
      effects:[{id:'weighted-capture',type:'control',trigger:'successful-ranged-attack',operation:'apply-status',status:'restrained-by-net',condition:'target-is-humanoid-and-no-larger-than-medium',actionCost:'long',frequency:'combat',stacking:'replace'}],
      desc:'Тяжёлый край захлёстывает руки и ноги, не разрезая добычу. Стража ценит её там, где пленник полезнее тела.'
    },
    {
      id:'shp_counter_06', name:'Цепь семи узлов', icon:'⛓️', image:'images/shop/seven-knot-binding-chain.png',
      cat:'magic', category:'magic', slot:'utility', handsRequired:2, tags:['creature-counter','demon','reusable','ritual'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['demon'],
      access:{markets:['licensed','secret'],legality:'restricted'}, price:{pl:3,zl:5,sr:0,md:0},
      effect:'Длинное действие · замкнутый контур блокирует демоническую телепортацию через него на сцену',
      effects:[{id:'seven-knot-boundary',type:'control',trigger:'anchor-closed-boundary',operation:'block-teleport',duration:'scene',condition:'teleporting-creature-is-demon-and-chain-remains-intact',actionCost:'long',frequency:'scene',stacking:'unique-source'}],
      desc:'Каждый узел отвечает за одно имя, которым демон не хочет называться. Цепь не удержит лапы, но заставит пройти расстояние честно.'
    },
    {
      id:'shp_counter_07', name:'Полярный заземлитель', icon:'⚡', image:'images/shop/polar-grounding-stakes.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:0, tags:['creature-counter','elemental','reusable','deployable'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['elemental'],
      access:{markets:['guild','licensed'],legality:'open'}, price:{pl:2,zl:8,sr:0,md:0},
      effect:'Длинное действие · до конца боя первый стихийный толчок в зоне 2×2 клетки не сдвигает союзников',
      effects:[{id:'ground-the-surge',type:'defense',trigger:'deploy-stakes',operation:'prevent-forced-movement',areaCells:'2x2',uses:1,condition:'source-is-elemental-and-both-stakes-remain-anchored',actionCost:'long',frequency:'combat',stacking:'unique-source'}],
      desc:'Два изолированных штыря соединяют почву и разряд. Комплект не гасит стихию, а отдаёт земле её первый мощный толчок.'
    },
    {
      id:'shp_counter_08', name:'Плащ пепельного разворота', icon:'🧥', image:'images/shop/ash-turn-cloak.png',
      cat:'armor', category:'clothing', slot:'outfit', handsRequired:0, tags:['creature-counter','dragon','reusable','cloak'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['dragon'],
      access:{markets:['guild','licensed'],legality:'open'}, price:{pl:4,zl:5,sr:0,md:0},
      effect:'Реакция на дыхание дракона · шаг на 1 клетку поперёк линии и полученный урон −1d6 · 1 раз за бой',
      effects:[{id:'turn-from-breath',type:'defense',trigger:'targeted-by-dragon-breath',operation:'reduce-damage-dice',dice:'1d6',moveCells:1,condition:'a-free-adjacent-cell-exists',actionCost:'reaction',frequency:'combat',stacking:'highest'}],
      desc:'Чешуйчатая подкладка ловит жар, а тяжёлый край помогает бросить тело в сторону. От пасти дракона не спасает — даёт единственный правильный миг.'
    },
    {
      id:'shp_counter_09', name:'Монокль правильных углов', icon:'🧐', image:'images/shop/true-angle-monocle.png',
      cat:'magic', category:'jewelry', slot:'head', handsRequired:0, tags:['creature-counter','aberration','reusable','vision'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['aberration'],
      access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:4,zl:0,sr:0,md:0},
      effect:'+1 к спасброскам против иллюзий и искажения восприятия аберраций',
      effects:[{id:'correct-the-angle',type:'defense',trigger:'resist-perception-distortion',operation:'save-bonus',value:1,condition:'source-is-aberration',frequency:'passive',stacking:'highest'}],
      desc:'Гранёное стекло возвращает невозможным линиям привычную геометрию. Долго смотреть через него неприятно, но хотя бы понятно, где верх.'
    },
    {
      id:'shp_counter_10', name:'Гвозди обратного имени', icon:'🔩', image:'images/shop/reverse-name-nails.png',
      cat:'magic', category:'magic', slot:'utility', handsRequired:0, tags:['creature-counter','cursed','reusable','ritual'],
      rarity:'rare', powerTier:2, recommendedLevel:{min:3,max:7}, counterTargets:['cursed'],
      access:{markets:['licensed','secret'],legality:'restricted'}, price:{pl:3,zl:0,sr:0,md:0},
      effect:'1 минута подготовки · три гвоздя подавляют одну названную черту проклятого, пока контур цел',
      effects:[{id:'nail-the-curse-name',type:'control',trigger:'complete-three-point-ritual',operation:'suppress-curse-trait',duration:'scene',condition:'target-is-cursed-and-remains-inside-intact-boundary',actionCost:'long',frequency:'scene',stacking:'unique-source'}],
      desc:'Три железных гвоздя и малый молоток. Охотник должен заранее назвать проявление порчи: регенерацию, смену облика или зов хозяина.'
    },
    {
      id:'shp_counter_11', name:'Полевой набор пробников', icon:'🧪', image:'images/shop/field-reagent-case.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:0, tags:['creature-counter','other','reusable','analysis'],
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:1,max:7}, counterTargets:['other'], charges:3, maxCharges:3,
      access:{markets:['city','guild'],legality:'open'}, price:{pl:1,zl:0,sr:0,md:0},
      effect:'После наблюдаемого воздействия · длинное действие определяет одно сопротивление или уязвимость образца · 3 пробника',
      effects:[{id:'test-the-residue',type:'scouting',trigger:'analyze-fresh-sample-after-observed-effect',operation:'identify-resistance',value:1,condition:'fresh-sample-and-field-reagent-available',actionCost:'long',frequency:'scene',stacking:'replace'}],
      desc:'Три керамические чашки и реакции на кровь, пепел, слизь или осколок. Набор отвечает на один вопрос, но не пишет за охотника весь бестиарий.'
    },
    {
      id:'shp_counter_12', name:'Кассета охотничьих жетонов', icon:'🪙', image:'images/shop/hunter-token-cassette.png',
      cat:'tool', category:'tool', slot:'utility', handsRequired:0, tags:['creature-counter','adaptive','reusable','planning'],
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:1,max:7}, counterTargets:['beast','plant','undead','construct','humanoid','demon','elemental','dragon','aberration','cursed','other'],
      access:{markets:['guild'],legality:'open'}, price:{pl:1,zl:4,sr:0,md:0},
      effect:'Перед охотой выбери изученный тип · +1 к первой проверке знаний или выслеживания этого типа в сцене',
      effects:[{id:'prepare-the-hunt',type:'scouting',trigger:'prepare-before-encounter',operation:'prepare-counter',value:1,condition:'chosen-creature-type-was-studied-before-combat',frequency:'scene',stacking:'replace'}],
      desc:'Жетоны разных материалов помогают разложить план по шагам. Выбор делается до встречи: в бою поздно искать правильный знак.'
    }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    return item;
  });

  // Повседневная броня и одежда. Это обычная ремесленная продукция без
  // магических свойств: варианты отличаются кроем, шумом и рабочей нишей,
  // но не образуют новую обязательную лестницу AC.
  var ARMOR_AND_CLOTHING_ITEMS = [
    {
      id:'shp_armor_01', name:'Кожаный доспех пограничного дозора', icon:'🦺', image:'images/shop/border-watch-leather-coat.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','leather','light-armor','ordinary'],
      armorFamily:'leather', weightClass:'light', rarity:'common', powerTier:1, recommendedLevel:{min:1,max:5},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:1,zl:0,sr:0,md:0},
      defense:1, acBonus:1, effect:'+1 AC · лёгкая полевая защита',
      effects:[{id:'border-leather-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'}],
      desc:'Многократно промасленная кожа, широкие плечи и следы ремонта. Доспех не красив, зато его можно носить весь дозор.'
    },
    {
      id:'shp_armor_02', name:'Кожаный доспех болотного зверолова', icon:'🦺', image:'images/shop/marsh-trapper-leather-armor.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','leather','light-armor','wetlands'],
      armorFamily:'leather', weightClass:'light', rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6},
      access:{markets:['local-open','guild'],legality:'open'}, price:{pl:1,zl:4,sr:0,md:0},
      defense:1, acBonus:1, effect:'+1 AC · +1 против падения на мокрой земле и в камышах',
      effects:[
        {id:'marsh-leather-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},
        {id:'marsh-footing',type:'defense',trigger:'resist-prone',operation:'check-bonus',value:1,condition:'wet-ground-reeds-or-shallow-mud',frequency:'passive',stacking:'highest'}
      ],
      desc:'Вощёные нахлёсты сбрасывают воду, а шнуровка не цепляется за корни. После болота пахнет хуже, чем выглядит.'
    },
    {
      id:'shp_armor_03', name:'Кожаный панцирь конного разведчика', icon:'🦺', image:'images/shop/mounted-scout-leather-cuirass.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','leather','light-armor','mounted'],
      armorFamily:'leather', weightClass:'light', rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:6},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:1,zl:6,sr:0,md:0},
      defense:1, acBonus:1, effect:'+1 AC · +1 против падения или стаскивания с седла',
      effects:[
        {id:'rider-leather-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},
        {id:'stay-in-saddle',type:'defense',trigger:'resist-fall-or-dismount',operation:'check-bonus',value:1,condition:'wearer-is-mounted',frequency:'passive',stacking:'highest'}
      ],
      desc:'Короткие полы не мешают седлу, а перекрёстные ремни держат корпус при резком повороте. Хорошая вещь, но всё ещё строевая.'
    },
    {
      id:'shp_armor_04', name:'Клёпаный жилет караванной стражи', icon:'🛡️', image:'images/shop/caravan-guard-studded-vest.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','studded','medium-armor','caravan'],
      armorFamily:'studded-leather', weightClass:'medium', rarity:'common', powerTier:2, recommendedLevel:{min:2,max:6},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:2,zl:5,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · надёжная серийная защита',
      effects:[{id:'caravan-studded-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'}],
      desc:'Толстая кожа укреплена прямыми рядами железных клёпок. Такие жилеты заказывают десятками для людей, сопровождающих обозы.'
    },
    {
      id:'shp_armor_05', name:'Клёпаный доспех речного патруля', icon:'🛡️', image:'images/shop/river-patrol-studded-coat.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','studded','medium-armor','river'],
      armorFamily:'studded-leather', weightClass:'medium', rarity:'common', powerTier:2, recommendedLevel:{min:2,max:6},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:2,zl:8,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · +1 удержаться на мокрой палубе · −1 к плаванию',
      effects:[
        {id:'river-studded-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},
        {id:'river-deck-footing',type:'defense',trigger:'resist-prone',operation:'check-bonus',value:1,condition:'wet-deck-or-dock',frequency:'passive',stacking:'highest'},
        {id:'river-coat-swim-cost',type:'risk',trigger:'swim',operation:'check-penalty',value:1,condition:'armor-is-waterlogged',frequency:'passive',stacking:'highest'}
      ],
      desc:'Вощёная кожа не разбухает от брызг, но полный доспех всё равно тянет вниз. Патруль знает цену поручням и верёвкам.'
    },
    {
      id:'shp_armor_06', name:'Клёпаная куртка городского ловца', icon:'🛡️', image:'images/shop/city-catcher-studded-jack.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','studded','medium-armor','urban'],
      armorFamily:'studded-leather', weightClass:'medium', rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:6},
      access:{markets:['city','licensed'],legality:'open'}, price:{pl:3,zl:0,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · +1 против захвата · −1 к скрытности в тишине',
      effects:[
        {id:'catcher-studded-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},
        {id:'catcher-braced-collar',type:'defense',trigger:'resist-grapple',operation:'check-bonus',value:1,condition:'attacker-is-adjacent',frequency:'passive',stacking:'highest'},
        {id:'catcher-rivet-noise',type:'risk',trigger:'stealth-check',operation:'check-penalty',value:1,condition:'quiet-indoor-space',frequency:'passive',stacking:'highest'}
      ],
      desc:'Усиленный ворот и плотные плечи помогают пережить свалку в переулке. Много клёпок — много лишнего звука.'
    },
    {
      id:'shp_armor_07', name:'Кольчужная рубаха ополченца', icon:'🔗', image:'images/shop/militia-chain-shirt.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','chain','medium-armor','militia'],
      armorFamily:'chainmail', weightClass:'medium', rarity:'common', powerTier:2, recommendedLevel:{min:2,max:6},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:3,zl:5,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · −1 к скрытности при движении',
      effects:[
        {id:'militia-chain-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},
        {id:'militia-chain-noise',type:'risk',trigger:'stealth-check',operation:'check-penalty',value:1,condition:'wearer-moved-this-turn',frequency:'passive',stacking:'highest'}
      ],
      desc:'Крупные кольца и заплаты разных мастеров. Надёжнее кожи, дешевле хорошего хауберка и слышна раньше владельца.'
    },
    {
      id:'shp_armor_08', name:'Кольчуга дорожной сотни', icon:'🔗', image:'images/shop/road-company-chainmail.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','chain','medium-armor','company'],
      armorFamily:'chainmail', weightClass:'medium', rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7},
      access:{markets:['city','licensed'],legality:'open'}, price:{pl:5,zl:0,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · полноценная походная кольчуга',
      effects:[{id:'road-company-chain-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'}],
      desc:'Ровное плетение, подбитый ворот и разрез для длинного шага. Не парадная работа, но такую можно чинить в любой оружейной.'
    },
    {
      id:'shp_armor_09', name:'Кольчужный хауберк пристанной стражи', icon:'🔗', image:'images/shop/harbor-watch-chain-hauberk.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','chain','medium-armor','harbor'],
      armorFamily:'chainmail', weightClass:'medium', rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7},
      access:{markets:['city','licensed'],legality:'open'}, price:{pl:5,zl:5,sr:0,md:0},
      defense:2, acBonus:2, effect:'+2 AC · +1 против толчка на твёрдой опоре · −1 к скрытности',
      effects:[
        {id:'harbor-hauberk-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},
        {id:'harbor-hauberk-brace',type:'defense',trigger:'resist-forced-movement',operation:'check-bonus',value:1,condition:'standing-on-solid-deck-or-ground',frequency:'passive',stacking:'highest'},
        {id:'harbor-hauberk-noise',type:'risk',trigger:'stealth-check',operation:'check-penalty',value:1,condition:'wearer-is-moving',frequency:'passive',stacking:'highest'}
      ],
      desc:'Тяжёлый подол и плотный поддоспешник помогают удержать строй у воды. Кольца темнеют от соли и требуют ежедневной протирки.'
    },
    {
      id:'shp_armor_10', name:'Короткая кольчужная рубаха разведчика', icon:'🔗', image:'images/shop/scout-short-chain-shirt.png',
      cat:'armor', category:'armor', slot:'body', handsRequired:0, tags:['armor','chain','light-armor','scout'],
      armorFamily:'chainmail', weightClass:'light', rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:3,zl:5,sr:0,md:0},
      defense:1, acBonus:1, effect:'+1 AC · облегчённое плетение без штрафа к скрытности',
      effects:[
        {id:'scout-chain-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},
        {id:'scout-chain-quiet',type:'scouting',trigger:'stealth-check',operation:'ignore-penalty',value:1,condition:'penalty-would-come-from-chainmail-noise',frequency:'passive',stacking:'highest'}
      ],
      desc:'Мелкое плетение закрывает корпус, но не руки и бёдра. За тишину платят меньшей площадью защиты, а не чудесным металлом.'
    },
    {
      id:'shp_armor_11', name:'Комплект конюха', icon:'🐴', image:'images/shop/stablehand-outfit.png',
      cat:'armor', category:'clothing', slot:'body', handsRequired:0, tags:['outfit','clothing','stable','ordinary'],
      armorFamily:'clothing', weightClass:'clothing', rarity:'common', powerTier:1, recommendedLevel:{min:1,max:6},
      access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'+1 к уходу за ездовыми животными и их успокоению вне боя',
      effects:[{id:'stable-work',type:'world',trigger:'handle-or-care-for-mount',operation:'check-bonus',value:1,condition:'outside-combat',frequency:'passive',stacking:'highest'}],
      desc:'Льняная рубаха, рабочий жилет, фартук, штопаные штаны и крепкие ботинки. Всё легко чистится от сена, грязи и чужого характера.'
    },
    {
      id:'shp_armor_12', name:'Комплект гильдейского писаря', icon:'🖋️', image:'images/shop/guild-scribe-outfit-v2.png',
      cat:'armor', category:'clothing', slot:'body', handsRequired:0, tags:['outfit','clothing','scribe','city'],
      armorFamily:'clothing', weightClass:'clothing', rarity:'uncommon', powerTier:1, recommendedLevel:{min:1,max:6},
      access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:8,sr:0,md:0},
      effect:'+1 к чтению договоров, копированию документов и поиску канцелярской ошибки',
      effects:[{id:'scribe-work',type:'world',trigger:'read-copy-or-audit-document',operation:'check-bonus',value:1,condition:'document-is-nonmagical-and-language-is-known',frequency:'passive',stacking:'highest'}],
      desc:'Сине-серый сюртук, чистая рубаха, мягкая обувь и сумка для бумаг. Выглядит достаточно служебно, чтобы задать неудобный вопрос.'
    }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    return item;
  });

  // Щиты имеют общую базовую защиту, но выбираются по роли: свободная
  // реакция, прикрытие спутника, стационарное укрытие, борьба у борта или
  // удержание узкого прохода. Это не линейка одинаковых прибавок к AC.
  var SHIELD_ITEMS = [
    {id:'shp_shield_01',name:'Баклер дорожного дуэлянта',image:'images/shop/shield-01.png',imageThumb:'images/shop/thumbs/shield-01.jpg',shieldRole:'duelist-buckler',armorFamily:'shield',weightClass:'light',slot:'offHand',powerTier:2,rarity:'uncommon',price:{pl:1,zl:2,sr:0,md:0},defense:1,acBonus:1,effect:'Лёгкая щитовая защита · раз за сцену после промаха в ближнем бою позволяет отступить на 1 клетку реакцией',desc:'Малый выпуклый щит с глубоким кулачным хватом. Он не закрывает корпус, зато не мешает клинку и помогает разорвать опасную дистанцию.',effects:[{id:'road-duelist-buckler-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},{id:'road-duelist-buckler-step',type:'tempo',trigger:'adjacent-melee-attack-misses-wearer',operation:'move-cells',balanceOperation:'artifact-effect',value:1,condition:'destination-is-free-and-not-through-attacker',actionCost:'reaction',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-last-rest']},
    {id:'shp_shield_02',name:'Каплевидный щит трактовой сотни',image:'images/shop/shield-02.png',imageThumb:'images/shop/thumbs/shield-02.jpg',shieldRole:'road-kite-shield',armorFamily:'shield',weightClass:'medium',slot:'offHand',powerTier:2,rarity:'common',price:{pl:1,zl:8,sr:0,md:0},defense:1,acBonus:1,effect:'Надёжная щитовая защита · длинным действием прикрывает соседнего союзника от дальних атак до следующего хода',desc:'Высокий деревянный щит с сыромятным краем и двумя ремнями. Стража ставит такие внахлёст, но даже одиночка может закрыть раненого спутника.',effects:[{id:'road-company-kite-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},{id:'road-company-kite-cover',type:'defense',trigger:'brace-beside-adjacent-ally',operation:'grant-shield-cover',balanceOperation:'artifact-effect',value:1,condition:'wearer-and-ally-do-not-move;against-ranged-attacks',actionCost:'long',duration:'until-wearers-next-turn',frequency:'round',stacking:'highest'}],baseRegion:'root-valley',marketIds:['glupishche-last-rest','glupishche-three-strikes']},
    {id:'shp_shield_03',name:'Складная павеза корневого стрелка',image:'images/shop/shield-03.png',imageThumb:'images/shop/thumbs/shield-03.jpg',shieldRole:'folding-pavise',armorFamily:'shield',weightClass:'heavy',slot:'offHand',powerTier:2,rarity:'uncommon',price:{pl:2,zl:8,sr:0,md:0},defense:1,acBonus:1,effect:'Тяжёлая щитовая защита · за длинное действие ставится как укрытие для одного стрелка',desc:'Высокая дощатая павеза складывается вдоль центрального ребра и упирается железным шипом. После установки её можно обойти, опрокинуть или унести.',effects:[{id:'root-archer-pavise-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},{id:'root-archer-pavise-deploy',type:'defense',trigger:'plant-pavise-on-firm-ground',operation:'create-one-creature-cover',balanceOperation:'artifact-effect',value:1,condition:'stationary-and-attacks-cross-shield-facing',actionCost:'long',frequency:'scene',stacking:'replace'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-last-rest']},
    {id:'shp_shield_04',name:'Крюковой щит пристанной стражи',image:'images/shop/shield-04.png',imageThumb:'images/shop/thumbs/shield-04.jpg',shieldRole:'harbor-hook-shield',armorFamily:'shield',weightClass:'medium',slot:'offHand',powerTier:2,rarity:'uncommon',price:{pl:2,zl:2,sr:0,md:0},defense:1,acBonus:1,effect:'Щитовая защита · реакцией цепляется за борт, поручень или соседний щит и не даёт сдвинуть владельца слабым толчком',desc:'Полукруглая железная скоба выступает за верхний край. Ею удерживают строй на мокром причале, но она легко цепляется за ветви и тесные дверные косяки.',effects:[{id:'harbor-hook-shield-ac',type:'defense',trigger:'equip',operation:'add-ac',value:1,frequency:'passive',stacking:'highest'},{id:'harbor-hook-shield-brace',type:'defense',trigger:'resist-minor-forced-movement',operation:'prevent-forced-movement',balanceOperation:'artifact-effect',value:1,condition:'hook-can-catch-rail-fixed-object-or-allied-shield',actionCost:'reaction',frequency:'round',stacking:'replace'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','glupishche-three-strikes']},
    {id:'shp_shield_05',name:'Башенный щит «Глухая Стена»',image:'images/shop/shield-05.png',imageThumb:'images/shop/thumbs/shield-05.jpg',shieldRole:'kazad-tower-shield',armorFamily:'shield',weightClass:'heavy',slot:'offHand',powerTier:3,rarity:'rare',price:{pl:5,zl:5,sr:0,md:0},defense:2,acBonus:2,effect:'Тяжёлая щитовая защита · удерживает проход шириной в 1 клетку · с поднятым щитом нельзя совершать Рывок',desc:'Дубовая плита обшита вертикальными полосами стали Казад-Дрома и снабжена нижним башмаком. Щит почти превращает бойца в дверь — вместе со всеми достоинствами двери.',effects:[{id:'deaf-wall-tower-shield-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},{id:'deaf-wall-hold-passage',type:'control',trigger:'brace-in-one-cell-wide-passage',operation:'block-enemy-passage',balanceOperation:'artifact-effect',value:2,condition:'wearer-stationary-and-facing-threat',actionCost:'long',frequency:'round',stacking:'replace'},{id:'deaf-wall-no-dash',type:'risk',trigger:'move-with-raised-shield',operation:'block-dash',value:1,frequency:'passive',stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],access:{markets:['guild','licensed'],legality:'restricted'}}
  ].map(function(item){
    item.icon='🛡️';
    item.cat='armor';
    item.category='shield';
    item.handsRequired=1;
    item.tags=['armor','shield',item.shieldRole,item.weightClass];
    item.access=item.access||{markets:['city','guild'],legality:'open'};
    return finishBatchItem(item,{cat:'armor',category:'shield',slot:'offHand',tags:[],access:item.access});
  });

  var CUIRASS_ITEMS = [
    {id:'shp_cuirass_01',name:'Сегментная кираса дозорного',image:'images/shop/cuirass-01.png',imageThumb:'images/shop/thumbs/cuirass-01.jpg',cuirassRole:'mobile-segmented',armorFamily:'cuirass',weightClass:'medium',powerTier:3,rarity:'uncommon',price:{pl:3,zl:5,sr:0,md:0},defense:2,acBonus:2,effect:'Средняя защита корпуса · не мешает ползти, карабкаться и проходить тесный лаз обычной ширины',desc:'Короткая нагрудная пластина соединена с подвижными брюшными полосами. Открытые плечи сохраняют свободу рук, но требуют отдельной защиты.',effects:[{id:'watch-segmented-cuirass-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},{id:'watch-segmented-mobility',type:'world',trigger:'crawl-climb-or-squeeze',operation:'ignore-armor-mobility-penalty',balanceOperation:'artifact-effect',value:1,condition:'ordinary-obstacle-and-cuirass-only',frequency:'passive',stacking:'highest'}],baseRegion:'root-valley',marketIds:['glupishche-three-strikes','glupishche-last-rest']},
    {id:'shp_cuirass_02',name:'Рёберная кираса пикинёра',image:'images/shop/cuirass-02.png',imageThumb:'images/shop/thumbs/cuirass-02.jpg',cuirassRole:'fluted-pikeman',armorFamily:'cuirass',weightClass:'medium',powerTier:3,rarity:'rare',price:{pl:5,zl:0,sr:0,md:0},defense:2,acBonus:2,effect:'Строевая защита корпуса · раз за сцену реакцией уменьшает кость фронтального колющего урона на одну ступень',desc:'Высокое центральное ребро и расходящиеся желобки уводят остриё от груди. Кираса помогает только против видимого удара спереди.',effects:[{id:'pikeman-fluted-cuirass-ac',type:'defense',trigger:'equip',operation:'add-ac',value:2,frequency:'passive',stacking:'highest'},{id:'pikeman-fluted-deflection',type:'defense',trigger:'receive-visible-frontal-piercing-hit',operation:'reduce-damage-dice-step',balanceOperation:'artifact-effect',value:1,condition:'attacker-in-front-and-wearer-can-react',actionCost:'reaction',frequency:'scene',stacking:'highest'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},
    {id:'shp_cuirass_03',name:'Горновая кираса Казад-Дрома',image:'images/shop/cuirass-03.png',imageThumb:'images/shop/thumbs/cuirass-03.jpg',cuirassRole:'kazad-forge-heavy',armorFamily:'cuirass',weightClass:'heavy',powerTier:3,rarity:'rare',price:{pl:8,zl:0,sr:0,md:0},defense:3,acBonus:3,effect:'Тяжёлая защита корпуса · раз за отдых превращает критическое попадание по корпусу в обычное · мешает плаванию',desc:'Чёрная сталь собрана из верхней нагрудной плиты и отдельного усиленного плакарта. Вес распределён хорошо, но в воде кираса остаётся куском горы.',effects:[{id:'kazad-forge-cuirass-ac',type:'defense',trigger:'equip',operation:'add-ac',value:3,frequency:'passive',stacking:'highest'},{id:'kazad-forge-critical-catch',type:'defense',trigger:'critical-hit-to-torso',operation:'convert-critical-to-normal-hit',balanceOperation:'artifact-effect',value:2,condition:'physical-hit-and-armor-intact',actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'},{id:'kazad-forge-swim-cost',type:'risk',trigger:'swim',operation:'grant-disadvantage',value:1,condition:'cuirass-worn',frequency:'passive',stacking:'highest'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain'],access:{markets:['guild','licensed'],legality:'restricted'}},
    {id:'shp_cuirass_04',name:'Осадная кираса Рудной Стражи',image:'images/shop/cuirass-04.png',imageThumb:'images/shop/thumbs/cuirass-04.jpg',cuirassRole:'ore-guard-superheavy',armorFamily:'cuirass',weightClass:'superheavy',powerTier:3,rarity:'uncommon',price:{pl:5,zl:5,sr:0,md:0},defense:3,acBonus:3,effect:'Сверхтяжёлая защита корпуса · встав в упор, владелец не сдвигается обычным толчком · нельзя совершать Рывок, лазание и плавание проходят с помехой',desc:'Грубые перекрывающиеся плиты закрывают грудь, живот и бока почти без зазоров. Такую кирасу надевают стражи рудных ворот, которым важнее удержать проход, чем догнать беглеца.',effects:[{id:'ore-guard-superheavy-ac',type:'defense',trigger:'equip',operation:'add-ac',value:3,frequency:'passive',stacking:'highest'},{id:'ore-guard-braced-mass',type:'defense',trigger:'brace-on-firm-ground',operation:'prevent-forced-movement',balanceOperation:'artifact-effect',value:1,condition:'ordinary-push-and-wearer-does-not-move',actionCost:'long',duration:'until-wearer-moves',frequency:'round',stacking:'replace'},{id:'ore-guard-no-dash',type:'risk',trigger:'move',operation:'block-dash',value:1,condition:'cuirass-worn',frequency:'passive',stacking:'replace'},{id:'ore-guard-climb-swim-cost',type:'risk',trigger:'climb-or-swim',operation:'grant-disadvantage',value:1,condition:'cuirass-worn',frequency:'passive',stacking:'highest'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure'],access:{markets:['guild','licensed'],legality:'restricted'}}
  ].map(function(item){
    item.icon='🛡️'; item.cat='armor'; item.category='armor'; item.slot='body'; item.handsRequired=0;
    item.tags=['armor','cuirass',item.cuirassRole,item.weightClass];
    item.access=item.access||{markets:['city','guild'],legality:'open'};
    return finishBatchItem(item,{cat:'armor',category:'armor',slot:'body',tags:[],access:item.access});
  });

  // Одноразовые составы и приспособления для охоты на конкретные типы
  // существ. Масло расходуется при нанесении, но само покрытие держится
  // несколько раундов или попаданий: подготовка должна ощущаться весомо.
  var CREATURE_HUNT_CONSUMABLE_ITEMS = [
    {
      id:'shp_hunt_01', name:'Смоляное масло углежога', icon:'🧴', image:'images/shop/charcoal-resin-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-2-hits', counterTargets:['plant'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','guild'],legality:'open'}, price:{pl:0,zl:6,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 2 попадания по растениям: +1d6 огнём · первое отключает регенерацию на 2 раунда',
      effects:[
        {id:'charcoal-resin-burn',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Огненный',maxHits:2,durationRounds:3,condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'charcoal-resin-sear',type:'control',trigger:'first-coated-hit',operation:'suppress-regeneration',durationRounds:2,condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Густая смола цепляется за клинок и продолжает тлеть в древесной плоти. Одной порции хватает на одно удачное попадание.'
    },
    {
      id:'shp_hunt_02', name:'Масло белого железа', icon:'🧴', image:'images/shop/white-iron-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-3-hits', counterTargets:['undead'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:8,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 3 попадания по нежити: +1d6 духовного · первое не даёт скрыться 3 раунда',
      effects:[
        {id:'white-iron-strike',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Духовный',maxHits:3,durationRounds:3,condition:'target-is-undead',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'white-iron-mark',type:'scouting',trigger:'first-coated-hit',operation:'prevent-hide',durationRounds:3,condition:'target-is-undead',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Светлая взвесь остаётся на мёртвой плоти заметным следом. Это не святая реликвия, а добротная работа храмового алхимика.'
    },
    {
      id:'shp_hunt_03', name:'Масло медной грозы', icon:'⚡', image:'images/shop/copper-storm-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-3-hits', counterTargets:['construct'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:9,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 3 попадания по конструктам: +1d6 молнией · первое лишает реакции на 1 раунд',
      effects:[
        {id:'copper-storm-spark',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Электрический',maxHits:3,durationRounds:3,condition:'target-is-construct',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'copper-storm-gap',type:'control',trigger:'first-coated-hit',operation:'disable-reaction',durationRounds:1,condition:'target-is-construct',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Медная суспензия растекается по сочленениям и на миг выдаёт слабый зазор между пластинами.'
    },
    {
      id:'shp_hunt_04', name:'Масло холодного железа', icon:'🧴', image:'images/shop/cold-iron-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-3-hits', counterTargets:['demon'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:1,zl:2,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 3 попадания по демонам: +1d6 холодным железом · первое блокирует телепортацию на 2 раунда',
      effects:[
        {id:'cold-iron-strike',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Холодное железо',maxHits:3,durationRounds:3,condition:'target-is-demon',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'cold-iron-anchor',type:'control',trigger:'first-coated-hit',operation:'block-teleport',durationRounds:2,condition:'target-is-demon',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Серая паста холодит рукоять даже через перчатку. Рана от неё на несколько мгновений делает расстояние для демона настоящим.'
    },
    {
      id:'shp_hunt_05', name:'Масло ледяной кромки', icon:'❄️', image:'images/shop/frost-edge-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-2-hits', counterTargets:['elemental','dragon'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:7,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 2 попадания по огненной твари: +1d6 холодом · первое запрещает Рывок на 2 раунда',
      effects:[
        {id:'frost-edge-strike',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Холодный',maxHits:2,durationRounds:3,condition:'target-is-fire-elemental-or-fire-dragon',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'frost-edge-slow',type:'control',trigger:'first-coated-hit',operation:'block-dash',durationRounds:2,condition:'target-is-fire-elemental-or-fire-dragon',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Холодная мазь не замораживает оружие навсегда. Она забирает жар из одной раны и делает следующий шаг твари тяжелее.'
    },
    {
      id:'shp_hunt_06', name:'Масло охотничьей соли', icon:'🧂', image:'images/shop/hunter-salt-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-2-hits', counterTargets:['beast'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 2 попадания по зверям: +1d6 · первое отключает поддержку стаи на 2 раунда',
      effects:[
        {id:'hunter-salt-strike',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Физический',maxHits:2,durationRounds:3,condition:'target-is-beast',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'hunter-salt-scent',type:'control',trigger:'first-coated-hit',operation:'prevent-pack-support',durationRounds:2,condition:'target-is-beast',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Резкая соль перебивает запах стаи и жжёт чувствительную рану. Против одиночного хищника остаётся просто хорошей присыпкой.'
    },
    {
      id:'shp_hunt_07', name:'Масло ясного контура', icon:'👁️', image:'images/shop/clear-contour-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds', counterTargets:['aberration'],
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:1,zl:0,sr:0,md:0},
      effect:'Короткое действие · 3 раунда даёт преимущество против аберраций · первое попадание проявляет цель на 2 раунда',
      effects:[
        {id:'clear-contour-aim',type:'damage',trigger:'coated-weapon-attack',operation:'grant-advantage',durationRounds:3,condition:'target-is-aberration',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'clear-contour-mark',type:'scouting',trigger:'first-coated-hit',operation:'reveal-creature',durationRounds:2,condition:'target-is-aberration',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Почти прозрачное масло ломает ложные блики вокруг клинка. Даже промах на миг показывает, где у невозможного тела настоящий край.'
    },
    {
      id:'shp_hunt_08', name:'Масло красной нити', icon:'🧵', image:'images/shop/red-thread-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-for-3-rounds-or-3-hits', counterTargets:['cursed'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:1,zl:4,sr:0,md:0},
      effect:'Короткое действие · 3 раунда или 3 попадания по проклятым: +1d6 ритуального · первое блокирует смену облика на 2 раунда',
      effects:[
        {id:'red-thread-strike',type:'damage',trigger:'coated-weapon-hit',operation:'add-damage-dice',dice:'1d6',damageType:'Ритуальный',maxHits:3,durationRounds:3,condition:'target-is-cursed',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'red-thread-bind',type:'control',trigger:'first-coated-hit',operation:'block-transformation',durationRounds:2,condition:'target-is-cursed',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Красные волокна расползаются по ране и удерживают один облик. Охотники ценят лишний раунд, когда чудовище остаётся узнаваемым.'
    },
    {
      id:'shp_hunt_09', name:'Известковая колба', icon:'🏺', image:'images/shop/limeburst-flask.png',
      delivery:'thrown', appliesTo:'2x2-zone', counterTargets:['plant'], range:'Метание / 4 клетки',
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:4,sr:0,md:0},
      effect:'Короткое действие · зона 2×2: растения получают AC −1 и не регенерируют 1 раунд',
      effects:[
        {id:'limeburst-open-bark',type:'control',trigger:'thrown-impact',operation:'reduce-ac',value:1,areaCells:'2x2',durationRounds:1,condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'limeburst-dry',type:'control',trigger:'same-impact',operation:'suppress-regeneration',areaCells:'2x2',durationRounds:1,condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Колба лопается облаком едкой извести. Она высушивает сок и раскрывает мягкие волокна, но быстро оседает.'
    },
    {
      id:'shp_hunt_10', name:'Погребальный колокольчик', icon:'🔔', image:'images/shop/funeral-chime-grenade.png',
      delivery:'thrown', appliesTo:'one-target', counterTargets:['undead'], range:'Метание / 4 клетки',
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:6,sr:0,md:0},
      effect:'Короткое действие · проявляет нежить и лишает её реакции на 1 раунд',
      effects:[
        {id:'funeral-chime-reveal',type:'scouting',trigger:'thrown-chime-rings',operation:'reveal-creature',durationRounds:1,condition:'target-is-undead-and-can-hear',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'},
        {id:'funeral-chime-stagger',type:'control',trigger:'same-chime',operation:'disable-reaction',durationRounds:1,condition:'target-is-undead-and-can-hear',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Одноразовый сплав трескается после удара, зато мёртвые на миг вспоминают звон, которым провожали живых.'
    },
    {
      id:'shp_hunt_11', name:'Магнитный песок', icon:'🧲', image:'images/shop/lodestone-sand-bomb.png',
      delivery:'thrown', appliesTo:'one-target', counterTargets:['construct'], range:'Метание / 4 клетки',
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'Короткое действие · конструкт получает скорость −2 и не может использовать реакцию 1 раунд',
      effects:[
        {id:'lodestone-sand-drag',type:'control',trigger:'thrown-impact',operation:'reduce-speed',value:2,durationRounds:1,condition:'target-is-construct-with-metal-parts',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'lodestone-sand-jam',type:'control',trigger:'same-impact',operation:'disable-reaction',durationRounds:1,condition:'target-is-construct-with-metal-parts',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Железная крошка липнет к шарнирам и грузит быстрые движения. Против дерева и камня без металлических частей бесполезна.'
    },
    {
      id:'shp_hunt_12', name:'Флакон якорного дыма', icon:'⚓', image:'images/shop/anchor-smoke-vial.png',
      delivery:'thrown', appliesTo:'2x2-zone', counterTargets:['demon'], range:'Метание / 4 клетки',
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:1,zl:0,sr:0,md:0},
      effect:'Короткое действие · дым 2×2 клетки запрещает демонам телепортацию на 1 раунд',
      effects:[{id:'anchor-smoke-zone',type:'control',trigger:'thrown-vial-breaks',operation:'block-teleport',areaCells:'2x2',durationRounds:1,condition:'target-is-demon-and-remains-in-smoke',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Тяжёлый дым стелется у земли и заставляет демона выходить из него ногами. Ветер быстро разрушает рисунок.'
    },
    {
      id:'shp_hunt_13', name:'Сосуд противотока', icon:'🌊', image:'images/shop/countercurrent-jar.png',
      delivery:'thrown', appliesTo:'one-target', counterTargets:['elemental'], range:'Метание / 4 клетки',
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:9,sr:0,md:0},
      effect:'Короткое действие · элементаль не может толкать или тянуть и получает скорость −1 на 1 раунд',
      effects:[
        {id:'countercurrent-brace',type:'control',trigger:'thrown-impact',operation:'prevent-forced-movement',durationRounds:1,condition:'target-is-elemental',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'},
        {id:'countercurrent-slow',type:'control',trigger:'same-impact',operation:'reduce-speed',value:1,durationRounds:1,condition:'target-is-elemental',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}
      ],
      desc:'Два встречных завихрения рвут единый поток стихии. Элементаль остаётся опасным, но на миг теряет власть над чужим положением.'
    },
    {
      id:'shp_hunt_14', name:'Глиняная бомба щелевика', icon:'💥', image:'images/shop/scalecracker-clay-bomb.png',
      delivery:'thrown', appliesTo:'one-target', counterTargets:['dragon'], range:'Метание / 4 клетки',
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:2,max:7}, access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:0,zl:8,sr:0,md:0},
      effect:'Короткое действие · природная броня дракона получает AC −1 на 1 раунд',
      effects:[{id:'scalecracker-grit',type:'control',trigger:'thrown-impact',operation:'reduce-ac',value:1,durationRounds:1,condition:'target-is-dragon-with-natural-armor',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}],
      desc:'Керамические клинья и грубый песок не ломают чешую, а забивают её стыки. Этого хватает для одного общего натиска.'
    },
    {
      id:'shp_hunt_15', name:'Свистящая приманка', icon:'🪈', image:'images/shop/whistling-beast-lure.png',
      delivery:'device', appliesTo:'one-target-or-point', counterTargets:['beast'], range:'Метание / 4 клетки',
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:3,sr:0,md:0},
      effect:'Короткое действие · зверь смещается к приманке на 1 клетку и теряет поддержку стаи на 1 раунд',
      effects:[
        {id:'whistling-lure-step',type:'control',trigger:'thrown-lure-whistles',operation:'pull-cells',value:1,condition:'target-is-beast-and-can-hear',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'whistling-lure-break-pack',type:'control',trigger:'same-whistle',operation:'prevent-pack-support',durationRounds:1,condition:'target-is-beast-and-can-hear',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Груз тащит свисток по земле, звук скачет в сторону от охотника. Хороший зверь замечает обман быстро — но не сразу.'
    },
    {
      id:'shp_hunt_16', name:'Петля миротворца', icon:'🪢', image:'images/shop/peacekeeper-bola.png',
      delivery:'device', appliesTo:'one-target', counterTargets:['humanoid'], range:'Метание / 4 клетки',
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','licensed'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'Короткое действие · при попадании гуманоид опутан до конца следующего хода',
      effects:[{id:'peacekeeper-bola-bind',type:'control',trigger:'successful-thrown-attack',operation:'apply-status',status:'entangled',durationRounds:1,condition:'target-is-humanoid-and-no-larger-than-medium',actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Три тупых груза обвивают ноги и оружие. Петля рассчитана на захват живого противника, а не на красивый бросок.'
    },
    {
      id:'shp_hunt_17', name:'Зеркальная фольга', icon:'🪞', image:'images/shop/mirror-foil-sheet.png',
      delivery:'device', appliesTo:'one-target', counterTargets:['aberration'], range:'Бросок света / 4 клетки',
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:0,zl:9,sr:0,md:0},
      effect:'Короткое действие · проявляет аберрацию и даёт ей −1 к следующей атаке в этом раунде',
      effects:[
        {id:'mirror-foil-reveal',type:'scouting',trigger:'unfold-and-flash',operation:'reveal-creature',durationRounds:1,condition:'target-is-aberration-and-can-see-reflection',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'},
        {id:'mirror-foil-aim-break',type:'control',trigger:'same-flash',operation:'reduce-attack-bonus',value:1,durationRounds:1,condition:'target-is-aberration-and-can-see-reflection',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}
      ],
      desc:'Ломаные грани возвращают твари сразу несколько несовместимых отражений. Фольга сгорает от напряжения после одного раскрытия.'
    },
    {
      id:'shp_hunt_18', name:'Печать сдерживания порчи', icon:'🩸', image:'images/shop/curse-binding-seal.png',
      delivery:'device', appliesTo:'one-target', counterTargets:['cursed'], range:'Ближняя / 1 клетка',
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:1,zl:1,sr:0,md:0},
      effect:'Короткое действие · подавляет смену облика или регенерацию проклятого на 1 раунд',
      effects:[{id:'curse-binding-choice',type:'control',trigger:'press-seal-on-target-or-fresh-trace',operation:'suppress-curse-trait',durationRounds:1,condition:'target-is-cursed-and-user-names-transformation-or-regeneration',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}],
      desc:'Охотник заранее называет одно проявление порчи. Печать не снимает проклятие — только заставляет его замолчать на несколько мгновений.'
    },
    {
      id:'shp_hunt_19', name:'Пакет шок-соли', icon:'🧂', image:'images/shop/shock-salt-packet.png',
      delivery:'device', appliesTo:'one-target', counterTargets:['other'], range:'Метание / 3 клетки',
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','licensed'],legality:'open'}, price:{pl:0,zl:8,sr:0,md:0},
      effect:'Короткое действие · следующее попадание игнорирует одно заранее известное сопротивление цели',
      effects:[{id:'shock-salt-open-resistance',type:'support',trigger:'apply-after-resistance-was-identified',operation:'ignore-resistance-on-next-hit',uses:1,condition:'resistance-is-known-before-use',actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}],
      desc:'Кристаллы на миг нарушают уже изученную защиту. Без предварительного знания состава пакет тратится вслепую и ничего не гарантирует.'
    },
    {
      id:'shp_hunt_20', name:'Пыль следовой памяти', icon:'✨', image:'images/shop/memory-track-dust.png',
      delivery:'device', appliesTo:'one-target-or-trail', counterTargets:['beast','plant','undead','construct','humanoid','demon','elemental','dragon','aberration','cursed','other'], range:'Рассыпать / 3 клетки',
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:7}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:7,sr:0,md:0},
      effect:'Короткое действие · проявляет след и не даёт отмеченной цели скрыться 2 раунда',
      effects:[
        {id:'memory-dust-track',type:'scouting',trigger:'scatter-on-target-or-fresh-trail',operation:'reveal-tracks',durationRounds:2,condition:'powder-touches-target-or-fresh-trail',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'},
        {id:'memory-dust-mark',type:'scouting',trigger:'same-scatter',operation:'prevent-hide',durationRounds:2,condition:'powder-touches-target',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Пыль цепляется не к телу, а к недавнему движению. Светится слабо, зато показывает поворот, прыжок и попытку раствориться в темноте.'
    }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    item.cat = item.delivery === 'weapon-coating' ? 'potion' : 'tool';
    item.category = 'consumable';
    item.slot = 'consumable';
    item.handsRequired = 0;
    item.charges = 1;
    item.tags = ['consumable','creature-hunt',item.delivery].concat(item.counterTargets || []);
    return item;
  });

  // Обычное походное снаряжение: полезность вне боя, без магической силы.
  // Пять равных групп позволяют расширять каталог без перекоса в одни палатки
  // или расходники.
  var EXPEDITION_GEAR_ITEMS = [
    { id:'shp_expedition_01', name:'Палатка трактового путника', icon:'⛺', image:'images/shop/trail-ridge-tent.png', expeditionGroup:'shelter', rarity:'common', price:{pl:1,zl:5,sr:0,md:0}, effect:'Сухой ночлег для двух путников', desc:'Низкая двускатная палатка из вощёного холста. Ставится за 10 минут и выдерживает обычный дождь.', effects:[{id:'trail-tent-camp',type:'world',trigger:'make-camp',operation:'safe-camp',value:1,condition:'two-people-or-fewer',actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_02', name:'Караванная палатка на четверых', icon:'⛺', image:'images/shop/caravan-party-tent.png', expeditionGroup:'shelter', rarity:'uncommon', price:{pl:3,zl:0,sr:0,md:0}, effect:'Укрытие для четырёх путников и их поклажи', desc:'Просторная палатка с усиленными растяжками. Тяжелее дорожной, зато в ней можно переждать долгую непогоду.', effects:[{id:'caravan-tent-camp',type:'world',trigger:'make-camp',operation:'safe-camp',value:1,condition:'four-people-or-fewer',actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_03', name:'Вощёный походный тент', icon:'🏕️', image:'images/shop/waxed-rain-tarp.png', expeditionGroup:'shelter', rarity:'common', price:{pl:0,zl:7,sr:0,md:0}, effect:'Закрывает лагерь от дождя и ветра', desc:'Плотное полотно с латунными кольцами. Служит навесом, подстилкой или временной стеной.', effects:[{id:'tarp-weather',type:'world',trigger:'prepare-shelter',operation:'ignore-penalty',value:1,condition:'ordinary-rain-or-wind',actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_04', name:'Шерстяной дорожный спальник', icon:'🛏️', image:'images/shop/wool-travel-bedroll.png', expeditionGroup:'shelter', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, effect:'Защищает отдых от обычного ночного холода', desc:'Толстая шерсть, холщовый чехол и ремни для скрутки. Не заменяет палатку, но сохраняет тепло на сухой земле.', effects:[{id:'bedroll-rest',type:'support',trigger:'long-rest',operation:'prevent-fatigue',value:1,condition:'dry-and-ordinary-cold',frequency:'scene',stacking:'highest'}] },

    { id:'shp_expedition_05', name:'Кожаная фляга путника', icon:'💧', image:'images/shop/leather-waterskin.png', expeditionGroup:'water', rarity:'common', price:{pl:0,zl:1,sr:5,md:0}, effect:'Запас воды одному путнику на день', desc:'Мягкая просмолённая фляга на плечевом ремне. Пустая сворачивается и почти не занимает места.', effects:[{id:'waterskin-supply',type:'world',trigger:'travel',operation:'carry-water',value:1,frequency:'passive',stacking:'replace'}] },
    { id:'shp_expedition_06', name:'Железная фляга дозорного', icon:'🧴', image:'images/shop/iron-expedition-canteen.png', expeditionGroup:'water', rarity:'common', price:{pl:0,zl:3,sr:0,md:0}, effect:'Прочная дневная порция воды', desc:'Плоская лужёная фляга в суконном чехле. Не прокалывается веткой и удобно ложится под плащ.', effects:[{id:'iron-canteen-supply',type:'world',trigger:'travel',operation:'carry-water',value:1,frequency:'passive',stacking:'replace'}] },
    { id:'shp_expedition_07', name:'Угольный походный фильтр', icon:'⚗️', image:'images/shop/charcoal-water-filter.png', expeditionGroup:'water', rarity:'common', price:{pl:0,zl:4,sr:0,md:0}, charges:4, effect:'Очищает четыре фляги мутной воды', desc:'Ткань, песок и древесный уголь в разборном кожухе. Убирает грязь и запах, но не нейтрализует яд или проклятие.', effects:[{id:'charcoal-filter',type:'support',trigger:'prepare-water',operation:'filter-water',value:3,condition:'nonmagical-contamination',actionCost:'long',frequency:'scene',stacking:'replace'}] },
    { id:'shp_expedition_08', name:'Керамический лагерный кувшин', icon:'🏺', image:'images/shop/ceramic-camp-water-jug.png', expeditionGroup:'water', rarity:'common', price:{pl:0,zl:3,sr:0,md:0}, effect:'Хранит воду на небольшой лагерь', desc:'Толстостенный кувшин в плетёной оплётке. Удобен в повозке или постоянном лагере, но не любит падений.', effects:[{id:'camp-jug-supply',type:'world',trigger:'make-camp',operation:'carry-water',value:1,frequency:'passive',stacking:'replace'}] },

    { id:'shp_expedition_09', name:'Чугунный походный котелок', icon:'🍲', image:'images/shop/iron-camp-cooking-pot.png', expeditionGroup:'cooking-fire', rarity:'common', price:{pl:0,zl:6,sr:0,md:0}, effect:'Горячая еда на четверых', desc:'Небольшой котёл с крышкой и дужкой. В нём варят похлёбку, кипятят воду и хранят сухую крупу.', effects:[{id:'camp-pot-meal',type:'support',trigger:'make-camp',operation:'prepare-hot-meal',value:2,actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_10', name:'Складная походная печь', icon:'🔥', image:'images/shop/folding-camp-stove.png', expeditionGroup:'cooking-fire', rarity:'uncommon', price:{pl:0,zl:9,sr:0,md:0}, effect:'Позволяет готовить на ветру и скрывает пламя', desc:'Железный короб со складными ножками и заслонкой. Требует мало топлива и не разбрасывает искры.', effects:[{id:'folding-stove',type:'world',trigger:'cook-or-boil',operation:'ignore-penalty',value:1,condition:'ordinary-wind-or-light-rain',actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_11', name:'Жестяной набор посуды', icon:'🥣', image:'images/shop/tin-mess-kit.png', expeditionGroup:'cooking-fire', rarity:'common', price:{pl:0,zl:2,sr:0,md:0}, effect:'Личная посуда складывается в один котелок', desc:'Кружка, миска, ложка и маленький котелок. Ничего героического, зато еда не оказывается на земле.', effects:[{id:'mess-kit-meal',type:'world',trigger:'prepare-rations',operation:'prepare-hot-meal',value:2,actionCost:'long',frequency:'scene',stacking:'replace'}] },
    { id:'shp_expedition_12', name:'Штормовая огнивица', icon:'🧰', image:'images/shop/stormproof-tinderbox.png', expeditionGroup:'cooking-fire', rarity:'uncommon', price:{pl:0,zl:4,sr:0,md:0}, effect:'Разжигает сухое топливо даже под дождём', desc:'Кремень, кресало и герметичная коробочка с трутом. Не создаёт огонь без топлива, но бережёт последнюю искру.', effects:[{id:'storm-tinder',type:'world',trigger:'light-fire',operation:'light-fire-in-rain',value:8,condition:'dry-fuel-available',actionCost:'long',frequency:'scene',stacking:'highest'}] },

    { id:'shp_expedition_13', name:'Фонарь с заслонками', icon:'🏮', image:'images/shop/shuttered-camp-lantern.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:6,sr:0,md:0}, effect:'Свет 4 клетки · заслонки сужают его до 1 клетки', desc:'Латунный фонарь с тремя подвижными створками. Свет можно направить на карту или почти полностью скрыть.', effects:[{id:'shuttered-light',type:'scouting',trigger:'light-lantern',operation:'apply-light',value:4,frequency:'passive',stacking:'replace'}] },
    { id:'shp_expedition_14', name:'Пеньковая верёвка, 15 метров', icon:'🪢', image:'images/shop/hemp-rope-coil.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:4,sr:0,md:0}, effect:'Преимущество при страховке, связывании и подъёме · первый провал страховки оставляет висеть вместо падения', desc:'Толстая смолёная верёвка без красивого плетения. Держит человека, тент и умеренный груз.', effects:[{id:'hemp-rope-work',type:'world',trigger:'climb-bind-or-haul',operation:'grant-advantage',value:1,condition:'rope-can-be-secured',frequency:'passive',stacking:'highest'},{id:'hemp-rope-catch',type:'defense',trigger:'first-failed-secured-climb',operation:'convert-fall-to-hanging',value:1,condition:'rope-properly-anchored',frequency:'scene',stacking:'replace'}] },
    { id:'shp_expedition_15', name:'Складная полевая лопата', icon:'⛏️', image:'images/shop/folding-field-shovel.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, effect:'Вдвое быстрее устраивает кострище, канаву или малое укрытие · обычная работа без проверки', desc:'Короткая железная лопата с шарнирной рукоятью. Ею окапывают палатку, тушат угли и освобождают колесо.', effects:[{id:'field-shovel-work',type:'world',trigger:'dig-campworks',operation:'halve-work-time',value:2,condition:'workable-ground-and-ordinary-task',frequency:'passive',stacking:'highest'}] },
    { id:'shp_expedition_16', name:'Малый лагерный топор', icon:'🪓', image:'images/shop/compact-camp-hatchet.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, effect:'Обычные дрова без проверки · преимущество на лёгкую плотницкую работу', desc:'Компактный топорик с кожаным чехлом. Хорош для сучьев, кольев и щепы, но не рассчитан на бой.', effects:[{id:'camp-hatchet-firewood',type:'world',trigger:'gather-ordinary-firewood',operation:'automatic-success',value:1,condition:'usable-wood-present',frequency:'scene',stacking:'replace'},{id:'camp-hatchet-work',type:'world',trigger:'light-carpentry',operation:'grant-advantage',value:1,condition:'camp-scale-task',frequency:'passive',stacking:'highest'}] },

    { id:'shp_expedition_17', name:'Дорожный ремонтный свёрток', icon:'🧵', image:'images/shop/travel-repair-roll.png', expeditionGroup:'travel-support', rarity:'common', price:{pl:0,zl:7,sr:0,md:0}, charges:5, effect:'Пять мелких ремонтов одежды, палатки или ремней', desc:'Иглы, дратва, заплаты, пряжки и шило в плотном свёртке. Не чинит металл и сломанное оружие.', effects:[{id:'repair-roll',type:'support',trigger:'repair-gear',operation:'check-bonus',value:3,condition:'cloth-leather-or-strap',actionCost:'long',frequency:'scene',stacking:'highest'}] },
    { id:'shp_expedition_18', name:'Вощёный тубус картографа', icon:'🗺️', image:'images/shop/weatherproof-map-case.png', expeditionGroup:'travel-support', rarity:'common', price:{pl:0,zl:6,sr:0,md:0}, effect:'Карты и бумаги не промокают в обычной непогоде', desc:'Жёсткий кожаный тубус с вощёными швами и деревянной крышкой. Вмещает карты, письма и дорожный журнал.', effects:[{id:'map-case',type:'world',trigger:'carry-documents',operation:'ignore-penalty',value:1,condition:'ordinary-rain-or-splash',frequency:'passive',stacking:'highest'}] },
    { id:'shp_expedition_19', name:'Деревянная рама грузчика', icon:'🎒', image:'images/shop/wooden-pack-frame.png', expeditionGroup:'travel-support', rarity:'uncommon', price:{pl:0,zl:9,sr:0,md:0}, effect:'+15 кг переносимого походного груза', desc:'Лёгкая деревянная рама с широкими ремнями и точками крепления. Распределяет поклажу, но остаётся громоздкой.', effects:[{id:'pack-frame',type:'world',trigger:'carry-travel-gear',operation:'carry-capacity',value:15,frequency:'passive',stacking:'highest'}] },
    { id:'shp_expedition_20', name:'Дымные спирали от мошкары', icon:'🌀', image:'images/shop/insect-smoke-coils.png', expeditionGroup:'travel-support', rarity:'common', price:{pl:0,zl:3,sr:0,md:0}, charges:3, effect:'Три ночи защищают небольшой лагерь от обычных насекомых', desc:'Прессованные травы медленно тлеют на глиняной подставке. Дым резкий, зато мошкара держится подальше.', effects:[{id:'insect-coils',type:'world',trigger:'make-camp',operation:'repel-insects',value:3,condition:'ordinary-insects',actionCost:'long',frequency:'scene',stacking:'highest'}] }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    item.cat = 'tool';
    item.category = 'tool';
    item.slot = 'utility';
    item.handsRequired = 0;
    item.tags = ['expedition','camp',item.expeditionGroup];
    item.powerTier = 1;
    item.recommendedLevel = {min:1,max:5};
    item.access = {markets:['local-open','city'],legality:'open'};
    return item;
  });

  // Одноразовые свитки не копируют механику заклинаний: spellRefId ведёт к
  // существующему фолианту каталога. После чтения свиток исчезает, а само
  // заклинание не считается выученным.
  var SPELL_SCROLL_ITEMS = [
    { id:'shp_scroll_01', name:'Свиток «Жар Пальцев»', icon:'📜', image:'images/shop/scroll-finger-heat.png', spellRefId:1773673009471, spellName:'Жар Пальцев', spellLevel:1, school:'Стихии Этериона', rarity:'common', price:{pl:0,zl:8,sr:0,md:0}, effect:'Разовое чтение · 1d6 огнём в пределах 1 клетки или поджечь обычный источник топлива', desc:'Края пергамента тёплые и слегка обуглены. Хранит одно применение одноимённого заклинания из каталога.' },
    { id:'shp_scroll_02', name:'Свиток «Касание Спасения»', icon:'📜', image:'images/shop/scroll-saving-touch.png', spellRefId:1774556074255, spellName:'Касание Спасения', spellLevel:1, school:'Язык Света', rarity:'common', price:{pl:1,zl:2,sr:0,md:0}, effect:'Разовое чтение · прикосновение восстанавливает союзнику 2d4 HP', desc:'Светлый свиток с печатью раскрытой ладони. Не действует на нежить и мёртвых.' },
    { id:'shp_scroll_03', name:'Свиток «Светоч Памяти»', icon:'📜', image:'images/shop/scroll-memory-beacon.png', spellRefId:1774697449889, spellName:'Светоч Памяти', spellLevel:1, school:'Язык Света', rarity:'uncommon', price:{pl:1,zl:4,sr:0,md:0}, effect:'Разовое чтение · свет на 20 минут, +1 к Восприятию союзникам рядом и одна попытка ослепления', desc:'Тёплая янтарная застёжка удерживает свет внутри пергамента до момента чтения.' },

    { id:'shp_scroll_04', name:'Свиток «Огненный снаряд»', icon:'📜', image:'images/shop/scroll-fire-projectile.png', spellRefId:1773704473098, spellName:'Огненный снаряд', spellLevel:2, school:'Стихии Этериона', rarity:'uncommon', price:{pl:2,zl:8,sr:0,md:0}, effect:'Разовое чтение · взрыв 3d6 огнём в радиусе 2 клеток, Ловкость Сл 13 — половина', desc:'Плотный свиток в медно-красной обвязке. Опасен в тесном помещении и воспламеняет сухие предметы.' },
    { id:'shp_scroll_05', name:'Свиток «Невидимость»', icon:'📜', image:'images/shop/scroll-invisibility.png', spellRefId:1774566290057, spellName:'Невидимость', spellLevel:2, school:'Маска Лжи', rarity:'uncommon', price:{pl:3,zl:2,sr:0,md:0}, effect:'Разовое чтение · цель невидима до конца следующего раунда, действия или получения урона', desc:'Серый пергамент будто теряет края в дымке. Сохраняет каталожное ограничение: не применяется в бою.' },
    { id:'shp_scroll_06', name:'Свиток «Починка»', icon:'📜', image:'images/shop/scroll-mending.png', spellRefId:1775565731791, spellName:'Починка', spellLevel:2, school:'Дыхание Пространства', rarity:'uncommon', price:{pl:2,zl:0,sr:0,md:0}, effect:'Разовое чтение · чинит немагическую поломку размером до 20 см', desc:'Пергамент демонстративно сшит металлической нитью. Не восстанавливает чары, живую плоть или магическое ядро.' },

    { id:'shp_scroll_07', name:'Свиток «Защита от Энергии»', icon:'📜', image:'images/shop/scroll-energy-protection.png', spellRefId:1774554691599, spellName:'Защита от Энергии', spellLevel:3, school:'Школа войны Дельйвана Кель-Эстеро', rarity:'rare', price:{pl:6,zl:0,sr:0,md:0}, effect:'Разовое чтение · сопротивление выбранной энергии на 5 раундов с концентрацией', desc:'Шесть минеральных вставок соответствуют огню, холоду, молнии, кислоте, яду и звуку.' },
    { id:'shp_scroll_08', name:'Свиток «Снятие Проклятья»', icon:'📜', image:'images/shop/scroll-remove-curse.png', spellRefId:1774558153786, spellName:'Снятие Проклятья', spellLevel:3, school:'Манипуляции Обгорелоликой', rarity:'rare', price:{pl:7,zl:5,sr:0,md:0}, effect:'Разовое чтение · снимает одно малое или среднее проклятие с существа либо предмета', desc:'Белый шнур проходит через расколотую чёрную печать. Не действует на древние, сложные и уникальные проклятия.' },
    { id:'shp_scroll_09', name:'Свиток «Магическое Послание»', icon:'📜', image:'images/shop/scroll-magical-message.png', spellRefId:1775559073733, spellName:'Магическое Послание', spellLevel:3, school:'Теории Эфира', rarity:'rare', price:{pl:5,zl:5,sr:0,md:0}, effect:'Разовое чтение · послание до 25 слов известному существу и один ответ', desc:'Синеватый свиток с печатью пера. Дальность не ограничена одним регионом, но связь не проходит между измерениями.' },

    { id:'shp_scroll_10', name:'Свиток «Разряд Источника»', icon:'📜', image:'images/shop/scroll-source-discharge.png', spellRefId:1773817318754, spellName:'Разряд Источника', spellLevel:4, school:'Стихии Этериона', rarity:'rare', price:{pl:14,zl:0,sr:0,md:0}, effect:'Разовое чтение · до двух целей получают 4d6 электрического и 1d6 случайного урона при попадании', desc:'Медная проволока отводит разряды от хрупкого края свитка. Точное применение следует записи каталога.' },
    { id:'shp_scroll_11', name:'Свиток «Печать Терпения»', icon:'📜', image:'images/shop/scroll-patience-seal.png', spellRefId:1774559839673, spellName:'Печать Терпения', spellLevel:4, school:'Язык Света', rarity:'rare', price:{pl:16,zl:0,sr:0,md:0}, effect:'Разовое чтение · приостанавливает два малых или один серьёзный негативный эффект на 24 часа', desc:'Тяжёлый пергамент с печатью свечи и песочных часов. Эффект не исчезает и вернётся, если его не снять.' },
    { id:'shp_scroll_12', name:'Свиток «Оживление Оружия»', icon:'📜', image:'images/shop/scroll-animate-weapon.png', spellRefId:1775561773885, spellName:'Оживление Оружия', spellLevel:4, school:'Школа войны Дельйвана Кель-Эстеро', rarity:'rare', price:{pl:15,zl:0,sr:0,md:0}, effect:'Разовое чтение · оживляет подходящее немагическое оружие на 5 раундов', desc:'Железная печать с клинком замыкает импульс движения. Оружие действует после читателя и требует концентрации.' },

    { id:'shp_scroll_13', name:'Свиток «И светит солнце»', icon:'📜', image:'images/shop/scroll-sun-shines.png', imageThumb:'images/shop/thumbs/scroll-sun-shines.jpg', spellRefId:1779342217270, spellName:'И светит солнце', spellLevel:5, school:'Стихии Этериона', rarity:'legendary', price:{pl:45,zl:0,sr:0,md:0}, effect:'Разовое чтение · белое пламя поражает зону радиусом 4 клетки и оставляет её раскалённой на 2 раунда', desc:'Пергамент заключён в широкий воротник из почерневшего белого металла и слюды. Свиток не различает союзников и врагов, а читатель принимает перегрев исходного фолианта.', access:{markets:['licensed','story'],legality:'restricted'}, baseRegion:'upperland', marketIds:['ztuz-licensed-counter','dorogograd-golden-measure'] },
    { id:'shp_scroll_14', name:'Свиток «Копьё Небесного Прорыва»', icon:'📜', image:'images/shop/scroll-heaven-piercing-spear.png', imageThumb:'images/shop/thumbs/scroll-heaven-piercing-spear.jpg', spellRefId:1780007598402, spellName:'Копьё Небесного Прорыва', spellLevel:5, school:'Школа войны Дельйвана Кель-Эстеро', rarity:'legendary', price:{pl:60,zl:0,sr:0,md:0}, effect:'Разовое чтение · молния прошивает линию в 18 клеток, а провалившие защиту теряют реакции', desc:'Узкий боевой свиток прошит серебром вокруг чёрного железного стержня. Линия не различает своих и чужих и не проходит через толстый камень или сильный магический барьер.', access:{markets:['licensed','story'],legality:'restricted'}, baseRegion:'upperland', marketIds:['kazad-drom-thundering-mountain','ztuz-licensed-counter'] },
    { id:'shp_scroll_15', name:'Свиток «Ледяная Буря»', icon:'📜', image:'images/shop/scroll-ice-storm.png', imageThumb:'images/shop/thumbs/scroll-ice-storm.jpg', spellRefId:1780007869920, spellName:'Ледяная Буря', spellLevel:5, school:'Стихии Этериона', rarity:'legendary', price:{pl:80,zl:0,sr:0,md:0}, effect:'Разовое чтение · создаёт на 4 раунда бурю радиусом 5 клеток с уроном, тяжёлой местностью и почти нулевой видимостью', desc:'Широкие листы белой кожи стянуты ледяным замком и костяными валиками. Буря мешает и читателю, плохо раскрывается в тесном помещении и гасит обычный огонь.', access:{markets:['licensed','secret','story'],legality:'restricted'}, baseRegion:'levoshlak', marketIds:['levoshlak-tower-vault','glupishche-hypnoks-eye'] }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    item.cat = 'magic';
    item.category = 'consumable';
    item.slot = 'consumable';
    item.handsRequired = 0;
    item.charges = 1;
    item.powerTier = item.spellLevel;
    item.recommendedLevel = {min:item.spellLevel,max:Math.min(10,item.spellLevel + 4)};
    item.access = item.access || {
      markets:item.spellLevel === 1 ? ['city','guild'] : item.spellLevel === 2 ? ['guild'] : item.spellLevel === 3 ? ['guild','licensed'] : ['licensed'],
      legality:'open'
    };
    item.tags = ['consumable','scroll','magic','folio','spell-level-' + item.spellLevel];
    item.consumption = {mode:'consume-on-cast',teachesSpell:false,preserveCatalogRestrictions:true};
    item.effects = [{id:'cast-spell-' + item.spellRefId,type:'support',trigger:'read-scroll',operation:'cast-catalog-spell',spellRefId:item.spellRefId,spellLevel:item.spellLevel,frequency:'charge',charges:1,stacking:'replace'}];
    return item;
  });

  // Малые арканные инструменты дают один понятный трюк и исчезают после
  // применения. Это не свитки: они не требуют знания заклинания и не ссылаются
  // на фолиант каталога.
  var MAGICAL_CONSUMABLE_ITEMS = [
    { id:'shp_magiccons_01', name:'Кристалл отложенного шага', icon:'💎', image:'images/shop/delayed-step-crystal.png', rarity:'uncommon', price:{pl:2,zl:2,sr:0,md:0}, effect:'Реакция после промаха по тебе · сместись на 1 клетку', desc:'Трещина внутри кристалла повторяет движение владельца с коротким запозданием. Не провоцирует ответный удар.', powerTier:2, recommendedLevel:{min:2,max:5}, effects:[{id:'delayed-step',type:'tempo',trigger:'enemy-misses-you',operation:'reaction-step',value:1,actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_02', name:'Стеклянный глаз дозора', icon:'👁️', image:'images/shop/watcher-glass-eye.png', rarity:'common', price:{pl:1,zl:2,sr:0,md:0}, effect:'Сторожит проход до следующего отдыха и звенит при пересечении', desc:'Положенный на поверхность глаз запоминает узкий проход шириной в клетку. Не распознаёт личность и не видит сквозь стены.', powerTier:1, recommendedLevel:{min:1,max:4}, effects:[{id:'watcher-eye',type:'scouting',trigger:'place-across-passage',operation:'alarm-ward',value:1,actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_03', name:'Зерно левитации', icon:'🌰', image:'images/shop/levitation-seed.png', rarity:'uncommon', price:{pl:2,zl:5,sr:0,md:0}, effect:'Короткое действие · поднимает согласную цель на 1 клетку на 2 раунда', desc:'После надлома семя выпускает невидимый воздушный корень. Цель может опуститься раньше по своему желанию.', powerTier:2, recommendedLevel:{min:2,max:5}, effects:[{id:'levitation-seed',type:'tempo',trigger:'break-near-willing-target',operation:'levitate-willing',value:1,durationRounds:2,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_04', name:'Пепел истинного контура', icon:'🫙', image:'images/shop/true-contour-ash.png', rarity:'uncommon', price:{pl:2,zl:0,sr:0,md:0}, effect:'Короткое действие · на 1 раунд проявляет скрытые силуэты в зоне 2×2', desc:'Серебристый пепел липнет к невидимым телам и краям простых иллюзий. Не раскрывает истинную природу существа.', powerTier:2, recommendedLevel:{min:2,max:5}, effects:[{id:'true-contour-ash',type:'scouting',trigger:'throw-ash',operation:'reveal-invisibility-zone',areaCells:'2x2',durationRounds:1,actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}] },
    { id:'shp_magiccons_05', name:'Свеча малого заслона', icon:'🕯️', image:'images/shop/minor-ward-candle.png', rarity:'uncommon', price:{pl:2,zl:8,sr:0,md:0}, effect:'Длинное действие · союзники в зоне 2×2 получают +1 к спасброскам от чар на 3 раунда', desc:'Неподвижное пламя очерчивает слабый защитный круг. Если свечу сдвинуть или погасить, заслон исчезает.', powerTier:2, recommendedLevel:{min:2,max:5}, effects:[{id:'minor-ward-candle',type:'defense',trigger:'light-and-place',operation:'stationary-spell-ward',value:1,areaCells:'2x2',durationRounds:3,actionCost:'long',frequency:'charge',charges:1,stacking:'highest'}] },
    { id:'shp_magiccons_06', name:'Монета второго голоса', icon:'🪙', image:'images/shop/second-voice-coin.png', rarity:'common', price:{pl:1,zl:0,sr:0,md:0}, effect:'Запоминает одну короткую фразу и повторяет её после щелчка', desc:'Две половины медной монеты говорят голосом того, кто последним прошептал в насечку. Полезна для отвлечения и простых сигналов.', powerTier:1, recommendedLevel:{min:1,max:4}, effects:[{id:'second-voice',type:'world',trigger:'snap-coin',operation:'create-sound',value:1,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_07', name:'Капля медленного падения', icon:'💧', image:'images/shop/slow-fall-drop.png', rarity:'uncommon', price:{pl:1,zl:8,sr:0,md:0}, effect:'Реакция при падении · снизь урон на 2d6 и приземлись на ноги', desc:'Жемчужная капля лопается в воздухе и на миг делает одежду широкой, как парус. Не меняет горизонтальное движение.', powerTier:2, recommendedLevel:{min:2,max:5}, effects:[{id:'slow-fall-drop',type:'defense',trigger:'start-falling',operation:'reduce-damage-dice',dice:'2d6',actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_08', name:'Флакон эфирного клея', icon:'🧪', image:'images/shop/ether-glue-vial.png', rarity:'uncommon', price:{pl:3,zl:5,sr:0,md:0}, effect:'Временно возвращает сломанному фокусу работу на одну сцену', desc:'Вязкая синяя смесь соединяет треснувший жезл, талисман или рунную пластину. Не восстанавливает заряды и не чинит уничтоженное ядро.', powerTier:2, recommendedLevel:{min:2,max:6}, effects:[{id:'ether-glue',type:'support',trigger:'repair-broken-focus',operation:'temporary-repair-focus',value:1,actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_09', name:'Бумажная моль-разведчик', icon:'🦋', image:'images/shop/paper-scout-moth.png', rarity:'uncommon', price:{pl:3,zl:0,sr:0,md:0}, effect:'Летит до 6 клеток и передаёт один короткий взгляд за угол', desc:'Сложенная из рунной бумаги моль слушается одного направления. Любое попадание или конец сцены превращает её в обычный клочок.', powerTier:2, recommendedLevel:{min:2,max:6}, effects:[{id:'paper-scout-moth',type:'scouting',trigger:'release-moth',operation:'remote-view',value:6,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}] },
    { id:'shp_magiccons_10', name:'Губка поглощения чар', icon:'🧽', image:'images/shop/spell-siphon-sponge.png', rarity:'rare', price:{pl:5,zl:5,sr:0,md:0}, effect:'Реакция · снизь получаемый магический или энергетический урон на 2d6', desc:'Пористый чёрный минерал вспыхивает цветом поглощённой энергии и рассыпается. Не действует на обычное оружие.', powerTier:3, recommendedLevel:{min:3,max:7}, effects:[{id:'spell-siphon',type:'defense',trigger:'receive-magical-or-energy-damage',operation:'reduce-damage-dice',dice:'2d6',actionCost:'reaction',frequency:'charge',charges:1,stacking:'replace'}] }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    item.cat = 'magic';
    item.category = 'consumable';
    item.slot = 'consumable';
    item.handsRequired = 0;
    item.charges = 1;
    item.tags = ['consumable','magic','arcane-tool'];
    item.access = {markets:item.powerTier >= 3 ? ['guild','licensed'] : ['city','guild'],legality:'open'};
    item.consumption = {mode:'consume-on-use',teachesSpell:false};
    return item;
  });

  var CRAFTING_POTION_NAMES = {
    shp_potion_01:'Малое зелье лечения',
    shp_potion_02:'Зелье лечения',
    shp_potion_03:'Большое зелье лечения',
    shp_potion_04:'Зелье медленного восстановления',
    shp_potion_05:'Зелье ясной крови',
    shp_potion_06:'Зелье спокойного сердца',
    shp_potion_07:'Зелье кошачьего шага',
    shp_potion_08:'Зелье каменной кожи',
    shp_potion_09:'Зелье ночного зрения',
    shp_potion_10:'Зелье жабр',
    shp_potion_11:'Зелье лёгкой руки',
    shp_potion_12:'Зелье громового голоса',
    shp_potion_13:'Зелье искрового сопротивления',
    shp_potion_14:'Зелье памяти пути',
    shp_potion_15:'Зелье прозрачного слуха',
    shp_potion_16:'Зелье исчезающего контура'
  };

  // Компонент сам по себе не даёт герою боевой бонус. Его affinity и uses
  // служат входом будущей рецептуре, а consumedByRecipe запрещает трактовать
  // материал как экипируемый предмет.
  var CRAFTING_COMPONENT_ITEMS = [
    { id:'shp_craft_01', name:'Узел огнестекла', icon:'🔥', image:'images/shop/emberglass-node.png', rarity:'common', price:{pl:0,zl:6,sr:0,md:0}, desc:'Тёплый осколок вулканического стекла с неподвижной искрой внутри.', crafting:{grade:1,sourceType:'mineral',affinities:['fire','light'],uses:['weapon-coating','heat-focus'],potionRefs:['shp_potion_12','shp_potion_13'],consumedByRecipe:true,unit:'node'} },
    { id:'shp_craft_02', name:'Гроздь лунной соли', icon:'🧂', image:'images/shop/moon-salt-cluster.png', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, desc:'Бледные кристаллы растут только на камне, который всю ночь видел луну.', crafting:{grade:1,sourceType:'mineral',affinities:['ward','cold','purification'],uses:['ritual-seal','purifying-powder'],potionRefs:['shp_potion_05','shp_potion_10'],consumedByRecipe:true,unit:'cluster'} },
    { id:'shp_craft_03', name:'Катушка эфирного шёлка', icon:'🧵', image:'images/shop/ether-silk-spool.png', rarity:'uncommon', price:{pl:1,zl:4,sr:0,md:0}, desc:'Нить почти невесома, но удерживает слабые чары лучше обычной проволоки.', crafting:{grade:2,sourceType:'arcane',affinities:['movement','illusion','binding'],uses:['scroll-binding','charm-thread'],potionRefs:['shp_potion_07','shp_potion_11'],consumedByRecipe:true,unit:'spool'} },
    { id:'shp_craft_04', name:'Сброшенная чешуя василиска', icon:'🐍', image:'images/shop/basilisk-shed-scale.png', rarity:'uncommon', price:{pl:1,zl:8,sr:0,md:0}, desc:'Тяжёлая зелёная пластина уже не обращает в камень, но хранит след оцепенения.', crafting:{grade:2,sourceType:'creature',affinities:['defense','petrification','venom'],uses:['armor-inlay','antidote-base'],potionRefs:['shp_potion_08','shp_potion_05'],consumedByRecipe:true,unit:'scale'} },
    { id:'shp_craft_05', name:'Щепа сердца сухостоя', icon:'🪵', image:'images/shop/deadwood-heart-shard.png', rarity:'uncommon', price:{pl:1,zl:6,sr:0,md:0}, desc:'Чёрная древесина из самой сердцевины дерева, погибшего стоя.', crafting:{grade:2,sourceType:'plant',affinities:['decay','roots','spirit'],uses:['wand-core','grave-ward'],potionRefs:['shp_potion_04','shp_potion_06'],consumedByRecipe:true,unit:'shard'} },
    { id:'shp_craft_06', name:'Нить грозовой меди', icon:'⚡', image:'images/shop/storm-copper-filament.png', rarity:'common', price:{pl:0,zl:8,sr:0,md:0}, desc:'Тонкая медь тихо потрескивает рядом с заряженными рунами.', crafting:{grade:1,sourceType:'mineral',affinities:['lightning','conduction'],uses:['runic-circuit','focus-repair'],potionRefs:['shp_potion_13','shp_potion_12','shp_potion_15'],consumedByRecipe:true,unit:'coil'} },
    { id:'shp_craft_07', name:'Флакон зеркального песка', icon:'⌛', image:'images/shop/mirror-sand-vial.png', rarity:'common', price:{pl:0,zl:7,sr:0,md:0}, desc:'Каждая песчинка отражает предмет под немного иным углом.', crafting:{grade:1,sourceType:'mineral',affinities:['illusion','divination','reflection'],uses:['scrying-lens','revealing-powder'],potionRefs:['shp_potion_09','shp_potion_14','shp_potion_16'],consumedByRecipe:true,unit:'vial'} },
    { id:'shp_craft_08', name:'Комок смолы сновидений', icon:'🌙', image:'images/shop/dream-resin-lump.png', rarity:'uncommon', price:{pl:1,zl:5,sr:0,md:0}, desc:'Лиловая смола пахнет дождём и чужим, почти забытым детством.', crafting:{grade:2,sourceType:'plant',affinities:['sleep','memory','illusion'],uses:['dream-incense','memory-focus'],potionRefs:['shp_potion_06','shp_potion_14','shp_potion_15'],consumedByRecipe:true,unit:'lump'} },
    { id:'shp_craft_09', name:'Опилки могильного серебра', icon:'⚰️', image:'images/shop/grave-silver-filings.png', rarity:'uncommon', price:{pl:2,zl:0,sr:0,md:0}, desc:'Тусклое серебро снимают с погребальных оберегов, утративших имя хозяина.', crafting:{grade:2,sourceType:'grave',affinities:['undead','ward','spirit'],uses:['weapon-inlay','spirit-seal'],potionRefs:['shp_potion_01','shp_potion_02','shp_potion_03'],consumedByRecipe:true,unit:'packet'} },
    { id:'shp_craft_10', name:'Живая рунная глина', icon:'🟤', image:'images/shop/living-rune-clay.png', rarity:'uncommon', price:{pl:1,zl:2,sr:0,md:0}, desc:'Глина медленно затягивает вмятины и удерживает выдавленный знак.', crafting:{grade:2,sourceType:'earth',affinities:['construct','repair','ward'],uses:['rune-tablet','construct-patch'],potionRefs:['shp_potion_03','shp_potion_08','shp_potion_11'],consumedByRecipe:true,unit:'lump'} }
  ].map(function (item) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 2;
    item.imgSize = 'square';
    item.cat = 'material';
    item.category = 'material';
    item.slot = '';
    item.handsRequired = 0;
    item.powerTier = 0;
    item.recommendedLevel = {min:item.crafting.grade,max:Math.min(6,item.crafting.grade + 4)};
    item.access = {markets:item.crafting.grade >= 2 ? ['guild','licensed'] : ['city','guild'],legality:'open'};
    item.tags = ['material','crafting','grade-' + item.crafting.grade].concat(item.crafting.affinities);
    item.effect = 'Компонент ' + item.crafting.grade + ' качества · Для зелий: ' + item.crafting.potionRefs.map(function (id) { return CRAFTING_POTION_NAMES[id]; }).filter(Boolean).join(', ');
    item.effects = [{id:'crafting-' + item.id,type:'world',trigger:'use-in-recipe',operation:'crafting-component',value:item.crafting.grade,frequency:'passive',stacking:'replace'}];
    return item;
  });

  function finishBatchItem(item, defaults) {
    item.schemaVersion = SCHEMA_VERSION;
    item.definitionVersion = 1;
    item.imgSize = 'square';
    item.cat = item.cat || defaults.cat;
    item.category = item.category || defaults.category;
    item.slot = item.slot == null ? defaults.slot : item.slot;
    item.handsRequired = Number(item.handsRequired) || 0;
    item.tags = (defaults.tags || []).concat(item.tags || []);
    item.recommendedLevel = item.recommendedLevel || {min:Math.max(1,item.powerTier || 1),max:Math.min(10,(item.powerTier || 1) + 4)};
    item.access = item.access || clone(defaults.access);
    if (!item.image && item.plannedImage) item.image = '';
    return item;
  }

  var ALCOHOL_ITEMS = [
    {id:'shp_alcohol_01',name:'Ячменное малое пиво',icon:'🍺',image:'images/shop/barley-small-beer.png',strength:1,servings:2,rarity:'common',price:{pl:0,zl:0,sr:0,md:3},effect:'Снимает дорожную сухость · почти не опьяняет',desc:'Слабое столовое пиво, которое в трактирах пьют вместо сомнительной воды.',effects:[{id:'small-beer-rest',type:'world',trigger:'drink-with-meal',operation:'ignore-penalty',value:1,condition:'ordinary-thirst-or-dry-rations',frequency:'scene',stacking:'replace'}]},
    {id:'shp_alcohol_02',name:'Копчёный тёмный эль',icon:'🍻',image:'images/shop/smoked-dark-ale.png',strength:2,servings:2,rarity:'common',price:{pl:0,zl:0,sr:1,md:0},effect:'+1 к общению с завсегдатаями · −1 к тонкой моторике до отдыха',desc:'Густой горький эль из солода, высушенного над торфяным дымом.',effects:[{id:'smoked-ale-company',type:'world',trigger:'share-drink-in-tavern',operation:'check-bonus',value:1,condition:'talking-to-drinkers',frequency:'scene',stacking:'highest'},{id:'smoked-ale-hands',type:'risk',trigger:'finish-serving',operation:'check-penalty',value:1,condition:'fine-motor-task',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_03',name:'Сидр старого сада',icon:'🍎',image:'images/shop/orchard-apple-cider.png',strength:1,servings:3,rarity:'common',price:{pl:0,zl:0,sr:1,md:5},effect:'Лёгкий праздничный напиток · +1 к первой дружеской беседе за столом',desc:'Мутный сухой сидр из мелких островных яблок.',effects:[{id:'orchard-toast',type:'world',trigger:'make-friendly-toast',operation:'check-bonus',value:1,condition:'non-hostile-company',frequency:'scene',stacking:'replace'}]},
    {id:'shp_alcohol_04',name:'Вересковая медовуха',icon:'🍯',image:'images/shop/heather-mead.png',strength:2,servings:3,rarity:'uncommon',price:{pl:0,zl:0,sr:4,md:0},effect:'+1 против обычного холода на час · после второй порции −1 Восприятие',desc:'Тёплая медовуха с терпким запахом вереска и дыма.',effects:[{id:'heather-warmth',type:'defense',trigger:'drink-serving',operation:'check-bonus',value:1,condition:'ordinary-cold',frequency:'scene',stacking:'highest'},{id:'mead-dull-senses',type:'risk',trigger:'drink-second-serving',operation:'check-penalty',value:1,condition:'perception-check',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_05',name:'Красное Морелесья',icon:'🍷',image:'images/shop/moreles-red-wine.png',strength:2,servings:4,rarity:'common',price:{pl:0,zl:0,sr:6,md:0},effect:'+1 к этикету на официальном застолье',desc:'Сухое красное вино с солоноватым послевкусием побережья.',effects:[{id:'moreles-etiquette',type:'world',trigger:'formal-meal',operation:'check-bonus',value:1,condition:'wine-customs-apply',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_06',name:'Белое Верхземья',icon:'🥂',image:'images/shop/upperland-white-wine.png',strength:2,servings:4,rarity:'common',price:{pl:0,zl:0,sr:7,md:0},effect:'+1 к распознаванию дворянских манер за столом',desc:'Светлое сухое вино из прохладных садов Верхземья.',effects:[{id:'upperland-table-read',type:'scouting',trigger:'observe-formal-table',operation:'check-bonus',value:1,condition:'nobility-or-merchant-customs',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_07',name:'Пряное сливовое вино',icon:'🫐',image:'images/shop/spiced-plum-wine.png',strength:2,servings:3,rarity:'uncommon',price:{pl:0,zl:1,sr:0,md:0},effect:'Скрывает вкус обычного лекарства · −1 к распознаванию примесей',desc:'Сладкое густое вино с пряностями, подаваемое маленькими чашками.',effects:[{id:'plum-mask-medicine',type:'support',trigger:'mix-ordinary-medicine',operation:'mask-bitter-taste',value:1,frequency:'scene',stacking:'replace'},{id:'plum-mask-additives',type:'risk',trigger:'inspect-mixed-drink',operation:'check-penalty',value:1,condition:'detect-additives',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_08',name:'Солёный береговой ром',icon:'🏴‍☠️',image:'images/shop/salt-coast-rum.png',strength:4,servings:4,rarity:'uncommon',price:{pl:0,zl:2,sr:0,md:0},effect:'+1 к перенесению боли на сцену · −1 Ловкость',desc:'Тёмный крепкий дистиллят, которым моряки отмечают возвращение в порт.',effects:[{id:'salt-rum-grit',type:'defense',trigger:'drink-serving',operation:'check-bonus',value:1,condition:'resist-pain',frequency:'scene',stacking:'highest'},{id:'salt-rum-balance',type:'risk',trigger:'drink-serving',operation:'check-penalty',value:1,condition:'dexterity-check',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_09',name:'Хлебный огонь артели',icon:'🥃',image:'images/shop/guild-grain-spirit.png',strength:5,servings:5,rarity:'common',price:{pl:0,zl:1,sr:2,md:0},effect:'Крепкий товар и средство для растирки · быстро опьяняет',desc:'Резкий зерновой спирт в толстой бутылке с пробкой на шнуре.',effects:[{id:'grain-spirit-clean',type:'support',trigger:'clean-tool-or-skin',operation:'prepare-clean-surface',value:1,frequency:'scene',stacking:'replace'},{id:'grain-spirit-drunk',type:'risk',trigger:'drink-serving',operation:'check-penalty',value:2,condition:'coordination-check',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_10',name:'Можжевеловая горечь',icon:'🌿',image:'images/shop/juniper-bitter-spirit.png',strength:4,servings:4,rarity:'uncommon',price:{pl:0,zl:2,sr:5,md:0},effect:'+1 к первой проверке против тошноты · −1 Харизма из-за запаха',desc:'Сухой травяной дистиллят с сильным запахом можжевельника.',effects:[{id:'juniper-stomach',type:'defense',trigger:'drink-small-serving',operation:'check-bonus',value:1,condition:'ordinary-nausea',frequency:'scene',stacking:'highest'},{id:'juniper-breath',type:'risk',trigger:'drink-serving',operation:'check-penalty',value:1,condition:'close-social-contact',frequency:'scene',stacking:'highest'}]},
    {id:'shp_alcohol_11',name:'Перцовая настойка рудокопа',icon:'🌶️',image:'images/shop/miner-pepper-tincture.png',strength:4,servings:3,rarity:'uncommon',price:{pl:0,zl:3,sr:0,md:0},effect:'Игнорирует первый штраф от обычного холода · затем вызывает жажду',desc:'Огненная настойка, которую в шахтах пьют по одному глотку.',effects:[{id:'pepper-cold',type:'defense',trigger:'drink-serving',operation:'ignore-penalty',value:1,condition:'ordinary-cold',frequency:'scene',stacking:'replace'},{id:'pepper-thirst',type:'risk',trigger:'end-scene',operation:'apply-thirst',value:1,frequency:'scene',stacking:'refresh'}]},
    {id:'shp_alcohol_12',name:'Синий абсент аптекаря',icon:'🧿',image:'images/shop/apothecary-blue-absinthe.png',strength:5,servings:3,rarity:'rare',price:{pl:0,zl:6,sr:0,md:0},effect:'+1 к толкованию странных образов · −1 к проверкам реальности',desc:'Горький синий напиток с травяным осадком. В некоторых городах продажа ограничена.',access:{markets:['guild','secret'],legality:'restricted'},effects:[{id:'blue-absinthe-symbols',type:'scouting',trigger:'contemplate-vision',operation:'check-bonus',value:1,condition:'symbols-dreams-or-omens',frequency:'scene',stacking:'highest'},{id:'blue-absinthe-reality',type:'risk',trigger:'drink-serving',operation:'check-penalty',value:1,condition:'detect-illusion',frequency:'scene',stacking:'highest'}]}
  ].map(function(item){item.powerTier=0;item.intoxication={strength:item.strength,servings:item.servings,stacksWithAlcohol:true};return finishBatchItem(item,{cat:'food',category:'consumable',slot:'consumable',tags:['drink','alcohol'],access:{markets:['local-open','city'],legality:'open'}});});

  var MOVEMENT_GEAR_ITEMS = [
    {id:'shp_mobility_01',name:'Кошки каменщика',icon:'🧗',effect:'Преимущество при подъёме по камню и кирпичу · первый провал останавливает вместо падения',desc:'Ременные накладки с короткими сменными зубьями.',group:'climb',price:{pl:0,zl:6,sr:0,md:0},effects:[{id:'mason-crampons',type:'tempo',trigger:'climb-masonry',operation:'grant-advantage',value:1,condition:'stone-or-brick',frequency:'passive',stacking:'highest'},{id:'mason-crampons-stop',type:'defense',trigger:'first-failed-masonry-climb',operation:'convert-fall-to-safe-stop',value:1,condition:'teeth-can-catch',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_02',name:'Крюк с обратным зубом',icon:'🪝',effect:'Закрепляет верёвку на уступе до 4 клеток',desc:'Тяжёлый трёхлапый крюк с кольцом и защитой от соскальзывания.',group:'climb',price:{pl:0,zl:8,sr:0,md:0},effects:[{id:'barbed-hook',type:'world',trigger:'throw-and-secure',operation:'create-anchor',value:4,actionCost:'long',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_03',name:'Верёвочная лестница, 6 метров',icon:'🪜',effect:'Создаёт проходимый вертикальный маршрут на 4 клетки',desc:'Лёгкие ясеневые ступени и смолёные боковые канаты.',group:'climb',price:{pl:0,zl:7,sr:0,md:0},effects:[{id:'rope-ladder',type:'tempo',trigger:'secure-ladder',operation:'create-route',value:4,actionCost:'long',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_04',name:'Пояс страховщика',icon:'🪢',effect:'Реакция · останови падение, если привязан к опоре',desc:'Широкий кожаный пояс с двумя стальными кольцами.',group:'climb',price:{pl:1,zl:2,sr:0,md:0},powerTier:2,effects:[{id:'belay-belt',type:'defense',trigger:'fall-while-anchored',operation:'prevent-fall',value:1,condition:'secured-rope',actionCost:'reaction',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_05',name:'Болотные снегоступы',icon:'🛷',effect:'Игнорируют 1 клетку штрафа вязкой земли за ход',desc:'Широкие плетёные рамы не дают ногам глубоко уходить в ил.',group:'terrain',price:{pl:0,zl:9,sr:0,md:0},effects:[{id:'marsh-shoes',type:'tempo',trigger:'move-through-soft-ground',operation:'ignore-difficult-cells',value:1,condition:'mud-snow-or-marsh',frequency:'turn',stacking:'highest'}]},
    {id:'shp_mobility_06',name:'Ледовые шипы сапог',icon:'⛸️',effect:'Преимущество на льду и мокром камне · первые 2 скользкие клетки не замедляют',desc:'Накладные железные пластины с четырьмя короткими шипами.',group:'terrain',price:{pl:0,zl:5,sr:0,md:0},effects:[{id:'ice-spikes',type:'tempo',trigger:'cross-slippery-ground',operation:'grant-advantage',value:1,condition:'ice-or-wet-stone',frequency:'passive',stacking:'highest'},{id:'ice-spikes-steps',type:'tempo',trigger:'move-on-slippery-ground',operation:'ignore-difficult-cells',value:2,condition:'ice-or-wet-stone',frequency:'turn',stacking:'highest'}]},
    {id:'shp_mobility_07',name:'Складной шест бродника',icon:'🎋',effect:'Преимущество при переходе мелкого брода · заранее обнаруживает яму или обрыв дна в соседней клетке',desc:'Составной шест с широким железным подпятником.',group:'water',price:{pl:0,zl:6,sr:0,md:0},effects:[{id:'ford-pole',type:'scouting',trigger:'cross-shallow-water',operation:'grant-advantage',value:1,condition:'wadeable-water',frequency:'passive',stacking:'highest'},{id:'ford-pole-probe',type:'scouting',trigger:'probe-adjacent-water-cell',operation:'reveal-underwater-drop',value:1,condition:'pole-reaches-bottom',frequency:'turn',stacking:'replace'}]},
    {id:'shp_mobility_08',name:'Надувной бурдюк-поплавок',icon:'🛟',effect:'Не даёт утонуть с лёгкой поклажей · преимущество против течения',desc:'Промасленная кожаная камера с петлёй под руку.',group:'water',price:{pl:0,zl:7,sr:0,md:0},effects:[{id:'skin-float',type:'defense',trigger:'stay-afloat',operation:'prevent-drowning',value:1,condition:'light-load-and-holding-float',frequency:'passive',stacking:'highest'},{id:'skin-float-current',type:'defense',trigger:'resist-water-current',operation:'grant-advantage',value:1,condition:'holding-float',frequency:'passive',stacking:'highest'}]},
    {id:'shp_mobility_09',name:'Песчаные накладки',icon:'🏜️',effect:'Не теряй первую клетку движения на рыхлом песке',desc:'Широкие кожаные подошвы с гибкой плетёной кромкой.',group:'terrain',price:{pl:0,zl:8,sr:0,md:0},effects:[{id:'sand-pads',type:'tempo',trigger:'move-through-sand',operation:'ignore-difficult-cells',value:1,condition:'loose-sand',frequency:'turn',stacking:'highest'}]},
    {id:'shp_mobility_10',name:'Спусковая восьмёрка',icon:'8️⃣',effect:'Контролируемый спуск по верёвке без штрафа за скорость',desc:'Кованая металлическая пластина для торможения каната.',group:'climb',price:{pl:1,zl:0,sr:0,md:0},effects:[{id:'descent-eight',type:'tempo',trigger:'descend-rope',operation:'ignore-penalty',value:1,condition:'secured-rope',frequency:'passive',stacking:'highest'}]},
    {id:'shp_mobility_11',name:'Прыжковая пружина гильдии',icon:'🌀',effect:'Раз за сцену увеличивает безопасный прыжок на 1 клетку',desc:'Тугая стальная пружина крепится между пяткой и голенью.',group:'urban',rarity:'uncommon',price:{pl:2,zl:5,sr:0,md:0},powerTier:2,effects:[{id:'guild-jump-spring',type:'tempo',trigger:'make-running-jump',operation:'add-jump-cells',value:1,frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_12',name:'Скользящий канатный блок',icon:'⚙️',effect:'Перемещает груз или человека вдоль натянутого каната',desc:'Двойной ролик с ручным тормозом и карабином.',group:'climb',rarity:'uncommon',price:{pl:3,zl:0,sr:0,md:0},powerTier:2,effects:[{id:'rope-trolley',type:'tempo',trigger:'traverse-tensioned-rope',operation:'create-route',value:6,condition:'rope-anchored-both-ends',actionCost:'long',frequency:'scene',stacking:'replace'}]}
  ].map(function(item){item.powerTier=item.powerTier||1;item.rarity=item.rarity||(item.powerTier>=2?'uncommon':'common');item.image='images/shop/mobility-'+item.id.slice(-2)+'.png';return finishBatchItem(item,{cat:'tool',category:'tool',slot:'utility',tags:['mobility'],access:{markets:['city','guild'],legality:'open'}});});

  var MINOR_ARTIFACT_ITEMS = [
    {id:'shp_artifact_01',name:'Камень сухого кармана',icon:'🪨',artifactLevel:1,effect:'Сохраняет один малый карман сухим в обычной непогоде',desc:'Пористый серый камень впитывает влагу, не становясь тяжелее.'},
    {id:'shp_artifact_02',name:'Игла верного севера',icon:'🧭',artifactLevel:1,effect:'Показывает север, если лежит на свободной ладони',desc:'Костяная игла медленно поворачивается к северу.'},
    {id:'shp_artifact_03',name:'Чаша последнего тепла',icon:'🥣',artifactLevel:1,effect:'Раз за сцену сохраняет одну порцию еды тёплой',desc:'Медная дорожная чаша с кольцом угольных рун.'},
    {id:'shp_artifact_04',name:'Шнур возвращённого узла',icon:'🪢',artifactLevel:1,effect:'Сам развязывает свой последний узел по слову владельца',desc:'Красный шнур помнит только одно завязывание.'},
    {id:'shp_artifact_05',name:'Фонарь чужого следа',icon:'🏮',artifactLevel:2,effect:'Раз за сцену проявляет свежие следы в радиусе 3 клеток',desc:'Синий огонь не освещает дорогу, зато цепляется за отпечатки.'},
    {id:'shp_artifact_06',name:'Пряжка упрямого шага',icon:'🔰',artifactLevel:2,effect:'Раз за сцену игнорирует 2 клетки замедляющей местности',desc:'Тяжёлая бронзовая пряжка тянет владельца вперёд.'},
    {id:'shp_artifact_07',name:'Маска спокойного дыхания',icon:'🎭',artifactLevel:2,effect:'+1 против дыма и удушающих испарений',desc:'Полумаска охлаждает и фильтрует каждый вдох.'},
    {id:'shp_artifact_08',name:'Зеркало неверного угла',icon:'🪞',artifactLevel:2,effect:'Раз за сцену позволяет заглянуть за угол на 2 клетки',desc:'Отражение в тёмном стекле всегда немного запаздывает.'},
    {id:'shp_artifact_09',name:'Ключ пустой двери',icon:'🗝️',artifactLevel:3,effect:'Раз за отдых открывает простой немагический замок без проверки',desc:'Беззубый ключ на миг принимает форму нужной бородки.'},
    {id:'shp_artifact_10',name:'Плащ второго силуэта',icon:'🧥',artifactLevel:3,effect:'Реакция раз за сцену · атака по владельцу получает −2',desc:'Тень плаща делает полшага в сторону раньше хозяина.'},
    {id:'shp_artifact_11',name:'Колокол тихой комнаты',icon:'🔔',artifactLevel:3,effect:'Раз за отдых создаёт зону 2×2, из которой 2 раунда не выходит звук',desc:'Малый колокол звучит только внутри своего бронзового корпуса.'},
    {id:'shp_artifact_12',name:'Перо удержанного слова',icon:'🪶',artifactLevel:3,effect:'Записывает и один раз дословно воспроизводит минуту речи',desc:'Чёрное перо пишет без чернил на любом чистом листе.'}
  ].map(function(item){item.powerTier=item.artifactLevel;item.rarity=item.artifactLevel===1?'uncommon':'rare';item.price={pl:item.artifactLevel*4,zl:0,sr:0,md:0};item.image='images/shop/artifact-'+item.id.slice(-2)+'.png';item.effects=[{id:'artifact-'+item.id,type:item.artifactLevel===1?'world':'support',trigger:'invoke-artifact',operation:'artifact-effect',value:item.artifactLevel,frequency:item.artifactLevel===1?'scene':'charge',charges:item.artifactLevel>1?1:null,stacking:'replace'}];return finishBatchItem(item,{cat:'magic',category:'artifact',slot:'utility',tags:['magic','artifact','artifact-level-'+item.artifactLevel],access:{markets:['guild','licensed'],legality:'open'}});});

  var POTION_ITEMS = [
    {id:'shp_potion_01',name:'Малое зелье лечения',icon:'❤️',potionTier:1,role:'healing',effect:'Короткое действие · восстанови 2d4+2 HP',desc:'Красная полевая настойка для свежих ран.',operation:'restore-hp-dice',dice:'2d4',value:2},
    {id:'shp_potion_02',name:'Зелье лечения',icon:'💖',potionTier:2,role:'healing',effect:'Короткое действие · восстанови 3d6+3 HP',desc:'Густой рубиновый состав из лицензированной аптеки.',operation:'restore-hp-dice',dice:'3d6',value:3},
    {id:'shp_potion_03',name:'Большое зелье лечения',icon:'💗',potionTier:3,role:'healing',effect:'Короткое действие · восстанови 5d6+5 HP',desc:'Редкий восстанавливающий состав с серебряным осадком.',operation:'restore-hp-dice',dice:'5d6',value:5},
    {id:'shp_potion_04',name:'Зелье медленного восстановления',icon:'💓',potionTier:2,role:'healing',effect:'В конце трёх следующих ходов восстанови по 1d4+1 HP',desc:'Тёмно-красное зелье действует мягче, но дольше.',operation:'regeneration-dice',dice:'1d4',value:1,durationRounds:3},
    {id:'shp_potion_05',name:'Зелье ясной крови',icon:'🩸',potionTier:1,role:'cleanse',effect:'Снимает обычное Отравление · против сильного даёт спасбросок с преимуществом',desc:'Горькая зелёная смесь очищающих солей.',operation:'remove-status',status:'poisoned',strongSaveMode:'advantage',value:1},
    {id:'shp_potion_06',name:'Зелье спокойного сердца',icon:'🫀',potionTier:1,role:'cleanse',effect:'Снимает Испуг · защищает от повторного Испуга того же источника на сцену',desc:'Молочная настойка замедляет дрожь и дыхание.',operation:'remove-status',status:'fear',immunitySource:'same-source',duration:'scene',value:1},
    {id:'shp_potion_07',name:'Зелье кошачьего шага',icon:'🐈',potionTier:2,role:'mobility',effect:'+2 клетки скорости и игнорирование трудной местности на 3 раунда',desc:'Золотистая жидкость делает движения мягкими и быстрыми.',effects:[{id:'potion-shp_potion_07',type:'tempo',trigger:'drink-potion',operation:'add-speed',balanceOperation:'potion-effect',balanceTier:2,value:2,durationRounds:3,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'cat-step-terrain',type:'tempo',trigger:'move',operation:'ignore-difficult-terrain',durationRounds:3,frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_potion_08',name:'Зелье каменной кожи',icon:'🪨',potionTier:2,role:'defense',effect:'Три раунда снижает первый физический урон каждого раунда на 1d4',desc:'Серая взвесь на миг уплотняет верхний слой кожи.',operation:'reduce-damage-dice',dice:'1d4',durationRounds:3,triggerOverride:'first-physical-damage-each-round'},
    {id:'shp_potion_09',name:'Зелье ночного зрения',icon:'👁️',potionTier:1,role:'scouting',effect:'На одну сцену позволяет видеть в обычной темноте как в тусклом свете',desc:'Чернильная жидкость расширяет зрачки до рассветной серости.',operation:'grant-darkvision',duration:'scene'},
    {id:'shp_potion_10',name:'Зелье жабр',icon:'🐟',potionTier:2,role:'exploration',effect:'Позволяет дышать под водой 1 час · преимущество против течения и захлёбывания',desc:'Солёная синяя микстура оставляет холод в горле.',effects:[{id:'potion-shp_potion_10',type:'tempo',trigger:'drink-potion',operation:'grant-breath',balanceOperation:'potion-effect',balanceTier:2,value:60,durationMinutes:60,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'gill-current',type:'defense',trigger:'resist-current-or-drowning',operation:'grant-advantage',value:1,durationMinutes:60,frequency:'charge',charges:1,stacking:'highest'}]},
    {id:'shp_potion_11',name:'Зелье лёгкой руки',icon:'🖐️',potionTier:1,role:'utility',effect:'Преимущество на тонкую ручную работу до конца сцены',desc:'Бесцветная настойка временно успокаивает пальцы.',operation:'grant-advantage',condition:'fine-handwork',duration:'scene'},
    {id:'shp_potion_12',name:'Зелье громового голоса',icon:'📣',potionTier:1,role:'social',effect:'Преимущество на первый приказ или запугивание в сцене · голос слышен на 10 клеток',desc:'Жёлтая шипучая жидкость делает голос низким и звонким.',effects:[{id:'potion-shp_potion_12',type:'tempo',trigger:'first-voice-command-or-intimidation',operation:'grant-advantage',balanceOperation:'potion-effect',balanceTier:1,value:1,duration:'scene',actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'thunder-voice-range',type:'world',trigger:'speak',operation:'amplify-voice',balanceOperation:'crafting-component',value:1,rangeCells:10,duration:'scene',frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_potion_13',name:'Зелье искрового сопротивления',icon:'⚡',potionTier:2,role:'defense',effect:'Сопротивление молнии на 3 раунда · первый разряд дополнительно снижается на 2d6',desc:'Медная взвесь уводит разряд в землю.',effects:[{id:'potion-shp_potion_13',type:'defense',trigger:'receive-lightning-damage',operation:'grant-resistance',balanceOperation:'potion-effect',balanceTier:2,damageType:'lightning',durationRounds:3,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'spark-first-hit',type:'defense',trigger:'first-lightning-damage',operation:'reduce-damage-dice',balanceOperation:'crafting-component',value:2,dice:'2d6',durationRounds:3,frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_potion_14',name:'Зелье памяти пути',icon:'🗺️',potionTier:1,role:'scouting',effect:'До отдыха без проверки воспроизводит уже пройденный маршрут и замечает отклонение',desc:'После глотка недавние ориентиры вспоминаются особенно ясно.',operation:'perfect-route-recall',duration:'until-rest'},
    {id:'shp_potion_15',name:'Зелье прозрачного слуха',icon:'👂',potionTier:2,role:'scouting',effect:'Преимущество на слух 3 раунда · определяет клетку звучащей невидимой цели · уязвимость к звуку',desc:'Фиолетовая микстура усиливает и шёпот, и болезненный звон.',effects:[{id:'potion-shp_potion_15',type:'scouting',trigger:'listen',operation:'grant-advantage',balanceOperation:'potion-effect',balanceTier:2,value:1,durationRounds:3,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'transparent-hearing-locate',type:'scouting',trigger:'unseen-target-makes-sound',operation:'locate-cell-by-sound',durationRounds:3,frequency:'charge',charges:1,stacking:'replace'},{id:'risk-shp_potion_15',type:'risk',trigger:'receive-sound-effect',operation:'impose-disadvantage',value:1,durationRounds:3,frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_potion_16',name:'Зелье исчезающего контура',icon:'👁️',image:'images/shop/potion-16.png',imageThumb:'images/shop/thumbs/potion-16.jpg',potionTier:3,role:'stealth',rarity:'rare',price:{pl:7,zl:5,sr:0,md:0},effect:'Короткое действие · статус Невидим на 3 раунда · заканчивается после атаки или вредоносного заклинания',desc:'Бесцветный состав действительно скрывает от зрения. Выпившего всё ещё можно услышать, проявить дымом или жидкостью либо обнаружить особой магией.',operation:'apply-status',status:'invisible',durationRounds:3,endsOn:['attack','harmful-spell'],access:{markets:['guild','licensed','secret'],legality:'restricted'},baseRegion:'upperland',marketIds:['ztuz-licensed-counter','glupishche-hypnoks-eye']}
  ].map(function(item){
    item.powerTier=item.potionTier;
    item.rarity=item.rarity||(item.potionTier===1?'common':item.potionTier===2?'uncommon':'rare');
    item.price=item.price||{pl:item.potionTier===1?0:item.potionTier*2,zl:item.potionTier===1?8:0,sr:0,md:0};
    item.charges=1;
    item.image=item.image||('images/shop/potion-'+item.id.slice(-2)+'.png');
    item.effects=item.effects||[{id:'potion-'+item.id,type:item.role==='healing'||item.role==='cleanse'?'support':item.role==='defense'?'defense':item.role==='scouting'||item.role==='stealth'?'scouting':'tempo',trigger:'drink-potion',effectTrigger:item.triggerOverride,operation:item.operation,balanceOperation:'potion-effect',balanceTier:item.potionTier,value:item.value,dice:item.dice,status:item.status,condition:item.condition,duration:item.duration,durationMinutes:item.durationMinutes,durationRounds:item.durationRounds,strongSaveMode:item.strongSaveMode,immunitySource:item.immunitySource,endsOn:item.endsOn,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}];
    if(item.risk)item.effects.push({id:'risk-'+item.id,type:'risk',trigger:'drink-potion',operation:'apply-vulnerability',value:1,condition:item.risk,frequency:'charge',charges:1,stacking:'replace'});
    item.consumption={mode:'consume-on-use'};
    return finishBatchItem(item,{cat:'potion',category:'consumable',slot:'consumable',tags:['potion','consumable',item.role],access:{markets:['city','guild'],legality:'open'}});
  });

  var MAGIC_ADORNMENT_ITEMS = [
    {id:'shp_adornment_01',name:'Кольцо сухой ладони',icon:'💍',kind:'ring',tier:1,effect:'Мелкие предметы не выскальзывают из мокрой ладони',desc:'Шероховатое медное кольцо всегда остаётся сухим.'},
    {id:'shp_adornment_02',name:'Кольцо тихого ключа',icon:'🔑',kind:'ring',tier:1,effect:'+1 к бесшумной работе с замками',desc:'Тонкое железное кольцо глушит звон малого инструмента.'},
    {id:'shp_adornment_03',name:'Кольцо сторожевой искры',icon:'✨',kind:'ring',tier:2,effect:'Раз за сцену вспыхивает, если к владельцу крадутся в пределах 2 клеток',desc:'В янтарной вставке спит крошечная неподвижная искра.'},
    {id:'shp_adornment_04',name:'Кольцо второго хвата',icon:'🤝',kind:'ring',tier:2,effect:'Реакция раз за сцену · +2 к удержанию предмета или края',desc:'Два переплетённых обода сжимают палец при опасности.'},
    {id:'shp_adornment_05',name:'Кольцо разбитой печати',icon:'🔘',kind:'ring',tier:3,effect:'Раз за отдых повтори проваленный спасбросок против малого проклятия',desc:'Серебряная печать на кольце намеренно расколота надвое.'},
    {id:'shp_adornment_06',name:'Амулет дорожного огня',icon:'🔥',kind:'amulet',tier:1,effect:'+1 к разжиганию и сохранению обычного костра',desc:'Плоский глиняный медальон с угольной спиралью.'},
    {id:'shp_adornment_07',name:'Амулет чистого глотка',icon:'💧',kind:'amulet',tier:1,effect:'Раз в день предупреждает о явно испорченной воде',desc:'Капля мутнеет рядом с гнилью, но не определяет конкретный яд.'},
    {id:'shp_adornment_08',name:'Амулет ровного дыхания',icon:'🌬️',kind:'amulet',tier:2,effect:'+1 против дыма, паники и задержки дыхания',desc:'Костяная подвеска мерно холодеет на каждом вдохе.'},
    {id:'shp_adornment_09',name:'Амулет следа хозяина',icon:'🐾',kind:'amulet',tier:2,effect:'+1 к поиску принадлежащей владельцу вещи',desc:'Внутри деревянного медальона хранится волос или нить одежды.'},
    {id:'shp_adornment_10',name:'Амулет малого отпора',icon:'🛡️',kind:'amulet',tier:3,effect:'Реакция раз за отдых · снизь магический урон на 2d6',desc:'Чёрный камень принимает цвет отражённой стихии.'},
    {id:'shp_adornment_11',name:'Оберег от дурного сна',icon:'🌙',kind:'charm',tier:1,effect:'+1 против обычных кошмаров и бессонницы',desc:'Пучок трав и шерстяная нить над изголовьем.'},
    {id:'shp_adornment_12',name:'Оберег дверного шёпота',icon:'🚪',kind:'charm',tier:1,effect:'Тихо трещит, когда закреплённую дверь открывают',desc:'Три костяные пластинки связаны красной нитью.'},
    {id:'shp_adornment_13',name:'Оберег от чужого имени',icon:'🧿',kind:'charm',tier:2,effect:'+1 против эффектов, требующих истинного имени владельца',desc:'Имя спрятано под семью слоями пустой бумаги.'},
    {id:'shp_adornment_14',name:'Оберег последнего угля',icon:'🪵',kind:'charm',tier:2,effect:'Раз за отдых сохраняет одну искру после полного затухания костра',desc:'Обугленный орех хранится в железной клеточке.'},
    {id:'shp_adornment_15',name:'Оберег порога',icon:'⛩️',kind:'charm',tier:3,effect:'Раз за отдых создаёт на пороге сигнал против нежити или демона',desc:'Связка соли, серебряной проволоки и обожжённого дерева.'}
  ].map(function(item){item.powerTier=item.tier;item.rarity=item.tier===1?'uncommon':'rare';item.price={pl:item.tier*5,zl:0,sr:0,md:0};item.slot=item.kind==='ring'?'ring':item.kind==='amulet'?'amulet':'utility';item.image='images/shop/'+item.kind+'-'+item.id.slice(-2)+'.png';item.effects=[{id:'adornment-'+item.id,type:item.tier===1?'world':item.tier===2?'scouting':'defense',trigger:item.tier===1?'while-worn':'invoke-adornment',operation:'artifact-effect',value:item.tier,condition:item.tier===1?'narrow-purpose':null,frequency:item.tier===1?'passive':item.tier===2?'scene':'charge',charges:item.tier===3?1:null,stacking:'unique-source'}];return finishBatchItem(item,{cat:'magic',category:'accessory',slot:item.slot,tags:['magic',item.kind],access:{markets:['guild','licensed'],legality:'open'}});});

  // Простые усилители формы заклинания. Это настольные заряды, а не таймеры:
  // каждый предмет срабатывает один раз за бой и восстанавливается перед следующим.
  var SPELL_FORM_ITEMS = [
    {id:'shp_spell_form_01',name:'Кольцо направляющей грани',icon:'💍',image:'images/shop/spell-form-ring-directed.png',imageThumb:'images/shop/thumbs/spell-form-ring-directed.jpg',spellForm:'directed',slot:'ring',powerTier:2,rarity:'uncommon',price:{pl:4,zl:5,sr:0,md:0},effect:'Раз за бой · после броска добавь 1d4 к попаданию направленным заклинанием',desc:'Разомкнутая оправа стягивает отблеск в одну точку. Решение принимают после броска, но до объявления результата.',effects:[{id:'guiding-edge-directed-spell',type:'support',trigger:'caster-rolls-directed-spell-attack',operation:'add-die-to-spell-attack-roll',balanceOperation:'artifact-effect',dice:'1d4',value:1,condition:'after-roll-before-outcome',frequency:'combat',charges:1,recharge:'next-combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},
    {id:'shp_spell_form_02',name:'Наручи удержанного узла',icon:'⭕',image:'images/shop/spell-form-bracers-concentration.png',imageThumb:'images/shop/thumbs/spell-form-bracers-concentration.jpg',spellForm:'concentration',slot:'wrists',powerTier:2,rarity:'uncommon',price:{pl:5,zl:5,sr:0,md:0},effect:'Раз за бой · добавь 1d6 к проверке сохранения концентрации',desc:'Переплетённые жилы затягиваются при ударе и помогают не распустить уже удерживаемое заклинание.',effects:[{id:'held-knot-concentration',type:'defense',trigger:'caster-makes-concentration-check',operation:'add-die-to-concentration-check',balanceOperation:'artifact-effect',dice:'1d6',value:1,frequency:'combat',charges:1,recharge:'next-combat',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','lesorubka-artel-yard']},
    {id:'shp_spell_form_03',name:'Перчатки полного касания',icon:'🧤',image:'images/shop/spell-form-gloves-touch.png',imageThumb:'images/shop/thumbs/spell-form-gloves-touch.jpg',spellForm:'touch',slot:'hands',powerTier:2,rarity:'rare',price:{pl:6,zl:5,sr:0,md:0},effect:'Раз за бой · добавь 1d6 к урону или лечению заклинания прикосновения',desc:'Серебряный шов доводит импульс до самых кончиков пальцев. Кубик следует исходному действию заклинания: ранит либо лечит.',effects:[{id:'full-touch-spell',type:'support',trigger:'caster-resolves-touch-spell-damage-or-healing',operation:'add-die-to-touch-spell-damage-or-healing',balanceOperation:'artifact-effect',dice:'1d6',value:1,condition:'same-damage-or-healing-mode-as-spell',frequency:'combat',charges:1,recharge:'next-combat',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','glupishche-last-rest']},
    {id:'shp_spell_form_04',name:'Амулет сосредоточенной области',icon:'◉',image:'images/shop/spell-form-amulet-area.png',imageThumb:'images/shop/thumbs/spell-form-amulet-area.jpg',spellForm:'area',slot:'amulet',powerTier:2,rarity:'rare',price:{pl:7,zl:5,sr:0,md:0},effect:'Раз за бой · одна выбранная цель области получает ещё 1d6 урона',desc:'Широкий диск собирает часть рассеянной силы в одну отмеченную точку. Остальные цели получают обычный эффект заклинания.',effects:[{id:'focused-area-spell',type:'damage',trigger:'caster-deals-damage-with-area-spell',operation:'add-damage-die-to-one-chosen-area-target',balanceOperation:'artifact-effect',dice:'1d6',value:1,targetLimit:1,condition:'chosen-target-is-affected-by-the-spell',frequency:'combat',charges:1,recharge:'next-combat',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','glupishche-hypnoks-eye']}
  ].map(function(item){
    item.cat='magic';
    item.category='accessory';
    item.charges=1;
    item.maxCharges=1;
    item.recharge='next-combat';
    item.tags=['magic','spell-form',item.spellForm];
    item.access={markets:['guild','licensed'],legality:'open'};
    return finishBatchItem(item,{cat:'magic',category:'accessory',slot:item.slot,tags:[],access:item.access});
  });

  var BLACK_MARKET_ITEMS = [
    {id:'shp_black_01',name:'Ключевой воск взломщика',icon:'🕯️',tier:1,legality:'restricted',effect:'+1 к созданию слепка простого ключа',desc:'Мягкий чёрный воск в плоской жестяной коробочке.'},
    {id:'shp_black_02',name:'Печать чужого курьера',icon:'📯',tier:1,legality:'forbidden',effect:'+1 к выдаче себя за низового посыльного',desc:'Набор поддельных сургучных печатей без гербов знати.'},
    {id:'shp_black_03',name:'Сажа без отпечатка',icon:'🖐️',tier:1,legality:'restricted',effect:'На одну сцену скрывает обычные отпечатки пальцев',desc:'Жирная сажа для перчаток и рукоятей.'},
    {id:'shp_black_04',name:'Тихая стеклорезная нить',icon:'🧵',tier:1,legality:'restricted',effect:'+1 к бесшумному вскрытию простого стекла',desc:'Алмазная пыль впаяна в тонкую металлическую нить.'},
    {id:'shp_black_05',name:'Монета ложного веса',icon:'🪙',tier:1,legality:'forbidden',effect:'+1 к одной проверке подмены монет на весах',desc:'Свинцовая сердцевина спрятана под тонким золотистым покрытием.'},
    {id:'shp_black_06',name:'Фонарь слепого пятна',icon:'🏮',tier:2,legality:'restricted',effect:'Раз за сцену создаёт узкую полосу тусклого света, удобную для скрытности',desc:'Заслонки направляют свет только под ноги владельца.'},
    {id:'shp_black_07',name:'Кандальный штифт',icon:'📌',tier:2,legality:'forbidden',effect:'Разово даёт +2 к освобождению из простых кандалов',desc:'Хрупкий стальной штифт прячется в шве одежды.'},
    {id:'shp_black_08',name:'Маска безликого лакея',icon:'🎭',tier:2,legality:'forbidden',effect:'+1 к изображению незаметного слуги на одну сцену',desc:'Неброская полумаска меняет запоминающиеся линии лица.'},
    {id:'shp_black_09',name:'Глушитель дверного колокольца',icon:'🔕',tier:2,legality:'restricted',effect:'Разово подавляет один простой сигнальный механизм',desc:'Комок особого воска и пружинная скоба.'},
    {id:'shp_black_10',name:'Карта сточных ходов',icon:'🗺️',tier:2,legality:'restricted',effect:'+1 к поиску служебного входа в известном городе',desc:'Неполные копии ремонтных схем с пометками контрабандистов.'},
    {id:'shp_black_11',name:'Зеркало перехваченного взгляда',icon:'🪞',tier:3,legality:'forbidden',effect:'Раз за отдых обнаруживает одно простое магическое наблюдение',desc:'Тёмное карманное зеркало покрывается инеем под чужим взглядом.'},
    {id:'shp_black_12',name:'Браслет снятой клятвы',icon:'⛓️',tier:3,legality:'forbidden',effect:'Раз за отдых подавляет малую магическую метку на одну сцену',desc:'Составной браслет из звеньев разных храмов.'},
    {id:'shp_black_13',name:'Пыль проходного лица',icon:'🌫️',tier:3,legality:'forbidden',effect:'На 3 раунда наблюдателям сложнее запомнить лицо: −2 к последующему опознанию',desc:'Серая пыль стирает детали из короткой памяти, но не меняет внешность.'},
    {id:'shp_black_14',name:'Ящик немого товара',icon:'📦',tier:2,legality:'restricted',effect:'Скрывает обычный запах содержимого на одну сцену',desc:'Малый свинцово-деревянный короб с угольной прокладкой.'},
    {id:'shp_black_15',name:'Жетон закрытого аукциона',icon:'🎟️',tier:1,legality:'restricted',effect:'Даёт доступ к одной встрече подпольного рынка, но не гарантирует доверия',desc:'Костяной жетон с меняющимся каждую неделю надрезом.'}
  ].map(function(item){item.powerTier=item.tier;item.rarity=item.tier===1?'common':item.tier===2?'uncommon':'rare';item.price={pl:item.tier*3,zl:0,sr:0,md:0};item.image='images/shop/black-market-'+item.id.slice(-2)+'.png';item.effects=[{id:'black-'+item.id,type:item.tier===1?'world':item.tier===2?'scouting':'control',trigger:'use-underworld-tool',operation:'underworld-tool',value:item.tier,frequency:item.tier===1?'scene':'charge',charges:item.tier>1?1:null,stacking:'replace'}];item.access={markets:['secret'],legality:item.legality};return finishBatchItem(item,{cat:'other',category:'tool',slot:'utility',tags:['black-market','underworld'],access:{markets:['secret'],legality:'restricted'}});});

  // Запрещённый товар — отдельный слой подпольного рынка. Все дурманы
  // полностью вымышлены: правила описывают только эффект и цену риска,
  // без состава, дозировки или способа изготовления.
  var FORBIDDEN_GOODS_ITEMS = [
    {id:'shp_forbidden_01',name:'Лукавка Страннограда',image:'images/shop/forbidden-good-01.png',imageThumb:'images/shop/thumbs/forbidden-good-01.jpg',contrabandKind:'narcotic-lukavka',category:'consumable',powerTier:1,rarity:'uncommon',price:{pl:1,zl:2,sr:0,md:0},charges:1,effect:'На одну сцену позволяет не чувствовать обычную усталость · затем до отдыха Помеха к Восприятию',desc:'Тёмные ломкие пластинки с приторным запахом. Болотная Гильдия продаёт их под разными именами, но на улицах прижилось одно — лукавка.',effects:[{id:'strannograd-lukavka-numbness',type:'support',trigger:'consume-fictional-drug',operation:'ignore-ordinary-fatigue-penalty',balanceOperation:'artifact-effect',value:1,duration:'scene',frequency:'charge',charges:1,stacking:'replace'},{id:'strannograd-lukavka-crash',type:'risk',trigger:'lukavka-effect-ends',operation:'grant-disadvantage',value:1,condition:'perception-checks',duration:'until-rest',frequency:'charge',charges:1,stacking:'refresh'}]},
    {id:'shp_forbidden_02',name:'Пепельный сахар Шахтогорья',image:'images/shop/forbidden-good-02.png',imageThumb:'images/shop/thumbs/forbidden-good-02.jpg',contrabandKind:'narcotic-ash-sugar',category:'consumable',powerTier:0,rarity:'uncommon',price:{pl:1,zl:5,sr:0,md:0},charges:1,effect:'На одну сцену даёт Преимущество переносить обычную боль · после окончания лишает реакции на 1 раунд',desc:'Серые стекловидные крошки в шахтёрской жестянке. Они делают боль далёкой, но вместе с ней запаздывает и чувство опасности.',effects:[{id:'ash-sugar-pain',type:'defense',trigger:'consume-fictional-drug',operation:'grant-advantage',balanceOperation:'artifact-effect',value:1,condition:'resist-ordinary-pain',duration:'scene',frequency:'charge',charges:1,stacking:'replace'},{id:'ash-sugar-delay',type:'risk',trigger:'ash-sugar-effect-ends',operation:'disable-reaction',value:1,durationRounds:1,frequency:'charge',charges:1,stacking:'refresh'}]},
    {id:'shp_forbidden_03',name:'Синяя тишь Песочного Жёлудя',image:'images/shop/forbidden-good-03.png',imageThumb:'images/shop/thumbs/forbidden-good-03.jpg',contrabandKind:'narcotic-blue-hush',category:'consumable',powerTier:1,rarity:'uncommon',price:{pl:1,zl:8,sr:0,md:0},charges:1,effect:'На одну социальную сцену скрывает дрожь голоса и обычную панику · затем речь остаётся только шёпотом до отдыха',desc:'Мягкие синие шарики в раковинной коробочке. Контрабандисты принимают их перед допросом, а потом часами не могут повысить голос.',effects:[{id:'blue-hush-composure',type:'support',trigger:'consume-fictional-drug',operation:'suppress-visible-fear-signs',balanceOperation:'artifact-effect',value:1,condition:'ordinary-panic-and-voice-tremor',duration:'social-scene',frequency:'charge',charges:1,stacking:'replace'},{id:'blue-hush-voice',type:'risk',trigger:'blue-hush-effect-ends',operation:'limit-voice-to-whisper',value:1,duration:'until-rest',frequency:'charge',charges:1,stacking:'refresh'}]},
    {id:'shp_forbidden_04',name:'Смола «Мягкое дно»',image:'images/shop/forbidden-good-04.png',imageThumb:'images/shop/thumbs/forbidden-good-04.jpg',contrabandKind:'narcotic-soft-bottom',category:'consumable',powerTier:0,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},charges:1,effect:'Позволяет уснуть несмотря на обычный шум и тревогу · первые 2 часа спящего трудно разбудить',desc:'Тусклая лиловая смола из портовых притонов. Её покупают те, кому нужен сон любой ценой, и обкрадывают именно поэтому.',effects:[{id:'soft-bottom-sleep',type:'world',trigger:'consume-before-rest',operation:'sleep-through-ordinary-noise-and-anxiety',value:1,condition:'voluntary-rest',frequency:'charge',charges:1,stacking:'replace'},{id:'soft-bottom-heavy-sleep',type:'risk',trigger:'fall-asleep-under-effect',operation:'hard-to-awaken',value:1,duration:'first-two-hours',frequency:'charge',charges:1,stacking:'refresh'}]},
    {id:'shp_forbidden_05',name:'Зеркальная пыль Вольной Башни',image:'images/shop/forbidden-good-05.png',imageThumb:'images/shop/thumbs/forbidden-good-05.jpg',contrabandKind:'narcotic-mirror-dust',category:'consumable',powerTier:2,rarity:'rare',price:{pl:3,zl:0,sr:0,md:0},charges:1,effect:'На 3 раунда показывает следы недавней магии в 3 клетках · Мастер добавляет один ложный след',desc:'Радужная пыль заставляет мир покрываться светящимися трещинами. Иногда они ведут к магии, иногда — только глубже в наваждение.',effects:[{id:'mirror-dust-traces',type:'scouting',trigger:'consume-fictional-drug',operation:'reveal-recent-magic-traces',balanceOperation:'artifact-effect',value:2,rangeCells:3,durationRounds:3,frequency:'charge',charges:1,stacking:'replace'},{id:'mirror-dust-false-trace',type:'risk',trigger:'perceive-magic-traces',operation:'add-one-false-trace',value:1,frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_forbidden_06',name:'Чёрный лист бессонной смены',image:'images/shop/forbidden-good-06.png',imageThumb:'images/shop/thumbs/forbidden-good-06.jpg',contrabandKind:'narcotic-black-leaf',category:'consumable',powerTier:1,rarity:'uncommon',price:{pl:1,zl:0,sr:0,md:0},charges:1,effect:'Позволяет бодрствовать одну ночь без обычной сонливости · следующий короткий отдых не снимает усталость',desc:'Свёрнутый почти чёрный лист, который расходится по караулам и шахтам. Он одалживает бодрость у следующего привала.',effects:[{id:'black-leaf-wakefulness',type:'support',trigger:'consume-before-night-watch',operation:'prevent-ordinary-sleepiness',balanceOperation:'artifact-effect',value:1,duration:'one-night',frequency:'charge',charges:1,stacking:'replace'},{id:'black-leaf-rest-debt',type:'risk',trigger:'take-next-short-rest',operation:'prevent-fatigue-recovery',value:1,duration:'next-short-rest',frequency:'charge',charges:1,stacking:'refresh'}]},
    {id:'shp_forbidden_07',name:'Паспорт мёртвого подданного',image:'images/shop/forbidden-good-07.png',imageThumb:'images/shop/thumbs/forbidden-good-07.jpg',contrabandKind:'forged-identity',category:'tool',powerTier:1,rarity:'rare',price:{pl:2,zl:5,sr:0,md:0},charges:1,effect:'Один раз выдерживает беглую проверку личности на заставе · сверка реестра сразу раскрывает подлог',desc:'Подлинный бланк и печать принадлежат человеку, которого уже нет. Покупателю остаётся соответствовать чужому возрасту и приметам.',effects:[{id:'dead-subject-passport',type:'world',trigger:'present-at-routine-checkpoint',operation:'pass-cursory-identity-check',balanceOperation:'artifact-effect',value:1,condition:'appearance-matches-and-no-registry-check',frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_forbidden_08',name:'Клеймо снятого груза',image:'images/shop/forbidden-good-08.png',imageThumb:'images/shop/thumbs/forbidden-good-08.jpg',contrabandKind:'forged-customs-seal',category:'tool',powerTier:1,rarity:'uncommon',price:{pl:1,zl:5,sr:0,md:0},charges:1,effect:'Помечает один ящик как уже осмотренный · внимательная проверка пломбы раскрывает подделку',desc:'Медная матрица и ломкая чёрная пломба копируют старый знак портовой стражи. После одного оттиска матрица деформируется.',effects:[{id:'cleared-cargo-mark',type:'world',trigger:'seal-one-cargo-container',operation:'mark-cargo-as-inspected',balanceOperation:'artifact-effect',value:1,condition:'routine-customs-check-only',frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_forbidden_09',name:'Книга чужих имён',image:'images/shop/forbidden-good-09.png',imageThumb:'images/shop/thumbs/forbidden-good-09.jpg',contrabandKind:'stolen-identity-ledger',category:'tool',powerTier:1,rarity:'rare',price:{pl:3,zl:5,sr:0,md:0},effect:'Для одного известного имени указывает последний записанный адрес, службу или долговую связь',desc:'Вырванный кусок городского реестра без обложки. Сведения правдивы на дату кражи, но люди и долги умеют исчезать.',effects:[{id:'book-of-others-names',type:'scouting',trigger:'research-known-registered-name',operation:'reveal-last-recorded-address-service-or-debt',balanceOperation:'artifact-effect',value:1,condition:'identity-was-recorded-before-ledger-theft',frequency:'scene',stacking:'replace'}]},
    {id:'shp_forbidden_10',name:'Кость неучтённой могилы',image:'images/shop/forbidden-good-10.png',imageThumb:'images/shop/thumbs/forbidden-good-10.jpg',contrabandKind:'grave-robbed-component',category:'material',powerTier:1,rarity:'rare',price:{pl:2,zl:0,sr:0,md:0},charges:1,effect:'Заменяет безымянный останок в одном малом некромантском обряде · несёт риск чужого отклика',desc:'Очищенная кость без храмовой нити и могильного номера. Даже продавец не знает, кому она принадлежала и почему отвечает на зов.',effects:[{id:'unregistered-grave-bone',type:'world',trigger:'use-in-minor-necromancy-rite',operation:'substitute-anonymous-mortal-remains',balanceOperation:'artifact-effect',value:1,frequency:'charge',charges:1,stacking:'replace'},{id:'unregistered-bone-echo',type:'risk',trigger:'complete-rite-with-unknown-remains',operation:'invite-unidentified-spirit-echo',value:1,frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_forbidden_11',name:'Военная карта закрытых дорог',image:'images/shop/forbidden-good-11.png',imageThumb:'images/shop/thumbs/forbidden-good-11.jpg',contrabandKind:'stolen-military-map',category:'tool',powerTier:2,rarity:'rare',price:{pl:4,zl:0,sr:0,md:0},effect:'Показывает один служебный обход и старое расписание патрулей выбранного укрепления',desc:'Промасленный лист из штабного планшета. Маршрут настоящий, но после кражи караулы могли изменить порядок.',effects:[{id:'closed-roads-military-map',type:'scouting',trigger:'study-before-approaching-fortification',operation:'reveal-service-route-and-old-patrol-pattern',balanceOperation:'artifact-effect',value:2,condition:'mapped-fortification-and-map-not-obsolete',frequency:'scene',stacking:'replace'}]},
    {id:'shp_forbidden_12',name:'Клетка украденного голоса',image:'images/shop/forbidden-good-12.png',imageThumb:'images/shop/thumbs/forbidden-good-12.jpg',contrabandKind:'stolen-voice-device',category:'tool',powerTier:2,rarity:'rare',price:{pl:5,zl:0,sr:0,md:0},charges:1,effect:'Запоминает одну услышанную короткую фразу и один раз повторяет её тем же голосом',desc:'Серебряная клеточка вокруг чёрной мембраны. Она копирует только звук — манеру разговора, новые слова и личность владельцу не даёт.',effects:[{id:'stolen-voice-cage',type:'world',trigger:'record-and-release-short-heard-phrase',operation:'replay-phrase-in-same-voice',balanceOperation:'artifact-effect',value:2,condition:'phrase-up-to-twelve-words;no-new-speech',frequency:'charge',charges:1,stacking:'replace'}]}
  ].map(function(item){
    item.icon='🩸';
    item.tags=['forbidden-goods','contraband',item.contrabandKind].concat(item.category==='consumable'?['fictional-drug','consumable']:[]);
    item.access={markets:['secret'],legality:'forbidden'};
    item.consumption=item.category==='consumable'?{mode:'consume-on-use'}:item.charges===1?{mode:'consume-on-use'}:null;
    return finishBatchItem(item,{cat:'contraband',category:item.category,slot:item.category==='consumable'?'consumable':'utility',tags:[],access:{markets:['secret'],legality:'forbidden'}});
  });

  // Воровские инструменты дают новые способы действовать и понятную цену
  // провала вместо универсальных числовых бонусов. Открытые наборы легальны
  // как ремесленные принадлежности; их применение определяет отношение стражи.
  var THIEF_GEAR_ITEMS = [
    {id:'shp_thiefgear_01',name:'Кайданы трактовой стражи',icon:'⛓️',image:'images/shop/thief-gear-01.png',imageThumb:'images/shop/thumbs/thief-gear-01.jpg',thiefRole:'restraint',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'common',price:{pl:0,zl:4,sr:0,md:0},charges:null,effect:'Длинное действие · сковывает согласную, беспомощную или уже опутанную цель · освобождение требует ключа, работы с замком либо шумного усилия',desc:'Кованые железные браслеты с короткой цепью и отдельным замком. Надёжны против обычного пленника, но не заменяют надзор.',effects:[{id:'road-guard-shackles',type:'control',trigger:'restrain-compliant-or-disabled-target',operation:'apply-restraint-device',value:1,condition:'target-willing-incapacitated-or-restrained',actionCost:'long',frequency:'passive',stacking:'replace'}],access:{markets:['local-open','city','guild'],legality:'open'},baseRegion:'root-valley',marketIds:['glupishche-last-rest','glupishche-three-strikes']},
    {id:'shp_thiefgear_02',name:'Набор отмычек «Три зубца»',icon:'🗝️',image:'images/shop/thief-gear-02.png',imageThumb:'images/shop/thumbs/thief-gear-02.jpg',thiefRole:'lockpicks-basic',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'common',price:{pl:0,zl:3,sr:5,md:0},charges:3,effect:'Позволяет работать с простыми немагическими замками · осложнение гнёт один зубец, а дальнейшая попытка без замены становится шумной',desc:'Три грубых щупа в льняном свёртке. Их продают как набор подмастерья, хотя хозяева запертых дверей называют иначе.',effects:[{id:'three-teeth-lockwork',type:'world',trigger:'work-simple-lock',operation:'allow-lockwork',value:1,condition:'simple-nonmagical-lock',actionCost:'long',frequency:'charge',charges:3,stacking:'replace'},{id:'three-teeth-complication',type:'risk',trigger:'lockwork-complication',operation:'bend-tool-and-make-next-attempt-noisy',value:1,frequency:'charge',charges:3,stacking:'refresh'}],access:{markets:['city','guild'],legality:'open'},baseRegion:'root-valley',marketIds:['glupishche-three-strikes','glupishche-last-rest']},
    {id:'shp_thiefgear_03',name:'Гильдейский свёрток тихого ключника',icon:'🔐',image:'images/shop/thief-gear-03.png',imageThumb:'images/shop/thumbs/thief-gear-03.jpg',thiefRole:'lockpicks-expert',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'uncommon',price:{pl:2,zl:8,sr:0,md:0},effect:'После осмотра замка позволяет один раз за сцену превратить провал во вторую попытку без заклинивания механизма и немедленной тревоги',desc:'Точный свёрток ключников Левошлака с гибкими щупами, натяжителями и маслом. Владение им не запрещено, но вопросы задают охотно.',effects:[{id:'quiet-keywright-inspection',type:'scouting',trigger:'inspect-lock-before-working',operation:'reveal-lock-family-and-obvious-trap',value:1,condition:'lock-within-reach',actionCost:'long',frequency:'scene',stacking:'replace'},{id:'quiet-keywright-retry',type:'support',trigger:'fail-lockwork-after-inspection',operation:'allow-safe-retry',value:1,condition:'no-force-used',frequency:'scene',stacking:'replace'}],access:{markets:['guild','secret'],legality:'restricted'},baseRegion:'levoshlak',marketIds:['strannograd-bog-guild','shakhtogorye-black-anvil']},
    {id:'shp_thiefgear_04',name:'Комплект тихого проникновения',icon:'🪞',image:'images/shop/thief-gear-04.png',imageThumb:'images/shop/thumbs/thief-gear-04.jpg',thiefRole:'entry-tools',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'uncommon',price:{pl:1,zl:6,sr:0,md:0},charges:3,effect:'Перед открытием двери выявляет доступную снаружи обычную щеколду, колокольчик или нажимную нить · расходник набора позволяет безопасно подавить один найденный механизм',desc:'Крючок, клинья, угловое зеркальце, мягкий зажим и тёмный воск. Набор не помогает против магических печатей и сложных ловушек.',effects:[{id:'quiet-entry-inspection',type:'scouting',trigger:'inspect-door-before-opening',operation:'reveal-reachable-entry-mechanism',value:1,condition:'mundane-latch-bell-or-tripwire',actionCost:'long',frequency:'scene',stacking:'replace'},{id:'quiet-entry-bypass',type:'world',trigger:'bypass-revealed-mechanism',operation:'suppress-mundane-entry-alarm',value:1,condition:'mechanism-revealed-and-reachable',frequency:'charge',charges:3,stacking:'replace'}],access:{markets:['guild','secret'],legality:'restricted'},baseRegion:'levoshlak',marketIds:['strannograd-bog-guild']},
    {id:'shp_thiefgear_05',name:'Набор грима «Чужая смена»',icon:'🎭',image:'images/shop/thief-gear-05.png',imageThumb:'images/shop/thumbs/thief-gear-05.jpg',thiefRole:'disguise-kit',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},charges:5,effect:'За 10 минут создаёт немагическую маскировку лица, волос и заметных примет · обманывает беглый взгляд, но прикосновение, близкий знакомый или противоречивое поведение могут раскрыть грим',desc:'Ящик дорожных актёров с воском, сажей, накладками и прядями. Хороший образ требует подходящей одежды и знания роли.',effects:[{id:'another-shift-disguise',type:'world',trigger:'prepare-disguise-ten-minutes',operation:'create-mundane-disguise',value:1,condition:'face-hair-and-marks-only',actionCost:'long',frequency:'charge',charges:5,stacking:'replace'}],access:{markets:['local-open','city','guild'],legality:'open'},baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-last-rest']},
    {id:'shp_thiefgear_06',name:'Маска заимствованных черт',icon:'🎭',image:'images/shop/thief-gear-06.png',imageThumb:'images/shop/thumbs/thief-gear-06.jpg',thiefRole:'magic-disguise',cat:'magic',category:'accessory',slot:'face',powerTier:3,rarity:'rare',price:{pl:11,zl:0,sr:0,md:0},effect:'Раз за отдых · после минуты наблюдения копирует лицо и голос гуманоида на одну сцену · не меняет рост, телосложение и одежду',desc:'Слоёный фарфор принимает чужие черты без швов. Прикосновение, особое зрение и внимательное знание привычек могут разоблачить владельца.',effects:[{id:'borrowed-features-mask',type:'scouting',trigger:'wear-after-observing-humanoid',operation:'copy-face-and-voice',balanceOperation:'artifact-effect',value:3,condition:'observed-for-one-minute;body-and-clothing-unchanged',actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}],access:{markets:['secret','licensed'],legality:'restricted'},baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','strannograd-bog-guild']}
  ].map(function(item){
    item.tags=['thief-gear',item.thiefRole].concat(item.cat==='magic'?['magic','disguise']:['nonmagical']);
    return finishBatchItem(item,{cat:item.cat,category:item.category,slot:item.slot,tags:[],access:item.access});
  });

  // Магические фокусы усиливают заклинания владельца, а не заменяют его набор
  // чар. Палочки отвечают за точность, посохи — за удержание и форму чар,
  // боевые скипетры — за ограниченное тактическое продолжение успешного каста.
  // Только часть фокусов хранит собственное каталожное заклинание.
  var ARCANE_FOCUS_ITEMS = [
    {id:'shp_focus_staff_01',name:'Посох удержанного круга',icon:'🌿',image:'images/shop/focus-staff-01.png',imageThumb:'images/shop/thumbs/focus-staff-01.jpg',focusKind:'staff',focusRole:'sustain-zone',slot:'mainHand',handsRequired:2,powerTier:2,rarity:'uncommon',price:{pl:5,zl:0,sr:0,md:0},effect:'Раз за бой при потере концентрации сохраняет созданную владельцем зону до начала его следующего хода',desc:'Корневая развилка вцепляется в землю и принимает первый разрыв магического контура на себя. Владелец должен держать посох двумя руками и оставаться рядом с исходной точкой чар.',effects:[{id:'held-circle-staff-focus',type:'defense',trigger:'caster-would-lose-concentration-on-zone-spell',operation:'preserve-zone-until-caster-next-turn',balanceOperation:'artifact-effect',value:2,condition:'staff-held-in-two-hands-and-caster-within-one-cell-of-cast-origin',frequency:'combat',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','lesorubka-artel-yard']},
    {id:'shp_focus_staff_02',name:'Посох приливного мерила',icon:'🌊',image:'images/shop/focus-staff-02.png',imageThumb:'images/shop/thumbs/focus-staff-02.jpg',focusKind:'staff',focusRole:'shape-element',slot:'mainHand',handsRequired:2,powerTier:2,rarity:'uncommon',price:{pl:4,zl:5,sr:0,md:0},effect:'Раз за бой исключает одну клетку из зоны заклинания холода или воды · хранит «Ледяной Шепот»',desc:'Подвижные кольца на солёном древке отмеряют границу волны. Собственное заклинание следует записи энциклопедии и восстанавливается после долгого отдыха.',boundSpell:{spellRefId:1775565586025,spellName:'Ледяной Шепот',spellLevel:1,charges:1,recharge:'long-rest'},effects:[{id:'tide-measure-shape-spell',type:'control',trigger:'cast-cold-or-water-area-spell',operation:'exclude-one-cell-from-spell-area',balanceOperation:'artifact-effect',value:2,condition:'staff-held-in-two-hands',frequency:'combat',stacking:'replace'},{id:'tide-measure-bound-spell',type:'support',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1775565586025,spellLevel:1,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','glupishche-hypnoks-eye']},
    {id:'shp_focus_staff_03',name:'Посох пепельного предела',icon:'🔥',image:'images/shop/focus-staff-03.png',imageThumb:'images/shop/thumbs/focus-staff-03.jpg',focusKind:'staff',focusRole:'contain-element',slot:'mainHand',handsRequired:2,powerTier:2,rarity:'rare',price:{pl:7,zl:5,sr:0,md:0},effect:'Раз за бой огненное заклинание владельца не воспламеняет выбранный предмет или одну соседнюю клетку',desc:'Холодный уголь в железной клетке втягивает лишнее пламя. Посох не уменьшает урон существам и не отменяет остальные последствия заклинания.',effects:[{id:'ash-boundary-contain-spell',type:'support',trigger:'cast-fire-spell-that-ignites-environment',operation:'protect-one-object-or-adjacent-cell-from-ignition',balanceOperation:'artifact-effect',value:2,condition:'does-not-protect-creatures-or-reduce-spell-damage',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},
    {id:'shp_focus_staff_04',name:'Посох башенного разрыва',icon:'🔔',image:'images/shop/focus-staff-04.png',imageThumb:'images/shop/thumbs/focus-staff-04.jpg',focusKind:'staff',focusRole:'extend-control',slot:'mainHand',handsRequired:2,powerTier:3,rarity:'rare',price:{pl:12,zl:0,sr:0,md:0},effect:'Раз за бой увеличивает дальность контрольного заклинания на один диапазон, но владелец теряет движение в этот ход',desc:'Бронзовые диски выстраивают дальний резонанс между магом и целью. Усиление не расширяет площадь заклинания и не помогает чарам без указанной дальности.',effects:[{id:'tower-rift-extend-control',type:'tempo',trigger:'cast-ranged-control-spell',operation:'extend-spell-range-one-band',balanceOperation:'artifact-effect',value:3,condition:'staff-held-in-two-hands;caster-forgoes-movement;does-not-expand-area',frequency:'combat',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','shakhtogorye-black-anvil']},

    {id:'shp_focus_wand_01',name:'Палочка точного контура',icon:'🪄',image:'images/shop/focus-wand-01.png',imageThumb:'images/shop/thumbs/focus-wand-01.jpg',focusKind:'wand',focusRole:'precision',slot:'mainHand',handsRequired:1,powerTier:1,rarity:'uncommon',price:{pl:2,zl:5,sr:0,md:0},effect:'Раз за бой одиночное заклинание владельца игнорирует половинное укрытие цели',desc:'Костяная игла обводит цель тонкой меловой нитью. Полное укрытие, отсутствие видимости и обычная дальность заклинания сохраняются.',effects:[{id:'exact-contour-ignore-half-cover',type:'support',trigger:'cast-single-target-spell-at-half-covered-target',operation:'ignore-half-cover-for-spell',balanceOperation:'artifact-effect',value:1,condition:'target-visible-and-within-spell-range;does-not-ignore-full-cover',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},
    {id:'shp_focus_wand_02',name:'Палочка тихой искры',icon:'✨',image:'images/shop/focus-wand-02.png',imageThumb:'images/shop/thumbs/focus-wand-02.jpg',focusKind:'wand',focusRole:'subtle-fire',slot:'mainHand',handsRequired:1,powerTier:2,rarity:'uncommon',price:{pl:3,zl:0,sr:0,md:0},effect:'Огненные чары не выдают владельца громким хлопком · хранит «Жар Пальцев»',desc:'Медные рожки гасят звук рождения пламени, но не скрывают свет, запах и сам полёт огня. Собственные чары следуют записи энциклопедии.',boundSpell:{spellRefId:1773673009471,spellName:'Жар Пальцев',spellLevel:1,charges:1,recharge:'combat'},effects:[{id:'quiet-spark-subtle-fire',type:'support',trigger:'cast-fire-spell-through-wand',operation:'suppress-spell-ignition-sound',balanceOperation:'artifact-effect',value:1,condition:'does-not-hide-light-smell-projectile-or-impact',frequency:'passive',stacking:'unique-source'},{id:'quiet-spark-bound-spell',type:'damage',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1773673009471,spellLevel:1,charges:1,recharge:'combat',frequency:'charge',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','glupishche-hypnoks-eye']},
    {id:'shp_focus_wand_03',name:'Палочка шовной лозы',icon:'🧵',image:'images/shop/focus-wand-03.png',imageThumb:'images/shop/thumbs/focus-wand-03.jpg',focusKind:'wand',focusRole:'support-reach',slot:'mainHand',handsRequired:1,powerTier:3,rarity:'uncommon',price:{pl:3,zl:5,sr:0,md:0},effect:'Раз за бой позволяет применить заклинание прикосновения к союзнику в соседней клетке · хранит «Починку»',desc:'Серебряная игла выбрасывает короткую лозу-проводник. Усиление работает только на согласного союзника и не переносит вредоносные чары.',boundSpell:{spellRefId:1775565731791,spellName:'Починка',spellLevel:2,charges:1,recharge:'long-rest'},effects:[{id:'stitch-vine-support-reach',type:'support',trigger:'cast-beneficial-touch-spell-on-willing-ally',operation:'deliver-touch-spell-to-adjacent-cell',balanceOperation:'artifact-effect',value:2,condition:'willing-ally;not-harmful-spell',frequency:'combat',stacking:'replace'},{id:'stitch-vine-bound-spell',type:'support',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1775565731791,spellLevel:2,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','lesorubka-artel-yard']},
    {id:'shp_focus_wand_04',name:'Палочка зеркальной росы',icon:'💧',image:'images/shop/focus-wand-04.png',imageThumb:'images/shop/thumbs/focus-wand-04.jpg',focusKind:'wand',focusRole:'reveal-on-hit',slot:'mainHand',handsRequired:1,powerTier:2,rarity:'rare',price:{pl:5,zl:5,sr:0,md:0},effect:'Раз за бой заклинание, затронувшее невидимую цель, оставляет видимый контур до конца её следующего хода',desc:'Зеркальная капля цепляется только за уже найденную цель. Она не обнаруживает невидимых сама и не отменяет статус Невидим, но показывает положение силуэта.',effects:[{id:'mirror-dew-outline-spell-target',type:'scouting',trigger:'spell-successfully-affects-invisible-target',operation:'outline-invisible-target-position',balanceOperation:'artifact-effect',value:2,duration:'until-target-next-turn-end',condition:'target-was-already-selected-or-inside-spell-area;does-not-remove-invisibility',frequency:'combat',stacking:'refresh'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','ztuz-licensed-counter']},

    {id:'shp_focus_scepter_01',name:'Боевой скипетр громового уступа',icon:'⚡',image:'images/shop/focus-scepter-01.png',imageThumb:'images/shop/thumbs/focus-scepter-01.jpg',focusKind:'scepter',focusRole:'spell-push',cat:'magic',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:5,rarity:'rare',price:{pl:10,zl:0,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Электрический',range:'Дальняя / 6 клеток',effect:'Оружие 1d6 молнией · раз за бой заклинание владельца отталкивает одну поражённую цель на 2 клетки · хранит «Лассо Молнии»',desc:'Раздвоенное навершие подхватывает уже выпущенные чары. Толчок не действует на цель крупнее владельца более чем на одну категорию; собственное Лассо следует каталогу.',boundSpell:{spellRefId:1774549339231,spellName:'Лассо Молнии',spellLevel:2,charges:1,recharge:'long-rest'},effects:[{id:'thunder-ledge-spell-push',type:'control',trigger:'damage-spell-successfully-affects-target',operation:'push-one-affected-target-cells',balanceOperation:'artifact-effect',value:3,cells:2,condition:'target-at-most-one-size-larger',frequency:'combat',stacking:'replace'},{id:'thunder-ledge-bound-spell',type:'control',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774549339231,spellLevel:2,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','kazad-drom-thundering-mountain']},
    {id:'shp_focus_scepter_02',name:'Боевой скипетр пепельной печати',icon:'🔥',image:'images/shop/focus-scepter-02.png',imageThumb:'images/shop/thumbs/focus-scepter-02.jpg',focusKind:'scepter',focusRole:'spell-healing-lock',cat:'magic',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:3,rarity:'rare',price:{pl:9,zl:0,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Огненный',range:'Дальняя / 5 клеток',effect:'Оружие 1d6 огнём · раз за бой огненные или некротические чары запрещают одной поражённой цели восстанавливать HP до конца её следующего хода',desc:'Пепельная печать продолжает успешный каст серым знаком на ране. Она не срабатывает без урона и не мешает снимать состояния.',effects:[{id:'ash-seal-spell-healing-lock',type:'control',trigger:'fire-or-necrotic-spell-deals-damage',operation:'suppress-healing-on-one-affected-target',balanceOperation:'prepare-counter',value:3,duration:'until-target-next-turn-end',frequency:'combat',stacking:'refresh'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','strannograd-bog-guild']},
    {id:'shp_focus_scepter_03',name:'Боевой скипетр холодного прилива',icon:'❄️',image:'images/shop/focus-scepter-03.png',imageThumb:'images/shop/thumbs/focus-scepter-03.jpg',focusKind:'scepter',focusRole:'spell-dash-lock',cat:'magic',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:3,rarity:'rare',price:{pl:8,zl:0,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Холодный',range:'Дальняя / 6 клеток',effect:'Оружие 1d6 холодом · раз за бой заклинание холода или контроля запрещает одной поражённой цели Рывок до конца следующего хода',desc:'Серебряный полумесяц оставляет на чужих чарах тонкую ледяную кромку. Обычное движение цели сохраняется.',effects:[{id:'cold-tide-spell-dash-lock',type:'control',trigger:'cold-or-control-spell-successfully-affects-target',operation:'block-dash-on-one-affected-target',balanceOperation:'artifact-effect',value:2,duration:'until-target-next-turn-end',frequency:'combat',stacking:'refresh'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','glupishche-hypnoks-eye']},
    {id:'shp_focus_scepter_04',name:'Боевой скипетр разбитого хора',icon:'🔔',image:'images/shop/focus-scepter-04.png',imageThumb:'images/shop/thumbs/focus-scepter-04.jpg',focusKind:'scepter',focusRole:'spell-reaction-lock',cat:'magic',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:2,rarity:'rare',price:{pl:8,zl:5,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Звуковой',range:'Дальняя / 5 клеток',effect:'Оружие 1d6 звуком · раз за бой вредоносное заклинание лишает одну слышащую поражённую цель реакции до начала её следующего хода',desc:'Треснувший колокол вплетает несовпадающую ноту в успешный каст. Глухие существа и цели, которых заклинание не затронуло, сохраняют реакцию.',effects:[{id:'broken-choir-spell-reaction-lock',type:'control',trigger:'harmful-spell-successfully-affects-hearing-target',operation:'disable-reaction-on-one-affected-target',balanceOperation:'artifact-effect',value:2,duration:'until-target-next-turn-start',condition:'target-can-hear',frequency:'combat',stacking:'refresh'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},

    {id:'shp_focus_staff_05',name:'Посох зеркального бастиона',icon:'🪞',image:'images/shop/focus-staff-mirror-bastion.png',imageThumb:'images/shop/thumbs/focus-staff-mirror-bastion.jpg',focusKind:'staff',focusRole:'reflect-defense',slot:'mainHand',handsRequired:2,powerTier:5,rarity:'epic',price:{pl:16,zl:0,sr:0,md:0},effect:'Раз за бой защитные чары дают цели половинное укрытие от следующей дальней магической атаки · хранит «Зеркальный Панцирь»',desc:'Три дымчатых зеркала смыкаются вокруг уже наложенной защиты. Укрытие исчезает после первой дальней магической атаки или в начале следующего хода заклинателя.',boundSpell:{spellRefId:1774554832785,spellName:'Зеркальный Панцирь',spellLevel:3,charges:1,recharge:'long-rest'},effects:[{id:'mirror-bastion-spell-cover',type:'defense',trigger:'cast-defensive-spell-on-self-or-ally',operation:'grant-half-cover-against-next-ranged-spell-attack',balanceOperation:'artifact-effect',value:3,duration:'until-caster-next-turn-start-or-triggered',condition:'staff-held-in-two-hands',frequency:'combat',stacking:'replace'},{id:'mirror-bastion-bound-spell',type:'defense',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774554832785,spellLevel:3,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},
    {id:'shp_focus_staff_06',name:'Посох корневой поступи',icon:'🌱',image:'images/shop/focus-staff-root-step.png',imageThumb:'images/shop/thumbs/focus-staff-root-step.jpg',focusKind:'staff',focusRole:'move-zone',slot:'mainHand',handsRequired:2,powerTier:3,rarity:'rare',price:{pl:10,zl:0,sr:0,md:0},effect:'Раз за бой в начале следующего хода сдвигает созданную владельцем зону земли или растений на соседнюю клетку',desc:'Шарнирные корни переставляют границу чар, не расширяя её. Между старой и новой точкой должна быть непрерывная земля, а посох всё время остаётся в двух руках.',effects:[{id:'root-step-move-spell-zone',type:'control',trigger:'caster-starts-turn-after-casting-earth-or-plant-zone-spell',operation:'move-spell-zone-origin-one-adjacent-cell',balanceOperation:'artifact-effect',value:3,condition:'continuous-ground;staff-held-in-two-hands;area-and-duration-unchanged',frequency:'combat',stacking:'replace'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-hypnoks-eye']},
    {id:'shp_focus_staff_07',name:'Посох источниковой вилки',icon:'⚡',image:'images/shop/focus-staff-source-fork.png',imageThumb:'images/shop/thumbs/focus-staff-source-fork.jpg',focusKind:'staff',focusRole:'split-energy',slot:'mainHand',handsRequired:2,powerTier:4,rarity:'rare',price:{pl:14,zl:0,sr:0,md:0},effect:'Раз за бой от поражённой энергетическими чарами цели отскакивает одна кость того же урона в соседнюю цель · хранит «Всполох Источника»',desc:'Медная развилка забирает только один импульс успешного заклинания. Вторая цель должна быть видна, стоять рядом с первой и не получает прочих эффектов исходных чар.',boundSpell:{spellRefId:1774697604591,spellName:'Всполох Источника',spellLevel:1,charges:1,recharge:'long-rest'},effects:[{id:'source-fork-split-spell-energy',type:'damage',trigger:'energy-damage-spell-successfully-affects-target',operation:'deal-one-source-damage-die-to-adjacent-second-target',balanceOperation:'artifact-effect',value:3,condition:'second-target-visible-and-adjacent;no-secondary-spell-effects',frequency:'combat',stacking:'replace'},{id:'source-fork-bound-spell',type:'damage',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774697604591,spellLevel:1,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','kazad-drom-thundering-mountain']},
    {id:'shp_focus_staff_08',name:'Посох луча надежды',icon:'☀️',image:'images/shop/focus-staff-ray-of-hope.png',imageThumb:'images/shop/thumbs/focus-staff-ray-of-hope.jpg',focusKind:'staff',focusRole:'share-support',slot:'mainHand',handsRequired:2,powerTier:5,rarity:'epic',price:{pl:18,zl:0,sr:0,md:0},effect:'Раз за бой после благотворных чар их цель может сразу сместиться на одну клетку без ответной реакции · хранит «Луч Надежды»',desc:'Солнечный камень продолжает движение поддерживающей магии. Смещение добровольное, не проходит сквозь препятствия и не действует на самого заклинателя.',boundSpell:{spellRefId:1774562047012,spellName:'Луч Надежды',spellLevel:3,charges:1,recharge:'long-rest'},effects:[{id:'hope-ray-spell-step',type:'tempo',trigger:'cast-beneficial-spell-on-willing-ally',operation:'allow-target-step-one-cell-without-reaction',balanceOperation:'artifact-effect',value:3,condition:'target-is-not-caster;destination-open',frequency:'combat',stacking:'replace'},{id:'hope-ray-bound-spell',type:'support',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774562047012,spellLevel:3,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','dorogograd-golden-measure']},

    {id:'shp_focus_wand_05',name:'Палочка лживого лика',icon:'🎭',image:'images/shop/focus-wand-false-face.png',imageThumb:'images/shop/thumbs/focus-wand-false-face.jpg',focusKind:'wand',focusRole:'sustain-illusion',slot:'mainHand',handsRequired:1,powerTier:4,rarity:'rare',price:{pl:7,zl:0,sr:0,md:0},effect:'Раз за бой перемещает созданную владельцем иллюзию на один диапазон без повторного каста · хранит «Иллюзию»',desc:'Пустые костяные лики запоминают положение обмана. Размер, длительность и свойства иллюзии не меняются; путь перемещения не проходит сквозь преграды.',boundSpell:{spellRefId:1774566110687,spellName:'Иллюзия',spellLevel:2,charges:1,recharge:'long-rest'},effects:[{id:'false-face-move-illusion-spell',type:'control',trigger:'caster-controls-own-active-illusion-spell',operation:'move-illusion-one-range-band',balanceOperation:'artifact-effect',value:3,condition:'path-open;spell-size-duration-and-properties-unchanged',frequency:'combat',stacking:'replace'},{id:'false-face-bound-spell',type:'control',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774566110687,spellLevel:2,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','glupishche-hypnoks-eye']},
    {id:'shp_focus_wand_06',name:'Палочка встречного крюка',icon:'🪝',image:'images/shop/focus-wand-intercept-hook.png',imageThumb:'images/shop/thumbs/focus-wand-intercept-hook.jpg',focusKind:'wand',focusRole:'read-counterspell',slot:'mainHand',handsRequired:1,powerTier:2,rarity:'uncommon',price:{pl:5,zl:0,sr:0,md:0},effect:'Раз за бой перед контрзаклинанием показывает школу и видимую ступень чужого каста',desc:'Обратные зубцы цепляют рисунок проявившихся чар. Палочка не раскрывает скрытый каст, точный эффект или выбор цели и ничего не отменяет сама.',effects:[{id:'intercept-hook-read-spell',type:'scouting',trigger:'caster-sees-another-creature-cast-spell-before-counterspell-decision',operation:'reveal-spell-school-and-apparent-level',balanceOperation:'artifact-effect',value:2,condition:'spell-manifestation-visible;does-not-reveal-target-or-full-effect',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','glupishche-hypnoks-eye']},
    {id:'shp_focus_wand_07',name:'Палочка немой черты',icon:'〰️',image:'images/shop/focus-wand-silent-line.png',imageThumb:'images/shop/thumbs/focus-wand-silent-line.jpg',focusKind:'wand',focusRole:'bend-line',slot:'mainHand',handsRequired:1,powerTier:3,rarity:'rare',price:{pl:9,zl:0,sr:0,md:0},effect:'Раз за бой позволяет линейному заклинанию один раз повернуть под прямым углом, не увеличивая общую длину',desc:'Серебряное кольцо задаёт место излома. Линия не проходит через полное укрытие, не возвращается назад и сохраняет исходную ширину.',effects:[{id:'silent-line-bend-spell',type:'control',trigger:'cast-line-shaped-spell',operation:'bend-spell-line-once-at-right-angle',balanceOperation:'artifact-effect',value:3,condition:'total-length-and-width-unchanged;cannot-cross-full-cover-or-reverse',frequency:'combat',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','strannograd-bog-guild']},

    {id:'shp_focus_bracer_01',name:'Наручи обратного импульса',icon:'🛡️',image:'images/shop/focus-bracer-reverse-impulse.png',imageThumb:'images/shop/thumbs/focus-bracer-reverse-impulse.jpg',focusKind:'bracer',focusRole:'absorb-recoil',slot:'wrists',handsRequired:0,powerTier:2,rarity:'uncommon',price:{pl:6,zl:0,sr:0,md:0},effect:'Раз за бой вдвое уменьшают урон магической отдачи владельцу, но лишают его движения в следующий ход',desc:'Янтарные камни принимают обратный толчок неудавшихся чар. Наручи не уменьшают урон от врагов и не предотвращают остальные последствия срыва.',effects:[{id:'reverse-impulse-absorb-caster-recoil',type:'defense',trigger:'caster-takes-magical-recoil-from-own-spell',operation:'halve-own-spell-recoil-damage',balanceOperation:'artifact-effect',value:2,condition:'caster-forgoes-movement-next-turn;does-not-reduce-enemy-damage',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','kazad-drom-thundering-mountain']},
    {id:'shp_focus_bracer_02',name:'Наручи замкнутого круга',icon:'⭕',image:'images/shop/focus-bracer-closed-circle.png',imageThumb:'images/shop/thumbs/focus-bracer-closed-circle.jpg',focusKind:'bracer',focusRole:'hold-concentration',slot:'wrists',handsRequired:0,powerTier:2,rarity:'rare',price:{pl:8,zl:0,sr:0,md:0},effect:'Раз за бой сохраняют концентрацию после принудительного перемещения до конца следующего хода, если владелец сам не движется',desc:'Бронзовые окружности удерживают разорванную позу ещё несколько ударов сердца. Урон и другие причины потери концентрации наручи не отменяют.',effects:[{id:'closed-circle-hold-caster-concentration',type:'defense',trigger:'caster-would-lose-concentration-from-forced-movement',operation:'preserve-concentration-until-next-turn-end',balanceOperation:'artifact-effect',value:2,condition:'caster-does-not-move-voluntarily;other-break-causes-still-apply',frequency:'combat',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','lesorubka-artel-yard']},
    {id:'shp_focus_bracer_03',name:'Наручи шести жил',icon:'🌈',image:'images/shop/focus-bracer-six-veins.png',imageThumb:'images/shop/thumbs/focus-bracer-six-veins.jpg',focusKind:'bracer',focusRole:'energy-ward',slot:'wrists',handsRequired:0,powerTier:5,rarity:'epic',price:{pl:12,zl:0,sr:0,md:0},effect:'Перед защитной реакцией показывают тип входящей энергии · хранят «Защиту от Энергии»',desc:'Шесть минеральных жил отвечают на огонь, холод, молнию, кислоту, яд и звук. Они определяют только явно направленный в владельца энергетический эффект.',boundSpell:{spellRefId:1774554691599,spellName:'Защита от Энергии',spellLevel:3,charges:1,recharge:'long-rest'},effects:[{id:'six-veins-read-spell-energy',type:'scouting',trigger:'caster-targeted-by-visible-energy-spell-before-defensive-reaction',operation:'reveal-incoming-energy-damage-type',balanceOperation:'artifact-effect',value:2,condition:'energy-effect-visible-and-targets-wearer',frequency:'combat',stacking:'replace'},{id:'six-veins-bound-spell',type:'defense',trigger:'invoke-bound-spell',operation:'cast-catalog-spell',spellRefId:1774554691599,spellLevel:3,charges:1,recharge:'long-rest',frequency:'charge',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','kazad-drom-thundering-mountain']},

    {id:'shp_focus_glove_01',name:'Перчатки проводящего шва',icon:'🧤',image:'images/shop/focus-glove-conducting-seam.png',imageThumb:'images/shop/thumbs/focus-glove-conducting-seam.jpg',focusKind:'glove',focusRole:'conduct-touch',slot:'hands',handsRequired:0,powerTier:1,rarity:'uncommon',price:{pl:4,zl:5,sr:0,md:0},effect:'Заклинания прикосновения проходят через обычную одежду и мягкую кожу, но не через доспех или твёрдую преграду',desc:'Серебряный шов переносит контакт с кончиков пальцев на внешнюю сторону перчатки. Дальность прикосновения не меняется.',effects:[{id:'conducting-seam-touch-spell',type:'support',trigger:'cast-touch-spell-through-ordinary-cloth-or-soft-leather',operation:'conduct-touch-spell-through-soft-covering',balanceOperation:'artifact-effect',value:1,condition:'does-not-cross-armor-rigid-barrier-or-distance',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-hypnoks-eye','lesorubka-artel-yard']},
    {id:'shp_focus_glove_02',name:'Перчатки разделённого знака',icon:'✋',image:'images/shop/focus-glove-divided-sign.png',imageThumb:'images/shop/thumbs/focus-glove-divided-sign.jpg',focusKind:'glove',focusRole:'divide-support',slot:'hands',handsRequired:0,powerTier:3,rarity:'rare',price:{pl:7,zl:0,sr:0,md:0},effect:'Раз за бой делят одиночные благотворные чары между двумя соседними союзниками без удвоения силы',desc:'Каждая ладонь завершает половину одного знака. Лечение и числовой запас делятся поровну, а длительность для обеих целей сокращается вдвое.',effects:[{id:'divided-sign-split-beneficial-spell',type:'support',trigger:'cast-single-target-beneficial-spell-on-two-adjacent-willing-allies',operation:'split-spell-benefit-between-two-targets',balanceOperation:'artifact-effect',value:3,condition:'healing-and-numeric-pool-divided;duration-halved;does-not-duplicate-benefit',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','dorogograd-golden-measure']},
    {id:'shp_focus_glove_03',name:'Перчатки немого счёта',icon:'🤫',image:'images/shop/focus-glove-silent-count.png',imageThumb:'images/shop/thumbs/focus-glove-silent-count.jpg',focusKind:'glove',focusRole:'silent-cast',slot:'hands',handsRequired:0,powerTier:4,rarity:'rare',price:{pl:9,zl:0,sr:0,md:0},effect:'Раз за долгий отдых позволяют сотворить выученное заклинание без голоса, даже в магической тишине',desc:'Костяные бусины отсчитывают слова движением пальцев. Нужны свободные жесты; связывание рук и прочие компоненты заклинания продолжают действовать.',effects:[{id:'silent-count-cast-spell-without-voice',type:'support',trigger:'caster-casts-learned-spell-with-verbal-component',operation:'replace-verbal-component-with-visible-finger-count',balanceOperation:'artifact-effect',value:3,condition:'hands-free-and-not-restrained;other-components-required',frequency:'long-rest',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','glupishche-hypnoks-eye']}
  ].map(function(item){
    item.cat=item.cat||'magic';
    item.category=item.category||'tool';
    item.tags=['magic','arcane-focus',item.focusKind].concat(item.category==='weapon'?['weapon','ranged']:[]);
    item.access=item.access||{markets:item.focusKind==='scepter'?['licensed','guild']:['guild','licensed'],legality:item.focusKind==='scepter'?'restricted':'open'};
    var finished = finishBatchItem(item,{cat:item.cat,category:item.category,slot:item.slot,tags:[],access:item.access});
    finished.definitionVersion = 2;
    return finished;
  });

  var PROSTHESIS_ITEMS = [
    {id:'shp_prosthesis_01',name:'Трактовая голень Глупища',icon:'🦿',image:'images/shop/prosthesis-01.png',imageThumb:'images/shop/thumbs/prosthesis-01.jpg',prosthesisSlot:'lower-leg',material:'wood-leather',powerTier:0,rarity:'common',price:{pl:0,zl:4,sr:0,md:0},effect:'Заменяет утраченную голень и позволяет обычно ходить по твёрдой дороге',desc:'Ясеневая колодка, кожаная гильза и сменный железный подпятник. Подгоняется мастером и не предназначена для бега по сложной местности.',effects:[{id:'glupishche-road-shin',type:'world',trigger:'wear-fitted-prosthesis',operation:'restore-ordinary-road-walking',value:1,frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-three-strikes','glupishche-last-rest']},
    {id:'shp_prosthesis_02',name:'Шарнирная нога каменщика',icon:'🦿',image:'images/shop/prosthesis-02.png',imageThumb:'images/shop/thumbs/prosthesis-02.jpg',prosthesisSlot:'whole-leg',material:'steel-leather',powerTier:1,rarity:'uncommon',price:{pl:1,zl:4,sr:0,md:0},effect:'Раз за сцену запирает колено и позволяет устоять на неровной опоре или при слабом толчке',desc:'Тяжёлая нога с зубчатым коленным замком и широкой ступнёй. В запертом положении владелец не может сделать Рывок до начала своего следующего хода.',effects:[{id:'mason-locking-leg',type:'defense',trigger:'brace-on-uneven-ground-or-minor-push',operation:'brace-with-locking-knee',balanceOperation:'artifact-effect',value:1,condition:'standing-and-knee-can-lock',actionCost:'reaction',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},
    {id:'shp_prosthesis_03',name:'Крюковая кисть Морелесья',icon:'🪝',image:'images/shop/prosthesis-03.png',imageThumb:'images/shop/thumbs/prosthesis-03.jpg',prosthesisSlot:'hand',material:'iron-leather',powerTier:1,rarity:'common',price:{pl:0,zl:9,sr:0,md:0},effect:'Преимущество при удержании мокрого каната, сети или борта · не годится для тонкой работы',desc:'Широкий морской крюк с поворотным кольцом и кожаной манжетой. Его легко снять и заменить ложкой, молотком или обычной насадкой.',effects:[{id:'moreles-hook-hand-grip',type:'world',trigger:'hold-wet-rope-net-or-rail',operation:'grant-advantage',value:1,condition:'hook-can-catch',frequency:'passive',stacking:'highest'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','glupishche-last-rest']},
    {id:'shp_prosthesis_04',name:'Артельная рука семи шарниров',icon:'🦾',image:'images/shop/prosthesis-04.png',imageThumb:'images/shop/thumbs/prosthesis-04.jpg',prosthesisSlot:'forearm-and-hand',material:'bronze-steel-leather',powerTier:1,rarity:'uncommon',price:{pl:2,zl:2,sr:0,md:0},effect:'Раз за сцену фиксирует хват: предмет нельзя выбить до начала следующего хода',desc:'Бронзовое предплечье с тросовыми пальцами и ладонным замком. Захват надёжен, но открыть зафиксированную кисть можно только коротким действием.',effects:[{id:'seven-joint-artel-arm',type:'defense',trigger:'lock-prosthetic-grip',operation:'prevent-item-break',value:1,condition:'held-object-fits-hand',actionCost:'reaction',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},
    {id:'shp_prosthesis_05',name:'Глаз коптильного стекла',icon:'👁️',image:'images/shop/prosthesis-05.png',imageThumb:'images/shop/thumbs/prosthesis-05.jpg',prosthesisSlot:'eye',material:'smoked-glass-silver',powerTier:2,rarity:'rare',price:{pl:3,zl:8,sr:0,md:0},effect:'Раз за сцену на 2 раунда различает движение и тепло сквозь обычный дым в 3 клетках',desc:'Тёмная линза в серебряной глазнице нагревается рядом с живым телом. Она не видит сквозь стены, магическую тьму и неподвижные холодные предметы.',effects:[{id:'smoked-glass-eye',type:'scouting',trigger:'open-prosthetic-shutter',operation:'see-motion-and-heat-through-smoke',balanceOperation:'artifact-effect',value:2,condition:'ordinary-smoke-within-three-cells',durationRounds:2,actionCost:'short',frequency:'scene',stacking:'refresh'}],baseRegion:'levoshlak',marketIds:['sandy-acorn-salvage','levoshlak-tower-vault']},
    {id:'shp_prosthesis_06',name:'Ухо башенного резонанса',icon:'👂',image:'images/shop/prosthesis-06.png',imageThumb:'images/shop/thumbs/prosthesis-06.jpg',prosthesisSlot:'ear',material:'bronze-bone',powerTier:2,rarity:'rare',price:{pl:4,zl:5,sr:0,md:0},effect:'Раз за сцену слышит речь и шаги через обычную дверь или тонкую стену в пределах 2 клеток',desc:'Костяная раковина соединена с тремя бронзовыми мембранами. Пока ухо прижато к поверхности, владелец почти не слышит происходящее позади.',effects:[{id:'tower-resonance-ear',type:'scouting',trigger:'press-ear-to-solid-surface',operation:'listen-through-thin-barrier',balanceOperation:'artifact-effect',value:2,condition:'ordinary-door-or-thin-wall-within-two-cells',actionCost:'long',frequency:'scene',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','strannograd-bog-guild']},
    {id:'shp_prosthesis_07',name:'Серебряная челюсть Безымянного',icon:'🦷',image:'images/shop/prosthesis-07.png',imageThumb:'images/shop/thumbs/prosthesis-07.jpg',prosthesisSlot:'jaw',material:'grave-silver-black-iron',powerTier:3,rarity:'epic',price:{pl:8,zl:0,sr:0,md:0},effect:'Раз за отдых произносит одну предупреждающую фразу сквозь магическое молчание · затем голос пропадает до конца сцены',desc:'Серебряные зубы закреплены в чёрной железной дуге без клейма мастера. Челюсть передаёт только короткое предупреждение и не позволяет читать заклинания в молчании.',effects:[{id:'nameless-silver-jaw',type:'support',trigger:'speak-warning-through-magical-silence',operation:'carry-short-warning-through-silence',balanceOperation:'artifact-effect',value:3,condition:'one-non-spell-phrase-up-to-twelve-words',actionCost:'short',frequency:'charge',charges:1,stacking:'replace'},{id:'nameless-jaw-voice-cost',type:'risk',trigger:'after-warning-through-silence',operation:'lose-voice',value:2,duration:'until-scene-end',frequency:'charge',charges:1,stacking:'refresh'}],baseRegion:'levoshlak',marketIds:['levoshlak-tower-vault','strannograd-bog-guild'],access:{markets:['secret'],legality:'restricted'}}
  ].map(function(item){
    item.tags=['prosthesis','body-replacement',item.prosthesisSlot].concat(item.powerTier>=2?['magic']:['nonmagical']);
    return finishBatchItem(item,{cat:item.powerTier>=2?'magic':'tool',category:'prosthesis',slot:'utility',tags:[],access:item.access||{markets:item.powerTier>=2?['guild','licensed']:['city','guild'],legality:'open'}});
  });

  var TRANSPORT_ITEMS = [
    {id:'shp_transport_horse_01',name:'Глушак, тяжёлая упряжная',icon:'🐴',image:'images/shop/transport-horse-01.png',imageThumb:'images/shop/thumbs/transport-horse-01.jpg',transportKind:'horse',capacityKg:900,powerTier:0,rarity:'common',price:{pl:3,zl:2,sr:0,md:0},effect:'Спокойно тянет тяжёлую повозку и не пугается обычного грохота · не годится для скачки',desc:'Старая широкогрудая лошадь конюшни «Тук да бряк». Медлительна, зато привычна к молотам, колёсам и крику ярмарки.',effects:[{id:'glushak-heavy-draft',type:'world',trigger:'pull-heavy-wagon-through-ordinary-noise',operation:'keep-draft-horse-calm',value:1,condition:'ordinary-road-and-no-combat',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-tuk-da-bryak']},
    {id:'shp_transport_horse_02',name:'Шайка, рыжая скаковая',icon:'🐎',image:'images/shop/transport-horse-02.png',imageThumb:'images/shop/thumbs/transport-horse-02.jpg',transportKind:'horse',capacityKg:120,powerTier:1,rarity:'uncommon',price:{pl:3,zl:8,sr:0,md:0},effect:'Раз за дорожную сцену опережает обычную погоню на открытом тракте · громкий удар заставляет проверить управление',desc:'Нервная рыжая кобыла, выведенная для курьеров. Быстро набирает ход и первой замечает запах дыма, но требует уверенного всадника.',effects:[{id:'shaika-open-road-burst',type:'tempo',trigger:'urge-mount-during-open-road-pursuit',operation:'gain-pursuit-lead',balanceOperation:'artifact-effect',value:1,condition:'open-road-and-skilled-rider',actionCost:'movement',frequency:'scene',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-tuk-da-bryak','glupishche-root-post']},
    {id:'shp_transport_horse_03',name:'Крошка Дуня, дорожная упряжная',icon:'🐴',image:'images/shop/transport-horse-03.png',imageThumb:'images/shop/thumbs/transport-horse-03.jpg',transportKind:'horse',capacityKg:650,powerTier:0,rarity:'common',price:{pl:2,zl:9,sr:0,md:0},effect:'Без понукания тянет среднюю повозку весь обычный дорожный переход',desc:'Молодая спокойная кобыла без выдающейся скорости. Хорошо держит шаг с обозом, но легко отвлекается на резкие птичьи крики.',effects:[{id:'dunya-steady-road-draft',type:'world',trigger:'make-ordinary-road-journey',operation:'sustain-medium-wagon-pace',value:1,condition:'maintained-road-and-normal-load',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-tuk-da-bryak','glupishche-three-ruts']},
    {id:'shp_transport_horse_04',name:'Седой Уступ, горный верховой',icon:'🐎',image:'images/shop/transport-horse-04.png',imageThumb:'images/shop/thumbs/transport-horse-04.jpg',transportKind:'horse',capacityKg:150,powerTier:1,rarity:'rare',price:{pl:9,zl:5,sr:0,md:0},effect:'Уверенно проходит узкую каменную тропу и первый раз за сцену останавливается перед ненадёжной опорой',desc:'Седой мерин из Верхземья с короткой сильной ногой. Не любит болото и глубокий снег, зато редко ошибается на осыпи.',effects:[{id:'grey-ledge-mountain-step',type:'scouting',trigger:'cross-narrow-rocky-route',operation:'detect-first-unsafe-footing',balanceOperation:'artifact-effect',value:1,condition:'rocky-trail-and-rider-allows-mount-to-choose-step',frequency:'passive',stacking:'unique-source'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','fishhook-import-row']},

    {id:'shp_transport_wagon_01',name:'Бочечная телега «Квасолёт»',icon:'🛒',image:'images/shop/transport-wagon-01.png',imageThumb:'images/shop/thumbs/transport-wagon-01.jpg',transportKind:'wagon',capacityKg:450,powerTier:0,rarity:'common',price:{pl:1,zl:4,sr:0,md:0},effect:'Перевозит до 6 бочек; боковые скобы позволяют разгрузить их без подъёмного крана',desc:'Низкая двухколёсная телега с выгнутыми ложементами. На пустом ходу гремит так, будто всё ещё везёт праздничный квас.',effects:[{id:'kvasolet-barrel-unload',type:'world',trigger:'load-or-unload-barrels',operation:'roll-barrels-from-side-cradles',value:1,condition:'firm-level-ground',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','glupishche-root-post']},
    {id:'shp_transport_wagon_02',name:'Лесовоз «Бревнобукса»',icon:'🛞',image:'images/shop/transport-wagon-02.png',imageThumb:'images/shop/thumbs/transport-wagon-02.jpg',transportKind:'wagon',capacityKg:800,powerTier:0,rarity:'common',price:{pl:2,zl:4,sr:0,md:0},effect:'Надёжно закрепляет длинный груз и проходит по рабочему лесному тракту',desc:'Разнесённые оси соединены длинной балкой и цепями. Возят брёвна, мачты и всё, что опасно оставлять торчать из обычной повозки.',effects:[{id:'log-hauler-long-cargo',type:'world',trigger:'carry-timber-or-long-load',operation:'secure-long-cargo',value:1,condition:'forestry-road-and-properly-chained-load',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-three-ruts']},
    {id:'shp_transport_wagon_03',name:'Тяжёлый воз «Король Мулов»',icon:'🛞',image:'images/shop/transport-wagon-03.png',imageThumb:'images/shop/thumbs/transport-wagon-03.jpg',transportKind:'wagon',capacityKg:1400,powerTier:1,rarity:'uncommon',price:{pl:3,zl:3,sr:0,md:0},effect:'Везёт тяжёлый груз по тракту; тормозной ворот удерживает воз на обычном спуске',desc:'Четырёхколёсный грузовой воз с двойной упряжью и железным ручным воротом. Медленный, широкий и почти неприлично надёжный.',effects:[{id:'mule-king-brake-winch',type:'defense',trigger:'hold-loaded-wagon-on-road-slope',operation:'anchor-heavy-wagon',balanceOperation:'artifact-effect',value:1,condition:'ordinary-road-slope-and-brake-attended',actionCost:'long',frequency:'scene',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','glupishche-root-post']},
    {id:'shp_transport_wagon_04',name:'Жилая повозка «Дальний Кров»',icon:'🏕️',image:'images/shop/transport-wagon-04.png',imageThumb:'images/shop/thumbs/transport-wagon-04.jpg',transportKind:'wagon',capacityKg:700,powerTier:1,rarity:'rare',price:{pl:11,zl:0,sr:0,md:0},effect:'Даёт четырём путникам сухое место для обычного отдыха в дождь и дорожный ветер',desc:'Крытая четырёхколёсная повозка с откидными койками, печной трубой и запираемым рундуком. Не защищает от нападения и сильной бури.',effects:[{id:'far-shelter-wagon-rest',type:'world',trigger:'make-camp-inside-wagon',operation:'safe-camp',value:1,condition:'ordinary-rain-or-road-wind;wagon-stationary',frequency:'passive',stacking:'highest'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','glupishche-root-post']},

    {id:'shp_transport_stagecoach_01',name:'Трактовый дилижанс «Семь Колокольцев»',icon:'🛞',image:'images/shop/transport-stagecoach-seven-bells.png',imageThumb:'images/shop/thumbs/transport-stagecoach-seven-bells.jpg',transportKind:'wagon',roadVehicleKind:'stagecoach',passengers:8,capacityKg:500,powerTier:0,rarity:'common',price:{pl:6,zl:0,sr:0,md:0},effect:'Восемь мест, багажные ячейки и звонки остановок для регулярного пассажирского тракта',desc:'Высокий глупищенский дилижанс с пронумерованными внутри полками. Семь разных колокольцев помогают кучеру объявлять остановки даже в тумане.',effects:[{id:'seven-bells-passenger-route',type:'world',trigger:'run-scheduled-passenger-route',operation:'organize-passengers-and-luggage-by-stop',value:1,condition:'maintained-road-and-posted-route',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','glupishche-root-post']},
    {id:'shp_transport_stagecoach_02',name:'Почтовый дилижанс «Красный Узел»',icon:'📯',image:'images/shop/transport-stagecoach-red-knot.png',imageThumb:'images/shop/thumbs/transport-stagecoach-red-knot.jpg',transportKind:'wagon',roadVehicleKind:'stagecoach',passengers:6,capacityKg:350,powerTier:1,rarity:'uncommon',price:{pl:9,zl:0,sr:0,md:0},effect:'Раз за дорожную сцену меняет уставшую упряжь на почтовом дворе без потери интервала пути',desc:'Облегчённый кузов, красные узловые ремни и крытая сетка для мешков. Возможность быстрой смены лошадей действует только по договору с работающим почтовым двором.',effects:[{id:'red-knot-relay-team',type:'tempo',trigger:'arrive-at-staffed-post-yard-during-road-scene',operation:'replace-tired-draft-team-without-losing-travel-interval',balanceOperation:'artifact-effect',value:1,condition:'relay-contract-and-fresh-team-available',actionCost:'long',frequency:'scene',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-root-post','glupishche-three-ruts']},
    {id:'shp_transport_stagecoach_03',name:'Бронированный дилижанс «Глухой Рейс»',icon:'🛡️',image:'images/shop/transport-stagecoach-deaf-run.png',imageThumb:'images/shop/thumbs/transport-stagecoach-deaf-run.jpg',transportKind:'wagon',roadVehicleKind:'stagecoach',passengers:6,capacityKg:450,powerTier:2,rarity:'rare',price:{pl:18,zl:0,sr:0,md:0},effect:'Долгим действием закрывает ставни и даёт пассажирам полное укрытие от выстрелов через борта',desc:'Казад-дромский кузов обит полосовой сталью и закрывается изнутри. С опущенными ставнями экипаж движется вдвое медленнее, а двери нельзя открыть.',effects:[{id:'deaf-run-armored-shutters',type:'defense',trigger:'close-armored-stagecoach-shutters',operation:'grant-full-cover-to-passengers-through-side-panels',balanceOperation:'artifact-effect',value:2,condition:'vehicle-speed-halved-and-doors-locked-until-shutters-reopen',actionCost:'long',frequency:'passive',stacking:'highest'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},

    {id:'shp_transport_carriage_01',name:'Городская карета «Тихий Фонарь»',icon:'🏮',image:'images/shop/transport-carriage-quiet-lantern.png',imageThumb:'images/shop/thumbs/transport-carriage-quiet-lantern.jpg',transportKind:'wagon',roadVehicleKind:'carriage',passengers:4,capacityKg:180,powerTier:0,rarity:'common',price:{pl:7,zl:0,sr:0,md:0},effect:'При закрытых дверях снаружи нельзя разобрать спокойный разговор пассажиров',desc:'Компактная карета с двойной обивкой, тяжёлыми шторами и четырьмя фонарными кронштейнами. Крик, открытое окно и магическое подслушивание обходят защиту.',effects:[{id:'quiet-lantern-private-cabin',type:'world',trigger:'listen-through-closed-carriage-body',operation:'muffle-quiet-passenger-conversation',value:1,condition:'doors-and-windows-closed;not-shouting-or-magical-listening',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts']},
    {id:'shp_transport_carriage_02',name:'Дорожная карета «Мягкая Ось»',icon:'🛞',image:'images/shop/transport-carriage-soft-axle.png',imageThumb:'images/shop/thumbs/transport-carriage-soft-axle.jpg',transportKind:'wagon',roadVehicleKind:'carriage',passengers:4,capacityKg:300,powerTier:1,rarity:'uncommon',price:{pl:12,zl:0,sr:0,md:0},effect:'Раз за дорожную сцену проходит первый короткий разбитый участок, не прерывая отдых пассажиров',desc:'Кузов висит на широких кожаных ремнях и упругих стальных пластинах. Глубокая грязь, обвал и длительное бездорожье всё равно вынуждают пассажиров выйти.',effects:[{id:'soft-axle-road-rest',type:'tempo',trigger:'cross-first-short-broken-road-section',operation:'preserve-passenger-rest',balanceOperation:'artifact-effect',value:1,condition:'not-deep-mud-rubble-or-prolonged-off-road-travel',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-three-ruts']},
    {id:'shp_transport_carriage_03',name:'Посольская карета «Четыре Печати»',icon:'📜',image:'images/shop/transport-carriage-four-seals.png',imageThumb:'images/shop/thumbs/transport-carriage-four-seals.jpg',transportKind:'wagon',roadVehicleKind:'carriage',passengers:4,capacityKg:250,powerTier:2,rarity:'rare',price:{pl:22,zl:0,sr:0,md:0},effect:'Под полом скрыт герметичный архив; вскрытие без четырёх ключей занимает долгое действие и оставляет явный след',desc:'Сдержанная верхземская карета для посольств и договоров. Четыре разнесённых замка не делают тайник неуязвимым, но не позволяют обыскать его незаметно и наспех.',effects:[{id:'four-seals-document-vault',type:'world',trigger:'search-or-open-underfloor-document-vault',operation:'resist-casual-search-and-record-forced-entry',balanceOperation:'artifact-effect',value:2,condition:'four-key-locks-intact;forced-entry-still-possible',actionCost:'long',frequency:'passive',stacking:'unique-source'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure']},

    {id:'shp_transport_cart_01',name:'Рудный воз «Каменная Жила»',icon:'⛏️',image:'images/shop/transport-cart-stone-vein.png',imageThumb:'images/shop/thumbs/transport-cart-stone-vein.jpg',transportKind:'wagon',roadVehicleKind:'cart',capacityKg:1800,powerTier:0,rarity:'common',price:{pl:7,zl:5,sr:0,md:0},effect:'Сегментированный короб безопасно разгружает руду на ровной площадке, не требуя подъёмного крана',desc:'Низкий казад-дромский воз с опрокидными секциями, тормозными башмаками и толстыми железными рёбрами. Для пассажиров места нет.',effects:[{id:'stone-vein-segmented-tip',type:'world',trigger:'unload-ore-on-level-ground',operation:'tip-segmented-ore-bed-without-crane',value:1,condition:'wagon-stationary-and-brake-shoes-set',actionCost:'long',frequency:'passive',stacking:'unique-source'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain']},
    {id:'shp_transport_cart_02',name:'Болотный воз «Широкая Колея»',icon:'🌾',image:'images/shop/transport-cart-wide-rut.png',imageThumb:'images/shop/thumbs/transport-cart-wide-rut.jpg',transportKind:'wagon',roadVehicleKind:'cart',capacityKg:700,powerTier:1,rarity:'uncommon',price:{pl:8,zl:5,sr:0,md:0},effect:'Раз за дорожную сцену пересекает один участок мелкой грязи, не увязая',desc:'Левошлакский грузовой воз с парными широкими колёсами, камышовыми щитками и грязевыми скребками. В глубокой трясине его ширина уже не спасает.',effects:[{id:'wide-rut-shallow-mud',type:'tempo',trigger:'cross-one-shallow-mud-section',operation:'avoid-wagon-becoming-stuck',balanceOperation:'artifact-effect',value:1,condition:'shallow-mud-not-deep-bog-or-flooded-ground',frequency:'scene',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['strannograd-bog-guild','sandy-acorn-salvage']},
    {id:'shp_transport_cart_03',name:'Щитовой обозный воз «Складная Стена»',icon:'🛡️',image:'images/shop/transport-cart-folding-wall.png',imageThumb:'images/shop/thumbs/transport-cart-folding-wall.jpg',transportKind:'wagon',roadVehicleKind:'cart',capacityKg:900,powerTier:2,rarity:'rare',price:{pl:15,zl:0,sr:0,md:0},effect:'Долгим действием превращает боковые борта в укрытие на две соседние клетки',desc:'Петли, стойки и колья складываются под усиленным кузовом. Перед развёртыванием груз нужно снять, а до обратной сборки воз не может двигаться.',effects:[{id:'folding-wall-convoy-cover',type:'defense',trigger:'deploy-hinged-wagon-sideboards',operation:'create-two-adjacent-cells-of-cover',balanceOperation:'artifact-effect',value:2,condition:'wagon-stationary-and-cargo-unloaded;cannot-move-until-reassembled',actionCost:'long',frequency:'scene',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['glupishche-last-rest','glupishche-three-ruts']},

    {id:'shp_transport_boat_01',name:'Камышовый челн Трёхкорня',icon:'🛶',image:'images/shop/transport-boat-01.png',imageThumb:'images/shop/thumbs/transport-boat-01.jpg',transportKind:'boat',passengers:2,capacityKg:180,powerTier:0,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},effect:'Проходит по мелкой воде и между плотным камышом, где крупная лодка сядет на дно',desc:'Узкий плоскодонный челн из лёгких досок с одним шестом. Не предназначен для моря, быстрины и тяжёлой волны.',effects:[{id:'three-root-reed-punt',type:'world',trigger:'pole-through-shallow-reeds',operation:'navigate-shallow-reed-water',value:1,condition:'calm-shallow-water',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','lesorubka-artel-yard']},
    {id:'shp_transport_boat_02',name:'Лодка маячного улова',icon:'⛵',image:'images/shop/transport-boat-02.png',imageThumb:'images/shop/thumbs/transport-boat-02.jpg',transportKind:'boat',passengers:4,capacityKg:420,powerTier:1,rarity:'uncommon',price:{pl:5,zl:0,sr:0,md:0},effect:'Сохраняет устойчивость на обычной прибрежной волне и позволяет работать с сетями вдвоём',desc:'Широкая рыбацкая лодка с короткой мачтой, съёмным парусом и высоким носом. Маячные старосты осматривают каждую перед продажей.',effects:[{id:'lighthouse-catch-boat',type:'defense',trigger:'cross-ordinary-coastal-chop',operation:'keep-small-boat-stable',balanceOperation:'artifact-effect',value:1,condition:'coastal-water-and-competent-crew',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market']},
    {id:'shp_transport_boat_03',name:'Лесорубский речной плоскодон',icon:'🛶',image:'images/shop/transport-boat-03.png',imageThumb:'images/shop/thumbs/transport-boat-03.jpg',transportKind:'boat',passengers:6,capacityKg:1100,powerTier:0,rarity:'common',price:{pl:3,zl:5,sr:0,md:0},effect:'Перевозит тяжёлый груз вниз по спокойной реке и подходит к низкому необорудованному берегу',desc:'Длинная плоскодонная лодья с распашными вёслами и съёмным настилом. На порогах неповоротлива и требует разгрузки.',effects:[{id:'lumber-river-flatboat',type:'world',trigger:'carry-cargo-on-calm-river',operation:'land-heavy-cargo-on-low-bank',value:1,condition:'calm-river-without-rapids',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','morelesie-lighthouse-market']},
    {id:'shp_transport_boat_04',name:'Баркас Чёрного Прилива',icon:'⛵',image:'images/shop/transport-boat-04.png',imageThumb:'images/shop/thumbs/transport-boat-04.jpg',transportKind:'boat',passengers:8,capacityKg:650,powerTier:1,rarity:'rare',price:{pl:12,zl:0,sr:0,md:0},effect:'Раз за морскую сцену меняет галс без потери хода, если у руля опытный мореход',desc:'Узкий левошлакский баркас с косым тёмным парусом и шестью вёслами. Быстр, но плохо прощает перегруз и неопытную команду.',effects:[{id:'black-tide-boat-tack',type:'tempo',trigger:'change-tack-during-sailing-scene',operation:'retain-sea-travel-tempo',balanceOperation:'artifact-effect',value:1,condition:'experienced-helmsman-and-not-overloaded',actionCost:'movement',frequency:'scene',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['sandy-acorn-salvage','strannograd-bog-guild']}
  ].map(function(item){
    item.tags=['transport',item.transportKind].concat(item.transportKind==='horse'?['animal','mount']:item.transportKind==='wagon'?['vehicle','land']:['vehicle','watercraft']);
    if (item.roadVehicleKind) item.tags.push(item.roadVehicleKind);
    return finishBatchItem(item,{cat:'mount',category:item.transportKind,slot:'',tags:[],access:{markets:item.rarity==='rare'?['guild','licensed']:['local-open','city'],legality:'open'}});
  });

  var SADDLE_ITEMS = [
    {id:'shp_saddle_01',name:'Трактовое седло «Долгий Шов»',icon:'🐎',image:'images/shop/saddle-road-glupishche.png',imageThumb:'images/shop/thumbs/saddle-road-glupishche.jpg',saddleRole:'road-comfort',powerTier:0,rarity:'common',price:{pl:0,zl:5,sr:0,md:0},effect:'После обычного дневного перехода всадник не получает натирание и усталость именно от плохо распределённого седла',desc:'Широкие подушки, сменные подпруги и шерстяной валик легко чинить в любой дорожной мастерской. Седло не отменяет усталость от скачки, голода или долгого пути.',effects:[{id:'long-stitch-road-comfort',type:'world',trigger:'complete-ordinary-mounted-travel-day',operation:'prevent-saddle-fit-fatigue',value:1,condition:'saddle-fitted-to-mount-and-rider;ordinary-travel-pace',frequency:'passive',stacking:'highest'}],baseRegion:'root-valley',marketIds:['glupishche-tuk-da-bryak','glupishche-three-ruts']},
    {id:'shp_saddle_02',name:'Курьерское седло «Корневой Узел»',icon:'📯',image:'images/shop/saddle-root-courier.png',imageThumb:'images/shop/thumbs/saddle-root-courier.jpg',saddleRole:'courier-speed',powerTier:1,rarity:'uncommon',price:{pl:1,zl:8,sr:0,md:0},effect:'Раз за дорожную сцену сохраняет темп погони на первом коротком участке разбитого тракта',desc:'Узкая посадка, вынесенные стремена и петли для почтовых тубусов позволяют курьеру быстро менять стойку. На долгом переходе седло менее удобно трактового.',effects:[{id:'root-knot-courier-pace',type:'tempo',trigger:'enter-first-short-rough-road-section-during-pursuit',operation:'retain-mounted-pursuit-tempo',balanceOperation:'artifact-effect',value:1,condition:'skilled-rider;rough-road-not-deep-mud-or-rubble',frequency:'scene',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-root-post','glupishche-tuk-da-bryak']},
    {id:'shp_saddle_03',name:'Вьючное седло «Четыре Рамы»',icon:'📦',image:'images/shop/saddle-lesorubka-pack.png',imageThumb:'images/shop/thumbs/saddle-lesorubka-pack.jpg',saddleRole:'balanced-pack',powerTier:0,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},effect:'Несёт четыре заранее уравновешенных тюка; один выбранный тюк снимается коротким действием без развязки остальных',desc:'Две деревянные арки и четыре отдельные грузовые рамки держат вес по сторонам животного. Для верховой езды посадочного места нет.',effects:[{id:'four-frame-pack-release',type:'world',trigger:'unload-prepared-pannier',operation:'quick-release-one-balanced-pack',value:1,condition:'four-loads-were-balanced-and-secured-before-travel',actionCost:'short',frequency:'passive',stacking:'unique-source'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-three-ruts']},
    {id:'shp_saddle_04',name:'Кавалерийское седло «Закрытый Строй»',icon:'🛡️',image:'images/shop/saddle-upper-watch-cavalry.png',imageThumb:'images/shop/thumbs/saddle-upper-watch-cavalry.jpg',saddleRole:'cavalry-security',powerTier:2,rarity:'rare',price:{pl:3,zl:8,sr:0,md:0},effect:'Раз за бой реакцией удерживает всадника при попытке выбить его из седла и не даёт получить отдельное падение; лошадь всё ещё может быть сдвинута или сбита',desc:'Высокие луки, бедренные щитки и закрытые стремена держат бойца внутри посадки. Быстро спешиться из такого седла нельзя.',effects:[{id:'closed-rank-stay-mounted',type:'defense',trigger:'rider-would-be-unseated-or-take-separate-fall',operation:'prevent-unseating-and-rider-fall',balanceOperation:'artifact-effect',value:2,condition:'rider-conscious-and-saddle-girths-intact;does-not-prevent-mount-movement-or-prone',actionCost:'reaction',frequency:'combat',stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-last-rest']},
    {id:'shp_saddle_05',name:'Горное седло «Низкий Центр»',icon:'⛰️',image:'images/shop/saddle-kazad-mountain.png',imageThumb:'images/shop/thumbs/saddle-kazad-mountain.jpg',saddleRole:'mountain-safety',powerTier:1,rarity:'uncommon',price:{pl:2,zl:4,sr:0,md:0},effect:'Раз за горную сцену первый срыв лошади или всадника на склоне превращается в остановку на страховочных ремнях',desc:'Раздельные подушки следуют движению спины, а низкая посадка и заднее якорное кольцо удерживают общий центр тяжести. На ровном тракте седло жёсткое.',effects:[{id:'low-center-mountain-catch',type:'defense',trigger:'mount-or-rider-first-slips-on-rocky-slope',operation:'convert-slope-fall-to-secured-stop',balanceOperation:'artifact-effect',value:1,condition:'safety-straps-fastened-and-anchor-ring-can-hold',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},
    {id:'shp_saddle_06',name:'Топкое седло «Камышовый Плавник»',icon:'🌾',image:'images/shop/saddle-levoshlak-marsh.png',imageThumb:'images/shop/thumbs/saddle-levoshlak-marsh.jpg',saddleRole:'marsh-release',powerTier:2,rarity:'rare',price:{pl:5,zl:5,sr:0,md:0},effect:'Раз за дорожную сцену длинным действием освобождает лошадь из вязкой грязи и выводит её на ближайшую устойчивую клетку без спешивания; не помогает в трясине глубже брюха',desc:'Широкая камышовая подкладка распределяет давление, герметичная посадка не набирает воду, а боковые пластины скользят по жиже вместо того, чтобы резать её.',effects:[{id:'reed-fin-marsh-release',type:'tempo',trigger:'mount-becomes-stuck-in-deep-mud',operation:'free-mounted-horse-and-reach-nearest-firm-cell',balanceOperation:'artifact-effect',value:2,condition:'mud-no-deeper-than-mount-belly;reeds-or-firm-bottom-within-reach',actionCost:'long',frequency:'scene',stacking:'replace'}],baseRegion:'levoshlak',marketIds:['strannograd-bog-guild','sandy-acorn-salvage']}
  ].map(function(item){
    item.compatibleMounts=['horse','mule'];
    item.tags=['saddle','mount-gear',item.saddleRole];
    return finishBatchItem(item,{cat:'mount',category:'saddle',slot:'mountBack',tags:[],access:{markets:item.rarity==='rare'?['guild','licensed']:['local-open','city'],legality:'open'}});
  });

  // Дрессированные животные дают разведку и связь, но не являются боевыми
  // существами каталога. Каждый навык ограничен выученной задачей, уходом
  // и естественными препятствиями, поэтому спутник не заменяет специалиста.
  var TRAINED_ANIMAL_ITEMS = [
    {id:'shp_trained_animal_01',name:'Почтовый голубь Корневого Узла',icon:'🕊️',image:'images/shop/trained-animal-01.png',imageThumb:'images/shop/thumbs/trained-animal-01.jpg',trainedRole:'courier-pigeon',species:'pigeon',powerTier:1,rarity:'common',price:{pl:0,zl:4,sr:0,md:0},effect:'Несёт одну лёгкую записку в знакомую голубятню · после отправки недоступен, пока его не вернут',desc:'Сизый голубь с мягкой ножной трубкой и меткой почтового двора. Он знает одну домашнюю голубятню и не умеет искать нового адресата.',effects:[{id:'root-knot-pigeon-message',type:'world',trigger:'release-with-light-note',operation:'deliver-message-to-known-roost',balanceOperation:'artifact-effect',value:1,condition:'familiar-home-roost;ordinary-flying-weather',actionCost:'long',frequency:'scene',stacking:'unique-source'}],care:{feed:'daily-grain-and-water',rest:'secure-roost'},baseRegion:'root-valley',marketIds:['glupishche-root-post']},
    {id:'shp_trained_animal_02',name:'Ловчий ястреб Верхоставского дозора',icon:'🦅',image:'images/shop/trained-animal-02.png',imageThumb:'images/shop/thumbs/trained-animal-02.jpg',trainedRole:'scouting-hawk',species:'hawk',powerTier:1,rarity:'uncommon',price:{pl:2,zl:2,sr:0,md:0},effect:'Раз за сцену обследует открытую местность в пределах 8 клеток и сигналом показывает направление крупного движения',desc:'Поджарый бурый ястреб с кожаными путцами и тихим колокольчиком. Он отличает движение от покоя, но не сообщает хозяину имя, намерение или точное число целей.',effects:[{id:'upper-watch-hawk-survey',type:'scouting',trigger:'release-over-open-terrain',operation:'survey-large-movement',balanceOperation:'artifact-effect',value:1,rangeCells:8,condition:'open-terrain;moving-target-medium-or-larger;no-storm',actionCost:'long',frequency:'scene',stacking:'unique-source'}],care:{feed:'fresh-meat-daily',rest:'hooded-perch'},baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-last-rest']},
    {id:'shp_trained_animal_03',name:'Следовая собака Глупищенского двора',icon:'🐕',image:'images/shop/trained-animal-03.png',imageThumb:'images/shop/thumbs/trained-animal-03.jpg',trainedRole:'scent-hound',species:'dog',powerTier:1,rarity:'uncommon',price:{pl:1,zl:8,sr:0,md:0},effect:'По свежему образцу запаха ведёт цель без видимых следов · теряет след в проточной воде или среди сильных ложных запахов',desc:'Короткошёрстная широколапая гончая в прочной кожаной шлейке. В драку её не учили: услышав оружие, она ждёт команды и держится позади.',effects:[{id:'glupishche-yard-scent-hound',type:'scouting',trigger:'present-fresh-scent-sample',operation:'follow-fresh-scent',balanceOperation:'artifact-effect',value:1,condition:'trail-not-crossing-running-water-or-deliberate-scent-screen',actionCost:'long',frequency:'scene',stacking:'unique-source'}],care:{feed:'daily-meal-and-water',rest:'dry-shelter'},baseRegion:'root-valley',marketIds:['glupishche-last-rest','glupishche-root-post']}
  ].map(function(item){
    item.tags=['trained-animal','animal','companion',item.species,item.trainedRole];
    return finishBatchItem(item,{cat:'mount',category:'trained-animal',slot:'',tags:[],access:{markets:['city','guild'],legality:'open'}});
  });

  // Специальные стрелы и болты открывают узкое применение вместо постоянной
  // прибавки к атаке. Расчётное оружие требует установки, экипажа и времени
  // на перезарядку, поэтому не заменяет обычное личное оружие персонажа.
  var AMMUNITION_AND_SIEGE_ITEMS = [
    {id:'shp_ammo_arrow_01',name:'Свистящие стрелы трактовой стражи',image:'images/shop/ammunition-arrow-01.png',imageThumb:'images/shop/thumbs/ammunition-arrow-01.jpg',munitionKind:'arrow',charges:5,powerTier:0,rarity:'common',price:{pl:0,zl:2,sr:0,md:0},effect:'Вместо обычного выстрела подаёт громкий сигнал, слышимый в пределах 12 клеток',desc:'Полый костяной свисток заменяет боевой наконечник. Разные тона условны только для тех, кто заранее договорился об их значении.',effects:[{id:'road-guard-whistling-arrow',type:'world',trigger:'fire-as-signal',operation:'emit-directional-signal',value:1,rangeCells:12,condition:'not-used-as-damaging-attack',frequency:'charge',charges:5,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-last-rest','glupishche-root-post']},
    {id:'shp_ammo_arrow_02',name:'Стрелы с бегущей нитью',image:'images/shop/ammunition-arrow-02.png',imageThumb:'images/shop/thumbs/ammunition-arrow-02.jpg',munitionKind:'arrow',charges:3,powerTier:0,rarity:'common',price:{pl:0,zl:3,sr:0,md:0},effect:'Перебрасывает лёгкий шнур на 6 клеток и цепляется за дерево, ткань или рыхлую землю',desc:'Лёгкая стрела с раскрывающимся деревянным усом и катушкой тонкого шнура. Шнур не держит вес человека, пока его не заменят верёвкой и не закрепят.',effects:[{id:'running-thread-arrow',type:'world',trigger:'fire-light-cord',operation:'carry-light-line-across-gap',value:1,rangeCells:6,condition:'wood-cloth-or-soft-earth-anchor;not-load-bearing',frequency:'charge',charges:3,stacking:'replace'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-last-rest']},
    {id:'shp_ammo_arrow_03',name:'Тупые стрелы малого лова',image:'images/shop/ammunition-arrow-03.png',imageThumb:'images/shop/thumbs/ammunition-arrow-03.jpg',munitionKind:'arrow',charges:5,powerTier:0,rarity:'common',price:{pl:0,zl:2,sr:5,md:0},effect:'Меняет урон лука на дробящий и позволяет объявить дальнее попадание несмертельным',desc:'Широкая кожаная головка набита войлоком и стянута сыромятью. Против твёрдого доспеха почти бесполезна, зато не портит мелкую добычу.',effects:[{id:'small-game-blunt-arrow',type:'world',trigger:'bow-hit-with-special-arrow',operation:'convert-ranged-hit-to-nonlethal-blunt',value:1,condition:'target-not-in-rigid-armor',frequency:'charge',charges:5,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-last-rest','lesorubka-artel-yard']},
    {id:'shp_ammo_arrow_04',name:'Серповые стрелы канатчика',image:'images/shop/ammunition-arrow-04.png',imageThumb:'images/shop/thumbs/ammunition-arrow-04.jpg',munitionKind:'arrow',charges:3,powerTier:1,rarity:'uncommon',price:{pl:0,zl:6,sr:0,md:0},effect:'При попадании перерезает натянутую обычную верёвку, сеть или тонкий тканевый трос',desc:'Два обращённых внутрь лезвия ловят натянутый шнур между собой. По существу такая стрела наносит обычный урон без дополнительного эффекта.',effects:[{id:'ropewright-crescent-arrow',type:'world',trigger:'hit-taut-line-or-net',operation:'cut-taut-mundane-line',balanceOperation:'artifact-effect',value:1,condition:'ordinary-rope-net-or-thin-cloth-cable',frequency:'charge',charges:3,stacking:'replace'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-last-rest']},

    {id:'shp_ammo_bolt_01',name:'Якорные болты плотника',image:'images/shop/ammunition-bolt-01.png',imageThumb:'images/shop/thumbs/ammunition-bolt-01.jpg',munitionKind:'bolt',charges:3,powerTier:1,rarity:'uncommon',price:{pl:0,zl:7,sr:0,md:0},effect:'Забивается в обычное дерево или плотную землю и становится временной опорой для одной верёвки',desc:'Короткий тяжёлый болт раскрывает два боковых зуба после удара. Перед нагрузкой крепление всё равно нужно проверить длинным действием.',effects:[{id:'carpenter-anchor-bolt',type:'world',trigger:'fire-into-valid-anchor-surface',operation:'create-temporary-rope-anchor',balanceOperation:'artifact-effect',value:1,condition:'ordinary-wood-or-firm-earth;inspect-before-loading',frequency:'charge',charges:3,stacking:'replace'}],baseRegion:'root-valley',marketIds:['lesorubka-artel-yard','glupishche-last-rest']},
    {id:'shp_ammo_bolt_02',name:'Гремучие болты дозорного',image:'images/shop/ammunition-bolt-02.png',imageThumb:'images/shop/thumbs/ammunition-bolt-02.jpg',munitionKind:'bolt',charges:5,powerTier:0,rarity:'common',price:{pl:0,zl:4,sr:0,md:0},effect:'Разбивается о твёрдую поверхность и создаёт громкий отвлекающий треск в выбранной точке',desc:'Тонкая керамическая головка наполнена свободными металлическими пластинками. Болт не взрывается и почти не ранит.',effects:[{id:'watchman-rattle-bolt',type:'control',trigger:'hit-hard-surface',operation:'create-audible-distraction',value:1,rangeCells:8,condition:'hard-surface;negligible-damage',frequency:'charge',charges:5,stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','glupishche-last-rest']},
    {id:'shp_ammo_bolt_03',name:'Долотные болты дверолома',image:'images/shop/ammunition-bolt-03.png',imageThumb:'images/shop/thumbs/ammunition-bolt-03.jpg',munitionKind:'bolt',charges:3,powerTier:1,rarity:'uncommon',price:{pl:0,zl:8,sr:0,md:0},effect:'При попадании в обычную деревянную дверь или щит раскалывает одно открытое крепление',desc:'Гранёный клин вместо острия принимает всю силу арбалета. Против существа это лишь тяжёлый неудобный болт без дополнительного урона.',effects:[{id:'doorbreaker-chisel-bolt',type:'world',trigger:'hit-mundane-wooden-object',operation:'split-one-exposed-fastening',balanceOperation:'artifact-effect',value:1,condition:'door-shield-or-cover;fastening-exposed',frequency:'charge',charges:3,stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','glupishche-last-rest']},
    {id:'shp_ammo_bolt_04',name:'Гранёные болты Казад-Дрома',image:'images/shop/ammunition-bolt-04.png',imageThumb:'images/shop/thumbs/ammunition-bolt-04.jpg',munitionKind:'bolt',charges:3,powerTier:1,rarity:'rare',price:{pl:1,zl:2,sr:0,md:0},effect:'Против жёсткого металлического доспеха брось урон дважды и выбери лучший результат',desc:'Узкий четырёхгранный наконечник не расширяет рану, а ищет зазор между пластинами. Против мягкой брони и незащищённой цели преимущества нет.',effects:[{id:'kazad-drom-faceted-bolt',type:'damage',trigger:'crossbow-hit',operation:'damage-roll-advantage',balanceOperation:'artifact-effect',value:1,condition:'target-wears-rigid-metal-armor',frequency:'charge',charges:3,stacking:'highest'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},

    {id:'shp_siege_01',name:'Повозочная баллиста «Колейный Зуб»',image:'images/shop/siege-weapon-01.png',imageThumb:'images/shop/thumbs/siege-weapon-01.jpg',munitionKind:'siege-weapon',siegeKind:'wagon-ballista',crew:2,mountRequired:'reinforced-wagon-bed',handsRequired:0,powerTier:3,rarity:'rare',price:{pl:18,zl:0,sr:0,md:0},damage:'2d10',damageFormula:'2d10',damageType:'Колющий',range:'Дальняя / 16 клеток',effect:'Требует усиленную повозочную раму и расчёт из 2 бойцов · две длинные операции на перезарядку · не стреляет после движения повозки',desc:'Разборная станина крепится поперёк кузова железными башмаками. Орудие защищает обоз на открытом тракте, но превращает повозку в заметную и неповоротливую цель.',effects:[{id:'rut-tooth-ballista-shot',type:'damage',trigger:'crew-fire-mounted-ballista',operation:'deal-siege-projectile-damage',value:3,dice:'2d10',condition:'reinforced-wagon-bed;two-crew;wagon-did-not-move',frequency:'round',stacking:'replace'},{id:'rut-tooth-ballista-reload',type:'risk',trigger:'after-ballista-shot',operation:'require-two-long-reload-operations',value:2,condition:'heavy-ballista-bolt-available',frequency:'round',stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','kazad-drom-thundering-mountain']},
    {id:'shp_siege_02',name:'Разборный скорпион «Три спицы»',image:'images/shop/siege-weapon-02.png',imageThumb:'images/shop/thumbs/siege-weapon-02.jpg',munitionKind:'siege-weapon',siegeKind:'portable-scorpion',crew:1,mountRequired:'deployed-tripod',handsRequired:0,powerTier:2,rarity:'rare',price:{pl:9,zl:0,sr:0,md:0},damage:'2d8',damageFormula:'2d8',damageType:'Колющий',range:'Дальняя / 12 клеток',effect:'Двое переносят, один стреляет · 10 минут на установку · длинное действие на перезарядку',desc:'Три складные опоры, короткие плечи из рога и железный ворот укладываются в два чехла. С неподготовленной земли стрелять нельзя.',effects:[{id:'three-spoke-scorpion-shot',type:'damage',trigger:'fire-deployed-scorpion',operation:'deal-siege-projectile-damage',value:2,dice:'2d8',condition:'tripod-deployed-on-firm-ground',frequency:'round',stacking:'replace'},{id:'three-spoke-scorpion-setup',type:'risk',trigger:'move-or-prepare-scorpion',operation:'require-deployment-and-long-reload',value:1,condition:'ten-minute-setup;one-long-reload-action',frequency:'scene',stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','dorogograd-golden-measure']},
    {id:'shp_siege_03',name:'Палубный гарпунный ворот Морелесья',image:'images/shop/siege-weapon-03.png',imageThumb:'images/shop/thumbs/siege-weapon-03.jpg',munitionKind:'siege-weapon',siegeKind:'deck-harpoon-winch',crew:2,mountRequired:'boat-or-reinforced-wagon',handsRequired:0,powerTier:2,rarity:'rare',price:{pl:11,zl:0,sr:0,md:0},damage:'2d8',damageFormula:'2d8',damageType:'Колющий',range:'Дальняя / 10 клеток',effect:'После попадания удерживает канат; расчёт может длинным действием попытаться подтянуть цель не крупнее Большой на 1 клетку',desc:'Поворотная рогатина соединена с барабаном толстого каната. Рыбаки ставят её на баркасы, а возчики — на укреплённые охотничьи повозки.',effects:[{id:'moreles-deck-harpoon-hit',type:'damage',trigger:'crew-fire-mounted-harpoon',operation:'deal-siege-projectile-damage',value:2,dice:'2d8',condition:'mounted-and-two-crew',frequency:'round',stacking:'replace'},{id:'moreles-deck-harpoon-line',type:'control',trigger:'long-action-after-hit',operation:'pull-cells',value:1,condition:'target-at-most-large;contested-strength;line-intact',actionCost:'long',frequency:'round',stacking:'highest'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market','glupishche-three-ruts']},
    {id:'shp_siege_04',name:'Ящик тяжёлых баллистных стрел',image:'images/shop/siege-weapon-04.png',imageThumb:'images/shop/thumbs/siege-weapon-04.jpg',munitionKind:'siege-ammunition',siegeKind:'heavy-bolt-crate',charges:6,powerTier:0,rarity:'uncommon',price:{pl:1,zl:8,sr:0,md:0},effect:'Шесть тяжёлых снарядов для баллисты, скорпиона или гарпунного ворота подходящего калибра',desc:'Окованный ящик удерживает древки раздельно, чтобы наконечники не били друг о друга на ухабах. Без расчётного орудия это просто очень тяжёлый груз.',effects:[{id:'heavy-ballista-bolt-crate',type:'world',trigger:'reload-compatible-siege-weapon',operation:'supply-heavy-siege-projectile',value:1,condition:'compatible-ballista-scorpion-or-harpoon',frequency:'charge',charges:6,stacking:'replace'}],baseRegion:'upperland',marketIds:['kazad-drom-thundering-mountain','glupishche-three-ruts']}
  ].map(function(item){
    var isSiege = item.munitionKind.indexOf('siege') === 0;
    item.icon=isSiege?'🏹':item.munitionKind==='arrow'?'🏹':'➶';
    item.tags=['ammunition',item.munitionKind].concat(isSiege?['siege-equipment']:['special-ammunition',item.munitionKind]);
    item.access={markets:isSiege?['guild','licensed']:['city','guild'],legality:isSiege?'restricted':'open'};
    item.consumption=item.charges?{mode:'consume-on-use'}:null;
    return finishBatchItem(item,{cat:'weapon',category:isSiege?'weapon':'consumable',slot:isSiege?'':'consumable',tags:[],access:item.access});
  });

  // Услуга исполняется продавцом и не превращается в переносимый предмет.
  // Её эффект описывает результат работы, а ограничения не дают покупать
  // постоянные универсальные бонусы под видом ремонта или консультации.
  var SERVICE_ITEMS = [
    {id:'shp_service_01',name:'Кузнечный ремонт снаряжения',image:'images/shop/service-01.png',imageThumb:'images/shop/thumbs/service-01.jpg',serviceKind:'repair',powerTier:0,rarity:'common',price:{pl:0,zl:2,sr:5,md:0},effect:'Возвращает один повреждённый немагический металлический предмет в рабочее состояние',desc:'Мастер выправляет металл, меняет крепёж и проверяет швы. Уничтоженную вещь не восстановит, а её свойства и качество не повысит.',effects:[{id:'workshop-equipment-repair',type:'world',trigger:'complete-workshop-service',operation:'restore-damaged-nonmagical-item',value:1,condition:'metal-item-is-damaged-not-destroyed',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-three-strikes','kazad-drom-thundering-mountain']},
    {id:'shp_service_02',name:'Подгонка протеза мастером',image:'images/shop/service-02.png',imageThumb:'images/shop/thumbs/service-02.jpg',serviceKind:'prosthesis-fitting',powerTier:0,rarity:'common',price:{pl:0,zl:3,sr:0,md:0},effect:'Подгоняет один протез под владельца и открывает все заявленные возможности модели',desc:'Мастер меняет гильзу, ремни, упоры и учит уходу. Цена не включает сам протез и переделку под другую часть тела.',effects:[{id:'master-prosthesis-fitting',type:'world',trigger:'complete-fitting-service',operation:'fit-prosthesis-to-owner',value:1,condition:'compatible-prosthesis-and-owner-present',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','kazad-drom-thundering-mountain']},
    {id:'shp_service_03',name:'Лекарский осмотр и перевязка',image:'images/shop/service-03.png',imageThumb:'images/shop/thumbs/service-03.jpg',serviceKind:'medical-examination',powerTier:0,rarity:'common',price:{pl:0,zl:1,sr:5,md:0},effect:'Определяет обычную рану, болезнь или признаки яда и подбирает подходящий уход',desc:'Лекарь очищает рану, накладывает свежую повязку и объясняет лечение. Магическую порчу, неизвестный яд и потерянные HP услуга сама не устраняет.',effects:[{id:'healer-examination-and-dressing',type:'support',trigger:'complete-medical-service',operation:'identify-ordinary-ailment-and-treatment',value:1,condition:'ordinary-wound-disease-or-known-poison',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'zargota-all',marketIds:['glupishche-last-rest','dorogograd-golden-measure']},
    {id:'shp_service_04',name:'Ночь стойла и уход за лошадью',image:'images/shop/service-04.png',imageThumb:'images/shop/thumbs/service-04.jpg',serviceKind:'stable-care',powerTier:0,rarity:'common',price:{pl:0,zl:0,sr:4,md:0},effect:'После ночёвки снимает с одной лошади обычную дорожную усталость и износ упряжи',desc:'В стоимость входят сухое стойло, корм, вода, чистка копыт и осмотр ремней. Раны, болезнь и магический испуг требуют отдельного лечения.',effects:[{id:'overnight-horse-care',type:'support',trigger:'complete-overnight-stable-service',operation:'remove-ordinary-mount-travel-fatigue',value:1,condition:'one-horse-without-serious-injury-or-disease',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-tuk-da-bryak']},
    {id:'shp_service_05',name:'Перегон купленного транспорта',image:'images/shop/service-05.png',imageThumb:'images/shop/thumbs/service-05.jpg',serviceKind:'vehicle-delivery',powerTier:0,rarity:'common',price:{pl:0,zl:4,sr:0,md:0},effect:'Доставляет одну лошадь или повозку в поселение на связанном тракте за 1–3 дня',desc:'Возчик принимает транспорт по описи и передаёт жетон получения. Опасные, закрытые и военные дороги требуют нового договора.',effects:[{id:'purchased-transport-delivery',type:'world',trigger:'commission-road-delivery',operation:'deliver-purchased-horse-or-wagon',value:1,condition:'known-settlement-on-open-connected-road',duration:'one-to-three-days',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-three-ruts','glupishche-root-post']},
    {id:'shp_service_06',name:'Место в охраняемом обозе',image:'images/shop/service-06.png',imageThumb:'images/shop/thumbs/service-06.jpg',serviceKind:'guarded-caravan',powerTier:1,rarity:'uncommon',price:{pl:0,zl:6,sr:0,md:0},effect:'Проводит одного путника с обычным багажом по одному открытому участку тракта',desc:'Обоз даёт темп, ночной караул и проводника. Он не отменяет встречи и не гарантирует спасения, если дорога перекрыта войной или чудовищем.',effects:[{id:'guarded-caravan-passage',type:'world',trigger:'join-scheduled-guarded-caravan',operation:'secure-ordinary-road-passage',balanceOperation:'artifact-effect',value:1,condition:'one-traveler-and-reasonable-luggage;open-road-segment',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-root-post','glupishche-three-ruts']},
    {id:'shp_service_07',name:'Срочная почта «Корневого Узла»',image:'images/shop/service-07.png',imageThumb:'images/shop/thumbs/service-07.jpg',serviceKind:'urgent-mail',powerTier:0,rarity:'common',price:{pl:0,zl:1,sr:0,md:0},effect:'Доставляет одно запечатанное письмо в известное поселение и оставляет отметку последнего пункта пути',desc:'Курьер берёт расписку и меняет лошадей на почтовых дворах. Посылки, запретный груз и путь через закрытую границу оплачиваются отдельно.',effects:[{id:'root-post-urgent-letter',type:'world',trigger:'commission-sealed-letter-delivery',operation:'deliver-letter-with-traceable-waypoint',value:1,condition:'known-settlement-and-legal-letter',duration:'route-dependent',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['glupishche-root-post']},
    {id:'shp_service_08',name:'Проводник по знакомому краю',image:'images/shop/service-08.png',imageThumb:'images/shop/thumbs/service-08.jpg',serviceKind:'regional-guide',powerTier:1,rarity:'uncommon',price:{pl:0,zl:5,sr:0,md:0},effect:'На один переход показывает воду, надёжную стоянку и один известный дорожный риск',desc:'Проводник знает открытые тропы и местные обычаи. Тайные места, внезапная погода и новая опасность остаются заботой группы.',effects:[{id:'regional-guide-passage',type:'scouting',trigger:'begin-guided-regional-journey',operation:'reveal-water-camp-and-known-route-hazard',balanceOperation:'artifact-effect',value:1,condition:'one-familiar-regional-passage',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'zargota-all',marketIds:['glupishche-root-post','dorogograd-golden-measure','strannograd-bog-guild']},
    {id:'shp_service_09',name:'Лоцман маячного берега',image:'images/shop/service-09.png',imageThumb:'images/shop/thumbs/service-09.jpg',serviceKind:'coastal-pilot',powerTier:1,rarity:'uncommon',price:{pl:0,zl:7,sr:0,md:0},effect:'Проводит малое судно через один знакомый портовый проход, мели или прибрежные камни',desc:'Лоцман приходит со своим грузилом и знает сигналы маяка. Шторм, погоня и открытое море в обычный договор не входят.',effects:[{id:'lighthouse-coastal-pilot',type:'scouting',trigger:'enter-guided-coastal-passage',operation:'navigate-known-shoals-and-harbor-rocks',balanceOperation:'artifact-effect',value:1,condition:'one-small-vessel-and-familiar-coast',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'root-valley',marketIds:['morelesie-lighthouse-market']},
    {id:'shp_service_10',name:'Опознание проверенной магии',image:'images/shop/service-10.png',imageThumb:'images/shop/thumbs/service-10.jpg',serviceKind:'magic-identification',powerTier:1,rarity:'uncommon',price:{pl:1,zl:2,sr:0,md:0},effect:'Раскрывает способ активации, заряды, явные эффекты и известные риски одного магического предмета',desc:'Лицензированный маг сверяет отклик вещи с каталогами. Скрытое проклятие, тайна создателя и неизвестная школе магия могут остаться нераскрытыми.',effects:[{id:'licensed-magic-identification',type:'scouting',trigger:'complete-licensed-identification',operation:'reveal-known-item-function-charges-and-risks',balanceOperation:'artifact-effect',value:1,condition:'one-accessible-magic-item;non-destructive-tests',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'upperland',marketIds:['ztuz-licensed-counter','glupishche-hypnoks-eye']},
    {id:'shp_service_11',name:'Оценка происхождения и цены',image:'images/shop/service-11.png',imageThumb:'images/shop/thumbs/service-11.jpg',serviceKind:'appraisal',powerTier:0,rarity:'common',price:{pl:0,zl:1,sr:0,md:0},effect:'Называет вероятный регион, признаки подделки и честный ценовой диапазон одного товара',desc:'Оценщик изучает материал, клеймо и следы оборота. Он не подтверждает законность владения и может ошибиться в уникальной реликвии.',effects:[{id:'golden-measure-appraisal',type:'scouting',trigger:'complete-market-appraisal',operation:'estimate-origin-authenticity-and-market-range',value:1,condition:'one-physical-trade-good',frequency:'charge',charges:1,stacking:'replace'}],baseRegion:'upperland',marketIds:['dorogograd-golden-measure','fishhook-import-row']},
    {id:'shp_service_12',name:'Посредник Болотной Гильдии',image:'images/shop/service-12.png',imageThumb:'images/shop/thumbs/service-12.jpg',serviceKind:'secret-broker',powerTier:1,rarity:'rare',price:{pl:2,zl:5,sr:0,md:0},effect:'За один визит находит продавца выбранной категории тайных или запретных товаров',desc:'Посредник обещает встречу, но не наличие конкретной вещи и не безопасную цену. Сделка оставляет след внимания Гильдии.',effects:[{id:'bog-guild-secret-broker',type:'world',trigger:'commission-secret-market-search',operation:'locate-restricted-seller-category',balanceOperation:'artifact-effect',value:1,condition:'one-category;stock-and-final-price-not-guaranteed',frequency:'charge',charges:1,stacking:'replace'},{id:'bog-guild-attention',type:'risk',trigger:'accept-brokered-meeting',operation:'raise-guild-attention',value:1,frequency:'charge',charges:1,stacking:'refresh'}],baseRegion:'levoshlak',marketIds:['strannograd-bog-guild'],access:{markets:['secret'],legality:'restricted'}}
  ].map(function(item){
    item.icon='🤝';
    item.tags=['service',item.serviceKind,'non-inventory'];
    item.consumption={mode:'service-on-purchase'};
    item.nonInventory=true;
    return finishBatchItem(item,{cat:'service',category:'service',slot:'',tags:[],access:item.access||{markets:item.rarity==='rare'?['secret','guild']:['local-open','city','guild'],legality:'open'}});
  });

  var POISON_ITEMS = [
    {id:'shp_poison_01',name:'Сонная слюна моли',icon:'🦋',tier:1,delivery:'ingested',effect:'Цель получает −1 к Восприятию на 2 раунда',desc:'Фантастический сонный яд в запечатанной ампуле.'},
    {id:'shp_poison_02',name:'Соль дрожащей руки',icon:'🧂',tier:1,delivery:'contact',effect:'Цель получает −1 к тонкой моторике на 2 раунда',desc:'Серая алхимическая соль вызывает краткую дрожь.'},
    {id:'shp_poison_03',name:'Чернильная горечь',icon:'🖋️',tier:1,delivery:'ingested',effect:'Цель не может различать вкус и запах одну сцену',desc:'Безопасная только в игровых правилах вымышленная горечь.'},
    {id:'shp_poison_04',name:'Сок ползучего шипа',icon:'🌵',tier:1,delivery:'weapon-coating',effect:'Следующее попадание снижает скорость цели на 1 клетку на раунд',desc:'Клейкий зелёный сок для одной стрелы или клинка.'},
    {id:'shp_poison_05',name:'Яд стеклянной осы',icon:'🐝',tier:2,delivery:'weapon-coating',effect:'Следующее попадание: 1d6 ядом и −1 к атакам на раунд',desc:'Синяя ампула с вымышленным островным токсином.'},
    {id:'shp_poison_06',name:'Пыль немого корня',icon:'🌱',tier:2,delivery:'inhaled',effect:'Цель не может говорить громче шёпота 2 раунда',desc:'Редкая фантастическая пыль, опасная только в правилах мира.'},
    {id:'shp_poison_07',name:'Масло тяжёлых век',icon:'👁️',tier:2,delivery:'contact',effect:'Цель теряет реакцию до начала следующего хода',desc:'Тёмное алхимическое масло одноразового применения.'},
    {id:'shp_poison_08',name:'Жёлчь болотного угря',icon:'🐍',tier:2,delivery:'weapon-coating',effect:'Следующее попадание: 2d4 ядом',desc:'Зелёная вымышленная желчь в костяном пузырьке.'},
    {id:'shp_poison_09',name:'Пепел пустого смеха',icon:'💀',tier:3,delivery:'inhaled',effect:'Провал спасброска: Испуг на 1 раунд',desc:'Проклятый алхимический пепел с кратким психическим действием.'},
    {id:'shp_poison_10',name:'Кровь белого паука',icon:'🕷️',tier:3,delivery:'weapon-coating',effect:'Следующее попадание: 2d6 ядом и скорость −2 на раунд',desc:'Редкий вымышленный токсин в серебряной ампуле.'},
    {id:'shp_poison_11',name:'Настойка рваного пульса',icon:'🫀',tier:3,delivery:'ingested',effect:'Цель не восстанавливает HP 2 раунда',desc:'Запрещённый фантастический состав подпольных алхимиков.'},
    {id:'shp_poison_12',name:'Слеза неподвижного василиска',icon:'💧',tier:3,delivery:'contact',effect:'Провал спасброска: Обездвиживание до конца следующего хода',desc:'Малая алхимическая имитация легендарного яда василиска.'}
  ].map(function(item){item.powerTier=item.tier;item.rarity=item.tier===1?'common':item.tier===2?'uncommon':'rare';item.price={pl:item.tier*4,zl:0,sr:0,md:0};item.charges=1;item.image='images/shop/poison-'+item.id.slice(-2)+'.png';item.effects=[{id:'poison-'+item.id,type:item.tier===1?'control':item.tier===2?'damage':'control',trigger:'deliver-poison',operation:'poison-effect',value:item.tier,delivery:item.delivery,frequency:'charge',charges:1,stacking:'refresh'}];item.access={markets:['secret'],legality:'forbidden'};item.consumption={mode:'consume-on-use'};return finishBatchItem(item,{cat:'potion',category:'consumable',slot:'consumable',tags:['poison','consumable',item.delivery],access:{markets:['secret'],legality:'forbidden'}});});

  // Лорные товары Зарготы намеренно избегают универсальных плоских бонусов.
  // Они открывают узкое действие, снимают конкретное последствие или меняют
  // цену провала. Вся первая двадцатка немагическая.
  var LORE_GOODS_ITEMS = [
    {id:'shp_loregoods_01',name:'Ржаной квас Трёхкорня',icon:'🍺',image:'images/shop/lore-goods-01.png',goodsGroup:'alcohol',cat:'food',category:'consumable',slot:'consumable',strength:1,servings:2,powerTier:0,rarity:'common',price:{pl:0,zl:0,sr:0,md:4},effect:'Одна порция заменяет часть простого дорожного рациона · почти не опьяняет',desc:'Кисловатый квас из ржаных сухарей и тмина. Им запивают пыль Тракта Трёхкорня, когда вода в бочке уже пахнет деревом.',effects:[{id:'three-root-kvass-ration',type:'world',trigger:'drink-with-travel-meal',operation:'count-as-ration-serving',value:1,frequency:'scene',stacking:'replace'}]},
    {id:'shp_loregoods_02',name:'Грибная брага Мещеры',icon:'🍄',image:'images/shop/lore-goods-02.png',goodsGroup:'alcohol',cat:'food',category:'consumable',slot:'consumable',strength:2,servings:2,powerTier:0,rarity:'common',price:{pl:0,zl:0,sr:1,md:2},effect:'Преимущество при распознавании болотных грибов · резкий запах мешает светской беседе',desc:'Мутная брага из безопасных шляпок и болотного мёда. Мещерские сборщики узнают по запаху, кто пил её впервые.',effects:[{id:'meshchera-brew-fungi',type:'scouting',trigger:'identify-marsh-fungus',operation:'grant-advantage',value:1,condition:'marsh-fungi',frequency:'scene',stacking:'highest'},{id:'meshchera-brew-odor',type:'risk',trigger:'enter-formal-conversation',operation:'impose-disadvantage',value:1,condition:'close-formal-company',frequency:'scene',stacking:'highest'}]},
    {id:'shp_loregoods_03',name:'Штормовой грог Рыбного Крюка',icon:'🥃',image:'images/shop/lore-goods-03.png',goodsGroup:'alcohol',cat:'food',category:'consumable',slot:'consumable',strength:4,servings:3,powerTier:0,rarity:'uncommon',price:{pl:0,zl:2,sr:0,md:0},effect:'Игнорирует первое последствие обычного холода или промокания · тонкая работа получает помеху',desc:'Крепкий тёмный грог с солью и жжёным сахаром. В порту им согревают руки, хотя после второй кружки руки уже не слушаются.',effects:[{id:'fishhook-grog-weather',type:'defense',trigger:'suffer-cold-or-wet-consequence',operation:'ignore-first-consequence',value:1,condition:'ordinary-cold-or-wet',frequency:'scene',stacking:'replace'},{id:'fishhook-grog-hands',type:'risk',trigger:'perform-fine-motor-task',operation:'impose-disadvantage',value:1,condition:'fine-motor-task',frequency:'scene',stacking:'highest'}]},
    {id:'shp_loregoods_04',name:'Сапоги долгого тракта',icon:'🥾',image:'images/shop/lore-goods-04.png',goodsGroup:'boots',cat:'armor',category:'clothing',slot:'feet',powerTier:0,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},effect:'После дневного перехода игнорируй первое последствие усталости ног',desc:'Широкие кожаные сапоги с двойной стелькой и сменными обмотками. Их шьют в Болвановке для гонцов, которым завтра снова идти.',effects:[{id:'long-road-boots-fatigue',type:'world',trigger:'finish-full-day-march',operation:'ignore-first-travel-fatigue-consequence',value:1,condition:'fatigue-from-walking',frequency:'charge',charges:1,stacking:'replace'}]},
    {id:'shp_loregoods_06',name:'Комплект проводника Острого Пика',icon:'🪢',image:'images/shop/lore-goods-06.png',goodsGroup:'climbing',cat:'tool',category:'tool',slot:'utility',powerTier:1,rarity:'uncommon',price:{pl:3,zl:0,sr:0,md:0},effect:'Раз за сцену провал подготовленного подъёма превращается в безопасную остановку на страховке',desc:'Длинный смолёный канат, грудная обвязка, пять стальных крюков и спусковая пластина. Снаряжение тех, кто водит чужих по Острому Пику.',effects:[{id:'sharp-peak-guide-stop',type:'defense',trigger:'fail-prepared-climb',operation:'convert-failure-to-safe-stop',value:3,condition:'route-anchored',actionCost:'reaction',frequency:'scene',stacking:'replace'}]},
    {id:'shp_loregoods_07',name:'Вощёный плащ Верхнего тракта',icon:'🧥',image:'images/shop/lore-goods-07.png',goodsGroup:'cloak',cat:'armor',category:'clothing',slot:'cloak',powerTier:1,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},effect:'Обычный дождь и ветер не портят отдых и спрятанные под плащом документы',desc:'Тяжёлое полотно пропитано воском и льняным маслом. Пахнет обозом, зато переживает верхнеземскую морось.',effects:[{id:'upper-road-cloak-weather',type:'world',trigger:'travel-or-rest-in-rain',operation:'ignore-ordinary-weather-penalty',value:1,condition:'rain-or-wind',frequency:'passive',stacking:'highest'},{id:'upper-road-cloak-documents',type:'world',trigger:'protect-carried-documents',operation:'keep-small-documents-dry',value:1,condition:'ordinary-weather',frequency:'passive',stacking:'replace'}]},
    {id:'shp_loregoods_08',name:'Плащ егеря Гонобесья',icon:'🌲',image:'images/shop/lore-goods-08.png',goodsGroup:'cloak',cat:'armor',category:'clothing',slot:'cloak',powerTier:1,rarity:'uncommon',price:{pl:1,zl:5,sr:0,md:0},effect:'Позволяет скрываться в редком лесном укрытии, если двигаться медленно',desc:'Неровные полосы коричневой шерсти и тусклой зелёной ткани разбивают силуэт среди веток. На бегу плащ цепляется за всё подряд.',effects:[{id:'gonobesye-ranger-cloak',type:'scouting',trigger:'hide-in-sparse-forest-cover',operation:'allow-hide',value:1,condition:'move-slowly-or-still',frequency:'passive',stacking:'highest'}]},
    {id:'shp_loregoods_09',name:'Парусиновый плащ Рыбного Крюка',icon:'⛵',image:'images/shop/lore-goods-09.png',goodsGroup:'cloak',cat:'armor',category:'clothing',slot:'cloak',powerTier:0,rarity:'common',price:{pl:1,zl:0,sr:0,md:0},effect:'За минуту превращается в малый тент, носилки или чехол для груза',desc:'Короткий морской плащ с утяжелённым подолом, петлями и съёмным капюшоном. Портовые рабочие редко используют его только как одежду.',effects:[{id:'fishhook-canvas-cloak',type:'world',trigger:'reconfigure-cloak',operation:'transform-utility-cloth',value:1,condition:'one-minute-and-cord',actionCost:'long',frequency:'scene',stacking:'replace'}]},
    {id:'shp_loregoods_10',name:'Фестивальная лютня Глупища',icon:'🎻',image:'images/shop/lore-goods-10.png',goodsGroup:'instrument',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'common',price:{pl:1,zl:2,sr:0,md:0},effect:'Удачное выступление удерживает дружелюбную публику и открывает разговор с группой',desc:'Грушевидная лютня с яркими тканевыми кистями. Её слышно над ярмарочной площадью, но после дороги струны требуют настройки.',effects:[{id:'glupishche-lute-audience',type:'world',trigger:'complete-public-performance',operation:'create-social-opening',value:1,condition:'non-hostile-audience',frequency:'scene',stacking:'replace'}]},
    {id:'shp_loregoods_11',name:'Походный барабан Талиона',icon:'🥁',image:'images/shop/lore-goods-11.png',goodsGroup:'instrument',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'common',price:{pl:1,zl:0,sr:0,md:0},effect:'Передаёт заранее условленные команды строю или обозу сквозь обычный шум',desc:'Плоский барабан на широком ремне, размеченный строевыми ритмами. В храмах Талиона его звук считают обещанием порядка.',effects:[{id:'talion-march-drum',type:'support',trigger:'play-agreed-signal',operation:'relay-group-command',value:1,condition:'listeners-know-signal',frequency:'scene',stacking:'replace'}]},
    {id:'shp_loregoods_12',name:'Пастушья флейта Трёхкорня',icon:'🪈',image:'images/shop/lore-goods-12.png',goodsGroup:'instrument',cat:'tool',category:'tool',slot:'utility',powerTier:1,rarity:'common',price:{pl:0,zl:6,sr:0,md:0},effect:'Даёт преимущество при привлечении или успокоении обычного домашнего скота',desc:'Светлая бузиновая флейта с тремя пастушьими сигналами. Её простой голос хорошо слышат овцы, козы и люди на соседнем поле.',effects:[{id:'three-root-herder-flute',type:'world',trigger:'guide-domestic-animal',operation:'grant-advantage',value:1,condition:'ordinary-domestic-livestock',frequency:'scene',stacking:'highest'},{id:'three-root-bird-call',type:'world',trigger:'play-local-bird-signal',operation:'imitate-known-bird-call',value:1,condition:'three-local-signals',frequency:'passive',stacking:'replace'}]},
    {id:'shp_loregoods_13',name:'Боевой лом Казад-Дрома',icon:'🔩',image:'images/shop/lore-goods-13.png',goodsGroup:'melee-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:1,rarity:'common',price:{pl:0,zl:6,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Дробящий',range:'Ближняя / 1 клетка',effect:'Работает как оружие и как рычаг для решёток, ящиков и заклинивших дверей',desc:'Кованый лом с обмотанной рукоятью и клиновидным концом. Шахтёры Казад-Дрома ценят его выше красивого меча.',effects:[{id:'kazad-drom-war-prybar',type:'world',trigger:'pry-object',operation:'allow-heavy-prying',value:1,condition:'bars-crates-or-stuck-doors',frequency:'passive',stacking:'highest'}]},
    {id:'shp_loregoods_14',name:'Багор Морелесья',icon:'🪝',image:'images/shop/lore-goods-14.png',goodsGroup:'melee-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:2,powerTier:1,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Колющий',range:'Ближняя / 1–2 клетки',effect:'После попадания позволяет попытаться подтянуть цель или свободный предмет на 1 клетку',desc:'Длинное древко с узким крюком, которым подтягивают сети, бочки и тех, кто слишком близко подошёл к краю причала.',effects:[{id:'moreles-boat-hook-pull',type:'control',trigger:'hit-or-hook-object',operation:'attempt-pull-cells',value:1,condition:'target-not-larger-than-medium-or-unattended',frequency:'round',stacking:'highest'}]},
    {id:'shp_loregoods_15',name:'Болотный тесак Мещеры',icon:'🔪',image:'images/shop/lore-goods-15.png',goodsGroup:'melee-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:1,rarity:'common',price:{pl:0,zl:7,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Рубящий',range:'Ближняя / 1 клетка',effect:'Расчищает камыш, лианы и густой подлесок без потери первого шага',desc:'Широкий однолезвийный тесак с дырчатым полотном, чтобы клинок не вяз в мокрых стеблях.',effects:[{id:'meshchera-marsh-cleaver',type:'tempo',trigger:'move-through-dense-plants',operation:'clear-first-natural-obstacle',value:1,condition:'reeds-vines-or-undergrowth',frequency:'turn',stacking:'highest'}]},
    {id:'shp_loregoods_16',name:'Двуручный молот Шахтогорья',icon:'🔨',image:'images/shop/lore-goods-16.png',goodsGroup:'melee-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:2,powerTier:2,rarity:'uncommon',price:{pl:2,zl:2,sr:0,md:0},damage:'1d10',damageFormula:'1d10',damageType:'Дробящий',range:'Ближняя / 1 клетка',effect:'Преимущество при разрушении каменных преград · помеха в тесном помещении',desc:'Короткий шахтный молот с тяжёлой прямоугольной головкой. Им ломают подпорки и стены, когда путь назад уже не нужен.',effects:[{id:'shakhtogorye-sledge-stone',type:'world',trigger:'break-stone-object',operation:'grant-advantage',value:1,condition:'stone-barrier',frequency:'passive',stacking:'highest'},{id:'shakhtogorye-sledge-cramped',type:'risk',trigger:'attack-in-cramped-space',operation:'impose-disadvantage',value:1,condition:'insufficient-swing-room',frequency:'turn',stacking:'highest'}]},
    {id:'shp_loregoods_17',name:'Длинный лук верхоставской сотни',icon:'🏹',image:'images/shop/lore-goods-17.png',goodsGroup:'ranged-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:2,powerTier:1,rarity:'uncommon',price:{pl:2,zl:8,sr:0,md:0},damage:'1d8',damageFormula:'1d8',damageType:'Колющий',range:'Дальняя / 12 клеток',effect:'Дальнобойный двуручный лук · помеха при стрельбе в тесном помещении',desc:'Высокий тисовый лук с роговыми накладками, рассчитанный на стены Верхостава и открытые поля.',effects:[{id:'upperkeep-longbow-cramped',type:'risk',trigger:'ranged-attack-in-cramped-space',operation:'impose-disadvantage',value:1,condition:'low-ceiling-or-tight-room',frequency:'turn',stacking:'highest'}],tags:['ranged','bow','two-handed']},
    {id:'shp_loregoods_18',name:'Лёгкий арбалет дорожной стражи',icon:'🏹',image:'images/shop/lore-goods-18.png',goodsGroup:'ranged-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:2,powerTier:1,rarity:'common',price:{pl:2,zl:0,sr:0,md:0},damage:'1d8',damageFormula:'1d8',damageType:'Колющий',range:'Дальняя / 10 клеток',effect:'После каждого выстрела требует короткого действия на перезарядку',desc:'Компактный арбалет с деревянным рычагом. Стражники Верхнего тракта могут зарядить его без ворота, но не мгновенно.',effects:[{id:'road-guard-light-crossbow-reload',type:'risk',trigger:'after-ranged-attack',operation:'require-reload-action',value:1,actionCost:'short',frequency:'turn',stacking:'refresh'}],tags:['ranged','crossbow','two-handed']},
    {id:'shp_loregoods_19',name:'Посох-праща камышовых селений',icon:'🪃',image:'images/shop/lore-goods-19.png',goodsGroup:'ranged-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:2,powerTier:1,rarity:'common',price:{pl:0,zl:8,sr:0,md:0},damage:'1d6',damageFormula:'1d6',damageType:'Дробящий',range:'Дальняя / 8 клеток',effect:'Может перебросить снаряд через низкое укрытие, если положение неподвижной цели известно',desc:'Короткий посох с кожаной петлёй увеличивает дугу броска. Камышовые охотники забрасывают им глиняные ядра через заросли.',effects:[{id:'reed-staff-sling-lob',type:'scouting',trigger:'attack-known-stationary-target',operation:'ignore-low-cover',value:1,condition:'target-position-known-and-stationary',frequency:'round',stacking:'highest'}],tags:['ranged','sling','two-handed']},
    {id:'shp_loregoods_20',name:'Охотничьи боласы Гонобесья',icon:'🪢',image:'images/shop/lore-goods-20.png',goodsGroup:'ranged-weapon',cat:'weapon',category:'weapon',slot:'mainHand',handsRequired:1,powerTier:1,rarity:'uncommon',price:{pl:1,zl:4,sr:0,md:0},damage:'1d4',damageFormula:'1d4',damageType:'Дробящий',range:'Дальняя / 5 клеток',effect:'Попадание снижает скорость на 2 до освобождения длинным действием',desc:'Три каменных груза на сыромятных ремнях. Охотники Гонобесья валят ими бегущую добычу, не портя шкуру.',effects:[{id:'gonobesye-hunting-bolas',type:'control',trigger:'ranged-hit',operation:'reduce-speed-until-escape',value:2,condition:'target-has-free-legs',actionCost:'long',frequency:'round',stacking:'refresh'}],tags:['ranged','thrown','entangling']}
  ].map(function(item){
    item.tags = ['zargota-lore-goods','nonmagical',item.goodsGroup].concat(item.tags || []);
    item.access = item.access || {markets:item.goodsGroup === 'alcohol' ? ['local-open','city'] : ['city','guild'],legality:'open'};
    if (item.goodsGroup === 'alcohol') item.intoxication = {strength:item.strength,servings:item.servings,stacksWithAlcohol:true};
    return finishBatchItem(item,{cat:item.cat || 'tool',category:item.category || 'tool',slot:item.slot || 'utility',tags:[],access:{markets:['city','guild'],legality:'open'}});
  });

  var NECROMANCY_ITEMS = [
    {id:'shp_necromancy_01',name:'Набор могильного анатома Страннограда',icon:'🩺',image:'images/shop/necromancy-01.png',necromancyClass:'secret',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'uncommon',price:{pl:1,zl:8,sr:0,md:0},effect:'За 10 минут определяет приблизительное время и обычную причину смерти, а также следы вмешательства',desc:'Костяные щупы, мерная нить, зеркальце и промасленный свёрток. Такой набор покупают лекари, дознаватели и те, кто не зовёт дознавателей.',effects:[{id:'strangograd-grave-anatomist',type:'scouting',trigger:'examine-corpse-ten-minutes',operation:'reveal-death-signs',value:1,condition:'corpse-accessible',actionCost:'long',frequency:'scene',stacking:'replace'}],access:{markets:['secret'],legality:'restricted'}},
    {id:'shp_necromancy_02',name:'Некрографический набор Левошлакской башни',icon:'✒️',image:'images/shop/necromancy-02.png',necromancyClass:'secret',cat:'tool',category:'tool',slot:'utility',powerTier:0,rarity:'uncommon',price:{pl:2,zl:0,sr:0,md:0},effect:'Без повреждения копирует руны, шрамы и остаточные знаки с костей или погребальных предметов',desc:'Тонкая угольная бумага, мягкие валики и серый проявитель. Башенные ученики записывают следы чар прежде, чем задавать вопросы мёртвым.',effects:[{id:'levoshlak-necrograph-copy',type:'world',trigger:'copy-necromantic-markings',operation:'preserve-marking-copy',value:1,condition:'bone-or-funerary-object',actionCost:'long',frequency:'scene',stacking:'replace'}],access:{markets:['secret'],legality:'restricted'}},
    {id:'shp_necromancy_03',name:'Маска трупного воздуха Мещеры',icon:'😷',image:'images/shop/necromancy-03.png',necromancyClass:'secret',cat:'tool',category:'tool',slot:'face',powerTier:0,rarity:'common',price:{pl:1,zl:2,sr:0,md:0},charges:3,effect:'Игнорирует обычные штрафы от смрада, могильных испарений и гнилостных спор · фильтр на 3 тяжёлые сцены',desc:'Кожаная полумаска с мешочками угля, соли и горьких трав. Её шьют в Мещере для тех, кто спускается туда, где воздух уже жил до них.',effects:[{id:'meshchera-corpse-air-mask',type:'defense',trigger:'enter-decay-fumes',operation:'ignore-environmental-penalty',value:1,condition:'stench-corpse-gas-or-decay-spores',frequency:'charge',charges:3,stacking:'highest'}],access:{markets:['secret'],legality:'restricted'}},
    {id:'shp_necromancy_04',name:'Игла последнего ответа',icon:'🪡',image:'images/shop/necromancy-04.png',necromancyClass:'forbidden',cat:'magic',category:'consumable',slot:'consumable',powerTier:0,rarity:'rare',price:{pl:4,zl:5,sr:0,md:0},charges:1,effect:'Свежий труп произносит одну короткую фразу, связанную с последними минутами жизни',desc:'Длинная чёрная игла с полым ушком. Ответ приходит обрывком памяти и не обязан понимать вопрос так, как его понимают живые.',effects:[{id:'last-answer-needle',type:'scouting',trigger:'place-in-fresh-corpse',operation:'question-corpse-memory',value:1,condition:'dead-less-than-one-day',actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}],consumption:{mode:'consume-on-use'},access:{markets:['secret'],legality:'forbidden'}},
    {id:'shp_necromancy_05',name:'Черепной фонарь Берега Мертвецов',icon:'🏮',image:'images/shop/necromancy-05.png',necromancyClass:'forbidden',cat:'magic',category:'tool',slot:'utility',powerTier:1,rarity:'rare',price:{pl:5,zl:0,sr:0,md:0},effect:'Проявляет духов, следы некромантии и недавний путь нежити в радиусе 3 клеток · духи замечают владельца',desc:'Малый железный фонарь собран вокруг выбеленной костяной чаши. Его пламя освещает не комнату, а то, что комната старается забыть.',effects:[{id:'dead-shore-skull-lantern-reveal',type:'scouting',trigger:'light-lantern',operation:'reveal-spirits-and-necromancy',value:6,condition:'within-three-cells',frequency:'scene',stacking:'highest'},{id:'dead-shore-skull-lantern-risk',type:'risk',trigger:'reveal-spirit',operation:'reveal-user-to-spirits',value:1,frequency:'scene',stacking:'refresh'}],access:{markets:['secret'],legality:'forbidden'}},
    {id:'shp_necromancy_06',name:'Соль непогребённой плоти',icon:'⚱️',image:'images/shop/necromancy-06.png',necromancyClass:'forbidden',cat:'magic',category:'consumable',slot:'consumable',powerTier:0,rarity:'rare',price:{pl:3,zl:8,sr:0,md:0},charges:1,effect:'Сохраняет одно тело пригодным для некромантского ритуала до следующего отдыха',desc:'Серые кристаллы из погребальной земли и солёной воды Левошлака. Они не оживляют плоть, лишь не дают времени забрать её первым.',effects:[{id:'unburied-flesh-salt',type:'world',trigger:'prepare-corpse',operation:'preserve-corpse-for-ritual',value:1,condition:'one-corpse',actionCost:'long',frequency:'charge',charges:1,stacking:'replace'}],consumption:{mode:'consume-on-use'},access:{markets:['secret'],legality:'forbidden'}}
  ].map(function(item){item.tags=['necromancy','levoshlak','black-market',item.necromancyClass];return finishBatchItem(item,{cat:item.cat,category:item.category,slot:item.slot,tags:[],access:item.access});});

  // Монеты живут в общем каталоге как предметы мира, но не дают могущества.
  // Их цена равна номиналу, а подробные изображения показывают обе стороны чеканки.
  var CURRENCY_ITEMS = [
    {id:'shp_currency_copper',name:'Медная монета Корневой Долины',icon:'🪙',image:'images/shop/zargota-coin-copper.webp',imageThumb:'images/shop/thumbs/zargota-coin-copper.jpg',baseRegion:'root-valley',marketIds:['glupishche-last-rest','dorogograd-golden-measure'],rarity:'common',price:{pl:0,zl:0,sr:0,md:1},effect:'Расчётная медная монета · 10 медных равны 1 серебряной',desc:'На лицевой стороне выбит сноп, на обороте — пашни Корневой Долины. Ободок несёт слова «Корневая Долина» и «Медь · Хлеб».',tags:['currency','coin','copper','root-valley']},
    {id:'shp_currency_silver',name:'Серебряная монета Левошлака',icon:'🪙',image:'images/shop/zargota-coin-silver.webp',imageThumb:'images/shop/thumbs/zargota-coin-silver.jpg',baseRegion:'levoshlak',marketIds:['strannograd-bog-guild','shakhtogorye-black-anvil'],rarity:'common',price:{pl:0,zl:0,sr:1,md:0},effect:'Расчётная серебряная монета · 10 серебряных равны 1 золотой',desc:'Горные пики и холодный прибой смотрят на портовую крепость Левошлака. На ободке отчеканено «Левошлак» и «Серебро · Море».',tags:['currency','coin','silver','levoshlak']},
    {id:'shp_currency_gold',name:'Золотая монета Верхземья',icon:'🪙',image:'images/shop/zargota-coin-gold.webp',imageThumb:'images/shop/thumbs/zargota-coin-gold.jpg',baseRegion:'upperland',marketIds:['dorogograd-golden-measure','kazad-drom-thundering-mountain'],rarity:'common',price:{pl:0,zl:1,sr:0,md:0},effect:'Основная расчётная монета Зарготы · 10 золотых равны 1 платиновой',desc:'Крепость Верхземья соседствует с раскрытой книгой и мечом. Ободок хранит легенду «Верхземье» и «Золото · Честь».',tags:['currency','coin','gold','upperland']},
    {id:'shp_currency_platinum',name:'Платиновая монета единой Зарготы',icon:'🪙',image:'images/shop/zargota-coin-platinum.webp',imageThumb:'images/shop/thumbs/zargota-coin-platinum.jpg',baseRegion:'zargota-all',marketIds:['dorogograd-golden-measure','fishhook-import-row'],rarity:'uncommon',price:{pl:1,zl:0,sr:0,md:0},effect:'Крупная расчётная монета · 1 платиновая равна 10 золотым',desc:'Светлая платина объединяет корону, горы, поля, башню и якорь четырёх краёв. На ободке выбито «Заргота» и «Платина · Королевство».',tags:['currency','coin','platinum','zargota-all']}
  ].map(function(item){
    item.powerTier=0;
    item.effects=[];
    return finishBatchItem(item,{cat:'other',category:'currency',slot:'',tags:['nonmagical'],access:{markets:['local-open','city','guild'],legality:'open'}});
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  var SHOP_REGION_DEFINITIONS = [
    {id:'zargota-all',label:'Вся Заргота',description:'Общий рынок острова: Верхземье, Корневая Долина, Левошлак и товары без узкой региональной привязки.',includes:['zargota-all','upperland','root-valley','levoshlak']},
    {id:'upperland',label:'Верхземье',description:'Лицензированная магия, университетские товары, металл Казад-Дрома, городское ремесло и импорт через Рыбный Крюк.',includes:['upperland']},
    {id:'root-valley',label:'Корневая Долина',description:'Дерево, сельские промыслы, охота, травничество, ярмарки Глупища и морской товар Морелесья.',includes:['root-valley']},
    {id:'levoshlak',label:'Левошлак',description:'Шахтное и портовое снаряжение, контрабанда, яды, вольная магия и тайные ремёсла.',includes:['levoshlak']},
    {id:'mainland',label:'Большая Земля',description:'Импорт из Анкастии и Элурада: редкие книги, точные инструменты, дорогие материалы и необычная магия.',includes:['mainland']}
  ];

  var SHOP_MARKET_DEFINITIONS = [
    {id:'glupishche-last-rest',region:'root-valley',location:'Глупище',name:'Лавка приключенцев «Последний Привал»',icon:'⚔️',kind:'Лавка приключенцев',quality:'Одна из лучших в Зарготе',owner:'Симур «Тот Самый» Рингол',hours:'Открыта до заката; ночью — только для срочного и дорогого заказа.',description:'Бывшая таверна с дубовыми полами, стойками оружия и чистыми витринами. Симур продаёт снаряжение тем, кто уважает ремесло; грубому торгу предпочитает молчаливый отказ.',people:['Грак Сломщик — молчаливый боец у стойки','Сирвин Тихоход — седой телохранитель у двери'],stock:['Оружие и броня для экспедиций','Походные наборы, ловушки и противоядия','Редкие вещи — штучно и по репутации']},
    {id:'glupishche-hypnoks-eye',region:'root-valley',location:'Глупище',name:'Волшебная лавка «Глаз Гипнока»',icon:'👁️',kind:'Магическая лавка',quality:'Редкая и специализированная',owner:'Хозяин в красном пальто',hours:'Работает днём; особые сделки — по предварительной договорённости.',description:'Трёхэтажная лавка справа от обелиска, набитая книгами, свитками, морскими реагентами и рукописями. Вывеска с морским существом находится под покровительством Дельмариса; её осквернение вызывает гнев бога глубин.',people:['Молчаливый бронзовокожий лавочник в красном пальто'],stock:['Свитки, книги и магические расходники','Алхимические компоненты моря и прилива','Редкости без гарантированного наличия']},
    {id:'glupishche-tuk-da-bryak',region:'root-valley',location:'Глупище',name:'Конюшня «Тук да бряк»',icon:'🐴',kind:'Конюшня',quality:'Надёжная, но не лучшая на острове',owner:'Местный конюх',hours:'От рассвета до заката.',description:'Средняя городская конюшня: животные ухожены, цены честные, а характер каждой лошади конюх знает лучше собственного.',people:['Конюх считает каждую клячу родной, кроме той, что укусила мельника'],stock:['Глушак — тяжёлая упряжная, около 32 зл','Шайка — резвая рыжая, около 38 зл','Крошка Дуня — дорожная упряжная, около 29 зл','Философ Бро — вьючный осёл, около 14 зл']},
    {id:'glupishche-three-ruts',region:'root-valley',location:'Глупище',name:'Двор дилижансов «Три колеи»',icon:'🛞',kind:'Экипажный двор',quality:'Ярмарочный выбор, качество разное',owner:'Союз возчиков Глупища',hours:'Осмотр днём; пробный выезд — до сумерек.',description:'Открытая выставка телег, рабочих повозок и дилижансов у почтового двора. Здесь спорят о колёсах громче, чем на турнире о мечах.',people:['Возчики, плотники и торговцы подержанными экипажами'],stock:['«Квасолёт» — бочечная телега, 12–16 зл','«Бревнобукса» — рабочая повозка, 19–27 зл','«Король Мулов» — тяжёлый склад, 29–35 зл','«Летучий Балаган» — быстрый экипаж, около 70 зл','«Пурпурный дилижанс» — дорожная роскошь, около 85 зл','«Дальний Кров» — жилая карета, около 110 зл','«Долгий Возчик» — грузовой воз, около 45 зл']},
    {id:'glupishche-root-post',region:'root-valley',location:'Глупище',name:'Почтовый двор «Корневой Узел»',icon:'✉️',kind:'Почта и караванный двор',quality:'Хороший региональный уровень',owner:'Старший смотритель тракта',hours:'Приём писем весь день; обозы уходят на рассвете.',description:'Главный узел сообщений Корневой Долины. Не лучший на острове, зато знает каждый тракт, перевозчика и ненадёжный мост.',people:['Почтари, курьеры и наёмные проводники'],stock:['Карты, тубусы и дорожные метки','Курьерское снаряжение','Место в обозе и доставка писем']},
    {id:'glupishche-three-strikes',region:'root-valley',location:'Глупище',name:'Кузница «Три удара»',icon:'🔨',kind:'Кузница и простой бронник',quality:'Добротный ремонт, среднее новое снаряжение',owner:'Артель кузнецов Корневой Долины',hours:'С рассвета до вечернего молота.',description:'Рабочая кузница при городском рынке. Из-за нехватки местной руды здесь отлично чинят и перековывают, но лучшие латы и редкие сплавы заказывают из Казад-Дрома.',people:['Подмастерья, ремонтники обозов и один ворчливый бронник'],stock:['Ремонт оружия, брони и экипажей','Обычные клинки, кольчуги и детали','Редкие металлы только под заказ']},
    {id:'lesorubka-artel-yard',region:'root-valley',location:'Лесорубка',name:'Артельный двор Лесорубки',icon:'🪵',kind:'Ремесленный рынок',quality:'Лучший по дереву и канатам',owner:'Рабочие артели Лесорубки',hours:'С первого гудка лесопилен до заката.',description:'Склады древесины, канатные навесы и лавки плотников у нового тракта. Здесь проще всего найти снаряжение для подъёма, сплава и ремонта.',people:['Лесорубы, плотники, канатчики и речные сплавщики'],stock:['Верёвки, крюки и лестницы','Топоры, тенты и ремонтные наборы','Деревянные детали для повозок']},
    {id:'morelesie-lighthouse-market',region:'root-valley',location:'Морелесье',name:'Рынок под Маяком',icon:'⚓',kind:'Рыбацкий рынок',quality:'Лучший морской товар Долины',owner:'Община Морелесья',hours:'С первого улова до полудня.',description:'Строгий прибрежный рынок под властью хранителя маяка. Здесь продают снасти, соль, смазки и вещи, которые действительно переживают море.',people:['Рыбаки, смотрители маяка и молчаливые старосты'],stock:['Гарпуны, багры и рыбацкое снаряжение','Соль, ром и морские реагенты','Вощёная одежда и поплавки']},
    {id:'dorogograd-golden-measure',region:'upperland',location:'Дорогоград',name:'Торговые ряды «Золотая Мера»',icon:'⚖️',kind:'Городской рынок',quality:'Крупнейший открытый рынок Зарготы',owner:'Торговый Совет Дорогограда',hours:'С утра до вечернего колокола.',description:'Лицензированные ряды столицы: широкий выбор, строгие сборы и отдельные прилавки гильдий. Здесь почти всё можно заказать, если происхождение товара выдержит проверку.',people:['Гильдейские приказчики, оценщики и городская стража'],stock:['Городские товары, одежда и инструменты','Стандартное оружие и броня','Заказы из других регионов']},
    {id:'kazad-drom-thundering-mountain',region:'upperland',location:'Казад-Дром',name:'Гильдия «Гремящая Гора»',icon:'⛏️',kind:'Рудничная гильдия и бронники',quality:'Лучшие металл и тяжёлая работа на острове',owner:'Горрин Камнедер',hours:'Заказы принимают по сменному колоколу.',description:'Гильдия контролирует металл Казад-Дрома и снабжает укрепления, верфи и лучших бронников. Здесь не любят красивых речей, зато отвечают за сплав и заклёпку.',people:['Шахтёры, литейщики, оружейники и тяжёлые бронники'],stock:['Руда, сталь и тяжёлые инструменты','Качественная броня и дробящее оружие','Редкий металл по гильдейскому заказу']},
    {id:'ztuz-licensed-counter',region:'upperland',location:'Дорогоград',name:'Лицензированная коллегия ЗТУЗ',icon:'📜',kind:'Магическая коллегия',quality:'Лучший легальный выбор знаний',owner:'Университет Зарготы',hours:'По учебным дням и только с документами.',description:'Закрытая и дорогая точка доступа к свиткам, исследованиям и проверенным магическим расходникам. Знание здесь продают вместе с контролем.',people:['Писцы, преподаватели, лицензированные маги и надзиратели'],stock:['Свитки и магические расходники','Точные компоненты и книги','Опознание и лицензирование']},
    {id:'fishhook-import-row',region:'upperland',location:'Порт-Рыбный Крюк',name:'Заморские ряды Рыбного Крюка',icon:'🚢',kind:'Портовый импортный рынок',quality:'Лучший импорт, цена нестабильна',owner:'Портовые гильдии',hours:'По приходу судов; лучшие партии уходят утром.',description:'Главные ворота Большой Земли. Здесь появляются ткани Анкастии, книги Элурада, точные инструменты и редкости, которых завтра уже может не быть.',people:['Капитаны, оценщики, контрабандисты и портовая стража'],stock:['Импорт из Анкастии и Элурада','Морское снаряжение и редкие материалы','Штучные артефакты с непостоянной ценой']},
    {id:'strannograd-bog-guild',region:'levoshlak',location:'Странноград',name:'Болотная Гильдия',icon:'🩸',kind:'Теневая торговая сеть',quality:'Лучший чёрный рынок Зарготы',owner:'Голос Гильдии',hours:'Открывается через посредника, а не по вывеске.',description:'Сеть контрабандистов и посредников, контролирующая оружие, яды, артефакты и информацию Левошлака. Покупатель платит не только монетой, но и заметностью.',people:['Посредники, банды, курьеры и неизвестный Голос Гильдии'],stock:['Контрабанда, яды и поддельные документы','Запретные инструменты и информация','Редкие вещи без гарантии происхождения']},
    {id:'shakhtogorye-black-anvil',region:'levoshlak',location:'Шахтогорье',name:'Чёрная наковальня Шахтогорья',icon:'⚒️',kind:'Шахтный рынок и кузницы',quality:'Грубая, тяжёлая и надёжная работа',owner:'Держатели шахтных участков',hours:'Пока горят плавильни.',description:'Разрозненные кузницы у шахт «чёрного камня». Здесь делают тяжёлые инструменты и оружие без красивой отделки, а часть руды проходит мимо любого учёта.',people:['Рудокопы, наёмники, литейщики и люди держателей'],stock:['Шахтное снаряжение и тяжёлое оружие','Неучтённая руда и чёрный камень','Ремонт без лишних вопросов']},
    {id:'sandy-acorn-salvage',region:'levoshlak',location:'Порт Песочный Жёлудь',name:'Рынок обломков Песочного Жёлудя',icon:'🪝',kind:'Портовый рынок руин',quality:'Неровное качество, редкие находки',owner:'Банды и остатки портовых гильдий',hours:'С полудня до тех пор, пока хозяин причала не сменился.',description:'Прилавки среди разрушенных причалов и сгоревших верфей. Тут продают корабельный лом, краденый импорт и вещи из трюмов, о которых никто не заявлял.',people:['Разборщики судов, кабатчики, контрабандисты и бывшие корабелы'],stock:['Корабельный лом и снасти','Серый импорт и подержанное оружие','Необычные находки из дальних трюмов']},
    {id:'levoshlak-tower-vault',region:'levoshlak',location:'Древняя Башня Левошлака',name:'Хранилище Вольной Башни',icon:'🔮',kind:'Тайная магическая лавка',quality:'Сильная магия без лицензий',owner:'Владыка Башни',hours:'Принимает только приглашённых или отчаянных.',description:'Лаборатории и хранилища башни вне законов Зарготы. Здесь встречаются вольная магия, некромантские инструменты и опасные знания с условиями, написанными мелким почерком.',people:['Ученики башни, посредники и слуги без знаков'],stock:['Нелицензированная магия и компоненты','Некромантские инструменты','Редкие ритуальные предметы']}
  ];

  function shopText(item) {
    return [item && item.id,item && item.name,item && item.desc,(item && item.tags || []).join(' ')].join(' ').toLowerCase();
  }

  function inferShopBaseRegion(item) {
    var text = shopText(item);
    if (/shp_(black|poison|necromancy)_/.test(text)) return 'levoshlak';
    if (/левошлак|странноград|шахтогор|гонобесь|острого пика|берега мертвецов|болотн|мещер/.test(text)) return 'levoshlak';
    if (/верхзем|казад-дром|верхостав|рыбного крюка|дорогоград|университет|зтуз/.test(text)) return 'upperland';
    if (/глупищ|трёхкорн|морелес|лесоруб|полев|пастуш|камыш|старого сада/.test(text)) return 'root-valley';
    if (/степного гостя|белого железа|заморск|анкасти|элурад/.test(text)) return 'mainland';
    if (/shp_foundation_(01|02|03|04|05|06|10|11)/.test(text)) return 'root-valley';
    if (/shp_foundation_(07|08|09)/.test(text)) return 'upperland';
    if (/shp_foundation_12/.test(text)) return 'levoshlak';
    if (/shp_consumable_(01|02|03|04|05|07|09|12|14|16|18)/.test(text)) return 'root-valley';
    if (/shp_consumable_(06|08|10|11|15|17|19|20)/.test(text)) return 'upperland';
    if (/shp_weapon_(01|06|07|09|13|16|17|18)/.test(text)) return 'root-valley';
    if (/shp_weapon_(02|03|08|10|14|19)/.test(text)) return 'upperland';
    if (/shp_weapon_(04|05|11|12|15)/.test(text)) return 'levoshlak';
    if (/shp_weapon_20/.test(text)) return 'mainland';
    if (/shp_armor_(01|02|03|05|07|10|11)/.test(text)) return 'root-valley';
    if (/shp_armor_(04|06|08|09|12)/.test(text)) return 'upperland';
    if (/shp_expedition_(01|03|04|05|07|08|09|14|16|19|20)/.test(text)) return 'root-valley';
    if (/shp_expedition_(02|06|10|11|12|13|15|17|18)/.test(text)) return 'upperland';
    if (/shp_scroll_/.test(text)) return 'upperland';
    if (/shp_magiccons_(01|02|04|05|07|10)/.test(text)) return 'upperland';
    if (/shp_craft_(01|03|06|07|10)/.test(text)) return 'upperland';
    if (/shp_craft_(02|05|08)/.test(text)) return 'root-valley';
    if (/shp_craft_(04|09)/.test(text)) return 'levoshlak';
    if (/shp_mobility_(01|02|03|04|07|08|10|12)/.test(text)) return 'root-valley';
    if (/shp_potion_(01|04|05|06|07|09|10|14|15)/.test(text)) return 'root-valley';
    if (/shp_potion_(02|03|08|11|12|13)/.test(text)) return 'upperland';
    if (/shp_adornment_(01|02|04|06|07|08|09|10)/.test(text)) return 'upperland';
    if (/shp_adornment_(11|12|14|15)/.test(text)) return 'root-valley';
    if (/shp_magiccons_(03|06|08|09)|shp_artifact_(08|09|11|12)|shp_adornment_(03|05|13)/.test(text)) return 'mainland';
    return 'zargota-all';
  }

  function inferShopMarketIds(item) {
    var text = shopText(item);
    var region = item.baseRegion || inferShopBaseRegion(item);
    var cat = item.cat || item.category || 'other';
    var legality = item.access && item.access.legality || 'open';
    var ids = [];
    function add(id) { if (ids.indexOf(id) < 0) ids.push(id); }
    if (/shp_armor_(03|11)|shp_foundation_10/.test(text)) add('glupishche-tuk-da-bryak');
    if (/shp_expedition_(17|19)|shp_mobility_12|shp_armor_11/.test(text)) add('glupishche-three-ruts');
    if (/shp_consumable_08|shp_weapon_02|shp_armor_(07|08)/.test(text)) add('glupishche-three-strikes');
    if (/shp_expedition_18|shp_consumable_07|shp_artifact_02|shp_scroll_09|shp_foundation_07/.test(text)) add('glupishche-root-post');
    if (legality === 'forbidden' || legality === 'restricted' || /black-market|контрабанд/.test(text)) {
      add('strannograd-bog-guild');
      if (cat === 'magic' || /necromancy|некромант/.test(text)) add('levoshlak-tower-vault');
      return ids;
    }
    if (region === 'upperland') {
      if (cat === 'magic' || /свиток|магичес/.test(text)) add('ztuz-licensed-counter');
      if (cat === 'weapon' || cat === 'armor' || cat === 'material' || /шахт|кузн|металл/.test(text)) add('kazad-drom-thundering-mountain');
      if (/порт|морск|рыб|гарпун|прилив|доков/.test(text)) add('fishhook-import-row');
      if (!ids.length || cat === 'food' || cat === 'tool') add('dorogograd-golden-measure');
    } else if (region === 'root-valley') {
      if (cat === 'magic' || /свиток|алхим|зель/.test(text)) add('glupishche-hypnoks-eye');
      if (/лесоруб|верёв|канат|крюк|лестниц|топор|бревн|дерев/.test(text)) add('lesorubka-artel-yard');
      if (/морелес|рыб|морск|гарпун|багор|соль|поплав/.test(text)) add('morelesie-lighthouse-market');
      if (cat === 'mount' || /конюх|лошад|упряж/.test(text)) add('glupishche-tuk-da-bryak');
      if (/картограф|курьер|посыльн|тракт|дорожн/.test(text)) add('glupishche-root-post');
      if (cat === 'weapon' || cat === 'armor' || cat === 'potion' || cat === 'tool') add('glupishche-last-rest');
      if (!ids.length) add('glupishche-last-rest');
    } else if (region === 'levoshlak') {
      if (cat === 'magic' || /некромант|ритуал|чар/.test(text)) add('levoshlak-tower-vault');
      if (cat === 'weapon' || cat === 'armor' || cat === 'material' || /шахт|кузн|молот/.test(text)) add('shakhtogorye-black-anvil');
      if (/порт|морск|кораб|снасть|гарпун|багор/.test(text)) add('sandy-acorn-salvage');
      if (cat === 'potion' || cat === 'other' || cat === 'contraband' || !ids.length) add('strannograd-bog-guild');
    } else if (region === 'mainland') {
      add('fishhook-import-row');
      if (cat === 'magic') add('ztuz-licensed-counter');
    } else {
      if (cat === 'magic') { add('glupishche-hypnoks-eye'); add('ztuz-licensed-counter'); }
      else if (cat === 'weapon' || cat === 'armor' || cat === 'potion' || cat === 'tool') { add('glupishche-last-rest'); add('dorogograd-golden-measure'); }
      else if (cat === 'mount') { add('glupishche-tuk-da-bryak'); add('glupishche-three-ruts'); }
      else add('dorogograd-golden-measure');
    }
    return ids;
  }

  function enrichShopItem(item) {
    var enriched = clone(item || {});
    if (enriched.baseRegion === 'zargota') enriched.baseRegion = 'zargota-all';
    enriched.baseRegion = enriched.baseRegion || inferShopBaseRegion(enriched);
    enriched.marketIds = Array.isArray(enriched.marketIds) && enriched.marketIds.length ? enriched.marketIds.slice() : inferShopMarketIds(enriched);
    if (!enriched.imageThumb && /^images\/shop\/[^/]+\.(?:png|jpe?g|webp)$/i.test(String(enriched.image || ''))) {
      enriched.imageThumb = String(enriched.image).replace(/^images\/shop\/([^/]+)\.[^.]+$/i, 'images/shop/thumbs/$1.jpg');
    }
    return enriched;
  }

  function enrichShopItems(items) {
    return (Array.isArray(items) ? items : []).map(enrichShopItem);
  }

  function priceInGold(price) {
    price = price || {};
    return (Number(price.pl) || 0) * 10 + (Number(price.zl) || 0) +
      (Number(price.sr) || 0) / 10 + (Number(price.md) || 0) / 100;
  }

  function averageDice(formula) {
    var text = String(formula || '').toLowerCase().replace(/\s+/g, '');
    var match, total = 0, found = false;
    var dicePattern = /([+-]?)(\d*)d(\d+)/g;
    while ((match = dicePattern.exec(text))) {
      var sign = match[1] === '-' ? -1 : 1;
      var count = Number(match[2] || 1);
      var sides = Number(match[3] || 0);
      total += sign * count * (sides + 1) / 2;
      found = true;
    }
    var flatPattern = /([+-]\d+)(?![^d]*d)/g;
    while ((match = flatPattern.exec(text))) total += Number(match[1]) || 0;
    return found ? Math.max(0, total) : 0;
  }

  function benchmarkForLevel(level) {
    var value = Math.max(1, Math.min(10, Number(level) || 1));
    return clone(LEVEL_BENCHMARKS[value - 1]);
  }

  function emptyPowerVector() {
    var vector = {};
    EFFECT_TYPES.forEach(function (type) { vector[type] = 0; });
    return vector;
  }

  function frequencyMultiplier(frequency) {
    return ({ passive:1, turn:1, round:0.85, combat:0.55, scene:0.45, charge:0.35 })[frequency] || 0.65;
  }

  function actionMultiplier(actionCost) {
    return ({ long:0.55, short:0.75, reaction:0.8, movement:0.8, free:1 })[actionCost] || 1;
  }

  function effectBaseScore(effect, benchmark) {
    var value = Math.abs(Number(effect && effect.value) || 0);
    switch (effect && (effect.balanceOperation || effect.operation)) {
      case 'add-damage-dice':
        return benchmark.damagePerRound
          ? averageDice(effect.dice) / benchmark.damagePerRound * 40
          : 0;
      case 'add-ac': return value * 8;
      case 'check-bonus': return value * 4;
      case 'add-range-cells': return value * 1.2;
      case 'use-found-stones': return 3;
      case 'remove-status': return 12;
      case 'reduce-damage-dice': return averageDice(effect.dice) * 5;
      case 'add-speed': return value * 10;
      case 'save-bonus': return value * 9;
      case 'prevent-fatigue': return 6;
      case 'apply-light': return 9;
      case 'navigation-bonus': return value * 5;
      case 'carry-capacity': return value * 0.5;
      case 'cast-catalog-spell': return ({1:18,2:36,3:64,4:105,5:160})[Number(effect.spellLevel)] || 18;
      case 'restore-ac': return value * 12;
      case 'ignore-penalty': return 9;
      case 'create-hazard-zone': return 20;
      case 'create-sound': return 9;
      case 'restore-hp-dice': return (averageDice(effect.dice) + value) * 5;
      case 'regeneration-dice': return averageDice(effect.dice) * Math.max(1,Number(effect.durationRounds)||1) * 5;
      case 'artifact-effect': return ({1:12,2:32,3:70})[Number(effect.value)] || 12;
      case 'underworld-tool': return ({1:12,2:32,3:70})[Number(effect.value)] || 12;
      case 'poison-effect': return ({1:18,2:36,3:70})[Number(effect.value)] || 18;
      case 'potion-effect': return ({1:24,2:44,3:78})[Number(effect.balanceTier)] || 24;
      case 'prevent-fall': return 40;
      case 'create-anchor': return value * 5;
      case 'create-route': return value * 8;
      case 'ignore-difficult-cells': return value * 3;
      case 'add-jump-cells': return value * 25;
      case 'reaction-step': return 30;
      case 'alarm-ward': return 15;
      case 'levitate-willing': return 30;
      case 'reveal-invisibility-zone': return 30;
      case 'stationary-spell-ward': return 32;
      case 'temporary-repair-focus': return 30;
      case 'remote-view': return 30;
      case 'crafting-component': return Math.min(3, Math.max(1, value));
      case 'reveal-tracks': return 20;
      case 'reduce-ac': return value * 22;
      case 'apply-status': return 27;
      case 'safe-camp': return 9;
      case 'repel-beasts': return 14;
      case 'muffle-sound': return 9;
      case 'escape-bonus': return value * 5;
      case 'grant-breath': return 20;
      case 'prevent-item-break': return 20;
      case 'add-attack-bonus': return value * 6;
      case 'ignore-shield-ac': return value * 6;
      case 'replace-damage-dice': return Math.max(2, (averageDice(effect.toDice) - averageDice(effect.fromDice)) * 5);
      case 'add-flat-damage': return value * 4;
      case 'free-draw': return 4;
      case 'deliver-applied-poison': return 6;
      case 'pull-cells': return value * 8;
      case 'spend-action': return 4;
      case 'prevent-pack-support': return 16;
      case 'suppress-regeneration': return 28;
      case 'reveal-creature': return 12;
      case 'block-teleport': return 28;
      case 'block-transformation': return 28;
      case 'disable-reaction': return 20;
      case 'reduce-speed': return value * 10;
      case 'reduce-attack-bonus': return value * 6;
      case 'ignore-resistance-on-next-hit': return 28;
      case 'prevent-hide': return 16;
      case 'prevent-forced-movement': return 28;
      case 'suppress-curse-trait': return 28;
      case 'identify-resistance': return 12;
      case 'prepare-counter': return value * 8;
      case 'create-obscured-zone':
        var area = String(effect.areaCells || '').match(/(\d+)\s*x\s*(\d+)/i);
        var cells = area ? Number(area[1]) * Number(area[2]) : 1;
        return 14 + Math.max(0, cells - 1) * 0.5 + Math.max(0, Number(effect.durationRounds) - 1) * 2;
      default: return value ? value * 3 : 3;
    }
  }

  function scoreEffect(effect, benchmark) {
    var type = EFFECT_TYPES.indexOf(effect && effect.type) >= 0 ? effect.type : 'world';
    var multiplier = frequencyMultiplier(effect && effect.frequency) * actionMultiplier(effect && effect.actionCost);
    if (effect && effect.condition) multiplier *= 0.7;
    if (effect && Number(effect.charges) === 1) multiplier *= 0.9;
    return { type:type, score:effectBaseScore(effect, benchmark) * multiplier };
  }

  function itemRangeCells(item) {
    var numbers = String(item && item.range || '').match(/\d+/g);
    if (!numbers || !numbers.length) return 0;
    return Math.max.apply(Math, numbers.map(Number));
  }

  function scoreItemDefinition(item) {
    item = item || {};
    var level = Number(item.recommendedLevel && item.recommendedLevel.min) || 1;
    var benchmark = benchmarkForLevel(level);
    var vector = emptyPowerVector();
    var damageAverage = averageDice(item.damageFormula || item.damage);
    if (damageAverage) vector.damage += Math.max(0, damageAverage - 2.5) * 1.5;
    if (/дальн|ranged|bow|sling/i.test([item.range, item.tags].join(' '))) {
      vector.scouting += Math.min(3, itemRangeCells(item) / 6);
    }
    var typedAc = Math.max(0, Number(item.acBonus || item.defense) || 0);
    var explicitAcEffect = (Array.isArray(item.effects) ? item.effects : []).some(function (effect) {
      return effect && effect.operation === 'add-ac';
    });
    if (typedAc && !explicitAcEffect) vector.defense += typedAc * 8;
    (Array.isArray(item.effects) ? item.effects : []).forEach(function (effect) {
      var result = scoreEffect(effect, benchmark);
      vector[result.type] += result.score;
    });
    Object.keys(vector).forEach(function (key) {
      vector[key] = Math.round(vector[key] * 10) / 10;
    });
    var positive = EFFECT_TYPES.filter(function (type) { return type !== 'risk'; }).reduce(function (sum, type) {
      return sum + vector[type];
    }, 0);
    var reviewIndex = Math.max(0, positive - vector.risk);
    reviewIndex = Math.round(reviewIndex * 10) / 10;
    var tier = Math.max(0, Math.min(5, Number(item.powerTier) || 0));
    var band = POWER_TIER_BANDS[tier];
    var priceGold = priceInGold(item.price);
    var flags = [];
    if (reviewIndex < band.min) flags.push('below-tier');
    if (reviewIndex > band.max) flags.push('above-tier');
    if (priceGold < band.priceMin) flags.push('below-price-band');
    if (priceGold > band.priceMax) flags.push('above-price-band');
    if (item.handsRequired === 2) flags.push('two-handed-cost');
    if (item.charges === 1) flags.push('single-use');
    return {
      id:item.id || '',
      name:item.name || '',
      benchmarkLevel:benchmark.level,
      benchmark:benchmark,
      powerTier:tier,
      vector:vector,
      reviewIndex:reviewIndex,
      priceGold:Math.round(priceGold * 100) / 100,
      status:flags.indexOf('above-tier') >= 0 ? 'review-high' : flags.indexOf('below-tier') >= 0 ? 'review-low' : 'within-tier',
      flags:flags,
      confidence:Array.isArray(item.effects) && item.effects.length ? 'structured' : 'legacy-low'
    };
  }

  function auditItemDefinitions(items) {
    return (Array.isArray(items) ? items : []).map(scoreItemDefinition);
  }

  function levelRequirement(level) {
    var value = Math.max(1, Math.min(10, Number(level) || 1));
    return clone(LEVEL_REQUIREMENTS[value - 1]);
  }

  function validateItemDefinition(item) {
    var errors = [];
    if (!item || typeof item !== 'object') return ['item must be an object'];
    if (!/^shp_[a-z0-9_]+$/i.test(String(item.id || ''))) errors.push('invalid id');
    if (!String(item.name || '').trim()) errors.push('missing name');
    if (!String(item.cat || item.category || '').trim()) errors.push('missing category');
    if (Number(item.schemaVersion) !== SCHEMA_VERSION) errors.push('unsupported schemaVersion');
    if (!(Number(item.powerTier) >= 0 && Number(item.powerTier) <= 5)) errors.push('powerTier must be 0..5');
    var minLevel = Number(item.recommendedLevel && item.recommendedLevel.min);
    var maxLevel = Number(item.recommendedLevel && item.recommendedLevel.max);
    if (!(minLevel >= 1 && maxLevel <= 10 && minLevel <= maxLevel)) errors.push('invalid recommendedLevel');
    var markets = item.access && item.access.markets;
    if (!Array.isArray(markets) || !markets.length || markets.some(function (market) {
      return MARKETS.indexOf(market) < 0;
    })) errors.push('invalid access markets');
    if (LEGALITIES.indexOf(String(item.access && item.access.legality || '')) < 0) errors.push('invalid access legality');
    if (!(priceInGold(item.price) >= 0)) errors.push('invalid price');
    (Array.isArray(item.effects) ? item.effects : []).forEach(function (effect, index) {
      if (EFFECT_TYPES.indexOf(effect && effect.type) < 0) errors.push('effect ' + index + ' has invalid type');
      if (STACKING_RULES.indexOf(effect && effect.stacking) < 0) errors.push('effect ' + index + ' has invalid stacking');
      if (!String(effect && effect.trigger || '').trim()) errors.push('effect ' + index + ' has no trigger');
      if (!String(effect && effect.operation || '').trim()) errors.push('effect ' + index + ' has no operation');
    });
    return errors;
  }

  function validateItemCollection(items) {
    var seen = Object.create(null), errors = [];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      if (seen[item.id]) errors.push(item.id + ': duplicate id');
      seen[item.id] = true;
      validateItemDefinition(item).forEach(function (error) {
        errors.push(item.id + ': ' + error);
      });
    });
    return errors;
  }

  function validateFoundationItems() {
    return validateItemCollection(FOUNDATION_ITEMS);
  }

  function validateConsumableItems() {
    return validateItemCollection(CONSUMABLE_ITEMS);
  }

  function validateWeaponItems() {
    return validateItemCollection(WEAPON_ITEMS);
  }

  function validateCreatureCounterItems() {
    var errors = validateItemCollection(CREATURE_COUNTER_ITEMS);
    CREATURE_COUNTER_ITEMS.forEach(function (item) {
      if (!Array.isArray(item.counterTargets) || !item.counterTargets.length) {
        errors.push(item.id + ': missing counterTargets');
      }
    });
    return errors;
  }

  function validateArmorAndClothingItems() {
    var errors = validateItemCollection(ARMOR_AND_CLOTHING_ITEMS);
    ARMOR_AND_CLOTHING_ITEMS.forEach(function (item) {
      if (!String(item.armorFamily || '').trim()) errors.push(item.id + ': missing armorFamily');
      if (item.category === 'clothing' && Number(item.acBonus || item.defense)) {
        errors.push(item.id + ': ordinary clothing must not grant AC');
      }
    });
    return errors;
  }

  function validateShieldItems() {
    var errors = validateItemCollection(SHIELD_ITEMS);
    if (SHIELD_ITEMS.length !== 5) errors.push('shields: expected five items');
    var roles = Object.create(null);
    SHIELD_ITEMS.forEach(function(item){
      if (item.cat !== 'armor' || item.category !== 'shield' || item.slot !== 'offHand') errors.push(item.id + ': shield catalog placement is invalid');
      if (item.handsRequired !== 1) errors.push(item.id + ': shield must use one hand');
      if (!(item.acBonus === 1 || item.acBonus === 2)) errors.push(item.id + ': shield must have supported base protection');
      if (!String(item.shieldRole || '').trim() || roles[item.shieldRole]) errors.push(item.id + ': missing or duplicate shieldRole');
      roles[item.shieldRole] = true;
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': shield effect text must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateCuirassItems() {
    var errors = validateItemCollection(CUIRASS_ITEMS);
    if (CUIRASS_ITEMS.length !== 4) errors.push('cuirasses: expected four items');
    var roles = Object.create(null);
    CUIRASS_ITEMS.forEach(function(item){
      if (item.cat !== 'armor' || item.category !== 'armor' || item.slot !== 'body') errors.push(item.id + ': cuirass catalog placement is invalid');
      if (item.handsRequired !== 0) errors.push(item.id + ': cuirass must not use a hand');
      if (!(item.acBonus === 2 || item.acBonus === 3)) errors.push(item.id + ': cuirass must have supported base protection');
      if (!String(item.cuirassRole || '').trim() || roles[item.cuirassRole]) errors.push(item.id + ': missing or duplicate cuirassRole');
      roles[item.cuirassRole] = true;
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': cuirass effect text must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateCreatureHuntConsumableItems() {
    var errors = validateItemCollection(CREATURE_HUNT_CONSUMABLE_ITEMS);
    var deliveries = ['weapon-coating','thrown','device'];
    CREATURE_HUNT_CONSUMABLE_ITEMS.forEach(function (item) {
      if (!Array.isArray(item.counterTargets) || !item.counterTargets.length) {
        errors.push(item.id + ': missing counterTargets');
      }
      if (Number(item.charges) !== 1) errors.push(item.id + ': hunting consumable must have one charge');
      if (deliveries.indexOf(item.delivery) < 0) errors.push(item.id + ': invalid delivery');
    });
    return errors;
  }

  function validateExpeditionGearItems() {
    var errors = validateItemCollection(EXPEDITION_GEAR_ITEMS);
    var groups = ['shelter','water','cooking-fire','camp-tools','travel-support'];
    EXPEDITION_GEAR_ITEMS.forEach(function (item) {
      if (groups.indexOf(item.expeditionGroup) < 0) errors.push(item.id + ': invalid expeditionGroup');
      if (item.category !== 'tool') errors.push(item.id + ': expedition gear must be a tool');
      if (item.rarity !== 'common' && item.rarity !== 'uncommon') errors.push(item.id + ': expedition gear must be ordinary quality');
    });
    return errors;
  }

  function validateSpellScrollItems() {
    var errors = validateItemCollection(SPELL_SCROLL_ITEMS);
    SPELL_SCROLL_ITEMS.forEach(function (item) {
      if (!(Number(item.spellRefId) > 0)) errors.push(item.id + ': missing spellRefId');
      if (!(Number(item.spellLevel) >= 1 && Number(item.spellLevel) <= 5)) errors.push(item.id + ': spellLevel must be 1..5');
      if (Number(item.charges) !== 1) errors.push(item.id + ': scroll must have one charge');
      if (!item.consumption || item.consumption.teachesSpell !== false) errors.push(item.id + ': scroll must not teach its spell');
    });
    return errors;
  }

  function validateMagicalConsumableItems() {
    var errors = validateItemCollection(MAGICAL_CONSUMABLE_ITEMS);
    MAGICAL_CONSUMABLE_ITEMS.forEach(function (item) {
      if (item.category !== 'consumable' || item.cat !== 'magic') errors.push(item.id + ': magical tool must be a magic consumable');
      if (Number(item.charges) !== 1) errors.push(item.id + ': magical consumable must have one charge');
      if (!item.consumption || item.consumption.mode !== 'consume-on-use') errors.push(item.id + ': missing consumption rule');
    });
    return errors;
  }

  function validateCraftingComponentItems() {
    var errors = validateItemCollection(CRAFTING_COMPONENT_ITEMS);
    CRAFTING_COMPONENT_ITEMS.forEach(function (item) {
      var crafting = item.crafting || {};
      if (item.category !== 'material') errors.push(item.id + ': crafting component must be a material');
      if (!(Number(crafting.grade) >= 1 && Number(crafting.grade) <= 3)) errors.push(item.id + ': invalid crafting grade');
      if (!Array.isArray(crafting.affinities) || !crafting.affinities.length) errors.push(item.id + ': missing crafting affinities');
      if (!Array.isArray(crafting.uses) || !crafting.uses.length) errors.push(item.id + ': missing crafting uses');
      if (!Array.isArray(crafting.potionRefs) || !crafting.potionRefs.length) errors.push(item.id + ': missing potion recipes');
      else crafting.potionRefs.forEach(function (id) { if (!CRAFTING_POTION_NAMES[id]) errors.push(item.id + ': unknown potion recipe ' + id); });
      if (crafting.consumedByRecipe !== true) errors.push(item.id + ': component must be consumed by recipe');
    });
    return errors;
  }

  function validateAlcoholItems() {
    var errors = validateItemCollection(ALCOHOL_ITEMS);
    ALCOHOL_ITEMS.forEach(function(item){
      if (!(item.intoxication && item.intoxication.strength >= 1 && item.intoxication.strength <= 5)) errors.push(item.id + ': invalid alcohol strength');
      if (item.category !== 'consumable') errors.push(item.id + ': alcohol must be consumable');
    });
    return errors;
  }

  function validateMovementGearItems() {
    var errors = validateItemCollection(MOVEMENT_GEAR_ITEMS);
    MOVEMENT_GEAR_ITEMS.forEach(function(item){if(!item.group) errors.push(item.id + ': missing movement group');});
    return errors;
  }

  function validateMinorArtifactItems() {
    var errors = validateItemCollection(MINOR_ARTIFACT_ITEMS);
    MINOR_ARTIFACT_ITEMS.forEach(function(item){if(!(item.artifactLevel>=1&&item.artifactLevel<=3)) errors.push(item.id + ': artifactLevel must be 1..3');});
    return errors;
  }

  function validatePotionItems() {
    var errors = validateItemCollection(POTION_ITEMS);
    POTION_ITEMS.forEach(function(item){if(Number(item.charges)!==1) errors.push(item.id + ': potion must have one charge');});
    if (POTION_ITEMS.filter(function(item){return item.role==='healing';}).length !== 4) errors.push('potions: expected exactly four healing types');
    return errors;
  }

  function validateMagicAdornmentItems() {
    var errors = validateItemCollection(MAGIC_ADORNMENT_ITEMS);
    ['ring','amulet','charm'].forEach(function(kind){if(MAGIC_ADORNMENT_ITEMS.filter(function(item){return item.kind===kind;}).length!==5) errors.push('adornments: expected five '+kind);});
    return errors;
  }

  function validateSpellFormItems() {
    var errors = validateItemCollection(SPELL_FORM_ITEMS);
    var expectedForms = ['directed','concentration','touch','area'];
    if (SPELL_FORM_ITEMS.length !== expectedForms.length) errors.push('spell forms: expected four items');
    expectedForms.forEach(function(form){if(SPELL_FORM_ITEMS.filter(function(item){return item.spellForm===form;}).length!==1) errors.push('spell forms: expected one '+form+' item');});
    SPELL_FORM_ITEMS.forEach(function(item){
      if (item.charges !== 1 || item.maxCharges !== 1 || item.recharge !== 'next-combat') errors.push(item.id + ': expected one charge per combat');
      if (!/Раз за бой/.test(item.effect)) errors.push(item.id + ': cooldown must be visible in effect text');
      if (!item.effects.length || item.effects.some(function(effect){return effect.frequency!=='combat'||effect.charges!==1||effect.recharge!=='next-combat';})) errors.push(item.id + ': structured cooldown mismatch');
    });
    var areaItem = SPELL_FORM_ITEMS.filter(function(item){return item.spellForm==='area';})[0];
    if (areaItem && areaItem.effects[0].targetLimit !== 1) errors.push(areaItem.id + ': area bonus must affect one target only');
    return errors;
  }

  function validateBlackMarketItems() {
    var errors = validateItemCollection(BLACK_MARKET_ITEMS);
    BLACK_MARKET_ITEMS.forEach(function(item){if(item.access.markets.indexOf('secret')<0) errors.push(item.id + ': black market item must use secret market');});
    return errors;
  }

  function validateForbiddenGoodsItems() {
    var errors = validateItemCollection(FORBIDDEN_GOODS_ITEMS);
    if (FORBIDDEN_GOODS_ITEMS.length !== 12) errors.push('forbidden goods: expected twelve items');
    if (FORBIDDEN_GOODS_ITEMS.filter(function(item){return item.tags.indexOf('fictional-drug') >= 0;}).length !== 6) errors.push('forbidden goods: expected six fictional drugs');
    FORBIDDEN_GOODS_ITEMS.forEach(function(item){
      if (item.cat !== 'contraband') errors.push(item.id + ': forbidden good must use contraband category');
      if (item.access.legality !== 'forbidden' || item.access.markets.indexOf('secret') < 0) errors.push(item.id + ': forbidden good must use forbidden secret access');
      if (!String(item.contrabandKind || '').trim()) errors.push(item.id + ': missing contrabandKind');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': forbidden good must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateThiefGearItems() {
    var errors = validateItemCollection(THIEF_GEAR_ITEMS);
    THIEF_GEAR_ITEMS.forEach(function(item){
      if (!String(item.thiefRole || '').trim()) errors.push(item.id + ': missing thiefRole');
      if (item.tags.indexOf('thief-gear') < 0) errors.push(item.id + ': missing thief-gear tag');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': thief gear must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateArcaneFocusItems() {
    var errors = validateItemCollection(ARCANE_FOCUS_ITEMS);
    var expectedKinds = {staff:8,wand:7,scepter:4,bracer:3,glove:3};
    Object.keys(expectedKinds).forEach(function(kind){
      if (ARCANE_FOCUS_ITEMS.filter(function(item){return item.focusKind===kind;}).length !== expectedKinds[kind]) errors.push('arcane focuses: wrong count for ' + kind);
    });
    ARCANE_FOCUS_ITEMS.forEach(function(item){
      if (item.tags.indexOf('arcane-focus') < 0) errors.push(item.id + ': missing arcane-focus tag');
      if (!String(item.focusRole || '').trim()) errors.push(item.id + ': missing focusRole');
      if (item.focusKind === 'staff' && item.handsRequired !== 2) errors.push(item.id + ': staff must use two hands');
      if ((item.focusKind === 'wand' || item.focusKind === 'scepter') && item.handsRequired !== 1) errors.push(item.id + ': wand and scepter must use one hand');
      if ((item.focusKind === 'bracer' || item.focusKind === 'glove') && item.handsRequired !== 0) errors.push(item.id + ': wearable focus must leave hands available');
      if (item.focusKind === 'bracer' && item.slot !== 'wrists') errors.push(item.id + ': bracer must use wrists slot');
      if (item.focusKind === 'glove' && item.slot !== 'hands') errors.push(item.id + ': glove must use hands slot');
      if (item.focusKind === 'scepter' && item.category !== 'weapon') errors.push(item.id + ': scepter must be a weapon');
      if (!item.effects.some(function(effect){return effect.operation !== 'cast-catalog-spell' && /spell|caster/.test(String(effect.trigger || ''));})) errors.push(item.id + ': focus must enhance owner spellcasting');
      if (item.boundSpell) {
        if (!(Number(item.boundSpell.spellRefId) > 0)) errors.push(item.id + ': bound spell missing spellRefId');
        if (!(Number(item.boundSpell.spellLevel) > 0)) errors.push(item.id + ': bound spell missing spellLevel');
        if (!item.effects.some(function(effect){return effect.operation === 'cast-catalog-spell' && Number(effect.spellRefId) === Number(item.boundSpell.spellRefId);})) errors.push(item.id + ': bound spell effect mismatch');
      }
    });
    if (ARCANE_FOCUS_ITEMS.filter(function(item){return item.boundSpell;}).length !== 9) errors.push('arcane focuses: expected nine bound catalog spells');
    return errors;
  }

  function validateProsthesisItems() {
    var errors = validateItemCollection(PROSTHESIS_ITEMS);
    if (PROSTHESIS_ITEMS.length !== 7) errors.push('prostheses: expected seven items');
    var slots = Object.create(null);
    PROSTHESIS_ITEMS.forEach(function(item){
      if (!String(item.prosthesisSlot || '').trim()) errors.push(item.id + ': missing prosthesisSlot');
      if (slots[item.prosthesisSlot]) errors.push(item.id + ': duplicate prosthesisSlot');
      slots[item.prosthesisSlot] = true;
      if (item.tags.indexOf('prosthesis') < 0) errors.push(item.id + ': missing prosthesis tag');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': prosthesis must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateTransportItems() {
    var errors = validateItemCollection(TRANSPORT_ITEMS);
    [{kind:'horse',count:4},{kind:'wagon',count:13},{kind:'boat',count:4}].forEach(function(expected){
      if (TRANSPORT_ITEMS.filter(function(item){return item.transportKind===expected.kind;}).length !== expected.count) errors.push('transport: expected ' + expected.count + ' ' + expected.kind);
    });
    ['stagecoach','carriage','cart'].forEach(function(kind){
      if (TRANSPORT_ITEMS.filter(function(item){return item.roadVehicleKind===kind;}).length !== 3) errors.push('transport: expected three road vehicles of kind ' + kind);
    });
    TRANSPORT_ITEMS.forEach(function(item){
      if (item.cat !== 'mount') errors.push(item.id + ': transport must use mount catalog category');
      if (item.tags.indexOf('transport') < 0) errors.push(item.id + ': missing transport tag');
      if (!(Number(item.capacityKg) > 0)) errors.push(item.id + ': missing capacity');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': transport must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateSaddleItems() {
    var errors = validateItemCollection(SADDLE_ITEMS);
    if (SADDLE_ITEMS.length !== 6) errors.push('saddles: expected six items');
    var roles = Object.create(null);
    SADDLE_ITEMS.forEach(function(item){
      if (item.cat !== 'mount' || item.category !== 'saddle') errors.push(item.id + ': saddle catalog placement is invalid');
      if (!String(item.saddleRole || '').trim() || roles[item.saddleRole]) errors.push(item.id + ': missing or duplicate saddleRole');
      roles[item.saddleRole] = true;
      if (item.tags.indexOf('saddle') < 0 || item.tags.indexOf('mount-gear') < 0) errors.push(item.id + ': missing saddle tags');
      if (!item.compatibleMounts || item.compatibleMounts.indexOf('horse') < 0) errors.push(item.id + ': missing horse compatibility');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': saddle must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateTrainedAnimalItems() {
    var errors = validateItemCollection(TRAINED_ANIMAL_ITEMS);
    if (TRAINED_ANIMAL_ITEMS.length !== 3) errors.push('trained animals: expected three items');
    var roles = Object.create(null);
    TRAINED_ANIMAL_ITEMS.forEach(function(item){
      if (item.cat !== 'mount' || item.category !== 'trained-animal') errors.push(item.id + ': trained animal catalog placement is invalid');
      if (!String(item.trainedRole || '').trim() || roles[item.trainedRole]) errors.push(item.id + ': missing or duplicate trainedRole');
      roles[item.trainedRole] = true;
      if (!item.care || !item.care.feed || !item.care.rest) errors.push(item.id + ': missing care requirements');
      if (item.tags.indexOf('trained-animal') < 0) errors.push(item.id + ': missing trained-animal tag');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': trained animal must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validateAmmunitionAndSiegeItems() {
    var errors = validateItemCollection(AMMUNITION_AND_SIEGE_ITEMS);
    if (AMMUNITION_AND_SIEGE_ITEMS.length !== 12) errors.push('ammunition and siege: expected twelve items');
    ['arrow','bolt','siege'].forEach(function(kind){
      var count = kind === 'siege'
        ? AMMUNITION_AND_SIEGE_ITEMS.filter(function(item){return item.munitionKind.indexOf('siege')===0;}).length
        : AMMUNITION_AND_SIEGE_ITEMS.filter(function(item){return item.munitionKind===kind;}).length;
      if (count !== 4) errors.push('ammunition and siege: expected four ' + kind);
    });
    AMMUNITION_AND_SIEGE_ITEMS.forEach(function(item){
      if (item.cat !== 'weapon') errors.push(item.id + ': ammunition or siege item must use weapon catalog category');
      if (item.tags.indexOf('ammunition') < 0) errors.push(item.id + ': missing ammunition tag');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': ammunition must avoid flat numeric bonuses');
      if (item.munitionKind === 'siege-weapon' && (!(item.crew >= 1) || !item.mountRequired)) errors.push(item.id + ': siege weapon needs crew and mounting requirement');
    });
    return errors;
  }

  function validateServiceItems() {
    var errors = validateItemCollection(SERVICE_ITEMS);
    if (SERVICE_ITEMS.length !== 12) errors.push('services: expected twelve items');
    var kinds = Object.create(null);
    SERVICE_ITEMS.forEach(function(item){
      if (item.cat !== 'service' || item.category !== 'service') errors.push(item.id + ': service must use service category');
      if (!item.nonInventory || !item.consumption || item.consumption.mode !== 'service-on-purchase') errors.push(item.id + ': service must be fulfilled on purchase');
      if (!String(item.serviceKind || '').trim()) errors.push(item.id + ': missing serviceKind');
      if (kinds[item.serviceKind]) errors.push(item.id + ': duplicate serviceKind');
      kinds[item.serviceKind] = true;
      if (item.tags.indexOf('service') < 0) errors.push(item.id + ': missing service tag');
      if (/\+\s*\d|−\s*\d/.test(String(item.effect || ''))) errors.push(item.id + ': service must avoid flat numeric bonuses');
    });
    return errors;
  }

  function validatePoisonItems() {
    var errors = validateItemCollection(POISON_ITEMS);
    var deliveries=['ingested','contact','inhaled','weapon-coating'];
    POISON_ITEMS.forEach(function(item){
      if(deliveries.indexOf(item.delivery)<0) errors.push(item.id + ': invalid poison delivery');
      if(Number(item.charges)!==1) errors.push(item.id + ': poison must have one charge');
      if(item.access.legality!=='forbidden') errors.push(item.id + ': poison must be forbidden');
    });
    return errors;
  }

  function validateLoreGoodsItems() {
    var errors = validateItemCollection(LORE_GOODS_ITEMS);
    var groups = ['alcohol','boots','climbing','cloak','instrument','melee-weapon','ranged-weapon'];
    LORE_GOODS_ITEMS.forEach(function(item){
      if (groups.indexOf(item.goodsGroup) < 0) errors.push(item.id + ': invalid lore goods group');
      if (item.tags.indexOf('nonmagical') < 0) errors.push(item.id + ': lore goods must be nonmagical');
      if (item.access.legality !== 'open') errors.push(item.id + ': ordinary lore goods must be open');
    });
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='alcohol';}).length !== 3) errors.push('lore goods: expected three alcohol items');
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='climbing';}).length !== 1) errors.push('lore goods: expected one expert climbing kit beside foundation apprentice kit');
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='cloak';}).length !== 3) errors.push('lore goods: expected three cloaks');
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='instrument';}).length !== 3) errors.push('lore goods: expected three instruments');
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='melee-weapon';}).length !== 4) errors.push('lore goods: expected four melee weapons');
    if (LORE_GOODS_ITEMS.filter(function(item){return item.goodsGroup==='ranged-weapon';}).length !== 4) errors.push('lore goods: expected four ranged weapons');
    return errors;
  }

  function validateNecromancyItems() {
    var errors = validateItemCollection(NECROMANCY_ITEMS);
    NECROMANCY_ITEMS.forEach(function(item){
      if (item.tags.indexOf('necromancy') < 0) errors.push(item.id + ': missing necromancy tag');
      if (item.access.markets.indexOf('secret') < 0) errors.push(item.id + ': necromancy item must use secret market');
      if (item.necromancyClass !== 'secret' && item.necromancyClass !== 'forbidden') errors.push(item.id + ': invalid necromancy class');
      if (item.necromancyClass === 'forbidden' && item.access.legality !== 'forbidden') errors.push(item.id + ': forbidden necromancy item has wrong legality');
    });
    if (NECROMANCY_ITEMS.filter(function(item){return item.necromancyClass==='secret';}).length !== 3) errors.push('necromancy: expected three secret items');
    if (NECROMANCY_ITEMS.filter(function(item){return item.necromancyClass==='forbidden';}).length !== 3) errors.push('necromancy: expected three forbidden items');
    return errors;
  }

  function definitionToInventorySnapshot(definition, itemId, quantity) {
    var item = clone(definition || {});
    return {
      itemId:String(itemId || ('zg-item-' + Date.now())),
      definitionId:String(item.id || ''),
      definitionVersion:Number(item.definitionVersion) || 1,
      name:item.name || 'Предмет',
      category:item.category || item.cat || 'other',
      image:item.image || '',
      icon:item.icon || '',
      qty:Math.max(1, Number(quantity) || 1),
      equipped:false,
      slot:item.slot || '',
      handsRequired:Number(item.handsRequired) || 0,
      damageFormula:item.damageFormula || item.damage || '',
      damageType:item.damageType || '',
      range:item.range || '',
      acBonus:Number(item.acBonus || item.defense) || 0,
      charges:item.charges == null ? null : Math.max(0, Number(item.charges) || 0),
      maxCharges:item.maxCharges == null ? null : Math.max(0, Number(item.maxCharges) || 0),
      recharge:item.recharge || '',
      spellRefId:item.spellRefId == null ? null : Number(item.spellRefId),
      spellLevel:item.spellLevel == null ? null : Number(item.spellLevel),
      consumption:item.consumption || null,
      crafting:item.crafting || null,
      intoxication:item.intoxication || null,
      effects:Array.isArray(item.effects) ? item.effects : [],
      effectText:item.effect || '',
      description:item.desc || '',
      definitionSnapshot:item
    };
  }

  return {
    SCHEMA_VERSION:SCHEMA_VERSION,
    POWER_MODEL_VERSION:POWER_MODEL_VERSION,
    EFFECT_TYPES:EFFECT_TYPES.slice(),
    STACKING_RULES:STACKING_RULES.slice(),
    MARKETS:MARKETS.slice(),
    LEGALITIES:LEGALITIES.slice(),
    SHOP_REGIONS:clone(SHOP_REGION_DEFINITIONS),
    SHOP_MARKETS:clone(SHOP_MARKET_DEFINITIONS),
    LEVEL_REQUIREMENTS:clone(LEVEL_REQUIREMENTS),
    LEVEL_BENCHMARKS:clone(LEVEL_BENCHMARKS),
    POWER_TIER_BANDS:clone(POWER_TIER_BANDS),
    levelRequirement:levelRequirement,
    benchmarkForLevel:benchmarkForLevel,
    averageDice:averageDice,
    priceInGold:priceInGold,
    scoreEffect:scoreEffect,
    scoreItemDefinition:scoreItemDefinition,
    auditItemDefinitions:auditItemDefinitions,
    validateItemDefinition:validateItemDefinition,
    validateFoundationItems:validateFoundationItems,
    validateConsumableItems:validateConsumableItems,
    validateWeaponItems:validateWeaponItems,
    validateCreatureCounterItems:validateCreatureCounterItems,
    validateArmorAndClothingItems:validateArmorAndClothingItems,
    validateShieldItems:validateShieldItems,
    validateCuirassItems:validateCuirassItems,
    validateCreatureHuntConsumableItems:validateCreatureHuntConsumableItems,
    validateExpeditionGearItems:validateExpeditionGearItems,
    validateSpellScrollItems:validateSpellScrollItems,
    validateMagicalConsumableItems:validateMagicalConsumableItems,
    validateCraftingComponentItems:validateCraftingComponentItems,
    validateAlcoholItems:validateAlcoholItems,
    validateMovementGearItems:validateMovementGearItems,
    validateMinorArtifactItems:validateMinorArtifactItems,
    validatePotionItems:validatePotionItems,
    validateMagicAdornmentItems:validateMagicAdornmentItems,
    validateSpellFormItems:validateSpellFormItems,
    validateBlackMarketItems:validateBlackMarketItems,
    validateForbiddenGoodsItems:validateForbiddenGoodsItems,
    validateThiefGearItems:validateThiefGearItems,
    validateArcaneFocusItems:validateArcaneFocusItems,
    validateProsthesisItems:validateProsthesisItems,
    validateTransportItems:validateTransportItems,
    validateSaddleItems:validateSaddleItems,
    validateTrainedAnimalItems:validateTrainedAnimalItems,
    validateAmmunitionAndSiegeItems:validateAmmunitionAndSiegeItems,
    validateServiceItems:validateServiceItems,
    validatePoisonItems:validatePoisonItems,
    validateLoreGoodsItems:validateLoreGoodsItems,
    validateNecromancyItems:validateNecromancyItems,
    getFoundationItems:function () { return clone(FOUNDATION_ITEMS); },
    getConsumableItems:function () { return clone(CONSUMABLE_ITEMS); },
    getWeaponItems:function () { return clone(WEAPON_ITEMS); },
    getCreatureCounterItems:function () { return clone(CREATURE_COUNTER_ITEMS); },
    getArmorAndClothingItems:function () { return clone(ARMOR_AND_CLOTHING_ITEMS); },
    getShieldItems:function () { return clone(SHIELD_ITEMS); },
    getCuirassItems:function () { return clone(CUIRASS_ITEMS); },
    getCreatureHuntConsumableItems:function () { return clone(CREATURE_HUNT_CONSUMABLE_ITEMS); },
    getExpeditionGearItems:function () { return clone(EXPEDITION_GEAR_ITEMS); },
    getSpellScrollItems:function () { return clone(SPELL_SCROLL_ITEMS); },
    getMagicalConsumableItems:function () { return clone(MAGICAL_CONSUMABLE_ITEMS); },
    getCraftingComponentItems:function () { return clone(CRAFTING_COMPONENT_ITEMS); },
    getAlcoholItems:function () { return clone(ALCOHOL_ITEMS); },
    getMovementGearItems:function () { return clone(MOVEMENT_GEAR_ITEMS); },
    getMinorArtifactItems:function () { return clone(MINOR_ARTIFACT_ITEMS); },
    getPotionItems:function () { return clone(POTION_ITEMS); },
    getMagicAdornmentItems:function () { return clone(MAGIC_ADORNMENT_ITEMS); },
    getSpellFormItems:function () { return clone(SPELL_FORM_ITEMS); },
    getBlackMarketItems:function () { return clone(BLACK_MARKET_ITEMS); },
    getForbiddenGoodsItems:function () { return clone(FORBIDDEN_GOODS_ITEMS); },
    getThiefGearItems:function () { return clone(THIEF_GEAR_ITEMS); },
    getArcaneFocusItems:function () { return clone(ARCANE_FOCUS_ITEMS); },
    getProsthesisItems:function () { return clone(PROSTHESIS_ITEMS); },
    getTransportItems:function () { return clone(TRANSPORT_ITEMS); },
    getSaddleItems:function () { return clone(SADDLE_ITEMS); },
    getTrainedAnimalItems:function () { return clone(TRAINED_ANIMAL_ITEMS); },
    getAmmunitionAndSiegeItems:function () { return clone(AMMUNITION_AND_SIEGE_ITEMS); },
    getServiceItems:function () { return clone(SERVICE_ITEMS); },
    getPoisonItems:function () { return clone(POISON_ITEMS); },
    getLoreGoodsItems:function () { return clone(LORE_GOODS_ITEMS); },
    getNecromancyItems:function () { return clone(NECROMANCY_ITEMS); },
    getCurrencyItems:function () { return clone(CURRENCY_ITEMS); },
    getShopRegions:function () { return clone(SHOP_REGION_DEFINITIONS); },
    getShopMarkets:function () { return clone(SHOP_MARKET_DEFINITIONS); },
    enrichShopItem:enrichShopItem,
    enrichShopItems:enrichShopItems,
    getShopSeedItems:function () { return enrichShopItems(FOUNDATION_ITEMS.concat(CONSUMABLE_ITEMS, WEAPON_ITEMS, CREATURE_COUNTER_ITEMS, ARMOR_AND_CLOTHING_ITEMS, SHIELD_ITEMS, CUIRASS_ITEMS, CREATURE_HUNT_CONSUMABLE_ITEMS, EXPEDITION_GEAR_ITEMS, SPELL_SCROLL_ITEMS, MAGICAL_CONSUMABLE_ITEMS, CRAFTING_COMPONENT_ITEMS, ALCOHOL_ITEMS, MOVEMENT_GEAR_ITEMS, MINOR_ARTIFACT_ITEMS, POTION_ITEMS, MAGIC_ADORNMENT_ITEMS, SPELL_FORM_ITEMS, BLACK_MARKET_ITEMS, FORBIDDEN_GOODS_ITEMS, THIEF_GEAR_ITEMS, ARCANE_FOCUS_ITEMS, PROSTHESIS_ITEMS, TRANSPORT_ITEMS, SADDLE_ITEMS, TRAINED_ANIMAL_ITEMS, AMMUNITION_AND_SIEGE_ITEMS, SERVICE_ITEMS, POISON_ITEMS, LORE_GOODS_ITEMS, NECROMANCY_ITEMS, CURRENCY_ITEMS)); },
    definitionToInventorySnapshot:definitionToInventorySnapshot
  };
});
