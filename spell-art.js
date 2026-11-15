(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZargotaSpellArt = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // Presentation only: catalog IDs stay independent of names and battle profiles.
  var defaults = Object.freeze({
    '1773672381766': 'images/spells/level1/counter-thorn-v1.webp',
    '1773672646696': 'images/spells/level1/sweeping-strike-v1.webp',
    '1773672863195': 'images/spells/level1/storm-arrow-v1.webp',
    '1773832374199': 'images/spells/level1/heart-mark-v1.webp',
    '1773834230927': 'images/spells/level1/provocation-v1.webp',
    '1774551795426': 'images/spells/level1/oak-stance-v1.webp',
    '1774560024154': 'images/spells/level1/rage-stance-v1.webp',
    '1774562729748': 'images/spells/level1/ghost-step-v1.webp',
    '1774562867258': 'images/spells/level1/boar-rush-v1.webp',
    '1774563134067': 'images/spells/level1/shadow-round-v1.webp',
    '1773673009471': 'images/spells/level1/finger-heat-v1.webp',
    '1773834544336': 'images/spells/level1/psychic-screech-v1.webp',
    '1774556074255': 'images/spells/level1/saving-touch-v1.webp',
    '1774556222800': 'images/spells/level1/comfort-whisper-v1.webp',
    '1774556376586': 'images/spells/level1/holy-washing-v1.webp',
    '1774560154079': 'images/spells/level1/breath-control-v1.webp',
    '1774697449889': 'images/spells/level1/memory-beacon-v1.webp',
    '1774697604591': 'images/spells/level1/source-flare-eye-v3-v1.webp',
    '1775565442524': 'images/spells/level1/dry-current-v1.webp',
    '1775565586025': 'images/spells/level1/icy-whisper-v1.webp'
  });
  var customFields = ['iconAsset', 'abilityIcon', 'iconImage', 'image', 'icon'];
  var scenes = new Set(Object.keys(defaults).map(function (id) { return defaults[id]; }));

  function safeImage(value) {
    if (typeof value !== 'string') return '';
    var source = value.trim();
    if (/[\u0000-\u001F\u007F]/.test(source)) return '';
    return /^(?:images\/|assets\/|https?:\/\/|data:image\/|blob:|\.{1,2}\/)/i.test(source) ? source : '';
  }

  function resolve(item) {
    if (!item || typeof item !== 'object') return '';
    for (var index = 0; index < customFields.length; index++) {
      var custom = safeImage(item[customFields[index]]);
      if (custom) return custom;
    }
    var id = String(item.id == null ? '' : item.id);
    return Object.prototype.hasOwnProperty.call(defaults, id) ? defaults[id] : '';
  }

  function isScene(source) {
    return typeof source === 'string' && scenes.has(source);
  }

  return Object.freeze({ resolve: resolve, isScene: isScene, defaults: defaults });
});
