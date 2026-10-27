import { useState } from 'react';
import { CircleHelp, MessageSquare } from 'lucide-react';
import { OWNER, UI } from '../content';

// Minimal top bar: who this is on the left; contacts + a tiny "?" on the right.
export function TopBar({ onContact, touch }: { onContact: () => void; touch: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
      <div className="pointer-events-auto">
        <div className="text-sm font-semibold tracking-tight text-white sm:text-base">{OWNER.name}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">{OWNER.role}</div>
      </div>

      <div className="pointer-events-auto relative flex items-center gap-2">
        <button
          onClick={() => setHelpOpen((v) => !v)}
          aria-label={UI.help}
          title={UI.help}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/12 bg-[#0a0e16]/70 text-slate-300 transition hover:border-white/30 hover:text-white"
        >
          <CircleHelp size={16} />
        </button>
        <button
          onClick={onContact}
          className="flex h-8 items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/10 px-3.5 text-xs font-medium text-amber-100 transition hover:bg-amber-300 hover:text-slate-950"
        >
          <MessageSquare size={14} />
          {UI.contact}
        </button>

        {helpOpen && (
          <div className="absolute right-0 top-10 w-64 rounded-xl border border-white/10 bg-[#0a0e16]/92 p-3.5 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
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
