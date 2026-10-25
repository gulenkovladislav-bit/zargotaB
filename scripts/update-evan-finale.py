"""Guarded additive finale patch. Source must be a fresh exchange envelope."""
import copy, itertools, json, sys
from pathlib import Path
H='speaker-1789852672609'; F='speaker-1789814989758'; M='speaker-1789799703305'; N='evan-abbey-narrator'
P='evan-finale-'; ROOM='scene-evan-evening-room'; RESULTS='scene-evan-results'; DEPART='scene-evan-campus-departure'
ART='assets/stories/Evan/backgrounds/bedroom-evening-v1.png'
def page(s,ru,uk,think=False):
 return dict(speaker=s,text=ru,textUk=uk,emotion=({'speaker-1789852672609':'emotion-1789852949259' if think else 'emotion-1789852989293','speaker-1789814989758':'emotion-1789816132394','speaker-1789799703305':'emotion-1789816051716'}.get(s,'')),showPortrait=s!=N,portraitOverride=False)
def patch(source):
 e=copy.deepcopy(source);assert not any(n['id']==P+'ready' for n in e['nodes']),'Finale already present: preserve author edits'
 assert Path(ART).is_file()
 original={n['id']:copy.deepcopy(n) for n in e['nodes']}
 def link(to,ru='Продолжить',uk='Продовжити',**kw):return dict(id=P+'link-'+str(next(serial)),to=P+to,label=ru,labelUk=uk,**kw)
 serial=iter(range(1000))
 def node(id,ru,uk,pages,links=None,scene=ROOM,**kw):
  links=links or [];n=dict(id=P+id,kind='choice' if len(links)>1 else 'dialogue',editorSceneId=scene,title=ru,titleUk=uk,x=8200,y=2000+len(e['nodes'])*4,slides=pages[1:],links=links,firstShowPortrait=pages[0]['showPortrait'],**kw);n.update(pages[0]);e['nodes'].append(n);return n
 node('ready','День в университете','День в університеті',[
 page(H,'В каждом дворе — совсем другое дело. А я всё возвращаюсь мыслями к тому станку и своим штырькам.','У кожному дворі — зовсім інша справа. А я весь час повертаюся думками до того верстата й своїх кілочків.',True),
 page(H,'Хочу ещё столько спросить. Запишу дома, пока не забыл. Родители, наверное, уже ждут у повозки.','Хочу ще стільки запитати. Запишу вдома, поки не забув. Батьки, мабуть, уже чекають біля воза.',True),
 page(N,'На карте теперь доступен путь к повозке — «Продолжить поездку». Можно ещё задержаться во дворах.','На мапі тепер доступний шлях до воза — «Продовжити поїздку». Можна ще затриматися у дворах.')],scene='scene-evan-v25-engineering')
 node('depart','Перед отъездом','Перед від’їздом',[
 page(F,'Ну, насмотрелся? Нам ещё нужно заехать по делам, пока лавки открыты.','Ну, надивився? Нам ще треба заїхати у справах, поки крамниці відчинені.'),
 page(H,'Не совсем. Но я теперь знаю, о чём хочу подумать дома. Можно я всю дорогу буду записывать?','Не зовсім. Але тепер я знаю, про що хочу подумати вдома. Можна я всю дорогу записуватиму?'),
 page(M,'Только не на коленке. Опять весь лист измажешь на ухабах.','Тільки не на коліні. Знову весь аркуш замажеш на вибоїнах.')],
 [link('evening','Продолжить поездку','Продовжити поїздку',sceneId=ROOM),link('linger','Ещё немного осмотрюсь','Ще трохи роздивлюся')],scene=DEPART)
 node('linger','Ещё немного времени','Ще трохи часу',[page(F,'Хорошо. Только недолго. Мы здесь.','Гаразд. Тільки недовго. Ми тут.')],scene=DEPART,openTravelMap='evan-university-booklet')
 node('evening','То, что хочется сохранить','Те, що хочеться зберегти',[
 page(N,'Дома уже стемнело. На столе лежит университетский буклет. Эван разворачивает рядом чистый лист.','Удома вже стемніло. На столі лежить університетський буклет. Еван розгортає поруч чистий аркуш.'),
 page(H,'Я хотел показать им тележку. А мне показали, сколько ещё она может делать. Даже если у неё вообще не будет колёс.','Я хотів показати їм візок. А мені показали, скільки ще він може робити. Навіть якщо в нього взагалі не буде коліс.',True),
 page(H,'Не надо сразу строить весь станок. Надо сделать одну часть так, чтобы остальные могли на неё положиться.','Не треба відразу будувати весь верстат. Треба зробити одну частину так, щоб решта могли на неї покластися.',True)], [link('thoughts','Обдумать сегодняшний день','Обміркувати сьогоднішній день')])
 node('thoughts','Что запомнилось','Що запам’яталося',[page(H,'С чего начать записи? Пока всё ещё держится в голове.','З чого почати записи? Поки все ще тримається в голові.',True)], [link('thought-engineering','Разговор с преподавателем','Розмова з викладачем'),link('thought-magic','Магический двор','Магічне подвір’я'),link('thought-military','Художник у военного корпуса','Художник біля військового корпусу'),link('thought-botany','Люди у грядок','Люди біля грядок'),link('choose','Выбрать, куда подавать документы','Обрати, куди подавати документи')])
 thoughts=[('engineering','Он не сказал: «Подрастёшь — разберёшься». Спросил, что уже работает. И подождал, пока я отвечу.','Він не сказав: «Підростеш — розберешся». Запитав, що вже працює. І почекав, поки я відповім.'),('magic','Там все такие разные. Хочется когда-нибудь стоять рядом и понимать, о чём они спорят. А потом и самому что-то предложить.','Там усі такі різні. Хочеться колись стояти поруч і розуміти, про що вони сперечаються. А потім і самому щось запропонувати.'),('military','Художник попал не туда, куда собирался. Но рисунки не бросил. Интересно, я бы сумел так?','Художник потрапив не туди, куди збирався. Але малюнків не покинув. Цікаво, я б так зміг?'),('botany','Помню таблички у растений. И грязь поверх букв. Не хочу, чтобы из-за этих двоих я забыл всё остальное.','Пам’ятаю таблички біля рослин. І бруд поверх літер. Не хочу, щоб через тих двох я забув усе інше.')]
 for id,ru,uk in thoughts:node('thought-'+id,'Запись на полях','Запис на полях',[page(H,ru,uk,True)],[link('thoughts','Подумать о другом','Подумати про інше'),link('choose','Перейти к заявкам','Перейти до заяв')])
 faculties=[('engineering','Инженерия','Інженерія'),('magic','Магия','Магія'),('botany','Естествознание','Природознавство'),('military','Военное дело','Військова справа')]
 node('choose','Две заявки','Дві заяви',[page(H,'Выберу два корпуса. Для каждого подготовлю работу, а не просто перепишу имя на другом листе.','Оберу два корпуси. Для кожного підготую роботу, а не просто перепишу ім’я на іншому аркуші.',True)], [link('second-'+id,ru,uk) for id,ru,uk in faculties])
 for id,ru,uk in faculties:
  node('second-'+id,'Второе направление','Другий напрям',[page(H,'Первое направление: '+ru+'. А куда подать вторую заявку?','Перший напрям: '+uk+'. А куди подати другу заяву?',True)], [link('pair-'+'-'.join(sorted([id,j])),r,u) for j,r,u in faculties if j!=id]+[link('choose','Выбрать заново','Обрати заново')])
 for a,b in itertools.combinations(faculties,2):
  key='-'.join(sorted([a[0],b[0]]))
  node('pair-'+key,'Мой выбор','Мій вибір',[page(H,a[1]+' и '+b[1]+'. Да, хочу попробовать оба направления.',a[2]+' та '+b[2]+'. Так, хочу спробувати обидва напрями.',True)], [link('guild','Оставить эти два','Залишити ці два',effect=P+'applied-'+key),link('choose','Передумать','Передумати')])
 node('guild','Ещё одна возможность','Ще одна можливість',[page(H,'Можно ещё попроситься учеником в гильдию мастеров. Там учатся за работой. Но на всё сразу тоже нужны силы.','Можна ще попроситися учнем до гільдії майстрів. Там навчаються за роботою. Але на все одразу теж потрібні сили.',True)], [link('guild-yes','Подготовить и заявку в гильдию','Підготувати й заяву до гільдії',effect=P+'guild-applied'),link('guild-no','Сосредоточиться на двух корпусах','Зосередитися на двох корпусах',effect=P+'guild-skipped')])
 node('guild-yes','В мастерскую','До майстерні',[page(H,'Добавлю письмо в гильдию. Спрошу, возьмут ли меня учиться и работать с мастером.','Додам листа до гільдії. Запитаю, чи візьмуть мене вчитися й працювати з майстром.',True)],[link('plans')])
 node('guild-no','Начать с этого','Почати з цього',[page(H,'Пока хватит двух. Лучше подготовиться как следует.','Поки вистачить двох. Краще підготуватися як слід.',True)],[link('plans')])
 node('plans','Работа впереди','Робота попереду',[page(H,'Завтра перерисую узел крупнее. Потом проверю, не застревает ли штырёк. И запишу, где ошибся.','Завтра перемалюю вузол більшим. Потім перевірю, чи не застрягає кілочок. І запишу, де помилився.',True),page(H,'Хочу вернуться туда уже с ответом. Пусть маленьким. Зато своим.','Хочу повернутися туди вже з відповіддю. Нехай маленькою. Зате своєю.',True)], [link('results','Закончить записи','Закінчити записи',sceneId=RESULTS)])
 node('results','Пришли ответы','Надійшли відповіді',[
 page(N,'За месяц листы успели обрасти исправлениями. Сегодня родители зовут Эвана поговорить об ответах.','За місяць аркуші встигли обрости виправленнями. Сьогодні батьки кличуть Евана поговорити про відповіді.'),
 page(F,'Пришли ответы из университета. К сожалению, в оба корпуса тебя не приняли.','Надійшли відповіді з університету. На жаль, до обох корпусів тебе не прийняли.'),
 page(H,'В оба?.. А что написали про работу?','До обох?.. А що написали про роботу?'),
 page(M,'Ты очень старался. Мы это видели. Не надо сейчас себя мучить.','Ти дуже старався. Ми це бачили. Не треба зараз себе мучити.')], [link('letters','Можно посмотреть ответы?','Можна подивитися відповіді?'),link('guild-result','А что ответили из гильдии?','А що відповіли з гільдії?',requires=P+'guild-applied')],scene=RESULTS)
 node('guild-result','Ответ гильдии','Відповідь гільдії',[page(F,'Там тоже не получилось. Но мы уже нашли другую возможность.','Там теж не вийшло. Але ми вже знайшли іншу можливість.'),page(H,'Подожди. Я хочу сначала сам прочитать.','Зачекай. Я хочу спочатку сам прочитати.')],[link('letters')],scene=RESULTS)
 node('letters','Дайте прочитать','Дайте прочитати',[
 page(H,'Если они объяснили, что не так, я смогу переделать. Покажите мне письма.','Якщо вони пояснили, що не так, я зможу переробити. Покажіть мені листи.'),
 page(F,'Не стоит цепляться за каждую строчку. От этого ответ не изменится.','Не варто чіплятися за кожен рядок. Від цього відповідь не зміниться.'),
 page(H,'Я не прошу его менять. Я прошу прочитать.','Я не прошу її змінювати. Я прошу прочитати.'),
 page(M,'Еван, пожалуйста. Давай не будем снова об этом. Мы ведь хотим тебе помочь.','Еване, будь ласка. Давай не будемо знову про це. Ми ж хочемо тобі допомогти.')], [link('other-place')],scene=RESULTS)
 node('other-place','Решение уже принято','Рішення вже ухвалене',[
 page(F,'Зато тебя готовы принять в другом месте. Мы поговорили с людьми из аббатства. Там такие, как ты, очень нужны.','Натомість тебе готові прийняти в іншому місці. Ми поговорили з людьми з абатства. Там такі, як ти, дуже потрібні.'),
 page(H,'Такие — это какие?','Такі — це які?'),
 page(F,'Способные. С руками, с головой. Там будет дело, порядок. И люди, на которых можно положиться.','Здібні. З руками, з головою. Там буде справа, порядок. І люди, на яких можна покластися.'),
 page(M,'Ты не останешься один. Мы обо всём позаботились.','Ти не залишишся сам. Ми про все подбали.'),
 page(H,'Но я ещё не решил.','Але я ще не вирішив.'),
 page(F,'Мы уже договорились.','Ми вже домовилися.')], [link('end')],scene=RESULTS)
 node('end','Не своей волей','Не своєю волею',[page(N,'Эван смотрит на свои записи. На полях всё ещё стоит вопрос, который он собирался задать преподавателю.','Еван дивиться на свої записи. На полях усе ще стоїть запитання, яке він збирався поставити викладачеві.'),page(N,'Конец первого эпизода.','Кінець першого епізоду.')],scene=RESULTS,complete=True)
 # Copy scenery, never old interactive content or morning triggers.
 def clone_scene(src,id,ru,uk,entry,fade=None,room=False):
  r=copy.deepcopy(next(r for r in e['scenes'] if r['id']==src));r.update(id=id,name=ru,nameUk=uk);s=r['scene'];s.update(name=ru,nameUk=uk);st=s['story'];st['wagonRide']=False;st['zones']=[z for z in st.get('zones',[]) if z.get('blocked') or z.get('occlusion')];st['firstVisitDialogueId']=P+entry
  for k in ['ambience','ambienceGroup']:st[k]=''
  st.pop('arrivalFade',None)
  if fade:st['arrivalFade']=dict(color='black',text=fade[0],textUk=fade[1],holdSeconds=2.8)
  if room:
   s['tokens']=[t for t in s['tokens'] if t['id']==e['heroTokenId']];s['layers'][0]['image']=ART
  else:
   for t in s['tokens']:
    if t['id']!=e['heroTokenId']:
     t['id']=P+t['id'];t.pop('entryId',None);e['interactions'][t['id']]=dict(entryId=P+'depart',marker='?',markerVisible=True)
  e['scenes'].append(r);return r
 clone_scene('scene-evan-wagon-riverside-arrival',DEPART,'Повозка · перед отъездом','Віз · перед від’їздом','depart')
 clone_scene('scene-mu7f8nxa',ROOM,'Комната · вечер','Кімната · вечір','evening',('Несколько часов спустя','Кілька годин потому'),True)
 result=clone_scene('scene-mu7f8nxa',RESULTS,'Комната · месяц спустя','Кімната · місяць потому','results',('Месяц спустя','Місяць потому'),True)
 # Parents are present for the final conversation.
 wagon=next(r['scene'] for r in e['scenes'] if r['id']=='scene-evan-wagon-riverside-arrival')
 for t in wagon['tokens']:
  if t.get('speaker') in [F,M]:
   t=copy.deepcopy(t);t.update(id=P+'results-'+t['id'],x=45 if t['speaker']==F else 55,y=53,size=64);result['scene']['tokens'].append(t)
 # A verbal route makes the key lesson reachable even when the folder was left at home.
 lesson=next(n for n in e['nodes'] if n['id']=='evan-campus-aspiration-lesson');fallback=copy.deepcopy(lesson);fallback['id']=P+'lesson-without-folder';fallback['title']='Объяснить идею';fallback['titleUk']='Пояснити ідею'
 intro=page(H,'Я не взял рисунки. Можно объяснить? Хочу, чтобы переставные штырьки на барабане задавали тележке путь.','Я не взяв малюнки. Можна пояснити? Хочу, щоб переставні кілочки на барабані задавали візку шлях.')
 fallback.update(intro);fallback['slides']=[page('evan-engineering-professor','Расскажи. Что штырьки будут двигать?','Розкажи. Що кілочки рухатимуть?'),page(H,'Рычаг поворота. Только я пока не разобрался, что будет крутить сам барабан.','Важіль повороту. Тільки я поки не розібрався, що крутитиме сам барабан.')]+copy.deepcopy(lesson['slides'][4:]);e['nodes'].append(fallback)
 hello=next(n for n in e['nodes'] if n['id']=='evan-campus-aspiration-hello');hello['links'].insert(1,link('lesson-without-folder','Рассказать идею без рисунков','Розповісти ідею без малюнків',requiresNoItemId='evan-draft-folder'))
 milestones=[('evan-military-artist-study','evan-campus-artist-finished','Поговорить с художником у военного корпуса','Поговорити з художником біля військового корпусу'),('evan-campus-aspiration-lesson','evan-campus-aspiration-learned','Обсудить свою идею с преподавателем инженерии','Обговорити свою ідею з викладачем інженерії'),('evan-campus-aspiration-first-magic','evan-campus-magic-seen','Осмотреть магический двор','Оглянути магічне подвір’я'),('evan-abbey-after','evan-abbey-encounter-finished','Осмотреть двор естествознания и поговорить у грядок','Оглянути подвір’я природознавства й поговорити біля грядок')]
 for id,flag,_,_ in milestones:
  n=next(n for n in e['nodes'] if n['id']==id);assert n.get('afterEffect',flag)==flag;n['afterEffect']=flag
 q=next(q for q in e['quests'] if q['id']=='evan-v25-campus');q.update(objective='Осмотреть четыре корпуса и познакомиться с людьми во дворах.',objectiveUk='Оглянути чотири корпуси й познайомитися з людьми у дворах.',dialogueId=P+'ready',nextId=P+'departure-quest',flag=P+'can-depart',milestones=[dict(id=P+'campus-complete',nodeId=P+'ready',requiresFlags=[m[1] for m in milestones],minCompleted=0,dialogueIds=[])])
 e['quests'].append(dict(id=P+'campus-checklist',kind='side',title='Знакомство с корпусами',titleUk='Знайомство з корпусами',startNodeId='evan-v25-arrival',steps=[dict(id=P+'step-'+str(i),nodeId=m[0],nodeIds=[m[0]]+([fallback['id']] if i==1 else []),label=m[2],labelUk=m[3]) for i,m in enumerate(milestones)],endNodeIds=[m[0] for m in milestones]+[fallback['id']]))
 for id,ru,uk,obj,obuk,done,nxt in [('departure-quest','Дальше по дороге','Далі дорогою','Вернуться к повозке через карту в сумке.','Повернутися до воза через мапу в сумці.','depart','plans-quest'),('plans-quest','Свой выбор','Власний вибір','Обдумать день и выбрать, куда подать заявки.','Обміркувати день і обрати, куди подати заяви.','plans','answers-quest'),('answers-quest','Пришли ответы','Надійшли відповіді','Выслушать родителей.','Вислухати батьків.','end','')]:
  e['quests'].append(dict(id=P+id,title=ru,titleUk=uk,objective=obj,objectiveUk=obuk,dialogueId=P+done,nextId=P+nxt if nxt else '',actions=[]))
 item=next(i for i in e['storyItems'] if i['itemId']=='evan-university-booklet');tm=item['travelMap'];tm['allowedScenes'].append(DEPART);tm['destinations'].append(dict(id=P+'return',name='Продолжить поездку',nameUk='Продовжити поїздку',sceneId=DEPART,entryId=P+'depart',requires=P+'can-depart',x=42,y=84,width=16,height=14))
 # Only these old records may change, and only for progression/access.
 allowed={'evan-campus-aspiration-hello',*[m[0] for m in milestones]}
 for n in e['nodes']:
  if n['id'] in original and n['id'] not in allowed:assert n==original[n['id']],n['id']
 assert e['minigames']==source['minigames'] and e['speakers']==source['speakers']
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
