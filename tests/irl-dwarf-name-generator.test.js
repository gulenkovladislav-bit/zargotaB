'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'js', 'irl-name-catalog.js'), 'utf8');
const world = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const context = { window: {} };
vm.runInNewContext(source, context);
const catalog = context.window.ZARGOTA_IRL_NAME_CATALOG;
const expectedAgeStems = {
  dwarf: { young: ['Ард', 'Брен', 'Вар', 'Каз', 'Кил'], adult: ['Гар', 'Дор', 'Инг', 'Кор', 'Тар'], mature: ['Бар', 'Дур', 'Маг', 'Нор', 'Раг'], old: ['Ор', 'Рун', 'Тор', 'Фар', 'Хар'] },
  human: { young: ['Адел', 'Вен', 'Дар', 'Ил', 'Мир'], adult: ['Вал', 'Ген', 'Дам', 'Кал', 'Мар'], mature: ['Альб', 'Берт', 'Ерм', 'Лор', 'Нат'], old: ['Ост', 'Рен', 'Сев', 'Теод', 'Фел'] },
  orc: { young: ['Арг', 'Баг', 'Гар', 'Раг', 'Рок'], adult: ['Борг', 'Варг', 'Гор', 'Драг', 'Карг'], mature: ['Грум', 'Краг', 'Морг', 'Нарг', 'Орг'], old: ['Тарг', 'Торг', 'Ург', 'Харг', 'Шар'] },
  elf: { young: ['Аэл', 'Ил', 'Лаэр', 'Лиар', 'Риэл'], adult: ['Ваэл', 'Маэл', 'Наэл', 'Саэл', 'Таэл'], mature: ['Гал', 'Силь', 'Фаэл', 'Эли', 'Кэли'], old: ['Эн', 'Эр', 'Эст', 'Ял', 'Мир'] }
};

assert.ok(catalog, 'IRL name catalog must load without Firebase');
for (const race of ['dwarf', 'human', 'orc', 'elf']) {
  const entry = catalog[race];
  assert.ok(entry, `${race} catalog must exist`);
  assert.strictEqual(entry.first.length, 400, `${race} needs exactly 400 given names`);
  assert.strictEqual(new Set(entry.first).size, 400, `${race} given names must be unique`);
  assert.ok(entry.surnames.length >= 330, `${race} needs a broad byname catalog`);
  assert.strictEqual(new Set(entry.surnames).size, entry.surnames.length, `${race} bynames must be unique`);
  assert.ok(entry.features.length >= 40, `${race} needs at least 40 grounded roleplay traits`);
  assert.strictEqual(new Set(entry.features).size, entry.features.length, `${race} traits must be unique`);
  assert.strictEqual(entry.professions.length, 4, `${race} must offer exactly four contrasting professions`);
  assert.strictEqual(new Set(entry.professions.map(item => item.id)).size, 4, `${race} profession roles must be distinct`);
  assert.deepStrictEqual(Array.from(entry.professions, item => item.label), ['Житель', 'Стражник', 'Ремесленник', 'Купец'], `${race} must use broad at-a-glance occupations`);
  assert.strictEqual(entry.lore.givers.length, 10, `${race} needs ten naming sources`);
  assert.strictEqual(entry.lore.origins.length, 38, `${race} needs every named main-island Atlas place`);
  assert.ok(entry.lore.givers.length * entry.lore.origins.length >= 200, `${race} needs at least 200 naming-history combinations`);
  assert.strictEqual(new Set(entry.lore.givers).size, 10, `${race} naming sources must be unique`);
  assert.strictEqual(new Set(entry.lore.origins).size, 38, `${race} origins must be unique`);
  const female = entry.first.filter(name => /(?:а|ия)$/.test(name));
  const male = entry.first.filter(name => !/(?:а|ия)$/.test(name));
  assert.strictEqual(female.length, 200, `${race} needs 200 female given names`);
  assert.strictEqual(male.length, 200, `${race} needs 200 male given names`);
  const agePools = ['young', 'adult', 'mature', 'old'].map(age => entry.firstByAge[age]);
  assert.ok(agePools.every(pool => pool.length === 100), `${race} needs four equally useful generational name pools`);
  assert.strictEqual(new Set(agePools.flat()).size, 400, `${race} age pools must create visibly different generations`);
  for (const age of ['young', 'adult', 'mature', 'old']) {
    assert.ok(entry.firstByAge[age].every(name => expectedAgeStems[race][age].some(stem => name.startsWith(stem))), `${race} ${age} names must stay inside the edited generational vocabulary`);
  }
  const professionPools = ['resident', 'guard', 'craft', 'trade'].map(job => entry.surnamesByProfession[job]);
  assert.ok(professionPools.every(pool => pool.length >= 136), `${race} needs very broad profession byname pools`);
  assert.strictEqual(new Set(professionPools.map(pool => pool.join('|'))).size, 4, `${race} professions must not share identical byname pools`);
  assert.ok(professionPools.flat().every(name => entry.surnames.includes(name)), `${race} profession bynames must come from its established catalog`);
}

