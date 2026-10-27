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
}: {
  activeId: string;
  progressPct: number;
  atStation: boolean;
  finale: boolean; // in space the main button restarts the journey
  autoCruise: boolean;
  onJump: (id: string) => void;
  onToggle: () => void;
}) {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-3 sm:px-8 sm:pb-4">
      <div className="pointer-events-auto flex items-end gap-5">
        <button
          onClick={onToggle}
          className={`shrink-0 transition ${
            atStation
              ? 'border-b border-amber-300 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200 hover:text-white'
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
  );
}
