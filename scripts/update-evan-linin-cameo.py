"""Optional Lin'In cameo, using the approved reference and public manner only."""
import copy,json,sys
from pathlib import Path
S='scene-evan-v25-magic';L='evan-campus-linin';H='speaker-1789852672609';P='assets/stories/portraits/Portraits/ChatGPT Image 9 сент. 2026 г., 21_32_14 (1).png'
def page(s,ru,uk,think=False):return dict(speaker=s,text=ru,textUk=uk,emotion=('emotion-1789852949259' if think else 'emotion-1789852989293') if s==H else '',showPortrait=True,portraitOverride=False)
def patch(source):
 e=copy.deepcopy(source);assert L not in e['speakers'];assert Path(P).is_file()
 e['speakers'][L]=dict(name='Лин’Ин',nameUk='Лін’Ін',portrait=P,emotions={},position='50% 50%',zoom=1)
 def node(id,ru,uk,pages,links=[],**kw):
  n=dict(id=id,kind='choice' if len(links)>1 else 'dialogue',editorSceneId=S,title=ru,titleUk=uk,x=7200,y=2100+len(e['nodes'])*2,slides=pages[1:],links=links,firstShowPortrait=True,**kw);n.update(pages[0]);e['nodes'].append(n)
 node(L+'-hello','У края двора','На краю подвір’я',[
 page(H,'Здравствуйте. Вы тоже пришли посмотреть корпус?','Вітаю. Ви теж прийшли подивитися корпус?'),
 page(L,'Перед тобой весь двор. Смотри.','Перед тобою все подвір’я. Дивись.'),
 page(H,'Я Эван. Хотел узнать, с кем здесь можно поговорить об учёбе.','Я Еван. Хотів дізнатися, з ким тут можна поговорити про навчання.'),
 page(L,'С тем, кто этим занимается. Я не встречаю посетителей.','З тим, хто цим займається. Я не зустрічаю відвідувачів.')],
 [dict(id=L+'-ask',to=L+'-talk',label='Извиниться и представиться ещё раз',labelUk='Перепросити й представитися ще раз'),dict(id=L+'-leave',to=L+'-leave',label='Не мешать ей',labelUk='Не заважати їй')],afterEffect=L+'-met',repeatRoutes=[dict(requires=L+'-met',to=L+'-repeat')])
 node(L+'-talk','Короткое знакомство','Коротке знайомство',[
 page(H,'Извините, я не хотел отвлекать. Просто здесь всё новое. А как вас зовут?','Перепрошую, я не хотів відволікати. Просто тут усе нове. А як вас звати?'),
 page(L,'Лин’Ин. Этого достаточно?','Лін’Ін. Цього достатньо?'),
 page(H,'Приятно познакомиться. Здесь столько разных людей. Наверное, у каждого есть чему поучиться.','Приємно познайомитися. Тут стільки різних людей. Мабуть, у кожного є чого повчитися.'),
 page(L,'Возможно. У некоторых — вовремя заканчивать разговор.','Можливо. У декого — вчасно закінчувати розмову.'),
 page(H,'Понял. Хорошего дня.','Зрозумів. Гарного дня.'),
 page(H,'Странно. Я ведь только спросил. Ладно, не буду приставать.','Дивно. Я ж тільки спитав. Гаразд, не чіплятимуся.',True)])
 node(L+'-leave','Не отвлекать','Не відволікати',[page(H,'Извините. Не буду мешать.','Перепрошую. Не заважатиму.'),page(H,'Может, я не вовремя подошёл. Спрошу у кого-нибудь другого.','Може, я невчасно підійшов. Спитаю в когось іншого.',True)])
 node(L+'-repeat','Разговор окончен','Розмову закінчено',[page(H,'Она явно не хочет разговаривать. Пойду дальше.','Вона явно не хоче розмовляти. Піду далі.',True)])
 # Choice promises only what its following page actually does.
 e['nodes'][-4]['links'][0]['label']='Извиниться и спросить её имя'
 e['nodes'][-4]['links'][0]['labelUk']='Перепросити й запитати її ім’я'
 scene=next(r['scene'] for r in e['scenes'] if r['id']==S)
 scene['tokens'].append(dict(id=L,type='custom',speaker=L,name='Лин’Ин',nameUk='Лін’Ін',image=P,x=22,y=80,size=62,visible=True,interactionRadiusScale=1.7))
 e['interactions'][L]=dict(entryId=L+'-hello',marker='?',markerVisible=True)
 if e.get('activeSceneId')==S:e['scene']=copy.deepcopy(scene)
 assert e['nodes'][:len(source['nodes'])]==source['nodes']
 assert e['minigames']==source['minigames'] and e['quests']==source['quests']
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
