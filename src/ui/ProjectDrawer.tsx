import { useEffect, useRef } from 'react';
import { ProjectContent, UI } from '../content';

const label = 'font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500';
const link =
  'border-b border-white/35 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-amber-300 hover:text-amber-200';

// Editorial detail panel: hairline header, a light title, three facts in a row, then
// sections. For the website stop it turns into a wide viewer (about half the screen):
// site tabs on top and the full screenshots stacked below, so the design is readable.
// The scene stays visible (dimmed) on the left; Esc or "Закрыть" closes.
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
  const scroller = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // switching site scrolls the viewer back to the top of that site
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [webSite]);

  const sites = project.sites;
  const site = sites ? sites[webSite] : null;

  return (
    <>
      {/* soft dim over the scene next to the panel (no blur: it is expensive on phones) */}
      <div className="pointer-events-none fixed inset-0 z-20 bg-gradient-to-r from-black/5 via-black/25 to-black/55" />
      <aside
        ref={scroller}
        className={`drawer-in pointer-events-auto fixed bottom-0 right-0 top-0 z-30 overflow-y-auto border-l border-white/10 bg-[#060a12]/95 px-6 pb-8 pt-5 sm:px-8 ${
          sites ? 'w-[min(780px,56vw)] short:w-[62vw]' : 'w-[min(460px,94vw)]'
        }`}
      >
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

        <h2 className="mt-6 text-[32px] font-extralight leading-[1.05] tracking-tight text-white sm:text-[38px] short:mt-3 short:text-[24px]">
          {project.title}
        </h2>
        <p className="mt-3 text-sm font-light leading-relaxed text-slate-300 short:mt-1.5">{project.lead}</p>
        {project.note && <p className="mt-1.5 text-xs italic text-slate-500">{project.note}</p>}

        {/* WEBSITE STOP: tabs + big screenshots */}
        {sites && site && (
          <section className="mt-6">
            <div className="sticky top-0 z-10 -mx-6 flex gap-6 overflow-x-auto border-y border-white/10 bg-[#060a12]/95 px-6 sm:-mx-8 sm:px-8">
              {sites.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => onPickSite(i)}
                  className={`shrink-0 whitespace-nowrap border-b py-3 text-[13px] font-light transition ${
                    i === webSite
                      ? 'border-amber-300 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span className="mr-2 font-mono text-[10px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                  {s.name}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{site.kind}</div>
                <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-slate-300">{site.description}</p>
              </div>
              <a href={site.url} target="_blank" rel="noreferrer" className={`${link} shrink-0`}>
                {UI.openSite} ↗
              </a>
            </div>

            <div className="mt-5 space-y-3">
              {site.slides.map((src, k) => (
                <img
                  key={src}
                  src={src}
                  alt={`${site.name}: экран ${k + 1}`}
                  loading="lazy"
                  className="w-full rounded-md border border-white/10"
                />
              ))}
            </div>
          </section>
        )}

        <dl className="mt-7 grid grid-cols-3 gap-4 border-y border-white/10 py-4">
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
