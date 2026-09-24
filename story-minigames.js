(function(w){
 'use strict';
 const entries=new Map();
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
 function register(entry){if(!entry||!entry.id||typeof entry.edit!=='function')throw Error('Invalid minigame entry');entries.set(entry.id,entry);}
 function edit(project,save,host){
  host.querySelectorAll('.zg-minigames-editor,.zg-minigame-editor').forEach(n=>n.remove());
  const root=el('section','zg-minigames-editor'),header=el('header'),layout=el('div','zg-minigames-layout'),list=el('nav','zg-minigames-list'),detail=el('div','zg-minigames-detail');
  header.append(el('h2','',t('Мини-игры','Мініігри')),el('p','',t('Отдельные игры внутри эпизода. Выбери игру, чтобы включить её и настроить.','Окремі ігри всередині епізоду. Обери гру, щоб увімкнути її та налаштувати.')));
  list.setAttribute('aria-label',t('Список мини-игр','Список мініігор'));detail.id='zg-minigames-settings';
  const buttons=new Map();let selected='';
  function refresh(){for(const [id,b] of buttons){b.setAttribute('aria-pressed',String(selected===id));b.querySelector('small').textContent=project.minigames?.[id]?.enabled?t('Включена в эпизоде','Увімкнена в епізоді'):t('Выключена','Вимкнена');}}
  function choose(id){const entry=entries.get(id);if(!entry)return;selected=id;detail.replaceChildren();entry.edit(project,fn=>{save(fn);refresh();},detail);refresh();}
  for(const entry of entries.values()){
   const button=el('button','zg-minigame-entry');button.type='button';button.setAttribute('aria-controls',detail.id);
   button.append(el('strong','',t(entry.name,entry.nameUk)),el('span','',t(entry.description,entry.descriptionUk)),el('small'));
   button.onclick=()=>choose(entry.id);buttons.set(entry.id,button);list.appendChild(button);
  }
  layout.append(list,detail);root.append(header,layout);host.appendChild(root);
  const first=entries.keys().next().value;if(first)choose(first);
  return root;
 }
 register({id:'towerClaw',name:'Башня и коготь',nameUk:'Вежа та кіготь',description:'Карты, медные ставки и разговоры за столом.',descriptionUk:'Карти, мідні ставки й розмови за столом.',edit(project,save,host){w.ZargotaCardGame.edit(project,save,host);}});
 w.ZargotaMinigames={register,edit};
})(window);
