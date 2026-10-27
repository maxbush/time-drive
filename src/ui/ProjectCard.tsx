import { ArrowRight } from 'lucide-react';
import { ProjectContent, UI } from '../content';

// The stop card: a lower-third in the bottom-left corner. Number, title, one line,
// three tags, two actions. Everything else lives in the drawer ("Подробнее").
export function ProjectCard({
  project,
  onDetails,
  onDemo,
}: {
  project: ProjectContent;
  onDetails: () => void;
  onDemo: () => void;
}) {
  return (
    <aside className="card-in pointer-events-auto fixed bottom-16 left-4 z-20 w-[min(340px,calc(100vw-2rem))] sm:bottom-20 sm:left-6 sm:w-[380px] short:bottom-12 short:left-4 short:w-[300px]">
      <div className="rounded-2xl border border-white/10 bg-[#080c14]/82 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:p-5 short:p-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-medium text-amber-300 sm:text-3xl short:text-lg">{project.index}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{project.tag}</span>
        </div>

        <h2 className="mt-2 text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl short:mt-1 short:text-base">
          {project.title}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-[13px] short:line-clamp-2 short:text-[11px]">
          {project.lead}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5 short:hidden">
          {project.stack.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/12 px-2.5 py-0.5 font-mono text-[10px] text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 short:mt-2.5">
          <button
            onClick={onDetails}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-300 text-xs font-semibold text-slate-950 transition hover:bg-amber-200 short:h-8"
          >
            {UI.details} <ArrowRight size={14} />
          </button>
          <button
            onClick={onDemo}
            className="h-9 rounded-full border border-white/20 px-4 text-xs font-medium text-white transition hover:border-white/50 hover:bg-white/5 short:h-8 short:px-3"
          >
            {UI.requestDemo}
          </button>
        </div>
      </div>
    </aside>
  );
}
