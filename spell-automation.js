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
    nonCombat: {
      kind: 'ignite',
      rangeCells: 1,
      manual: true,
      targets: ['torch', 'oil', 'candle', 'campfire']
    }
  }];

  function matches(profile, spell) {
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

  return {
    version: 1,
    normalizeName: normalizeName,
    resolve: resolve,
    mergeMeta: mergeMeta,
    catalog: catalog
  };
});
