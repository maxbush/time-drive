import { FINALE, UI } from '../content';

const link =
  'border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-sky-300 hover:text-sky-200';

// Space finale: the slogan large and light, text links only, so the stars stay the
// background. Bottom-left like the project stops.
export function FinalePanel({ onDiscuss, onRestart }: { onDiscuss: () => void; onRestart: () => void }) {
  return (
    <section className="card-in pointer-events-auto fixed left-4 top-[22%] z-20 w-[min(600px,calc(100vw-2rem))] sm:left-8 short:top-[16%]">
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300">
        <span>Акт III</span>
        <span className="h-px w-10 bg-sky-300/50" />
      </div>
      <h2 className="mt-3 text-[34px] font-extralight leading-[1.04] tracking-tight text-white drop-shadow-[0_2px_28px_rgba(0,0,0,0.7)] sm:text-[56px] short:mt-1.5 short:text-3xl">
        {FINALE.slogan}
      </h2>
      <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-slate-200 drop-shadow-[0_1px_12px_rgba(0,0,0,0.8)] short:mt-1.5 short:text-xs">
        {FINALE.sub}
      </p>
      <div className="mt-6 flex items-center gap-7 short:mt-3">
        <button onClick={onDiscuss} className={link}>
          {UI.discuss} →
        </button>
        <button onClick={onRestart} className={link}>
          {UI.restart} ↺
        </button>
      </div>
    </section>
  );
}
