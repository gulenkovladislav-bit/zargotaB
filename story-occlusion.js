(function(w){
 'use strict';
 function points(zone){return (zone.points||[]).filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>[Math.max(0,Math.min(100,p[0])),Math.max(0,Math.min(100,p[1]))]);}
 function mask(zone,scene){
  const polygon=points(zone);if(polygon.length<3)return '';
  const width=(Number(scene.boardWidth)||24)*(Number(scene.gridSize)||64),height=(Number(scene.boardHeight)||16)*(Number(scene.gridSize)||64);
  const soft=Math.max(0,Math.min(24,Number(zone.occlusionFeather??3)||0));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+soft+'"/></filter></defs><polygon fill="white" '+(soft?'filter="url(#soft)" ':'')+'points="'+polygon.map(p=>p[0]*width/100+','+p[1]*height/100).join(' ')+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
 }
 const cache=new Map();
 function combined(zones,scene){
  const width=(Number(scene.boardWidth)||24)*(Number(scene.gridSize)||64),height=(Number(scene.boardHeight)||16)*(Number(scene.gridSize)||64);
  const key=JSON.stringify([width,height,zones.map(z=>[z.points,z.occlusionFeather,z.occlusionBitmap])]);if(cache.has(key))return cache.get(key);
  let content='';zones.forEach((zone,i)=>{const bitmap=zone.occlusionBitmap;if(bitmap?.format==='png'&&/^[A-Za-z0-9+/=]+$/.test(bitmap.data||'')){content+='<image width="'+width+'" height="'+height+'" preserveAspectRatio="none" href="data:image/png;base64,'+bitmap.data+'"/>';return;}
   const polygon=points(zone),soft=Math.max(0,Math.min(24,Number(zone.occlusionFeather??3)||0));content+='<defs><filter id="s'+i+'" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+soft+'"/></filter></defs><polygon fill="white" '+(soft?'filter="url(#s'+i+')" ':'')+'points="'+polygon.map(p=>p[0]*width/100+','+p[1]*height/100).join(' ')+'"/>';});
  const value='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none">'+content+'</svg>')+'")';if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
 }
 function render(world,scene,flags){
  world.querySelectorAll(':scope > .zg-story-occlusion').forEach(e=>e.remove());
  const zones=(scene.story?.zones||[]).filter(z=>z.occlusion&&z.enabled!==false&&z.visible!==false&&(!z.requires||flags?.[z.requires])&&(z.occlusionBitmap?.format==='png'||points(z).length>=3));
  const layers=(scene.layers||[]).filter(l=>l.visible!==false&&l.image);
  if(!layers.length||!zones.length)return;
  const top=1+(scene.tokens||[]).reduce((z,t)=>Math.max(z,10+Math.max(0,Number(t.z)||0)),10);
  {
   const cover=document.createElement('div');cover.className='zg-story-occlusion';cover.dataset.occlusionId='combined';cover.setAttribute('aria-hidden','true');
   Object.assign(cover.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:String(top),maskImage:combined(zones,scene),maskSize:'100% 100%',maskRepeat:'no-repeat',background:'#111719'});
   for(const layer of layers){
    const img=document.createElement('img');img.src=layer.image;img.alt='';img.draggable=false;
    Object.assign(img.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',objectFit:layer.fit==='stretch'?'fill':layer.fit==='contain'?'contain':'cover',transform:'translate('+(layer.x||0)+'%,'+(layer.y||0)+'%) scale('+(layer.scale||1)+')',opacity:String(layer.opacity??1),filter:'brightness('+((layer.brightness||1)*(1-(layer.darken||0)))+') contrast('+(layer.contrast||1)+') saturate('+(layer.saturation??1)+')'});
    cover.appendChild(img);
   }
   world.appendChild(cover);
  }
 }
 w.ZargotaStoryOcclusion={mask,points,render,combined};
})(window);
