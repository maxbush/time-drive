import { OWNER, UI } from '../content';

// Full-screen loading screen: dark, a faint drifting grid, the name, one thin
// glowing progress line. Pure CSS; fades out when the world is ready.
export function Loader({ visible, pct }: { visible: boolean; pct: number }) {
  const shown = Math.max(4, Math.min(100, pct));
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#05070b] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="loader-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 52%, rgba(56,189,248,0.10), transparent 70%), radial-gradient(40% 30% at 50% 100%, rgba(251,191,36,0.08), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-amber-300/90">Time Drive</div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{OWNER.name}</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{OWNER.role}</p>

        <div className="mt-10 h-px w-64 overflow-hidden bg-white/10 sm:w-80 short:mt-6">
          <div
            className="h-full bg-gradient-to-r from-amber-300 via-white to-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)] transition-[width] duration-500 ease-out"
            style={{ width: `${shown}%` }}
          />
        </div>
        <div className="mt-4 flex w-64 items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500 sm:w-80">
          <span>{pct >= 100 ? UI.stageWarm : UI.stageCar}</span>
          <span className="text-slate-300">{pct > 0 ? `${Math.round(Math.min(100, pct))}%` : '···'}</span>
        </div>
      </div>
    </div>
  );
}
