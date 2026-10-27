import { useEffect, useRef, useState } from 'react';
import { OWNER, UI } from '../content';

// Full-screen loading screen as a speedometer: the needle climbs 0 → 88 MPH
// while assets load. The displayed speed is smoothed toward the real progress
// and never visually stalls — between updates it creeps at a crawl and the
// needle jitters like an idling engine, so the screen always feels alive.
export function Loader({ visible, pct }: { visible: boolean; pct: number }) {
  const [speed, setSpeed] = useState(0);
  const speedRef = useRef(0);
  const pctRef = useRef(pct);
  pctRef.current = pct;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = Math.max(6, Math.min(88, (pctRef.current / 100) * 88));
      const cur = speedRef.current;
      // Chase the real progress, but never stand still: minimum crawl ~4 mph/s.
      let next = cur + (target - cur) * 0.06;
      if (next < target - 0.4 && target - cur < 0.4) next = cur + 0.02; // idle creep
      speedRef.current = next;
      setSpeed(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Dial geometry: 240° sweep, from -120° to +120°.
  const needleAngle = -120 + (speed / 88) * 240;
  const jitter = Math.sin(speedRef.current * 9 + performance.now() / 90) * 0.6;
  const arcR = 86;
  const arcLen = Math.PI * arcR * (240 / 180);

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
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{OWNER.name}</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{OWNER.role}</p>

        <svg viewBox="0 0 200 128" className="mt-6 w-72 sm:w-96" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (-120 + i * (240 / 11)) * (Math.PI / 180);
            const big = i % 2 === 0;
            const x1 = 100 + Math.cos(a) * 78, y1 = 108 + Math.sin(a) * 78;
            const x2 = 100 + Math.cos(a) * (big ? 66 : 71), y2 = 108 + Math.sin(a) * (big ? 66 : 71);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i >= 9 ? '#f59e0b' : 'rgba(255,255,255,0.28)'}
                strokeWidth={big ? 2 : 1}
              />
            );
          })}
          <path
            d={`M ${100 - arcR} 108 A ${arcR} ${arcR} 0 1 1 ${100 + arcR} 108`}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="3"
          />
          <path
            d={`M ${100 - arcR} 108 A ${arcR} ${arcR} 0 1 1 ${100 + arcR} 108`}
            fill="none"
            stroke="url(#speedGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(speed / 88) * arcLen} ${arcLen}`}
          />
          <defs>
            <linearGradient id="speedGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="70%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <g transform={`rotate(${needleAngle + jitter} 100 108)`}>
            <line x1="100" y1="108" x2="100" y2="34" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="108" r="5" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
          </g>
          <text x="100" y="86" textAnchor="middle" fill="#f8fafc" fontSize="24" fontFamily="monospace" fontWeight="700">
            {Math.round(speed)}
          </text>
          <text x="100" y="100" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="8" fontFamily="monospace" letterSpacing="3">
            MPH
          </text>
        </svg>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
          {pct >= 100 ? UI.stageWarm : UI.stageCar}
        </div>
      </div>
    </div>
  );
}
