const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('story-player.js', 'utf8');
const match = source.match(/filter\(function\(z\)\{return (z\.markerVisible[^;]+);\}\)/);
assert.ok(match, 'Runtime zone marker filter exists');
const visible = new Function('z', 'return ' + match[1]);
assert.equal(visible({}), false, 'Legacy zones are invisible by default');
assert.equal(visible({markerVisible:false}), false);
assert.equal(visible({markerVisible:true}), true);
for (const extra of [{blocked:true}, {enabled:false}, {spatial:true}]) {
  assert.equal(visible({markerVisible:true, ...extra}), false);
}
assert.ok(source.includes("token.markerVisible!==false"), 'Token markers remain unchanged');
console.log('PASS: zone markers require explicit visibility');
