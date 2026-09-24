# Карточная мини-игра / Карткова мінігра

## RU — включение

Редактор эпизода → **Мини-игры** → **Включить карточную мини-игру**.
Выберите реплику, после которой начинается раздача, и трёх соперников из
персонажей эпизода. «Тест мини-игры» работает и без включения в сюжет.
Настройки сохраняются вместе с обычным JSON эпизода в
`minigames.towerClaw = {enabled, afterNodeId, opponents, stack}`.
По умолчанию модуль выключен. Существующие эпизоды не мигрируются и не меняются.
После завершения или досрочного выхода продолжается выбранный сюжетный переход.
Результат доступен в состоянии прохождения `minigames.towerClaw` и флагах
`cardGamePlayed`, `cardGameWon`; повторный запуск обновляет результат.

Первый прототип: 40 карт, 10 рангов × 2 цвета × 2 копии. Две личные карты,
шесть общих, открытие 3 → 2 → 1, лучшая шестёрка из восьми. Ранг объединяет
цвета; цвет не служит старшинством. Колода и порядок силы пока тестовые,
не утверждённая математическая балансировка. Стрит-флеш отдельно не выделяется.
В справке есть все 11 комбинаций и их покерные соответствия.

Ставки — учебные фишки: чек / уравнять / пас / повышение на одну фишку,
одно повышение на круг. Повышение ограничено средствами всех оставшихся
игроков; олл-ин и побочные банки не нужны. Равные руки делят банк; остаток
по одной фишке выдаётся по порядку мест. Новая раздача восстанавливает учебный
запас. Серебро, предметы, сюжетные награды и реплики не изменяются. Ставки
конкретной сцены и дальнейшие реакции подключаются отдельным следующим шагом.

## UK — увімкнення

Редактор епізоду → **Мініігри** → **Увімкнути карткову мінігру**.
Оберіть репліку, після якої починається роздача, та трьох суперників із
персонажів епізоду. «Тест мінігри» працює й без увімкнення в сюжет.
Налаштування зберігаються у звичайному JSON епізоду в `minigames.towerClaw`.
Типово модуль вимкнено; наявні епізоди не мігруються й не змінюються.
Після завершення або дострокового виходу продовжується обраний сюжетний перехід.
Результат — у стані проходження `minigames.towerClaw` та прапорцях
`cardGamePlayed`, `cardGameWon`; повторний запуск оновлює результат.

Перший прототип: 40 карт, 10 рангів × 2 кольори × 2 копії. Дві особисті карти,
шість спільних, відкриття 3 → 2 → 1, найкраща шістка з восьми. Ранг об'єднує
кольори; колір не визначає старшинство. Колода й порядок сили поки тестові,
не затверджене математичне балансування. Стрит-флеш окремо не виділяється.
У довідці є всі 11 комбінацій та їхні покерні відповідники.

Ставки — навчальні фішки: чек / зрівняти / пас / підвищення на одну фішку,
одне підвищення на коло. Ліміт враховує кошти всіх гравців, що залишилися;
ол-ін і побічні банки не потрібні. Рівні руки ділять банк; залишок по одній
фішці видається за порядком місць. Нова роздача відновлює навчальний запас.
Срібло, предмети, сюжетні нагороди та репліки не змінюються. Ставки конкретної
сцени й подальші реакції підключаються окремим наступним кроком.

## Assets / prompts

Background: `assets/stories/cards/tower-claw/table-burlap-v1.png`.
Built-in imagegen, exact prompt:

> Use case: precise-object-edit. Production game background clean plate. Keep the exact overhead camera, warm painterly sunlight, rectangular burlap cloth on grass, tiny wildflowers and peripheral sleeping cat of this approved game mockup. Remove ALL cards, deck, tokens, portraits, UI buttons, labels, coins, bags, hands and text. Fill their areas naturally with uninterrupted burlap or grass. Central cloth should occupy 85 percent of width and height with very ample clean playing surface. Landscape 1536x1024. No characters, no symbols, no interface, no writing. This is a background on which live HTML game objects will be placed.

Reference: `exec-fec44be5-7801-484e-a09d-7d0d44106da6.png`.
Generated original: `exec-1d864793-e27b-4e34-91c8-bb98b6830ce3.png`.
Approved back: unchanged right-hand card from `approved-frame-sheet-v1.png`,
original `exec-11f2c66c-493f-4f67-ad32-fbd47f634298.png`; displayed by CSS sprite.
No new back design is used. Rank I skeleton and rank II imp use approved v2
wide-frame originals, not obsolete narrow v1 cards.

## Validation

`node tests/story-card-game.test.js` — deterministic categories, 1,000 seeded
games, conservation, gate and asset paths. `tests/card-game-preview.html` is an
isolated manual test without persistence. Not a replacement for playing the
authored episode in Edge.

2026-09-22: Edge isolated preview verified manually through raise/call, 3 → 2 → 1
reveal, showdown, bank payout, exit callback, reference back and help drawer.
Actual authored episode launch has not been manually verified; its data was not
overwritten. Focused core/editor/player tests pass. Of 48 story test files,
42 pass; failures remain in unchanged choice-fixed-panel, image-reveal,
screen-fx, sidequests, timeline-resize and village-errand areas.

## Оживление стола / Пожвавлення столу

RU: Добавлены последовательная раздача, раскрытие общих карт, мягкое свечение
хода, реакция банка и однократный акцент победителя. Учитывается reduced motion.
Клик по портрету соперника → «Присмотреться»: наблюдение только за публичным
действием и настроенной манерой, без чтения руки. Меню ставит ходы на паузу.
Кот мурчит по нажатию; повторные клики не наслаивают звук. Выход и выключение
звука останавливают запись. Остальные звуки в audio/candidates ожидают согласования.

UK: Додано послідовну роздачу, відкриття спільних карт, м’яке світіння ходу,
реакцію банку й одноразовий акцент переможця. Враховано reduced motion.
Натискання на портрет суперника → «Придивитися»: спостереження лише за публічною
дією та налаштованою манерою, без читання руки. Меню ставить ходи на паузу.
Кіт муркоче за натисканням; повторні натискання не накладають звук. Вихід і
вимкнення звуку зупиняють запис. Решта звуків в audio/candidates чекають погодження.

Validation: isolated in-app browser confirms portrait menu, observation text,
return, audio `playing` feedback and mute. Speaker output/loudness and this
update's actual Edge playback remain unverified. Unit suite passes.
