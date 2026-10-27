import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ProjectContent, UI } from '../content';

// Right-hand drawer with the details of the current project. The scene stays
// visible on the left; Esc or the cross closes it.
export function ProjectDrawer({
  project,
  onClose,
  onDemo,
}: {
  project: ProjectContent;
  onClose: () => void;
  onDemo: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="drawer-in pointer-events-auto fixed bottom-14 right-0 top-14 z-30 w-[min(420px,92vw)] overflow-y-auto border-l border-white/10 bg-[#070b12]/94 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">
            {project.index} · {project.tag}
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
            {project.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label={UI.close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:border-white/40 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-300">{project.description}</p>

      {/* Media: real screenshots when they exist, otherwise a quiet placeholder */}
      {project.media.length > 0 ? (
        <div className="mt-5 space-y-3">
          {project.media.map((m) => (
            <figure key={m.src}>
              <img src={m.src} alt={m.caption} loading="lazy" className="w-full rounded-lg border border-white/10" />
              <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {m.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <ul className="mt-5 space-y-2">
        {project.points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm text-slate-200">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {project.stack.map((t) => (
          <span key={t} className="rounded-full border border-white/12 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
            {t}
          </span>
        ))}
      </div>

      <button
        onClick={onDemo}
        className="mt-6 h-10 w-full rounded-full bg-amber-300 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
      >
        {UI.requestDemo}
      </button>
    </aside>
  );
}
