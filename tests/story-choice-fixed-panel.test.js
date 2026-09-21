const fs = require('node:fs');
const assert = require('node:assert/strict');
const css = fs.readFileSync('story-player.css', 'utf8');
assert.ok(!css.includes(':has(.zg-story-answers .is-choice){height:auto'));
assert.ok(css.includes('height:var(--dialogue-block-height,180px)'));
assert.ok(css.includes('.zg-dialogue-keys{position:static'));
assert.ok(css.includes('min-height:38px;padding:6px 12px'));
console.log('PASS: fixed dialogue panel, compact answers, keyboard hint in flow');
