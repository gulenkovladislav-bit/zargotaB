"""Rebuild the local source index from archived Miro SVG; no network or board writes."""
from pathlib import Path
import hashlib
import html
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
BASE = 'https://miro.com/app/board/uXjVIs7ths0=/'
items = {}
files = []
for path in sorted(ROOT.glob('source-*.svg')):
    raw = path.read_text()
    files.append({'file': path.name, 'sha256': hashlib.sha256(raw.encode()).hexdigest()})
    for el in ET.fromstring(raw).iter():
        item_id = el.get('data-miro-id')
        if not item_id:
            continue
        table = next((x for x in el.iter() if x.tag.split('}')[-1] == 'table'), None)
        if table is not None:
            rows = []
            for row in table.iter():
                if row.tag.split('}')[-1] == 'tr':
                    rows.append(' | '.join(' '.join(cell.itertext()).strip() for cell in row))
            content = '\n'.join(rows)
        else:
            content = html.unescape(' '.join(el.itertext()))
            content = re.sub(r'<br\s*/?>|</p>|</li>', '\n', content)
            content = re.sub(r'<[^>]+>', '', content)
        content = re.sub(r'\n\s*\n+', '\n\n', content).strip()
        row = items.setdefault(item_id, {
            'id': item_id, 'type': el.tag.split('}')[-1],
            'title': el.get('data-title', ''), 'text': content,
            'source_files': [], 'url': BASE + '?moveToWidget=' + item_id,
        })
        if content != row['text']:
            raise ValueError('Conflicting snapshots of item ' + item_id)
        row['source_files'].append(path.name)
items = sorted(items.values(), key=lambda x: x['id'])
(ROOT / 'items.json').write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n')
manifest = json.loads((ROOT / 'manifest.json').read_text())
extra = json.loads((ROOT / 'search-extra.json').read_text())
expected = {x['id'] for x in manifest['areas'] + extra['results'] if x.get('id')}
actual = {x['id'] for x in items}
missing = sorted(expected - actual)
if missing:
    raise ValueError('Missing selected items: ' + ', '.join(missing))
stats = {
    'unique_items': len(items), 'items_with_text': sum(bool(x['text']) for x in items),
    'selected_unique_ids': len(expected), 'missing_selected_ids': missing,
    'board_total_at_overview': 3407, 'exhaustive_board_export': False, 'files': files,
}
(ROOT / 'coverage.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2) + '\n')
lines = ['# Каталог источников / Каталог джерел', '',
         'RU: Исходные заголовки и тексты сохранены на языке доски. Это архив источников, не перевод и не подтверждение канона.', '',
         'UK: Вихідні заголовки й тексти збережені мовою дошки. Це архів джерел, не переклад і не підтвердження канону.', '',
         f"Объектов / Об’єктів: {len(items)}; с текстом / з текстом: {stats['items_with_text']}. "
         'Выборочный снимок / Вибірковий знімок.', '',
         '[Карта сюжетов / Мапа сюжетів](../MIRO_STORY_ATLAS.md)', '',
         '| ID | Исходное название или начало / Вихідна назва або початок |', '|---|---|']
for row in items:
    title = row['title'] or (row['text'].splitlines()[0] if row['text'] else row['type'])
    title = title[:150].replace('|', '\\|').replace('[', '\\[').replace(']', '\\]')
    lines.append(f"| [{row['id']}]({row['url']}) | {title} |")
(ROOT / 'SOURCE_INDEX.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({k: v for k, v in stats.items() if k != 'files'}, ensure_ascii=False))
