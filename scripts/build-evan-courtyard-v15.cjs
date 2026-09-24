'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../story-content/evan');
const original=fs.readFileSync(path.join(dir,'episode-1-courtyard-v14.json'),'utf8');
let text=original;
const changes=new Map();
for(const slug of ['broken-counter','lodestone-fragment']){
 changes.set(`assets/stories/Evan/inspections/${slug}-v1.png`,`assets/stories/Evan/inspections/${slug}-v2.png`);
 changes.set(`assets/stories/Evan/objects/${slug}-icon-v1.png`,`assets/stories/Evan/objects/${slug}-icon-v2.png`);
}
changes.set('Фельцер раскрывает ладонь. Из треснувшего корпуса выглядывают шестерёнки.','Фельцер раскрывает ладонь. На ней крошечная деревянная коробочка с надколотым колёсиком.');
changes.set('Фельцер розкриває долоню. Із тріснутого корпусу визирають шестірні.','Фельцер розкриває долоню. На ній крихітна дерев’яна коробочка з надщербленим коліщатком.');
changes.set('На ладони Пена лежит тёмный обломок. Два ржавых гвоздя держатся прямо на камне.','На ладони Пена лежит маленький тёмный обломок. К нему прилип ржавый гвоздик.');
changes.set('На долоні Пена лежить темний уламок. Два іржаві цвяхи тримаються просто на камені.','На долоні Пена лежить маленький темний уламок. До нього прилип іржавий цвяшок.');
changes.set('Карманный счётчик оборотов лебёдки. Корпус треснул, шестерёнка заедает. Пока принадлежит Фельцеру.','Крошечный счётчик с лебёдки: грубая деревянная коробочка с заедающим колёсиком. Пока принадлежит Фельцеру.');
changes.set('Кишеньковий лічильник обертів лебідки. Корпус тріснув, шестірню заклинює. Поки належить Фельцеру.','Крихітний лічильник із лебідки: груба дерев’яна коробочка з коліщатком, яке заклинює. Поки належить Фельцеру.');
changes.set('Тёмный тяжёлый обломок, притягивающий железо. Пока принадлежит Пену.','Маленький невзрачный обломок, притягивающий гвоздик. Пока принадлежит Пену.');
changes.set('Темний важкий уламок, що притягує залізо. Поки належить Пену.','Маленький непоказний уламок, що притягує цвяшок. Поки належить Пену.');
for(const [from,to] of changes){assert(text.includes(from),`Missing source: ${from}`);text=text.split(from).join(to);}
const out=JSON.parse(text),base=JSON.parse(original);
for(const key of ['scenes','scene','quests','speakers','interactions','player'])assert.deepEqual(out.episode[key],base.episode[key],key);
for(const node of out.episode.nodes){const prior=base.episode.nodes.find(n=>n.id===node.id);assert.deepEqual(node.links,prior.links);}
fs.writeFileSync(path.join(dir,'episode-1-courtyard-v15.json'),text);
console.log('v15: four image paths and bilingual visual descriptions only; story state preserved');
