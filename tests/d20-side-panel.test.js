'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /position:fixed;left:auto;right:24px;bottom:24px;width:420px/, 'desktop d20 picker must follow the viewport right edge');
assert.match(html, /width:420px;padding:20px/, 'desktop d20 picker must have room for enlarged labels');
assert.match(html, /\.zg-dice-pop\{\s*left:calc\(50% - min\(325px,46vw\)\);transform:none/, 'the dice fan must not create a transformed containing block for the fixed picker');
assert.match(html, /@keyframes zgD20SideIn\{[\s\S]*?translateX\(38px\)[\s\S]*?transform:none/, 'the d20 picker must enter softly from the right');
assert.match(html, /\.zg-dice-abils-title\{[^}]*font-size:13\.5px/, 'section labels must be readable');
assert.match(html, /\.zg-d20-stat-copy b\{font-size:14px/, 'stat names must use the enlarged type scale');
assert.match(html, /\.zg-d20-stat-copy small\{font-size:10\.5px/, 'stat abbreviations must remain readable');
assert.match(html, /\.zg-d20-modes button\{height:48px[^}]*font-size:11\.5px/, 'mode controls must fit the larger labels');
assert.match(html, /@media\(max-width:760px\)[\s\S]*?position:fixed;left:auto;right:12px;bottom:12px/, 'small screens must keep the picker on the right with a safe inset');
assert.doesNotMatch(html, /\.zg-dice-pop:has\(\.zg-dice-abils\.open\)\{left:40%\}/, 'opening the picker must no longer shove the dice fan sideways');

console.log('d20 side panel contract passed');
