import * as THREE from 'three';

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return [canvas, ctx];
}

function heightBufferToNormalTexture(
  heightData: Float32Array,
  width: number,
  height: number,
  strength: number,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(width, height);
  const img = ctx.createImageData(width, height);
  const out = img.data;

  for (let y = 0; y < height; y++) {
    const ym = (y - 1 + height) % height;
    const yp = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;

      const hL = heightData[y * width + xm];
      const hR = heightData[y * width + xp];
      const hU = heightData[ym * width + x];
      const hD = heightData[yp * width + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

      const idx = (y * width + x) * 4;
      out[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d', { willReadFrequently: true })!;
  const src = hCtx.getImageData(0, 0, w, h).data;

  const [nCanvas, nCtx] = makeCanvas(w, h);
  const out = nCtx.createImageData(w, h);
  const dst = out.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  nCtx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(nCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isSRGB: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface PBRTextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export interface TextureLibrary {
  asphalt: PBRTextureSet;
  sidewalk: PBRTextureSet;
  basaltStrip: PBRTextureSet;
  curbGranite: PBRTextureSet;
  limestone: PBRTextureSet;
  warmStone: PBRTextureSet;
  darkBrick: PBRTextureSet;
  warmBrick: PBRTextureSet;
  flutedConcrete: PBRTextureSet;
  architecturalConcrete: PBRTextureSet;
  lightFormworkConcrete: THREE.CanvasTexture;
  plazaRingTex: THREE.CanvasTexture;
  brushedBronze: THREE.CanvasTexture;
  manholeMap: THREE.CanvasTexture;
  drainGrateMap: THREE.CanvasTexture;
  lightPoolMap: THREE.CanvasTexture;
  haloCoronaMap: THREE.CanvasTexture;
  grassTurf: PBRTextureSet;
  maxAnisotropy: number;
}

/**
 * High-definition 1024x1024 Damp Urban Asphalt with multi-scale coarse mineral aggregate,
 * longitudinal wheel-track polish, rain puddle patches, and bitumen tar repair seams.
 */
async function buildAsphaltSet(anisotropy: number, pause: () => Promise<void>): Promise<PBRTextureSet> {
  const w = 1024;
  const h = 1024;
  const rng = mulberry32(104729);
  const [colorCanvas, cCtx] = makeCanvas(w, h);
  const [roughCanvas, rCtx] = makeCanvas(w, h);

  const cImg = cCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);
  const heightBuf = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    // a million pixels of noise: hand control back to the browser every 128 rows (same pixel order,
    // so the same texture)
    if (y > 0 && (y & 127) === 0) await pause();
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const idx = (y * w + x) * 4;

      const fineGrain = hash2(x * 0.9, y * 0.9);
      const medAggregate = smoothNoise(x * 0.22, y * 0.22);
      const coarseStone = rng() > 0.87 ? (rng() - 0.87) * 185 : 0;
      const puddlePatch = fbm(u * 6.0 + 2.1, v * 6.0 + 0.7, 4);

      // 4-lane avenue wheel tracks
      const longitudinalWear =
        Math.exp(-Math.pow((u - 0.16) / 0.055, 2)) * 0.5 +
        Math.exp(-Math.pow((u - 0.36) / 0.055, 2)) * 0.55 +
        Math.exp(-Math.pow((u - 0.64) / 0.055, 2)) * 0.55 +
        Math.exp(-Math.pow((u - 0.84) / 0.055, 2)) * 0.5;

      const gutterWetness =
        Math.exp(-Math.pow(u / 0.05, 2)) * 0.7 +
        Math.exp(-Math.pow((1 - u) / 0.05, 2)) * 0.7;

      const dampness = Math.min(
        1,
        Math.max(0, (puddlePatch - 0.35) * 1.5 + longitudinalWear * 0.42 + gutterWetness * 0.55)
      );

      // Rich charcoal-granite asphalt with visible mineral aggregate speckle
      const baseVal = (34 + fineGrain * 18 + medAggregate * 12 + coarseStone) * (1 - dampness * 0.35);
      cImg.data[idx] = Math.max(14, Math.min(115, Math.round(baseVal * 0.96)));
      cImg.data[idx + 1] = Math.max(15, Math.min(120, Math.round(baseVal * 1.0)));
      cImg.data[idx + 2] = Math.max(18, Math.min(132, Math.round(baseVal * 1.1)));
      cImg.data[idx + 3] = 255;

      // Physically plausible roughness: glossy wet wheel ruts & puddles (0.14) vs coarse dry stone (0.72)
      const rough = Math.max(0.14, Math.min(0.76, 0.68 - dampness * 0.48 + (fineGrain - 0.5) * 0.12));
      const rByte = Math.round(rough * 255);
      rImg.data[idx] = rByte;
      rImg.data[idx + 1] = rByte;
      rImg.data[idx + 2] = rByte;
      rImg.data[idx + 3] = 255;

      heightBuf[y * w + x] =
        (fineGrain * 0.65 + medAggregate * 0.35 + (coarseStone > 0 ? 0.35 : 0)) *
        (1 - dampness * 0.62);
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Glossy dark bitumen tar crack seams
  cCtx.strokeStyle = 'rgba(10, 12, 16, 0.72)';
  cCtx.lineWidth = 2.6;
  rCtx.strokeStyle = 'rgb(34, 34, 34)';
  rCtx.lineWidth = 3.2;
  for (let s = 0; s < 4; s++) {
    cCtx.beginPath();
    rCtx.beginPath();
    let sx = w * (0.18 + s * 0.21);
    cCtx.moveTo(sx, 0);
    rCtx.moveTo(sx, 0);
    for (let sy = 24; sy <= h; sy += 24) {
      sx += (hash2(s * 19, sy) - 0.5) * 14;
      cCtx.lineTo(sx, sy);
      rCtx.lineTo(sx, sy);
    }
    cCtx.stroke();
    rCtx.stroke();
  }

  const repeatX = 1;
  const repeatY = 42;

  return {
    map: finalizeTexture(colorCanvas, true, anisotropy, repeatX, repeatY),
    normalMap: heightBufferToNormalTexture(heightBuf, w, h, 2.35, anisotropy, repeatX, repeatY),
    roughnessMap: finalizeTexture(roughCanvas, false, anisotropy, repeatX, repeatY),
  };
}

function buildStoneOrBrickSet(
  opts: {
    w: number;
    h: number;
    rows: number;
    cols: number;
    baseRGB: [number, number, number];
    varRGB: number;
    mortarRGB: [number, number, number];
    mortarPx: number;
    baseRough: number;
    mortarRough: number;
    normalStrength: number;
    streakStrength: number;
    seed: number;
  },
  anisotropy: number
): PBRTextureSet {
  const { w, h, rows, cols, baseRGB, varRGB, mortarRGB, mortarPx, baseRough, mortarRough, normalStrength, streakStrength, seed } = opts;
  const rng = mulberry32(seed);
  const [albedoC, aCtx] = makeCanvas(w, h);
  const [heightC, hCtx] = makeCanvas(w, h);
  const [roughC, rCtx] = makeCanvas(w, h);

  aCtx.fillStyle = `rgb(${mortarRGB[0]},${mortarRGB[1]},${mortarRGB[2]})`;
  aCtx.fillRect(0, 0, w, h);

  hCtx.fillStyle = `rgb(36,36,36)`;
  hCtx.fillRect(0, 0, w, h);

  const mRoughByte = Math.round(mortarRough * 255);
  rCtx.fillStyle = `rgb(${mRoughByte},${mRoughByte},${mRoughByte})`;
  rCtx.fillRect(0, 0, w, h);

  const rowH = h / rows;
  const colW = w / cols;
  const isBrick = rows >= 14;

  for (let row = 0; row < rows; row++) {
    const stagger = (row % 2) * (colW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const bx = col * colW + stagger;
      const by = row * rowH;

      const delta = (rng() - 0.5) * 2 * varRGB;
      const warmShift = (rng() - 0.5) * 9;
      const cr = Math.max(0, Math.min(255, Math.round(baseRGB[0] + delta + warmShift)));
      const cg = Math.max(0, Math.min(255, Math.round(baseRGB[1] + delta)));
      const cb = Math.max(0, Math.min(255, Math.round(baseRGB[2] + delta - warmShift * 0.45)));

      const pad = mortarPx * 0.5;
      const rx = bx + pad;
      const ry = by + pad;
      const rw = colW - mortarPx;
      const rh = rowH - mortarPx;

      aCtx.fillStyle = `rgb(${Math.max(0, cr - 18)},${Math.max(0, cg - 18)},${Math.max(0, cb - 18)})`;
      aCtx.fillRect(rx, ry, rw, rh);

      aCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
      aCtx.fillRect(rx + 1.5, ry + 1.5, Math.max(1, rw - 3), Math.max(1, rh - 3));

      aCtx.fillStyle = `rgba(255, 250, 242, 0.09)`;
      aCtx.fillRect(rx + 2, ry + 1.5, Math.max(1, rw - 4), 2);

      const hVal = Math.round(212 + (rng() - 0.5) * 28);
      const hMid = Math.round(hVal * 0.72);
      const hEdge = Math.round(hVal * 0.48);

      hCtx.fillStyle = `rgb(${hEdge},${hEdge},${hEdge})`;
      hCtx.fillRect(rx, ry, rw, rh);
      hCtx.fillStyle = `rgb(${hMid},${hMid},${hMid})`;
      hCtx.fillRect(rx + 1.5, ry + 1.5, Math.max(1, rw - 3), Math.max(1, rh - 3));
      hCtx.fillStyle = `rgb(${hVal},${hVal},${hVal})`;
      hCtx.fillRect(rx + 3, ry + 3, Math.max(1, rw - 6), Math.max(1, rh - 6));

      const rByte = Math.max(30, Math.min(245, Math.round((baseRough + (rng() - 0.5) * 0.12) * 255)));
      rCtx.fillStyle = `rgb(${rByte},${rByte},${rByte})`;
      rCtx.fillRect(rx, ry, rw, rh);
    }
  }

  const aImg = aCtx.getImageData(0, 0, w, h);
  const hImg = hCtx.getImageData(0, 0, w, h);
  const rImg = rCtx.getImageData(0, 0, w, h);
  const ad = aImg.data;
  const hd = hImg.data;
  const rd = rImg.data;

  for (let y = 0; y < h; y++) {
    const ny = (y / h) * Math.PI * 2;
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * Math.PI * 2;
      const i = (y * w + x) * 4;

      const vein =
        Math.sin(nx * 3.0 + Math.cos(ny * 2.0) * 1.5 + seed) *
        Math.cos(ny * (isBrick ? 14.0 : 6.0) + Math.sin(nx * 4.0));
      const poreRoll = rng();
      const pore = !isBrick && poreRoll > 0.985 ? -22 : 0;

      const columnStreak = Math.sin(nx * 5.0 + seed) * Math.cos(nx * 2.0) * streakStrength;
      const grain = (rng() - 0.5) * (isBrick ? 17 : 11) + vein * 5.5 + pore;
      const streak = columnStreak * (0.5 + 0.5 * Math.sin(ny));

      ad[i] = Math.max(0, Math.min(255, ad[i] + grain - streak * 16));
      ad[i + 1] = Math.max(0, Math.min(255, ad[i + 1] + grain - streak * 15));
      ad[i + 2] = Math.max(0, Math.min(255, ad[i + 2] + grain - streak * 12));

      const hGrain = (rng() - 0.5) * (isBrick ? 22 : 14) + vein * 9 + pore * 1.5;
      hd[i] = hd[i + 1] = hd[i + 2] = Math.max(0, Math.min(255, hd[i] + hGrain));
      rd[i] = rd[i + 1] = rd[i + 2] = Math.max(25, Math.min(250, rd[i] + (rng() - 0.5) * 16 - pore));
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: finalizeTexture(albedoC, true, anisotropy),
    normalMap: heightToNormalTexture(heightC, normalStrength, anisotropy),
    roughnessMap: finalizeTexture(roughC, false, anisotropy),
  };
}

function buildFlutedConcreteSet(anisotropy: number): PBRTextureSet {
  const w = 512;
  const h = 512;
  const rng = mulberry32(99371);
  const [albedoC, aCtx] = makeCanvas(w, h);
  const [heightC, hCtx] = makeCanvas(w, h);
  const [roughC, rCtx] = makeCanvas(w, h);

  const aImg = aCtx.createImageData(w, h);
  const hImg = hCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  const flutes = 24;
  for (let y = 0; y < h; y++) {
    const panelJoint = y % 128 < 3;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const flutePhase = ((x / w) * flutes) % 1;
      const rib = Math.sin(flutePhase * Math.PI);
      const grain = (rng() - 0.5) * 11;

      const base = panelJoint ? 52 : 84 + rib * 22 + grain;
      aImg.data[i] = Math.max(24, Math.min(165, Math.round(base)));
      aImg.data[i + 1] = Math.max(26, Math.min(168, Math.round(base + 2)));
      aImg.data[i + 2] = Math.max(30, Math.min(175, Math.round(base + 5)));
      aImg.data[i + 3] = 255;

      const hVal = panelJoint ? 40 : 90 + rib * 145 + grain * 0.8;
      hImg.data[i] = hImg.data[i + 1] = hImg.data[i + 2] = Math.max(0, Math.min(255, Math.round(hVal)));
      hImg.data[i + 3] = 255;

      const rByte = Math.round((0.64 - rib * 0.12 + (rng() - 0.5) * 0.06) * 255);
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = rByte;
      rImg.data[i + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  hCtx.putImageData(hImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: finalizeTexture(albedoC, true, anisotropy),
    normalMap: heightToNormalTexture(heightC, 2.2, anisotropy),
    roughnessMap: finalizeTexture(roughC, false, anisotropy),
  };
}

/**
 * Light architectural board-formed concrete from the original 5th pack (`concreteTex`)
 * so Ribbed Gate, Grove Hall, Spindle plinth, and Cable Bridge pylons read in crisp light tones!
 */
function buildLightFormworkConcreteTexture(anisotropy: number): THREE.CanvasTexture {
  const W = 512;
  const [c, x] = makeCanvas(W, W);
  const r = mulberry32(51);
  x.fillStyle = '#d6d0c4';
  x.fillRect(0, 0, W, W);
  const bh = W / 20;
  for (let j = 0; j < 20; j++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '90,80,65' : '255,252,245'},${0.04 + r() * 0.08})`;
    x.fillRect(0, j * bh, W, bh);
    x.fillStyle = 'rgba(70,60,50,0.22)';
    x.fillRect(0, j * bh, W, 1.2);
    const sx = r() * W;
    x.fillRect(sx, j * bh, 1.5, bh);
  }
  x.fillStyle = 'rgba(60,52,44,0.35)';
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 10; j++) {
      x.fillRect(i * 85 + 20, j * 51 + 20, 3, 3);
    }
  }
  for (let i = 0; i < 2800; i++) {
    const v = r() < 0.5 ? 0 : 255;
    x.fillStyle = `rgba(${v},${v},${v},${r() * 0.06})`;
    x.fillRect(r() * W, r() * W, 1.5, 1.5);
  }
  return finalizeTexture(c, true, anisotropy);
}

/**
 * Concentric travertine stone plaza texture from the original 5th pack (`plazaRingTex`)
 * for The Spindle circular plaza & monumental courts (replaces flat water).
 */
function buildPlazaRingTexture(anisotropy: number): THREE.CanvasTexture {
  const W = 1024;
  const [c, x] = makeCanvas(W, W);
  const r = mulberry32(15);
  x.fillStyle = '#d9d0bf';
  x.fillRect(0, 0, W, W);
  const cx = W / 2;
  const R = W / 2;
  x.translate(cx, cx);
  const bands: [number, number, string][] = [
    [78, 84, '#b9ad98'],
    [84, 92, '#e6dccb'],
    [92, 94, '#a99c86'],
    [108, 110, '#a99c86'],
    [124, 132, '#cdbfa8'],
    [132, 134, '#a99c86'],
  ];
  for (const [a, b, col] of bands) {
    x.fillStyle = col;
    x.beginPath();
    x.arc(0, 0, (b / 142) * R, 0, Math.PI * 2);
    x.arc(0, 0, (a / 142) * R, 0, Math.PI * 2, true);
    x.fill();
  }
  x.strokeStyle = 'rgba(120,100,76,0.55)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = (84 / 142) * R;
    const r1 = ((i % 4 === 0 ? 132 : 120) / 142) * R;
    x.beginPath();
    x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    x.stroke();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 9000; i++) {
    const v = r() < 0.5 ? 0 : 255;
    x.fillStyle = `rgba(${v},${v},${v},${r() * 0.06})`;
    x.fillRect(r() * W, r() * W, 2, 2);
  }
  return finalizeTexture(c, true, anisotropy);
}

function buildBrushedBronzeTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const rng = mulberry32(4411);
  ctx.fillStyle = '#4a3f35';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = 58 + Math.round((rng() - 0.5) * 14);
    ctx.fillStyle = `rgb(${v + 12}, ${v + 4}, ${v - 4})`;
    ctx.fillRect(0, y, 256, 1);
  }
  return finalizeTexture(c, true, anisotropy);
}

function buildManholeTexture(anisotropy: number): THREE.CanvasTexture {
  const s = 256;
  const [c, mCtx] = makeCanvas(s, s);
  mCtx.clearRect(0, 0, s, s);
  mCtx.fillStyle = '#2b2f36';
  mCtx.beginPath();
  mCtx.arc(128, 128, 120, 0, Math.PI * 2);
  mCtx.fill();
  mCtx.strokeStyle = '#4c5360';
  mCtx.lineWidth = 6;
  for (let r = 28; r <= 112; r += 26) {
    mCtx.beginPath();
    mCtx.arc(128, 128, r, 0, Math.PI * 2);
    mCtx.stroke();
  }
  mCtx.fillStyle = '#0a0c10';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    mCtx.beginPath();
    mCtx.arc(128 + Math.cos(a) * 68, 128 + Math.sin(a) * 68, 6, 0, Math.PI * 2);
    mCtx.fill();
  }
  const tex = finalizeTexture(c, true, anisotropy);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildDrainGrateTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, gCtx] = makeCanvas(128, 256);
  gCtx.fillStyle = '#1f242b';
  gCtx.fillRect(0, 0, 128, 256);
  gCtx.fillStyle = '#06080b';
  for (let sy = 16; sy < 240; sy += 24) {
    gCtx.fillRect(14, sy, 42, 12);
    gCtx.fillRect(72, sy, 42, 12);
  }
  const tex = finalizeTexture(c, true, anisotropy);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildLightPoolTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 214, 150, 0.42)');
  grad.addColorStop(0.35, 'rgba(255, 190, 110, 0.18)');
  grad.addColorStop(0.7, 'rgba(255, 170, 85, 0.05)');
  grad.addColorStop(1, 'rgba(255, 160, 75, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildHaloCoronaTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255, 246, 224, 0.92)');
  grad.addColorStop(0.18, 'rgba(255, 218, 158, 0.38)');
  grad.addColorStop(0.5, 'rgba(225, 180, 120, 0.10)');
  grad.addColorStop(1, 'rgba(180, 150, 110, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSignageTexture(
  title: string,
  subtitle: string,
  style: {
    bg: string;
    fg: string;
    accent: string;
    serif?: boolean;
    border?: boolean;
    tag?: string;
  },
  anisotropy = 8
): THREE.CanvasTexture {
  const w = 1024;
  const h = 280;
  const [c, ctx] = makeCanvas(w, h);

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, w, h);

  if (style.border) {
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, w - 32, h - 32);
  }

  ctx.fillStyle = style.accent;
  ctx.fillRect(64, h * 0.48 - 2, 48, 3);
  ctx.fillRect(w - 112, h * 0.48 - 2, 48, 3);

  if (style.tag) {
    ctx.fillStyle = style.accent;
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(style.tag.toUpperCase(), w / 2, 52);
  }

  ctx.fillStyle = style.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontFamily = style.serif ? 'Georgia, "Times New Roman", serif' : '"Inter", sans-serif';
  // Signs are read from far away: make the title as large as the width allows (short
  // titles get big letters) and shrink only the long ones to fit.
  const fit = (text: string, font: (px: number) => string, maxPx: number, minPx: number, maxW: number) => {
    let px = maxPx;
    ctx.font = font(px);
    while (ctx.measureText(text).width > maxW && px > minPx) {
      px -= 2;
      ctx.font = font(px);
    }
  };
  fit(title, (px) => `700 ${px}px ${fontFamily}`, 88, 36, w - 230);
  ctx.fillText(title, w / 2, subtitle ? h * 0.44 : h * 0.54);

  if (subtitle) {
    ctx.fillStyle = style.accent;
    const sub = subtitle.toUpperCase();
    fit(sub, (px) => `500 ${px}px "Inter", sans-serif`, 32, 16, w - 170);
    ctx.fillText(sub, w / 2, h * 0.79);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createPastRoadSignTexture(crossedOut: boolean, anisotropy = 8): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const [c, ctx] = makeCanvas(w, h);

  // Retro highway green/dark-slate sign board with weathered amber border
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#122620');
  grad.addColorStop(1, '#0a1612');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#e2d5b5';
  ctx.lineWidth = 12;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 38, w - 76, h - 76);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!crossedOut) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 28px "Inter", monospace';
    ctx.fillText('ERA 01 · ARCHIVE HIGHWAY · 2004—2014', w / 2, 96);

    ctx.fillStyle = '#fff8eb';
    ctx.font = '900 84px "Inter", sans-serif';
    ctx.fillText('WELCOME TO THE PAST', w / 2, 220);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = '600 34px "Inter", monospace';
    ctx.fillText('WEB 2.0 · PHP 5 · WORDPRESS · BOOTSTRAP', w / 2, 335);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.fillText('ACCELERATE TO 88 MPH FOR TEMPORAL JUMP ↑', w / 2, 418);
  } else {
    // "End of zone" sign. The word stays readable: one slim red strike confined to the word
    // (a thick band used to hide half of it), and the rest of the sign is bigger and brighter.
    ctx.save();
    ctx.strokeStyle = 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 7;
    ctx.strokeRect(28, 28, w - 56, h - 56); // red frame: reads as "stop / ended" from far away
    ctx.restore();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 32px "Inter", monospace';
    ctx.fillText('YOU ARE NOW LEAVING', w / 2, 92);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 138px "Inter", sans-serif';
    ctx.fillText('THE PAST', w / 2, 232);

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineCap = 'butt';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(176, 300);
    ctx.lineTo(848, 162);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '800 42px "Inter", monospace';
    ctx.fillText('NEXT EXIT → THE PRESENT', w / 2, 398);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createShowcaseScreenTexture(
  opts: {
    era: string;
    title: string;
    subtitle: string;
    metrics: string[];
    accentHex: string;
    secondaryHex: string;
  },
  anisotropy = 8
): THREE.CanvasTexture {
  const w = 1024;
  const h = 576;
  const [c, ctx] = makeCanvas(w, h);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#090f1c');
  grad.addColorStop(0.5, '#0f1b30');
  grad.addColorStop(1, '#070b14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(148, 179, 228, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = opts.accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = opts.accentHex;
  ctx.fillRect(56, 58, 12, 32);
  ctx.font = '700 22px "Inter", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(opts.era.toUpperCase(), 84, 82);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 64px "Inter", sans-serif';
  ctx.fillText(opts.title, 56, 178);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 28px "Inter", sans-serif';
  ctx.fillText(opts.subtitle, 56, 232);

  const cardW = (w - 112 - (opts.metrics.length - 1) * 20) / Math.max(1, opts.metrics.length);
  opts.metrics.forEach((m, i) => {
    const cx = 56 + i * (cardW + 20);
    const cy = 320;
    ctx.fillStyle = 'rgba(15, 25, 45, 0.85)';
    ctx.fillRect(cx, cy, cardW, 170);
    ctx.strokeStyle = i === 0 ? opts.accentHex : opts.secondaryHex;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cardW, 170);

    const parts = m.split('|');
    ctx.fillStyle = i === 0 ? opts.accentHex : '#e2e8f0';
    ctx.font = '700 34px "Inter", monospace';
    ctx.fillText(parts[0] || '', cx + 24, cy + 72);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 20px "Inter", sans-serif';
    ctx.fillText(parts[1] || '', cx + 24, cy + 124);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Generating the procedural textures takes a couple of seconds of pure CPU work; `pause` lets the
// caller hand control back to the browser between the sets (loading screen keeps moving).
export async function createTextureLibrary(
  renderer: THREE.WebGLRenderer,
  maxAniso = 16,
  pause: () => Promise<void> = async () => {}
): Promise<TextureLibrary> {
  const maxAnisotropy = Math.min(maxAniso, renderer.capabilities.getMaxAnisotropy());

  const asphalt = await buildAsphaltSet(maxAnisotropy, pause);
  await pause();
  const sidewalk = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 6,
      cols: 4,
      baseRGB: [104, 108, 116],
      varRGB: 10,
      mortarRGB: [52, 56, 64],
      mortarPx: 4,
      baseRough: 0.56,
      mortarRough: 0.86,
      normalStrength: 1.65,
      streakStrength: 0.15,
      seed: 1201,
    },
    maxAnisotropy
  );
  await pause();

  const basaltStrip = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 10,
      cols: 8,
      baseRGB: [56, 60, 68],
      varRGB: 8,
      mortarRGB: [32, 35, 40],
      mortarPx: 5,
      baseRough: 0.52,
      mortarRough: 0.84,
      normalStrength: 1.85,
      streakStrength: 0.12,
      seed: 2207,
    },
    maxAnisotropy
  );
  await pause();

  const curbGranite = buildStoneOrBrickSet(
    {
      w: 512,
      h: 256,
      rows: 2,
      cols: 4,
      baseRGB: [124, 127, 134],
      varRGB: 10,
      mortarRGB: [62, 65, 72],
      mortarPx: 6,
      baseRough: 0.54,
      mortarRough: 0.86,
      normalStrength: 1.9,
      streakStrength: 0.25,
      seed: 3309,
    },
    maxAnisotropy
  );
  await pause();

  const limestone = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 8,
      cols: 4,
      baseRGB: [176, 169, 158],
      varRGB: 11,
      mortarRGB: [116, 110, 102],
      mortarPx: 4,
      baseRough: 0.64,
      mortarRough: 0.88,
      normalStrength: 1.65,
      streakStrength: 0.32,
      seed: 4409,
    },
    maxAnisotropy
  );
  await pause();

  const warmStone = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 10,
      cols: 5,
      baseRGB: [154, 134, 116],
      varRGB: 12,
      mortarRGB: [96, 82, 70],
      mortarPx: 4,
      baseRough: 0.62,
      mortarRough: 0.86,
      normalStrength: 1.6,
      streakStrength: 0.3,
      seed: 5501,
    },
    maxAnisotropy
  );
  await pause();

  const darkBrick = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 22,
      cols: 7,
      baseRGB: [84, 60, 54],
      varRGB: 14,
      mortarRGB: [52, 46, 44],
      mortarPx: 4,
      baseRough: 0.76,
      mortarRough: 0.9,
      normalStrength: 2.0,
      streakStrength: 0.28,
      seed: 6607,
    },
    maxAnisotropy
  );
  await pause();

  const warmBrick = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 20,
      cols: 6,
      baseRGB: [126, 82, 68],
      varRGB: 16,
      mortarRGB: [82, 74, 68],
      mortarPx: 4,
      baseRough: 0.74,
      mortarRough: 0.9,
      normalStrength: 2.15,
      streakStrength: 0.25,
      seed: 7717,
    },
    maxAnisotropy
  );
  await pause();

  const flutedConcrete = buildFlutedConcreteSet(maxAnisotropy);
  await pause();

  const architecturalConcrete = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 4,
      cols: 2,
      baseRGB: [132, 136, 142],
      varRGB: 8,
      mortarRGB: [78, 82, 88],
      mortarPx: 4,
      baseRough: 0.68,
      mortarRough: 0.88,
      normalStrength: 1.55,
      streakStrength: 0.28,
      seed: 8821,
    },
    maxAnisotropy
  );
  await pause();

  const grassTurf = buildStoneOrBrickSet(
    {
      w: 512,
      h: 512,
      rows: 1,
      cols: 1,
      baseRGB: [58, 86, 62],
      varRGB: 14,
      mortarRGB: [52, 78, 56],
      mortarPx: 0,
      baseRough: 0.88,
      mortarRough: 0.9,
      normalStrength: 1.8,
      streakStrength: 0.15,
      seed: 9912,
    },
    maxAnisotropy
  );
  await pause();

  return {
    asphalt,
    sidewalk,
    basaltStrip,
    curbGranite,
    limestone,
    warmStone,
    darkBrick,
    warmBrick,
    flutedConcrete,
    architecturalConcrete,
    lightFormworkConcrete: buildLightFormworkConcreteTexture(maxAnisotropy),
    plazaRingTex: buildPlazaRingTexture(maxAnisotropy),
    brushedBronze: buildBrushedBronzeTexture(maxAnisotropy),
    manholeMap: buildManholeTexture(maxAnisotropy),
    drainGrateMap: buildDrainGrateTexture(maxAnisotropy),
    lightPoolMap: buildLightPoolTexture(),
    haloCoronaMap: buildHaloCoronaTexture(),
    grassTurf,
    maxAnisotropy,
  };
}
