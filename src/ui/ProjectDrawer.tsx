import { useEffect, useRef, useState } from 'react';
import { ProjectContent, SiteContent, UI } from '../content';

const label = 'font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500';
const link =
  'border-b border-white/35 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-amber-300 hover:text-amber-200';

// Side panel of a stop: full height on the right, about a third to a half of the screen.
// The website stop opens it by itself on arrival: previews of the sites first, and a
// click opens one site in detail (big screenshots + a link to the live site). The other
// stops open it from "Подробнее" with the project description.
// The scene stays visible (dimmed) on the left; Esc steps back / closes.
export function ProjectDrawer({
  project,
  onClose,
  onCta,
}: {
  project: ProjectContent;
  onClose: () => void;
  onCta: () => void;
}) {
  const scroller = useRef<HTMLElement | null>(null);
  const [siteIdx, setSiteIdx] = useState<number | null>(null);
  const sites = project.sites;
  const site: SiteContent | null = sites && siteIdx !== null ? sites[siteIdx] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (site) setSiteIdx(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, site]);

  // switching between list and a site starts from the top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [siteIdx]);

  return (
    <>
      {/* soft dim over the scene next to the panel (no blur: it is expensive on phones) */}
      <div className="pointer-events-none fixed inset-0 z-20 bg-gradient-to-r from-black/0 via-black/20 to-black/55" />
      <aside
        ref={scroller}
        className={`drawer-in pointer-events-auto fixed bottom-0 right-0 top-0 z-30 overflow-y-auto border-l border-white/10 bg-[#060a12]/95 px-6 pb-8 pt-5 sm:px-8 ${
          sites ? 'w-[min(640px,48vw)] short:w-[50vw]' : 'w-[min(460px,94vw)]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          {site ? (
            <button
              onClick={() => setSiteIdx(null)}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:text-white"
            >
              ← {project.title}
            </button>
          ) : (
            <span className={label}>
              {project.index} / {project.tag}
            </span>
          )}
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:text-white"
          >
            {UI.close} ×
          </button>
        </div>

        {/* ---- one site in detail ---- */}
        {site && (
          <section className="mt-6 short:mt-3">
            <div className={label}>{site.kind}</div>
            <h2 className="mt-2 text-[30px] font-extralight leading-[1.05] tracking-tight text-white sm:text-[36px] short:text-[24px]">
              {site.name}
            </h2>
            <p className="mt-3 text-sm font-light leading-relaxed text-slate-300">{site.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href={site.url} target="_blank" rel="noreferrer" className={link}>
                {UI.openSite} ↗
              </a>
              <span className="font-mono text-[10px] tracking-wider text-slate-500">{site.domain}</span>
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

        {/* ---- site previews ---- */}
        {sites && !site && (
          <>
            <h2 className="mt-6 text-[32px] font-extralight leading-[1.05] tracking-tight text-white sm:text-[38px] short:mt-3 short:text-[24px]">
              {project.title}
            </h2>
            <p className="mt-3 text-sm font-light leading-relaxed text-slate-300 short:mt-1.5">{project.lead}</p>
            {project.note && <p className="mt-1.5 text-xs italic text-slate-500">{project.note}</p>}

            <ul className="mt-5 space-y-3 short:mt-3 short:space-y-2">
              {sites.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSiteIdx(i)}
                    className="group flex w-full gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-left transition hover:border-amber-300/50 hover:bg-white/[0.05]"
                  >
                    <span className="block aspect-[16/10] w-[42%] shrink-0 overflow-hidden rounded-md border border-white/10 bg-slate-900">
                      <img
                        src={s.slides[0]}
                        alt={s.name}
                        className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center py-1">
                      <span className="font-mono text-[10px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                      <span className="mt-0.5 text-[17px] font-light leading-tight text-white short:text-[15px]">
                        {s.name}
                      </span>
                      <span className="mt-1 text-[12px] font-light leading-snug text-slate-400 short:hidden">
                        {s.kind}
                      </span>
                      <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 transition group-hover:text-amber-200">
                        {UI.moreAbout} →
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ---- other stops: the project description ---- */}
        {!sites && (
          <>
            <h2 className="mt-6 text-[32px] font-extralight leading-[1.05] tracking-tight text-white sm:text-[38px] short:mt-3 short:text-[24px]">
              {project.title}
            </h2>
            <p className="mt-3 text-sm font-light leading-relaxed text-slate-300 short:mt-1.5">{project.lead}</p>
            {project.note && <p className="mt-1.5 text-xs italic text-slate-500">{project.note}</p>}

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
          </>
        )}

        <button
          onClick={onCta}
          className="mt-8 h-11 w-full border border-white/30 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-slate-950"
        >
          {project.cta} →
        </button>
      </aside>
    </>
  );
}
