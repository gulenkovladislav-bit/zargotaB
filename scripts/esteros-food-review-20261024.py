"""Apply reviewed food-search dialogue/audio to a fresh exchange export, preserving scene settings."""
import copy,json,sys
from pathlib import Path
TEXT={
'food-water':[("Вода набрана. Пора бы идти, а я всё стою.","Воду набрано. Час би йти, а я все стою.",'sad'),("Здесь хотя бы слышно реку. Дома я всё прислушиваюсь, не позвала ли мама.","Тут хоча б чути річку. Удома я весь час прислухаюся, чи не покликала мама.",'worried'),("Надо ещё найти еды. Вчера она опять сказала, что не голодна.","Треба ще знайти їжу. Учора вона знову сказала, що не голодна.",'sad')],
'food-water-repeat':[("Котелок уже полный. Хоть за водой второй раз идти не придётся.","Казанок уже повний. Хоч по воду вдруге йти не доведеться.",'')],
'food-plan':[("В деревнях просить нечего. У кого ещё есть еда, те берегут её для своих.","У селах просити нічого. У кого ще є їжа, ті бережуть її для своїх.",'sad'),("А где лихорадка, к дверям лучше не подходить. Уже думаю об этом так, будто речь о плохой погоде.","А де гарячка, до дверей краще не підходити. Вже думаю про це так, наче йдеться про негоду.",'worried'),("Остаются затон, кочка у воды и протока. Надо посмотреть, что там ещё можно найти.","Лишаються затон, купина біля води й протока. Треба подивитися, що там ще можна знайти.",'tense')],
'food-path':[("Если сейчас пойти домой, мама спросит только, не устал ли я. Про пустые руки ничего не скажет.","Якщо зараз піти додому, мама спитає тільки, чи я не втомився. Про порожні руки нічого не скаже.",'sad'),("Посмотрю ещё одно место.","Подивлюся ще одне місце.",'tense')],
'food-home':[("Теперь есть что принести. Всё проверяю, на месте ли еда, хотя потерять её было негде.","Тепер є що принести. Все перевіряю, чи на місці їжа, хоча загубити її було ніде.",'hopeful'),("Можно домой. Сегодня не придётся начинать с того, что я ничего не нашёл.","Можна додому. Сьогодні не доведеться починати з того, що я нічого не знайшов.",'hopeful')],
'food-already':[("Больше ничего не осталось. Я ведь уже проверял.","Більше нічого не лишилося. Я ж уже перевіряв.",'sad')],
'food-map':[("Где я ещё не смотрел?..","Де я ще не дивився?..",'')],
'food-backwater-arrival':[("Тут тихо. Даже вода почти не движется.","Тут тихо. Навіть вода майже не рухається.",'')],
'food-tracks':[("Колея уходит в камыш. Здесь и пешком вязнешь — зачем было тащить сюда повозку?","Колія йде в очерет. Тут і пішки грузнеш — навіщо було тягти сюди воза?",'doubtful')],
'food-cart':[("Люди… Я сперва увидел только одежду.","Люди… Я спершу побачив тільки одяг.",'tense'),("Двое у самой воды. Рядом повозка. Их привезли сюда?..","Двоє біля самої води. Поруч віз. Їх привезли сюди?..",'worried'),("Я не узнаю лиц. И всё равно пытаюсь разглядеть. Будто станет легче, если это чужие.","Я не впізнаю облич. І все одно намагаюся роздивитися. Наче стане легше, якщо це чужі.",'sad'),("Надо отойти. От этого жужжания уже мутит.","Треба відійти. Від цього дзижчання вже нудить.",'worried')],
'food-cart-repeat':[("Не хочу смотреть ещё раз. А взгляд всё равно возвращается к повозке.","Не хочу дивитися ще раз. А погляд усе одно повертається до воза.",'sad')],
'food-bad-roots':[("Корни совсем в тине. Стоит тронуть — поднимается муть.","Коріння зовсім у баговинні. Варто торкнутися — здіймається каламуть.",'doubtful'),("Если принести домой ещё и болезнь… Нет. Здесь брать не буду.","Якщо принести додому ще й хворобу… Ні. Тут не братиму.",'worried')],
'food-roots-arrival':[("Земля под ногами держит. Можно хоть перестать смотреть, куда ставлю ногу.","Земля під ногами тримає. Можна хоч перестати дивитися, куди ступаю.",'')],
'food-empty':[("Мелкие обрывки. Я всё перебираю их, хотя уже вижу: брать нечего.","Дрібні обривки. Я все перебираю їх, хоча вже бачу: брати нічого.",'sad')],
'food-rotten':[("Мягкий… А с виду был целый.","М’який… А на вигляд був цілий.",'doubtful'),("Хотелось уже положить в сумку и больше не проверять.","Хотілося вже покласти в торбу й більше не перевіряти.",'sad')],
'food-roots-find':[("Эти вроде крепкие. Под землёй ещё есть, только сидят глубоко.","Ці наче міцні. Під землею ще є, тільки сидять глибоко.",''),("Мама такие резала совсем тонко. В тарелке казалось больше.","Мама такі різала зовсім тонко. У тарілці здавалося більше.",'sad')],
'food-leave':[("Рука сама отдёрнулась. Не могу пока.","Рука сама відсмикнулася. Поки не можу.",'worried')],
'food-roots-work':[("Ещё чуть-чуть… Земля держит так, будто это её еда.","Ще трішки… Земля тримає так, ніби це її їжа.",'tense'),("Поддался. Только бы не сгнил внутри.","Піддався. Тільки б не згнив усередині.",'worried')],
'food-roots-take':[("Крепкие. Немного, но из них получится похлёбка.","Міцні. Небагато, але з них вийде юшка.",'hopeful'),("Уже представляю, как мама придерживает тёплую миску обеими руками.","Уже уявляю, як мама притримує теплу миску обома руками.",'hopeful')],
'food-channel-arrival':[("Камыш закрывает воду. Слышно её совсем рядом, а видно только между стеблями.","Очерет затуляє воду. Чути її зовсім поруч, а видно тільки між стеблами.",'')],
'food-nest':[("Яйца. Два виднеются под корнем… Я уже чувствую, как хочется есть.","Яйця. Два видніються під коренем… Я вже відчуваю, як хочеться їсти.",'hopeful'),("Дальше темно. Снаружи кажется, что рукой достать легко.","Далі темно. Ззовні здається, що рукою дістати легко.",'worried')],
'food-snake-wait':[("Смотрю в эту щель, пока глаза не начинают болеть. Всё равно ничего не разобрать.","Дивлюся в цю щілину, аж очі починають боліти. Усе одно нічого не розібрати.",'worried')],
'food-eggs-take':[("Оба целые. Держу так осторожно, будто от этого они могут стать сытнее.","Обидва цілі. Тримаю так обережно, наче від цього вони можуть стати ситнішими.",'tense'),("Одно маме. Одно мне. Хорошо хоть сегодня не придётся спорить, кто не голоден.","Одне мамі. Одне мені. Добре хоч сьогодні не доведеться сперечатися, хто не голодний.",'hopeful')],
'food-map-backwater':[("В затоне вода тише. Может, у кромки ещё осталось что-нибудь съедобное.","У затоні вода тихіша. Може, біля краю ще лишилося щось їстівне.",'')],
'food-map-roots':[("На этой кочке растут корни. Если их ещё не выкопали, можно набрать на похлёбку.","На цій купині росте коріння. Якщо його ще не викопали, можна набрати на юшку.",'')],
'food-map-channel':[("У протоки много корней и сухого камыша. Там бывает что поискать. Только под ноги надо смотреть.","Біля протоки багато коріння й сухого очерету. Там буває що пошукати. Тільки під ноги треба дивитися.",'worried')],
'food-map-stay':[("Может, ближе есть что-нибудь…","Може, ближче є щось…",'')],
'food-map-shore':[("От берега я найду дорогу домой и в темноте.","Від берега я знайду дорогу додому й у темряві.",'')],
'food-shore-return':[("Тот же плеск. Пока меня не было, здесь ничего не изменилось.","Той самий плюскіт. Поки мене не було, тут нічого не змінилося.",'sad')],
'food-eggs-reach':[("Только бы достать…","Тільки б дістати…",'tense')],
'food-snake-fright':[("Больно!.. На руке кровь. Всё-таки достала.","Боляче!.. На руці кров. Усе-таки дістала.",'tense'),("Две маленькие точки. Я смотрю на них и никак не могу понять, насколько это плохо.","Дві маленькі цятки. Я дивлюся на них і ніяк не можу зрозуміти, наскільки це погано.",'worried'),("Если рука опухнет, как я понесу воду домой?..","Якщо рука набрякне, як я понесу воду додому?..",'worried')],
}

