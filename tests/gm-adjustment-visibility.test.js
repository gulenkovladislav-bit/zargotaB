const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(__dirname, '..', 'zargota-network.js'), 'utf8');

assert.match(html, /var gmInterventionRevealToPlayers = true;/, 'manual HP feedback is public by default');
assert.match(html, /id="zg-gm-adjustment-visibility"/, 'GM entity panel exposes one clear visibility switch');
assert.match(html, /Показ изменений игрокам/, 'the switch explains its audience');
assert.match(html, /HP изменится без числа, анимации и звука у игроков/, 'hidden mode explains that the HP mutation still happens');
assert.match(html, /gmInterventionOperation\(token,\{kind:kind,amount:amount,revealToPlayers:revealToPlayers\}\)/, 'the chosen visibility travels with the exact HP operation');

const networkStart = network.indexOf('    gmAdjustEntity: function');
const networkEnd = network.indexOf('    gmAdvanceWorldTime: function', networkStart);
const adjustmentNetwork = network.slice(networkStart, networkEnd);
assert.ok(networkStart >= 0 && networkEnd > networkStart, 'GM adjustment network operation remains extractable');
assert.match(adjustmentNetwork, /if\(\(kind==='damage'\|\|kind==='heal'\|\|kind==='temp-hp'\)&&operation\.revealToPlayers===false\)event\.visibility='gm'/, 'damage, healing and temporary HP can become GM-only presentation events');
assert.match(adjustmentNetwork, /updates\.manualEvent=event/, 'the visibility flag stays on the synchronized manual event');
assert.match(adjustmentNetwork, /if\(combat&&combat\.active\)updates\.combatEvent=event/, 'combat receives the same audience-safe event instead of a parallel public copy');
assert.match(adjustmentNetwork, /else if\(event\.visibility!=='gm'\)/, 'hidden out-of-combat adjustments do not create player inbox messages');

const visualStart = html.indexOf('  function animateGmAdjustmentVisual()');
const visualEnd = html.indexOf('  function gmVisualTarget(', visualStart);
const adjustmentVisual = html.slice(visualStart, visualEnd);
assert.match(adjustmentVisual, /event\.visibility==='gm'&&\(!adjustmentSession\|\|adjustmentSession\.role!=='master'\)/, 'player clients reject hidden adjustments before finding the token');
const audienceGate = adjustmentVisual.indexOf("event.visibility==='gm'");
['claimCombatPlaybackEvent(event,\'label\')', "claimCombatPlaybackEvent(event,'hitFx')", "claimCombatPlaybackEvent(event,'particles')", "claimCombatPlaybackEvent(event,'sound')"].forEach(function(channel){
  assert.ok(adjustmentVisual.indexOf(channel) > audienceGate, channel + ' must remain behind the player audience gate');
});

console.log('GM adjustment visibility contract passed');
