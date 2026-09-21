(function(w){
 'use strict';
 function list(q){return q.actions|| (q.reveal?[Object.assign({type:'reveal',actionId:'legacy-reveal'},q.reveal)]:[]);}
 function key(a){return JSON.stringify([a.sceneId||'',a.kind||'tokens',a.id]);}
 function apply(scene,sceneId,state){var copy=JSON.parse(JSON.stringify(scene));Object.values(state.actionObjects||{}).forEach(function(p){if(p.sceneId!==sceneId)return;var group=p.kind==='tokens'?(copy.tokens=copy.tokens||[]):((copy.story=copy.story||{})[p.kind]=copy.story[p.kind]||[]),item=group.find(function(i){return i.id===p.id;});if(!item&&p.spawn){item={id:p.id};group.push(item);}if(item)Object.assign(item,p.values);});return copy;}
 function run(actions,ctx,done){var stopped=false,index=0,timer,cleanups=[];
  function stop(){stopped=true;clearTimeout(timer);cleanups.forEach(function(fn){fn();});w.ZargotaStorySequence.cancel();}
  function patch(a,values,spawn){ctx.state.actionObjects=ctx.state.actionObjects||{};var k=key(a),old=ctx.state.actionObjects[k];ctx.state.actionObjects[k]={sceneId:a.sceneId||'',kind:a.kind||'tokens',id:a.id,spawn:spawn||old&&old.spawn,values:Object.assign({},old&&old.values,values)};}
  function next(){if(stopped)return;var a=actions[index++];if(!a){done();return;}if(a.enabled===false){next();return;}
   if(a.type==='giveItem'){if(ctx.giveItem)ctx.giveItem(a.itemId,a.qty,a.equip,a.actionId);next();return;}
   if(a.type==='timeline'){if(ctx.timeline){var cancelTimeline=ctx.timeline(a.timelineId,next);if(cancelTimeline)cleanups.push(cancelTimeline);}else next();return;}
   if(a.type==='travel'){var travel=ctx.travel||(w.ZargotaStoryPlayer&&w.ZargotaStoryPlayer.travel);if(travel&&a.sceneId)travel(a.sceneId,next);else next();return;}
   if(a.type==='music'){if(ctx.music)ctx.music(a.musicEvent);next();return;}
   if(a.type==='sound'){if(a.sound){var audio=ctx.sound(a.sound);if(audio&&audio.pause)cleanups.push(function(){audio.pause();});}next();return;}
   if(a.type==='fx'){cleanups.push(w.ZargotaStoryScreenFx.run(ctx.root,{screenFx:a.screenFx||{type:'damage',intensity:.55,durationMs:1800}}));timer=setTimeout(next,Math.max(300,Number(a.screenFx&&a.screenFx.durationMs)||1800));return;}
   if(a.type==='wait'){timer=setTimeout(next,Math.max(0,Number(a.durationMs)||0));return;}
if(a.type==='follow'||a.type==='unfollow'){ctx.state.followers=ctx.state.followers||{};if(a.type==='unfollow'){var f=ctx.state.followers[a.id];if(f)patch(Object.assign({},a,{sceneId:f.sceneId,kind:'tokens'}),Object.assign({},f.token,f.position,{visible:true,enabled:true,hidden:false,opacity:1}),true);delete ctx.state.followers[a.id];}else{var r=ctx.records.find(function(r){return r.id===a.sceneId;}),v=r?ctx.view(r):{tokens:[]},actor=(v.tokens||[]).find(function(t){return t.id===a.id;});if(actor)ctx.state.followers[a.id]={pending:actor.hidden===true||actor.visible===false,scope:a.followScope||'all',originSceneId:a.sceneId,sceneIds:a.followSceneIds||[],token:JSON.parse(JSON.stringify(actor)),gapCells:Math.max(.5,Number(a.gapCells)||1.2),sceneId:a.sceneId,position:{x:actor.x,y:actor.y},trail:[{x:actor.x,y:actor.y}]};}ctx.redraw();next();return;}
   if(a.type==='spawn'){patch(a,Object.assign({},a.object,{id:a.id,enabled:true,visible:true,hidden:false}),true);}
   if(a.type==='reveal'){var source=ctx.records.find(function(r){return r.id===a.sceneId;}),base=source&&source.scene,group=base&&(a.kind==='tokens'?base.tokens:(base.story||{})[a.kind]),original=(group||[]).find(function(o){return o.id===a.id;});patch(a,{visible:true,enabled:true,hidden:false,opacity:original&&original.opacity!=null?original.opacity:1});}
   if(a.type==='hide')patch(a,{visible:false,markerVisible:false,opacity:0});
   if(a.type==='enable'||a.type==='disable')patch(a,{enabled:a.type==='enable'});
   if(a.type==='move'){
    var record=ctx.records.find(function(r){return r.id===a.sceneId;}),view=ctx.view(record),token=(view.tokens||[]).find(function(t){return t.id===a.id;}),points=a.toHero?[[ctx.position().x,ctx.position().y]]:a.points||[];
    if(!token){next();return;}patch(a,{visible:true,enabled:true});ctx.redraw();
    if(a.sceneId===ctx.sceneId()){view=ctx.view(record);w.ZargotaStorySequence.run([{tokenId:a.id,points:points,durationMs:a.durationMs||2400,hide:a.hide}],view,ctx.world(),function(){if(stopped)return;var moved=view.tokens.find(function(t){return t.id===a.id;});patch(a,{x:moved.x,y:moved.y,visible:moved.visible});ctx.redraw();next();});return;}
    if(points.length)patch(a,{x:points[points.length-1][0],y:points[points.length-1][1],visible:!a.hide});
   }
   ctx.redraw();next();
  }next();return stop;
 }
 w.ZargotaStoryQuestActions={list:list,apply:apply,run:run};
})(window);
