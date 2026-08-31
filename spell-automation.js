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
    automationKey: 'retaliation-spike-v1',
    catalogId: '1773672381766',
    name: 'Ответный Шип',
    nameUk: 'Шип відплати',
    aliases: ['ответный шип', 'шип відплати'],
    uiIcon: '🛡',
    uiTone: 'gold',
    playbackSummary: 'После полученного урона предлагает реакцию: обычная атака основным оружием; при принятии следующее основное действие теряется.',
    playbackSummaryUk: 'Після отриманої шкоди пропонує реакцію: звичайна атака основною зброєю; після прийняття наступна основна дія втрачається.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'reaction',
    resolutionMode: 'attack',
    usesAttackRoll: true,
    usesSave: false,
    attackStat: 'str',
    saveStat: '',
    rangeCells: 0,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'attacker',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'physical',
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'twice_per_battle', rounds: 0, label: '2 раза за бой' },
    maxUses: 2,
    resourceScopeKind: 'battle',
    triggeredOnly: true,
    triggerKind: 'after-damage',
    weaponMode: 'main',
    nextTurnLongActionDebt: 1,
    animationKey: 'weapon-counterattack',
    soundProfile: 'weapon-impact',
    iconAsset: 'images/ui/combat-generated/codex.png',
    learningPlan: {
      version:1,
      type:'training',
      durationMinutes:0,
      checks:[{ statOptions:['con'], dc:12, successesRequired:2 }],
      prerequisites:{ tagsAny:['martial-specialization'], maxKnownByType:3 },
      retry:{ kind:'break' },
      failure:{
        consequenceChoices:[
          { key:'fatigue-next-check', label:'−1 к следующей проверке изучения', labelUk:'−1 до наступної перевірки вивчення', statPenalty:{stat:'con',amount:-1,until:'next-learning-check'} },
          { key:'overstrain-hp', label:'Потерять 1 HP от перенапряжения', labelUk:'Втратити 1 HP від перенапруження', flatSelfDamage:1 }
        ]
      }
    },
    resolutionPlan: {
      version: 1,
      staged: true,
      steps: [
        { key:'damage-trigger', kind:'gate', actor:'resolver', label:'Получен урон', labelUk:'Отримано шкоду' },
        { key:'weapon-attack', kind:'weapon-attack', actor:'caster-owner', when:'reaction-accepted', label:'Атака основным оружием', labelUk:'Атака основною зброєю' }
      ]
    },
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'counterattack', kind:'reaction', icon:'↩', label:'Ответная атака', labelUk:'Удар у відповідь', summary:'Обычная атака основным оружием по источнику урона', summaryUk:'Звичайна атака основною зброєю по джерелу шкоди', trigger:'after-damage', required:true },
        { key:'next-turn-long-debt', kind:'economy', icon:'⌛', label:'Потеря основного действия', labelUk:'Втрата основної дії', summary:'Основное действие следующего собственного хода недоступно', summaryUk:'Основна дія наступного власного ходу недоступна', trigger:'reaction-accepted', required:true }
      ],
      gmAdditions: { kinds:[], max:0 }
    }
  }, {
    automationKey: 'sweeping-strike-v1',
    catalogId: '1773672646696',
    name: 'Размашистый удар',
    nameUk: 'Розмашистий удар',
    aliases: ['размашистый удар', 'розмашистий удар'],
    uiIcon: '⚔',
    uiTone: 'gold',
    playbackSummary: 'Один взмах двуручным оружием: один бросок атаки по двум соседним врагам; каждому половина урона с округлением вверх.',
    playbackSummaryUk: 'Один помах дворучною зброєю: один кидок атаки по двох сусідніх ворогах; кожному половина шкоди з округленням угору.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'attack',
    usesAttackRoll: true,
    usesSave: false,
    attackStat: 'str',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'enemy',
    targetCount: 2,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'physical',
    healFormula: '',
    halfOnSave: false,
    damageSplit: 'ceil-half-per-target',
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'once_per_battle', rounds: 0, label: '1 раз за бой' },
    maxUses: 1,
    resourceScopeKind: 'battle',
    weaponMode: 'two-handed-melee',
    animationKey: 'sweeping-strike-v1',
    soundProfile: 'weapon-impact',
    iconAsset: 'images/ui/combat-generated/codex.png',
    learningPlan: {
      version:1,
      type:'training',
      durationMinutes:0,
      checks:[{ statOptions:['str'], dc:12, successesRequired:2 }],
      prerequisites:{ tagsAny:['training-dummy'], maxKnownByType:3 },
      retry:{ kind:'immediate' },
      failure:{
        consequences:['next-attack-minus-one','initiative-minus-one-until-rest'],
        temporaryEffects:[
          { kind:'attack-penalty', amount:-1, until:'next-attack', label:'−1 к следующей атаке', labelUk:'−1 до наступної атаки' },
          { kind:'initiative-penalty', amount:-1, until:'rest', label:'−1 к инициативе до отдыха', labelUk:'−1 до ініціативи до відпочинку' }
        ]
      }
    },
    resolutionPlan: {
      version:1,
      staged:true,
      steps:[
        { key:'attack', kind:'attack', formula:'1d20', actor:'caster-owner', compare:'multi-target-ac', shared:true, label:'Общий бросок атаки', labelUk:'Спільний кидок атаки' },
        { key:'damage', kind:'damage', formula:'1d4', actor:'caster-owner', shared:true, gmEditable:true, addStat:'str', label:'Общий урон оружия', labelUk:'Спільна шкода зброї' },
        { key:'apply', kind:'apply', actor:'resolver', label:'Разделить урон', labelUk:'Розділити шкоду' }
      ]
    },
    effectPlan: {
      version:1,
      prescribed:[
        { key:'shared-attack', kind:'attack', icon:'⚔', label:'Один бросок атаки', labelUk:'Один кидок атаки', summary:'Результат сравнивается с КД каждой из двух целей', summaryUk:'Результат порівнюється з КЗ кожної з двох цілей', trigger:'automatic', required:true },
        { key:'split-damage', kind:'damage', icon:'⇆', label:'Урон пополам', labelUk:'Шкода навпіл', summary:'Каждая поражённая цель получает половину общего урона с округлением вверх', summaryUk:'Кожна уражена ціль отримує половину спільної шкоди з округленням угору', trigger:'attack-hit', required:true }
      ],
      gmAdditions:{ kinds:[], max:0 }
    }
  }, {
    automationKey: 'storm-arrow-v1',
    catalogId: '1773672863195',
    name: 'Стрела-буря',
    nameUk: 'Стріла-буря',
    aliases: ['стрела буря', 'стрела-буря', 'стріла буря', 'стріла-буря'],
    uiIcon: '🏹',
    uiTone: 'storm',
    playbackSummary: 'Два снаряда одним приёмом: общий бросок атаки и общий урон с помехой по двум соседним врагам.',
    playbackSummaryUk: 'Два снаряди одним прийомом: спільний кидок атаки та спільна шкода з перешкодою по двох сусідніх ворогах.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'attack',
    usesAttackRoll: true,
    usesSave: false,
    attackStat: 'dex',
    attackRollMode: 'disadvantage',
    damageRollMode: 'disadvantage',
    saveStat: '',
    rangeCells: 1,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'enemy',
    targetCount: 2,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '',
    damageType: 'pierce',
    healFormula: '',
    halfOnSave: false,
    statuses: [],
    durationRounds: 0,
    concentration: false,
    cooldown: { kind: 'once_per_battle', rounds: 0, label: '1 раз за бой' },
    maxUses: 1,
    resourceScopeKind: 'battle',
    weaponMode: 'ranged',
    lockRemainingTurn: true,
    animationKey: 'storm-arrow-v1',
    soundProfile: 'arrow',
    iconAsset: 'images/ui/item-icons/bow.png',
    learningPlan: {
      version:1,
      type:'training',
      durationMinutes:0,
      checks:[{ statOptions:['dex','per'], choose:'best', dc:11, successesRequired:2 }],
      prerequisites:{ tagsAny:['ranged-weapon-proficiency'], maxKnownByType:3 },
      retry:{ kind:'break' },
      failure:{
        consequences:['next-learning-check-minus-one','next-battle-range-minus-one'],
        temporaryEffects:[
          { kind:'learning-check-penalty', stat:'dex', amount:-1, until:'next-learning-check', label:'−1 к следующей проверке изучения', labelUk:'−1 до наступної перевірки вивчення' },
          { kind:'learning-check-penalty', stat:'per', amount:-1, until:'next-learning-check', label:'−1 к следующей проверке изучения', labelUk:'−1 до наступної перевірки вивчення' },
          { kind:'range-penalty', amount:-1, until:'next-battle', label:'−1 к дальности в следующем бою', labelUk:'−1 до дальності в наступному бою' }
        ]
      }
    },
    resolutionPlan: {
      version:1,
      staged:true,
      steps:[
        { key:'attack', kind:'attack', formula:'1d20', actor:'caster-owner', compare:'multi-target-ac', rollMode:'disadvantage', shared:true, label:'Общая атака с помехой', labelUk:'Спільна атака з перешкодою' },
        { key:'damage', kind:'damage', formula:'1d6', actor:'caster-owner', when:'attack-hit', rollMode:'disadvantage', shared:true, gmEditable:true, addStat:'dex', label:'Общий урон с помехой', labelUk:'Спільна шкода з перешкодою' },
        { key:'apply', kind:'apply', actor:'resolver', label:'Применить к попаданиям', labelUk:'Застосувати до влучань' }
      ]
    },
    effectPlan: {
      version:1,
      prescribed:[
        { key:'shared-disadvantaged-attack', kind:'attack', icon:'🏹', label:'Один бросок с помехой', labelUk:'Один кидок із перешкодою', summary:'Меньший d20 сравнивается с КД каждой из двух целей', summaryUk:'Менший d20 порівнюється з КЗ кожної з двох цілей', trigger:'automatic', required:true },
        { key:'shared-disadvantaged-damage', kind:'damage', icon:'🌪', label:'Урон с помехой', labelUk:'Шкода з перешкодою', summary:'Два пула урона; меньший полный результат получает каждая поражённая цель', summaryUk:'Два пули шкоди; менший повний результат отримує кожна уражена ціль', trigger:'attack-hit', required:true },
        { key:'turn-lock', kind:'economy', icon:'⌛', label:'Абсолютная концентрация', labelUk:'Абсолютне зосередження', summary:'До конца хода нельзя двигаться или совершать другие действия', summaryUk:'До кінця ходу не можна рухатися чи виконувати інші дії', trigger:'automatic', required:true }
      ],
      gmAdditions:{ kinds:[], max:0 }
    }
  }, {
    automationKey: 'rot-ray-v1',
    catalogId: '1773702048611',
    name: 'Луч Гнили',
    nameUk: 'Промінь Гнилі',
    aliases: ['луч гнили', 'промінь гнилі'],
    uiIcon: '☠',
    uiTone: 'blood',
    playbackSummary: 'Магическая атака Харизмой до 3 клеток: 1d6 ядом, затем CON DC 13; при провале официальный статус «Отравлен» на 1d3 раунда.',
    playbackSummaryUk: 'Магічна атака Харизмою до 3 клітинок: 1d6 отрутою, потім CON СК 13; у разі провалу офіційний стан «Отруєний» на 1d3 раунди.',
    kind: 'spell',
    effectKind: 'damage',
    actionCost: 'long',
    resolutionMode: 'attack',
    usesAttackRoll: true,
    usesSave: true,
    attackStat: 'cha',
    saveStat: 'con',
    saveDC: 13,
    rangeCells: 3,
    aoeRadius: 0,
    areaWidth: 1,
    targetMode: 'enemy',
    targetCount: 1,
    targetRequired: true,
    selfOnly: false,
    damageFormula: '1d6',
    damageType: 'poison',
    healFormula: '',
    halfOnSave: false,
    statuses: ['poison'],
    durationRounds: 0,
    conditionalStatusSaveStep: 'save',
    statusDurationRollMode: 'd6-half-up',
    statusBlockedByDamageImmunity: true,
    concentration: false,
    cooldown: { kind: 'twice_per_long_rest', rounds: 0, label: '2 раза между долгими отдыхами, не больше 1 раза за бой' },
    maxUses: 2,
    maxUsesPerBattle: 1,
    resourceScopeKind: 'long-rest',
    animationKey: 'rot-ray-v1',
    soundProfile: 'magic-poison',
    iconAsset: 'images/ui/catalog/damage/poison.png',
    nonCombat: { kind:'poison-food', manual:true },
    learningPlan: {
      version:1,
      type:'ritual',
      durationMinutes:0,
      environment:['night-or-seclusion'],
      materials:['caster-blood','swamp-sludge-or-rotten-water','eye-rune'],
      checks:[{ statOptions:['cha'], dc:11, successesRequired:1 }],
      prerequisites:{ anyMinStats:{int:2,cha:2}, maxKnownByType:3 },
      retry:{ kind:'long_rest' },
      failure:{
        consequences:['one-eye-temporarily-blind','ability-unavailable-until-rest'],
        temporaryEffects:[
          {kind:'one-eye-blind',amount:1,until:'rest',label:'Один глаз временно ослеп до отдыха',labelUk:'Одне око тимчасово осліпло до відпочинку'},
          {kind:'spell-disabled',amount:1,until:'rest',label:'«Луч Гнили» недоступен до отдыха',labelUk:'«Промінь Гнилі» недоступний до відпочинку'}
        ]
      }
    },
    resolutionPlan: {
      version:1,
      staged:true,
      steps:[
        { key:'attack', kind:'attack', formula:'1d20', actor:'caster-owner', compare:'target-ac', label:'Атака лучом Харизмой', labelUk:'Атака променем Харизмою' },
        { key:'damage', kind:'damage', formula:'1d6', actor:'caster-owner', when:'attack-hit', gmEditable:true, label:'Урон ядом', labelUk:'Шкода отрутою' },
        { key:'save', kind:'save', formula:'1d20', actor:'target-owner', when:'attack-hit', perTarget:true, stat:'con', dc:13, label:'Проверка CON против отравления', labelUk:'Перевірка CON проти отруєння' },
        { key:'status-duration', kind:'duration', formula:'1d6', actor:'gm', when:'save-fail', label:'Длительность отравления: d6 пополам вверх', labelUk:'Тривалість отруєння: d6 навпіл угору' },
        { key:'apply', kind:'apply', actor:'resolver', label:'Применить урон и отравление', labelUk:'Застосувати шкоду й отруєння' }
      ]
    },
    effectPlan: {
      version:1,
      prescribed:[
        { key:'rot-attack', kind:'attack', icon:'☠', label:'Магическая атака', labelUk:'Магічна атака', summary:'d20 + Харизма против КД цели', summaryUk:'d20 + Харизма проти КЗ цілі', trigger:'automatic', required:true },
        { key:'poison-damage', kind:'damage', icon:'◆', label:'1d6 ядом', labelUk:'1d6 отрутою', summary:'Мастер может изменить пул до броска; иммунитет к яду обнуляет урон', summaryUk:'Майстер може змінити пул до кидка; імунітет до отрути обнуляє шкоду', trigger:'attack-hit', required:true },
        { key:'poison-save', kind:'save', icon:'⚄', label:'CON DC 13', labelUk:'CON СК 13', summary:'При провале накладывается официальный статус «Отравлен»', summaryUk:'У разі провалу накладається офіційний стан «Отруєний»', trigger:'attack-hit', required:true },
        { key:'poison', kind:'status', icon:'☠', label:'Официальный статус «Отравлен»', labelUk:'Офіційний стан «Отруєний»', summary:'Только после провала CON DC 13; стандартные механики статуса сохраняются', summaryUk:'Лише після провалу CON СК 13; стандартні механіки стану зберігаються', trigger:'save-fail', required:true },
        { key:'poison-duration', kind:'duration', icon:'⌛', label:'1d3 раунда', labelUk:'1d3 раунди', summary:'Видимый d6 делится пополам с округлением вверх; стандартный CON DC 14 статуса может снять его раньше', summaryUk:'Видимий d6 ділиться навпіл з округленням угору; стандартний CON СК 14 стану може зняти його раніше', trigger:'save-fail', required:true },
        { key:'poison-food', kind:'scene', icon:'◈', label:'Отравить пищу', labelUk:'Отруїти їжу', summary:'Небоевая возможность остаётся ручным решением мастера', summaryUk:'Небойова можливість лишається ручним рішенням Майстра', trigger:'manual', required:false }
      ],
      gmAdditions:{ kinds:[], max:0 }
    }
  }, {
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
    learningPlan: { version:1, type:'study', durationMinutes:0, checks:[{ statOptions:['int'], dc:12, successesRequired:1 }], prerequisites:{ minStats:{int:2}, maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ consequences:['page-charred'], maxFailures:4, lockCatalogForCharacter:true } },
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
    learningPlan: { version:1, type:'study', durationMinutes:0, checks:[{ statOptions:['int'], dc:11, successesRequired:1 }], prerequisites:{ any:[{minStats:{int:2}},{tag:'healer-background'}], maxKnownByType:3 }, retry:{ kind:'long_rest' }, failure:{ consequences:['text-forgotten'], maxFailures:2, lockCatalogForCharacter:true } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'healing', kind:'healing', formula:'2d4', actor:'caster-owner', gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'healing-result' }
    ] },
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
    learningPlan: { version:1, type:'study', durationMinutes:40, environment:['open-flame'], checks:[{ statOptions:['int'], dc:12, successesRequired:1 }], prerequisites:{ minStats:{int:3}, tagsAny:['destruction-magic','survived-fire','destructive-affinity'], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d6', damageType:'fire', consequences:['hand-disadvantage-until-rest'], critical:{ naturalMax:1, totalBelow:4, consequence:'random-fireball-direction' } } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'saves', kind:'save', formula:'1d20', actor:'target-owner', stat:'dex', dc:13, perTarget:true, gmEditable:true },
      { key:'damage', kind:'damage', formula:'3d6', actor:'caster-owner', shared:true, gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'saves-and-damage-result' }
    ] },
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
    learningPlan: { version:1, type:'study', durationMinutes:30, environment:['electric-source'], checks:[{ statOptions:['int'], dc:13, successesRequired:1 }], prerequisites:{ tagsAny:['survived-electricity','storm-magic'], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d6', damageType:'elec' } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'save', kind:'save', formula:'1d20', actor:'target-owner', stat:'str', dc:13, perTarget:true, gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'save-result' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:0, environment:['cemetery-or-burial'], checks:[{ statOptions:['int'], dc:15, successesRequired:1 }], prerequisites:{ anyMinStats:{int:3,cha:4} }, retry:{ kind:'rest' }, failure:{ consequences:['hostile-undead-manual-encounter'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'requirements', kind:'admission', actor:'gm', requires:['corpse','bone-dust','salt-of-oblivion','caster-blood'] },
      { key:'summon', kind:'summon', actor:'resolver', when:'requirements-approved' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:10, environment:['seclusion'], materials:['small-animal-sacrifice'], checks:[{ statOptions:['int'], dc:11, successesRequired:1 }], prerequisites:{ tagsAny:['death-magic-contact','necrotic-contact'], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ flatSelfDamage:1, consequences:['first-attack-minus-one-until-rest'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'temp-hp', kind:'temp_hp', formula:'2d4', actor:'caster-owner', when:'variant-roll', gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'temp-hp-or-fixed-result' }
    ] },
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
    learningPlan: { version:1, type:'study', durationMinutes:50, environment:['selected-energy-source'], checks:[{ statOptions:['con'], dc:11, successesRequired:1 }], prerequisites:{ maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormulaChoices:['1d4','1d6'], damageType:'selected-energy', gmChoosesFormula:true } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'energy-type', kind:'choice', actor:'caster-owner' },
      { key:'concentration', kind:'concentration-start', actor:'resolver' },
      { key:'apply', kind:'apply', actor:'resolver', when:'energy-type-selected' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:50, environment:['silent-place'], materials:['mouth-cloth','three-cuts','caster-blood'], checks:[{ statOptions:['int'], dc:13, successesRequired:1 }], prerequisites:{ allMinStats:{con:2,dex:2,per:2}, maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d4', damageType:'psychic', consequences:['cannot-speak-1d6-hours'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'point', kind:'targeting', actor:'caster-owner' },
      { key:'zone', kind:'zone', actor:'resolver', when:'point-approved' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:30, environment:['smoke'], materials:['ash-mint-or-darkleaf','charcoal-rune'], checks:[{ statOptions:['int'], dc:12, successesRequired:1 }], prerequisites:{ anyMinStats:{con:2,dex:2}, tagsAny:['survived-pursuit','survived-captivity','sudden-disappearance'], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d4', consequences:['initiative-minus-one-next-battle'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'point', kind:'targeting', actor:'caster-owner' },
      { key:'teleport', kind:'movement', actor:'resolver', when:'point-approved' },
      { key:'smoke', kind:'status', actor:'resolver', when:'teleport-applied' }
    ] },
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
    maxTargetSize: 'large',
    catalogInterpretation: 'save-success-holds-position',
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
    learningPlan: { version:1, type:'study', durationMinutes:0, environment:['small-object'], checks:[{ statOptions:['int','per'], choose:'best', dc:14, successesRequired:1 }], prerequisites:{ anyMinStats:{int:3,per:3}, maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d4', damageType:'blunt', target:'caster' } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'saves', kind:'save', formula:'1d20', actor:'target-owner', stat:'str', dc:14, perTarget:true, gmEditable:true },
      { key:'collision-damage', kind:'damage', formula:'1d6', actor:'caster-owner', when:'collision', shared:true, gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'saves-complete' }
    ] },
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
    requiresSight: true,
    rangePolicy: 'visible-unlimited',
    cooldown: { kind:'long_rest_charge', rounds:0, label:'3 раза за день' },
    maxUses: 3,
    resourceScopeKind: 'long-rest',
    animationKey: 'psychic-screech-v1',
    soundProfile: 'magic-psychic',
    iconAsset: 'images/ui/catalog/categories/debuff.png',
    learningPlan: { version:1, type:'study', durationMinutes:0, environment:['silence','seclusion'], checks:[{ statOptions:['int'], dc:11, successesRequired:1 }], prerequisites:{ any:[{minStats:{int:1}},{minStats:{cha:2}},{tag:'mental-gift'}], maxKnownByType:3 }, retry:{ kind:'conditions', requires:['silence','seclusion'] }, failure:{ statPenalty:{stat:'int',amount:-1,until:'rest'}, consequences:['headache'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'visible-target', kind:'admission', actor:'gm', perTarget:true, label:'Цель видима и обладает разумом', labelUk:'Ціль видима й має розум' },
      { key:'save', kind:'save', formula:'1d20', actor:'target-owner', stat:'int', dc:13, perTarget:true, gmEditable:true },
      { key:'penalty', kind:'penalty', formula:'1d6', actor:'caster-owner', when:'save-fail', gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'save-and-penalty-result' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:60, environment:['moonlight','silence','seclusion'], checks:[{ statOptions:['int','cha'], choose:'best', dc:14, successesRequired:1 }], prerequisites:{ minStats:{per:2}, anyMinStats:{int:3,cha:3}, maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d4', damageType:'psychic', statPenalty:{stat:'per',amount:-1,until:'rest',catalogStat:'wisdom'}, consequences:['headache'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'saves', kind:'save', formula:'1d20', actor:'target-owner', statOptions:['int','cha'], choose:'best', dc:13, perTarget:true, gmEditable:true },
      { key:'apply', kind:'apply', actor:'resolver', when:'saves-complete' }
    ] },
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
    resourceScopeKind: 'two-days',
    cooldownMs: 172800000,
    animationKey: 'remove-curse-v1',
    soundProfile: 'magic-cleanse',
    iconAsset: 'images/ui/catalog/categories/heal.png',
    learningPlan: { version:1, type:'study', durationMinutes:60, environment:['cursed-creature-or-object'], materials:['silver-filigree-25-gold','caster-blood'], checks:[{ statOptions:['int'], dc:14, successesRequired:1 }], prerequisites:{ any:[{minStats:{int:3}},{tag:'temple-cleansing-training'}], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d4', damageType:'psychic', consequences:['curse-magic-vulnerability-24-hours'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'curse-tier', kind:'admission', actor:'gm', allowed:['minor','medium'] },
      { key:'remove', kind:'remove-status', actor:'resolver', statusKey:'curse', when:'admission-approved' }
    ] },
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
    learningPlan: { version:1, type:'ritual', durationMinutes:60, environment:['near-dying-or-recently-dead'], materials:['voluntary-blood-or-flesh'], checks:[{ statOptions:['con'], dc:13, successesRequired:1 }], prerequisites:{ tagsAny:['lost-ally','self-sacrifice'], maxKnownByType:3 }, retry:{ kind:'rest' }, failure:{ damageFormula:'1d6', statPenalty:{stat:'dex',amount:-1,until:'rest'}, consequences:['fatigue'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'source-damage', kind:'damage', formula:'2d8', actor:'caster-owner', target:'caster', addStat:'int', unresistable:true, gmEditable:true },
      { key:'healing', kind:'healing', actor:'resolver', multiplier:2, martyrMultiplier:3, selfMultiplier:1, when:'source-damage-result' },
      { key:'apply', kind:'apply', actor:'resolver', when:'healing-calculated' }
    ] },
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
    casterStatuses: ['electric-spell-lock'],
    statusPolicy: { mode:'custom', keys:['reaction-lock','electric-spell-lock'], contracts:{
      'reaction-lock':{closestCanonical:'stun',reason:'reaction-only-lock'},
      'electric-spell-lock':{closestCanonical:'silence',reason:'electric-spells-only'}
    } },
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
    learningPlan: { version:1, type:'study', durationMinutes:0, environment:['real-storm','open-high-ground'], materials:['metal-rod-or-spear'], checks:[{ statOptions:['int','con'], choose:'best', dc:17, successesRequired:1 }], prerequisites:{ any:[{minStats:{int:5}},{minStats:{con:5}},{tag:'survived-storm-magic'}], maxKnownByType:3 }, retry:{ kind:'long_rest' }, failure:{ damageFormula:'3d8', damageType:'elec', consequences:['folio-hand-numb'] } },
    resolutionPlan: { version:1, staged:true, steps:[
      { key:'line-clear', kind:'admission', actor:'gm', label:'Линия не перекрыта толстой каменной стеной или сильным магическим барьером', labelUk:'Лінію не перекрито товстою кам’яною стіною або сильним магічним бар’єром' },
      { key:'saves', kind:'save', formula:'1d20', actor:'target-owner', stat:'dex', dc:17, perTarget:true, gmEditable:true },
      { key:'success-damage', kind:'damage', formula:'4d8', actor:'caster-owner', when:'any-save-success', sharedByOutcome:true, gmEditable:true },
      { key:'fail-damage', kind:'damage', formula:'7d8', actor:'caster-owner', when:'any-save-fail', sharedByOutcome:true, gmEditable:true },
      { key:'secondary-saves', kind:'save', formula:'1d20', actor:'target-owner', stat:'con', dc:15, perTarget:true, when:'save-fail-margin-5', gmEditable:true },
      { key:'shock-consequence', kind:'choice', actor:'gm', perTarget:true, when:'secondary-save-fail', allowed:['drop-item','lose-concentration'], label:'Последствие тяжёлого электрического шока', labelUk:'Наслідок тяжкого електричного шоку' },
      { key:'apply', kind:'apply', actor:'resolver', when:'all-required-results' }
    ] },
    effectPlan: {
      version: 1,
      prescribed: [
        { key:'lightning-line', kind:'damage', icon:'⚡', label:'Пробивающая молния', labelUk:'Пробивна блискавка', summary:'Все существа на линии: 4d8 электро при успехе DEX DC 17 или 7d8 при провале', summaryUk:'Усі істоти на лінії: 4d8 електро за успіху DEX СК 17 або 7d8 за провалу', trigger:'save', required:true },
        { key:'reaction-lock', kind:'status', icon:'ϟ', label:'Без реакций · электрический шок', labelUk:'Без реакцій · електричний шок', summary:'Провал: цель не использует реакции до конца следующего хода', summaryUk:'Провал: ціль не використовує реакції до кінця наступного ходу', trigger:'save-fail', required:true },
        { key:'severe-shock', kind:'rule', icon:'⚠', label:'Тяжёлый пробой', labelUk:'Тяжкий пробій', summary:'Провал на 5+: CON DC 15; при провале мастер выбирает падение предмета или потерю концентрации', summaryUk:'Провал на 5+: CON СК 15; у разі провалу Майстер обирає падіння предмета або втрату зосередження', trigger:'secondary-save', required:true },
        { key:'electric-spell-lock', kind:'status', target:'caster', icon:'⚡', label:'Электрический канал перегружен', labelUk:'Електричний канал перевантажено', summary:'Заклинатель не применяет другие электро-заклинания до конца своего следующего хода', summaryUk:'Заклинач не застосовує інші електро-закляття до кінця свого наступного ходу', trigger:'automatic', required:true },
        { key:'line-materials', kind:'scene', icon:'≈', label:'Линия и окружение', labelUk:'Лінія й оточення', summary:'Игнорирует обычные щиты, дерево и слабые баррикады; не проходит сквозь толстый камень или сильный магический барьер; вода вдоль линии искрит и дымится', summaryUk:'Ігнорує звичайні щити, дерево й слабкі барикади; не проходить крізь товстий камінь або сильний магічний бар’єр; вода вздовж лінії іскрить і димиться', trigger:'manual', required:true }
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

  function learningPlan(spell) {
    var profile = spell && spell.learningPlan ? spell : resolve(spell);
    return profile && profile.learningPlan ? clone(profile.learningPlan) : null;
  }

  function resolutionPlan(spell) {
    var profile = spell && spell.resolutionPlan ? spell : resolve(spell);
    return profile && profile.resolutionPlan ? clone(profile.resolutionPlan) : null;
  }

  function prescribedStatusKeys(spell) {
    return effectPlan(spell).prescribed.filter(function (effect) {
      return effect && effect.kind === 'status' && effect.required !== false && effect.key && effect.target !== 'caster';
    }).map(function (effect) { return String(effect.key); });
  }

  function prescribedCasterStatusKeys(spell) {
    return effectPlan(spell).prescribed.filter(function (effect) { return effect && effect.kind === 'status' && effect.required !== false && effect.key && effect.target === 'caster'; }).map(function (effect) { return String(effect.key); });
  }

  var CANONICAL_STATUS_KEYS = ['stun','freeze','paralyze','restrain','prone','fear','blind','charm','dominate','confusion','burn','poison','bleed','slow','curse','exhausted','silence','anchor','invisible','regen','shield','rage','fly'];
  var CUSTOM_STATUS_CONTRACTS = {
    'energy-ward': { closestCanonical:'shield', reason:'elemental-resistance-not-ac', mechanics:{ resistanceType:'selected', acMod:0 } },
    'smoke-disadvantage': { closestCanonical:'blind', reason:'attack-disadvantage-only', mechanics:{ attackDisadvantage:true, grantAdvantageToAttackers:false } },
    'psychic-screech': { closestCanonical:'curse', reason:'single-rolled-attack-penalty', mechanics:{ attackPenaltyFormula:'1d6', consumeOnAttack:true } },
    'hypnotic-trance': { closestCanonical:'stun', reason:'breaks-on-damage-and-melee-only-advantage', mechanics:{ cantAct:true, cantMove:true, cantReact:true, grantMeleeAdvantageToAttackers:true, breakOnDamage:true } },
    'reaction-lock': { closestCanonical:'stun', reason:'reaction-only-lock', mechanics:{ cantAct:false, cantMove:false, cantReact:true } },
    'electric-spell-lock': { closestCanonical:'silence', reason:'electric-spells-only', mechanics:{ blocksDamageType:'elec', blocksOtherSpells:false } }
  };
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

  function statusPolicyAudit(spell) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), policy = statusPolicy(profile), errors = [], decisions = [];
    if (!profile) return { valid:false, errors:['profile-missing'], decisions:[], policy:policy };
    var prescribed = prescribedStatusKeys(profile).concat(prescribedCasterStatusKeys(profile)), declared = [].concat(profile.statuses || [], profile.casterStatuses || [], prescribed).map(String).filter(function (key, index, list) { return key && list.indexOf(key) === index; });
    if (declared.indexOf('dead') >= 0 || policy.removes.indexOf('dead') >= 0) errors.push('dead-is-derived-not-canonical');
    declared.forEach(function (key) { if (policy.keys.indexOf(key) < 0) errors.push('undeclared-status:' + key); });
    policy.removes.forEach(function (key) { if (CANONICAL_STATUS_KEYS.indexOf(key) < 0) errors.push('remove-must-be-canonical:' + key); });
    if (policy.mode === 'canonical') {
      policy.keys.concat(policy.removes).forEach(function (key) {
        if (CANONICAL_STATUS_KEYS.indexOf(key) < 0) errors.push('unknown-canonical-status:' + key);
        else decisions.push({ key:key, mode:'canonical' });
      });
    } else if (policy.mode === 'custom') {
      policy.keys.forEach(function (key) {
        if (CANONICAL_STATUS_KEYS.indexOf(key) >= 0) errors.push('custom-duplicates-canonical:' + key);
        var contract = CUSTOM_STATUS_CONTRACTS[key];
        if (!contract) errors.push('custom-contract-missing:' + key);
        else {
          var declaredContract=policy.contracts&&policy.contracts[key]||policy;
          if (declaredContract.closestCanonical !== contract.closestCanonical) errors.push('closest-canonical-mismatch:' + key);
          if (declaredContract.reason !== contract.reason) errors.push('custom-reason-mismatch:' + key);
          if (CANONICAL_STATUS_KEYS.indexOf(contract.closestCanonical) < 0) errors.push('closest-canonical-unknown:' + key);
          decisions.push({ key:key, mode:'custom', closestCanonical:contract.closestCanonical, reason:contract.reason, mechanics:clone(contract.mechanics) });
        }
      });
    } else if (declared.length || policy.removes.length) errors.push('status-policy-mode-missing');
    return { valid:errors.length === 0, errors:errors, decisions:decisions, policy:policy };
  }

  function learningPlanAudit(spell) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), plan = learningPlan(profile), errors = [];
    if (!profile) return { valid:false, errors:['profile-missing'], plan:null };
    if (!plan || plan.version !== 1) errors.push('learning-plan-missing');
    var checks = plan && Array.isArray(plan.checks) ? plan.checks : [];
    if (!checks.length) errors.push('learning-check-missing');
    checks.forEach(function (check, index) {
      var stats = [].concat(check && check.statOptions || []);
      if (!stats.length || stats.some(function (key) { return ['str','dex','int','cha','per','con'].indexOf(String(key)) < 0; })) errors.push('learning-stat-invalid:' + index);
      if (!(Number(check && check.dc) >= 1 && Number(check && check.dc) <= 40)) errors.push('learning-dc-invalid:' + index);
    });
    return { valid:errors.length === 0, errors:errors, plan:plan };
  }

  function resolutionPlanAudit(spell) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), plan = resolutionPlan(profile), errors = [], actors = ['player','caster-owner','target-owner','gm','resolver'];
    if (!profile) return { valid:false, errors:['profile-missing'], plan:null };
    if (!plan || plan.version !== 1 || plan.staged !== true) errors.push('resolution-plan-missing');
    var steps = plan && Array.isArray(plan.steps) ? plan.steps : [], seen = {};
    if (!steps.length) errors.push('resolution-steps-missing');
    steps.forEach(function (step, index) {
      var key = String(step && step.key || '');
      if (!key || seen[key]) errors.push('resolution-step-key-invalid:' + index);else seen[key] = true;
      if (actors.indexOf(String(step && step.actor || '')) < 0) errors.push('resolution-step-actor-invalid:' + key);
      if (step && step.formula && !/^\d{1,2}d(?:4|6|8|10|12|20|100)(?:[+-]\d{1,3})?$/.test(String(step.formula).replace(/\s+/g,''))) errors.push('resolution-step-formula-invalid:' + key);
    });
    return { valid:errors.length === 0, errors:errors, plan:plan };
  }

  function resolutionTarget(value, index) {
    value = value && typeof value === 'object' ? value : { key:value };
    return {
      key:String(value.key || value.targetKey || ('target-' + index)).slice(0,160),
      uid:String(value.uid || value.ownerUid || '').slice(0,128),
      name:String(value.name || value.targetName || 'Цель').slice(0,160)
    };
  }

  function createResolutionWorkflow(spell, context) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), plan = resolutionPlan(profile), options = context && typeof context === 'object' ? context : {}, casterUid = String(options.casterUid || '').slice(0,128), targets = [].concat(options.targets || options.targetKeys || []).map(resolutionTarget), assignments = [];
    if (!profile || !plan) return null;
    (plan.steps || []).forEach(function (step) {
      if (!step || step.actor === 'resolver' || ['apply','summon','zone','movement','status','remove-status','concentration-start'].indexOf(String(step.kind || '')) >= 0) return;
      var stepTargets = step.perTarget ? targets : (step.kind === 'attack' && targets.length ? [targets[0]] : [null]);
      stepTargets.forEach(function (target, targetIndex) {
        var ownerUid = '', ownerRole = 'master';
        if (step.actor === 'player' || step.actor === 'caster-owner') { ownerUid = casterUid;ownerRole = ownerUid ? 'player' : 'master'; }
        if (step.actor === 'target-owner' && target) { ownerUid = target.uid;ownerRole = ownerUid ? 'player' : 'master'; }
        assignments.push({
          id:String(step.key) + (target ? ':' + target.key : ''), stepKey:String(step.key), kind:String(step.kind || 'gate'),
          formula:String(step.formula || ''), actor:String(step.actor || ''), ownerUid:ownerUid, ownerRole:ownerRole,
          targetKey:target ? target.key : '', targetUid:target ? target.uid : '', targetName:target ? target.name : '', targetIndex:target ? targetIndex : -1,
          stat:String(step.stat || ''), statOptions:[].concat(step.statOptions || []).map(String).slice(0,3), choose:String(step.choose || ''), dc:step.dc == null ? null : Number(step.dc),
          compare:String(step.compare || ''), when:String(step.when || ''), gmEditable:step.gmEditable === true, addStat:String(step.addStat || ''), unresistable:step.unresistable === true,
          rollMode:['advantage','disadvantage'].indexOf(String(step.rollMode || '')) >= 0 ? String(step.rollMode) : 'normal',
          shared:step.shared === true, sharedByOutcome:step.sharedByOutcome === true, allowed:[].concat(step.allowed || []).map(String).slice(0,12), label:String(step.label || ''), labelUk:String(step.labelUk || ''), status:'pending', result:null
        });
      });
    });
    return {
      version:1, automationKey:String(profile.automationKey || ''), casterUid:casterUid,
      targetKeys:targets.map(function (target) { return target.key; }), targets:targets,
      assignments:assignments, flags:clone(options.flags || {}), itemLedger:clone(options.itemLedger || []),
      activeAssignmentId:'', status:assignments.length ? 'pending' : 'ready-to-apply', createdAt:Number(options.createdAt) || 0, updatedAt:Number(options.createdAt) || 0
    };
  }

  function workflowResults(workflow, predicate) {
    return [].concat(workflow && workflow.assignments || []).filter(function (assignment) {
      return assignment && assignment.status === 'resolved' && (!predicate || predicate(assignment));
    });
  }

  function workflowConditionState(assignment, workflow) {
    var when = String(assignment && assignment.when || '');
    if (!when) return true;
    var assignments = [].concat(workflow && workflow.assignments || []), targetKey = String(assignment && assignment.targetKey || '');
    function candidates(key) { return assignments.filter(function (item) { return item && item.stepKey === key && (!targetKey || !item.targetKey || item.targetKey === targetKey); }); }
    function allSettled(items) { return items.length > 0 && items.every(function (item) { return item.status === 'resolved' || item.status === 'skipped'; }); }
    function resultOf(key) { return workflowResults(workflow, function (item) { return item.stepKey === key && (!targetKey || !item.targetKey || item.targetKey === targetKey); }); }
    if (when === 'attack-hit') { var attacks = candidates('attack');if (!allSettled(attacks)) return null;return resultOf('attack').some(function (item) { return item.result && item.result.success; }); }
    if (when === 'any-save-success' || when === 'any-save-fail') { var saves = candidates('saves');if (!allSettled(saves)) return null;var success = resultOf('saves').some(function (item) { return item.result && item.result.success; });return when === 'any-save-success' ? success : resultOf('saves').some(function (item) { return item.result && item.result.success === false; }); }
    if (when === 'save-fail') { var save = candidates('save');if (!allSettled(save)) return null;return resultOf('save').some(function (item) { return item.result && item.result.success === false; }); }
    if (when === 'save-fail-margin-5') { var primary = assignments.filter(function (item) { return item && item.stepKey === 'saves' && item.targetKey === targetKey; });if (!allSettled(primary)) return null;return primary.some(function (item) { return item.result && item.result.success === false && Number(item.result.dc) - Number(item.result.total) >= 5; }); }
    if (when === 'secondary-save-fail') { var secondary = assignments.filter(function (item) { return item && item.stepKey === 'secondary-saves' && item.targetKey === targetKey; });if (!allSettled(secondary)) return null;return secondary.some(function (item) { return item.result && item.result.success === false; }); }
    if (when === 'collision') return workflow && workflow.flags && workflow.flags.collision === true;
    if (when === 'variant-roll') return !(workflow && workflow.flags && workflow.flags.variantRoll === false);
    return true;
  }

  function advanceResolutionWorkflow(value) {
    var workflow = clone(value || {}), assignments = [].concat(workflow.assignments || []), active = null;
    assignments.forEach(function (assignment) {
      if (active || !assignment || assignment.status !== 'pending') return;
      var condition = workflowConditionState(assignment, workflow);
      if (condition === false) assignment.status = 'skipped';
      else if (condition === true) { assignment.status = 'active';active = assignment; }
    });
    workflow.assignments = assignments;workflow.activeAssignmentId = active ? active.id : '';
    workflow.status = active ? 'waiting-roll' : assignments.some(function (assignment) { return assignment && assignment.status === 'pending'; }) ? 'waiting-dependency' : 'ready-to-apply';
    return workflow;
  }

  function recordResolutionResult(value, assignmentId, result) {
    var workflow = clone(value || {}), assignment = [].concat(workflow.assignments || []).find(function (item) { return item && item.id === String(assignmentId || ''); });
    if (!assignment || assignment.status !== 'active') return { valid:false, error:'assignment-not-active', workflow:workflow };
    assignment.status = 'resolved';assignment.result = clone(result || {});workflow.activeAssignmentId = '';workflow.updatedAt = Number(result && result.rolledAt) || workflow.updatedAt || 0;
    return { valid:true, error:'', workflow:advanceResolutionWorkflow(workflow) };
  }

  function resolutionWorkflowAudit(spell, workflow) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), errors = [], planAudit = resolutionPlanAudit(profile), ids = {};
    if (!planAudit.valid) errors.push.apply(errors, planAudit.errors);
    if (!workflow || workflow.version !== 1) errors.push('workflow-missing');
    [].concat(workflow && workflow.assignments || []).forEach(function (assignment, index) {
      if (!assignment || !assignment.id || ids[assignment.id]) errors.push('workflow-assignment-id-invalid:' + index);else ids[assignment.id] = true;
      if (assignment && assignment.formula && !/^\d{1,2}d(?:4|6|8|10|12|20|100)(?:[+-]\d{1,3})?$/.test(String(assignment.formula).replace(/\s+/g,''))) errors.push('workflow-formula-invalid:' + assignment.id);
      if (assignment && ['pending','active','resolved','skipped'].indexOf(String(assignment.status || '')) < 0) errors.push('workflow-status-invalid:' + assignment.id);
    });
    if (workflow && workflow.activeAssignmentId && !ids[workflow.activeAssignmentId]) errors.push('workflow-active-missing');
    return { valid:errors.length === 0, errors:errors, workflow:clone(workflow) };
  }

  function resolutionWorkflowResults(spell, workflow, targetKeys) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), assignments = [].concat(workflow && workflow.assignments || []), keys = [].concat(targetKeys || workflow && workflow.targetKeys || []).map(String), results = [];
    function resolved(stepKey, targetKey) { return assignments.find(function (assignment) { return assignment && assignment.status === 'resolved' && assignment.stepKey === stepKey && (assignment.shared === true || !targetKey || !assignment.targetKey || assignment.targetKey === targetKey); }); }
    function total(assignment) { return Math.max(0, Number(assignment && assignment.result && (assignment.result.total == null ? assignment.result.rolledTotal : assignment.result.total)) || 0); }
    function rolls(assignment) { return [].concat(assignment && assignment.result && (assignment.result.rolls || assignment.result.baseRolls) || []).map(function (value) { return Math.max(1, Math.min(100, Math.floor(Number(value) || 1))); }).slice(0,40); }
    keys.forEach(function (key) {
      var attack = resolved('attack', key), save = resolved('saves', key) || resolved('save', key), successDamage = resolved('success-damage'), failDamage = resolved('fail-damage'), damageAssignment = resolved('damage'), healing = resolved('healing'), tempHp = resolved('temp-hp'), penalty = resolved('penalty'), secondary = resolved('secondary-saves', key), durationAssignment = resolved('status-duration', key), primary = attack || save, success = primary && primary.result ? primary.result.success !== false : true, damageSource = successDamage && success ? successDamage : failDamage && !success ? failDamage : damageAssignment, damage = total(damageSource), conditionalSave = profile && profile.conditionalStatusSaveStep ? resolved(String(profile.conditionalStatusSaveStep), key) : null, statusDuration = profile && profile.statusDurationRollMode === 'd6-half-up' && durationAssignment ? Math.max(1, Math.ceil(total(durationAssignment) / 2)) : 0, applyConditionalStatus = success && (!conditionalSave || conditionalSave.result && conditionalSave.result.success === false), statuses = applyConditionalStatus ? [].concat(profile && profile.statuses || []) : [];
      if (!attack && save && success && profile && profile.halfOnSave) damage = Math.floor(damage / 2);else if (!attack && save && success && profile && !profile.successDamageFormula) damage = 0;
      if (profile && profile.damageSplit === 'ceil-half-per-target') damage = success ? Math.ceil(damage / 2) : 0;
      results.push({ key:key, roll:primary&&primary.result&&primary.result.roll, rolls:primary&&primary.result&&primary.result.rolls||[], rollMode:primary&&primary.result&&primary.result.rollMode||'normal', modifier:Number(primary&&primary.result&&primary.result.modifier)||0, itemBonus:Number(primary&&primary.result&&primary.result.itemBonus)||0, total:Number(primary&&primary.result&&primary.result.total)||0, dc:Number(primary&&primary.result&&primary.result.dc)||0, success:!!success, rawDamage:damage, damage:damage, damageRolls:rolls(damageSource), heal:total(healing), healRolls:rolls(healing), tempHp:total(tempHp), tempHpRolls:rolls(tempHp), attackPenalty:total(penalty), penaltyRolls:rolls(penalty), secondarySave:secondary&&secondary.result||null, conditionalSave:conditionalSave&&conditionalSave.result||null, statusDuration:applyConditionalStatus?statusDuration:0, statuses:statuses });
    });
    return { results:results, itemLedger:clone(workflow && workflow.itemLedger || []) };
  }

  function spellModifierLedger(spell, sources, context) {
    var profile = spell && spell.automationKey ? spell : resolve(spell), options = context && typeof context === 'object' ? context : {}, usage = options.usage && typeof options.usage === 'object' ? options.usage : {}, battleScopeKey = String(options.battleScopeKey || ''), area = !!(profile && (profile.targetMode === 'area' || profile.areaMode && profile.areaMode !== 'manual' || Number(profile.aoeRadius) > 0)), touch = !!(profile && Number(profile.rangeCells) <= 1), healing = !!(profile && (profile.healFormula || profile.sourceDamageFormula || profile.effectKind === 'healing')), control = !!(profile && ([].concat(profile.statuses || []).length || profile.zoneKind || profile.pullCells || profile.pullTowardPoint)), attack = !!(profile && profile.resolutionMode === 'attack'), weaponAttack = !!(profile && profile.weaponMode), rows = [], seenSources = {};
    [].concat(sources || []).forEach(function (source, sourceIndex) {
      source = source && typeof source === 'object' ? source : {};
      var stableSourceId=String(source.instanceId || source.id || ('source-' + sourceIndex));
      if(seenSources[stableSourceId])return;seenSources[stableSourceId]=true;
      [].concat(source.effects || source.modifiers || []).forEach(function (effect, effectIndex) {
        effect = effect && typeof effect === 'object' ? effect : {};
        var operation = String(effect.operation || ''), applicable = false, stage = '';
        if (operation === 'add-die-to-spell-attack-roll') { applicable = attack && !weaponAttack;stage = 'attack'; }
        else if (operation === 'add-attack-bonus') { applicable = weaponAttack;stage = 'attack'; }
        else if (operation === 'add-damage-dice' || operation === 'add-flat-damage') { applicable = weaponAttack;stage = 'damage'; }
        else if (operation === 'add-die-to-concentration-check') { applicable = options.concentrationCheck === true;stage = 'concentration'; }
        else if (operation === 'add-die-to-touch-spell-damage-or-healing') { applicable = touch && !!(profile && (profile.damageFormula || healing));stage = healing ? 'healing' : 'damage'; }
        else if (operation === 'add-damage-die-to-one-chosen-area-target') { applicable = area && !!(profile && (profile.damageFormula || profile.successDamageFormula || profile.failDamageFormula));stage = 'damage'; }
        else if (operation === 'impose-disadvantage') { applicable = control;stage = 'save'; }
        else if (operation === 'reroll-one-healing-die-keep-higher') { applicable = healing;stage = 'healing'; }
        else if (/spell/.test(String(effect.trigger || '')) || /spell/.test(operation)) { applicable = true;stage = 'special'; }
        if (!applicable) return;
        var effectId=String(effect.id || ('spell-modifier-' + sourceIndex + '-' + effectIndex)),frequency=String(effect.frequency || ''),charges=Math.max(0, Number(effect.charges) || 0),resourceKey=('item-effect-'+stableSourceId+'-'+effectId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100),state=usage[resourceKey]&&typeof usage[resourceKey]==='object'?usage[resourceKey]:{},used=Math.max(0,Number(state.used)||0);
        if(frequency==='combat'&&battleScopeKey&&String(state.scopeKey||'')!==battleScopeKey)used=0;
        var remaining=charges?Math.max(0,charges-used):Infinity;
        rows.push({ id:resourceKey, effectId:effectId, sourceId:stableSourceId, sourceName:String(source.name || source.label || 'Предмет'), operation:operation, stage:stage, dice:String(effect.dice || ''), value:Number(effect.value) || 0, condition:String(effect.condition || ''), targetLimit:Math.max(0, Number(effect.targetLimit) || 0), damageType:String(effect.damageType || ''), frequency:frequency, charges:charges, used:used, remaining:remaining, available:remaining>0, resourceKey:resourceKey, scopeKey:frequency==='combat'?battleScopeKey:'', optional:effect.frequency !== 'passive' || weaponAttack && !!effect.condition });
      });
    });
    return { version:1, automationKey:String(profile && profile.automationKey || ''), entries:rows };
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
        var vitals = projectVitals(target, damage), lifeMultiplier = martyr ? number(profile.martyrHealMultiplier, 3) : (String(target && target.key || '') === String(actor.key || '') ? number(profile.selfHealMultiplier, 1) : number(profile.healMultiplier, 2)), healing = sourceDamageRoll ? sourceDamage * lifeMultiplier : Math.max(0, healRoll.total + number(context.healModifier, 0)), healed = projectHealing({hp:vitals.hp,hpMax:target&&target.hpMax,tempHp:vitals.tempHp}, healing), requestedTempHp = Math.max(0, number(profile.tempHpFixed, 0) || tempHpRoll.total), tempHpLimit = Math.max(0, Math.floor(number(target&&target.hpMax, 0) * .5)), projectedTempHp = requestedTempHp ? Math.max(vitals.tempHp, Math.min(tempHpLimit || requestedTempHp, requestedTempHp)) : vitals.tempHp, appliedStatuses = mode === 'save' ? (!success ? [].concat(profile.statuses || []) : []) : (success ? [].concat(profile.statuses || []) : []), penaltyRoll = !success && profile.penaltyFormula ? formulaRoll(profile.penaltyFormula, false, random) : null, removedStatuses = profile.removeStatus && statusKeys(target).indexOf(String(profile.removeStatus).toLowerCase()) >= 0 ? [String(profile.removeStatus)] : [], secondarySave = null, conditionalSave = null, statusDuration = 0;
        if (profile.conditionalStatusSaveStep && success) {
          var conditionalRoll = die(20, random), conditionalModifier = stat(target, profile.saveStat || 'con') + number(target && target.saveModifier, 0), conditionalDC = Math.max(1, number(context.saveDC == null ? profile.saveDC : context.saveDC, 10)), conditionalTotal = conditionalRoll + conditionalModifier, conditionalSuccess = conditionalRoll === 20 || (conditionalRoll !== 1 && conditionalTotal >= conditionalDC);
          conditionalSave = { stat:String(profile.saveStat || 'con'), roll:conditionalRoll, rolls:[conditionalRoll], modifier:conditionalModifier, total:conditionalTotal, dc:conditionalDC, success:conditionalSuccess };
          appliedStatuses = conditionalSuccess || profile.statusBlockedByDamageImmunity && immune ? [] : [].concat(profile.statuses || []);
          if (appliedStatuses.length && profile.statusDurationRollMode === 'd6-half-up') statusDuration = Math.ceil(die(6, random) / 2);
        }
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
          statuses:appliedStatuses, statusDuration:statusDuration, conditionalSave:conditionalSave, attackPenalty:penaltyRoll ? penaltyRoll.total : 0, penaltyRolls:penaltyRoll ? penaltyRoll.rolls : [], removedStatuses:removedStatuses, secondarySave:secondarySave
        };
      })
    };
  }

  return {
    version: 8,
    normalizeName: normalizeName,
    resolve: resolve,
    mergeMeta: mergeMeta,
    catalog: catalog,
    effectPlan: effectPlan,
    learningPlan: learningPlan,
    resolutionPlan: resolutionPlan,
    learningPlanAudit: learningPlanAudit,
    resolutionPlanAudit: resolutionPlanAudit,
    createResolutionWorkflow: createResolutionWorkflow,
    advanceResolutionWorkflow: advanceResolutionWorkflow,
    recordResolutionResult: recordResolutionResult,
    resolutionWorkflowAudit: resolutionWorkflowAudit,
    resolutionWorkflowResults: resolutionWorkflowResults,
    spellModifierLedger: spellModifierLedger,
    prescribedStatusKeys: prescribedStatusKeys,
    prescribedCasterStatusKeys: prescribedCasterStatusKeys,
    canonicalStatusKeys: CANONICAL_STATUS_KEYS.slice(),
    customStatusContracts: clone(CUSTOM_STATUS_CONTRACTS),
    statusPolicy: statusPolicy,
    statusPolicyAudit: statusPolicyAudit,
    buildPreview: buildPreview,
    projectVitals: projectVitals,
    projectHealing: projectHealing
  };
});
