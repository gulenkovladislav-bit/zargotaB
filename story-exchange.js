(function(w){
 'use strict';
 const t=(r,u)=>w.ZargotaI18n?.getLocale()==='uk'?u:r;
 let running=false,key='',generation=0,last='',listeners=new Set(),autoTimer=null,loadingKey=false;
 let phase='offline';const indicators=new Set();
 function setPhase(value){phase=value;indicators.forEach(render=>render());}
 function indicator(){
  const el=document.createElement('span');el.className='zg-exchange-indicator';
  const dot=document.createElement('span');dot.className='zg-exchange-dot';dot.setAttribute('aria-hidden','true');const label=document.createElement('span');el.append(dot,label);
  const render=()=>{el.dataset.state=phase;label.textContent=phase==='connected'?t('Связь есть','Зв’язок є'):phase==='connecting'?t('Подключение…','Підключення…'):t('Нет связи','Немає зв’язку');el.title=phase==='connected'?t('Приложение обмена подключено.','Застосунок обміну підключено.'):phase==='connecting'?t('Проверяю связь с приложением обмена.','Перевіряю зв’язок із застосунком обміну.'):t('Приложение обмена не подключено. Редактор работает как обычно.','Застосунок обміну не підключено. Редактор працює як завжди.');el.setAttribute('aria-label',el.title);};indicators.add(render);render();return el;}
 const preference='zg-story-exchange-auto';
 const client=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 function status(text){last=text;listeners.forEach(fn=>fn(text));}
 async function post(route,body,token){const r=await fetch('http://127.0.0.1:17349'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(String(r.status));return r.json();}
 function stop(manual=false){setPhase('offline');if(manual)localStorage.setItem(preference,'off');running=false;key='';generation++;status(t('Связь выключена','Зв’язок вимкнено'));}
 async function loop(api,gen,token){
  setPhase('connecting');
  while(running&&gen===generation){
   try{
    const message=await post('/poll',{client},token);if(gen!==generation)return;
    setPhase('connected');status(t('Подключено к папке проекта','Підключено до папки проєкту'));
    if(message.job){const job=message.job;let result;
     try{result=job.op==='backup'?api.backup():job.op==='list'?api.list():job.op==='read'?api.read(job.payload.projectId):job.op==='apply'?api.apply(job.payload,job.payload.diskBackup):{ok:false,error:'operation'};}catch(e){result={ok:false,error:'editor-error'};}
     // Never execute a delivered command twice, even if the acknowledgement fails.
     await post('/result',{client,id:job.id,result},token);
     if(job.op==='apply'){
      const text=result.ok?t('Правки эпизода применены.','Правки епізоду застосовано.'):t('Правки остановлены: ','Правки зупинено: ')+result.error;
      status(text);if(w.showToast)w.showToast(text);
     }
    }
   }catch(e){if(gen!==generation)return;stop();status(t('Ожидаю приложение обмена. Неподтверждённые правки повторно не отправляются.','Очікую застосунок обміну. Непідтверджені правки повторно не надсилаються.'));return;}
   await new Promise(r=>setTimeout(r,1500));
  }
 }
 function autoConnect(api){
  function attempt(){
   if(running||loadingKey||localStorage.getItem(preference)==='off'||w.location.protocol!=='file:')return;
   loadingKey=true;const script=document.createElement('script');
   script.src=new URL('.story-exchange/connection.js?read='+Date.now(),w.location.href).href;
   function finish(){loadingKey=false;script.remove();}
   script.onerror=finish;script.onload=()=>{const token=w.__zgLocalExchangeKey;delete w.__zgLocalExchangeKey;finish();if(running||localStorage.getItem(preference)==='off'||!(/^[a-f0-9]{64}$/).test(token||''))return;key=token;running=true;loop(api,++generation,key);};
   document.head.append(script);
  }
  if(autoTimer)clearInterval(autoTimer);attempt();autoTimer=setInterval(attempt,4000);
 }
 function controls(api){
  const box=document.createElement('fieldset'),label=document.createElement('legend');label.textContent=t('Обмен через папку','Обмін через папку');
  const help=document.createElement('p');help.textContent=t('Откройте приложение «Обмен эпизодами» и нажмите «Запустить». Этот редактор подключится автоматически.','Відкрийте застосунок «Обмен эпизодами» і натисніть «Запустити». Цей редактор підключиться автоматично.');
  const input=document.createElement('input');input.type='password';input.autocomplete='off';input.placeholder=t('Ключ подключения','Ключ підключення');input.setAttribute('aria-label',input.placeholder);
  const connect=document.createElement('button');connect.type='button';connect.textContent=t('Подключить','Підключити');connect.onclick=()=>{if(running)return;if(!/^[a-f0-9]{64}$/.test(input.value.trim())){status(t('Вставьте полный ключ из окна сервиса.','Вставте повний ключ із вікна сервісу.'));return;}key=input.value.trim();input.value='';running=true;loop(api,++generation,key);};
  const disconnect=document.createElement('button');disconnect.type='button';disconnect.textContent=t('Отключить','Вимкнути');disconnect.onclick=()=>stop(true);
  const info=document.createElement('p');info.setAttribute('role','status');info.textContent=last||t('Связь выключена','Зв’язок вимкнено');const update=text=>{info.textContent=text;};listeners.add(update);
  const observer=new MutationObserver(()=>{if(!box.isConnected){listeners.delete(update);observer.disconnect();}});setTimeout(()=>{if(box.isConnected)observer.observe(document.body,{childList:true,subtree:true});},0);
  const auto=document.createElement('button');auto.type='button';auto.textContent=t('Подключить автоматически','Підключити автоматично');auto.onclick=()=>{localStorage.removeItem(preference);autoConnect(api);};
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('Ручное подключение · диагностика','Ручне підключення · діагностика');details.append(summary,input,connect);box.append(label,help,auto,disconnect,info,details);return box;
 }
 w.ZargotaStoryExchange={controls,stop,autoConnect,indicator};
})(window);
