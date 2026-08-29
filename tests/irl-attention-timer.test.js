'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'zargota-i18n.js'), 'utf8');

assert.strictEqual((html.match(/id="zg-irl-attention-toast"/g) || []).length, 1, 'the IRL table needs one shared five-minute warning');
assert.match(html, /stored\.attentionByKey=stored\.attentionByKey/, 'attention timers must be kept in the active local session');
assert.match(html, /\[5,10,15,20,30\]\.map/, 'each portrait timer must offer the five quick durations including 30 minutes');
assert.match(html, /zg-irl-attention-custom[\s\S]*?type="number" min="1" max="180"[\s\S]*?zgIrlAttentionStartCustom/, 'the timer menu must accept a custom duration from 1 to 180 minutes');
assert.match(html, /function irlAttentionSnapshot\(timer,now\)[\s\S]*?remaining>0&&remaining<=300000/, 'the warning state must begin at the five-minute threshold');
assert.match(html, /function irlAttentionTick\(now\)[\s\S]*?!timer\.warned&&snap\.warning[\s\S]*?irlAttentionShowToast/, 'the compact five-minute warning must only be announced once');
assert.match(html, /zg-irl-attention-ring[\s\S]*?conic-gradient[\s\S]*?--zg-attention-progress/, 'portrait progress must be rendered as a circular ring');
assert.match(html, /class="zg-irl-hero-vitals"[\s\S]*?class="zg-irl-hero-hp" aria-label="HP '[\s\S]*?class="zg-irl-hero-ac" aria-label="AC '/, 'each portrait must show HP and final sheet AC in one unified HUD');
assert.match(html, /\.zg-irl-hero-vitals\{[^}]*grid-template-columns:1fr 1fr[^}]*border-radius:999px/, 'the HP and AC HUD must remain one balanced two-part pill');
assert.match(html, /\.zg-irl-character-dock\{[^}]*gap:14px[^}]*padding:10px 18px/, 'the desktop dock must be enlarged by roughly thirty-five percent');
assert.match(html, /\.zg-irl-hero-button\{[^}]*width:78px[^}]*height:78px/, 'hero portraits must grow with the dock instead of leaving empty padding');
assert.match(html, /\.zg-irl-hero-vitals\{[^}]*bottom:-28px[^}]*width:84px[^}]*height:30px/, 'the enlarged HP and AC HUD must stay below the portrait ring');
assert.match(html, /\.zg-irl-attention-time\{[^}]*top:-31px[^}]*height:26px/, 'the enlarged remaining-time badge must stay above the portrait');
assert.match(html, /ac=Math\.max\(0,Number\(character&&character\.ac\)\|\|10\)/, 'the dock AC badge must use the final character-sheet AC');
assert.match(html, /zg-irl-attention-due[\s\S]*?zgIrlAttentionDone[\s\S]*?zgIrlAttentionAdd/, 'the expired reminder must offer Done and +5 minutes');
assert.match(html, /zg-irl-attention-due[\s\S]*?zg-irl-attention-extend[\s\S]*?type="number" min="1" max="180"[\s\S]*?zgIrlAttentionAddCustom/, 'the expired reminder must replace the unused note with custom minute extension');
assert.match(html, /w\.zgIrlAttentionAddCustom=function\(key,event\)[\s\S]*?zg-irl-attention-extend input[\s\S]*?w\.zgIrlAttentionAdd\(key,minutes,event\)/, 'custom extension must validate and add the selected number of minutes');
assert.doesNotMatch(html, /zgIrlAttentionNote|attentionNotesByKey|Быстрая заметка/, 'the unused quick-note field and dead state must be removed');

const snapshotSource = html.match(/function irlAttentionSnapshot\(timer,now\)\{[^\n]+\}/);
assert.ok(snapshotSource, 'attention snapshot helper must remain testable');
const sandbox = {};
vm.runInNewContext(snapshotSource[0] + ';this.snapshot=irlAttentionSnapshot;', sandbox);
const timer = { durationMs: 600000, endsAt: 1600000 };
assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.snapshot(timer, 1000000))), { remaining: 600000, progress: 0, due: false, warning: false });
assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.snapshot(timer, 1300000))), { remaining: 300000, progress: 0.5, due: false, warning: true });
assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.snapshot(timer, 1600000))), { remaining: 0, progress: 1, due: true, warning: false });

const attentionHandlers = html.match(/w\.zgIrlAttentionMenu=function[\s\S]*?w\.zgIrlAttentionTick=function\(now\)[^\n]+/);
assert.ok(attentionHandlers, 'all portrait timer handlers must exist');
assert.doesNotMatch(attentionHandlers[0], /Firebase|ZargotaRooms|updateRoom|setRoom/, 'IRL attention timers must stay local and must not write to the online room');

[
  "'Таймер внимания': 'Таймер уваги'",
  "'Своё время, мин': 'Свій час, хв'",
  "'Поставить': 'Установити'",
  "'Пора уделить внимание': 'Час приділити увагу'",
  "'Добавить минут': 'Додати хвилин'",
  "'Через 5 минут — время': 'За 5 хвилин — час'"
].forEach((entry) => assert.ok(i18n.includes(entry), 'missing bilingual attention copy: ' + entry));

console.log('IRL attention timer: ok');
