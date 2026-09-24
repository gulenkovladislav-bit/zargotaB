(function(w){
'use strict';
// One continuous gait per token, also when its destination changes.
var states=new WeakMap();
function update(token,world,scene,point,now,reduced,trails){
 var s=states.get(token);if(!s){s={x:point.x,y:point.y,time:now,phase:0,step:0,side:1};states.set(token,s);return;}
 var dx=(point.x-s.x)*Number(scene.boardWidth||24)/100,dy=(point.y-s.y)*Number(scene.boardHeight||16)/100,distance=Math.hypot(dx,dy),dt=Math.max(0,Math.min(64,now-s.time));
 if(distance>0&&dt>0){var speed=distance/(dt/1000),interval=Math.max(280,Math.min(650,600/Math.sqrt(Math.max(.25,speed))));s.phase+=dt/interval*Math.PI;s.step+=dt;
 if(!reduced){token.classList.add('is-walking');var size=parseFloat(token.style.width)||64;token.style.translate=(Math.sin(s.phase)*Math.min(1.4,size*.02))+'px '+(-(1-Math.cos(s.phase*2))*.5*Math.min(2,size*.03))+'px';token.style.rotate=(Math.sin(s.phase)*1.6)+'deg';}
 // Never catch up by creating several prints in the same rendered frame.
 if(trails!==false&&s.step>=interval){s.step%=interval;s.side=-s.side;var angle=Math.atan2(dy,dx),grid=Number(scene.gridSize)||64,mark=document.createElement('span');mark.className='zg-move-footprint zg-story-boot '+(s.side>0?'right':'left');mark.innerHTML='<i></i>';mark.style.left=point.x+'%';mark.style.top=point.y+'%';mark.style.width=grid*.17+'px';mark.style.height=grid*.34+'px';mark.style.marginLeft=(-Math.sin(angle)*s.side*grid*.08)+'px';mark.style.marginTop=(Math.cos(angle)*s.side*grid*.08)+'px';mark.style.setProperty('--foot-angle',(angle*180/Math.PI+90+s.side*4)+'deg');mark.setAttribute('aria-hidden','true');world.appendChild(mark);mark.addEventListener('animationend',function(){mark.remove();});var marks=world.querySelectorAll('.zg-story-boot');if(marks.length>36)marks[0].remove();}}
 s.x=point.x;s.y=point.y;s.time=now;
}
function stop(token){states.delete(token);token.classList.remove('is-walking');token.style.translate='0px 0px';token.style.rotate='0deg';}
w.ZargotaStoryWalk={update:update,stop:stop};
})(window);
