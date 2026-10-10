"""Guarded additive update of the author's latest episode; originals stay untouched."""
import json,sys,copy
from pathlib import Path
src,out=map(Path,sys.argv[1:]); data=json.loads(src.read_text()); e=data['episode']; original=copy.deepcopy(e); nodes=e['nodes']; by={n['id']:n for n in nodes}
h=e['playerSpeakerId']; m='evan-yard-milo'; g='evan-shelter-girl'; f='evan-port-feltser'; pen='evan-port-pen'; l='evan-friend-lida'; tar='evan-friend-tarin'; mom='speaker-1789799703305'; yard='scene-evan-green-courtyard'; street='scene-mu7f8tk1-6m4a'; departure='scene-evan-v25-departure'; ended='evan-card-table-finished'; locked='evan-courtyard-locked'
assert g not in e['speakers'], 'Already updated'
names=[('neutral','Обычная','Звичайна'),('speaking','Говорит','Говорить'),('skeptical','Недоверие','Недовіра'),('angry','Злость','Злість'),('ironic','Ирония','Іронія')]
e['speakers'][g]={'name':'Тесс','nameUk':'Тесс','portrait':'assets/stories/Evan/portraits/shelter-girl-neutral-v2.png','emotions':{key:{'name':ru,'nameUk':uk,'portrait':f'assets/stories/Evan/portraits/shelter-girl-{key}-v2.png'} for key,ru,uk in names}}
def page(s,ru,uk,emotion='speaking'):
 if s==h:emotion='emotion-1789852989293'
 return dict(speaker=s,text=ru,textUk=uk,emotion=emotion,showPortrait=True)
