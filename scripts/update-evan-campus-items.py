"""Narrow, repeatable patch for a fresh exchange envelope. Never rewrites authored pages."""
import copy, json, sys
from pathlib import Path

# Recovered from original exports/builds; preserve wording around damaged bytes.
REPAIRS = {
 'Стоп.. Сьогодні ж день ����одачі документів! Треба прокидатися.': 'Стоп.. Сьогодні ж день подачі документів! Треба прокидатися.',
 'Спроси��ь о размене': 'Спросить о размене',
 'Карти · не втручат��ся': 'Карти · не втручатися',
 'Зосе��едж��ний': 'Зосереджений', 'Замисливс��': 'Замислився',
 'Говорит��': 'Говорить', 'З��ість': 'Злість', 'Зло��ть': 'Злость',
 'Не зггібай так швидко. Я п��ощаюся.': 'Не зггібай так швидко. Я пгощаюся.',
 'Піднімаю. Твоя в��дповідь?': 'Піднімаю. Твоя відповідь?',
 'Эти перес��итаю сам.': 'Эти пересчитаю сам.',
 'Останню просто так не ��іддам.': 'Останню просто так не віддам.',
}
FLAG = 'evan-discussed-drafts-leor'
PREFIX = 'campus-item-'

def patch(episode):
 e=copy.deepcopy(episode); repairs=[]
 def repair(v,path=''):
  if isinstance(v,dict):return {k:repair(x,path+'/'+k) for k,x in v.items()}
  if isinstance(v,list):return [repair(x,path+'/'+str(i)) for i,x in enumerate(v)]
  if isinstance(v,str) and '\ufffd' in v:
   if v not in REPAIRS:raise ValueError('Unreviewed damaged text at '+path+': '+repr(v))
   repairs.append({'path':path,'before':v,'after':REPAIRS[v]});return REPAIRS[v]
  return v
 e=repair(e); nodes={n['id']:n for n in e['nodes']}
 hero=e['playerSpeakerId']; talk='emotion-1789852989293'; think='emotion-1789852949259'
 assert talk in e['speakers'][hero]['emotions'] and think in e['speakers'][hero]['emotions']
 for key in ['evan-leor-hello','evan-leor-design','evan-leor-learning','evan-leor-faculties','campus-talk-engineering-drawing','campus-talk-engineering-repair','campus-talk-magic-practice']:assert key in nodes,key
 added=[]
 def page(speaker,ru,uk,emotion=None):
  return dict(speaker=speaker,emotion=(emotion or talk) if speaker==hero else '',text=ru,textUk=uk,showPortrait=True,portraitOverride=False)
 def make(slug,faculty,title,titleUk,rows,links=None):
  nid=PREFIX+slug
  if nid in nodes:return nid # Preserve any subsequent author edits.
  pages=[page(*row) for row in rows]
  node=dict(id=nid,kind='dialogue',editorSceneId='scene-evan-v25-'+faculty,title=title,titleUk=titleUk,x=4800+(len(added)%3)*340,y=(1200 if faculty=='magic' else 2400)+(len(added)//3)*300,firstShowPortrait=True,slides=pages[1:],links=links or [],**pages[0])
  e['nodes'].append(node);nodes[nid]=node;added.append(nid);return nid
 def link(source,dest,ru,uk,**conditions):
  n=nodes[source];lid=PREFIX+source+'-'+dest
  if not any(l.get('id')==lid or l.get('to')==dest for l in n.get('links',[])):
   n.setdefault('links',[]).append(dict(id=lid,to=dest,label=ru,labelUk=uk,**conditions))
 # Existing Leor dialogue is authored; retain every page, connect it from other topics.
 for source in ['evan-leor-hello','evan-leor-learning','evan-leor-faculties']:
  old=next((l for l in nodes[source].get('links',[]) if l.get('to')=='evan-leor-design'),None)
  if old:
   if old.get('requires')=='evan-has-drafts':old.pop('requires')
   old['requiresItemId']='evan-draft-folder'
  else:link(source,'evan-leor-design','Показать свои схемы','Показати свої схеми',requiresItemId='evan-draft-folder')
 # Record the conversation only on completion, preserving all authored pages.
 if nodes['evan-leor-design'].get('afterEffect') not in (None,'',FLAG):raise ValueError('Leor already has another afterEffect; preserve and merge explicitly')
 nodes['evan-leor-design']['afterEffect']=FLAG
 eng=nodes['campus-talk-engineering-drawing']['slides'][0]['speaker']
 mech=nodes['campus-talk-engineering-repair']['slides'][0]['speaker']
 mage=nodes['campus-talk-magic-practice']['slides'][0]['speaker']
 design=make('schemes','engineering','Свои чертежи','Власні креслення',[
  (hero,'У меня тоже есть наброски. Можно покажу? Я хотел менять вращение колёс, не переделывая всю тележку.','У мене теж є начерки. Можна покажу? Я хотів змінювати обертання коліс, не переробляючи весь візочок.'),
  (eng,'Давай. Вот эта часть должна задавать движение? А откуда берётся усилие?','Давай. Оця частина має задавати рух? А звідки береться зусилля?'),
  (hero,'С этим пока не разобрался. На бумаге у меня всё крутится само.','Із цим поки не розібрався. На папері в мене все крутиться саме.',think),
  (eng,'Порядок движения ты придумал. Теперь нужно понять, что будет двигать сам механизм. Это две разные задачи.','Порядок руху ти вигадав. Тепер треба зрозуміти, що рухатиме сам механізм. Це два різні завдання.')])
 leor=make('leor-comment','engineering','Цена удобства','Ціна зручності',[
  (hero,'Леор советовал начать с одного поворота. А если всё получится, как понять, не слишком ли дорого выйдет?','Леор сказав, що люди обирають просте й дешеве. Навіть рухома передня вісь буває надто дорогою.'),
  (eng,'А ты для кого рисуешь? Для того, кто повезёт мешки, или чтобы разобраться, как это работает?','А ти для кого малюєш? Для того, хто повезе мішки, чи щоб розібратися, як це працює?'),
  (hero,'Сначала — разобраться. Леор советовал проверять по одной части и записывать, где пошло не так.','Спочатку — розібратися. Леор іще сказав не навішувати на одну ідею все одразу.',think),
  (eng,'Тогда не выбрасывай рисунок. Собери одну часть. А потом уже спроси, сколько она стоит и кому нужна.','Тоді не викидай малюнок. Збери одну частину. А потім уже спитай, скільки вона коштує й кому потрібна.')])
 start=make('first-test','engineering','Одна рабочая часть','Одна робоча частина',[
  (hero,'С чего бы ты начал?','Із чого б ти почав?'),
  (eng,'С двух колёсиков на дощечке. Одно крутишь рукой и смотришь, что делает второе. Размеры сначала подпиши.','Із двох коліщаток на дощечці. Одне крутиш рукою й дивишся, що робить друге. Розміри спочатку підпиши.'),
  (hero,'Такую штуку я, пожалуй, смогу собрать. И будет видно, где я ошибся.','Таку штуку я, мабуть, зможу зібрати. І буде видно, де я помилився.'),
  (eng,'А с работающей частью возвращайся. Смотреть будет интереснее, чем угадывать по стрелкам.','А з робочою частиною повертайся. Дивитися буде цікавіше, ніж вгадувати за стрілками.')])
 counter=make('counter','engineering','Счётчик с лебёдки','Лічильник із лебідки',[
  (hero,'Я купил вот такую штуку. Сказали, счётчик с лебёдки. Колёсико заедает — можно показать?','Я купив ось таку штуку. Казали, лічильник із лебідки. Коліщатко заїдає — можна показати?'),
  (mech,'Можно. Только не дави. Сначала найди место, где оно останавливается. Каждый раз одно и то же?','Можна. Тільки не тисни. Спочатку знайди місце, де воно зупиняється. Щоразу те саме?'),
  (hero,'Я сильнее крутил. Думал, просто туго идёт.','Я сильніше крутив. Думав, просто туго йде.',think),
  (mech,'Так можно и зубец сломать. Я бы посмотрела, не попало ли что внутрь и не перекосило ли ось. Но без разборки не обещаю.','Так можна й зубець зламати. Я б подивилася, чи не потрапило щось усередину й чи не перекосило вісь. Але без розбирання не обіцяю.'),
  (hero,'А если я захочу таким менять скорость колеса?','А якщо я захочу таким змінювати швидкість колеса?'),
  (mech,'Считать обороты и задавать их — разные вещи. Но разобрать счётчик и зарисовать детали тебе точно полезно. Только сначала — как они стояли.','Рахувати оберти й задавати їх — різні речі. Але розібрати лічильник і замалювати деталі тобі точно корисно. Тільки спочатку — як вони стояли.')])
 stone=make('lodestone','magic','Камень и гвоздь','Камінь і цвях',[
  (hero,'Можно ещё вопрос? Я купил камень, а он держит гвоздь. Это магия?','Можна ще запитання? Я купив камінь, а він тримає цвях. Це магія?'),
  (mage,'Покажи. Похоже на магнитный камень. Но по одному гвоздю я бы про заклинание ничего не обещала.','Покажи. Схоже на магнітний камінь. Але за одним цвяхом я б про закляття нічого не обіцяла.'),
  (hero,'А если прицепить его к тележке? Он мог бы тянуть её без коня?','А якщо причепити його до візочка? Він міг би тягнути його без коня?',think),
  (mage,'Ты уже от одного гвоздя до тележки дошёл. Сначала проверь, что он притягивает и с какого расстояния.','Ти вже від одного цвяха до візочка дійшов. Спочатку перевір, що він притягує й з якої відстані.'),
  (hero,'И записать, когда перестаёт? Кажется, у меня для этого ещё есть чистый лист.','І записати, коли перестає? Здається, у мене для цього ще є чистий аркуш.'),
  (mage,'Вот. А преподавателю принеси и камень, и записи. Тогда будет что обсуждать, кроме слова «магия».','От. А викладачеві принеси і камінь, і записи. Тоді буде що обговорювати, крім слова «магія».')])
 goodbye={faculty:make('bye-'+faculty,faculty,'До встречи','До зустрічі',[(hero,'Спасибо. Не буду отвлекать от работы.','Дякую. Не відволікатиму від роботи.')]) for faculty in ['engineering','magic']}
 for source,target,item,ru,uk in [
  ('campus-talk-engineering-drawing',design,'evan-draft-folder','Показать свои схемы','Показати свої схеми'),
  ('campus-talk-engineering-repair',counter,'evan-broken-counter','Показать купленный механизм','Показати придбаний механізм'),
  ('campus-talk-magic-practice',stone,'evan-lodestone-fragment','Показать магнитный камень','Показати магнітний камінь')]:
  link(source,target,ru,uk,requiresItemId=item)
  faculty='magic' if source.startswith('campus-talk-magic') else 'engineering'
  link(source,goodbye[faculty],'Спасибо, пойду дальше','Дякую, піду далі')
 link(design,leor,'Рассказать о замечании Леора','Розповісти про зауваження Леора',requires=FLAG)
 link(design,start,'С чего начать?','Із чого почати?')
 link(design,goodbye['engineering'],'Убрать схемы','Прибрати схеми')
 link(leor,start,'Как проверить первую часть?','Як перевірити першу частину?')
 # Also allow leaving Leor after choosing other subjects, without being forced to show an item.
 farewell='evan-leor-items-goodbye'
 if farewell not in nodes:
  n=dict(id=farewell,kind='dialogue',editorSceneId=nodes['evan-leor-hello']['editorSceneId'],title='Спасибо Леору',titleUk='Подякувати Леорові',x=1250,y=3800,firstShowPortrait=True,slides=[],links=[],**page(hero,'Спасибо. Пойду посмотрю, что во дворе.','Дякую. Піду подивлюся, що у дворі.'))
  e['nodes'].append(n);nodes[farewell]=n;added.append(farewell)
 for source in ['evan-leor-learning','evan-leor-faculties']:link(source,farewell,'Попрощаться','Попрощатися')
 if 'card-social-stone' in nodes:nodes['card-social-stone'].setdefault('cardAction',{})['sound']='throw'
 return e,{'added':added,'repairs':repairs}

if __name__=='__main__':
 source=Path(sys.argv[1]);output=Path(sys.argv[2]);data=json.loads(source.read_text());result,report=patch(data['episode']);data['episode']=result
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 output.with_suffix('.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'output':str(output),'added':len(report['added']),'repaired':len(report['repairs'])},ensure_ascii=False))
