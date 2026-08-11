'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sourceStart = html.indexOf('  var sceneBackgroundDecodeCache=Object.create(null)');
const sourceEnd = html.indexOf('  function finishTokenDrag', sourceStart);
assert.ok(sourceStart > 0 && sourceEnd > sourceStart, 'scene background runtime must exist');
const source = html.slice(sourceStart, sourceEnd);

assert.doesNotMatch(source, /bg\.innerHTML\s*=\s*['"]['"]/, 'Firebase renders must not rebuild heavy background nodes');
assert.match(source, /data-layer-id/, 'background nodes are reconciled by stable layer id');
assert.match(source, /decodeSceneBackground\(renderSource,layer\.image\)/, 'one cached decode precedes applying a scene background');
assert.match(source, /map-vtt-2048\.webp/, 'balanced clients receive the compact map');
assert.match(source, /map-vtt-3072\.webp/, 'large high-DPR clients retain a detailed map');

const original = fs.statSync(path.join(root, 'images/map.jpg')).size;
const compact = fs.statSync(path.join(root, 'images/map-vtt-2048.webp')).size;
const detailed = fs.statSync(path.join(root, 'images/map-vtt-3072.webp')).size;
assert.ok(compact < original * 0.08, 'compact map should be less than 8% of the original transfer');
assert.ok(detailed < original * 0.15, 'detailed map should be less than 15% of the original transfer');

console.log('scene background runtime passed');
