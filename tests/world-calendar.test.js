'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

const calendarMatch = html.match(/var ZARGOTA_CALENDAR=(\{[\s\S]*?\});\s*w\.ZARGOTA_CALENDAR/);
assert.ok(calendarMatch, 'calendar must have one shared catalog');
const calendar = Function(`"use strict"; return (${calendarMatch[1]});`)();

assert.strictEqual(calendar.id, 'zargota-lvk');
assert.strictEqual(calendar.title, 'Летоисчисление от Великого Корня');
assert.strictEqual(calendar.anchorYear, 1276);
assert.strictEqual(calendar.anchorDayOfYear, 156, 'day zero must be the 67th day of summer');
assert.strictEqual(calendar.daysPerYear, 360);
assert.strictEqual(calendar.seasons.length, 4);
assert.deepStrictEqual(calendar.seasons.map((season) => season.name), [
  'Зелёный Восход',
  'Летний Расцвет',
  'Золотой Листопад',
  'Серебряный Мороз'
]);
assert.strictEqual(calendar.phases.length, 8, 'the dial must have eight atmospheric phases');
assert.deepStrictEqual(calendar.phases.map((phase) => phase.key), [
  'deep-night','predawn','dawn','morning','noon','day','sunset','evening'
]);

assert.match(html, /displayMode===['"]phase['"]\?['"]phase['"]:['"]exact['"]/);
assert.match(html, /Что знают игроки/);
assert.match(html, /Точное время/);
assert.match(html, /Время суток/);
assert.match(html, /isRestDay=\(dayOfYear\+1\)%5===0/);
assert.match(html, /67-й день Летнего Расцвета/);
assert.match(html, /1276 ЛВК/);
assert.match(html, /class="zg-time-sky-icon"/);
assert.match(html, /\.phase-deep-night \.zg-time-sky-icon/);
assert.match(html, /\.phase-sunset \.zg-time-sky-icon/);
assert.match(html, /class="zg-season-glyph season-/);
assert.match(html, /\.zg-season-glyph\.season-green-rise/);
assert.match(html, /\.zg-season-glyph\.season-silver-frost/);
assert.match(
  html,
  /\.zg-world-clock\{box-sizing:border-box;z-index:18;left:14px;right:auto;top:14px;bottom:auto;width:204px;/,
  'the room clock must use the compact upper-left card geometry'
);
assert.match(
  html,
  /\.zg-game-overlay\.gm \.zg-world-clock\{top:72px\}/,
  'the GM clock must sit below the master toolbar'
);
assert.match(
  html,
  /\.zg-game-overlay:has\(\.zg-combat-bar\.open\) \.zg-world-clock\{visibility:hidden;/,
  'the combat initiative panel must replace, not overlap, the room clock'
);
assert.match(
  html,
  /\.zg-world-clock\.mode-phase \.zg-world-clock-copy em\{display:none\}/,
  'approximate time must not repeat a redundant explanatory line'
);
assert.doesNotMatch(html, /\.zg-world-clock\{min-width:252px/, 'legacy oversized clock geometry must stay removed');
assert.match(html, /zgGmSetExactWorldTime/);
assert.match(html, /zgGmSetDayPhase/);

assert.match(network, /calendarId:String\(clock\.calendarId\|\|'zargota-lvk'\)/);
assert.match(network, /displayMode:clock\.displayMode==='phase'\?'phase':'exact'/);
assert.match(network, /gmSetWorldClock: function \(operation\)/);
assert.match(network, /session\.role!=='master'/);

console.log('world calendar contract passed');
