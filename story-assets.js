(function(w){
  'use strict';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  var resourceDirectory=null;
  function directoryStore(value){return new Promise(function(resolve){
    if(!w.indexedDB)return resolve(null);
    var request;try{request=w.indexedDB.open('zg-story-resource-directory',1);}catch(e){return resolve(null);}
    request.onupgradeneeded=function(){request.result.createObjectStore('handles');};
    request.onerror=function(){resolve(null);};
    request.onsuccess=function(){var db=request.result;try{var tx=db.transaction('handles',value?'readwrite':'readonly'),store=tx.objectStore('handles'),op=value?store.put(value,'stories'):store.get('stories'),result=null;op.onsuccess=function(){result=op.result;};tx.oncomplete=function(){db.close();resolve(result);};tx.onerror=tx.onabort=function(){db.close();resolve(null);};}catch(e){db.close();resolve(null);}};
  });}
  async function readDirectory(directory,prefix,files){for await(var entry of directory.values()){var name=prefix+entry.name;if(entry.kind==='directory')await readDirectory(entry,name+'/',files);else{var type=/\.(png|jpe?g|webp|gif|svg)$/i.test(name)?'image':/\.(mp3|ogg|wav|m4a|webm)$/i.test(name)?'audio':'';if(type)files.push({name:name,path:'assets/stories/'+name.split('/').map(encodeURIComponent).join('/'),type:type});}}return files;}
  async function connectLocalDirectory(){
    resourceDirectory=resourceDirectory||await directoryStore();
    if(resourceDirectory){
      if(!resourceDirectory.queryPermission)return;
      var permission=await resourceDirectory.queryPermission({mode:'read'});
      if(permission==='granted')return;
      if(resourceDirectory.requestPermission&&await resourceDirectory.requestPermission({mode:'read'})==='granted')return;
      throw Error('folder-access');
    }
    if(!w.showDirectoryPicker)throw Error('folder-unsupported');
    var chosen=await w.showDirectoryPicker({id:'story-resources',mode:'read'});
    if(chosen.name!=='stories')throw Error('folder-name');
    resourceDirectory=chosen;await directoryStore(chosen);
  }
  function valid(file){return file&&/^assets\/stories\//.test(file.path)&&!file.path.split('/').some(function(p){try{return ['..','.'].includes(decodeURIComponent(p));}catch(e){return true;}})&&['image','audio'].includes(file.type);}
  async function freshCatalog(){
    resourceDirectory=resourceDirectory||await directoryStore();
    if(resourceDirectory){try{if(!resourceDirectory.queryPermission||await resourceDirectory.queryPermission({mode:'read'})==='granted')return {files:await readDirectory(resourceDirectory,'',[]),live:true};}catch(e){resourceDirectory=null;}}
    if(location.protocol==='file:')throw Error('folder-access');
    var catalog=null;
    try{var response=await fetch('assets/stories/catalog.json?refresh='+Date.now(),{cache:'no-store'});if(response.ok)catalog=await response.json();}catch(e){}
    // Local static servers expose a directory index. Hosted builds use the fresh manifest.
    var base=new URL('assets/stories/',location.href),found=[],indexed=false,visited=new Set();
    async function scan(url){if(visited.has(url.href)||visited.size>100)return;visited.add(url.href);var r=await fetch(url.href,{cache:'no-store'});if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))return;var doc=new DOMParser().parseFromString(await r.text(),'text/html');if(!/Directory listing|Index of/i.test(doc.title))return;indexed=true;for(var a of doc.querySelectorAll('a[href]')){var u=new URL(a.getAttribute('href'),url);if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname)||u.pathname===url.pathname||u.search)continue;if(u.pathname.endsWith('/'))await scan(u);else{var type=/\.(png|jpe?g|webp|gif|svg)$/i.test(u.pathname)?'image':/\.(mp3|ogg|wav|m4a|webm)$/i.test(u.pathname)?'audio':'';if(type)found.push({path:'assets/stories/'+u.pathname.slice(base.pathname.length),name:decodeURIComponent(u.pathname.slice(base.pathname.length)),type:type});}}}
    try{await scan(base);}catch(e){indexed=false;}if(indexed)return {files:found,live:true};
    if(!catalog)await new Promise(function(resolve){var script=document.createElement('script');script.src='assets/stories/catalog.js?refresh='+Date.now();script.onload=script.onerror=function(){script.remove();resolve();};document.head.appendChild(script);});
    catalog=catalog||w.ZargotaStoryAssetCatalog;if(!catalog)throw Error('catalog');return catalog;
  }
  function repair(value){
    if(typeof value==='string'){if(!value.startsWith('assets/stories/portraits/'))return value;var decoded;try{decoded=decodeURIComponent(value);}catch(e){return value;}if(w.ZargotaStoryPortraitAliases?.[decoded])return w.ZargotaStoryPortraitAliases[decoded].split('/').map(encodeURIComponent).join('/');var candidate=decoded.replace(/^assets\/stories\/portraits\/Портреты\//,'assets/stories/portraits/Portraits/');if(candidate!==decoded&&(w.ZargotaStoryAssetCatalog?.files||[]).some(function(f){return decodeURIComponent(f.path)===candidate;}))return candidate.split('/').map(encodeURIComponent).join('/');return value;}
    if(Array.isArray(value))return value.map(repair);if(value&&typeof value==='object'){var copy={};Object.keys(value).forEach(function(k){copy[k]=repair(value[k]);});return copy;}return value;
  }
  function assetCategory(file){var parts=String(file.path||file.name||'').toLowerCase().split('/');return ['backgrounds','portraits','objects','animations','audio'].find(function(key){return parts.includes(key);})||'other';}
  async function pick(type,choose){
    var old=document.getElementById('zg-story-assets');if(old)old.remove();
    var panel=document.createElement('dialog');panel.id='zg-story-assets';panel.style.cssText='width:min(1080px,90vw);max-height:80vh;background:#111b19;color:#eee3cc;border:1px solid #668477;border-radius:12px;padding:24px;z-index:20000';
    var title=document.createElement('h3');title.textContent=t('Ресурсы проекта','Ресурси проєкту');panel.appendChild(title);
    var close=document.createElement('button');close.textContent=t('Закрыть','Закрити');close.onclick=function(){panel.close();panel.remove();};panel.appendChild(close);
    if(w.showDirectoryPicker){var folder=document.createElement('button');folder.type='button';folder.textContent=t('Указать папку assets/stories…','Вказати папку assets/stories…');folder.onclick=async function(){try{var chosen=await w.showDirectoryPicker({id:'story-resources',mode:'read'});if(chosen.name!=='stories'){folder.textContent=t('Выберите именно папку stories внутри assets','Оберіть саме папку stories всередині assets');return;}resourceDirectory=chosen;await directoryStore(chosen);panel.close();panel.remove();pick(type,choose);}catch(e){if(e.name!=='AbortError')folder.textContent=t('Нет доступа к папке. Повторить','Немає доступу до папки. Повторити');}};panel.appendChild(folder);}
    var status=document.createElement('p');status.setAttribute('role','status');panel.appendChild(status);
    var search=document.createElement('input');search.placeholder=t('Найти файл…','Знайти файл…');search.style.cssText='display:block;width:95%;margin:16px 0;padding:10px';panel.appendChild(search);
    var category='all',filters=document.createElement('div');filters.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px';panel.appendChild(filters);
    var list=document.createElement('div');list.className='zg-asset-grid';list.style.cssText='display:grid;gap:8px;max-height:50vh;overflow:auto';panel.appendChild(list);document.body.appendChild(panel);panel.showModal();
    list.textContent=t('Обновление списка файлов…','Оновлення списку файлів…');try{if(location.protocol==='file:')await connectLocalDirectory();if(!panel.isConnected)return;var catalog=await freshCatalog();if(!panel.isConnected)return;status.textContent=catalog.live?t('Содержимое папки проверено заново.','Вміст папки перевірено знову.'):t('Сервер отдаёт готовый каталог, а не содержимое папки. Укажите assets/stories один раз для проверки новых файлов при каждом открытии. Если выбор папки недоступен, обновите каталог на сервере командой npm run story:assets.','Сервер віддає готовий каталог, а не вміст папки. Укажіть assets/stories один раз для перевірки нових файлів при кожному відкритті. Якщо вибір папки недоступний, оновіть каталог на сервері командою npm run story:assets.');var files=(catalog.files||[]).filter(function(f){return valid(f)&&f.type===type;});
      var categories=[['all',t('Все','Усі')],['backgrounds',t('Фоны','Тло')],['portraits',t('Портреты','Портрети')],['objects',t('Объекты','Об’єкти')],['animations',t('Анимации','Анімації')],['audio',t('Звуки','Звуки')],['other',t('Другие','Інші')]];
      categories.filter(function(c){return c[0]==='all'||files.some(function(f){return assetCategory(f)===c[0];});}).forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=c[1];b.dataset.category=c[0];b.style.cssText='font:inherit;color:inherit;border:1px solid #668477;border-radius:9px;padding:7px 13px;background:#192c24';b.onclick=function(){category=c[0];render();list.scrollTop=0;};filters.appendChild(b);});
      function render(){filters.querySelectorAll('button').forEach(function(b){var active=b.dataset.category===category;b.setAttribute('aria-pressed',String(active));b.style.borderColor=active?'#e5c16f':'#668477';b.style.background=active?'#344535':'#192c24';});list.replaceChildren();files.filter(function(f){return (category==='all'||assetCategory(f)===category)&&f.name.toLowerCase().includes(search.value.toLowerCase());}).forEach(function(f){var b=document.createElement('button');b.className='zg-asset-tile';b.title=f.name;var image=document.createElement(f.type==='image'?'img':'span');if(f.type==='image'){image.src=f.path;image.alt='';image.loading='lazy';}else image.textContent='♫';var caption=document.createElement('span');caption.textContent=f.name.split('/').pop();b.append(image,caption);b.onclick=function(){choose(f.path);panel.close();panel.remove();};list.appendChild(b);});if(!list.childNodes.length)list.textContent=t('Подходящих файлов нет. Добавьте файл в assets/stories и откройте выбор снова.','Відповідних файлів немає. Додайте файл до assets/stories та відкрийте вибір знову.');}search.oninput=render;render();
    }catch(e){if(!panel.isConnected)return;list.textContent=location.protocol==='file:'?(e.message==='folder-name'?t('Выберите именно папку stories внутри assets.','Оберіть саме папку stories всередині assets.'):e.message==='folder-unsupported'?t('Этот браузер не поддерживает доступ к папке. Откройте index.html в Edge или Chrome.','Цей браузер не підтримує доступ до папки. Відкрийте index.html в Edge або Chrome.'):t('Для списка файлов разрешите чтение папки assets/stories кнопкой выше. После этого она проверяется только при открытии этого окна.','Для списку файлів дозвольте читання папки assets/stories кнопкою вище. Після цього вона перевіряється лише під час відкриття цього вікна.')):t('Каталог недоступен. Укажите папку assets/stories кнопкой выше.','Каталог недоступний. Укажіть папку assets/stories кнопкою вище.');}
  }
  function attach(input,type){if(!input||input.dataset.resourcePicker)return;input.dataset.resourcePicker='1';var b=document.createElement('button');b.type='button';b.textContent=t('▧ Из папки ресурсов','▧ З папки ресурсів');b.onclick=function(){pick(type,function(path){input.value=path;input.dispatchEvent(new Event('change',{bubbles:true}));});};input.after(b);}
  function exportEpisode(data,records){
    var copy=JSON.parse(JSON.stringify(data));var scenes=(records||[]).map(function(r){return {id:r.id,name:r.name,scene:r.id===copy.activeSceneId?copy.scene:r.scene};});
    if(copy.scene&&!scenes.some(function(r){return r.id===copy.activeSceneId;})){var id=copy.activeSceneId||'scene-draft';scenes.push({id:id,name:copy.title||id,scene:copy.scene});copy.activeSceneId=id;}
    copy.scenes=scenes.length?scenes:(copy.scenes||[]);
    function check(value){if(typeof value==='string'&&/^(data:|blob:|file:)/i.test(value))throw Error('embedded-media');if(value&&typeof value==='object')Object.keys(value).forEach(function(k){check(value[k]);});}check(copy);
    return JSON.stringify({format:'zargota-story',version:1,episode:copy},null,2);
  }
  w.ZargotaStoryAssets={pick:pick,attach:attach,exportEpisode:exportEpisode,repair:repair,freshCatalog:freshCatalog};
})(window);
