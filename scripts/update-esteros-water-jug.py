"""Apply only the reviewed water-jug fragment to a fresh episode-exchange snapshot."""
import copy
import json
import sys
from pathlib import Path

target = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
document = json.loads(target.read_text())
episode = document['episode']
reference = json.loads((root / 'story-content/esteros/episode-1-food-search-v1.json').read_text())['episode']

for owner, source, key in [(episode, reference, 'storyItems'),
                            (episode['player'], reference['player'], 'inventoryItems')]:
    expected = next(i for i in source[key] if i['itemId'] == 'esteros-water-jug')
    current = next((i for i in owner[key] if i['itemId'] == expected['itemId']), None)
    if current is None:
        owner[key].append(copy.deepcopy(expected))
    elif current != expected:
        raise SystemExit('Jug already exists with different author settings; compare before applying.')

node = next(n for n in episode['nodes'] if n['id'] == 'food-water')
reviewed = next(n for n in reference['nodes'] if n['id'] == 'food-water')
for key in ['sound', 'afterWorldActions', 'text', 'textUk', 'slides']:
    if node.get(key) != reviewed.get(key):
        raise SystemExit('Water dialogue changed; compare before applying. No dialogue or coordinates were saved.')

repeat = next(n for n in episode['nodes'] if n['id'] == 'food-water-repeat')
for field in ['title', 'text']:
    repeat[field] = repeat[field].replace('Котелок', 'Кувшин')
for field in ['titleUk', 'textUk']:
    repeat[field] = repeat[field].replace('Казанок', 'Глечик')

target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
print('Checked reviewed collection flow and patched jug items only; author coordinates preserved.')
