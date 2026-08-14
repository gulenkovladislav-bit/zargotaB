const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

const catalogMatch = html.match(/var ZG_INJURY_TABLE=(\[[\s\S]*?\]);\s*function injuryIconMarkup/);
assert.ok(catalogMatch, 'the d20 injury catalog must have one shared source');
const catalog = Function(`"use strict"; return (${catalogMatch[1]});`)();

assert.strictEqual(catalog.length, 20, 'the injury table must contain exactly 20 outcomes');
assert.deepStrictEqual(catalog.map((injury) => injury.roll), Array.from({ length: 20 }, (_, index) => index + 1));
catalog.forEach((injury) => {
  assert.ok(injury.key && injury.icon && injury.name, `injury ${injury.roll} must be identifiable`);
  assert.ok(injury.effect && injury.treatment && injury.severity, `injury ${injury.roll} must explain effect and treatment`);
  assert.match(injury.iconPath, /^images\/vtt-injuries\/[a-z0-9-]+\.png$/, `injury ${injury.roll} must use a local PNG icon`);
  assert.ok(fs.existsSync(path.join(root, injury.iconPath)), `injury ${injury.roll} icon must exist`);
});
assert.match(catalog[18].name, /Ампутация руки/);
assert.match(catalog[19].name, /Ампутация ноги/);

assert.match(html, /gmInterventionTab==='injuries'/, 'GM workspace must expose the injuries tab');
assert.match(html, /w\.zgGmInjuryRoll=function/, 'GM must be able to roll d20');
assert.match(html, /w\.zgGmInjuryApply=function/, 'GM must be able to add a reviewed injury');
assert.match(html, /w\.zgGmInjuryRemoveConfirm=function/, 'injury removal must require confirmation');
assert.match(html, /onclick="zgVttInjuryInfo\(/, 'filled hero injury slots must open details');
assert.match(html, /data-injury-id="'\+esc\(typeof injury==='object'&&injury\.id\|\|''\)/, 'filled injury slots keep a stable injury id');
assert.match(html, /current\.find\(function\(item\).*String\(item\.id\|\|''\)===String\(injuryId\)/, 'injury details resolve against the currently viewed GM/player sheet');
assert.match(html, /window\.ZARGOTA_INJURY_TABLE/, 'Manual must render the shared injury catalog');
assert.match(html, /injuryPenalty=Math\.min\(30,stateInjurySource\.length\*10\)/, 'hero sheet must apply the Manual HP cap penalty');
assert.match(html, /w\.zgInjuryIconMarkup=injuryIconMarkup/, 'injury icons must use the shared local-image renderer');
assert.match(html, /\.zg-state-injury i \.zg-injury-icon\{width:38px;height:38px\}/, 'character-sheet injury art must have a stable size');
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\.open\{z-index:36/, 'the combat turn widget must not cover injury cards');
assert.match(html, /typeof w\.zgInjuryIconMarkup==='function'\?w\.zgInjuryIconMarkup\(injury,'zg-injury-icon'\)/, 'the character drawer must call the shared injury renderer across module boundaries');
const characterStatsStart = html.indexOf('function characterStats(member){');
const characterStatsEnd = html.indexOf('function inventoryItemCategory(item){', characterStatsStart);
const characterStatsSource = html.slice(characterStatsStart, characterStatsEnd);
assert.doesNotMatch(characterStatsSource, /<i>'\+injuryIconMarkup\(injury,'zg-injury-icon'\)/, 'the character drawer must not call the scene-private injury renderer directly');
assert.doesNotMatch(html, /class="zg-state-injury filled"[\s\S]{0,220}<i>'\+esc\(typeof injury==='object'&&injury\.icon/, 'filled injury slots must not fall back to emoji when local art exists');

const injuryInfoStart = html.indexOf('  w.zgVttInjuryInfo=function(index,injuryId){');
const injuryInfoEnd = html.indexOf('\n  w.zgVttStatusInfo=function(index){', injuryInfoStart);
assert.ok(injuryInfoStart >= 0 && injuryInfoEnd > injuryInfoStart, 'injury detail handler must remain extractable');
const injuryInfoSource = html.slice(injuryInfoStart, injuryInfoEnd);
assert.match(injuryInfoSource, /typeof w\.zgInjuryIconMarkup==='function'\?w\.zgInjuryIconMarkup/, 'injury detail modal must use the exported renderer across module boundaries');
assert.doesNotMatch(injuryInfoSource, /[^.\w]injuryIconMarkup\(/, 'injury detail modal cannot call the scene-private renderer directly');
let appendedInjuryModal = null;
const injuryModalElement = {
  id: '', className: '', innerHTML: '', onclick: null,
  style: { setProperty() {} },
  setAttribute() {},
  querySelector() { return { focus() {} }; }
};
const injuryInfoWindow = {
  zgVttStatusInfoClose() {},
  zgVttStatusInfoBackdrop() {},
  zgInjuryIconMarkup(injury) { return `<img src="${injury.iconPath}" alt="">`; }
};
const injuryInfoDocument = {
  createElement() { return injuryModalElement; },
  body: { appendChild(node) { appendedInjuryModal = node; } }
};
const injuryRecord = { id:'inj-arm', roll:1, name:'Сломанная рука', severity:'Тяжёлая', effect:'−1 к атакам', treatment:'Шина', iconPath:'images/vtt-injuries/broken-arm.png' };
const installInjuryInfo = Function('w','document','drawerInjuryDetails','drawerMember','fullLocalCharacter','esc', `${injuryInfoSource}; return w.zgVttInjuryInfo;`);
const openInjuryInfo = installInjuryInfo(injuryInfoWindow, injuryInfoDocument, [injuryRecord], () => ({ character:{ injuries:[injuryRecord] } }), () => null, (value) => String(value == null ? '' : value));
assert.doesNotThrow(() => openInjuryInfo(0, 'inj-arm'), 'clicking a filled injury slot must not fail before mounting its dialog');
assert.strictEqual(appendedInjuryModal, injuryModalElement, 'injury click must append a visible detail dialog');
assert.match(injuryModalElement.innerHTML, /Сломанная рука/, 'injury detail dialog renders the selected injury');
assert.match(injuryModalElement.innerHTML, /images\/vtt-injuries\/broken-arm\.png/, 'injury detail dialog renders the shared injury art');

assert.match(network, /kind==='injury'/, 'Firebase GM operation must accept injury mutations');
assert.match(network, /character\/injuries/, 'injuries must persist on the member character');
assert.match(network, /function injuryPenaltyPercent\(injuries\)/, 'injury HP penalty must be available in the network runtime');
assert.match(network, /character\/hpMax'\]=hpMax/, 'injury operations must persist the adjusted maximum HP');
assert.match(network, /entry\.injuries=injuries/, 'injuries must be mirrored into active combat');
assert.match(network, /updates\[path\+'\/injuries'\]=injuries/, 'injuries must be mirrored to scene tokens');
assert.match(network, /injury-limit/, 'the four injury slot limit must be enforced server-side');
assert.match(network, /kind==='injury'\?'gm-injury'/, 'injury changes must emit a dedicated room/combat event');

console.log('injury system contract passed');
