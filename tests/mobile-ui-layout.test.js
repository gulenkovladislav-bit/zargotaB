const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(
  html,
  /@media\(max-width:600px\)\{\.skill-card-popup\{[^}]*max-height:calc\(100dvh - 60px\)!important[^}]*overflow-y:auto!important[^}]*overscroll-behavior:contain/,
  'long character ability cards must scroll inside the mobile viewport'
);

assert.match(
  html,
  /class="zg-shop-subtabs"/,
  'the shop section switcher must expose a stable responsive hook'
);

assert.match(
  html,
  /@media\(max-width:600px\)\{\s*\.zg-shop-subtabs\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'shop tabs must use a two-column mobile grid instead of clipped centered overflow'
);

assert.match(
  html,
  /@media\(max-width:620px\)\{[^\n]*\.zg-game-settings-tabs,\.zg-game-settings\.no-workshop \.zg-game-settings-tabs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'session settings tabs must use a readable two-column mobile grid'
);

assert.match(
  html,
  /v: '2026-08-27\.1'[^\n]*конструктор каталога[^\n]*встроенным двуязычным окном[^\n]*конструктор каталогу[^\n]*вбудованим двомовним вікном/,
  'the mobile fixes must be recorded in both changelog languages'
);

assert.match(
  html,
  /#page-form \.catalog-pill-icon\s*\{[^}]*width:\s*31px[^}]*height:\s*31px/,
  'catalog constructor category art must not expand to the source image dimensions'
);

assert.match(
  html,
  /@media \(max-width: 560px\)\s*\{\s*\.arena-combat-action-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  'arena combat actions must wrap to a two-column mobile grid'
);

assert.match(
  html,
  /#arena-manual-name,[\s\S]*?#arena-manual-side\s*\{[^}]*min-width:0[^}]*width:100%/,
  'native arena participant fields must be allowed to shrink inside the mobile grid'
);

assert.match(
  html,
  /@media\(max-width:760px\)\{[\s\S]*?\.zg-dice-pop,\.zg-dice-pop:has\(\.zg-dice-abils\.open\)\{[^}]*left:50%[^}]*width:calc\(100vw - 8px\)[^}]*transform:translateX\(-50%\)[\s\S]*?\.zg-dice-row\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/,
  'the mobile dice fan must stay centered and keep all six dice inside the viewport'
);

assert.match(
  html,
  /@media\(max-width:760px\)\{[\s\S]*?\.zg-vtt-journal\{bottom:128px\}[\s\S]*?\.zg-vtt-chat input\{font-size:16px\}/,
  'the mobile journal composer must clear the bottom dock and avoid native input zoom'
);

assert.match(
  html,
  /@media\(max-width:760px\)\{[\s\S]*?\.zg-game-overlay\.gm\.gm-vision \.zg-scene-quick\{top:170px;right:8px;width:auto\}[\s\S]*?\.zg-scene-gm-note\{width:calc\(100vw - 16px\);max-width:440px\}/,
  'mobile scene controls and their note must remain below the enlarged world clock and inside the viewport'
);

assert.match(
  html,
  /id="zg-gm-pin-overlay"[\s\S]*?id="zg-gm-pin-input"[^>]*inputmode="numeric"[^>]*autocomplete="one-time-code"/,
  'the GM PIN gate must use an in-app mobile-friendly dialog'
);

assert.doesNotMatch(
  html.match(/function zgGmGate\(onOk\)\s*\{[\s\S]*?\n\}/)?.[0] || '',
  /prompt\s*\(/,
  'the GM PIN gate must not depend on a system prompt unsupported by the in-app browser'
);

assert.match(
  html,
  /title: 'Мастерская Геймастера'[\s\S]*?title: 'Майстерня Гейммайстра'|title: 'Майстерня Гейммайстра'[\s\S]*?title: 'Мастерская Геймастера'/,
  'the GM PIN dialog must provide Russian and Ukrainian copy'
);

assert.match(
  html,
  /#page-workshop\s*\{[^}]*padding-top:\s*56px[^}]*box-sizing:\s*border-box[\s\S]*?@media \(max-width: 700px\)\s*\{\s*#page-manual,\s*#page-workshop\s*\{\s*padding-top:\s*50px/,
  'the NPC registry toolbar must stay below the fixed app header on desktop and mobile'
);

assert.match(
  html,
  /id="beast-actions-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="beast-actions-menu"/,
  'the bestiary overflow menu must expose an accessible mobile toggle'
);

assert.match(
  html,
  /function openBeastMenu\(button\)[\s\S]*?function closeBeastMenu\(\)/,
  'the bestiary overflow button must call a defined menu controller'
);

assert.match(
  html,
  /@media \(max-width: 600px\)[\s\S]*?\.home-card\s*\{[^}]*touch-action:\s*pan-y/,
  'home cards must leave vertical gestures to native mobile scrolling'
);

const preciseHomeTap = html.match(/function bindHomeCardPreciseTap\(card, go\)\s*\{[\s\S]*?\n  \}\n  document\.querySelectorAll\('#page-home \.home-card/);
assert.ok(preciseHomeTap, 'home cards must use a dedicated precise-tap guard');
assert.match(
  preciseHomeTap[0],
  /moveThreshold\s*=\s*10[\s\S]*?pointermove[\s\S]*?pointercancel[\s\S]*?suppressClickUntil/,
  'a moved or cancelled pointer gesture must suppress the following synthetic click'
);
assert.doesNotMatch(
  preciseHomeTap[0],
  /touchend[\s\S]*?go\(\)/,
  'home card touchend must not navigate unconditionally after a scroll gesture'
);

console.log('Mobile UI layout: OK');
