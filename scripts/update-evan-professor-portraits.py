"""Install approved professor identity without replacing shared teacher archetypes."""
import copy,json,sys
from pathlib import Path
BASE='assets/stories/Evan/portraits/engineering-professor/'
ID='evan-engineering-professor'
def patch(source):
 e=copy.deepcopy(source)
 actor=dict(name='Преподаватель инженерии',nameUk='Викладач інженерії',portrait=BASE+'neutral-v2.png',position='50% 50%',zoom=1,emotions={})
 for key,ru,uk in [('neutral','Слушает','Слухає'),('speaking','Объясняет','Пояснює'),('thinking','Задумался','Замислився'),('smiling','Улыбается','Усміхається')]:
  path=BASE+key+'-v2.png';assert Path(path).is_file()
  actor['emotions'][key]=dict(name=ru,nameUk=uk,portrait=path,position='50% 50%',zoom=1)
 if ID in e['speakers']:assert e['speakers'][ID]==actor,'Existing professor was edited; review before replacing'
 e['speakers'][ID]=actor
 for n in e['nodes']:
  if not n['id'].startswith('evan-campus-aspiration-'):continue
  for i,p in enumerate([n]+n.get('slides',[])):
   if p.get('speaker') not in ('campus26-engineering-person-6-speaker',ID):continue
   p['speaker']=ID;p['emotion']='speaking';p['portraitOverride']=False
   if n['id'].endswith('lesson'):
    if i in (1,3,10):p['emotion']='thinking'
    if i in (14,19,21):p['emotion']='smiling'
   elif n['id'].endswith('hello'):p['emotion']='smiling'
 for scene in [e.get('scene',{})]+[r['scene'] for r in e['scenes']]:
  for token in scene.get('tokens',[]):
   if token['id']=='evan-campus-aspiration-teacher':token.update(speaker=ID,image=actor['portrait'],name=actor['name'],nameUk=actor['nameUk'])
 return e
if __name__=='__main__':
 src,out=map(Path,sys.argv[1:]);v=json.loads(src.read_text());v['episode']=patch(v['episode']);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(out)
