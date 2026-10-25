"""Patch a fresh exchange envelope; preserve dialogue and non-character objects."""
import copy
import json
import sys
from pathlib import Path

BASE = 'assets/stories/Evan/university/crowd/'
PEOPLE = [
    ('elf-man', 'Студент-эльф', 'Студент-ельф'),
    ('elf-woman', 'Студентка-эльфийка', 'Студентка-ельфійка'),
    ('dwarf-apprentice', 'Студент-дворф в фартуке', 'Студент-дворф у фартусі'),
    ('dwarf-scholar', 'Студент-дворф', 'Студент-дворф'),
    ('human-woman', 'Студентка', 'Студентка'),
    ('human-man', 'Студент', 'Студент'),
]
POSITIONS = {
    'magic': [(39, 55), (45, 57), (64, 63), (69, 60), (39, 85), (62, 80)],
    'engineering': [(43, 58), (63, 90), (48, 60), (39, 85), (72, 91), (49, 91)],
}
ROUTES = {
    'magic': {4: [[39, 85], [45, 89]], 5: [[62, 80], [60, 70], [62, 57]]},
    'engineering': {1: [[63, 90], [69, 94], [81, 94]], 5: [[49, 91], [45, 80], [43, 70]]},
}

def patch(episode):
    before = copy.deepcopy(episode)
    removed = []
    for key in ('magic', 'engineering', 'botany', 'military'):
        record = next(s for s in episode['scenes'] if s['id'] == 'scene-evan-v25-' + key)
        scene = record['scene']
        old = [t for t in scene['tokens'] if t['id'].startswith('campus26-' + key + '-person-')]
        removed.extend(t['id'] for t in old)
        scene['tokens'] = [t for t in scene['tokens'] if t not in old and not t['id'].startswith('campus-crowd-')]
        for i, (slug, ru, uk) in enumerate(PEOPLE if key in POSITIONS else []):
            x, y = POSITIONS[key][i]
            speaker = 'campus-crowd-' + slug
            dialogue_slug = slug + '-dialogue' if slug in ('elf-man', 'dwarf-scholar', 'human-woman') else slug
            episode['speakers'][speaker] = {
                'name': ru, 'nameUk': uk, 'portrait': BASE + dialogue_slug + '-v1.png',
                'emotions': {}, 'campusDraft': True,
            }
            token = {'id': 'campus-crowd-' + key + '-' + slug, 'type': 'custom',
                     'name': ru, 'nameUk': uk, 'image': BASE + slug + '-v1.png',
                     'speaker': speaker, 'x': x, 'y': y, 'size': 46,
                     'visible': True, 'bakedFrame': True, 'markerVisible': False}
            if i in ROUTES[key]:
                token['ambientMotion'] = {'enabled': True, 'kind': 'pedestrian', 'mode': 'pingpong',
                                          'points': ROUTES[key][i], 'duration': 38 + i * 3,
                                          'gap': 0, 'random': True, 'trails': True}
            scene['tokens'].append(token)
    for token_id in removed:
        episode.get('interactions', {}).pop(token_id, None)
    active = next((s for s in episode['scenes'] if s['id'] == episode.get('activeSceneId')), None)
    if active:
        episode['scene'] = copy.deepcopy(active['scene'])
    assert episode['nodes'] == before['nodes'], 'Authored dialogue must remain unchanged'
    targets = {'scene-evan-v25-' + k for k in ('magic', 'engineering', 'botany', 'military')}
    for old, new in zip(before['scenes'], episode['scenes']):
        if old['id'] not in targets:
            assert old == new
        else:
            for field in old['scene']:
                if field != 'tokens':
                    assert old['scene'][field] == new['scene'][field], field
            assert next(t for t in old['scene']['tokens'] if t['id'] == episode['heroTokenId']) == next(t for t in new['scene']['tokens'] if t['id'] == episode['heroTokenId'])
            assert [t for t in old['scene']['tokens'] if t.get('type') == 'note'] == [t for t in new['scene']['tokens'] if t.get('type') == 'note']
    return removed

if __name__ == '__main__':
    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    removed = patch(data['episode'])
    for slug, _, _ in PEOPLE:
        assert Path(BASE + slug + '-v1.png').is_file()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Removed {len(removed)} old character tokens; added 6 students per active courtyard. Dialogue preserved.')
