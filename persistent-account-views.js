(function(w){
  'use strict';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function button(action,label,sid,extra){return '<button type="button" data-pc-action="'+action+'"'+(sid?' data-sheet="'+esc(sid)+'"':'')+(extra||'')+'>'+label+'</button>';}
  function safeImage(value){
    if(!value)return '';
    if(/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))return value;
    try{var url=new URL(value,location.href);return /^(http:|https:)$/.test(url.protocol)?url.href:'';}catch(_){return '';}
  }
  function avatar(hero,admin){
    var image=hero&&safeImage(hero.portrait),letter=admin?'♛':String(hero&&hero.name||'?').trim().slice(0,1);
    var source=w.ZargotaPortrait&&w.ZargotaPortrait.sources(hero,'thumb');
    return '<span class="pc-avatar'+(admin?' pc-avatar-admin':'')+'" aria-hidden="true">'+(image?'<img'+(source?' srcset="'+source.srcset+'" sizes="'+source.sizes+'"':'')+' src="'+esc(image)+'" alt="" loading="lazy" decoding="async">':esc(letter))+'</span>';
  }
  function accountCard(item,manage){
    var hero=item.hero||{},sid=item.sid,admin=item.admin;
    var name=admin?t('Мой аккаунт','Мій акаунт'):hero.name||t('Персонаж','Персонаж');
    var detail=admin?t('Все ваши игроки и их листы','Усі ваші гравці та їхні аркуші'):[hero.race,hero.klasse].filter(Boolean).join(' · ');
    var actions=admin?button('master-code',t('Мой код администратора','Мій код адміністратора')):
      button('account-open',t('Открыть лист','Відкрити аркуш'),sid)+(manage?button('account-code',t('Код входа','Код входу'),sid)+button('history',t('История','Історія'),sid):'');
    return '<article class="pc-account-card'+(admin?' pc-account-admin':'')+'"'+(sid?' data-account-sheet="'+esc(sid)+'"':'')+'>'+avatar(admin?null:hero,admin)+
      '<div class="pc-account-info"><span class="pc-role">'+(admin?t('Администратор · это вы','Адміністратор · це ви'):t('Игрок','Гравець'))+'</span><h3>'+esc(name)+'</h3><p>'+esc(detail)+'</p>'+
      (!admin?'<span class="pc-online'+(item.online?' is-online':'')+'">'+(item.online?t('Онлайн','Онлайн'):t('Не в сети','Не в мережі'))+'</span>'+(!item.online&&item.lastSeen?'<small class="pc-last-seen">'+t('Последний раз в сети: ','Востаннє в мережі: ')+esc(new Date(item.lastSeen).toLocaleString(t('ru-RU','uk-UA'),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</small>':'')+(manage&&item.unread?'<span class="pc-unread">● '+t('Есть изменения','Є зміни')+'</span>':''):'')+'</div><div class="pc-account-actions">'+actions+'</div></article>';
  }
  function online(items){
    var limit=w.matchMedia('(max-width:700px)').matches?1:3;
    return items.slice(0,limit).map(function(item){var label=item.hero.name+' · '+t('онлайн','онлайн')+(item.unread?' · '+t('есть изменения','є зміни'):'');return '<button type="button" class="pc-online-avatar'+(item.unread?' pc-has-updates':'')+'" data-pc-action="account-open" data-sheet="'+esc(item.sid)+'" title="'+esc(label)+'" aria-label="'+esc(label)+'">'+avatar(item.hero,false)+'<i aria-hidden="true"></i></button>';}).join('')+(items.length>limit?button('settings','+'+(items.length-limit),null,' class="pc-online-more" aria-label="'+t('Все игроки онлайн','Усі гравці онлайн')+'"'):'');
  }
  function login(available){
    var art='<img class="pc-login-art" src="images/ui/main-menu/home-helm.webp" alt="" width="116" height="116">';
    if(!available)return art+'<p class="pc-login-intro">'+t('Вход по кодам ещё не включён. Вы можете пользоваться разделами сайта без входа.','Вхід за кодами ще не ввімкнено. Ви можете користуватися розділами сайту без входу.')+'</p>'+button('ordinary',t('Продолжить без входа','Продовжити без входу'),null,' class="pc-guest"');
    return art+'<p class="pc-login-intro">'+t('Введите код, который дал мастер.','Введіть код, який дав майстер.')+'</p><form id="pc-login-form"><label for="persistent-login-code">'+t('Личный код','Особистий код')+'</label><input id="persistent-login-code" name="code" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required aria-describedby="pc-login-remember" placeholder="'+t('Введите код','Введіть код')+'"><button type="submit" class="pc-primary" data-pc-action="login">'+t('Открыть свой лист','Відкрити свій аркуш')+'</button></form><p id="pc-login-remember" class="pc-login-remember">'+t('Вход сохранится на этом устройстве.','Вхід збережеться на цьому пристрої.')+'</p>'+button('ordinary',t('Продолжить без входа','Продовжити без входу'),null,' class="pc-guest"');
  }
  function presence(item){
    var last=item.lastSeen&&Number.isFinite(Number(item.lastSeen))?new Date(Number(item.lastSeen)).toLocaleString(t('ru-RU','uk-UA'),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    return '<span class="pc-online'+(item.online?' is-online':'')+'">'+(item.online?t('Онлайн','Онлайн'):t('Не в сети','Не в мережі'))+'</span>'+(!item.online&&last?'<small class="pc-last-seen">'+t('Был(а): ','Був(ла): ')+esc(last)+'</small>':'');
  }
  function accounts(items,selectedSid){
    var selected=items.find(function(item){return item.sid===selectedSid;})||items[0];
    return '<div class="pc-roster-heading"><h3>'+t('Игроки','Гравці')+' <span data-pc-player-count>'+items.length+'</span></h3>'+button('account-add','<span aria-hidden="true">＋</span> '+t('Добавить','Додати'))+'</div><div class="pc-master-controls">'+button('master-code','<span aria-hidden="true">⚿</span> '+t('Мастер · вы','Майстер · ви'),null,' class="pc-account-master pc-account-admin"')+button('leave',t('Выйти','Вийти'),null,' class="pc-leave-link"')+'</div><div id="pc-account-list" class="pc-account-roster">'+roster(items,selected&&selected.sid)+'</div><div id="pc-account-detail">'+accountDetail(selected)+'</div>';
  }
  function roster(items,selectedSid){
    if(!items.length)return '<div class="pc-account-empty"><p>'+t('Добавьте первого игрока','Додайте першого гравця')+'</p><small>'+t('Выберите его персонажа и передайте личный код.','Виберіть його персонажа й передайте особистий код.')+'</small></div>';
    return items.map(function(item){var hero=item.hero||{},active=item.sid===selectedSid;return button('select-account',avatar(hero,false)+'<span class="pc-account-info"><b>'+esc(hero.name||t('Персонаж','Персонаж'))+'</b>'+presence(item)+(item.unread?'<span class="pc-unread">'+t('Есть изменения','Є зміни')+'</span>':'')+'</span><span class="pc-row-chevron" aria-hidden="true">›</span>',item.sid,' class="pc-account-card pc-account-row'+(active?' is-selected':'')+'" aria-pressed="'+active+'" data-account-sheet="'+esc(item.sid)+'"');}).join('');
  }
  function accountDetail(item){
    if(!item)return '';
    var hero=item.hero||{};
    return '<section class="pc-selected-account" data-account-detail="'+esc(item.sid)+'"><h3>'+esc(hero.name||t('Персонаж','Персонаж'))+'</h3><div class="pc-code-summary"><span>'+t('Личный код','Особистий код')+'</span><span class="pc-code-mask" aria-label="'+(item.code?t('Личный код','Особистий код'):t('Код скрыт','Код приховано'))+'">'+esc(item.code||'••••')+'</span>'+button('account-code',item.code?t('Скрыть код','Приховати код'):t('Показать код','Показати код'),item.sid)+(item.code?button('copy-account-code',t('Копировать','Копіювати'),item.sid):'')+'</div><p class="pc-code-hint">'+t('Игрок вводит код один раз на каждом устройстве.','Гравець вводить код один раз на кожному пристрої.')+'</p><div class="pc-detail-actions">'+button('account-open',t('Открыть лист','Відкрити аркуш'),item.sid,' class="pc-primary"')+button('history',t('История изменений','Історія змін'),item.sid)+button('message',t('Написать','Написати'),item.sid)+'</div></section>';
  }
  function accountMenu(item,statusText,logged){
    var hero=item&&item.hero;
    if(!logged)return '<p class="pc-popover-title">'+t('Ваш персонаж','Ваш персонаж')+'</p><p class="pc-popover-copy">'+t('Войдите один раз, чтобы открыть свой лист на этом устройстве.','Увійдіть один раз, щоб відкрити свій аркуш на цьому пристрої.')+'</p>'+button('menu',t('Войти','Увійти'),null,' class="pc-primary"')+'<div class="pc-popover-actions">'+button('character-actions',t('Действия персонажа','Дії персонажа'))+'</div>';
    return '<div class="pc-popover-identity">'+avatar(hero,!hero)+'<b>'+esc(hero&&hero.name||t('Мастер','Майстер'))+'</b></div><p class="pc-popover-title">'+(hero?t('Мой персонаж','Мій персонаж'):t('Мой аккаунт','Мій акаунт'))+'</p><p class="pc-popover-state" role="status">'+esc(statusText||t('Вход сохранён','Вхід збережено'))+'</p><p class="pc-popover-copy">'+t('Повторно вводить код не нужно.','Повторно вводити код не потрібно.')+'</p><div class="pc-popover-actions">'+button('character-actions',t('Действия персонажа','Дії персонажа'))+(item&&item.sid?button('message',t('Сообщения','Повідомлення'),item.sid):'')+button('settings',t('Учётная запись','Обліковий запис'))+button('leave',t('Выйти из аккаунта','Вийти з акаунта'))+'</div>';
  }
  function mine(items){return '<div class="pc-account-intro">'+t('Вы вошли по личному коду. Повторно вводить его на этом устройстве не нужно.','Ви увійшли за особистим кодом. Повторно вводити його на цьому пристрої не потрібно.')+'</div><div class="pc-account-grid">'+items.map(function(item){return accountCard(item,false);}).join('')+'</div><div class="pc-mine-controls">'+button('menu',t('Войти по другому коду','Увійти за іншим кодом'))+button('leave',t('Выйти','Вийти'),null,' class="pc-leave-link"')+'</div>';}
  function picker(chars){chars=chars.filter(function(c){return c.type!=='npc';});return '<div class="pc-new-character">'+button('account-new',t('＋ Создать нового персонажа','＋ Створити нового персонажа'),null,' class="pc-primary"')+'</div><p>'+t('Выберите персонажа игрока. Его портрет станет аватаркой аккаунта.','Виберіть персонажа гравця. Його портрет стане аватаркою акаунта.')+'</p><div class="pc-character-picker">'+chars.map(function(c){return '<button type="button" class="pc-character-choice" data-pc-action="account-create" data-character="'+esc(c.id)+'">'+avatar(c,false)+'<span><b>'+esc(c.name)+'</b><small>'+esc([c.race,c.klasse].filter(Boolean).join(' · '))+'</small></span><i aria-hidden="true">＋</i></button>';}).join('')+'</div>'+(!chars.length?'<p>'+t('Все существующие персонажи уже подключены. Вы можете создать нового здесь.','Усі наявні персонажі вже підключені. Ви можете створити нового тут.')+'</p>':'')+button('settings',t('← Аккаунты','← Акаунти'));}
  w.ZargotaAccountViews={avatar:avatar,login:login,accounts:accounts,roster:roster,accountDetail:accountDetail,accountMenu:accountMenu,mine:mine,picker:picker,online:online};
})(window);
