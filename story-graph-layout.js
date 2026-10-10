(function(w){
 'use strict';
 function arrange(nodes,entryId){
  const byId=new Map(nodes.map(n=>[n.id,n])),order=new Map(nodes.map((n,i)=>[n.id,i]));
  const out=new Map(),incoming=new Map(),neighbors=new Map();
  nodes.forEach(n=>{out.set(n.id,[]);incoming.set(n.id,[]);neighbors.set(n.id,[]);});
  nodes.forEach(n=>(n.links||[]).forEach(l=>{if(!byId.has(l.to)||l.to===n.id||out.get(n.id).includes(l.to))return;out.get(n.id).push(l.to);incoming.get(l.to).push(n.id);neighbors.get(n.id).push(l.to);neighbors.get(l.to).push(n.id);}));
  const seen=new Set(),groups=[],positions=new Map();
  const seeds=nodes.map(n=>n.id).sort((a,b)=>(a===entryId?-1:b===entryId?1:order.get(a)-order.get(b)));
  seeds.forEach(id=>{if(seen.has(id))return;const group=[],stack=[id];seen.add(id);while(stack.length){const v=stack.pop();group.push(v);neighbors.get(v).forEach(x=>{if(!seen.has(x)){seen.add(x);stack.push(x);}});}groups.push(group);});
  let top=1000;
  groups.forEach(group=>{
   const remaining=new Set(group),rank=new Map(group.map(id=>[id,0])),degree=new Map(group.map(id=>[id,incoming.get(id).length])),sequence=[];
   // Kahn ordering; explicitly break cycles for display only, never edit links.
   while(remaining.size){
    let ready=[...remaining].filter(id=>degree.get(id)===0);
    if(!ready.length)ready=[...remaining].sort((a,b)=>degree.get(a)-degree.get(b)||order.get(a)-order.get(b)).slice(0,1);
    ready.sort((a,b)=>(a===entryId?-1:b===entryId?1:order.get(a)-order.get(b)));
    const id=ready[0];remaining.delete(id);sequence.push(id);
    out.get(id).forEach(to=>{if(remaining.has(to)){degree.set(to,degree.get(to)-1);rank.set(to,Math.max(rank.get(to),rank.get(id)+1));}});
   }
   const columns=[];sequence.forEach(id=>(columns[rank.get(id)]||(columns[rank.get(id)]=[])).push(id));
   const row=new Map();columns.forEach(col=>col.forEach((id,i)=>row.set(id,i)));
   function sort(col,edges){const score=id=>{const list=edges.get(id);return list.length?list.reduce((s,p)=>s+row.get(p),0)/list.length:row.get(id);};col.sort((a,b)=>score(a)-score(b)||order.get(a)-order.get(b));col.forEach((id,i)=>row.set(id,i));}
   for(let pass=0;pass<4;pass++){columns.forEach(col=>sort(col,incoming));columns.slice().reverse().forEach(col=>sort(col,out));}
   let bottom=top;
   columns.forEach((col,x)=>{let y=top;col.forEach(id=>{
    const parents=incoming.get(id).map(p=>positions.get(p)).filter(Boolean);
    const preferred=parents.length?parents.reduce((s,p)=>s+p.y,0)/parents.length:top;
    y=Math.max(y,preferred);positions.set(id,{x:1000+x*360,y});
    y+=108+Math.max(1,(byId.get(id).links||[]).length)*32+100;bottom=Math.max(bottom,y);
   });});
   top=bottom+100;
  });
  return positions;
 }
 function install(root,api){
  const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru,bar=root.querySelector('.zg-board-tools');if(!bar)return;
  const button=document.createElement('button'),undo=document.createElement('button');button.type=undo.type='button';
  button.textContent=t('⇥ Упорядочить','⇥ Упорядкувати');button.title=t('Разложить диалоги текущей локации по связям. Меняются только координаты.','Розкласти діалоги поточної локації за зв’язками. Змінюються лише координати.');
  undo.textContent=t('↶ Отменить раскладку','↶ Скасувати розкладку');undo.hidden=true;let previous=null;
  const menu=document.createElement('details'),summary=document.createElement('summary');menu.className='zg-board-arrange-menu';summary.textContent='⋯';summary.title=summary.ariaLabel=t('Действия с доской','Дії з дошкою');menu.append(summary);root.querySelector('.zg-story-body').append(menu);
  button.onclick=()=>{menu.open=false;const data=api.get(),visible=w.ZargotaStoryLocationDialogues?w.ZargotaStoryLocationDialogues.nodes(data,data.activeSceneId||''):data.nodes;if(!visible.length)return;
   const positions=arrange(visible,data.entryId);previous={project:root.querySelector('[data-story-project-select]')?.value,scene:data.activeSceneId,title:data.title,coords:visible.map(n=>({id:n.id,x:n.x,y:n.y,placed:positions.get(n.id)}))};
   api.update(d=>d.nodes.forEach(n=>{const p=positions.get(n.id);if(p)Object.assign(n,p);}));undo.hidden=false;menu.open=false;
   // Editor restores scroll on the next frame; focus the arranged start afterwards.
   requestAnimationFrame(()=>requestAnimationFrame(()=>{const canvas=root.querySelector('.zg-story-canvas'),scale=w.ZargotaStoryGraph?.scale||1;canvas.scrollLeft=Math.max(0,1000*scale-120);canvas.scrollTop=Math.max(0,1000*scale-120);}));
  };
  undo.onclick=()=>{menu.open=false;if(!previous)return;const data=api.get();if(root.querySelector('[data-story-project-select]')?.value!==previous.project||data.activeSceneId!==previous.scene||data.title!==previous.title)return;
   api.update(d=>previous.coords.forEach(p=>{const n=d.nodes.find(n=>n.id===p.id);if(n&&n.x===p.placed.x&&n.y===p.placed.y){if(p.x===undefined)delete n.x;else n.x=p.x;if(p.y===undefined)delete n.y;else n.y=p.y;}}));previous=null;undo.hidden=true;
  };menu.append(button,undo);undo.addEventListener('click',()=>{menu.open=false;});
 }
 w.ZargotaStoryGraphLayout={arrange,install};
})(window);
