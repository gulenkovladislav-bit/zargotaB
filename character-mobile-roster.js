/* Character selection on a phone. Only the list supplied by renderCharList is selectable. */
(function (w) {
  'use strict';
  const narrow = matchMedia('(max-width: 899px)');
  const statLabels = [
    ['str','СИЛ','СИЛ','Сила','Сила'], ['dex','ЛОВ','СПР','Ловкость','Спритність'],
    ['int','ИНТ','ІНТ','Интеллект','Інтелект'], ['cha','ХАР','ХАР','Харизма','Харизма'],
    ['per','ВОС','СПРЙ','Восприятие','Сприйняття'], ['con','ВЫН','ВИТ','Выносливость','Витривалість']
  ];
  let heroes = [], selectedId, expanded = true, touchStart;
  const t = (ru, uk) => w.ZargotaI18n?.getLocale() === 'uk' ? uk : ru;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const nameOf = hero => w.characterEntryText(hero, hero.name || t('Без имени','Без імені'));
  const glyphs = {
    left: 'm15 4-8 8 8 8', right: 'm9 4 8 8-8 8', fold:'m5 15 7-7 7 7',
    path:'M12 21v-6m0 0C12 9 5 10 4 4l5 2M12 15c0-6 7-5 8-11l-5 2'
  };
  const glyph = name => '<svg class="roster-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="'+glyphs[name]+'"/></svg>';
  function portrait(hero) {
    return hero.portrait ? '<img alt="" draggable="false" src="'+escape(hero.portrait)+'">' : '<span class="roster-silhouette" aria-hidden="true">♙</span>';
  }
  function draw(grid) {
    const hero = heroes.find(item => item.id === selectedId) || heroes[0];
    const add = '<button type="button" class="roster-add" data-roster-action="add" aria-label="'+t('Новый персонаж','Новий персонаж')+'">＋</button>';
    if (!hero) {
      grid.innerHTML = '<div class="roster-empty">'+add+'<span>'+t('Новый персонаж','Новий персонаж')+'</span></div>';
      return;
    }
    selectedId = hero.id;
    const fullName = nameOf(hero);
    const parts = /^(.*?)\s*\(([^()]+)\)$/.exec(fullName);
    const path = hero.narrativePath?.title;
    const stats = statLabels.map(([key,ru,uk,longRu,longUk]) => {
      const value = (parseInt(hero.stats?.[key]?.cur,10) || 0) + (w.readTempBonusTotal(hero,key) || 0);
      return '<span aria-label="'+escape(t(longRu,longUk)+' '+value)+'">'+w.zgStatIcon(key)+' <small>'+t(ru,uk)+'</small> <b>'+escape(value)+'</b></span>';
    }).join('');
    const arrow = (action,icon,label) => heroes.length > 1 ?
      '<button class="roster-arrow '+action+'" data-roster-action="'+action+'" aria-label="'+label+'">'+glyph(icon)+'</button>' : '';
    const meta = [hero.race,hero.klasse].filter(Boolean).map(value=>escape(w.characterEntryText(hero,value))).join(' · ');
    const thumbs = heroes.map((item,index)=>'<button class="roster-thumb" data-roster-action="select" data-index="'+index+'" aria-label="'+escape(nameOf(item))+'" aria-pressed="'+(hero.id===item.id)+'">'+'<span class="roster-cameo">'+portrait(item)+'</span>'+'</button>').join('');
    const markup = '<section class="roster-screen" data-zg-i18n-skip><div class="roster-stage">'+portrait(hero)+
      arrow('prev','left',t('Предыдущий герой','Попередній герой'))+arrow('next','right',t('Следующий герой','Наступний герой'))+
      '<div class="roster-caption"><h2>'+escape(parts?parts[1]:fullName)+'</h2>'+
      (parts?'<div>'+escape(parts[2])+'</div>':'')+(path?'<em>'+glyph('path')+escape(path)+'</em>':'')+'</div></div>'+
      '<div class="roster-meta"><span>'+meta+'</span><b>'+t('Ур.','Рів.')+' '+escape(hero.level??1)+'</b><span><i>♥</i> '+escape(hero.hpCur??0)+' / '+escape(hero.hpMax??0)+'</span></div>'+
      '<button class="roster-toggle" data-roster-action="stats" aria-controls="roster-values" aria-expanded="'+expanded+'">'+t('Характеристики','Характеристики')+glyph('fold')+'</button>'+
      '<div id="roster-values" '+(expanded?'':'hidden')+'>'+stats+'</div>'+
      '<button class="roster-open" data-roster-action="open">'+t('Открыть лист','Відкрити аркуш')+'</button>'+
      '<div class="roster-strip"><div class="roster-thumbs">'+thumbs+'</div>'+add+'</div></section>';
    w.ZargotaMobileSheet.updateMarkup(grid,markup);
    const rail = grid.querySelector('.roster-thumbs'), active = rail.querySelector('[aria-pressed=true]');
    const delta = active.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    if (delta < 0) rail.scrollLeft += delta;
    else if (delta + active.offsetWidth > rail.clientWidth) rail.scrollLeft += delta + active.offsetWidth - rail.clientWidth;
  }
  function select(index) {
    if (!heroes.length) return;
    selectedId = heroes[(index+heroes.length)%heroes.length].id;
    const grid = document.getElementById('char-grid');
    draw(grid);
    const stage = grid.querySelector('.roster-stage');
    if(stage?.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      stage.animate([{opacity:.7},{opacity:1}],{duration:170,easing:'ease-out'});
  }
  function step(by) { select(heroes.findIndex(hero=>hero.id===selectedId)+by); }
  document.addEventListener('click',event=>{
    const button = event.target.closest('[data-roster-action]');
    if (!button) return;
    switch(button.dataset.rosterAction) {
      case 'select': select(Number(button.dataset.index)); break;
      case 'prev': step(-1); break;
      case 'next': step(1); break;
      case 'stats': expanded=!expanded; draw(document.getElementById('char-grid')); break;
      case 'open': w.openCharSheet(selectedId); break;
      case 'add': w.openCharEditor(null); break;
      case 'import': document.querySelector('.roster-menu').open=false; document.getElementById('char-import-file').click(); break;
    }
  });
  document.addEventListener('touchstart',event=>{
    touchStart=event.touches.length===1 && event.target.closest('.roster-stage') && !event.target.closest('button') ? event.touches[0] : null;
  },{passive:true});
  document.addEventListener('touchcancel',()=>{touchStart=null;});
  document.addEventListener('touchend',event=>{
    if (!touchStart) return;
    const dx=event.changedTouches[0].clientX-touchStart.clientX,dy=event.changedTouches[0].clientY-touchStart.clientY;
    touchStart=null;
    if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.4) step(dx<0?1:-1);
  },{passive:true});
  narrow.addEventListener('change',()=>{if(w.charView==='list' && document.querySelector('#page-characters.active')) w.renderCharList();});
  w.ZargotaMobileRoster = {render(grid, list){
    if (!narrow.matches) return false;
    heroes=list;
    const menu=document.querySelector('.roster-menu');
    menu.querySelector('summary').setAttribute('aria-label',t('Меню персонажей','Меню персонажів'));
    menu.querySelector('button').textContent=t('Импорт персонажа','Імпорт персонажа');
    draw(grid);
    return true;
  }};
})(window);
