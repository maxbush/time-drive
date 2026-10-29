// ============================================================================
// ALL VISITOR-FACING TEXT LIVES HERE (Russian for now; add `en` later and pick by
// language). Anything marked TODO is a placeholder waiting for real details.
// ============================================================================

export const OWNER = {
  name: 'Максим Бушенко',
  // TODO: уточнить роль одной строкой (показывается под именем в шапке и на загрузке)
  role: 'Разработка · Боты · Автоматизация',
};

// Contact destinations. Empty string = that option is simply not shown.
export const CONTACT = {
  telegramUser: 'ktoetopishet', // без @
  email: 'maxim.bushenko@gmail.com',
  // Free Web3Forms access key (https://web3forms.com, created with the email above).
  // When set, the form sends the request to that email; without it only the
  // Telegram / email buttons are shown.
  web3formsKey: '',
};

export type ProjectId = 'web' | 'albion' | 'tenders';

export interface ProjectContent {
  index: string; // "01"
  tag: string;
  title: string;
  lead: string; // one line under the title
  description: string;
  points: string[]; // what it does
  stack: string[];
  // Which side the stop card sits on: opposite the stand in the world (stands of 01/02 are
  // on the left of the avenue, 03 on the right), so the card never covers the stand.
  side: 'left' | 'right';
  demoSubject: string;
  cta: string; // label of the contact action ("Запросить демо" / "Обсудить ваш сайт")
  facts: [string, string][]; // three short, verifiable facts (label, value)
  note?: string; // small line under the lead
  sites?: SiteContent[]; // the website stop lists real sites in its side panel
  parts?: [string, string][]; // components of a software product (name, role)
  // Extra screenshots / media for the drawer (paths under /public). Empty = none.
  media: { src: string; caption: string }[];
}

// Sites shown in the side panel of stop 01: a small preview in the list (public/sites/<id>-1.webp),
// and a click opens the live site in a near-fullscreen window (an iframe).
export interface SiteContent {
  id: string;
  name: string;
  kind: string;
  domain: string;
  url: string;
  description: string;
  highlight?: string; // a feature worth pointing out (shown under the description)
    slides: string[];
}

export const SITES: SiteContent[] = [
  {
    id: 'albion',
    name: 'ALBION Consult',
    kind: 'Консалтинг · Оксфорд · SEO',
    domain: 'maxbush.github.io/albion-mockups',
    url: 'https://maxbush.github.io/albion-mockups/albion-v2/ru/',
    description:
      'Сайт консалтинговой компании из Оксфорда, собранный вместе с SEO-стратегией: маршрут поступления в пять этапов, разделы услуг, гайды, двуязычная структура и анкета консультации.',
    highlight: 'Параллакс в первом экране: слои акварели движутся с разной скоростью при прокрутке.',
    slides: ['./sites/albion-1.webp'], // the list preview; the site itself is shown live
  },
  {
    id: 'grodno',
    name: 'Гродно Апарт',
    kind: 'Посуточная аренда апартаментов',
    domain: 'maxbush.github.io/grodno-apart',
    url: 'https://maxbush.github.io/grodno-apart/',
    description:
      'Каталог дизайнерских апартаментов в центре Гродно: фотографии, описания, удобства и бронирование.',
    highlight: 'Фотографии подгружаются по мере прокрутки: первая загрузка меньше мегабайта.',
    slides: ['./sites/grodno-1.webp'], // the list preview; the site itself is shown live
  },
  {
    id: 'lune',
    name: 'LUNÉ Studio',
    kind: 'Креативная студия · Дубай',
    domain: 'maxbush.github.io/lune',
    url: 'https://maxbush.github.io/lune/',
    description:
      'Сайт продакшн-студии для luxury-брендов: услуги, кампании, студии и интерактивный калькулятор съёмки, где формат, длительность и уровень ретуши сразу дают ориентир по стоимости.',
    highlight: 'Калькулятор стоимости съёмки: выбор параметров пересчитывает пакет и цену.',
    slides: ['./sites/lune-1.webp'], // the list preview; the site itself is shown live
  },
  {
    id: 'eca',
    name: 'Евростройарсенал',
    kind: 'Корпоративный сайт · огнезащита и теплоизоляция',
    domain: 'eca.by',
    url: 'https://eca.by',
    description: 'Сайт компании: направления работ, стандарты и качество, сертификаты, контакты.',
    slides: ['./sites/eca-1.webp'], // the list preview; the site itself is shown live
  },
];

