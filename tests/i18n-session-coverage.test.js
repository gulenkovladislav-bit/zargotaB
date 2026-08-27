'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const document = {
  documentElement: {},
  readyState: 'loading',
  addEventListener() {},
  querySelectorAll() { return []; }
};
const window = {
  document,
  localStorage: { getItem() { return 'uk'; }, setItem() {} },
  CustomEvent: function CustomEvent() {}
};
const context = { window, WeakMap, Object, Array, String, RegExp };

for (const file of ['zargota-i18n.js', 'zargota-i18n-content-uk.js', 'zargota-i18n-encyclopedia-uk.js', 'js/irl-name-catalog.js', 'zargota-i18n-session-uk.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}

const i18n = window.ZargotaI18n;
const catalog = window.ZARGOTA_IRL_NAME_CATALOG;
assert.ok(i18n && catalog, 'Session localization and the NPC catalog must load together');

const uiSamples = new Map([
  ['Карточка персонажа', 'Картка персонажа'],
  ['Персонажи партии', 'Персонажі загону'],
  ['СЕССИОННОЕ HP', 'HP СЕСІЇ'],
  ['Активных состояний нет', 'Активних станів немає'],
  ['Генератор имён', 'Генератор імен'],
  ['Случайный персонаж', 'Випадковий персонаж'],
  ['Сохранённые имена', 'Збережені імена'],
  ['Удалить из этой сессии?', 'Видалити з цієї сесії?'],
  ['Завершить реальную сессию?', 'Завершити реальну сесію?'],
  ['Создать онлайн-игру', 'Створити онлайн-гру'],
  ['Создать онлайн-комнату', 'Створити онлайн-кімнату'],
  ['Открыть Стол мастера', 'Відкрити Стіл Майстра'],
  ['Введите код приключения, чтобы присоединиться', 'Введіть код пригоди, щоб приєднатися'],
  ['к существующей игре.', 'до наявної гри.']
]);
for (const [source, target] of uiSamples) {
  assert.strictEqual(i18n.translate(source, 'uk'), target, `Session UI must translate: ${source}`);
  assert.strictEqual(i18n.translate(source, 'ru'), source, `Russian Session UI must remain unchanged: ${source}`);
}

const dynamicSessionMessages = [
  'Неверный пароль гейм-мастера.',
  'Открываем Стол мастера…',
  'Сетевая система ещё загружается.',
  'Создаём мастерскую комнату…',
  'Не удалось создать комнату.',
  'Введите код приключения.',
  'Проверьте код комнаты. Пример: K7F2Q',
  'Ищем комнату…',
  'Не удалось подключиться к комнате.',
  'Подтверждаем игрока…',
  'Не удалось подтвердить игрока.',
  'Сохраняем резерв и освобождаем место…',
  'Место освобождено. Резерв игрока сохранён в комнате.',
  'Открываем выбор героев…',
  '⚠ Выбранный локальный герой не найден',
  '💾 Аварийная копия героя скачана',
  'Сохраняем итог игры…',
  'Не удалось покинуть сессию.',
  'Подключение подтверждено.',
  'Ожидаем команду гейм-мастера…',
  'Заявка отправлена.',
  'Ожидаем подтверждения гейм-мастера…',
  'Не удалось получить итог из Firebase',
  'Повторить сохранение',
  '💾 Скачать аварийный JSON',
  'Выйти с локальной копией',
  'Остаться в сессии',
  'Наблюдайте, как герои выбирают свой путь',
  'Выберите персонажа',
  'Войти в игру как гейм-мастер',
  'Герои выбрали персонажей:',
  'Можно готовить сцену до подключения игроков',
  'Игрок просит добавить личного героя в эту комнату.',
  'Портрет не загружен — добавьте его в редакторе персонажей',
  'Личный герой допущен в комнату',
  'Личный герой отклонён; игрок сможет выбрать другого',
  'Собираю экспорт…',
  'Просмотр союзников',
  'Показывать результаты существ',
  'Здоровье существ для игроков',
  'Магическая немота',
  'Защитный щит',
  'Замешательство',
  'Собрать участников',
  'Быстрые группы',
  'К инициативе',
  'Критическая просадка кадров: главный поток или графические эффекты не успевают.'
];
for (const source of dynamicSessionMessages) {
  assert.notStrictEqual(i18n.translate(source, 'uk'), source, `Dynamic Session message must translate: ${source}`);
  assert.strictEqual(i18n.translate(source, 'ru'), source, `Dynamic Session message must preserve Russian: ${source}`);
}
assert.strictEqual(i18n.translate('Код скопирован: K7F2Q', 'uk'), 'Код скопійовано: K7F2Q');
assert.strictEqual(i18n.translate('Не удалось создать комнату: permission denied', 'uk'), 'Не вдалося створити кімнату: permission denied');
assert.strictEqual(i18n.translate('Прикреплено к «Лин’Ин» (оба слоя). Сохранено.', 'uk'), 'Прикріплено до «Лин’Ин» (обидва шари). Збережено.');
assert.strictEqual(i18n.translate('Скачано: героев с артами — 5', 'uk'), 'Завантажено: героїв з ілюстраціями — 5');
assert.strictEqual(i18n.translate('Обнаружена долгая задача JavaScript 165 мс — интерфейс в этот момент блокировался.', 'uk'), 'Виявлено тривале завдання JavaScript на 165 мс — у цей момент інтерфейс був заблокований.');
assert.strictEqual(
  i18n.translate('Firebase недоступен. Локальный лист не изменён. Можно повторить, скачать копию или выйти без последнего Firebase-снимка.', 'uk'),
  'Firebase недоступний. Локальний аркуш не змінено. Можна повторити, завантажити копію або вийти без останнього Firebase-знімка.'
);

assert.strictEqual(i18n.translate('Оценка Бестелесности', 'uk'), 'Оцінка безтілесності');
assert.strictEqual(i18n.translate('Фокус мастера: Лин’Ин — трещины памяти', 'uk'), 'Фокус Майстра: Лін’Ін — тріщини пам’яті');
assert.strictEqual(i18n.translate('Потрачено 1 из 3', 'uk'), 'Витрачено 1 із 3');

let featureCount = 0;
let bynameCount = 0;
let firstNameCount = 0;
for (const race of Object.keys(catalog)) {
  for (const firstName of catalog[race].first) {
    firstNameCount += 1;
    assert.doesNotMatch(i18n.translate(firstName, 'uk'), /[ыэъё]/iu, `${race} given name must use Ukrainian orthography: ${firstName}`);
  }
  for (const feature of catalog[race].features) {
    featureCount += 1;
    const translated = i18n.translate(feature, 'uk');
    assert.notStrictEqual(translated, feature, `${race} roleplay feature must be localized: ${feature}`);
    assert.doesNotMatch(translated, /[ыэъё]/iu, `${race} roleplay feature must not retain Russian-only letters`);
    assert.strictEqual(i18n.translate(feature, 'ru'), feature, 'Russian generator content must remain its source text');
  }
  for (const byname of catalog[race].surnames) {
    bynameCount += 1;
    assert.doesNotMatch(i18n.translate(byname, 'uk'), /[ыэъё]/iu, `${race} byname must not retain Russian-only letters: ${byname}`);
  }
  for (const giver of catalog[race].lore.givers) {
    assert.notStrictEqual(i18n.translate(giver, 'uk'), giver, `${race} naming source must be localized`);
  }
}
assert.strictEqual(featureCount, 160, 'all four races need all forty roleplay features localized');
assert.strictEqual(firstNameCount, 1600, 'all generated given names must pass through Ukrainian orthography');
assert.ok(bynameCount >= 1300, 'every generated byname combination must pass through the manual Ukrainian lexicon');
assert.strictEqual(i18n.translate('Риэлор', 'uk'), 'Ріелор');
assert.strictEqual(i18n.translate('Серебряная Фляжка', 'uk'), 'Срібна Фляга');
assert.strictEqual(i18n.translate('Пыльный След', 'uk'), 'Запилений Слід');
assert.strictEqual(i18n.translate('Дальний Свет', 'uk'), 'Далеке Світло');
assert.strictEqual(i18n.translate('Серый Бивень', 'uk'), 'Сіре Ікло');
assert.strictEqual(i18n.translate('Седая Осыпь', 'uk'), 'Сивий Осип');
assert.strictEqual(i18n.translate('Медная Цепь', 'uk'), 'Мідний Ланцюг');
assert.strictEqual(i18n.translate('Белая Прядь', 'uk'), 'Біле Пасмо');
assert.strictEqual(i18n.translate('Ровное Копьё', 'uk'), 'Рівний Спис');
assert.strictEqual(i18n.translate('Виноградники и поместье Беатрис Виньяр · Верхземье', 'uk'), 'Виноградники та маєток Беатріс Віньяр · Верхзем’я');
assert.strictEqual(
  i18n.translate('В имени «Марен» — память о дороге. Пожелание: ясный разум. «Серебряная Фляжка» — прозвище, закрепившееся за человеком.', 'uk'),
  'В імені «Марен» — пам’ять про дорогу. Побажання: ясний розум. «Срібна Фляга» — прізвисько, що закріпилося за цією людиною.'
);

assert.match(html, /<script src="js\/irl-name-catalog\.js"><\/script>\s*<script src="zargota-i18n-session-uk\.js\?v=/, 'Session content sidecar must load after the source NPC catalog');
assert.match(html, /function irlNameDisplay\(item\)/, 'generated and saved NPC names must have a locale-aware display path');
assert.match(html, /currentIrlName\?irlNameDisplay\(currentIrlName\)/, 'current NPC result must use the locale-aware display name');
assert.match(html, /facts=\[[\s\S]*?\.map\(irlTranslate\)\.join\(' · '\)/, 'saved NPC facts must translate each semantic field independently');
assert.match(html, /document\.addEventListener\('zargota:localechange'[\s\S]*?renderCurrent\(\);renderSaved\(\);renderIrlCharacters\(\);/, 'Session panels must rerender immediately after a locale change');
assert.match(html, /snapshot\.diagnosis\|\|\[\]\)\.map\(function\(issue\)\{return w\.ZargotaI18n/, 'performance diagnosis must translate each issue before joining the live message');

console.log(`i18n Session coverage: OK (${featureCount} features, ${bynameCount} bynames)`);
