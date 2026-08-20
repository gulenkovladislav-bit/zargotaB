'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.doesNotMatch(index, /ZargotaSpellAutomation\.buildPreview\(request\.ability/, 'opening the GM verdict must not secretly roll dice');
assert.match(index, /Назначить бросок d20/, 'the GM verdict must explicitly assign the spell attack die');
assert.match(index, /Назначить бросок d6/, 'a successful attack must explicitly assign the damage die');
assert.match(index, /zgCombatAbilityDragStart/, 'the player must receive a physical spell-die drag control');
assert.match(index, /zg-spell-inline-error/, 'apply and range failures must be visible inside the GM verdict');
assert.match(index, /Сначала — канон заклинания/, 'effects prescribed by the spell text must be presented first');
assert.match(index, /Состояния сверх текста заклинания отмечаются отдельно/, 'GM additions must not masquerade as catalog rules');
assert.match(index, /zgAbilityExtraStatusAdd/, 'the GM can add another condition from the shared status catalog');
assert.match(index, /abilityAdditionalStatusCatalog/, 'the verdict reuses the scene status catalog instead of hardcoding Burning');
assert.match(network, /prepareCombatAbilityRoll:/, 'the network API must expose the GM preparation stage');
assert.match(network, /rollCombatAbilityStage:/, 'the network API must expose the player roll stage');
assert.match(network, /ability-attack-ready/, 'the attack roll must have a synchronized waiting state');
assert.match(network, /ability-damage-result/, 'the damage roll must have a synchronized result state');
assert.match(network, /Сначала игрок должен бросить d20/, 'final apply must reject a missing attack roll');
assert.match(network, /После попадания игрок должен бросить кубик урона/, 'final apply must reject a missing damage roll');
assert.match(network, /sanitizeAbilityStatusKeys/, 'additional conditions must be normalized and bounded by the resolver');
assert.doesNotMatch(network, /return value==='burn'/, 'the resolver must not limit spell additions to a single hardcoded condition');

console.log('staged combat spell roll contract passed');
