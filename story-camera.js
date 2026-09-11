(function(w){
 'use strict';
 function layout(vw,vh,width,height,zoom,x,y){var z=Math.max(1,Math.min(3,Number(zoom)||1)),scale=Math.min(vw/width,vh/height)*z,limitX=Math.max(0,(width*scale-vw)/2),limitY=Math.max(0,(height*scale-vh)/2);return {scale:scale,x:Math.max(-limitX,Math.min(limitX,Number(x)||0)),y:Math.max(-limitY,Math.min(limitY,Number(y)||0))};}
 w.ZargotaStoryCamera={layout:layout};
})(window);
