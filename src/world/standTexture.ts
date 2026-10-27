import * as THREE from 'three';

// ============================================================================
// PROJECT STAND SCREENS (the big boards at the three stops) — elegant version:
// graphite, a hairline frame with corner ticks, a light large title, mono labels and
// (for the bots) a thin flow diagram instead of boxed "metric" tiles.
// Drawn once at 1536x864 from a 1024x576 design grid.
// ============================================================================

export type StandDiagram = 'albion' | 'tenders';

export interface StandOptions {
  era: string; // "ПРОЕКТ 02 // АВТОМАТИЗАЦИЯ"
  title: string;
  subtitle: string;
  metrics: string[]; // "VALUE|label" (used when there is no diagram)
  accentHex: string;
  secondaryHex: string;
  diagram?: StandDiagram;
}

const DW = 1024;
const DH = 576;
const SCALE = 1.5;

type Ctx = CanvasRenderingContext2D;

const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function tracking(ctx: Ctx, px: number) {
  // letterSpacing is not in every browser; harmless when missing
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, w = 1.5, dash?: number[]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, dash?: number[]) {
  line(ctx, x1, y1, x2, y2, color, 1.5, dash);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function node(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  sub: string,
  accent: string,
  strong = false
) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  ctx.fillStyle = strong ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)';
  ctx.strokeStyle = strong ? accent : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = strong ? 1.8 : 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1f5f9';
  ctx.font = `400 17px ${MONO}`;
  tracking(ctx, 0.5);
  ctx.fillText(label, cx, cy - (sub ? 2 : -6));
  if (sub) {
    ctx.fillStyle = '#7d8aa0';
    ctx.font = `300 13px ${SANS}`;
    tracking(ctx, 0);
    ctx.fillText(sub, cx, cy + 17);
  }
  ctx.restore();
}

function drawAlbion(ctx: Ctx, accent: string, soft: string) {
  const y = 410;
  node(ctx, 150, y, 190, 62, 'MeritHub', 'расписание, занятия', accent);
  node(ctx, 470, y, 190, 70, 'ALBION', 'ассистент координатора', accent, true);
  node(ctx, 800, y - 62, 210, 56, 'Родитель', 'Telegram · кнопка «Всё в порядке»', accent);
  node(ctx, 800, y + 62, 210, 56, 'Координатор', 'эскалация при молчании', accent);
  arrow(ctx, 247, y, 372, y, soft);
  arrow(ctx, 567, y - 12, 692, y - 58, soft);
  arrow(ctx, 567, y + 12, 692, y + 58, soft, [6, 5]);
  ctx.save();
  ctx.fillStyle = '#7d8aa0';
  ctx.font = `300 12px ${MONO}`;
  tracking(ctx, 1.2);
  ctx.textAlign = 'center';
  ctx.fillText('НЕЯВКА', 310, y - 12);
  ctx.fillText('ЕСЛИ НЕТ ОТВЕТА', 640, y + 30);
  ctx.restore();
}

function drawTenders(ctx: Ctx, accent: string, soft: string) {
  const y = 415;
  node(ctx, 112, y, 156, 64, 'gias.by', 'API закупок', accent);
  node(ctx, 330, y, 156, 64, 'База данных', 'закупки · планы', accent);
  node(ctx, 590, y, 210, 92, 'Анализ', 'конкуренты · планы · приоритет', accent, true);
  node(ctx, 880, y, 156, 64, 'Отчёты', 'Excel · бот · дашборд', accent);
  arrow(ctx, 192, y, 250, y, soft);
  arrow(ctx, 410, y, 484, y, soft);
  arrow(ctx, 696, y, 800, y, soft);
}

function drawMetrics(ctx: Ctx, metrics: string[], accent: string) {
  const n = Math.max(1, metrics.length);
  const gap = 36;
  const colW = (DW - 112 - gap * (n - 1)) / n;
  metrics.forEach((m, i) => {
    const x = 56 + i * (colW + gap);
    const [value, label] = m.split('|');
    line(ctx, x, 360, x + colW, 360, 'rgba(255,255,255,0.22)', 1);
    ctx.save();
    ctx.fillStyle = i === 0 ? accent : '#e2e8f0';
    ctx.font = `400 24px ${MONO}`;
    tracking(ctx, 0.5);
    ctx.fillText(value || '', x, 400);
    ctx.fillStyle = '#7d8aa0';
    ctx.font = `300 16px ${SANS}`;
    tracking(ctx, 0);
    ctx.fillText(label || '', x, 430);
    ctx.restore();
  });
}

export function createStandTexture(opts: StandOptions, anisotropy = 8): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = DW * SCALE;
  canvas.height = DH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // graphite background with a barely-there grid
  const bg = ctx.createLinearGradient(0, 0, 0, DH);
  bg.addColorStop(0, '#0b111b');
  bg.addColorStop(1, '#05080e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, DW, DH);
  ctx.strokeStyle = 'rgba(148,163,184,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= DW; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, DH);
    ctx.stroke();
  }
  for (let y = 0; y <= DH; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(DW, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(DW * 0.78, DH * 0.2, 10, DW * 0.78, DH * 0.2, 420);
  glow.addColorStop(0, hexA(opts.accentHex, 0.1));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, DW, DH);

  // hairline frame with corner ticks in the accent colour
  const m = 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(m, m, DW - 2 * m, DH - 2 * m);
  ctx.strokeStyle = opts.accentHex;
  ctx.lineWidth = 2;
  const t = 18;
  for (const [cx, cy, dx, dy] of [
    [m, m, 1, 1],
    [DW - m, m, -1, 1],
    [m, DH - m, 1, -1],
    [DW - m, DH - m, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * t);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * t, cy);
    ctx.stroke();
  }

  // era label: "ПРОЕКТ 02 // АВТОМАТИЗАЦИЯ" -> index, hairline, category
  const [head, tail] = opts.era.split('//').map((s) => s.trim());
  const idx = (head.match(/\d+/) ?? ['01'])[0];
  ctx.textAlign = 'left';
  ctx.fillStyle = opts.accentHex;
  ctx.font = `500 20px ${MONO}`;
  tracking(ctx, 2);
  ctx.fillText(idx, 62, 86);
  line(ctx, 100, 80, 150, 80, 'rgba(255,255,255,0.3)', 1);
  ctx.fillStyle = '#8b98ad';
  ctx.font = `400 15px ${MONO}`;
  tracking(ctx, 3.5);
  ctx.fillText((tail ?? head).toUpperCase(), 164, 85);

  // title + subtitle
  ctx.fillStyle = '#f8fafc';
  ctx.font = `200 82px ${SANS}`;
  tracking(ctx, -1);
  ctx.fillText(opts.title, 60, 188);
  ctx.fillStyle = '#9aa7bb';
  ctx.font = `300 25px ${SANS}`;
  tracking(ctx, 0);
  ctx.fillText(opts.subtitle, 62, 240);

  const soft = hexA(opts.accentHex, 0.75);
  if (opts.diagram === 'albion') drawAlbion(ctx, opts.accentHex, soft);
  else if (opts.diagram === 'tenders') drawTenders(ctx, opts.accentHex, soft);
  else drawMetrics(ctx, opts.metrics, opts.accentHex);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
