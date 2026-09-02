const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert(html.includes('var LOADER_MIN_VISIBLE_MS = 2400'), 'startup loader must remain visible long enough to cover late initialization');
assert(html.includes('window.zgHomeInteractionsReady === true') && html.includes('window.zgHomeInteractionsReady = true'), 'loader and home bindings must share an explicit interaction-ready gate');
assert(html.includes("window.dispatchEvent(new CustomEvent('zgDataReady', { detail: state }))") && html.includes('function finishWhenInteractive(state)'), 'data refresh must finish behind the loader before readiness polling begins');
assert(/requestAnimationFrame\(function\(\) \{\s*requestAnimationFrame\(function\(\) \{/.test(html), 'loader must allow two paint frames before revealing the interface');
assert(html.includes("loaderText('Подготавливаю интерфейс…', 'Готую інтерфейс…')"), 'new startup status must ship in Russian and Ukrainian');
assert(html.includes("v: '2026-09-01.25'") && html.includes("notesUk: 'Стартовий екран завантаження"), 'startup readiness release note must remain bilingual');
assert(html.includes('function timelineLoaderGoal(elapsed)') && html.includes('return 88 + 7 * (1 - Math.exp'), 'loader progress must keep moving throughout normal and extended readiness waits');
assert(html.includes('var eased = t * t * (3 - 2 * t)') && html.includes('var maximumStep = (loaderCompletionRequested ? 58 : 38) * delta / 1000'), 'loader progress must use a smooth timeline and cap sudden speed changes');
assert(html.includes('function loaderPhaseTarget(phase, pct)') && html.includes("phase === 'ready' || phase === 'offline' || phase === 'error'") && html.includes('return 44'), 'fast cached data must leave most visible progress for the continuous interface-preparation curve');
assert(html.includes('Math.min(loaderCompletionRequested ? 100 : 94') && html.includes('loaderDisplayedPct >= 99.75'), 'loader must reserve its final progress for the real interaction-ready completion');
assert(html.indexOf("document.documentElement.classList.add('zg-startup-pending')") < html.indexOf('<script src="zargota-i18n.js'), 'startup veil must be installed before application scripts can paint the home screen');
assert(html.includes('html.zg-startup-pending::before') && html.includes("document.documentElement.classList.remove('zg-startup-pending')"), 'startup veil must cover the first frame and hand off directly to the loader');
assert(html.includes('zgLoaderFogA') && html.includes('zgLoaderFogB') && !html.includes('class="zg-loader-sigil"') && !html.includes('id="zg-loader-pct"'), 'loader must use the calm fog composition without the ornate sigil or visible percentage');
assert(!html.includes('id="zg-loader-version"') && !html.includes('function setLoaderVersion') && !html.includes("loaderText('локальная', 'локальна')"), 'startup loader must not show an unexplained local-version caption');
assert(html.includes('width:min(420px,calc(100vw - 40px))') && html.includes('font:400 30px/1.1 Georgia') && html.includes('width:min(310px,78vw)') && html.includes('font:400 16px/1.45 Georgia'), 'startup loader card, title, status, and progress bar must be slightly larger');
assert(html.includes('@media(prefers-reduced-motion:reduce)') && html.includes('role="progressbar"') && html.includes('aria-valuenow'), 'loader animation must remain accessible');
assert(html.includes("v: '2026-09-01.27'") && html.includes("notesUk: 'Стартове завантаження отримало живу шкалу"), 'animated loader release note must remain bilingual');
assert(html.includes("v: '2026-09-01.30'") && html.includes("notesUk: 'Стартовий екран більше не показує головне меню"), 'calm fog loader and first-frame fix must have a bilingual release note');
assert(html.includes("v: '2026-09-01.33'") && html.includes("notesUk: 'Стартове завантаження стало трохи більшим"), 'larger and smoother loader release note must be bilingual');

console.log('startup loader readiness contract passed');
