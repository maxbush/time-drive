import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { CONTACT, OWNER, PROJECTS, SITES } from './src/content';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The page content that crawlers and screen readers get, generated from the same src/content.ts the
// 3D world uses (one source of truth), plus schema.org data. Injected into index.html at build time.
function seoPlugin(): Plugin {
  return {
    name: 'time-drive-seo',
    transformIndexHtml(html, ctx) {
      // The fonts the first screen needs, found among the hashed build files, are fetched at once
      // instead of when the first piece of text asks for them (a late font swap = a visible jump).
      const fonts = Object.keys(ctx.bundle ?? {})
        .filter((f) => /(inter-(latin|cyrillic)-wght|jetbrains-mono-(latin|cyrillic)-(400|500))-normal-[\w-]+\.woff2$/.test(f))
        .map((f) => `<link rel="preload" href="./${f}" as="font" type="font/woff2" crossorigin />`)
        .join('\n    ');
      const siteItems = SITES.map(
        (s) => `<li><a href="${esc(s.url)}">${esc(s.name)}</a>: ${esc(s.kind)}. ${esc(s.description)}</li>`
      ).join('');
      const bot = (p: (typeof PROJECTS)[keyof typeof PROJECTS]) =>
        `<section><h2>${esc(p.title)}</h2><p>${esc(p.lead)}</p><p>${esc(p.description)}</p><ul>${p.points
          .map((x) => `<li>${esc(x)}</li>`)
          .join('')}</ul></section>`;
      const content =
        `<h1>${esc(OWNER.name)}</h1><p>${esc(OWNER.role)}. Сайты, боты и автоматизация: дизайн и разработка в одних руках.</p>` +
        `<section><h2>${esc(PROJECTS.web.title)}</h2><p>${esc(PROJECTS.web.lead)} ${esc(PROJECTS.web.note ?? '')}</p><ul>${siteItems}</ul></section>` +
        bot(PROJECTS.albion) +
        bot(PROJECTS.tenders) +
        `<section><h2>Контакты</h2><p><a href="https://t.me/${CONTACT.telegramUser}">Telegram @${CONTACT.telegramUser}</a>, <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p></section>`;
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: OWNER.name,
        url: 'https://maxbush.github.io/time-drive/',
        jobTitle: 'Веб-разработчик, разработка ботов и автоматизации',
        email: CONTACT.email,
        sameAs: [`https://t.me/${CONTACT.telegramUser}`],
        knowsAbout: ['Веб-разработка', 'SEO', 'Telegram-боты', 'Автоматизация', 'Аналитика данных'],
      };
      // the links of the hidden copy stay readable for crawlers and screen readers, but are out of the
      // keyboard focus order (an invisible focused link that Enter takes you away with is a trap)
      const staticContent = content.replace(/<a /g, '<a tabindex="-1" ');
      return html
        .replace('<!--FONT_PRELOAD-->', fonts)
        .replace('<!--STATIC_CONTENT-->', staticContent)
        .replace('<!--JSON_LD-->', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
    },
  };
}

export default defineConfig({
  base: './', // relative paths — works on GitHub Pages under any repo name
  plugins: [react(), tailwindcss(), seoPlugin()],
  // local `vite preview` only: never let a browser reuse an old index.html between builds
  preview: { headers: { 'Cache-Control': 'no-store' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          postprocessing: [
            'three/examples/jsm/postprocessing/EffectComposer.js',
            'three/examples/jsm/postprocessing/RenderPass.js',
            'three/examples/jsm/postprocessing/UnrealBloomPass.js',
            'three/examples/jsm/postprocessing/OutputPass.js',
            'three/examples/jsm/postprocessing/SMAAPass.js',
          ],
        },
      },
    },
  },
});
