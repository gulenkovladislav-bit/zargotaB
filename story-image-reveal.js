(function(w){
 'use strict';
 // An optional paired still reveal. Both layers share framing and movement.
 function play(view,art,node){
  var stopped=false,animations=[],cover=null,reduced=w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(target,frames,options){if(target.animate)animations.push(target.animate(frames,options));}
  function drift(target){if(!reduced)animate(target,[{transform:'scale(1)'},{transform:'scale(1.018)'}],{duration:18000,easing:'ease-out',fill:'forwards'});}
  if(node.imageRevealFrom&&!reduced){
   cover=art.cloneNode(false);cover.removeAttribute('src');cover.alt='';cover.setAttribute('aria-hidden','true');
   cover.style.cssText=art.style.cssText;cover.style.position='absolute';cover.style.inset='0';cover.style.pointerEvents='none';
   cover.src=node.imageRevealFrom;view.appendChild(cover);
   Promise.all([art.decode?art.decode():Promise.resolve(),cover.decode?cover.decode():Promise.resolve()]).then(function(){
    if(stopped)return;drift(art);drift(cover);
    animate(cover,[{opacity:1},{opacity:0}],{delay:250,duration:2600,easing:'ease-in-out',fill:'forwards'});
   }).catch(function(){if(!stopped&&cover)cover.remove();});
  }else drift(art);
  return function(){stopped=true;animations.forEach(function(a){a.cancel();});if(cover)cover.remove();};
 }
 w.ZargotaStoryImageReveal={play:play};
})(window);
