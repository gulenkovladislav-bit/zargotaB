(function(w){
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 function choose(data,done){
  const dialog=document.createElement('dialog');dialog.className='zg-custom-menu';
  const title=document.createElement('header');title.textContent=t('Вход на локацию · тест','Вхід на локацію · тест');
  const note=document.createElement('p');note.textContent=t('Выберите активное задание. Его завершение запустит обычные действия. Настройки эпизода не изменятся.','Оберіть активне завдання. Його завершення запустить звичайні дії. Налаштування епізоду не зміняться.');
  const list=document.createElement('div');list.className='zg-custom-options';
  const nodes=w.ZargotaStoryLocationDialogues.nodes(data,data.activeSceneId);
  let selected=(data.quests||[]).find(q=>[q.dialogueId,...(q.dialogueIds||[])].some(id=>nodes.some(n=>n.id===id)))?.id||data.initialQuestId||'';
  const buttons=[];
  [{id:'',title:t('Без задания','Без завдання')},...(data.quests||[])].forEach(q=>{
   const b=document.createElement('button');b.type='button';b.textContent=t(q.title||q.id,q.titleUk||q.title||q.id);
   const update=()=>b.setAttribute('aria-pressed',String(selected===q.id));buttons.push(update);update();
   b.onclick=()=>{selected=q.id;buttons.forEach(fn=>fn());};list.appendChild(b);
  });
  const start=document.createElement('button');start.textContent=t('▶ Зайти на локацию','▶ Зайти на локацію');
  start.onclick=()=>{dialog.remove();done(selected);};
  const cancel=document.createElement('button');cancel.textContent=t('Отмена','Скасувати');cancel.onclick=()=>dialog.remove();
  dialog.addEventListener('cancel',()=>dialog.remove());
  dialog.append(title,note,list,start,cancel);document.body.appendChild(dialog);dialog.showModal();
 }
 w.ZargotaStoryTestEntry={choose};
})(window);
