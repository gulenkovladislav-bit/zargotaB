"""Add military arrival and artist; preserve purchase effects and authored dialogue."""
import copy,json,sys
from pathlib import Path
H='speaker-1789852672609'; F='speaker-1789814989758'; A='evan-military-artist'; S='scene-evan-v25-military'
P='assets/stories/Evan/portraits/military-artist/neutral-v4.png'
def page(who,ru,uk):
 return dict(speaker=who,text=ru,textUk=uk,emotion=('emotion-1789852989293' if who==H else 'emotion-1789816132394' if who==F else ''),showPortrait=True,portraitOverride=False)
def patch(source):
 e=copy.deepcopy(source); ns={n['id']:n for n in e['nodes']}
 assert A not in e['speakers'],'Already installed; inspect instead of overwriting'
 e['speakers'][A]=dict(name='Студент-художник',nameUk='Студент-художник',portrait=P,position='50% 50%',zoom=1,emotions={})
 arrival=ns['evan-v25-arrival']
 arrival['links']=[dict(id='arrival-military',label='Выйти к военному корпусу',labelUk='Вийти до військового корпусу',sceneId=S)]
 impression=ns['evan-campus-aspiration-first-military']
 impression['slides'] += [page(F,'Мы решили начать отсюда. Дисциплина тебе не помешает: взрослеешь, пора учиться отвечать за свои решения.','Ми вирішили почати звідси. Дисципліна тобі не завадить: дорослішаєш, час учитися відповідати за свої рішення.'),page(H,'Я посмотрю. Только потом хочу к инженерам — я ведь не зря вёз рисунки.','Я подивлюся. Тільки потім хочу до інженерів — я ж не дарма віз малюнки.'),page(F,'Успеешь. Мы тоже осмотримся. Далеко от университета не уходи.','Встигнеш. Ми теж роздивимося. Далеко від університету не йди.')]
 for n in e['nodes']:
  if n['id'].startswith(('campus27-artist','campus27-offer-','campus27-bought-')):
   n['editorSceneId']=S
   for p in [n]+n.get('slides',[]):
    if p.get('speaker')=='campus26-engineering-person-0-speaker':p['speaker']=A;p['emotion']=''
 def node(id,title,uk,pages,links):
  n=dict(id=id,kind='dialogue',editorSceneId=S,title=title,titleUk=uk,x=6400,y=1800+len(e['nodes'])*2,firstShowPortrait=True,slides=pages[1:],links=links);n.update(pages[0]);e['nodes'].append(n)
 node('evan-military-artist-hello','Кисть у плаца','Пензель біля плацу',[
 page(H,'Здравствуйте. Это вы нарисовали? Я думал, здесь только с оружием упражняются.','Вітаю. Це ви намалювали? Я думав, тут тільки зі зброєю вправляються.'),
 page(A,'Со щитом рисовать неудобно. Поэтому я дожидаюсь, когда его можно отложить.','Зі щитом малювати незручно. Тому я чекаю, коли його можна відкласти.')],
 [dict(id='artist-study',to='evan-military-artist-study',label='Вы здесь учитесь? Почему так тихо?',labelUk='Ви тут навчаєтеся? Чому так тихо?'),dict(id='artist-cards',to='campus27-artist',label='Можно посмотреть ваши карты?',labelUk='Можна подивитися ваші карти?'),dict(id='artist-leave',to='campus27-artist-leave',label='Не буду мешать',labelUk='Не заважатиму')])
 node('evan-military-artist-study','Другой путь','Інший шлях',[
 page(A,'Учусь. Сегодня наш курс на занятиях за городом. Я дежурю при оружейной: выдал снаряжение, теперь жду обратно.','Навчаюся. Сьогодні наш курс на заняттях за містом. Я чергую при зброярні: видав спорядження, тепер чекаю назад.'),
 page(H,'А вы хотели именно сюда?','А ви хотіли саме сюди?'),
 page(A,'Нет. Пробовал в другие корпуса — не прошёл. Сюда приняли. Первую неделю считал, что просто согласился на то, что осталось.','Ні. Пробував до інших корпусів — не пройшов. Сюди прийняли. Перший тиждень вважав, що просто погодився на те, що залишилося.'),
 page(H,'И больше так не считаете?','І більше так не вважаєте?'),
 page(A,'На занятии нам дали распределить припасы для отряда. У меня всё красиво сошлось. Только до места мои люди дошли бы без воды.','На занятті нам дали розподілити припаси для загону. У мене все гарно зійшлося. Тільки до місця мої люди дійшли б без води.'),
 page(A,'Так что учиться тут есть чему. Уйти только потому, что я представлял себе другую дверь, было бы глупо.','Тож учитися тут є чого. Піти лише тому, що я уявляв собі інші двері, було б нерозумно.'),
 page(H,'А рисовать не бросили.','А малювати не покинули.'),
 page(A,'Зачем? Свободный час всё ещё мой. Иногда за него ещё и платят.','Навіщо? Вільна година досі моя. Іноді за неї ще й платять.'),
 page(H,'Вы и меня можете нарисовать? На настоящей карте?','Ви й мене можете намалювати? На справжній карті?')],
 [dict(id='artist-shop',to='campus27-artist',label='Посмотреть варианты',labelUk='Подивитися варіанти'),dict(id='artist-study-leave',to='campus27-artist-leave',label='Спасибо. Я ещё осмотрюсь',labelUk='Дякую. Я ще роздивлюся')])
 scene=next(r['scene'] for r in e['scenes'] if r['id']==S)
 scene['tokens'].append(dict(id=A,type='custom',name='Студент-художник',nameUk='Студент-художник',image=P,speaker=A,x=65,y=76,size=64,visible=True,interactionRadiusScale=1.7))
 e['interactions'][A]=dict(entryId='evan-military-artist-hello',marker='?',markerVisible=True)
 # The root scene can be a mirror of the active location.
 if e.get('activeSceneId')==S:e['scene']=copy.deepcopy(scene)
 for old in source['nodes']:
  new=next(n for n in e['nodes'] if n['id']==old['id'])
  if old['id'].startswith(('campus27-offer-','campus27-bought-')):assert old['links']==new['links']
 assert e['storyItems']==source['storyItems']
 ids={n['id'] for n in e['nodes']}
 for n in e['nodes'][-2:]:
  for l in n['links']:assert l['to'] in ids
 assert Path(P).is_file()
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
