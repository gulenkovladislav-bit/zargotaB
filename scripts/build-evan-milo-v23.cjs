const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=process.argv[2]||'/Users/merkov/Downloads/episode-muedzjx3-odc3 (1).json';
const out=JSON.parse(fs.readFileSync(source)),e=out.episode,base=structuredClone(e),dir=path.join(__dirname,'../story-content/evan');
const E=e.playerSpeakerId,F='evan-port-feltser',P='evan-port-pen',M='evan-yard-milo',T='evan-friend-tarin',L='evan-friend-lida',N='evan-courtyard-narrator';
function page(s,text,textUk,emotion='speaking'){return{speaker:s,text,textUk,emotion:s===N?'':s===E?'emotion-1789852989293':emotion,showPortrait:s!==N};}
function write(id,pages){const n=e.nodes.find(n=>n.id===id);assert.ok(n,id);Object.assign(n,pages[0],{firstShowPortrait:pages[0].showPortrait,slides:pages.slice(1)});return n;}
function add(id,title,titleUk,pages,to){const n={id,title,titleUk,kind:'dialogue',editorSceneId:'scene-evan-green-courtyard',x:7100,y:2100+e.nodes.length*3,links:to?[{id:id+'-next',to,label:'Далее',labelUk:'Далі'}]:[]};e.nodes.push(n);return write(id,pages);}
function choice(n,id,to,label,labelUk,effect){return{id,to,label,labelUk,...(effect?{effect,rememberEffect:true}:{})};}
write('card-story-milo-noticed',[
 page(F,'Блять! Ты давно тут стоишь?','Блять! Ти давно тут стоїш?','shocked'),
 page(M,'Пока ты проигрывал.','Поки ти програвав.'),
 page(P,'Давно, значит.','Давно, значить.','laughing'),
 page(F,'Очень смешно. Чего надо?','Дуже смішно. Чого треба?','angry'),
 page(M,'С вами. Я принёс.','З вами. Я приніс.'),
 page(T,'Только не на карты высыпай.','Тільки не на карти висипай.')]);
write('card-story-stones',[
 page(M,'Вот. У меня тоже есть.','Ось. У мене теж є.'),
 page(F,'Бля, он мостовую принёс. Ты по дороге весь двор обобрал?','Бля, він бруківку приніс. Ти дорогою весь двір обібрав?','surprised'),
 page(P,'Богатый. Два забога — и можно дом покупать.','Багатий. Два пагкани — і можна хату купувати.','laughing'),
 page(M,'Этот гладкий. Он больше стоит.','Цей гладенький. Він більше коштує.'),
 page(F,'Гладкий оставь. Надгробие твоему кошельку.','Гладенький залиш. Надгробок твоєму гаманцю.','laughing'),
 page(L,'У меня больше нет. Я Тарину отдала.','У мене більше немає. Я Таріну віддала.')]);
write('card-story-crunch',[page(N,'Пока Фельцер считает медь, рядом тихо хрустит. У Мило остаётся одна карта.','Поки Фельцер рахує мідь, поруч тихо хрумтить. У Мило лишається одна карта.')]);
const missing=write('card-story-card-missing',[
 page(F,'Погоди. Одну вижу. Вторую подними.','Стривай. Одну бачу. Другу підніми.','pointing'),
 page(M,'Нету.','Немає.'),
 page(F,'Под задницей посмотри.','Під дупою подивись.','angry'),
 page(M,'Я съел.','Я з’їв.'),
 page(P,'В смысле — всю?','Тобто — всю?','surprised'),
 page(M,'Она маленькая.','Вона маленька.'),
 page(F,'Ха… Блять. Ты не шутишь? Это моя карта. Моя, сука, колода!','Ха… Блять. Ти не жартуєш? Це моя карта. Моя, сука, колода!','angry'),
 page(P,'Не пе-ге-живай. Завтга вегнёт. Только ганг не пе-гепутай.','Не пе-ге-живай. Завтга повегне. Тільки ганг не пе-геплутай.','laughing'),
 page(T,'Только в мою руку потом не сдавай.','Тільки в мою руку потім не здавай.')]);
missing.kind='choice';missing.links=[
 choice(missing,'v23-bite-mock','v23-bite-mock','Теперь понятно, куда пропадают короли','Тепер зрозуміло, куди зникають королі','evanMockedMilo'),
 choice(missing,'v23-bite-silent','v23-bite-silent','Промолчать и отодвинуть свои карты','Промовчати й відсунути свої карти','evanIgnoredMilo'),
 choice(missing,'v23-bite-stop','v23-bite-stop','Хватит ржать. Мило, остальное положи','Досить реготати. Мило, решту поклади','evanDefendedMilo')];
