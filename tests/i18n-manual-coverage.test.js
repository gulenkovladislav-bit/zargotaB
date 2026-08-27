const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manualUk = require(path.join(root, 'zargota-i18n-manual-uk.js'));

function between(source, start, end, includeEnd) {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt);
  assert(startAt >= 0 && endAt > startAt, `source markers must exist: ${start} -> ${end}`);
  return source.slice(startAt, endAt + (includeEnd ? end.length : 0));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const manualHashSource = between(indexSource, '//  MANUAL PAGE', '//  SHOP PAGE', false);
const injuryHashSource = between(indexSource, 'var ZG_INJURY_TABLE', 'w.ZARGOTA_INJURY_TABLE=ZG_INJURY_TABLE;', true);
assert.strictEqual(sha256(manualHashSource), manualUk.sourceHash, 'Manual source changed and requires a new Ukrainian review');
assert.strictEqual(sha256(injuryHashSource), manualUk.injuryHash, 'injury table changed and requires a new Ukrainian Manual review');

const injuryArraySource = between(indexSource, 'var ZG_INJURY_TABLE=', '\n  ];', true)
  .replace(/^var ZG_INJURY_TABLE=/, '')
  .replace(/;\s*$/, '');
const injuryTable = vm.runInNewContext(`(${injuryArraySource})`, Object.create(null));
const host = {
  innerHTML: '',
  querySelectorAll() { return []; }
};
const sandbox = {
  window: {
    ZARGOTA_INJURY_TABLE: injuryTable,
    zgInjuryIconMarkup() { return ''; }
  },
  document: {
    getElementById(id) { return id === 'manual-page-inner' ? host : null; }
  },
  manualUiState: { query: '', category: 'all' },
  syncManualBridgeUi() {},
  escHTML(value) { return String(value); },
  zgDamageIconMarkup() { return ''; }
};
const executableManualSource = between(indexSource, 'var MANUAL_CATEGORIES = [', "if (typeof window !== 'undefined') { window.renderManualPage = renderManualPage; }", true);
vm.runInNewContext(executableManualSource, sandbox);
sandbox.renderManualPage();

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const textNodes = [];
const seen = new Set();
for (const match of host.innerHTML.matchAll(/>([^<>]+)</g)) {
  const source = decodeHtml(match[1]).trim();
  if (!source || seen.has(source)) continue;
  seen.add(source);
  textNodes.push(source);
}

const russianText = /[А-ЯЁа-яё]/u;
const required = textNodes.filter((source) => russianText.test(source));
const translations = manualUk.translations;
const missing = required.filter((source) => typeof translations[source] !== 'string' || !translations[source].trim());
assert.deepStrictEqual(missing, [], `every Russian Manual text node must have a reviewed Ukrainian translation; missing ${missing.length}: ${missing.slice(0, 8).join(' | ')}`);

const numberTokens = (value) => (String(value).match(/\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(',', '.'));
const numericMismatches = required.filter((source) => numberTokens(source).join('|') !== numberTokens(translations[source]).join('|'));
assert.deepStrictEqual(numericMismatches, [], `Manual translations must preserve numeric tokens; mismatches ${numericMismatches.length}`);

const reviewTargets = required.map((source) => translations[source]);
const rejectedWording = /\b(?:ГМ|каст(?:овать|уется)?|сейв(?:ы|е)?|спелл(?:ам|ы)?|хар-ка|дефолт|стак(?:аются|а?))\b/iu;
const rejected = reviewTargets.filter((target) => rejectedWording.test(target));
assert.deepStrictEqual(rejected, [], `reviewed Manual contains rejected slang or Russian shorthand: ${rejected.slice(0, 5).join(' | ')}`);

const sidecarSource = fs.readFileSync(path.join(root, 'zargota-i18n-manual-uk.js'), 'utf8');
assert(!/localStorage|indexedDB|firebase|database\s*\(/i.test(sidecarSource), 'Manual sidecar must not mutate storage or Firebase');

console.log(`i18n Manual coverage: OK (${required.length}/${textNodes.length} Russian text nodes reviewed)`);
