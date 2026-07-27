window.__zgpScriptStarted = true;
(function(global) {
  'use strict';

  var PLAN_VERSION = 1;
  var ui = {
    charId: null,
    level: 2,
    tab: 'stats',
    search: '',
    spellType: 'all',
    confirmUntil: 0
  };

  var STAT_ORDER = ['str', 'dex', 'int', 'cha', 'per', 'con'];
  var STAT_LABELS = {
    str: 'Сила', dex: 'Ловкость', int: 'Интеллект',
    cha: 'Харизма', per: 'Восприятие', con: 'Выносливость'
  };
  var STAT_ICONS = {
    str: '💪', dex: '🤸', int: '🧠',
    cha: '😎', per: '👁', con: '🧃'
  };
  var SPELL_TYPES = {
    kodex: { icon: '🥋', label: 'Кодекс', color: '#c8d4dc' },
    folio: { icon: '📖', label: 'Фолиант', color: '#5a9ae0' },
    obrad: { icon: '🩸', label: 'Обрядник', color: '#c94c4c' }
  };

  function esc(value) {
    if (typeof global.escHTML === 'function') return global.escHTML(String(value == null ? '' : value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sameId(a, b) {
    return String(a) === String(b);
  }

  function getCharacter(charId) {
    return (global.characters || []).find(function(character) {
      return character && sameId(character.id, charId);
    }) || null;
  }

  function emptyStats() {
    return { str:0, dex:0, int:0, cha:0, per:0, con:0 };
  }

  function normalizeEntry(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var stats = emptyStats();
    STAT_ORDER.forEach(function(key) {
      stats[key] = Math.max(0, Math.floor(Number(raw.stats && raw.stats[key]) || 0));
    });
    return {
      stats: stats,
      spellIds: Array.isArray(raw.spellIds) ? raw.spellIds.slice() : [],
      items: Array.isArray(raw.items) ? raw.items.slice() : [],
      notes: Array.isArray(raw.notes) ? raw.notes.filter(Boolean).map(String) : [],
      appliedAt: raw.appliedAt || null
    };
  }

  function ensurePlan(character) {
    var current = Math.max(1, Math.min(11, Number(character.level) || 1));
    var plan = character.progressionPlan;
    if (!plan || typeof plan !== 'object') {
      plan = character.progressionPlan = {
        version: PLAN_VERSION,
        baselineLevel: current,
        selectedLevel: Math.min(11, current + 1),
        levels: {}
      };
    }
    plan.version = PLAN_VERSION;
    if (!plan.levels || typeof plan.levels !== 'object') plan.levels = {};
    if (!Number(plan.baselineLevel)) plan.baselineLevel = current;
    if (!Number(plan.selectedLevel)) plan.selectedLevel = Math.min(11, current + 1);
    Object.keys(plan.levels).forEach(function(level) {
      plan.levels[level] = normalizeEntry(plan.levels[level]);
    });
    return plan;
  }

  function levelEntry(character, level, create) {
    var plan = ensurePlan(character);
    var key = String(level);
    if (!plan.levels[key] && create) plan.levels[key] = normalizeEntry({});
    return plan.levels[key] || normalizeEntry({});
  }

  function entryPointCount(entry) {
    return STAT_ORDER.reduce(function(total, key) {
      return total + (Number(entry.stats[key]) || 0);
    }, 0);
  }

  function levelAllowance(character, level) {
    if (level <= 1) return 4;
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    var milestone = level === 3 || level === 6 || level === 9;
    return 2 + (milestone && race && race.racialAt369 && race.racialAt369.kind === 'free' ? 1 : 0);
  }

  function currentBaseStat(character, key) {
    var stat = character.stats && character.stats[key];
    if (!stat) return 0;
    return Number(stat.base != null ? stat.base : stat.cur) || 0;
  }

  function projectedStats(character, targetLevel) {
    var result = emptyStats();
    STAT_ORDER.forEach(function(key) { result[key] = currentBaseStat(character, key); });
    var current = Number(character.level) || 1;
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    for (var level = current + 1; level <= targetLevel; level += 1) {
      var entry = levelEntry(character, level, false);
      if (!entry.appliedAt) {
        STAT_ORDER.forEach(function(key) { result[key] += Number(entry.stats[key]) || 0; });
      }
      if ((level === 3 || level === 6 || level === 9) && race && race.racialAt369) {
        var racial = race.racialAt369;
        if (racial.kind === 'stat' || racial.kind === 'stat+speed') result[racial.stat] += 1;
      }
    }
    return result;
  }

  function projectedSpeed(character, targetLevel) {
    var speed = typeof global.parseSpeedNumber === 'function'
      ? global.parseSpeedNumber(character.speed || character.baseSpeed || '0')
      : (parseInt(character.speed, 10) || 0);
    var current = Number(character.level) || 1;
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    if (!race || !race.racialAt369 || race.racialAt369.kind !== 'stat+speed') return speed;
    for (var level = current + 1; level <= targetLevel; level += 1) {
      if (level === 3 || level === 6 || level === 9) speed += Number(race.racialAt369.speed) || 0;
    }
    return speed;
  }

  function projectedHp(character, targetLevel) {
    var current = Number(character.level) || 1;
    var hp = Number(character.hpMax) || Number(character.baseHpMax) || 10;
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    var hpPerLevel = race ? Number(race.hpPerLevel) || 4 : 4;
    var nowCon = currentBaseStat(character, 'con');
    var futureCon = projectedStats(character, targetLevel).con;
    return hp + Math.max(0, targetLevel - current) * hpPerLevel + Math.max(0, futureCon - nowCon) * 2;
  }

  function projectedAc(character, targetLevel) {
    var ac = Number(character.ac) || 10;
    var nowDex = currentBaseStat(character, 'dex');
    var futureDex = projectedStats(character, targetLevel).dex;
    return ac + Math.floor(futureDex / 3) - Math.floor(nowDex / 3);
  }

  function catalogEntries() {
    if (typeof entries !== 'undefined' && Array.isArray(entries)) return entries;
    if (Array.isArray(global.entries)) return global.entries;
    try {
      var raw = JSON.parse(localStorage.getItem('grimoire_v3') || '{}');
      return Array.isArray(raw.entries) ? raw.entries : [];
    } catch (error) {
      return [];
    }
  }

  function shopItems() {
    if (typeof global.loadShopItems === 'function') return global.loadShopItems();
    try {
      var raw = JSON.parse(localStorage.getItem('zargota_shop_v1') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      return [];
    }
  }

  function spellLevel(spell) {
    if (String(spell && spell.level).toLowerCase() === 'абсолют') return 11;
    return Math.max(1, Number(spell && spell.level) || 1);
  }

  function extractRequirements(spell) {
    var text = [
      spell && spell.restriction,
      spell && spell.learnText
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    var patterns = {
      str: /сил(?:а|ы|ой|у|е|ом)?\s*(\d+)\s*\+/ig,
      dex: /ловкост(?:ь|и|ью)?\s*(\d+)\s*\+/ig,
      int: /интеллект(?:а|ом|у|е)?\s*(\d+)\s*\+/ig,
      cha: /харизм(?:а|ы|ой|у|е)?\s*(\d+)\s*\+/ig,
      per: /восприяти(?:е|я|ем|ю)?\s*(\d+)\s*\+/ig,
      con: /выносливост(?:ь|и|ью)?\s*(\d+)\s*\+/ig
    };
    var found = [];
    STAT_ORDER.forEach(function(key) {
      var match;
      while ((match = patterns[key].exec(text))) {
        found.push({ key:key, min:Number(match[1]) || 0, index:match.index });
      }
    });
    found.sort(function(a, b) { return a.index - b.index; });
    var unique = {};
    found.forEach(function(req) {
      unique[req.key] = Math.max(unique[req.key] || 0, req.min);
    });
    var requirements = Object.keys(unique).map(function(key) {
      return { key:key, min:unique[key] };
    });
    return {
      mode: requirements.length > 1 && /или/i.test(text) ? 'any' : 'all',
      stats: requirements
    };
  }

  function plannedSpellIdsUpTo(character, targetLevel) {
    var ids = [];
    var current = Number(character.level) || 1;
    for (var level = current + 1; level <= targetLevel; level += 1) {
      levelEntry(character, level, false).spellIds.forEach(function(id) {
        if (!ids.some(function(existing) { return sameId(existing, id); })) ids.push(id);
      });
    }
    return ids;
  }

  function spellCompatibility(character, spell, targetLevel) {
    var stats = projectedStats(character, targetLevel);
    var req = extractRequirements(spell);
    var checks = req.stats.map(function(item) { return stats[item.key] >= item.min; });
    var statsOk = !checks.length || (req.mode === 'any'
      ? checks.some(Boolean)
      : checks.every(Boolean));
    var levelOk = spellLevel(spell) <= targetLevel;
    var already = (character.spellRefs || []).some(function(id) { return sameId(id, spell.id); });
    var allIds = (character.spellRefs || []).slice().concat(plannedSpellIdsUpTo(character, targetLevel));
    var sameType = {};
    allIds.forEach(function(id) {
      var existing = catalogEntries().find(function(item) { return sameId(item.id, id); });
      if (existing) sameType[String(existing.id)] = existing.spellType;
    });
    sameType[String(spell.id)] = spell.spellType;
    var typeCount = Object.keys(sameType).filter(function(id) {
      return sameType[id] === spell.spellType;
    }).length;
    var limitOk = typeCount <= 3;
    var missing = req.stats.filter(function(item) { return stats[item.key] < item.min; });
    var reason = '';
    if (already) reason = 'Уже привязано к герою';
    else if (!levelOk) reason = 'Нужен уровень ' + spellLevel(spell);
    else if (!statsOk) {
      reason = 'Нужно: ' + missing.map(function(item) {
        return STAT_LABELS[item.key] + ' ' + item.min + '+';
      }).join(req.mode === 'any' ? ' или ' : ', ');
    } else if (!limitOk) reason = 'Лимит типа: 3';
    else reason = 'Совместимо';
    return {
      ok: !already && levelOk && statsOk && limitOk,
      already: already,
      reason: reason,
      requirements: req
    };
  }

  function priceToCopper(price) {
    price = price || {};
    return (Number(price.pl) || 0) * 1000 +
      (Number(price.zl) || 0) * 100 +
      (Number(price.sr) || 0) * 10 +
      (Number(price.md) || 0);
  }

  function coinsToCopper(character) {
    var coins = character.coins || {};
    return (Number(coins.platinum != null ? coins.platinum : coins.plat) || 0) * 1000 +
      (Number(coins.gold) || 0) * 100 +
      (Number(coins.silver != null ? coins.silver : coins.silv) || 0) * 10 +
      (Number(coins.copper != null ? coins.copper : coins.bron) || 0);
  }

  function writeCopper(character, total) {
    total = Math.max(0, Math.floor(total));
    character.coins = character.coins || {};
    character.coins.platinum = Math.floor(total / 1000);
    total %= 1000;
    character.coins.gold = Math.floor(total / 100);
    total %= 100;
    character.coins.silver = Math.floor(total / 10);
    character.coins.copper = total % 10;
    delete character.coins.plat;
    delete character.coins.silv;
    delete character.coins.bron;
  }

  function priceText(price) {
    price = price || {};
    var parts = [];
    if (price.pl) parts.push(price.pl + ' пл');
    if (price.zl) parts.push(price.zl + ' зл');
    if (price.sr) parts.push(price.sr + ' ср');
    if (price.md) parts.push(price.md + ' мд');
    return parts.join(' ') || 'бесплатно';
  }

  function plannedCost(character, targetLevel) {
    var current = Number(character.level) || 1;
    var total = 0;
    for (var level = current + 1; level <= targetLevel; level += 1) {
      levelEntry(character, level, false).items.forEach(function(item) {
        total += priceToCopper(item.price);
      });
    }
    return total;
  }

  function savePlan(character) {
    if (typeof global.saveChars === 'function') {
      global.saveChars({ reason:'progression-plan' });
    }
  }

  function toast(message) {
    if (typeof global.showToast === 'function') global.showToast(message);
  }

  function installStyles() {
    if (document.getElementById('zg-progression-styles')) return;
    var style = document.createElement('style');
    style.id = 'zg-progression-styles';
    style.textContent =
      '#zg-progression-overlay{position:fixed;inset:0;z-index:100050;background:rgba(2,2,1,.88);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}' +
      '#zg-progression{--pg:#d7b45a;--pg2:#8f7130;--ink:#e8ddc4;--mut:#9a8969;width:min(1180px,100%);height:min(860px,94vh);background:radial-gradient(circle at 50% 0,#211708 0,#0d0905 45%,#080604 100%);border:1px solid #6b5225;border-radius:14px;box-shadow:0 28px 100px #000,0 0 0 1px #d7b45a18 inset;display:flex;flex-direction:column;overflow:hidden;color:var(--ink)}' +
      '.zgp-head{padding:15px 18px;border-bottom:1px solid #33240f;display:flex;align-items:center;gap:14px;background:#0b0805dd}.zgp-title{font:700 17px Cinzel,serif;color:#f1dda3;letter-spacing:1px}.zgp-sub{font:11px Lora,serif;color:#796b51;margin-top:2px}.zgp-close{margin-left:auto;width:34px;height:34px;border:1px solid #3b2a12;border-radius:8px;background:transparent;color:#88775b;font-size:20px;cursor:pointer}' +
      '.zgp-body{display:grid;grid-template-columns:245px 1fr;min-height:0;flex:1}.zgp-side{border-right:1px solid #2b1e0c;padding:16px;overflow:auto;background:#090704aa}.zgp-main{min-width:0;overflow:auto;padding:16px 18px}.zgp-hero{padding:13px;border:1px solid #35250f;border-radius:10px;background:#100c07;margin-bottom:12px}.zgp-name{font:700 14px Cinzel,serif;color:#f0dfaf}.zgp-meta{font:10px Cinzel,serif;color:#88785d;margin-top:5px}.zgp-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.zgp-kpi{padding:9px 5px;text-align:center;border:1px solid #2c2112;border-radius:7px;background:#0c0906}.zgp-kpi b{display:block;color:#e3c36f;font:700 17px Cinzel,serif}.zgp-kpi span{font:8px Cinzel,serif;color:#74664f;letter-spacing:.7px}' +
      '.zgp-statline{display:flex;align-items:center;gap:7px;padding:7px 2px;border-bottom:1px solid #1e160b;font:11px Cinzel,serif;color:#98886c}.zgp-statline strong{margin-left:auto;color:#d9c59b}.zgp-arrow{color:#5f513c;margin:0 3px}.zgp-future{color:#71b77a!important}.zgp-money{margin-top:12px;padding:10px;border:1px solid #4a3718;border-radius:8px;background:#151006;font:10px Cinzel,serif;color:#a89569;line-height:1.6}' +
      '.zgp-road-wrap{overflow-x:auto;padding:4px 2px 18px;scrollbar-width:none}.zgp-road{display:flex;align-items:flex-start;min-width:920px;position:relative;padding-top:22px}.zgp-road:before{content:\"\";position:absolute;left:35px;right:35px;top:52px;height:2px;background:linear-gradient(90deg,#5d4822,#c8a54e,#3b2b13)}.zgp-node-wrap{width:9.09%;position:relative;text-align:center;z-index:1}.zgp-node-label{font:700 11px Cinzel,serif;color:#8f7b54;margin-bottom:8px}.zgp-node{width:52px;height:52px;border:1px solid #3c2d16;border-radius:11px;background:#0c0906;color:#66583f;font-size:18px;cursor:pointer;box-shadow:0 0 0 5px #0b0805;margin:auto;transition:.16s}.zgp-node:hover{border-color:#8f7130;color:#c9a956}.zgp-node.current{border:2px solid #d7b45a;color:#efd477;box-shadow:0 0 0 5px #0b0805,0 0 22px #c9993b42}.zgp-node.selected{border-color:#8fb9d4;color:#b9d9ea;background:#101923}.zgp-node.past{color:#6a604f;background:#11100d}.zgp-node.has-plan:after{content:\"\";display:block;width:6px;height:6px;border-radius:50%;background:#d7b45a;margin:7px auto 0;box-shadow:0 0 8px #d7b45a}.zgp-node.abs{border-radius:50%;color:#e8c060}' +
      '.zgp-level-title{display:flex;align-items:center;gap:10px;margin-bottom:11px}.zgp-level-title h3{margin:0;font:700 15px Cinzel,serif;color:#e7cf91}.zgp-budget{font:10px Cinzel,serif;color:#8c7a5c;border:1px solid #3c2b12;border-radius:12px;padding:4px 9px}.zgp-tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}.zgp-tab{padding:7px 12px;border:1px solid #33240f;border-radius:7px;background:#0c0906;color:#88785d;font:10px Cinzel,serif;cursor:pointer}.zgp-tab.on{border-color:#a58236;color:#e1c269;background:#a5823612}' +
      '.zgp-panel{border:1px solid #2e2110;border-radius:10px;background:#0c0906;padding:13px}.zgp-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.zgp-stat-card{display:grid;grid-template-columns:30px 1fr 28px 28px;align-items:center;gap:5px;padding:10px;border:1px solid #2b2113;border-radius:8px;background:#100d08}.zgp-stat-card .ico{font-size:20px}.zgp-stat-card b{font:11px Cinzel,serif;color:#cdbd98}.zgp-stat-card small{display:block;color:#665b48;font-size:9px;margin-top:2px}.zgp-mini{width:28px;height:28px;border:1px solid #4b3717;border-radius:6px;background:#171006;color:#d6b65c;cursor:pointer;font-size:15px}.zgp-mini:disabled{opacity:.28;cursor:not-allowed}' +
      '.zgp-search{width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #382912;border-radius:7px;background:#080604;color:#d7c8aa;font:12px Lora,serif;margin-bottom:9px}.zgp-filter{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}.zgp-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:335px;overflow:auto;padding-right:3px}.zgp-choice{display:flex;align-items:center;gap:8px;text-align:left;padding:9px;border:1px solid #2a2012;border-radius:8px;background:#100c07;color:#b8a98b;cursor:pointer;min-width:0}.zgp-choice:hover{border-color:#5a4320}.zgp-choice.picked{border-color:#a98436;background:#a9843612}.zgp-choice.bad{opacity:.56}.zgp-choice .art{width:38px;height:38px;border:1px solid #302410;border-radius:7px;background:#080604;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;font-size:18px}.zgp-choice .art img{width:100%;height:100%;object-fit:cover}.zgp-choice .txt{min-width:0;flex:1}.zgp-choice .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:10.5px Cinzel,serif;color:#d6c6a7}.zgp-choice .why{font:9px Lora,serif;color:#746750;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.zgp-choice .ok{color:#70b47a}.zgp-choice .no{color:#bd6a64}' +
      '.zgp-notes textarea{width:100%;min-height:120px;box-sizing:border-box;padding:11px;border:1px solid #382912;border-radius:8px;background:#080604;color:#d7c8aa;font:12px Lora,serif;resize:vertical}.zgp-note-actions{display:flex;gap:7px;margin-top:8px}.zgp-note-chip{display:flex;gap:7px;align-items:flex-start;padding:8px 10px;border:1px solid #302413;border-radius:7px;background:#100c07;margin-top:6px;color:#a99a7e;font:11px Lora,serif}.zgp-note-chip button{margin-left:auto;background:none;border:0;color:#765d42;cursor:pointer}' +
      '.zgp-foot{border-top:1px solid #33240f;padding:11px 16px;display:flex;align-items:center;gap:10px;background:#0a0705}.zgp-foot-note{font:10px Lora,serif;color:#76684f;line-height:1.4;flex:1}.zgp-apply{padding:10px 17px;border:1px solid #b28d3d;border-radius:8px;background:#b28d3d18;color:#e6c66d;font:700 11px Cinzel,serif;cursor:pointer}.zgp-apply:disabled{opacity:.32;cursor:not-allowed}.zgp-apply.arm{border-color:#70b47a;color:#8bd394;background:#70b47a18}.zgp-empty{text-align:center;padding:28px;color:#6d604a;font:italic 12px Lora,serif}' +
      '@media(max-width:800px){#zg-progression-overlay{padding:0;align-items:stretch}#zg-progression{height:100%;max-height:none;border-radius:0;border-left:0;border-right:0}.zgp-body{display:block;overflow:auto}.zgp-side{border:0;border-bottom:1px solid #2b1e0c}.zgp-main{overflow:visible}.zgp-stat-grid{grid-template-columns:repeat(2,1fr)}.zgp-list{grid-template-columns:1fr;max-height:none}.zgp-foot{position:sticky;bottom:0}.zgp-sub{display:none}}' +
      '@media(max-width:480px){.zgp-head{padding:11px 12px}.zgp-main,.zgp-side{padding:12px}.zgp-stat-grid{grid-template-columns:1fr}.zgp-tabs{display:grid;grid-template-columns:repeat(2,1fr)}.zgp-tab{padding:9px 5px}.zgp-foot{align-items:stretch;flex-direction:column}.zgp-apply{width:100%;min-height:44px}}';
    document.head.appendChild(style);
  }

  function roadmapHtml(character) {
    var current = Number(character.level) || 1;
    var plan = ensurePlan(character);
    var html = '<div class="zgp-road-wrap"><div class="zgp-road">';
    for (var level = 1; level <= 11; level += 1) {
      var entry = levelEntry(character, level, false);
      var hasPlan = entryPointCount(entry) || entry.spellIds.length || entry.items.length || entry.notes.length;
      var classes = [];
      if (level < current) classes.push('past');
      if (level === current) classes.push('current');
      if (level === ui.level) classes.push('selected');
      if (hasPlan) classes.push('has-plan');
      if (level === 11) classes.push('abs');
      html += '<div class="zgp-node-wrap"><div class="zgp-node-label">' +
        (level === 11 ? 'АБСОЛЮТ' : level) +
        '</div><button class="zgp-node ' + classes.join(' ') + '" onclick="zgProgressionSelectLevel(' + level + ')">' +
        (level < current ? '✓' : (level === current ? '◆' : (level === 11 ? '∞' : '+'))) +
        '</button></div>';
    }
    return html + '</div></div>';
  }

  function sideHtml(character) {
    var target = Math.max(Number(character.level) || 1, ui.level);
    var stats = projectedStats(character, target);
    var currentCoins = coinsToCopper(character);
    var remaining = currentCoins - plannedCost(character, target);
    return '<div class="zgp-hero"><div class="zgp-name">' + esc(character.name || 'Персонаж') + '</div>' +
      '<div class="zgp-meta">' + esc(character.race || 'Раса не указана') + ' · ур. ' + (character.level || 1) + '</div></div>' +
      '<div class="zgp-summary">' +
        '<div class="zgp-kpi"><b>' + projectedHp(character, target) + '</b><span>HP</span></div>' +
        '<div class="zgp-kpi"><b>' + projectedAc(character, target) + '</b><span>AC</span></div>' +
        '<div class="zgp-kpi"><b>' + projectedSpeed(character, target) + '</b><span>СКОР.</span></div>' +
      '</div><div style="margin-top:12px">' +
      STAT_ORDER.map(function(key) {
        var now = currentBaseStat(character, key);
        var future = stats[key];
        return '<div class="zgp-statline"><span>' + STAT_ICONS[key] + '</span><span>' + STAT_LABELS[key] + '</span>' +
          '<strong>' + now + (future !== now ? '<span class="zgp-arrow">→</span><span class="zgp-future">' + future + '</span>' : '') + '</strong></div>';
      }).join('') + '</div>' +
      '<div class="zgp-money">🪙 Сейчас: <b>' + priceText(copperAsPrice(currentCoins)) + '</b><br>' +
      'После плана: <b style="color:' + (remaining < 0 ? '#c86c66' : '#7dbb83') + '">' +
      (remaining < 0 ? 'не хватает ' + priceText(copperAsPrice(-remaining)) : priceText(copperAsPrice(remaining))) +
      '</b></div>';
  }

  function copperAsPrice(total) {
    total = Math.max(0, Math.floor(total));
    var price = {
      pl: Math.floor(total / 1000), zl:0, sr:0, md:0
    };
    total %= 1000;
    price.zl = Math.floor(total / 100);
    total %= 100;
    price.sr = Math.floor(total / 10);
    price.md = total % 10;
    return price;
  }

  function statsPanelHtml(character, entry, editable) {
    var used = entryPointCount(entry);
    var allowance = levelAllowance(character, ui.level);
    var projected = projectedStats(character, ui.level);
    return '<div class="zgp-panel"><div class="zgp-stat-grid">' +
      STAT_ORDER.map(function(key) {
        var amount = Number(entry.stats[key]) || 0;
        return '<div class="zgp-stat-card"><span class="ico">' + STAT_ICONS[key] + '</span>' +
          '<span><b>' + STAT_LABELS[key] + '</b><small>' + projected[key] + ' итог · +' + amount + ' на уровне</small></span>' +
          '<button class="zgp-mini" ' + (!editable || amount <= 0 ? 'disabled' : '') + ' onclick="zgProgressionStat(\'' + key + '\',-1)">−</button>' +
          '<button class="zgp-mini" ' + (!editable || used >= allowance ? 'disabled' : '') + ' onclick="zgProgressionStat(\'' + key + '\',1)">+</button></div>';
      }).join('') +
      '</div><div style="margin-top:10px;font:10px Lora,serif;color:#70634d">Каждое очко Выносливости добавляет 2 HP. Каждые 3 очка Ловкости добавляют 1 AC. Расовые бонусы 3/6/9 начисляются отдельно.</div></div>';
  }

  function spellPanelHtml(character, entry, editable) {
    var query = ui.search.toLowerCase();
    var list = catalogEntries().filter(function(spell) {
      var matchesSearch = !query || String(spell.name || '').toLowerCase().indexOf(query) >= 0;
      var matchesType = ui.spellType === 'all' || spell.spellType === ui.spellType;
      return matchesSearch && matchesType;
    }).sort(function(a, b) {
      return spellLevel(a) - spellLevel(b) || String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    var filters = '<div class="zgp-filter"><button class="zgp-tab ' + (ui.spellType === 'all' ? 'on' : '') + '" onclick="zgProgressionSpellType(\'all\')">Все</button>' +
      Object.keys(SPELL_TYPES).map(function(key) {
        var type = SPELL_TYPES[key];
        return '<button class="zgp-tab ' + (ui.spellType === key ? 'on' : '') + '" onclick="zgProgressionSpellType(\'' + key + '\')">' + type.icon + ' ' + type.label + '</button>';
      }).join('') + '</div>';
    var choices = list.slice(0, 120).map(function(spell) {
      var type = SPELL_TYPES[spell.spellType] || { icon:'📜', color:'#9a7b3e' };
      var picked = entry.spellIds.some(function(id) { return sameId(id, spell.id); });
      var compatibility = spellCompatibility(character, spell, ui.level);
      var canToggle = editable && (picked || compatibility.ok);
      return '<button class="zgp-choice ' + (picked ? 'picked' : '') + (!canToggle && !picked ? ' bad' : '') + '" ' +
        (!canToggle ? 'disabled' : '') + ' onclick="zgProgressionToggleSpell(\'' + esc(spell.id) + '\')">' +
        '<span class="art">' + type.icon + '</span><span class="txt"><span class="nm">' + esc(spell.name || 'Без имени') + '</span>' +
        '<span class="why ' + ((compatibility.ok || picked) ? 'ok' : 'no') + '">ур. ' + spellLevel(spell) + ' · ' +
        (picked ? 'добавлено в план' : compatibility.reason) + '</span></span><span>' + (picked ? '✓' : '+') + '</span></button>';
    }).join('');
    return '<div class="zgp-panel"><input class="zgp-search" value="' + esc(ui.search) + '" placeholder="Поиск по Каталогу..." oninput="zgProgressionSearch(this.value)">' +
      filters + '<div class="zgp-list">' + (choices || '<div class="zgp-empty">В Каталоге ничего не найдено</div>') + '</div>' +
      '<div style="margin-top:9px;font:9px Lora,serif;color:#6c604c">Проверяются уровень, характеристики и лимит 3 записи каждого типа. Классовые ограничения будут добавлены позже.</div></div>';
  }

  function itemPanelHtml(entry, editable) {
    var query = ui.search.toLowerCase();
    var list = shopItems().filter(function(item) {
      return !query || String(item.name || '').toLowerCase().indexOf(query) >= 0;
    });
    var choices = list.map(function(item) {
      var picked = entry.items.some(function(saved) { return sameId(saved.id, item.id); });
      var art = item.image
        ? '<img src="' + esc(item.image) + '" alt="">'
        : esc(item.icon || '📦');
      return '<button class="zgp-choice ' + (picked ? 'picked' : '') + '" ' + (!editable ? 'disabled' : '') +
        ' onclick="zgProgressionToggleItem(\'' + esc(item.id) + '\')"><span class="art">' + art + '</span>' +
        '<span class="txt"><span class="nm">' + esc(item.name || 'Без имени') + '</span>' +
        '<span class="why">' + esc(priceText(item.price)) + ' · ' + esc(item.effect || item.desc || 'товар') + '</span></span>' +
        '<span>' + (picked ? '✓' : '+') + '</span></button>';
    }).join('');
    return '<div class="zgp-panel"><input class="zgp-search" value="' + esc(ui.search) + '" placeholder="Поиск по Товарам..." oninput="zgProgressionSearch(this.value)">' +
      '<div class="zgp-list">' + (choices || '<div class="zgp-empty">В разделе «Товары» пока пусто</div>') + '</div>' +
      '<div style="margin-top:9px;font:9px Lora,serif;color:#6c604c">Цена фиксируется в плане. При переходе уровня деньги будут проверены и списаны, а предмет появится в инвентаре.</div></div>';
  }

  function notesPanelHtml(entry, editable) {
    return '<div class="zgp-panel zgp-notes">' +
      (editable ? '<textarea id="zgp-note-input" placeholder="Например: найти наставника или пройти испытание..."></textarea>' +
        '<div class="zgp-note-actions"><button class="zgp-tab on" onclick="zgProgressionAddNote()">＋ Добавить заметку</button></div>' : '') +
      entry.notes.map(function(note, index) {
        return '<div class="zgp-note-chip"><span>🪶</span><span>' + esc(note) + '</span>' +
          (editable ? '<button onclick="zgProgressionRemoveNote(' + index + ')">✕</button>' : '') + '</div>';
      }).join('') +
      (!editable && !entry.notes.length ? '<div class="zgp-empty">На этом уровне заметок нет</div>' : '') +
      '</div>';
  }

  function selectedPanelHtml(character) {
    var current = Number(character.level) || 1;
    var entry = levelEntry(character, ui.level, true);
    var editable = ui.level > current && !entry.appliedAt;
    var used = entryPointCount(entry);
    var allowance = levelAllowance(character, ui.level);
    var panel;
    if (!editable && ui.level <= current) {
      panel = '<div class="zgp-panel"><div class="zgp-empty">Уровень уже зафиксирован в листе героя. Для нового плана выбери следующий уровень.</div></div>';
    } else if (ui.tab === 'stats') panel = statsPanelHtml(character, entry, editable);
    else if (ui.tab === 'spells') panel = spellPanelHtml(character, entry, editable);
    else if (ui.tab === 'items') panel = itemPanelHtml(entry, editable);
    else panel = notesPanelHtml(entry, editable);
    return '<div class="zgp-level-title"><h3>' + (ui.level === 11 ? 'Абсолют' : 'План на уровень ' + ui.level) + '</h3>' +
      '<span class="zgp-budget">Очки: ' + used + ' / ' + allowance + '</span></div>' +
      '<div class="zgp-tabs">' +
        '<button class="zgp-tab ' + (ui.tab === 'stats' ? 'on' : '') + '" onclick="zgProgressionTab(\'stats\')">💪 Характеристики</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'spells' ? 'on' : '') + '" onclick="zgProgressionTab(\'spells\')">📚 Каталог</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'items' ? 'on' : '') + '" onclick="zgProgressionTab(\'items\')">🎒 Товары</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'notes' ? 'on' : '') + '" onclick="zgProgressionTab(\'notes\')">🪶 Заметки</button>' +
      '</div>' + panel;
  }

  function footerHtml(character) {
    var current = Number(character.level) || 1;
    var next = current + 1;
    var canApply = current < 11 && ui.level === next;
    var armed = Date.now() < ui.confirmUntil;
    var entry = levelEntry(character, next, false);
    var pieces = [];
    if (entryPointCount(entry)) pieces.push(entryPointCount(entry) + ' очк. характеристик');
    if (entry.spellIds.length) pieces.push(entry.spellIds.length + ' навыка');
    if (entry.items.length) pieces.push(entry.items.length + ' предмета');
    return '<div class="zgp-foot-note">' +
      (current >= 11 ? 'Герой достиг Абсолюта.' :
        (canApply ? 'Будет применено: ' + (pieces.join(', ') || 'только базовый прирост уровня') + '.'
          : 'Для применения выбери ближайший уровень ' + next + '.')) +
      '</div><button class="zgp-apply ' + (armed ? 'arm' : '') + '" ' + (!canApply ? 'disabled' : '') +
      ' onclick="zgProgressionApply()">' +
      (armed ? '✓ Подтвердить переход' : (current >= 11 ? 'Абсолют достигнут' : 'Перейти на уровень ' + next)) +
      '</button>';
  }

  function render() {
    var overlay = document.getElementById('zg-progression-overlay');
    var character = getCharacter(ui.charId);
    if (!overlay || !character) return;
    var plan = ensurePlan(character);
    plan.selectedLevel = ui.level;
    overlay.innerHTML = '<div id="zg-progression" role="dialog" aria-modal="true" aria-label="Планировщик прокачки">' +
      '<div class="zgp-head"><div><div class="zgp-title">✦ Путь героя</div><div class="zgp-sub">Планирование не меняет боевой лист до подтверждения уровня</div></div>' +
      '<button class="zgp-close" onclick="closeProgressionPlanner()" aria-label="Закрыть">×</button></div>' +
      '<div class="zgp-body"><aside class="zgp-side">' + sideHtml(character) + '</aside>' +
      '<main class="zgp-main">' + roadmapHtml(character) + selectedPanelHtml(character) + '</main></div>' +
      '<footer class="zgp-foot">' + footerHtml(character) + '</footer></div>';
  }

  function open(charId) {
    var character = getCharacter(charId);
    if (!character) return;
    installStyles();
    var plan = ensurePlan(character);
    ui.charId = character.id;
    ui.level = Math.max(Number(character.level) || 1, Math.min(11, Number(plan.selectedLevel) || ((Number(character.level) || 1) + 1)));
    if (ui.level <= Number(character.level) && Number(character.level) < 11) ui.level = Number(character.level) + 1;
    ui.tab = 'stats';
    ui.search = '';
    ui.spellType = 'all';
    ui.confirmUntil = 0;
    var old = document.getElementById('zg-progression-overlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'zg-progression-overlay';
    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) close();
    });
    document.body.appendChild(overlay);
    render();
  }

  function close() {
    var overlay = document.getElementById('zg-progression-overlay');
    if (overlay) overlay.remove();
    ui.confirmUntil = 0;
  }

  function mutateEntry(mutator) {
    var character = getCharacter(ui.charId);
    if (!character || ui.level <= Number(character.level)) return;
    var entry = levelEntry(character, ui.level, true);
    if (entry.appliedAt) return;
    mutator(entry, character);
    ensurePlan(character).selectedLevel = ui.level;
    savePlan(character);
    ui.confirmUntil = 0;
    render();
  }

  function toggleSpell(id) {
    mutateEntry(function(entry, character) {
      var index = entry.spellIds.findIndex(function(existing) { return sameId(existing, id); });
      if (index >= 0) {
        entry.spellIds.splice(index, 1);
        return;
      }
      var spell = catalogEntries().find(function(item) { return sameId(item.id, id); });
      if (!spell) return;
      var compatibility = spellCompatibility(character, spell, ui.level);
      if (!compatibility.ok) {
        toast('⛔ ' + compatibility.reason);
        return;
      }
      entry.spellIds.push(spell.id);
    });
  }

  function toggleItem(id) {
    mutateEntry(function(entry) {
      var index = entry.items.findIndex(function(item) { return sameId(item.id, id); });
      if (index >= 0) {
        entry.items.splice(index, 1);
        return;
      }
      var source = shopItems().find(function(item) { return sameId(item.id, id); });
      if (!source) return;
      entry.items.push({
        id: source.id,
        name: source.name || 'Предмет',
        icon: source.icon || '📦',
        image: source.image || '',
        cat: source.cat || '',
        rarity: source.rarity || '',
        price: {
          pl:Number(source.price && source.price.pl) || 0,
          zl:Number(source.price && source.price.zl) || 0,
          sr:Number(source.price && source.price.sr) || 0,
          md:Number(source.price && source.price.md) || 0
        },
        desc: source.desc || '',
        effect: source.effect || '',
        damage: source.damage || '',
        damageType: source.damageType || '',
        range: source.range || '',
        defense: source.defense == null ? '' : source.defense
      });
    });
  }

  function syncArena(character, previousHpMax) {
    var arena = global.ZargotaArena;
    if (!arena || typeof arena.listBattles !== 'function' || typeof arena.createCharacterSnapshot !== 'function') return;
    var snapshot = arena.createCharacterSnapshot(character, {});
    arena.listBattles().forEach(function(battle) {
      (battle.combatants || []).forEach(function(combatant) {
        if (!combatant.sourceRef || combatant.sourceRef.type !== 'character' || !sameId(combatant.sourceRef.id, character.id)) return;
        var oldMax = Number(combatant.resources && combatant.resources.hpMax) || Number(previousHpMax) || snapshot.resources.hpMax;
        var oldCurrent = Number(combatant.resources && combatant.resources.hpCurrent) || 0;
        var maxGain = Math.max(0, snapshot.resources.hpMax - oldMax);
        arena.updateCombatant(battle.id, combatant.id, {
          level: snapshot.level,
          initiativeBonus: snapshot.initiativeBonus,
          speedCells: snapshot.speedCells,
          stats: snapshot.stats,
          defenses: snapshot.defenses,
          resources: {
            hpMax: snapshot.resources.hpMax,
            hpCurrent: Math.min(snapshot.resources.hpMax, oldCurrent + maxGain)
          },
          equipSlots: snapshot.equipSlots,
          actions: snapshot.actions,
          notes: snapshot.notes
        });
      });
    });
  }

  function validateApply(character, level, entry) {
    var allowance = levelAllowance(character, level);
    if (entryPointCount(entry) > allowance) return 'Слишком много очков характеристик для уровня.';
    for (var i = 0; i < entry.spellIds.length; i += 1) {
      var spell = catalogEntries().find(function(item) { return sameId(item.id, entry.spellIds[i]); });
      if (!spell) return 'Один из навыков больше не найден в Каталоге.';
      var compatibility = spellCompatibility(character, spell, level);
      if (!compatibility.ok && !compatibility.already) return spell.name + ': ' + compatibility.reason + '.';
    }
    var cost = entry.items.reduce(function(total, item) { return total + priceToCopper(item.price); }, 0);
    if (coinsToCopper(character) < cost) return 'Недостаточно монет для предметов этого уровня.';
    return '';
  }

  function applyNext() {
    var character = getCharacter(ui.charId);
    if (!character) return;
    var next = (Number(character.level) || 1) + 1;
    if (next > 11 || ui.level !== next) return;
    var entry = levelEntry(character, next, true);
    var error = validateApply(character, next, entry);
    if (error) {
      toast('⛔ ' + error);
      return;
    }
    if (Date.now() >= ui.confirmUntil) {
      ui.confirmUntil = Date.now() + 3500;
      render();
      return;
    }
    ui.confirmUntil = 0;
    var previousHpMax = Number(character.hpMax) || Number(character.baseHpMax) || 10;
    var result = typeof global.levelUpCharacter === 'function'
      ? global.levelUpCharacter(character.id, { deferSave:true, silent:true, reason:'progression-apply' })
      : null;
    if (!result || !result.history) {
      toast('⛔ Не удалось повысить уровень');
      return;
    }
    var spent = entryPointCount(entry);
    STAT_ORDER.forEach(function(key) {
      var amount = Number(entry.stats[key]) || 0;
      if (!amount) return;
      character.stats[key].base = (Number(character.stats[key].base) || 0) + amount;
    });
    character.unspentStatPoints = Math.max(0, (Number(character.unspentStatPoints) || 0) - spent);
    var conGain = Number(entry.stats.con) || 0;
    if (result.history.racial && result.history.racial.stat === 'con') conGain += 1;
    var hpFromCon = conGain * 2;
    if (hpFromCon) {
      character.baseHpMax = (Number(character.baseHpMax) || 10) + hpFromCon;
      character.hpCur = (Number(character.hpCur) || 0) + hpFromCon;
    }
    character.spellRefs = Array.isArray(character.spellRefs) ? character.spellRefs : [];
    character.spellsLearned = character.spellsLearned && typeof character.spellsLearned === 'object' ? character.spellsLearned : {};
    var addedSpellIds = [];
    entry.spellIds.forEach(function(id) {
      if (!character.spellRefs.some(function(existing) { return sameId(existing, id); })) {
        character.spellRefs.push(id);
        character.spellsLearned[id] = false;
        addedSpellIds.push(id);
      }
    });
    character.inventoryItems = Array.isArray(character.inventoryItems) ? character.inventoryItems : [];
    var appliedItemIds = [];
    entry.items.forEach(function(item) {
      var progressionItemId = 'progression-' + next + '-' + String(item.id);
      if (character.inventoryItems.some(function(existing) { return existing && existing.progressionItemId === progressionItemId; })) return;
      character.inventoryItems.push({
        itemId: progressionItemId,
        progressionItemId: progressionItemId,
        shopItemId: item.id,
        name: item.name,
        icon: item.icon || '📦',
        image: item.image || '',
        qty: 1,
        description: item.desc || item.effect || '',
        type: item.cat || '',
        category: item.cat || '',
        rarity: item.rarity || '',
        effect: item.effect || '',
        damage: item.damage || '',
        damageType: item.damageType || '',
        range: item.range || '',
        defense: item.defense,
        acquiredAtLevel: next,
        equipped: false
      });
      appliedItemIds.push(progressionItemId);
    });
    var itemCost = entry.items.reduce(function(total, item) { return total + priceToCopper(item.price); }, 0);
    writeCopper(character, coinsToCopper(character) - itemCost);
    result.history.progression = {
      stats: Object.assign({}, entry.stats),
      hpFromCon: hpFromCon,
      addedSpellIds: addedSpellIds,
      appliedItemIds: appliedItemIds,
      itemCostCopper: itemCost
    };
    entry.appliedAt = Date.now();
    var plan = ensurePlan(character);
    plan.baselineLevel = next;
    plan.selectedLevel = Math.min(11, next + 1);
    if (typeof global.applyCharacterEquipmentBonuses === 'function') global.applyCharacterEquipmentBonuses(character);
    if (character.hpCur > character.hpMax) character.hpCur = character.hpMax;
    syncArena(character, previousHpMax);
    if (typeof global.saveChars === 'function') global.saveChars({ reason:'progression-apply' });
    if (typeof global.renderCharSheet === 'function') global.renderCharSheet();
    ui.level = Math.min(11, next + 1);
    toast('✦ Уровень ' + next + ' применён к герою и Арене');
    render();
  }

  global.openProgressionPlanner = open;
  global.closeProgressionPlanner = close;
  global.zgProgressionSelectLevel = function(level) {
    ui.level = Math.max(1, Math.min(11, Number(level) || 1));
    ui.search = '';
    ui.confirmUntil = 0;
    var character = getCharacter(ui.charId);
    if (character) {
      ensurePlan(character).selectedLevel = ui.level;
      savePlan(character);
    }
    render();
  };
  global.zgProgressionTab = function(tab) {
    ui.tab = tab || 'stats';
    ui.search = '';
    render();
  };
  global.zgProgressionSearch = function(value) {
    ui.search = String(value || '');
    var input = document.querySelector('#zg-progression .zgp-search');
    var position = input ? input.selectionStart : ui.search.length;
    render();
    var nextInput = document.querySelector('#zg-progression .zgp-search');
    if (nextInput) {
      nextInput.focus();
      try { nextInput.setSelectionRange(position, position); } catch (error) {}
    }
  };
  global.zgProgressionSpellType = function(type) {
    ui.spellType = type || 'all';
    render();
  };
  global.zgProgressionStat = function(key, delta) {
    mutateEntry(function(entry, character) {
      var used = entryPointCount(entry);
      var allowance = levelAllowance(character, ui.level);
      if (delta > 0 && used >= allowance) return;
      entry.stats[key] = Math.max(0, (Number(entry.stats[key]) || 0) + Number(delta || 0));
    });
  };
  global.zgProgressionToggleSpell = toggleSpell;
  global.zgProgressionToggleItem = toggleItem;
  global.zgProgressionAddNote = function() {
    var input = document.getElementById('zgp-note-input');
    var value = input && input.value.trim();
    if (!value) return;
    mutateEntry(function(entry) { entry.notes.push(value); });
  };
  global.zgProgressionRemoveNote = function(index) {
    mutateEntry(function(entry) { entry.notes.splice(Number(index) || 0, 1); });
  };
  global.zgProgressionApply = applyNext;

  global.ZargotaProgression = {
    ensurePlan: ensurePlan,
    levelEntry: levelEntry,
    levelAllowance: levelAllowance,
    projectedStats: projectedStats,
    extractRequirements: extractRequirements,
    spellCompatibility: spellCompatibility,
    priceToCopper: priceToCopper,
    coinsToCopper: coinsToCopper,
    validateApply: validateApply,
    syncArena: syncArena
  };
})(window);
