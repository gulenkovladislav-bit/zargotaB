'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function pruneDuplicateRollVisuals(');
const end = html.indexOf('  function renderRollAnimations()', start);
assert.ok(start >= 0 && end > start, 'dice DOM deduplicator must remain extractable');

const stopped = [];
const context = {stopDicePreview(id){stopped.push(id);}};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

function node(rollId, totalId) {
  return {
    dataset:{rollId:rollId || '', rollTotal:totalId || ''},
    removed:false,
    remove(){this.removed=true;}
  };
}
const first = node('roll-a-0');
const duplicate = node('roll-a-0');
const secondContestDie = node('roll-a-1');
const total = node('', 'roll-a');
const totalDuplicate = node('', 'roll-a');
const unrelated = node('roll-b-0');
const host = {querySelectorAll(){return [first,duplicate,secondContestDie,total,totalDuplicate,unrelated];}};

assert.strictEqual(context.pruneDuplicateRollVisuals(host, 'roll-a'), true);
assert.strictEqual(first.removed, false, 'the first canonical die stays visible');
assert.strictEqual(duplicate.removed, true, 'a repeated Firebase/local die node is removed');
assert.strictEqual(secondContestDie.removed, false, 'the second advantage/disadvantage die is mechanically valid');
assert.strictEqual(total.removed, false);
assert.strictEqual(totalDuplicate.removed, true, 'only one total card survives');
assert.strictEqual(unrelated.removed, false);
assert.deepStrictEqual(stopped, ['die:roll-a-0']);

const modeStart = html.indexOf('  function combatContestRollMode(');
const modeEnd = html.indexOf('  function renderRollAnimations()', modeStart);
assert.ok(modeStart >= 0 && modeEnd > modeStart, 'd20 contest mode helper must remain extractable');
vm.runInContext(html.slice(modeStart, modeEnd), context);
assert.strictEqual(context.combatContestRollMode('normal'), '', 'an ordinary kept d20 is not disadvantage');
assert.strictEqual(context.combatContestRollMode('advantage'), 'advantage');
assert.strictEqual(context.combatContestRollMode('disadvantage'), 'disadvantage');
assert.strictEqual(context.combatContestRollMode(''), '');

const listenerStart = html.indexOf("w.addEventListener('zg-local-roll'");
const listenerEnd = html.indexOf('\n    });', listenerStart) + 7;
const listener = html.slice(listenerStart, listenerEnd);
assert.match(listener,/hasLocalVisual=pruneDuplicateRollVisuals/,'network confirmation checks the existing physical die');
assert.match(listener,/if\(hasLocalVisual\)renderedRollVisuals\[localRollKey\]=Date\.now\(\);else delete renderedRollVisuals/,'network confirmation cannot reopen an already rendered id');
assert.match(html,/isContest\?Math\.max\(104/,'advantage dice have a visibly separate flight path');
assert.doesNotMatch(html, /label\.textContent=.*(?:ПРЕИМУЩЕСТВО|ПОМЕХА).*index\+1/, 'advantage dice do not show redundant numbered captions below their faces');
assert.match(html,/if\(contestMode\)contestRoll=rolls\.find/,'only explicit advantage or disadvantage can activate contest presentation');
assert.match(html,/if\(isContest\)setTimeout/,'ordinary rollMode normal does not trigger contest convergence');
const combatReleaseStart = html.indexOf('  function endApprovedAttackDie(');
const combatReleaseEnd = html.indexOf("  document.addEventListener('pointermove'", combatReleaseStart);
const combatRelease = html.slice(combatReleaseStart, combatReleaseEnd);
assert.match(combatRelease, /finishApprovedDiceGhost\(\);if\(drag\.isMasterAttack\)/, 'attack, damage and action checks remove the held texture at release');
assert.doesNotMatch(combatRelease, /launchApprovedDiceGhost/, 'a flat shuriken-like die is never launched before the result die');

console.log('dice visual deduplication passed');
