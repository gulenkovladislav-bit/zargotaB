// Additive content build; does not read or overwrite browser saves.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=process.argv[2];assert.ok(source,'Pass the unmodified v24 episode export');
const out=JSON.parse(fs.readFileSync(source)),e=out.episode,base=structuredClone(e);
assert.ok(e.nodes.some(n=>n.id==='card-v21-offer-pen'&&n.slides.length===0),'Expected v24');
assert.ok(!e.nodes.some(n=>n.id==='evan-v25-depart'),'Already extended');
const dir=path.join(__dirname,'../story-content/evan'),art='assets/stories/Evan/university/';
const street='scene-evan-v25-departure',ride='scene-evan-v25-wagon',campus='scene-mu7f8xuw-u6wn',book='evan-university-booklet';
const hero=e.playerSpeakerId,mother='speaker-1789799703305',father='speaker-1789814989758';
const talk={[hero]:'emotion-1789852989293',[mother]:'emotion-1789816051716',[father]:'emotion-1789816132394'};
const page=(speaker,text,textUk,emotion)=>({speaker,text,textUk,emotion:emotion||talk[speaker]||'',showPortrait:!!speaker,portraitOverride:false});
const link=(to,label='Далее',labelUk='Далі',extra={})=>({id:'v25-link-'+(++linkN),to,label,labelUk,...extra});let linkN=0;
function node(id,scene,title,titleUk,pages,links=[],extra={}){const n={id,kind:links.length>1?'choice':'dialogue',editorSceneId:scene,title,titleUk,x:300+e.nodes.filter(n=>n.id.startsWith('evan-v25-')).length*340,y:300,portraitOverride:false,firstShowPortrait:pages[0].showPortrait,...pages[0],slides:pages.slice(1),links,...extra};e.nodes.push(n);return n;}
const originalStreet=e.scenes.find(s=>s.id==='scene-mu7f8tk1-6m4a');
const token=structuredClone(e.scenes.flatMap(s=>s.scene.tokens||[]).find(t=>t.id===e.heroTokenId));assert.ok(token);
function scene(id,name,nameUk,image,x=50,y=80){const record={id,name,nameUk,scene:{name,nameUk,boardWidth:24,boardHeight:13.5,gridSize:64,layers:[{id:'story-background',image:art+image,visible:true,opacity:1,fit:'contain',scale:1}],tokens:[{...structuredClone(token),x,y,size:72,visible:true}],story:{spawnX:x,spawnY:y,cameraZoom:1,movementSpeed:.75,zones:[]}}};const old=e.scenes.findIndex(s=>s.id===id);if(old>=0){assert.ok(!e.nodes.some(n=>n.editorSceneId===id),'Do not replace an authored scene');e.scenes[old]=record;}else e.scenes.push(record);return record;}
function point(record,id,x,y,entryId,name,nameUk){record.scene.tokens.push({id,type:'note',name,nameUk,x,y,size:38,visible:true,interactionRadiusScale:1.4});e.interactions[id]={entryId,marker:'?',markerVisible:true};}
const departure=scene(street,'Повозка у лавки','Повозка біля крамниці','street-wagon-v1.png',76,62);
// Preserve building collision silhouettes; discard old NPCs, traffic and quest exits.
departure.scene.story.zones=structuredClone((originalStreet.scene.story.zones||[]).filter(z=>z.blocked));
departure.scene.story.zones.push({id:'v25-wagon-obstacle',blocked:true,enabled:true,points:[[12,36],[45,36],[45,60],[12,60]]});
point(departure,'v25-parents',30,67,'evan-v25-boarding','Родители у повозки','Батьки біля повозки');
scene(ride,'В крытой повозке','У критій повозці','wagon-interior-v1.png');
const global=scene(campus,'ЗТУЗ · карта корпусов','ЗТУЗ · мапа корпусів','campus-v1.png',51,83);
point(global,'v25-campus-map',51,70,'evan-v25-map','Развернуть буклет','Розгорнути буклет');
const faculties=[
 ['magic','Магия','Магія',5,3,38,36,50,79,50,33,'За этими дверями учат магии. Сначала бы понять, что здесь спрашивают у поступающих.','За цими дверима вчать магії. Спершу б зрозуміти, що тут питають у вступників.'],
 ['engineering','Инженерия','Інженерія',59,3,39,40,52,82,51,35,'Вот этот подъёмник я бы рассмотрел. Где у него крепится верёвка?','Оцей підіймач я б роздивився. Де в нього кріпиться мотузка?'],
 ['botany','Естествознание','Природознавство',1,48,40,44,53,82,52,35,'Колосья подписаны по грядкам. Отец наверняка узнал бы больше меня.','Колосся підписане за грядками. Батько напевне впізнав би більше за мене.'],
 ['military','Военное дело','Військова справа',59,49,39,44,48,82,28,42,'На этих стойках следы настоящих ударов. Моя лавка дома выглядит куда бодрее.','На цих стійках сліди справжніх ударів. Моя лавка вдома має значно бадьоріший вигляд.']
];
const destinations=[];
const approaches={magic:[47,43],engineering:[42,45],botany:[53,43],military:[32,60]};
const walking={
 magic:[[9,65],[36,44],[47,39],[62,46],[88,67],[96,100],[8,100]],
 engineering:[[0,54],[28,39],[41,42],[51,51],[68,62],[91,76],[99,94],[70,100],[2,100]],
 botany:[[27,40],[51,41],[59,46],[83,69],[66,80],[50,100],[28,96],[38,72],[29,59]],
 military:[[13,80],[30,56],[48,47],[60,37],[99,32],[99,99],[29,99]]
};
for(const [key,name,nameUk,x,y,width,height,sx,sy,dx,dy,text,textUk] of faculties){
 const id='scene-evan-v25-'+key,record=scene(id,name+' · вход',nameUk+' · вхід',key+'-v1.png',sx,sy);
 // Broad open paving. Roofs are excluded from the walking surface.
 record.scene.story.zones.push({id:'v25-'+key+'-roof',enabled:true,blocked:true,points:[[0,0],[100,0],[100,25],[0,25]]});
 record.scene.story.walkable=walking[key];
 point(record,'v25-'+key+'-door',...approaches[key],'evan-v25-'+key+'-door','Вход в корпус','Вхід до корпусу');
 point(record,'v25-'+key+'-map',sx,sy+6,'evan-v25-map','Развернуть буклет','Розгорнути буклет');
 node('evan-v25-'+key+'-door',id,name+' · у входа',nameUk+' · біля входу',[page(hero,text,textUk,'emotion-1789852949259')]);
 destinations.push({id:key,name,nameUk,x,y,width,height,sceneId:id});
}
e.storyItems.push({itemId:book,name:'Буклет ЗТУЗ',nameUk:'Буклет ЗТУЗ',description:'Складной план университетских корпусов. Откройте карту в сумке и выберите, куда идти.',descriptionUk:'Складаний план університетських корпусів. Відкрийте мапу в сумці й оберіть, куди йти.',category:'key',stackable:false,qty:1,image:art+'campus-v1.png',travelMap:{title:'ЗТУЗ · корпуса',titleUk:'ЗТУЗ · корпуси',image:art+'campus-v1.png',requires:'evan-v25-arrived',allowedScenes:[campus,...destinations.map(d=>d.sceneId)],destinations}});
const finish=e.nodes.find(n=>n.id==='evan-yard-finish');finish.links.push(link('evan-v25-depart','Закончить игру и вернуться к лавке','Закінчити гру й повернутися до крамниці'));
node('evan-v25-depart','scene-evan-green-courtyard','После карт · домой','Після карт · додому',[
 page(hero,'Всё, я ухожу. Мы сегодня ещё едем.','Усе, я йду. Ми сьогодні ще їдемо.'),
 page('evan-friend-tarin','Давай. Потом расскажешь, что там за воротами.','Давай. Потім розкажеш, що там за брамою.','speaking')
],[link('','Вернуться к лавке','Повернутися до крамниці',{sceneId:street})],{afterEffect:'evan-v25-cards-finished'});
node('evan-v25-boarding',street,'Повозка дождалась','Повозка дочекалася',[
 page(mother,'Вот ты где. Садись, Эван. Отец уже дважды пересчитал наши свёртки.','Ось ти де. Сідай, Еване. Батько вже двічі перелічив наші згортки.'),
 page(father,'И оба раза их было столько же. Бумаги у меня, ничего не забыли.','І обидва рази їх було стільки ж. Папери в мене, нічого не забули.'),
 page(hero,'А почему заднее колесо больше переднего? На поворотах так удобнее?','А чому заднє колесо більше за переднє? На поворотах так зручніше?','emotion-1789852949259'),
 page(mother,'Сначала залезь. Рассматривать колёса из-под колёс не надо.','Спершу залізь. Розглядати колеса з-під коліс не треба.','emotion-1789815980576')
],[link('evan-v25-road','Сесть в повозку','Сісти в повозку',{sceneId:ride})]);
node('evan-v25-road',ride,'По дороге · родители','Дорогою · батьки',[
 page(mother,'Не прижимайся к полотну. На улице пыль, а ты только оделся.','Не притуляйся до полотна. Надворі пил, а ти щойно вдягнувся.'),
 page(hero,'Я смотрю. Отсюда вывески совсем другие — снизу ничего не видно.','Я дивлюся. Звідси вивіски зовсім інші — знизу нічого не видно.'),
 page(father,'В университете тоже сначала посмотри. Потом спрашивай. И дослушивай ответ.','В університеті теж спершу подивися. Потім питай. І дослуховуй відповідь.'),
 page(hero,'Я дослушиваю. Просто иногда уже понятно, что спросить дальше.','Я дослуховую. Просто іноді вже зрозуміло, що спитати далі.','emotion-1789852957946')
],[link('evan-v25-booklet')],{image:art+'wagon-interior-v1.png',imageFit:'contain'});
node('evan-v25-booklet',ride,'Буклет · получить карту','Буклет · отримати мапу',[
 page(father,'Держи. План корпусов. Я взял, когда узнавал насчёт поездки.','Тримай. План корпусів. Я взяв, коли дізнавався про поїздку.'),
 page(hero,'Вот мастерские… А это всё — учебные грядки? Почти как отдельный двор на каждый корпус.','Ось майстерні… А це все — навчальні грядки? Майже окреме подвір’я на кожен корпус.','emotion-1789852949259'),
 page(father,'Четыре корпуса. Магия, инженерия, естествознание и военное дело. Не пытайся обойти все за одну минуту.','Чотири корпуси. Магія, інженерія, природознавство й військова справа. Не намагайся обійти всі за одну хвилину.'),
 page(mother,'Сложи аккуратно. Приедем — выберешь, откуда начать.','Склади охайно. Приїдемо — обереш, звідки почати.')
],[link('evan-v25-arrival','Доехать до университета','Доїхати до університету',{sceneId:campus})],{image:art+'wagon-interior-v1.png',imageFit:'contain',afterWorldActions:[{actionId:'v25-give-booklet',type:'giveItem',itemId:book,qty:1}]});
node('evan-v25-arrival',campus,'Прибытие · четыре корпуса','Прибуття · чотири корпуси',[
 page(hero,'На бумаге всё помещалось под ладонью. А здесь от одних ворот до других идти и идти.','На папері все вміщалося під долонею. А тут від однієї брами до іншої йти та йти.','emotion-1789853039972'),
 page(father,'Не спеши. Посмотри, куда хочешь подойти. Мы рядом.','Не поспішай. Подивися, куди хочеш підійти. Ми поруч.'),
 page(mother,'И буклет не потеряй. Доставай, разберёмся.','І буклет не загуби. Діставай, розберемося.')
],[],{afterEffect:'evan-v25-arrived',openTravelMap:book});
node('evan-v25-map',campus,'Карта университета','Мапа університету',[page(hero,'Так. Куда теперь?','Так. Куди тепер?','emotion-1789852949259')],[],{openTravelMap:book});
const gameQuest=e.quests.find(q=>q.id==='evan-yard-game-quest');Object.assign(gameQuest,{title:'Игра с ребятами',titleUk:'Гра з хлопцями',objective:'Сыграть с ребятами. Когда закончите — вернуться к лавке.',objectiveUk:'Зіграти з хлопцями. Коли закінчите — повернутися до крамниці.',dialogueId:'evan-v25-depart'});
const papers=e.quests.find(q=>q.id==='evan-yard-papers-quest');Object.assign(papers,{title:'Повозка ждёт',titleUk:'Повозка чекає',objective:'Подойти к родителям возле повозки.',objectiveUk:'Підійти до батьків біля повозки.',dialogueId:'evan-v25-boarding',nextId:'evan-v25-journey'});
e.quests.push({id:'evan-v25-journey',title:'Дорога в университет',titleUk:'Дорога до університету',objective:'Поговорить с родителями по дороге.',objectiveUk:'Поговорити з батьками дорогою.',dialogueId:'evan-v25-arrival',nextId:'evan-v25-campus',actions:[]},{id:'evan-v25-campus',title:'Университет',titleUk:'Університет',objective:'Развернуть буклет и осмотреть входы корпусов.',objectiveUk:'Розгорнути буклет і оглянути входи корпусів.',actions:[]});
const patch={format:'zargota-guarded-content-patch',base:path.basename(source),operations:[]};
for(const collection of ['nodes','scenes','storyItems','quests'])for(const after of e[collection]){const key=collection==='storyItems'?'itemId':'id',before=base[collection].find(x=>x[key]===after[key])||null;if(JSON.stringify(before)!==JSON.stringify(after))patch.operations.push({collection,id:after[key],before,after});}
patch.interactions={before:base.interactions,after:e.interactions};
fs.writeFileSync(path.join(dir,'episode-1-university-v25.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(dir,'university-v25-patch.json'),JSON.stringify(patch,null,2)+'\n');
console.log('Built v25: '+patch.operations.length+' guarded changes; '+destinations.length+' map destinations.');
