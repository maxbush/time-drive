import { FINALE, UI } from '../content';
import { ContactLinks } from './ContactLinks';

const link =
  'border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-sky-300 hover:text-sky-200';

// Space finale: ONE translucent block on the left (slogan, a line, the contacts, "again"), so
// everything is aligned and reads as a unit over the stars. The car stays free at the bottom centre.
export function FinalePanel({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="card-in pointer-events-auto fixed left-4 top-[14%] z-20 w-[min(540px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#050a14]/58 px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:left-8 sm:px-8 compact:top-[10%] compact:px-6 compact:py-4 short:top-[8%] short:px-4 short:py-3">
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300">
        <span>Акт III</span>
        <span className="h-px w-10 bg-sky-300/50" />
      </div>
      <h2 className="mt-3 text-[30px] font-extralight leading-[1.04] tracking-tight text-white sm:text-[46px] compact:mt-2 compact:text-[38px] short:mt-1.5 short:text-[26px]">
        {FINALE.slogan}
      </h2>
      <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-slate-200 compact:hidden">{FINALE.sub}</p>

      <div className="mb-3 mt-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400 compact:mb-2 compact:mt-4 short:mb-1.5 short:mt-3">
        <span className="text-sky-300">{UI.discuss}</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <ContactLinks subject="Обсудить проект" large />

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4 compact:mt-3 compact:pt-3 short:mt-2.5 short:pt-2.5">
        <button onClick={onRestart} className={link}>
          {UI.restart} ↺
        </button>
        <a href="./simple/" className={link}>
          {UI.simpleVersion} →
        </a>
      </div>
    </section>
  );
}