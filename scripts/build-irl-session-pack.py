#!/usr/bin/env python3
"""Rebuild the browser bundle and RU/UK reading copies from the session JSON."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
pack=json.loads((root/'story-content/irl/morelesye-session.json').read_text())
(root/'js/irl-morelesye-data.js').write_text('/* Generated from story-content/irl/morelesye-session.json. GM-only source pack. */\nwindow.ZG_MORELESYE_PACK = '+json.dumps(pack,ensure_ascii=False,indent=2)+';\n')
# A separate reading copy, generated from the same bilingual source to prevent drift.
for locale,name in [('ru','MORELESYE_SESSION_RU.md'),('uk','MORELESYE_SESSION_UK.md')]:
 labels={'ru':['Памятка мастера','Материал доски — план, если явно не сказано, что эпизод сыгран. Манеры отыгрыша — рабочие рекомендации. Все секреты только для мастера.','Персонажи','Цель','Отыгрыш','Знает','Секрет / граница знания','Механика из источника','Источник','Встречи','Когда','Что видно','Развитие','Тайна мастера'],'uk':['Пам’ятка Майстра','Матеріал дошки — план, якщо явно не сказано, що епізод зіграно. Манери відіграшу — робочі рекомендації. Усі таємниці лише для Майстра.','Персонажі','Мета','Відіграш','Знає','Таємниця / межа знання','Механіка з джерела','Джерело','Зустрічі','Коли','Що видно','Розвиток','Таємниця Майстра']}[locale]
 out=['# '+labels[0]+': '+pack['title'][locale],labels[1]]
 for b in pack['briefing']:out+=['## '+b['title'][locale],b['body'][locale],labels[8]+': '+b['source']]
 out+=['## '+labels[2]]
 for n in pack['npc']:
  out+=['### '+n['name'][locale]+' · '+n['status']]
  for field,label in [('goal',3),('play',4),('knows',5),('secret',6),('combat',7)]:
   if n.get(field):out+=['**'+labels[label]+'.** '+n[field][locale]]
  out+=[labels[8]+': '+n['source']]
 out+=['## '+labels[9]]
 for n in pack['encounters']:
  out+=['### '+n['title'][locale]+' · '+n['status']]
  for field,label in [('trigger',10),('visible',11),('options',12),('secret',13)]:out+=['**'+labels[label]+'.** '+n[field][locale]]
  out+=[labels[8]+': '+n['source']]
 (root/'lore'/name).write_text('\n\n'.join(out)+'\n')
print(len(pack['npc']),'NPC;',len(pack['encounters']),'encounters')
