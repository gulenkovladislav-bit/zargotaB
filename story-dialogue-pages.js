(function(w){
  'use strict';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function local(o,k){return t(o[k],o[k+'Uk']||o[k])||'';}
  function el(tag,text){var e=document.createElement(tag);if(text!=null)e.textContent=text;return e;}
  if(w.addEventListener)w.addEventListener('beforeunload',function(){var input=document.activeElement;if(input&&input.matches('input,textarea,select')&&input.closest('.zg-dialogue-pages-editor'))input.dispatchEvent(new Event('change',{bubbles:true}));});
  function pages(node){return [node.firstShowPortrait==null?node:Object.assign({},node,{showPortrait:node.firstShowPortrait})].concat((node.slides||[]).map(function(s){var page=Object.assign({},node,s,{slides:undefined,musicEvent:s.musicEvent||null,afterPageActions:s.afterPageActions||[]});if((s.speaker!=null||s.emotion!=null)&&s.portrait==null)delete page.portrait;return page;}));}
  function playback(node,host,draw){
    var list=pages(node),index=0,timeout=0,paused=true,ready=false,nav=el('nav');nav.className='zg-dialogue-page-nav';
    host.querySelectorAll('.zg-dialogue-page-nav').forEach(function(e){e.remove();});host.appendChild(nav);
    function button(text,label,fn){var b=el('button',text);b.type='button';b.setAttribute('aria-label',label);b.onclick=function(e){e.stopPropagation();fn();};nav.appendChild(b);return b;}
    var prev=button('‹',t('Предыдущая реплика','Попередня репліка'),function(){paused=true;show(index-1);}),counter=el('span');nav.appendChild(counter);
    var next=button('›',t('Следующая реплика','Наступна репліка'),function(){paused=true;show(index+1);});
    var pause=button('▶',t('Автосмена реплик','Автозміна реплік'),function(){paused=!paused;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-pressed',String(!paused));if(paused)clearTimeout(timeout);else if(ready)complete();});pause.hidden=true;
    function show(i){clearTimeout(timeout);ready=false;index=Math.max(0,Math.min(list.length-1,i));prev.disabled=index===0;next.disabled=index===list.length-1;counter.textContent=(index+1)+' / '+list.length;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-pressed',String(!paused));nav.hidden=list.length<2;draw(list[index]);}
    function complete(){ready=true;clearTimeout(timeout);if(index<list.length-1&&!paused)timeout=setTimeout(function(){show(index+1);},Math.max(500,Math.min(60000,Number(node.pageDelayMs)||3000)));return index===list.length-1;}
    return{pause:function(){paused=true;clearTimeout(timeout);pause.textContent='▶';pause.setAttribute('aria-pressed','false');},back:function(){if(index===0)return false;paused=true;show(index-1);return true;},last:function(){paused=true;show(list.length-1);},start:function(at){show(Number(at)||0);},next:function(){if(index>=list.length-1)return false;show(index+1);return true;},complete:complete,cancel:function(){clearTimeout(timeout);nav.remove();},index:function(){return index;}};
  }
  var activePages={};function enhance(data,node,host,save){
    var target=host.querySelector('[data-tab=text]')||host,box=el('section');box.className='zg-dialogue-pages-editor';target.appendChild(box);
    function commit(fn){save(function(d){fn(d.nodes.find(function(n){return n.id===node.id;}));});}
    function field(parent,title,value,onchange,type){var label=el('label',title),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type||'text';input.value=value==null?'':value;input.onchange=function(){onchange(input.type==='checkbox'?input.checked:input.value);};label.appendChild(input);parent.appendChild(label);return input;}
    function select(parent,title,value,options,onchange){var label=el('label',title),s=el('select');options.forEach(function(p){var o=el('option',p[1]);o.value=p[0];s.appendChild(o);});s.value=value;s.onchange=function(){onchange(s.value);};label.appendChild(s);parent.appendChild(label);return s;}
    function action(parent,text,fn){var b=el('button',text);b.type='button';b.onclick=fn;parent.appendChild(b);}
    var opts=[['',t('Без имени','Без імені')],['@player',t('♙ Персонаж игрока','♙ Персонаж гравця')]].concat(Object.keys(data.speakers||{}).filter(function(k){return !data.speakers[k].archived||k===node.speaker||(node.slides||[]).some(function(s){return s.speaker===k;});}).map(function(k){return[k,w.ZargotaStoryActors.displayName(data.speakers[k])];}));
    box.appendChild(el('h3',t('Реплики внутри блока','Репліки всередині блоку')));
    box.appendChild(el('p',t('Первая реплика — выше. Остальные наследуют фон и оформление блока. Ответы появятся после последней.','Перша репліка — вище. Решта успадковують тло й оформлення блоку. Відповіді з’являться після останньої.')));
    if(node.kind==='choice'){
      var media=el('details');media.appendChild(el('summary',t('▧ Картинка выбора','▧ Зображення вибору')));box.appendChild(media);
      var image=field(media,t('Фон выбора','Тло вибору'),node.image||'',function(v){commit(function(n){n.image=v;});});if(w.ZargotaStoryAssets)w.ZargotaStoryAssets.attach(image,'image');
    }
    (node.slides||[]).forEach(function(slide,i){var item=el('details');item.className='zg-page-card';item.open=i===(activePages[node.id]||0);var summary=el('summary',t('Реплика ','Репліка ')+(i+2)+' · '+(local(slide,'text').slice(0,65)||t('Пустая реплика','Порожня репліка')));item.appendChild(summary);summary.onclick=function(){activePages[node.id]=i;box.querySelectorAll('.zg-page-card').forEach(function(other){if(other!==item)other.open=false;});};box.appendChild(item);function set(k,v){commit(function(n){n.slides[i][k]=v;});}
      select(item,t('Кто говорит','Хто говорить'),slide.speaker==null?node.speaker||'':slide.speaker,opts,function(v){commit(function(n){n.slides[i].speaker=v;n.slides[i].emotion='';});});
      field(item,t('Текст','Текст'),local(slide,'text'),function(v){set(t('text','textUk'),v);},'textarea');
      if(w.ZargotaStoryAudioEditor)w.ZargotaStoryAudioEditor.edit(data,slide.musicEvent,item,function(v){set('musicEvent',v);});
      var actorId=slide.speaker==null?node.speaker:slide.speaker,actor=(data.speakers||{})[actorId==='@player'?data.playerSpeakerId:actorId]||{};
      if(w.ZargotaStoryPortraitKit){w.ZargotaStoryPortraitKit.picker(data,pages(node)[i+1],item,function(patch){commit(function(n){Object.assign(n.slides[i],patch);});},false,slide);}else{
      select(item,t('Эмоция','Емоція'),slide.emotion==null?node.emotion||'':slide.emotion,[['',t('Обычный портрет','Звичайний портрет')]].concat(Object.keys(actor.emotions||{}).map(function(k){return[k,w.ZargotaStoryActors.displayName(actor.emotions[k])];})),function(v){set('emotion',v);});
      var portrait=field(item,t('Другой портрет','Інший портрет'),slide.portrait||'',function(v){set('portrait',v);});if(w.ZargotaStoryAssets)w.ZargotaStoryAssets.attach(portrait,'image');
      select(item,t('Портрет этой реплики','Портрет цієї репліки'),slide.showPortrait==null?'inherit':slide.showPortrait?'on':'off',[['inherit',t('Как у блока','Як у блоку')],['on',t('Показать','Показати')],['off',t('Скрыть','Приховати')]],function(v){commit(function(n){if(v==='inherit')delete n.slides[i].showPortrait;else n.slides[i].showPortrait=v==='on';});});
      var resolved=w.ZargotaStoryActors.portrait(data,pages(node)[i+1]);if(resolved.portrait){var thumbnail=el('img');thumbnail.src=resolved.portrait;thumbnail.alt=t('Портрет реплики','Портрет репліки');thumbnail.className='zg-page-portrait-preview';item.appendChild(thumbnail);}
      }
      action(item,'↑',function(){if(i>0)commit(function(n){var s=n.slides.splice(i,1)[0];n.slides.splice(i-1,0,s);});});action(item,'↓',function(){if(i<(node.slides||[]).length-1)commit(function(n){var s=n.slides.splice(i,1)[0];n.slides.splice(i+1,0,s);});});
      action(item,t('× Удалить реплику','× Видалити репліку'),function(){commit(function(n){n.slides.splice(i,1);});});
    });
    action(box,t('＋ Добавить реплику','＋ Додати репліку'),function(){commit(function(n){n.slides=n.slides||[];activePages[node.id]=n.slides.length;n.slides.push({text:'',textUk:''});});});
    var settings=el('details');settings.open=false;settings.appendChild(el('summary',t('Дополнительно · оформление и печать','Додатково · оформлення й друк')));(host.querySelector('[data-tab=visual]')||box).appendChild(settings);
    function range(title,key,value,min,max,step,suffix){var input=field(settings,title,value,function(v){commit(function(n){n[key]=Number(v);});},'range'),out=el('output',value+suffix);input.min=min;input.max=max;input.step=step;input.value=value;input.after(out);input.oninput=function(){out.textContent=input.value+suffix;};}
    range(t('Скорость · знаков в секунду','Швидкість · знаків за секунду'),'textSpeed',node.textSpeed||37,5,100,1,'');
    range(t('Размер текста · px','Розмір тексту · px'),'textSize',node.textSize||30,16,48,1,' px');
    range(t('Ширина текста без портрета','Ширина тексту без портрета'),'textWidth',node.textWidth||100,50,100,5,'%');

    select(settings,t('Анимация текста','Анімація тексту'),node.textAnimation||'typewriter',[['typewriter',t('Печатная машинка','Друкарська машинка')],['fade',t('Плавное появление','Плавна поява')],['rise',t('Снизу вверх','Знизу вгору')],['none',t('Без анимации','Без анімації')]],function(v){commit(function(n){n.textAnimation=v;});});
    select(settings,t('Звук печати','Звук друку'),node.typingSound||'soft',[['off',t('Без звука','Без звуку')],['soft',t('Мягкий','М’який')],['click',t('Щелчки','Клацання')]],function(v){commit(function(n){n.typingSound=v;});});
    select(settings,t('Портрет в блоке','Портрет у блоці'),node.showPortrait===false?'off':'on',[['on',t('Показывать','Показувати')],['off',t('Скрыть','Приховати')]],function(v){commit(function(n){n.showPortrait=v==='on';});});

  }
  w.ZargotaStoryPages={pages:pages,playback:playback,enhance:enhance};
})(window);
