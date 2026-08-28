(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaSpellAutomation = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  function clone(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = clone(value[key]); });
    return copy;
  }

  function normalizeName(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .toLocaleLowerCase('ru-RU');
  }

  var profiles = [{
    automationKey: 'finger-heat-v1',
    catalogId: '1773673009471',
    name: 'Жар Пальцев',
    nameUk: 'Жар Пальців',
    aliases: ['жар пальцев', 'жар пальців'],
    uiIcon: '🔥',
    uiTone: 'fire',
    playbackSummary: 'Ближняя магическая атака: INT против КД, затем 1d6 огнём.',
    playbackSummaryUk: 'Ближня магічна атака: INT проти КЗ, потім 1d6 вогнем.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'attack',
    usesAttackRoll: true,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'target',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '1d6',
    damageType: 'fire',
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'once_per_battle', rounds: 0, label: '1 раз за бой' },
    maxUses: 1,
    resourceScopeKind: 'battle',
    animationKey: 'finger-heat-v1',
    soundProfile: 'magic-fire',
    iconAsset: 'images/ui/combat-generated/spell-finger-heat.png',
    resolutionPlan: {
      version: 1,
      staged: true,
      steps: [
        { key:'attack', kind:'attack', formula:'1d20', actor:'player', compare:'target-ac' },
        { key:'damage', kind:'damage', formula:'1d6', actor:'player', when:'attack-hit' }
      ]
    },
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'fire-damage', kind:'damage', icon:'🔥', label:'Огненный урон', labelUk:'Вогняна шкода', summary:'1d6 урона огнём при попадании', summaryUk:'1d6 шкоди вогнем у разі влучання', trigger:'attack-hit', required:true },
        { key:'ignite-flammable', kind:'scene', icon:'🕯', label:'Зажечь горючий объект', labelUk:'Підпалити займистий об’єкт', summary:'Факел, масло, свеча или костёр в пределах 1 клетки', summaryUk:'Смолоскип, олія, свічка або багаття в межах 1 клітини', trigger:'manual', required:false }
      ],
      gmAdditions: { kinds:['status'], max:6 }
    },
    nonCombat: {
      kind: 'ignite',
      rangeCells: 1,
      manual: true,
      targets: ['torch', 'oil', 'candle', 'campfire']
    }
  }, {
    automationKey: 'salvation-touch-v1',
    catalogId: '1774556074255',
    name: 'Касание Спасения',
    nameUk: 'Дотик Спасіння',
    aliases: ['касание спасения', 'дотик спасіння'],
    uiIcon: '✚',
    uiTone: 'life',
    playbackSummary: 'Касание союзника: восстанавливает 2d4 HP без броска атаки.',
    playbackSummaryUk: 'Дотик до союзника: відновлює 2d4 HP без кидка атаки.',
    kind: 'spell',
    effectKind: 'heal',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'ally',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'holy',
    healFormula: '2d4',
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'short_rest', rounds: 0, label: '1 раз за короткий отдых' },
    maxUses: 1,
    resourceScopeKind: 'short-rest',
    animationKey: 'salvation-touch-v1',
    soundProfile: 'magic-holy',
    iconAsset: 'images/ui/catalog/categories/heal.png',
    restrictions: { rejectUndead:true, rejectDead:true },
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'healing', kind:'heal', icon:'✚', label:'Исцеление', labelUk:'Зцілення', summary:'2d4 HP живому союзнику в соседней клетке', summaryUk:'2d4 HP живому союзнику в сусідній клітині', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:3 }
    }
  }, {
    automationKey: 'fire-projectile-v1',
    catalogId: '1773704473098',
    name: 'Огненный снаряд',
    nameUk: 'Вогняний снаряд',
    aliases: ['огненный снаряд', 'вогняний снаряд'],
    uiIcon: '☄',
    uiTone: 'fire',
    playbackSummary: 'Точка до 10 клеток, радиус 2: DEX DC 13, 3d6 огнём или половина.',
    playbackSummaryUk: 'Точка до 10 клітин, радіус 2: DEX СК 13, 3d6 вогнем або половина.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'dex',
    saveDC: 13,
    rangeCells: 10,
    aoeRadius: 2,
    areaWidth: 1,
    targetMode: 'area',
    targetCount: 30,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '3d6',
    damageType: 'fire',
    healFormula: '',
    halfOnSave: true,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'long_rest', rounds: 0, label: '2 раза до долгого отдыха' },
    maxUses: 2,
    resourceScopeKind: 'long-rest',
    animationKey: 'fire-projectile-v1',
    soundProfile: 'magic-fire',
    iconAsset: 'images/ui/combat-generated/spell-finger-heat.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'fire-area', kind:'damage', icon:'☄', label:'Огненный взрыв', labelUk:'Вогняний вибух', summary:'3d6 огнём в радиусе 2 клеток; половина при успешном спасброске', summaryUk:'3d6 вогнем у радіусі 2 клітин; половина за успішного ряткидка', trigger:'save', required:true },
        { key:'ignite-flammable', kind:'scene', icon:'🕯', label:'Воспламенить окружение', labelUk:'Підпалити оточення', summary:'Сухие, деревянные, бумажные и масляные объекты в области', summaryUk:'Сухі, дерев’яні, паперові та масляні об’єкти в області', trigger:'manual', required:false }
      ],
      gmAdditions: { kinds:['status'], max:4 }
    }
  }, {
    automationKey: 'lightning-lasso-v1',
    catalogId: '1774549339231',
    name: 'Лассо Молнии',
    nameUk: 'Ласо Блискавки',
    aliases: ['лассо молнии', 'ласо блискавки'],
    uiIcon: 'ϟ',
    uiTone: 'storm',
    playbackSummary: 'STR DC 13: средняя цель обездвижена на раунд; малую можно подтянуть.',
    playbackSummaryUk: 'STR СК 13: середня ціль знерухомлена на раунд; малу можна підтягнути.',
    kind: 'spell',
    effectKind: 'control',
    actionCost: 'long',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'str',
    saveDC: 13,
    rangeCells: 6,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'target',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'elec',
    healFormula: '',
    halfOnSave: false,
    statuses: ['restrain'],
    statusPolicy: { mode:'canonical', keys:['restrain'] },
    durationRounds: 1,
    concentration: false,
    cooldown: { kind: 'once_per_battle', rounds: 0, label: '1 раз за бой' },
    maxUses: 1,
    resourceScopeKind: 'battle',
    animationKey: 'lightning-lasso-v1',
    soundProfile: 'magic-lightning',
    iconAsset: 'images/ui/catalog/damage/elec.png',
    playbackVariants: [
      { key:'restrain', label:'Средняя · обездвижить', labelUk:'Середня · знерухомити', statuses:['restrain'], pullCells:0 },
      { key:'pull', label:'Малая · подтянуть на 2 клетки', labelUk:'Мала · підтягнути на 2 клітини', statuses:[], pullCells:2 }
    ],
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'restrain', kind:'status', icon:'ϟ', label:'Лассо молнии', labelUk:'Ласо блискавки', summary:'Провал STR DC 13: обездвижить на 1 раунд либо подтянуть малую цель на 2 клетки', summaryUk:'Провал STR СК 13: знерухомити на 1 раунд або підтягнути малу ціль на 2 клітини', trigger:'save-fail', required:true }
      ],
      gmAdditions: { kinds:['status'], max:3 }
    }
  }, {
    automationKey: 'raise-undead-v1',
    catalogId: '1775568519798',
    name: 'Призыв Нежити',
    nameUk: 'Заклик Нежиті',
    aliases: ['призыв нежити', 'заклик нежиті'],
    uiIcon: '☠',
    uiTone: 'necro',
    playbackSummary: 'Точка рядом с заклинателем: 1–3 скелета либо одна свежая нежить.',
    playbackSummaryUk: 'Точка поряд із заклиначем: 1–3 скелети або одна свіжа нежить.',
    kind: 'spell',
    effectKind: 'summon',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 3,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'point',
    targetCount: 1,
    targetRequired: false,
    selfOnly: false,
    damageFormula: '',
    damageType: 'necro',
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    durationRounds: 10,
    concentration: false,
    cooldown: { kind: 'long_rest_charge', rounds: 0, label: '1 заряд после долгого отдыха' },
    maxUses: 3,
    resourceScopeKind: 'long-rest',
    animationKey: 'raise-undead-v1',
    soundProfile: 'magic-necro',
    iconAsset: 'images/ui/bestiary/types/large/undead.png',
    summonVariants: [
      { key:'skeleton', label:'Скелет', labelUk:'Скелет', maxCount:3, chargeCost:1, hpFormula:'2d8', averageHp:10, ac:11, speed:6, initiative:0 },
      { key:'fresh-undead', label:'Свежая нежить', labelUk:'Свіжа нежить', maxCount:1, chargeCost:3, hpFormula:'4d8', averageHp:18, ac:10, speed:4, initiative:-1 }
    ],
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'summon-undead', kind:'summon', icon:'☠', label:'Поднять слуг', labelUk:'Підняти слуг', summary:'До 3 скелетов либо 1 свежая нежить; жетоны добавляются в конец очереди', summaryUk:'До 3 скелетів або 1 свіжа нежить; жетони додаються наприкінці черги', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'pseudo-life-v1',
    catalogId: '1774552085257',
    name: 'Псевдожизнь',
    nameUk: 'Псевдожиття',
    aliases: ['псевдожизнь', 'псевдожиття'],
    uiIcon: '🩸',
    uiTone: 'necro',
    playbackSummary: 'Касание себя или союзника: 4 либо 2d4 временных HP без складывания.',
    playbackSummaryUk: 'Дотик до себе або союзника: 4 чи 2d4 тимчасових HP без складання.',
    kind: 'spell',
    effectKind: 'temp_hp',
    actionCost: 'short',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'ally',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'necro',
    healFormula: '',
    tempHpFormula: '2d4',
    tempHpFixed: 0,
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind:'long_rest_charge', rounds:0, label:'2 применения до долгого отдыха' },
    maxUses: 2,
    resourceScopeKind: 'long-rest',
    animationKey: 'pseudo-life-v1',
    soundProfile: 'magic-necro',
    iconAsset: 'images/ui/catalog/categories/defense.png',
    playbackVariants: [
      { key:'roll', label:'Риск · бросить 2d4', labelUk:'Ризик · кинути 2d4', tempHpFormula:'2d4', tempHpFixed:0 },
      { key:'stable', label:'Стабильно · получить 4', labelUk:'Стабільно · отримати 4', tempHpFormula:'', tempHpFixed:4 }
    ],
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'pseudo-life', kind:'temp_hp', icon:'🩸', label:'Оболочка псевдожизни', labelUk:'Оболонка псевдожиття', summary:'4 либо 2d4 временных HP; сохраняется большее значение и не лечится', summaryUk:'4 чи 2d4 тимчасових HP; зберігається більше значення й не лікується', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'energy-protection-v1',
    catalogId: '1774554691599',
    name: 'Защита от Энергии',
    nameUk: 'Захист від Енергії',
    aliases: ['защита от энергии', 'захист від енергії'],
    uiIcon: '✴',
    uiTone: 'ward',
    playbackSummary: 'Касание: сопротивление выбранной стихии на 5 раундов с концентрацией.',
    playbackSummaryUk: 'Дотик: опір обраній стихії на 5 раундів із зосередженням.',
    kind: 'spell',
    effectKind: 'buff',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'ally',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: '',
    healFormula: '',
    halfOnSave: false,
    statuses: ['energy-ward'],
    statusPolicy: { mode:'custom', keys:['energy-ward'], closestCanonical:'shield', reason:'elemental-resistance-not-ac' },
    durationRounds: 5,
    concentration: true,
    cooldown: { kind:'long_rest_charge', rounds:0, label:'2 применения до долгого отдыха' },
    maxUses: 2,
    resourceScopeKind: 'long-rest',
    animationKey: 'energy-protection-v1',
    soundProfile: 'magic-ward',
    iconAsset: 'images/ui/catalog/categories/defense.png',
    energyOptions: [
      { key:'fire', label:'🔥 Огонь', labelUk:'🔥 Вогонь' },
      { key:'cold', label:'❄ Холод', labelUk:'❄ Холод' },
      { key:'elec', label:'⚡ Молния', labelUk:'⚡ Блискавка' },
      { key:'acid', label:'🧪 Кислота', labelUk:'🧪 Кислота' },
      { key:'poison', label:'🌫 Яд', labelUk:'🌫 Отрута' },
      { key:'sound', label:'🔊 Звук', labelUk:'🔊 Звук' }
    ],
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'energy-ward', kind:'status', icon:'✴', label:'Энергетическая защита', labelUk:'Енергетичний захист', summary:'Половина урона выбранного типа в течение 5 раундов; одна стихия на цель', summaryUk:'Половина шкоди обраного типу протягом 5 раундів; одна стихія на ціль', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'silence-seal-v1',
    catalogId: '1774549676464',
    name: 'Печать Молчания',
    nameUk: 'Печатка Мовчання',
    aliases: ['печать молчания', 'печатка мовчання'],
    uiIcon: '🔇',
    uiTone: 'silence',
    playbackSummary: 'Точка до 12 клеток, радиус 5: магическая немота на 10 раундов.',
    playbackSummaryUk: 'Точка до 12 клітин, радіус 5: магічна німота на 10 раундів.',
    kind: 'spell',
    effectKind: 'control',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 12,
    aoeRadius: 5,
    areaWidth: 1,
    targetMode: 'area',
    targetCount: 30,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: '',
    healFormula: '',
    halfOnSave: false,
    statuses: ['silence'],
    statusPolicy: { mode:'canonical', keys:['silence'] },
    durationRounds: 10,
    concentration: false,
    zoneKind: 'silence',
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз за долгий отдых' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'silence-seal-v1',
    soundProfile: 'magic-silence',
    iconAsset: 'images/ui/catalog/categories/control.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'silence', kind:'status', icon:'🔇', label:'Магическая немота', labelUk:'Магічна німота', summary:'Все участники в круге теряют голос; зона продолжает блокировать заклинания со словами', summaryUk:'Усі учасники в колі втрачають голос; зона й далі блокує закляття зі словами', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'misty-transition-v1',
    catalogId: '1774563873341',
    name: 'Туманный Переход',
    nameUk: 'Туманний Перехід',
    aliases: ['туманный переход', 'туманний перехід'],
    uiIcon: '☁',
    uiTone: 'mist',
    playbackSummary: 'Телепорт на видимую точку до 10 клеток; у старой позиции остаётся дым.',
    playbackSummaryUk: 'Телепорт у видиму точку до 10 клітин; на старій позиції лишається дим.',
    kind: 'spell',
    effectKind: 'movement',
    movementKind: 'magical',
    actionCost: 'short',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 10,
    teleportCells: 10,
    smokeRadius: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'point',
    targetCount: 1,
    targetRequired: false,
    selfOnly: true,
    damageFormula: '',
    damageType: 'chaos',
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    statusPolicy: { mode:'custom', keys:['smoke-disadvantage'], closestCanonical:'blind', reason:'attack-disadvantage-only' },
    durationRounds: 1,
    concentration: false,
    cooldown: { kind:'long_rest_charge', rounds:0, label:'2 применения до долгого отдыха' },
    maxUses: 2,
    resourceScopeKind: 'long-rest',
    animationKey: 'misty-transition-v1',
    soundProfile: 'magic-mist',
    iconAsset: 'images/ui/catalog/categories/move.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'teleport', kind:'movement', icon:'☁', label:'Переход сквозь дым', labelUk:'Перехід крізь дим', summary:'Переместить жетон без провокации атак на видимую точку до 10 клеток', summaryUk:'Перемістити жетон без провокації атак у видиму точку до 10 клітин', trigger:'automatic', required:true },
        { key:'smoke-disadvantage', kind:'status', icon:'◌', label:'Дымный след', labelUk:'Димний слід', summary:'Враги в 1 клетке от исходной позиции получают помеху на атаки на 1 раунд', summaryUk:'Вороги в 1 клітині від початкової позиції отримують перешкоду на атаки на 1 раунд', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'gravity-center-v1',
    catalogId: '1774551284983',
    name: 'Центр Притяжения',
    nameUk: 'Центр Тяжіння',
    aliases: ['центр притяжения', 'центр тяжіння'],
    uiIcon: '🌀',
    uiTone: 'gravity',
    playbackSummary: 'Точка до 10 клеток, радиус 5: STR DC 14 или притяжение к центру.',
    playbackSummaryUk: 'Точка до 10 клітин, радіус 5: STR СК 14 або притягання до центру.',
    kind: 'spell',
    effectKind: 'control',
    actionCost: 'long',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'str',
    saveDC: 14,
    rangeCells: 10,
    aoeRadius: 5,
    areaWidth: 1,
    targetMode: 'area',
    targetCount: 30,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'blunt',
    collisionDamageFormula: '1d6',
    pullCells: 5,
    pullTowardPoint: true,
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз за долгий отдых' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'gravity-center-v1',
    soundProfile: 'magic-gravity',
    iconAsset: 'images/ui/catalog/categories/aoe.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'gravity-pull', kind:'movement', icon:'🌀', label:'Стянуть к центру', labelUk:'Стягнути до центру', summary:'Провал STR DC 14: притянуть на расстояние до 5 клеток; успешный спасбросок удерживает позицию', summaryUk:'Провал STR СК 14: притягнути на відстань до 5 клітин; успішний ряткидок утримує позицію', trigger:'save-fail', required:true },
        { key:'gravity-collision', kind:'damage', icon:'✷', label:'Столкновение', labelUk:'Зіткнення', summary:'Если две цели сходятся в одной клетке, каждая получает 1d6 дробящего урона', summaryUk:'Якщо дві цілі сходяться в одній клітині, кожна зазнає 1d6 дробильної шкоди', trigger:'collision', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'psychic-screech-v1',
    catalogId: '1773834544336',
    name: 'Психический Визг',
    nameUk: 'Психічний Вереск',
    aliases: ['психический визг', 'психічний вереск'],
    uiIcon: '🧠',
    uiTone: 'mind',
    playbackSummary: 'Разумная видимая цель: INT DC 13 или −1d6 к следующей атаке.',
    playbackSummaryUk: 'Розумна видима ціль: INT СК 13 або −1d6 до наступної атаки.',
    kind: 'spell',
    effectKind: 'control',
    actionCost: 'short',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'int',
    saveDC: 13,
    rangeCells: 0,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'target',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'psych',
    healFormula: '',
    penaltyFormula: '1d6',
    statuses: ['psychic-screech'],
    statusPolicy: { mode:'custom', keys:['psychic-screech'], closestCanonical:'curse', reason:'single-rolled-attack-penalty' },
    durationRounds: 99,
    concentration: false,
    requiresMind: true,
    cooldown: { kind:'long_rest_charge', rounds:0, label:'3 раза за день' },
    maxUses: 3,
    resourceScopeKind: 'long-rest',
    animationKey: 'psychic-screech-v1',
    soundProfile: 'magic-psychic',
    iconAsset: 'images/ui/catalog/categories/debuff.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'psychic-screech', kind:'status', icon:'🧠', label:'Сбитая мысль', labelUk:'Збита думка', summary:'Провал INT DC 13: вычесть 1d6 из следующего броска атаки цели', summaryUk:'Провал INT СК 13: відняти 1d6 від наступного кидка атаки цілі', trigger:'save-fail', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'hypnotic-pattern-v1',
    catalogId: '1774549971372',
    name: 'Гипнотический Узор',
    nameUk: 'Гіпнотичний Візерунок',
    aliases: ['гипнотический узор', 'гіпнотичний візерунок'],
    uiIcon: '🌀',
    uiTone: 'illusion',
    playbackSummary: 'Квадрат 4×4 до 6 клеток: лучший INT/CHA DC 13 или транс до урона.',
    playbackSummaryUk: 'Квадрат 4×4 до 6 клітин: кращий INT/CHA СК 13 або транс до шкоди.',
    kind: 'spell',
    effectKind: 'control',
    actionCost: 'long',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'int',
    saveStatOptions: ['int','cha'],
    saveStatMode: 'best',
    saveDC: 13,
    rangeCells: 6,
    aoeRadius: 2,
    areaMode: 'square',
    areaSize: 4,
    areaWidth: 4,
    targetMode: 'area',
    targetCount: 30,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'psych',
    healFormula: '',
    halfOnSave: false,
    statuses: ['hypnotic-trance'],
    statusPolicy: { mode:'custom', keys:['hypnotic-trance'], closestCanonical:'stun', reason:'breaks-on-damage-and-melee-only-advantage' },
    durationRounds: 99,
    concentration: false,
    requiresSight: true,
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз за долгий отдых' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'hypnotic-pattern-v1',
    soundProfile: 'magic-illusion',
    iconAsset: 'images/ui/catalog/categories/control.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'hypnotic-trance', kind:'status', icon:'🌀', label:'Гипнотический транс', labelUk:'Гіпнотичний транс', summary:'Провал лучшего INT/CHA DC 13: без действий, движения и реакций; ближние атаки получают преимущество', summaryUk:'Провал кращого INT/CHA СК 13: без дій, руху й реакцій; ближні атаки отримують перевагу', trigger:'save-fail', required:true },
        { key:'break-trance', kind:'rule', icon:'✦', label:'Хрупкий эффект', labelUk:'Крихкий ефект', summary:'Любой урон или встряска сразу снимает транс', summaryUk:'Будь-яка шкода або струс негайно знімає транс', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    },
    nonCombat: { kind:'hypnotic-projection', durationMinutes:5, concentration:true, manual:true }
  }, {
    automationKey: 'remove-curse-v1',
    catalogId: '1774558153786',
    name: 'Снятие Проклятья',
    nameUk: 'Зняття Прокляття',
    aliases: ['снятие проклятья', 'снятие проклятия', 'зняття прокляття'],
    uiIcon: '⛓',
    uiTone: 'cleanse',
    playbackSummary: 'Касание: снимает одно малое или среднее проклятие с существа.',
    playbackSummaryUk: 'Дотик: знімає одне мале або середнє прокляття з істоти.',
    kind: 'spell',
    effectKind: 'cleanse',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'target',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'holy',
    healFormula: '',
    removeStatus: 'curse',
    statusPolicy: { mode:'canonical', removes:['curse'] },
    durationRounds: 0,
    concentration: false,
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз в два дня' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'remove-curse-v1',
    soundProfile: 'magic-cleanse',
    iconAsset: 'images/ui/catalog/categories/heal.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'remove-curse', kind:'cleanse', icon:'⛓', label:'Разорвать проклятие', labelUk:'Розірвати прокляття', summary:'Снять один статус «Проклят»; древние, сложные и уникальные проклятия остаются ручным решением мастера', summaryUk:'Зняти один стан «Проклятий»; давні, складні й унікальні прокляття лишаються ручним рішенням Майстра', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    },
    nonCombat: { kind:'cleanse-cursed-object', durationMinutes:30, manual:true }
  }, {
    automationKey: 'life-transfer-v1',
    catalogId: '1774559007781',
    name: 'Передача Жизни',
    nameUk: 'Передавання Життя',
    aliases: ['передача жизни', 'передавання життя'],
    uiIcon: '❤️',
    uiTone: 'blood',
    playbackSummary: 'До 6 клеток: потерять 2d8+INT HP без сопротивления, союзник лечится вдвое.',
    playbackSummaryUk: 'До 6 клітин: втратити 2d8+INT HP без опору, союзник лікується вдвічі.',
    kind: 'spell',
    effectKind: 'heal',
    actionCost: 'long',
    resolutionMode: 'utility',
    usesAttackRoll: false,
    usesSave: false,
    attackStat: 'int',
    saveStat: '',
    rangeCells: 6,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'ally',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'necro',
    healFormula: '',
    sourceDamageFormula: '2d8',
    sourceDamageStat: 'int',
    sourceDamageUnresistable: true,
    healMultiplier: 2,
    selfHealMultiplier: 1,
    martyrHpThreshold: 1,
    martyrHealMultiplier: 3,
    durationRounds: 0,
    concentration: false,
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз за долгий отдых' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'life-transfer-v1',
    soundProfile: 'magic-blood',
    iconAsset: 'images/ui/catalog/categories/heal.png',
    restrictions: { rejectUndead:true, rejectElemental:true, rejectConstruct:true, rejectDead:true },
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'blood-price', kind:'damage', icon:'🩸', label:'Цена крови', labelUk:'Ціна крові', summary:'Заклинатель теряет 2d8+INT HP; сопротивления и временные HP не уменьшают эту цену', summaryUk:'Заклинач втрачає 2d8+INT HP; опір і тимчасові HP не зменшують цю ціну', trigger:'automatic', required:true },
        { key:'life-gift', kind:'heal', icon:'❤️', label:'Передать жизнь', labelUk:'Передати життя', summary:'Союзник восстанавливает вдвое больше фактически потерянных HP; при 1 HP — втрое, но заклинатель погибает', summaryUk:'Союзник відновлює вдвічі більше фактично втрачених HP; за 1 HP — утричі, але заклинач гине', trigger:'automatic', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }, {
    automationKey: 'heaven-piercing-spear-v1',
    catalogId: '1780007598402',
    name: 'Копьё Небесного Прорыва',
    nameUk: 'Спис Небесного Прориву',
    aliases: ['копьё небесного прорыва', 'копье небесного прорыва', 'спис небесного прориву'],
    uiIcon: '⚡',
    uiTone: 'storm',
    playbackSummary: 'Линия 18×0,5: DEX DC 17, 4d8 при успехе или 7d8 и без реакций при провале.',
    playbackSummaryUk: 'Лінія 18×0,5: DEX СК 17, 4d8 за успіху або 7d8 і без реакцій за провалу.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'save',
    usesAttackRoll: false,
    usesSave: true,
    attackStat: 'int',
    saveStat: 'dex',
    saveDC: 17,
    rangeCells: 18,
    aoeRadius: 0,
    areaMode: 'line',
    areaLength: 18,
    areaWidth: 0.5,
    targetMode: 'point',
    targetCount: 30,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '7d8',
    successDamageFormula: '4d8',
    failDamageFormula: '7d8',
    damageType: 'elec',
    healFormula: '',
    halfOnSave: false,
    statuses: ['reaction-lock'],
    statusPolicy: { mode:'custom', keys:['reaction-lock'], closestCanonical:'stun', reason:'reaction-only-lock' },
    durationRounds: 1,
    concentration: false,
    metalArmorDisadvantage: true,
    severeFailureMargin: 5,
    secondarySaveStat: 'con',
    secondarySaveDC: 15,
    cooldown: { kind:'long_rest', rounds:0, label:'1 раз за долгий отдых' },
    maxUses: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'heaven-piercing-spear-v1',
    soundProfile: 'magic-lightning-heavy',
    iconAsset: 'images/ui/catalog/damage/elec.png',
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'lightning-line', kind:'damage', icon:'⚡', label:'Пробивающая молния', labelUk:'Пробивна блискавка', summary:'Все существа на линии: 4d8 электро при успехе DEX DC 17 или 7d8 при провале', summaryUk:'Усі істоти на лінії: 4d8 електро за успіху DEX СК 17 або 7d8 за провалу', trigger:'save', required:true },
        { key:'reaction-lock', kind:'status', icon:'ϟ', label:'Электрический шок', labelUk:'Електричний шок', summary:'Провал: цель не использует реакции до конца следующего хода', summaryUk:'Провал: ціль не використовує реакції до кінця наступного ходу', trigger:'save-fail', required:true },
        { key:'severe-shock', kind:'rule', icon:'⚠', label:'Тяжёлый пробой', labelUk:'Тяжкий пробій', summary:'Провал на 5+: CON DC 15; при провале роняет предмет или теряет концентрацию', summaryUk:'Провал на 5+: CON СК 15; у разі провалу впускає предмет або втрачає зосередження', trigger:'secondary-save', required:true }
      ],
      gmAdditions: { kinds:['status'], max:0 }
    }
  }];

  function matches(profile, spell) {
    if (spell && spell.automationKey && String(spell.automationKey) === String(profile.automationKey)) return true;
    var normalized = normalizeName(spell && (spell.name || spell.title));
    if (!normalized) return false;
    return profile.aliases.some(function (alias) { return normalizeName(alias) === normalized; });
  }

  function resolve(spell) {
    var profile = profiles.find(function (candidate) { return matches(candidate, spell); });
    return profile ? clone(profile) : null;
  }

  function mergeMeta(spell, inferred) {
    var profile = resolve(spell);
    var result = clone(inferred || {});
    if (!profile) return result;
    Object.keys(profile).forEach(function (key) {
      if (key !== 'aliases') result[key] = clone(profile[key]);
    });
    result._source = 'automation:' + profile.automationKey;
    return result;
  }

  function catalog() {
    return profiles.map(clone);
  }

  function effectPlan(spell) {
    var profile = spell && spell.effectPlan ? spell : resolve(spell);
    var plan = profile && profile.effectPlan;
    return plan ? clone(plan) : { version:1, prescribed:[], gmAdditions:{ kinds:['status'], max:6 } };
  }

  function prescribedStatusKeys(spell) {
    return effectPlan(spell).prescribed.filter(function (effect) {
      return effect && effect.kind === 'status' && effect.required !== false && effect.key;
    }).map(function (effect) { return String(effect.key); });
  }

  var CANONICAL_STATUS_KEYS = ['stun','burn','poison','freeze','fear','blind','prone','bleed','silence','anchor','charm','dominate','paralyze','restrain','slow','curse','exhausted','invisible','regen','shield','rage','fly','confusion','dead'];
  function statusPolicy(spell) {
    var profile = spell && spell.automationKey ? spell : resolve(spell);
    if (!profile) return { mode:'none', keys:[], removes:[] };
    var explicit = profile.statusPolicy && typeof profile.statusPolicy === 'object' ? clone(profile.statusPolicy) : null;
    var keys = [].concat(explicit && explicit.keys || [], profile.statuses || [], prescribedStatusKeys(profile)).map(String).filter(function (key, index, list) { return key && list.indexOf(key) === index; });
    var removes = [].concat(explicit && explicit.removes || [], profile.removeStatus || []).map(String).filter(function (key, index, list) { return key && list.indexOf(key) === index; });
    if (explicit) { explicit.keys = keys;explicit.removes = removes;return explicit; }
    if (!keys.length && !removes.length) return { mode:'none', keys:[], removes:[] };
    return { mode:keys.concat(removes).every(function (key) { return CANONICAL_STATUS_KEYS.indexOf(key) >= 0; }) ? 'canonical' : 'custom', keys:keys, removes:removes };
  }

  function number(value, fallback) {
    value = Number(value);
    return isFinite(value) ? value : (fallback == null ? 0 : fallback);
  }

  function stat(entry, key) {
    var value = entry && entry.stats && entry.stats[key];
    if (typeof value === 'number') return number(value, 0);
    return number(value && (value.cur != null && value.cur !== 0 ? value.cur : value.base), 0);
  }

  function die(sides, random) {
    return 1 + Math.floor(Math.max(0, Math.min(.999999, number(random(), 0))) * sides);
  }

  function formulaRoll(formula, critical, random) {
    var match = String(formula || '').replace(/\s+/g, '').match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i);
    if (!match) return { formula:'', rolls:[], modifier:0, total:0 };
    var count = Math.max(1, Number(match[1])) * (critical ? 2 : 1), sides = Number(match[2]), modifier = Number(match[3] || 0), rolls = [];
    for (var index = 0; index < count; index++) rolls.push(die(sides, random));
    return { formula:String(formula), rolls:rolls, modifier:modifier, total:Math.max(0, rolls.reduce(function (sum, value) { return sum + value; }, 0) + modifier) };
  }

  function hasTrait(values, damageType) {
    var needle = normalizeName(damageType);
    return [].concat(values || []).some(function (value) {
      var raw = value && typeof value === 'object' ? (value.key || value.type || value.name || value.label) : value;
      raw = normalizeName(raw);
      return !!needle && (raw === needle || raw.indexOf(needle) >= 0 || needle.indexOf(raw) >= 0);
    });
  }

  function projectVitals(target, damage) {
    var hp = Math.max(0, number(target && (target.hp == null ? target.hpMax : target.hp), 0));
    var tempHp = Math.max(0, number(target && target.tempHp, 0));
    var absorbed = Math.min(tempHp, damage);
    return { beforeHp:hp, beforeTempHp:tempHp, absorbed:absorbed, hp:Math.max(0, hp - Math.max(0, damage - absorbed)), tempHp:Math.max(0, tempHp - absorbed) };
  }

  function projectHealing(target, healing) {
    var hpMax = Math.max(0, number(target && target.hpMax, 0));
    var hp = Math.max(0, number(target && (target.hp == null ? hpMax : target.hp), 0));
    var requested = Math.max(0, number(healing, 0));
    var applied = Math.min(requested, Math.max(0, hpMax - hp));
    return { beforeHp:hp, hpMax:hpMax, requested:requested, applied:applied, hp:Math.min(hpMax, hp + applied), tempHp:Math.max(0, number(target && target.tempHp, 0)) };
  }

  function hasMetalArmor(target) {
    var text = [target && target.armorMaterial, target && target.armorType, target && target.equipmentText]
      .concat(target && target.armor || [], target && target.equipment || [])
      .map(function (value) { return value && typeof value === 'object' ? (value.material || value.type || value.name || value.label) : value; })
      .join(' ').toLowerCase();
    return !!(target && target.heavyArmor) || /metal|steel|iron|plate|chain|металл|сталь|желез|лат|кольч|метал|заліз|панцир/.test(text);
  }

  function statusKeys(target) {
    return [].concat(target && target.statuses || [], target && target.statusEffects || []).map(function (value) {
      return String(typeof value === 'string' ? value : value && (value.statusKey || value.key || value.id) || '').toLowerCase();
    }).filter(Boolean);
  }

  function buildPreview(profile, context, random) {
    profile = clone(profile || {});
    context = context || {};
    random = typeof random === 'function' ? random : Math.random;
    var actor = context.actor || {}, targets = Array.isArray(context.targets) ? context.targets : [], attackModifier = stat(actor, profile.attackStat || 'int') + number(context.attackModifier, 0);
    // An area spell is one effect: roll its damage once, then resolve every
    // target's save and damage traits against that shared result.
    var sharedAreaDamage = profile.targetMode === 'area' && profile.damageFormula
      ? formulaRoll(profile.damageFormula, false, random)
      : null;
    var sharedSuccessDamage = profile.successDamageFormula ? formulaRoll(profile.successDamageFormula, false, random) : null;
    var sharedFailDamage = profile.failDamageFormula ? formulaRoll(profile.failDamageFormula, false, random) : null;
    var sourceDamageRoll = profile.sourceDamageFormula ? formulaRoll(profile.sourceDamageFormula, false, random) : null;
    var sourceBeforeHp = Math.max(0, number(actor.hp == null ? actor.hpMax : actor.hp, 0));
    var sourceRawDamage = sourceDamageRoll ? Math.max(0, sourceDamageRoll.total + stat(actor, profile.sourceDamageStat || 'int')) : 0;
    var sourceDamage = sourceDamageRoll ? Math.min(sourceBeforeHp, sourceRawDamage) : 0;
    var martyr = !!(sourceDamageRoll && sourceBeforeHp <= Math.max(0, number(profile.martyrHpThreshold, 0)));
    var sourceAfterHp = sourceDamageRoll ? Math.max(0, sourceBeforeHp - sourceDamage) : sourceBeforeHp;
    return {
      version:1,
      automationKey:String(profile.automationKey || ''),
      abilityName:String(profile.name || ''),
      actorKey:String(actor.key || ''),
      actorName:String(actor.name || ''),
      damageFormula:String(profile.damageFormula || ''),
      damageType:String(profile.damageType || ''),
      sourceDamage:sourceDamage,
      sourceRawDamage:sourceRawDamage,
      sourceDamageRolls:sourceDamageRoll ? sourceDamageRoll.rolls : [],
      sourceBeforeHp:sourceBeforeHp,
      sourceAfterHp:sourceAfterHp,
      martyr:martyr,
      results:targets.map(function (target) {
        var mode = String(profile.resolutionMode || 'utility'), rollMode = ['advantage','disadvantage'].indexOf(target && target.rollMode) >= 0 ? target.rollMode : 'normal', first = null, second = null, rolls = [], natural = null, dc = null, modifier = 0, total = null, success = true;
        if (mode === 'attack' || mode === 'save') {
          if (mode === 'save' && profile.metalArmorDisadvantage && hasMetalArmor(target)) rollMode = 'disadvantage';
          first = die(20, random);second = rollMode === 'normal' ? null : die(20, random);rolls = second == null ? [first] : [first, second];
          natural = second == null ? first : (rollMode === 'advantage' ? Math.max(first, second) : Math.min(first, second));
          if (mode === 'attack') { modifier = attackModifier;dc = Math.max(0, number(target && target.ac, 10) + number(target && target.acModifier, 0)); }
          else {
            var saveStats = profile.saveStatMode === 'best' && Array.isArray(profile.saveStatOptions) && profile.saveStatOptions.length ? profile.saveStatOptions : [profile.saveStat || 'con'];
            var saveStat = saveStats.reduce(function (best, key) { return stat(target, key) > stat(target, best) ? key : best; }, saveStats[0]);
            modifier = stat(target, saveStat) + number(target && target.saveModifier, 0);dc = Math.max(1, number(context.saveDC == null ? profile.saveDC : context.saveDC, 10));
            target._previewSaveStat = saveStat;
          }
          total = natural + modifier;success = natural === 20 || (natural !== 1 && total >= dc);
        }
        var damageRoll = mode === 'save' && success && sharedSuccessDamage ? sharedSuccessDamage : mode === 'save' && !success && sharedFailDamage ? sharedFailDamage : sharedAreaDamage
          ? { formula:sharedAreaDamage.formula, rolls:sharedAreaDamage.rolls.slice(), modifier:sharedAreaDamage.modifier, total:sharedAreaDamage.total }
          : formulaRoll(profile.damageFormula, natural === 20 && mode === 'attack', random), healRoll = formulaRoll(profile.healFormula, false, random), tempHpRoll = formulaRoll(profile.tempHpFormula, false, random);
        if (mode === 'save' && success && sharedSuccessDamage) damageRoll = { formula:sharedSuccessDamage.formula, rolls:sharedSuccessDamage.rolls.slice(), modifier:sharedSuccessDamage.modifier, total:sharedSuccessDamage.total };
        if (mode === 'save' && !success && sharedFailDamage) damageRoll = { formula:sharedFailDamage.formula, rolls:sharedFailDamage.rolls.slice(), modifier:sharedFailDamage.modifier, total:sharedFailDamage.total };
        var rolledDamage = Math.max(0, damageRoll.total + number(context.damageModifier, 0)), rawDamage = mode === 'attack' && !success ? 0 : (mode === 'save' && success ? (profile.halfOnSave ? Math.floor(rolledDamage / 2) : 0) : rolledDamage);
        if (mode === 'save' && (sharedSuccessDamage || sharedFailDamage)) rawDamage = rolledDamage;
        var immune = hasTrait(target && target.immunities, profile.damageType), resisted = hasTrait(target && target.resistances, profile.damageType), vulnerable = hasTrait(target && target.vulnerabilities, profile.damageType), damage = rawDamage, potentialDamage = rolledDamage;
        if (immune) damage = 0;
        else if (resisted && !vulnerable) damage = Math.floor(damage / 2);
        else if (vulnerable && !resisted) damage *= 2;
        if (immune) potentialDamage = 0;
        else if (resisted && !vulnerable) potentialDamage = Math.floor(potentialDamage / 2);
        else if (vulnerable && !resisted) potentialDamage *= 2;
        var vitals = projectVitals(target, damage), lifeMultiplier = martyr ? number(profile.martyrHealMultiplier, 3) : (String(target && target.key || '') === String(actor.key || '') ? number(profile.selfHealMultiplier, 1) : number(profile.healMultiplier, 2)), healing = sourceDamageRoll ? sourceDamage * lifeMultiplier : Math.max(0, healRoll.total + number(context.healModifier, 0)), healed = projectHealing({hp:vitals.hp,hpMax:target&&target.hpMax,tempHp:vitals.tempHp}, healing), requestedTempHp = Math.max(0, number(profile.tempHpFixed, 0) || tempHpRoll.total), tempHpLimit = Math.max(0, Math.floor(number(target&&target.hpMax, 0) * .5)), projectedTempHp = requestedTempHp ? Math.max(vitals.tempHp, Math.min(tempHpLimit || requestedTempHp, requestedTempHp)) : vitals.tempHp, appliedStatuses = mode === 'save' ? (!success ? [].concat(profile.statuses || []) : []) : (success ? [].concat(profile.statuses || []) : []), penaltyRoll = !success && profile.penaltyFormula ? formulaRoll(profile.penaltyFormula, false, random) : null, removedStatuses = profile.removeStatus && statusKeys(target).indexOf(String(profile.removeStatus).toLowerCase()) >= 0 ? [String(profile.removeStatus)] : [], secondarySave = null;
        if (!success && profile.severeFailureMargin && dc - total >= number(profile.severeFailureMargin, 5)) {
          var secondaryFirst = die(20, random), secondaryModifier = stat(target, profile.secondarySaveStat || 'con'), secondaryDC = Math.max(1, number(profile.secondarySaveDC, 10));
          secondarySave = { stat:String(profile.secondarySaveStat || 'con'), roll:secondaryFirst, modifier:secondaryModifier, total:secondaryFirst + secondaryModifier, dc:secondaryDC, success:secondaryFirst === 20 || (secondaryFirst !== 1 && secondaryFirst + secondaryModifier >= secondaryDC) };
        }
        return {
          key:String(target && target.key || ''), name:String(target && target.name || 'Цель'), portrait:String(target && target.portrait || ''),
          roll:natural, rolls:rolls, rollMode:rollMode, modifier:modifier, total:total, dc:dc, success:success, saveStatUsed:String(target._previewSaveStat || profile.saveStat || ''),
          damageRolls:damageRoll.rolls, damageRollTotal:damageRoll.total, rawDamage:rawDamage, potentialDamage:potentialDamage, damage:damage, healRolls:healRoll.rolls, healRollTotal:healRoll.total, heal:healed.applied, tempHpRolls:tempHpRoll.rolls, tempHpRollTotal:tempHpRoll.total, tempHpGain:Math.max(0,projectedTempHp-vitals.tempHp),
          immune:immune, resisted:resisted, vulnerable:vulnerable,
          beforeHp:vitals.beforeHp, beforeTempHp:vitals.beforeTempHp, absorbed:vitals.absorbed, hp:healed.hp, tempHp:projectedTempHp,
          statuses:appliedStatuses, attackPenalty:penaltyRoll ? penaltyRoll.total : 0, penaltyRolls:penaltyRoll ? penaltyRoll.rolls : [], removedStatuses:removedStatuses, secondarySave:secondarySave
        };
      })
    };
  }

  return {
    version: 6,
    normalizeName: normalizeName,
    resolve: resolve,
    mergeMeta: mergeMeta,
    catalog: catalog,
    effectPlan: effectPlan,
    prescribedStatusKeys: prescribedStatusKeys,
    canonicalStatusKeys: CANONICAL_STATUS_KEYS.slice(),
    statusPolicy: statusPolicy,
    buildPreview: buildPreview,
    projectVitals: projectVitals,
    projectHealing: projectHealing
  };
});
