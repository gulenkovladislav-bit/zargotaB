(function(root,factory){
  var api=factory(root||{});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaDiceResultFx=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(w){
  'use strict';

  var active=Object.create(null),completed=Object.create(null),styleReady=false;
  var bands=[
    {key:'subtle',label:'1–9',max:9},
    {key:'awakened',label:'10–19',max:19},
    {key:'forceful',label:'20–29',max:29},
    {key:'dominant',label:'30–39',max:39},
    {key:'overwhelming',label:'40–49',max:49},
    {key:'might',label:'50+',max:Infinity,powerLabel:'МОГУЩЕСТВО'}
  ];

  function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
  function bandForScore(score){
    score=Math.max(0,Number(score)||0);var index=0;
    while(index<bands.length-1&&score>bands[index].max)index++;
    return{index:index,number:index+1,band:bands[index]};
  }
  function magnitudeForScore(score){return clamp(.72+Math.sqrt(Math.max(0,Number(score)||0))*.15,.78,2.25);}
  function meaningfulRolls(rolls){
    rolls=Array.isArray(rolls)?rolls.filter(Boolean):[];
    var contest=rolls.some(function(item){var mode=String(item.rollMode||'').toLowerCase();return mode==='advantage'||mode==='disadvantage';});
    if(!contest)return rolls;
    return [rolls.find(function(item){return item.kept===true;})||rolls[0]].filter(Boolean);
  }
  function grade(rolls,total,options){
    options=options||{};
    var relevant=meaningfulRolls(rolls),raw=0,min=0,max=0,combinationChance=1;
    relevant.forEach(function(item){
      var sides=Math.max(1,Number(item.sides)||1),value=clamp(item.value,1,sides);
      raw+=value;min+=1;max+=sides;combinationChance*=1/sides;
    });
    var quality=max>min?(raw-min)/(max-min):(raw>=max?1:0.5);
    var exactMax=!!relevant.length&&raw===max,exactMin=!!relevant.length&&raw===min;
    var surpriseBits=exactMax||exactMin?-Math.log(Math.max(Number.MIN_VALUE,combinationChance))/Math.LN2:0;
    var tier=exactMax?(surpriseBits>=6?'legendary':surpriseBits>=4?'exceptional':'perfect'):exactMin?(surpriseBits>=6?'catastrophic':surpriseBits>=4?'disastrous':'fumble'):quality>=0.85?'excellent':quality>=0.65?'strong':quality>=0.35?'steady':'low';
    var score=Math.max(0,Number(total)||0),scale=bandForScore(score),bandIndex=scale.index,band=scale.band,magnitude=magnitudeForScore(score);
    return{
      hidden:!!options.hidden,total:score,raw:raw,min:min,max:max,
      quality:quality,tier:tier,exactMax:exactMax,exactMin:exactMin,
      combinationChance:exactMax||exactMin?combinationChance:1,surpriseBits:surpriseBits,magnitude:magnitude,
      band:bandIndex+1,bandKey:band.key,bandLabel:band.label,powerLabel:band.powerLabel||'',
      count:relevant.length
    };
  }
  function emitSound(cue){
    try{if(w.ZargotaSound&&typeof w.ZargotaSound.diceScoreCue==='function')w.ZargotaSound.diceScoreCue(cue);}catch(ignore){}
  }
  function ensureStyle(){
    if(styleReady||!w.document||!w.document.head)return;
    styleReady=true;
    var style=w.document.createElement('style');style.id='zg-dice-result-fx-style';
    style.textContent='\
.zg-roll-total.dice-score-active{--dice-score-color:#d9bd78;--dice-score-glow:rgba(217,189,120,.36)}\
.zg-roll-total.dice-score-low,.zg-roll-total.dice-score-fumble,.zg-roll-total.dice-score-disastrous,.zg-roll-total.dice-score-catastrophic{--dice-score-color:#b77d70;--dice-score-glow:rgba(150,58,45,.34)}\
.zg-roll-total.dice-score-strong{--dice-score-color:#e4c86f;--dice-score-glow:rgba(228,200,111,.4)}\
.zg-roll-total.dice-score-excellent,.zg-roll-total.dice-score-perfect,.zg-roll-total.dice-score-exceptional{--dice-score-color:#fff0a8;--dice-score-glow:rgba(255,220,92,.54)}\
.zg-roll-total.dice-score-legendary{--dice-score-color:#fff7c8;--dice-score-glow:rgba(255,223,83,.72)}\
.zg-roll-total.dice-score-band-2{--dice-score-color:#efc16b;--dice-score-glow:rgba(211,143,47,.48)}\
.zg-roll-total.dice-score-band-3{--dice-score-color:#e39758;--dice-score-glow:rgba(192,83,38,.52)}\
.zg-roll-total.dice-score-band-4{--dice-score-color:#d06450;--dice-score-glow:rgba(158,38,40,.58)}\
.zg-roll-total.dice-score-band-5{--dice-score-color:#bd3b4a;--dice-score-glow:rgba(126,18,43,.68)}\
.zg-roll-total.dice-score-band-6{--dice-score-color:#941f3f;--dice-score-glow:rgba(112,7,38,.8)}\
.zg-roll-total.dice-score-active b{color:var(--dice-score-color,#d9bd78)!important;text-shadow:0 2px 7px #000,0 0 12px var(--dice-score-glow),0 0 24px var(--dice-score-glow);transition:color .22s ease,text-shadow .22s ease}\
.zg-roll-total.dice-score-active em{color:var(--dice-score-color,#d9bd78);transition:color .22s ease}\
.zg-roll-total.dice-score-final{animation:zgDiceScoreCard .62s cubic-bezier(.18,.75,.22,1) both}\
.zg-dice-score-burst{position:absolute;left:50%;top:50%;width:1px;height:1px;pointer-events:none;z-index:4;color:var(--dice-score-color,#d9bd78)}\
.zg-dice-score-burst::after{content:"";position:absolute;inset:-13px;border:1.5px solid currentColor;border-radius:50%;opacity:.62;box-shadow:0 0 10px currentColor;animation:zgDiceScoreRing .56s ease-out both}\
.zg-dice-score-burst.band-4::before,.zg-dice-score-burst.band-5::before,.zg-dice-score-burst.band-6::before{content:"";position:absolute;inset:-24px;border:1px solid currentColor;border-radius:50%;opacity:.48;box-shadow:0 0 18px var(--dice-score-glow);animation:zgDiceScoreRing .82s cubic-bezier(.12,.72,.2,1) .08s both}\
.zg-dice-score-burst.step::after{inset:-8px;animation-duration:.34s}\
.zg-dice-score-particle{position:absolute;left:0;top:0;width:var(--p-size,4px);height:var(--p-size,4px);margin:calc(var(--p-size,4px)/-2);border-radius:2px;background:currentColor;box-shadow:0 0 6px currentColor,0 0 14px currentColor;transform:rotate(var(--p-angle)) translateX(0) scale(.35);animation:zgDiceScoreParticle var(--p-duration,.76s) cubic-bezier(.12,.7,.2,1) var(--p-delay,0ms) both}\
.zg-dice-score-particle.shard{border-radius:50% 0 50% 0;background:#ffd0bb;box-shadow:0 0 7px currentColor,0 0 18px var(--dice-score-glow)}\
.zg-roll-total.ready.dice-score-might-title b{animation:zgDicePowerNumberYield 1.2s cubic-bezier(.32,0,.2,1) .22s both!important}\
.zg-roll-total.ready.dice-score-might-title em{animation:zgDicePowerMetaYield .55s ease .72s both!important}\
.zg-dice-score-title{position:absolute;left:50%;top:50%;z-index:6;transform:translate(-50%,-50%);white-space:nowrap;color:#e05268;font:900 20px/1.1 Cinzel,serif;letter-spacing:3.8px;text-shadow:0 2px 5px #160006,0 0 9px #7c102d,0 0 25px #b8254c;opacity:0;animation:zgDicePowerTitle 1.6s cubic-bezier(.15,.72,.2,1) 1.52s both}\
@keyframes zgDiceScoreParticle{0%{opacity:0;transform:rotate(var(--p-angle)) translateX(0) scale(.25)}16%,56%{opacity:1}100%{opacity:0;transform:rotate(var(--p-angle)) translateX(var(--p-distance,42px)) scale(.1)}}\
@keyframes zgDiceScoreRing{0%{opacity:.62;transform:scale(.35)}100%{opacity:0;transform:scale(var(--dice-score-ring-scale,2.6))}}\
@keyframes zgDiceScoreCard{0%{filter:none;transform:translateX(-50%) scale(1)}38%{filter:drop-shadow(0 0 18px var(--dice-score-glow));transform:translateX(-50%) scale(var(--dice-score-card-peak,1.075))}100%{filter:none;transform:translateX(-50%) scale(1)}}\
@keyframes zgDicePowerNumberYield{0%,55%{opacity:1;visibility:visible;transform:scale(1)}99%,100%{opacity:0;visibility:hidden;transform:scale(.82)}}\
@keyframes zgDicePowerMetaYield{0%,34%{opacity:1;visibility:visible}99%,100%{opacity:0;visibility:hidden}}\
@keyframes zgDicePowerTitle{0%{opacity:0;letter-spacing:9px;transform:translate(-50%,-50%) scale(.68)}12%{opacity:.12}44%,78%{opacity:1}100%{opacity:.94;letter-spacing:3.8px;transform:translate(-50%,-50%) scale(1)}}\
@media (prefers-reduced-motion:reduce){.zg-roll-total.dice-score-final,.zg-roll-total.dice-score-might-title b,.zg-roll-total.dice-score-might-title em,.zg-dice-score-burst::before,.zg-dice-score-burst::after,.zg-dice-score-particle,.zg-dice-score-title{animation-duration:.01ms!important;animation-delay:0ms!important}}';
    w.document.head.appendChild(style);
  }
  function burst(node,result,phase,index){
    if(!node||!node.appendChild||result.hidden)return;
    ensureStyle();
    var holder=w.document.createElement('span');holder.className='zg-dice-score-burst '+phase+' band-'+result.band;
    holder.style.setProperty('--dice-score-ring-scale',String(1.7+result.magnitude*.85));
    var bonus=result.tier==='legendary'?9:result.tier==='exceptional'||result.tier==='catastrophic'?6:result.tier==='perfect'||result.tier==='disastrous'?4:result.tier==='excellent'?3:result.tier==='strong'?2:0;
    var count=phase==='step'?2+Math.ceil(result.magnitude)+Math.max(0,result.band-2):Math.min(52,6+result.band*3+Math.floor(result.total/8)+bonus),reach=1+Math.max(0,result.band-1)*.1;
    for(var i=0;i<count;i++){
      var particle=w.document.createElement('i');particle.className='zg-dice-score-particle'+(result.band>=4&&i%3===0?' shard':'');
      particle.style.setProperty('--p-angle',((360/count)*i+(index||0)*17)+'deg');
      particle.style.setProperty('--p-distance',((phase==='step'?(14+((i*5)%10))*result.magnitude:(31+((i*7)%17))*result.magnitude)*reach)+'px');
      particle.style.setProperty('--p-size',(phase==='step'?2.6+result.magnitude*.25+result.band*.08:3.4+result.magnitude*.65+(i%3)+result.band*.16)+'px');
      particle.style.setProperty('--p-duration',phase==='step'?'.46s':(.7+result.band*.045)+'s');
      particle.style.setProperty('--p-delay',(i%4)*18+'ms');
      holder.appendChild(particle);
    }
    node.appendChild(holder);
    setTimeout(function(){if(holder.parentNode)holder.remove();},1050);
  }
  function applyVisualBand(node,number,key){
    if(!node||!node.classList)return;
    for(var i=1;i<=bands.length;i++)node.classList.remove('dice-score-band-'+i);
    node.classList.add('dice-score-band-'+number);node.dataset.scoreBand=String(number);node.dataset.scoreBandKey=key;
  }
  function decorate(node,result){
    if(!node||!node.classList)return;
    node.classList.add('dice-score-active','dice-score-'+result.tier);applyVisualBand(node,1,bands[0].key);
    if(node.style&&node.style.setProperty)node.style.setProperty('--dice-score-card-peak',String(1.035+Math.min(.15,result.magnitude*.045+result.band*.009)));
    node.dataset.scoreTier=result.tier;node.dataset.scoreFinalBand=String(result.band);node.dataset.scoreMagnitude=String(result.magnitude.toFixed(3));
  }
  function appendPowerTitle(node,result){
    if(!node||!node.appendChild||result.hidden||!result.powerLabel)return false;
    if(node.querySelector&&node.querySelector('.zg-dice-score-title'))return false;
    var title=w.document.createElement('strong');title.className='zg-dice-score-title';title.textContent=result.powerLabel;node.classList.add('dice-score-might-title');node.appendChild(title);return true;
  }
  function begin(id,rolls,total,node,options){
    id=String(id||'');if(!id||active[id]||completed[id])return false;
    var result=grade(rolls,total,options),soundKind=String(options&&options.soundKind||'').toLowerCase()==='damage'?'damage':'normal',resultSound=String(options&&options.resultSound||'').toLowerCase();
    if(['success','fail','critical-success','critical-fail','silent'].indexOf(resultSound)<0){
      var candidates=(Array.isArray(rolls)?rolls:[]).filter(function(item){return item&&item.kept!==false;}),decisive=candidates.length===1?candidates[0]:(rolls&&rolls.length===1?rolls[0]:null);
      resultSound=decisive&&(decisive.outcome==='critical-success'||decisive.outcome==='critical-fail')?decisive.outcome:'normal';
    }
    var state={id:id,result:result,node:node||null,steps:Object.create(null),finished:false,soundKind:soundKind,resultSound:resultSound};
    active[id]=state;decorate(state.node,result);
    emitSound({id:id,phase:'begin',soundKind:soundKind,resultSound:resultSound,hidden:result.hidden,band:result.band,tier:result.tier,quality:result.quality,count:result.count,total:result.total,magnitude:result.magnitude,surpriseBits:result.surpriseBits});
    return result;
  }
  function step(id,index,running,value){
    var state=active[String(id||'')],key=String(index);if(!state||state.finished||state.steps[key])return false;
    state.steps[key]=true;
    if(!state.result.hidden){
      var runningScore=Math.max(0,Number(running)||0),scale=bandForScore(runningScore),stepResult=Object.assign({},state.result,{total:runningScore,band:scale.number,bandKey:scale.band.key,bandLabel:scale.band.label,powerLabel:'',magnitude:magnitudeForScore(runningScore)});
      applyVisualBand(state.node,scale.number,scale.band.key);
      emitSound({id:state.id,phase:'step',soundKind:state.soundKind,resultSound:state.resultSound,band:scale.number,tier:state.result.tier,quality:state.result.quality,index:Number(index)||0,count:Math.max(1,state.result.count),running:runningScore,value:Number(value)||0,total:state.result.total,magnitude:stepResult.magnitude,surpriseBits:state.result.surpriseBits});
      burst(state.node,stepResult,'step',Number(index)||0);
    }
    return true;
  }
  function finish(id){
    id=String(id||'');var state=active[id];if(!state||state.finished||completed[id])return false;
    state.finished=true;completed[id]=Date.now();
    emitSound({id:state.id,phase:'final',soundKind:state.soundKind,resultSound:state.resultSound,hidden:state.result.hidden,band:state.result.band,tier:state.result.tier,quality:state.result.quality,total:state.result.total,magnitude:state.result.magnitude,surpriseBits:state.result.surpriseBits,exactMax:state.result.exactMax,exactMin:state.result.exactMin});
    applyVisualBand(state.node,state.result.band,state.result.bandKey);
    if(state.node&&state.node.classList)state.node.classList.add('dice-score-final');
    burst(state.node,state.result,'final',0);appendPowerTitle(state.node,state.result);delete active[id];
    var cleanupTimer=setTimeout(function(){delete completed[id];},30000);
    if(cleanupTimer&&typeof cleanupTimer.unref==='function')cleanupTimer.unref();
    return state.result;
  }
  function cancel(id){id=String(id||'');if(!active[id])return false;delete active[id];return true;}
  function diagnostics(){return{active:Object.keys(active),completed:Object.keys(completed),styleReady:styleReady};}

  return{grade:grade,begin:begin,step:step,finish:finish,cancel:cancel,diagnostics:diagnostics};
});
