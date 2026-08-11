'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const background = path.join(root, 'images/vtt-test/combat-workshop.webp');

assert.ok(fs.existsSync(background), 'combat workshop background must exist');
const size = fs.statSync(background).size;
assert.ok(size > 100000, 'combat workshop background should contain real rendered detail');
assert.ok(size < 500000, 'combat workshop WebP should stay lightweight enough for the VTT');
assert.match(html, /name:'Мастерская · тренировочная арена',image:'images\/vtt-test\/combat-workshop\.webp',locked:true/, 'QA scene must bind the dedicated background as a locked layer');
assert.match(html, /draft\.boardWidth=20;draft\.boardHeight=14;[^\n]+draft\.grid=true;[^\n]+draft\.gridOpacity=\.26/, 'workshop should keep a readable 20 by 14 movement grid');

console.log('combat workshop background contract passed');