assert.ok(catalog.orc.surnamesByProfession.trade.includes('Медный Вес') && catalog.orc.surnamesByProfession.trade.includes('Верный Караван'), 'orc merchants need weights and caravan-house bynames');
assert.ok(catalog.elf.surnamesByProfession.trade.includes('Янтарные Весы') && catalog.elf.surnamesByProfession.trade.includes('Шёлковый Путь'), 'elf merchants need goods and route bynames');
assert.ok(catalog.human.surnamesByProfession.guard.includes('Лунный Страж') && catalog.dwarf.surnamesByProfession.guard.includes('Кованый Щит'), 'guard pools need unmistakably martial bynames');
assert.ok(catalog.human.surnamesByProfession.craft.includes('Семь Гвоздей') && catalog.orc.surnamesByProfession.craft.includes('Костяное Кольцо'), 'craft pools need unmistakably made-object bynames');
assert.ok(!catalog.orc.surnamesByProfession.trade.some(name => ['Рваное Ухо', 'Ровное Копьё'].includes(name)), 'orc merchants must not receive fallback combat bynames');
assert.ok(catalog.elf.surnamesByProfession.guard.includes('Вересковый Дозор') && catalog.elf.surnamesByProfession.guard.includes('Серебряный Лук'), 'elf guards need explicit watch and weapon bynames');
assert.ok(!catalog.elf.surnamesByProfession.guard.some(name => ['Медовая Мера', 'Песнь Дрозда', 'Дальний Свет'].includes(name)), 'elf guards must not receive fallback trade or artisan bynames');
assert.ok(!catalog.human.surnamesByProfession.craft.includes('Три Монеты'), 'human artisans must not receive a fallback merchant byname');
assert.ok(catalog.elf.surnamesByProfession.trade.length >= 18, 'elf merchants need a broader byname pool');
assert.ok(catalog.elf.surnamesByProfession.trade.filter(name => /лист|кора/i.test(name)).length <= 1, 'elf merchant results must not be dominated by leaf and bark bynames');
assert.ok(catalog.human.surnamesByProfession.trade.includes('Серебряная Фляжка'), 'human merchants need grounded object bynames');
assert.ok(catalog.human.surnamesByProfession.trade.every(name => name.trim().split(/\s+/).length >= 2), 'a generated byname must remain one readable multiword epithet');

const mainIslandAtlasPlaces = world.atlas.objects.filter(item => item.type === 'zone' && ['Корневая Долина', 'Левошлак', 'Верхземье'].includes(item.meta && item.meta.region) && item.name.trim() !== 'Новая зона');
assert.strictEqual(mainIslandAtlasPlaces.length, 38, 'fixture must expose the 38 named places on Zargota main island');
for (const place of mainIslandAtlasPlaces) {
  assert.ok(catalog.human.lore.origins.some(origin => origin.includes(place.name.trim())), `name lore must reuse Atlas place: ${place.name.trim()}`);
}

assert.ok(catalog.human.surnames.every(name => name.includes(' ')), 'human bynames must read as fantasy epithets rather than modern surnames');
assert.ok(catalog.human.surnames.every(name => !/(?:ов|ев|ин|ский|цкий)$/i.test(name)), 'human bynames must avoid modern Russian surname endings');

