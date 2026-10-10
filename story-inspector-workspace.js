(function(w){
  'use strict';
  var selections=new Map(),expanded=false,currentTab=null;
  var panelWidth=60;try{var stored=Number(localStorage.getItem('zg-reply-width'));if(stored>=25&&stored<=85)panelWidth=stored;}catch(e){}
  function resizePanel(body){
    if(body.querySelector('.zg-reply-resizer'))return;
    var handle=el('div','zg-reply-resizer');handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label',t('Ширина панели диалога','Ширина панелі діалогу'));body.append(handle);
    function apply(value,save){var width=body.clientWidth,min=Math.min(420,width*.65),max=Math.max(min,width-160);panelWidth=Math.max(min/width*100,Math.min(max/width*100,value));body.style.setProperty('--reply-width',panelWidth+'%');handle.setAttribute('aria-valuenow',Math.round(panelWidth));handle.setAttribute('aria-valuemin',Math.round(min/width*100));handle.setAttribute('aria-valuemax',Math.round(max/width*100));if(save)try{localStorage.setItem('zg-reply-width',panelWidth);}catch(e){}}
    var dragging=false;handle.onpointerdown=function(e){if(e.button!==0)return;e.preventDefault();e.stopPropagation();dragging=true;handle.setPointerCapture(e.pointerId);body.classList.add('zg-reply-resizing');};
    handle.onpointermove=function(e){if(dragging){var r=body.getBoundingClientRect();apply((r.right-e.clientX)/r.width*100,false);}};
    function finish(){if(!dragging)return;dragging=false;body.classList.remove('zg-reply-resizing');apply(panelWidth,true);}
    handle.onpointerup=finish;handle.onpointercancel=finish;handle.onlostpointercapture=finish;
    handle.onkeydown=function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();apply(panelWidth+(e.key==='ArrowLeft'?2:-2),true);}};
    new ResizeObserver(function(){if(body.clientWidth)apply(panelWidth,false);}).observe(body);apply(panelWidth,false);
  }
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function el(tag,cls,text){var e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
  function reorder(node,from,to){
    var count=1+(node.slides||[]).length;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=count||to>=count||from===to)return false;
    if(from>0&&to>0){node.slides.splice(to-1,0,node.slides.splice(from-1,1)[0]);return true;}
    // Materialize inherited page values before the first page changes its defaults.
    var keys=new Set(['text','textUk','speaker','emotion','portrait','portraitOverride','musicEvent','afterPageActions']);
    (node.slides||[]).forEach(function(s){Object.keys(s).forEach(function(k){if(!['id','links','slides','firstShowPortrait'].includes(k))keys.add(k);});});
    keys.delete('showPortrait');
    var resolved=w.ZargotaStoryPages.pages(node),list=resolved.map(function(p){var result={};keys.forEach(function(k){if(p[k]!==undefined)result[k]=JSON.parse(JSON.stringify(p[k]));});result.showPortrait=p.showPortrait!==false;return result;});
    list.splice(to,0,list.splice(from,1)[0]);var first=list.shift();keys.forEach(function(k){if(first[k]===undefined)delete node[k];else node[k]=first[k];});node.firstShowPortrait=first.showPortrait;node.slides=list;return true;
  }
  function enhance(data,node,host,save){
    if(!host||host.querySelector('.zg-reply-workspace'))return;
    var text=host.querySelector('[data-tab=text]'),pages=host.querySelector('.zg-dialogue-pages-editor');if(!text||!pages)return;
    var root=host.closest('#zg-story-editor'),body=host.closest('.zg-story-body');
    resizePanel(body);
    var project=root.querySelector('[data-story-project-select]'),key=(project?project.value:'')+':'+node.id;
    var count=1+(node.slides||[]).length,previous=selections.get(key),active=previous?Math.min(previous.index,count-1):0;
    if(previous&&count>previous.count)active=count-1;
    var toolbar=el('div','zg-reply-toolbar'),expand=el('button','',t('⤢ Расширить','⤢ Розширити'));expand.type='button';toolbar.append(expand);host.prepend(toolbar);
    function sizing(){body.classList.add('zg-reply-layout');body.classList.toggle('zg-reply-expanded',expanded);expand.textContent=expanded?t('⤡ Вернуть доску','⤡ Повернути дошку'):t('⤢ Расширить','⤢ Розширити');expand.setAttribute('aria-expanded',String(expanded));}
    expand.onclick=function(){expanded=!expanded;sizing();};sizing();
    var workspace=el('section','zg-reply-workspace zg-dialogue-pages-editor'),nav=el('nav','zg-reply-pages'),first=el('section','zg-reply-page'),main=el('div','zg-reply-main'),portrait=el('div','zg-reply-portrait');nav.setAttribute('aria-label',t('Реплики блока','Репліки блоку'));workspace.append(nav,first);first.append(main,portrait);text.prepend(workspace);
    var title=host.querySelector('[data-story-field=title]');if(title)toolbar.prepend(title.closest('label')||title);
    ['speaker','text'].forEach(function(k){var input=host.querySelector('[data-story-field="'+k+'"]');if(input)main.append(input.closest('label')||input);});
    var firstPortrait=host.querySelector('.zg-first-portrait');if(firstPortrait)portrait.append(firstPortrait);
    var cards=Array.from(pages.querySelectorAll('.zg-page-card')),panels=[first];
    cards.forEach(function(card){
      // A details element has an anonymous content box: do not use it as the grid.
      var panel=el('section','zg-reply-page'),left=el('div','zg-reply-main'),right=el('div','zg-reply-portrait'),frame=el('fieldset','zg-first-portrait'),actions=el('div','zg-reply-slide-actions');
      frame.append(el('legend','',t('Портрет этой реплики','Портрет цієї репліки')));right.append(frame);
      Array.from(card.children).forEach(function(child){if(child.tagName==='SUMMARY')return;if(child.matches('.zg-portrait-picker,.zg-page-portrait-preview'))frame.append(child);else if(child.matches('.zg-music-editor')){var events=host.querySelector('[data-tab=events]');child.dataset.replyIndex=panels.length;if(events)events.prepend(child);}else if(child.tagName==='BUTTON')actions.append(child);else left.append(child);});
      Array.from(actions.children).forEach(function(b){if(b.textContent==='↑'||b.textContent==='↓')b.remove();});
      left.append(actions);panel.append(left,right);workspace.append(panel);panels.push(panel);card.remove();
    });
    pages.querySelectorAll(':scope > h3,:scope > p').forEach(function(e){e.hidden=true;});
    var playback=host.querySelector('.zg-story-play-from'),moment=playback&&playback.querySelector('select');
    function select(index){active=index;selections.set(key,{index:active,count:count});panels.forEach(function(p,i){p.hidden=i!==active;});nav.querySelectorAll('[data-reply-index]').forEach(function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.replyIndex)===active));});host.querySelectorAll('[data-tab=events] > .zg-music-editor').forEach(function(e){e.hidden=Number(e.dataset.replyIndex||0)!==active;});if(moment){moment.value=String(active);moment.dispatchEvent(new Event('change',{bubbles:true}));}}
    panels.forEach(function(panel,i){var b=el('button','',t('Реплика ','Репліка ')+(i+1));b.type='button';b.dataset.replyIndex=i;b.onclick=function(){select(i);};nav.append(b);});
    var dragged=null;
    function move(from,to){if(!save||from===to)return;selections.set(key,{index:to,count:count});save(function(d){var n=d.nodes.find(function(n){return n.id===node.id;});if(n)reorder(n,from,to);});}
    nav.querySelectorAll('[data-reply-index]').forEach(function(b){
      b.draggable=!!save;b.title=t('Перетащите для изменения порядка. Alt + стрелка — с клавиатуры.','Перетягніть для зміни порядку. Alt + стрілка — з клавіатури.');
      b.ondragstart=function(e){dragged=Number(b.dataset.replyIndex);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragged));b.classList.add('zg-reply-dragging');};
      b.ondragover=function(e){if(dragged===null)return;e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('zg-reply-drop');};
      b.ondragleave=function(){b.classList.remove('zg-reply-drop');};
      b.ondrop=function(e){if(dragged===null)return;e.preventDefault();e.stopPropagation();var from=dragged;dragged=null;move(from,Number(b.dataset.replyIndex));};
      b.ondragend=function(){dragged=null;nav.querySelectorAll('button').forEach(function(e){e.classList.remove('zg-reply-drop','zg-reply-dragging');});};
      b.onkeydown=function(e){if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();var from=Number(b.dataset.replyIndex),to=from+(e.key==='ArrowLeft'?-1:1);if(to>=0&&to<count)move(from,to);};
    });
    if(moment){moment.hidden=true;moment.addEventListener('change',function(){/* Existing preview handler owns persistence. */});}
    var footer=el('div','zg-reply-footer');if(playback)footer.append(playback);
    // Keep links in their existing tab: moving DOM preserves delegated handlers and IDs.
    var links=host.querySelector('[data-tab=links]');if(links){host.querySelectorAll('.zg-story-link-row,[data-story-add-link]').forEach(function(e){links.append(e);});}
    // Inventory every remaining control rather than leaving the old vertical tail.
    var visual=host.querySelector('[data-tab=visual]');
    Array.from(pages.children).forEach(function(e){if(e.tagName==='BUTTON')nav.append(e);else if(e.tagName==='DETAILS'&&visual)visual.append(e);});pages.remove();
    var ai=host.querySelector('.zg-ai-edit-panel'),aiSection=el('section','zg-inspector-section');aiSection.dataset.tab='ai';aiSection.hidden=true;
    aiSection.append(el('p','zg-reply-ai-scope',t('AI редактирует выбранный блок со всеми его репликами. В окне копирования можно выбрать связанную ветку. Выбор «Реплика 1 / 2» не ограничивает область AI. Перед применением ответа показывается проверка изменений.','AI редагує вибраний блок з усіма його репліками. У вікні копіювання можна вибрати пов’язану гілку. Вибір «Репліка 1 / 2» не обмежує область AI. Перед застосуванням відповіді показується перевірка змін.')));
    if(ai)aiSection.append(ai);host.append(aiSection);
    Array.from(text.children).forEach(function(e){if(e===workspace)return;if(e.matches('button')&&links){e.textContent=t('＋ Следующий блок на доске','＋ Наступний блок на дошці');links.append(e);}else if(links)links.append(e);});
    text.append(footer);
    var tabs=host.querySelector('.zg-inspector-tabs'),header=el('div','zg-reply-header');header.append(toolbar);if(tabs)header.append(tabs);header.append(nav);host.prepend(header);
    if(tabs){var aiButton=el('button','','AI');aiButton.type='button';tabs.append(aiButton);var names=['text','visual','events','links','ai'];function tab(name){currentTab=name;host.querySelectorAll(':scope > .zg-inspector-section').forEach(function(section){section.hidden=section.dataset.tab!==name;});Array.from(tabs.children).forEach(function(b,i){b.setAttribute('aria-pressed',String(names[i]===name));});nav.hidden=name==='ai';}Array.from(tabs.children).forEach(function(b,i){var original=b.onclick;b.onclick=function(){if(original)original();tab(names[i]);};});tab(currentTab||'text');}
    // Portrait picker opens to the same position on every page; choices keep their handlers.
    panels.forEach(function(p){
      p.querySelectorAll('.zg-reply-main > label').forEach(function(label){Array.from(label.childNodes).filter(function(n){return n.nodeType===3&&n.textContent.trim();}).forEach(function(n){var span=el('span','',n.textContent);n.replaceWith(span);});});
      p.querySelectorAll('.zg-portrait-picker').forEach(function(picker){picker.open=false;});
    });
    body.classList.toggle('zg-reply-expanded',expanded);
    select(active);
  }
  w.ZargotaStoryInspectorWorkspace={enhance:enhance,reorder:reorder};
})(window);
