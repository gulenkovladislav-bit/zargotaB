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
      id:'shp_counter_05', name:'Сеть миротворца', icon:'🕸️', image:'images/shop/peacekeeper-weighted-net.png',
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

  // Одноразовые составы и приспособления для охоты на конкретные типы
  // существ. Они создают короткое тактическое окно: одно попадание или один
  // раунд. Это расходная подготовка, а не постоянный обязательный бонус билда.
  var CREATURE_HUNT_CONSUMABLE_ITEMS = [
    {
      id:'shp_hunt_01', name:'Смоляное масло углежога', icon:'🧴', image:'images/shop/charcoal-resin-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['plant'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','guild'],legality:'open'}, price:{pl:0,zl:6,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по растению: +1d4 огнём и без регенерации на 1 раунд',
      effects:[
        {id:'charcoal-resin-burn',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Огненный',condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'charcoal-resin-sear',type:'control',trigger:'same-coated-hit',operation:'suppress-regeneration',durationRounds:1,condition:'target-is-plant',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Густая смола цепляется за клинок и продолжает тлеть в древесной плоти. Одной порции хватает на одно удачное попадание.'
    },
    {
      id:'shp_hunt_02', name:'Масло белого железа', icon:'🧴', image:'images/shop/white-iron-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['undead'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:8,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по нежити: +1d4 и цель нельзя скрыть на 1 раунд',
      effects:[
        {id:'white-iron-strike',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Духовный',condition:'target-is-undead',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'white-iron-mark',type:'scouting',trigger:'same-coated-hit',operation:'prevent-hide',durationRounds:1,condition:'target-is-undead',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Светлая взвесь остаётся на мёртвой плоти заметным следом. Это не святая реликвия, а добротная работа храмового алхимика.'
    },
    {
      id:'shp_hunt_03', name:'Масло медной грозы', icon:'⚡', image:'images/shop/copper-storm-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['construct'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:9,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по конструкту: +1d4 молнией и AC −1 на 1 раунд',
      effects:[
        {id:'copper-storm-spark',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Электрический',condition:'target-is-construct',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'copper-storm-gap',type:'control',trigger:'same-coated-hit',operation:'reduce-ac',value:1,durationRounds:1,condition:'target-is-construct',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}
      ],
      desc:'Медная суспензия растекается по сочленениям и на миг выдаёт слабый зазор между пластинами.'
    },
    {
      id:'shp_hunt_04', name:'Масло холодного железа', icon:'🧴', image:'images/shop/cold-iron-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['demon'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','licensed'],legality:'restricted'}, price:{pl:1,zl:2,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по демону: +1d4 и запрет телепортации на 1 раунд',
      effects:[
        {id:'cold-iron-strike',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Холодное железо',condition:'target-is-demon',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'cold-iron-anchor',type:'control',trigger:'same-coated-hit',operation:'block-teleport',durationRounds:1,condition:'target-is-demon',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Серая паста холодит рукоять даже через перчатку. Рана от неё на несколько мгновений делает расстояние для демона настоящим.'
    },
    {
      id:'shp_hunt_05', name:'Масло ледяной кромки', icon:'❄️', image:'images/shop/frost-edge-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['elemental','dragon'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:6}, access:{markets:['city','guild'],legality:'open'}, price:{pl:0,zl:7,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по огненной твари: +1d4 холодом и скорость −1 на 1 раунд',
      effects:[
        {id:'frost-edge-strike',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Холодный',condition:'target-is-fire-elemental-or-fire-dragon',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'frost-edge-slow',type:'control',trigger:'same-coated-hit',operation:'reduce-speed',value:1,durationRounds:1,condition:'target-is-fire-elemental-or-fire-dragon',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'}
      ],
      desc:'Холодная мазь не замораживает оружие навсегда. Она забирает жар из одной раны и делает следующий шаг твари тяжелее.'
    },
    {
      id:'shp_hunt_06', name:'Масло охотничьей соли', icon:'🧂', image:'images/shop/hunter-salt-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['beast'],
      rarity:'common', powerTier:2, recommendedLevel:{min:1,max:5}, access:{markets:['local-open','city'],legality:'open'}, price:{pl:0,zl:5,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по зверю: +1d4 и зверь теряет поддержку стаи на 1 раунд',
      effects:[
        {id:'hunter-salt-strike',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Физический',condition:'target-is-beast',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'hunter-salt-scent',type:'control',trigger:'same-coated-hit',operation:'prevent-pack-support',durationRounds:1,condition:'target-is-beast',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Резкая соль перебивает запах стаи и жжёт чувствительную рану. Против одиночного хищника остаётся просто хорошей присыпкой.'
    },
    {
      id:'shp_hunt_07', name:'Масло ясного контура', icon:'👁️', image:'images/shop/clear-contour-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-attack', counterTargets:['aberration'],
      rarity:'uncommon', powerTier:1, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:1,zl:0,sr:0,md:0},
      effect:'Короткое действие · следующая атака по аберрации получает +1 и проявляет её до конца раунда',
      effects:[
        {id:'clear-contour-aim',type:'damage',trigger:'next-weapon-attack',operation:'add-attack-bonus',value:1,condition:'target-is-aberration',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'clear-contour-mark',type:'scouting',trigger:'same-coated-attack',operation:'reveal-creature',durationRounds:1,condition:'target-is-aberration',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
      ],
      desc:'Почти прозрачное масло ломает ложные блики вокруг клинка. Даже промах на миг показывает, где у невозможного тела настоящий край.'
    },
    {
      id:'shp_hunt_08', name:'Масло красной нити', icon:'🧵', image:'images/shop/red-thread-weapon-oil.png',
      delivery:'weapon-coating', appliesTo:'one-weapon-until-next-hit', counterTargets:['cursed'],
      rarity:'uncommon', powerTier:2, recommendedLevel:{min:2,max:7}, access:{markets:['guild','secret'],legality:'restricted'}, price:{pl:1,zl:4,sr:0,md:0},
      effect:'Короткое действие · следующее попадание по проклятому: +1d4 и запрет смены облика на 1 раунд',
      effects:[
        {id:'red-thread-strike',type:'damage',trigger:'next-weapon-hit',operation:'add-damage-dice',dice:'1d4',damageType:'Ритуальный',condition:'target-is-cursed',actionCost:'short',frequency:'charge',charges:1,stacking:'highest'},
        {id:'red-thread-bind',type:'control',trigger:'same-coated-hit',operation:'block-transformation',durationRounds:1,condition:'target-is-cursed',actionCost:'short',frequency:'charge',charges:1,stacking:'refresh'}
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
    { id:'shp_expedition_14', name:'Пеньковая верёвка, 15 метров', icon:'🪢', image:'images/shop/hemp-rope-coil.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:4,sr:0,md:0}, effect:'+1 к страховке, связыванию и подъёму груза', desc:'Толстая смолёная верёвка без красивого плетения. Держит человека, тент и умеренный груз.', effects:[{id:'hemp-rope-work',type:'world',trigger:'climb-bind-or-haul',operation:'check-bonus',value:1,condition:'rope-can-be-secured',frequency:'passive',stacking:'highest'}] },
    { id:'shp_expedition_15', name:'Складная полевая лопата', icon:'⛏️', image:'images/shop/folding-field-shovel.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, effect:'+1 к устройству кострища, канавы или укрытия', desc:'Короткая железная лопата с шарнирной рукоятью. Ею окапывают палатку, тушат угли и освобождают колесо.', effects:[{id:'field-shovel-work',type:'world',trigger:'dig-campworks',operation:'check-bonus',value:1,condition:'workable-ground',frequency:'passive',stacking:'highest'}] },
    { id:'shp_expedition_16', name:'Малый лагерный топор', icon:'🪓', image:'images/shop/compact-camp-hatchet.png', expeditionGroup:'camp-tools', rarity:'common', price:{pl:0,zl:5,sr:0,md:0}, effect:'+1 к заготовке дров и лёгкой плотницкой работе', desc:'Компактный топорик с кожаным чехлом. Хорош для сучьев, кольев и щепы, но не рассчитан на бой.', effects:[{id:'camp-hatchet-work',type:'world',trigger:'process-wood',operation:'check-bonus',value:1,condition:'camp-scale-task',frequency:'passive',stacking:'highest'}] },

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
    { id:'shp_scroll_12', name:'Свиток «Оживление Оружия»', icon:'📜', image:'images/shop/scroll-animate-weapon.png', spellRefId:1775561773885, spellName:'Оживление Оружия', spellLevel:4, school:'Школа войны Дельйвана Кель-Эстеро', rarity:'rare', price:{pl:15,zl:0,sr:0,md:0}, effect:'Разовое чтение · оживляет подходящее немагическое оружие на 5 раундов', desc:'Железная печать с клинком замыкает импульс движения. Оружие действует после читателя и требует концентрации.' }
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
    item.access = {
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
    shp_potion_15:'Зелье прозрачного слуха'
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
    { id:'shp_craft_07', name:'Флакон зеркального песка', icon:'⌛', image:'images/shop/mirror-sand-vial.png', rarity:'common', price:{pl:0,zl:7,sr:0,md:0}, desc:'Каждая песчинка отражает предмет под немного иным углом.', crafting:{grade:1,sourceType:'mineral',affinities:['illusion','divination','reflection'],uses:['scrying-lens','revealing-powder'],potionRefs:['shp_potion_09','shp_potion_14'],consumedByRecipe:true,unit:'vial'} },
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
    {id:'shp_mobility_01',name:'Кошки каменщика',icon:'🧗',effect:'+1 к подъёму по камню и кирпичу',desc:'Ременные накладки с короткими сменными зубьями.',group:'climb',price:{pl:0,zl:6,sr:0,md:0},effects:[{id:'mason-crampons',type:'tempo',trigger:'climb-masonry',operation:'check-bonus',value:1,condition:'stone-or-brick',frequency:'passive',stacking:'highest'}]},
    {id:'shp_mobility_02',name:'Крюк с обратным зубом',icon:'🪝',effect:'Закрепляет верёвку на уступе до 4 клеток',desc:'Тяжёлый трёхлапый крюк с кольцом и защитой от соскальзывания.',group:'climb',price:{pl:0,zl:8,sr:0,md:0},effects:[{id:'barbed-hook',type:'world',trigger:'throw-and-secure',operation:'create-anchor',value:4,actionCost:'long',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_03',name:'Верёвочная лестница, 6 метров',icon:'🪜',effect:'Создаёт проходимый вертикальный маршрут на 4 клетки',desc:'Лёгкие ясеневые ступени и смолёные боковые канаты.',group:'climb',price:{pl:0,zl:7,sr:0,md:0},effects:[{id:'rope-ladder',type:'tempo',trigger:'secure-ladder',operation:'create-route',value:4,actionCost:'long',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_04',name:'Пояс страховщика',icon:'🪢',effect:'Реакция · останови падение, если привязан к опоре',desc:'Широкий кожаный пояс с двумя стальными кольцами.',group:'climb',price:{pl:1,zl:2,sr:0,md:0},powerTier:2,effects:[{id:'belay-belt',type:'defense',trigger:'fall-while-anchored',operation:'prevent-fall',value:1,condition:'secured-rope',actionCost:'reaction',frequency:'scene',stacking:'replace'}]},
    {id:'shp_mobility_05',name:'Болотные снегоступы',icon:'🛷',effect:'Игнорируют 1 клетку штрафа вязкой земли за ход',desc:'Широкие плетёные рамы не дают ногам глубоко уходить в ил.',group:'terrain',price:{pl:0,zl:9,sr:0,md:0},effects:[{id:'marsh-shoes',type:'tempo',trigger:'move-through-soft-ground',operation:'ignore-difficult-cells',value:1,condition:'mud-snow-or-marsh',frequency:'turn',stacking:'highest'}]},
    {id:'shp_mobility_06',name:'Ледовые шипы сапог',icon:'⛸️',effect:'+1 к равновесию на льду и мокром камне',desc:'Накладные железные пластины с четырьмя короткими шипами.',group:'terrain',price:{pl:0,zl:5,sr:0,md:0},effects:[{id:'ice-spikes',type:'tempo',trigger:'cross-slippery-ground',operation:'check-bonus',value:1,condition:'ice-or-wet-stone',frequency:'passive',stacking:'highest'}]},
    {id:'shp_mobility_07',name:'Складной шест бродника',icon:'🎋',effect:'+1 к поиску опоры и переходу мелкого брода',desc:'Составной шест с широким железным подпятником.',group:'water',price:{pl:0,zl:6,sr:0,md:0},effects:[{id:'ford-pole',type:'scouting',trigger:'cross-shallow-water',operation:'check-bonus',value:1,condition:'wadeable-water',frequency:'passive',stacking:'highest'}]},
    {id:'shp_mobility_08',name:'Надувной бурдюк-поплавок',icon:'🛟',effect:'+1 к удержанию на воде с лёгкой поклажей',desc:'Промасленная кожаная камера с петлёй под руку.',group:'water',price:{pl:0,zl:7,sr:0,md:0},effects:[{id:'skin-float',type:'defense',trigger:'stay-afloat',operation:'check-bonus',value:1,condition:'light-load',frequency:'passive',stacking:'highest'}]},
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
    {id:'shp_potion_01',name:'Малое зелье лечения',icon:'❤️',potionTier:1,role:'healing',effect:'Короткое действие · восстанови 1d6+2 HP',desc:'Красная полевая настойка для свежих ран.',operation:'restore-hp-dice',dice:'1d6',value:2},
    {id:'shp_potion_02',name:'Зелье лечения',icon:'💖',potionTier:2,role:'healing',effect:'Короткое действие · восстанови 2d6+3 HP',desc:'Густой рубиновый состав из лицензированной аптеки.',operation:'restore-hp-dice',dice:'2d6',value:3},
    {id:'shp_potion_03',name:'Большое зелье лечения',icon:'💗',potionTier:3,role:'healing',effect:'Короткое действие · восстанови 3d6+5 HP',desc:'Редкий восстанавливающий состав с серебряным осадком.',operation:'restore-hp-dice',dice:'3d6',value:5},
    {id:'shp_potion_04',name:'Зелье медленного восстановления',icon:'💓',potionTier:2,role:'healing',effect:'В конце трёх следующих ходов восстанови по 1d4 HP',desc:'Тёмно-красное зелье действует мягче, но дольше.',operation:'regeneration-dice',dice:'1d4',durationRounds:3},
    {id:'shp_potion_05',name:'Зелье ясной крови',icon:'🩸',potionTier:1,role:'cleanse',effect:'Снимает обычное Отравление или даёт повторный спасбросок против сильного',desc:'Горькая зелёная смесь очищающих солей.',operation:'remove-status',value:1},
    {id:'shp_potion_06',name:'Зелье спокойного сердца',icon:'🫀',potionTier:1,role:'cleanse',effect:'Снимает Испуг либо подавляет его на 2 раунда',desc:'Молочная настойка замедляет дрожь и дыхание.',operation:'remove-status',value:1},
    {id:'shp_potion_07',name:'Зелье кошачьего шага',icon:'🐈',potionTier:2,role:'mobility',effect:'+2 клетки скорости на 3 раунда',desc:'Золотистая жидкость делает движения мягкими и быстрыми.',operation:'add-speed',value:2,durationRounds:3},
    {id:'shp_potion_08',name:'Зелье каменной кожи',icon:'🪨',potionTier:2,role:'defense',effect:'Снизь первый физический урон на 1d6 в течение 3 раундов',desc:'Серая взвесь на миг уплотняет верхний слой кожи.',operation:'reduce-damage-dice',dice:'1d6',durationRounds:3},
    {id:'shp_potion_09',name:'Зелье ночного зрения',icon:'👁️',potionTier:1,role:'scouting',effect:'Игнорирует штраф тусклого света на одну сцену',desc:'Чернильная жидкость расширяет зрачки до рассветной серости.',operation:'ignore-penalty',value:1},
    {id:'shp_potion_10',name:'Зелье жабр',icon:'🐟',potionTier:2,role:'exploration',effect:'Позволяет дышать под водой 10 минут',desc:'Солёная синяя микстура оставляет холод в горле.',operation:'grant-breath',value:10},
    {id:'shp_potion_11',name:'Зелье лёгкой руки',icon:'🖐️',potionTier:1,role:'utility',effect:'+1 к одной проверке тонкой ручной работы',desc:'Бесцветная настойка временно успокаивает пальцы.',operation:'check-bonus',value:1},
    {id:'shp_potion_12',name:'Зелье громового голоса',icon:'📣',potionTier:1,role:'social',effect:'+1 к одной проверке приказа или запугивания голосом',desc:'Жёлтая шипучая жидкость делает голос низким и звонким.',operation:'check-bonus',value:1},
    {id:'shp_potion_13',name:'Зелье искрового сопротивления',icon:'⚡',potionTier:2,role:'defense',effect:'Снизь следующий урон молнией на 2d6',desc:'Медная взвесь уводит один разряд в землю.',operation:'reduce-damage-dice',dice:'2d6'},
    {id:'shp_potion_14',name:'Зелье памяти пути',icon:'🗺️',potionTier:1,role:'scouting',effect:'+1 к возвращению по уже пройденному маршруту',desc:'После глотка недавние ориентиры вспоминаются особенно ясно.',operation:'navigation-bonus',value:1},
    {id:'shp_potion_15',name:'Зелье прозрачного слуха',icon:'👂',potionTier:2,role:'scouting',effect:'На 3 раунда +1 к слуху, но −1 против звуковых атак',desc:'Фиолетовая микстура усиливает и шёпот, и болезненный звон.',operation:'check-bonus',value:1,risk:'sound-vulnerability'}
  ].map(function(item){item.powerTier=item.potionTier;item.rarity=item.potionTier===1?'common':item.potionTier===2?'uncommon':'rare';item.price={pl:item.potionTier===1?0:item.potionTier*2,zl:item.potionTier===1?8:0,sr:0,md:0};item.charges=1;item.image='images/shop/potion-'+item.id.slice(-2)+'.png';item.effects=[{id:'potion-'+item.id,type:item.role==='healing'||item.role==='cleanse'?'support':item.role==='defense'?'defense':item.role==='scouting'?'scouting':'tempo',trigger:'drink-potion',operation:item.operation,balanceOperation:'potion-effect',balanceTier:item.potionTier,value:item.value,dice:item.dice,durationRounds:item.durationRounds,actionCost:'short',frequency:'charge',charges:1,stacking:'replace'}];if(item.risk)item.effects.push({id:'risk-'+item.id,type:'risk',trigger:'drink-potion',operation:'apply-vulnerability',value:1,condition:item.risk,frequency:'charge',charges:1,stacking:'replace'});item.consumption={mode:'consume-on-use'};return finishBatchItem(item,{cat:'potion',category:'consumable',slot:'consumable',tags:['potion','consumable',item.role],access:{markets:['city','guild'],legality:'open'}});});

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
      if (!(Number(item.spellLevel) >= 1 && Number(item.spellLevel) <= 4)) errors.push(item.id + ': spellLevel must be 1..4');
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

  function validateBlackMarketItems() {
    var errors = validateItemCollection(BLACK_MARKET_ITEMS);
    BLACK_MARKET_ITEMS.forEach(function(item){if(item.access.markets.indexOf('secret')<0) errors.push(item.id + ': black market item must use secret market');});
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
    validateBlackMarketItems:validateBlackMarketItems,
    validatePoisonItems:validatePoisonItems,
    validateLoreGoodsItems:validateLoreGoodsItems,
    validateNecromancyItems:validateNecromancyItems,
    getFoundationItems:function () { return clone(FOUNDATION_ITEMS); },
    getConsumableItems:function () { return clone(CONSUMABLE_ITEMS); },
    getWeaponItems:function () { return clone(WEAPON_ITEMS); },
    getCreatureCounterItems:function () { return clone(CREATURE_COUNTER_ITEMS); },
    getArmorAndClothingItems:function () { return clone(ARMOR_AND_CLOTHING_ITEMS); },
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
    getBlackMarketItems:function () { return clone(BLACK_MARKET_ITEMS); },
    getPoisonItems:function () { return clone(POISON_ITEMS); },
    getLoreGoodsItems:function () { return clone(LORE_GOODS_ITEMS); },
    getNecromancyItems:function () { return clone(NECROMANCY_ITEMS); },
    getShopRegions:function () { return clone(SHOP_REGION_DEFINITIONS); },
    getShopMarkets:function () { return clone(SHOP_MARKET_DEFINITIONS); },
    enrichShopItem:enrichShopItem,
    enrichShopItems:enrichShopItems,
    getShopSeedItems:function () { return enrichShopItems(FOUNDATION_ITEMS.concat(CONSUMABLE_ITEMS, WEAPON_ITEMS, CREATURE_COUNTER_ITEMS, ARMOR_AND_CLOTHING_ITEMS, CREATURE_HUNT_CONSUMABLE_ITEMS, EXPEDITION_GEAR_ITEMS, SPELL_SCROLL_ITEMS, MAGICAL_CONSUMABLE_ITEMS, CRAFTING_COMPONENT_ITEMS, ALCOHOL_ITEMS, MOVEMENT_GEAR_ITEMS, MINOR_ARTIFACT_ITEMS, POTION_ITEMS, MAGIC_ADORNMENT_ITEMS, BLACK_MARKET_ITEMS, POISON_ITEMS, LORE_GOODS_ITEMS, NECROMANCY_ITEMS)); },
    definitionToInventorySnapshot:definitionToInventorySnapshot
  };
});