assert.strictEqual((html.match(/class="zg-irl-name-tool"/g) || []).length, 1, 'GM table must expose exactly one Names tool button');
assert.match(html, /<script src="js\/irl-name-catalog\.js"><\/script>/, 'catalog must load before the local generator runtime');
assert.strictEqual((html.match(/data-race="(?:dwarf|human|orc|elf)"/g) || []).length, 4, 'custom race picker must expose four enabled races');
assert.doesNotMatch(html.match(/id="zg-irl-race-menu"[\s\S]*?<\/div>/)[0], /disabled/, 'race choices must not be disabled');
assert.match(html, /function pickUnused\(pool,used\)[\s\S]*?while\(!available\.length&&used\.length\)\{used\.shift\(\)/, 'generated values must use a sliding no-repeat window across pool boundaries');
assert.match(html, /var normalized=\[\][\s\S]*?normalized\.indexOf\(value\)<0[\s\S]*?used\.splice\.apply/, 'legacy generation histories must be deduplicated without forgetting valid values');
assert.match(html, /w\.zgIrlSavedDeleteRequest=function[\s\S]*?w\.zgIrlSavedDeleteConfirm=function/, 'saved NPCs need an in-app deletion flow');
assert.doesNotMatch(html.match(/var catalog=w\.ZARGOTA_IRL_NAME_CATALOG[\s\S]*?w\.zgIrlSavedDeleteConfirm=function[\s\S]*?\};/)[0], /\bconfirm\s*\(/, 'name-card deletion must not use a native confirm dialog');
assert.ok((html.match(/class="zg-irl-icon"/g) || []).length >= 8, 'generator controls must use custom vector icons');
assert.strictEqual((html.match(/data-irl-gender="(?:male|female)"/g) || []).length, 2, 'gender must use two custom choices');
assert.strictEqual((html.match(/data-irl-age="(?:young|adult|mature|old)"/g) || []).length, 4, 'age must use four quick choices');
assert.match(html, /function namesForProfile\(meta,gender,age\)[\s\S]*?meta\.firstByAge[\s\S]*?gender==='female'/, 'gender and age must jointly filter the generated name pool');
assert.match(html, /function surnamesForProfession\(meta,profession\)[\s\S]*?meta\.surnamesByProfession/, 'profession must choose a thematic byname pool');
assert.match(html, /firstUsedByProfile[\s\S]*?pickUnused\(first,firstUsed\)/, 'given names must cycle through the selected gender and age pool before repeating');
assert.match(html, /surnameUsedByProfile[\s\S]*?pickUnused\(bynames,bynameUsed\)/, 'profession bynames must cycle through their full pool before repeating');
assert.match(html, /bynameKey=race/, 'byname history must continue across profession changes for the same race');
assert.match(html, /function findUnusedPair\(first,bynames,used\)[\s\S]*?used\.indexOf\(name\)<0/, 'the full generated name must be checked against complete history');
assert.match(html, /data\.usedByRace\[race\]=used;/, 'complete generated-name history must persist without a rolling truncation');
assert.doesNotMatch(html, /used\.slice\(-1000\)/, 'generated-name memory must not forget older people');
assert.match(html, /firstName:firstName,byname:byname/, 'the result must keep exactly two semantic parts: given name and byname');
assert.match(html, /w\.zgIrlProfileChoose=function\(kind,value\)/, 'profile controls must update the current NPC');
assert.match(html, /w\.zgIrlProfileChoose=function\(kind,value\)[\s\S]*?data\.current=null;currentIrlName=null;saveNameState\(data\);w\.zgIrlNamesGenerate\(\)/, 'changing gender, age, or profession must immediately regenerate the NPC');
assert.match(html, /gender:currentIrlName\.gender,age:currentIrlName\.age,profession:currentIrlName\.profession/, 'saved NPC cards must retain gender, age, and profession');
assert.match(html, /\.zg-irl-profile-row\{display:grid;grid-template-columns:\.8fr 1\.55fr/, 'gender and age controls must share one compact row');
assert.match(html, /\.zg-irl-professions\{display:grid;grid-template-columns:repeat\(4,1fr\)/, 'four occupation directions must fit on one row');
assert.match(html, /\.zg-irl-name-popover\{[^}]*width:min\(640px/, 'generator panel must provide room for larger readable controls');
assert.match(html, /\.zg-irl-name-lore-row\{[^}]*font-size:15\.5px/, 'name lore must use readable body text');
assert.match(html, /\.zg-irl-name-feature span\{[^}]*font:600 17px/, 'roleplay detail must be visually prominent');
assert.match(html, /\.zg-irl-saved-card strong\{[^}]*font:700 17px/, 'saved NPC names must remain easy to read');
assert.match(html, /\.zg-irl-saved-lore-row\{[^}]*font-size:14\.5px/, 'saved NPC lore must use readable body text');
const nameResultMarkup = html.match(/<button type="button" id="zg-irl-name-result"[\s\S]*?<\/button>/)[0];
assert.match(nameResultMarkup, /onclick="zgIrlNameLoreToggle\(\)"/, 'full name lore must open by clicking the name');
assert.doesNotMatch(nameResultMarkup, /onmouseenter|onmouseleave|onfocus|onblur/, 'hover and focus must not open lore or make the name jump');
assert.doesNotMatch(html, /id="zg-irl-name-lore-button"|zgIrlNameLoreShow|zgIrlNameLoreHide/, 'the redundant lore button and hover handlers must be removed');
assert.match(html, /\.zg-irl-name-result\{[^}]*grid-column:1\/-1[^}]*white-space:normal[^}]*overflow:visible/, 'the full name must use the complete row and remain untruncated');
assert.match(html, /Кто назвал[\s\S]*?Родом из/, 'lore card must explain who named the NPC and where they came from');
assert.match(html, /function buildNameLore\(meta,firstName,byname,used,gender\)/, 'generated names must receive natural gender-aware meaning and history data');
assert.match(html, /version:6[\s\S]*?currentIrlName\.lore\.version!==6/, 'legacy lore must be rebuilt into the plain-language byname-aware version');
assert.match(html, /так '\+pronoun\+' назвали в память[\s\S]*?прозвище, полученное позже/, 'name meaning must be written as a short human story rather than database labels');
assert.match(html, /lore:currentIrlName\.lore/, 'saved NPCs must retain their name lore');
assert.match(html, /id="zg-irl-saved-tool"[\s\S]*?id="zg-irl-saved-count"/, 'saved names must collapse into a small counted tool');
assert.match(html, /class="zg-irl-name-close"[\s\S]*?zgIrlNamesToggle\(false\)/, 'generator needs an explicit compact collapse control');
assert.match(html, /w\.zgIrlSavedToggle=function\(force\)/, 'saved-name drawer must be independently collapsible');
assert.match(html, /w\.zgIrlSavedExpand=function\(id\)/, 'each saved name must expose its full information on demand');
assert.match(html, /zg-irl-saved-lore-row[\s\S]*?Как понимать имя[\s\S]*?Кто назвал[\s\S]*?Родом из/, 'expanded saved names must show concise complete naming lore');
assert.match(html, /saved\.forEach\(function\(item\)[\s\S]*?item\.lore\.version===6[\s\S]*?item\.lore=buildNameLore/, 'legacy saved names must receive concise plain-language lore');
assert.doesNotMatch(html.match(/function renderCurrent\(\)[\s\S]*?function renderSaved\(\)/)[0], /Происхождение сверено|В Зарготе форма|Место Атласа/, 'visible name lore must not expose technical wording');

const generatorBlock = html.match(/var catalog=w\.ZARGOTA_IRL_NAME_CATALOG[\s\S]*?w\.zgIrlSavedDeleteConfirm=function[\s\S]*?\};/);
assert.ok(generatorBlock, 'multi-race generator runtime must be present');
assert.doesNotMatch(generatorBlock[0], /Firebase|ZargotaRooms|createRoom/, 'name generation must remain local and Firebase-free');

console.log('IRL multi-race name generator: ok');
