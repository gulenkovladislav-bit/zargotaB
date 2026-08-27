import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outputPath = path.resolve(process.argv[2] || '/tmp/zargota-i18n-content-source.json');
const require = createRequire(import.meta.url);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const economy = require(path.join(root, 'item-economy.js'));
const russianText = /[А-ЯЁа-яё]/u;
const values = new Map();

function collect(value, source, pointer = '$') {
  if (typeof value === 'string') {
    if (russianText.test(value)) {
      const sources = values.get(value) || [];
      sources.push(`${source}:${pointer}`);
      values.set(value, sources);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collect(entry, source, `${pointer}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => collect(entry, source, `${pointer}.${key}`));
  }
}

collect(data.catalog, 'catalog');
collect(data.beasts, 'beasts');
collect(data.atlas, 'atlas');
collect(data.encyclopedia, 'encyclopedia');
collect(data.encyclopediaCategories, 'encyclopediaCategories');
collect(data.htree, 'htree');
collect(data.characters, 'characters');
collect(data.arena, 'arena');
collect(data.armoryItems, 'armoryItems');
collect(data.armorySets, 'armorySets');
collect(data.npc, 'npc');
collect(data.shop, 'shop');
collect(economy.getShopSeedItems(), 'economy.shopSeedItems');
collect(economy.getShopRegions(), 'economy.shopRegions');
collect(economy.getShopMarkets(), 'economy.shopMarkets');

const entries = Array.from(values.entries())
  .sort(([first], [second]) => first.localeCompare(second, 'ru'))
  .map(([text, sources], index) => ({ id: String(index + 1), text, sources }));
const output = {
  schemaVersion: 1,
  sourceLocale: 'ru',
  targetLocale: 'uk',
  generatedAt: new Date().toISOString(),
  entries
};

fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');
console.log(JSON.stringify({ outputPath, strings: entries.length, characters: entries.reduce((sum, entry) => sum + entry.text.length, 0) }));
