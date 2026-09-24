(function(w){
'use strict';
function t(a,b){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?b:a;}
function edit(ctx){
 var token=ctx.token,config=Object.assign({enabled:false,kind:'pedestrian',mode:'pingpong',duration:40,gap:5,random:true,trails:true,points:[[token.x,token.y],[Math.min(100,token.x+25),token.y]]},token.ambientMotion||{}),drawing=false,points=[],preview=null,ghost=null;
 var box=document.createElement('details');box.open=!!config.enabled;var title=document.createElement('summary');title.textContent=t('Движение и следы','Рух і сліди');box.appendChild(title);ctx.host.appendChild(box);
 var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8';ctx.map.appendChild(svg);
 function paint(){svg.replaceChildren();var route=drawing?points:config.points||[];if(route.length){var line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',route.map(function(p){return p.join(',');}).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#f0c86b');line.setAttribute('stroke-width','.3');svg.appendChild(line);route.forEach(function(p){var dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);dot.setAttribute('r','.6');dot.setAttribute('fill','#f0c86b');svg.appendChild(dot);});}}
 function stop(){if(preview)preview.dispose();preview=null;if(ghost)ghost.remove();ghost=null;}
 function save(){stop();ctx.set('ambientMotion',JSON.parse(JSON.stringify(config)));paint();}
 function field(label,key,type,min,max){var l=document.createElement('label'),i=document.createElement('input');l.className='zg-story-field';l.textContent=label;i.type=type;if(type==='checkbox')i.checked=config[key];else{i.value=config[key];i.min=min;i.max=max;}i.onchange=function(){config[key]=type==='checkbox'?i.checked:Math.max(min,Math.min(max,Number(i.value)||min));save();};l.appendChild(i);box.appendChild(l);}
 function select(label,key,options){var l=document.createElement('label'),s=document.createElement('select');l.className='zg-story-field';l.textContent=label;options.forEach(function(p){var o=document.createElement('option');o.value=p[0];o.textContent=p[1];s.appendChild(o);});s.value=config[key];s.onchange=function(){config[key]=s.value;save();};l.appendChild(s);box.appendChild(l);}
 function button(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;box.appendChild(b);return b;}
 field(t('Фоновое движение','Фоновий рух'),'enabled','checkbox');
 select(t('Тип','Тип'),'kind',[['pedestrian',t('Пешеход · следы обуви','Пішохід · сліди взуття')],['cart',t('Повозка · колея','Повозка · колія')]]);
 select(t('Повтор маршрута','Повтор маршруту'),'mode',[['pingpong',t('Туда и обратно','Туди й назад')],['repeat',t('Проход и новое появление','Прохід і нова поява')]]);
 field(t('Полный проход · секунды','Повний прохід · секунди'),'duration','number',4,300);
 field(t('Пауза между проходами · секунды','Пауза між проходами · секунди'),'gap','number',0,120);
 field(t('Случайные интервалы','Випадкові інтервали'),'random','checkbox');
 field(t('Оставлять следы','Залишати сліди'),'trails','checkbox');
 var audioLabel=document.createElement('label'),audioInput=document.createElement('input');audioLabel.className='zg-story-field';audioLabel.textContent=t('Звук рядом с токеном · путь / URL','Звук поруч із токеном · шлях / URL');audioInput.value=config.sound||'';audioInput.onchange=function(){config.sound=audioInput.value.trim();save();};audioLabel.appendChild(audioInput);box.appendChild(audioLabel);
 if(config.soundVolume==null)config.soundVolume=.4;if(config.soundRadius==null)config.soundRadius=5;
 field(t('Громкость · 0–1','Гучність · 0–1'),'soundVolume','number',0,1);box.lastElementChild.querySelector('input').step=.05;
 field(t('Радиус звука · клетки','Радіус звуку · клітинки'),'soundRadius','number',1,30);
 var record=button(t('Нарисовать маршрут на карте','Намалювати маршрут на карті'),function(){stop();drawing=!drawing;if(drawing)points=[];record.textContent=drawing?t('Отменить рисование','Скасувати малювання'):t('Нарисовать маршрут на карте','Намалювати маршрут на карті');paint();});
 button(t('Сохранить маршрут','Зберегти маршрут'),function(){if(!drawing||points.length<2)return;config.points=points.slice();drawing=false;save();record.textContent=t('Нарисовать маршрут на карте','Намалювати маршрут на карті');});
 button(t('▶ Проверить движение','▶ Переглянути рух'),function(){stop();if(!w.ZargotaStoryTraffic)return;ghost=document.createElement('div');ghost.className='zg-story-play-token';ghost.dataset.tokenId=token.id;ghost.style.cssText='position:absolute;pointer-events:none;width:'+(token.size||64)+'px;height:'+(token.size||64)+'px;z-index:9;';var image=document.createElement('img');image.src=token.image||'';image.alt='';ghost.appendChild(image);ctx.map.appendChild(ghost);preview=w.ZargotaStoryTraffic.create();preview.mount(Object.assign({},ctx.scene,{trafficTokens:[Object.assign({},token,{visible:true,hidden:false,enabled:true,ambientMotion:Object.assign({},config,{enabled:true,random:false})})]}),ctx.map,'preview');});
 button(t('■ Стоп','■ Стоп'),stop);
 var note=document.createElement('small');note.textContent=t('Кликните минимум две точки и сохраните маршрут. Фоновый токен не запускает диалоги и не блокирует героя. Перемещение токена сдвигает весь маршрут.','Клацніть щонайменше дві точки й збережіть маршрут. Фоновий токен не запускає діалоги й не блокує героя. Переміщення токена зсуває весь маршрут.');box.appendChild(note);
 function down(e){if(drawing){e.preventDefault();e.stopImmediatePropagation();}}
 function click(e){if(!drawing)return;e.preventDefault();e.stopImmediatePropagation();var r=ctx.map.getBoundingClientRect();points.push([Math.round(Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))*100)/100,Math.round(Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100))*100)/100]);paint();}
 ctx.map.addEventListener('pointerdown',down,true);ctx.map.addEventListener('click',click,true);paint();
 return {dispose:function(){stop();svg.remove();ctx.map.removeEventListener('pointerdown',down,true);ctx.map.removeEventListener('click',click,true);}};
}
w.ZargotaStoryTrafficEditor={edit:edit};
})(window);
