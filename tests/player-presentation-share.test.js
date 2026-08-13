const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'gm-delivery.css'), 'utf8');

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `section start not found: ${start}`);
  assert.notEqual(to, -1, `section end not found: ${end}`);
  return source.slice(from, to);
}

test('player share writes a presentation-only event to the sender member', () => {
  const share = section(network, 'sharePresentation: function', 'acknowledgeGmDelivery: function');
  assert.match(share, /session\.role\s*!==\s*'player'/);
  assert.match(share, /members\/'\+user\.uid\+'\/sharedPresentation/);
  assert.match(share, /previewOnly:true/);
  assert.match(share, /recipientUids:targets/);
  assert.doesNotMatch(share, /gmDeliveries/);
  assert.doesNotMatch(share, /inventoryItems|journalEntries|preparedSpells|spellCards/);
});

test('shared presentation receiver only enqueues the existing popup', () => {
  const receive = section(delivery, 'function syncSharedPresentations()', 'function sync(nextSnapshot)');
  assert.match(receive, /recipientUids/);
  assert.match(receive, /claimDeliveryPresentation/);
  assert.match(receive, /enqueuePopup\(delivery\)/);
  assert.doesNotMatch(receive, /applyDelivery|handleDelivery|saveCharacter|saveChars/);
  const sync = section(delivery, 'function sync(nextSnapshot)', "document.addEventListener('keydown'");
  assert.ok(sync.indexOf('syncSharedPresentations()') < sync.indexOf("snapshot.session.role === 'master'"), 'GM must receive a presentation before the master-only panel branch returns');
});

test('item, ability and journal details expose the player-only share action', () => {
  assert.match(page, /zgVttShareCurrentItem/);
  assert.match(page, /zgVttShareAbility/);
  assert.match(page, /zgVttShareJournalRecord/);
  assert.match(page, /zg-presentation-share-trigger/);
  assert.match(page, /session\.role==='player'/);
});

test('share menu has readable recipients and explicit share or exit actions', () => {
  assert.match(delivery, /id = 'zg-player-share-menu'/);
  assert.match(delivery, />Выйти</);
  assert.match(delivery, />Поделиться</);
  assert.match(delivery, /Гейм-мастер/);
  assert.match(delivery, /Подключённый герой/);
  assert.match(css, /\.zg-player-share-menu/);
  assert.match(css, /\.zg-player-share-target/);
  assert.match(css, /\.zg-player-delivery-popup\.shared-preview/);
});
