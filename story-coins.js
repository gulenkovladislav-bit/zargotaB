(function(w){
 'use strict';
 function metal(item){const id=String(item?.itemId||'');return ['copper','silver','gold','platinum'].find(m=>id==='evan-'+m+'-coin'||id==='zargota-coin-'+m||item?.image==='images/ui/coins/'+m+'.webp'||item?.image==='images/shop/zargota-coin-'+m+'.webp')||'';}
 function detail(item){const m=metal(item);return m?'images/shop/zargota-coin-'+m+'.webp':'';}
 function viewer(item,options={}){
  const m=metal(item);if(!m)return null;
  const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
  const root=document.createElement('div');root.className='zg-coin-viewer';
  const stage=document.createElement('div');stage.className='zg-coin-stage';
  const coin=document.createElement('div');coin.className='zg-coin-turner';
  const sheet='images/ui/coins/'+m+'-faces'+(w.ZargotaI18n?.getLocale()==='uk'?'-uk':'')+'.png';
  for(let i=0;i<2;i++){const face=document.createElement('div');face.className='zg-coin-face '+(i?'reverse':'obverse');face.style.backgroundImage='url("'+sheet+'")';coin.append(face);}
  stage.append(coin);
  const status=document.createElement('p');status.setAttribute('role','status');
  const controls=document.createElement('div');controls.className='zg-coin-controls';
  let side=0,busy=false,animation=null,audio=null,disposed=false;
  function stopSound(){if(audio){audio.pause();audio.src='';audio=null;}}
  function actionSound(){stopSound();if(!options.soundAllowed?.())return;try{audio=new Audio('assets/stories/audio/yodguard-coin-collect-3-540190.mp3');audio.volume=.5;audio.play().catch(()=>{});}catch(e){}}
  function report(){status.textContent=side?t('Оборотная сторона','Зворотний бік'):t('Лицевая сторона','Лицьовий бік');}
  function move(toss){if(busy||disposed)return;busy=true;flip.disabled=throwCoin.disabled=true;actionSound();
   const next=toss?(Math.random()<.5?0:1):1-side,from=side*180,to=toss?2880+next*180:from+180;
   const finish=()=>{side=next;coin.style.transform='rotateY('+side*180+'deg)';if(animation){animation.cancel();animation=null;}busy=false;flip.disabled=throwCoin.disabled=false;report();};
   if(!coin.animate||w.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
   const frames=toss?[0,.2,.4,.5,.6,.8,1].map(p=>({offset:p,transform:'translateY('+(-4*p*(1-p)*32)+'%) scale('+(1+.08*Math.sin(p*Math.PI))+') rotateY('+(from+(to-from)*p)+'deg)'})):[{transform:'rotateY('+from+'deg)'},{transform:'rotateY('+to+'deg)'}];
   animation=coin.animate(frames,{duration:toss?2600:1100,easing:toss?'linear':'ease-in-out',fill:'forwards'});animation.onfinish=finish;
  }
  const flip=document.createElement('button');flip.type='button';flip.textContent=t('Перевернуть','Перевернути');flip.onclick=()=>move(false);
  const throwCoin=document.createElement('button');throwCoin.type='button';throwCoin.textContent=t('Подкинуть','Підкинути');throwCoin.onclick=()=>move(true);
  controls.append(flip,throwCoin);root.append(stage);if(options.interactive!==false){root.append(status,controls);report();}
  root.dispose=()=>{disposed=true;stopSound();if(animation){animation.onfinish=null;animation.cancel();animation=null;}};
  return root;
 }
 w.ZargotaStoryCoins={metal,detail,viewer};
})(window);
