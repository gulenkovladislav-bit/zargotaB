/* Stock portraits are versioned assets. Personal uploads never share their paths. */
(function (w) {
  'use strict';
  var heroes = [
    ['evan',1776627463516,'Evan'], ['melissa',1776626039651,'Melissa'],
    ['esteros',1776463717210,'Esteros'], ['vrotik',1778221131899,'Vrotik'],
    ['lin-yin',1778221143711,'LinIn']
  ];
  function t(ru,uk) { return w.ZargotaI18n && w.ZargotaI18n.getLocale()==='uk' ? uk : ru; }
  function entry(c) { return heroes.find(function(h){return c.campaignKey===h[0] || String(c.id)===String(h[1]);}); }
  function choices(c) {
    var h=entry(c); if(!h)return [];
    return [
      {src:'images/portraits/defaults/'+h[0]+'-2026-11.png',label:t('Новый портрет','Новий портрет')},
      {src:'images/heroart/'+h[2]+'.png',label:t('В тумане','У тумані')},
      {src:'images/portraits/defaults/'+h[0]+'-classic.png',label:t('Прежний портрет','Попередній портрет')}
    ];
  }
  // An older upload can occupy the original stock filename in IndexedDB.
  // If storage cannot be inspected, preserve the existing portrait.
  function hasUpload(path) {
    return new Promise(function(resolve){
      if(!w.indexedDB){resolve(true);return;}
      var request;
      try { request=w.indexedDB.open('zargota_imagestore'); } catch(e){resolve(true);return;}
      request.onupgradeneeded=function(){
        if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images');
      };
      request.onerror=request.onblocked=function(){resolve(true);};
      request.onsuccess=function(){
        var db=request.result;
        if(!db.objectStoreNames.contains('images')){db.close();resolve(false);return;}
        try {
          var read=db.transaction('images','readonly').objectStore('images').get(path);
          read.onsuccess=function(){db.close();resolve(!!(read.result&&read.result.blob));};
          read.onerror=function(){db.close();resolve(true);};
        } catch(e){db.close();resolve(true);}
      };
    });
  }
  async function upgradeDefaults(collection, inspect) {
    var changed=false;
    await Promise.all(collection.map(async function(c){
      var h=entry(c),old=c.portrait;
      if(!h || old!=='images/portraits/char_'+h[1]+'.png' || c.portraitThumb || c.portraitChoice)return;
      if(await (inspect||hasUpload)(old))return;
      // Do not overwrite a choice made while storage was being read.
      if(c.portrait!==old || c.portraitThumb || c.portraitChoice)return;
      c.portrait=choices(c)[0].src;
      delete c.portraitFocusX;delete c.portraitFocusY;
      changed=true;
    }));
    return changed;
  }
  function open(id) {
    var c=(w.characters||[]).find(function(x){return String(x.id)===String(id);});
    if(!c)return;
    var previous=document.activeElement,dialog=document.createElement('dialog');
    dialog.className='zg-portrait-picker';dialog.setAttribute('data-zg-i18n-skip','');
    dialog.setAttribute('aria-labelledby','zg-portrait-title');
    var title=document.createElement('h2');title.id='zg-portrait-title';title.textContent=t('Портрет персонажа','Портрет персонажа');
    var header=document.createElement('header');header.appendChild(title);
    function button(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
    var close=button('×',function(){dialog.close();});close.setAttribute('aria-label',t('Закрыть','Закрити'));header.appendChild(close);dialog.appendChild(header);
    var grid=document.createElement('div');grid.className='zg-portrait-options';dialog.appendChild(grid);
    var error=document.createElement('p');error.setAttribute('role','status');
    choices(c).forEach(function(option){
      var b=button('',async function(){
        var snapshot={};['portrait','portraitThumb','portraitFocusX','portraitFocusY','portraitChoice'].forEach(function(k){snapshot[k]=c[k];});
        dialog.querySelectorAll('button').forEach(function(x){x.disabled=true;});
        c.portrait=option.src;c.portraitThumb='';c.portraitChoice=option.src;
        delete c.portraitFocusX;delete c.portraitFocusY;
        try {
          var saved=await w.saveChars();if(!saved||!saved.ok)throw new Error('save-failed');
          if(w.renderCharsPage)w.renderCharsPage();if(w.renderCharSheet)w.renderCharSheet();dialog.close();
        } catch(e){
          Object.keys(snapshot).forEach(function(k){if(snapshot[k]===undefined)delete c[k];else c[k]=snapshot[k];});
          error.textContent=t('Не удалось сохранить. Попробуйте ещё раз.','Не вдалося зберегти. Спробуйте ще раз.');
          dialog.querySelectorAll('button').forEach(function(x){x.disabled=false;});
        }
      });
      b.setAttribute('aria-pressed',String(c.portrait===option.src));
      var img=document.createElement('img');img.src=option.src;img.alt='';
      var sample={portrait:option.src};
      var point=w.ZargotaPortrait?w.ZargotaPortrait.point(sample):[50,35];
      img.setAttribute('data-zg-portrait','thumb');img.dataset.portraitX=point[0];img.dataset.portraitY=point[1];
      b.appendChild(img);var label=document.createElement('span');label.textContent=option.label;b.appendChild(label);grid.appendChild(b);
    });
    var upload=button(t('Загрузить своё изображение','Завантажити власне зображення'),function(){
      dialog.close();var input=document.getElementById('sheet-portrait-input');if(input){input.value='';input.click();}
    });upload.className='zg-portrait-upload';dialog.appendChild(upload);dialog.appendChild(error);
    dialog.addEventListener('click',function(ev){if(ev.target===dialog){var r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}});
    dialog.addEventListener('close',function(){dialog.remove();if(previous&&previous.isConnected)previous.focus({preventScroll:true});});
    document.body.appendChild(dialog);dialog.showModal();
  }
  w.ZargotaPortraitPicker=Object.freeze({choices:choices,upgradeDefaults:upgradeDefaults,open:open});
})(window);