export const PROJECTS: Record<ProjectId, ProjectContent> = {
  web: {
    index: '01',
    tag: 'Сайты и SEO',
    title: 'Сайты',
    lead: 'Дизайн и разработка сайтов в одних руках: от макета до публикации.',
    note: 'Четыре последних проекта.',
    description:
      'Делаю сайты целиком: структура и дизайн, вёрстка, анимация, формы и калькуляторы, SEO и публикация.',
    points: [
      'Корпоративные сайты и лендинги',
      'Каталоги и сайты с бронированием',
      'Анимация и интерактив: параллакс, калькуляторы, 3D',
      'SEO: структура, семантика, тексты, техническая оптимизация',
      'Адаптация под телефон, быстрая загрузка, публикация',
    ],
    stack: ['Дизайн', 'Разработка', 'SEO'],
    side: 'right',
    demoSubject: 'Запрос: сайт',
    cta: 'Обсудить ваш сайт',
    facts: [
      ['Формат', 'под ключ'],
      ['Показано', '4 проекта'],
      ['Дизайн', 'авторский'],
    ],
    sites: SITES,
    media: [],
  },
  albion: {
    index: '02',
    tag: 'Автоматизация и бот',
    title: 'ALBION Bot',
    lead: 'Ассистент координатора репетиторской компании: забирает на себя рутину, которая раньше шла вручную через мессенджеры и таблицы.',
    description:
      'Бот подключён к расписанию MeritHub по API и общается с родителями, репетиторами и координатором в WhatsApp и Telegram. Если ученик не пришёл, родитель сразу получает сообщение с кнопкой «Всё в порядке», а при молчании бот сам поднимает вопрос у координатора. Новые заявки разбирает ИИ, отмены и переносы проходят по сценариям с уведомлением всех участников. События, очередь отложенных уведомлений и журнал хранятся в собственной базе данных.',
    points: [
      'Неявка ученика: сообщение родителю с кнопкой подтверждения, при молчании эскалация координатору',
      'Каналы: WhatsApp и Telegram',
      'Интеграция с расписанием MeritHub по API',
      'Заявки: ИИ извлекает из обращения предмет, уровень и цель',
      'Отмена и перенос занятий с уведомлением репетитора и координатора',
      'Роли и права: координатор, репетитор, родитель',
      'Собственная база: отложенные уведомления, журнал, очередь сбойных событий',
    ],
    parts: [
      ['MeritHub', 'расписание и занятия по API'],
      ['WhatsApp · Telegram', 'связь с родителями, репетиторами и координатором'],
      ['Собственная база', 'события, очередь уведомлений, журнал'],
      ['ИИ (LLM)', 'разбор заявок и обращений'],
      ['Сценарии', 'неявка, отмена, перенос, эскалация'],
      ['Надёжность', '229 автотестов, аварийный выключатель'],
    ],
    stack: ['Python', 'WhatsApp', 'Telegram', 'MeritHub API', 'SQLite', 'LLM'],
    side: 'right',
    demoSubject: 'Запрос демо: ALBION Bot',
    cta: 'Запросить демо',
    facts: [
      ['Интеграция', 'MeritHub'],
      ['Каналы', 'WhatsApp · Telegram'],
      ['База данных', 'собственная'],
    ],
    media: [],
  },
  tenders: {
    index: '03',
    tag: 'Аналитика госзакупок',
    title: 'Тендерная аналитика',
    lead: 'Система, которая собирает закупки Беларуси и превращает их в приоритетный список возможностей.',
    description:
      'Загружает закупки и планы закупок заказчиков из gias.by в собственную базу данных, находит релевантные позиции по кодам ОКРБ, оценивает участие конкурентов и считает приоритет каждой возможности. С результатом работают в веб-интерфейсе (дашборд на React поверх REST API), в Telegram-боте и в Excel-отчётах для руководителя.',
    points: [
      'Импорт закупок и планов закупок из gias.by в собственную базу',
      'Анализ собственного участия и конкурентов',
      'Релевантность позиций планов по кодам ОКРБ и ключевым словам',
      'Расчёт приоритета возможностей',
      'Веб-интерфейс: дашборд и REST API',
      'Telegram: профиль поиска и анализ плана заказчика по УНП',
      'Excel-отчёты: технический, управленческий, по возможностям',
    ],
    parts: [
      ['gias.by', 'закупки, планы и детали торгов'],
      ['Собственная база', 'SQLite: закупки, планы, заказчики'],
      ['Аналитика', 'ОКРБ, приоритет, конкуренты'],
      ['REST API', 'FastAPI между данными и интерфейсами'],
      ['Веб-интерфейс', 'дашборд на React'],
      ['Telegram', 'профиль поиска, планы заказчиков'],
      ['Excel', 'отчёты для руководителя'],
    ],
    stack: ['Python', 'FastAPI', 'SQLite', 'React', 'Telegram', 'Excel'],
    side: 'left',
    demoSubject: 'Запрос демо: тендерная аналитика',
    cta: 'Запросить демо',
    facts: [
      ['Источник', 'gias.by'],
      ['Интерфейсы', 'Web · Telegram · Excel'],
      ['База данных', 'собственная'],
    ],
    media: [],
  },
};
export const CHAPTERS: { id: string; label: string }[] = [
  { id: 'act1-web20', label: 'Прошлое' },
  { id: 'cluster1-web', label: 'Веб' },
  { id: 'cluster2-albion', label: 'Albion' },
  { id: 'cluster3-tenders', label: 'Тендеры' },
  { id: 'act3-space', label: 'Финал' },
];

