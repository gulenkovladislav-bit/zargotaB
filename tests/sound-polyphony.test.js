'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('//  ZARGOTA SOUND ENGINE v2');
const end = html.indexOf('})(window);', start) + '})(window);'.length;
const sound = html.slice(start, end);

assert.match(sound, /var sampleGroups = Object\.create\(null\)/, 'sample playback owns semantic channels');
assert.match(sound, /function stopSampleGroup\(group, preserveRequest\)/, 'a replacement can stop the previous source in its channel');
assert.match(sound, /sampleGroupRequests\[group\]!==requestId/, 'a slow older decode cannot replace the newer semantic cue');
assert.match(sound, /if\(group\)stopSampleGroup\(group,true\)/, 'channel replacement happens before a new source starts');
assert.match(sound, /maxDuration[^\n]*exponentialRampToValueAtTime/, 'long samples fade before their bounded stop');
assert.match(sound, /group:'impact'/, 'weapon impacts share one non-stacking channel');
assert.match(sound, /group:'turn-flow'/, 'round and turn cues cannot overlap indefinitely');
assert.match(sound, /deathCoinReveal[\s\S]*stopSampleGroup\('death-bed'\);stopSampleGroup\('death-coin'\)/, 'death reveal stops the toss bed before its result cue');
assert.match(sound, /group:'death-reveal',maxDuration:3\.35/, 'long death recordings cannot outlive the ritual by many seconds');
assert.match(sound, /diagnostics: function\(\)/, 'active sample counts are available locally');
assert.match(sound, /document\.hidden\) return null/, 'a hidden document cannot start new synthetic tones or samples');
assert.match(sound, /function stopHiddenAudio\(\)/, 'visibility lifecycle owns one audio cleanup boundary');
assert.match(sound, /visibilitychange',stopHiddenAudio/, 'backgrounding triggers audio cleanup');
assert.match(sound, /activeAudioNodes\.slice\(\)/, 'ticks, tones and decoded samples are stopped together');
assert.match(html, /Audio samples активно \/ максимум/, 'performance diagnostics expose sample overlap');
assert.match(html, /Audio nodes \/ hidden stops/, 'performance diagnostics expose hidden-tab cleanup');

console.log('sound polyphony and lifetime contract passed');
