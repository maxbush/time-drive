import { OWNER, UI } from '../content';

// Shown on a phone held in portrait. The world is paused meanwhile (it keeps loading).
export function RotateHint({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-7 bg-[#05070b] px-8 text-center">
      <svg
        className="rotate-hint h-24 w-24 text-amber-300"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="20" y="6" width="24" height="46" rx="4" />
        <line x1="29" y1="46" x2="35" y2="46" />
        <path d="M12 56c6 4 14 6 20 6s14-2 20-6" opacity="0.55" />
        <path d="M47 58l5-2-2-5" opacity="0.55" />
      </svg>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-300">{OWNER.name}</div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">{UI.rotateTitle}</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{UI.rotateText}</p>
      </div>
      <button onClick={onContinue} className="mt-2 text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300">
        {UI.rotateContinue}
      </button>
    </div>
  );
}
