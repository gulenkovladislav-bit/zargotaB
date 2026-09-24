const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('story-actors.js', 'utf8');
const fn = source.slice(source.indexOf('  function inspectItem('), source.indexOf('  function showCharacter('));
const roots = [];
function el(tag) {
  return { tag, children: [], listeners: {}, append(...items) { this.children.push(...items); },
    addEventListener(name, cb) { this.listeners[name] = cb; },
    showModal() { this.open = true; }, close() { this.open = false; this.listeners.close(); },
    remove() { this.removed = true; }, focus() { this.focused = true; } };
}
const item = { name: 'Drafts', inspectImage: 'draft.png', qty: 1, equipped: false };
const before = JSON.stringify(item);
const trigger = { isConnected: true, focus() { this.focused = true; } };
const context = { el, btn(text, onclick) { return Object.assign(el('button'), { text, onclick }); },
  t: (ru) => ru, local: (obj, key) => obj[key], item, trigger,
  document: { body: { appendChild(n) { roots.push(n); } } } };
vm.createContext(context);
vm.runInContext(fn + ';inspectItem(item,trigger);', context);
const dialog = roots[0];
assert.equal(dialog.open, true);
assert.equal(dialog.children[0].src, item.inspectImage);
assert.equal(dialog.children[1].focused, true);
let stopped = false;
dialog.listeners.keydown({ stopPropagation() { stopped = true; } });
assert.equal(stopped, true);
dialog.children[1].onclick();
assert.equal(dialog.removed, true);
assert.equal(trigger.focused, true);
assert.equal(JSON.stringify(item), before, 'Inspecting never equips or consumes item');
assert.ok(source.includes("if(item.inspectImage)detail.appendChild"));
assert.ok(fs.readFileSync('story-items.js', 'utf8').includes('stored.inspectImage=inspection.value'));
console.log('PASS: inspection opens modal, preserves item, restores focus and has editor field (mock DOM).');
