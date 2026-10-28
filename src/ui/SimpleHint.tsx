import { UI } from '../content';

// A quiet offer of the light, script-free version (/simple/). Shown once per visit when the device
// looks weak (lighter profile at start, or the frame rate stays low), never over a panel.
export function SimpleHint({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      className="card-in pointer-events-auto fixed bottom-16 left-4 z-[37] flex max-w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-white/15 bg-[#060a12]/85 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:bottom-20 sm:left-8"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-light leading-snug text-slate-200">{UI.hintText}</div>
        <a
          href="./simple/"
          className="mt-2 inline-block border-b border-white/40 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition hover:border-amber-300 hover:text-amber-200"
        >
          {UI.hintOpen} →
        </a>
      </div>
      <button
        onClick={onClose}
        aria-label={UI.close}
        className="-mr-1 -mt-1 shrink-0 rounded p-1 font-mono text-[14px] leading-none text-slate-400 transition hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
