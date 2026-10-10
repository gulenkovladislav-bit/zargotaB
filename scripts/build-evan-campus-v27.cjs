// Additive, repeatable-from-v26 export. Never reads or writes browser storage.
const fs=require('node:fs'),assert=require('node:assert/strict');
const [source,destination]=process.argv.slice(2);assert.ok(source&&destination,'Usage: node scripts/build-evan-campus-v27.cjs v26.json output.json');
const out=JSON.parse(fs.readFileSync(source)),e=out.episode,sceneId='scene-evan-v25-engineering';
assert.ok(!e.nodes.some(n=>n.id.startsWith('campus27-')),'Already populated');
const scene=e.scenes.find(s=>s.id===sceneId).scene,hero=e.playerSpeakerId;
const person=i=>'campus26-engineering-person-'+i,artist=person(0)+'-speaker',expert=person(5)+'-speaker',other=[person(3)+'-speaker',person(4)+'-speaker'];
const copper='evan-copper-coin',root='campus27-artist',table='campus27-table',tableId='engineering';
function node(id,title,titleUk,speaker,text,textUk,links=[],extra={}){const n={id,kind:links.length>1?'choice':'dialogue',editorSceneId:sceneId,title,titleUk,x:400+(e.nodes.length%4)*370,y:2800+Math.floor(e.nodes.filter(n=>n.id.startsWith('campus27-')).length/4)*260,speaker,emotion:speaker===hero?'emotion-1789852989293':'',showPortrait:true,firstShowPortrait:true,portraitOverride:false,text,textUk,slides:[],links,...extra};e.nodes.push(n);return n;}
function link(to,label,labelUk,extra={}){return{id:to+'-'+label,to,label,labelUk,...extra};}
function role(i,name,nameUk,x,y,entry){const token=scene.tokens.find(t=>t.id===person(i));assert.ok(token);Object.assign(token,{name,nameUk,x,y,markerSize:25});Object.assign(e.speakers[token.speaker],{name,nameUk});e.interactions[token.id]={entryId:entry,marker:'?',markerVisible:true};}
role(0,'Студент-рисовальщик','Студент-малювальник',22,61,root);
role(5,'Опытный картёжник','Досвідчений картяр',30,80,table);
role(3,'Студент за картами','Студент за картами',23,82,'campus27-bystander-a');
role(4,'Студент за картами','Студент за картами',36,85,'campus27-bystander-b');
const menu=[];
for(const [key,rank,ru,uk,line,lineUk] of [
 ['hero',6,'Герой','Герой','С компасом и плащом. Будет вид, будто ты знаешь, куда идёшь.','З компасом і плащем. Матимеш вигляд, ніби знаєш, куди йдеш.'],
 ['knight',7,'Рыцарь','Лицар','Латы нарисую, шлем — нет. Иначе за что ты мне платишь, если лица не видно?','Лати намалюю, шолом — ні. Інакше за що ти мені платиш, якщо обличчя не видно?'],
 ['king',10,'Король','Король','Корону могу. Подданных и казну придётся добывать самому.','Корону можу. Підданих і скарбницю доведеться здобувати самому.']
]){
 const id='evan-card-skin-'+key,image='assets/stories/cards/tower-claw/evan-'+key+'-v1.png',offer='campus27-offer-'+key,bought='campus27-bought-'+key;
 e.storyItems.push({itemId:id,name:'Портретная карта: '+ru,nameUk:'Портретна карта: '+uk,description:'Еван в образе «'+ru+'». В карточной игре заменяет рисунок красного ранга '+rank+'. Сила и частота выпадения не меняются.',descriptionUk:'Еван в образі «'+uk+'». У картковій грі замінює малюнок червоного рангу '+rank+'. Сила й частота випадання не змінюються.',category:'other',stackable:false,qty:1,equipped:false,image,inspectImage:image,cardSkin:{rank,color:0,image}});
 menu.push(link(offer,ru+' — посмотреть',uk+' — подивитися'));
 node(offer,ru+' · портретная карта',uk+' · портретна карта',artist,line+' Пять медных за рисунок.',lineUk+' П’ять мідних за малюнок.',[
  link(bought,'Заказать за 5 медных','Замовити за 5 мідних',{requiresItemId:copper,requiresItemQty:5,requiresNoItemId:id,exchangeTakeId:copper,exchangeTakeQty:5,exchangeGiveId:id,exchangeGiveQty:1,exchangeUnique:true,exchangeOnce:'bought:'+id,exchangeLimit:5}),
  link(root,'Посмотреть другие','Подивитися інші'),link('campus27-artist-leave','Не сейчас','Не зараз')
 ],{image,imageFit:'contain'});
 node(bought,'Рисунок готов','Малюнок готовий',artist,'Держи. Краску не трогай, пусть схватится. За столом тебя теперь сразу узнают.','Тримай. Фарбу не чіпай, нехай схопиться. За столом тебе тепер одразу впізнають.',[link(root,'Посмотреть ещё','Подивитися ще'),link('campus27-artist-leave','Спасибо, пойду','Дякую, піду')],{image,imageFit:'contain'});
}
menu.push(link('campus27-artist-rules','А с ними можно играть?','А ними можна грати?'),link('campus27-artist-leave','Я ещё подумаю','Я ще подумаю'));
node(root,'Карты с твоим лицом','Карти з твоїм обличчям',artist,'Садись на минуту — нарисую тебя на карте. Героем, рыцарем, королём. По пять медных; у тебя сейчас {{copper}}.', 'Сідай на хвилину — намалюю тебе на карті. Героєм, лицарем, королем. По п’ять мідних; у тебе зараз {{copper}}.',menu);
node('campus27-artist-rules','Та же колода','Та сама колода',artist,'Ранг и рубашку я не меняю. Только лицо. У ребят за верстаком такие уже есть — играют, никто не спорит.','Ранг і сорочку я не міняю. Лише обличчя. У хлопців за верстатом такі вже є — грають, ніхто не сперечається.',[link(root,'Покажи варианты','Покажи варіанти')]);
node('campus27-artist-leave','До встречи','До зустрічі',artist,'Я пока здесь. Только не садись на коробку с красками.','Я поки тут. Тільки не сідай на коробку з фарбами.');
node(table,'Карты у инженеров','Карти в інженерів',expert,'Место свободно. Играем на медь, без долгов. Только не ставь всё сразу — мне интереснее, когда соперник успевает подумать.','Місце вільне. Граємо на мідь, без боргів. Тільки не став усе одразу — мені цікавіше, коли суперник встигає подумати.',[
 link('campus27-deal','Сесть за стол','Сісти за стіл',{requiresItemId:copper,requiresItemQty:1}),link('campus27-table-rules','Давно играешь?','Давно граєш?'),link('campus27-table-leave','Пока посмотрю','Поки подивлюся')
]);
node('campus27-table-rules','Привычка считать','Звичка рахувати',expert,'Достаточно, чтобы смотреть на ставки, а не на выражение лица. На прошлой неделе один улыбался до последней монеты.','Достатньо, щоб дивитися на ставки, а не на вираз обличчя. Минулого тижня один усміхався до останньої монети.',[link(table,'Понятно','Зрозуміло')]);
node('campus27-deal','Начать партию у инженеров','Почати партію в інженерів',expert,'Подвинь сумку, тут карты лягут. Сдаю.','Посунь сумку, тут ляжуть карти. Здаю.',[link('campus27-table-after','Играем','Граємо')]);
node('campus27-table-after','После партии','Після партії',expert,'Пересчитай свои. Если ещё садишься — кошельки остаются те же.','Перелічи свої. Якщо ще сідаєш — гаманці лишаються ті самі.',[link('campus27-deal','Ещё партия','Ще партія',{requiresItemId:copper,requiresItemQty:1}),link('campus27-table-leave','На сегодня хватит','На сьогодні досить')]);
node('campus27-table-leave','Отойти от стола','Відійти від столу',expert,'Ладно. Проход только не загораживай — мастер и так на нас косится.','Гаразд. Прохід тільки не затуляй — майстер і так на нас коситься.');
node('campus27-bystander-a','Свободное место','Вільне місце',other[0],'Садись, если умеешь. Только у него советов не спрашивай: он объясняет уже после того, как забрал банк.','Сідай, якщо вмієш. Тільки в нього порад не питай: він пояснює вже після того, як забрав банк.',[link(table,'Подойти к столу','Підійти до столу')]);
node('campus27-bystander-b','Не мешай считать','Не заважай рахувати',other[1],'Погоди, я считаю. Нет, не монеты — сколько раз мне сегодня не повезло.','Зачекай, я рахую. Ні, не монети — скільки разів мені сьогодні не пощастило.',[link(table,'Можно к вам?','Можна до вас?')]);
const rows=(...pairs)=>pairs.map(([text,textUk])=>({text,textUk,emotion:''}));
const replies={};
replies[expert]={
 win:rows(['Не спеши открываться. Я ещё ставку не закончил считать.','Не поспішай відкриватися. Я ще ставку не скінчив рахувати.'],['Хорошая рука. У меня оказалась лучше.','Гарна рука. У мене виявилася краща.']),
 loss:rows(['Чисто взял. Давай следующую.','Чисто взяв. Давай наступну.'],['Здесь я переплатил. Запомню.','Тут я переплатив. Запам’ятаю.']),
 raise:rows(['Дороже. Решай.','Дорожче. Вирішуй.']),allin:rows(['Всё на столе. Больше у меня нет.','Усе на столі. Більше в мене немає.']),
 lowMoney:rows(['Хватит ещё на одну ошибку. Постараюсь без неё.','Вистачить іще на одну помилку. Спробую без неї.']),
 bigWin:rows(['Сначала разделим банк. Потом будем спорить.','Спершу поділимо банк. Потім сперечатимемося.']),rich:rows(['Это ещё не повод ставить вслепую.','Це ще не привід ставити наосліп.'])};
