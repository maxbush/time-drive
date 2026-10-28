import { FINALE, UI } from '../content';
import { ContactLinks } from './ContactLinks';

const link =
  'border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-sky-300 hover:text-sky-200';

// Space finale: the slogan large and light on the left, the feedback form on the
// right (no extra click needed). The car stays free at the bottom centre.
export function FinalePanel({ onRestart }: { onRestart: () => void }) {
  return (
    <>
      <section className="card-in pointer-events-none fixed left-4 top-[20%] z-20 w-[min(560px,46vw)] sm:left-8 short:top-[14%]">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300">
          <span>Акт III</span>
          <span className="h-px w-10 bg-sky-300/50" />
        </div>
        <h2 className="mt-3 text-[30px] font-extralight leading-[1.04] tracking-tight text-white drop-shadow-[0_2px_28px_rgba(0,0,0,0.7)] sm:text-[54px] short:mt-1.5 short:text-[26px]">
          {FINALE.slogan}
        </h2>
        <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-slate-200 drop-shadow-[0_1px_12px_rgba(0,0,0,0.8)] short:mt-1.5 short:hidden">
          {FINALE.sub}
        </p>
        <div className="pointer-events-auto mt-6 short:mt-3">
          <button onClick={onRestart} className={link}>
            {UI.restart} ↺
          </button>
        </div>
      </section>

      <aside className="card-in pointer-events-auto fixed right-4 top-[14%] z-20 w-[min(500px,46vw)] rounded-xl border border-white/10 bg-[#060a12]/88 p-7 shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:right-8 short:top-[10%] short:p-3.5">
        <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400 short:mb-1.5">
          <span className="text-sky-300">{UI.discuss}</span>
          <span className="h-px flex-1 bg-white/15" />
        </div>
        <ContactLinks subject="Обсудить проект" large />
      </aside>
    </>
  );
}
