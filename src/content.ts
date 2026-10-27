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
  telegramUser: '', // TODO: ник в Telegram без @ (например "maxbush")
  email: '', // TODO: почта для заявок
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
  cta: string; // label of the contact action ("Запросить демо" / "Обсудить такой сайт")
  facts: [string, string][]; // three short, verifiable facts (label, value)
  note?: string; // small line under the lead
  sites?: SiteContent[]; // the website stop shows real sites on its stand
  // Extra screenshots / media for the drawer (paths under /public). Empty = none.
  media: { src: string; caption: string }[];
}

// Real client sites shown on the stand of stop 01. Slides are viewport screenshots
// (public/sites/<id>-1..4.webp): they scroll slowly inside a "browser" on the stand.
export interface SiteContent {
  id: string;
  name: string;
  kind: string;
  domain: string; // shown in the stand's fake address bar
  url: string;
  description: string;
  slides: string[];
}

export const SITES: SiteContent[] = [
  {
    id: 'albion',
    name: 'ALBION Consult',
    kind: 'Образовательная консультация · Оксфорд',
    domain: 'maxbush.github.io/albion-mockups',
    url: 'https://maxbush.github.io/albion-mockups/green/',
    description:
      'Сайт-история для консалтинговой компании: маршрут семьи через британское образование в пять этапов, журнал, гайды и форма консультации.',
    slides: [1, 2, 3, 4].map((n) => `./sites/albion-${n}.webp`),
  },
  {
    id: 'grodno',
    name: 'Гродно Апарт',
    kind: 'Посуточная аренда апартаментов',
    domain: 'maxbush.github.io/grodno-apart',
    url: 'https://maxbush.github.io/grodno-apart/',
    description:
      'Каталог дизайнерских апартаментов в центре Гродно: фотографии, описания, удобства и бронирование.',
    slides: [1, 2, 3, 4].map((n) => `./sites/grodno-${n}.webp`),
  },
  {
    id: 'eca',
    name: 'Евростройарсенал',
    kind: 'Корпоративный сайт · огнезащита и теплоизоляция',
    domain: 'eca.by',
    url: 'https://eca.by',
    description:
      'Сайт компании: направления работ, стандарты и качество, сертификаты, контакты.',
    slides: [1, 2, 3, 4].map((n) => `./sites/eca-${n}.webp`),
  },
];

export const PROJECTS: Record<ProjectId, ProjectContent> = {
  web: {
    index: '01',
    tag: 'Сайты',
    title: 'Последние сайты',
    lead: 'Сайты для клиентов: свой дизайн, быстрая загрузка, аккуратная анимация.',
    note: 'Показаны последние проекты, не все.',
    description:
      'Проектирую и разрабатываю сайты от идеи до запуска: собственный дизайн без шаблонов, быстрая загрузка, аккуратная анимация и адаптация под телефон. Ниже три последних проекта, их можно открыть вживую.',
    points: [
      'Корпоративные сайты и лендинги',
      'Каталоги и сайты с бронированием',
      'Интерактивные страницы на WebGL',
      'Дизайн и разработка в одних руках',
    ],
    stack: ['Next.js', 'TypeScript', 'React', 'Tailwind CSS', 'Three.js'],
    side: 'right',
    demoSubject: 'Запрос: сайт',
    cta: 'Обсудить такой сайт',
    facts: [
      ['Формат', 'под ключ'],
      ['Показано', '3 последних'],
      ['Дизайн', 'авторский'],
    ],
    sites: SITES,
    media: [],
  },
  albion: {
    index: '02',
    tag: 'Автоматизация и бот',
    title: 'ALBION Bot',
    lead: 'Ассистент координатора репетиторских занятий.',
    note: 'Сейчас уведомления идут через Telegram, WhatsApp — следующий этап.',
    description:
      'Автоматизирует рутину координатора репетиторской компании. Если ученик не пришёл, родитель получает сообщение с кнопкой «Всё в порядке», а при молчании бот сам сообщает координатору. Принимает заявки и разбирает их с помощью ИИ, помогает с отменой и переносом занятий. Интегрирован с платформой MeritHub.',
    points: [
      'Неявка ученика: родителю уходит сообщение с кнопкой подтверждения, при молчании эскалация координатору',
      'Заявки: ИИ извлекает данные из обращения',
      'Отмена и перенос занятий с уведомлением репетитора и координатора',
      'Роли: координатор, репетитор, родитель',
      'Надёжность: отложенные уведомления хранятся в базе, очередь сбойных событий, аварийный выключатель',
    ],
    stack: ['Python', 'Telegram', 'MeritHub API', 'SQLite', 'LLM'],
    side: 'right',
    demoSubject: 'Запрос демо: ALBION Bot',
    cta: 'Запросить демо',
    facts: [
      ['Интеграция', 'MeritHub'],
      ['Канал', 'Telegram'],
      ['Автотесты', '229'],
    ],
    media: [],
  },
  tenders: {
    index: '03',
    tag: 'Тендеры и аналитика',
    title: 'Тендерный бот',
    lead: 'Аналитика госзакупок: тендеры, конкуренты, планы заказчиков.',
    description:
      'Система для работы с государственными закупками Беларуси. Загружает закупки и планы закупок из gias.by, складывает их в базу, находит релевантные позиции по кодам ОКРБ и считает приоритет возможностей. Результат: отчёты в Excel для руководителя, REST API с веб-дашбордом и Telegram-бот.',
    points: [
      'Импорт закупок и планов закупок заказчиков из gias.by',
      'Анализ собственного участия и конкурентов',
      'Фильтрация планов госзакупок по релевантности (коды ОКРБ)',
      'Приоритет возможностей и отчёты в Excel',
      'Telegram-бот: профиль поиска и анализ плана заказчика по УНП',
    ],
    stack: ['Python', 'FastAPI', 'SQLite', 'React', 'Telegram'],
    side: 'left',
    demoSubject: 'Запрос демо: тендерный бот',
    cta: 'Запросить демо',
    facts: [
      ['Источник', 'gias.by'],
      ['Результат', 'Excel · API · бот'],
      ['Анализ', 'ОКРБ и приоритет'],
    ],
    media: [],
  },
};

export const CHAPTERS: { id: string; label: string }[] = [
  { id: 'act1-web20', label: 'Прошлое' },
  { id: 'ribbed-gate', label: 'Прыжок' },
  { id: 'cluster1-web', label: 'Веб' },
  { id: 'cluster2-albion', label: 'Albion' },
  { id: 'cluster3-tenders', label: 'Тендеры' },
  { id: 'act3-space', label: 'Космос' },
];

export const FINALE = {
  // TODO: слоган обсуждаем
  slogan: 'Погнали со мной в будущее',
  sub: 'Сайты, боты и автоматизация. Расскажите о задаче, обсудим и покажем демо.',
};

export const UI = {
  contact: 'Контакты',
  help: 'Управление',
  details: 'Подробнее',
  openSite: 'Открыть сайт',
  requestDemo: 'Запросить демо',
  next: 'Ехать дальше',
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
    ['W / S или колесо', 'ручное управление'],
    ['Перетаскивание', 'осмотреться'],
    ['H', 'скрыть интерфейс'],
  ] as [string, string][],
  helpTouch: 'Перетаскивайте, чтобы осмотреться. Остановки и переходы идут сами.',
};
