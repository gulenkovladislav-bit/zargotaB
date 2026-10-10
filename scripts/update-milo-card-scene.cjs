const fs=require('node:fs'),assert=require('node:assert/strict');
const [source,destination]=process.argv.slice(2);if(!source||!destination)throw Error('Expected source and destination');
const doc=JSON.parse(fs.readFileSync(source,'utf8')),p=doc.episode||doc,before=JSON.parse(JSON.stringify(p));
const node=id=>{const n=p.nodes.find(n=>n.id===id);assert(n,id);return n;};
p.minigames.towerClaw.firstRoundBetCap=2;p.minigames.towerClaw.ante??=1;
const engineering=p.minigames.towerClawTables?.find(t=>t.tableId==='engineering');if(engineering)engineering.ante??=2;
const stone=node('card-social-stone');assert.equal(stone.cardAction.kind,'stone');Object.assign(stone.cardEvent,{phase:'roundStart',round:3,minRound:3,delaySeconds:0});delete stone.cardEvent.afterEventId;
for(const id of ['card-story-crunch','card-story-card-missing'])node(id).cardEvent.round=4;
const hero=p.playerSpeakerId,milo='evan-yard-milo',feltser='evan-port-feltser',pen='evan-port-pen';
function page(speaker,text,textUk,emotion='speaking'){assert(p.speakers[speaker]);assert(!emotion||p.speakers[speaker].emotions[emotion],speaker+':'+emotion);return {speaker,text,textUk,emotion,showPortrait:true};}
function add(id,title,titleUk,first,slides,cardAction){assert(!p.nodes.some(n=>n.id===id));p.nodes.push({id,title,titleUk,editorSceneId:stone.editorSceneId,kind:'dialogue',x:stone.x+720,y:stone.y+(id.endsWith('throw')?300:0),...first,firstShowPortrait:true,slides,links:[],...(cardAction?{cardAction}: {})});}
add('card-milo-copper-help','Карты · медь в ладонь Мило','Карти · мідь у долоню Мило',page(hero,'Держи. Это для игры.','Тримай. Це для гри.','emotion-1789852989293'),[
page(milo,'Мне?.. Одна. Спасибо.','Мені?.. Одна. Дякую.'),
page(feltser,'Ну всё, богач. Камнями только сдачу не давай.','Ну все, багатій. Камінням тільки решту не давай.','laughing'),
page(milo,'Эту… не кидать.','Цю… не кидати.','sad')]);
add('card-milo-copper-throw','Карты · Еван бросает медную','Карти · Еван кидає мідну',page(milo,'Ай!.. Не надо.','Ай!.. Не треба.','sad'),[
page(hero,'Вот. Теперь настоящие деньги.','Ось. Тепер справжні гроші.','emotion-1789852989293'),
page(feltser,'Ха! Вот это я понимаю — помог человеку.','Ха! Оце я розумію — допоміг людині.','laughing'),
page(milo,'Можно… в руку.','Можна… в руку.','sad')],{kind:'coin',from:hero,to:milo});
stone.links.unshift({id:'milo-copper-help',to:'card-milo-copper-help',label:'Дать Мило 1 медную в руку',labelUk:'Дати Мило 1 мідну в руку',cardGiveGuest:1,effect:'evanHelpedMilo',rememberEffect:true},{id:'milo-copper-throw',to:'card-milo-copper-throw',label:'Бросить в Мило 1 медную',labelUk:'Кинути в Мило 1 мідну',cardGiveGuest:1,effect:'evanMockedMilo',rememberEffect:true});
// Existing authored lines, including unfinished pages, are intentionally preserved.
for(const old of before.nodes){const current=node(old.id);assert.equal(current.text,old.text);assert.equal(current.textUk,old.textUk);assert.deepEqual(current.slides,old.slides);}
for(const n of p.nodes)for(const l of n.links||[])if(l.to)assert(p.nodes.some(x=>x.id===l.to),l.to);
fs.writeFileSync(destination,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
console.log('Saved: opening cap 2, stone on deal 3, give/throw copper branches; existing dialogue text preserved.');
