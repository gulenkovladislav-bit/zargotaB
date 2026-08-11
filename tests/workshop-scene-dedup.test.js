'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /function qaWorkshopFixtureReady\(scene\)[\s\S]*?scene\.layers[\s\S]*?qa-rat-melee[\s\S]*?qa-archer-range[\s\S]*?function isQaWorkshopSceneRecord\(record\)[\s\S]*?isQaWorkshopSceneNamed\(record\)&&qaWorkshopFixtureReady\(record\.scene\)/, 'cleanup must recognize only the complete generated workshop fixture');
assert.match(html, /function isQaWorkshopSceneNamed\(record\)[\s\S]*?record\.name==='Мастерская · тестовая арена'/, 'reuse should recognize a named workshop even when its old fixture is incomplete');
assert.match(html, /function saveQaWorkshopScene\(qaName\)[\s\S]*?ZargotaLib\.list\('scene'/, 'workshop reuse must query the persistent scene library, not a partially rendered cache');
assert.match(html, /record\.id===publishedSceneId[\s\S]*?record\.id===activeSceneId[\s\S]*?updatedAt/, 'published or open workshop scene must win before the newest fallback');
assert.match(html, /function cleanupQaWorkshopSceneDuplicates\(records,canonicalId\)[\s\S]*?isQaWorkshopSceneRecord\(record\)&&record\.id!==canonicalId[\s\S]*?ZargotaLib\.remove/, 'only verified non-canonical workshop copies may be removed');
assert.match(html, /if\(canonical\)[\s\S]*?zgSceneSave\(false[\s\S]*?cleanupQaWorkshopSceneDuplicates\(records,saved\.id\)/, 'existing workshop scene must be updated before duplicates are cleaned');
assert.match(html, /w\.zgSceneSave\(true,function\(saved\)\{finishQaWorkshopSceneSync\(\);\},qaName\)/, 'a new scene may be created only when the persistent library has no workshop fixture');
assert.match(html, /var qaWorkshopSceneSyncBusy=false[\s\S]*?if\(qaWorkshopSceneSyncBusy\)return/, 'parallel workshop entry must not start duplicate saves');
assert.match(html, /saveQaWorkshopScene\('Мастерская · тестовая арена'\)/, 'the builder must use the deduplicating persistence path');
assert.match(html, /var matches=records\.filter\(isQaWorkshopSceneNamed\)/, 'repairing an old empty workshop must update it instead of creating another scene');

console.log('workshop scene dedup contracts passed');
