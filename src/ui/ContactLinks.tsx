import { useState } from 'react';
import { Check, Copy, Mail, Send } from 'lucide-react';
import { CONTACT } from '../content';

// Direct contacts (used while the web form has no key): Telegram and e-mail as two large rows,
// each with a link and a copy button. Shared by the space finale and the contact overlay.
export function ContactLinks({ subject, large = false }: { subject: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const tg = CONTACT.telegramUser;
  const mail = CONTACT.email;

  const copy = () => {
    navigator.clipboard?.writeText(mail).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => undefined
    );
  };

  const row = 'flex items-center gap-4 border-b border-white/12 py-3.5 first:pt-0 last:border-b-0 last:pb-0 compact:py-2.5 short:py-2';
  // (no truncation: the address must never be cut; it may break after the @ on a narrow screen)
  const valueCls = `min-w-0 whitespace-nowrap font-light text-white transition hover:text-sky-200 ${
    large ? 'text-[18px] short:text-[14px]' : 'text-base'
  }`;
  const label = 'w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400';

  return (
    <div>
      {tg && (
        <div className={row}>
          <Send size={14} className="shrink-0 text-sky-300" />
          <span className={label}>Telegram</span>
          <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className={valueCls}>
            @{tg}
          </a>
        </div>
      )}
      {mail && (
        <div className={row}>
          <Mail size={14} className="shrink-0 text-sky-300" />
          <span className={label}>Почта</span>
          <a href={`mailto:${mail}?subject=${encodeURIComponent(subject)}`} className={valueCls}>
            {mail}
          </a>
          <button
            onClick={copy}
            title={copied ? 'Скопировано' : 'Копировать адрес'}
            aria-label="Копировать адрес"
            className="ml-auto shrink-0 text-slate-400 transition hover:text-white"
          >
            {copied ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}