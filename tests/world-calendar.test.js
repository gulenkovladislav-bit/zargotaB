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
assert.deepStrictEqual(calendar.canonDate, { year: 1276, seasonIndex: 1, day: 67, seasonLabel: 'Летнего Расцвета', status: 'Актуально!' }, 'the authored current date remains explicit and easy to update');
assert.strictEqual(calendar.daysPerYear, 360);
assert.strictEqual(calendar.seasons.length, 4);
assert.ok(calendar.seasons.every((season) => season.holiday && season.holiday.name && season.holiday.day), 'every season exposes its authored holiday to players');
assert.ok(calendar.seasons.every((season) => season.holiday.description), 'every holiday has a short player-facing explanation');
assert.deepStrictEqual(calendar.seasons.map((season) => season.holiday.day), [1,45,60,90], 'holiday dates are authored as days within their own seasons');
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
assert.match(html, /<u><span>1276 Год<\/span><span>Великого Корня<\/span><\/u>/, 'the widget presents the calendar era as two deliberate lines');
assert.match(html, /function worldClockPlayerDetails\(view\)/, 'the player clock provides an expanded calendar card');
assert.match(html, /class="zg-world-clock-details"/, 'the expanded card is rendered inside the clock widget');
assert.match(html, /Ближайший праздник/, 'the expanded card names the nearest holiday');
assert.match(html, /data-description="'\+esc\(description\)\+'"/, 'each holiday card carries its short hover explanation');
assert.match(html, /\.zg-world-clock-holidays>span:hover:after/, 'hovering a holiday reveals the custom explanation bubble');
assert.match(html, /Каждый пятый день календаря/, 'the expanded card explains rest days');
assert.match(html, /aria-describedby','zg-world-clock-details'/, 'players can reach the expanded information with keyboard focus');
assert.match(html, /\.zg-world-clock\.player:hover \.zg-world-clock-details/, 'hovering the player widget reveals the calendar details');
assert.match(html, /@keyframes zgWorldClockArrival/, 'time changes use a dedicated smooth arrival animation');
assert.match(html, /clockChanged[\s\S]*classList\.add\('time-changing'\)/, 'a new synchronized revision triggers the player animation');
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
assert.match(html, /zgGmWorldClockWidget\(\\'always\\'\)/, 'the room-wide clock visibility control lives in the GM time panel');
assert.match(html, /zgGmWorldClockWidget\(\\'brief\\'\)/, 'the GM can switch the player clock to brief arrivals without scene settings');
assert.match(html, /zgGmPulseWorldClock\(\)/, 'the time panel keeps a small explicit reminder action');
assert.match(html, /gameSettingsTab=\['players','visibility'\]/, 'legacy scene-bound clock controls are removed from general settings');
assert.match(html, /w\.zgGmClockStep=function\(field,delta\)/, 'date and time fields expose compact minus and plus controls');
assert.match(html, /zgGmClockStep\(\\'minute\\',5\)/, 'minute controls advance in convenient five-minute steps');
assert.match(html, /class="zg-gm-canon-date"/, 'the GM sees the compact canonical-date shortcut');
assert.match(html, /Дата сегодня/, 'the canonical-date shortcut explains its purpose');
assert.match(html, /w\.zgGmSetCanonWorldDate=function/, 'the canonical-date shortcut has a dedicated update action');
assert.match(html, /relativeDay\*1440\+view\.minuteOfDay,view\.displayMode/, 'restoring the canonical date preserves current hours and display mode');
assert.match(html, /\.zg-gm-canon-date\{/, 'the canonical-date shortcut has a custom visual treatment');
assert.match(html, /data-phase-key=/, 'phase cards expose their keys for automatic selection');
assert.match(html, /w\.zgGmClockPreviewPhase=function/, 'editing hours updates the highlighted phase preview');
assert.match(html, /setWorldClockTarget\(relativeDay\*1440\+hour\*60\+minute,currentView\.displayMode/, 'applying an exact date preserves the selected player display mode');
assert.match(html, /\.zg-gm-clock-step>div>button:hover/, 'clock steppers have authored hover feedback');

assert.match(network, /calendarId:String\(clock\.calendarId\|\|'zargota-lvk'\)/);
assert.match(network, /displayMode:clock\.displayMode==='phase'\?'phase':'exact'/);
assert.match(network, /gmSetWorldClock: function \(operation\)/);
assert.match(network, /gmSetWorldClockWidget: function \(mode\)/, 'clock visibility is synchronized through the room API');
assert.match(network, /widgetMode:\['always','brief','hidden'\]/, 'room clock snapshots preserve their visibility mode');
assert.match(network, /session\.role!=='master'/);

console.log('world calendar contract passed');
