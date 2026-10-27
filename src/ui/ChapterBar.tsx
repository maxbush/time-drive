import { ArrowRight, Pause, Play } from 'lucide-react';
import { CHAPTERS, UI } from '../content';

// Bottom strip: a thin progress line with clickable chapters + one primary
// button (pause / drive on). Kept slim so the scene stays the star.
export function ChapterBar({
  activeId,
  progressPct,
  atStation,
  autoCruise,
  onJump,
  onToggle,
}: {
  activeId: string;
  progressPct: number;
  atStation: boolean;
  autoCruise: boolean;
  onJump: (id: string) => void;
  onToggle: () => void;
}) {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-3 sm:px-6 sm:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center gap-3">
        <button
          onClick={onToggle}
          className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition ${
            atStation
              ? 'bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.35)] hover:bg-amber-200'
              : 'border border-white/15 bg-[#0a0e16]/70 text-slate-200 hover:border-white/35'
          }`}
        >
          {atStation ? (
            <>
              {UI.next} <ArrowRight size={14} />
            </>
          ) : autoCruise ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="h-px w-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-sky-300 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            {CHAPTERS.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => onJump(c.id)}
                  className={`truncate font-mono text-[10px] uppercase tracking-[0.16em] transition sm:text-[11px] ${
                    active ? 'text-amber-200' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
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
