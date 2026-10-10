(function(w){
 'use strict';
 const active=new WeakMap();
 function sample(t,bump){
  let y=.45*Math.sin(t*2.1)+.22*Math.sin(t*3.7),r=.025*Math.sin(t*1.3);
  if(bump){const u=(t-bump.start)/bump.duration;if(u>=0&&u<=1){y-=bump.height*Math.pow(Math.sin(Math.PI*u),3);r+=.025*Math.sin(2*Math.PI*u);}else if(u>1&&u<1.7)y+=bump.height*.23*Math.pow(Math.sin(Math.PI*(u-1)/.7),3);}
  return {y,rotate:r};
 }
 function mount(world,enabled){
  if(!world)return;if(!enabled){stop(world);return;}if(active.has(world))return;
  const reduced=w.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,last=null,time=0,bump=null,next=1.8+Math.random()*2;
  function tick(now){
   if(last!==null&&!document.hidden)time+=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
   if(time>=next){bump={start:time,duration:.42+Math.random()*.35,height:1.1+Math.random()*.9};next=time+2.2+Math.random()*4.5;}
   const value=sample(time,bump);world.style.translate='0 '+value.y.toFixed(3)+'px';world.style.rotate=value.rotate.toFixed(4)+'deg';frame=w.requestAnimationFrame(tick);
  }
  function preference(){w.cancelAnimationFrame(frame);frame=0;last=null;world.style.removeProperty('translate');world.style.removeProperty('rotate');if(!reduced.matches)frame=w.requestAnimationFrame(tick);}
  const dispose=()=>{w.cancelAnimationFrame(frame);reduced.removeEventListener('change',preference);world.style.removeProperty('translate');world.style.removeProperty('rotate');};
  active.set(world,dispose);reduced.addEventListener('change',preference);preference();
 }
 function stop(world){const dispose=active.get(world);if(dispose){dispose();active.delete(world);}}
 w.ZargotaStoryWagonMotion={mount,stop,sample};
})(window);
