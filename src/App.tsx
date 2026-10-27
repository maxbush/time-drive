import { useEffect, useRef, useState } from 'react';
import { WORLD_ZONES, WorldSceneEngine, WorldTelemetry } from './world/WorldScene';
import { CHAPTERS, PROJECTS, ProjectId } from './content';
import { Loader } from './ui/Loader';
import { TopBar } from './ui/TopBar';
import { ChapterBar } from './ui/ChapterBar';
import { ProjectCard } from './ui/ProjectCard';
import { ProjectDrawer } from './ui/ProjectDrawer';
import { ContactPanel } from './ui/ContactPanel';
import { FinalePanel } from './ui/FinalePanel';
import { RotateHint } from './ui/RotateHint';
import { DevPanel } from './ui/DevPanel';

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldSceneEngine | null>(null);

  // ?debug: interface hidden by default, tiny perf readout only. ?dev: public UI + dev controls.
  const debugMode = query.has('debug');
  const devMode = query.has('dev');
  const [hudVisible, setHudVisible] = useState(!debugMode);
  const [loading, setLoading] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [liveView, setLiveView] = useState(false); // a live site is open in the panel: freeze the 3D world
  const [contact, setContact] = useState<{ open: boolean; subject: string }>({ open: false, subject: '' });
  const flashRef = useRef<HTMLDivElement>(null);
  const flashLabelRef = useRef<HTMLDivElement>(null);

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

  // Phones: the journey is built for landscape (portrait is slower and crops the
  // avenue), so in portrait we ask the visitor to rotate. The 3D world is paused
  // meanwhile (it keeps loading) and they can still choose to continue as is.
  // ?phone=portrait forces the portrait-phone behaviour (for testing on a desktop).
  const forcePhone = query.get('phone');
  const [isPhone] = useState(
    () => forcePhone !== null || window.matchMedia('(pointer: coarse) and (hover: none)').matches
  );
  const isPortraitNow = () => window.innerHeight > window.innerWidth;
  const [portrait, setPortrait] = useState(() => forcePhone === 'portrait' || isPortraitNow());
  const [portraitOk, setPortraitOk] = useState(false);
  const showRotate = isPhone && portrait && !portraitOk;

  useEffect(() => {
    // Measured from the window size itself: the orientation media query lags on some
    // phones, which left the hint on screen for a while after rotating. Re-checked a few
    // times after a rotation because the browser reports the final size a moment later.
    const timers: number[] = [];
    const check = () => setPortrait(forcePhone === 'portrait' || window.innerHeight > window.innerWidth);
    const onRotate = () => {
      check();
      for (const ms of [80, 250, 600]) timers.push(window.setTimeout(check, ms));
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', onRotate);
    screen.orientation?.addEventListener?.('change', onRotate);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', onRotate);
      screen.orientation?.removeEventListener?.('change', onRotate);
      timers.forEach(clearTimeout);
    };
  }, [forcePhone]);

  // The world pauses behind the rotate hint and behind the contact overlay.
  const paused = showRotate || contact.open || liveView;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const engine = new WorldSceneEngine(
      el,
      (data) => setTelemetry(data),
      (p) => setLoadPct(Math.round(p * 100))
    );
    engineRef.current = engine;
    engine.setPaused(pausedRef.current);
    engine.ready.then(() => setLoading(false));
    let lastFlashKind: 'jump' | 'launch' | null = null;
    engine.onFlash = (v, kind) => {
      if (flashRef.current) flashRef.current.style.opacity = String(v);
      if (flashLabelRef.current && kind !== lastFlashKind) {
        lastFlashKind = kind;
        flashLabelRef.current.textContent = kind === 'launch' ? 'ЗАЖИГАНИЕ' : '88 MPH';
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyH' && !e.repeat) setHudVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const station = telemetry.activeStation;
  const activeProject = station && station !== 'space' ? PROJECTS[station as ProjectId] : null;
  const showFinale = station === 'space';

  // The side panel belongs to a stop: the website stop opens it on arrival (previews of
  // the sites), the others open it from "Подробнее". Driving away closes it.
  useEffect(() => {
    setDrawerOpen(station === 'web');
  }, [station]);

  // The wide sites panel covers the right half: slide the 3D view into the free left part
  // so the stand and the car stay visible (the narrow drawers sit over empty road).
  const sitesPanelOpen = drawerOpen && !!activeProject?.sites && hudVisible;
  useEffect(() => {
    const vw = window.innerWidth;
    const panel = Math.min(680, vw * (window.innerHeight <= 480 ? 0.52 : 0.5));
    engineRef.current?.setPanelShift(sitesPanelOpen ? (panel / vw / 2) * 0.82 : 0);
  }, [sitesPanelOpen]);

  const progressPct = Math.max(
    0,
    Math.min(100, ((320 - telemetry.zPos + telemetry.yPos) / (320 - -580)) * 100)
  );

  const openContact = (subject: string) => setContact({ open: true, subject });
  const engine = () => engineRef.current;
  const chIdx = Math.max(0, CHAPTERS.findIndex((c) => c.id === telemetry.activeZoneId));
  const chapter = `Глава ${String(chIdx + 1).padStart(2, '0')} · ${CHAPTERS[chIdx].label}`;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#05070b]">
      {/* 3D WebGL canvas */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Cinematic vignette — pure CSS, zero GL cost */}
      <div
        className="pointer-events-none fixed inset-0 z-[6]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(2,6,17,0.42) 100%)',
        }}
      />

      <Loader visible={loading} pct={loadPct} />
      {showRotate && <RotateHint onContinue={() => setPortraitOk(true)} />}

      {/* Time-jump / launch flash. The white-out itself is drawn in the WebGL post pass
          (so it blooms); this layer only carries the caption, dark on the white. */}
      <div ref={flashRef} className="pointer-events-none fixed inset-0 z-10" style={{ opacity: 0 }}>
        <div className="flex h-full w-full flex-col items-center justify-center">
          <div
            ref={flashLabelRef}
            className="rounded-full border border-slate-900/40 bg-white/30 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.35em] text-slate-900"
          >
            88 MPH
          </div>
        </div>
      </div>

      {/* ?debug with the interface hidden: a tiny always-on performance readout */}
      {debugMode && !hudVisible && (
        <div className="pointer-events-none fixed left-2 top-2 z-30 rounded bg-black/45 px-2 py-1 font-mono text-[11px] leading-tight text-emerald-400">
          {telemetry.fps} FPS
          <span className="ml-2 text-slate-400">
            {telemetry.drawCalls} DC · {(telemetry.triangles / 1e6).toFixed(1)}M△
          </span>
          <div className="text-[10px] text-slate-500">{telemetry.profile}</div>
        </div>
      )}

      {!hudVisible && (
        <button
          onClick={() => setHudVisible(true)}
          className="fixed right-4 top-4 z-30 rounded-full border border-white/15 bg-slate-950/75 px-3.5 py-1.5 text-xs font-medium tracking-wider text-slate-200 hover:border-amber-400/50"
        >
          UI [H]
        </button>
      )}

      {hudVisible && (
        <>
          {/* soft top / bottom scrims so thin text stays legible over bright sky or road */}
          <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/60 via-black/25 to-transparent" />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <TopBar onContact={() => openContact('Связаться')} touch={isPhone} chapter={chapter} />

          {activeProject && !drawerOpen && (
            <ProjectCard
              project={activeProject}
              onDetails={() => setDrawerOpen(true)}
              onCta={() => openContact(activeProject.demoSubject)}
            />
          )}
          {activeProject && drawerOpen && (
            <ProjectDrawer
              project={activeProject}
              onClose={() => setDrawerOpen(false)}
              onLive={setLiveView}
              onCta={() => openContact(activeProject.demoSubject)}
            />
          )}

          {showFinale && (
            <FinalePanel onRestart={() => engine()?.resumeFromStation()} />
          )}

          <ChapterBar
            activeId={telemetry.activeZoneId}
            progressPct={progressPct}
            atStation={station !== null}
            finale={showFinale}
            autoCruise={telemetry.autoCruise}
            onJump={(id) => engine()?.jumpToZone(id)}
            onToggle={() => engine()?.toggleAutoCruise()}
          />
        </>
      )}

      {devMode && hudVisible && <DevPanel engine={engineRef.current} t={telemetry} />}

      {contact.open && (
        <ContactPanel subject={contact.subject} onClose={() => setContact({ open: false, subject: '' })} />
      )}
    </div>
  );
}
