const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const syncStart = html.indexOf('function syncJourney(snapshot)');
const syncEnd = html.indexOf('// «Да» — закрепляем локальный лист', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart, 'journey synchronization block must exist');
const syncBlock = html.slice(syncStart, syncEnd);

assert.doesNotMatch(syncBlock, /мастер выбирает сцену/i, 'waiting journey must not show the master scene-selection caption');
assert.match(syncBlock, /setJourneyStatus\(''\)/, 'waiting journey must leave only the loading indicator');
assert.match(html, /\.zg-journey-loader\{[^}]*bottom:8%/, 'journey loading indicator must sit lower on the screen');
assert.match(html, /node\.hidden = !value/, 'empty journey status must hide its text node');

console.log('journey waiting layout contract passed');