add('v23-bite-mock','Карты · Еван подыгрывает','Карти · Еван підігрує',[
 page(E,'Теперь понятно, куда пропадают короли. Казнь без остатка.' ,'Тепер зрозуміло, куди зникають королі. Страта без залишку.'),
 page(P,'А мы ещё столицу искали.','А ми ще столицю шукали.','laughing'),
 page(M,'Я только одну.','Я тільки одну.'),
 page(F,'За вторую счёт выставлю. Жрать будет в долг.','За другу рахунок виставлю. Жертиме в борг.','angry')],'card-story-card-return');
add('v23-bite-silent','Карты · Еван молчит','Карти · Еван мовчить',[
 page(N,'Еван придвигает свои карты к себе. Фельцер замечает и коротко фыркает.','Еван підсуває свої карти до себе. Фельцер помічає й коротко пирхає.'),
 page(F,'Правильно. Спасай дворянство.','Правильно. Рятуй шляхту.','laughing'),
 page(M,'Я твою не буду.','Я твою не буду.')],'card-story-card-return');
add('v23-bite-stop','Карты · Еван прерывает смех','Карти · Еван перериває сміх',[
 page(E,'Хватит ржать. Мило, остальное положи. Не в рот — на ткань.','Досить реготати. Мило, решту поклади. Не до рота — на тканину.'),
 page(F,'Ты мне новую колоду купишь? Тогда командуй.','Ти мені нову колоду купиш? Тоді командуй.','angry'),
 page(E,'Я сказал положить карту. Не купить тебе лавку.','Я сказав покласти карту. Не купити тобі крамницю.')],'card-story-card-return');
const end=write('card-story-card-return',[
 page(N,'Мило кладёт оставшуюся карту на мешковину. Второй нет. Фельцер ещё раз смотрит ему в рот.','Мило кладе карту, що лишилася, на мішковину. Другої немає. Фельцер ще раз дивиться йому до рота.'),
 page(F,'Остальное не трогай. Даже если тебе короля недокормили.','Решту не чіпай. Навіть якщо тобі короля недогодували.','angry'),
 page(M,'Я уже не хочу.','Я вже не хочу.'),
 page(T,'Твой ход, Фельцер. Мы всё ещё на деньги играем.','Твій хід, Фельцере. Ми досі на гроші граємо.')]);
delete end.cardAction;end.title='Карты · одна карта осталась';end.titleUk='Карти · лишилася одна карта';
const stone=write('card-social-stone',[
 page(M,'Ай. Это мой камень.','Ай. Це мій камінь.','angry'),
 page(F,'Вернул вклад. Чего недовольный?','Повернув внесок. Чого невдоволений?','laughing'),
 page(P,'С пгоцентами.','З відсотками.','laughing'),
 page(M,'Не так. В руку дай.','Не так. До руки дай.','sad')]);
stone.links.push(choice(stone,'v23-stone-mock','v23-stone-mock','Вот тебе и прибыль','Ось тобі й прибуток','evanMockedMilo'),choice(stone,'v23-stone-silent','v23-stone-silent','Смотреть в свои карты','Дивитися у свої карти','evanIgnoredMilo'));
add('v23-stone-mock','Карты · жестокая шутка Евана','Карти · жорстокий жарт Евана',[page(E,'Вот тебе и прибыль. Не проси второй взнос.','Ось тобі й прибуток. Не проси другого внеску.'),page(F,'Еван понял правила.','Еван зрозумів правила.','laughing'),page(M,'Мне не смешно.','Мені не смішно.','angry')]);
add('v23-stone-silent','Карты · не вмешиваться','Карти · не втручатися',[page(N,'Еван смотрит в карты. Мило забирает камень с ткани и зажимает в кулаке.','Еван дивиться в карти. Мило забирає камінець із тканини й затискає в кулаці.'),page(F,'Ну всё, банк закрылся.','Ну все, банк зачинився.','laughing')]);
const patch={format:'zargota-guarded-content-patch',base:path.basename(source),operations:[]};
for(const n of e.nodes){const before=base.nodes.find(x=>x.id===n.id)||null;if(JSON.stringify(before)!==JSON.stringify(n)){for(const p of [n,...n.slides||[]]){assert.ok(p.text&&p.textUk);assert.ok(p.text.length<240&&p.textUk.length<240);if(p.emotion)assert.ok(e.speakers[p.speaker]?.emotions?.[p.emotion],n.id+': '+p.emotion);}patch.operations.push({collection:'nodes',id:n.id,before,after:n});}}
for(const op of patch.operations)for(const l of op.after.links||[])assert.ok(e.nodes.some(n=>n.id===l.to));
fs.writeFileSync(path.join(dir,'episode-1-milo-v23.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(dir,'milo-v23-patch.json'),JSON.stringify(patch,null,2)+'\n');
console.log('v23: '+patch.operations.length+' changed/new nodes, bilingual pages, emotions and links validated; source preserved');
