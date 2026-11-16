/* Presentation only: retain catalog wording and distinguish reading from learning. */
(function(root){
 'use strict';
 function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 var stats=[['str','сил(?:а|ы|у|ой|ою|і|и|ою)'],['dex','(?:ловкост(?:ь|и|ью)|спритн(?:ість|ості|істю))'],['int','(?:интеллект(?:а|у|ом|е)?|інтелект(?:у|ом|і)?)'],['cha','харизм(?:а|ы|у|ой|и|ою|і)'],['per','(?:восприяти(?:е|я|ю|ем|и)|сприйнятт(?:я|ю|ям|і))'],['con','(?:выносливост(?:ь|и|ью)|витривал(?:ість|ості|істю))']];
 var statPattern=stats.map(function(x){return x[1];}).join('|');
 var tokens=new RegExp('(?<![\\p{L}])(?:(?:'+statPattern+')(?:\\s*[:—-]?\\s*\\d+\\s*\\+)?|(?:Сл|КС|DC)\\s*[:.]?\\s*\\d+(?:\\s*\\+\\s*(?:'+statPattern+'))?|[+−-]?\\d+(?:[dдк]\\d+)?(?:\\s*[–—-]\\s*\\d+)?(?:\\s*(?:метр[а-яіїєґ]*|раунд[а-яіїєґ]*|ход[а-яіїєґ]*|хід|хвилин[а-яіїєґ]*|минут[а-яіїєґ]*|час(?:а|ов)?|годин[а-яіїєґ]*|секунд[а-яіїєґ]*|HP|ОЗ|%))?)(?![\\p{L}])','giu');
 function highlight(value){
  var str=String(value==null?'':value),out='',last=0;
  for(var match of str.matchAll(tokens)){
   var stat=stats.find(function(x){return new RegExp('^(?:'+x[1]+')(?![\\p{L}])','iu').test(match[0]);});
   out+=escape(str.slice(last,match.index))+'<span class="'+(stat?'zgms-param stat-'+stat[0]:'zgms-number')+'">'+escape(match[0])+'</span>';last=match.index+match[0].length;
  }
  return out+escape(str.slice(last));
 }
 function restrictionGroup(value){
  var s=String(value||'').replace(/^[^\p{L}]+/u,'').replace(/\s+/g,' ').trim();
  // Eligibility is stated explicitly in the catalog; a target's stat is not a caster prerequisite.
  if(/совместим|сумісн|выуч|изуч|обуч|вивч|навчан|память тела|пам.ять тіла/i.test(s))return 'learn';
  if(/(?:фолиант|фоліант|обрядник|кодекс|ритуальник|ритуалов|ритуалів)/i.test(s)&&/(?:не более|не більше|до \d|лимит|ліміт|один персонаж)/i.test(s))return 'learn';
  if(/^(?:только|тільки|лише)\s+(?:для\s+)?персонаж/i.test(s))return 'learn';
  if(/^(?:(?:требует|требуется|потребує|вимагає|потрібн[аоі]?)\s+)?(?:сил[аыіу]|ловкост|спритн|интеллект|інтелект|харизм|восприяти|сприйнятт|вынослив|витривал|телослож|связ[ьи] с природ|зв[’']яз\S* [із]+ природ)/i.test(s))return 'learn';
  if(/^(?:не |нельзя|не можна|неможливо|работает|працює|діє|можно |можна |повторн|после |після |если |якщо |цель |ціль |концентрац|применение |застосування |уничтожение|знищення|разрушение|руйнування)/i.test(s))return 'use';
  if(/^(?:только|тільки|лише)\s+(?:один|одна|одно|одне|1|против|проти|на |для обычных|для звичайних|для немаг|мелкие|дрібні)/i.test(s))return 'use';
  if(/(?:оруж|збро|стрел|стріл|брон|досп|противник|супротивник|цель|цели|целям|целей|ціл[іь]|существ|істот|свободн.*простран|вільн.*прост|заклинатель.*страдает|заклинач.*страждає|один предмет|одне тіло|одно тело|активн.*(?:аспект|конструкт)|аспект.*актив|иллюзия не|ілюзія не)/i.test(s))return 'use';
  if(/концентрац|лук|арбалет|при получении урона|при отриманні шкоди|не срабатывает|не спрацьовує|любое действие|будь-яка дія|нельзя|неможливо|невозможно|не различает|не розрізняє/i.test(s))return 'use';
  // Unknown future formats remain visible under learning rather than guessed into combat rules.
  return 'learn';
 }
 function restrictionParts(value){
  return String(value||'').split(/(?=📌)|(?<=[\n\u2028])(?=📘)/).map(function(part){return part.trim();}).filter(Boolean);
 }
 function sections(sp,translate,t){
  function field(ru,uk,value){return {heading:t(ru,uk),body:translate(value||'').trim()};}
  var learningLabels={study:['Изучение','Вивчення'],train:['Тренировка','Тренування'],ritual:['Ритуал изучения','Ритуал вивчення']},learning=learningLabels[sp.learnType]||learningLabels.study;
  var result={use:[field('Эффект','Ефект',sp.effect),field('В бою','У бою',sp.battle)],learn:[field(learning[0],learning[1],sp.learnText)],description:[field('Описание','Опис',sp.description),field('Проявление','Прояв',sp.manifestation)]};
  Object.keys(result).forEach(function(key){result[key]=result[key].filter(function(f){return f.body;});});
  // Optional field titles may themselves contain an entire rule. Never discard them.
  (sp.optFields||[]).forEach(function(f){if(f){var entry={heading:translate(f.label||'').trim(),body:translate(f.text||'').trim()},group=/изуч|обуч|вивч|навчан/i.test(entry.heading)?'learn':'use';if(entry.heading||entry.body)result[group].push(entry);}});
  var restrictions={use:[],learn:[]};restrictionParts(translate(sp.restriction||'')).forEach(function(part){restrictions[restrictionGroup(part)].push(part);});
  if(restrictions.learn.length)result.learn.push({heading:t('Требования и ограничения','Вимоги та обмеження'),body:restrictions.learn.join('\n')});
  if(restrictions.use.length)result.use.push({heading:t('Ограничения применения','Обмеження застосування'),body:restrictions.use.join('\n')});
  return result;
 }
 function rules(fields){return fields.map(function(f){return '<section class="zgms-rule">'+(f.heading?'<h3>'+escape(f.heading)+'</h3>':'')+(f.body?f.body.split(/\n+/).map(function(line){return '<p>'+highlight(line)+'</p>';}).join(''):'')+'</section>';}).join('');}
 function requirements(value){var re=new RegExp('(?<![\\p{L}])(?:'+statPattern+')\\s*[:—-]?\\s*\\d+\\s*\\+','giu');return Array.from(new Set(String(value||'').match(re)||[]));}
 var api={highlight:highlight,sections:sections,rules:rules,requirements:requirements,restrictionGroup:restrictionGroup,restrictionParts:restrictionParts};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaSpellDetailContent=api;
})(typeof window==='object'?window:globalThis);
