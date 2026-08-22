'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const saveLayer = html.match(/\.zg-combat-save\{z-index:(\d+);width:/);
const sceneDrawerLayer = html.match(/\.zg-scene-drawer\{[^}]*z-index:(\d+)/);
const portraitMenuLayer = html.match(/\.zg-combat-round-popover\{[^}]*z-index:(\d+)/);

assert.ok(saveLayer, 'the saving-throw form declares an explicit foreground layer');
assert.ok(sceneDrawerLayer, 'the scene library layer remains discoverable');
assert.ok(portraitMenuLayer, 'the portrait action menu layer remains discoverable');
assert.ok(Number(saveLayer[1]) > Number(sceneDrawerLayer[1]), 'the saving-throw form opens above the scene library and its backdrop');
assert.ok(Number(saveLayer[1]) > Number(portraitMenuLayer[1]), 'the form replaces the portrait menu on a higher layer after the click');
assert.match(html, /w\.zgPortraitSavingThrow=function\(event,key\)[\s\S]*?w\.zgCombatSaveToggle\?w\.zgCombatSaveToggle\(true\):false;/, 'the portrait action still opens the saving-throw form');

console.log('portrait saving-throw layering contract passed');
