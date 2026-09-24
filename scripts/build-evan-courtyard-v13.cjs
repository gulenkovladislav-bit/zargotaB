// Builds a new review export; never edits the browser or the v12 source.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'story-content/evan');
const source=JSON.parse(fs.readFileSync(path.join(dir,'episode-1-courtyard-v12.json'),'utf8'));
const out=structuredClone(source),e=out.episode,sceneId='scene-evan-green-courtyard';
const E='speaker-1789852672609',T='evan-friend-tarin',L='evan-friend-lida',S='evan-port-feltser',Y='evan-port-pen',M='evan-yard-milo',N='evan-courtyard-narrator';
const emotions={laughing:['Смеётся','Сміється'],speaking:['Говорит','Говорить'],surprised:['Удивлён','Здивований'],shocked:['Потрясён','Приголомшений'],angry:['Злится','Злиться'],pointing:['Указывает пальцем','Показує пальцем']};
for(const [id,slug,ru,uk] of [[S,'feltser','Фельцер','Фельцер'],[Y,'pen','Пен','Пен']]){
 const portrait=`assets/stories/Evan/portraits/${slug}-neutral-v1.png`;
 e.speakers[id]={name:ru,nameUk:uk,portrait,position:'50% 50%',zoom:1,emotions:{normal:{name:'Спокойно',nameUk:'Спокійно',portrait,position:'50% 50%',zoom:1}}};
 for(const [key,[name,nameUk]] of Object.entries(emotions))e.speakers[id].emotions[key]={name,nameUk,portrait:`assets/stories/Evan/portraits/${slug}-${key}-v1.png`,position:'50% 50%',zoom:1};
}
e.speakers[M]={name:'Мило',nameUk:'Мило',portrait:'',emotions:{}};
e.speakers[N]={name:'Рассказчик',nameUk:'Оповідач',portrait:'',emotions:{}};
const page=(speaker,text,textUk,emotion)=>({speaker,text,textUk,emotion:emotion||(speaker===E?'emotion-1789852989293':[T,L].includes(speaker)?'speaking':[S,Y].includes(speaker)?'speaking':''),showPortrait:![M,N].includes(speaker),portrait:''});
let linkSequence=0;
const link=(to,label='Продолжить',labelUk='Продовжити',extra={})=>({id:`v13-${++linkSequence}-${to}`,to,label,labelUk,...extra});
const money=(qty)=>({requiresItemId:'evan-silver-coin',requiresItemQty:qty});
const changed=[];
function put(id,title,titleUk,pages,links=[],extra={}){
 const previous=e.nodes.find(n=>n.id===id),n={id,kind:links.length>1?'choice':'dialogue',title,titleUk,editorSceneId:sceneId,x:3200+(changed.length%4)*360,y:200+Math.floor(changed.length/4)*340,portraitOverride:false,firstShowPortrait:pages[0].showPortrait,...pages[0],slides:pages.slice(1),links,...extra};
 if(previous){n.x=previous.x;n.y=previous.y;e.nodes[e.nodes.indexOf(previous)]=n;}else e.nodes.push(n);
 changed.push(id);return n;
}
const move=(id,x,y)=>({type:'move',sceneId,kind:'tokens',id,points:[[47,76],[48,62],[x,y]],durationMs:1500});
put('evan-green-rules','Ещё двое','Ще двоє',[
 page(E,'Давайте одну партию. Только без вчерашнего спора до самого вечера.','Давайте одну партію. Тільки без учорашньої суперечки до самого вечора.'),
 page(T,'Так я вчера был прав.','Та я вчора мав рацію.','smiling'),
 page(S,'А сегодня опять будешь? Подвинься, мы тоже пришли.','А сьогодні знову матимеш? Посунься, ми теж прийшли.'),
 page(T,'Это Фельцер. А длинный — Пен. Иногда таскают у причала, иногда мешают мне выигрывать.','Це Фельцер. А довгий — Пен. Іноді тягають біля причалу, іноді заважають мені вигравати.'),
 page(E,'Эван. Я тут живу, у хлебной лавки.','Еван. Я тут живу, біля хлібної крамниці.','emotion-1789852957946'),
 page(N,'Пен выше остальных на полголовы. Он отвечает с раскатистым горловым «р», сперва оглядев лавку за оградой.','Пен вищий за решту на пів голови. Він відповідає з розкотистим горловим «р», спершу оглянувши крамницю за огорожею.'),
 page(Y,'А. Где пахнет, когда жрать хочется. Знаю.','А. Де пахне, коли жерти хочеться. Знаю.'),
 page(S,'Он все лавки так запоминает.','Він усі крамниці так запам’ятовує.','laughing')
],[link('evan-port-findings')],{beforeWorldActions:[move('evan-port-feltser-token',36,54),move('evan-port-pen-token',57,57)],repeatWhen:'evan-green-game-agreed',repeatId:'evan-yard-ready'});
put('evan-port-findings','Находки с причала','Знахідки з причалу',[
 page(E,'Что у тебя щёлкает в кармане?','Що в тебе клацає в кишені?','emotion-1789852949259'),
 page(S,'Счётчик. Был на ручной лебёдке. За уборку хлама отдали — вместо нормальной платы, суки.','Лічильник. Стояв на ручній лебідці. За прибирання мотлоху віддали — замість нормальної плати, суки.'),
 page(E,'Он обороты считает? Дай повернуть.','Він оберти рахує? Дай повернути.','emotion-1789853039972'),
 page(S,'Один считает. Потом клинит. Не говори только, что починишь за минуту.','Один рахує. Потім клинить. Тільки не кажи, що полагодиш за хвилину.'),
 page(E,'Не починю. Пока даже не понимаю, где заедает. Но для моей тележки такая штука…','Не полагоджу. Поки навіть не розумію, де заїдає. Але для мого візочка така штука…','emotion-1789852949259'),
 page(Y,'А у меня камень. Смотри на гвоздь.','А в мене камінь. Дивись на цвях.','pointing'),
 page(N,'Гвоздь прилипает к тёмному обломку. Пен переворачивает его, придерживая ладонью снизу.','Цвях прилипає до темного уламка. Пен перевертає його, притримуючи долонею знизу.'),
 page(E,'Магнитный? А через дощечку держит?','Магнітний? А крізь дощечку тримає?','emotion-1789853039972'),
 page(Y,'Не пробовал. Дощечки нет.','Не пробував. Дощечки немає.'),
 page(L,'Скамья есть. Только не разбирайте её.','Лава є. Тільки не розбирайте її.','smiling')
],[link('evan-milo-arrives')]);
put('evan-milo-arrives','Можно с вами?','Можна з вами?',[
 page(M,'Лида! Я тоже хочу. Можно с вами?','Лідо! Я теж хочу. Можна з вами?'),
 page(L,'Привет, Мило. Можно. Мы ещё не начали.','Привіт, Мило. Можна. Ми ще не почали.','smiling'),
 page(M,'Я принёс плоский. Вот.','Я приніс плаский. Ось.'),
 page(N,'Мило раскрывает ладонь: маленький гладкий камень, тщательно завёрнутый в тряпицу.','Мило розкриває долоню: маленький гладенький камінець, старанно загорнутий у ганчірку.'),
 page(S,'Мы тут уже собрались, а правил всё нет. Совет капитанов, блядь.','Ми тут уже зібралися, а правил досі немає. Рада капітанів, бля.'),
 page(E,'Тогда сначала решим: просто играем или на что-нибудь?','Тоді спершу вирішимо: просто граємо чи на щось?')
],[link('evan-port-stake','Предложить серебро против обеих находок','Запропонувати срібло проти обох знахідок',money(1)),link('evan-port-free','Играть без ставки','Грати без ставки')],{beforeWorldActions:[move('evan-milo-token',64,37)]});
put('evan-port-stake','Цена интереса','Ціна інтересу',[
 page(E,'Могу поставить серебро. Вы — счётчик и камень.','Можу поставити срібло. Ви — лічильник і камінь.'),
 page(S,'Серебро? Настоящий серебряк? Тебе его просто дали?','Срібло? Справжній срібняк? Тобі його просто дали?','shocked'),
 page(E,'На сегодня. Мы едем смотреть факультеты. Обычно мне столько не дают.','На сьогодні. Ми їдемо дивитися факультети. Зазвичай мені стільки не дають.','emotion-1789853064627'),
 page(S,'Нихуя себе поездочка. Нам вообще не дают. Что натаскал — то твоё.','Ніхуя собі поїздочка. Нам узагалі не дають. Що натягав — те твоє.','surprised'),
 page(Y,'За оба — два серебряных. Нас двое.','За обидва — два срібняки. Нас двоє.'),
 page(E,'Я не покупаю. Выиграете — деньги ваши. Выиграю я — обе вещи мои.','Я не купую. Виграєте — гроші ваші. Виграю я — обидві речі мої.'),
 page(S,'Вот и договорились. Только сначала правила. Чтоб потом никто не крутил.','От і домовилися. Тільки спочатку правила. Щоб потім ніхто не крутив.','pointing')
],[link('evan-port-two','Два серебряных против обоих предметов','Два срібняки проти обох предметів',money(2)),link('evan-port-bargain','Попробовать сбить ставку до одного','Спробувати збити ставку до одного',money(1)),link('evan-port-free','Нет, лучше без денег','Ні, краще без грошей')]);
put('evan-port-bargain','Один за риск','Один за ризик',[
 page(E,'Счётчик сломан. Камень — обломок. Серебряный зато целый. Один против обоих.','Лічильник зламаний. Камінь — уламок. Срібняк зате цілий. Один проти обох.'),
 page(S,'Когда гвоздь прилип, ты на него совсем не как на обломок смотрел.','Коли цвях прилип, ти на нього зовсім не як на уламок дивився.'),
 page(E,'Мне интересно. Но два я не поставлю. Один — и решим правила до игры.','Мені цікаво. Але два я не поставлю. Один — і визначимо правила до гри.'),
 page(Y,'Один на двоих?..','Один на двох?..','surprised'),
 page(S,'Поделим, если выиграем. Ладно, Эван. Один. Но забрать только камень, если передумаешь, не выйдет.','Поділимо, якщо виграємо. Гаразд, Еване. Один. Але забрати лише камінь, якщо передумаєш, не вийде.'),
 page(E,'Оба предмета. Я помню.','Обидва предмети. Я пам’ятаю.','emotion-1789852957946')
],[link('evan-port-one','Договориться на один серебряный','Домовитися на один срібняк',money(1)),link('evan-port-free','Всё-таки играть без ставки','Усе-таки грати без ставки')]);
for(const [id,ru,uk,flag] of [['evan-port-one','Один серебряный против счётчика и камня.','Один срібняк проти лічильника й каменя.','evan-stake-one'],['evan-port-two','Два серебряных против счётчика и камня.','Два срібняки проти лічильника й каменя.','evan-stake-two']]){
 put(id,'Уговор','Угода',[page(E,ru,uk),page(L,'Мило и я ничего не ставим. И Тарин за вами в долги не записывается.','Мило і я нічого не ставимо. І Тарін за вами в борги не записується.'),page(S,'Да никто вас не записывает. Ставка наша с Эваном.','Та ніхто вас не записує. Ставка наша з Еваном.'),page(M,'А я всё равно играю?','А я все одно граю?'),page(E,'Конечно. Мы все играем.','Звісно. Ми всі граємо.','emotion-1789852957946')],[link('evan-port-ready-paid')],{afterEffect:flag});
}
put('evan-port-free','Без денег','Без грошей',[
 page(E,'Давайте без ставки. Мне ещё ехать сегодня, не хочу потом объясняться.','Давайте без ставки. Мені ще їхати сьогодні, не хочу потім пояснювати.'),
 page(S,'Да играй. Я сюда не долги собирать пришёл.','Та грай. Я сюди не борги збирати прийшов.'),
 page(Y,'Тогда камень мой.','Тоді камінь мій.','pointing'),
 page(L,'Он и сейчас твой, Пен.','Він і зараз твій, Пене.','smiling'),
 page(M,'Я рядом с Лидой буду.','Я поруч із Лідою буду.'),
 page(E,'Хорошо. Играем все, никто ничего не должен.','Добре. Граємо всі, ніхто нічого не винен.')
],[link('evan-port-ready-free')],{afterEffect:'evan-stake-none'});
put('evan-port-ready-paid','До первого броска','До першого кидка',[
 page(L,'А если выиграет кто-то из нас? Или будет ничья?','А якщо виграє хтось із нас? Або буде нічия?'),
 page(E,'Тогда ничего не отдаём. Но это ещё до бросков нормально обсудим.','Тоді нічого не віддаємо. Але це ще до кидків нормально обговоримо.'),
 page(S,'Вот теперь дело. Пока каждый своё держит.','От тепер діло. Поки кожен своє тримає.')
],[link('evan-port-at-circle')]);
put('evan-port-ready-free','Собраться у круга','Зібратися біля кола',[
 page(T,'Ну наконец-то. Я успел бы проиграть и отыграться.','Ну нарешті. Я встиг би програти й відігратися.','smiling'),
 page(S,'Ты пока только языком выиграл.','Ти поки тільки язиком виграв.','laughing'),
 page(E,'Пошли к кругу. Сначала договоримся, во что именно играем.','Ходімо до кола. Спершу домовимося, у що саме граємо.')
],[link('evan-port-at-circle')]);
put('evan-port-at-circle','Все в сборе','Усі зібралися',[
 page(M,'Отсюда бросать? Покажи, где встать.','Звідси кидати? Покажи, де стати.'),
 page(E,'Сейчас разберёмся вместе. Камень пока придержи.','Зараз розберемося разом. Камінець поки притримай.'),
 page(N,'Ребята собираются у мелового круга. Первый камень ещё ни у кого не покинул ладонь.','Хлопці й дівчина збираються біля крейдяного кола. Перший камінець ще ні в кого не залишив долоні.')
],[],{afterEffect:'evan-green-game-agreed'});
put('evan-yard-ready','Перед игрой','Перед грою',[page(E,'Все собрались. Осталось выбрать правила — и можно начинать.','Усі зібралися. Залишилося обрати правила — і можна починати.')],[link('evan-yard-lida','Поговорить с Лидой о поездке','Поговорити з Лідою про поїздку')]);
put('evan-port-wait','Камешки приготовлены','Камінці підготовлені',[page(N,'Продолжение игры будет в следующей версии эпизода. Уговор сохранён; деньги и находки остаются у владельцев.','Продовження гри буде в наступній версії епізоду. Домовленість збережена; гроші й знахідки залишаються у власників.')]);
const green=e.scenes.find(s=>s.id===sceneId).scene;
for(const [id,speaker,name,nameUk,image] of [['evan-port-feltser-token',S,'Фельцер','Фельцер',e.speakers[S].portrait],['evan-port-pen-token',Y,'Пен','Пен',e.speakers[Y].portrait],['evan-milo-token',M,'Мило · портрет позже','Мило · портрет згодом','']]){
 green.tokens.push({id,speaker,name,nameUk,image,x:47,y:82,size:image?128:48,visible:false,...(!image?{type:'note'}:{})});
 e.interactions[id]={marker:'?',entryId:'evan-yard-greet'};
}
e.interactions['evan-yard-stones'].entryId='evan-port-wait';
const meet=e.quests.find(q=>q.id==='evan-yard-meet-quest');meet.dialogueId='evan-port-at-circle';meet.objective='Познакомиться с ребятами и договориться: со ставкой или без.';meet.objectiveUk='Познайомитися з хлопцями й домовитися: зі ставкою чи без.';
const game=e.quests.find(q=>q.id==='evan-yard-game-quest');game.title='Перед первой партией';game.titleUk='Перед першою партією';game.objective='Ребята готовы. Продолжение игры — в следующей версии.';game.objectiveUk='Компанія готова. Продовження гри — у наступній версії.';
// The older game/result nodes remain editable drafts, but are not reachable from this scene.
if(green.tokens.some(t=>t.id==='evan-yard-stones'&&t.entryId))green.tokens.find(t=>t.id==='evan-yard-stones').entryId='evan-port-wait';
const file=path.join(dir,'episode-1-courtyard-v13.json');fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
const patch={format:'zargota-guarded-content-patch',base:'episode-1-courtyard-v12.json',target:'episode-1-courtyard-v13.json',operations:[]};
for(const key of ['nodes','quests','scenes'])for(const after of e[key]){const before=source.episode[key].find(x=>x.id===after.id)||null;if(JSON.stringify(before)!==JSON.stringify(after))patch.operations.push({collection:key,id:after.id,before,after});}
for(const key of ['speakers','interactions'])for(const [id,after] of Object.entries(e[key])){const before=source.episode[key][id]||null;if(JSON.stringify(before)!==JSON.stringify(after))patch.operations.push({collection:key,id,before,after});}
fs.writeFileSync(path.join(dir,'courtyard-v13-patch.json'),JSON.stringify(patch,null,2)+'\n');
let review='# Дворик v13 / Дворик v13\n\nRU: Черновик до начала игры. Фельцер и Пен — имена автора; Мило — рабочее имя. Портрет Мило отложен по просьбе автора. Игра, списание монет и выдача находок не реализованы.\n\nUK: Чернетка до початку гри. Фельцер і Пен — імена автора; Мило — робоче ім’я. Портрет Мило відкладений на прохання автора. Гру, списання монет і видачу знахідок не реалізовано.\n';
for(const id of changed){const n=e.nodes.find(n=>n.id===id);review+=`\n## ${n.title} / ${n.titleUk} (${id})\n\n`;for(const p of [n,...n.slides])review+=`**${e.speakers[p.speaker].name}**\n\nRU: ${p.text}\n\nUK: ${p.textUk}\n\n`;for(const l of n.links)review+=`- ${l.label} / ${l.labelUk} → ${l.to}${l.requiresItemId?` (≥ ${l.requiresItemQty} ${l.requiresItemId})`:''}\n`;}
fs.writeFileSync(path.join(dir,'COURTYARD-V13.md'),review);console.log(file);
