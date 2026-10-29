import { useEffect, useRef, useState } from 'react';
import { ProjectContent, SiteContent, UI } from '../content';
import { renderStandImageAsync, StandOptions } from '../world/standTexture';
import { SchemaViewer } from './SchemaViewer';

const label = 'font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500';
const link =
  'border-b border-white/35 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-amber-300 hover:text-amber-200';

// Side panel of a stop: full height on the right, about a third to a half of the screen.
// The website stop opens it by itself on arrival: previews of the sites first, and a
// click expands into a near-fullscreen live window (real iframe, real resolution) so
// the site reads exactly as in a browser. The other stops open it from "Подробнее"
// with the project description and its components. Esc steps back / closes.
export function ProjectDrawer({
  project,
  onClose,
  onCta,
  onLive,
  schema,
  lowEnd = false,
}: {
  lowEnd?: boolean; // weak device: the scheme image is drawn smaller (about 250 ms of main-thread work at 2.4x on a laptop)
  schema?: StandOptions;
  project: ProjectContent;
  onClose: () => void;
  onCta: () => void;
  onLive: (live: boolean) => void;
}) {
  const scroller = useRef<HTMLElement | null>(null);
  const [siteIdx, setSiteIdx] = useState<number | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  // The live site is attached only after the panel has finished opening: parsing a heavy page
  // right at the click froze the opening animation for a third of a second.
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  // the board of the stop, redrawn large for reading (software stops only)
  const [schemaUrl, setSchemaUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!schema) return;
    let dead = false;
    const fonts = document.fonts
      ? Promise.race([
          Promise.all([
            document.fonts.load('200 20px "Inter Variable"'),
            document.fonts.load('300 14px "Inter Variable"'),
            document.fonts.load('400 16px "JetBrains Mono"'),
            document.fonts.load('500 16px "JetBrains Mono"'),
          ]),
          new Promise((r) => setTimeout(r, 1500)),
        ])
      : Promise.resolve();
    let url: string | null = null;
    let timer = 0;
    fonts.then(() => {
      // after the panel's slide-in, so drawing the big image never stutters the animation
      timer = window.setTimeout(() => {
        if (dead) return;
        renderStandImageAsync(schema, lowEnd ? 1.5 : 2.4)
          .then((u) => {
            url = u;
            if (dead) URL.revokeObjectURL(u);
            else setSchemaUrl(u);
          })
          .catch(() => undefined);
      }, 520);
    });
    return () => {
      dead = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [schema]);
  const sites = project.sites;
  const site: SiteContent | null = sites && siteIdx !== null ? sites[siteIdx] : null;

  const openSite = (i: number) => {
    setFrameLoaded(false);
    setSiteIdx(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.code === 'Escape' || e.key === 'Escape')) return;
      if (zoom) return; // the viewer handles its own Esc
      if (site) setSiteIdx(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, site, zoom]);

  useEffect(() => {
    setFrameSrc(null);
    if (!site) return;
    const t = window.setTimeout(() => setFrameSrc(site.url), 480);
    return () => clearTimeout(t);
  }, [site]);

  // A live site shares the page's main thread: freeze the 3D world while it is shown.
  useEffect(() => {
    onLive(site !== null);
    return () => onLive(false);
  }, [site, onLive]);

  // switching between list and a site starts from the top
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [siteIdx]);

  // Site detail = near-fullscreen live window; everything else = right drawer.
  // (the panel sits opposite the stand of the stop: the tender stand is on the right, so its panel is left)
  const left = project.side === 'left' && !site;
  const panelCls = site
    ? 'fixed inset-2 sm:inset-4 z-30 rounded-xl border border-white/15 flex flex-col bg-[#060a12]/97'
    : `fixed bottom-0 top-0 z-30 flex w-[min(680px,50vw)] flex-col overflow-y-auto border-white/10 bg-[#060a12]/95 px-6 pb-24 pt-5 short:w-[52vw] sm:px-8 ${
        left ? 'left-0 border-r' : 'right-0 border-l'
      }`;

  return (
    <>
      {/* soft dim over the scene next to the panel (no blur: it is expensive on phones) */}
      <div
        className={`pointer-events-none fixed inset-0 z-20 ${
          site ? 'bg-black/60' : left ? 'bg-gradient-to-l from-black/0 via-black/20 to-black/55' : 'bg-gradient-to-r from-black/0 via-black/20 to-black/55'
        }`}
      />
      <aside ref={scroller} className={`${left ? 'drawer-in-left' : 'drawer-in'} pointer-events-auto ${panelCls}`}>
        <div
          className={`flex shrink-0 items-center justify-between border-b border-white/10 ${
            site ? 'px-5 py-3' : 'pb-3'
          }`}
        >
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
          <div className="flex items-center gap-5">
            {site && (
              <a href={site.url} target="_blank" rel="noreferrer" className={link}>
                {UI.openSite} ↗
              </a>
            )}
            <button
              onClick={onClose}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:text-white"
            >
              {UI.close} ×
            </button>
          </div>
        </div>

        {/* ---- one site in detail: near-fullscreen live window ---- */}
        {site && (
          <section className="flex min-h-0 flex-1 flex-col px-5 pb-4">
            <div className="flex items-center gap-4 py-3">
              <div className="flex min-w-0 items-baseline gap-3">
                <span className={label}>{site.kind}</span>
                <h2 className="truncate text-lg font-light leading-none tracking-tight text-white">
                  {site.name}
                </h2>
                <span className="hidden font-mono text-[10px] tracking-wider text-slate-600 sm:block">
                  {site.domain}
                </span>
              </div>
              <p className="ml-auto hidden max-w-md truncate text-[12px] font-light text-slate-400 lg:block">
                {site.highlight ?? site.description}
              </p>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-white/15 bg-white">
              <div className="flex shrink-0 items-center gap-1.5 bg-slate-800 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                <span className="ml-3 truncate font-mono text-[10px] text-slate-300">{site.domain}</span>
              </div>
              {!frameLoaded && (
                <div className="absolute inset-x-0 top-9 bottom-0 flex flex-col items-center justify-center gap-4 overflow-hidden bg-[#0a0f18] font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">
                  {/* Starting a live page costs the browser a few tenths of a second (a new frame, sometimes a
                      new process). A transform animation runs on the compositor, so this bar keeps sliding
                      smoothly through that stall instead of freezing with the page. */}
                  <span className="site-sweep relative block h-[2px] w-40 overflow-hidden rounded-full bg-white/10" aria-hidden="true" />
                  Загружаем сайт…
                </div>
              )}
              {frameSrc && (
              <iframe
                key={site.id}
                src={frameSrc}
                title={site.name}
                referrerPolicy="no-referrer"
                // third-party pages: scripts and forms work, but they cannot navigate the portfolio itself
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                onLoad={() => setFrameLoaded(true)}
                className="min-h-0 w-full flex-1 border-0 bg-[#0a0f18]"
              />
              )}
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
                    onClick={() => openSite(i)}
                    className="group flex w-full gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-left transition hover:border-amber-300/50 hover:bg-white/[0.05]"
                  >
                    <span className="block aspect-[16/10] w-[40%] shrink-0 overflow-hidden rounded-md border border-white/10 bg-slate-900">
                      <img
                        src={s.slides[0]}
                        alt={s.name}
                        decoding="async"
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

            {schema && (
              <figure className="schema-pop mt-5">
                {schemaUrl ? (
                  <button
                    onClick={() => setZoom(true)}
                    className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-white/10 transition hover:border-amber-300/50"
                  >
                    <img src={schemaUrl} alt={project.title} className="block w-full" />
                  </button>
                ) : (
                  <div className="aspect-[16/9] w-full rounded-lg border border-white/10 bg-white/[0.02]" />
                )}
                <figcaption className={`${label} mt-2 text-center`}>Схема системы · нажмите, чтобы увеличить</figcaption>
              </figure>
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

            {project.parts && (
              <section className="mt-7">
                <h3 className={label}>{UI.partsTitle}</h3>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {project.parts.map(([name, role]) => (
                    <li key={name} className="rounded-md border border-white/10 bg-white/[0.025] px-3 py-2.5">
                      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-amber-100">{name}</div>
                      <div className="mt-1 text-[12px] font-light leading-snug text-slate-400">{role}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-7">
              <h3 className={label}>Что умеет</h3>
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

        {zoom && schemaUrl && <SchemaViewer src={schemaUrl} alt={project.title} onClose={() => setZoom(false)} />}

        {!site && (
          <button
            onClick={onCta}
            className="mt-6 h-11 w-full shrink-0 border border-white/30 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-slate-950"
          >
            {project.cta} →
          </button>
        )}
      </aside>
    </>
  );
}
