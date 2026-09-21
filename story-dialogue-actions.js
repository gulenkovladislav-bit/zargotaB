(function(w){
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 function edit(data,node,host,save){
  if(!host||!w.ZargotaStoryQuestActionsEditor)return;
  const box=document.createElement('details');box.className='zg-dialogue-actions';
  const summary=document.createElement('summary');summary.textContent=t('◇ Токены и события','◇ Токени та події');box.appendChild(summary);
  const pane=document.createElement('div'),select=document.createElement('select');select.setAttribute('aria-label',t('Когда выполнять действия','Коли виконувати дії'));
  [['beforeWorldActions',t('До диалога','До діалогу')],['afterWorldActions',t('После диалога','Після діалогу')],['afterPageActions',t('После выбранной реплики','Після обраної репліки')]].forEach(([v,s])=>{const o=document.createElement('option');o.value=v;o.textContent=s;select.appendChild(o);});
  const key='zg-dialogue-actions:'+node.id;select.value=sessionStorage.getItem(key)||'afterWorldActions';box.open=!!sessionStorage.getItem(key+':open');box.ontoggle=()=>sessionStorage.setItem(key+':open',box.open?'1':'');
  const pageSelect=document.createElement('select');pageSelect.setAttribute('aria-label',t('После какой реплики','Після якої репліки'));
  [node].concat(node.slides||[]).forEach((p,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+(t(p.text,p.textUk||p.text)||t('Без текста','Без тексту')).slice(0,90);pageSelect.appendChild(o);});pageSelect.value=sessionStorage.getItem(key+':page')||'0';if(pageSelect.selectedIndex<0)pageSelect.value='0';
  function target(n){return select.value==='afterPageActions'?(Number(pageSelect.value)===0?n:(n.slides||[])[Number(pageSelect.value)-1]):n;}
  function draw(){pageSelect.hidden=select.value!=='afterPageActions';pane.replaceChildren();const p=target(node);w.ZargotaStoryQuestActionsEditor.edit(data,{id:node.id+select.value+pageSelect.value,actions:p?.[select.value]||[]},pane,actions=>save(d=>{const n=d.nodes.find(n=>n.id===node.id),p=n&&target(n);if(p)p[select.value]=actions;}));}
  pageSelect.onchange=()=>{sessionStorage.setItem(key+':page',pageSelect.value);draw();};
  const give=document.createElement('button');give.type='button';give.textContent=t('＋ Выдать предмет','＋ Видати предмет');
  give.onclick=()=>{sessionStorage.setItem(key+':open','1');save(d=>{const n=d.nodes.find(n=>n.id===node.id),p=n&&target(n);if(p)p[select.value]=(p[select.value]||[]).concat([{actionId:'gift-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),type:'giveItem',qty:1,equip:false}]);});};
  const note=document.createElement('small');note.textContent=t('Предмет выдаётся один раз за прохождение. Выберите время выдачи и при необходимости включите экипировку.','Предмет видається один раз за проходження. Оберіть час видачі й за потреби увімкніть спорядження.');
  select.onchange=()=>{sessionStorage.setItem(key,select.value);draw();};box.append(select,pageSelect,pane);host.prepend(note);host.prepend(give);host.prepend(box);draw();
 }
 w.ZargotaStoryDialogueActions={edit};
})(window);
