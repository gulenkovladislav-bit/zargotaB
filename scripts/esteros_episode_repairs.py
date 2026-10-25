"""Targeted, repeatable repairs to the live Esteros episode; never rebuild its graph."""
import argparse, copy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BASE = 'assets/stories/portraits/Portraits/ChatGPT Image 9 сент. 2026 г., '

def repair(e):
    hero = e['heroTokenId']
    speaker = e['speakers']['esteros-child-thoughts']
    # Existing authored portrait set; no generated walking sprite.
    emotions = {
        'tense': ('Напряжение', 'Напруження', '21_24_20 (2).png'),
        'worried': ('Тревога', 'Тривога', '21_24_21 (3).png'),
        'sad': ('Печаль', 'Смуток', '21_24_21 (4).png'),
        'doubtful': ('Недоверие', 'Недовіра', '21_24_22 (6).png'),
        'hopeful': ('Слабая улыбка', 'Легка усмішка', '21_24_23 (7).png')}
    for key,(ru,uk,file) in emotions.items():
        speaker.setdefault('emotions',{}).setdefault(key,dict(name=ru,nameUk=uk,portrait=BASE+file,position='50% 50%',zoom=1))
    for scene in [e.get('scene',{})]+[r['scene'] for r in e['scenes']]:
        for token in scene.get('tokens',[]):
            if token['id']==hero and token.get('image','').endswith('/walking-draft.png'):
                token['image']=speaker['portrait']; token['size']=80; token.pop('renderMode',None)
    nodes={n['id']:n for n in e['nodes']}
    # Replace only rejected boilerplate; keep unrelated author's revisions intact.
    descriptions={
      'moss': [('Моховое. До него идти через всё болото. Сколько бы я там ни нашёл, назад придётся возвращаться затемно.','Мохове. До нього йти через усе болото. Хоч би скільки я там знайшов, назад доведеться повертатися поночі.')],
      'quiet': [('Тихая Гать. Дома тянутся вдоль одной дороги. Должно быть, там тоже смотрят, кто идёт мимо, — не принёс ли чего.','Тиха Гать. Хати тягнуться вздовж однієї дороги. Мабуть, там теж придивляються до перехожих — чи не приніс хто чогось.')],
      'reeds': [('Камышовка у самой реки. Можно подумать: воды столько — уж рыбы-то должно хватать.','Комишівка біля самої річки. Можна подумати: стільки води — риби ж має вистачати.'),('Только у нас тоже река рядом. А я опять ищу, что положить в котелок.','Тільки в нас теж річка поруч. А я знову шукаю, що покласти в казанок.')],
      'bay': [('Бухта Яровец. Мама даже причалы нарисовала — тоненькие палочки у берега.','Бухта Яровець. Мама навіть причали намалювала — тоненькі палички біля берега.'),('Оттуда лодки выходят в большую воду. Я смотрю на них на карте и всё думаю: каково это — когда под тобой уже нет дна, до которого можно достать?','Звідти човни виходять на велику воду. Дивлюся на них на мапі й думаю: як це — коли під тобою вже немає дна, до якого можна дістати?')]
    }
    for key,pages in descriptions.items():
        n=nodes.get('esteros-map-'+key)
        if n and ('Мамины маленькие крыши' in n.get('text','') or 'Мамині маленькі дахи' in n.get('textUk','')):
            n['text'],n['textUk']=pages[0]
            n['slides']=[dict(text=ru,textUk=uk,speaker=n['speaker'],showPortrait=True,portraitOverride=False) for ru,uk in pages[1:]]
    moods={
      'dialog-1':['sad','hopeful','doubtful','tense'],
      'esteros-map-memory':['hopeful','','','doubtful','sad'],
      'esteros-map-bridge':['sad','sad'], 'esteros-map-grey-gat':['','doubtful'],
      'esteros-map-kochary':['','tense'], 'esteros-map-home':['sad',''],
      'esteros-map-moss':['worried'], 'esteros-map-quiet':['sad'],
      'esteros-map-reeds':['doubtful','sad'], 'esteros-map-bay':['','doubtful'],
      'food-water':['sad','','tense'],'food-plan':['worried','','tense'],
      'food-cart':['tense','worried','worried','sad'], 'food-cart-repeat':['worried'],
      'food-bad-roots':['doubtful','tense'], 'food-rotten':['doubtful','sad'],
      'food-roots-find':['','tense'], 'food-roots-work':['tense',''],
      'food-roots-take':['','hopeful'], 'food-eggs-take':['tense',''],
      'food-nest':['worried','tense'], 'food-snake-wait':['tense','worried','worried'],
      'food-home':['','hopeful'], 'food-empty':['sad','sad']}
    for n in e['nodes']:
        if n.get('speaker')!='esteros-child-thoughts':continue
        sequence=moods.get(n['id'])
        if not sequence and n['id'].startswith('esteros-map-danger'):sequence=['worried','tense']
        if not sequence and n['id'].startswith('esteros-map-bandits'):sequence=['tense','doubtful']
        if not sequence and n['id'].startswith('food-'):sequence=['']
        if sequence:
            for i,page in enumerate([n]+n.get('slides',[])):
                page['emotion']=sequence[min(i,len(sequence)-1)];page['portraitOverride']=False
                page['showPortrait']=True
    shore=next(r['id'] for r in e['scenes'] if any(t['id']==hero for t in r['scene'].get('tokens',[])) and not r['id'].startswith('scene-esteros-food'))
    item=next(i for i in e['storyItems'] if i['itemId']=='esteros-mothers-map')
    for d in item['travelMap']['destinations']:
        if d['id'].startswith('food-'):
            key=d['id'][5:];d['sceneId']=shore if key=='shore' else 'scene-esteros-food-'+key
            d['marker']='location' if key=='shore' else 'search'
            # Nearby search sites, on the marsh bank below the bridge, in both map versions.
            x,y={'shore':(15.5,23),'roots':(23,23),'backwater':(19.5,30),'channel':(28,29)}[key]
            d.update(x=x,y=y,width=5,height=5)
            d['geometryUk']=dict(x=x,y=y+2,width=5,height=5.5)
    for i,other in enumerate(e['player']['inventoryItems']):
        if other['itemId']==item['itemId']:e['player']['inventoryItems'][i]=copy.deepcopy(item)
    return e

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();doc=json.loads(Path(args.source).read_text());repair(doc['episode'])
    Path(args.output).write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    print(args.output)
