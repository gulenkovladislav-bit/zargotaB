const fs=require('node:fs'),assert=require('node:assert/strict');
const graph=fs.readFileSync('story-graph.js','utf8');
assert.match(graph,/querySelector\('\[data-story-add-link\]'\)[\s\S]*addLine\.remove\(\)/,'The obsolete Add line button is removed from the inspector');
assert.match(graph,/t\('Не подключено','Не підключено'\)/,'Detached ports are named clearly in both locales');
console.log('PASS: dialogue inspector removes automatic Add line and labels detached ports clearly.');
