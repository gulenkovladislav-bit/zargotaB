const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

const catalogMatch = html.match(/var ZG_INJURY_TABLE=(\[[\s\S]*?\]);\s*w\.ZARGOTA_INJURY_TABLE/);
assert.ok(catalogMatch, 'the d20 injury catalog must have one shared source');
const catalog = Function(`"use strict"; return (${catalogMatch[1]});`)();

assert.strictEqual(catalog.length, 20, 'the injury table must contain exactly 20 outcomes');
assert.deepStrictEqual(catalog.map((injury) => injury.roll), Array.from({ length: 20 }, (_, index) => index + 1));
catalog.forEach((injury) => {
  assert.ok(injury.key && injury.icon && injury.name, `injury ${injury.roll} must be identifiable`);
  assert.ok(injury.effect && injury.treatment && injury.severity, `injury ${injury.roll} must explain effect and treatment`);
});
assert.match(catalog[18].name, /Ампутация руки/);
assert.match(catalog[19].name, /Ампутация ноги/);

assert.match(html, /gmInterventionTab==='injuries'/, 'GM workspace must expose the injuries tab');
assert.match(html, /w\.zgGmInjuryRoll=function/, 'GM must be able to roll d20');
assert.match(html, /w\.zgGmInjuryApply=function/, 'GM must be able to add a reviewed injury');
assert.match(html, /w\.zgGmInjuryRemoveConfirm=function/, 'injury removal must require confirmation');
assert.match(html, /onclick="zgVttInjuryInfo\(/, 'filled hero injury slots must open details');
assert.match(html, /window\.ZARGOTA_INJURY_TABLE/, 'Manual must render the shared injury catalog');
assert.match(html, /injuryPenalty=Math\.min\(30,stateInjurySource\.length\*10\)/, 'hero sheet must apply the Manual HP cap penalty');

assert.match(network, /kind==='injury'/, 'Firebase GM operation must accept injury mutations');
assert.match(network, /character\/injuries/, 'injuries must persist on the member character');
assert.match(network, /entry\.injuries=injuries/, 'injuries must be mirrored into active combat');
assert.match(network, /updates\[path\+'\/injuries'\]=injuries/, 'injuries must be mirrored to scene tokens');
assert.match(network, /injury-limit/, 'the four injury slot limit must be enforced server-side');
assert.match(network, /kind==='injury'\?'gm-injury'/, 'injury changes must emit a dedicated room/combat event');

console.log('injury system contract passed');
