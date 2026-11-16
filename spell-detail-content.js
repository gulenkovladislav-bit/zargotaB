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
  var s=String(value||'').replace(/\s+/g,' ').trim();
  // Caster compatibility and stat thresholds are use requirements, per the author.
  // Keep mixed clauses visible during use rather than hiding an incompatibility.
  if(/не\s*совместим|не\s*сумісн/i.test(s))return 'use';
  if(/выуч|изуч|вивч|обучени[еяию]|навчанн/i.test(s))return 'learn';
  if(/(?:знать|знати).*(?:фолиант|фоліант|кодекс|обрядник)/i.test(s))return 'learn';
  // Unknown wording is never silently treated as an acquisition requirement.
  return 'use';
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
 function paragraphs(value){
  var output=[],buffer=[],previous='',plainList=false;
  function flush(){if(buffer.length)output.push(buffer.join(' '));buffer=[];}
  // Catalog exports contain both real list breaks and fixed-width prose wrapping.
  var lines=String(value||'').replace(/\r\n?/g,'\n').replace(/\u2028\n?/g,'\n').replace(/\u2029/g,'\n\n').split('\n');
  lines.forEach(function(raw){
   var line=raw.trim();if(!line){flush();previous='';plainList=false;return;}
   var marker=/^(?:[•→←↪➜✔✘✓✗❌✅☑▶►📌📘]|[-–—]\s+|[+−–-]\s*\d|\d+[.)]\s+|\d\uFE0F?\u20E3|\p{Extended_Pictographic})/u.test(line);
   // An em dash can also be a wrapped continuation of ordinary prose.
   if(/^—\s+\p{Ll}/u.test(line)&&!plainList)marker=false;
   var stage=/^(?:(?:Раунд|Рунд|Ход|Хід|Шаг|Крок|Этап|Етап|Фаза)\s+\d+|(?:HP|AC|ОЗ|КБ)\s*:)/iu.test(line);
   var afterLabel=/:$/.test(previous),shortListItem=plainList&&previous.length<56&&!/(?:\s|^)(?:в|на|и|і|й|или|або|с|з|из|із|для|до|от|від|по|под|під|при|та)$/iu.test(previous);
   if(marker||stage||afterLabel||shortListItem)flush();
   buffer.push(line);
   if(marker||stage)plainList=false;else if(afterLabel)plainList=true;
   if(/[.!?]$/.test(line))plainList=false;
   previous=line;
  });
  flush();return output;
 }
 function rules(fields){return fields.map(function(f){return '<section class="zgms-rule">'+(f.heading?'<h3>'+escape(f.heading)+'</h3>':'')+(f.body?paragraphs(f.body).map(function(line){return '<p>'+highlight(line)+'</p>';}).join(''):'')+'</section>';}).join('');}
 function requirements(value){var re=new RegExp('(?<![\\p{L}])(?:'+statPattern+')\\s*[:—-]?\\s*\\d+\\s*\\+','giu');return Array.from(new Set(String(value||'').match(re)||[]));}
 var personalTerms={
  benefit:'преимуществ[\\p{L}]*|переваг[\\p{L}]*',
  danger:'помех[\\p{L}]*|перешкод[\\p{L}]*|штраф[\\p{L}]*',
  limit:'не\\s+(?:действует|діє|працює|спрацьовує)|требует|потребує|максимум',
  check:'провер[\\p{L}]*|перевір[\\p{L}]*|спасброс[\\p{L}]*|рятівн[\\p{L}]*'
 };
 var personalStatPattern='(?:'+statPattern+')(?:\\s*[:—-]?\\s*(?:\\d+\\s*\\+|[+−–-]\\s*\\d+))?';
 var personalTokens=new RegExp('(?<![\\p{L}\\p{N}])(?:'+personalStatPattern+'|(?:Сл|КС|DC)\\s*[:.]?\\s*\\d+(?:\\s*[–—-]\\s*\\d+)?\\+?|[+−–-]?(?:\\d+)?[dдк]\\d+|[+−–-]?\\d+(?:\\s*[–—-]\\s*\\d+)?(?:\\s*(?:метр[\\p{L}]*|м|клет[\\p{L}]*|клітин[\\p{L}]*|раунд[\\p{L}]*|ход[\\p{L}]*|хід|хвилин[\\p{L}]*|минут[\\p{L}]*|час(?:а|ов)?|годин[\\p{L}]*|секунд[\\p{L}]*|HP|хп|ОЗ|%))?|'+Object.keys(personalTerms).map(function(k){return personalTerms[k];}).join('|')+')(?![\\p{L}\\p{N}])','giu');
 function highlightPersonal(value){
  var str=String(value==null?'':value),out='',last=0;
  for(var match of str.matchAll(personalTokens)){
   var stat=stats.find(function(x){return new RegExp('^(?:'+x[1]+')(?![\\p{L}])','iu').test(match[0]);});
   var term=Object.keys(personalTerms).find(function(k){return new RegExp('^(?:'+personalTerms[k]+')$','iu').test(match[0]);});
   var cls=stat?'zgms-param stat-'+stat[0]:term?'zgms-rule-key key-'+term:/^(?:Сл|КС|DC)/i.test(match[0])?'zgms-number zgms-difficulty':'zgms-number';
   out+=escape(str.slice(last,match.index))+'<span class="'+cls+'">'+escape(match[0])+'</span>';last=match.index+match[0].length;
  }
  return out+escape(str.slice(last));
 }
 function personalRules(value){
  var sections=[],current=null;
  function begin(label,tone){current={label:label||'',tone:tone||'neutral',items:[]};sections.push(current);}
  function tone(label){
   if(/^(?:бонус|переваг|успех|успіх)/iu.test(label))return 'benefit';
   if(/^(?:минус|мінус|провал|невдач|побочн|побічн)/iu.test(label))return 'danger';
   if(/огранич|обмеж|услови|умов/iu.test(label))return 'limit';
   if(/провер|перевір|спасброс|рятівн/iu.test(label))return 'check';
   if(/фраза|ролевая|рольова|описание злобы|опис люті/iu.test(label))return 'roleplay';
   return 'neutral';
  }
  function add(kind,text,label,accent){if(!current)begin();current.items.push({kind:kind,text:text,label:label||'',tone:accent||''});}
  var labels=/^(?:суть|фраза|бонус|минус(?:\s*\([^)]*\))?|мінус(?:\s*\([^)]*\))?|выбрать одно|обрати одне|в природной среде|у природному середовищі|доступ к базовым эффектам|доступ до базових ефектів|возможности|можливості|ограничения|обмеження|условия|умови|сомнение|сумнів|надлом|критический эффект|критичний ефект|урон|шкода|ролевая часть|рольова частина|описание злобы|опис люті|дополнительно|додатково|(?:проверка|перевірка)\s+[^:]{1,50})$/iu;
  var outcome=/^((?:(?:Если|При|Якщо|У разі)\s+)?(?:Критическ(?:ий|ом)\s+(?:успех|провал)|Критичн(?:ий|ому)\s+(?:успіх|провал)|Успех|Успіх|Провал(?:е)?|Невдача|Побочный эффект|Побічний ефект))(?=\s|:|[—–-]|$)\s*[:—–-]?\s*(.*)$/iu;
  String(value||'').replace(/\\n/g,'\n').replace(/\r\n?|[\u2028\u2029]/g,'\n').split('\n').forEach(function(raw){
   var line=raw.trim();if(!line)return;
   // Strip only decorative leading markers, retaining every authored word and rule.
   line=line.replace(/^(?:[\p{Extended_Pictographic}\uFE0F\u200D✔✘→]\s*)+/u,'').trim();if(!line)return;
   if(/^[«“"]/.test(line)){add('quote',line);return;}
   var bullet=line.match(/^([•▪◦]|(?:[IVX]+|\d+)\s*[.—–)-])\s*(.+)$/u);
   if(bullet){add('list',bullet[2],bullet[1]);return;}
   var result=line.match(outcome);
   if(result){add('outcome',result[2],result[1],/провал|невдач|побочн|побічн/iu.test(result[1])?'danger':'benefit');return;}
   var colon=line.match(/^([^:]{1,84}):\s*(.*)$/u),label=colon?colon[1]:line;
   var capitals=label.length<=64&&/\p{Lu}/u.test(label)&&!/[\p{Ll}\d.!?]/u.test(label)&&label.split(/\s+/).length<=7;
   if((colon&&labels.test(label))||capitals){begin(label,tone(label));if(colon&&colon[2])add('prose',colon[2]);return;}
   // Level headings remain distinct; Roman numbered effects above never become headings.
   if(/^\d+\s+(?:уровень|рівень)\s*[—–-]\s*\p{L}/iu.test(line)){begin(line);return;}
   if(/^(?:или|або)$/iu.test(line)){add('choice',line);return;}
   add('prose',line);
  });
  function body(items){
   var html='',list=[];
   function flush(){if(list.length){html+='<ul class="zgms-personal-list">'+list.map(function(item){return '<li><span class="zgms-list-marker">'+escape(item.label)+'</span><span>'+highlightPersonal(item.text)+'</span></li>';}).join('')+'</ul>';list=[];}}
   items.forEach(function(item){
    if(item.kind==='list'){list.push(item);return;}flush();
    if(item.kind==='quote'){html+='<blockquote class="zgms-personal-quote">'+highlightPersonal(item.text)+'</blockquote>';return;}
    if(item.kind==='choice'){html+='<div class="char-ability-choice-separator">'+escape(item.text)+'</div>';return;}
    html+='<p class="char-ability-rule-paragraph'+(item.kind==='outcome'?' zgms-personal-outcome outcome-'+item.tone:'')+'">'+(item.kind==='outcome'?'<strong class="zgms-outcome-label">'+escape(item.label)+':</strong> ':'')+highlightPersonal(item.text)+'</p>';
   });flush();return html;
  }
  return '<div class="char-ability-rule-lines zgms-personal-rules">'+sections.map(function(section){return '<section class="char-ability-rule-section tone-'+section.tone+'">'+(section.label?'<h4>'+highlightPersonal(section.label)+'</h4>':'')+'<div class="char-ability-rule-copy">'+body(section.items)+'</div></section>';}).join('')+'</div>';
 }
 function artCaption(sp,translate){
  function clean(value){return String(translate?translate(value||''):value||'').replace(/\s+/g,' ').trim();}
  var description=clean(sp&&sp.description),manifestation=clean(sp&&sp.manifestation);
  // Reuse a complete inscription, not quoted terminology or a newly invented speaker.
  var quotes=Array.from(description.matchAll(/«([^»]+)»|“([^”]+)”|"([^"\n]+)"/gu),function(match){return (match[1]||match[2]||match[3]).trim();});
  var quote=quotes.find(function(value){return value.length>=16&&value.length<=240&&/^\p{Lu}/u.test(value);});
  if(quote)return quote;
  // A short excerpt keeps the image central; never cut a sentence in half.
  var source=manifestation||description;if(!source)return '';
  var sentences=typeof Intl==='object'&&Intl.Segmenter?Array.from(new Intl.Segmenter('ru',{granularity:'sentence'}).segment(source),function(part){return part.segment.trim();}):source.match(/[^.!?…]+(?:[.!?…]+[»”"]?|$)/gu)||[source];
  return sentences.find(function(value){return value.length>=16&&value.length<=240;})||sentences[0]||source;
 }
 var api={highlight:highlight,highlightPersonal:highlightPersonal,personalRules:personalRules,sections:sections,rules:rules,requirements:requirements,restrictionGroup:restrictionGroup,restrictionParts:restrictionParts,paragraphs:paragraphs,artCaption:artCaption};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaSpellDetailContent=api;
})(typeof window==='object'?window:globalThis);
