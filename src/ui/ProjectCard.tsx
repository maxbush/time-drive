import { ProjectContent, UI } from '../content';

const link =
  'border-b border-white/35 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-amber-300 hover:text-amber-200';

// The stop card, editorial style: a hairline index, a light large title, a short line,
// then text links. It sits on a semi-transparent plate for legibility over any scene.
// The website stop lists the real client sites; picking one switches the stand.
export function ProjectCard({
  project,
  webSite,
  onPickSite,
  onDetails,
  onCta,
}: {
  project: ProjectContent;
  webSite: number;
  onPickSite: (i: number) => void;
  onDetails: () => void;
  onCta: () => void;
}) {
  const sites = project.sites;
  const activeSite = sites ? sites[webSite] : null;

  return (
    <aside
      className={`card-in pointer-events-auto fixed bottom-16 z-20 w-[min(410px,calc(100vw-2rem))] sm:bottom-20 short:bottom-12 short:w-[330px] ${
        project.side === 'right' ? 'right-4 sm:right-8 short:right-4' : 'left-4 sm:left-8 short:left-4'
      }`}
    >
      <div className="rounded-xl border border-white/10 bg-[#060a12]/72 px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:px-6 short:px-4 short:py-3">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
          <span className="text-amber-200">{project.index}</span>
          <span className="h-px w-8 bg-white/25" />
          <span>{project.tag}</span>
        </div>

        <h2 className="mt-3 text-[28px] font-extralight leading-[1.06] tracking-tight text-white sm:text-[34px] short:mt-2 short:text-[22px]">
          {project.title}
        </h2>
        <p className="mt-2 text-[13px] font-light leading-relaxed text-slate-300 short:hidden">{project.lead}</p>
        {project.note && (
          <p className="mt-1.5 text-[11px] italic text-slate-500 short:mt-1">{project.note}</p>
        )}

        {sites ? (
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10 short:mt-2.5">
            {sites.map((s, i) => {
              const active = i === webSite;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => onPickSite(i)}
                    className={`flex w-full items-center gap-3 py-2 text-left transition short:py-1.5 ${
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-widest text-slate-500">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-light short:text-[13px]">{s.name}</span>
                      <span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500 short:hidden">
                        {s.kind}
                      </span>
                    </span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                        active ? 'bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]' : 'bg-white/15'
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 short:hidden">
            {project.stack.slice(0, 3).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 short:mt-2.5">
          <button onClick={onDetails} className={link}>
            {UI.details} ↗
          </button>
          {activeSite ? (
            <a href={activeSite.url} target="_blank" rel="noreferrer" className={link}>
              {UI.openSite} ↗
            </a>
          ) : (
            <button onClick={onCta} className={link}>
              {project.cta}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
