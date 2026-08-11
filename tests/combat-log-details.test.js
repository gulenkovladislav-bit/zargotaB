'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(html, /function journalDetailHtml\(/);
assert.match(html, /w\.zgVttLogOpen=function\(id\)/);
assert.match(html, /id="zg-vtt-log-detail"/);
assert.match(html, /data-log-id=/);
assert.match(html, /Скрытые параметры броска доступны только мастеру/);
assert.match(html, /Поглощено временными HP/);
assert.match(html, /Снято здоровья/);

['deep-night','predawn','dawn','morning','noon','day','sunset','evening'].forEach(function(key){
  assert.ok(fs.existsSync(path.join(root, 'images', 'ui', 'time-phases', key + '.png')), 'missing time phase ' + key);
});
['armor','speed','initiative'].forEach(function(key){
  assert.ok(fs.existsSync(path.join(root, 'images', 'ui', 'stats', key + '.png')), 'missing stat icon ' + key);
});

console.log('combat log details and generated UI assets contract passed');
