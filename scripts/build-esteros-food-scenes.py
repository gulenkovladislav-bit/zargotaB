"""Build the RU/UK food-search additions from a preserved episode snapshot."""
import copy, json, pathlib, re, argparse
parser=argparse.ArgumentParser();parser.add_argument('--overwrite-initial-draft',action='store_true');parser.add_argument('--source');parser.add_argument('--apply-file');args=parser.parse_args()

ROOT = pathlib.Path(__file__).resolve().parents[1]
if (ROOT/'story-content/esteros/episode-1-food-search-v1.json').exists() and not args.overwrite_initial_draft:
    parser.error('Historical initial generator: current episode has later author and minigame edits. Use a fresh exchange snapshot and a targeted repair; --overwrite-initial-draft explicitly opts into rebuilding the old draft.')
read = lambda p: json.loads((ROOT / p).read_text())
clone = copy.deepcopy
doc = read(args.source or 'story-content/esteros/episode-1-mothers-map-v1.json')
e = doc['episode']
shore = e['activeSceneId']
hero = e['heroTokenId']
speaker = 'esteros-child-thoughts'
prefix = 'food-'
scene_ids = {k: 'scene-esteros-food-' + k for k in ('backwater', 'roots', 'channel')}
asset = 'assets/stories/backgrounds/esteros-food-v1/'
e.setdefault('presentation',{})['esterosResolve']={'enabled':True,'initialHope':3,'hitTime':4.27}
e['interactions'] = e.get('interactions', {})

e['quests'] = [
 dict(id='food-search', startSceneId=shore, title='Выжить', titleUk='Вижити', objective='Раздобыть еды. Осмотреть ближайшие места на маминой карте.', objectiveUk='Здобути їжу. Оглянути найближчі місця на маминій мапі.', dialogueIds=['food-roots-take','food-eggs-take'], nextId='food-return', flag='food-found'),
 dict(id='food-return', title='Выжить', titleUk='Вижити', objective='Вернуться к береговой тропе с припасом.', objectiveUk='Повернутися до берегової стежки з припасом.', dialogueId='food-home', flag='food-draft-finished')
]

