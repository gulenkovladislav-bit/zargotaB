'use strict';
// Generated reviewable snapshot; never imports into browser storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../story-content/evan');
const out=JSON.parse(fs.readFileSync(path.join(dir,'episode-1-courtyard-v15.json')));
const e=out.episode,patch=JSON.parse(fs.readFileSync(path.join(dir,'courtyard-v16-patch.json')));
for(const op of patch.operations){
 if(op.collection){const rows=e[op.collection],index=rows.findIndex(n=>n.id===op.id);assert.deepEqual(index<0?null:rows[index],op.before);if(index<0)rows.push(op.after);else rows[index]=op.after;}
 else{assert.deepEqual(e[op.property]||null,op.before);e[op.property]=op.after;}
}
const base=structuredClone(e),street='scene-mu7f8tk1-6m4a',yard='scene-evan-green-courtyard',N='evan-courtyard-narrator',E=e.playerSpeakerId,F='evan-port-feltser';
let seq=0;
const link=(to,label='Продолжить',labelUk='Продовжити',extra={})=>({id:'exchange-v17-'+(++seq),to,label,labelUk,...extra});
const page=(speaker,text,textUk,emotion='')=>({speaker,text,textUk,emotion,showPortrait:speaker!==N,firstShowPortrait:speaker!==N});
function node(id,title,titleUk,pages,links=[],extra={}){const n={id,title,titleUk,editorSceneId:street,x:3800+(seq%4)*300,y:1800+seq*35,kind:links.length>1?'choice':'dialogue',...pages[0],slides:pages.slice(1),links,...extra};const i=e.nodes.findIndex(n=>n.id===id);if(i<0)e.nodes.push(n);else e.nodes[i]=n;return n;}
e.storyItems.push({itemId:'evan-copper-coin',name:'Медная монета',nameUk:'Мідна монета',description:'Разменная монета. Десять медных равны одной серебряной.',descriptionUk:'Розмінна монета. Десять мідних дорівнюють одній срібній.',category:'other',stackable:true,qty:1,equipped:false,image:'images/ui/coins/copper.webp'});
node('evan-exchange-leave','Нужна мелочь','Потрібні дрібні',[
 page(E,'У меня серебро. Медь разменяете?','У мене срібло. На мідь розміняєте?','emotion-1789852989293'),
 page(F,'Да откуда у нас столько мелочи, бля? На улице поспрашивай. Мы пока колоду разложим.','Та звідки в нас стільки дрібних, бля? На вулиці порозпитуй. Ми поки колоду розкладемо.','speaking')
],[link('evan-exchange-street','Выйти на улицу за разменом','Вийти на вулицю по розмін',{sceneId:street,effect:'evan-exchange-errand'}),link('evan-port-free','Пока сыграем без денег','Поки зіграємо без грошей')],{editorSceneId:yard});
node('evan-exchange-street','Кого спросить?','Кого спитати?',[
 page(E,'Попробую спросить прохожих. Один серебряный — десять медных. На пробу хватит.','Спробую спитати перехожих. Один срібняк — десять мідних. На пробу вистачить.','emotion-1789852949259')
]);
node('evan-exchange-back','Снова у ребят','Знову в хлопців',[
 page(F,'Ну что, нашёл мелочь? Или пока без денег учимся?','Ну що, знайшов дрібні? Чи поки без грошей вчимося?','speaking')
],[link('evan-port-free','Медь есть. Сначала покажите правила','Мідь є. Спершу покажіть правила',{requiresItemId:'evan-copper-coin',requiresItemQty:1}),link('evan-exchange-leave','Ещё поищу размен','Ще пошукаю розмін'),link('evan-port-free','Сыграем пробную без ставки','Зіграємо пробну без ставки')],{editorSceneId:yard});
for(const id of ['evan-port-stake','evan-yard-ready','evan-yard-finish'])e.nodes.find(n=>n.id===id).links.push(link('evan-exchange-leave','Сначала разменяю серебро','Спершу розміняю срібло',{requiresItemId:'evan-silver-coin',requiresItemQty:1}));
for(const id of ['evan-yard-greet','evan-port-wait'])Object.assign(e.nodes.find(n=>n.id===id),{repeatWhen:'evan-exchange-errand',repeatId:'evan-exchange-back'});
node('evan-exchange-bye','До встречи','До зустрічі',[page(E,'Ладно, спасибо.','Гаразд, дякую.','emotion-1789852989293')]);
const greetings=[page(E,'Извините! Не разменяете серебряный на медь?','Перепрошую! Не розміняєте срібняк на мідь?','emotion-1789852989293')];
const people=[
 ['street-man-east','busy','Прохожий даже не сбавляет шаг. Только отмахивается.','Перехожий навіть не сповільнює крок. Лише відмахується.'],
 ['street-woman-west','empty','Женщина качает головой: «Сама бы разменяла. Всю мелочь за муку отдала».','Жінка хитає головою: «Сама б розміняла. Усі дрібні за борошно віддала».'],
 ['street-man-west','porter','Мужчина придерживает кошель: «По десять медных за серебряный, без наценки. Можно частями — сколько мелочи осталось, столько разменяю».','Чоловік притримує гаманець: «По десять мідних за срібняк, без націнки. Можна частинами — скільки дрібних залишилося, стільки розміняю».'],
 ['street-woman-east','seller','Женщина пересчитывает мелочь: «Десять за серебряный. Давай, пока мелочь есть. Себе крупные оставлю».','Жінка перелічує дрібні: «Десять за срібняк. Давай, поки дрібні є. Собі великі залишу».']
];
for(const [token,key,ru,uk] of people){
 const id='evan-exchange-'+key,can=['porter','seller'].includes(key),flag=id+'-spent';
 const links=[link('evan-exchange-bye','Не отвлекать','Не відволікати')];
 const limit=key==='porter'?3:2;
 if(can)for(let amount=limit;amount>=1;amount--)links.unshift(link(id+'-done',`Разменять: серебро ${amount} → медь ${amount*10}`,`Розміняти: срібло ${amount} → мідь ${amount*10}`,{requiresItemId:'evan-silver-coin',requiresItemQty:amount,exchangeTakeId:'evan-silver-coin',exchangeTakeQty:amount,exchangeGiveId:'evan-copper-coin',exchangeGiveQty:amount*10,exchangeOnce:flag,exchangeLimit:limit}));
 node(id,'Спросить о размене','Спитати про розмін',[...greetings,page(N,ru,uk)],links,can?{repeatWhen:flag,repeatId:id+'-empty'}:{});
 if(can){node(id+'-done','Монета на мелочь','Монета на дрібні',[page(N,'Еван отдаёт серебро и пересчитывает полученную медь. По десять за монету — всё сходится.','Еван віддає срібло й перелічує отриману мідь. По десять за монету — усе сходиться.'),page(E,'Спасибо. Выручили!','Дякую. Виручили!','emotion-1789852957946')]);node(id+'-empty','Мелочи больше нет','Дрібних більше немає',[page(N,'Прохожий разводит руками: «Всю свободную медь уже тебе отдал».','Перехожий розводить руками: «Усю вільну мідь уже тобі віддав».')]);}
 e.interactions[token]={entryId:id,marker:'?',markerVisible:false};
 e.scenes.find(s=>s.id===street).scene.tokens.find(t=>t.id===token).dialogueInteractive=true;
}
// Retain every traffic route and existing scene transition.
const operations=[];
for(const after of e.nodes){const before=base.nodes.find(n=>n.id===after.id)||null;if(JSON.stringify(before)!==JSON.stringify(after))operations.push({collection:'nodes',id:after.id,before,after});}
for(const property of ['storyItems','interactions','scenes'])operations.push({property,before:base[property],after:e[property]});
fs.writeFileSync(path.join(dir,'episode-1-courtyard-v17.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(dir,'courtyard-v17-patch.json'),JSON.stringify({format:'zargota-guarded-content-patch',base:'courtyard-v16-patch.json',operations},null,2)+'\n');
console.log('v17 generated: four passersby, two finite exchanges, editable dialogue, no browser import.');
