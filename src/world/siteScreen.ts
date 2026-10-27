import * as THREE from 'three';
import { SITES } from '../content';

// ============================================================================
// SITE SCREEN: the stand of stop 01 shows the client sites inside a "browser
// window". Each site is a few viewport screenshots; every slide pans slowly down
// (like someone scrolling), slides cross-fade, and after the last slide it moves to
// the next site. One 1024x576 canvas texture, redrawn ~24x/s ONLY while the stop is
// near, images are loaded lazily the first time that happens.
// ============================================================================

const W = 1024;
const H = 576;
const BAR = 46; // browser chrome height
const AREA_H = H - BAR;
const SLIDE_SEC = 3.4;
const FADE_SEC = 0.7;
const HOLD_AFTER_MANUAL_SEC = 26; // after a manual pick, stay on that site this long
const FPS = 24;

export interface SiteScreen {
  texture: THREE.CanvasTexture;
  readonly index: number;
  select: (i: number, manual?: boolean) => void;
  update: (time: number, active: boolean) => void;
  onChange?: (i: number) => void;
}

export function createSiteScreen(anisotropy = 8): SiteScreen {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;

  const images: (HTMLImageElement | null)[][] = SITES.map((s) => s.slides.map(() => null));
  const loaded: boolean[][] = SITES.map((s) => s.slides.map(() => false));
  let loadStarted = false;
  const startLoading = () => {
    if (loadStarted) return;
    loadStarted = true;
    SITES.forEach((site, si) =>
      site.slides.forEach((src, k) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          images[si][k] = img;
          loaded[si][k] = true;
        };
        img.src = src;
      })
    );
  };

  let index = 0;
  let siteT = 0; // seconds spent on the current site
  let holdUntil = 0; // (screen time) auto-advance is paused until then
  let lastTime = 0;
  let acc = 0;
  let screenTime = 0;

  const drawSlide = (si: number, k: number, pan: number, alpha: number, zoom: number) => {
    const img = images[si][k];
    if (!img || !loaded[si][k]) return;
    // cover-fit by width, pan down through the screenshot
    const sw = img.naturalWidth;
    const sh = Math.min(img.naturalHeight, (sw * AREA_H) / W / zoom);
    const sx = (sw - sw / zoom) / 2;
    const sy = pan * Math.max(0, img.naturalHeight - sh);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw / zoom, sh, 0, BAR, W, AREA_H);
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    const site = SITES[index];
    const n = site.slides.length;

    // background + placeholder while images load
    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, W, H);

    const slideF = siteT / SLIDE_SEC;
    const k = Math.min(n - 1, Math.floor(slideF));
    const local = slideF - Math.floor(slideF); // 0..1 inside the slide
    const pan = local * local * (3 - 2 * local); // eased scroll
    const zoom = 1 + 0.035 * local;

    if (loaded[index][k]) {
      drawSlide(index, k, pan, 1, zoom);
      // cross-fade into the next slide during the last FADE_SEC of this one
      const left = (1 - local) * SLIDE_SEC;
      if (left < FADE_SEC && k + 1 < n && loaded[index][k + 1]) {
        drawSlide(index, k + 1, 0, 1 - left / FADE_SEC, 1);
      }
    } else {
      ctx.fillStyle = '#e8edf5';
      ctx.font = '300 44px "Inter Variable", Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(site.name, W / 2, BAR + AREA_H / 2);
      ctx.textAlign = 'left';
    }

    // browser chrome
    ctx.fillStyle = '#10151f';
    ctx.fillRect(0, 0, W, BAR);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, BAR - 1, W, 1);
    const dots = ['#ff5f57', '#febc2e', '#28c840'];
    dots.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(26 + i * 22, BAR / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    // address pill
    const px = 112;
    const pw = W - px - 28;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(px, 9, pw, BAR - 18, 14);
    ctx.fill();
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '400 17px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(site.domain, px + 18, BAR / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    // slide progress (thin line under the chrome)
    const prog = Math.min(1, siteT / (SLIDE_SEC * n));
    ctx.fillStyle = 'rgba(56,189,248,0.85)';
    ctx.fillRect(0, BAR - 2, W * prog, 2);

    texture.needsUpdate = true;
  };

  const api: SiteScreen = {
    texture,
    get index() {
      return index;
    },
    select: (i, manual = false) => {
      const next = ((i % SITES.length) + SITES.length) % SITES.length;
      if (next !== index) {
        index = next;
        siteT = 0;
        api.onChange?.(index);
      } else if (manual) {
        siteT = 0;
      }
      if (manual) holdUntil = screenTime + HOLD_AFTER_MANUAL_SEC;
      draw();
    },
    update: (time, active) => {
      const dt = Math.min(0.1, Math.max(0, time - lastTime));
      lastTime = time;
      if (!active) return;
      startLoading();
      screenTime += dt;
      siteT += dt;
      // auto-advance to the next site after the last slide (unless the visitor picked one)
      if (siteT >= SLIDE_SEC * SITES[index].slides.length && screenTime >= holdUntil) {
        api.select(index + 1);
      } else if (siteT >= SLIDE_SEC * SITES[index].slides.length) {
        siteT = 0; // held by a manual pick: loop this site
      }
      acc += dt;
      if (acc >= 1 / FPS) {
        acc = 0;
        draw();
      }
    },
  };

  draw();
  return api;
}
