import { CONTACT, OWNER, PROJECTS, SITES } from '../src/content';

// The static, JavaScript-free version of the portfolio (/simple/): for search engines and other
// robots, for weak devices and for visitors who just want to read it. Generated at build time from
// src/content.ts (the same single source of truth as the 3D world), together with schema.org data.

export const SITE_URL = 'https://maxbush.github.io/time-drive/';
export const SIMPLE_URL = SITE_URL + 'simple/';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PERSON_ID = SITE_URL + '#person';
const WEBSITE_ID = SITE_URL + '#website';

// What is offered. Every line is backed by the project texts in content.ts (no prices, no claims).
const SERVICES: { name: string; text: string }[] = [
  { name: 'Сайты под ключ', text: 'Структура и дизайн, вёрстка, анимация, формы и калькуляторы, публикация.' },
  { name: 'SEO', text: 'Структура, семантика, тексты и техническая оптимизация.' },
  { name: 'Telegram- и WhatsApp-боты', text: 'Сценарии, интеграции по API, роли и права, собственная база.' },
  { name: 'Автоматизация и аналитика', text: 'Сбор данных, расчёты, веб-панели и отчёты в Excel.' },
];

const SKILLS = ['Веб-разработка', 'Дизайн сайтов', 'SEO', 'Telegram-боты', 'WhatsApp-боты', 'Автоматизация', 'Аналитика данных'];

/** schema.org graph for the main (3D) page: who, and what the site is. */
export function mainJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: SITE_URL,
        name: 'TIME DRIVE — ' + OWNER.name,
        inLanguage: 'ru',
        publisher: { '@id': PERSON_ID },
      },
      person(),
    ],
  };
}

function person() {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: OWNER.name,
    url: SITE_URL,
    jobTitle: 'Веб-разработчик, разработка ботов и автоматизации',
    email: CONTACT.email,
    sameAs: [`https://t.me/${CONTACT.telegramUser}`],
    knowsAbout: SKILLS,
    makesOffer: SERVICES.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, description: s.text, provider: { '@id': PERSON_ID } },
    })),
  };
}

const abs = (rel: string) => SITE_URL + rel.replace(/^\.\//, '');

function simpleJsonLd() {
  const bots = [PROJECTS.albion, PROJECTS.tenders];
  const items = [
    ...SITES.map((s) => ({
      '@type': 'CreativeWork',
      name: s.name,
      url: s.url,
      description: `${s.kind}. ${s.description}`,
      image: abs(s.slides[0]),
      inLanguage: 'ru',
      creator: { '@id': PERSON_ID },
    })),
    ...bots.map((p) => ({
      '@type': 'SoftwareApplication',
      name: p.title,
      description: `${p.lead} ${p.description}`,
      applicationCategory: 'BusinessApplication',
      featureList: p.points,
      author: { '@id': PERSON_ID },
    })),
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE_URL, name: 'TIME DRIVE — ' + OWNER.name, inLanguage: 'ru', publisher: { '@id': PERSON_ID } },
      person(),
      {
        '@type': 'ProfilePage',
        '@id': SIMPLE_URL + '#page',
        url: SIMPLE_URL,
        name: `${OWNER.name}: сайты, боты и автоматизация`,
        description: 'Портфолио: сайты, боты и автоматизация. Дизайн и разработка в одних руках.',
        inLanguage: 'ru',
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
        primaryImageOfPage: { '@type': 'ImageObject', url: SITE_URL + 'og.jpg', width: 1200, height: 630 },
      },
      {
        '@type': 'ItemList',
        name: 'Проекты',
        itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TIME DRIVE', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Версия без 3D', item: SIMPLE_URL },
        ],
      },
    ],
  };
}

