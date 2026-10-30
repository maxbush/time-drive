import * as THREE from 'three';
import { renderStandImageAsync, StandOptions } from './standTexture';

export interface BoardSpec {
  id: string;
  center: THREE.Vector3;
  rotY: number;
  width: number;
  height: number;
  opts: StandOptions;
}

interface Item {
  spec: BoardSpec;
  img: HTMLImageElement | null;
  loading: boolean;
  shown: boolean;
  w: number;
}

const ASPECT = 576 / 1024;
const _v = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Unit square -> quad (projective), as a CSS matrix3d for an element of w x h px with its origin at the top left. */
function quadMatrix(w: number, h: number, p: number[][]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const det = dx1 * dy2 - dx2 * dy1;
  let g = 0;
  let hh = 0;
  if (Math.abs(det) > 1e-9) {
    g = (sx * dy2 - dx2 * sy) / det;
    hh = (dx1 * sy - sx * dy1) / det;
  }
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + hh * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
}

/**
 * The stop boards drawn by the browser instead of by WebGL.
 *
 * On a screen that is stretched (the weak tiers render the scene below the screen's own resolution) every
 * letter on a board in the 3D scene is smeared by that stretch. While the car stands at a board, the same
 * picture is laid over it as an ordinary HTML image, projected onto the board's four corners, so the browser
 * draws it at the screen's real resolution. It is a flat image on the compositor: no cost for the GPU scene.
 */
export class BoardOverlay {
  private root: HTMLDivElement;
  private items = new Map<string, Item>();
  private scale: number;

  constructor(container: HTMLElement, boards: BoardSpec[], scale: number) {
    this.scale = scale;
    this.root = document.createElement('div');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(this.root);
    for (const spec of boards) this.items.set(spec.id, { spec, img: null, loading: false, shown: false, w: 0 });
  }

  /** Draws the board's picture (async, off the main thread for the encoding) the first time it is asked for. */
  public async prepare(id: string) {
    const it = this.items.get(id);
    if (!it || it.img || it.loading) return;
    it.loading = true;
    try {
      if (document.fonts) {
        await Promise.race([
          Promise.all([
            document.fonts.load('200 20px "Inter Variable"'),
            document.fonts.load('300 14px "Inter Variable"'),
            document.fonts.load('400 16px "JetBrains Mono"'),
            document.fonts.load('500 16px "JetBrains Mono"'),
          ]),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      }
      const url = await renderStandImageAsync(it.spec.opts, this.scale, true);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode().catch(() => undefined);
      img.style.cssText =
        'position:absolute;left:0;top:0;transform-origin:0 0;opacity:0;transition:opacity .28s ease;will-change:transform,opacity;filter:brightness(.94);max-width:none;';
      this.root.appendChild(img);
      it.img = img;
    } catch {
      it.loading = false;
    }
  }

  private hide(it: Item) {
    if (it.img && it.shown) {
      it.img.style.opacity = '0';
      it.shown = false;
    }
  }

  /** Call right after the scene has been rendered with `camera`. */
  public update(camera: THREE.Camera, viewW: number, viewH: number, activeId: string | null, enabled: boolean, car: THREE.Vector3) {
    for (const it of this.items.values()) {
      const img = it.img;
      if (!img) continue;
      if (!enabled || it.spec.id !== activeId) {
        this.hide(it);
        continue;
      }
      const s = it.spec;
      const cos = Math.cos(s.rotY);
      const sin = Math.sin(s.rotY);
      const hw = s.width / 2;
      const hh = s.height / 2;
      const pts: number[][] = [];
      let ok = true;
      for (const [sx, sy] of [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        _v.set(s.center.x + cos * hw * sx, s.center.y + hh * sy, s.center.z - sin * hw * sx).project(camera);
        if (_v.z > 1 || _v.z < -1) ok = false;
        pts.push([(_v.x * 0.5 + 0.5) * viewW, (-_v.y * 0.5 + 0.5) * viewH]);
      }
      const W = (Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) + Math.hypot(pts[2][0] - pts[3][0], pts[2][1] - pts[3][1])) / 2;
      // the car in front of the board (orbiting the camera): do not paint over it
      _c.copy(car);
      _c.y += 1;
      _c.project(camera);
      const cx = (_c.x * 0.5 + 0.5) * viewW;
      const cy = (-_c.y * 0.5 + 0.5) * viewH;
      const minX = Math.min(pts[0][0], pts[3][0]);
      const maxX = Math.max(pts[1][0], pts[2][0]);
      const minY = Math.min(pts[0][1], pts[1][1]);
      const maxY = Math.max(pts[2][1], pts[3][1]);
      const carOver = _c.z < 1 && cx > minX && cx < maxX && cy > minY && cy < maxY;
      if (!ok || W < 60 || carOver) {
        this.hide(it);
        continue;
      }
      // the element has (about) the size it has on screen, so the browser resamples the picture once, properly
      if (!it.w || Math.abs(W / it.w - 1) > 0.04) {
        it.w = W;
        img.style.width = `${W}px`;
        img.style.height = `${W * ASPECT}px`;
      }
      img.style.transform = quadMatrix(it.w, it.w * ASPECT, pts);
      if (!it.shown) {
        img.style.opacity = '1';
        it.shown = true;
      }
    }
  }

  public dispose() {
    for (const it of this.items.values()) {
      if (it.img) URL.revokeObjectURL(it.img.src);
    }
    this.items.clear();
    this.root.remove();
  }
}