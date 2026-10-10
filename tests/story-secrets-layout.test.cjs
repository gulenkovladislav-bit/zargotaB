const fs=require('node:fs'),assert=require('node:assert/strict');
const css=fs.readFileSync('story-secrets.css','utf8');
assert.match(css,/\.zg-story-player \.zg-story-play-token\.is-secret\{z-index:9!important/);
assert.match(css,/\.zg-secret-found\{position:fixed;inset:0;margin:0/);
assert.match(css,/\.zg-secret-found\[open\]\{display:flex;flex-direction:column;align-items:center;justify-content:center/);
assert.match(css,/pointer-events:none;background:radial-gradient/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
console.log('PASS secret layout: below tokens, centered full-screen modal, decorative particles, reduced motion.');
