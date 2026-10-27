import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { OWNER, UI } from '../content';

// One thin line: the name and the current chapter on the left; contacts and a small
// "?" on the right. Text only, no boxes.
export function TopBar({
  onContact,
  touch,
  chapter,
}: {
  onContact: () => void;
  touch: boolean;
  chapter: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3 sm:px-8 sm:pt-5">
      <div className="pointer-events-auto flex min-w-0 items-center gap-3">
        <span className="whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.2em] text-white">
          {OWNER.name}
        </span>
        <span className="h-3 w-px shrink-0 bg-white/25" />
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-slate-300">{chapter}</span>
      </div>

      <div className="pointer-events-auto relative flex items-center gap-4">
        <button
          onClick={() => setHelpOpen((v) => !v)}
          aria-label={UI.help}
          title={UI.help}
          className="text-slate-400 transition hover:text-white"
        >
          <CircleHelp size={15} />
        </button>
        <button
          onClick={onContact}
          className="border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-amber-300 hover:text-amber-200"
        >
          {UI.contact}
        </button>

        {helpOpen && (
          <div className="absolute right-0 top-9 w-64 rounded-xl border border-white/10 bg-[#060a12]/94 p-3.5 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            {touch ? (
              <p className="leading-relaxed text-slate-300">{UI.helpTouch}</p>
            ) : (
              <ul className="space-y-1.5">
                {UI.helpItems.map(([k, v]) => (
                  <li key={k} className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[11px] text-amber-200">{k}</span>
                    <span className="text-right text-slate-400">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
