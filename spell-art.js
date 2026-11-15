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
    '1775565586025': 'images/spells/level1/icy-whisper-v1.webp',
    '1773702048611': 'images/spells/level1/ray-of-rot-v3.webp',
    '1773835374611': 'images/spells/level1/one-word-command-v3.webp',
    '1774547837394': 'images/spells/level1/dead-mans-scream-v1.webp',
    '1774552085257': 'images/spells/level1/false-life-v2.webp',
    '1774560299194': 'images/spells/level1/grave-strength-v3.webp',
    '1774560449555': 'images/spells/level1/drop-of-betrayal-v2.webp',
    '1774560615264': 'images/spells/level1/blood-scorch-v1.webp',
    '1774699462737': 'images/spells/level1/seeker-of-evil-v1.webp',
    '1775567449210': 'images/spells/level1/evil-eye-v1.webp',
    '1775567656257': 'images/spells/level1/minor-curse-v1.webp',
    '1775568519798': 'images/spells/level1/summon-undead-v1.webp',
    '1773702698728': 'images/spells/level2/circular-strike-v1.webp',
    '1773703580969': 'images/spells/level2/through-shot-v1.webp',
    '1773704142146': 'images/spells/level2/multiple-volley-v1.webp',
    '1774548621809': 'images/spells/level2/tactical-control-v1.webp',
    '1774549041232': 'images/spells/level2/disarm-v1.webp',
    '1774553565101': 'images/spells/level2/blur-v1.webp',
    '1774553719987': 'images/spells/level2/counter-rush-v1.webp',
    '1774553876524': 'images/spells/level2/cover-ally-v1.webp',
    '1774554059361': 'images/spells/level2/living-barrier-v1.webp',
    '1774560834956': 'images/spells/level2/flame-charge-v1.webp',
    '1773704473098': 'images/spells/level2/fire-projectile-v1.webp',
    '1773704738759': 'images/spells/level2/whirlwind-of-blades-v1.webp',
    '1774549339231': 'images/spells/level2/lightning-lasso-v1.webp',
    '1774556597370': 'images/spells/level2/support-v1.webp',
    '1774566110687': 'images/spells/level2/illusion-v1.webp',
    '1774566290057': 'images/spells/level2/invisibility-v1.webp',
    '1775558042161': 'images/spells/level2/detect-thoughts-v1.webp',
    '1775558318136': 'images/spells/level2/hypocrite-v1.webp',
    '1775565731791': 'images/spells/level2/mending-v1.webp',
    '1775565893506': 'images/spells/level2/spectral-hand-v1.webp',
    '1774549524026': 'images/spells/level2/defile-mind-v1.webp',
    '1774549676464': 'images/spells/level2/seal-of-silence-v1.webp',
    '1774556923997': 'images/spells/level2/cleansing-ritual-v1.webp',
    '1774561054506': 'images/spells/level2/absorb-elements-v1.webp',
    '1774563690250': 'images/spells/level2/levitation-v1.webp',
    '1774563873341': 'images/spells/level2/misty-passage-v1.webp',
    '1775558603938': 'images/spells/level2/darkvision-v1.webp',
    '1775558838524': 'images/spells/level2/see-invisible-v1.webp',
    '1775560758891': 'images/spells/level2/animal-courier-v1.webp'
  });
  var customFields = ['iconAsset', 'abilityIcon', 'iconImage', 'image', 'icon'];

  function safeImage(value) {
    if (typeof value !== 'string') return '';
    var source = value.trim();
    if (/[\u0000-\u001F\u007F]/.test(source)) return '';
    return /^(?:images\/|assets\/|https?:\/\/|data:image\/|blob:|\.{1,2}\/)/i.test(source) ? source : '';
  }

  function imagePath(source) {
    return source.split(/[?#]/)[0].replace(/^\.\//, '');
  }

  // Historical application fallbacks are not player-uploaded illustrations.
  function legacyFallback(source) {
    return /^images\/ui\/(?:combat-generated\/(?:codex|folio|ritual)|mobile-skills\/(?:thorn|heat|rot|fire)-v1)\.png$/.test(imagePath(source));
  }

  function resolveCustom(item, skipFallback) {
    if (!item || typeof item !== 'object') return '';
    for (var index = 0; index < customFields.length; index++) {
      var custom = safeImage(item[customFields[index]]);
      if (custom && !(skipFallback && legacyFallback(custom))) return custom;
    }
    return '';
  }

  function resolve(item) {
    if (!item || typeof item !== 'object') return '';
    var id = String(item.id == null ? '' : item.id);
    var standard = Object.prototype.hasOwnProperty.call(defaults, id) ? defaults[id] : '';
    return resolveCustom(item, !!standard) || standard;
  }

  function isScene(source) {
    var image = safeImage(source);
    // Supplied artwork fills its frame. Only actual UI glyphs need inset spacing.
    return !!image && !/^images\/ui\/(?:combat-generated\/|mobile-skills\/source-)/.test(imagePath(image));
  }

  return Object.freeze({ resolve: resolve, resolveCustom: resolveCustom, isScene: isScene, defaults: defaults });
});
