import json,sys,copy
from pathlib import Path
src,out=map(Path,sys.argv[1:]);data=json.loads(src.read_text());e=data.get('episode',data);nodes=e['nodes'];by={n['id']:n for n in nodes};hero=e['playerSpeakerId'];m='evan-yard-milo';f='evan-port-feltser';pen='evan-port-pen'
def page(s,ru,uk,emotion='speaking'):return dict(speaker=s,text=ru,textUk=uk,emotion=emotion,showPortrait=True)
reach=by['card-social-reach-a'];reach.update(page(hero,'Мило. Отдай карту.','Мило. Віддай карту.','emotion-1789852989293'));reach['slides']=[page(m,'Это… моя карта.','Це… моя карта.')];reach['cardEvent']={'enabled':True,'phase':'roundStart','minRound':4,'once':True,'requires':'guestJoined'}
reach['links']=[{'id':'milo-return-calm','to':'card-milo-return-calm','label':'Мило, отдай мою карту.','labelUk':'Мило, віддай мою карту.'},{'id':'milo-return-rough','to':'card-milo-return-rough','label':'Блять, отдай, блять, мою карту.','labelUk':'Блять, віддай, блять, мою карту.'}]
by['card-social-reach-b']['cardEvent']['enabled']=False
for key,lines in [('calm',[page(hero,'Мило, отдай мою карту. Твои — возле тебя.','Мило, віддай мою карту. Твої — біля тебе.','emotion-1789852989293'),page(m,'Эта… ко мне шла.','Ця… до мене йшла.','surprised'),page(f,'Ага, сама поползла. Ещё и кошель к тебе пойдёт?','Ага, сама поповзла. Ще й гаманець до тебе піде?','laughing'),page(pen,'Кагта умнее. Уже от него убегает.','Кагта гозумніша. Вже від нього тікає.','laughing'),page(m,'Вот. Твоя.','Ось. Твоя.')]),('rough',[page(hero,'Блять, отдай, блять, мою карту.','Блять, віддай, блять, мою карту.','emotion-1789852989293'),page(m,'Не кричи. Я… держал.','Не кричи. Я… тримав.','sad'),page(f,'Руки убрал, блять. Своих двух тебе мало?','Руки прибрав, блять. Своїх двох тобі мало?','angry'),page(pen,'Он уже тгетью себе гасдал.','Він уже тгетю собі гоздав.','laughing'),page(m,'Забери.','Забери.','sad')])]:
 n={'id':'card-milo-return-'+key,'title':'Мило · вернуть карту · '+key,'titleUk':'Мило · повернути карту · '+key,'editorSceneId':reach['editorSceneId'],'x':reach['x']+500,'y':reach['y']+(400 if key=='rough' else 0),'kind':'dialogue',**lines[0],'slides':lines[1:],'links':[{'id':'milo-return-end-'+key,'to':'card-milo-return-end','label':'Далее','labelUk':'Далі'}]};nodes.append(n)
nodes.append({'id':'card-milo-return-end','title':'Карта возвращается','titleUk':'Карта повертається','editorSceneId':reach['editorSceneId'],'x':reach['x']+950,'y':reach['y'],'kind':'dialogue',**page(hero,'Держи свои. Играем.','Тримай свої. Граємо.','emotion-1789852989293'),'slides':[],'links':[],'cardAction':{'kind':'returnCard'}})
crunch=by['card-story-crunch'];crunch['cardEvent']={'enabled':True,'phase':'board','boardCount':3,'minRound':5,'once':True,'requires':'guestJoined','silent':True,'afterRoundEvent':'card-social-reach-a'};crunch['cardAction']['sound']='assets/stories/audio/milo-first-crunch.wav'
by['card-story-card-missing']['cardEvent']={'enabled':True,'phase':'afterEvent','afterEventId':crunch['id'],'delaySeconds':1.2,'once':True,'requires':'guestJoined'}
e['minigames']['towerClaw'].update(guestGraceHands=3,guestLoanHands=2)
nodes.append({'id':'card-milo-credit','title':'Мило · ещё на раздачу','titleUk':'Мило · ще на роздачу','editorSceneId':reach['editorSceneId'],'x':reach['x'],'y':reach['y']+900,'kind':'dialogue',**page(m,'Ещё… одну можно? Монет мало.','Ще… одну можна? Монет мало.'),'slides':[page(f,'Ладно, скинулись тебе ещё на взнос. Только карты не лапай.','Гаразд, скинулися тобі ще на внесок. Тільки карти не лапай.')],'links':[],'cardEvent':{'enabled':True,'phase':'roundStart','once':True,'requires':'guestCredit'}})
ids={n['id'] for n in nodes};assert len(ids)==len(nodes)
for n in nodes:
 for l in n.get('links',[]):assert l.get('to') in ids or not l.get('to'),(n['id'],l)
for n in nodes:
 if n['id'].startswith('card-milo-return') or n['id']=='card-milo-credit':
  for p in [n]+n['slides']:assert p['emotion'] in e['speakers'][p['speaker']]['emotions']
with out.open('x') as file:json.dump(data,file,ensure_ascii=False,indent=2)
print(out)
