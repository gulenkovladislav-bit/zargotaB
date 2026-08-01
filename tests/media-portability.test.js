const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const exportStart = html.indexOf('window.zgExportDataJson = function');
const exportEnd = html.indexOf('window.zgDownloadCurrentDataSnapshot', exportStart);
const exportSource = html.slice(exportStart, exportEnd);

assert.ok(exportStart >= 0 && exportEnd > exportStart, 'world export function must exist');
assert.match(exportSource, /items\.filter\(function\(it\) \{ return it && it\.path && it\.blob; \}\)/,
  'export must retain every locally stored image until publication is explicitly confirmed');
assert.doesNotMatch(exportSource, /\.markPublished\(/,
  'downloading a ZIP must not mark images as published before commit and push');

assert.match(html, /function zgItemVisualMarkup\(item, fallback, extraStyle\)/,
  'item renderer must understand portable images and generated art icons');
assert.match(html, /window\.zgItemIconMarkup = zgItemIconMarkup;/,
  'isolated session UI must be able to reuse the generated item icon renderer');
assert.match(html, /String\(item\.imageThumb \|\| item\.image \|\| ''\)/,
  'portable item thumbnail must win over a repository-only image path');
assert.match(html, /function zgShopImageSource\(item\)[\s\S]*item\.imageThumb \|\| item\.image/,
  'shop cards must prefer the portable image shared with other clients');
assert.match(html, /window\.zgShopImageSource = zgShopImageSource;/,
  'portable shop media resolver must be available to other UI modules');
assert.match(html, /setShopImagePreparing\(true\)/,
  'shop editor must lock saving while a portable preview is being prepared');
assert.match(html, /if \(shopImagePreparing\)/,
  'shop editor must reject premature saving of an unfinished custom image');

console.log('media portability contract passed');
