'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../story-content/evan'),out=JSON.parse(fs.readFileSync(path.join(dir,'episode-1-courtyard-v19.json'))),e=out.episode;
for(const op of JSON.parse(fs.readFileSync(path.join(dir,'courtyard-v20-patch.json'))).operations){if(op.collection){const i=e[op.collection].findIndex(n=>n.id===op.id);assert.deepEqual(e[op.collection][i],op.before);e[op.collection][i]=op.after;}else{assert.deepEqual(e[op.property],op.before);e[op.property]=op.after;}}
const base=structuredClone(e),E=e.playerSpeakerId,F='evan-port-feltser',P='evan-port-pen',T='evan-friend-tarin',L='evan-friend-lida',M='evan-yard-milo',N='evan-courtyard-narrator',C='evan-copper-coin',S='evan-silver-coin';let serial=0;
function page(speaker,text,textUk,emotion='speaking'){if(speaker===E)emotion='emotion-1789852989293';if(speaker===N)emotion='';return {speaker,text,textUk,emotion,showPortrait:speaker!==N};}
function link(to,label='Далее',labelUk='Далі',extra={}){return {id:'v21-'+(++serial),to,label,labelUk,...extra};}
function put(id,title,titleUk,pages,links=[],extra={}){let n=e.nodes.find(n=>n.id===id);if(!n){n={id,editorSceneId:'scene-evan-green-courtyard',x:6200,y:1000+serial*100};e.nodes.push(n);}Object.assign(n,{title,titleUk,...pages[0],firstShowPortrait:pages[0].showPortrait,slides:pages.slice(1),links,kind:links.length>1?'choice':'dialogue'},extra);return n;}
const copperLink=(to,label='У меня есть медь. Играю',uk='У мене є мідь. Граю')=>link(to,label,uk,{requiresItemId:C,requiresItemQty:1});
put('evan-port-arrival','Колода вместо камешков','Колода замість камінців',[
 page(F,'Опять камушки? Вы ещё канаву палкой помешайте.','Знову камінці? Ви ще канаву палицею помішайте.','pointing'),
 page(T,'А ты нам занятие принёс или опять только рот?','А ти нам заняття приніс чи знову лише рота?'),
 page(N,'Фельцер вытаскивает потрёпанную колоду. На рубашке — башня, стиснутая когтями.','Фельцер витягає пошарпану колоду. На сорочці — вежа, стиснута пазурами.'),
 page(F,'Вот. «Башня и коготь». Смотри, только не замасли.','Ось. «Вежа та кіготь». Дивись, тільки не замасти.'),
 page(F,'А ты чей будешь? Раньше тебя тут не видел.','А ти чий будеш? Раніше тебе тут не бачив.'),page(E,'Еван. А ты всегда так знакомишься?','Еван. А ти завжди так знайомишся?'),
 page(F,'Фельцер. Это Пен. Ладно, садись ближе.','Фельцер. Це Пен. Гаразд, сідай ближче.','laughing')
],[link('evan-port-stake')]);
put('evan-port-stake','Теперь о ставке','Тепер про ставку',[
 page(F,'Только играем на деньги. А то опять полдня шуметь за просто так.','Тільки граємо на гроші. Бо знову пів дня галасувати за просто так.'),
 page(L,'Тарин, не надо. Ты потом весь день злиться будешь.','Таріне, не треба. Ти потім увесь день злитимешся.'),
 page(T,'У меня четыре медных. Свои. Я сам решу.','У мене чотири мідні. Свої. Я сам вирішу.'),
 page(P,'У меня шесть. У Фельцега семь. Ты что поставишь, Еван?','У мене шість. У Фельцега сім. Ти що поставиш, Еване?'),
 page(E,'Я ещё правил не знаю.','Я ще правил не знаю.'),page(F,'Объясню до первой ставки. Не понравится — встанешь. Ну, играем?','Поясню до першої ставки. Не сподобається — встанеш. Ну, граємо?')
],[link('evan-v21-silver','У меня серебро','У мене срібло',{requiresItemId:S,requiresItemQty:1}),copperLink('evan-v21-lida'),link('evan-v21-decline','Не хочу играть на деньги','Не хочу грати на гроші')]);
put('evan-v21-silver','Серебро в кошельке','Срібло в гаманці',[
 page(E,'Серебряных у меня — {{silver}}. Мама на поездку дала.','Срібних у мене — {{silver}}. Мама на поїздку дала.'),
 page(F,'Ого. Нихуя себе у тебя поездка. Только сдачи у нас нет.','Ого. Ніхуя собі в тебе поїздка. Тільки решти в нас немає.','surprised'),
 page(P,'Сегебго сначала газменяй. Мы тут лавку не откгываем.','Срібло спегшу гозміняй. Ми тут кгамницю не відкгиваємо.'),
 page(E,'Ладно. Спрошу на улице. Всё на стол сразу выкладывать я не обещал.','Гаразд. Спитаю на вулиці. Усе на стіл одразу викладати я не обіцяв.')
],[link('evan-exchange-leave','Пойду разменяю','Піду розміняю'),copperLink('evan-v21-lida','Медь тоже есть. Серебро оставлю','Мідь теж є. Срібло залишу'),link('evan-v21-decline','Передумал','Передумав')]);
put('evan-exchange-leave','За мелочью','По дрібні гроші',[page(F,'У прохожих спроси. Мы здесь, никуда твой будущий проигрыш не денется.','У перехожих спитай. Ми тут, нікуди твій майбутній програш не дінеться.','laughing')],[link('evan-exchange-street','Выйти на улицу','Вийти на вулицю',{sceneId:'scene-mu7f8tk1-6m4a',effect:'evan-exchange-errand'}),link('evan-v21-decline','Пока не буду','Поки не буду')]);
put('evan-exchange-back','Вернулся к колоде','Повернувся до колоди',[page(F,'Ну что, мелочь нашлась?','Ну що, дрібні гроші знайшлися?')],[copperLink('evan-v21-lida'),link('evan-exchange-leave','Ещё поищу размен','Ще пошукаю розмін',{requiresItemId:S,requiresItemQty:1}),link('evan-v21-decline','Сегодня без меня','Сьогодні без мене')]);
put('evan-v21-decline','Не садиться за карты','Не сідати за карти',[page(E,'Нет, пока без меня.','Ні, поки без мене.'),page(F,'Как знаешь. Мы не уходим.','Як знаєш. Ми не йдемо.')],[],{afterEffect:'evan-exchange-errand'});
put('evan-v21-lida','Лида меняет решение','Ліда змінює рішення',[
 page(L,'Тарин, подожди. Ты ведь всё равно сядешь?','Таріне, зачекай. Ти ж однаково сядеш?'),page(T,'Сяду. Но в долг не полезу. Четыре — и всё.','Сяду. Але в борг не полізу. Чотири — і все.'),
 page(L,'Давай добавлю {{lidaContribution}} своих. Если выиграешь — поделимся. Только не швыряй всё сразу.','Давай додам {{lidaContribution}} своїх. Якщо виграєш — поділимося. Тільки не кидай усе одразу.'),
 page(T,'Ты же только что меня отговаривала.','Ти ж щойно мене відмовляла.','smiling'),page(L,'И всё ещё считаю, что ты дурак. Поэтому сяду рядом.','І досі вважаю, що ти дурень. Тому сяду поруч.'),page(T,'Ладно. Договорились.','Гаразд. Домовилися.')
],[copperLink('evan-port-at-circle','Сесть и послушать правила','Сісти й послухати правила')],{repeatWhen:'evan-lida-agreed',repeatId:'evan-port-at-circle',afterEffect:'evan-lida-agreed'});
put('evan-port-at-circle','Вокруг мешковины','Навколо мішковини',[page(N,'Фельцер разглаживает мешковину и кладёт колоду у края. Тарин садится рядом с Лидой. Еван выкладывает медь перед собой.','Фельцер розгладжує мішковину й кладе колоду біля краю. Тарін сідає поруч із Лідою. Еван викладає мідь перед собою.')],[link('evan-yard-finish','Продолжить','Продовжити')],{afterEffect:'evan-green-game-agreed'});
put('evan-port-wait','Колода на месте','Колода на місці',[page(F,'Садишься? Только с медью.','Сідаєш? Тільки з міддю.')],[copperLink('evan-v21-lida'),link('evan-v21-silver','У меня серебро','У мене срібло',{requiresItemId:S,requiresItemQty:1}),link('evan-v21-decline','Позже','Пізніше')]);
put('evan-yard-finish','Отойти от игры','Відійти від гри',[page(E,'Пока хватит. Пересчитаю, что осталось.','Поки досить. Перелічу, що лишилося.')],[copperLink('evan-port-at-circle','Вернуться к картам','Повернутися до карт'),link('evan-yard-after','Вернуться во двор','Повернутися у двір'),link('evan-exchange-leave','Разменять ещё серебра','Розміняти ще срібла',{requiresItemId:S,requiresItemQty:1})]);
// Keep old IDs reachable by imported links, but remove the obsolete free-game route.
for(const id of ['evan-port-free','evan-port-ready-free','evan-port-ready-paid','evan-port-one','evan-port-two','evan-port-bargain','evan-port-findings']){put(id,'Перед картами','Перед картами',[page(F,'Сначала реши, играешь или нет. Вещи обсудим, если мелочь кончится.','Спершу виріши, граєш чи ні. Речі обговоримо, якщо дрібні гроші скінчаться.')],[link('evan-port-stake')]);delete e.nodes.find(n=>n.id===id).afterEffect;}
put('card-story-intro','Фельцер объясняет карты','Фельцер пояснює карти',[
 page(F,'Так, деньги пока не двигай. Вот две карты. Видишь цифры?','Так, гроші поки не рухай. Ось дві карти. Бачиш цифри?','pointing'),page(T,'Одинаковые. Хотя рисунки разные.','Однакові. Хоча малюнки різні.'),
 page(F,'Это дуэт. Считаешь ранг, не морду на картинке. Красная и чёрная вместе тоже годятся.','Це дует. Рахуєш ранг, а не пику на малюнку. Червона й чорна разом теж годяться.'),
 page(E,'А мои карты вы не видите?','А мої карти ви не бачите?'),page(F,'Если сам не покажешь. Две твои — держишь к себе. Ещё шесть лягут сюда, общие.','Якщо сам не покажеш. Дві твої — тримаєш до себе. Ще шість ляжуть сюди, спільні.'),
 page(L,'То есть одну и ту же карту со стола могут взять все?','Тобто одну й ту саму карту зі столу можуть узяти всі?'),page(F,'Для счёта — да. Руками не хватать. Из своих и общих выбираешь лучшие шесть.','Для підрахунку — так. Руками не хапати. Зі своїх і спільних обираєш найкращі шість.'),
 page(P,'Тги одинаковых — отгяд. Две пагы — два дуэта. Шесть кагт не обязаны все быть полезными.','Тги однакові — загін. Дві паги — два дуети. Шість кагт не мусять усі бути когисними.'),
 page(F,'Пять рангов подряд — тоже дело. Цвета мешать можно. Соберёшь ещё лучше — сравним.','П’ять рангів поспіль — теж діло. Кольори мішати можна. Збереш ще краще — порівняємо.'),
 page(T,'Когда деньги ставить?','Коли гроші ставити?'),page(F,'По очереди. Если никто не поднял — можешь пропустить ставку и остаться.','По черзі. Якщо ніхто не підняв — можеш пропустити ставку й лишитися.'),
 page(F,'Подняли — либо докладываешь столько же, либо пас. То, что уже поставил, назад не тянешь.','Підняли — або докладаєш стільки ж, або пас. Те, що вже поставив, назад не тягнеш.'),
 page(E,'А если не хватает?','А якщо не вистачає?'),page(F,'Ставишь остаток. Но на чужую лишнюю медь не претендуешь. Сначала считаем общий банк, потом добавку.','Ставиш залишок. Але на чужу зайву мідь не претендуєш. Спершу рахуємо спільний банк, потім додаток.'),
 page(L,'И не надо каждый раз ставить всё, Тарин.','І не треба щоразу ставити все, Таріне.'),page(T,'Я услышал с первого раза.','Я почув з першого разу.'),
 page(F,'Сначала открою три общие. Потом ещё две. Потом последнюю. Между ними успеешь и подумать, и передумать.','Спершу відкрию три спільні. Потім ще дві. Потім останню. Між ними встигнеш і подумати, і передумати.'),
 page(P,'А если все спасуют — последний забегаёт банк. Даже если у него полная хгень.','А якщо всі спасують — останній забегає банк. Навіть якщо в нього повна хгінь.'),
 page(E,'Теперь понятно. Сдавай.','Тепер зрозуміло. Здавай.')
],[],{cardEvent:{enabled:true,phase:'intro',round:1,once:true,maxVisit:1},cardAction:{kind:'example'}});
const noticed=e.nodes.find(n=>n.id==='card-story-milo-noticed');noticed.cardEvent={enabled:true,phase:'guestAppeared',delaySeconds:3,round:0,once:true};noticed.slides.find(p=>p.speaker===T).text='Садись рядом. Сейчас эту раздачу закончим.';noticed.slides.find(p=>p.speaker===T).textUk='Сідай поруч. Зараз цю роздачу закінчимо.';
const stone=e.nodes.find(n=>n.id==='card-social-stone');stone.cardEvent={enabled:true,phase:'afterEvent',afterEventId:'card-story-milo-noticed',delaySeconds:2,round:0,once:true,unless:'noStones',participants:[F]};
const c=e.minigames.towerClaw;Object.assign(c,{realMoney:true,currencyItemId:C,sponsor:{playerId:T,speakerId:L,amount:6,profitShare:.5},itemStakes:[{speakerId:F,itemId:'evan-broken-counter',value:5},{speakerId:P,itemId:'evan-lodestone-fragment',value:3}]});
for(const [id,item,ru,ua] of [[F,'evan-broken-counter','счётчик','лічильник'],[P,'evan-lodestone-fragment','магнитный камень','магнітний камінь']]){
 const suffix=id===F?'feltser':'pen',offer='card-v21-offer-'+suffix,yes=offer+'-yes',no=offer+'-no',price='{{stake:'+id+'}}';
 put(offer,'Нет меди · '+ru,'Немає міді · '+ua,[page(id,id===F?'Бля. Пусто. Погоди, у меня ещё счётчик есть.':'Медь кончилась. А камень — нет.',id===F?'Бля. Порожньо. Стривай, у мене ще лічильник є.':'Мідь скінчилася. А камінь — ні.'),page(id,'Возьмёшь '+ru+' за '+price+' медных? Я на них ещё сыграю.','Візьмеш '+ua+' за '+price+' мідних? Я на них ще зіграю.'),page(E,'Значит, вещь сразу моя. И потом обратно не требуешь.','Отже, річ одразу моя. І потім назад не вимагаєш.'),page(id,'Договорились. Или не берёшь?','Домовилися. Чи не береш?')],[link(yes,'Договорились. Отдать медь за предмет','Домовилися. Віддати мідь за річ',{cardPurchase:id,effect:'offerResolved:'+id,rememberEffect:true}),link(no,'Нет. Сегодня хватит','Ні. На сьогодні досить',{effect:'offerResolved:'+id,rememberEffect:true})],{cardEvent:{enabled:true,phase:'roundEnd',round:0,once:true,requires:'broke:'+id,unless:'offerResolved:'+id,participants:[id,E]}});
 put(yes,'Вещь меняет владельца','Річ змінює власника',[page(id,'Держи. С новой раздачи я опять в игре.','Тримай. З нової роздачі я знову в грі.')]);
 put(no,'Без добавки','Без додатку',[page(id,id===F?'Ладно, бля. Посмотрю, как остальные утонут.':'Ладно. Кагты убгал, глаза оставил.',id===F?'Гаразд, бля. Подивлюся, як інші потонуть.':'Гагазд. Кагти пгибгав, очі залишив.')]);
}
// The contribution scene happens once; subsequent visits use the remaining wallets.
for(const n of e.nodes){const incoming=n.links.filter(l=>l.to==='evan-v21-lida');for(const l of incoming){l.unless='evan-lida-agreed';n.links.push({...l,id:'v21-'+(++serial),to:'evan-port-at-circle',unless:'',requires:'evan-lida-agreed'});}}
const patch={format:'zargota-guarded-content-patch',base:'episode-1-courtyard-v20.json',operations:[]};
for(const node of e.nodes){const before=base.nodes.find(n=>n.id===node.id)||null;if(JSON.stringify(before)!==JSON.stringify(node))patch.operations.push({collection:'nodes',id:node.id,before,after:node});}
patch.operations.push({property:'minigames',before:base.minigames,after:e.minigames});
fs.writeFileSync(path.join(dir,'episode-1-courtyard-v21.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(dir,'courtyard-v21-patch.json'),JSON.stringify(patch,null,2)+'\n');
console.log('v21 prepared: paid entry, live wallet text, sponsor, in-world tutorial and item offers. Browser data untouched.');
