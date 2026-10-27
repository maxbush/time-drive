import { FormEvent, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { CONTACT, UI } from '../content';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'unconfigured';

// The feedback form, shared by the contact overlay and the space finale.
// Destinations come from content.ts: Telegram / email links when configured, and the
// form itself posts to Web3Forms (-> email) when a key is set.
export function ContactForm({
  subject,
  compact = false,
  large = false,
}: {
  subject: string;
  compact?: boolean;
  large?: boolean;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const tgHref = CONTACT.telegramUser
    ? `https://t.me/${CONTACT.telegramUser}?text=${encodeURIComponent(subject)}`
    : '';
  const mailHref = CONTACT.email ? `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}` : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!CONTACT.web3formsKey) {
      setStatus('unconfigured');
      return;
    }
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

  const field = `w-full border-0 border-b border-white/20 bg-transparent px-0 font-light text-white placeholder:text-slate-400 focus:border-amber-300 focus:outline-none ${
    large ? 'py-3 text-base short:py-1.5 short:text-sm' : 'py-2 text-sm'
  }`;

  if (status === 'sent') {
    return (
      <div className="border-t border-emerald-400/40 pt-4">
        <div className="text-base font-light text-emerald-200">{UI.formSent}</div>
        <p className="mt-1 text-xs text-slate-300">{UI.formSentText}</p>
      </div>
    );
  }

  return (
    <div>
      {(tgHref || mailHref) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-sky-300 hover:text-sky-200"
            >
              <Send size={12} /> {UI.writeTelegram}
            </a>
          )}
          {mailHref && (
            <a
              href={mailHref}
              className="flex items-center gap-2 border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white transition hover:border-sky-300 hover:text-sky-200"
            >
              <Mail size={12} /> {UI.writeEmail}
            </a>
          )}
        </div>
      )}

      <form onSubmit={submit} className={compact ? 'space-y-1' : 'space-y-2'}>
        <input className={field} required value={name} onChange={(e) => setName(e.target.value)} placeholder={UI.formName} autoComplete="name" />
        <input className={field} required value={contact} onChange={(e) => setContact(e.target.value)} placeholder={UI.formContact} />
        <textarea
          className={`${field} resize-none`}
          rows={compact ? 2 : large ? 4 : 3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={UI.formMessage}
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="mt-3 border-b border-white/50 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-amber-300 hover:text-amber-200 disabled:opacity-50"
        >
          {status === 'sending' ? UI.formSending : `${UI.formSend} →`}
        </button>
        {status === 'error' && <p className="pt-2 text-xs text-rose-300">{UI.formError}</p>}
        {status === 'unconfigured' && <p className="pt-2 text-xs text-amber-200/90">{UI.formUnconfigured}</p>}
      </form>
    </div>
  );
}
