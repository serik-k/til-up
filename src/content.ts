export type Locale = 'ru' | 'kz';
export type SoundKey = 'L' | 'R' | 'SH';

export type SoundCard = {
  letter: string;
  stretch: string;
  name: string;
  image?: string;
  emoji?: string;
  color: string;
  softColor: string;
  tongueTip: string;
};

export const APP_COPY = {
  ru: {
    brandHint: 'играем со звуками',
    homeAria: 'Til Up — на начало страницы',
    eyebrow: 'Детская логопедическая игра',
    heroLine: 'Говори, играй,',
    heroAccent: 'улыбайся!',
    heroText:
      'Тренируем произношение звуков Л, Р и Ш по картинкам. Выбери звук, посмотри на картинку и назови её.',
    start: 'Начать игру',
    stepsAria: 'Как играть',
    steps: ['Выбери звук', 'Назови картинку', 'Собери звёзды'],
    mascotAria: 'Весёлый помощник Til Up',
    exerciseEyebrow: 'Короткое упражнение',
    exerciseTitle: 'Какой звук потренируем?',
    exerciseText: 'Выбирай сам. Здесь можно ошибаться и пробовать ещё раз.',
    footer: 'помогает тренироваться играючи.',
    disclaimer: 'Игра не заменяет занятие со специалистом.',
  },
  kz: {
    brandHint: 'дыбыстармен ойнаймыз',
    homeAria: 'Til Up — беттің басына оралу',
    eyebrow: 'Балаларға арналған логопедиялық ойын',
    heroLine: 'Сөйле, ойна,',
    heroAccent: 'күлімде!',
    heroText:
      'Л, Р және Ш дыбыстарын суреттер арқылы жаттықтырамыз. Дыбысты таңда, суретке қарап, атауын айт.',
    start: 'Ойынды бастау',
    stepsAria: 'Қалай ойнау керек',
    steps: ['Дыбысты таңда', 'Суретті ата', 'Жұлдыз жина'],
    mascotAria: 'Til Up көңілді көмекшісі',
    exerciseEyebrow: 'Қысқа жаттығу',
    exerciseTitle: 'Қай дыбысты жаттықтырамыз?',
    exerciseText: 'Өзің таңда. Мұнда қателесуге және қайта көруге болады.',
    footer: 'ойын арқылы жаттығуға көмектеседі.',
    disclaimer: 'Ойын маманмен өткізілетін сабақты алмастырмайды.',
  },
} as const;

export const SEO_COPY = {
  ru: {
    title: 'Логопедическая игра для детей — звуки Л, Р и Ш | Til Up',
    description:
      'Бесплатная детская логопедическая игра: тренируем произношение звуков Л, Р и Ш по картинкам. Короткие упражнения без таймера и оценок.',
  },
  kz: {
    title: 'Балаларға арналған логопедиялық ойын — Л, Р және Ш | Til Up',
    description:
      'Балаларға арналған тегін логопедиялық ойын: Л, Р және Ш дыбыстарын суреттер арқылы жаттықтыру. Қысқа әрі түсінікті жаттығулар.',
  },
} as const;

export const GAME_COPY = {
  ru: {
    soundPicker: 'Выбор звука',
    trainSound: 'Тренируем звук',
    chooseSound: 'Тренировать звук',
    starsAria: 'Собрано звёзд',
    tongueHint: 'Подсказка язычку',
    ready: 'Потренируем звук',
    namePicture: 'Назови картинку',
    complete: 'Упражнение готово!',
    heard: 'Я услышал! Здорово!',
    repeat: 'Отличный повтор!',
    listen: 'Послушать пример',
    micUnsupported: 'Микрофон не поддерживается — нажимай на картинку',
    micListening: 'Я слушаю тебя',
    micStarting: 'Включаю микрофон…',
    micError: 'Не слышу — можно нажать на картинку',
    micPermission: 'Разреши доступ к микрофону или играй нажатием',
    micNoDevice: 'Микрофон не найден — играй нажатием',
    micNetwork: 'Распознавание временно недоступно — играй нажатием',
    micBrowser: 'Открой игру в Chrome или Safari либо играй нажатием',
    micIdle: 'Микрофон включится после старта',
    finishTitle: 'Ты молодец!',
    finishText: 'Все пять звёзд собраны',
    again: 'Сыграть ещё',
    start: 'Начать упражнение',
    tapHint: 'Не получилось голосом? Нажми на картинку',
    noteStrong: 'Главное — повторять.',
    note: 'Игра слышит название картинки, но не ставит оценок произношению.',
    pictureAria: 'Картинка',
    pictureAction: 'Произнеси название или нажми.',
    selected: 'Выбран звук',
    sayPicture: 'Назови картинку',
    earned: 'Получена звезда',
    allEarned: 'Все звёзды собраны!',
    onceMore: 'Ещё раз',
    statsTitle: 'Для родителей',
    statsSessions: 'Завершено упражнений',
    statsWords: 'Повторено слов',
    statsReset: 'Сбросить статистику',
  },
  kz: {
    soundPicker: 'Дыбысты таңдау',
    trainSound: 'Дыбысты жаттықтырамыз',
    chooseSound: 'Дыбысты жаттықтыру',
    starsAria: 'Жиналған жұлдыздар',
    tongueHint: 'Тілге арналған кеңес',
    ready: 'Дыбысты жаттықтырамыз',
    namePicture: 'Суретті ата',
    complete: 'Жаттығу аяқталды!',
    heard: 'Естідім! Керемет!',
    repeat: 'Өте жақсы қайталадың!',
    listen: 'Үлгіні тыңдау',
    micUnsupported: 'Микрофон қолдау таппайды — суретті бас',
    micListening: 'Мен сені тыңдап тұрмын',
    micStarting: 'Микрофонды қосып жатырмын…',
    micError: 'Естілмеді — суретті басуға болады',
    micPermission: 'Микрофонға рұқсат бер немесе суретті басып ойна',
    micNoDevice: 'Микрофон табылмады — суретті басып ойна',
    micNetwork: 'Дыбысты тану уақытша қолжетімсіз — суретті бас',
    micBrowser: 'Ойынды Chrome не Safari-де аш немесе суретті бас',
    micIdle: 'Микрофон басталғанда қосылады',
    finishTitle: 'Жарайсың!',
    finishText: 'Бес жұлдыздың бәрі жиналды',
    again: 'Тағы ойнау',
    start: 'Жаттығуды бастау',
    tapHint: 'Дауыспен болмады ма? Суретті бас',
    noteStrong: 'Ең бастысы — қайталау.',
    note: 'Ойын суреттің атауын естиді, бірақ айтылуына баға қоймайды.',
    pictureAria: 'Сурет',
    pictureAction: 'Атауын айт немесе суретті бас.',
    selected: 'Таңдалған дыбыс',
    sayPicture: 'Суретті ата',
    earned: 'Жұлдыз алынды',
    allEarned: 'Барлық жұлдыз жиналды!',
    onceMore: 'Тағы бір рет',
    statsTitle: 'Ата-аналарға',
    statsSessions: 'Аяқталған жаттығулар',
    statsWords: 'Қайталанған сөздер',
    statsReset: 'Статистиканы өшіру',
  },
} as const;

