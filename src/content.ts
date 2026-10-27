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
  demoSubject: string;
  // Real screenshots / media for the drawer (paths under /public). Empty = placeholder.
  media: { src: string; caption: string }[];
}

export const PROJECTS: Record<ProjectId, ProjectContent> = {
  web: {
    index: '01',
    tag: 'Веб-платформы и сайты',
    title: 'Сайты и интерактивные платформы',
    lead: 'От лендинга до 3D-интерфейса: под ключ, со своим дизайном.',
    description:
      'Проектирую и разрабатываю сайты от идеи до запуска: собственный дизайн без шаблонов, быстрая загрузка, аккуратная анимация и адаптация под телефон.',
    points: [
      'Корпоративные сайты, лендинги и витрины',
      'Интерактивные 3D-страницы на WebGL',
      'Личные кабинеты и сервисные интерфейсы',
      'Дизайн и разработка в одних руках',
    ],
    stack: ['Next.js', 'TypeScript', 'React', 'Tailwind CSS', 'Three.js'],
    demoSubject: 'Запрос: веб-проект',
    media: [],
  },
  albion: {
    index: '02',
    tag: 'Автоматизация и бот',
    title: 'ALBION Bot',
    lead: 'Следит за расписанием школы и сам рассылает уведомления.',
    description:
      'Бот интегрирован с API MeritHub: отслеживает расписание и сообщает об изменениях. Ученики получают уведомления в WhatsApp, координатор в Telegram.',
    points: [
      'Синхронизация расписания через API MeritHub',
      'Уведомления ученикам в WhatsApp',
      'Уведомления и сводки координатору в Telegram',
      'Работает без ручного участия',
    ],
    stack: ['MeritHub API', 'WhatsApp', 'Telegram'],
    demoSubject: 'Запрос демо: ALBION Bot',
    media: [],
  },
  tenders: {
    index: '03',
    tag: 'Тендеры и аналитика',
    title: 'Тендерный бот',
    lead: 'Анализ тендеров, конкурентов и планов госзакупок.',
    description:
      'Бот для работы с тендерами и аналитики данных. Разбирает тендеры, в которых вы участвовали, и действия конкурентов, фильтрует планы госзакупок целевых заказчиков. Данные получает из API gias.by.',
    points: [
      'Анализ собственных тендеров и истории участия',
      'Анализ конкурентов',
      'Анализ и фильтрация планов госзакупок',
      'Данные из API gias.by',
    ],
    stack: ['API gias.by', 'Аналитика данных', 'Госзакупки'],
    demoSubject: 'Запрос демо: тендерный бот',
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
