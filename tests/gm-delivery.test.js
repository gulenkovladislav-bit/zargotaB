'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');
var styles = fs.readFileSync(path.join(root, 'gm-delivery.css'), 'utf8');
var todo = fs.readFileSync(path.join(root, 'GM_GAMEPLAY_SYSTEM_TODO.md'), 'utf8');

new vm.Script(delivery, {filename:'gm-delivery.js'});

assert.match(html, /gm-delivery\.css\?v=/);
assert.match(html, /gm-delivery\.js\?v=/);
assert.match(html, /class="zg-scene-publish zg-gm-delivery-button"/);
assert.match(html, /onclick="zgGmDeliveryToggle\(\)"/);

assert.match(network, /gmSendDelivery:\s*function/);
assert.match(network, /acknowledgeGmDelivery:\s*function/);
assert.match(network, /\['item','quest','text','image'\]\.indexOf\(value\.kind\)/);
assert.match(network, /\['calm','solemn','ominous'\]\.indexOf\(value\.mood\)/);
assert.match(network, /status:'pending'/);
assert.match(network, /members\/'\+memberUid\+'\/gmDeliveries\/'\+deliveryId/);
assert.match(network, /resolved\.slice\(30\)/);
assert.match(network, /delivery-image-large/);

assert.match(delivery, /STORAGE_KEY = 'zargota_gm_delivery_library_v1'/);
assert.match(delivery, /MAX_IMAGE_BYTES = 250 \* 1024/);
assert.match(delivery, /inventory\.push\(/);
assert.match(delivery, /journal\.push\(/);
assert.match(delivery, /character\._gmDeliveryIds = appliedIds\(character\)\.concat\(deliveryId\)/);
assert.match(delivery, /acknowledgeGmDelivery\(delivery\.id, 'applied'\)/);
assert.match(delivery, /saveChars\(\{reason:delivery\.kind === 'item' \? 'inventory-add' : 'journal-add'\}\)/);
assert.match(delivery, /character\.inventoryItems = rollback\.inventoryItems/);
assert.match(delivery, /character\.journalEntries = rollback\.journalEntries/);
assert.match(delivery, /character\._gmDeliveryIds = rollback\.deliveryIds/);
assert.match(delivery, /inventory\.some\(function \(item\)/);
assert.match(delivery, /journal\.some\(function \(entry\)/);
assert.match(delivery, /delivery\.showPopup !== false/);
assert.match(delivery, /mood-' \+ \(delivery\.mood \|\| 'calm'\)/);
assert.match(delivery, /receivedFromGm:true/);
assert.match(delivery, /equipped:false/);

assert.match(styles, /\.zg-player-delivery-popup\.mood-calm/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-solemn/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-ominous/);
assert.match(styles, /\.zg-game-overlay\.gm\.gm-edit-mode \.zg-gm-delivery-button\{display:none\}/);

assert.match(todo, /Этап 1\. Единый канал выдачи/);
assert.match(todo, /Этап 4\. Канонические статусы/);
assert.match(todo, /Этап 6\. Каст заклинаний на сцене/);

console.log('gm delivery contract passed');
