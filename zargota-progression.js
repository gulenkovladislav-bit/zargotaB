window.__zgpScriptStarted = true;
(function(global) {
  'use strict';

  var PLAN_VERSION = 1;
  var ui = {
    charId: null,
    level: 2,
    mode: 'roadmap',
    builderRace: 'Человек',
    builderLevel: 1,
    builderStats: { str:0, dex:0, int:0, cha:0, per:0, con:0 },
    weaponItems: [],
    tab: 'stats',
    menu: null,
    search: '',
    spellType: 'all',
    confirmUntil: 0
  };

  var STAT_ORDER = ['str', 'dex', 'int', 'cha', 'per', 'con'];
  var STAT_LABELS = {
    str: 'Сила', dex: 'Ловкость', int: 'Интеллект',
    cha: 'Харизма', per: 'Восприятие', con: 'Выносливость'
  };
  function statIcon(key) {
    return typeof global.zgStatIcon === 'function' ? global.zgStatIcon(key) : '◆';
  }
  var STAT_ICONS = {
    str: statIcon('str'), dex: statIcon('dex'), int: statIcon('int'),
    cha: statIcon('cha'), per: statIcon('per'), con: statIcon('con')
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

  function coinIcon(key, size) {
    return typeof global.zgCoinIconHtml === 'function' ? global.zgCoinIconHtml(key, size || 16) : '';
  }

  function coinStack(size) {
    return typeof global.zgCoinStackHtml === 'function' ? global.zgCoinStackHtml(size || 16) : '';
  }

  function priceHtml(price) {
    price = price || {};
    var parts = [];
    [['pl','пл'],['zl','зл'],['sr','ср'],['md','мд']].forEach(function(entry) {
      if (!price[entry[0]]) return;
      if (typeof global.zgCoinAmountHtml === 'function') parts.push(global.zgCoinAmountHtml(entry[0], price[entry[0]]));
      else parts.push(esc(price[entry[0]] + ' ' + entry[1]));
    });
    return parts.join(' ') || 'бесплатно';
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
      gold: Array.isArray(raw.gold) ? raw.gold.map(function(entry) {
        return { amount:Number(entry && entry.amount) || 0, note:String(entry && entry.note || '') };
      }).filter(function(entry) { return entry.amount; }) : [],
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

  function racialAtLevel(race, level) {
    if (!race) return null;
    if (race.racialByLevel && race.racialByLevel[level]) return race.racialByLevel[level];
    if ((level === 3 || level === 6 || level === 9) && race.racialAt369) return race.racialAt369;
    return null;
  }

  function levelAllowance(character, level) {
    if (level <= 1) return 4;
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    var racial = racialAtLevel(race, level);
    return 2 + (racial && racial.kind === 'free' ? 1 : 0);
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
      var racial = racialAtLevel(race, level);
      if (racial) {
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
    for (var level = current + 1; level <= targetLevel; level += 1) {
      var racial = racialAtLevel(race, level);
      if (racial && racial.kind === 'stat+speed') speed += Number(racial.speed) || 0;
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

  function projectedInitiative(character, targetLevel) {
    var initiative = Number(character.initiative) || 0;
    var nowPer = currentBaseStat(character, 'per');
    var futureStats = projectedStats(character, targetLevel);
    return initiative + Math.floor(futureStats.per / 2) - Math.floor(nowPer / 2);
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

  function spellTypeLimit(character, spellType, targetLevel) {
    var race = typeof global.getRaceData === 'function' ? global.getRaceData(character) : null;
    var every = Number(race && race.spellSlotsEveryLevels) || 0;
    var racialBonus = every > 0 ? Math.floor(Math.max(1, Number(targetLevel) || 1) / every) : 0;
    return 3 + racialBonus;
  }

  function spellTypeCounts(character, targetLevel) {
    var counts = { kodex:0, folio:0, obrad:0 };
    var ids = (character.spellRefs || []).slice().concat(plannedSpellIdsUpTo(character, targetLevel));
    var seen = {};
    ids.forEach(function(id) {
      var key = String(id);
      if (seen[key]) return;
      seen[key] = true;
      var spell = catalogEntries().find(function(item) { return sameId(item.id, id); });
      if (spell && counts[spell.spellType] != null) counts[spell.spellType] += 1;
    });
    return counts;
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
    var counts = spellTypeCounts(character, targetLevel);
    var alreadyPlanned = plannedSpellIdsUpTo(character, targetLevel).some(function(id) { return sameId(id, spell.id); });
    var typeCount = (counts[spell.spellType] || 0) + (!already && !alreadyPlanned ? 1 : 0);
    var limit = spellTypeLimit(character, spell.spellType, targetLevel);
    var limitOk = typeCount <= limit;
    var missing = req.stats.filter(function(item) { return stats[item.key] < item.min; });
    var reason = '';
    if (already) reason = 'Уже привязано к герою';
    else if (!levelOk) reason = 'Нужен уровень ' + spellLevel(spell);
    else if (!statsOk) {
      reason = 'Нужно: ' + missing.map(function(item) {
        return STAT_LABELS[item.key] + ' ' + item.min + '+';
      }).join(req.mode === 'any' ? ' или ' : ', ');
    } else if (!limitOk) reason = 'Нет свободного слота: ' + (SPELL_TYPES[spell.spellType] ? SPELL_TYPES[spell.spellType].label : 'тип') +
      ' ' + (typeCount - 1) + '/' + limit;
    else reason = 'Совместимо';
    return {
      ok: !already && levelOk && statsOk && limitOk,
      already: already,
      reason: reason,
      requirements: req,
      limitOk: limitOk,
      limit: limit,
      typeCount: typeCount
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

  function plannedGold(character, targetLevel) {
    var current = Number(character.level) || 1;
    var total = 0;
    for (var level = current + 1; level <= targetLevel; level += 1) {
      levelEntry(character, level, false).gold.forEach(function(entry) {
        total += (Number(entry.amount) || 0) * 100;
      });
    }
    return total;
  }

  function plannedItemsUpTo(character, targetLevel) {
    var current = Number(character.level) || 1;
    var result = [];
    for (var level = current + 1; level <= targetLevel; level += 1) {
      levelEntry(character, level, false).items.forEach(function(item) { result.push(item); });
    }
    return result;
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
      '@media(max-width:480px){.zgp-head{padding:11px 12px}.zgp-main,.zgp-side{padding:12px}.zgp-stat-grid{grid-template-columns:1fr}.zgp-tabs{display:grid;grid-template-columns:repeat(2,1fr)}.zgp-tab{padding:9px 5px}.zgp-foot{align-items:stretch;flex-direction:column}.zgp-apply{width:100%;min-height:44px}}' +
      /* Roadmap layout follows the supplied forge popup instead of replacing the old LVL manager. */
      '#zg-progression{width:min(1260px,100%);height:min(820px,94vh)}' +
      '.zgp-road-body{display:flex;flex-direction:column;min-height:0;flex:1;padding:18px 20px 14px;overflow:auto}' +
      '.zgp-road-layout{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;min-height:0;flex:1}' +
      '.zgp-road-column{min-width:0;display:flex;flex-direction:column}' +
      '.zgp-road-wrap{overflow-x:auto;overflow-y:visible;padding:6px 0 18px;min-height:250px}' +
      '.zgp-road{display:flex;align-items:flex-start;min-width:1030px;position:relative;padding-top:4px}' +
      '.zgp-road:before{display:none}' +
      '.zgp-node-wrap{flex:1;width:auto;min-width:92px;position:relative;text-align:center;z-index:1}' +
      '.zgp-node-label{font:700 18px Cinzel,serif;color:#b99b5e;margin:0 0 18px}' +
      '.zgp-rail{position:absolute;left:0;right:0;top:70px;height:1px;background:#6a5225;z-index:-1}.zgp-node-wrap:first-child .zgp-rail{left:50%}.zgp-node-wrap:last-child .zgp-rail{right:50%}' +
      '.zgp-node{width:60px;height:60px;border:1px solid #44351d;border-radius:11px;background:#0c0a07;color:#b99a5d;font-size:26px;cursor:pointer;box-shadow:0 0 0 5px #0b0805;margin:auto;transition:.16s}' +
      '.zgp-node.current{border:2px solid #e1bd5e;color:#f0d47d;box-shadow:0 0 0 5px #0b0805,0 0 22px #c9993b55}.zgp-node.selected{outline:1px solid #b9984d;outline-offset:5px;background:#161108}.zgp-node.past{color:#75684e;background:#0e0d0a}.zgp-node.abs{border-radius:50%}' +
      '.zgp-stem{width:1px;height:16px;background:#5a4521;margin:6px auto 0}.zgp-tags{display:flex;flex-direction:column;align-items:center;gap:5px;padding:0 3px}' +
      '.zgp-tag{max-width:112px;display:flex;align-items:center;gap:4px;border:1px solid #42331b;border-radius:7px;padding:5px 7px;background:#121009;color:#aa9874;font:10px Lora,serif;white-space:nowrap}.zgp-tag.stat{border-color:#3d492c;color:#9db47a}.zgp-tag.spell{border-color:#344a5b;color:#8fb7d1}.zgp-tag.item{border-color:#5b4424;color:#c4a36a}.zgp-tag.note{color:#a89472}.zgp-tag span{max-width:78px;overflow:hidden;text-overflow:ellipsis}.zgp-tag button{border:0;background:none;color:#685a42;padding:0;cursor:pointer}' +
      '.zgp-plan-side{border:1px solid #3a2c16;border-radius:10px;background:#0d0a06;padding:14px;overflow:auto}.zgp-plan-side h3{font:700 14px Cinzel,serif;color:#d8bd7c;margin:0 0 9px}.zgp-capline{font:10px Lora,serif;color:#796c53;padding-bottom:10px;border-bottom:1px solid #271d0e}.zgp-plan-row{display:flex;gap:7px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #21180d;color:#b7a687;font:11px Lora,serif}.zgp-plan-row button{margin-left:auto;border:0;background:none;color:#705b3e;cursor:pointer}.zgp-plan-empty{padding:22px 4px;text-align:center;color:#6f624c;font:italic 11px Lora,serif}' +
      '.zgp-menu{position:absolute;z-index:4;left:50%;top:158px;transform:translateX(-50%);width:min(430px,calc(100% - 30px));max-height:460px;overflow:auto;border:1px solid #87682e;border-radius:10px;background:#100d08;box-shadow:0 18px 55px #000;padding:7px}.zgp-menu-root{width:310px;max-width:100%;margin:auto}.zgp-menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:12px 10px;border:0;border-bottom:1px solid #2b2113;background:transparent;color:#cbb98f;font:13px Lora,serif;text-align:left;cursor:pointer}.zgp-menu-item:hover{background:#6f562117}.zgp-menu-item small{margin-left:auto;color:#7d6c50}.zgp-menu-close{float:right;border:0;background:none;color:#79684d;font-size:18px;cursor:pointer}.zgp-menu-title{padding:7px 8px 10px;color:#d8bd7c;font:700 11px Cinzel,serif;letter-spacing:.7px}' +
      '.zgp-bottom{display:grid;grid-template-columns:1fr 1.6fr 1.2fr 1fr;margin-top:auto;border:1px solid #302514;border-radius:11px;background:#0b0906;min-height:88px}.zgp-bottom-cell{padding:14px 18px;border-right:1px solid #241b0e;color:#776a52;font:11px Lora,serif}.zgp-bottom-cell:last-child{border:0}.zgp-bottom-cell b{display:block;color:#dcc071;font:700 23px Cinzel,serif;margin-top:5px}.zgp-bottom-icons{display:flex;gap:14px;color:#b79a62;font-size:16px;margin-top:10px}.zgp-bottom-icons strong{font:700 14px Cinzel,serif;color:#d9bd76}' +
      '@media(max-width:900px){.zgp-road-layout{grid-template-columns:1fr}.zgp-plan-side{max-height:190px}.zgp-bottom{grid-template-columns:1fr 1fr}.zgp-bottom-cell:nth-child(2){border-right:0}.zgp-menu{top:150px}}' +
      '@media(max-width:560px){.zgp-road-body{padding:12px}.zgp-bottom{grid-template-columns:1fr}.zgp-bottom-cell{border-right:0;border-bottom:1px solid #241b0e}.zgp-node-wrap{min-width:82px}.zgp-menu{position:fixed;top:72px;max-height:calc(100vh - 150px)}}';
    style.textContent +=
      '.zgp-modebar{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid #33240f;background:#0a0805}' +
      '.zgp-modebtn{padding:11px 16px;border:0;border-bottom:2px solid transparent;background:transparent;color:#71644e;font:700 10px Cinzel,serif;letter-spacing:.6px;cursor:pointer}.zgp-modebtn.on{color:#e1c36f;border-bottom-color:#c39e45;background:#c39e450b}' +
      '.zgp-help{align-self:center;margin-left:auto;width:30px;height:30px;border:1px solid #59431f;border-radius:50%;background:#151006;color:#d2b86f;font:700 14px Cinzel,serif;cursor:pointer}.zgp-help:hover{border-color:#a78338;color:#f0d27b;background:#201707}' +
      '.zgp-workspace{display:grid;grid-template-columns:220px minmax(0,1fr) 250px;gap:14px;min-height:0;flex:1}.zgp-workspace.builder{grid-template-columns:220px minmax(0,1fr)}' +
      '.zgp-forecast{border:1px solid #382b16;border-radius:10px;background:#0d0a06;overflow-y:auto;overflow-x:hidden;min-height:0}.zgp-portrait{height:205px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 20%,#2a1e0d,#090704 72%);border-bottom:1px solid #382b16}.zgp-portrait img{width:100%;height:100%;object-fit:cover;object-position:center 22%;filter:saturate(.82) contrast(1.04)}.zgp-portrait:after{content:\"\";position:absolute;inset:0;background:linear-gradient(transparent 55%,#0d0a06)}.zgp-portrait-fallback{height:100%;display:flex;align-items:center;justify-content:center;font-size:58px;color:#9f8245}' +
      '.zgp-forecast-head{padding:0 13px 11px;margin-top:-28px;position:relative;z-index:1}.zgp-forecast-head strong{display:block;color:#ead59d;font:700 13px Cinzel,serif}.zgp-forecast-head span{font:9px Cinzel,serif;color:#806f52}' +
      '.zgp-change-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:0 10px 9px}.zgp-change-kpi{padding:7px 3px;text-align:center;border:1px solid #2a2011;border-radius:6px;background:#090704}.zgp-change-kpi small{display:block;color:#695d48;font:8px Cinzel,serif}.zgp-change-kpi b{display:block;color:#cbb27a;font:700 12px Cinzel,serif;margin-top:4px}.zgp-change-kpi em{color:#72b87d;font-style:normal}' +
      '.zgp-change-list{padding:0 11px 10px}.zgp-change-title{padding:8px 0 5px;color:#796b52;font:700 8px Cinzel,serif;letter-spacing:1px}.zgp-change-row{display:grid;grid-template-columns:19px 1fr auto;align-items:center;gap:5px;padding:5px 0;border-bottom:1px solid #20180d;color:#95866b;font:9.5px Cinzel,serif}.zgp-change-row b{color:#c7b48d;font-size:10px}.zgp-change-row .to{color:#5d513e;margin:0 3px}.zgp-change-row .up{color:#78b982}' +
      '.zgp-builder-main{border:1px solid #382b16;border-radius:10px;background:#0d0a06;padding:16px;overflow:auto}.zgp-builder-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}.zgp-builder-head h3{margin:0;color:#e1c781;font:700 15px Cinzel,serif}.zgp-builder-head p{margin:4px 0 0;color:#75674f;font:10px Lora,serif}.zgp-race-select{min-width:190px;padding:9px 12px;border:1px solid #5a431e;border-radius:7px;background:#0a0704;color:#d4bc7b;font:11px Cinzel,serif}.zgp-builder-levels{display:grid;grid-template-columns:repeat(11,1fr);gap:6px;margin-bottom:16px}.zgp-builder-lvl{height:46px;border:1px solid #342813;border-radius:8px;background:#0a0805;color:#8c7852;font:700 12px Cinzel,serif;cursor:pointer}.zgp-builder-lvl.on{border-color:#c6a14b;color:#efd376;box-shadow:0 0 14px #bb91362c;background:#171107}' +
      '.zgp-race-card{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}.zgp-builder-box{border:1px solid #2e2414;border-radius:8px;background:#0a0805;padding:13px}.zgp-builder-box h4{margin:0 0 10px;color:#bda56f;font:700 10px Cinzel,serif;letter-spacing:.7px}.zgp-builder-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:7px}.zgp-builder-metric{padding:10px 6px;text-align:center;border:1px solid #2b2112;border-radius:7px}.zgp-builder-metric span{display:block;color:#6f624d;font:8px Cinzel,serif}.zgp-builder-metric b{display:block;margin-top:5px;color:#dfc477;font:700 18px Cinzel,serif}.zgp-gain-list{display:flex;flex-direction:column;gap:6px}.zgp-gain{display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #29301f;border-radius:6px;background:#10140c;color:#9faf83;font:10px Lora,serif}.zgp-gain strong{margin-left:auto;color:#8bc18e}.zgp-builder-note{margin-top:12px;padding:10px;border-left:2px solid #6b5428;background:#141006;color:#786b53;font:10px Lora,serif;line-height:1.5}' +
      '.zgp-builder-allocation{grid-column:1/-1;border:1px solid #4a3718;border-radius:8px;background:#100c07;padding:13px}.zgp-builder-allocation-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.zgp-builder-allocation-head h4{margin:0;color:#d4b96f;font:700 10px Cinzel,serif;letter-spacing:.7px}.zgp-builder-points{margin-left:auto;padding:5px 9px;border:1px solid #60491f;border-radius:12px;color:#d5b966;font:700 9px Cinzel,serif}.zgp-builder-points.empty{color:#7ebb83;border-color:#345438}.zgp-builder-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.zgp-builder-stat{display:grid;grid-template-columns:26px minmax(0,1fr) 28px 28px;align-items:center;gap:6px;padding:9px;border:1px solid #2d2314;border-radius:7px;background:#0a0805}.zgp-builder-stat .ico{font-size:18px}.zgp-builder-stat b{display:block;color:#cdbb91;font:10px Cinzel,serif}.zgp-builder-stat small{display:block;color:#76684f;font:8px Lora,serif;margin-top:3px}.zgp-builder-stat .zgp-mini{width:28px;height:28px}.zgp-builder-stat .zgp-mini:disabled{opacity:.25}' +
      '.zgp-road-wrap{overflow:visible;min-height:250px}.zgp-road{min-width:0;width:100%}.zgp-node-wrap{min-width:0}.zgp-node-label{font-size:13px}.zgp-node{width:48px;height:48px;font-size:21px}.zgp-rail{top:61px}' +
      '.zgp-menu{overflow-x:hidden}.zgp-menu .zgp-panel{overflow:hidden}.zgp-menu .zgp-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.zgp-menu .zgp-stat-card{grid-template-columns:26px minmax(0,1fr) 27px 27px;gap:4px;padding:8px;min-width:0}.zgp-menu .zgp-stat-card span:nth-child(2){min-width:0}.zgp-menu .zgp-stat-card b,.zgp-menu .zgp-stat-card small{white-space:normal;overflow-wrap:anywhere}' +
      '.zgp-tag{position:relative;cursor:help}.zgp-tag:before{content:attr(data-tooltip);position:absolute;z-index:20;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%) translateY(4px);width:max-content;max-width:260px;white-space:pre-line;text-align:left;padding:9px 11px;border:1px solid #70562a;border-radius:7px;background:#171108;color:#d7c39a;font:11px/1.45 Lora,serif;box-shadow:0 10px 28px #000;opacity:0;visibility:hidden;pointer-events:none;transition:.14s}.zgp-tag:hover:before,.zgp-tag:focus-within:before{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}.zgp-tag.clickable{cursor:pointer}' +
      '.zgp-weapons{padding:0 11px 12px}.zgp-weapon-list{display:flex;gap:6px;flex-wrap:wrap}.zgp-weapon{position:relative;width:38px;height:38px;border:1px solid #5a4322;border-radius:7px;background:#0a0704;color:#d8b86b;display:flex;align-items:center;justify-content:center;font-size:19px;cursor:pointer}.zgp-weapon img{width:100%;height:100%;object-fit:cover;border-radius:6px}.zgp-weapon:after{content:attr(data-tooltip);position:absolute;z-index:20;left:0;bottom:calc(100% + 8px);width:210px;white-space:pre-line;padding:9px;border:1px solid #70562a;border-radius:7px;background:#171108;color:#d7c39a;font:10px/1.45 Lora,serif;box-shadow:0 10px 28px #000;opacity:0;visibility:hidden;pointer-events:none}.zgp-weapon:hover:after{opacity:1;visibility:visible}.zgp-weapon-dmg{position:absolute;right:-4px;bottom:-5px;padding:2px 4px;border-radius:8px;background:#6a261f;color:#ffd0ba;font:700 7px Cinzel,serif;border:1px solid #9b4438}' +
      '#zgp-preview-overlay{position:fixed;inset:0;z-index:100200;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}.zgp-preview-card{width:min(680px,100%);max-height:88vh;overflow:auto;border:2px solid #8b6b30;border-radius:12px;background:linear-gradient(155deg,#1b1409,#0b0805);box-shadow:0 28px 90px #000;padding:22px;box-sizing:border-box}.zgp-preview-top{display:flex;gap:8px;align-items:flex-start}.zgp-preview-top h3{margin:0;color:#f1ddaa;font:700 21px Cinzel,serif}.zgp-preview-top button{margin-left:auto;border:1px solid #3a2c16;background:transparent;color:#8b795b;border-radius:7px;width:32px;height:32px;cursor:pointer}.zgp-preview-badges{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0 15px}.zgp-preview-badges span{padding:4px 8px;border:1px solid #49371a;border-radius:10px;color:#a9956d;font:9px Cinzel,serif}.zgp-preview-block{padding:12px 0;border-top:1px solid #2b2011;color:#c5b394;font:12px/1.6 Lora,serif;white-space:pre-wrap}.zgp-preview-block b{display:block;margin-bottom:5px;color:#8d7b59;font:9px Cinzel,serif;letter-spacing:1px}.zgp-choice-info{width:25px;height:25px;border:1px solid #4b391c;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#b99b58;flex:0 0 auto}' +
      '.zgp-spell-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 10px}.zgp-spell-slot{display:flex;align-items:center;gap:6px;padding:7px 8px;border:1px solid #302514;border-radius:7px;background:#0a0805;color:#8e7d60;font:9px Cinzel,serif}.zgp-spell-slot b{margin-left:auto;color:#d2b875;font-size:11px}.zgp-spell-slot.full{border-color:#713d35;color:#bc756d}.zgp-spell-slot.full b{color:#d77a70}' +
      '@media(max-width:1050px){.zgp-workspace{grid-template-columns:190px minmax(0,1fr)}.zgp-workspace:not(.builder) .zgp-plan-side{grid-column:1/-1;max-height:170px}.zgp-race-card{grid-template-columns:1fr}.zgp-builder-levels{grid-template-columns:repeat(6,1fr)}}' +
      '@media(min-width:721px){#zg-progression{zoom:1.35;width:min(1260px,calc(100% / 1.35));height:min(820px,calc(94vh / 1.35))}}' +
      '#zg-progression *{scrollbar-width:thin;scrollbar-color:#765324 #0b0805}#zg-progression *::-webkit-scrollbar{width:8px;height:8px}#zg-progression *::-webkit-scrollbar-track{background:#0b0805;border-radius:8px}#zg-progression *::-webkit-scrollbar-thumb{background:linear-gradient(#9a7130,#5d421f);border:2px solid #0b0805;border-radius:8px}' +
      '.zgp-race-picker{position:relative;min-width:220px}.zgp-race-picker summary{height:48px;display:flex;align-items:center;gap:10px;padding:0 11px;border:1px solid #654b20;border-radius:9px;background:linear-gradient(180deg,#171107,#090704);color:#dec47e;font:700 12px Cinzel,serif;cursor:pointer;list-style:none}.zgp-race-picker summary::-webkit-details-marker{display:none}.zgp-race-picker summary span:nth-child(2){min-width:0;flex:1}.zgp-race-picker[open] summary{border-color:#c19842;box-shadow:0 0 0 2px #bd923225}.zgp-race-menu{position:absolute;z-index:40;right:0;top:calc(100% + 6px);width:290px;max-height:360px;overflow:auto;padding:7px;border:1px solid #8a662b;border-radius:10px;background:#100b06;box-shadow:0 20px 60px #000}.zgp-race-option{width:100%;min-height:54px;display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid transparent;border-radius:8px;background:transparent;color:#bda97d;font:11px Cinzel,serif;text-align:left;cursor:pointer}.zgp-race-option:hover,.zgp-race-option.on{border-color:#674b20;background:#241707;color:#f0d08b}.zgp-race-option span:nth-child(2){flex:1}.zgp-race-option b{color:#79bf85}.zgp-race-art{display:block;flex:0 0 auto;background-image:url("images/ui/races/race-portraits-atlas-v1.png");background-repeat:no-repeat;background-size:300% 300%;background-color:#080604}.zgp-race-art.mini{width:38px;height:38px;border:1px solid #745323;border-radius:8px}.zgp-race-art.hero{width:100%;height:100%}.zgp-race-art.race-human{background-position:0 0}.zgp-race-art.race-elf{background-position:50% 0}.zgp-race-art.race-dwarf{background-position:100% 0}.zgp-race-art.race-goblin{background-position:0 50%}.zgp-race-art.race-halfling{background-position:50% 50%}.zgp-race-art.race-orc{background-position:100% 50%}.zgp-race-art.race-firbolg{background-position:0 100%}.zgp-race-art.race-kenku{background-position:50% 100%}.zgp-race-art.race-outcast{background-position:100% 100%}.zgp-builder-stat .zg-stat-icon{width:24px;height:24px}.zgp-builder-stat .ico{display:grid;place-items:center}' +
      '@media(max-width:720px){.zgp-workspace,.zgp-workspace.builder{grid-template-columns:1fr}.zgp-forecast{max-height:none}.zgp-portrait{height:180px}.zgp-builder-head{align-items:stretch;flex-direction:column}.zgp-builder-levels{grid-template-columns:repeat(4,1fr)}.zgp-builder-metrics{grid-template-columns:repeat(2,1fr)}.zgp-builder-stat-grid{grid-template-columns:1fr}.zgp-modebtn{flex:1;padding:10px 5px;font-size:8px}.zgp-road{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px 4px}.zgp-rail{display:none}.zgp-node-wrap{min-width:0}.zgp-tag:before{position:fixed;left:12px;right:12px;bottom:80px;transform:none;width:auto;max-width:none}.zgp-race-picker{min-width:0}.zgp-race-menu{left:0;right:auto;width:min(320px,calc(100vw - 48px))}}';
    document.head.appendChild(style);
  }

  function roadmapHtml(character) {
    var current = Number(character.level) || 1;
    var html = '<div class="zgp-road-wrap"><div class="zgp-road">';
    for (var level = 1; level <= 11; level += 1) {
      var entry = levelEntry(character, level, false);
      var hasPlan = entryPointCount(entry) || entry.spellIds.length || entry.items.length || entry.gold.length || entry.notes.length;
      var classes = [];
      if (level < current) classes.push('past');
      if (level === current) classes.push('current');
      if (level === ui.level) classes.push('selected');
      if (hasPlan) classes.push('has-plan');
      if (level === 11) classes.push('abs');
      var tags = [];
      STAT_ORDER.forEach(function(key) {
        if (entry.stats[key]) {
          tags.push('<div class="zgp-tag stat" data-tooltip="+' + entry.stats[key] + ' ' + STAT_LABELS[key] + '">' + STAT_ICONS[key] + '<span>+' + entry.stats[key] + ' ' + STAT_LABELS[key] +
            '</span><button onclick="event.stopPropagation();zgProgressionRemovePlan(' + level + ',\'stat\',\'' + key + '\')">×</button></div>');
        }
      });
      entry.spellIds.forEach(function(id, index) {
        var spell = catalogEntries().find(function(candidate) { return sameId(candidate.id, id); });
        var spellTip = (spell && spell.name || 'Навык') + '\n' +
          (spell && (spell.description || spell.battle || spell.restriction || spell.learnText) || 'Нажмите, чтобы открыть карточку Каталога');
        tags.push('<div class="zgp-tag spell clickable" data-tooltip="' + esc(spellTip) +
          '" onclick="zgProgressionViewSpell(' + level + ',' + index + ')">🏹<span>' +
          esc(spell && spell.name || 'Навык') + '</span><button onclick="event.stopPropagation();zgProgressionRemovePlan(' +
          level + ',\'spell\',' + index + ')">×</button></div>');
      });
      entry.items.forEach(function(item, index) {
        var itemTip = (item.name || 'Предмет') +
          (item.damage ? '\nУрон: ' + item.damage + (item.damageType ? ' · ' + item.damageType : '') : '') +
          (item.effect ? '\n' + item.effect : (item.desc ? '\n' + item.desc : '')) +
          '\nНажмите, чтобы открыть карточку Товаров';
        tags.push('<div class="zgp-tag item clickable" data-tooltip="' + esc(itemTip) +
          '" onclick="zgProgressionViewItem(' + level + ',' + index + ')">📦<span>' +
          esc(item.name || 'Предмет') + '</span><button onclick="event.stopPropagation();zgProgressionRemovePlan(' +
          level + ',\'item\',' + index + ')">×</button></div>');
      });
      entry.gold.forEach(function(gold, index) {
        var label = (gold.amount > 0 ? '+' : '') + gold.amount + ' зл';
        tags.push('<div class="zgp-tag item" data-tooltip="' + esc(label + (gold.note ? '\n' + gold.note : '')) +
          '">' + coinIcon('zl',16) + '<span>' + label + '</span><button onclick="event.stopPropagation();zgProgressionRemovePlan(' +
          level + ',\'gold\',' + index + ')">×</button></div>');
      });
      entry.notes.forEach(function(note, index) {
        tags.push('<div class="zgp-tag note" data-tooltip="' + esc(note) + '">🪶<span>' + esc(note) +
          '</span><button onclick="event.stopPropagation();zgProgressionRemovePlan(' +
          level + ',\'note\',' + index + ')">×</button></div>');
      });
      html += '<div class="zgp-node-wrap"><div class="zgp-node-label">' +
        (level === 11 ? 'АБСОЛЮТ' : level) +
        '</div><div class="zgp-rail"></div><button class="zgp-node ' + classes.join(' ') +
        '" onclick="zgProgressionOpenMenu(' + level + ')">' +
        (level < current ? '✓' : (level === current ? '◆' : (level === 11 ? '☠' : '+'))) +
        '</button>' + (tags.length ? '<div class="zgp-stem"></div>' : '') +
        '<div class="zgp-tags">' + tags.join('') + '</div></div>';
    }
    return html + '</div></div>';
  }

  function selectedPlanSummaryHtml(character) {
    var entry = levelEntry(character, ui.level, false);
    var rows = [];
    STAT_ORDER.forEach(function(key) {
      if (entry.stats[key]) rows.push({ icon:STAT_ICONS[key], text:'+' + entry.stats[key] + ' ' + STAT_LABELS[key], kind:'stat', key:key });
    });
    entry.spellIds.forEach(function(id, index) {
      var spell = catalogEntries().find(function(candidate) { return sameId(candidate.id, id); });
      rows.push({ icon:'🏹', text:(spell && spell.name) || 'Навык', kind:'spell', key:index });
    });
    entry.items.forEach(function(item, index) {
      rows.push({ icon:item.icon || '📦', text:item.name || 'Предмет', kind:'item', key:index });
    });
    entry.gold.forEach(function(gold, index) {
      rows.push({ icon:coinIcon('zl',16), text:(gold.amount > 0 ? '+' : '') + gold.amount + ' зл' +
        (gold.note ? ' · ' + gold.note : ''), kind:'gold', key:index });
    });
    entry.notes.forEach(function(note, index) {
      rows.push({ icon:'🪶', text:note, kind:'note', key:index });
    });
    return '<aside class="zgp-plan-side"><h3>План на ур. ' + ui.level + '</h3>' +
      '<div class="zgp-capline">Очки характеристик: <b>' + entryPointCount(entry) + '/' +
      levelAllowance(character, ui.level) + '</b></div>' +
      (rows.length ? rows.map(function(row) {
        return '<div class="zgp-plan-row"><span>' + row.icon + '</span><span>' + esc(row.text) +
          '</span><button onclick="zgProgressionRemovePlan(' + ui.level + ',\'' + row.kind + '\',\'' +
          row.key + '\')">×</button></div>';
      }).join('') : '<div class="zgp-plan-empty">Пусто.<br>Нажмите «+» на узле уровня.</div>') +
      '</aside>';
  }

  function menuHtml(character) {
    if (!ui.menu) return '';
    var entry = levelEntry(character, ui.level, true);
    var current = Number(character.level) || 1;
    var editable = ui.level > current && !entry.appliedAt;
    if (!editable) {
      return '<div class="zgp-menu"><button class="zgp-menu-close" onclick="zgProgressionCloseMenu()">×</button>' +
        '<div class="zgp-menu-title">УРОВЕНЬ ' + ui.level + '</div><div class="zgp-plan-empty">' +
        'Этот уровень уже применён. Старая ручная прокачка по-прежнему открывается кликом по LVL в листе героя.</div></div>';
    }
    if (ui.menu === 'root') {
      return '<div class="zgp-menu"><button class="zgp-menu-close" onclick="zgProgressionCloseMenu()">×</button>' +
        '<div class="zgp-menu-root"><div class="zgp-menu-title">УР. ' + ui.level + ' · ВЫБЕРИТЕ РЕШЕНИЕ</div>' +
        '<button class="zgp-menu-item" onclick="zgProgressionMenuSection(\'stats\')"><span>' + STAT_ICONS.str + '</span>Повысить стат<small>' +
          entryPointCount(entry) + '/' + levelAllowance(character, ui.level) + '</small></button>' +
        '<button class="zgp-menu-item" onclick="zgProgressionMenuSection(\'spells\')"><span>🏹</span>Выбрать навык<small>из Каталога</small></button>' +
        '<button class="zgp-menu-item" onclick="zgProgressionMenuSection(\'items\')"><span>📦</span>Купить предмет<small>из Товаров</small></button>' +
        '<button class="zgp-menu-item" onclick="zgProgressionMenuSection(\'gold\')"><span>' + coinIcon('zl',18) + '</span>Добавить золото<small>доход / трата</small></button>' +
        '<button class="zgp-menu-item" onclick="zgProgressionMenuSection(\'notes\')"><span>🪶</span>Добавить заметку</button>' +
        '</div></div>';
    }
    var panel = ui.menu === 'stats' ? statsPanelHtml(character, entry, true)
      : ui.menu === 'spells' ? spellPanelHtml(character, entry, true)
      : ui.menu === 'items' ? itemPanelHtml(entry, true)
      : ui.menu === 'gold' ? goldPanelHtml(entry, true)
      : notesPanelHtml(entry, true);
    return '<div class="zgp-menu"><button class="zgp-menu-close" onclick="zgProgressionCloseMenu()">×</button>' +
      '<button class="zgp-tab" onclick="zgProgressionMenuSection(\'root\')">← назад</button>' +
      '<div class="zgp-menu-title">УР. ' + ui.level + ' · ' +
      ({stats:'СТАТ',spells:'НАВЫК ИЗ КАТАЛОГА',items:'ПРЕДМЕТ ИЗ ТОВАРОВ',gold:'ЗОЛОТО',notes:'ЗАМЕТКА'}[ui.menu] || '') +
      '</div>' + panel + '</div>';
  }

  function bottomSummaryHtml(character) {
    var selected = levelEntry(character, ui.level, false);
    var totals = { stats:0, spells:0, items:0, gold:0, notes:0 };
    Object.keys(ensurePlan(character).levels).forEach(function(level) {
      var entry = levelEntry(character, level, false);
      totals.stats += entryPointCount(entry);
      totals.spells += entry.spellIds.length;
      totals.items += entry.items.length;
      totals.gold += entry.gold.reduce(function(sum, gold) { return sum + (Number(gold.amount) || 0); }, 0);
      totals.notes += entry.notes.length;
    });
    var currentCoins = coinsToCopper(character);
    var target = Math.max(Number(character.level) || 1, ui.level);
    var remaining = currentCoins - plannedCost(character, target) + plannedGold(character, target);
    var next = Math.min(11, (Number(character.level) || 1) + 1);
    return '<div class="zgp-bottom">' +
      '<div class="zgp-bottom-cell">Свободных очков на ур. ' + ui.level + ':<b>' +
      (levelAllowance(character, ui.level) - entryPointCount(selected)) + '</b></div>' +
      '<div class="zgp-bottom-cell">Запланировано до ур. ' + target + ':' +
      '<div class="zgp-bottom-icons"><span>' + STAT_ICONS.str + ' <strong>' + totals.stats + '</strong></span><span>🏹 <strong>' +
      totals.spells + '</strong></span><span>📦 <strong>' + totals.items + '</strong></span><span>' + coinIcon('zl',15) + ' <strong>' +
      (totals.gold > 0 ? '+' : '') + totals.gold + '</strong></span><span>🪶 <strong>' +
      totals.notes + '</strong></span></div></div>' +
      '<div class="zgp-bottom-cell">Монеты после плана:<b style="color:' + (remaining < 0 ? '#c86c66' : '#dcc071') + '">' +
      (remaining < 0 ? 'не хватает ' : '') + priceHtml(copperAsPrice(Math.abs(remaining))) + '</b></div>' +
      '<div class="zgp-bottom-cell">Следующее решение:<b>ур. ' + next + '</b></div></div>';
  }

  function heroPortrait(character) {
    var baked = {
      '1776627463516':'images/heroart/Evan.png',
      '1776626039651':'images/heroart/Melissa.png',
      '1776463717210':'images/heroart/Esteros.png',
      '1778221131899':'images/heroart/Vrotik.png',
      '1778221143711':'images/heroart/LinIn.png'
    };
    var art = character && character.heroArt;
    var layer = art && (art.fg || (!art.bg && art));
    return (character && character.portrait) || (layer && (layer.path || layer.image)) ||
      baked[String(character && character.id)] || '';
  }

  function changeValue(now, future) {
    return '<b>' + now + (future !== now
      ? '<span class="to">→</span><span class="up">' + future + '</span>'
      : '') + '</b>';
  }

  function weaponCardsHtml(character, targetLevel) {
    var shop = shopItems();
    var combined = [];
    (character.inventoryItems || []).concat(character.equipItems || []).forEach(function(item) {
      if (!item) return;
      var source = shop.find(function(shopItem) {
        return sameId(shopItem.id, item.shopItemId || item.itemId) ||
          String(shopItem.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
      });
      combined.push(source || item);
    });
    plannedItemsUpTo(character, targetLevel).forEach(function(item) { combined.push(item); });
    var seen = {};
    var weapons = combined.filter(function(item) {
      var key = String(item.id || item.shopItemId || item.itemId || item.name || '');
      if (!key || seen[key]) return false;
      var isWeapon = !!item.damage || /урон\s*:/i.test(String(item.description || '')) ||
        /оруж|клин|меч|кинжал|копь|лук|арбал|топор|молот|дубин|сабл/i.test(
        String(item.cat || '') + ' ' + String(item.type || '') + ' ' + String(item.name || '')
      );
      if (isWeapon) seen[key] = true;
      return isWeapon;
    }).slice(0, 8);
    ui.weaponItems = weapons;
    if (!weapons.length) return '<div class="zgp-weapons"><div class="zgp-change-title">ОРУЖИЕ И УРОН</div>' +
      '<div style="color:#625743;font:italic 9px Lora,serif">В плане оружия пока нет</div></div>';
    return '<div class="zgp-weapons"><div class="zgp-change-title">ОРУЖИЕ И УРОН</div><div class="zgp-weapon-list">' +
      weapons.map(function(item, weaponIndex) {
        var source = shop.find(function(shopItem) {
          return sameId(shopItem.id, item.id || item.shopItemId || item.itemId) ||
            String(shopItem.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
        }) || item;
        var image = source.image ? '<img src="' + esc(source.image) + '" alt="">' : esc(source.icon || '⚔');
        var damageMatch = String(source.description || '').match(/урон\s*:\s*([^\n\r]+)/i);
        var damage = source.damage || (damageMatch && damageMatch[1] && damageMatch[1].trim()) || '—';
        var tip = (source.name || 'Оружие') + '\nУрон: ' + damage +
          (source.damageType ? ' · ' + source.damageType : '') +
          (source.range ? '\nДальность: ' + source.range : '') +
          (source.effect ? '\n' + source.effect : '');
        var badgeDamage = String(damage).split(/\s+/)[0];
        return '<button class="zgp-weapon" data-tooltip="' + esc(tip) + '" ' +
          'onclick="zgProgressionViewWeapon(' + weaponIndex + ')"' +
          '>' + image + '<span class="zgp-weapon-dmg">' + esc(badgeDamage) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function roadmapForecastHtml(character) {
    var target = Math.max(Number(character.level) || 1, ui.level);
    var stats = projectedStats(character, target);
    var portrait = heroPortrait(character);
    var nowHp = Number(character.hpMax) || Number(character.baseHpMax) || 10;
    var nowAc = Number(character.ac) || 10;
    var nowInitiative = Number(character.initiative) || 0;
    var nowSpeed = typeof global.parseSpeedNumber === 'function'
      ? global.parseSpeedNumber(character.speed || character.baseSpeed || '0')
      : (parseInt(character.speed, 10) || 0);
    return '<aside class="zgp-forecast">' +
      '<div class="zgp-portrait">' + (portrait
        ? '<img src="' + esc(portrait) + '" alt="' + esc(character.name || 'Герой') + '">'
        : '<div class="zgp-portrait-fallback">♟</div>') + '</div>' +
      '<div class="zgp-forecast-head"><strong>' + esc(character.name || 'Персонаж') + '</strong><span>' +
      esc(character.race || 'Раса не указана') + ' · ур. ' + (character.level || 1) + ' → ' + target + '</span></div>' +
      '<div class="zgp-change-kpis">' +
        '<div class="zgp-change-kpi"><small>HP</small>' + changeValue(nowHp, projectedHp(character, target)) + '</div>' +
        '<div class="zgp-change-kpi"><small>AC</small>' + changeValue(nowAc, projectedAc(character, target)) + '</div>' +
        '<div class="zgp-change-kpi"><small>ИНИЦ.</small>' + changeValue(nowInitiative, projectedInitiative(character, target)) + '</div>' +
        '<div class="zgp-change-kpi"><small>СКОР.</small>' + changeValue(nowSpeed, projectedSpeed(character, target)) + '</div>' +
      '</div><div class="zgp-change-list"><div class="zgp-change-title">ИЗМЕНЕНИЯ ХАРАКТЕРИСТИК</div>' +
      STAT_ORDER.map(function(key) {
        return '<div class="zgp-change-row"><span>' + STAT_ICONS[key] + '</span><span>' + STAT_LABELS[key] + '</span>' +
          changeValue(currentBaseStat(character, key), stats[key]) + '</div>';
      }).join('') + '</div>' + weaponCardsHtml(character, target) + '</aside>';
  }

  function raceNames() {
    var source = global.ZARGOTA_RACES || {};
    var names = Object.keys(source);
    return names.length ? names : ['Человек','Эльф','Дворф','Гоблин','Полурослик','Орк','Уродец'];
  }

  var RACE_ART = { Человек:'human', Эльф:'elf', Дворф:'dwarf', Гоблин:'goblin', Полурослик:'halfling', Орк:'orc', Фирболг:'firbolg', Кенку:'kenku', Уродец:'outcast' };

  function raceArtHtml(name, extraClass) {
    return '<span class="zgp-race-art race-' + esc(RACE_ART[name] || 'human') + ' ' + (extraClass || '') + '" aria-hidden="true"></span>';
  }

  function racePickerHtml() {
    return '<details class="zgp-race-picker"><summary>' + raceArtHtml(ui.builderRace, 'mini') + '<span>' + esc(ui.builderRace) + '</span><b>⌄</b></summary>' +
      '<div class="zgp-race-menu">' + raceNames().map(function(name) {
        return '<button type="button" class="zgp-race-option ' + (name === ui.builderRace ? 'on' : '') + '" onclick="zgProgressionBuilderRace(\'' + esc(name) + '\')">' +
          raceArtHtml(name, 'mini') + '<span>' + esc(name) + '</span>' + (name === ui.builderRace ? '<b>✓</b>' : '') + '</button>';
      }).join('') + '</div></details>';
  }

  function builderRaceData(name) {
    return typeof global.getRaceData === 'function'
      ? global.getRaceData({ race:name })
      : { hpStart:10, hpPerLevel:4, speed:7, racialAt369:{kind:'free'} };
  }

  function milestoneCount(level) {
    return [3,6,9].filter(function(value) { return value <= level; }).length;
  }

  function normalizeBuilderStats(raw) {
    var result = emptyStats();
    STAT_ORDER.forEach(function(key) {
      result[key] = Math.max(0, Math.floor(Number(raw && raw[key]) || 0));
    });
    return result;
  }

  function builderUsedPoints(stats) {
    return STAT_ORDER.reduce(function(total, key) {
      return total + (Number(stats && stats[key]) || 0);
    }, 0);
  }

  function builderStatCap(level, totalPoints) {
    // Из стартовых 4 очков в одну характеристику разрешено вложить максимум 2.
    // Все очки последующих уровней можно направить туда же.
    if (Math.max(1, Number(level) || 1) === 1) return 2;
    return Math.max(2, Math.max(4, Number(totalPoints) || 4) - 2);
  }

  function trimBuilderStats(stats, maximum, perStatMaximum) {
    var result = normalizeBuilderStats(stats);
    var statCap = Number(perStatMaximum);
    if (statCap >= 0) {
      STAT_ORDER.forEach(function(key) { result[key] = Math.min(result[key], statCap); });
    }
    var excess = Math.max(0, builderUsedPoints(result) - Math.max(0, Number(maximum) || 0));
    STAT_ORDER.slice().reverse().forEach(function(key) {
      if (!excess) return;
      var removed = Math.min(result[key], excess);
      result[key] -= removed;
      excess -= removed;
    });
    return result;
  }

  function builderProjection(raceName, level, allocatedStats) {
    var race = builderRaceData(raceName);
    var allocated = normalizeBuilderStats(allocatedStats);
    var stats = emptyStats();
    var freeRacial = Math.max(0, Number(race.startingFree) || 0);
    var speedBonus = 0;
    STAT_ORDER.forEach(function(key) {
      stats[key] = allocated[key] + Math.max(0, Number(race.startingStats && race.startingStats[key]) || 0);
    });
    for (var racialLevel = 2; racialLevel <= level; racialLevel += 1) {
      var racial = racialAtLevel(race, racialLevel);
      if (!racial) continue;
      if ((racial.kind === 'stat' || racial.kind === 'stat+speed') && racial.stat) stats[racial.stat] += 1;
      if (racial.kind === 'stat+speed') speedBonus += Number(racial.speed) || 0;
      if (racial.kind === 'free') freeRacial += 1;
    }
    var points = 4 + Math.max(0, level - 1) * 2 + freeRacial;
    var used = builderUsedPoints(allocated);
    return {
      race: race,
      stats: stats,
      allocated: allocated,
      hp: (Number(race.hpStart) || 10) + Math.max(0, level - 1) * (Number(race.hpPerLevel) || 4) + stats.con * 2,
      ac: (Number(race.acStart) || 10) + Math.floor(stats.dex / 3),
      initiative: Math.floor(stats.per / 2),
      speed: (Number(race.speed) || 7) + speedBonus,
      points: points,
      statCap: builderStatCap(level, points),
      used: used,
      free: Math.max(0, points - used),
      milestones: milestoneCount(level)
    };
  }

  function racialDescription(raceName) {
    var race = builderRaceData(raceName);
    if (raceName === 'Фирболг') return '«Пульс Леса» развивается на уровнях 1, 3, 6 и 9';
    if (raceName === 'Кенку') return '+1 Восприятие на 3-м, +1 Ловкость на 6-м и +1 Восприятие на 9-м';
    if (raceName === 'Человек') return '+1 свободное расовое очко на старте и на уровнях 3, 6 и 9';
    var racial = race.racialAt369 || { kind:'none' };
    if (racial.kind === 'free') return '+1 свободное очко на уровнях 3, 6 и 9';
    if (racial.kind === 'stat+speed') return '+1 ' + (STAT_LABELS[racial.stat] || 'стат') + ' и +' +
      (racial.speed || 0) + ' м скорости на уровнях 3, 6 и 9';
    if (racial.kind === 'stat') return '+1 ' + (STAT_LABELS[racial.stat] || 'стат') + ' на уровнях 3, 6 и 9';
    return 'автоматического бонуса характеристик на 3/6/9 нет';
  }

  function builderForecastHtml() {
    var level = ui.builderLevel;
    var now = builderProjection(ui.builderRace, Math.max(1, level - 1));
    var future = builderProjection(ui.builderRace, level, ui.builderStats);
    return '<aside class="zgp-forecast"><div class="zgp-portrait">' + raceArtHtml(ui.builderRace, 'hero') + '</div>' +
      '<div class="zgp-forecast-head"><strong>' + esc(ui.builderRace) + '</strong><span>быстрый прогноз · ур. ' + level + '</span></div>' +
      '<div class="zgp-change-kpis">' +
        '<div class="zgp-change-kpi"><small>HP</small>' + changeValue(now.hp, future.hp) + '</div>' +
        '<div class="zgp-change-kpi"><small>AC</small>' + changeValue(now.ac, future.ac) + '</div>' +
        '<div class="zgp-change-kpi"><small>ИНИЦ.</small>' + changeValue(now.initiative, future.initiative) + '</div>' +
        '<div class="zgp-change-kpi"><small>СКОР.</small>' + changeValue(now.speed, future.speed) + '</div>' +
      '</div><div class="zgp-change-list"><div class="zgp-change-title">ХАРАКТЕРИСТИКИ СБОРКИ</div>' +
      STAT_ORDER.map(function(key) {
        return '<div class="zgp-change-row"><span>' + STAT_ICONS[key] + '</span><span>' + STAT_LABELS[key] +
          '</span>' + changeValue(now.stats[key], future.stats[key]) + '</div>';
      }).join('') + '</div></aside>';
  }

  function quickBuilderHtml() {
    var projection = builderProjection(ui.builderRace, ui.builderLevel, ui.builderStats);
    var previous = builderProjection(ui.builderRace, Math.max(1, ui.builderLevel - 1));
    var racial = racialAtLevel(projection.race, ui.builderLevel) || { kind:'none' };
    var builderSlotHtml = '<div class="zgp-change-title" style="margin-top:10px">ЛИМИТЫ МАГИИ</div>' +
      '<div class="zgp-spell-slots">' + Object.keys(SPELL_TYPES).map(function(key) {
        var type = SPELL_TYPES[key];
        return '<div class="zgp-spell-slot"><span>' + type.icon + '</span><span>' + type.label +
          '</span><b>' + spellTypeLimit({ race:ui.builderRace }, key, ui.builderLevel) + '</b></div>';
      }).join('') + '</div>';
    var gains = [
      { icon:'❤', text:ui.builderLevel === 1 ? 'Стартовое здоровье' : 'Максимальное здоровье',
        value:'+' + (ui.builderLevel === 1 ? projection.hp : Math.max(0, projection.hp - previous.hp)) + ' HP' },
      { icon:'✦', text:'Очки развития на этом уровне', value:'+' + (ui.builderLevel === 1 ? 4 : 2 + (racial.kind === 'free' ? 1 : 0)) }
    ];
    if (ui.builderLevel === 1) {
      var startingBonuses = [];
      STAT_ORDER.forEach(function(key) {
        var amount = Math.max(0, Number(projection.race.startingStats && projection.race.startingStats[key]) || 0);
        if (amount) startingBonuses.push('+' + amount + ' ' + STAT_LABELS[key]);
      });
      if (projection.race.startingFree) {
        startingBonuses.push('+' + projection.race.startingFree + ' свободное очко');
      }
      if (startingBonuses.length) {
        gains.push({ icon:'🧬', text:'Расовый бонус на старте', value:startingBonuses.join(', ') });
      }
    }
    if (racial.kind !== 'none' && !(ui.builderLevel === 1 && racial.starting)) {
      var racialGain = racial.kind === 'ability' ? racial.name :
        (racial.kind === 'stat' ? '+1 ' + (STAT_LABELS[racial.stat] || 'характеристика') :
        (racial.kind === 'stat+speed' ? '+1 ' + (STAT_LABELS[racial.stat] || 'характеристика') +
          ' и +' + (racial.speed || 0) + ' м скорости' :
        (racial.kind === 'free' ? '+1 свободное очко' : racialDescription(ui.builderRace))));
      gains.push({ icon:'🌟', text:'Расовый рубеж', value:racialGain });
    }
    return '<section class="zgp-builder-main"><div class="zgp-builder-head"><div><h3>Быстрый конструктор</h3>' +
      '<p>Выберите расу и уровень — расчёт обновится мгновенно.</p></div>' +
      racePickerHtml() + '</div>' +
      '<div class="zgp-builder-levels">' + Array.from({length:11}, function(_, index) {
        var level = index + 1;
        return '<button class="zgp-builder-lvl ' + (level === ui.builderLevel ? 'on' : '') +
          '" title="' + (level === 11 ? 'Абсолют' : 'Уровень ' + level) +
          '" onclick="zgProgressionBuilderLevel(' + level + ')">' + (level === 11 ? '☠' : level) + '</button>';
      }).join('') + '</div>' +
      '<div class="zgp-race-card"><div class="zgp-builder-allocation"><div class="zgp-builder-allocation-head">' +
        '<h4>РАСПРЕДЕЛЕНИЕ ХАРАКТЕРИСТИК ДО УРОВНЯ ' + (ui.builderLevel === 11 ? '«АБСОЛЮТ»' : ui.builderLevel) + '</h4>' +
        '<span class="zgp-builder-points ' + (!projection.free ? 'empty' : '') + '">Свободно: ' +
          projection.free + ' / ' + projection.points + '</span></div>' +
        '<div class="zgp-builder-stat-grid">' + STAT_ORDER.map(function(key) {
          var automatic = projection.stats[key] - projection.allocated[key];
          return '<div class="zgp-builder-stat"><span class="ico">' + STAT_ICONS[key] + '</span><span><b>' +
            STAT_LABELS[key] + ' · ' + projection.stats[key] + '</b><small>вложено ' + projection.allocated[key] +
            (automatic ? ' · раса +' + automatic : '') + ' · макс. ' + projection.statCap + '</small></span>' +
            '<button class="zgp-mini" onclick="zgProgressionBuilderStat(\'' + key + '\',-1)"' +
              (!projection.allocated[key] ? ' disabled' : '') + '>−</button>' +
            '<button class="zgp-mini" onclick="zgProgressionBuilderStat(\'' + key + '\',1)"' +
              (!projection.free || projection.allocated[key] >= projection.statCap ? ' disabled' : '') + '>+</button></div>';
        }).join('') + '</div></div>' +
      '<div class="zgp-builder-box"><h4>ИТОГ НА УРОВНЕ ' + (ui.builderLevel === 11 ? '«АБСОЛЮТ»' : ui.builderLevel) + '</h4>' +
        '<div class="zgp-builder-metrics">' +
          '<div class="zgp-builder-metric"><span>HP</span><b>' + projection.hp + '</b></div>' +
          '<div class="zgp-builder-metric"><span>AC</span><b>' + projection.ac + '</b></div>' +
          '<div class="zgp-builder-metric"><span>ИНИЦИАТИВА</span><b>+' + projection.initiative + '</b></div>' +
          '<div class="zgp-builder-metric"><span>СКОРОСТЬ</span><b>' + projection.speed + ' м</b></div>' +
          '<div class="zgp-builder-metric"><span>ОЧКИ ВЛОЖЕНО</span><b>' + projection.used + '/' + projection.points + '</b></div>' +
        '</div>' + builderSlotHtml + '<div class="zgp-builder-note"><b>' + esc(ui.builderRace) + ':</b> старт ' +
        (projection.race.hpStart || 10) + ' HP, прирост +' + (projection.race.hpPerLevel || 4) +
        ' HP за уровень, скорость ' + (projection.race.speed || 7) + ' м.<br>Рубежи: ' +
        esc(racialDescription(ui.builderRace)) + '.</div></div>' +
      '<div class="zgp-builder-box"><h4>ПРИРОСТ ПРИ ПЕРЕХОДЕ НА УР. ' + ui.builderLevel + '</h4>' +
        '<div class="zgp-gain-list">' + gains.map(function(gain) {
          return '<div class="zgp-gain"><span>' + gain.icon + '</span><span>' + esc(gain.text) +
            '</span><strong>' + esc(gain.value) + '</strong></div>';
        }).join('') + '</div>' +
        '<div class="zgp-builder-note">На 1-м уровне из стартовых 4 очков нельзя вложить больше 2 в одну характеристику. Расовый бонус считается отдельно и может поднять итог выше +2. Очки следующих уровней могут развивать характеристику дальше. HP и AC пересчитываются сразу; каждые 2 полных очка Восприятия дают +1 инициативы. Конструктор не изменяет героя и роадмапу.</div>' +
      '</div></div></section>';
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
      '<div class="zgp-money">' + coinStack(16) + ' Сейчас: <b>' + priceHtml(copperAsPrice(currentCoins)) + '</b><br>' +
      'После плана: <b style="color:' + (remaining < 0 ? '#c86c66' : '#7dbb83') + '">' +
      (remaining < 0 ? 'не хватает ' + priceHtml(copperAsPrice(-remaining)) : priceHtml(copperAsPrice(remaining))) +
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
    var counts = spellTypeCounts(character, ui.level);
    var slotCounters = '<div class="zgp-spell-slots">' + Object.keys(SPELL_TYPES).map(function(key) {
      var type = SPELL_TYPES[key];
      var limit = spellTypeLimit(character, key, ui.level);
      var count = counts[key] || 0;
      return '<div class="zgp-spell-slot ' + (count >= limit ? 'full' : '') + '"><span>' + type.icon +
        '</span><span>' + type.label + '</span><b>' + count + '/' + limit + '</b></div>';
    }).join('') + '</div>';
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
      return '<button class="zgp-choice ' + (picked ? 'picked' : '') + (!compatibility.ok && !picked ? ' bad' : '') + '" ' +
        (!editable ? 'disabled' : '') + ' onclick="zgProgressionToggleSpell(\'' + esc(spell.id) + '\')">' +
        '<span class="art">' + type.icon + '</span><span class="txt"><span class="nm">' + esc(spell.name || 'Без имени') + '</span>' +
        '<span class="why ' + ((compatibility.ok || picked) ? 'ok' : 'no') + '">ур. ' + spellLevel(spell) + ' · ' +
        (picked ? 'добавлено в план' : compatibility.reason) + '</span></span>' +
        '<span class="zgp-choice-info" onclick="event.stopPropagation();zgProgressionPreviewSpellId(\'' + esc(spell.id) + '\')">ⓘ</span>' +
        '<span>' + (picked ? '✓' : '+') + '</span></button>';
    }).join('');
    return '<div class="zgp-panel">' + slotCounters +
      '<input class="zgp-search" value="' + esc(ui.search) + '" placeholder="Поиск по Каталогу..." oninput="zgProgressionSearch(this.value)">' +
      filters + '<div class="zgp-list">' + (choices || '<div class="zgp-empty">В Каталоге ничего не найдено</div>') + '</div>' +
      '<div style="margin-top:9px;font:9px Lora,serif;color:#6c604c">База: отдельно 3 Кодекса, 3 Фолианта и 3 Ритуальника. Эльф получает +1 слот каждого типа на уровнях 3, 6 и 9. Классовые ограничения будут добавлены позже.</div></div>';
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
        '<span class="why">' + priceHtml(item.price) + ' · ' + esc(item.effect || item.desc || 'товар') + '</span></span>' +
        '<span class="zgp-choice-info" onclick="event.stopPropagation();zgProgressionViewShopId(\'' +
        encodeURIComponent(String(item.id)) + '\',true)">ⓘ</span><span>' + (picked ? '✓' : '+') + '</span></button>';
    }).join('');
    return '<div class="zgp-panel"><input class="zgp-search" value="' + esc(ui.search) + '" placeholder="Поиск по Товарам..." oninput="zgProgressionSearch(this.value)">' +
      '<div class="zgp-list">' + (choices || '<div class="zgp-empty">В разделе «Товары» пока пусто</div>') + '</div>' +
      '<div style="margin-top:9px;font:9px Lora,serif;color:#6c604c">Цена и параметры фиксируются только в плане. Предмет и деньги героя не изменяются.</div></div>';
  }

  function goldPanelHtml(entry, editable) {
    return '<div class="zgp-panel zgp-notes">' +
      (editable ? '<input id="zgp-gold-amount" class="zgp-search" type="number" step="1" placeholder="+50 доход или −20 трата">' +
        '<input id="zgp-gold-note" class="zgp-search" placeholder="Комментарий, необязательно">' +
        '<div class="zgp-note-actions"><button class="zgp-tab on" onclick="zgProgressionAddGold()">' + coinIcon('zl',16) + ' Добавить в план</button></div>' : '') +
      entry.gold.map(function(gold, index) {
        return '<div class="zgp-note-chip"><span>' + coinIcon('zl',16) + '</span><span>' +
          (gold.amount > 0 ? '+' : '') + gold.amount + ' зл' + (gold.note ? ' · ' + esc(gold.note) : '') +
          '</span><button onclick="zgProgressionRemovePlan(' + ui.level + ',\'gold\',' + index + ')">✕</button></div>';
      }).join('') +
      '<div style="margin-top:9px;font:9px Lora,serif;color:#6c604c">Положительное число — планируемый доход, отрицательное — расход. Это не меняет монеты героя.</div></div>';
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
        '<button class="zgp-tab ' + (ui.tab === 'stats' ? 'on' : '') + '" onclick="zgProgressionTab(\'stats\')">' + STAT_ICONS.str + ' Характеристики</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'spells' ? 'on' : '') + '" onclick="zgProgressionTab(\'spells\')">📚 Каталог</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'items' ? 'on' : '') + '" onclick="zgProgressionTab(\'items\')">🎒 Товары</button>' +
        '<button class="zgp-tab ' + (ui.tab === 'notes' ? 'on' : '') + '" onclick="zgProgressionTab(\'notes\')">🪶 Заметки</button>' +
      '</div>' + panel;
  }

  function footerHtml(character) {
    return '<div class="zgp-foot-note">План сохраняется отдельно от характеристик героя. ' +
      'Он не повышает уровень, не меняет лист, инвентарь, деньги или состояние на Арене.</div>';
  }

  function render() {
    var overlay = document.getElementById('zg-progression-overlay');
    var character = getCharacter(ui.charId);
    if (!overlay || !character) return;
    var plan = ensurePlan(character);
    plan.selectedLevel = ui.level;
    var modeBar = '<div class="zgp-modebar">' +
      '<button class="zgp-modebtn ' + (ui.mode === 'roadmap' ? 'on' : '') +
        '" onclick="zgProgressionMode(\'roadmap\')">✦ Роадмапа прокачки</button>' +
      '<button class="zgp-modebtn ' + (ui.mode === 'builder' ? 'on' : '') +
        '" onclick="zgProgressionMode(\'builder\')">🧬 Быстрый конструктор</button>' +
      (ui.mode === 'roadmap'
        ? '<button class="zgp-help" onclick="zgProgressionRulesHelp()" title="Как характеристики влияют на героя" aria-label="Памятка по характеристикам">?</button>'
        : '') + '</div>';
    var content = ui.mode === 'builder'
      ? '<main class="zgp-road-body"><div class="zgp-workspace builder">' +
          builderForecastHtml() + quickBuilderHtml() + '</div></main>'
      : '<main class="zgp-road-body"><div class="zgp-workspace">' +
          roadmapForecastHtml(character) + '<div class="zgp-road-column">' +
          roadmapHtml(character) + bottomSummaryHtml(character) + '</div>' +
          selectedPlanSummaryHtml(character) + '</div>' + menuHtml(character) + '</main>';
    overlay.innerHTML = '<div id="zg-progression" role="dialog" aria-modal="true" aria-label="Планировщик прокачки">' +
      '<div class="zgp-head"><div><div class="zgp-title">✦ Путь героя · ' + esc(character.name || 'Персонаж') + '</div><div class="zgp-sub">Планирование не изменяет боевой лист героя</div></div>' +
      '<button class="zgp-close" onclick="closeProgressionPlanner()" aria-label="Закрыть">×</button></div>' +
      modeBar + content +
      '<footer class="zgp-foot">' + (ui.mode === 'roadmap' ? footerHtml(character) :
        '<div class="zgp-foot-note">Быстрый конструктор позволяет собрать развитие до выбранного уровня, но не изменяет персонажа и роадмапу.</div>') +
      '</footer></div>';
  }

  function open(charId) {
    var character = getCharacter(charId);
    if (!character) return;
    installStyles();
    var plan = ensurePlan(character);
    ui.charId = character.id;
    ui.mode = 'roadmap';
    ui.level = Math.max(Number(character.level) || 1, Math.min(11, Number(plan.selectedLevel) || ((Number(character.level) || 1) + 1)));
    if (ui.level <= Number(character.level) && Number(character.level) < 11) ui.level = Number(character.level) + 1;
    ui.tab = 'stats';
    ui.builderRace = raceNames().indexOf(character.race) >= 0 ? character.race : 'Человек';
    ui.builderLevel = Math.max(1, Math.min(11, Number(character.level) || 1));
    ui.builderStats = emptyStats();
    ui.menu = null;
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
    ui.menu = null;
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

  function toggleSpellAt(character, level, id) {
    if (!character || level <= Number(character.level)) return { changed:false };
    var entry = levelEntry(character, level, true);
    var index = entry.spellIds.findIndex(function(existing) { return sameId(existing, id); });
    if (index >= 0) {
      entry.spellIds.splice(index, 1);
      return { changed:true, added:false };
    }
    var spell = catalogEntries().find(function(item) { return sameId(item.id, id); });
    if (!spell) return { changed:false };
    var compatibility = spellCompatibility(character, spell, level);
    if (!compatibility.limitOk) {
      return { changed:false, blocked:true, reason:compatibility.reason, compatibility:compatibility };
    }
    // spellCompatibility пересчитывает прогноз и нормализует план; берём
    // актуальную ссылку на запись уровня после этого пересчёта.
    entry = levelEntry(character, level, true);
    entry.spellIds.push(spell.id);
    return { changed:true, added:true, compatibility:compatibility };
  }

  function toggleSpell(id) {
    var character = getCharacter(ui.charId);
    var result = toggleSpellAt(character, ui.level, id);
    if (!result.changed) {
      toast(result.reason ? '⚠ ' + result.reason : 'Навык не найден в Каталоге');
      return;
    }
    if (result.added && result.compatibility && !result.compatibility.ok) {
      toast('⚠ Добавлено в план с предупреждением: ' + result.compatibility.reason);
    }
    ensurePlan(character).selectedLevel = ui.level;
    savePlan(character);
    ui.confirmUntil = 0;
    render();
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

  function closePreview() {
    var old = document.getElementById('zgp-preview-overlay');
    if (old) old.remove();
  }

  function previewCard(title, badges, blocks) {
    closePreview();
    var overlay = document.createElement('div');
    overlay.id = 'zgp-preview-overlay';
    overlay.addEventListener('click', function(event) { if (event.target === overlay) closePreview(); });
    overlay.innerHTML = '<div class="zgp-preview-card"><div class="zgp-preview-top"><h3>' + esc(title) +
      '</h3><button onclick="zgProgressionClosePreview()">×</button></div>' +
      '<div class="zgp-preview-badges">' + badges.map(function(badge) {
        return badge && badge.html ? '<span>' + badge.html + '</span>' : (badge ? '<span>' + esc(badge) + '</span>' : '');
      }).join('') + '</div>' + blocks.filter(function(block) { return block && block.text; }).map(function(block) {
        return '<div class="zgp-preview-block"><b>' + esc(block.label) + '</b>' + esc(block.text) + '</div>';
      }).join('') + '</div>';
    document.body.appendChild(overlay);
  }

  function previewSpellById(id) {
    var spell = catalogEntries().find(function(item) { return sameId(item.id, id); });
    if (!spell) return;
    var type = SPELL_TYPES[spell.spellType] || { icon:'📜', label:'Навык' };
    previewCard(spell.name || 'Навык', [
      type.icon + ' ' + type.label,
      'ур. ' + spellLevel(spell),
      spell.klasse || '',
      spell.cd ? 'КД: ' + spell.cd : ''
    ], [
      { label:'ОПИСАНИЕ', text:spell.description || '' },
      { label:'ЭФФЕКТ', text:spell.effect || '' },
      { label:'БОЙ', text:spell.battle || '' },
      { label:'ОБУЧЕНИЕ', text:spell.learnText || '' },
      { label:'ОГРАНИЧЕНИЯ', text:spell.restriction || '' }
    ]);
  }

  function previewItem(item) {
    previewCard(item.name || 'Предмет', [
      item.cat || item.type || 'Товар',
      item.rarity || '',
      { html:priceHtml(item.price) }
    ], [
      { label:'УРОН', text:item.damage ? item.damage + (item.damageType ? ' · ' + item.damageType : '') : '' },
      { label:'ДАЛЬНОСТЬ', text:item.range || '' },
      { label:'ЭФФЕКТ', text:item.effect || '' },
      { label:'ОПИСАНИЕ', text:item.desc || item.description || '' }
    ]);
  }

  function progressionRulesHelp() {
    previewCard('Как характеристики влияют на героя', [
      '❤ HP', '🛡 AC', '⚡ Инициатива'
    ], [
      {
        label:'❤ ВЫНОСЛИВОСТЬ → HP',
        text:'Каждое очко Выносливости даёт +2 к максимальному HP.\nИтог: расовое HP + прирост за уровни + Выносливость × 2.'
      },
      {
        label:'🛡 ЛОВКОСТЬ → AC',
        text:'Каждые полные 3 очка Ловкости дают +1 AC.\n0–2 = +0; 3–5 = +1; 6–8 = +2; 9–11 = +3.'
      },
      {
        label:'⚡ ВОСПРИЯТИЕ → ИНИЦИАТИВА',
        text:'Каждые 2 полных очка Восприятия дают +1 инициативы.\nЛовкость инициативу не повышает. Расовые свойства, навыки и предметы прибавляются сверху.'
      },
      {
        label:'✦ СТАРТОВОЕ РАСПРЕДЕЛЕНИЕ',
        text:'Распредели 4 стартовых очка, но не больше +2 в одну характеристику. Расовый бонус считается отдельно.'
      }
    ]);
  }

  function viewShopItem(id) {
    var item = shopItems().find(function(candidate) { return sameId(candidate.id, id); });
    if (!item) return;
    if (typeof global.zgShopView === 'function') {
      global.zgShopView(item.id);
      var popup = document.getElementById('shop-view-popup');
      if (popup) popup.style.zIndex = '100220';
      return;
    }
    previewItem(item);
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

  global.openProgressionPlanner = open;
  global.closeProgressionPlanner = close;
  global.zgProgressionClosePreview = closePreview;
  global.zgProgressionRulesHelp = progressionRulesHelp;
  global.zgProgressionPreviewSpellId = function(id) { previewSpellById(id); };
  global.zgProgressionViewShopId = function(id, encoded) {
    viewShopItem(encoded ? decodeURIComponent(String(id)) : id);
  };
  global.zgProgressionViewWeapon = function(index) {
    var item = ui.weaponItems[Number(index) || 0];
    if (!item) return;
    var source = shopItems().find(function(candidate) {
      return sameId(candidate.id, item.id || item.shopItemId || item.itemId) ||
        String(candidate.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
    });
    if (source) {
      viewShopItem(source.id);
      return;
    }
    var copy = Object.assign({}, item);
    if (!copy.damage) {
      var match = String(copy.description || '').match(/урон\s*:\s*([^\n\r]+)/i);
      if (match) copy.damage = match[1].trim();
    }
    previewItem(copy);
  };
  global.zgProgressionViewSpell = function(level, index) {
    var character = getCharacter(ui.charId);
    if (!character) return;
    var entry = levelEntry(character, Number(level) || ui.level, false);
    var id = entry.spellIds[Number(index) || 0];
    if (id != null) previewSpellById(id);
  };
  global.zgProgressionViewItem = function(level, index) {
    var character = getCharacter(ui.charId);
    if (!character) return;
    var entry = levelEntry(character, Number(level) || ui.level, false);
    var item = entry.items[Number(index) || 0];
    if (!item) return;
    var source = shopItems().find(function(candidate) { return sameId(candidate.id, item.id); });
    if (source) viewShopItem(source.id);
    else previewItem(item);
  };
  global.zgProgressionMode = function(mode) {
    ui.mode = mode === 'builder' ? 'builder' : 'roadmap';
    ui.menu = null;
    ui.search = '';
    render();
  };
  global.zgProgressionBuilderRace = function(race) {
    if (raceNames().indexOf(race) < 0) return;
    ui.builderRace = race;
    var raceProjection = builderProjection(ui.builderRace, ui.builderLevel);
    ui.builderStats = trimBuilderStats(ui.builderStats, raceProjection.points, raceProjection.statCap);
    render();
  };
  global.zgProgressionBuilderLevel = function(level) {
    ui.builderLevel = Math.max(1, Math.min(11, Number(level) || 1));
    var levelProjection = builderProjection(ui.builderRace, ui.builderLevel);
    ui.builderStats = trimBuilderStats(ui.builderStats, levelProjection.points, levelProjection.statCap);
    render();
  };
  global.zgProgressionBuilderStat = function(key, delta) {
    if (STAT_ORDER.indexOf(key) < 0) return;
    var projection = builderProjection(ui.builderRace, ui.builderLevel, ui.builderStats);
    delta = Number(delta) || 0;
    if (delta > 0 && projection.free <= 0) return;
    if (delta > 0 && (Number(ui.builderStats[key]) || 0) >= projection.statCap) return;
    ui.builderStats[key] = Math.max(0, (Number(ui.builderStats[key]) || 0) + delta);
    render();
  };
  global.zgProgressionOpenMenu = function(level) {
    ui.level = Math.max(1, Math.min(11, Number(level) || 1));
    ui.menu = 'root';
    ui.search = '';
    ui.confirmUntil = 0;
    var character = getCharacter(ui.charId);
    if (character) {
      ensurePlan(character).selectedLevel = ui.level;
      savePlan(character);
    }
    render();
  };
  global.zgProgressionCloseMenu = function() {
    ui.menu = null;
    ui.search = '';
    render();
  };
  global.zgProgressionMenuSection = function(section) {
    ui.menu = section || 'root';
    ui.tab = section === 'root' ? 'stats' : section;
    ui.search = '';
    render();
  };
  global.zgProgressionRemovePlan = function(level, kind, key) {
    var character = getCharacter(ui.charId);
    level = Math.max(1, Math.min(11, Number(level) || 1));
    if (!character || level <= Number(character.level)) return;
    var entry = levelEntry(character, level, true);
    if (kind === 'stat') entry.stats[key] = 0;
    else if (kind === 'spell') entry.spellIds.splice(Number(key) || 0, 1);
    else if (kind === 'item') entry.items.splice(Number(key) || 0, 1);
    else if (kind === 'gold') entry.gold.splice(Number(key) || 0, 1);
    else if (kind === 'note') entry.notes.splice(Number(key) || 0, 1);
    savePlan(character);
    ui.confirmUntil = 0;
    render();
  };
  global.zgProgressionSelectLevel = function(level) {
    ui.level = Math.max(1, Math.min(11, Number(level) || 1));
    ui.menu = null;
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
  global.zgProgressionAddGold = function() {
    var amountInput = document.getElementById('zgp-gold-amount');
    var noteInput = document.getElementById('zgp-gold-note');
    var amount = Number(amountInput && amountInput.value) || 0;
    if (!amount) {
      toast('Введите сумму золота, например 50 или -20');
      return;
    }
    var note = String(noteInput && noteInput.value || '').trim();
    mutateEntry(function(entry) { entry.gold.push({ amount:amount, note:note }); });
  };
  global.ZargotaProgression = {
    ensurePlan: ensurePlan,
    levelEntry: levelEntry,
    levelAllowance: levelAllowance,
    projectedStats: projectedStats,
    builderProjection: builderProjection,
    builderUsedPoints: builderUsedPoints,
    builderStatCap: builderStatCap,
    trimBuilderStats: trimBuilderStats,
    spellTypeLimit: spellTypeLimit,
    spellTypeCounts: spellTypeCounts,
    extractRequirements: extractRequirements,
    spellCompatibility: spellCompatibility,
    toggleSpellAt: toggleSpellAt,
    priceToCopper: priceToCopper,
    coinsToCopper: coinsToCopper,
    plannedGold: plannedGold,
    validateApply: validateApply
  };
})(window);
