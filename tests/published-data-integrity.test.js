const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(data.encyclopedia && Array.isArray(data.encyclopedia.entries), 'published encyclopedia must be an entry collection');
assert.ok(data.encyclopedia.entries.length >= 71, 'published encyclopedia must not regress to an empty or reduced snapshot');
assert.strictEqual(manifest.counts.encyclopedia, data.encyclopedia.entries.length, 'manifest encyclopedia count must match data.json');
assert.strictEqual(manifest.version, data.version, 'manifest and data versions must match');
assert.match(html, /publishedEncEntries\.length \|\| !localEncEntries\.length/, 'loader must preserve a fuller local encyclopedia when a published snapshot is empty');
assert.match(html, /if \(window\.zgStorePublishedWorldSnapshot\)/, 'published world snapshot must use its public cross-module API');

console.log('published data integrity contract passed');
