const assert = require('assert');
const playback = require('../combat-playback.js');

function cueNames(plan){ return plan.cues.map(cue => cue.name); }

const attack = playback.buildTimeline({id:'attack-1',kind:'combat-attack',targetKey:'enemy',attackRoll:17,ts:1000,revealAt:4200});
assert.strictEqual(attack.family, 'attack');
assert.deepStrictEqual(cueNames(attack), ['resolved','roll','result','impact','reaction','log']);
assert.strictEqual(attack.cueMap.result.at, 4200);
assert.ok(attack.cueMap.impact.order > attack.cueMap.result.order, 'impact cannot precede the visible attack result');
assert.ok(!attack.cueMap.audio, 'attack confirmation does not own the damage sound');

const damage = playback.buildTimeline({id:'damage-1',kind:'combat-damage',targetKey:'enemy',damageRolls:[6],ts:5000,revealAt:8200});
assert.strictEqual(damage.family, 'damage');
assert.deepStrictEqual(cueNames(damage), ['resolved','roll','result','commit','impact','reaction','audio','log']);
assert.ok(damage.cueMap.commit.order > damage.cueMap.result.order, 'HP presentation commit follows the dice result');
assert.ok(damage.cueMap.audio.order > damage.cueMap.impact.order, 'one impact sound belongs after the impact cue');

const delayed = playback.buildTimeline({id:'cast-1',kind:'combat-ability',roll:12,ts:9000,revealAt:12000}, {impactDelayMs:180,commitDelayMs:260,reactionDelayMs:320});
assert.strictEqual(delayed.family, 'ability');
assert.strictEqual(delayed.cueMap.impact.at, 12180);
assert.strictEqual(delayed.cueMap.commit.at, 12260);
assert.strictEqual(delayed.cueMap.reaction.at, 12320);
assert.strictEqual(delayed.cueMap.log.at, 12320);

assert.strictEqual(playback.eventFamily({id:'initiative-roll-1',kind:'combat'}), 'initiative');
assert.strictEqual(playback.eventFamily({id:'future-check-1',kind:'skill-check'}), 'check');
assert.strictEqual(playback.eventFamily({id:'save-1',kind:'combat-save-success'}), 'save');
assert.strictEqual(playback.eventFamily({id:'death-save-1',kind:'death-save'}), 'death');
assert.strictEqual(playback.eventFamily({id:'turn-1',kind:'combat',statusTicks:[{type:'damage',amount:1}]}), 'direct', 'structured status ticks receive commit/impact/audio phases');

const invalidOrder = playback.validateEvent({id:'broken',kind:'combat-damage',ts:5000,revealAt:4000});
assert.strictEqual(invalidOrder.valid, false);
assert.ok(invalidOrder.errors.includes('reveal-before-resolution'));
const missingIdentity = playback.validateEvent({kind:'combat-attack',ts:1000,revealAt:2000});
assert.strictEqual(missingIdentity.valid, false);
assert.ok(missingIdentity.errors.includes('id-required'));

console.log('combat playback contracts passed');