def node(key, ru, uk, pages=(), **extra):
    n=dict(id=prefix+key, kind='dialogue', title=ru[:45], titleUk=uk[:45], speaker=speaker,
           text=ru, textUk=uk, showPortrait=True, emotion='map-sad', textSpeed=43,
           imageMotion='none', branchOverride=True, editorSceneId=shore,
           x=600+(len(e['nodes'])%5)*300, y=400+(len(e['nodes'])//5)*180, links=[])
    if pages:n['slides']=[dict(text=a,textUk=b,showPortrait=True,emotion='map-sad') for a,b in pages]
    n.update(extra); e['nodes'].append(n); return n

def link(n, key, ru='', uk='', **extra):
    n['links'].append(dict(id=n['id']+'-'+str(len(n['links'])),to=prefix+key if key else '',label=ru,labelUk=uk,**extra))

def point(scene, key, name, name_uk, xy, entry):
    scene['tokens'].append(dict(id='food-point-'+key,type='note',name=name,nameUk=name_uk,x=xy[0],y=xy[1],size=32,markerSize=22,entryId=prefix+entry,visible=True,opacity=1))

def repeat(n, flag, destination):
    n['repeatRoutes']=[dict(requires=flag,to=prefix+destination)]

def reward(n, item):
    n['resolveEvent']={'id':'esteros-provisions-for-home','type':'hope'}
    n['afterEffect']=item+'-taken'
    n['afterWorldActions']=[dict(type='giveItem',itemId=item,qty=1,actionId=item+'-once')]
    repeat(n,item+'-taken','already')

shore_scene=next(r['scene'] for r in e['scenes'] if r['id']==shore)
# Keep the project's authored portrait token in every walkable scene.
hero_template=clone(next(t for t in shore_scene['tokens'] if t['id']==hero))
point(shore_scene,'water','Набрать воды','Набрати води',(47,49),'water')
point(shore_scene,'path','Тропа к деревне','Стежка до села',(50,89),'path')
n=node('water','За водой пришёл. А опять сижу и смотрю на камни.','По воду прийшов. А знову сиджу й дивлюся на каміння.',[
 ('Вода в котелке кажется темнее речной. Закрою крышкой. Дома надо будет вскипятить.','Вода в казанку здається темнішою за річкову. Накрию кришкою. Удома треба буде закип’ятити.'),
 ('Теперь еда. Мама спросит, ел ли я. Надо, чтобы сегодня можно было ответить сразу.','Тепер їжа. Мама спитає, чи я їв. Треба, щоб сьогодні можна було відповісти одразу.')], afterEffect='food-water-filled',openTravelMap='esteros-mothers-map')
repeat(n,'food-water-filled','water-repeat')
node('water-repeat','Крышка держится. Воду я уже набрал.','Кришка тримається. Воду я вже набрав.')
n=node('plan','В деревнях сейчас едва хватает своим. А там, где лихорадка, и двери не открывают.','У селах зараз ледь вистачає своїм. А там, де гарячка, й дверей не відчиняють.',[
 ('За излучиной есть затон. На кочке у старой ивы ещё могли остаться корни. Дальше — узкая протока.','За закрутом є затон. На купині біля старої верби ще могли лишитися корені. Далі — вузька протока.'),
 ('Все три места близко. Только на маминой карте между ними сухая бумага.','Усі три місця близько. Тільки на маминій мапі між ними сухий папір.')],afterEffect='food-planned')
memory=next(n for n in e['nodes'] if n['id']=='esteros-map-memory')
memory['links']=[dict(id='food-after-map-memory',to='food-plan',label='',labelUk='')]
n=node('path','С пустыми руками идти не хочется. Посмотрю мамину карту.','З порожніми руками йти не хочеться. Подивлюся мамину мапу.',openTravelMap='esteros-mothers-map')
repeat(n,'food-found','home')
node('home','Припас есть. Немного, но есть. Можно идти домой.','Припас є. Небагато, але є. Можна йти додому.',[
 ('До деревни знакомая тропа. Сегодня я хотя бы не буду считать шаги, чтобы не думать о голоде.','До села знайома стежка. Сьогодні я хоча б не рахуватиму кроки, щоб не думати про голод.')],complete=True)
node('already','Здесь я уже всё собрал. Второй раз больше не станет.','Тут я вже все зібрав. Удруге більше не стане.')

specs={
 'backwater':('Глухой затон','Глухий затон',[(45,97),(55,97),(64,78),(71,62),(80,42),(85,27),(77,25),(70,41),(60,56),(45,61),(35,58),(28,64),(41,81)],(50,89)),
 'roots':('Корневая кочка','Коренева купина',[(46,97),(55,97),(63,79),(79,65),(78,54),(64,43),(48,35),(27,34),(21,49),(28,65),(42,78)],(50,87)),
 'channel':('Змеиная протока','Зміїна протока',[(44,97),(56,97),(66,76),(73,63),(71,53),(59,46),(43,30),(31,26),(23,35),(23,53),(36,72)],(50,88))
}
for key,(ru,uk,poly,spawn) in specs.items():
    s=dict(name=ru,nameUk=uk,boardWidth=24,boardHeight=16,gridSize=64,
      layers=[dict(id='food-bg-'+key,image=asset+key+('-v2.png' if key=='backwater' else '.png'),visible=True,opacity=1,fit='cover')],
      tokens=[dict(hero_template,x=spawn[0],y=spawn[1],visible=True,opacity=1)],
      story=dict(spawnX=spawn[0],spawnY=spawn[1],walkable=poly,cameraZoom=1,movementSpeed=1,
        firstVisitDialogueId=prefix+key+'-arrival',blockedMessage='Вода и вязкий ил. Лучше держаться суши.',blockedMessageUk='Вода й в’язкий мул. Краще триматися суші.'))
    e['scenes'].append(dict(id=scene_ids[key],name=ru,nameUk=uk,scene=s))
    point(s,key+'-exit','Обратно к карте','Назад до мапи',(50,92),'map')
    specs[key]=s
node('map','Сверюсь с картой.','Звірюся з мапою.',openTravelMap='esteros-mothers-map')

node('backwater-arrival','Следы колёс. Кто-то проехал сюда совсем недавно.','Сліди коліс. Хтось проїхав сюди зовсім недавно.',editorSceneId=scene_ids['backwater'])
point(specs['backwater'],'tracks','Следы в грязи','Сліди в багнюці',(57,65),'tracks')
node('tracks','Колёса провалились глубоко. Везли что-то тяжёлое.','Колеса провалилися глибоко. Везли щось важке.',editorSceneId=scene_ids['backwater'])
point(specs['backwater'],'cart','Повозка','Віз',(77,31),'cart')
n=node('cart','В воде лежат люди. Одежда облепила спины. Один уткнулся лицом в тину.','У воді лежать люди. Одяг обліпив спини. Один уткнувся обличчям у баговиння.',[
 ('Двое. А на повозке ещё осталось место.','Двоє. А на возі ще лишилося місце.'),
 ('Мухи садятся на ткань и сразу взлетают. Больше здесь никто не шевелится.','Мухи сідають на тканину й одразу злітають. Більше тут ніхто не ворушиться.'),
 ('Не знаю, от чего они умерли. И узнавать не у кого.','Не знаю, від чого вони померли. І спитати ні в кого.')],afterEffect='food-cart-seen',resolveEvent={'id':'esteros-abandoned-bodies','type':'fatalism'},sound='assets/stories/audio/esteros/flies-draft.wav',editorSceneId=scene_ids['backwater'])
repeat(n,'food-cart-seen','cart-repeat')
node('cart-repeat','Я всё ещё слышу мух. Пора отсюда.','Я досі чую мух. Час звідси йти.')
point(specs['backwater'],'bad-roots','Корни у воды','Корені біля води',(35,63),'bad-roots')
node('bad-roots','Корни в воде. От повозки сюда тянется мутный ручеёк.','Корені у воді. Від воза сюди тягнеться каламутний струмочок.',[
 ('Не возьму. Лучше ещё пройти, чем принести это домой.','Не візьму. Краще ще пройти, ніж принести це додому.')],editorSceneId=scene_ids['backwater'])

node('roots-arrival','Здесь суше. Кто-то уже копал — земля не успела осесть.','Тут сухіше. Хтось уже копав — земля не встигла осісти.',editorSceneId=scene_ids['roots'])
point(specs['roots'],'empty','Раскопанная земля','Розкопана земля',(29,49),'empty')
node('empty','Одни обрывки. Даже мелкие выбрали.','Самі обривки. Навіть дрібні вибрали.',[
 ('Кто-то тоже хотел успеть раньше других. И успел раньше меня.','Хтось теж хотів устигнути раніше за інших. І встиг раніше за мене.')],editorSceneId=scene_ids['roots'])
point(specs['roots'],'rotten','Потемневшие корни','Потемнілі корені',(49,43),'rotten')
node('rotten','Снаружи крепкий. Нажал — пальцы провалились.','Зовні міцний. Натиснув — пальці провалилися.',[
 ('Придётся вытереть руку о траву. На рукаве уже сухого места нет.','Доведеться витерти руку об траву. На рукаві вже сухого місця немає.')],editorSceneId=scene_ids['roots'])
point(specs['roots'],'good','Корни в плотной земле','Корені в щільній землі',(70,58),'roots-find')
n=node('roots-find','Эти ещё держатся. Земля вокруг твёрдая — пальцами не взять.','Ці ще тримаються. Земля навколо тверда — пальцями не взяти.',editorSceneId=scene_ids['roots'])
link(n,'roots-work','Разрыхлить землю обломком ветки','Розпушити землю уламком гілки')
link(n,'leave','Пока оставить','Поки залишити')
repeat(n,'esteros-food-roots-taken','already')
node('leave','Можно вернуться. Пока ещё светло.','Можна повернутися. Поки ще видно.')
n=node('roots-work','Ветка гнётся. Ещё немного… Только не сломайся.','Гілка гнеться. Ще трохи… Тільки не зламайся.',[
 ('Ком земли наконец отходит. В нём три небольших корня.','Грудка землі нарешті відходить. У ній три невеличкі корені.')])
link(n,'roots-take')
n=node('roots-take','Три. Хотелось бы больше. Но если мелко нарезать, хватит на похлёбку.','Три. Хотілося б більше. Та якщо дрібно нарізати, вистачить на юшку.',[
 ('Заверну. Маме отдам тот, что покрупнее.','Загорну. Мамі віддам той, що більший.')]);reward(n,'esteros-food-roots')

node('channel-arrival','Под корнями гнездо. Отсюда не видно, пустое ли.','Під корінням гніздо. Звідси не видно, чи порожнє.',editorSceneId=scene_ids['channel'])
point(specs['channel'],'nest','Гнездо под корнями','Гніздо під корінням',(69,55),'nest')
n=node('nest','Яйца. И змея рядом — почти одного цвета с корой.','Яйця. І змія поруч — майже одного кольору з корою.',[
 ('Руку туда не суну. Пока она здесь, лучше подождать.','Руку туди не суну. Поки вона тут, краще зачекати.')],editorSceneId=scene_ids['channel'])
repeat(n,'esteros-food-eggs-taken','already')
link(n,'snake-wait','Затаиться и подождать','Завмерти й зачекати')
link(n,'leave','Отойти от корней','Відійти від коріння')
n=node('snake-wait','Нога затекла. Змея всё ещё лежит.','Нога затерпла. Змія досі лежить.',[
 ('Потом по корню проходит тонкая тень. Она уходит в камыш.','Потім коренем проходить тонка тінь. Вона йде в очерет.'),
 ('Из темноты под ивой ничего не видно. Может, там есть ещё одна.','У темряві під вербою нічого не видно. Може, там є ще одна.')])
link(n,'eggs-take','Рискнуть и забрать яйца','Ризикнути й забрати яйця')
link(n,'leave','Не рисковать. Поискать в другом месте','Не ризикувати. Пошукати в іншому місці')
n=node('eggs-take','Два яйца в ладони. Третье треснуло.','Два яйця в долоні. Третє тріснуло.',[
 ('Я уже отошёл от корней, а плечи всё ещё подняты. Можно выдохнуть.','Я вже відійшов від коріння, а плечі досі підняті. Можна видихнути.')]);reward(n,'esteros-food-eggs')

e['storyItems'].extend([
 dict(itemId='esteros-food-roots',name='Болотные корни',nameUk='Болотні корені',description='Три небольших корня, добытых на сухой кочке. Скудный припас для дома.',descriptionUk='Три невеликі корені, знайдені на сухій купині. Мізерний припас для дому.',image='assets/stories/items/esteros/marsh-roots.png',qty=1,stackable=False),
 dict(itemId='esteros-food-eggs',name='Два болотных яйца',nameUk='Два болотні яйця',description='Два целых яйца из гнезда у протоки.',descriptionUk='Два цілих яйця з гнізда біля протоки.',qty=1,stackable=False)
])
# Inspecting a location keeps the map open. Choosing to go there is a scene transition.
map_item=next(i for i in e['storyItems'] if i['itemId']=='esteros-mothers-map')
map_item['travelMap']['refreshOnFlags']=True
for key,xy in [('backwater',(21,29)),('roots',(23,20)),('channel',(29,25))]:
    s=specs[key]
    n=node('map-'+key,'Здесь '+s['name'].lower()+'. Можно попробовать поискать еду.','Тут '+s['nameUk'].lower()+'. Можна спробувати пошукати їжу.')
    link(n,key+'-arrival','Пойти туда','Піти туди',sceneId=scene_ids[key])
    link(n,'map-stay','Остаться у карты','Залишитися біля мапи')
    map_item['travelMap']['destinations'].append(dict(id='food-'+key,name=s['name'],nameUk=s['nameUk'],nodeId=n['id'],x=xy[0],y=xy[1],width=7,height=6,requires='food-planned'))
node('map-stay','Посмотрю ещё.','Подивлюся ще.')
n=node('map-shore','Отсюда знакомая дорога домой.','Звідси знайома дорога додому.')
link(n,'shore-return','Вернуться на берег','Повернутися на берег',sceneId=shore)
link(n,'map-stay','Остаться у карты','Залишитися біля мапи')
node('shore-return','Снова опоры. Теперь надо идти по тропе.','Знову опори. Тепер треба йти стежкою.')
map_item['travelMap']['destinations'].append(dict(id='food-shore',name='Береговая тропа',nameUk='Берегова стежка',nodeId='food-map-shore',x=16,y=20,width=6,height=6,requires='food-planned'))
for i,item in enumerate(e['player']['inventoryItems']):
    if item['itemId']=='esteros-mothers-map':e['player']['inventoryItems'][i]=clone(map_item)
e['scene']=clone(shore_scene)
from esteros_episode_repairs import repair
repair(e)
out=ROOT/'story-content/esteros/episode-1-food-search-v1.json'
out.write_text(json.dumps({'format':'zargota-story','version':1,'episode':e},ensure_ascii=False,indent=2)+'\n')
if args.apply_file:(ROOT/args.apply_file).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
preview=ROOT/'output/esteros-food-scenes-v1'
preview.mkdir(parents=True,exist_ok=True)
(preview/'episode.js').write_text('window.ESTEROS_FOOD_EPISODE='+json.dumps(e,ensure_ascii=False)+';\n')
print(out)
