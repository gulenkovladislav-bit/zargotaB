'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /Player HUD readability v1: authored text is 130%/, 'the final HUD readability layer must stay explicit and last');
assert.match(html, /\.zg-world-clock\{\s*width:438px;height:122px/, 'the compact world clock must grow with its 130 percent typography');
assert.match(html, /\.zg-world-clock-copy small\{font-size:12px!important/, 'the compact clock date must be readable');
assert.match(html, /\.zg-world-clock-copy strong\{font-size:34px!important/, 'the compact clock time must be readable');
assert.match(html, /\.zg-world-clock-details\{\s*width:min\(640px/, 'the expanded calendar must reflow into a wider card');
assert.match(html, /\.zg-world-clock-details-mood\{font-size:16px;line-height:1\.48\}/, 'calendar prose must stay readable inside the larger blocks');
assert.match(html, /\.zg-world-clock-details-facts>span\{[^}]*min-height:92px;[^}]*padding:15px 16px/, 'calendar fact cards must have deliberate reading space');
assert.match(html, /\.zg-world-clock-holidays>span\{[^}]*min-height:72px;[^}]*padding:11px 12px/, 'holiday cards must grow independently of the outer panel');
assert.match(html, /\.zg-world-clock-details-activities\{[^}]*min-height:78px;[^}]*padding:15px 17px/, 'season activity copy must sit in a larger readable block');
assert.match(html, /@media\(max-height:780px\)\{[\s\S]*?\.zg-world-clock-details\{[\s\S]*?max-height:calc\(100vh - 164px\);overflow-x:hidden;overflow-y:auto/, 'short screens must keep every enlarged calendar block reachable');

[
  ['str', 'Сила'],
  ['dex', 'Ловкость'],
  ['int', 'Интеллект'],
  ['cha', 'Харизма'],
  ['per', 'Восприятие'],
  ['con', 'Выносливость']
].forEach(function(entry){
  var key = entry[0];
  var label = entry[1];
  var expression = new RegExp('data-stat="' + key + '"[^>]*>[\\s\\S]*?images/ui/stats/' + key + '\\.png[\\s\\S]*?<b>' + label + '<\\/b>');
  assert.match(html, expression, label + ' must use the existing custom stat icon in the d20 panel');
});

assert.match(html, /D20 side picker v2: a readable screen-right card/, 'the d20 options must use the dedicated screen-right layout layer');
assert.match(html, /\.zg-dice-abils\{\s*position:fixed;left:auto;right:24px;bottom:24px;width:420px/, 'the d20 options must be anchored to the right edge of the screen');
assert.match(html, /\.zg-dice-pop:has\(\.zg-dice-abils\.open\)\{left:calc\(50% - min\(325px,46vw\)\)\}/, 'the physical dice fan must remain centred when the d20 panel opens');
assert.match(html, /\.zg-d20-stat-copy b\{font-size:14px/, 'd20 stat names must be substantially larger and readable');
assert.match(html, /\.zg-d20-modes button\{height:48px[\s\S]*?font-size:11\.5px/, 'roll modes must be larger without reverting to native selects');
assert.match(html, /data-mode="advantage"[^>]*>[\s\S]*?⇈[\s\S]*?Преимущество/, 'advantage must keep a quick visual cue');
assert.match(html, /data-mode="disadvantage"[^>]*>[\s\S]*?⇊[\s\S]*?Помеха/, 'disadvantage must keep a quick visual cue');
assert.match(html, /\.zg-dice-row button span\{font-size:14\.3px\}/, 'physical dice labels must grow by 30 percent');
assert.match(html, /\.zg-dice-hint\{[^}]*font-size:11\.7px/, 'dice instructions must grow by 30 percent');
assert.match(html, /\.zg-player-action-label\{font-size:14\.3px\}/, 'player dock labels must grow by 30 percent');
assert.match(html, /\.zg-vtt-token-name\{max-width:170px;font-size:14\.3px\}/, 'token names must grow without losing ellipsis protection');
assert.match(html, /\.zg-vtt-log-entry\{[^}]*font-size:13px\}/, 'journal feed text must grow by 30 percent');

assert.match(html, /var PLAYER_BAG_TEXT_SCALE=1\.3;/, 'the magic bag view must retain the shared 130 percent typography scaler');
assert.match(html, /data-backpack-skin="magic"/, 'the readable bag scaler must still cover the magic view');
assert.match(html, /\.zg-spell-catalog-card\.gm-editable\{\s*padding-right:64px/, 'the magic catalog must reserve a compact GM action rail instead of crushing enlarged spell text');

console.log('player HUD readability contract passed');
