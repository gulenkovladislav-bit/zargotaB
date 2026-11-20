/* Store navigation only, never character data or credentials. */
(function(w){
 'use strict';
 var key='zg-mobile-sheet-resume-v1',cancelled=false,restoring=true,timer,attempts=0;
 function mobile(){return w.matchMedia('(max-width:900px), (pointer:coarse)').matches;}
 function version(){return String(w.ZG_APP_VERSION||'');}
 function identity(){return w.ZargotaPersistentCharacters?.tableIdentity();}
 function read(){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
 function save(){
  if(restoring||!mobile()||document.body.classList.contains('zg-irl-table-view'))return;
  var account=identity();if(!account||account.loading)return;
  var uid=account.uid||'local',all=read()||{};
  if(!document.querySelector('#page-characters.active')||w.charView!=='sheet'){delete all[uid];}
  else{
   var records=w.ZargotaPersistentCharacters.status().records;
   var sid=Object.keys(records).find(function(id){return records[id].allowed&&String(records[id].localId)===String(w.viewingCharId);});
   if(account.enabled&&!sid)return;
   all[uid]={version:version(),sheetId:sid||null,id:w.viewingCharId,tab:['stats','skills','inventory','lore'].includes(w._charSheetTab)?w._charSheetTab:'stats'};
  }
  try{localStorage.setItem(key,JSON.stringify(all));}catch(_){}
 }
 function finish(){restoring=false;clearTimeout(timer);}
 function restore(){
  if(cancelled||!mobile()){finish();return;}
  var account=identity(),splash=document.getElementById('zg-data-loader-splash');
  if(!account||account.loading||splash&&getComputedStyle(splash).display!=='none'){
   if(++attempts<300)timer=setTimeout(restore,100);else finish();return;
  }
  var saved=(read()||{})[account.uid||'local'];
  if(!saved||saved.version!==version()||!version()){finish();return;}
  var id=saved.id;
  if(account.enabled){
   var entry=w.ZargotaPersistentCharacters.status().records[saved.sheetId];
   if(!entry||!entry.allowed){finish();return;}
   if(!entry.base){if(++attempts<300)timer=setTimeout(restore,100);else finish();return;}
   id=entry.localId;
  }else if(saved.sheetId){finish();return;}
  var hero=(w.characters||[]).find(function(c){return String(c.id)===String(id);});
  if(hero){w.showPage('characters');w._charSheetTab=['stats','skills','inventory','lore'].includes(saved.tab)?saved.tab:'stats';w.openCharSheet(hero.id);}
  finish();
 }
 document.addEventListener('pointerdown',function(){if(restoring){cancelled=true;finish();}},{capture:true,once:true});
 document.addEventListener('keydown',function(){if(restoring){cancelled=true;finish();}},{capture:true,once:true});
 w.addEventListener('pagehide',save);
 document.addEventListener('visibilitychange',function(){if(document.hidden)save();});
 w.addEventListener('zargota:persistent-auth-change',function(event){if(event.detail?.previousUid){cancelled=true;finish();}});
 w.addEventListener('load',function(){Promise.resolve(w.zgCharacterLoadPromise).then(restore);},{once:true});
})(window);
