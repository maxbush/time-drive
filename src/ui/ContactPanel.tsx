import { FormEvent, useEffect, useState } from 'react';
import { Mail, Send, X } from 'lucide-react';
import { CONTACT, OWNER, UI } from '../content';

type Status = 'idle' | 'sending' | 'sent' | 'error';

// Contact overlay. The world stays paused behind it. Only the destinations that are
// configured in content.ts are shown; the form posts to Web3Forms (-> email).
export function ContactPanel({ subject, onClose }: { subject: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSend = !!CONTACT.web3formsKey;
  const tgHref = CONTACT.telegramUser
    ? `https://t.me/${CONTACT.telegramUser}?text=${encodeURIComponent(subject)}`
    : '';
  const mailHref = CONTACT.email
    ? `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`
    : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: CONTACT.web3formsKey,
          subject,
          from_name: name,
          name,
          contact,
          message,
          botcheck: '',
        }),
      });
      const data = await res.json();
      setStatus(data.success ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const input =
    'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-300/70 focus:outline-none';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="panel-in max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#080c14] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.7)] sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">{subject}</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{OWNER.name}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={UI.close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:border-white/40 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {(tgHref || mailHref) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tgHref && (
              <a
                href={tgHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center gap-2 rounded-full bg-sky-400 px-4 text-xs font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                <Send size={14} /> {UI.writeTelegram}
              </a>
            )}
            {mailHref && (
              <a
                href={mailHref}
                className="flex h-9 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-medium text-white transition hover:border-white/50"
              >
                <Mail size={14} /> {UI.writeEmail}
              </a>
            )}
          </div>
        )}

        {canSend && status !== 'sent' && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              className={input}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={UI.formName}
              autoComplete="name"
            />
            <input
              className={input}
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={UI.formContact}
            />
            <textarea
              className={`${input} resize-none`}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={UI.formMessage}
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="h-10 w-full rounded-full bg-amber-300 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
            >
              {status === 'sending' ? UI.formSending : UI.formSend}
            </button>
            {status === 'error' && <p className="text-xs text-rose-300">{UI.formError}</p>}
          </form>
        )}

        {status === 'sent' && (
          <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div className="text-sm font-semibold text-emerald-200">{UI.formSent}</div>
            <p className="mt-1 text-xs text-slate-300">{UI.formSentText}</p>
          </div>
        )}

        {!canSend && !tgHref && !mailHref && (
          <p className="mt-5 text-sm text-slate-400">Контакты скоро появятся здесь.</p>
        )}
      </div>
    </div>
  );
}
