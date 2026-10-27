import { useEffect } from 'react';
import { OWNER, UI } from '../content';
import { ContactForm } from './ContactForm';

// Contact overlay. The world stays paused behind it.
export function ContactPanel({ subject, onClose }: { subject: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="panel-in max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#070b12] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.7)] sm:p-7"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">{subject}</span>
          <button
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:text-white"
          >
            {UI.close} ×
          </button>
        </div>
        <h2 className="mt-5 text-[28px] font-extralight leading-tight tracking-tight text-white">{OWNER.name}</h2>
        <div className="mt-5">
          <ContactForm subject={subject} />
        </div>
      </div>
    </div>
  );
}
