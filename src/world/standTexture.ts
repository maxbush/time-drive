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

// Draws `text` at the given size, shrinking it until it fits `maxW`.
function fitText(ctx: Ctx, text: string, x: number, y: number, maxW: number, font: (px: number) => string, px: number) {
  let s = px;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 0.5;
    ctx.font = font(s);
  }
  ctx.fillText(text, x, y);
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
  ctx.fillStyle = strong ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)';
  ctx.strokeStyle = strong ? accent : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = strong ? 2 : 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  tracking(ctx, 0.4);
  ctx.fillStyle = '#f1f5f9';
  fitText(ctx, label, cx, cy - (sub ? 3 : -6), w - 18, (p) => `400 ${p}px ${MONO}`, strong ? 22 : 18);
  if (sub) {
    ctx.fillStyle = '#7d8aa0';
    tracking(ctx, 0);
    fitText(ctx, sub, cx, cy + 15, w - 18, (p) => `300 ${p}px ${SANS}`, 14.5);
  }
  ctx.restore();
}

// elbow connector: through the given points, arrowhead on the last segment
function path(ctx: Ctx, pts: [number, number][], color: string, dash?: number[]) {
  for (let i = 0; i < pts.length - 2; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color, 1.5, dash);
  const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
  arrow(ctx, a[0], a[1], b[0], b[1], color, dash);
}

function tag(ctx: Ctx, text: string, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#6f7d93';
  ctx.font = `300 11px ${MONO}`;
  tracking(ctx, 1.2);
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ALBION: the assistant at the centre, MeritHub and the LLM feeding it, its own database
// underneath, two messengers on the right that reach the people (and the answer comes back).
function drawAlbion(ctx: Ctx, accent: string, soft: string) {
  node(ctx, 135, 345, 190, 54, 'MeritHub', 'расписание · API', accent);
  node(ctx, 135, 465, 190, 54, 'ИИ · LLM', 'разбор заявок', accent);
  node(ctx, 460, 405, 230, 104, 'ALBION', 'сценарии · роли · эскалация', accent, true);
  node(ctx, 460, 522, 190, 44, 'Своя база данных', 'события · очередь · журнал', accent);
  node(ctx, 745, 335, 150, 50, 'Telegram', 'уведомления', accent);
  node(ctx, 905, 335, 150, 50, 'WhatsApp', 'уведомления', accent);
  node(ctx, 825, 478, 290, 56, 'Родители · репетиторы · координатор', '', accent);

  path(ctx, [[230, 345], [300, 345], [300, 385], [345, 385]], soft);
  path(ctx, [[230, 465], [300, 465], [300, 425], [345, 425]], soft);
  arrow(ctx, 440, 457, 440, 500, soft);
  arrow(ctx, 480, 500, 480, 457, soft);
  path(ctx, [[575, 385], [620, 385], [620, 335], [670, 335]], soft);
  path(ctx, [[575, 400], [905, 400], [905, 361]], soft);
  arrow(ctx, 745, 360, 745, 450, soft);
  arrow(ctx, 905, 400, 905, 450, soft);
  path(ctx, [[680, 505], [568, 505], [568, 457]], soft, [6, 5]);
  tag(ctx, 'ОТВЕТ', 624, 522);
}

// Tenders: gias.by -> own database -> analysis -> REST API -> web UI / Telegram, and
// Excel reports straight from the analysis.
function drawTenders(ctx: Ctx, accent: string, soft: string) {
  const y = 405;
  node(ctx, 110, y, 120, 58, 'gias.by', 'закупки · планы', accent);
  node(ctx, 305, y, 140, 58, 'Своя база', 'SQLite', accent);
  node(ctx, 520, y, 190, 90, 'Аналитика', 'ОКРБ · приоритет · конкуренты', accent, true);
  node(ctx, 705, y, 100, 58, 'REST API', 'FastAPI', accent);
  node(ctx, 895, 335, 170, 54, 'Веб-интерфейс', 'дашборд · React', accent);
  node(ctx, 895, 405, 170, 54, 'Telegram', 'профиль · планы', accent);
  node(ctx, 895, 485, 170, 54, 'Excel-отчёты', 'для руководителя', accent);

  arrow(ctx, 170, y, 235, y, soft);
  arrow(ctx, 375, y, 425, y, soft);
  arrow(ctx, 615, y, 655, y, soft);
  path(ctx, [[755, y - 12], [790, y - 12], [790, 335], [810, 335]], soft);
  arrow(ctx, 755, y + 2, 810, y + 2, soft);
  path(ctx, [[520, y + 45], [520, 485], [810, 485]], soft);
  tag(ctx, 'ИМПОРТ', 202, y - 9);
  tag(ctx, 'ОТЧЁТЫ', 680, 478);
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
  tracking(ctx, -1);
  fitText(ctx, opts.title, 60, 188, DW - 120, (p) => `200 ${p}px ${SANS}`, 82);
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
