'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var start = html.indexOf('(function(w){\n  function portraitThumb(character)');
var end = html.indexOf('})(window);', start) + '})(window);'.length;
assert.ok(start >= 0 && end > start, 'shared session portrait resolver must exist');

var context = { window:{ characters:[] }, Array:Array, String:String };
vm.runInNewContext(html.slice(start, end), context);
var resolvePortrait = context.window.zgResolveSessionHeroPortrait;

var local = { id:42, name:'Ярвик Плакса', portrait:'images/portraits/yarvik.webp', portraitThumb:'data:image/webp;base64,LOCAL' };
var member = { uid:'player-1', characterId:'42', character:{ id:'42', name:'Ярвик Плакса', portrait:'' } };
assert.strictEqual(resolvePortrait(member, {}, [local]), local.portraitThumb,
  'a new hero token must reuse the portable portrait from the matching local sheet');
assert.strictEqual(resolvePortrait({character:{name:'Ярвик Плакса',portrait:''}}, {}, [local]), local.portraitThumb,
  'a unique exact hero name repairs an older session snapshot without an id');
assert.strictEqual(resolvePortrait({character:{id:'42',portrait:'data:image/webp;base64,ROOM'}}, {portrait:'data:image/webp;base64,OLD'}, []), 'data:image/webp;base64,ROOM',
  'the current member portrait must replace a stale combat-order portrait');
assert.strictEqual(resolvePortrait({}, {portrait:'images/fallback.webp'}, []), 'images/fallback.webp',
  'creature and legacy entry portraits remain valid fallbacks');

assert.match(html, /function tokenPortrait\(token\)[\s\S]{0,360}zgResolveSessionHeroPortrait\(member,token,w\.characters\)/,
  'map hero tokens must use the shared portrait resolver');
assert.match(html, /function combatEntryPortrait\(entry\)[\s\S]{0,420}memberPortrait\(member,entry\)/,
  'combat portraits must refresh from the current member instead of freezing the initial order snapshot');
assert.match(html, /portrait:w\.zgResolveSessionHeroPortrait\?w\.zgResolveSessionHeroPortrait\(member,character,w\.characters\)/,
  'local combat setup must store the portable resolved hero portrait');
assert.match(html, /var heroHtml=heroes\.map\([\s\S]{0,260}portrait=memberPortrait\(member,c\)/,
  'the combat participant picker must use the same resolved hero portrait');

console.log('session hero portrait fallback passed');
