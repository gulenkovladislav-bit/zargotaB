// Deterministic original synthesized foley; no external recordings or licenses.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../assets/stories/Evan/audio');
const rate = 44100;
let seed = 21921;
function noise() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; }
function wave(name, seconds, sample) {
  const count = Math.round(seconds * rate), data = Buffer.alloc(44 + count * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate, fade = Math.min(1, t / .012, (seconds - t) / .035);
    data.writeInt16LE(Math.round(Math.max(-.85, Math.min(.85, sample(t))) * fade * 32767), 44 + i * 2);
  }
  fs.mkdirSync(dir, {recursive:true}); fs.writeFileSync(path.join(dir, name), data);
}
let phase = 0, filtered = 0;
wave('plush-soft-squeeze-v1.wav', 1.15, t => {
  filtered = filtered * .80 + noise() * .20;
  const env = Math.pow(Math.sin(Math.PI * Math.min(1, t / .95)), 2);
  phase += 2 * Math.PI * (460 + 170 * Math.sin(Math.PI * t / .95)) / rate;
  return env * (.08 * Math.sin(phase) + .025 * Math.sin(2 * phase) + .12 * filtered);
});
phase = 0; filtered = 0;
wave('wooden-stair-creak-v1.wav', 1.65, t => {
  filtered = filtered * .88 + noise() * .12;
  const u = t % .8, env = Math.sin(Math.PI * Math.min(1, u / .72)) ** 2;
  phase += 2 * Math.PI * (125 + 45 * Math.sin(u * 7) + 12 * Math.sin(t * 43)) / rate;
  const creak = env * (.10 * Math.sin(phase) + .045 * Math.sin(3 * phase) + .018 * Math.sin(7 * phase)) * (.65 + .35 * Math.sin(t * 91) ** 2);
  const tread = Math.exp(-u * 27) * (.13 * Math.sin(2 * Math.PI * 67 * u) + .22 * filtered);
  return creak + tread + env * .035 * filtered;
});
