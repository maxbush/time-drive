import { CONTACT, OWNER, PROJECTS, SITES } from '../content';
import { ContactLinks } from './ContactLinks';

export type SimpleReason = 'nowebgl' | 'error' | 'manual';

const NOTE: Record<SimpleReason, string | null> = {
  nowebgl: 'Для 3D-версии нужен WebGL, а в этом браузере он недоступен. Ниже короткая версия того же портфолио.',
  error: 'Не получилось запустить 3D-версию. Ниже короткая версия того же портфолио.',
  manual: null,
};

// The compact, plain version of the portfolio: shown when the 3D world cannot run (no WebGL,
// a crash) or on request (?simple, the link on a slow loading screen). Also a crawlable page.
export function SimpleSite({ reason, onTry3d }: { reason: SimpleReason; onTry3d: () => void }) {
  const note = NOTE[reason];
  const bots = [PROJECTS.albion, PROJECTS.tenders];
  const label = 'font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500';

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#05070b] text-slate-200">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:pt-16">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-amber-300/90">Time Drive</div>
          {/* (a div, not an h1: the page's real h1 is in the static content of index.html) */}
          <div className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{OWNER.name}</div>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-400">{OWNER.role}</p>
          <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-slate-300">
            Сайты, боты и автоматизация. Дизайн и разработка в одних руках: от макета до публикации.
          </p>
          {note && (
            <p className="mt-6 rounded-lg border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm font-light text-amber-100/90">
              {note}
            </p>
          )}
        </header>

        <section className="mt-14" aria-labelledby="sites-title">
          <h2 id="sites-title" className={label}>
            {PROJECTS.web.title} · {PROJECTS.web.note?.replace('.', '')}
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {SITES.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-amber-300/50"
                >
                  <img
                    src={s.slides[0]}
                    alt={s.name}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover object-top"
                  />
                  <div className="p-4">
                    <div className="text-lg font-light text-white">{s.name}</div>
                    <div className="mt-1 text-sm font-light text-slate-400">{s.kind}</div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300 transition group-hover:text-amber-200">
                      Открыть сайт ↗
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {bots.map((p) => (
          <section key={p.index} className="mt-14" aria-labelledby={`p-${p.index}`}>
            <h2 id={`p-${p.index}`} className={label}>
              {p.index} / {p.tag}
            </h2>
            <div className="mt-3 text-3xl font-extralight tracking-tight text-white">{p.title}</div>
            <p className="mt-3 text-base font-light leading-relaxed text-slate-300">{p.lead}</p>
            <p className="mt-3 text-sm font-light leading-relaxed text-slate-400">{p.description}</p>
            {p.parts && (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {p.parts.map(([name, role]) => (
                  <li key={name} className="rounded-md border border-white/10 bg-white/[0.025] px-3 py-2.5">
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-amber-100">{name}</div>
                    <div className="mt-1 text-[13px] font-light text-slate-400">{role}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-14" aria-labelledby="contact-title">
          <h2 id="contact-title" className={label}>
            Контакты
          </h2>
          <div className="mt-5 max-w-lg rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <ContactLinks subject="Обсудить проект" large />
          </div>
          <p className="mt-3 text-xs font-light text-slate-500">
            Telegram @{CONTACT.telegramUser} · {CONTACT.email}
          </p>
        </section>

        {reason !== 'nowebgl' && (
          <button
            onClick={onTry3d}
            className="mt-14 border-b border-white/40 pb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:border-amber-300 hover:text-amber-200"
          >
            Открыть 3D-версию →
          </button>
        )}
      </div>
    </div>
  );
}