import { useEffect, useRef, useState } from 'react';
import { OWNER, UI } from '../content';

// Full-screen loading screen as a speedometer: the needle climbs 0 -> 88 MPH while the assets
// load. While the page loads, the main thread is repeatedly blocked (decoding the car, building
// the city, compiling shaders), so everything that has to keep moving is a CSS transform /
// opacity animation: those run on the compositor and do not freeze with JavaScript. That is the
// idling needle, the scrolling road dashes, the drifting grid and the pulsing glow. Only the
// number and the arc are updated from JS (10 times a second, smoothed toward real progress).
export function Loader({ visible, pct }: { visible: boolean; pct: number }) {
  const [speed, setSpeed] = useState(0);
  const speedRef = useRef(0);
  const pctRef = useRef(pct);
  pctRef.current = pct;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      const target = Math.max(6, Math.min(88, (pctRef.current / 100) * 88));
      const cur = speedRef.current;
      let next = cur + (target - cur) * 0.2;
      if (target - next < 0.15) next = target;
      speedRef.current = next;
      setSpeed((s) => (Math.abs(s - next) < 0.05 ? s : next));
    }, 100);
    return () => window.clearInterval(id);
  }, [visible]);

  // remove the layer completely once it has faded out
  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => setGone(true), 900);
    return () => window.clearTimeout(t);
  }, [visible]);
  if (gone) return null;

  // Dial geometry: 240 deg sweep, from -120 to +120.
  const needleAngle = -120 + (speed / 88) * 240;
  const arcR = 86;
  const arcLen = Math.PI * arcR * (240 / 180);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#05070b] transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* static backdrop (nothing full-screen is animated: cheap even on a weak GPU) */}
      <div className="loader-grid-wrap absolute inset-0 opacity-60" aria-hidden="true">
        <div className="loader-grid" />
      </div>
      <div className="loader-fade absolute inset-0" aria-hidden="true" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 52%, rgba(56,189,248,0.07), transparent 70%), radial-gradient(40% 30% at 50% 100%, rgba(251,191,36,0.08), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-[40%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(56,189,248,0.10), transparent)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-amber-300/90">Time Drive</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{OWNER.name}</h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{OWNER.role}</p>

        <div className="relative mt-6 aspect-[200/128] w-72 sm:w-96">
          <svg viewBox="0 0 200 128" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (-120 + i * (240 / 11)) * (Math.PI / 180);
              const big = i % 2 === 0;
              const x1 = 100 + Math.cos(a) * 78;
              const y1 = 108 + Math.sin(a) * 78;
              const x2 = 100 + Math.cos(a) * (big ? 66 : 71);
              const y2 = 108 + Math.sin(a) * (big ? 66 : 71);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
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
            <text x="100" y="86" textAnchor="middle" fill="#f8fafc" fontSize="24" fontFamily="monospace" fontWeight="700">
              {Math.round(speed)}
            </text>
            <text
              x="100"
              y="100"
              textAnchor="middle"
              fill="rgba(148,163,184,0.8)"
              fontSize="8"
              fontFamily="monospace"
              letterSpacing="3"
            >
              MPH
            </text>
          </svg>

          {/* needle: HTML so its rotation + idle shake run on the compositor */}
          <div className="absolute" style={{ left: '50%', top: '84.375%' }}>
            <div style={{ transform: `rotate(${needleAngle}deg)`, transition: 'transform 0.5s linear' }}>
              <div className="needle-idle">
                <div
                  className="absolute h-[6.66rem] rounded-full bg-amber-500 sm:h-[8.88rem]"
                  style={{ width: 3, left: -1.5, bottom: 0 }}
                />
              </div>
            </div>
            <div
              className="absolute rounded-full border-[1.5px] border-amber-500 bg-slate-900"
              style={{ width: 12, height: 12, left: -6, top: -6 }}
            />
          </div>
        </div>

        {/* road dashes flying past: never stops, whatever the page is doing */}
        <div className="relative mt-5 h-[3px] w-72 overflow-hidden sm:w-96" aria-hidden="true">
          <div
            className="loader-road absolute inset-y-0 left-0"
            style={{
              width: 'calc(100% + 46px)',
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(245,158,11,0.75) 0 24px, transparent 24px 46px)',
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
          <span>{pct >= 100 ? UI.stageWarm : UI.stageCar}</span>
          <span>...</span>
        </div>
      </div>
    </div>
  );
}
