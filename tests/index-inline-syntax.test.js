'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.indexOf('ZG_APP_CHANGELOG[0]') > html.indexOf('var ZG_APP_CHANGELOG ='), 'Changelog updates must follow its declaration');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!match[2].trim() || /\btype\s*=\s*["'](?:application\/ld\+json|importmap|module)["']/i.test(match[1])) continue;
  const line = html.slice(0, match.index).split('\n').length;
  assert.doesNotThrow(() => new vm.Script(match[2], { filename: `index.html:script-at-${line}` }));
  count++;
}
assert.ok(count > 0);
console.log(`Parsed ${count} inline scripts successfully`);
