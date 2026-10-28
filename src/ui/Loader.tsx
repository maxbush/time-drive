import { useEffect, useRef, useState } from 'react';
import { OWNER, UI } from '../content';

// Full-screen loading screen as a speedometer: the needle climbs towards 88 MPH while the world
// loads. The needle, the arc and the progress line are CSS animations on the compositor (a
// time-based ease-out, see loader-rot / loader-scale in index.css), so they keep moving smoothly even
// when the main thread is busy building the world or compiling shaders. JavaScript only counts the
// number and, once the world is ready, brings the dial to the full 88 and lets the layer fade out.
export function Loader({ visible, pct, onSimple }: { visible: boolean; pct: number; onSimple?: () => void }) {
  void pct; // (the dial is time-driven; real progress only decides when it finishes)
  // After a while on a slow device offer the plain version instead of making people wait
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setSlow(true), 9000);
    return () => window.clearTimeout(t);
  }, [visible]);
  const needleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<SVGTextElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  // the number follows the same curve as the animations (it is the only part that needs JS)
  useEffect(() => {
    if (!visible) return;
    const t0 = performance.now();
    let shown = -1;
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.round(85 * (1 - Math.exp(-(now - t0) / 6500)));
      if (n !== shown && numRef.current) {
        shown = n;
        numRef.current.textContent = String(n);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // loaded: from wherever the animation is now, run up to the full 88 and fade out
  useEffect(() => {
    if (visible) return;
    const finish = (el: HTMLElement | null, to: string) => {
      if (!el) return;
      const cur = getComputedStyle(el).transform; // where the animation is right now
      el.style.animation = 'none';
      el.style.transform = cur === 'none' ? '' : cur;
      void el.offsetWidth; // commit the frozen position before the transition starts
      el.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1)';
      el.style.transform = to;
    };
    finish(needleRef.current, 'rotate(120deg)');
    finish(ringRef.current, 'rotate(120deg)');
    finish(barRef.current, 'scaleX(1)');
    if (numRef.current) numRef.current.textContent = '88';
  }, [visible]);

  // remove the layer completely once it has faded out
  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => setGone(true), 900);
    return () => window.clearTimeout(t);
  }, [visible]);
  if (gone) return null;

  const arcR = 80;
  // dial geometry: 240 deg sweep, from -120 to +120; arc from the lower left over the top to the lower right (240 deg), centre (100, 92)
  const arcStart = { x: 100 - arcR * Math.cos(Math.PI / 6), y: 92 + arcR * Math.sin(Math.PI / 6) };
  const arcEnd = { x: 100 + arcR * Math.cos(Math.PI / 6), y: arcStart.y };
  const arcD = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 1 1 ${arcEnd.x} ${arcEnd.y}`;

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

        <div className="relative mt-6 aspect-[200/150] w-72 sm:w-96">
          <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (150 + i * (240 / 11)) * (Math.PI / 180);
              const big = i % 2 === 0;
              const x1 = 100 + Math.cos(a) * 74;
              const y1 = 92 + Math.sin(a) * 74;
              const x2 = 100 + Math.cos(a) * (big ? 62 : 67);
              const y2 = 92 + Math.sin(a) * (big ? 62 : 67);
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
              d={arcD}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="3"
            />
            <text
              ref={numRef}
              x="100"
              y="128"
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="22"
              fontFamily="monospace"
              fontWeight="700"
            >
              0
            </text>
            <text
              x="100"
              y="141"
              textAnchor="middle"
              fill="rgba(148,163,184,0.8)"
              fontSize="8"
              fontFamily="monospace"
              letterSpacing="3"
            >
              MPH
            </text>
          </svg>

          {/* the filled arc: a ring (mask) limited to the 240 deg dial sector (mask), with a
              coloured wedge inside that is simply rotated by the same animation as the needle */}
          <div
            className="absolute"
            style={{
              left: '9.25%',
              top: '7%',
              width: '81.5%',
              aspectRatio: '1',
              WebkitMaskImage:
                'radial-gradient(closest-side, transparent 96.3%, #000 96.4% 99.9%, transparent 100%), conic-gradient(from -120deg, #000 0deg 240deg, transparent 240deg)',
              maskImage:
                'radial-gradient(closest-side, transparent 96.3%, #000 96.4% 99.9%, transparent 100%), conic-gradient(from -120deg, #000 0deg 240deg, transparent 240deg)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
            aria-hidden="true"
          >
            <div
              ref={ringRef}
              className="loader-rot absolute inset-0"
              style={{
                background:
                  'conic-gradient(from -240deg, #38bdf8 0deg, #f8fafc 170deg, #f59e0b 240deg, transparent 240deg)',
              }}
            />
          </div>

          {/* needle: HTML so its rotation + idle shake run on the compositor */}
          <div className="absolute" style={{ left: '50%', top: '61.333%' }}>
            <div ref={needleRef} className="loader-rot">
              <div className="needle-idle">
                <div
                  className="absolute h-[5.9rem] rounded-full bg-amber-500 sm:h-[7.87rem]"
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

        {/* progress line: the same eased value as the needle, drawn with a transform (no layout) */}
        <div className="relative mt-5 h-[3px] w-72 overflow-hidden rounded-full bg-white/10 sm:w-96" aria-hidden="true">
          <div
            ref={barRef}
            className="loader-scale absolute inset-0 origin-left rounded-full"
            style={{
              background: 'linear-gradient(90deg, #38bdf8, #f8fafc 70%, #f59e0b)',
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
          <span>{pct >= 90 ? UI.stageWarm : UI.stageCar}</span>
          <span>...</span>
        </div>
        {slow && onSimple && (
          <button
            onClick={onSimple}
            className="mt-5 border-b border-white/30 pb-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Долго грузится? Открыть простую версию →
          </button>
        )}
      </div>
    </div>
  );
}
