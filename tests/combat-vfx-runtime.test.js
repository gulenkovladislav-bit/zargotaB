const assert = require('assert');
const runtimeModule = require('../combat-vfx-runtime.js');

let clock = 1000;
const runtime = runtimeModule.createRuntime({now:() => clock});
const event = {id:'vfx-event-1',family:'ranged',ts:1000,revealAt:1800};
const first = runtime.begin(event, 'projectile', {quality:'balanced'});
assert.ok(first);
assert.strictEqual(first.command.preset.key, 'projectile');
assert.strictEqual(first.command.quality, 'balanced');
assert.strictEqual(first.command.revealAt, 1800);
assert.strictEqual(runtime.prepare(event, 'movement', {durationMs:3200}).durationMs, 3200, 'event-derived duration can extend a visual without mutating its preset');
assert.strictEqual(runtime.begin(event, 'projectile', {quality:'balanced'}), null, 'same event/channel begins once');

let snapshot = runtime.snapshot();
assert.strictEqual(snapshot.activeVfx, 1);
assert.strictEqual(snapshot.activeProjectiles, 1);
assert.strictEqual(snapshot.activeParticles, first.command.composition.particles.length);
assert.strictEqual(snapshot.duplicates, 1);
assert.strictEqual(snapshot.createdHandles, 1);

assert.strictEqual(runtime.finish(first, 'complete'), true);
assert.strictEqual(runtime.finish(first, 'complete'), false, 'finish is idempotent');
snapshot = runtime.snapshot();
assert.strictEqual(snapshot.activeVfx, 0);
assert.strictEqual(snapshot.activeParticles, 0);
assert.strictEqual(snapshot.activeProjectiles, 0);
assert.strictEqual(snapshot.completed, 1);
assert.strictEqual(snapshot.poolSize, 1);

clock = 2000;
const second = runtime.begin({id:'vfx-event-2',family:'spell',ts:2000}, 'unknown-preset', {quality:'low'});
assert.ok(second);
assert.strictEqual(second.command.preset.fallback, true);
assert.strictEqual(runtime.snapshot().fallbacks, 1);
assert.strictEqual(runtime.snapshot().reusedHandles, 1, 'completed handles are reused instead of allocated again');
assert.strictEqual(runtime.cancelEvent('vfx-event-2', 'replaced'), 1);
assert.strictEqual(runtime.snapshot().cancelled, 1);
assert.strictEqual(runtime.activeCount(), 0);

const cancellable = runtime.begin({id:'vfx-cancel-handle',family:'spell',ts:2000}, 'fire', {channel:'handle-cancel'});
assert.strictEqual(typeof cancellable.cancel, 'function', 'every pooled EffectHandle exposes cancel(reason)');
assert.strictEqual(cancellable.cancel('lane-replaced'), true);
assert.strictEqual(cancellable.cancel('duplicate-cancel'), false, 'EffectHandle.cancel is idempotent');
assert.strictEqual(runtime.activeCount(), 0);
assert.strictEqual(runtime.snapshot().cancelled, 2);

const reconnectA = runtime.begin({id:'reconnect-a',family:'spell',ts:2000}, 'fire', {channel:'reconnect-a'});
const reconnectB = runtime.begin({id:'reconnect-b',family:'heal',ts:2000}, 'heal', {channel:'reconnect-b'});
assert.ok(reconnectA && reconnectB);
assert.strictEqual(runtime.cancelAll('reconnect'), 2, 'reconnect cancels every active VFX handle once');
assert.strictEqual(runtime.activeCount(), 0);
assert.strictEqual(runtime.snapshot().cancelled, 4);

runtime.setRafActive(true);
runtime.noteFrame(16);
runtime.noteFrame(24);
runtime.noteFrame(41);
snapshot = runtime.snapshot();
assert.strictEqual(snapshot.activeRafLoops, 1);
assert.strictEqual(snapshot.maxActiveRafLoops, 1);
assert.strictEqual(snapshot.rafWakeups, 3);
assert.strictEqual(snapshot.frameOver20, 2);
assert.strictEqual(snapshot.frameOver34, 1);
assert.strictEqual(snapshot.maxFrameMs, 41);
runtime.setRafActive(false);
assert.strictEqual(runtime.snapshot().activeRafLoops, 0);
runtime.setRafActive(true,'preview');
runtime.setRafActive(true,'live-combat');
assert.strictEqual(runtime.snapshot().activeRafLoops,2,'independent surfaces are visible instead of hiding a parallel RAF');
runtime.setRafActive(false,'preview');
runtime.setRafActive(false,'live-combat');
assert.strictEqual(runtime.snapshot().activeRafLoops,0);

runtime.reset();clock=10000;
assert.strictEqual(runtime.prepare({id:'quality-high'},'fire',{quality:'high'}).quality,'high');
runtime.noteFrame(41);runtime.noteFrame(41);
assert.strictEqual(runtime.snapshot().qualityCap,'balanced','repeated slow renderer frames lower the future cosmetic cap once');
assert.strictEqual(runtime.prepare({id:'quality-balanced'},'fire',{quality:'high'}).quality,'balanced');
assert.strictEqual(runtime.prepare({id:'quality-explicit'},'fire',{quality:'high',adaptive:false}).quality,'high','explicit preview comparison can bypass adaptive quality');
clock=13000;runtime.noteFrame(41);runtime.noteFrame(41);
assert.strictEqual(runtime.snapshot().qualityCap,'low','a continued measured overload can lower the cap again after cooldown');
clock=24000;for(let frame=0;frame<240;frame++)runtime.noteFrame(8);
assert.strictEqual(runtime.snapshot().qualityCap,'balanced','long stable rendering raises quality one tier rather than oscillating');
assert.strictEqual(runtime.snapshot().qualityChanges,3);

console.log('combat VFX runtime passed');
