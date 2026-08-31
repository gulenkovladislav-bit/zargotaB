'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /function zgNpcCatalogItems\(\)[\s\S]*ZargotaItemEconomy[\s\S]*getShopSeedItems/, 'NPC editor uses the shared Zargota item catalog');
assert.match(html, /function zgNpcInventoryAdd\([\s\S]*definitionToInventorySnapshot/, 'catalog definitions become canonical inventory snapshots');
assert.match(html, /n\.inventoryItems = JSON\.parse\(JSON\.stringify\(_npcEditInventory\.slice\(0,40\)\)\)/, 'NPC registry persists item instances and their state');
assert.match(html, /function zgNpcResolvedSheet\([\s\S]*zgNpcEquipmentResult\(n\)[\s\S]*out\.equipmentBonuses = equipment/, 'NPC resolved stats include equipped item bonuses');
assert.match(html, /function sourceEntries\(kind\)[\s\S]*inventoryItems:[^,]+,[\s\S]*equipmentBonuses:/, 'NPC source carries inventory and equipment into its scene token');
assert.match(html, /function applySource\([\s\S]*token\.inventoryItems=[\s\S]*token\.equipmentBonuses=/, 'binding a registry NPC copies the inventory state to the token');
assert.match(html, /function copyToken\([\s\S]*inventoryItems:[\s\S]*equipmentBonuses:/, 'scene copies retain creature inventory state');
assert.match(html, /zg-gm-creature-inventory[\s\S]*zgGmCreatureInventoryAction/, 'GM creature sheet exposes combat inventory controls');
assert.match(html, /zgGmCreatureInventoryAction=function[\s\S]*kind:'inventory'/, 'combat item actions go through the acknowledged GM operation');
assert.match(html, /syncNpcRegistryInventoryFromToken/, 'confirmed combat item state is mirrored back to the local NPC registry');

assert.match(network, /function sessionInventoryItems\([\s\S]*sharedImageSource/, 'Firebase inventory transport strips unsupported heavy media');
assert.match(network, /inventoryItems: sessionInventoryItems\(token\.inventoryItems, 40\)/, 'published scene includes bounded NPC inventory');
assert.match(network, /inventoryItems:sessionInventoryItems\(participant\.inventoryItems,40\)/, 'combat start includes NPC inventory');
assert.match(network, /kind==='inventory'[\s\S]*applyCreatureInventory/, 'Firebase-authoritative GM operation applies item state');
assert.match(network, /inventoryAction:kind==='inventory'/, 'combat event identifies the item action');

const stormTargeting = html.slice(html.indexOf('function renderCombat()'), html.indexOf('function combatGroupRows()'));
assert.match(stormTargeting, /combatOwnsDock=!!\(active\|\|initiative\)/, 'combat owns the lower dock throughout multi-target selection');
assert.match(html, /Стрела-буря[^]*ровно двух соседних врагов|Стрелы-бури[^]*первой из двух целей/, 'Storm Arrow two-target contract remains documented in the active build');

console.log('NPC inventory and Storm Arrow combat regression contracts passed');
