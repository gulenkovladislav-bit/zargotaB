'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const content=require('../spell-detail-content');
const t=(ru)=>ru;
const plain=(value)=>String(value||'');
const all=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data.json'),'utf8')).catalog;
const catalog=Array.isArray(all)?all:all.entries;
// Every populated catalog rule survives the presentation grouping verbatim.
for(const spell of catalog){
 const sections=content.sections(spell,plain,t),fields=Object.values(sections).flat();
 for(const key of ['effect','battle','learnText','description','manifestation']){
  if(spell[key]&&String(spell[key]).trim())assert.ok(fields.some(f=>f.body===String(spell[key]).trim()),spell.id+': lost '+key);
 }
 const restrictionFields=fields.filter(f=>['Требования и ограничения','Ограничения применения'].includes(f.heading));
 const canonical=(parts)=>parts.map(part=>part.replace(/\s+/g,' ').trim()).sort();
 assert.deepEqual(canonical(restrictionFields.flatMap(f=>content.restrictionParts(f.body))),canonical(content.restrictionParts(spell.restriction)),spell.id+': lost, changed or duplicated restriction');
 for(const optional of spell.optFields||[]){
  if(optional&&(optional.label||optional.text))assert.ok(fields.some(f=>f.heading===plain(optional.label).trim()&&f.body===plain(optional.text).trim()),spell.id+': lost optional rule');
 }
}
const sections=content.sections({effect:'Apply',learnText:'Learn',manifestation:'See',restriction:'Интеллект 2+',optFields:[{label:'Не более двух одновременно'}]},plain,t);
assert.deepEqual(sections.learn.map(f=>f.body),['Learn','Интеллект 2+']);
assert.deepEqual(sections.description.map(f=>f.body),['See']);
assert.ok(!sections.use.some(f=>f.body==='Интеллект 2+'));
assert.ok(content.rules(sections.use).includes('Не более двух одновременно'));
for(const [name,key] of [['Сила','str'],['Ловкость','dex'],['Интеллект','int'],['Харизма','cha'],['Восприятие','per'],['Выносливость','con'],['Спритність','dex'],['Інтелект','int'],['Сприйняття','per'],['Витривалість','con']]){
 assert.ok(content.highlight(name+' 2+').includes('class="zgms-param stat-'+key+'">'+name+' 2+</span>'));
}
assert.deepEqual(content.requirements('Интеллект 2+. Не более 2 целей. Ловкость 3+.'),['Интеллект 2+','Ловкость 3+']);
assert.match(content.highlight('Сл 15, 1d4, 10 метров'),/>Сл 15<.*>1d4<.*>10 метров</);
assert.equal(content.highlight('<img src=x onerror="bad()">'),'&lt;img src=x onerror=&quot;bad()&quot;&gt;');
assert.equal(content.sections({learnType:'ritual',learnText:'Ritual'},plain,(ru,uk)=>uk).learn[0].heading,'Ритуал вивчення');
const mixed=content.sections({restriction:'📌 Требует Интеллекта 3+\n📌 Требует концентрации (при получении урона — проверка Интеллекта Сл 12)\n📌 Только на гуманоидов с Интеллектом 2+\n📘 Один персонаж может выучить не более 3 фолиантов\n📌 Не более двух целей',optFields:[{label:'Особенности изучения',text:'При провале изучения — 1d4 урона'},{label:'Ритуал активации',text:'Перед каждым использованием'},{label:'Изучение'}]},plain,t);
assert.ok(mixed.learn.some(f=>f.body.includes('Требует Интеллекта 3+')));
assert.ok(mixed.learn.some(f=>f.heading==='Особенности изучения'));
assert.ok(mixed.learn.some(f=>f.heading==='Изучение'&&!f.body),'label-only optional learning rule survives');
assert.ok(mixed.use.some(f=>f.body.includes('Требует концентрации')&&f.body.includes('Только на гуманоидов')&&f.body.includes('Не более двух целей')));
assert.ok(mixed.use.some(f=>f.heading==='Ритуал активации'));
for(const value of ['📌 Вимагає Інтелекту 3+','📌 Сумісність: лише персонажі з Харизмою 2+','📌 Не більше 3 фоліантів'])assert.equal(content.restrictionGroup(value),'learn',value);
for(const value of ['📌 Не працює під водою','📌 Потребує концентрації','📌 Лише на істот з Інтелектом 2+'])assert.equal(content.restrictionGroup(value),'use',value);
assert.equal(content.restrictionGroup('📌 Неизвестный формат нового требования'),'learn');
const vm=require('node:vm'),sandbox={window:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../character-mobile-skills.js'),'utf8'),sandbox);
for(const cd of ['2 применения до долгого отдыха','2 использования до долгого отдыха','2 застосування до довгого відпочинку','2 використання до довгого відпочинку','2 заряда максимум']){
 const r=sandbox.window.ZargotaMobileSkills.resource({id:5,cd},{spellCD:{5:{used:1}}},true);
 assert.equal(r.max,2,cd);assert.equal(r.remaining,1,cd);assert.equal(r.text,cd);
}
console.log('PASS: all catalog rule fields preserved; three sections; RU/UK six stats, thresholds, dice and safe escaping');
