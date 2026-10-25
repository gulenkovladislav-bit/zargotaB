import copy, importlib.util, json, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('patch','scripts/update-evan-campus-items.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
e=json.loads(Path(sys.argv[1]).read_text())['episode'];result,report=m.patch(e);again,second=m.patch(result)
assert result==again and not second['added'] and not second['repairs']
old={n['id']:n for n in e['nodes']};new={n['id']:n for n in result['nodes']}
assert len(new)==len(result['nodes'])
# Every authored string is unchanged except exact, reviewed replacement-character recovery.
def verify(a,b):
 if isinstance(a,str): assert b==m.REPAIRS.get(a,a),(a,b)
 elif isinstance(a,list):
  assert len(a)==len(b)
  for x,y in zip(a,b):verify(x,y)
 elif isinstance(a,dict):
  for k,v in a.items():verify(v,b[k])
 else:assert a==b
for id,n in old.items():
 for field in ['text','textUk','slides','speaker','emotion','portrait','image','cardEvent']:
  if field in n:verify(n[field],new[id][field])
for k in ['scenes','scene','storyItems','interactions','quests','player']:assert e[k]==result[k],k
for id in report['added']:
 n=new[id]
 for p in [n,*n['slides']]:
  assert p['text'] and p['textUk'] and p['speaker'] in result['speakers']
  assert not p['emotion'] or p['emotion'] in result['speakers'][p['speaker']]['emotions']
  assert max(len(p['text']),len(p['textUk']))<205
for n in new.values():
 if n['id'] in report['added'] or n.get('id','').startswith('campus-talk-'):
  for l in n.get('links',[]):assert l['to'] in new and l['label'] and l['labelUk']
assert '\ufffd' not in json.dumps(result,ensure_ascii=False)
assert new['evan-leor-design']['afterEffect']==m.FLAG
assert new['card-social-stone']['cardAction']['sound']=='throw'
print(f'PASS campus content: {len(report["added"])} new nodes; {len(report["repairs"])} exact repairs; authored pages/scenes/items preserved; locales, portraits, links, idempotence.')
