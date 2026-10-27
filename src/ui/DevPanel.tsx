import { CameraMode, WORLD_ZONES, WorldSceneEngine, WorldTelemetry } from '../world/WorldScene';

// Developer-only controls (?dev). The old camera / mood / zone buttons live here so
// the public interface stays clean.
export function DevPanel({ engine, t }: { engine: WorldSceneEngine | null; t: WorldTelemetry }) {
  const modes: { id: CameraMode; label: string }[] = [
    { id: 'chase', label: 'Chase' },
    { id: 'cinematic-low', label: 'Low' },
    { id: 'orbit', label: 'Orbit' },
  ];
  return (
    <div className="pointer-events-auto fixed left-3 top-16 z-30 w-56 rounded-xl border border-white/10 bg-black/70 p-3 font-mono text-[10px] text-slate-300">
      <div className="mb-2 text-emerald-400">
        {t.fps} FPS · {t.drawCalls} DC · {(t.triangles / 1e6).toFixed(1)}M△
      </div>
      <div className="mb-2 text-slate-500">{t.profile}</div>
      <div className="mb-2 flex gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => engine?.setCameraMode(m.id)}
            className={`rounded px-2 py-1 ${t.cameraMode === m.id ? 'bg-sky-400 text-slate-950' : 'bg-white/10'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="mb-2 flex items-center gap-2">
        dusk
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={t.duskDepth}
          onChange={(e) => engine?.setDuskDepth(parseFloat(e.target.value))}
          className="w-28 accent-amber-400"
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        {WORLD_ZONES.map((z, i) => (
          <button
            key={z.id}
            onClick={() => engine?.jumpToZone(z.id)}
            className={`truncate rounded px-2 py-1 text-left ${t.activeZoneId === z.id ? 'bg-amber-400 text-slate-950' : 'bg-white/10'}`}
          >
            {i + 1} · {z.id.replace('cluster', 'c')}
          </button>
        ))}
      </div>
    </div>
  );
}
