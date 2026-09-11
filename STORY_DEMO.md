# Сюжет Вротика / Сюжет Вротіка

RU: Откройте «Мастерская → Создание сюжета», в списке «Сюжет кампании» выберите «Вротик · Эпизод 1» и нажмите «Пройти эпизод». Нажмите на тропу для движения, на брата для разговора, на знак вопроса для осмотра камня. Пробел или нажатие на текст раскрывает реплику сразу. Кнопка «Заново» сбрасывает прохождение; «Редактор» возвращает к схеме.

UK: Відкрийте «Майстерня → Створення сюжету», у списку «Сюжет кампанії» оберіть «Вротік · Епізод 1» і натисніть «Пройти епізод». Натисніть на стежку для руху, на брата для розмови, на знак питання для огляду каменя. Пробіл або натискання на текст розкриває репліку одразу. Кнопка «Заново» скидає проходження; «Редактор» повертає до схеми.

## Инструменты / Інструменти

RU: Проигрыватель читает текущую схему реплик, выбранную начальную реплику, говорящего, названия ответов и задержки. В редакторе можно менять название и цель задания, отмечать завершающие реплики. Номера линий остаются видны рядом с текстом выбора. Русские и украинские реплики редактируются раздельно в соответствующем языке интерфейса.

UK: Програвач читає поточну схему реплік, обрану початкову репліку, мовця, назви відповідей і затримки. У редакторі можна змінювати назву й мету завдання, позначати завершальні репліки. Номери ліній залишаються видимими поруч із текстом вибору. Російські й українські репліки редагуються окремо відповідною мовою інтерфейсу.

RU: Существующий редактор сцены используется для фоновых слоёв и размещения жетонов. При запуске берётся свежий снимок сцены. Сюжетные сцены разделены по проектам и сохраняются отдельно от онлайн-сцен. Изменения игрового положения героя не перезаписывают стартовую композицию.

UK: Наявний редактор сцени використовується для фонових шарів і розташування жетонів. Під час запуску береться свіжий знімок сцени. Сюжетні сцени розділено за проєктами й збережено окремо від онлайн-сцен. Зміни ігрового положення героя не перезаписують початкову композицію.

RU: Это тестовый черновик предыстории, а не утверждённый канон. Пока есть один эпизод, один выбор с двумя исходами и дополнительный осмотр. Итог хранится в текущем прохождении; награды кампании не выдаются. Ограничение обрыва задано полигоном в данных эпизода, обход препятствий и визуальное рисование коллизий ещё не добавлены. Туман, боевые зоны и правила сетки из редактора не участвуют в сюжетном проигрывателе. При перемещении фонового слоя границу прохода надо согласовать в данных. Портреты статические; печать текста сопровождается включаемым синтезированным звуком, а не озвучкой.

UK: Це тестова чернетка передісторії, а не затверджений канон. Наразі є один епізод, один вибір із двома наслідками й додатковий огляд. Підсумок зберігається в поточному проходженні; нагороди кампанії не видаються. Межу урвища задано полігоном у даних епізоду, обхід перешкод і візуальне малювання колізій ще не додано. Туман, бойові зони й правила сітки з редактора не беруть участі в сюжетному програвачі. Після переміщення фонового шару межу проходу треба узгодити в даних. Портрети статичні; друк тексту супроводжується синтезованим звуком, який можна ввімкнути, а не озвученням.

## Asset generation (developer notes)

Generated with the built-in ImageGen tool. Final files: `images/story/vrotik-mountain-v1.png`, `images/story/vrotik-brother-v1.png`. Existing hero portrait: `images/heroart/Vrotik.png`.

Final map prompt:

> Create a STRICT ORTHOGRAPHIC TOP-DOWN 90 DEGREE OVERHEAD tabletop battle map of a mountain plateau cliff edge, 1536x1024 landscape. Camera looks vertically straight DOWN, like a satellite or flat architectural plan. ALL visible stone ground surfaces parallel to image plane. NO horizon, NO distant vertical peaks, NO perspective, NO isometric, NO oblique view. A large flat stony plateau in center and left 75%, winding traversable path along center from bottom edge to upper center overlook. Right quarter is sheer drop indicated by dark rock edge outline and pale clouds seen from above. Scattered boulders, sparse mountain shrubs around perimeter. Hand painted realistic dark fantasy terrain, muted slate grey, pale mist, small warm lichen details. Flat readable ground for virtual tabletop token movement. No people, no creatures, no tokens, no text, no UI, no grid. It must be an actual battlemap flat plan view, not landscape illustration.

Brother portrait initial prompt (reference: Vrotik.png):

> Use case: stylized-concept. Reference image is Vrotik, a raven-like kenku fantasy character; create a DISTINCT brother character of the same bird humanoid species, not a copy. Asset type: large dialogue portrait, vertical 2:3. Chest-up older raven kenku brother, black feathers with grey at temples, long dark beak, intelligent amber eyes, weathered charcoal travel cloak with subtle muted moss-green lining and simple leather strap. Head uncovered, no wings or weapons in frame. Facing slightly right toward dialogue text, calm protective expression. Painterly realistic dark fantasy RPG portrait, detailed feathers, soft warm rim light and cool shadows. Truly transparent background, isolated clean silhouette, no frame, no writing, no symbols. Character fills image.

Corrective portrait edit (the initial output had a baked-in checkerboard, no alpha):

> Edit this raven kenku portrait. Preserve exact character face, beak, feather details, cloak, framing and pose. Replace ALL checkerboard pattern background with perfectly uniform solid near-black #080a0b background. No checkerboard, no transparency, no patterns. Soft dark vignette around shoulders and bottom so the portrait blends seamlessly with dark dialogue UI. Do not change character identity. No text or border.
