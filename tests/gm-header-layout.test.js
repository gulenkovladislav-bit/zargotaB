'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /\.zg-gm-actions\{[^}]*top:1px;[^}]*left:calc\(50% \+ 10px\);[^}]*right:120px;[^}]*height:44px/, 'service controls occupy the right half of one compact header plane');
assert.match(html, /\.zg-scene-quick\{[^}]*top:1px;[^}]*left:10px;[^}]*right:calc\(50% \+ 10px\);[^}]*height:44px/, 'scene rail occupies the left half of the same compact header plane');
assert.match(html, /\.zg-gm-actions:before\{[^}]*left:-10px;[^}]*width:1px/, 'the two header halves have a restrained midpoint divider');
assert.match(html, /\.zg-gm-intervention-button\{position:static;/, 'GM panel launcher must remain inside the shared service row');
assert.match(html, /\.gm-run-mode \.zg-zones-button\{display:inline-flex;opacity:\.5\}/, 'zones stay discoverable in run mode while clearly marked as editing-only');
assert.match(html, /\.zg-scene-publish\{height:34px;[^}]*display:inline-flex/, 'service buttons share one compact height');
assert.match(html, /\.zg-gm-actions>\.zg-scene-publish\[hidden\]\{display:none!important\}/, 'compact layout must preserve hidden contextual controls');
assert.match(html, /id="zg-scene-quick-title"[\s\S]*?id="zg-scene-quick-count"/, 'scene visor exposes the dynamic scene count');
assert.match(html, /quickCount\.textContent=String\(items\.length\)/, 'scene count follows the rendered library');
assert.match(html, /b\.innerHTML = '<span>' \+ \(gm \? 'Мастер' : 'Игроки'\)/, 'view control uses a compact master/player label without a mismatched text glyph');
assert.match(html, /if\(button\)\{button\.textContent=active\?'Бой · '/, 'combat state keeps the compact shared-row label');
assert.match(html, /@media\(min-width:561px\) and \(max-width:1180px\)\{[\s\S]*?\.zg-game-overlay\.gm\.gm-vision \.zg-scene-quick\{left:8px;right:calc\(50% \+ 4px\);top:1px;height:44px;[\s\S]*?\.zg-game-overlay\.gm \.zg-gm-actions\{left:calc\(50% \+ 4px\);right:110px;top:1px;height:44px/, 'mid-size screens keep scene and service controls in two non-overlapping halves');
assert.match(html, /@media\(min-width:561px\) and \(max-width:1180px\)\{[\s\S]*?\.zg-scene-published-state\{max-width:92px;overflow:hidden;text-overflow:ellipsis;font-size:7px\}[\s\S]*?\.zg-scene-dirty\{width:11px;padding:0;font-size:0;gap:0\}/, 'mid-size status labels compact before they can cover the final scene tab');
assert.match(html, /\.zg-scene-quick-list\{[^}]*padding-right:7px;[^}]*border:0;[^}]*mask-image:none/, 'scrolling scene names end cleanly without a fog mask');
assert.match(html, /\.zg-scene-dirty:before,\.zg-scene-quick-save:before\{[^}]*border-right:2px solid #765827;[^}]*border-radius:0 12px 12px 0/, 'the scene list ends in a crisp absorbing bracket');
assert.match(html, /\.zg-scene-quick-save\{[^}]*margin-left:4px;/, 'save controls keep a small breathing gap after the scene bracket');
assert.match(html, /badge\.hidden=!dirty;[^}]*badge\.innerHTML='<i><\/i> Не сохранено'/, 'the header only shows a status when local scene changes are unsaved');
assert.match(html, /\.zg-scene-published-state\{display:none!important\}/, 'publication state stays out of the compact header without removing its data flow');
assert.match(html, /@media\(min-width:1381px\) and \(max-width:1680px\)\{\.zg-scene-dirty\{width:11px;[^}]*font-size:0/, 'intermediate desktop widths keep the save indicator without crowding publication status');
assert.match(html, /\.zg-gm-mode-switch\{height:34px;flex:0 0 124px;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'run and edit states keep one stable switch width');
assert.match(html, /\.zg-game-overlay\.gm::before\{[^}]*top:0;[^}]*height:46px;[^}]*background:linear-gradient\(180deg,#100d08 0%,#070604 100%\);[^}]*border-bottom:1px solid #392b17/, 'GM workspace uses one compact opaque top shell across the screen');
assert.match(html, /\.zg-scene-quick\{[^}]*height:44px;[^}]*padding:5px 6px;[^}]*border:0;[^}]*background:transparent;[^}]*box-shadow:none/, 'scene controls sit inside the shared shell without a separate dark island');
assert.match(html, /\.zg-gm-actions\{[^}]*height:44px;[^}]*padding:5px 6px;[^}]*border:0;[^}]*background:transparent;[^}]*box-shadow:none/, 'service controls sit inside the same shared shell');
assert.match(html, /@media\(max-width:1380px\)\{\s*\.zg-scene-quick\{top:1px;left:10px;right:calc\(50% \+ 10px\);/, 'compact desktop keeps scenes on the same top plane as service controls');
assert.match(html, /\.zg-scene-quick-item,\.zg-scene-quick-add\{height:34px;[^}]*border-radius:7px/, 'scene controls share the service-button height');
assert.match(html, /\.zg-game-overlay\.gm \.zg-vtt-party\{top:48px\}/, 'initiative portraits begin below the compact top shell instead of sliding under it');
assert.match(html, /@media\(min-width:561px\) and \(max-width:1180px\)\{[\s\S]*?\.zg-game-overlay\.gm \.zg-gm-actions>\.zg-vision-gear,[\s\S]*?height:34px/, 'desktop responsive labels may collapse without shrinking service controls');

console.log('GM header layout contracts passed');
