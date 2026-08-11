'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /var localWorkshop=!!\(snapshot&&snapshot\.room&&snapshot\.room\.code==='TEST'&&w\.zgLocalCombatQaActive&&w\.zgLocalCombatQaActive\(\)\)/, 'TEST workshop is identified independently from online connection state');
assert.match(html, /snapshot&&snapshot\.session&&!snapshot\.online&&!localWorkshop/, 'intentional offline workshop never raises a reconnect error');
assert.match(html, /var workshopLocal=el\('zg-workshop-local'\);if\(workshopLocal\)workshopLocal\.hidden=!localWorkshop/, 'local workshop marker follows the active test snapshot');
assert.match(html, /id="zg-workshop-local"[^>]*aria-label="Локальная мастерская · Firebase не используется"/, 'compact local marker explains why no Firebase connection is expected');
assert.match(html, /\.zg-workshop-local\[hidden\]\{display:none!important\}/, 'local marker never consumes space in real sessions');

console.log('workshop connection state contracts passed');
