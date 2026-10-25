(function(w){
 'use strict';
 const clamp=n=>Math.max(0,Math.min(6,Math.round(Number(n)||0)));
 function current(run,config){
  if(!run.esterosResolve)run.esterosResolve={hope:clamp(config?.initialHope??3),events:{}};
  run.esterosResolve.events=run.esterosResolve.events||{};
  return run.esterosResolve;
 }
 function apply(run,config,event){
  if(!config?.enabled||!event?.id||!['hope','fatalism'].includes(event.type))return null;
  const state=current(run,config);
  if(Object.prototype.hasOwnProperty.call(state.events,event.id))return null;
  const from=clamp(state.hope),direction=event.type==='hope'?1:-1,to=clamp(from+direction);
  const result={id:event.id,type:event.type,from,to,direction,changed:from!==to,dominant:to===6?'hope':to===0?'fatalism':null};
  state.hope=to;state.events[event.id]=result;
  return result;
 }
 w.ZargotaEsterosResolveCore={current,apply};
})(window);
