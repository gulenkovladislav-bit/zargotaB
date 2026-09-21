(function(w){
 function install(root){const title=root.querySelector('[data-play-title]'),panel=title?.parentElement;if(!panel)return;panel.classList.add('zg-quest-polish');let previous='';
  root.addEventListener('pointermove',e=>{
   const r=panel.getBoundingClientRect();
   panel.classList.toggle('is-pointer-over',e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom);
  },{passive:true});
  root.addEventListener('pointerleave',()=>panel.classList.remove('is-pointer-over'));
  new MutationObserver(()=>{const value=title.textContent;if(value===previous)return;const animate=!!previous;previous=value;if(!animate||!root.classList.contains('open')||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
   panel.querySelectorAll('.zg-quest-spark').forEach(e=>e.remove());title.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'ease-out'});
   for(let i=0;i<9;i++){const s=document.createElement('i');s.className='zg-quest-spark';s.style.left=(8+i*9)+'%';s.style.top='45%';panel.appendChild(s);s.animate([{opacity:0,transform:'translate(0,0) scale(.4)'},{opacity:.9,offset:.2},{opacity:0,transform:'translate('+(i-4)*9+'px,-38px) scale(0)'}],{duration:650+i*35,easing:'ease-out'}).onfinish=()=>s.remove();}
  }).observe(title,{childList:true,characterData:true,subtree:true});
 }
 w.ZargotaStoryQuestPolish={install};
})(window);
