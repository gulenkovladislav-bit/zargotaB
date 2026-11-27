// Local encounter preparation on the live-game GM desk.
(() => {
  const table = document.querySelector('#page-gm-table .zg-irl-table');
  if (!table) return;
  const root = document.createElement('section');
  root.className = 'enemy-desk';
  root.setAttribute('data-zg-i18n-skip','');
  document.body.append(root);
  const uk = () => window.ZargotaI18n?.getLocale() === 'uk';
  const t = (ru, ua) => uk() ? ua : ru;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const local = (obj, key) => uk() ? obj[key+'Uk'] || window.ZargotaI18n?.translate(obj[key]) || obj[key] : obj[key];
  const btn = (action, label, id='') => '<button type="button" data-op="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
  let owner, state, selected='', panel='', tab='actions', catalog=[];
  let unsaved=false;
  function read(){
    const key='zg-live-enemies-v1:'+(window.ZargotaPersistentCharacters?.tableIdentity()?.uid || 'local');
    if(key===owner)return;
    owner=key; selected=panel=''; unsaved=false;
    try { state=JSON.parse(localStorage.getItem(key)); } catch { state=null; }
    if(!Array.isArray(state?.rows))state={on:false,rows:[],round:1,turn:''};
    if(state.definitions){
      for(const row of state.rows)row.snapshot=state.definitions[row.ref] || row.snapshot;
      delete state.definitions;
    }
  }
  function save(){
    // A pack of identical creatures needs just one Bestiary snapshot.
    const definitions=Object.create(null);
    const rows=state.rows.map(({snapshot,...row})=>{
      if(snapshot)definitions[row.ref]=snapshot;
      return row;
    });
    try {
      localStorage.setItem(owner,JSON.stringify({...state,rows,definitions}));
      unsaved=false;
    } catch {
      if(!unsaved)window.showToast?.(t('Бой доступен до закрытия вкладки. Браузер не сохранил изменения.','Бій доступний до закриття вкладки. Браузер не зберіг зміни.'));
      unsaved=true;
    }
  }
  function all(){return typeof beasts!=='undefined' && beasts.length ? beasts : catalog;}
  function definition(row){return all().find(b=>String(b.id)===row.ref)||row.snapshot;}
  const wolfArt = 'images/beasts/beast_1775678137839.9426.png';
  function portrait(b){
    const src = b.portrait === wolfArt ? 'images/ui/bestiary/gray-wolf-encounter.webp' : b.portrait;
    if (!/^(images\/|assets\/|https?:\/\/|data:image\/)/i.test(src || '')) return '<span class="ed-no-art" aria-hidden="true">◇</span>';
    return '<img class="ed-portrait" src="'+esc(src)+'" alt="">';
  }
  function statusDefs(){return (window.zgGmStatusCatalog?.()||[]).filter(s=>s.enabled!==false);}
  function name(row,b){return (local(b,'name')||'')+(row.number>1?' · '+row.number:'');}
  function hp(row,b){
    const maximum = Math.max(0,Number(b.hp)||0);
    const percent = maximum ? Math.min(100,Math.max(0,row.hp / maximum * 100)) : 0;
    return '<div class="ed-hp">'+btn('minus','−',row.id)+'<b style="--health:'+percent+'%">♥ '+esc(row.hp)+' / '+maximum+'</b>'+btn('plus','+',row.id)+'</div>';
  }
  function tile(row,b){
    const tags=row.statuses.map(key=>statusDefs().find(s=>s.key===key)).filter(Boolean).map(s=>'<small title="'+esc(local(s,'label'))+'" style="--tag:'+(/^#[0-9a-f]{3,8}$/i.test(s.color)?s.color:'#d4af65')+'">'+esc(local(s,'label'))+(row.statusRounds?.[s.key]?' · '+esc(row.statusRounds[s.key])+' р.':'')+'</small>').join('');
    return '<article data-enemy="'+row.id+'" class="'+(state.turn===row.id?'current':'')+'">'+
      '<button class="ed-face" title="'+esc(name(row,b))+'" data-op="inspect" data-id="'+row.id+'">'+portrait(b)+'<strong>'+esc(name(row,b))+'</strong></button>'+
      '<span class="ed-roll">'+esc(row.init)+'</span>'+hp(row,b)+'<div class="ed-tags">'+tags+'</div></article>';
  }
  function detail(row,b){
    const stats=[['str','Сила','Сила'],['dex','Ловкость','Спритність'],['int','Интеллект','Інтелект'],['cha','Харизма','Харизма'],['wis','Мудрость','Мудрість'],['con','Телосложение','Статура']];
    const txt = (entry,key) => {
      const value = entry[key];
      const reviewed = window.beastEntryText?.(b,value);
      if(uk() && !entry[key+'Uk'] && reviewed && reviewed !== value) return reviewed;
      return local(entry,key);
    };
    let content;
    if(tab==='actions') content=(b.attacks||[]).map((a,index)=>{
      const icon = b.portrait===wolfArt && a.name==='Загнать в круг' ? 'images/ui/bestiary/wolf-bite-encounter.webp' : 'images/vtt-actions/attack.png';
      const summary = [txt(a,'damage'),txt(a,'range')].filter(Boolean).map(esc).join(' · ');
      const used = row.used?.includes(index);
      return '<details data-attack="'+index+'"><summary><img src="'+icon+'" alt=""><span><b>'+esc(txt(a,'name'))+(used?' ✓':'')+'</b><small>'+summary+'</small></span></summary><p>'+[txt(a,'toHit'),txt(a,'cd'),txt(a,'desc')].filter(Boolean).map(esc).join('<br>')+'</p>'+btn('use',used?t('✓ Использовано','✓ Використано'):t('Использовать','Використати'),index)+'</details>';
    }).join('');
    if(tab==='traits')content=(b.traits||[]).map(a=>'<p><strong>'+esc(txt(a,'name'))+'</strong><br>'+esc(txt(a,'desc'))+'</p>').join('');
    if(tab==='description')content=['description','behavior','lore'].map(key=>txt(b,key)).filter(Boolean).map(s=>'<p>'+esc(s)+'</p>').join('');
    const metric=(key,label,value)=>'<div class="ed-metric"><img src="images/character-derived/'+key+'-v3.webp" alt=""><span>'+label+'<b>'+esc(value)+'</b></span></div>';
    const tabs=[['actions','Действия','Дії','attack'],['traits','Черты','Риси','custom'],['description','Описание','Опис','inspect']];
    const navigation=tabs.map(([key,r,u,icon])=>'<button type="button" data-op="tab" data-id="'+key+'" aria-pressed="'+(key===tab)+'"><img src="images/vtt-actions/'+icon+'.png" alt="">'+t(r,u)+'</button>').join('');
    const attributes=stats.map(([k,r,u])=>'<div data-stat="'+k+'"><img src="images/ui/stats/'+(k==='wis'?'per':k)+'.png" alt=""><span>'+t(r,u)+'</span><b>'+esc(b[k])+'</b></div>').join('');
    const overview=tab==='actions'?'<div class="ed-info">'+portrait(b)+'<div><strong>'+esc(txt(b,'role')||name(row,b))+'</strong><div class="ed-metrics">'+metric('armor',t('Защита','Захист'),b.ac)+metric('speed',t('Скорость','Швидкість'),b.speed)+'</div>'+hp(row,b)+'<label><img src="images/character-derived/initiative-v3.webp" alt="">'+t('Инициатива','Ініціатива')+' <input type="number" data-init="'+row.id+'" value="'+row.init+'"></label></div></div><div class="ed-stats">'+attributes+'</div>':'';
    return '<aside class="ed-sheet" data-enemy-sheet="'+esc(row.id)+'" data-section="'+tab+'"><header><b>'+esc(name(row,b))+'</b>'+btn('close','×')+'</header><div class="ed-scroll">'+overview+'<section><h3>'+t(...tabs.find(entry=>entry[0]===tab).slice(1,3))+'</h3>'+(content||'—')+'</section>'+(tab==='description'?btn('remove',t('Убрать из боя','Прибрати з бою'),row.id):'')+'</div><nav>'+navigation+'</nav></aside>';

  }
  function command(op,label,body,expanded){
    const disclosure=expanded===undefined?'':' aria-expanded="'+expanded+'"';
    return '<button type="button" data-op="'+op+'" aria-label="'+esc(label)+'" title="'+esc(label)+'"'+disclosure+'>'+body+'</button>';
  }
  let draft=null,folderEdit=null;
  const heroes=()=>window.ZargotaGmTable?.targets()||[];
  const roll=b=>1+Math.floor(Math.random()*20)+(Number(b.initiative)||0);
  function enemyRow(b,rows){
    const ref=String(b.id);
    return {id:globalThis.crypto?.randomUUID?.() || 'enemy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),ref,snapshot:b,
      number:1+Math.max(0,...rows.filter(r=>r.ref===ref).map(r=>r.number)),hp:Number(b.hp)||0,init:null,statuses:[]};
  }
  function setup(){
    const playerRows=heroes().map(h=>{
      const picked=Object.hasOwn(draft.heroInit,h.key);
      return '<label><input type="checkbox" data-player="'+esc(h.key)+'" '+(picked?'checked':'')+'><span>'+esc(h.name)+'</span><input aria-label="'+t('Инициатива','Ініціатива')+'" type="number" data-manual="'+esc(h.key)+'" value="'+esc(draft.heroInit[h.key])+'" '+(picked?'':'disabled')+'></label>';
    }).join('');
    const foes=draft.rows.map(row=>'<label><span>'+esc(name(row,row.snapshot))+'</span><input aria-label="'+t('Инициатива','Ініціатива')+'" type="number" data-manual="'+esc(row.id)+'" value="'+esc(row.init)+'">'+btn('omit','×',row.id)+'</label>').join('');
    return '<aside class="ed-picker ed-setup"><header>'+t('Подготовка боя','Підготовка бою')+btn('close','×')+'</header><section><h4>'+t('Игроки','Гравці')+'</h4>'+playerRows+'<h4>'+t('Враги','Вороги')+'</h4>'+foes+'</section><footer>'+btn('picker',t('Из бестиария','З бестіарію'))+(foes?btn('roll',t('Бросить за врагов','Кинути за ворогів')):'')+btn('start',t('Начать бой','Почати бій'))+'</footer></aside>';
  }
  function dockHero(id){
    return document.querySelector('#zg-irl-character-dock [data-gm-key="'+CSS.escape(id)+'"]');
  }
  function syncHeroes(){
    for(const card of root.querySelectorAll('[data-player-tile]')){
      const source=dockHero(card.dataset.playerTile);
      const art=card.querySelector('.ed-hero-art');
      const original=source?.querySelector('.zg-gm-hero-portrait');
      if(original && !original.isEqualNode(art.firstChild))art.replaceChildren(original.cloneNode(true));
      const health=source?.querySelector('.zg-gm-hp span')?.textContent || '—';
      const label=card.querySelector('.ed-hp b');
      if(label.textContent!==health)label.textContent=health;
      for(const [op,delta] of [['hero-minus','-1'],['hero-plus','1']]){
        card.querySelector('[data-op="'+op+'"]').disabled=!source?.querySelector('[data-gm-hp="'+delta+'"]:enabled');
      }
    }
    markHeroTurn();
  }
  function bestiary(){
    const label=t('Найти существо','Знайти істоту');
    const options=all().map(b=>'<button type="button" data-op="add" data-id="'+esc(b.id)+'">'+portrait(b)+'<span>'+esc(local(b,'name'))+'</span></button>').join('');
    return '<aside class="ed-picker"><header>'+t('Бестиарий','Бестіарій')+btn('close','×')+'</header>'+
      '<input type="search" data-search aria-label="'+label+'" placeholder="'+label+'"><section>'+options+'</section></aside>';
  }
  function markHeroTurn(){
    const dock=document.getElementById('zg-irl-character-dock');
    const active=state.on && state.turn;
    const old=dock?.querySelector('.ed-hero-turn');
    const next=active && dock?.querySelector('[data-gm-key="'+CSS.escape(active)+'"]');
    if(next!==old){old?.classList.remove('ed-hero-turn');if(next)next.classList.add('ed-hero-turn');}
  }
  function render(){
    read();
    let html=state.on?'':'<div class="ed-tools">'+btn('toggle',t('⚔ Бой','⚔ Бій'))+'</div>';
    if(panel==='setup' && draft)html+=setup();
    if(panel==='picker')html+=bestiary();
    if(state.on){
      const actors=queue().map(actor=>{
        const r=state.rows.find(r=>r.id===actor.id);
        if(r)return tile(r,definition(r));
        const id=esc(actor.id);
        return '<article class="ed-player'+(state.turn===actor.id?' current':'')+'" data-player-tile="'+id+'">'+
          '<button class="ed-face" data-op="hero" data-id="'+id+'"><span class="ed-hero-art"></span><strong>'+esc(actor.title)+'</strong></button>'+
          '<span class="ed-roll">'+esc(actor.init)+'</span><div class="ed-hp">'+btn('hero-minus','−',actor.id)+'<b></b>'+btn('hero-plus','+',actor.id)+'</div></article>';
      }).join('');
      const round=command('order',t('Порядок ходов','Порядок ходів'),'<span>Раунд</span><b>'+esc(state.round)+'</b>',panel==='order');
      const next=t('Следующий ход','Наступний хід');
      html+='<div class="ed-rack">'+round+'<div class="ed-actors">'+actors+'</div>'+command('next',next,'<span>'+next+'</span> →')+'</div>';
      const row=state.rows.find(r=>r.id===selected),b=row&&definition(row);
      if(panel==='order')html+='<aside class="ed-picker"><header>'+t('Порядок ходов','Порядок ходів')+btn('close','×')+'</header><section>'+queue().map(q=>'<label'+(q.id===state.turn?' aria-current="step"':'')+'>'+esc(q.title)+' <input type="number" data-order="'+esc(q.id)+'" value="'+q.init+'"></label>').join('')+'</section><footer>'+btn('picker',t('Добавить врага','Додати ворога'))+btn('finish',t('Завершить бой','Завершити бій'))+'</footer></aside>';
      if(b&&panel==='sheet')html+=detail(row,b);

      if(row&&panel==='status')html+='<aside class="ed-menu"><header>'+t('Статусы','Стани')+' · '+esc(name(row,b))+btn('close','×')+'</header>'+statusDefs().map(s=>{
        const active=row.statuses.includes(s.key);
        const duration=active?'<label class="ed-duration">'+t('Раунды','Раунди')+' <input type="number" min="1" step="1" data-duration="'+esc(s.key)+'" placeholder="∞" value="'+esc(row.statusRounds?.[s.key])+'"></label>':'';
        return btn('status',(active?'✓ ':'')+local(s,'label'),s.key)+duration;
      }).join('')+'</aside>';
    }
    const previous = root.querySelector('.ed-sheet');
    const openAttacks = previous ? Array.from(previous.querySelectorAll('details[open]'), el=>el.dataset.attack) : [];
    const scrollTop = previous?.querySelector('.ed-scroll').scrollTop || 0;
    const railOffset=root.querySelector('.ed-actors')?.scrollLeft || 0;
    root.innerHTML=html;
    const actors=root.querySelector('.ed-actors');
    if(actors)actors.scrollLeft=railOffset;
    const sheet = root.querySelector('.ed-sheet');
    if (sheet && previous && sheet.dataset.enemySheet===previous.dataset.enemySheet && sheet.dataset.section===previous.dataset.section) {
      sheet.querySelectorAll('details').forEach(el=>{ el.open=openAttacks.includes(el.dataset.attack); });
      sheet.querySelector('.ed-scroll').scrollTop=scrollTop;
    }
    syncHeroes();
  }
  let menuPos;
  function anchor(){const m=root.querySelector('.ed-menu');if(m&&menuPos){m.style.left=Math.max(5,Math.min(menuPos.x,innerWidth-m.offsetWidth-8))+'px';m.style.top=Math.max(5,Math.min(menuPos.y,innerHeight-m.offsetHeight-8))+'px';}}
  root.oncontextmenu=e=>{const card=e.target.closest('[data-enemy]');if(!card)return;e.preventDefault();selected=card.dataset.enemy;panel='status';menuPos={x:e.clientX,y:e.clientY};render();anchor();};
  root.oninput=e=>{if(e.target.hasAttribute('data-search'))root.querySelectorAll('[data-op=add]').forEach(n=>n.hidden=!n.textContent.toLowerCase().includes(e.target.value.toLowerCase()));};
  function queue(){
    const heroes=(window.ZargotaGmTable?.targets()||[]).filter(h=>!state.players || state.players.includes(h.key)).map(h=>({id:h.key,title:h.name,init:state.heroInit?.[h.key]??0}));
    return heroes.concat(state.rows.map(r=>({id:r.id,title:name(r,definition(r)||{}),init:r.init}))).sort((a,b)=>b.init-a.init);
  }
  function advanceTurn(removing){
    const order=queue();
    if(!order.length || (removing && order.length===1)){state.turn='';return;}
    const current=order.findIndex(actor=>actor.id===state.turn);
    const next=(current+1)%order.length;
    state.turn=order[next].id;
    if(current>=0 && next===0){
      state.round++;
      for(const row of state.rows){
        row.statuses=row.statuses.filter(key=>{
          const remaining=row.statusRounds?.[key];
          if(!Number.isSafeInteger(remaining))return true;
          if(remaining>1){row.statusRounds[key]=remaining-1;return true;}
          delete row.statusRounds[key];
          return false;
        });
      }
    }
    state.started=true;
    const enemy=state.rows.find(row=>row.id===state.turn);
    if(enemy){
      enemy.used=[];
      const reminders=statusDefs().filter(status=>enemy.statuses.includes(status.key) && status.startOfTurnEffect==='damage')
        .map(status=>local(status,'label')+' · '+(status.startOfTurnDice || status.startOfTurnValue || 0)+' '+t('урона','шкоди'));
      if(reminders.length)window.showToast?.(name(enemy,definition(enemy))+' — '+reminders.join(', '));
    }
  }
  function sort(){state.rows.sort((a,b)=>b.init-a.init);}
  root.onchange=e=>{
    const input=e.target;
    if(panel==='status' && input.hasAttribute('data-duration')){
      const row=state.rows.find(r=>r.id===selected),key=input.dataset.duration;
      if(!row?.statuses.includes(key))return;
      const rounds=input.valueAsNumber;
      row.statusRounds??={};
      if(input.validity.badInput || (input.value && (!Number.isSafeInteger(rounds)||rounds<1))){
        input.value=row.statusRounds[key]??'';
        return;
      }
      if(input.value)row.statusRounds[key]=rounds;else delete row.statusRounds[key];
      save();
      const card=root.querySelector('[data-enemy="'+CSS.escape(row.id)+'"]');
      if(card)card.outerHTML=tile(row,definition(row));
      return;
    }
    if(panel==='setup' && input.dataset.player){
      if(input.checked)draft.heroInit[input.dataset.player]=null;else delete draft.heroInit[input.dataset.player];
      render();return;
    }
    if(panel==='setup' && input.dataset.manual){
      const row=draft.rows.find(r=>r.id===input.dataset.manual);
      const value=Number.isFinite(input.valueAsNumber)?input.valueAsNumber:null;
      if(row)row.init=value;else draft.heroInit[input.dataset.manual]=value;
      return;
    }
    const key=input.dataset.order || input.dataset.init;
    if(!key || !Number.isFinite(input.valueAsNumber))return;
    const enemy=state.rows.find(r=>r.id===key);
    if(enemy)enemy.init=input.valueAsNumber;
    else (state.heroInit??={})[key]=input.valueAsNumber;
    sort();
    if(!state.started)state.turn=queue()[0]?.id;
    save();
    // A blur fires before the click on the next control. Keep that control mounted.
    for(const [index,actor] of queue().entries()){
      const id=CSS.escape(actor.id);
      const tile=root.querySelector('[data-enemy="'+id+'"],[data-player-tile="'+id+'"]');
      if(tile){
        tile.style.order=index;
        tile.classList.toggle('current',actor.id===state.turn);
        tile.querySelector('.ed-roll,small').textContent=actor.init;
      }
      const label=root.querySelector('[data-order="'+CSS.escape(actor.id)+'"]')?.closest('label');
      if(label){
        label.style.order=index;
        if(actor.id===state.turn)label.setAttribute('aria-current','step');
        else label.removeAttribute('aria-current');
      }
    }
    markHeroTurn();
  };
  root.onclick=async e=>{
    const action=e.target.closest('[data-op]') || e.target.closest('[data-enemy]')?.querySelector('.ed-face');
    if(!action)return;
    read();const {op,id}=action.dataset,row=state.rows.find(r=>r.id===id);
    if(op==='toggle'){draft=panel==='setup'?null:{rows:[],heroInit:{}};folderEdit=null;panel=draft?'setup':'';}
    if(op==='hero-minus'||op==='hero-plus'){dockHero(id)?.querySelector('[data-gm-hp="'+(op==='hero-minus'?'-1':'1')+'"]')?.click();return;}
    if(op==='hero'){document.querySelector('[data-gm-open="'+CSS.escape(id)+'"]')?.click();return;}
    if(op==='omit')draft.rows=draft.rows.filter(r=>r.id!==id);
    if(op==='roll')draft.rows.forEach(r=>r.init=roll(r.snapshot));
    if(op==='start'){
      const values=[...Object.values(draft.heroInit),...draft.rows.map(r=>r.init)];
      if(!values.length||values.some(v=>!Number.isFinite(v))){window.showToast?.(t('Выберите участников и укажите инициативу каждого.','Виберіть учасників і вкажіть ініціативу кожного.'));return;}
      state={on:true,rows:draft.rows,heroInit:draft.heroInit,players:Object.keys(draft.heroInit),round:1};
      sort();state.turn=queue()[0]?.id;draft=null;panel='';
    }
    if(op==='finish'){state.on=false;draft=null;panel='';}
    if(op==='picker')panel=panel==='picker'?'':'picker';
    if(op==='order')panel=panel==='order'?'':'order';
    if(op==='close'){if(panel==='picker'&&draft)panel='setup';else{panel='';draft=null;}folderEdit=null;}
    if(op==='inspect'){panel=selected===id&&panel==='sheet'?'':'sheet';selected=id;tab='actions';}
    if(op==='tab')tab=id;
    if(op==='use'){const enemy=state.rows.find(r=>r.id===selected);if(enemy){const n=Number(id);enemy.used=enemy.used?.includes(n)?enemy.used.filter(k=>k!==n):[...(enemy.used||[]),n];}}
    if(op==='add'){const b=all().find(b=>String(b.id)===id);if(!b)return;
      if(folderEdit){folderEdit.add(b);folderEdit=null;panel='';}
      else if(draft){draft.rows.push(enemyRow(b,draft.rows));panel='setup';}
      else {const r=enemyRow(b,state.rows);r.init=roll(b);state.rows.push(r);sort();if(!state.started)state.turn=queue()[0].id;panel='';}
    }
    if(row&&(op==='minus'||op==='plus'))row.hp=Math.max(0,Math.min(definition(row).hp,row.hp+(op==='plus'?1:-1)));
    if(op==='remove'&&row){
      if(state.turn===id)advanceTurn(true);
      state.rows=state.rows.filter(r=>r!==row);
      panel='';
      if(!queue().length)state.on=false;
    }
    if(op==='status'){
      const enemy=state.rows.find(r=>r.id===selected);
      const status=statusDefs().find(s=>s.key===id);
      if(enemy && status){
        enemy.statusRounds??={};
        if(enemy.statuses.includes(id)){
          enemy.statuses=enemy.statuses.filter(key=>key!==id);
          delete enemy.statusRounds[id];
        }else{
          enemy.statuses.push(id);
          if(status.defaultDuration>0)enemy.statusRounds[id]=Number(status.defaultDuration);
        }
      }
      panel='';
    }
    if(op==='next')advanceTurn(false);
    if(['start','finish','add','minus','plus','use','remove','status','next'].includes(op))save();
    render();
    if(op==='next')root.querySelector('.ed-actors .current')?.scrollIntoView({block:'nearest',inline:'nearest'});
    if(panel==='picker')root.querySelector('[data-search]')?.focus({preventScroll:true});
    if(panel==='picker'&&!all().length){try{const res=await fetch('data.json');catalog=(await res.json()).beasts;render();}catch{window.showToast?.(t('Не удалось загрузить бестиарий','Не вдалося завантажити бестіарій'));}}
  };
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape' && panel && (root.contains(e.target)||e.target===document.body) && document.body.classList.contains('zg-irl-table-view')){
      e.preventDefault();
      e.stopPropagation();
      const previous=panel;
      panel=panel==='picker'&&draft?'setup':'';folderEdit=null;if(!panel)draft=null;render();
      root.querySelector(previous==='order'?'[data-op=order]':previous==='picker'?'[data-op=picker]':'[data-id="'+CSS.escape(selected)+'"][data-op=inspect]')?.focus({preventScroll:true});
    }
  },true);
  document.addEventListener('zargota:localechange',()=>{render();anchor();});
  document.addEventListener('pointerdown',e=>{if(['picker','status','order'].includes(panel)&&!root.contains(e.target)){panel=panel==='picker'&&draft?'setup':'';folderEdit=null;render();}});
  window.ZargotaEnemyDock={
    chooseForFolder(add){draft=null;folderEdit={add};panel='picker';render();},
    acceptFolder(x,y,refs){
      const inside=[...root.querySelectorAll('.ed-rack,.ed-tools button,.ed-setup')].some(el=>{const b=el.getBoundingClientRect();return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;});
      if(!refs?.length || !inside)return false;
      const defs=refs.map(ref=>all().find(b=>String(b.id)===ref)).filter(Boolean);
      if(!defs.length)return false;
      folderEdit=null;
      if(!state.on){draft??={rows:[],heroInit:{}};panel='setup';}
      const rows=state.on?state.rows:draft.rows;
      for(const b of defs){const r=enemyRow(b,rows);if(state.on)r.init=roll(b);rows.push(r);}
      if(state.on){sort();if(!state.started)state.turn=queue()[0]?.id;save();}render();return true;
    },
    refresh(){const old=owner;read();if(old!==owner){draft=null;folderEdit=null;render();}else if(state.on)queueMicrotask(()=>{
      const visible=Array.from(root.querySelectorAll('[data-player-tile]'),el=>el.dataset.playerTile).sort();
      const expected=heroes().filter(h=>!state.players||state.players.includes(h.key)).map(h=>h.key).sort();
      if(visible.length!==expected.length || visible.some((id,i)=>id!==expected[i]))render();else syncHeroes();
    });}};
  const names=table.querySelector('#zg-irl-name-tool');
  if(names){
    const rail=names.parentElement;
    let drag=null,skipClick=false;
    function placeNames(x,y){
      rail.style.left=Math.max(0,Math.min(innerWidth-rail.offsetWidth,x))+'px';
      rail.style.top=Math.max(0,Math.min(innerHeight-rail.offsetHeight,y))+'px';
      rail.style.bottom='auto';
    }
    names.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      skipClick=false;
      const b=rail.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:b.left,top:b.top};
      names.setPointerCapture(e.pointerId);
    });
    names.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!skipClick&&Math.hypot(dx,dy)<4)return;
      skipClick=true;placeNames(drag.left+dx,drag.top+dy);
    });
    names.addEventListener('pointerup',()=>{
      if(drag&&skipClick){try{localStorage.setItem('zg-gm-names-position',JSON.stringify([parseFloat(rail.style.left),parseFloat(rail.style.top)]));}catch{}}
      drag=null;
    });
    names.addEventListener('click',()=>{
      const pop=table.querySelector('#zg-irl-name-popover.open');
      if(!pop)return;
      const b=names.getBoundingClientRect();
      const above=b.top-8,below=innerHeight-b.bottom-8;
      const useAbove=above>=below;
      pop.style.maxHeight=Math.max(80,useAbove?above-8:below-8)+'px';
      pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,b.left))+'px';
      pop.style.bottom='auto';
      pop.style.top=(useAbove?Math.max(8,above-pop.offsetHeight):b.bottom+8)+'px';
    });
    names.addEventListener('pointercancel',()=>{drag=null;});
    names.addEventListener('click',e=>{if(skipClick){e.stopImmediatePropagation();e.preventDefault();skipClick=false;}},true);
    try{const pos=JSON.parse(localStorage.getItem('zg-gm-names-position'));if(Array.isArray(pos)&&pos.length===2&&pos.every(Number.isFinite))placeNames(...pos);}catch{}
    window.addEventListener('resize',()=>{if(rail.style.left)placeNames(parseFloat(rail.style.left),parseFloat(rail.style.top));});
  }
  render();
  document.addEventListener('DOMContentLoaded',()=>{
    const log=window.ZG_APP_CHANGELOG?.[0];
    if(log){log.notes+=' В конце раунда истекают временные статусы врагов. В начале хода появляется подсказка об уроне. При удалении противника ход переходит по очереди инициативы. Длительность статуса можно изменить через правую кнопку. Раунд, карточки участников и переход хода собраны в верхней полосе. Перед боем мастер выбирает участников и задаёт инициативу. Папку с существами можно перенести на бой. При изменении HP сохраняется положение очереди. В листе врага действия, черты и описание открываются отдельными страницами.';log.notesUk+=' Наприкінці раунду спливають тимчасові стани ворогів. На початку ходу з’являється підказка про шкоду. Після вилучення ворога хід переходить за чергою ініціативи. Тривалість стану можна змінити правою кнопкою. Раунд, картки учасників і перехід ходу зібрано у верхній смузі. Перед боєм майстер вибирає учасників і задає ініціативу. Папку з істотами можна перетягнути на бій. Під час зміни HP зберігається положення черги. В аркуші ворога дії, риси й опис відкриваються окремими сторінками.';}
  });
})();