def repair(e):
 e=copy.deepcopy(e);nodes={n['id']:n for n in e['nodes']}
 for id,pages in TEXT.items():
  n=nodes[id];n.update(text=pages[0][0],textUk=pages[0][1],emotion=pages[0][2],title=pages[0][0][:55],titleUk=pages[0][1][:55]);old=n.get('slides',[])
  # Reviewed nodes have no per-page actions; never drop an author's gameplay events.
  for slide in old:
   if any(slide.get(k) for k in ['afterPageActions','musicEvent','sound']):raise ValueError('Review page events before replacing '+id)
  n['slides']=[dict(text=ru,textUk=uk,emotion=emotion,showPortrait=True,portraitOverride=False) for ru,uk,emotion in pages[1:]]
 # Existing scene-audio fields, shared continuation group; no camera or token edits.
 shore=next(r['scene'] for r in e['scenes'] if r['id']=='scene-mvctoydb')['story']
 if not shore.get('ambience'):raise ValueError('Opening soundtrack not set')
 for r in e['scenes']:
  if r['id']=='scene-mvctoydb' or r['id'].startswith('scene-esteros-food-'):
   st=r['scene'].setdefault('story',{});st.update(ambience=shore['ambience'],volume=shore.get('volume',.8),ambienceLoop=True,ambienceGroup='esteros-food-day',ambienceContinue=True)
   if st.get('firstVisitDialogueId','').startswith('food-'):st.pop('firstVisitDialogueId')
 for n in e['nodes']:
  for l in n.get('links',[]):
   if l.get('sceneId','').startswith('scene-esteros-food-') and l.get('to','').endswith('-arrival'):l['to']=''
 cfg=e['minigames']['snakeReach'];cfg.update(sound='assets/stories/audio/esteros/snake-bite-01.mp3',soundVolume=1,soundRate=4)
 bite=nodes['food-snake-fright'];bite.update(damage=2,effect='esteros-snake-bitten')
 # Use the existing repeat-route and damage controls. Merely re-reading the site does not inflict another bite.
 bitten=copy.deepcopy(nodes['food-leave']);bitten.update(id='food-nest-bitten',title='После укуса',titleUk='Після укусу',text='Рука всё ещё болит. Стоит взглянуть под корень — и я снова чувствую этот рывок.',textUk='Рука досі болить. Варто глянути під корінь — і я знову відчуваю той ривок.',emotion='worried',slides=[dict(text='Нет. Вторую руку я туда не суну.',textUk='Ні. Другу руку я туди не суну.',emotion='tense',showPortrait=True,portraitOverride=False)],editorSceneId='scene-esteros-food-channel',x=1800,y=1900,links=[])
 for k in ['damage','effect','afterEffect','resolveEvent','repeatRoutes']:bitten.pop(k,None)
 if bitten['id'] not in nodes:e['nodes'].append(bitten)
 for id in ['food-nest','food-eggs-reach']:
  n=nodes[id];n['repeatRoutes']=[r for r in n.get('repeatRoutes',[]) if r.get('requires')!='esteros-snake-bitten']+[{'requires':'esteros-snake-bitten','to':'food-nest-bitten'}]
 # Route the minigame gate as well as inspection through its authored repeat rule.
 # The generic leave node is also used by roots; separate that refusal from retracting a hand.
 roots_leave=copy.deepcopy(nodes['food-leave']);roots_leave.update(id='food-roots-leave',title='Не сейчас',titleUk='Не зараз',text='Если бы сил было столько же, сколько голода… Посмотрю в другом месте.',textUk='Якби сил було стільки ж, скільки голоду… Подивлюся в іншому місці.',emotion='sad',slides=[],editorSceneId='scene-esteros-food-roots')
 if roots_leave['id'] not in nodes:e['nodes'].append(roots_leave)
 for n in e['nodes']:
  if n.get('editorSceneId')=='scene-esteros-food-roots':
   for l in n.get('links',[]):
    if l.get('to')=='food-leave':l['to']='food-roots-leave'
 e['scene']=copy.deepcopy(next(r['scene'] for r in e['scenes'] if r['id']==e['activeSceneId']))
 return e
if __name__=='__main__':
 p=Path(sys.argv[1]);doc=json.loads(p.read_text());doc['episode']=repair(doc['episode']);p.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n');print('Updated',len(TEXT),'dialogues, four scene soundtracks, bite consequences:',p)