def link(id,to,ru,uk,**kw):return dict(id=id,to=to,label=ru,labelUk=uk,**kw)
def node(id,ru,uk,pages,links=None,scene=yard,**kw):
 assert id not in by
 n=dict(id=id,kind='choice' if links else 'dialogue',title=ru,titleUk=uk,editorSceneId=scene,x=4600+(len(nodes)%4)*420,y=11000+(len(nodes)//4)*240,**pages[0],slides=pages[1:],links=links or [],**kw);nodes.append(n);by[id]=n;return n
node('milo-farewell-table','За Мило пришли','По Мило прийшли',[
 page(g,'Мило. Вот ты где. Вставай, пойдём.','Мило. Ось ти де. Вставай, ходімо.','angry'),
 page(m,'Я… играл.','Я… грав.'),
 page(g,'Вижу, блять. А вы чего уставились? Тряпки вонючие. Нашли себе развлечение?','Бачу, блять. А ви чого витріщилися? Ганчірки смердючі. Знайшли собі розвагу?','angry'),
 page(f,'Ты вообще кто такая?','Ти взагалі хто така?','surprised'),
 page(g,'Та, которая его отсюда забирает. Ещё раз полезете к нему — пожалеете.','Та, яка його звідси забирає. Ще раз полізете до нього — пошкодуєте.','angry'),
 page(m,'Камни… заберу.','Камінці… заберу.'),
 page(g,'Забери. И идём. А вы идите нахуй со своей колодой.','Забери. І ходімо. А ви йдіть нахуй зі своєю колодою.','angry'),
 page(pen,'Чего это она? Мы её даже не звали.','Чого це вона? Ми її навіть не кликали.','surprised'),
 page(tar,'Лида, ты её знаешь?','Лідо, ти її знаєш?','speaking'),
 page(l,'Знаю. Это Тесс. Она за приютом присматривает. За Мило и остальными — сама.','Знаю. Це Тесс. Вона за притулком доглядає. За Мило й рештою — сама.'),
 page(l,'Ей тяжело досталось. Только расспрашивать её сейчас не надо.','Їй тяжко дісталося. Тільки розпитувати її зараз не треба.'),
])
e['minigames']['towerClaw'].update(farewellNodeId='milo-farewell-table',singleSession=True,finishedFlag=ended)
for n in nodes:
 if n.get('cardEvent',{}).get('once') is not False and n.get('cardEvent'):n['cardEvent']['oncePerEpisode']=True
# Keep authored pages unchanged; only the exit routes requested by the author change.
by['evan-yard-finish']['links']=[link('farewell-leave-yard','evan-v25-depart','Закончить игру и попрощаться','Закінчити гру й попрощатися')]
for n in nodes:
 for a in n.get('links',[]):
  if a.get('exchangeTakeId')=='evan-silver-coin':a['effect']=locked
  if a.get('to') in ['evan-exchange-leave','evan-v21-decline']:a['unless']=locked
  if a.get('to') in ['evan-port-at-circle','evan-v21-lida','evan-v21-silver']:
   # Existing Lida conditions remain; these upstream nodes redirect once the table closes.
   pass
# The initial silver conversation must always offer the first exchange before play.
for a in by['evan-v21-silver']['links']:
 if a.get('to')=='evan-exchange-leave':a['unless']=ended
for a in by['evan-exchange-leave']['links']:
 if a.get('id')=='v21-8':a['sceneId']=street
for id in ['evan-yard-greet','evan-exchange-back','evan-port-at-circle','evan-port-wait','evan-port-stake','evan-v21-lida']:
 n=by[id]
 n.setdefault('repeatRoutes',[]).insert(0,{'requires':ended,'to':'evan-yard-finish'})
# An explicit courtyard exit checks the lock; the finished route goes to the wagon scene.
node('milo-yard-exit','У калитки','Біля хвіртки',[page(h,'Сначала закончу здесь.','Спершу закінчу тут.')],[link('yard-exit-street','','Выйти на улицу','Вийти на вулицю',sceneId=street,unless=locked),link('yard-exit-wagon','evan-v25-depart','Пойти к повозке','Піти до повозки',requires=ended)],repeatRoutes=[{'requires':ended,'to':'evan-v25-depart'}])
for s in e['scenes']:
 if s['id']==yard:
  for token in s['scene'].get('tokens',[]):
   if token.get('sceneId')==street:token.pop('sceneId');token['entryId']='milo-yard-exit'
  for z in s['scene'].get('story',{}).get('zones',[]):
   if z.get('sceneId')==street:z['unless']=locked
for a in by['evan-v25-depart']['links']:
 if a.get('sceneId')==departure:a['to']='milo-wagon-noticed'
node('milo-wagon-noticed','Повозка уже здесь','Повозка вже тут',[page(h,'О, повозка уже здесь. Значит, пора ехать.','О, повозка вже тут. Значить, час їхати.')],scene=departure)
node('milo-outside-short','Мило у калитки','Мило біля хвіртки',[page(m,'Я камни забрал. Все.','Я камінці забрав. Усі.'),page(m,'Мы… домой.','Ми… додому.','sad')],scene=departure)
offers=[link('shelter-one','milo-shelter-one','Предложить одну медную','Запропонувати одну мідну',requiresItemId='evan-copper-coin',requiresItemQty=1),link('shelter-five','milo-shelter-five','Дать пять медных для приюта','Дати п’ять мідних для притулку',spendItemId='evan-copper-coin',spendItemQty=5,unless='evan-shelter-donated',effect='evan-shelter-donated'),link('shelter-leave','milo-shelter-bye','Уйти','Піти')]
node('milo-shelter-talk','Разговор у калитки','Розмова біля хвіртки',[page(g,'Чего тебе? Пошёл вон, мужлан. Ненавижу вашу компанию.','Чого тобі? Пішов геть, мужлане. Ненавиджу вашу компанію.','angry')],offers,scene=departure,repeatWhen='evan-shelter-donated',repeatId='milo-shelter-bye')
node('milo-shelter-one','Одну не возьмёт','Одну не візьме',[page(h,'Я могу дать одну медную. Для приюта.','Я можу дати одну мідну. Для притулку.'),page(g,'Одну? Оставь себе. Мне ребят кормить, а не твою совесть гладить.','Одну? Залиш собі. Мені дітей годувати, а не твою совість гладити.','skeptical')],[copy.deepcopy(offers[1]),copy.deepcopy(offers[2])],scene=departure)
node('milo-shelter-five','Пять медных для приюта','П’ять мідних для притулку',[page(h,'Возьми пять. На еду им.','Візьми п’ять. На їжу їм.'),page(g,'Давай. Деньги нужны.','Давай. Гроші потрібні.'),page(g,'Это ничего не меняет, понял? А теперь пошёл нахуй. Мило, идём.','Це нічого не змінює, зрозумів? А тепер пішов нахуй. Мило, ходімо.','angry')],scene=departure)
node('milo-shelter-bye','Не задерживать','Не затримувати',[page(g,'Всё сказал? Тогда отойди.','Усе сказав? Тоді відійди.','angry')],scene=departure)
for s in e['scenes']:
 if s['id']==departure:
  for id,speaker,x,y,entry in [('milo-departure-token',m,78,44,'milo-outside-short'),('shelter-departure-token',g,83,43,'milo-shelter-talk')]:
   sp=e['speakers'][speaker];s['scene']['tokens'].append(dict(id=id,speaker=speaker,name=sp['name'],nameUk=sp.get('nameUk',sp['name']),image=sp['portrait'],x=x,y=y,size=90,visible=True));e['interactions'][id]={'entryId':entry,'marker':'?'}
# Only this existing dialogue was explicitly requested to be rewritten.
boarding=by['evan-v25-boarding'];boarding.update(page(mom,'Нет времени осматривать повозку. Садись, Эван, нам пора.','Немає часу розглядати повозку. Сідай, Еване, нам пора.','emotion-1789816051716'));boarding['slides']=[page(h,'Уже едем?','Уже їдемо?'),page(mom,'Да. Планы изменились — нам ещё нужно в одно место заехать. По дороге объясню.','Так. Плани змінилися — нам ще треба в одне місце заїхати. Дорогою поясню.','emotion-1789816051716')]
# Keep all previous authored page text, portraits, timing and audio outside boarding.
fields=['speaker','text','textUk','emotion','portrait','slides','musicEvent','textSpeed','showPortrait']
for old in original['nodes']:
 if old['id']=='evan-v25-boarding':continue
 for field in fields:assert old.get(field)==by[old['id']].get(field),(old['id'],field)
ids={n['id'] for n in nodes};assert len(ids)==len(nodes)
for n in nodes:
 for a in n.get('links',[]):assert not a.get('to') or a['to'] in ids,(n['id'],a)
 if n['id'] not in {n['id'] for n in original['nodes']}:
  for p in [n]+n.get('slides',[]):assert p['emotion'] in e['speakers'][p['speaker']]['emotions'],(n['id'],p)
with out.open('x') as file:json.dump(data,file,ensure_ascii=False,indent=2)
print('Saved:',out,'; preserved authored pages:',len(original['nodes'])-1,'; new nodes:',len(nodes)-len(original['nodes']))
