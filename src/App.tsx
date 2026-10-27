import { useEffect, useRef, useState } from 'react';
import {
  CameraMode,
  ProjectStationId,
  WORLD_ZONES,
  WorldSceneEngine,
  WorldTelemetry,
} from './world/WorldScene';

interface ProjectBriefData {
  tag: string;
  title: string;
  subtitle: string;
  summary: string;
  stack: string[];
  highlights: Array<{ label: string; value: string; desc: string }>;
  websites?: Array<{ name: string; role: string; stack: string; metric: string }>;
}

const PROJECT_BRIEFS: Record<'web' | 'albion' | 'tenders', ProjectBriefData> = {
  web: {
    tag: 'PROJECT 01 // WEB ARCHITECTURE & INTERACTIVE DESIGN',
    title: 'Современные веб-платформы и сайты',
    subtitle: 'От высококонверсионных продуктовых лендингов до сложных 3D/WebGL и SaaS-интерфейсов',
    summary:
      'Серия из 4 коммерческих веб-проектов с индивидуальной дизайн-системой, продуманной типографикой, микро-анимациями и максимальной скоростью загрузки.',
    stack: ['Next.js', 'TypeScript', 'React', 'Tailwind CSS', 'Three.js / WebGL', 'Framer Motion'],
    highlights: [
      { label: '4 ПРОЕКТА', value: 'Production', desc: 'Коммерческие релизы под ключ' },
      { label: 'LIGHTHOUSE', value: '98–100', desc: 'Оптимизация Core Web Vitals и SSR' },
      { label: 'UI / UX', value: 'Custom', desc: 'Авторский дизайн без шаблонных решений' },
    ],
    websites: [
      { name: '01 · Corporate & Product Flagship', role: '3D-презентация продукта и лидогенерация', stack: 'Next.js · WebGL', metric: '+64% конверсия' },
      { name: '02 · EdTech / Service Platform', role: 'Личный кабинет, расписание и оплата', stack: 'React · TypeScript', metric: '99.4% Uptime' },
      { name: '03 · E-Commerce & Brand Showroom', role: 'Интерактивный каталог и конфигуратор', stack: 'Next.js · Tailwind', metric: '<0.8s LCP' },
      { name: '04 · B2B Analytics Landing', role: 'Визуализация данных и демо-воронка', stack: 'TypeScript · Motion', metric: 'x2.4 заявки' },
    ],
  },
  albion: {
    tag: 'PROJECT 02 // EDTECH AUTOMATION & MESSAGING ECOSYSTEM',
    title: 'ALBION Bot — Автоматизация расписания',
    subtitle: 'Интеграция с API MeritHub · Уведомления ученикам в WhatsApp · Дайджесты координатору в Telegram',
    summary:
      'Автономная система мониторинга расписания онлайн-школы: отслеживает переносы, отмены и новые уроки в MeritHub, автоматически уведомляет учеников в WhatsApp и отправляет оперативные сводки координаторам в Telegram.',
    stack: ['Node.js / TypeScript', 'MeritHub API', 'WhatsApp API', 'Telegram Bot API', 'SQLite / Cron Scheduler'],
    highlights: [
      { label: 'MERITHUB API', value: '24/7 Sync', desc: 'Автоматическая синхронизация слотов и ссылок на уроки' },
      { label: 'WHATSAPP', value: 'Ученикам', desc: 'Персональные напоминания за 24ч и 1ч до занятия' },
      { label: 'TELEGRAM', value: 'Координатору', desc: 'Мгновенные алерты об изменениях и утренние дайджесты' },
    ],
  },
  tenders: {
    tag: 'PROJECT 03 // GOVTECH & PROCUREMENT INTELLIGENCE',
    title: 'Система анализа тендеров (API GIAS.BY)',
    subtitle: 'Разведка конкурентов · История участия в закупках · Умная фильтрация планов госзакупок',
    summary:
      'Аналитическая B2B-платформа, подключенная к API gias.by. Позволяет анализировать свои прошлые тендеры и стратегии конкурентов, отслеживать снижение цен и автоматически фильтровать годовые планы государственных закупок целевых заказчиков.',
    stack: ['GIAS.BY API', 'Python / TypeScript', 'Data Pipelines', 'Analytics Dashboard', 'Smart Filtering'],
    highlights: [
      { label: 'API GIAS.BY', value: 'Real-Time', desc: 'Прямая загрузка тендеров, лотов и протоколов торгов' },
      { label: 'КОНКУРЕНТЫ', value: 'Win / Loss', desc: 'Матрица пересечений, ценовых стратегий и побед конкурентов' },
      { label: 'ГОСЗАКУПКИ', value: 'План-Фильтр', desc: 'Ранний поиск перспективных закупок в планах госзаказчиков' },
    ],
  },
};

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldSceneEngine | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const flashLabelRef = useRef<HTMLDivElement>(null);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubject, setDemoSubject] = useState('Обсудить проект / Запросить демо');
  const [formSent, setFormSent] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactHandle, setContactHandle] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const [telemetry, setTelemetry] = useState<WorldTelemetry>({
    fps: 60,
    drawCalls: 0,
    profile: '',
    triangles: 0,
    speedKmh: 0,
    zPos: 315,
    yPos: 0,
    activeZoneId: WORLD_ZONES[0].id,
    activeZoneLabel: WORLD_ZONES[0].label,
    activeZoneEra: WORLD_ZONES[0].era,
    activeZoneSubtitle: WORLD_ZONES[0].subtitle,
    cameraMode: 'chase',
    autoCruise: true,
    carModel: 'bttf',
    duskDepth: 0.25,
    activeStation: null,
    temporalFlash: 0,
    flashKind: null,
    spaceFactor: 0,
  });

  const debugMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const engine = new WorldSceneEngine(
      el,
      (data) => {
        setTelemetry(data);
      },
      (p) => setLoadPct(Math.round(p * 100))
    );
    engineRef.current = engine;
    engine.ready.then(() => setLoading(false));
    let lastFlashKind: 'jump' | 'launch' | null = null;
    engine.onFlash = (v, kind) => {
      if (flashRef.current) flashRef.current.style.opacity = String(v);
      if (flashLabelRef.current && kind !== lastFlashKind) {
        lastFlashKind = kind;
        flashLabelRef.current.textContent =
          kind === 'launch' ? 'IGNITION // BEYOND THE HORIZON' : '88 MPH // TEMPORAL JUMP';
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyH' && !e.repeat) {
        setHudVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const progressPct = Math.max(
    0,
    Math.min(100, ((320 - telemetry.zPos + telemetry.yPos) / (320 - -580)) * 100)
  );

  const activeBrief =
    telemetry.activeStation && telemetry.activeStation !== 'space'
      ? PROJECT_BRIEFS[telemetry.activeStation]
      : null;

  const openDemoRequest = (subject: string) => {
    setDemoSubject(subject);
    setFormSent(false);
    setDemoModalOpen(true);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05070b] select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading screen — covers the world until the DeLorean GLB is in */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070b] transition-opacity duration-700 ${
          loading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 py-1.5 rounded border border-amber-400/40 text-amber-300 font-mono text-[11px] tracking-[0.35em] uppercase">
          TIME DRIVE · PORTFOLIO
        </div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Путешествие во времени загружается
        </h1>
        <div className="mt-6 w-64 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-sky-400 transition-all duration-300"
            style={{ width: `${Math.max(6, loadPct)}%` }}
          />
        </div>
        <div className="mt-3 font-mono text-[11px] text-slate-500 tracking-widest">
          {loadPct > 0 ? `LOADING DELOREAN — ${loadPct}%` : 'IGNITING FLUX CAPACITOR…'}
        </div>
      </div>

      {/* 88 MPH Temporal Flash — opacity driven per-frame via ref (no React
          re-render), so the ramp is smooth instead of 8Hz telemetry steps */}
      <div
        ref={flashRef}
        className="fixed inset-0 z-10 pointer-events-none"
        style={{ opacity: 0 }}
      >
        {/* The white-out itself is rendered in the WebGL post pass (so it blooms);
            this layer only carries the caption, dark on the white flash. */}
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div
            ref={flashLabelRef}
            className="px-4 py-1.5 rounded-full bg-white/30 border border-slate-900/40 text-slate-900 font-mono text-xs tracking-[0.3em] uppercase"
          >
            88 MPH // TEMPORAL JUMP
          </div>
        </div>
      </div>

      {/* Minimal Toggle Pill when HUD is hidden */}
      {!hudVisible && (
        <button
          onClick={() => setHudVisible(true)}
          className="fixed top-4 right-4 z-30 px-3.5 py-1.5 rounded-full bg-slate-950/75 border border-white/15 text-xs font-medium tracking-wider text-slate-200 hover:border-amber-400/50 transition"
        >
          SHOW HUD [H]
        </button>
      )}

      {/* DESIGNER PROJECT BRIEF CARD (Automatically unfolds when car slows down at Station 1, 2, or 3!) */}
      {hudVisible && activeBrief && !demoModalOpen && (
        <aside className="fixed right-6 top-20 bottom-28 z-20 w-full max-w-[440px] flex flex-col justify-between rounded-2xl bg-slate-950/82 border border-white/15 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-y-auto pointer-events-auto">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono text-[10px] tracking-widest uppercase">
                {activeBrief.tag}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                STATION STOP
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              {activeBrief.title}
            </h2>
            <p className="mt-1 text-xs font-medium text-sky-300/90">
              {activeBrief.subtitle}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {activeBrief.summary}
            </p>

            {/* Key Metrics / Architecture Grid */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {activeBrief.highlights.map((h) => (
                <div
                  key={h.label}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10"
                >
                  <div className="text-[10px] font-mono text-slate-400 uppercase">{h.label}</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">{h.value}</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-1">{h.desc}</div>
                </div>
              ))}
            </div>

            {/* Websites Breakdown for Project 01 */}
            {activeBrief.websites && (
              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Избранные веб-проекты:
                </div>
                {activeBrief.websites.map((w) => (
                  <div
                    key={w.name}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 hover:border-amber-400/40 transition"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{w.name}</div>
                      <div className="text-[11px] text-slate-400">{w.role}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono text-emerald-300">{w.metric}</div>
                      <div className="text-[10px] font-mono text-slate-500">{w.stack}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tech Stack Pills */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {activeBrief.stack.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2.5">
            <button
              onClick={() => openDemoRequest(`Запрос демо: ${activeBrief.title}`)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs tracking-wide transition shadow-[0_0_25px_rgba(251,191,36,0.3)] cursor-pointer"
            >
              Запросить демо / Обсудить
            </button>
            <button
              onClick={() => engineRef.current?.resumeFromStation()}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold text-xs tracking-wide transition cursor-pointer"
            >
              Ехать дальше →
            </button>
          </div>
        </aside>
      )}

      {/* ACT III finale — pre-mounted hidden so it doesn't cost an 80ms DOM
          mount mid-flight; visibility just flips when the card is due */}
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/55 pointer-events-auto"
        style={{
          visibility:
            hudVisible && (telemetry.activeStation === 'space' || demoModalOpen)
              ? 'visible'
              : 'hidden',
          pointerEvents:
            hudVisible && (telemetry.activeStation === 'space' || demoModalOpen)
              ? 'auto'
              : 'none',
        }}
      >
          <div className="w-full max-w-lg rounded-2xl bg-slate-950/90 border border-sky-400/35 p-7 shadow-[0_0_90px_rgba(56,189,248,0.25)]">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 font-mono text-[11px] tracking-widest uppercase">
                {demoModalOpen ? demoSubject : 'ACT III // BEYOND THE HORIZON'}
              </span>
              <button
                onClick={() => {
                  setDemoModalOpen(false);
                  if (telemetry.activeStation === 'space') {
                    engineRef.current?.resumeFromStation();
                  }
                }}
                className="text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
              >
                [ ЗАКРЫТЬ ✕ ]
              </button>
            </div>

            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Погнали со мной в будущее — создадим ваш проект
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Веб-платформы, автоматизация бизнес-процессов (ALBION Bot) или аналитические системы (GIAS.BY). Оставьте контакт — обсудим задачу и проведем живое демо.
            </p>

            {formSent ? (
              <div className="mt-6 p-5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-center">
                <div className="text-base font-bold text-emerald-300">
                  Заявка принята на борт!
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Свяжусь с вами в ближайшее время в Telegram / WhatsApp.
                </p>
                <button
                  onClick={() => {
                    setFormSent(false);
                    setDemoModalOpen(false);
                    if (telemetry.activeStation === 'space') {
                      engineRef.current?.resumeFromStation();
                    }
                  }}
                  className="mt-4 px-5 py-2 rounded-lg bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
                >
                  Начать маршрут заново ↻
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormSent(true);
                }}
                className="mt-5 space-y-3.5"
              >
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Максим / Компания"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Telegram / WhatsApp / Email
                  </label>
                  <input
                    type="text"
                    required
                    value={contactHandle}
                    onChange={(e) => setContactHandle(e.target.value)}
                    placeholder="@username или +375 / +7..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Какой проект или демо интересует?
                  </label>
                  <textarea
                    rows={3}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Разработка сайта, внедрение бота расписания или система аналитики тендеров..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(56,189,248,0.35)] hover:opacity-95 transition cursor-pointer"
                  >
                    Отправить и запросить демо
                  </button>
                  {telemetry.activeStation === 'space' && (
                    <button
                      type="button"
                      onClick={() => engineRef.current?.resumeFromStation()}
                      className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition cursor-pointer"
                    >
                      В начало ↻
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

      {hudVisible && (
        <>
          {/* Top Bar */}
          <header className="fixed top-0 inset-x-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-b from-slate-950/85 via-slate-950/45 to-transparent pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto">
              <div className="px-3 py-1 rounded bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-mono tracking-widest uppercase">
                TIME DRIVE · PORTFOLIO
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-sky-400">
                  {telemetry.activeZoneEra}
                </div>
                <div className="text-sm font-semibold text-white tracking-tight">
                  {telemetry.activeZoneSubtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">

              {/* Camera Mode Switcher */}
              <div className="flex items-center rounded-lg bg-slate-900/80 border border-white/10 p-0.5">
                {(
                  [
                    { id: 'chase', label: 'Chase' },
                    { id: 'cinematic-low', label: 'Low Angle' },
                    { id: 'orbit', label: 'Free Orbit' },
                  ] as Array<{ id: CameraMode; label: string }>
                ).map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => engineRef.current?.setCameraMode(cam.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      telemetry.cameraMode === cam.id
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Atmosphere / Night Depth Toggle */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-white/10">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Dusk/Night</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={telemetry.duskDepth}
                  onChange={(e) => engineRef.current?.setDuskDepth(parseFloat(e.target.value))}
                  className="w-20 accent-amber-400 cursor-pointer"
                />
              </div>

              <button
                onClick={() => openDemoRequest('Связаться / Запросить демо')}
                className="px-3 py-1.5 rounded-lg bg-amber-400/20 border border-amber-400/50 text-xs font-semibold text-amber-200 hover:bg-amber-400 hover:text-slate-950 transition cursor-pointer"
              >
                Контакт
              </button>

              <button
                onClick={() => setHudVisible(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/10 text-xs text-slate-400 hover:text-white cursor-pointer"
                title="Hide UI (H)"
              >
                Hide [H]
              </button>
            </div>
          </header>

          {/* Bottom Timeline & Controls */}
          <footer className="fixed bottom-0 inset-x-0 z-20 px-5 pb-4 pt-8 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent pointer-events-none">
            <div className="max-w-7xl mx-auto flex flex-col gap-2.5 pointer-events-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {WORLD_ZONES.map((zone, idx) => {
                  const active = telemetry.activeZoneId === zone.id;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => engineRef.current?.jumpToZone(zone.id)}
                      className={`text-left px-3 py-2 rounded-lg border transition cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400/70 text-white shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25 hover:bg-slate-900/90'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-amber-300/90">
                        <span>KEY [{idx + 1}]</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                      </div>
                      <div className="text-xs font-semibold truncate mt-0.5">{zone.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-slate-900/80 border border-white/10 text-xs">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => engineRef.current?.toggleAutoCruise()}
                    className={`px-3 py-1 rounded font-mono text-xs font-semibold transition cursor-pointer ${
                      telemetry.activeStation
                        ? 'bg-amber-400 text-slate-950 animate-pulse'
                        : telemetry.autoCruise
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {telemetry.activeStation
                      ? '▶ ЕХАТЬ ДАЛЬШЕ [SPACE]'
                      : telemetry.autoCruise
                        ? '● AUTO-DRIVE ON [SPACE]'
                        : '▶ ВКЛЮЧИТЬ AUTO-DRIVE [SPACE]'}
                  </button>

                  <div className="hidden sm:flex items-center gap-3 text-slate-300 font-mono text-[11px]">
                    <span>W/S or SCROLL: Ручное управление</span>
                    <span>·</span>
                    <span>SHIFT: Ускорение</span>
                    <span>·</span>
                    <span>DRAG MOUSE: Обзор 360°</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs">
                  <div className="hidden md:flex items-center gap-2 w-36">
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-sky-400 transition-all duration-150"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-amber-300 font-semibold">{telemetry.speedKmh} KM/H</span>
                  <span className="text-slate-400">
                    {telemetry.yPos > 5 ? `ALT: ${telemetry.yPos}m` : `Z: ${telemetry.zPos}m`}
                  </span>
                  {debugMode && (
                    <>
                      <span className="text-emerald-400">{telemetry.fps} FPS</span>
                      <span className="text-slate-500 text-[10px]">
                        {telemetry.drawCalls} DC · {(telemetry.triangles / 1e6).toFixed(1)}M△ · {telemetry.profile}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
