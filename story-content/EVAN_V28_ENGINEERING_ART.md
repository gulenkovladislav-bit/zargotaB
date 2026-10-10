# Engineering table v28 / Инженерный стол / Інженерний стіл

RU: Импортируйте v28 отдельной копией из Загрузок. Четыре новых портрета назначены рисовальщику и трём игрокам как в локации, так и за столом. Инженерный стол использует отдельный верстак с серо-синей тканью. Нажатие на шестерню слева внизу вращает её и запускает серию щелчков. Повторное нажатие во время вращения не создаёт наложения. Звук подчиняется выключателю мини-игры, при выходе останавливается. Настройки: «Мини-игры → Башня и коготь → Инженерный двор → Оформление стола и интерактив». Старый стол с котом не изменён. Полное прохождение после импорта не проверено; автоматические тесты и изолированный браузерный просмотр отмечаются отдельно.

UK: Імпортуйте v28 окремою копією із Завантажень. Чотири нові портрети призначено малювальнику й трьом гравцям як у локації, так і за столом. Інженерний стіл використовує окремий верстат із сіро-синьою тканиною. Натискання на шестерню ліворуч унизу обертає її та запускає серію клацань. Повторне натискання під час обертання не створює накладання. Звук підкоряється вимикачу мінігри, після виходу зупиняється. Налаштування: «Мініігри → Вежа та кіготь → Інженерне подвір’я → Оформлення столу й інтерактив». Старий стіл із котом не змінено. Повне проходження після імпорту не перевірено; автоматичні тести й ізольований браузерний перегляд відзначаються окремо.

## Asset manifest

Built-in imagegen, six separate original images, no reused NPC portraits. Saved under `assets/stories/Evan/university/cards/`:

- `artist-v1.png` — 1254×1254
- `expert-v1.png` — 1254×1254
- `student-a-v1.png` — 1254×1254
- `student-b-v1.png` — 1254×1254
- `workbench-v1.png` — 1672×941 (native generated resolution, not an upscaled 4K claim)
- `cog-v1.png` — 1254×1254, alpha transparency

Audio reuses `assets/stories/cards/tower-claw/audio/candidates/interface/click_001.mp3`; no new audio provenance claim. The module plays spaced clicks only on user activation, not on table rerender.

## Final generation prompts

### artist

A single square head-and-shoulders portrait for a medieval fantasy RPG dialogue token. NEW ORIGINAL CHARACTER, a young adult male student illustrator, human age 20, slim angular face, olive complexion, short untidy black curls, dark alert eyes, paint smudge on one cheek, sly friendly half smile. Worn moss-green linen shirt under brown leather artist apron, pencil tucked behind ear. No hat, no jewelry, no modern objects. Both shoulders visible, face centered with generous margin for circular crop. Background plain muted warm umber, softly brushed. Hand-painted dark-fantasy oil illustration, broad visible brushstrokes, matte surfaces, detailed expressive face, restrained warm light, same polished visual language as an antique fantasy portrait, not photo, not cartoon. No text, no frame, no collage. 1024x1024.

### expert

A single square head-and-shoulders portrait for a medieval fantasy RPG dialogue token. NEW ORIGINAL CHARACTER, experienced card-playing engineering student, human male age 25, auburn brown hair tied short behind neck, clean shaven, straight nose, calm calculating grey eyes, small old scar at eyebrow, self-assured restrained expression. Weathered navy wool vest over off-white linen shirt, rolled collar, no modern clothes, no glasses, no crown. Both shoulders visible, face centered with generous margin for circular crop. Background plain muted warm umber. Hand-painted dark-fantasy oil illustration, broad brushstrokes, matte surfaces, expressive face, restrained warm side light, not photo, not cartoon. New distinctive face, no famous character. No text, no frame, no collage. 1024x1024.

### student-a

Single square head-and-shoulders portrait, original medieval fantasy engineering student for dialogue token. Human young adult man age 19, round freckled face, sandy blond tousled hair, large brown eyes, tentative almost worried smile, broad shoulders in rust-red coarse wool waistcoat over cream linen shirt, small dark grease mark on collar. Distinct from handsome heroic protagonists: ordinary approachable young craft student. Centered face, both shoulders, ample margin for circular crop. Plain softly brushed muted umber background. Traditional hand-painted dark-fantasy oil illustration with broad brush strokes, matte surfaces and expressive face, restrained warm side light. No photo, no cartoon, no text, no frame, no collage. Square high resolution.

### student-b

Single square head-and-shoulders portrait, NEW original medieval fantasy engineering student for dialogue token. Human young adult man age 22, dark chestnut straight hair swept sideways, long narrow face, olive skin, hooked nose, wiry build, expressive dark eyes, crooked confident smirk, dark forest-green work tunic and ochre neck cloth, medieval linen and wool. No modern clothing or accessories. Centered face, both shoulders visible, generous margin for circular token crop. Plain softly brushed warm muted umber background. Hand-painted dark-fantasy oil portrait, broad visible brushwork, matte texture, expressive facial detail, restrained warm side light. No photorealism, no cartoon, no text, no frame, no collage. Square high resolution.

### workbench

Stylized-concept illustration, a production background for a full-screen medieval fantasy card game. Landscape 16:9, highest detail, 2560x1440 if possible. Camera directly overhead, flat tabletop, NOT perspective room. An old heavy dark oak engineering workbench fills the entire image edge to edge. A large worn dusty blue-grey linen cloth covers the central 80 percent, gently wrinkled with subtle seams and a few faint charcoal drafting lines, NOT busy drawings: center clear and low contrast for cards and character portraits to overlay. Bare wooden margin around cloth. Only at outer corners: folded parchment mechanical sketches (no readable text), brass dividers, wooden ruler, iron caliper, small hammer, spare screws and curled shavings. Lower left keep a clear small patch of bare wood for a separate clickable cog to be placed by game. Neutral muted workshop daylight, weathered practical materials, painterly medieval fantasy look, less sunny and less saturated, no grass, no flowers, NO cat, no people, no hands, no playing cards, no coins, no UI, no lettering, no border. Keep tools small near edges, center 80% EMPTY usable cloth.

### cog

Single isolated game prop sprite on a genuinely transparent background. Strict overhead orthographic view of a flat antique brass cogwheel with 12 evenly spaced thick teeth, worn dark brass surface, concentric incised circles, four curved cutout spokes around central iron axle bolt. A small wooden crank grip mounted near the rim. Entire object visible with generous transparent margin, circular main silhouette centered precisely for CSS rotation. Hand-painted realistic fantasy oil illustration, restrained top-left light, no floor, no support stand, no other props, no text, no frame. This is a clickable medieval engineering bench mechanism; render detailed metal and wood, clear silhouette, transparent outside AND through spoke holes, no cast shadow background.
