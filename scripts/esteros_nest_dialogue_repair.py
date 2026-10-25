"""Narrow, guarded repair of the nest discovery. Never rebuild the episode."""
import argparse
import copy
import json
from pathlib import Path

SCENE = 'scene-esteros-food-channel'


def repair(episode):
    e = copy.deepcopy(episode)
    by_id = {n['id']: n for n in e['nodes']}
    nest = by_id['food-nest']
    old = ('Яйца. И змея рядом — почти одного цвета с корой.',
           'Яйця. І змія поруч — майже одного кольору з корою.')
    new = ('Три яйца… Одно маме, одно мне. Ещё и на утро останется.',
           'Три яйця… Одне мамі, одне мені. Ще й на ранок лишиться.')
    old_page = ('Руку туда не суну. Пока она здесь, лучше подождать.',
                'Руку туди не суну. Поки вона тут, краще зачекати.')
    new_page = ('Что там блеснуло?.. Нет. Темно, не разглядеть.',
                'Що там блиснуло?.. Ні. Темно, не роздивитися.')
    if (nest.get('text'), nest.get('textUk')) not in (old, new):
        raise ValueError('Author changed food-nest: review fresh text before editing')
    pages = nest.get('slides', [])
    if len(pages) != 1 or (pages[0].get('text'), pages[0].get('textUk')) not in (old_page, new_page):
        raise ValueError('Author changed nest pages: review before editing')
    cfg = e.get('minigames', {}).get('snakeReach', {})
    if not cfg.get('enabled') or cfg.get('startNodeId') != 'food-eggs-reach':
        raise ValueError('Snake minigame configuration differs; do not bypass it')
    choice = next(l for l in nest['links'] if l['id'] == 'food-nest-0')
    if choice.get('to') not in ('food-snake-wait', 'food-eggs-reach'):
        raise ValueError('Author changed nest choice')
    nest['text'], nest['textUk'] = new
    nest['title'], nest['titleUk'] = 'Яйца под корнем', 'Яйця під коренем'
    nest['emotion'] = 'hopeful'
    pages[0]['text'], pages[0]['textUk'] = new_page
    pages[0]['emotion'] = 'worried'
    choice.update(to='food-eggs-reach', label='Попробовать достать яйца', labelUk='Спробувати дістати яйця')
    # Preserve the old nodes for author reference, but remove both automatic routes.
    record = next(s for s in e['scenes'] if s['id'] == SCENE)
    story = record['scene'].setdefault('story', {})
    if story.get('firstVisitDialogueId') == 'food-channel-arrival':
        story.pop('firstVisitDialogueId')
    for n in e['nodes']:
        for link in n.get('links', []):
            if link.get('sceneId') == SCENE and link.get('to') == 'food-channel-arrival':
                link['to'] = ''
    active = next(s for s in e['scenes'] if s['id'] == e['activeSceneId'])
    e['scene'] = copy.deepcopy(active['scene'])
    return e


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file')
    args = parser.parse_args()
    path = Path(args.file)
    document = json.loads(path.read_text())
    document['episode'] = repair(document['episode'])
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    print(path)
