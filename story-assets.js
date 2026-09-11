(function(w){
  'use strict';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function valid(file){return file&&/^assets\/stories\//.test(file.path)&&!file.path.split('/').some(function(p){try{return ['..','.'].includes(decodeURIComponent(p));}catch(e){return true;}})&&['image','audio'].includes(file.type);}
  async function pick(type,choose){
    var old=document.getElementById('zg-story-assets');if(old)old.remove();
    var panel=document.createElement('dialog');panel.id='zg-story-assets';panel.style.cssText='width:min(1080px,90vw);max-height:80vh;background:#111b19;color:#eee3cc;border:1px solid #668477;border-radius:12px;padding:24px;z-index:20000';
    var title=document.createElement('h3');title.textContent=t('Ресурсы проекта','Ресурси проєкту');panel.appendChild(title);
    var close=document.createElement('button');close.textContent=t('Закрыть','Закрити');close.onclick=function(){panel.close();panel.remove();};panel.appendChild(close);
    var search=document.createElement('input');search.placeholder=t('Найти файл…','Знайти файл…');search.style.cssText='display:block;width:95%;margin:16px 0;padding:10px';panel.appendChild(search);
    var list=document.createElement('div');list.className='zg-asset-grid';list.style.cssText='display:grid;gap:8px;max-height:50vh;overflow:auto';panel.appendChild(list);document.body.appendChild(panel);panel.showModal();
    try{var catalog=w.ZargotaStoryAssetCatalog;if(!catalog){var response=await fetch('assets/stories/catalog.json',{cache:'no-store'});if(!response.ok)throw Error('catalog');catalog=await response.json();}var files=(catalog.files||[]).filter(function(f){return valid(f)&&f.type===type;});
      function render(){list.replaceChildren();files.filter(function(f){return f.name.toLowerCase().includes(search.value.toLowerCase());}).forEach(function(f){var b=document.createElement('button');b.className='zg-asset-tile';b.title=f.name;var image=document.createElement(f.type==='image'?'img':'span');if(f.type==='image'){image.src=f.path;image.alt='';image.loading='lazy';}else image.textContent='♫';var caption=document.createElement('span');caption.textContent=f.name.split('/').pop();b.append(image,caption);b.onclick=function(){choose(f.path);panel.close();panel.remove();};list.appendChild(b);});if(!list.childNodes.length)list.textContent=t('Добавьте файлы в assets/stories и выполните npm run story:assets.','Додайте файли до assets/stories та виконайте npm run story:assets.');}search.oninput=render;render();
    }catch(e){list.textContent=t('Каталог недоступен. Выполните npm run story:assets и обновите страницу.','Каталог недоступний. Виконайте npm run story:assets та оновіть сторінку.');}
  }
  function attach(input,type){if(!input||input.dataset.resourcePicker)return;input.dataset.resourcePicker='1';var b=document.createElement('button');b.type='button';b.textContent=t('▧ Из папки ресурсов','▧ З папки ресурсів');b.onclick=function(){pick(type,function(path){input.value=path;input.dispatchEvent(new Event('change',{bubbles:true}));});};input.after(b);}
  function exportEpisode(data,records){
    var copy=JSON.parse(JSON.stringify(data));var scenes=(records||[]).map(function(r){return {id:r.id,name:r.name,scene:r.id===copy.activeSceneId?copy.scene:r.scene};});
    if(copy.scene&&!scenes.some(function(r){return r.id===copy.activeSceneId;})){var id=copy.activeSceneId||'scene-draft';scenes.push({id:id,name:copy.title||id,scene:copy.scene});copy.activeSceneId=id;}
    copy.scenes=scenes.length?scenes:(copy.scenes||[]);
    function check(value){if(typeof value==='string'&&/^(data:|blob:|file:)/i.test(value))throw Error('embedded-media');if(value&&typeof value==='object')Object.keys(value).forEach(function(k){check(value[k]);});}check(copy);
    return JSON.stringify({format:'zargota-story',version:1,episode:copy},null,2);
  }
  w.ZargotaStoryAssets={pick:pick,attach:attach,exportEpisode:exportEpisode};
})(window);
