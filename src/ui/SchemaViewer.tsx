import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI } from '../content';

// Full-screen viewer for a scheme: wheel zooms around the pointer, drag pans, double-click or
// the button resets, Esc / background click / × closes. (Touch: drag pans.)
export function SchemaViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // one stable listener (capture phase, so nothing else can swallow it); always calls the latest onClose
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Escape' || e.key === 'Escape')) closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const next = Math.min(5, Math.max(1, scale * Math.exp(-e.deltaY * 0.0015)));
    if (next === scale) return;
    // keep the point under the cursor fixed while zooming
    const cx = e.clientX - (r.left + r.width / 2);
    const cy = e.clientY - (r.top + r.height / 2);
    const k = next / scale;
    setPos((p) => (next === 1 ? { x: 0, y: 0 } : { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
    setScale(next);
  };

  // Rendered into <body>: inside the sliding panel (whose entrance animation makes it the
  // containing block of fixed children) the viewer was clipped to the panel's own width.
  return createPortal(
    <div
      ref={box}
      className="fixed inset-0 z-[45] touch-none select-none overflow-hidden bg-black/90"
      onWheel={onWheel}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false };
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        if (scale > 1) setPos({ x: d.px + dx, y: d.py + dy });
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setDragging(false);
        // a plain click on the dark background closes; a drag never does
        if (d && !d.moved && scale === 1) onClose();
      }}
      onDoubleClick={reset}
      style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
    >
      <div className="flex h-full w-full items-center justify-center p-3">
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[92vh] max-w-[96vw] rounded-lg"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <span className="rounded-full bg-black/45 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">
          Колесо: масштаб · перетаскивание: сдвиг · двойной клик: сброс
        </span>
        <button
          className="pointer-events-auto rounded-full bg-black/55 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:bg-black/80"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          {UI.close} ×
        </button>
      </div>
    </div>,
    document.body
  );
}