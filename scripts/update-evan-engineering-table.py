"""Connect existing engineering table; add bounded exchange and campus chatter."""
import copy,json,sys
from pathlib import Path
S='scene-evan-v25-engineering';H='speaker-1789852672609'
A='campus26-engineering-person-5-speaker';B='campus26-engineering-person-3-speaker';C='campus26-engineering-person-4-speaker'
def page(s,ru,uk):return dict(speaker=s,text=ru,textUk=uk,emotion='emotion-1789852989293' if s==H else '',showPortrait=True,portraitOverride=False)
def link(id,to,ru,uk,**kw):return dict(id=id,to=to,label=ru,labelUk=uk,**kw)
def patch(source):
 e=copy.deepcopy(source);ns={n['id']:n for n in e['nodes']};assert 'campus28-exchange' not in ns
 scene=next(r['scene'] for r in e['scenes'] if r['id']==S)
 for id,actor,entry,x,y in [('campus28-card-expert',A,'campus27-table',26,73),('campus28-card-student-a',B,'campus27-bystander-a',19,77),('campus28-card-student-b',C,'campus27-bystander-b',32,80)]:
  sp=e['speakers'][actor];assert Path(sp['portrait']).is_file()
  scene['tokens'].append(dict(id=id,type='custom',speaker=actor,name=sp['name'],nameUk=sp['nameUk'],image=sp['portrait'],x=x,y=y,size=60,visible=True,interactionRadiusScale=1.7))
  e['interactions'][id]=dict(entryId=entry,marker='?',markerVisible=True)
 for id in ['campus27-table','campus27-table-after']:
  n=ns[id]
  for l in n['links']:
   if l.get('to')=='campus27-deal':l['requiresItemQty']=2
  n['links'].insert(-1,link(id+'-exchange','campus28-exchange','Разменять серебро','Розміняти срібло'))
  n['links'].insert(-1,link(id+'-study','campus28-study','Над чем вы сейчас работаете?','Над чим ви зараз працюєте?'))
 def node(id,ru,uk,pages,links):
  n=dict(id=id,kind='choice' if len(links)>1 else 'dialogue',editorSceneId=S,title=ru,titleUk=uk,x=6900,y=1800+len(e['nodes'])*3,firstShowPortrait=True,slides=pages[1:],links=links);n.update(pages[0]);e['nodes'].append(n)
 back=link('campus28-back','campus27-table','Вернуться к столу','Повернутися до столу')
 node('campus28-exchange','Мелочь для игры','Дрібні для гри',[
 page(H,'У меня есть серебро. Разменяете?','У мене є срібло. Розміняєте?'),
 page(A,'Один серебряный — десять медных. На размен отдельно отложено тридцать. В игру садимся с двумя медными.','Один срібняк — десять мідних. На розмін окремо відкладено тридцять. До гри сідаємо з двома мідними.')],
 [link('campus28-exchange-one','campus28-exchange-done','Разменять 1 серебряную → 10 медных','Розміняти 1 срібну → 10 мідних',requiresItemId='evan-silver-coin',requiresItemQty=1,exchangeTakeId='evan-silver-coin',exchangeTakeQty=1,exchangeGiveId='evan-copper-coin',exchangeGiveQty=10,exchangeOnce='campus28-exchange-stock',exchangeLimit=3),back])
 node('campus28-exchange-done','Размен без наценки','Розмін без націнки',[page(A,'Десять. Пересчитай. Серебро уберу отдельно, чтобы случайно не поставить.','Десять. Перелічи. Срібло приберу окремо, щоб випадково не поставити.')],[back])
 node('campus28-study','Задача у верстака','Задача біля верстака',[
 page(H,'А что вы собираете на занятиях? Я пока только свои рисунки принёс.','А що ви збираєте на заняттях? Я поки тільки свої малюнки приніс.'),
 page(B,'Водяное колесо. Я думал, будем зерно молоть, а нам велели заставить его поднимать молот.','Водяне колесо. Я думав, будемо зерно молоти, а нам звеліли змусити його піднімати молот.'),
 page(H,'Колесо ведь крутится. Как оно молот поднимает?','Колесо ж обертається. Як воно молот піднімає?'),
 page(A,'На валу выступ. Подхватывает рычаг, приподнимает молот, потом уходит из-под него. Молот падает сам.','На валу виступ. Підхоплює важіль, піднімає молот, потім виходить з-під нього. Молот падає сам.'),
 page(C,'А если выступ сделан кое-как, вся твоя умная машина колотит по собственной раме. Проверено.','А якщо виступ зроблено абияк, уся твоя розумна машина гатить по власній рамі. Перевірено.'),
 page(H,'Значит, можно менять выступы и получать другое движение?','Отже, можна міняти виступи й отримувати інший рух?'),
 page(A,'Можно. Только сначала добейся, чтобы одно движение повторялось как надо. Рисунок терпит больше, чем дерево.','Можна. Тільки спочатку добийся, щоб один рух повторювався як треба. Малюнок терпить більше, ніж дерево.')],[back,link('campus28-study-leave','campus27-table-leave','Спасибо, пойду осмотрюсь','Дякую, піду роздивлюся')])
 table=next(t for t in e['minigames']['towerClawTables'] if t['tableId']=='engineering')
 def add(s,event,ru,uk,slides):
  r=dict(text=ru,textUk=uk,emotion='',slides=slides);table['replies'].setdefault(s,{}).setdefault(event,[]).append(r)
 add(A,'win','Забираю. Ты всё на наше колесо поглядываешь.','Забираю. Ти все на наше колесо поглядаєш.',[
 page(H,'Им ведь зерно мелют? А вы что с ним делаете?','Ним же зерно мелють? А ви що з ним робите?'),
 page(A,'Можно и молот приводить, и сукно валять. Вода крутит колесо, а работа зависит от того, что к валу присоединили.','Можна й молот приводити, і сукно валяти. Вода крутить колесо, а робота залежить від того, що до вала приєднали.')])
 add(B,'loss','Ладно, твои. У меня сегодня и с моделью не сошлось.','Гаразд, твої. У мене сьогодні й із моделлю не зійшлося.',[
 page(H,'Что случилось?','Що сталося?'),page(B,'Колесо крутилось, а молот застревал. Оказалось, я выступ слишком высоко поднял. Пришлось переделывать одну деталь.','Колесо оберталося, а молот застрягав. Виявилося, я виступ надто високо підняв. Довелося переробляти одну деталь.')])
 add(C,'win','На бумагу хватит. А то вчера весь лист испортил.','На папір вистачить. Бо вчора весь аркуш зіпсував.',[
 page(H,'Чертёж не получился?','Креслення не вийшло?'),page(C,'Получился. Только я забыл оставить место, чтобы вынуть сломанную ось. Собрать можно, починить — разбирай половину.','Вийшло. Тільки я забув залишити місце, щоб вийняти зламану вісь. Зібрати можна, полагодити — розбирай половину.')])
 add(A,'raise','Ещё две. И не трогай тот валик — он весь в краске.','Іще дві. І не чіпай той валик — він увесь у фарбі.',[
 page(H,'Вы его красите?','Ви його фарбуєте?'),page(A,'Проверяем, где трёт. Иногда след от краски говорит больше, чем полчаса спора.','Перевіряємо, де треться. Іноді слід від фарби каже більше, ніж пів години суперечки.')])
 # Do not claim a specific raise amount: game decides the actual wager.
 table['replies'][A]['raise'][-1]['text']='Подниму. И не трогай тот валик — он весь в краске.'
 table['replies'][A]['raise'][-1]['textUk']='Підніму. І не чіпай той валик — він увесь у фарбі.'
 if e.get('activeSceneId')==S:e['scene']=copy.deepcopy(scene)
 assert e['minigames']['towerClaw']==source['minigames']['towerClaw']
 assert e['storyItems']==source['storyItems'] and e['quests']==source['quests']
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
