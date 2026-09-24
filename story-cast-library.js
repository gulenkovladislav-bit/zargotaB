(function(w){
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 function used(data,id){return data.playerSpeakerId===id||(data.nodes||[]).some(n=>[n].concat(n.slides||[]).some(p=>p.speaker===id))||[data.scene].concat((data.scenes||[]).map(r=>r.scene)).some(s=>(s?.tokens||[]).some(x=>x.speaker===id));}
 function toggle(data,all,key,enabled){data.showOtherEpisodeActors=enabled;data.speakers=data.speakers||{};if(enabled)for(const [project,p]of Object.entries(all)){if(project===key)continue;for(const [id,actor]of Object.entries(p.speakers||{})){if(actor.archived||actor.originEpisode)continue;const newId='cast:'+encodeURIComponent(project)+':'+encodeURIComponent(id);if(!data.speakers[newId])data.speakers[newId]=Object.assign(JSON.parse(JSON.stringify(actor)),{originEpisode:project});}}
 for(const [id,actor]of Object.entries(data.speakers)){if(!actor.originEpisode)continue;actor.archived=!enabled&&!used(data,id);}}
 function install(host,data,save,key){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!data.showOtherEpisodeActors;label.append(input,document.createTextNode(t(' Показывать персонажей других эпизодов',' Показувати персонажів інших епізодів')));host.prepend(label);input.onchange=()=>{let all;try{all=JSON.parse(localStorage.getItem('zargota_story_editor_v1')||'{}');if(w.ZargotaStoryStorageCodec)all=w.ZargotaStoryStorageCodec.unpack(all);}catch(e){return;}const enabled=input.checked;save(d=>toggle(d,all,key,enabled));};}
 w.ZargotaStoryCastLibrary={install,toggle,used};
})(window);
