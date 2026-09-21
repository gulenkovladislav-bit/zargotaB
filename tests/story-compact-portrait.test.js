const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const window = { ZargotaStoryPortraitKit: { picker(data, node, host) {
  host.compactPicker = true;
} } };
function element() { return { children: [], classList: { add() {} }, appendChild(child) { this.children.push(child); } }; }
vm.runInNewContext(fs.readFileSync('story-actors.js', 'utf8'), {
  window, document: { createElement: element }
});
const data = { nodes: [{ id: 'first', portraitFrame: { zoom: 1.8, cropX: 48 }, portraitOverride: true, slides: [{ text: 'Existing page', portraitFrame: { zoom: 2 } }] }] };
const before = JSON.stringify(data);
for (let i = 0; i < 5; i++) {
  const host = element();
  window.ZargotaStoryActors.enhance(data, data.nodes[0], host, () => assert.fail('Rendering must not save'));
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].compactPicker, true);
  assert.equal(host.children[0].children.length, 1, 'Only legend and compact picker; no adjustment panel');
}
assert.equal(JSON.stringify(data), before, 'Legacy presentation and slides preserved');
console.log('PASS: compact portrait editor, no presentation preview dependency, no render-time mutation.');