const shared = {
  L: { letter: 'Л', stretch: 'Л-Л-Л', color: '#ff9d58', softColor: '#fff0d9' },
  R: { letter: 'Р', stretch: 'Р-Р-Р', color: '#4aaee8', softColor: '#e1f4ff' },
  SH: { letter: 'Ш', stretch: 'Ш-Ш-Ш', color: '#f05f91', softColor: '#ffe3ee' },
};

export const CARD_SETS: Record<Locale, Record<SoundKey, SoundCard[]>> = {
  ru: {
    L: [
      { ...shared.L, name: 'лев', image: '/images/speech-cards/lion.png', tongueTip: 'Кончик языка подними к верхним зубкам.' },
      { ...shared.L, name: 'лампа', emoji: '💡', tongueTip: 'Кончик языка подними к верхним зубкам.' },
      { ...shared.L, name: 'ложка', emoji: '🥄', tongueTip: 'Кончик языка подними к верхним зубкам.' },
    ],
    R: [
      { ...shared.R, name: 'ракета', image: '/images/speech-cards/rocket.png', tongueTip: 'Улыбнись и дай язычку легко задрожать.' },
      { ...shared.R, name: 'рыба', emoji: '🐟', tongueTip: 'Улыбнись и дай язычку легко задрожать.' },
      { ...shared.R, name: 'робот', emoji: '🤖', tongueTip: 'Улыбнись и дай язычку легко задрожать.' },
    ],
    SH: [
      { ...shared.SH, name: 'шар', image: '/images/speech-cards/balloon.png', tongueTip: 'Губы округли, язык сделай широкой чашечкой.' },
      { ...shared.SH, name: 'шапка', emoji: '🎩', tongueTip: 'Губы округли, язык сделай широкой чашечкой.' },
      { ...shared.SH, name: 'машина', emoji: '🚗', tongueTip: 'Губы округли, язык сделай широкой чашечкой.' },
    ],
  },
  kz: {
    L: [
      { ...shared.L, name: 'лақ', image: '/images/speech-cards/goat-kz.png', tongueTip: 'Тілдің ұшын жоғарғы тістерге жақындат.' },
      { ...shared.L, name: 'гүл', emoji: '🌷', tongueTip: 'Тілдің ұшын жоғарғы тістерге жақындат.' },
      { ...shared.L, name: 'бала', emoji: '🧒', tongueTip: 'Тілдің ұшын жоғарғы тістерге жақындат.' },
    ],
    R: [
      { ...shared.R, name: 'ара', image: '/images/speech-cards/bee-kz.png', tongueTip: 'Жымиып, тілдің ұшын жеңіл дірілдет.' },
      { ...shared.R, name: 'арба', emoji: '🛒', tongueTip: 'Жымиып, тілдің ұшын жеңіл дірілдет.' },
      { ...shared.R, name: 'қорап', emoji: '📦', tongueTip: 'Жымиып, тілдің ұшын жеңіл дірілдет.' },
    ],
    SH: [
      { ...shared.SH, name: 'шар', image: '/images/speech-cards/balloon.png', tongueTip: 'Ерінді дөңгелетіп, тілді кең ұста.' },
      { ...shared.SH, name: 'шаш', emoji: '💇', tongueTip: 'Ерінді дөңгелетіп, тілді кең ұста.' },
      { ...shared.SH, name: 'шана', emoji: '🛷', tongueTip: 'Ерінді дөңгелетіп, тілді кең ұста.' },
    ],
  },
};
