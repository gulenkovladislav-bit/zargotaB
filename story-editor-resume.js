(function(w){
 'use strict';
 const key='zg-story-editor-return-v1',tabs=['scene','dialogues','actors','quests','minigames'];let pending=null;
 const t=(r,u)=>w.ZargotaI18n?.getLocale()==='uk'?u:r;
 function read(){try{const x=JSON.parse(localStorage.getItem(key)||'{}');return {enabled:x.enabled===true,projectId:typeof x.projectId==='string'?x.projectId:'',tab:tabs.includes(x.tab)?x.tab:'dialogues'};}catch(e){return {enabled:false,projectId:'',tab:'dialogues'};}}
 function write(x){try{localStorage.setItem(key,JSON.stringify(x));return true;}catch(e){return false;}}
 function remember(projectId,tab){const x=read();x.projectId=projectId;x.tab=tabs.includes(tab)?tab:'dialogues';write(x);}
 function take(){const x=pending;pending=null;return x;}
 function restore(){const x=read();if(!x.enabled||!x.projectId||location.search||location.hash)return;const list=w.ZargotaStoryDirectBridge?.list();if(!list?.ok||!list.episodes.some(e=>e.id===x.projectId)||!w.zgWorkshopModeChoose)return;pending=x;w.zgWorkshopModeChoose('story');setTimeout(()=>{pending=null;},30000);}
 function settings(){const host=document.querySelector('[data-game-panel-pane="general"]');if(!host)return;let section=document.getElementById('zg-story-return-setting');if(!section){section=document.createElement('section');section.id='zg-story-return-setting';section.className='zg-sound-settings';host.insertBefore(section,host.querySelector('.zg-game-leave'));}section.replaceChildren();const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span'),help=document.createElement('small');box.type='checkbox';box.checked=read().enabled;text.textContent=t('Возвращаться в редактор после обновления','Повертатися до редактора після оновлення');help.textContent=t('Открывать последний эпизод и раздел редактора при запуске сайта.','Відкривати останній епізод і розділ редактора під час запуску сайту.');label.style.cssText='display:flex;align-items:center;gap:10px;cursor:pointer';box.onchange=()=>{const x=read();x.enabled=box.checked;if(!write(x)){box.checked=!box.checked;w.showToast?.(t('Не удалось сохранить настройку.','Не вдалося зберегти налаштування.'));}};label.append(box,text);section.append(label,help);}
 w.ZargotaStoryEditorResume={remember,take,read,restore};
 w.addEventListener('load',()=>{settings();setTimeout(restore,0);});document.addEventListener('zargota:localechange',settings);
})(window);
