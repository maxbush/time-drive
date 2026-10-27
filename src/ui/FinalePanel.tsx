import { RotateCcw } from 'lucide-react';
import { FINALE, UI } from '../content';

// Space finale: the slogan large, no card chrome, so the stars stay the background.
// Sits bottom-left like the project cards, with two actions.
export function FinalePanel({ onDiscuss, onRestart }: { onDiscuss: () => void; onRestart: () => void }) {
  return (
    <section className="card-in pointer-events-auto fixed bottom-16 left-4 z-20 w-[min(560px,calc(100vw-2rem))] sm:bottom-20 sm:left-8 short:bottom-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-sky-300">Акт III</div>
      <h2 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-5xl short:mt-1.5 short:text-2xl">
        {FINALE.slogan}
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-200 drop-shadow-[0_1px_12px_rgba(0,0,0,0.7)] short:mt-1.5 short:text-xs">
        {FINALE.sub}
      </p>
      <div className="mt-5 flex items-center gap-2 short:mt-3">
        <button
          onClick={onDiscuss}
          className="h-10 rounded-full bg-sky-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.4)] transition hover:bg-sky-300"
        >
          {UI.discuss}
        </button>
        <button
          onClick={onRestart}
          className="flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-sm text-white transition hover:border-white/60 hover:bg-white/5"
        >
          <RotateCcw size={14} /> {UI.restart}
        </button>
      </div>
    </section>
  );
}
