'use strict';
// Generates a new, reviewable snapshot. Never touches editor/browser storage.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../story-content/evan');
const source=JSON.parse(fs.readFileSync(path.join(dir,'episode-1-courtyard-v15.json'),'utf8'));
const out=structuredClone(source),e=out.episode,changed=[];
const E=e.playerSpeakerId,T='evan-friend-tarin',L='evan-friend-lida',F='evan-port-feltser',P='evan-port-pen',M='evan-yard-milo',N='evan-courtyard-narrator',sceneId='scene-evan-green-courtyard';
const hero={speaking:'emotion-1789852989293',thinking:'emotion-1789852949259',smiling:'emotion-1789852957946',surprised:'emotion-1789853039972'};
function page(speaker,text,textUk,emotion='speaking',image='') {return {speaker,text,textUk,emotion:speaker===N?'':speaker===E?hero[emotion]:emotion,showPortrait:speaker!==N,portrait:'',image,imageFit:'contain'};}
let seq=0;
function link(to,label='Продолжить',labelUk='Продовжити',qty=0){return {id:`v16-${++seq}`,to,label,labelUk,...(qty?{requiresItemId:'evan-silver-coin',requiresItemQty:qty}:{})};}
function put(id,title,titleUk,pages,links=[],extra={}) {
 const old=e.nodes.find(n=>n.id===id)||{id,editorSceneId:sceneId,x:3200,y:1550};
 const node={...old,title,titleUk,...pages[0],firstShowPortrait:pages[0].showPortrait,slides:pages.slice(1),links,kind:links.length>1?'choice':'dialogue',...extra};
 if(e.nodes.includes(old))e.nodes[e.nodes.indexOf(old)]=node;else e.nodes.push(node);
 changed.push(id);return node;
}
put('evan-yard-greet','Свои во дворе','Свої у дворі',[
 page(T,'Еван! Мы уже начали. Бери плоский — круг сегодня мой.','Еване! Ми вже почали. Бери плаский — коло сьогодні моє.','smiling'),
 page(L,'Круг общий. Он просто первый успел похвастаться.','Коло спільне. Він просто перший устиг похвалитися.','smiling')
],[link('evan-green-rules','Сыграть в камешки','Зіграти в камінці'),link('evan-green-plans','Рассказать о поездке','Розповісти про поїздку')]);
const intro=put('evan-green-rules','Твой бросок','Твій кидок',[
 page(L,'Чей камень ближе к середине, тот выиграл. За линию не заступай.','Чий камінь ближче до середини, той виграв. За лінію не заступай.'),
 page(E,'Ладно. Этот плоский — мой.','Гаразд. Цей плаский — мій.','smiling')
],[link('evan-yard-game','Прицелиться','Прицілитися')]);
const arrivals=structuredClone(intro.beforeWorldActions);delete intro.beforeWorldActions;
put('evan-yard-game','Первый бросок','Перший кидок',[
 page(E,'Подкатить по земле или с отскоком? Между камнем Лиды и серединой как раз есть щель.','Підкотити по землі чи з відскоком? Між каменем Ліди й серединою якраз є щілина.','thinking')
],[link('evan-yard-safe','Подкатить осторожно','Підкотити обережно'),link('evan-yard-risk','Бросить с отскоком','Кинути з відскоком')]);
put('evan-yard-safe','Почти в центре','Майже в центрі',[
 page(N,'Камешек катится между двумя другими и замирает у середины круга.','Камінець котиться між двома іншими й завмирає біля середини кола.'),
 page(T,'Да ладно! У тебя что, прицел в пальце?','Та ну! У тебе що, приціл у пальці?','smiling')
],[link('evan-port-arrival')]);
put('evan-yard-risk','В траву','У траву',[
 page(N,'Камешек подпрыгивает, цепляет край круга и улетает в траву.','Камінець підстрибує, чіпляє край кола й відлітає в траву.'),
 page(L,'Красиво. Только круг здесь, а не у забора.','Гарно. Тільки коло тут, а не біля паркану.','smiling')
],[link('evan-port-arrival')]);
put('evan-port-arrival','С причала','З причалу',[
 page(F,'Вы серьёзно? Опять камушки? Чё за хернёй вы тут занимаетесь?','Ви серйозно? Знову камінці? Що за хернею ви тут займаєтеся?','pointing'),
 page(T,'А ты опять пришёл всем объяснять, как веселиться?','А ти знову прийшов усім пояснювати, як веселитися?'),
 page(P,'В кагты давайте. На что-нибудь. А то бросил, поднял — охуеть занятие.','У кагти давайте. На щось. А то кинув, підняв — охуїти заняття.'),
 page(N,'Пен плюхается на траву. Его горловое «р» царапает слова; Фельцер уже достаёт потрёпанную колоду.','Пен гепається на траву. Його горлове «р» дряпає слова; Фельцер уже дістає пошарпану колоду.'),
 page(F,'А тебя не знаю. Как звать?','А тебе не знаю. Як звати?'),
 page(E,'Еван. А ты всегда сначала орёшь, потом знакомишься?','Еван. А ти завжди спочатку горлаєш, потім знайомишся?','smiling'),
 page(F,'Фельцер. Это Пен. Ну что, Еван, покажешь, как надо?','Фельцер. Це Пен. Ну що, Еване, покажеш, як треба?','laughing')
],[link('evan-milo-arrives')],{beforeWorldActions:arrivals});
put('evan-milo-arrives','Ещё один игрок','Ще один гравець',[
 page(M,'Лида! Я камень принёс. Уже поздно?','Лідо! Я камінь приніс. Уже пізно?'),
 page(L,'Теперь карты. Садись рядом, покажу. Это Еван.','Тепер карти. Сідай поруч, покажу. Це Еван.'),
 page(E,'Привет. И мне заодно покажешь — я тоже не всё знаю.','Привіт. І мені заразом покажеш — я теж не все знаю.','smiling'),
 page(M,'Я Мило. Только не быстро, ладно?','Я Мило. Тільки не швидко, гаразд?','normal')
],[link('evan-port-stake')]);
put('evan-port-stake','На что играем?','На що граємо?',[
 page(F,'Мой счётчик и его магнитный камень — против двух серебряных. Выиграешь — оба твои.','Мій лічильник і його магнітний камінь — проти двох срібняків. Виграєш — обидва твої.'),
 page(T,'Два серебряных? Вы охренели?','Два срібняки? Ви охрінили?'),
 page(P,'У нас таких денег нет. Зато вещи есть. Не нравится — тоггуйся.','У нас таких грошей немає. Зате речі є. Не подобається — тоггуйся.')
],[link('evan-port-two','Два серебряных за оба предмета','Два срібняки за обидві речі',2),link('evan-port-bargain','Сбить ставку до одного','Збити ставку до одного',1),link('evan-port-free','Без денег — сначала пробная партия','Без грошей — спершу пробна партія'),link('evan-port-findings','Сначала покажите вещи','Спершу покажіть речі')]);
put('evan-port-findings','Их ставка','Їхня ставка',[
 page(F,'Счётчик с лебёдки. За работу всучили. Колёсико клинит — сразу говорю.','Лічильник із лебідки. За роботу всунули. Коліщатко заклинює — одразу кажу.','speaking','assets/stories/Evan/inspections/broken-counter-v2.png'),
 page(E,'Крошечный… Такой бы на ось моей тележки. Если разобраться, что заедает.','Крихітний… Такий би на вісь мого візочка. Якщо розібратися, що заїдає.','thinking','assets/stories/Evan/inspections/broken-counter-v2.png'),
 page(P,'А этот гвоздь держит. Смотри.','А цей цвях тримає. Дивись.','pointing','assets/stories/Evan/inspections/lodestone-fragment-v2.png'),
 page(E,'Магнитный. Ладно, интересно. Но два серебряных за это — много.','Магнітний. Гаразд, цікаво. Але два срібняки за це — багато.','thinking','assets/stories/Evan/inspections/lodestone-fragment-v2.png')
],[link('evan-port-two','Поставить два','Поставити два',2),link('evan-port-bargain','Предложить один','Запропонувати один',1),link('evan-port-free','Сыграть без ставки','Зіграти без ставки')]);
put('evan-port-bargain','Один за оба','Один за обидва',[
 page(E,'Один за оба. Счётчик сломан, камень — обломок. Монета хотя бы целая.','Один за обидва. Лічильник зламаний, камінь — уламок. Монета хоча б ціла.'),
 page(F,'Хитрожопый. Ладно, один. Только потом не ной.','Хитросракий. Гаразд, один. Тільки потім не ний.'),
 page(P,'Сегебгяный пополам разменяем. Давай уже.','Сгібняк навпіл розміняємо. Давай вже.')
],[link('evan-port-one','Договорились','Домовилися',1),link('evan-port-free','Лучше без ставки','Краще без ставки')]);
put('evan-port-one','Уговор','Угода',[page(E,'Один серебряный. И ты тоже без нытья.','Один срібняк. І ти теж без ниття.','smiling')],[link('evan-port-ready-paid')]);
put('evan-port-two','Две монеты','Дві монети',[
 page(E,'Два. Мама на сегодняшнюю поездку дала — обычно столько не даёт.','Два. Мама на сьогоднішню поїздку дала — зазвичай стільки не дає.'),
 page(F,'Нихуя себе у тебя поездки… Ладно. Уговор.','Ніхуя собі в тебе поїздки… Гаразд. Угода.','shocked')
],[link('evan-port-ready-paid')]);
put('evan-port-free','Пробная партия','Пробна партія',[
 page(E,'Сначала без денег. Я ещё ваши правила не видел.','Спершу без грошей. Я ще ваших правил не бачив.'),
 page(F,'Ладно. Только карты держи к себе, а не всему двору показывай.','Гаразд. Тільки карти тримай до себе, а не всьому двору показуй.')
],[link('evan-port-ready-free')]);
put('evan-port-ready-paid','Сначала пробуем','Спершу пробуємо',[page(L,'Уговор запомнили. Сначала одна пробная — никто ничего не отдаёт.','Угоду запам’ятали. Спершу одна пробна — ніхто нічого не віддає.')],[link('evan-port-at-circle')]);
put('evan-port-ready-free','Сдавай','Здавай',[page(P,'Иггаем уже. Фельцер, сдавай.','Ггаємо вже. Фельцере, здавай.')],[link('evan-port-at-circle')]);
put('evan-port-at-circle','За мешковиной','За мішковиною',[
 page(N,'На траве расстилают мешковину. Еван, Фельцер, Пен и Мило садятся вокруг. Лида помогает Мило; Тарин заглядывает через плечо.','На траві розстеляють мішковину. Еван, Фельцер, Пен і Мило сідають навколо. Ліда допомагає Мило; Тарін зазирає через плече.'),
 page(N,'Альфа-тест: сейчас играем на учебные фишки. Выбранная ставка отмечена, но серебро и вещи остаются у владельцев.','Альфа-тест: зараз граємо на навчальні фішки. Обрану ставку позначено, але срібло й речі залишаються у власників.')
],[link('evan-yard-finish','Начать карточную игру','Почати карткову гру')]);
put('evan-yard-finish','После пробной','Після пробної',[page(T,'Ну что, разобрались? Или ещё раз разложите?','Ну що, розібралися? Чи ще раз розкладете?','smiling')],[link('evan-port-at-circle','Ещё одна пробная','Ще одна пробна'),link('evan-yard-after','Вернуться во двор','Повернутися у двір')]);
put('evan-yard-after','Пора собираться','Час збиратися',[page(E,'Мне ещё бумаги проверить. Вы пока не разбегайтесь.','Мені ще папери перевірити. Ви поки не розбігайтеся.')]);
put('evan-yard-ready','Колода на месте','Колода на місці',[page(F,'Ну? Ещё раз или хватит на сегодня?','Ну? Ще раз чи досить на сьогодні?')],[link('evan-port-at-circle','Сыграть ещё раз','Зіграти ще раз'),link('evan-yard-lida','Поговорить с Лидой','Поговорити з Лідою')]);
put('evan-port-wait','Колода на мешковине','Колода на мішковині',[page(N,'Карты уже разложены. Можно сыграть пробную партию.','Карти вже розкладені. Можна зіграти пробну партію.')],[link('evan-port-at-circle','Сесть за карты','Сісти за карти')]);
e.minigames={...e.minigames,towerClaw:{enabled:true,afterNodeId:'evan-port-at-circle',opponents:[F,P,M],styles:['bold','balanced','cautious'],stack:20}};
e.interactions['evan-yard-stones'].entryId='evan-yard-greet';
const quest=e.quests.find(q=>q.id==='evan-yard-game-quest');
Object.assign(quest,{title:'Пробная партия',titleUk:'Пробна партія',objective:'Сыграть в карты с ребятами. Альфа: серебро и вещи не расходуются.',objectiveUk:'Зіграти в карти з хлопцями. Альфа: срібло й речі не витрачаються.'});
const patch={format:'zargota-guarded-content-patch',base:'episode-1-courtyard-v15.json',target:'episode-1-courtyard-v16.json',operations:[]};
for(const key of ['nodes','quests'])for(const after of e[key]){const before=source.episode[key].find(n=>n.id===after.id)||null;if(JSON.stringify(before)!==JSON.stringify(after))patch.operations.push({collection:key,id:after.id,before,after});}
for(const key of ['minigames','interactions'])patch.operations.push({property:key,before:source.episode[key]||null,after:e[key]});
fs.writeFileSync(path.join(dir,'episode-1-courtyard-v16.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(dir,'courtyard-v16-patch.json'),JSON.stringify(patch,null,2)+'\n');
let review='# Дворик v16 / Дворик v16\n\nRU: Отдельный экспорт на основе v15; живое сохранение не заменено. Импортируйте JSON как эпизод. Мини-игра включена после evan-port-at-circle. Камешки → вторжение → ставка → пробная партия. Монеты и предметы не передаются.\n\nUK: Окремий експорт на основі v15; живе збереження не замінено. Імпортуйте JSON як епізод. Мінігру ввімкнено після evan-port-at-circle. Камінці → вторгнення → ставка → пробна партія. Монети й речі не передаються.\n\nGuarded patch is for programmatic comparison, not the editor JSON-fragment importer.\n';
for(const id of changed){const n=e.nodes.find(n=>n.id===id);review+=`\n## ${n.title} / ${n.titleUk}\n`;for(const p of [n,...n.slides])review+=`\n**${e.speakers[p.speaker].name} · ${p.emotion}**\n\nRU: ${p.text}\n\nUK: ${p.textUk}\n`;for(const l of n.links)review+=`\n- ${l.label} / ${l.labelUk} → ${l.to}\n`;}
fs.writeFileSync(path.join(dir,'COURTYARD-V16.md'),review);
console.log(`v16: ${changed.length} dialogue nodes; card launch enabled; no saved editor data changed.`);
