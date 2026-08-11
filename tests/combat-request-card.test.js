'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function actionRequestDisplayText\(request\)/, 'request cards need one canonical readable summary');
assert.match(html, /text\.toLocaleLowerCase\(\)\.indexOf\(name\.toLocaleLowerCase\(\)\+' '\)===0/, 'attack summaries must not repeat the actor name');
assert.match(html, /text\.replace\(\/\\s\*·\\s\*⚠\\s\*ВНЕ ДИСТАНЦИИ:/, 'range warnings must be removed from duplicate prose and kept in the dedicated tag');
assert.match(html, /summary\.className='zg-action-request-summary'/, 'the summary must have a readable dedicated element');
assert.match(html, /actions\.classList\.add\('attack-actions'\)/, 'attack controls need an explicit layout hook');
assert.match(html, /\.zg-move-request-actions\.attack-actions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/, 'attack modes must form one readable row');
assert.match(html, /bonusTitle\.textContent='Дополнительный урон'/, 'bonus dice controls need a clear label');
assert.match(html, /\.zg-attack-bonus-control\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/, 'bonus selects must share the available card width');
assert.match(html, /\.zg-attack-bonus-control select\{[^}]*width:100%[^}]*max-width:100%/, 'dropdowns must stay inside the request card');

console.log('combat request card contracts passed');
