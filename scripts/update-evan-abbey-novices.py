"""Install approved abbey portraits and a first, non-spoiling campus encounter."""
import copy,json,sys
from pathlib import Path
S='scene-evan-v25-botany';H='speaker-1789852672609';A='evan-abbey-stocky';B='evan-abbey-slender';N='evan-abbey-narrator';BASE='assets/stories/Evan/portraits/abbey-novices/'
def page(s,ru,uk,think=False):return dict(speaker=s,text=ru,textUk=uk,emotion=('emotion-1789852949259' if think else 'emotion-1789852989293') if s==H else '',showPortrait=s!=N,portraitOverride=False)
def patch(source):
 e=copy.deepcopy(source);assert not any(n['id']=='evan-abbey-encounter' for n in e['nodes']),'Already installed; review author edits'
 for id,name,uk,file in [(A,'Коренастый послушник','Кремезний послушник','stocky-neutral-v1.png'),(B,'Худой послушник','Худорлявий послушник','slender-neutral-v1.png')]:
  assert Path(BASE+file).is_file();e['speakers'][id]=dict(name=name,nameUk=uk,portrait=BASE+file,emotions={},position='50% 50%',zoom=1)
 e['speakers'][N]=dict(name='',nameUk='',portrait='',emotions={})
 def node(id,ru,uk,pages,links=None,**kw):
  links=links or [];n=dict(id=id,kind='choice' if len(links)>1 else 'dialogue',editorSceneId=S,title=ru,titleUk=uk,x=7500,y=2500+len(e['nodes'])*3,slides=pages[1:],links=links,firstShowPortrait=pages[0]['showPortrait'],**kw);n.update(pages[0]);e['nodes'].append(n)
 def link(id,to,ru,uk):return dict(id=id,to=to,label=ru,labelUk=uk)
 node('evan-abbey-encounter','Грязь на надписи','Бруд на написі',[
 page(N,'У грядки стоят двое в одинаковых коричневых робах. Коренастый скребёт подошвой по плоскому камню с надписью.','Біля грядки стоять двоє в однакових коричневих робах. Кремезний шкребе підошвою по пласкому каменю з написом.'),
 page(H,'Извините, там название растения. Вы его грязью закрыли.','Перепрошую, там назва рослини. Ви її брудом закрили.'),
 page(A,'Отмоется. Дождь пойдёт.','Відмиється. Дощ піде.'),
 page(H,'Но сейчас не прочитать. Здесь же для этого и подписали.','Але зараз не прочитати. Тут же для цього й підписали.'),
 page(N,'Худой отходит от грядки и останавливается рядом с Эваном. Слишком близко для обычного разговора.','Худорлявий відходить від грядки й зупиняється поруч з Еваном. Надто близько для звичайної розмови.'),
 page(B,'Ты здесь главный по камням?','Ти тут головний по каменях?')],
 [link('abbey-answer','evan-abbey-answer','Попросить не портить чужую работу','Попросити не псувати чужу роботу'),link('abbey-step-back','evan-abbey-step-back','Отступить и не спорить','Відступити й не сперечатися')],afterEffect='evan-abbey-met',repeatRoutes=[dict(requires='evan-abbey-met',to='evan-abbey-repeat')])
 node('evan-abbey-answer','Чужая работа','Чужа робота',[
 page(H,'Нет. Просто кто-то это сделал, чтобы другим было понятно. Можно ведь вытереть сапог о край дорожки.','Ні. Просто хтось це зробив, щоб іншим було зрозуміло. Можна ж витерти чобіт об край доріжки.'),
 page(A,'Слышал? Нас уже учат. Ещё порог не переступили.','Чув? Нас уже вчать. Ще порога не переступили.'),
 page(B,'Пойдём. Нам велели забрать рассаду, а не разговаривать со всеми подряд.','Ходімо. Нам звеліли забрати розсаду, а не розмовляти з усіма підряд.')],
 [link('abbey-who','evan-abbey-who','Вы из какого корпуса?','Ви з якого корпусу?'),link('abbey-done','evan-abbey-after','Пропустить их','Пропустити їх')])
 node('evan-abbey-step-back','Не продолжать спор','Не продовжувати суперечку',[
 page(H,'Я только хотел прочитать название. Проходите.','Я лише хотів прочитати назву. Проходьте.'),
 page(B,'Вот и договорились.','От і домовилися.'),
 page(A,'Пойдём уже за рассадой. В аббатстве ждать не будут.','Ходімо вже по розсаду. В абатстві чекати не будуть.')],[link('abbey-after-back','evan-abbey-after','Отойти к дорожке','Відійти до доріжки')])
 node('evan-abbey-who','Из аббатства','З абатства',[
 page(A,'Мы из аббатства. Недавно пришли. На сегодня нам дела хватит и без ваших уроков.','Ми з абатства. Нещодавно прийшли. На сьогодні нам справ вистачить і без ваших уроків.'),
 page(B,'Дорогу оставь.','Дорогу залиш.')],[link('abbey-after-who','evan-abbey-after','Дать им пройти','Дати їм пройти')])
 node('evan-abbey-after','После разговора','Після розмови',[
 page(N,'Они поворачиваются к грядкам. На камне остаётся тёмная полоса поперёк букв.','Вони повертаються до грядок. На камені лишається темна смуга впоперек літер.'),
 page(H,'Я ведь не хотел ссориться. Только надпись прочитать.','Я ж не хотів сваритися. Лише напис прочитати.',True),
 page(H,'Здесь столько всего делают, берегут, объясняют. А этим даже отступить на шаг было трудно.','Тут стільки всього роблять, бережуть, пояснюють. А цим навіть відступити на крок було важко.',True)],afterEffect='evan-abbey-encounter-finished')
 node('evan-abbey-repeat','Не подходить снова','Не підходити знову',[page(H,'Не хочу снова к ним подходить. Посмотрю остальной двор.','Не хочу знову до них підходити. Огляну решту подвір’я.',True)])
 scene=next(r['scene'] for r in e['scenes'] if r['id']==S)
 for id,x,y in [(A,57,63),(B,64,65)]:
  sp=e['speakers'][id];scene['tokens'].append(dict(id=id,type='custom',speaker=id,name=sp['name'],nameUk=sp['nameUk'],image=sp['portrait'],x=x,y=y,size=66,visible=True,interactionRadiusScale=1.8));e['interactions'][id]=dict(entryId='evan-abbey-encounter',marker='?',markerVisible=True)
 if e.get('activeSceneId')==S:e['scene']=copy.deepcopy(scene)
 assert e['nodes'][:len(source['nodes'])]==source['nodes'];assert e['quests']==source['quests'] and e['minigames']==source['minigames']
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
