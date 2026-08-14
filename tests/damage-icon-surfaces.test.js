const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const keys = ['fire','cold','elec','necro','holy','psych','poison','pierce','slash','blunt','acid','sound','radiant','chaos'];

keys.forEach((key) => {
  const asset = path.join(root, 'images', 'ui', 'catalog', 'damage', `${key}.png`);
  assert.ok(fs.existsSync(asset), `missing custom damage icon: ${key}`);
  assert.ok(fs.statSync(asset).size > 0, `empty custom damage icon: ${key}`);
});

assert.match(html, /function zgDamageAssetKey\(value\)/, 'damage icons need one shared alias resolver');
assert.match(html, /function zgDamageIconMarkup\(value, className\)/, 'damage surfaces need one shared image renderer');
assert.match(html, /id:'damage', icon:'<img class="manual-section-art" src="images\/ui\/catalog\/categories\/damage\.png"/, 'manual damage section uses project art instead of an emoji');
keys.forEach((key) => assert.match(html, new RegExp(`DAMAGE_TAG\\('${key}'`), `manual must render ${key} through project art`));
assert.match(html, /found\.map\(function\(key\)\{ return zgDamageIconMarkup\(key,'btype-damage-icon'\); \}\)/, 'bestiary guide weakness icons use the same project set');
assert.doesNotMatch(html, /id:'damage', icon:'💥'/, 'manual damage header no longer uses an emoji');

console.log('damage icon surfaces contract passed');
