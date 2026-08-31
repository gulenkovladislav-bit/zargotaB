const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const abilitiesStart = html.indexOf('function abilitiesPanel()');
const abilitiesEnd = html.indexOf('function dicePanel()', abilitiesStart);
assert.ok(abilitiesStart >= 0 && abilitiesEnd > abilitiesStart, 'ability panel source must exist');
const abilities = html.slice(abilitiesStart, abilitiesEnd);

assert.match(html, /\.zg-spell-catalog-card\.has-actions\{display:block\}/, 'spell actions remain inside the spell plaque instead of forming a detached side rail');
assert.match(html, /\.zg-spell-catalog-card\.has-actions>\.zg-spell-card-main\{[^}]*padding-right:50px/, 'spell copy reserves room for its corner action');
assert.match(html, /\.zg-spell-card-menu\{position:absolute;[^}]*right:7px;bottom:7px;top:auto/, 'spell action is anchored inside the lower-right card corner');
assert.match(html, /\.zg-spell-card-menu-toggle\{[\s\S]*?width:34px;height:34px;min-height:0/, 'spell action must stay a compact medallion instead of stretching across the card');
assert.match(html, /\.zg-spell-card-menu-toggle\{[\s\S]*?border-radius:11px 11px 4px 11px/, 'spell action uses an inset corner-tab silhouette rather than a floating circle');
assert.match(html, /\.zg-spell-card-menu-toggle small\{[^}]*clip-path:inset\(50%\)/, 'the action label remains accessible without becoming a clipped visual caption');
assert.match(html, /\.zg-spell-card-menu-toggle\.direct-study::after\{content:'\+'/, 'direct learning is marked by a compact plus badge');
assert.doesNotMatch(html, /\.zg-spell-card-menu-toggle:hover[^}]*transform:/, 'hover must not make the small action run away from the pointer');
assert.doesNotMatch(html, /\.zg-spell-catalog-card\.is-unlearned\{[^}]*repeating-linear-gradient/, 'unlearned spells must not use diagonal editor hatching');
assert.doesNotMatch(abilities, />•••<\/button>/, 'the spell card must not expose an unexplained three-dot button');
assert.match(abilities, /abilityActionMarkHtml\(learningMenu\?'study':'menu'\)/, 'learning and general actions use recognisable vector marks');
assert.match(abilities, /vttSpellPlaybackText\('Изучить','Вивчити'\)/, 'the direct learning action is bilingual');
assert.match(abilities, /vttSpellPlaybackText\('Отметить освоенным','Позначити опанованим'\)/, 'the GM learning action is framed as character mastery in both locales');
assert.match(abilities, /class="zg-spellbook-count"[^>]*><b>'\+innateCards\.length\+'<\/b><\/span>/, 'innate total is rendered as the number alone');
assert.match(abilities, /class="zg-spellbook-count"[^>]*><b>'\+spellCount\+'<\/b><\/span>/, 'spell total is rendered as the number alone');
assert.doesNotMatch(abilities, /class="zg-spellbook-count"[^>]*>[\s\S]{0,120}<small>/, 'magic section totals must not add a label that can cover the heading');
assert.match(html, /\.zg-spellbook section>header>\.zg-spellbook-count\{[\s\S]*?width:24px;[\s\S]*?min-width:24px;[\s\S]*?border-radius:50%/, 'magic totals remain compact number circles in narrow headers');
assert.match(abilities, /class="zg-gm-spell-add"[\s\S]{0,500}?vttSpellPlaybackText\('Открыть каталог заклинаний','Відкрити каталог заклять'\)[\s\S]{0,500}?>＋<\/button>/, 'catalog action is a plus-only button with bilingual accessible text');
assert.match(html, /\.zg-spellbook-catalog>header \.zg-gm-spell-add\{[^}]*flex:0 0 28px;[^}]*width:28px;[^}]*margin:0/, 'the catalog plus stays compact and cannot cover the heading');

console.log('spellbook card polish passed');
