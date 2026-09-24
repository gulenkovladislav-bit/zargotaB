const assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('story-card-game.css','utf8');
const roaming=fs.readFileSync('story-cursor.js','utf8');
const svg=decodeURIComponent(css.match(/data:image\/svg\+xml,([^"\n]+)/)[1]);
for(const path of ['M3 3 L29 22 L19 24 L25 36 L20 39 L14 27 L7 34 Z','M5 6 L14 23 L26 22 M14 23 L8 30']){
 assert(svg.includes(path));assert(roaming.includes(path));
}
assert(css.includes('.zg-card-game,.zg-card-game *{cursor:url('));
assert(css.includes('3 3,auto!important'));
assert(css.includes('[contenteditable=true]{cursor:text!important}'));
console.log('Card cursor: roaming arrow geometry, scoped native cursor and input fallback passed. No browser test.');
