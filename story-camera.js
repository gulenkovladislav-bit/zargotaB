(function(w){
 'use strict';
 function layout(vw,vh,width,height,zoom,x,y,fit){var z=Math.max(1,Math.min(3,Number(zoom)||1)),scale=(fit==='cover'?Math.max(vw/width,vh/height):Math.min(vw/width,vh/height))*z,limitX=Math.max(0,(width*scale-vw)/2),limitY=Math.max(0,(height*scale-vh)/2);return {scale:scale,x:Math.max(-limitX,Math.min(limitX,Number(x)||0)),y:Math.max(-limitY,Math.min(limitY,Number(y)||0))};}
 function keyboard(options){
  var keys={},frame=0,last=0,vx=0,vy=0;
  function clear(){keys={};vx=vy=last=0;if(frame)w.cancelAnimationFrame(frame);frame=0;}
  function editable(target){return target&&target.closest&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');}
  function allowed(){return !document.hidden&&!editable(document.activeElement)&&options.enabled();}
  function tick(now){
   frame=0;if(!allowed()){clear();return;}
   var dt=last?Math.min((now-last)/1000,.05):1/60;last=now;
   var x=(keys.KeyD?1:0)-(keys.KeyA?1:0),y=(keys.KeyS?1:0)-(keys.KeyW?1:0),length=Math.hypot(x,y)||1;
   var blend=1-Math.exp(-14*dt);vx+=(x/length*620-vx)*blend;vy+=(y/length*620-vy)*blend;
   options.move(-vx*dt,-vy*dt);
   if(x||y||Math.hypot(vx,vy)>.5)frame=w.requestAnimationFrame(tick);else clear();
  }
  function down(e){if(!/^Key[WASD]$/.test(e.code)||e.ctrlKey||e.metaKey||e.altKey||editable(e.target)||!allowed())return;e.preventDefault();keys[e.code]=true;if(!frame)frame=w.requestAnimationFrame(tick);}
  function up(e){delete keys[e.code];}
  document.addEventListener('keydown',down);document.addEventListener('keyup',up);w.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  return {clear:clear,dispose:function(){clear();document.removeEventListener('keydown',down);document.removeEventListener('keyup',up);w.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);}};
 }
 function focus(scene,point,vw,vh){
  var story=scene.story||{},width=(scene.boardWidth||24)*(scene.gridSize||64),height=(scene.boardHeight||16)*(scene.gridSize||64),z=story.cameraZoom||1,base=layout(vw,vh,width,height,z,0,0,story.cameraFit);
  var y=story.cameraCenterY!=null&&Number.isFinite(Number(story.cameraCenterY))?Math.max(0,Math.min(100,Number(story.cameraCenterY))):point.y;
  return layout(vw,vh,width,height,z,(50-point.x)*width*base.scale/100,(50-y)*height*base.scale/100,story.cameraFit);
 }
 w.ZargotaStoryCamera={layout:layout,focus:focus,keyboard:keyboard};
})(window);