replies[other[0]]={win:rows(['Вот! А ты говорил — не дотяну.','От! А ти казав — не дотягну.']),loss:rows(['Так, обед стал заметно скромнее.','Так, обід став помітно скромнішим.']),raise:rows(['Добавлю. Не смотри так, я посчитал.','Додам. Не дивися так, я порахував.']),allin:rows(['Ладно. Хуже пустого кошелька только ждать, пока он опустеет.','Гаразд. Гірше за порожній гаманець лише чекати, поки він спорожніє.'])};
replies[other[1]]={win:rows(['Наконец-то. Я уже начал обижаться на колоду.','Нарешті. Я вже почав ображатися на колоду.']),loss:rows(['Опять? Да чтоб у тебя все чертежи намокли.','Знову? Та щоб у тебе всі креслення змокли.']),raise:rows(['Ещё медь. Проверим.','Іще мідь. Перевіримо.']),allin:rows(['Вот и весь мой запас. Без лекций, пожалуйста.','Ось і весь мій запас. Без лекцій, будь ласка.'])};
replies[hero]={win:rows(['Так. Это я забираю?','Так. Це я забираю?']),loss:rows(['Поторопился.','Поквапився.']),allin:rows(['Больше не добавлю. Всё здесь.','Більше не додам. Усе тут.'])};
e.minigames.towerClawTables=e.minigames.towerClawTables||[];
e.minigames.towerClawTables.push({tableId,name:'Инженерный двор',nameUk:'Інженерне подвір’я',enabled:true,afterNodeId:'campus27-deal',realMoney:true,currencyItemId:copper,opponents:[expert,...other],styles:['expert','cautious','bold'],stacks:[20,45,18,24],guestSpeakerId:'',itemStakes:[],sponsor:{},socialReplies:true,actionRepliesPerRound:1,firstRoundThinkMs:2000,npcThinkMs:1500,replies});
fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log('v27: 3 portrait skins, artist, independent engineering table. '+destination);
