(function(w){
  'use strict';
  var p=JSON.parse(JSON.stringify(w.ZargotaStoryCampaign));
  function portrait(file){return 'assets/stories/portraits/'+encodeURIComponent('Портреты')+'/'+encodeURIComponent('ChatGPT Image 9 сент. 2026 г., '+file+'.png');}
  p.id='vrotik-lookout-test';p.title='Вротик · Огонь за облаками';p.titleUk='Вротік · Вогонь за хмарами';p.episode='Тестовый эпизод';p.episodeUk='Тестовий епізод';p.quest='Огонь за облаками';p.questUk='Вогонь за хмарами';p.entryId='lookout-start';
  p.scene.boardWidth=28;p.scene.boardHeight=16;p.scene.layers[0].image='assets/stories/backgrounds/cliff-lookout-v1.png';p.scene.story={cameraZoom:1};
  p.walkable=[[5,95],[8,73],[27,50],[50,34],[69,13],[82,10],[90,26],[82,39],[63,43],[40,57],[20,76],[14,95]];
  p.scene.tokens=p.scene.tokens.slice(0,2);p.scene.tokens[0].x=49;p.scene.tokens[0].y=42;p.scene.tokens[1].x=75;p.scene.tokens[1].y=26;
  p.speakers.vrotik={name:'Вротик',nameUk:'Вротік',portrait:portrait('21_27_41 (1)'),position:'50% 35%',zoom:1.05};
  p.speakers.brother={name:'Брат Вротика',nameUk:'Брат Вротіка',portrait:portrait('21_28_28 (1)'),position:'50% 35%',zoom:1.05};
  p.scene.tokens[0].image=p.speakers.vrotik.portrait;p.scene.tokens[1].image=p.speakers.brother.portrait;
  p.interactions={'story-brother':{entryId:p.entryId,main:true,marker:'?'}};
  function n(id,speaker,ru,uk,x,y,links){return{id:id,title:ru.slice(0,30),titleUk:uk.slice(0,30),text:ru,textUk:uk,speaker:speaker,x:x,y:y,links:links||[]};}
  p.nodes=[n('lookout-start','brother','Подойди, Вротик. Взгляни вдаль — за облаками ещё горит огонь. Видишь башню на хребте?','Підійди, Вротіку. Поглянь удалечінь — за хмарами ще горить вогонь. Бачиш вежу на хребті?',70,70,[{id:'dismiss',to:'lookout-dismiss',label:'Это не важно. Нам пора идти.',labelUk:'Це не важливо. Нам час іти.'},{id:'look',to:'lookout-view',label:'Взглянуть вдаль',labelUk:'Поглянути вдалечінь'}]),
  n('lookout-dismiss','vrotik','Огонь далеко. А ночь уже близко. Давай сначала найдём безопасный спуск.','Вогонь далеко. А ніч уже близько. Давай спершу знайдемо безпечний спуск.',390,70,[{id:'dismiss-next',to:'lookout-path'}]),
  n('lookout-path','brother','Хорошо. Иди по старой тропе к каменной арке. Я пойду следом — только не подходи к осыпи.','Гаразд. Іди старою стежкою до кам’яної арки. Я піду слідом — тільки не підходь до осипу.',710,70),
  n('lookout-view','vrotik','Облака расходятся. Внизу серебрится река, а справа, на далёком хребте, над башней дрожит золотой огонь. Кто-то поддерживает его даже здесь.','Хмари розходяться. Внизу сріблиться річка, а праворуч, на далекому хребті, над вежею тремтить золотий вогонь. Хтось підтримує його навіть тут.',390,340,[{id:'view-next',to:'lookout-beacon'}]),
  n('lookout-beacon','brother','Теперь видишь. Пока горит маяк, в долине кто-то ждёт. Найдём дорогу к той башне — начнём со спуска у старой арки.','Тепер бачиш. Поки горить маяк, у долині хтось чекає. Знайдемо дорогу до тієї вежі — почнемо зі спуску біля старої арки.',710,340)];
  p.nodes[3].kind='image';p.nodes[3].image='assets/stories/backgrounds/distant-beacon-v1.png';
  p.nodes[2].objective='Найти безопасный спуск у старой арки';p.nodes[2].objectiveUk='Знайти безпечний спуск біля старої арки';
  p.nodes[4].objective='Найти путь к башне с огнём';p.nodes[4].objectiveUk='Знайти шлях до вежі з вогнем';
  w.ZargotaStoryLookout=p;
  w.addEventListener('load',function(){if(new URLSearchParams(location.search).has('lookout-demo'))w.ZargotaStoryPlayer.start(p,function(){w.zgStoryEditorOpen(p.id);});});
})(window);
