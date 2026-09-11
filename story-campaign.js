(function(w){
  'use strict';
  var portrait='images/heroart/Vrotik.png',brother='images/story/vrotik-brother-v1.png';
  function node(id,title,titleUk,speaker,text,textUk,x,y,links){return{id:id,title:title,titleUk:titleUk,speaker:speaker,text:text,textUk:textUk,x:x,y:y,complete:id==='dialog-stay'||id==='dialog-go',links:links||[]};}
  w.ZargotaStoryCampaign={
    id:'vrotik-episode-1',heroKey:'vrotik',title:'Вротик · На краю ветра',titleUk:'Вротік · На краю вітру',
    episode:'Эпизод 1 · Тестовая сцена',episodeUk:'Епізод 1 · Тестова сцена',entryId:'dialog-1',activeSceneId:'',clockVisible:false,
    quest:'На краю ветра',questUk:'На краю вітру',objective:'Поговорить с братом у обрыва',objectiveUk:'Поговорити з братом біля урвища',
    walkable:[[19,80],[22,60],[16,41],[20,31],[32,30],[40,35],[43,21],[47,7],[56,7],[60,19],[64,32],[67,53],[68,66],[62,80],[52,94],[47,99],[31,99],[34,86]],
    heroTokenId:'story-vrotik',speakers:{
      vrotik:{name:'Вротик',nameUk:'Вротік',portrait:portrait,position:'37% 35%',zoom:2},
      brother:{name:'Брат Вротика',nameUk:'Брат Вротіка',portrait:brother,position:'50% 18%',zoom:1.28}
    },
    interactions:{'story-brother':{entryId:'dialog-1',main:true,marker:'?'},'story-stone':{entryId:'dialog-stone',marker:'?'}},
    scene:{boardWidth:24,boardHeight:16,gridSize:64,grid:false,snap:false,zoom:1,x:0,y:0,
      layers:[{id:'story-mountain',name:'Горный край',nameUk:'Гірський край',image:'images/story/vrotik-mountain-v1.png',fit:'cover',locked:true}],
      tokens:[
        {id:'story-vrotik',type:'custom',name:'Вротик',nameUk:'Вротік',image:portrait,x:46,y:65,size:68,disposition:'hero',snap:false},
        {id:'story-brother',type:'custom',name:'Брат Вротика',nameUk:'Брат Вротіка',image:brother,x:53,y:43,size:68,disposition:'ally',snap:false},
        {id:'story-stone',type:'note',name:'След на камне',nameUk:'Слід на камені',x:49,y:45,size:32,hidden:true}
      ],regions:[],fogClouds:[]},
    nodes:[
      node('dialog-1','У обрыва','Біля урвища','brother','Слышишь? Здесь ветер говорит голосами тех, кто уже ушёл. Я всё пытаюсь узнать среди них наш дом.','Чуєш? Тут вітер говорить голосами тих, хто вже пішов. Я все намагаюся впізнати серед них наш дім.',70,70,[{id:'line-1',to:'dialog-2',label:'',delayMs:350}]),
      node('dialog-2','Знакомый голос','Знайомий голос','vrotik','«Держись ближе». Я повторяю его голос — тот самый, которым он звал меня с тропы много лет назад.','«Тримайся ближче». Я повторюю його голос — той самий, яким він кликав мене зі стежки багато років тому.',360,70,[{id:'line-2',to:'dialog-3',label:'',delayMs:250}]),
      node('dialog-3','Один выбор','Один вибір','brother','Я помню. Тогда ты послушался. А сейчас? Останемся здесь ещё на минуту или пойдём вниз вместе?','Я пам’ятаю. Тоді ти послухався. А зараз? Залишимося тут ще на хвилину чи підемо вниз разом?',650,70,[
        {id:'line-3',to:'dialog-stay',label:'Остаться рядом и послушать ветер',labelUk:'Залишитися поруч і послухати вітер',delayMs:450,effect:'stay'},
        {id:'line-4',to:'dialog-go',label:'Протянуть руку: пойдём вместе',labelUk:'Простягнути руку: ходімо разом',delayMs:450,effect:'together'}
      ]),
      node('dialog-stay','Ещё минута','Ще хвилина','brother','Хорошо. Иногда самое важное — никуда не спешить. Я запомню, что ты остался.','Гаразд. Іноді найважливіше — нікуди не поспішати. Я запам’ятаю, що ти залишився.',940,70,[]),
      node('dialog-go','Вместе','Разом','brother','Вместе. Только на этот раз первым пойдёшь ты. А я буду рядом.','Разом. Тільки цього разу першим підеш ти. А я буду поруч.',940,260,[]),
      node('dialog-stone','След на камне','Слід на камені','vrotik','Три старые царапины на камне. Когда-то мы считали, что такими отметками можно удержать дорогу домой.','Три старі подряпини на камені. Колись ми вважали, що такими позначками можна втримати дорогу додому.',70,290,[])
    ]
  };
})(window);
