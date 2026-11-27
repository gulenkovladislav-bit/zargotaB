/* Campaign people available in GM storage. */
window.ZargotaCampaignSeeds=[
  {
    "key": "person:ebg-pluviy",
    "_special": "person",
    "ability": {
      "name": "Плувий Бекряш",
      "nameUk": "Плувій Бекряш",
      "relation": "Трактирщик",
      "relationUk": "Шинкар",
      "lastKnownPlace": "Таверна «Сладкий Кайф»",
      "lastKnownPlaceUk": "Таверна «Солодкий Кайф»",
      "description": "Хозяин таверны «Сладкий Кайф».",
      "descriptionUk": "Господар таверни «Солодкий Кайф».",
      "iconAsset": "images/npcs/ebg-oil/pluviy.webp"
    },
    "label": "Плувий Бекряш",
    "labelUk": "Плувій Бекряш",
    "description": "Хозяин таверны «Сладкий Кайф».",
    "descriptionUk": "Господар таверни «Солодкий Кайф».",
    "iconPath": "images/npcs/ebg-oil/pluviy.webp",
    "gmProfile": {
      "stats": {
        "age": 43
      },
      "traits": [
        {
          "name": "Слухи за кружкой",
          "nameUk": "Чутки за кухлем",
          "text": "Знает разговоры гостей. Может поделиться слухом за выпивку или монету.",
          "textUk": "Знає розмови гостей. Може поділитися чуткою за випивку або монету."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/pluviy-miro.webp",
      "images/npcs/pluviy-berkyash.jpg"
    ]
  },
  {
    "key": "person:ebg-furiy",
    "_special": "person",
    "ability": {
      "name": "Фурий Лукавый",
      "nameUk": "Фурій Лукавий",
      "relation": "Торговец и зельевар",
      "relationUk": "Торговець і зіллєвар",
      "lastKnownPlace": "Лавка Лукавого",
      "lastKnownPlaceUk": "Крамниця Лукавого",
      "description": "Держит собственную лавку в деревне.",
      "descriptionUk": "Тримає власну крамницю в селі.",
      "iconAsset": "images/npcs/ebg-oil/furiy.webp"
    },
    "label": "Фурий Лукавый",
    "labelUk": "Фурій Лукавий",
    "description": "Держит собственную лавку в деревне.",
    "descriptionUk": "Тримає власну крамницю в селі.",
    "iconPath": "images/npcs/ebg-oil/furiy.webp",
    "gmProfile": {
      "stats": {
        "hp": 14,
        "armor": 1,
        "initiative": "+2",
        "age": "≈40"
      },
      "traits": [
        {
          "name": "Ядовитая игла",
          "nameUk": "Отруйна голка",
          "text": "1d6 урона. При попадании возможен яд, сложность 13.",
          "textUk": "1d6 шкоди. У разі влучання можливе отруєння, складність 13."
        },
        {
          "name": "Мятный дым",
          "nameUk": "М’ятний дим",
          "text": "Один раз за схватку бросает порошок. При провале проверки воли сложности 13 враг получает −1 к атаке на один ход.",
          "textUk": "Раз за сутичку кидає порошок. Якщо ворог провалить перевірку волі зі складністю 13, отримає −1 до атаки на один хід."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/furiy-miro.webp",
      "images/npcs/lukaviy.jpg"
    ]
  },
  {
    "key": "person:ebg-morgan",
    "_special": "person",
    "ability": {
      "name": "Морган Дребень",
      "nameUk": "Морган Дребень",
      "relation": "Старший страж",
      "relationUk": "Старший вартовий",
      "lastKnownPlace": "Дом Старшего Дозорного",
      "lastKnownPlaceUk": "Дім Старшого Дозорного",
      "description": "Следит за порядком в деревне.",
      "descriptionUk": "Стежить за порядком у селі.",
      "iconAsset": "images/npcs/ebg-oil/morgan.webp"
    },
    "label": "Морган Дребень",
    "labelUk": "Морган Дребень",
    "description": "Следит за порядком в деревне.",
    "descriptionUk": "Стежить за порядком у селі.",
    "iconPath": "images/npcs/ebg-oil/morgan.webp",
    "gmProfile": {
      "stats": {
        "hp": 15,
        "armor": 13,
        "str": 3,
        "dex": -1,
        "con": 2,
        "int": 0,
        "per": 1,
        "cha": -2
      },
      "traits": [
        {
          "name": "Голос мракобеса",
          "nameUk": "Голос мракобіса",
          "text": "Раз за бой. Враги с харизмой 0 или ниже совершают спасбросок сложности 12. При провале получают −1 к атаке и действиям на ход.",
          "textUk": "Раз за бій. Вороги з харизмою 0 або нижчою роблять ряткидок зі складністю 12. У разі провалу отримують −1 до атаки й дій на хід."
        },
        {
          "name": "Закон — я!",
          "nameUk": "Закон — я!",
          "text": "Пока страж жив, стражники в пределах трёх клеток получают +1 к урону.",
          "textUk": "Поки вартовий живий, вартові в межах трьох клітинок отримують +1 до шкоди."
        },
        {
          "name": "Живым или в кашу",
          "nameUk": "Живим або в кашу",
          "text": "Раз за короткий отдых атакует цель дважды с помехой. Два попадания — оглушение на ход, спасбросок телосложения сложности 12.",
          "textUk": "Раз за короткий відпочинок двічі атакує ціль з перешкодою. Два влучання — оглушення на хід, ряткидок статури зі складністю 12."
        },
        {
          "name": "Алебарда «Гниломёт»",
          "nameUk": "Алебарда «Гниломет»",
          "text": "Урон 1d10 + 3, дальность 2 клетки. При критическом попадании цель теряет ход.",
          "textUk": "Шкода 1d10 + 3, дальність 2 клітинки. У разі критичного влучання ціль пропускає хід."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/morgan-dreben.jpg"
    ]
  },
  {
    "key": "person:ebg-khariton",
    "_special": "person",
    "ability": {
      "name": "Харитон Твердомысл Корнекорень",
      "nameUk": "Харитон Твердомисл Коренекорінь",
      "relation": "Старейшина, хранитель храма",
      "relationUk": "Старійшина, хранитель храму",
      "lastKnownPlace": "Дом Старосты / Безымянный Храм",
      "lastKnownPlaceUk": "Дім Старости / Безіменний Храм",
      "description": "Хранитель деревенской памяти и храма.",
      "descriptionUk": "Хранитель сільської пам’яті та храму.",
      "iconAsset": "images/npcs/ebg-oil/khariton.webp"
    },
    "label": "Харитон Твердомысл Корнекорень",
    "labelUk": "Харитон Твердомисл Коренекорінь",
    "description": "Хранитель деревенской памяти и храма.",
    "descriptionUk": "Хранитель сільської пам’яті та храму.",
    "iconPath": "images/npcs/ebg-oil/khariton.webp",
    "gmProfile": {
      "stats": {
        "age": 72
      },
      "traits": [
        {
          "name": "Деревенская память",
          "nameUk": "Сільська пам’ять",
          "text": "Говорит резко, помнит давние события и не терпит пустых обещаний.",
          "textUk": "Говорить різко, пам’ятає давні події й не терпить порожніх обіцянок."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/khariton-miro.webp",
      "images/npcs/khariton-tverdomysl.jpg"
    ]
  },
  {
    "key": "person:ebg-saveliy",
    "_special": "person",
    "ability": {
      "name": "Савелий",
      "nameUk": "Савелій",
      "relation": "Спутник отряда",
      "relationUk": "Супутник загону",
      "lastKnownPlace": "",
      "lastKnownPlaceUk": "",
      "description": "Житель деревни, присоединившийся к героям.",
      "descriptionUk": "Мешканець села, який приєднався до героїв.",
      "iconAsset": "images/npcs/ebg-oil/saveliy.webp"
    },
    "label": "Савелий",
    "labelUk": "Савелій",
    "description": "Житель деревни, присоединившийся к героям.",
    "descriptionUk": "Мешканець села, який приєднався до героїв.",
    "iconPath": "images/npcs/ebg-oil/saveliy.webp",
    "gmProfile": {
      "stats": {
        "initiative": "+0"
      },
      "traits": [
        {
          "name": "Непрошеный помощник",
          "nameUk": "Непроханий помічник",
          "text": "Сам ищет приключений. Носит самодельную удочку с крючком из подковы.",
          "textUk": "Сам шукає пригод. Носить саморобну вудку з гачком із підкови."
        },
        {
          "name": "Невосприимчивость",
          "nameUk": "Несприйнятливість",
          "text": "В необязательном правиле мастера Савелий невосприимчив к страху, очарованию и контролю разума. К спасброску от уныния добавляет +2.",
          "textUk": "За необов’язковим правилом майстра Савелій несприйнятливий до страху, зачарування й контролю розуму. До ряткидка від зневіри додає +2."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/saveliy.jpg"
    ]
  },
  {
    "key": "person:ebg-trakeld",
    "_special": "person",
    "ability": {
      "name": "Тракельд",
      "nameUk": "Тракельд",
      "relation": "Хозяин дома",
      "relationUk": "Господар дому",
      "lastKnownPlace": "Ебатьэтогденск",
      "lastKnownPlaceUk": "Ебатьєтогденськ",
      "description": "Путники ночевали на чердаке его дома.",
      "descriptionUk": "Подорожні ночували на горищі його дому.",
      "iconAsset": "images/npcs/ebg-oil/trakeld.webp"
    },
    "label": "Тракельд",
    "labelUk": "Тракельд",
    "description": "Путники ночевали на чердаке его дома.",
    "descriptionUk": "Подорожні ночували на горищі його дому.",
    "iconPath": "images/npcs/ebg-oil/trakeld.webp",
    "gmProfile": {
      "stats": {
        "age": "≈53"
      },
      "traits": [
        {
          "name": "Бывший торговец зерном",
          "nameUk": "Колишній торговець зерном",
          "text": "Полурослик. Ходит босиком, в кармане носит связку гвоздей.",
          "textUk": "Напіврослик. Ходить босоніж, у кишені носить в’язку цвяхів."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/trakeld-miro.webp",
      "images/npcs/trakeld.jpg"
    ]
  },
  {
    "key": "person:ebg-gregor",
    "_special": "person",
    "ability": {
      "name": "Грегор",
      "nameUk": "Грегор",
      "relation": "Травник",
      "relationUk": "Травник",
      "lastKnownPlace": "Ебатьэтогденск",
      "lastKnownPlaceUk": "Ебатьєтогденськ",
      "description": "Деревенский травник. Продаёт средство от крысиного булька.",
      "descriptionUk": "Сільський травник. Продає засіб від щурячого булька.",
      "iconAsset": "images/npcs/ebg-oil/gregor.webp"
    },
    "label": "Грегор",
    "labelUk": "Грегор",
    "description": "Деревенский травник. Продаёт средство от крысиного булька.",
    "descriptionUk": "Сільський травник. Продає засіб від щурячого булька.",
    "iconPath": "images/npcs/ebg-oil/gregor.webp",
    "gmProfile": {
      "stats": {
        "hp": 10,
        "armor": 10
      },
      "traits": [
        {
          "name": "Нервная речь",
          "nameUk": "Нервова мова",
          "text": "Говорит быстро, сбивается и оправдывается. Особенно боится волков.",
          "textUk": "Говорить швидко, збивається й виправдовується. Особливо боїться вовків."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/gregor-miro.webp",
      ""
    ]
  },
  {
    "key": "person:ebg-marta",
    "_special": "person",
    "ability": {
      "name": "Марта-Шестёрка",
      "nameUk": "Марта-Шістка",
      "relation": "Игрок в покер",
      "relationUk": "Гравчиня в покер",
      "lastKnownPlace": "Таверна «Сладкий Кайф»",
      "lastKnownPlaceUk": "Таверна «Солодкий Кайф»",
      "description": "Играет в карты в «Сладком Кайфе».",
      "descriptionUk": "Грає в карти в «Солодкому Кайфі».",
      "iconAsset": "images/npcs/ebg-oil/marta.webp"
    },
    "label": "Марта-Шестёрка",
    "labelUk": "Марта-Шістка",
    "description": "Играет в карты в «Сладком Кайфе».",
    "descriptionUk": "Грає в карти в «Солодкому Кайфі».",
    "iconPath": "images/npcs/ebg-oil/marta.webp",
    "gmProfile": {
      "stats": {},
      "traits": [
        {
          "name": "Шулерство",
          "nameUk": "Шахрайство за картами",
          "text": "Еван заметил обман, когда Марта выложила выигрыш за покерным столом.",
          "textUk": "Єван помітив обман, коли Марта виклала виграш за покерним столом."
        }
      ]
    },
    "previousPortraits": [
      "images/npcs/marta-poker.webp",
      ""
    ]
  },
  {
    "key": "person:ebg-riks",
    "_special": "person",
    "ability": {
      "name": "Рикс Кривой Палец",
      "nameUk": "Рикс Кривий Палець",
      "relation": "Игрок в покер",
      "relationUk": "Гравець у покер",
      "lastKnownPlace": "Таверна «Сладкий Кайф»",
      "lastKnownPlaceUk": "Таверна «Солодкий Кайф»",
      "description": "Один из игроков за столом в таверне.",
      "descriptionUk": "Один із гравців за столом у таверні.",
      "iconAsset": "images/npcs/ebg-oil/riks.webp"
    },
    "label": "Рикс Кривой Палец",
    "labelUk": "Рикс Кривий Палець",
    "description": "Один из игроков за столом в таверне.",
    "descriptionUk": "Один із гравців за столом у таверні.",
    "iconPath": "images/npcs/ebg-oil/riks.webp",
    "gmProfile": {
      "note": "Играл с Еваном. Во время потасовки дрался с Морганом.",
      "noteUk": "Грав із Єваном. Під час бійки зчепився з Морганом."
    },
    "previousPortraits": [
      "images/npcs/riks-poker.webp",
      ""
    ]
  },
  {
    "key": "person:ebg-poker-elder",
    "_special": "person",
    "ability": {
      "name": "Старик за карточным столом",
      "nameUk": "Старий за картярським столом",
      "relation": "Игрок в покер",
      "relationUk": "Гравець у покер",
      "lastKnownPlace": "Таверна «Сладкий Кайф»",
      "lastKnownPlaceUk": "Таверна «Солодкий Кайф»",
      "description": "Играл с Еваном, Мартой и Риксом в «Сладком Кайфе».",
      "descriptionUk": "Грав із Єваном, Мартою та Риксом у «Солодкому Кайфі».",
      "iconAsset": "images/npcs/ebg-oil/elder.webp"
    },
    "label": "Старик за карточным столом",
    "labelUk": "Старий за картярським столом",
    "description": "Играл с Еваном, Мартой и Риксом в «Сладком Кайфе».",
    "descriptionUk": "Грав із Єваном, Мартою та Риксом у «Солодкому Кайфі».",
    "iconPath": "images/npcs/ebg-oil/elder.webp",
    "gmProfile": {
      "note": "Умер на следующий день после игры в таверне.",
      "noteUk": "Помер наступного дня після гри в таверні."
    }
  },
  {
    "key": "person:ebg-boy",
    "_special": "person",
    "ability": {
      "name": "Мальчик у повозки",
      "nameUk": "Хлопчик біля воза",
      "relation": "Курьер",
      "relationUk": "Кур’єр",
      "lastKnownPlace": "Ебатьэтогденск",
      "lastKnownPlaceUk": "Ебатьєтогденськ",
      "description": "Мальчик, которого видели у разбитой повозки.",
      "descriptionUk": "Хлопчик, якого бачили біля розбитого воза.",
      "iconAsset": "images/npcs/ebg-oil/boy.webp"
    },
    "label": "Мальчик у повозки",
    "labelUk": "Хлопчик біля воза",
    "description": "Мальчик, которого видели у разбитой повозки.",
    "descriptionUk": "Хлопчик, якого бачили біля розбитого воза.",
    "iconPath": "images/npcs/ebg-oil/boy.webp",
    "gmProfile": {
      "note": "Мелисса выследила его за таверной. Он должен был передать постояльцу второго этажа сведения о шкатулке.",
      "noteUk": "Мелісса вистежила його за таверною. Він мав передати постояльцю другого поверху відомості про скриньку."
    },
    "previousPortraits": [
      "images/npcs/wagon-boy.jpg"
    ]
  },
  {
    "key": "person:ebg-courier",
    "_special": "person",
    "ability": {
      "name": "Гонец барона",
      "nameUk": "Гінець барона",
      "relation": "Гонец почтовой службы",
      "relationUk": "Гінець поштової служби",
      "lastKnownPlace": "Тракт у моста",
      "lastKnownPlaceUk": "Тракт біля мосту",
      "description": "Вёз письмо барона в Морелесье.",
      "descriptionUk": "Віз лист барона до Морелісся.",
      "iconAsset": "images/npcs/ebg-oil/courier.webp"
    },
    "label": "Гонец барона",
    "labelUk": "Гінець барона",
    "description": "Вёз письмо барона в Морелесье.",
    "descriptionUk": "Віз лист барона до Морелісся.",
    "iconPath": "images/npcs/ebg-oil/courier.webp",
    "gmProfile": {
      "note": "Мелисса и Лин’Ин нашли его у моста. Отряд прочитал письмо барона Берегозору о торговых ограничениях.",
      "noteUk": "Мелісса й Лін’Ін знайшли його біля мосту. Загін прочитав лист барона до Берегозора про торговельні обмеження."
    },
    "previousPortraits": [
      "images/npcs/courier.jpg"
    ]
  }
];