const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#05070b;color:#cbd5e1;font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
background-image:radial-gradient(60% 40% at 50% 0,rgba(56,189,248,.08),transparent 70%),radial-gradient(40% 30% at 50% 100%,rgba(251,191,36,.06),transparent 70%)}
a{color:inherit}.wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.skip{position:absolute;left:-999px;top:8px;background:#fbbf24;color:#05070b;padding:8px 12px;border-radius:6px;z-index:9}.skip:focus{left:8px}
.mono{font:500 11px/1.4 ui-monospace,"JetBrains Mono",Consolas,monospace;letter-spacing:.24em;text-transform:uppercase}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0}
.top .mono{color:#fbbf24}.top a{text-decoration:none;color:#94a3b8;transition:color .2s}.top a:hover,.top a:focus-visible{color:#fff}
h1{margin:48px 0 0;font-size:clamp(36px,7vw,64px);line-height:1.04;letter-spacing:-.02em;color:#fff;font-weight:600}
.role{margin:16px 0 0;color:#94a3b8}.lead{margin:28px 0 0;max-width:640px;font-size:clamp(18px,2.4vw,22px);font-weight:300;color:#cbd5e1}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin:32px 0 0}
.btn{display:inline-block;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:12px 22px;text-decoration:none;color:#fff;transition:border-color .2s,background .2s}
.btn:hover,.btn:focus-visible{border-color:#fbbf24;background:rgba(251,191,36,.08)}.btn.main{background:#fbbf24;border-color:#fbbf24;color:#05070b;font-weight:600}
.btn.main:hover,.btn.main:focus-visible{background:#fcd34d}
section{margin-top:72px}h2{margin:0;color:#94a3b8;font-weight:500}
.grid{display:grid;gap:16px;margin:24px 0 0;padding:0;list-style:none;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.card{display:block;height:100%;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025);overflow:hidden;text-decoration:none;transition:border-color .2s,transform .2s}
a.card:hover,a.card:focus-visible{border-color:rgba(251,191,36,.5);transform:translateY(-2px)}
.card img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;object-position:top;background:#0a0f18}
.card .b{padding:18px 20px 20px}.card h3{margin:0;color:#fff;font-size:20px;font-weight:400}.card .k{margin:4px 0 0;color:#94a3b8;font-size:14px}
.card p{margin:12px 0 0;font-size:15px;color:#aab6c6}.card .go{margin:14px 0 0;color:#e2e8f0}
.svcs{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}.sitegrid{grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))}
.svc{padding:20px}.svc h3{margin:0;color:#fff;font-size:18px;font-weight:500}.svc p{margin:8px 0 0;font-size:15px;color:#aab6c6}
.proj{margin-top:24px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025);padding:28px}
.proj h3{margin:8px 0 0;color:#fff;font-size:clamp(24px,4vw,32px);font-weight:300}.proj .l{margin:12px 0 0;color:#e2e8f0}.proj p{margin:12px 0 0;color:#aab6c6;font-size:15px}
.proj ul{margin:16px 0 0;padding-left:20px;color:#aab6c6;font-size:15px}.proj li{margin:4px 0}
.parts{display:grid;gap:10px;margin:20px 0 0;padding:0;list-style:none;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))}
.parts li{border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;margin:0}.parts b{display:block;color:#fde68a;font:500 11px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}
.parts span{display:block;margin-top:2px;color:#94a3b8;font-size:13px}
.stack{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}.stack li{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:3px 12px;margin:0;color:#94a3b8;font-size:12px}
.contact{margin-top:24px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025);padding:28px;display:flex;flex-wrap:wrap;gap:12px 28px;align-items:center;justify-content:space-between}
.contact p{margin:0;max-width:420px;color:#cbd5e1}
footer{margin:80px 0 40px;padding-top:24px;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;color:#64748b;font-size:13px}
footer a{color:#94a3b8}:focus-visible{outline:2px solid #fbbf24;outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/** The whole /simple/ page. Paths are relative to /simple/ (the sites screenshots live one level up). */
export function buildSimplePage(): string {
  const bots = [PROJECTS.albion, PROJECTS.tenders];
  const title = `${OWNER.name}: сайты, боты и автоматизация (версия без 3D)`;
  const desc =
    'Портфолио Максима Бушенко: дизайн и разработка сайтов, SEO, Telegram- и WhatsApp-боты, автоматизация и аналитика. Четыре последних сайта и два проекта-бота.';
  const tg = `https://t.me/${CONTACT.telegramUser}`;

  const sites = SITES.map(
    (s) => `<li><a class="card" href="${esc(s.url)}" target="_blank" rel="noopener">
<img src="${esc(s.slides[0].replace('./', '../'))}" alt="Скриншот сайта ${esc(s.name)}" width="800" height="500" loading="lazy" decoding="async">
<div class="b"><h3>${esc(s.name)}</h3><p class="k">${esc(s.kind)}</p><p>${esc(s.description)}</p><p class="go mono">Открыть сайт ↗</p></div></a></li>`
  ).join('\n');

  const services = SERVICES.map((s) => `<li class="card svc"><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p></li>`).join('\n');

  const botBlocks = bots
    .map(
      (p) => `<article class="proj" id="${p === PROJECTS.albion ? 'albion-bot' : 'tender-analytics'}">
<div class="mono" style="color:#fbbf24">${esc(p.index)} · ${esc(p.tag)}</div>
<h3>${esc(p.title)}</h3><p class="l">${esc(p.lead)}</p><p>${esc(p.description)}</p>
<ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${p.parts ? `<h4 class="mono" style="margin:24px 0 0;color:#64748b;font-weight:500">Из чего состоит</h4><ul class="parts">${p.parts.map(([n, r]) => `<li><b>${esc(n)}</b><span>${esc(r)}</span></li>`).join('')}</ul>` : ''}
<ul class="stack">${p.stack.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
</article>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(OWNER.name)}">
<meta name="theme-color" content="#05070b">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SIMPLE_URL}">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="icon" type="image/x-icon" href="../favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="TIME DRIVE">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SIMPLE_URL}">
<meta property="og:image" content="${SITE_URL}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_URL}og.jpg">
<script type="application/ld+json">${JSON.stringify(simpleJsonLd())}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#content">К содержимому</a>
<div class="wrap">
<header class="top"><span class="mono">Time Drive</span><a class="mono" href="../">Открыть 3D-версию →</a></header>
<main id="content">
<h1>${esc(OWNER.name)}</h1>
<p class="role mono">${esc(OWNER.role)}</p>
<p class="lead">Сайты, боты и автоматизация. Дизайн и разработка в одних руках: от макета до публикации.</p>
<p class="cta"><a class="btn main" href="${tg}" target="_blank" rel="noopener">Написать в Telegram</a><a class="btn" href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a><a class="btn" href="../">3D-путешествие по проектам</a></p>

<section aria-labelledby="services-h"><h2 class="mono" id="services-h">Чем занимаюсь</h2>
<ul class="grid svcs">${services}</ul></section>

<section aria-labelledby="sites-h"><h2 class="mono" id="sites-h">${esc(PROJECTS.web.tag)} · ${esc((PROJECTS.web.note ?? '').replace('.', ''))}</h2>
<p style="margin:12px 0 0;max-width:640px">${esc(PROJECTS.web.lead)}</p>
<ul class="grid sitegrid">${sites}</ul></section>

<section aria-labelledby="bots-h"><h2 class="mono" id="bots-h">Автоматизация, боты и аналитика</h2>
${botBlocks}</section>

<section aria-labelledby="contact-h"><h2 class="mono" id="contact-h">Контакты</h2>
<div class="contact"><p>Расскажите о задаче: обсудим и покажем демо.</p><p class="cta" style="margin:0"><a class="btn main" href="${tg}" target="_blank" rel="noopener">Telegram @${esc(CONTACT.telegramUser)}</a><a class="btn" href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a></p></div></section>
</main>
<footer><span>© ${esc(OWNER.name)}</span><span><a href="../">Интерактивное 3D-портфолио</a></span></footer>
</div>
</body>
</html>
`;
}
