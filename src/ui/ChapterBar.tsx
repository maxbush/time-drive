import { Pause, Play } from 'lucide-react';
import { CHAPTERS, UI } from '../content';

// Bottom strip: a hairline progress line with clickable chapters and one control
// (pause / "ехать дальше"). Slim, text-first, so the scene stays the star.
export function ChapterBar({
  activeId,
  progressPct,
  atStation,
  finale,
  autoCruise,
  onJump,
  onToggle,
  hideNext = false,
}: {
  hideNext?: boolean; // e.g. a site is open full-screen: no floating button over it
  activeId: string;
  progressPct: number;
  atStation: boolean;
  finale: boolean; // in space the main button restarts the journey
  autoCruise: boolean;
  onJump: (id: string) => void;
  onToggle: () => void;
}) {
  // The pill is a sibling of the footer, not a child: the footer is its own stacking context (z-20),
  // which would keep the pill below the side panels (z-30) whatever z-index the pill had.
  return (
    <>
      {/* "Drive on" at a stop: a semi-transparent pill in the middle of the screen, above the
          side panels (z-36) so it is never covered, wherever the panel opens. */}
      {atStation && !finale && !hideNext && (
        <div className="pointer-events-none fixed inset-x-0 bottom-14 z-[36] flex justify-center sm:bottom-[4.25rem] short:bottom-11">
          <button
            onClick={onToggle}
            className="pointer-events-auto rounded-full border border-white/25 bg-black/35 px-7 py-2.5 font-mono text-[11px] uppercase tracking-[0.24em] text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:border-white/50 hover:bg-black/60 hover:text-white short:px-5 short:py-1.5"
          >
            {UI.next} →
          </button>
        </div>
      )}
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-3 sm:px-8 sm:pb-4">
      <div className="pointer-events-auto flex items-end gap-5">
        <button
          onClick={onToggle}
          aria-label={atStation ? UI.next : autoCruise ? 'Пауза' : 'Продолжить'}
          className={`shrink-0 transition ${
            atStation
              ? `border-b border-amber-300 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200 hover:text-white ${
                  finale ? '' : 'hidden'
                }`
              : 'grid h-7 w-7 place-items-center rounded-full border border-white/20 text-slate-200 hover:border-white/50'
          }`}
        >
          {atStation ? (
            <>{finale ? `${UI.restart} ↺` : `${UI.next} →`}</>
          ) : autoCruise ? (
            <Pause size={12} />
          ) : (
            <Play size={12} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="h-px w-full bg-white/12">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-sky-300 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            {CHAPTERS.map((c, i) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => onJump(c.id)}
                  className={`truncate font-mono text-[10px] uppercase tracking-[0.18em] transition ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span className="mr-1.5 text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
