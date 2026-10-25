"""Patch a fresh exchange envelope, preserving authored dialogue and token settings."""
import copy,json,sys
p=sys.argv[1];d=json.load(open(p));e=d['episode'];nodes={n['id']:n for n in e['nodes']}
wagon=next(s for s in e['scenes'] if s['id']=='scene-evan-v25-wagon')
arrival_id='scene-evan-wagon-riverside-arrival'
assert arrival_id not in {s['id'] for s in e['scenes']}, 'Already applied'
parked=copy.deepcopy(wagon);parked['id']=arrival_id;parked['name']='Повозка · берег у университета';parked['scene']['name']=parked['name'];parked['scene']['nameUk']='Повозка · берег біля університету'
layers=parked['scene']['layers'];bg=next(l for l in layers if 'wagon-interior' in l.get('image',''));bg['image']='assets/stories/Evan/university/wagon-riverside-arrival-v1.png'
story=parked['scene']['story'];story.update(wagonRide=False,ambience='',ambienceGroup='',arrivalFade={'color':'black','text':'Сорок минут спустя','textUk':'Сорок хвилин потому','holdSeconds':2.8})
e['scenes'].append(parked)
book=nodes['evan-v25-booklet'];stop=nodes['evan-v25-wagon-stopped'];road=nodes['evan-v25-road'];assert book['links'][0]['to']==stop['id']
hero=copy.deepcopy(road['slides'][0]);father=copy.deepcopy(road['slides'][1]);mother={k:copy.deepcopy(v) for k,v in road.items() if k in ['speaker','emotion','portrait','showPortrait','portraitOverride']}
def line(base,ru,uk):
 r={k:copy.deepcopy(v) for k,v in base.items() if k in ['speaker','emotion','portrait','showPortrait','portraitOverride']};r.update(text=ru,textUk=uk);return r
extra={'id':'evan-road-riverside-conversation','kind':'dialogue','title':'Дорога · за окнами','titleUk':'Дорога · за вікнами','editorSceneId':wagon['id'],'x':2840,'y':700,'links':[{'id':'road-time-passes','label':'Ехать дальше','labelUk':'Їхати далі','to':stop['id'],'sceneId':arrival_id}]}
extra.update(line(hero,'Интересно, в мастерских дают разбирать настоящие повозки? Или сначала только рисовать?','Цікаво, у майстернях дають розбирати справжні повозки? Чи спочатку тільки малювати?'))
extra['slides']=[line(father,'Вот у них и спросишь. Только нашу пока оставь целой.','Ось у них і спитаєш. Тільки нашу поки залиш цілою.'),line(hero,'Я же не сейчас. Просто тут под сиденьем что-то постукивает.','Я ж не зараз. Просто тут під сидінням щось постукує.'),line(mother,'Еване, сядь ровно. Доедем — будешь смотреть.','Еване, сядь рівно. Доїдемо — будеш дивитися.')]
# RU name above follows the existing family spelling.
extra['slides'][-1]['text']='Эван, сядь ровно. Доедем — будешь смотреть.'
e['nodes'].append(extra);book['links'][0]['to']=extra['id'];book['links'][0].pop('sceneId',None)
stop['editorSceneId']=arrival_id
if e.get('activeSceneId')==wagon['id']:e['scene']=copy.deepcopy(wagon['scene'])
assert len({s['id'] for s in e['scenes']})==len(e['scenes'])
assert len({n['id'] for n in e['nodes']})==len(e['nodes'])
assert parked['scene']['tokens']==wagon['scene']['tokens']
json.dump(d,open(p,'w'),ensure_ascii=False,indent=2)
print('Prepared riverside arrival, 4 additional lines, 40 minute black transition; tokens preserved.')
