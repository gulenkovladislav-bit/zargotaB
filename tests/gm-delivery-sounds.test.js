'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'gm-delivery.css'), 'utf8');

new vm.Script(delivery, {filename:'gm-delivery.js'});

const expectedIds = ['auto', 'none', 'paper', 'seal', 'reward', 'mystic'];
const expectedAssets = [
  'audio/vtt-actions/gm-action-request-paper.mp3',
  'audio/vtt-actions/gm-action-approved-pencil.mp3',
  'audio/vtt-actions/item-reward-bag.mp3',
  'audio/vtt-actions/status-cleanse-holy.mp3'
];

expectedIds.forEach((id) => {
  assert.match(delivery, new RegExp("id:'" + id + "'"), 'shared delivery sound library must include ' + id);
});
expectedAssets.forEach((asset) => {
  assert.ok(fs.existsSync(path.join(root, asset)), 'approved existing delivery sound must remain available: ' + asset);
});

assert.match(delivery, /function deliverySoundLibraryMarkup\(value\)/, 'item, quest and information composers share one sound picker');
assert.match(delivery, /\['item','quest','text'\]\.indexOf\(activeKind\) < 0/, 'the shared picker must cover the three requested delivery types');
assert.match(delivery, /id="zg-gm-delivery-sound" type="hidden"/, 'sound choice uses the custom card UI instead of a native select');
assert.match(delivery, /zgGmDeliverySoundPreview/, 'the GM can preview a selected cue before sending');
assert.match(delivery, /soundId:'auto'/, 'new and old-compatible drafts default to semantic automatic sound');
assert.match(delivery, /soundId:deliverySoundId\(/, 'the chosen sound is persisted in the form and therefore in templates and history');
assert.match(delivery, /kind:'item',mood:value\.mood,soundId:deliverySoundId\(value\.soundId\)/, 'bundle delivery keeps the selected receipt cue');
assert.match(delivery, /function playDeliverySound\(delivery\)/, 'recipient playback resolves through the shared sound library');
assert.match(delivery, /w\.ZargotaSound\[sound\.method\]\(\)/, 'explicit cues reuse the established sound engine and mute handling');

const handleStart = delivery.indexOf('  function handleDelivery(delivery, member) {');
const handleEnd = delivery.indexOf('\n  function syncSharedPresentations()', handleStart);
const handleBlock = delivery.slice(handleStart, handleEnd);
assert.ok(handleStart >= 0 && handleEnd > handleStart, 'delivery handler must be present');
assert.ok(handleBlock.indexOf('claimDeliveryPresentation(delivery.id)') < handleBlock.indexOf('playDeliverySound(delivery)'), 'sound plays only after the stable delivery presentation is claimed');
assert.strictEqual((handleBlock.match(/playDeliverySound\(delivery\)/g) || []).length, 1, 'one delivery produces one selected cue');
assert.doesNotMatch(handleBlock, /itemReward\(|playerDeliveryReceived\(/, 'legacy automatic cues cannot double-play beside the selected cue');

assert.match(network, /var deliverySoundIds=\['auto','none','paper','seal','reward','mystic'\]/, 'network boundary uses the same sound ids');
assert.match(network, /soundId:soundId/, 'the sanitized cue is included in each Firebase delivery record');
assert.match(network, /String\(value\.soundId\|\|'auto'\)/, 'missing and invalid legacy values safely fall back to automatic playback');

assert.match(styles, /\.zg-gm-delivery-sounds\{/, 'shared sound cards have a project-native visual treatment');
assert.match(styles, /\.zg-gm-delivery-sounds>div\{display:grid;grid-template-columns:repeat\(2/, 'the library remains compact in the delivery sidebar');

console.log('gm-delivery-sounds.test.js: all assertions passed');
