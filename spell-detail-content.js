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
 function sections(sp,translate,t){
  function field(ru,uk,value){return {heading:t(ru,uk),body:translate(value||'').trim()};}
  var learningLabels={study:['Изучение','Вивчення'],train:['Тренировка','Тренування'],ritual:['Ритуал изучения','Ритуал вивчення']},learning=learningLabels[sp.learnType]||learningLabels.study;
  var result={use:[field('Эффект','Ефект',sp.effect),field('В бою','У бою',sp.battle)],learn:[field(learning[0],learning[1],sp.learnText)],description:[field('Описание','Опис',sp.description),field('Проявление','Прояв',sp.manifestation)]};
  // Optional field titles may themselves contain an entire rule. Never discard them.
  (sp.optFields||[]).forEach(function(f){if(f)result.use.push({heading:translate(f.label||'').trim(),body:translate(f.text||'').trim()});});
  result.use.push(field('Ограничения','Обмеження',sp.restriction));
  Object.keys(result).forEach(function(key){result[key]=result[key].filter(function(f){return f.body||key==='use'&&f.heading&&!['Эффект','Ефект','В бою','У бою','Ограничения','Обмеження'].includes(f.heading);});});
  return result;
 }
 function rules(fields){return fields.map(function(f){return '<section class="zgms-rule">'+(f.heading?'<h3>'+escape(f.heading)+'</h3>':'')+(f.body?f.body.split(/\n+/).map(function(line){return '<p>'+highlight(line)+'</p>';}).join(''):'')+'</section>';}).join('');}
 function requirements(value){var re=new RegExp('(?<![\\p{L}])(?:'+statPattern+')\\s*[:—-]?\\s*\\d+\\s*\\+','giu');return Array.from(new Set(String(value||'').match(re)||[]));}
 var api={highlight:highlight,sections:sections,rules:rules,requirements:requirements};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaSpellDetailContent=api;
})(typeof window==='object'?window:globalThis);
