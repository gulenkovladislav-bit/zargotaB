// Review of the exported episode; never mutates browser/editor storage or its input.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [source,destination]=process.argv.slice(2);assert.ok(source&&destination,'Pass input and NEW output paths');
const raw=fs.readFileSync(source),out=JSON.parse(raw),e=out.episode,before=structuredClone(e);
assert.ok(e.minigames.towerClawTables.find(t=>t.tableId==='engineering').tableVisual,'Requires v28');
const node=id=>{const n=e.nodes.find(n=>n.id===id);assert.ok(n,id);return n;};
const set=(id,ru,uk)=>Object.assign(node(id),{text:ru,textUk:uk});
const line=(p,ru,uk)=>Object.assign(p,{text:ru,textUk:uk});
const link=(id,to,label,labelUk,extra={})=>({id,to,label,labelUk,...extra});
// Refusal is a real branch, not a dead end that forces paid gambling.
node('evan-v21-decline').links=[link('v29-decline-stay','','Пока остаться во дворе','Поки лишитися у дворі'),link('v29-decline-depart','evan-v25-depart','Пойду к родителям','Піду до батьків')];
const meet=e.quests.find(q=>q.id==='evan-yard-meet-quest');
meet.dialogueIds=[...new Set([...(meet.dialogueIds||[]),'evan-v21-decline'])];
Object.assign(meet,{objective:'Поговорить с ребятами и решить, садиться ли за карты.',objectiveUk:'Поговорити з хлопцями й вирішити, чи сідати за карти.'});
Object.assign(e.quests.find(q=>q.id==='evan-yard-game-quest'),{objective:'Сыграть, если хочется. Перед поездкой попрощаться с ребятами и вернуться к лавке.',objectiveUk:'Зіграти, якщо хочеться. Перед поїздкою попрощатися з хлопцями й повернутися до крамниці.'});
for(const id of ['evan-yard-ready','evan-exchange-back','evan-port-wait'])node(id).links.push(link('v29-depart-'+id,'evan-v21-decline','Больше не играю','Більше не граю'));
for(const id of ['evan-yard-ready','evan-yard-finish'])for(const l of node(id).links)if(l.to==='evan-port-at-circle')Object.assign(l,{requiresItemId:'evan-copper-coin',requiresItemQty:1});
// Old optional doorstep dialogue must not invent a winner or replay an obsolete ending.
set('evan-yard-door','Эван, ты далеко собрался? Как приедет повозка, сразу возвращайся.','Еване, ти далеко зібрався? Як приїде повозка, одразу повертайся.');
line(node('evan-yard-door').slides[0],'Я рядом, во дворике. Не пропущу.','Я поруч, у дворику. Не пропущу.');
line(node('evan-yard-door').slides[1],'Слышала я это «не пропущу». Смотри не заставь возницу искать тебя по всему кварталу.','Чула я це «не пропущу». Дивись не змусь візника шукати тебе всім кварталом.');
set('evan-yard-door-after','Если уже собираться, сначала попрощаюсь с ребятами.','Якщо вже збиратися, спершу попрощаюся з хлопцями.');
// The optional drawing folder is not guaranteed to have been picked up.
set('evan-father','Пап, если в мастерской разрешат, я хочу показать свои рисунки.','Тату, якщо в майстерні дозволять, я хочу показати свої малюнки.');
line(node('evan-mother-time').slides[3],'Хорошо. Только мои черновики с бумагами для поступления не перепутай.','Добре. Тільки мої чернетки з паперами для вступу не переплутай.');
// Correct the call explanation: match the total, not add the entire raise again.
const tutorial=node('card-story-intro');
line(tutorial.slides.find(p=>p.text.startsWith('Подняли —')),'Подняли — докладываешь недостающее или пасуешь. Уже поставил две, ставка стала три — добавляешь одну.','Підняли — докладаєш те, чого бракує, або пасуєш. Уже поставив дві, ставка стала три — додаєш одну.');
const callIndex=tutorial.slides.findIndex(p=>p.text.startsWith('Подняли —'));
tutorial.slides.splice(callIndex+1,0,{speaker:'evan-port-feltser',emotion:'speaking',showPortrait:true,text:'А то, что поставил до паса, остаётся здесь. Передумал — не значит воскресил свою медь.',textUk:'А те, що поставив до пасу, лишається тут. Передумав — не означає воскресив свою мідь.'});
// Keep established cruel courtyard scenes and their choices intact; sharpen the money stakes.
line(node('evan-v21-lida').slides[1],'У меня ещё {{lidaContribution}}. Добавлю. Своё сначала вернём, а выигрыш — пополам. Не делай вид, что не услышал.','У мене ще {{lidaContribution}}. Додам. Своє спершу повернемо, а виграш — навпіл. Не вдавай, що не почув.');
line(node('evan-v21-lida').slides[3],'Потому и сяду рядом. Если уж хоронить мои деньги, я хотя бы должна видеть покойника.','Тому й сяду поруч. Якщо вже ховати мої гроші, я хоча б маю бачити небіжчика.');
set('campus27-artist','Нужна карта со своим лицом? Герой, рыцарь или король — по пять медных. Корону за эти деньги только нарисую.','Потрібна карта зі своїм обличчям? Герой, лицар або король — по п’ять мідних. Корону за ці гроші лише намалюю.');
set('campus27-table-after','Пересчитай свои. Если осталась медь — место свободно. В долг не даём, даже под честное лицо.','Перелічи свої. Якщо лишилася мідь — місце вільне. У борг не даємо, навіть під чесне обличчя.');
const table=e.minigames.towerClawTables.find(t=>t.tableId==='engineering');
// A win reply cannot describe betting that has already ended.
line(table.replies[table.opponents[0]].win[0],'Сначала монеты пересчитай. На обиду времени хватит.','Спершу монети перелічи. На образу часу вистачить.');
// Distinct campus voices. Observable details and personal jokes, not new institutional canon.
const voices={
magic:[
 ['Если я ещё раз перечитаю вопрос, он, может, сжалится и станет понятным.','Якщо я ще раз перечитаю запитання, воно, може, змилується й стане зрозумілим.'],
 ['Только не отвлекай. Ответ я помню. Осталось вспомнить, на что.','Тільки не відволікай. Відповідь я пам’ятаю. Лишилося згадати, на що.'],
 ['Ты к преподавателю? Тогда за мной. Я уже пропустила двоих, пока собиралась с духом.','Ти до викладача? Тоді за мною. Я вже пропустила двох, поки збиралася з духом.'],
 ['На камень смотреть можно. Я спросил. Второй вопрос — зачем мы на него смотрим — пока придержу.','На камінь дивитися можна. Я спитав. Друге запитання — навіщо ми на нього дивимося — поки притримаю.'],
 ['Красивые буквы? Спасибо. Содержание преподаватель пока не хвалил.','Гарні літери? Дякую. Зміст викладач поки не хвалив.'],
 ['Вон тот лист — мой. Не наступи: это единственное, что сегодня получилось без помарок.','Он той аркуш — мій. Не наступи: це єдине, що сьогодні вийшло без помарок.']
 ],
engineering:[
 ['За портретом — ко мне. За советом, как выиграть, — не к тому, кто сейчас сгребает деньги.','По портрет — до мене. По пораду, як виграти, — не до того, хто зараз згрібає гроші.'],
 ['Чертёж безупречный. Дерево, сука, опять не согласилось.','Креслення бездоганне. Дерево, сука, знову не погодилося.'],
 ['Подержать предложишь — не откажусь. Только с этой стороны: с той я уже проверил пальцем.','Запропонуєш потримати — не відмовлюся. Тільки з цього боку: з того я вже перевірив пальцем.'],
 ['Пять медных проиграл. Зато теперь знаю, сколько стоит совет «не спеши».','П’ять мідних програв. Зате тепер знаю, скільки коштує порада «не поспішай».'],
 ['Мастер велел найти причину люфта. Я нашёл три. Теперь прячу четвёртую от самого себя.','Майстер звелів знайти причину люфту. Я знайшов три. Тепер ховаю четверту від самого себе.'],
 ['Хочешь играть — садись. Подсматривать через плечо дешевле, но место всё равно занимать придётся.','Хочеш грати — сідай. Підглядати через плече дешевше, але місце однаково зайняти доведеться.']
 ],
botany:[
 ['Не трогай дощечку. Я только вспомнил, что здесь посеял. Если забуду ещё раз, будем ждать всходов.','Не чіпай дощечку. Я щойно згадав, що тут посіяв. Якщо забуду ще раз, чекатимемо сходів.'],
 ['Земля под ногтями — моя. А вот эта в горшке подписана. Не перепутай, если будешь жаловаться.','Земля під нігтями — моя. А ось ця в горщику підписана. Не переплутай, якщо скаржитимешся.'],
 ['Поливать второй раз было лишним. Теперь стараюсь не встречаться с преподавательницей взглядом.','Поливати вдруге було зайвим. Тепер намагаюся не зустрічатися з викладачкою поглядом.'],
 ['Этот черенок ещё живой. Остальные я пока называю наблюдением.','Цей живець іще живий. Решту я поки називаю спостереженням.'],
 ['Пахнет плохо, зато честно. В других дворах свои ошибки хотя бы можно завернуть в бумагу.','Пахне кепсько, зате чесно. В інших дворах свої помилки хоча б можна загорнути в папір.'],
 ['Не ешь ничего с учебной грядки. Мне уже хочется дожить до обеда, а не послужить объяснением.','Не їж нічого з навчальної грядки. Мені вже хочеться дожити до обіду, а не стати поясненням.']
 ],
military:[
 ['Стой сбоку. В мишень я сегодня попадаю редко, зато рядом — почти всегда.','Стій збоку. У мішень я сьогодні влучаю рідко, зате поруч — майже завжди.'],
 ['Да, меч деревянный. Нет, пальцам от этого не легче.','Так, меч дерев’яний. Ні, пальцям від цього не легше.'],
 ['Мел не стирай. По этой черте я должен отходить. Пока чаще падаю.','Крейду не стирай. По цій рисці я маю відступати. Поки частіше падаю.'],
 ['Мне сказали: не закрывай глаза. Отлично. Теперь я ещё и вижу, за что получаю.','Мені сказали: не заплющуй очі. Чудово. Тепер я ще й бачу, за що дістаю.'],
 ['Я не отдыхаю. Я проверяю, все ли рёбра на месте. Не сбивай.','Я не відпочиваю. Я перевіряю, чи всі ребра на місці. Не збивай.'],
 ['Бить сильнее я умею. Осталось попасть туда, куда обещаю.','Бити сильніше я вмію. Лишилося влучити туди, куди обіцяю.']
 ]};
for(const [faculty,rows] of Object.entries(voices))rows.forEach((pair,i)=>set(`campus26-${faculty}-person-${i}`,...pair));
// New content remains editable using the existing graph and per-table reply settings.
const operations=[];
for(const collection of ['nodes','quests'])for(const after of e[collection]){const old=before[collection].find(n=>n.id===after.id);if(JSON.stringify(old)!==JSON.stringify(after))operations.push({collection,id:after.id,before:old,after});}
if(JSON.stringify(before.minigames)!==JSON.stringify(e.minigames))operations.push({collection:'minigames',before:before.minigames,after:e.minigames});
const patch={format:'zargota-guarded-content-patch',sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),base:source,operations};
fs.writeFileSync(destination,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(destination.replace(/\.json$/,'.patch.json'),JSON.stringify(patch,null,2)+'\n',{flag:'wx'});
console.log(`${operations.length} guarded changes -> ${destination}`);
