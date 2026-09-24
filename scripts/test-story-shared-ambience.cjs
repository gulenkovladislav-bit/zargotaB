const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const audios = [];
class Audio {
  constructor(src) { this.src = src; this.currentTime = 0; this.paused = true; this.volume = 1; audios.push(this); }
  play() { this.paused = false; }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() { this.currentTime = 0; }
}
const element = () => ({ setAttribute() {}, appendChild() {}, remove() {}, style: { setProperty() {} } });
const context = { window: {}, Audio, document: { createElement: element }, performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {} };
vm.createContext(context);
for (const file of ['story-audio-mixer.js', 'story-environment.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
const mixer = context.window.ZargotaStoryAudioMixer.create();
const env = context.window.ZargotaStoryEnvironment.create(null, mixer);
const world = element();
const settings = { ambience: 'song.mp3', ambienceGroup: 'morning', volume: .5 };
env.setSound(true);
env.scene(settings, world, 'room');
const song = audios.at(-1);
song.currentTime = 42;
env.playZone({ sound: 'stairs.mp3', loop: true, id: 'stairs' });
const zone = audios.at(-1);
mixer.reset(true); // Normal player scene transition preserves only scene ambience.
env.scene({ ...settings, volume: .8 }, world, 'shop');
assert.equal(audios.length, 2);
assert.equal(song.currentTime, 42);
assert.equal(song.paused, false);
assert.equal(song.src, 'song.mp3');
assert.equal(song.volume, .48);
assert.equal(zone.paused, true);
assert.equal(mixer.status().tracks, 1);
env.scene(settings, world, 'shop'); // World redraw is not a playback event.
assert.equal(song.currentTime, 42);
env.scene(settings, world, 'room'); // Sequence-preserving transition, without reset.
assert.equal(song.currentTime, 42);
mixer.reset(true);
env.scene({ ...settings, ambienceGroup: 'outside' }, world, 'street');
assert.equal(song.paused, true);
assert.notEqual(audios.at(-1), song);
const outside = audios.at(-1);
env.scene({ ...settings, ambienceGroup: 'outside', ambience: 'other.mp3' }, world, 'yard');
assert.equal(outside.paused, true);
const count = audios.length;
env.scene({ ambience: 'other.mp3' }, world, 'unlinked');
assert.equal(audios.length, count + 1);
env.scene({}, world, 'silent');
assert.equal(mixer.status().tracks, 0);
env.setSound(false);
env.scene(settings, world, 'room');
assert.equal(mixer.status().tracks, 0);
env.setSound(true);
assert.equal(audios.at(-1).paused, false);
mixer.reset();
env.dispose();
assert.equal(mixer.status().tracks, 0);
assert.ok(audios.every(a => a.paused));
console.log('Shared ambience: continuity, gain, zone cleanup, redraw, different groups/files, silence, mute and exit passed (mock audio).');
