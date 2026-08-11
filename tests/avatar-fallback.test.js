'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  var failedAvatarSources=Object.create(null)');
const end = html.indexOf('  function hpPercent', start);
assert.ok(start > 0 && end > start, 'avatar fallback block must exist');
const source = html.slice(start, end);

assert.match(source, /failedAvatarSources\[source\]=true/, 'a failed URL is remembered for this page lifetime');
assert.match(source, /replaceChild\(fallback,image\)/, 'broken image is replaced without rebuilding its parent');
assert.match(source, /portrait&&!failedAvatarSources\[portrait\]/, 'later renders do not request the same broken portrait again');
assert.match(source, /onerror="zgAvatarImageError\(this\)"/, 'avatar markup reports the first failed request');

console.log('avatar fallback contract passed');
