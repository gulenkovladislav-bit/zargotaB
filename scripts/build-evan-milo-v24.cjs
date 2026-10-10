const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../story-content/evan'),out=JSON.parse(fs.readFileSync('/Users/merkov/Downloads/episode-muedzjx3-odc3 (1).json')),e=out.episode;
for(const op of JSON.parse(fs.readFileSync(path.join(dir,'milo-v23-patch.json'))).operations){const i=e.nodes.findIndex(n=>n.id===op.id);assert.deepEqual(i<0?null:e.nodes[i],op.before,'Source changed: '+op.id);if(i<0)e.nodes.push(op.after);else e.nodes[i]=op.after;}
const base=structuredClone(e);
for(const n of e.nodes){
 if(/^card-v21-offer-(feltser|pen)$/.test(n.id)){
  const offer=e.minigames.towerClaw.itemStakes.find(o=>o.speakerId===n.speaker);assert.ok(offer);
  const question=n.slides.find(p=>p.speaker===n.speaker&&/stake:/.test(p.text));assert.ok(question);
  Object.assign(n,question);n.slides=[];n.kind='choice';n.offeredItemId=offer.itemId;
  const yes=n.links.find(l=>l.cardPurchase);assert.ok(yes);yes.label='Купить за {{stake:'+offer.speakerId+'}} медных';yes.labelUk='Купити за {{stake:'+offer.speakerId+'}} мідних';
  const no=n.links.find(l=>!l.cardPurchase);no.label='Нет';no.labelUk='Ні';
 }
 if(n.id==='evan-exchange-leave'){n.links=[{...n.links[0],to:'',label:'Пойду искать размен',labelUk:'Піду шукати розмін'}];delete n.links[0].sceneId;}
 if(['evan-yard-safe','evan-yard-risk'].includes(n.id)&&!(n.beforeWorldActions||[]).some(a=>a.type==='projectile'))n.beforeWorldActions=[...(n.beforeWorldActions||[]),{type:'projectile',targetId:'evan-yard-stones',offsetX:n.id==='evan-yard-risk'?12:0,offsetY:n.id==='evan-yard-risk'?7:0,durationMs:900}];
 if(n.id==='card-story-stones')n.cardAction.sound=n.cardAction.sound||'stones';
 if(n.id==='card-social-stone'){
  n.text='Ай… не. Больно.';n.textUk='Ай… ні. Боляче.';
  n.slides[0].text='Даун, я тебе твои деньги вернул. Чего орёшь?';n.slides[0].textUk='Даун, я тобі твої гроші повернув. Чого волаєш?';
  n.slides[2].text='Не… не кидай.';n.slides[2].textUk='Не… не кидай.';
 }
 // Individual speech: short fragments, no blanket claim about a diagnosis.
 for(const p of [n,...n.slides||[]])if(p.speaker==='evan-yard-milo'){
  const replacements={'Пока ты проигрывал.':['Я… тут. Стоял.','Я… тут. Стояв.'],'С вами. Я принёс.':['Я… тоже. Вот.','Я… теж. Ось.'],'Вот. У меня тоже есть.':['На. Камни. Играть.','На. Камінці. Грати.'],'Этот гладкий. Он больше стоит.':['Этот… хороший. Мой.','Цей… хороший. Мій.'],'Я съел.':['Ам. Всё.','Ам. Усе.'],'Она маленькая.':['Нету… я. Ам.','Нема… я. Ам.'],'Я только одну.':['Одну… одну.','Одну… одну.'],'Я твою не буду.':['Не… твою. Не.','Не… твою. Ні.']};
  if(replacements[p.text])[p.text,p.textUk]=replacements[p.text];
 }
 if(n.id==='card-story-card-missing'){
  const p=n.slides.find(p=>p.text.startsWith('Ха…'));p.text='Ха… Погоди. Ты её проглотил? Блять, открой рот. Да не улыбайся — карту где?!';p.textUk='Ха… Стривай. Ти її проковтнув? Блять, відкрий рота. Та не всміхайся — карта де?!';p.emotion='shocked';
  n.slides.push({speaker:'evan-port-feltser',text:'Всё. Хватит ржать. Он мою колоду сожрал, а вы сидите, блять, довольные.',textUk:'Усе. Досить реготати. Він мою колоду зжер, а ви сидите, блять, задоволені.',emotion:'angry',showPortrait:true});
 }
}
const patch={format:'zargota-guarded-content-patch',base:'episode-1-milo-v23.json',operations:[]};
for(const n of e.nodes){const before=base.nodes.find(x=>x.id===n.id);if(JSON.stringify(before)!==JSON.stringify(n))patch.operations.push({collection:'nodes',id:n.id,before,after:n});}
for(const n of e.nodes.filter(n=>/^card-v21-offer-(feltser|pen)$/.test(n.id))){assert.equal(n.slides.length,0);assert.equal(n.links.length,2);assert.ok(e.storyItems.find(i=>i.itemId===n.offeredItemId)?.image);}
fs.writeFileSync(path.join(dir,'episode-1-milo-v24.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(dir,'milo-v24-patch.json'),JSON.stringify(patch,null,2)+'\n');
console.log('v24: '+patch.operations.length+' nodes; offers contain zero intermediate pages, item images and 2 choices; v22 fixes carried forward');
