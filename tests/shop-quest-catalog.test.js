const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const delivery = fs.readFileSync('gm-delivery.js', 'utf8');

assert(html.includes("var ZG_QUEST_SHOP_KEY = 'zargota_gm_quest_items_v1'"), 'quest catalog must use a separate storage key');
assert(html.includes("zgShopSetTab(\\'quest\\')"), 'shop must expose the GM quest-items tab');
assert(html.includes("zgShopEdit(null,\\'quest\\')"), 'quest tab must allow creating a quest item');
assert(html.includes("if (isQuest) saveQuestShopItems(arr); else saveShopItems(arr);"), 'quest items must not be saved into the commercial shop');
assert(html.includes("function zgCleanupLegacyPlayerShopItems()"), 'legacy player-item cleanup must exist');
assert(html.includes("return !item || !ids[String(item.id || '')];"), 'cleanup must remove only exact legacy item ids');
assert(html.includes("localStorage.getItem('zargota_armory_v1_backup_before_products')"), 'cleanup must use the pre-merge armory snapshot');
assert(!html.includes("['zargota_armory_v1_backup_before_products','zargota_armory_v1']"), 'current shared armory must never be used as a shop deletion list');

const loadItemsMatch = html.match(/function loadItems\(\) \{([\s\S]*?)\n  \}/);
assert(loadItemsMatch, 'armory compatibility loader must exist');
assert(!loadItemsMatch[1].includes('migrateLegacyArmoryOnce'), 'legacy armory items must no longer be imported into the shop');

assert(delivery.includes("if (source === 'quest')"), 'session delivery must read the quest catalog');
assert(delivery.includes("zgGmDeliveryImportOpen(\\'quest\\')"), 'session delivery must expose quest items as a separate source');
assert(delivery.includes("importSource = source === 'quest' ? 'quest' : 'shop';"), 'session delivery must preserve the selected source');

console.log('shop quest catalog test passed');
