(function(w){
 'use strict';
 function capture(root){if(!root)return function(){};function path(e){var p=[];while(e&&e!==root){p.unshift(Array.prototype.indexOf.call(e.parentNode.children,e));e=e.parentNode;}return p;}function find(p){return p.reduce(function(e,i){return e&&e.children[i];},root);}
   var scroll=[],folds=[],active=document.activeElement,focus=active&&root.contains(active)&&active.matches('input,textarea,select')?{path:path(active),tag:active.tagName,start:active.selectionStart,end:active.selectionEnd}:null;
   [root].concat(Array.from(root.querySelectorAll('*'))).forEach(function(e){if(e.scrollTop||e.scrollLeft)scroll.push({path:path(e),top:e.scrollTop,left:e.scrollLeft});if(e.tagName==='DETAILS')folds.push({path:path(e),open:e.open,title:e.querySelector('summary')&&e.querySelector('summary').textContent});});
   return function(){if(!root.isConnected)return;folds.forEach(function(s){var e=find(s.path);if(e&&e.tagName==='DETAILS'&&e.querySelector('summary')&&e.querySelector('summary').textContent===s.title)e.open=s.open;});if(focus){var e=find(focus.path);if(e&&e.tagName===focus.tag){e.focus({preventScroll:true});if(focus.start!=null&&e.setSelectionRange)try{e.setSelectionRange(focus.start,focus.end);}catch(ignore){}}}scroll.forEach(function(s){var e=find(s.path);if(e){e.scrollTop=s.top;e.scrollLeft=s.left;}});};
 }
 w.ZargotaStoryViewState={capture:capture};
})(window);
