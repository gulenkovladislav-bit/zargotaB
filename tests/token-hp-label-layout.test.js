'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /node\.classList\.add\('has-hp-bar'\)/, 'initial creature render must mark tokens that show HP');
assert.match(html, /node\.classList\.toggle\('has-hp-bar',hasHpBar\)/, 'runtime HP patches must keep the layout marker synchronized');
assert.match(html, /\.zg-vtt-token\.has-hp-bar:not\(\.hero-token\) \.zg-vtt-token-name\{top:calc\(100% \+ 12px\)\}/, 'creature names must sit below their HP bar');
assert.match(html, /\.zg-vtt-token\.disp-hero \.zg-vtt-token-name\{top:calc\(100% \+ 11px\)\}/, 'the existing player label position must stay unchanged');

console.log('token HP label layout contracts passed');
