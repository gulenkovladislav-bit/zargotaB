'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const content=require('../spell-detail-content');
const t=(ru)=>ru;
const plain=(value)=>String(value||'');
const all=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data.json'),'utf8')).catalog;
const catalog=Array.isArray(all)?all:all.entries;
const whitespace=(value)=>String(value||'').replace(/\s+/g,' ').trim();
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
 for(const field of fields){
  const paragraphs=content.paragraphs(field.body);
  assert.equal(whitespace(paragraphs.join(' ')),whitespace(field.body),spell.id+': presentation changed words or numbers');
  // Exported bullets remain paragraph starts; wrapped continuation lines may join them.
  for(const line of field.body.split(/[\n\r\u2028\u2029]/).map(x=>x.trim()).filter(x=>/^(?:[•→←✔✘❌📌📘]|\d+[.)]\s)/u.test(x))){
   assert.ok(paragraphs.some(p=>p.startsWith(line)),spell.id+': merged list item '+line);
  }
 }
}
const kara=catalog.find(s=>String(s.name).includes('Кара Небес'));
assert.equal(content.paragraphs(kara.description).length,1);
assert.ok(content.paragraphs(kara.description)[0].includes('Когда он в руке'));
assert.ok(content.paragraphs(kara.effect).some(p=>p.startsWith('Раунд 1')&&p.includes('Свет начинает мерцать')));
assert.ok(content.paragraphs(kara.effect).some(p=>p.startsWith('Раунд 2')));
assert.ok(content.paragraphs(kara.effect).some(p=>p.startsWith('• Все существа')&&p.includes('Спасбросок Ловкости')));
assert.deepEqual(content.paragraphs('Первое предложение\nпродолжается.\n\nНовый абзац.'),['Первое предложение продолжается.','Новый абзац.']);
assert.deepEqual(content.paragraphs('Параметры:\nСила\nЛовкость\nВыносливость'),['Параметры:','Сила','Ловкость','Выносливость']);
assert.deepEqual(content.paragraphs('Коли він у\nруці — чути грім.\n📌 Не діє під\nводою'),['Коли він у руці — чути грім.','📌 Не діє під водою']);
const sections=content.sections({effect:'Apply',learnText:'Learn',manifestation:'See',restriction:'Интеллект 2+',optFields:[{label:'Не более двух одновременно'}]},plain,t);
assert.deepEqual(sections.learn.map(f=>f.body),['Learn']);
assert.deepEqual(sections.description.map(f=>f.body),['See']);
assert.ok(sections.use.some(f=>f.body==='Интеллект 2+'));
assert.ok(content.rules(sections.use).includes('Не более двух одновременно'));
for(const [name,key] of [['Сила','str'],['Ловкость','dex'],['Интеллект','int'],['Харизма','cha'],['Восприятие','per'],['Выносливость','con'],['Спритність','dex'],['Інтелект','int'],['Сприйняття','per'],['Витривалість','con']]){
 assert.ok(content.highlight(name+' 2+').includes('class="zgms-param stat-'+key+'">'+name+' 2+</span>'));
}
assert.deepEqual(content.requirements('Интеллект 2+. Не более 2 целей. Ловкость 3+.'),['Интеллект 2+','Ловкость 3+']);
assert.match(content.highlight('Сл 15, 1d4, 10 метров'),/>Сл 15<.*>1d4<.*>10 метров</);
assert.equal(content.highlight('<img src=x onerror="bad()">'),'&lt;img src=x onerror=&quot;bad()&quot;&gt;');
assert.equal(content.sections({learnType:'ritual',learnText:'Ritual'},plain,(ru,uk)=>uk).learn[0].heading,'Ритуал вивчення');
const mixed=content.sections({restriction:'📌 Требует Интеллекта 3+\n📌 Требует концентрации (при получении урона — проверка Интеллекта Сл 12)\n📌 Только на гуманоидов с Интеллектом 2+\n📘 Один персонаж может выучить не более 3 фолиантов\n📌 Не более двух целей',optFields:[{label:'Особенности изучения',text:'При провале изучения — 1d4 урона'},{label:'Ритуал активации',text:'Перед каждым использованием'},{label:'Изучение'}]},plain,t);
assert.ok(!mixed.learn.some(f=>f.body.includes('Требует Интеллекта 3+')));
assert.ok(mixed.learn.some(f=>f.body.includes('может выучить не более 3 фолиантов')));
assert.ok(mixed.use.some(f=>f.body.includes('Требует Интеллекта 3+')));
assert.ok(mixed.learn.some(f=>f.heading==='Особенности изучения'));
assert.ok(mixed.learn.some(f=>f.heading==='Изучение'&&!f.body),'label-only optional learning rule survives');
assert.ok(mixed.use.some(f=>f.body.includes('Требует концентрации')&&f.body.includes('Только на гуманоидов')&&f.body.includes('Не более двух целей')));
assert.ok(mixed.use.some(f=>f.heading==='Ритуал активации'));
for(const value of ['📌 Не більше 3 вивчених фоліантів','📌 Повторне навчання можливе після відпочинку','📌 Один персонаж может знать не более 3 фолиантов'])assert.equal(content.restrictionGroup(value),'learn',value);
for(const value of ['📌 Вимагає Інтелекту 3+','📌 Сумісність: лише персонажі з Харизмою 2+','📌 Не більше 3 активних фоліантів','📌 Не працює під водою','📌 Потребує концентрації','📌 Лише на істот з Інтелектом 2+','📌 Совместимость: Сила 2+ или обученные в ближнем бою','📌 Можно выучить не более 3 кодексов, не совместимо с Хороводом теней'])assert.equal(content.restrictionGroup(value),'use',value);
assert.equal(content.restrictionGroup('📌 Неизвестный формат нового требования'),'use');
const vm=require('node:vm'),sandbox={window:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../character-mobile-skills.js'),'utf8'),sandbox);
for(const cd of ['2 применения до долгого отдыха','2 использования до долгого отдыха','2 застосування до довгого відпочинку','2 використання до довгого відпочинку','2 заряда максимум']){
 const r=sandbox.window.ZargotaMobileSkills.resource({id:5,cd},{spellCD:{5:{used:1}}},true);
 assert.equal(r.max,2,cd);assert.equal(r.remaining,1,cd);assert.equal(r.text,cd);
}
const captions={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../zargota-i18n-catalog-uk.js'),'utf8'),captions);
const uk=captions.window.ZargotaI18nCatalogUk;
for(const locale of ['ru','uk'])for(const spell of catalog){
 const tx=value=>locale==='uk'&&uk.reviewedEntryIds.includes(String(spell.id))?(uk.translations[value]||value):value;
 const caption=content.artCaption(spell,tx);
 assert.ok(caption.length>=16&&caption.length<=240,spell.id+': caption must remain short and complete');
 assert.ok([spell.description,spell.manifestation].some(source=>whitespace(tx(source)).includes(caption)),spell.id+': caption invented or changed source text');
}
assert.equal(content.artCaption({description:'Надпись: «Когда сталь рвёт\nплоть — пусть плоть ударит в ответ»',manifestation:'Маг сжимает руку.'},plain),'Когда сталь рвёт плоть — пусть плоть ударит в ответ');
assert.equal(content.artCaption({description:'Описаны «жгучие точки».',manifestation:'В 3.5 шагах воздух дрожит. Затем вспышка.'},plain),'В 3.5 шагах воздух дрожит.');
assert.equal(content.artCaption({description:'Камень хранит тепло огня.'},plain),'Камень хранит тепло огня.');
assert.equal(content.artCaption({}), '');
const longSentence='Туман '+('плотный '.repeat(40))+'окружает мага.';
assert.equal(content.artCaption({manifestation:longSentence},plain),longSentence);
console.log('PASS: all catalog rule fields preserved; three sections; RU/UK six stats, thresholds, dice and safe escaping');
