(function(w){
 'use strict';
 function install(root,resolve){
  const seen=new Set(),cursor=document.createElement('div');cursor.className='zg-gold-cursor';cursor.hidden=true;cursor.setAttribute('aria-hidden','true');
  cursor.innerHTML='<svg viewBox="0 0 48 48" width="42" height="42"><defs><linearGradient id="zg-cursor-gold" x2="1" y2="1"><stop stop-color="#fff1b5"/><stop offset=".45" stop-color="#dfb55c"/><stop offset="1" stop-color="#95602a"/></linearGradient></defs><g class="zg-cursor-arrow" stroke="#302213" stroke-width="3" stroke-linejoin="round"><path fill="url(#zg-cursor-gold)" d="M3 3 L29 22 L19 24 L25 36 L20 39 L14 27 L7 34 Z"/><path d="M5 6 L14 23 L26 22 M14 23 L8 30" fill="none" stroke="#ffedaf" stroke-width="1"/></g><g class="zg-cursor-badge"><circle cx="33" cy="33" r="12" fill="#172019" stroke="#e4be6c" stroke-width="2"/><text class="zg-cursor-question" x="33" y="40" text-anchor="middle" fill="#ffe2a1" font-family="Georgia,serif" font-size="22" font-weight="bold">?</text><path class="zg-cursor-cross" d="M28 28 L38 38 M38 28 L28 38" stroke="#ffe2a1" stroke-width="3" stroke-linecap="round"/></g><g class="zg-cursor-glass" stroke="#382713" stroke-width="5"><path d="M26 26 L39 39" stroke-linecap="round"/><circle cx="17" cy="17" r="13" fill="#17251fe8"/><path d="M26 26 L39 39" stroke="#dcb365" stroke-width="4" stroke-linecap="round"/><circle cx="17" cy="17" r="13" stroke="#e9c67c" stroke-width="3"/><path d="M10 16 Q10 10 17 10" fill="none" stroke="#fff0b2" stroke-width="2"/></g></svg>';
  document.body.appendChild(cursor);let last=null,mode='',animation,frame=0;
  function hide(){cancelAnimationFrame(frame);frame=0;last=null;cursor.hidden=true;if(root.classList.contains('zg-has-cursor'))root.classList.remove('zg-has-cursor');}
  function refresh(e){if(e.pointerType==='touch'||!root.classList.contains('open')||e.target.closest('input,textarea,select,[contenteditable]')||!matchMedia('(pointer:fine)').matches){hide();return;}const hit=resolve(e)||{};const next=hit.inspect?'inspect':hit.key?(seen.has(hit.key)?'blocked':'unknown'):'normal';cursor.hidden=false;if(!root.classList.contains('zg-has-cursor'))root.classList.add('zg-has-cursor');cursor.style.transform='translate3d('+(e.clientX-3)+'px,'+(e.clientY-3)+'px,0)';if(mode!==next){mode=next;cursor.dataset.mode=next;}return hit;}
  function schedule(e){last=e;if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(last)refresh(last);});}
  root.addEventListener('pointermove',schedule);
  root.addEventListener('pointerleave',hide);w.addEventListener('blur',hide);
  root.addEventListener('click',e=>{if(!e.detail)return;if(!cursor.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches){animation?.cancel();animation=cursor.querySelector('svg').animate([{opacity:1},{opacity:.65},{opacity:1}],{duration:180});}});
  new MutationObserver(()=>{if(!root.classList.contains('open'))hide();}).observe(root,{attributes:true,attributeFilter:['class']});
  return {mark(e){const hit=resolve(e)||{};if(hit.key){seen.add(hit.key);schedule(e);}},reset(){cancelAnimationFrame(frame);frame=0;seen.clear();hide();mode='';last=null;}};
 }
 w.ZargotaStoryCursor={install};
})(window);
