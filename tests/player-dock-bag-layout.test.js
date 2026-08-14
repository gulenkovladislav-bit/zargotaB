const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function playerDockBagGeometry\(hostRect,drawerRect,preferredWidth\)/, 'bag docking must preserve each toolbar preferred width');
assert.match(html, /var rightShift=targetWidth\*\.3;/, 'both toolbars must shift right by exactly 30% of their own width');
assert.match(html, /function playerDockBagRestRect\(drawer\)/, 'bag docking must calculate the final resting bag edge');
assert.match(html, /drawerRect=playerDockBagRestRect\(drawer\)/, 'toolbar placement must ignore transient bag animation keyframes');
assert.match(html, /bagNeedsDocking=!!\(bagOpen&&drawer\.getAttribute\('data-player-bag-scale'\)==='large'\)/, 'only the enlarged bag may reposition either toolbar');
assert.match(html, /if\(!drawer\|\|!bagNeedsDocking\)\{[\s\S]*?removeProperty\('--zg-player-dock-left'\);[\s\S]*?removeProperty\('--zg-player-dock-width'\)/, 'normal 100 percent mode must restore the untouched toolbar position and width');
assert.match(html, /translateX=width\*\.2,left=baseRight-width\*scale\+translateX/, 'resting edge must include the backpack translation and user scale');
assert.match(html, /preferredWidth=item===dock\?780:\(item\.classList\.contains\('long-action-menu'\)\|\|item\.classList\.contains\('ability-palette'\)\?1240:832\)/, 'free, compact combat and expanded combat toolbars must keep their requested widths');
assert.doesNotMatch(html, /playerDockBagLayoutUntil|schedulePlayerDockBagLayout\((460|560)\)/, 'the toolbar must not chase the drawer animation frame by frame');
assert.match(html, /layoutHosts=\[dock,combatDock\]/, 'free-room and combat toolbars must share bag collision handling');
assert.match(html, /item===dock\?!item\.classList\.contains\('combat-mode'\):item\.classList\.contains\('open'\)/, 'only the currently visible toolbar may be docked');
assert.match(html, /\.zg-player-dock\.bag-docked\{[\s\S]*?left:var\(--zg-player-dock-left\);width:var\(--zg-player-dock-width\);min-width:0;transform:none/, 'open-bag dock must use the free horizontal region');
assert.match(html, /\.zg-player-dock\.bag-docked\{[\s\S]*?transition:left \.34s cubic-bezier\(\.22,\.78,\.2,1\),width \.34s cubic-bezier\(\.22,\.78,\.2,1\),transform \.34s cubic-bezier\(\.22,\.78,\.2,1\)/, 'free-room toolbar must ease smoothly into its final geometry');
assert.match(html, /#zg-combat-economy\.bag-docked\{[\s\S]*?left:var\(--zg-player-dock-left\);width:var\(--zg-player-dock-width\);min-width:0;transform:none;[\s\S]*?transition:opacity \.24s ease,left \.34s cubic-bezier\(\.22,\.78,\.2,1\),width \.34s cubic-bezier\(\.22,\.78,\.2,1\),transform \.34s cubic-bezier\(\.22,\.78,\.2,1\)/, 'combat toolbar must ease smoothly into its final geometry');
assert.doesNotMatch(html, /\.bag-docked-compact\{|#zg-combat-economy\.bag-docked[^\{]*button\{/, 'bag docking must not reduce toolbar controls or typography');
assert.match(html, /\.zg-vtt-drawer\.open\.backpack-skin~\.zg-player-dock\{z-index:60\}/, 'the free-room toolbar must paint over the open bag');
assert.match(html, /#zg-combat-economy\.bag-docked\{\s*z-index:60;/, 'the combat toolbar must paint over the open bag');
assert.match(html, /\.zg-combat-economy\.open\{z-index:60\}/, 'the combat toolbar must stay above the normal 100 percent bag without docking');

const geometryStart = html.indexOf('  function playerDockBagGeometry(hostRect,drawerRect,preferredWidth){');
const geometryEnd = html.indexOf('\n  function updatePlayerDockBagLayout(){', geometryStart);
assert.ok(geometryStart >= 0 && geometryEnd > geometryStart, 'bag geometry helper must remain extractable');
const geometrySource = html.slice(geometryStart, geometryEnd);
const geometry = Function(`${geometrySource}; return playerDockBagGeometry;`)();

const normal = geometry({ left:0, right:1200 }, { left:820, right:1200 }, 780);
assert.deepStrictEqual(normal, { left:274, width:780, compact:false, minimal:false }, 'free-room toolbar must keep full size and shift right by 30%');
const combat = geometry({ left:0, right:1675 }, { left:1105, right:1675 }, 832);
assert.deepStrictEqual(combat, { left:523, width:832, compact:false, minimal:false }, 'combat toolbar must use its 20 percent tighter width and shift right by 30%');
const constrained = geometry({ left:0, right:900 }, { left:620, right:900 }, 780);
assert.deepStrictEqual(constrained, { left:74, width:780, compact:false, minimal:false }, 'bag docking must shift rather than shrink the toolbar when room is constrained');

console.log('player dock and bag collision contract passed');
