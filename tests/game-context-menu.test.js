'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function suppressGameContextMenu(ev)');
const end = html.indexOf("  document.addEventListener('contextmenu'", start);
assert.ok(start >= 0 && end > start, 'game context-menu policy remains extractable');

const context = {};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

function overlay(open) {
  return { classList: { contains(name) { return name === 'open' && open; } } };
}
function target(gameOverlay, editable) {
  return {
    closest(selector) {
      if (selector === '#zg-game-overlay') return gameOverlay;
      if (selector === 'input,textarea,select,[contenteditable="true"]') return editable ? {} : null;
      return null;
    }
  };
}

assert.equal(context.suppressGameContextMenu({ target: target(overlay(true), false) }), true, 'right click on the open VTT suppresses the browser menu');
assert.equal(context.suppressGameContextMenu({ target: target(overlay(true), true) }), false, 'chat and other editable controls retain copy and paste menus');
assert.equal(context.suppressGameContextMenu({ target: target(overlay(false), false) }), false, 'a closed game cannot affect the rest of the application');
assert.equal(context.suppressGameContextMenu({ target: target(null, false) }), false, 'pages outside the VTT retain the browser menu');
assert.match(html, /cancelActiveSceneTool\(\)\|\|suppressGameContextMenu\(ev\)/, 'tool cancellation and ordinary game suppression share the contextmenu handler');

console.log('game context menu suppression passed');
