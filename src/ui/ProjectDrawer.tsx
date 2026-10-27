import { useEffect } from 'react';
import { ProjectContent, UI } from '../content';

const label = 'font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500';
const link =
  'border-b border-white/35 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-amber-300 hover:text-amber-200';

// Editorial detail panel: header with hairlines, a light title, three facts in a row,
// then sections. The scene stays visible (dimmed) on the left; Esc or "Закрыть" closes.
export function ProjectDrawer({
  project,
  webSite,
  onPickSite,
  onClose,
  onCta,
}: {
  project: ProjectContent;
  webSite: number;
  onPickSite: (i: number) => void;
  onClose: () => void;
  onCta: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* soft dim over the scene to the left of the panel (no blur: it is expensive on phones) */}
      <div className="pointer-events-none fixed inset-0 z-20 bg-gradient-to-r from-black/10 via-black/30 to-black/55" />
      <aside className="drawer-in pointer-events-auto fixed bottom-0 right-0 top-0 z-30 w-[min(460px,94vw)] overflow-y-auto border-l border-white/10 bg-[#060a12]/94 px-6 pb-8 pt-5 sm:px-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className={label}>
            {project.index} / {project.tag}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:text-white"
          >
            {UI.close} ×
          </button>
        </div>

        <h2 className="mt-6 text-[32px] font-extralight leading-[1.05] tracking-tight text-white sm:text-[38px]">
          {project.title}
        </h2>
        <p className="mt-3 text-sm font-light leading-relaxed text-slate-300">{project.lead}</p>
        {project.note && <p className="mt-1.5 text-xs italic text-slate-500">{project.note}</p>}

        <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-white/10 py-4">
          {project.facts.map(([k, v]) => (
            <div key={k}>
              <dt className={label}>{k}</dt>
              <dd className="mt-1.5 font-mono text-[12px] leading-snug text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-7">
          <h3 className={label}>О проекте</h3>
          <p className="mt-2.5 text-sm font-light leading-relaxed text-slate-300">{project.description}</p>
        </section>

        {project.sites && (
          <section className="mt-7">
            <h3 className={label}>Сайты</h3>
            <ul className="mt-3 space-y-7">
              {project.sites.map((s, i) => (
                <li key={s.id} className={i === webSite ? '' : 'opacity-90'}>
                  <div className="flex items-baseline justify-between gap-3">
                    <button
                      onClick={() => onPickSite(i)}
                      className="text-left text-xl font-extralight tracking-tight text-white hover:text-amber-100"
                    >
                      {String(i + 1).padStart(2, '0')} · {s.name}
                    </button>
                    <a href={s.url} target="_blank" rel="noreferrer" className={`${link} shrink-0`}>
                      {UI.openSite} ↗
                    </a>
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{s.kind}</div>
                  <p className="mt-2 text-sm font-light leading-relaxed text-slate-300">{s.description}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {s.slides.slice(0, 4).map((src, k) => (
                      <img
                        key={src}
                        src={src}
                        alt={`${s.name}: экран ${k + 1}`}
                        loading="lazy"
                        className="aspect-[4/3] w-full rounded-md border border-white/10 object-cover object-top"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <h3 className={label}>Что делаю</h3>
          <ul className="mt-3 space-y-2">
            {project.points.map((p) => (
              <li key={p} className="flex gap-3 text-sm font-light text-slate-200">
                <span className="mt-[11px] h-px w-3 shrink-0 bg-slate-500" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-7">
          <h3 className={label}>Стек</h3>
          <p className="mt-2.5 font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-slate-300">
            {project.stack.join(' · ')}
          </p>
        </section>

        <button
          onClick={onCta}
          className="mt-9 h-11 w-full border border-white/30 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-slate-950"
        >
          {project.cta} →
        </button>
      </aside>
    </>
  );
}
