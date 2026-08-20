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
    name: 'Жар Пальцев',
    aliases: ['жар пальцев'],
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
        { key:'fire-damage', kind:'damage', icon:'🔥', label:'Огненный урон', summary:'1d6 урона огнём при попадании', trigger:'attack-hit', required:true },
        { key:'ignite-flammable', kind:'scene', icon:'🕯', label:'Зажечь горючий объект', summary:'Факел, масло, свеча или костёр в пределах 1 клетки', trigger:'manual', required:false }
      ],
      gmAdditions: { kinds:['status'], max:6 }
    },
    nonCombat: {
      kind: 'ignite',
      rangeCells: 1,
      manual: true,
      targets: ['torch', 'oil', 'candle', 'campfire']
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

  function buildPreview(profile, context, random) {
    profile = clone(profile || {});
    context = context || {};
    random = typeof random === 'function' ? random : Math.random;
    var actor = context.actor || {}, targets = Array.isArray(context.targets) ? context.targets : [], attackModifier = stat(actor, profile.attackStat || 'int') + number(context.attackModifier, 0);
    return {
      version:1,
      automationKey:String(profile.automationKey || ''),
      abilityName:String(profile.name || ''),
      actorKey:String(actor.key || ''),
      actorName:String(actor.name || ''),
      damageFormula:String(profile.damageFormula || ''),
      damageType:String(profile.damageType || ''),
      results:targets.map(function (target) {
        var rollMode = ['advantage','disadvantage'].indexOf(target && target.rollMode) >= 0 ? target.rollMode : 'normal', first = die(20, random), second = rollMode === 'normal' ? null : die(20, random), rolls = second == null ? [first] : [first, second];
        var natural = second == null ? first : (rollMode === 'advantage' ? Math.max(first, second) : Math.min(first, second)), ac = Math.max(0, number(target && target.ac, 10) + number(target && target.acModifier, 0));
        var total = natural + attackModifier, success = natural === 20 || (natural !== 1 && total >= ac);
        var damageRoll = formulaRoll(profile.damageFormula, natural === 20 && profile.resolutionMode === 'attack', random);
        var rolledDamage = Math.max(0, damageRoll.total + number(context.damageModifier, 0)), rawDamage = success ? rolledDamage : 0;
        var immune = hasTrait(target && target.immunities, profile.damageType), resisted = hasTrait(target && target.resistances, profile.damageType), vulnerable = hasTrait(target && target.vulnerabilities, profile.damageType), damage = rawDamage, potentialDamage = rolledDamage;
        if (immune) damage = 0;
        else if (resisted && !vulnerable) damage = Math.floor(damage / 2);
        else if (vulnerable && !resisted) damage *= 2;
        if (immune) potentialDamage = 0;
        else if (resisted && !vulnerable) potentialDamage = Math.floor(potentialDamage / 2);
        else if (vulnerable && !resisted) potentialDamage *= 2;
        var vitals = projectVitals(target, damage);
        return {
          key:String(target && target.key || ''), name:String(target && target.name || 'Цель'), portrait:String(target && target.portrait || ''),
          roll:natural, rolls:rolls, rollMode:rollMode, modifier:attackModifier, total:total, dc:ac, success:success,
          damageRolls:damageRoll.rolls, damageRollTotal:damageRoll.total, rawDamage:rawDamage, potentialDamage:potentialDamage, damage:damage, heal:0,
          immune:immune, resisted:resisted, vulnerable:vulnerable,
          beforeHp:vitals.beforeHp, beforeTempHp:vitals.beforeTempHp, absorbed:vitals.absorbed, hp:vitals.hp, tempHp:vitals.tempHp,
          statuses:[]
        };
      })
    };
  }

  return {
    version: 2,
    normalizeName: normalizeName,
    resolve: resolve,
    mergeMeta: mergeMeta,
    catalog: catalog,
    effectPlan: effectPlan,
    prescribedStatusKeys: prescribedStatusKeys,
    buildPreview: buildPreview,
    projectVitals: projectVitals
  };
});