// The jump through the gate is an effect, not a stop: while the car is in its zone the header and the
// bottom strip show the chapter it belongs to. The number keys 1-5 jump to the chapters in this order.
export const CHAPTER_OF_ZONE: Record<string, string> = { 'ribbed-gate': 'act1-web20' };


export const FINALE = {
  // EN (later): "Let's drive into future"
  slogan: 'Навстречу будущему',
  sub: 'Сайты, боты и автоматизация. Расскажите о задаче, обсудим и покажем демо.',
};

export const UI = {
  contact: 'Контакты',
  help: 'Управление',
  details: 'Подробнее',
  viewSites: 'Все сайты',
  partsTitle: 'Из чего состоит',
  moreAbout: 'Открыть',
  openSite: 'Открыть сайт',
  requestDemo: 'Запросить демо',
  next: 'Ехать дальше',
  simpleVersion: 'Версия без 3D',
  hintText: 'Тормозит или не хочется смотреть? Есть лёгкая версия без 3D: те же проекты и контакты, открывается мгновенно.',
  hintOpen: 'Открыть версию без 3D',
  close: 'Закрыть',
  restart: 'Заново',
  discuss: 'Обсудить проект',
  loadingTitle: 'Загружаем путешествие',
  stageCar: 'Загружаем машину',
  stageWarm: 'Готовим сцену',
  rotateTitle: 'Поверните телефон',
  rotateText: 'Путешествие лучше всего смотреть в горизонтальном положении: быстрее и виден весь проспект.',
  rotateContinue: 'Продолжить в вертикальном режиме',
  formName: 'Имя',
  formContact: 'Как с вами связаться (Telegram, WhatsApp, почта)',
  formMessage: 'Расскажите о задаче',
  formSend: 'Отправить',
  formSending: 'Отправляем…',
  formSent: 'Заявка отправлена',
  formSentText: 'Спасибо! Отвечу в ближайшее время.',
  formError: 'Не удалось отправить. Напишите напрямую в Telegram или на почту.',
  formUnconfigured: 'Форма готова, но отправка ещё не подключена (нужен ключ формы).',
  writeTelegram: 'Написать в Telegram',
  writeEmail: 'Написать на почту',
  helpItems: [
    ['Пробел', 'пауза и «ехать дальше»'],
    ['W / S', 'ручное управление'],
    ['Колесо мыши', 'приблизить и отдалить'],
    ['Перетаскивание', 'осмотреться'],
    ['H', 'скрыть интерфейс'],
  ] as [string, string][],
  helpTouch: 'Перетаскивайте, чтобы осмотреться. Остановки и переходы идут сами.',
};
