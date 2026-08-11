'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));

assert.match(network, /hostname!==['"]localhost['"]&&hostname!==['"]127\.0\.0\.1['"]&&hostname!==['"]::1['"]/, 'emulator opt-in must be restricted to local hosts');
assert.match(network, /get\(['"]firebase_emulator['"]\)===['"]1['"]/, 'browser emulator mode requires an explicit query flag');
assert.match(network, /connectAuthEmulator\(auth,['"]http:\/\/127\.0\.0\.1:9099['"]/, 'anonymous browser auth uses the local emulator');
assert.match(network, /connectDatabaseEmulator\(db,['"]127\.0\.0\.1['"],9000\)/, 'browser database uses the local emulator');
assert.match(network, /api\.mode=['"]firebase-emulator['"]/, 'diagnostics expose the selected backend');
assert.strictEqual(firebaseConfig.emulators.auth.port, 9099);
assert.strictEqual(firebaseConfig.emulators.database.port, 9000);

console.log('firebase browser emulator contract passed');
