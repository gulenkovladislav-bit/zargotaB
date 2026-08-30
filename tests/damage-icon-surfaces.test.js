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
assert.match(html, /#page-detail \.detail-meta \.catalog-filter-art,[\s\S]*?#page-detail \.dmg-chip \.catalog-pill-icon \{[\s\S]*?width: 20px; height: 20px; flex: 0 0 20px;/, 'catalog detail artwork must stay icon-sized instead of using intrinsic PNG dimensions');
assert.match(html, /#spell-detail-popup \.cat-chip \.catalog-pill-icon,[\s\S]*?#spell-detail-popup \.dmg-chip \.catalog-pill-icon \{[\s\S]*?width: 20px;[\s\S]*?height: 20px;[\s\S]*?flex: 0 0 20px;/, 'character spell popup artwork must stay icon-sized instead of using intrinsic PNG dimensions');
assert.match(html, /@media \(max-width: 700px\) \{[\s\S]*?#spell-detail-popup \.cat-chip \.catalog-pill-icon,[\s\S]*?#spell-detail-popup \.dmg-chip \.catalog-pill-icon \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;[\s\S]*?flex-basis: 18px;/, 'character spell popup artwork must remain compact on phones');

console.log('damage icon surfaces contract passed');
