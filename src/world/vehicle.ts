import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type CarModelId = 'bttf';

const CAR_FILES: Record<CarModelId, string> = {
  bttf: './models/bttf_delorean_mobile.glb',
};

export interface VehicleController {
  root: THREE.Group;
  position: THREE.Vector3;
  heading: number;
  pitchAngle: number;
  speed: number;
  currentCar: CarModelId;
  setCarModel: (id: CarModelId) => void;
  setPose: (x: number, z: number, heading?: number, y?: number, pitch?: number) => void;
  ready: Promise<void>;
  /** 0..1 glow around the car (blue underglow + aura) used by the transitions. */
  setFx: (v: number) => void;
  update: (
    dt: number,
    input: { forward: boolean; backward: boolean; left: boolean; right: boolean; boost: boolean },
    autoCruise: boolean,
    stationSlowdownFactor: number,
    cruiseBoost?: number
  ) => void;
}

function makeRadialGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Speed (units/s) the car reaches during the space launch. Keep in sync with
// TRANSITION_TUNING.launch.maxSpeed in transitions.ts (used to scale FX).
const LAUNCH_SPEED = 95;
// Auto-cruise speed inside the Ribbed Gate (boosted fly-through), units/s.
const GATE_SPEED = 44;

interface LampCluster {
  x: number;
  y: number;
  zFront: number; // most-forward (most negative) z of the cluster
  zBack: number; // most-rearward (most positive) z of the cluster
  w: number;
  h: number;
  n: number;
}

// Finds lamp lenses from the model's own emissive-lamp mesh: collects its
// vertices in the car's local space, keeps the ones in the front (or rear) half
// and groups them into per-lamp clusters. Robust to the GLB's baked transforms.
function findLamps(model: THREE.Object3D, rear: boolean): LampCluster[] {
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const pts: THREE.Vector3[] = [];
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => m && m.name && m.name.includes('LightEmissive'))) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (rear ? v.z > 1.5 : v.z < -1.5) pts.push(v.clone());
    }
  });

  interface Acc { sx: number; sy: number; n: number; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  const clusters: Acc[] = [];
  for (const p of pts) {
    let c = clusters.find((k) => Math.abs(k.sx / k.n - p.x) < 0.14 && Math.abs(k.sy / k.n - p.y) < 0.14);
    if (!c) {
      c = { sx: 0, sy: 0, n: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
      clusters.push(c);
    }
    c.sx += p.x;
    c.sy += p.y;
    c.n++;
    c.minX = Math.min(c.minX, p.x);
    c.maxX = Math.max(c.maxX, p.x);
    c.minY = Math.min(c.minY, p.y);
    c.maxY = Math.max(c.maxY, p.y);
    c.minZ = Math.min(c.minZ, p.z);
    c.maxZ = Math.max(c.maxZ, p.z);
  }
  return clusters.map((c) => ({
    x: c.sx / c.n,
    y: c.sy / c.n,
    zFront: c.minZ,
    zBack: c.maxZ,
    w: c.maxX - c.minX,
    h: c.maxY - c.minY,
    n: c.n,
  }));
}

// Splits a mesh that contains all four wheels into one mesh per wheel, assigning
// each triangle to the quadrant (left/right x front/rear) of its world centroid.
// Attributes are copied as plain floats (the GLB is meshopt/quantised), the new
// meshes keep the original's transform, material and flags, and replace it.
function splitByWheel(src: THREE.Mesh, carCenter: THREE.Vector3): THREE.Mesh[] {
  const g = src.geometry as THREE.BufferGeometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  const index = g.index;
  const triCount = (index ? index.count : pos.count) / 3;
  src.updateWorldMatrix(true, false);

  const groups: number[][] = [[], [], [], []];
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const ids = index
      ? [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)]
      : [t * 3, t * 3 + 1, t * 3 + 2];
    c.set(0, 0, 0);
    for (const i of ids) c.add(v.fromBufferAttribute(pos, i).applyMatrix4(src.matrixWorld));
    c.multiplyScalar(1 / 3);
    groups[(c.x < carCenter.x ? 0 : 1) + (c.z < carCenter.z ? 0 : 2)].push(ids[0], ids[1], ids[2]);
  }

  const out: THREE.Mesh[] = [];
  const parent = src.parent!;
  for (const tri of groups) {
    if (!tri.length) continue;
    const remap = new Map<number, number>();
    const p: number[] = [];
    const n: number[] = [];
    const u: number[] = [];
    const idx: number[] = [];
    for (const i of tri) {
      let k = remap.get(i);
      if (k === undefined) {
        k = remap.size;
        remap.set(i, k);
        p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (nor) n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        if (uv) u.push(uv.getX(i), uv.getY(i));
      }
      idx.push(k);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    if (nor) ng.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    if (uv) ng.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    ng.setIndex(idx);
    const m = new THREE.Mesh(ng, src.material);
    m.position.copy(src.position);
    m.quaternion.copy(src.quaternion);
    m.scale.copy(src.scale);
    m.castShadow = src.castShadow;
    m.receiveShadow = src.receiveShadow;
    m.layers.mask = src.layers.mask;
    m.renderOrder = src.renderOrder;
    m.name = src.name + '_wheel' + out.length;
    parent.add(m);
    out.push(m);
  }
  parent.remove(src);
  g.dispose();
  return out;
}

// Reflection brightness of the studio environment on the car body. The city env
// is a dark dusk sky, so brushed steel read as dark grey; the studio env gives it
// long soft highlights like a car commercial. Raise for a brighter, more silver car.
const CAR_ENV_INTENSITY = 0.78;

export function createVehicleController(
  scene: THREE.Scene,
  onProgress?: (fraction: number) => void,
  renderer?: THREE.WebGLRenderer,
  opts: { mobile?: boolean; weak?: boolean } = {}
): VehicleController {
  // One-off PMREM of a soft-box studio, used ONLY by the car's materials (the
  // city keeps its dusk look). No per-frame cost, no extra lights.
  let carEnv: THREE.Texture | null = null;
  if (renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    carEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }

  const root = new THREE.Group();
  root.position.set(2.8, 0.0, 315);
  scene.add(root);

  const chassis = new THREE.Group();
  root.add(chassis);

  const fallbackGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c4ccd8'),
    metalness: 0.9,
    roughness: 0.2,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0c1524'),
    metalness: 0.85,
    roughness: 0.08,
  });
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.98, 6.8), bodyMat);
  bodyMesh.position.y = 0.82;
  bodyMesh.castShadow = true;
  fallbackGroup.add(bodyMesh);

  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.68, 3.2), glassMat);
  cabinMesh.position.set(0, 1.52, -0.2);
  fallbackGroup.add(cabinMesh);
  chassis.add(fallbackGroup);

  const glowTex = makeRadialGlowTexture();
  const lampSprite = (color: string, scale: number) => {
    const m = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.scale.setScalar(scale);
    return s;
  };

  // Dual real headlights: tight warm beams pooling on the asphalt ahead
  const mkHeadlight = (x: number) => {
    const spot = new THREE.SpotLight('#ffe2b0', 34, 68, 0.24, 0.6, 1.55);
    spot.position.set(x, 1.05, -3.55);
    spot.target.position.set(x * 1.8, -0.5, -27);
    if (!opts.mobile && !opts.weak) {
      // Phones & weak GPUs: no real headlight spots (two more lights per fragment)
      root.add(spot);
      root.add(spot.target);
    }
    return spot;
  };
  const headL = mkHeadlight(-0.85);
  const headR = mkHeadlight(0.85);

  // Headlamp halos are created after the GLB loads, at the REAL lamp positions
  // (found from the model's LightEmissive mesh) — see setupHeadlamps().
  const _lampWorld = new THREE.Vector3();
  const _lampFwd = new THREE.Vector3();
  const _lampToCam = new THREE.Vector3();
  const setupHeadlamps = (lamps: LampCluster[]) => {
    // The emissive mesh holds a lot more than headlamps: bumper-level strips/lights
    // (y~0.83), grille strips, corner markers (|x|>1). The real headlamps are the
    // upper row of rectangular lamps in the nose pods — two per side, recessed
    // behind the bumper lip (y~1.07, z~-3.35) — so take the topmost row inboard
    // of the corner markers.
    const cand = lamps.filter((c) => c.n >= 12 && Math.abs(c.x) < 1.0);
    if (!cand.length) return;
    const topY = Math.max(...cand.map((c) => c.y));
    const front = cand.filter((c) => c.y > topY - 0.1);

    // One spotlight per side, emitted just in front of that side's lamp group.
    for (const side of [-1, 1] as const) {
      const grp = front.filter((c) => Math.sign(c.x) === side);
      if (!grp.length) continue;
      const mx = grp.reduce((a, c) => a + c.x, 0) / grp.length;
      const my = grp.reduce((a, c) => a + c.y, 0) / grp.length;
      const mz = Math.min(...grp.map((c) => c.zFront));
      const spot = side < 0 ? headL : headR;
      spot.position.set(mx, my, mz - 0.25);
      spot.target.position.set(mx * 1.8, -0.5, -27);
    }

    // Soft halo per lamp. Sits a hair in front of the lens and fades out when the
    // camera is beside/behind the car, so it never reads as a floating blob.
    // The emissive reflectors sit ~0.2 m BEHIND the visible lens plane (recessed in
    // the nose pod), so a halo placed on them looks shifted inward from an angle.
    // Put it on the lens plane instead, and skip the depth test (small, only seen
    // from the front) so the nose can't clip it into a hard edge.
    // Currently OFF by decision (didn't look right enough); flip to true to re-test.
    const HEADLAMP_HALOS = false;
    for (const c of HEADLAMP_HALOS ? front : []) {
      const size = THREE.MathUtils.clamp(Math.max(c.w, c.h) * 2.0, 0.26, 0.4);
      const halo = lampSprite('#fff1d6', size);
      const mat = halo.material as THREE.SpriteMaterial;
      const baseOpacity = 0.45;
      mat.opacity = baseOpacity;
      mat.depthTest = false;
      halo.renderOrder = 5;
      halo.position.set(c.x, c.y, c.zFront - 0.2);
      halo.layers.set(1);
      halo.onBeforeRender = (_r, _s, camera) => {
        halo.getWorldPosition(_lampWorld);
        chassis.getWorldDirection(_lampFwd).negate(); // car front is local -Z
        _lampToCam.copy(camera.position).sub(_lampWorld).normalize();
        const facing = _lampFwd.dot(_lampToCam);
        mat.opacity = baseOpacity * THREE.MathUtils.smoothstep(facing, 0.15, 0.7);
      };
      chassis.add(halo);
    }

    if (new URLSearchParams(window.location.search).has('debug')) {
      console.info('[headlamps] ' + JSON.stringify(front.map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.zFront.toFixed(2), w: +c.w.toFixed(2), h: +c.h.toFixed(2), n: c.n }))));
    }
  };

  // Taillights: full-width rear glow + brake dynamics
  // Placed on the real tail-lamp grids once the GLB is measured (setupTaillamps).
  // The old fixed spot floated ~0.3 m above/behind the lamps and showed up as a
  // red cloud beside the car from the 3/4 camera.
  const tailMatL = lampSprite('#ff3822', 0.8);
  const tailMatR = lampSprite('#ff3822', 0.8);
  tailMatL.position.set(-0.8, 0.95, 3.62);
  tailMatR.position.set(0.8, 0.95, 3.62);
  root.add(tailMatL, tailMatR);
  let tailBase = 0.5; // brake/launch driven brightness, set every frame in update()

  const setupTaillamps = (lamps: LampCluster[]) => {
    // The emissive mesh also holds inner louver strips and bumper reflectors; averaging
    // everything pulled the halo inboard and ~0.3 m below the lit grids. Use only the
    // big lamp-grid clusters (the visibly glowing ones), one small halo each.
    const rear = lamps.filter((c) => c.n >= 100 && Math.abs(c.x) < 1.2 && c.y > 1.0);
    if (!rear.length) return;
    root.remove(tailMatL, tailMatR); // drop the placeholder pair
    for (const c of rear) {
      const spr = lampSprite('#ff3822', THREE.MathUtils.clamp(Math.max(c.w, c.h) * 2.0, 0.3, 0.55));
      spr.position.set(c.x, c.y, c.zBack + 0.05);
      spr.layers.set(1);
      chassis.add(spr); // follows the body's pitch/roll
      const mat = spr.material as THREE.SpriteMaterial;
      // A camera-facing quad half-buried in the sloped rear panel gets depth-clipped
      // by the body and leaves a hard red diagonal line across the bumper. The halo
      // is small and only shown from behind, so skip the depth test entirely.
      mat.depthTest = false;
      spr.renderOrder = 5;
      // Visible only from behind: fades out as the camera swings to the front/side.
      spr.onBeforeRender = (_r, _s, camera) => {
        spr.getWorldPosition(_lampWorld);
        chassis.getWorldDirection(_lampFwd); // local +Z = the car's back
        _lampToCam.copy(camera.position).sub(_lampWorld).normalize();
        mat.opacity = tailBase * THREE.MathUtils.smoothstep(_lampFwd.dot(_lampToCam), 0.05, 0.55);
      };
    }
    if (new URLSearchParams(window.location.search).has('debug')) {
      console.info('[taillamps] ' + JSON.stringify(rear.map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.zBack.toFixed(2), w: +c.w.toFixed(2), h: +c.h.toFixed(2), n: c.n }))));
    }
  };

  // Flux glow for the transitions: a blue underglow plane + a soft aura around the
  // car. Both always exist (opacity 0 when idle) so their shaders compile with
  // everything else at load instead of mid-jump. HDR colours -> they bloom.
  const underGeo = new THREE.PlaneGeometry(4.2, 9.0);
  underGeo.rotateX(-Math.PI / 2);
  const underMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: new THREE.Color(0.35, 0.9, 2.6),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const underGlow = new THREE.Mesh(underGeo, underMat);
  // 0.12 clears the road crown (0.065) and the lane paint, so it isn't buried.
  underGlow.position.y = 0.12;
  underGlow.layers.set(1);
  root.add(underGlow);

  const auraSprite = lampSprite('#8cc4ff', 11);
  const auraMat = auraSprite.material as THREE.SpriteMaterial;
  auraSprite.position.set(0, 1.1, 0.4);
  auraMat.opacity = 0;
  auraSprite.layers.set(1);
  root.add(auraSprite);
  let fxLevel = 0;

  // Soft contact shadow under the car: the shadow map is coarse (15 cm texels) so
  // without this the car looks like it hovers. One transparent quad, no cost.
  const csCanvas = document.createElement('canvas');
  csCanvas.width = csCanvas.height = 128;
  const csCtx = csCanvas.getContext('2d')!;
  const csGrad = csCtx.createRadialGradient(64, 64, 6, 64, 64, 64);
  csGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  csGrad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  csGrad.addColorStop(1, 'rgba(0,0,0,0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 128, 128);
  const csGeo = new THREE.PlaneGeometry(3.6, 7.6);
  csGeo.rotateX(-Math.PI / 2);
  const csMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(csCanvas),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: false,
  });
  const contactShadow = new THREE.Mesh(csGeo, csMat);
  contactShadow.position.y = 0.085; // above the road crown (0.065)
  contactShadow.layers.set(1);
  root.add(contactShadow);

  // Electric arcs crawling over the body during the transitions. Thin HDR lines
  // (bloom turns them into a glow), re-rolled every 40-140 ms so they crackle.
  // Always rendered (opacity 0 / collapsed when idle) so the shader compiles at load.
  const ARC_COUNT = 14;
  const ARC_SEG = 12;
  const arcPos = new Float32Array(ARC_COUNT * ARC_SEG * 2 * 3);
  const arcGeo = new THREE.BufferGeometry();
  const arcAttr = new THREE.BufferAttribute(arcPos, 3);
  arcGeo.setAttribute('position', arcAttr);
  const arcMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(1.3, 2.4, 4.2),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  // Two copies, a hair apart: WebGL lines are 1px, this makes them read ~2px.
  for (const off of [0, 0.014]) {
    const l = new THREE.LineSegments(arcGeo, arcMat);
    l.position.set(off, off * 0.7, 0);
    l.frustumCulled = false;
    l.layers.set(1);
    chassis.add(l);
  }
  const arcLife = new Float32Array(ARC_COUNT).fill(-1);
  const arcPts: number[] = new Array((ARC_SEG + 1) * 3).fill(0);
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  // Points on the real body (chassis space) with their normals, collected once the model is in: the
  // arcs run over the actual surface - roof, doors, hood, rear, wheel arches - instead of boxes tuned
  // for an earlier model that mostly sat inside the body (only the bumper showed).
  let arcSurface: Float32Array | null = null;
  const collectArcSurface = (group: THREE.Object3D) => {
    chassis.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(chassis.matrixWorld).invert();
    const m4 = new THREE.Matrix4();
    const nm = new THREE.Matrix3();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const pts: number[] = [];
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m && /wheel|tire|tyre/i.test(m.name ?? ''))) return; // they spin
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      if (!pos || !nor || pos.count < 30) return;
      m4.multiplyMatrices(inv, o.matrixWorld);
      nm.getNormalMatrix(m4);
      const step = Math.max(1, Math.floor(pos.count / 70));
      for (let i = Math.floor(Math.random() * step); i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4);
        n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        if (v.y < 0.18) continue; // not under the car
        pts.push(v.x, v.y, v.z, n.x, n.y, n.z);
      }
    });
    arcSurface = pts.length >= 6 * 60 ? new Float32Array(pts) : null;
  };

  const rollArc = (i: number) => {
    let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
    let lx = 0, ly = 0, lz = 0; // which way the arc is lifted off the surface (average normal)
    const r = Math.random();
    let surfaceArc = false;
    if (arcSurface && r < 0.9) {
      const cnt = arcSurface.length / 6;
      const a = Math.floor(Math.random() * cnt) * 6;
      let best = -1;
      for (let tries = 0; tries < 10 && best < 0; tries++) {
        const b = Math.floor(Math.random() * cnt) * 6;
        const d = Math.hypot(arcSurface[b] - arcSurface[a], arcSurface[b + 1] - arcSurface[a + 1], arcSurface[b + 2] - arcSurface[a + 2]);
        if (d > 0.6 && d < 2.6) best = b;
      }
      if (best >= 0) {
        surfaceArc = true;
        ax = arcSurface[a]; ay = arcSurface[a + 1]; az = arcSurface[a + 2];
        bx = arcSurface[best]; by = arcSurface[best + 1]; bz = arcSurface[best + 2];
        lx = arcSurface[a + 3] + arcSurface[best + 3];
        ly = arcSurface[a + 4] + arcSurface[best + 4];
        lz = arcSurface[a + 5] + arcSurface[best + 5];
        const ll = Math.hypot(lx, ly, lz) || 1;
        lx /= ll; ly /= ll; lz /= ll;
      }
    }
    if (surfaceArc) {
      // (positions are set above)
    } else if (r < 0.4) {
      // across the rear panel (the part the chase camera actually sees)
      az = bz = 3.5;
      ax = rnd(-0.95, 0.95);
      bx = rnd(-0.95, 0.95);
      ay = rnd(0.35, 1.15);
      by = rnd(0.35, 1.15);
    } else if (r < 0.7) {
      // along the roof / hood
      ax = bx = rnd(-0.7, 0.7);
      ay = by = rnd(1.0, 1.25);
      az = rnd(-3.3, 0.2);
      bz = az + rnd(1.5, 3.5);
    } else {
      // from the body side down to the road
      const side = Math.random() < 0.5 ? -1 : 1;
      ax = side * 1.0;
      ay = rnd(0.5, 1.0);
      az = rnd(-2.5, 2.5);
      bx = side * rnd(1.15, 1.55);
      by = 0.08;
      bz = az + rnd(-0.6, 0.6);
    }
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const jit = 0.05 + len * 0.045;
    for (let k = 0; k <= ARC_SEG; k++) {
      const t = k / ARC_SEG;
      const edge = k === 0 || k === ARC_SEG ? 0 : Math.sin(Math.PI * t);
      // a surface arc is also bulged away from the paint (a straight chord between two points on a curved
      // body would run inside it), and a little outward everywhere so it never z-fights with the metal
      const lift = surfaceArc ? 0.05 + len * 0.07 * edge : 0;
      arcPts[k * 3] = ax + (bx - ax) * t + rnd(-jit, jit) * edge + lx * lift;
      arcPts[k * 3 + 1] = ay + (by - ay) * t + rnd(-jit, jit) * edge + ly * lift;
      arcPts[k * 3 + 2] = az + (bz - az) * t + rnd(-jit, jit) * edge + lz * lift;
    }
    for (let k = 0; k < ARC_SEG; k++) {
      const o = (i * ARC_SEG + k) * 6;
      arcPos[o] = arcPts[k * 3];
      arcPos[o + 1] = arcPts[k * 3 + 1];
      arcPos[o + 2] = arcPts[k * 3 + 2];
      arcPos[o + 3] = arcPts[k * 3 + 3];
      arcPos[o + 4] = arcPts[k * 3 + 4];
      arcPos[o + 5] = arcPts[k * 3 + 5];
    }
  };
  const clearArc = (i: number) => {
    arcPos.fill(0, i * ARC_SEG * 6, (i + 1) * ARC_SEG * 6);
  };

  // (no fake lens discs — the GLB's own LightEmissive lamps are driven instead)

  // (fire-trail exhaust particles removed — FX to be redesigned)

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loadedModels = new Map<CarModelId, THREE.Group>();
  let activeModelGroup: THREE.Group | null = null;
  let currentCar: CarModelId = 'bttf';

  let resolveReady!: () => void;
  const ready = new Promise<void>((res) => {
    resolveReady = res;
  });
  let readyDone = false;
  const markReady = () => {
    if (!readyDone) {
      readyDone = true;
      resolveReady();
    }
  };

  const applyModel = (id: CarModelId, group: THREE.Group) => {
    if (activeModelGroup) {
      chassis.remove(activeModelGroup);
    }
    fallbackGroup.visible = false;
    activeModelGroup = group;
    chassis.add(group);
    currentCar = id;
    setupWheelPivots(group);
    collectArcSurface(group);
    if (new URLSearchParams(window.location.search).has('debug')) {
      console.info('[wheels] pivots=' + wheelPivots.length);
    }
  };

  // Wheels have baked transforms in these Sketchfab GLBs — detect them by
  // bounding box (roundish, low, out at the four corners) and re-pivot.
  const wheelPivots: { pivot: THREE.Group; r: number }[] = [];
  const setupWheelPivots = (group: THREE.Group) => {
    wheelPivots.length = 0;
    // Everything below works in world space, so the whole chain up to the scene must be current:
    // the car is now created (and may be posed / moved) before anything has been rendered, and a
    // stale parent matrix put the re-pivoted wheels in the wrong place.
    group.updateWorldMatrix(true, true);
    const carBox = new THREE.Box3().setFromObject(group);
    const carSize = carBox.getSize(new THREE.Vector3());
    const carC = carBox.getCenter(new THREE.Vector3());
    const wheelMeshes: { mesh: THREE.Mesh; c: THREE.Vector3; r: number }[] = [];
    const meshes: { mesh: THREE.Mesh; b: THREE.Box3 }[] = [];

    // This GLB bakes all four wheels (tyre + rim) into ONE mesh, so the corner
    // search below finds nothing and the wheels never turned. Split that mesh into
    // four per-wheel meshes by triangle position first.
    let wheelSrc: THREE.Mesh | null = null;
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && !wheelSrc) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m && /wheel/i.test(m.name ?? ''))) wheelSrc = o;
      }
    });
    if (wheelSrc) {
      for (const m of splitByWheel(wheelSrc, carC)) {
        const b = new THREE.Box3().setFromObject(m);
        wheelMeshes.push({ mesh: m, c: b.getCenter(new THREE.Vector3()), r: b.getSize(new THREE.Vector3()).y / 2 });
      }
    }
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push({ mesh: o, b: new THREE.Box3().setFromObject(o) });
    });
    // Fallback (models with separate wheel meshes): corner search just above the ground
    for (const sx of wheelMeshes.length ? [] : [-1, 1]) {
      for (const sz of [-1, 1]) {
        const ex = carC.x + sx * carSize.x * 0.36;
        const ez = carC.z + sz * carSize.z * 0.33;
        let best: { mesh: THREE.Mesh; b: THREE.Box3 } | null = null;
        let bestD = Infinity;
        for (const m of meshes) {
          const s = m.b.getSize(new THREE.Vector3());
          const c = m.b.getCenter(new THREE.Vector3());
          if (c.y - carBox.min.y > 0.55) continue;
          if (Math.max(s.x, s.y, s.z) > 1.4) continue;
          const d = (c.x - ex) ** 2 + (c.z - ez) ** 2;
          if (d < bestD) {
            bestD = d;
            best = m;
          }
        }
        if (best && !wheelMeshes.some((w) => w.mesh === best!.mesh)) {
          const b2 = best.b;
          wheelMeshes.push({ mesh: best.mesh, c: b2.getCenter(new THREE.Vector3()), r: b2.getSize(new THREE.Vector3()).y / 2 });
        }
      }
    }
    const worldLateral = new THREE.Vector3(1, 0, 0);
    for (const { mesh, c, r } of wheelMeshes) {
      const parent = mesh.parent!;
      const pivot = new THREE.Group();
      parent.add(pivot);
      parent.updateWorldMatrix(true, true);
      pivot.position.copy(parent.worldToLocal(c.clone()));
      pivot.updateWorldMatrix(true, false);
      pivot.attach(mesh);
      // Resolve the spin axis ONCE in pivot-local space — recomputing it per
      // frame against the already-rotated matrix makes wheels never turn.
      pivot.updateMatrixWorld(true);
      const axis = worldLateral
        .clone()
        .transformDirection(pivot.matrixWorld.clone().invert())
        .normalize();
      pivot.userData.ax = axis;
      wheelPivots.push({ pivot, r });
    }
  };

  const loadCarModel = (id: CarModelId) => {
    const cached = loadedModels.get(id);
    if (cached) {
      applyModel(id, cached);
      return;
    }

    loader.load(
      CAR_FILES[id],
      (gltf) => {
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 7.2 / Math.max(size.x, size.z, 0.001);
        model.scale.multiplyScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale + 0.06, -center.z * scale);

        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = false; // lowpoly proxy casts the shadow instead
            obj.receiveShadow = true;
            obj.layers.set(1); // hidden from the planar reflection camera
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (const m of mats) {
                if (m instanceof THREE.MeshStandardMaterial) {
                  if (carEnv) {
                    m.envMap = carEnv; // studio soft-boxes, car only
                    m.envMapIntensity = CAR_ENV_INTENSITY;
                  } else {
                    m.envMapIntensity = 2.4; // fallback: stronger city-env reflections
                  }
                  if (m.name === 'orange_glass') {
                    m.emissive.setRGB(0, 0, 0);
                    m.emissiveIntensity = 0;
                    m.color.setRGB(0.28, 0.11, 0.02);
                    m.opacity = 0.85;
                  }
                  if (m.name && m.name.includes('LightEmissive')) {
                    m.emissive.setRGB(0.85, 0.92, 1.0);
                    m.emissiveIntensity = 3.0;
                    m.depthWrite = true;
                  }
                  if (m.name === 'red_glas') {
                    m.emissiveIntensity = 0.85;
                  }
                  if (m.metalness < 0.3 && m.roughness > 0.6) {
                    m.metalness = 0.82;
                    m.roughness = 0.22;
                  }
                  // Gloss pass: non-glass body mats get a tight specular — the
                  // brushed-steel DeLorean should read almost chrome at dusk.
                  if (!/glass|glas|glass_?0|tire|tyre|wheel/i.test(m.name ?? '')) {
                    m.metalness = Math.max(m.metalness, 0.85);
                    m.roughness = Math.min(m.roughness, 0.18);
                  }
                  // The door / wing panels carry a brushed-steel normal map that is far too strong for a
                  // glossy reflection: every bright highlight broke up into torn white patches ("squares").
                  // At 30% the brushed grain stays, the highlight is one soft shape.
                  if (/PaletteMaterial006/.test(m.name ?? '') && m.normalMap) m.normalScale.set(0.3, 0.3);
                }
              }
            }
          }
        });

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.rotation.y = (size.x > size.z ? Math.PI / 2 : 0) + Math.PI;
        loadedModels.set(id, wrapper);
        // Lamp positions are measured while the wrapper is still unparented, so
        // they come out in the car's own (chassis) space, independent of the pose.
        const lamps = findLamps(wrapper, false);
        const rearLamps = findLamps(wrapper, true);
        if (currentCar === id) {
          applyModel(id, wrapper);
          setupHeadlamps(lamps);
          setupTaillamps(rearLamps);
        }
        markReady();
      },
      (ev) => {
        if (onProgress && ev.total > 0) onProgress(Math.min(1, ev.loaded / ev.total));
      },
      () => {
        fallbackGroup.visible = true;
        markReady();
      }
    );
  };

  loadCarModel('bttf');

  // Lowpoly twins, one file two roles:
  //  a) shadow proxy — writes nothing to the framebuffer (colorWrite off) but
  //     casts the real directional shadow. Scaled 0.985 so its silhouette sits
  //     a hair inside the body -> no self-shadow acne on the detailed car.
  //  b) reflection proxy — a REAL cheap material on layer 2, seen only by the
  //     planar reflection camera (detailed car moved to layer 1).
  // (Phones have shadows and the planar reflection switched off, so skip these
  // two proxies entirely — saves a 1.6 MB download and two meshes.)
  if (!opts.mobile) loader.load('./models/bttf_delorean_shadow_v2.glb', (gltf) => {
    const mkNormalized = () => {
      const model = gltf.scene.clone(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 7.2 / Math.max(size.x, size.z, 0.001);
      model.scale.multiplyScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale + 0.06, -center.z * scale);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.rotation.y = (size.x > size.z ? Math.PI / 2 : 0) + Math.PI;
      return wrapper;
    };

    const shadowWrap = mkNormalized();
    const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    shadowWrap.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.material = ghost;
      }
    });
    shadowWrap.scale.setScalar(0.985);
    chassis.add(shadowWrap);

    const reflWrap = mkNormalized();
    const reflMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#232830'),
      metalness: 0.7,
      roughness: 0.35,
    });
    reflWrap.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.material = reflMat;
        obj.layers.set(2);
      }
    });
    chassis.add(reflWrap);
  });

  let heading = 0;
  let pitchAngle = 0; // 0 on road, smoothly rotates up to +Math.PI/2 (90 degrees straight up!) in Act III Space Launch
  let speed = 0;
  let prevSpeed = 0;
  let brakeGlow = 0;
  let exhaustTime = 0;

  return {
    root,
    get position() {
      return root.position;
    },
    get heading() {
      return heading;
    },
    get pitchAngle() {
      return pitchAngle;
    },
    get speed() {
      return speed;
    },
    get currentCar() {
      return currentCar;
    },
    ready,
    setFx: (v: number) => {
      fxLevel = THREE.MathUtils.clamp(v, 0, 1);
    },
    setCarModel: (id: CarModelId) => {
      currentCar = id;
      loadCarModel(id);
    },
    setPose: (x: number, z: number, newHeading = 0, y = 0, pitch = 0) => {
      root.position.set(x, y, z);
      heading = newHeading;
      pitchAngle = pitch;
      speed = 0;
      root.rotation.set(pitchAngle, heading, 0, 'YXZ');
      chassis.rotation.set(0, 0, 0);
      root.updateMatrixWorld(true);
    },
    update: (dt, input, autoCruise, stationSlowdownFactor, cruiseBoost = 0) => {
      exhaustTime += dt;
      const maxSpeed = input.boost ? 56 : 34;
      const accel = input.boost ? 36 : 22;

      if (input.forward) {
        speed = THREE.MathUtils.lerp(speed, maxSpeed, 1 - Math.exp(-accel * 0.12 * dt));
      } else if (input.backward) {
        speed = THREE.MathUtils.lerp(speed, -18, 1 - Math.exp(-18 * 0.12 * dt));
      } else if (autoCruise) {
        const launching = root.position.z <= -442 || root.position.y > 0.5;
        if (launching) {
          // Rocket burst up through the ring, then a hard brake into calm weightlessness
          // once the contact card opens (stationSlowdownFactor ramps to 0.72 there).
          const calm = THREE.MathUtils.clamp(stationSlowdownFactor / 0.72, 0, 1);
          const targetLaunch = THREE.MathUtils.lerp(LAUNCH_SPEED, 6, calm);
          speed = THREE.MathUtils.lerp(speed, targetLaunch, 1 - Math.exp(-(calm > 0 ? 3.2 : 1.7) * dt));
        } else {
          // In auto-cruise, smoothly slow down when approaching a project station (`stationSlowdownFactor` 0..1)
          const cruise = THREE.MathUtils.lerp(28, GATE_SPEED, cruiseBoost);
          const targetCruise = THREE.MathUtils.lerp(cruise, 0, stationSlowdownFactor);
          // Gentle rate while the boost is on/easing out: no hard braking at the exit.
          speed = THREE.MathUtils.lerp(speed, targetCruise, 1 - Math.exp(-(cruiseBoost > 0 ? 2.0 : 4.2) * dt));
        }
      } else {
        speed = THREE.MathUtils.lerp(speed, 0, 1 - Math.exp(-4.5 * dt));
        if (Math.abs(speed) < 0.08) speed = 0;
      }

      const steerRate = 1.35 * Math.min(1, Math.abs(speed) / 6);
      let steerInput = 0;
      if (input.left) steerInput += 1;
      if (input.right) steerInput -= 1;

      if (autoCruise && Math.abs(steerInput) < 0.01) {
        const targetX = root.position.z < -430 ? 0.0 : 2.8;
        const xErr = targetX - root.position.x;
        heading = THREE.MathUtils.lerp(heading, THREE.MathUtils.clamp(-xErr * 0.05, -0.2, 0.2), 1 - Math.exp(-4 * dt));
      } else {
        heading += steerInput * steerRate * (speed >= 0 ? 1 : -1) * dt;
      }

      // Check if we passed through The Continuum Arch (z < -442) -> 90-degree vertical launch into space!
      if (root.position.z <= -442 || root.position.y > 0.5) {
        if (speed >= 0) {
          // Smoothly rotate pitch up to 90 degrees (+Math.PI / 2) and ascend into the cosmos!
          const launchProgress = THREE.MathUtils.clamp((-442 - root.position.z) / 22 + root.position.y / 35, 0, 1);
          const targetPitch = launchProgress * (Math.PI * 0.48); // ~86-90 degrees vertical climb!
          // Snappy pitch-up (was 3.5/s, felt too smooth) — the flash + hit-stop sell it
          pitchAngle = THREE.MathUtils.lerp(pitchAngle, targetPitch, 1 - Math.exp(-6.5 * dt));

          const forwardHoriz = Math.cos(pitchAngle) * speed;
          const climbVert = Math.sin(pitchAngle) * speed;

          root.position.z -= forwardHoriz * dt;
          // Ceiling raised 220 -> 520: the rocket flight now lasts ~4s before the card.
          root.position.y = Math.min(520, root.position.y + climbVert * dt);
          root.position.x = THREE.MathUtils.lerp(root.position.x, 0, 1 - Math.exp(-3 * dt));
        } else {
          // Reversing back down to road
          root.position.y = Math.max(0, root.position.y + speed * Math.sin(pitchAngle) * dt);
          root.position.z -= speed * Math.cos(pitchAngle) * dt;
          if (root.position.y <= 0.1) {
            root.position.y = 0;
            pitchAngle = THREE.MathUtils.lerp(pitchAngle, 0, 1 - Math.exp(-6 * dt));
          }
        }
      } else {
        pitchAngle = THREE.MathUtils.lerp(pitchAngle, 0, 1 - Math.exp(-6 * dt));
        root.position.y = THREE.MathUtils.lerp(root.position.y, 0, 1 - Math.exp(-8 * dt));
        const vx = -Math.sin(heading) * speed;
        const vz = -Math.cos(heading) * speed;
        root.position.x = THREE.MathUtils.clamp(root.position.x + vx * dt, -9.2, 9.2);
        root.position.z += vz * dt;
      }

      if (root.position.z > 345) {
        root.position.z = 345;
        speed = 0;
      }

      root.rotation.set(pitchAngle, heading, 0, 'YXZ');

      const targetPitch = THREE.MathUtils.clamp((speed / maxSpeed) * 0.018, -0.02, 0.025);
      const targetRoll = THREE.MathUtils.clamp(-steerInput * (speed / maxSpeed) * 0.035, -0.04, 0.04);
      chassis.rotation.x = THREE.MathUtils.lerp(chassis.rotation.x, targetPitch, 1 - Math.exp(-10 * dt));
      chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z, targetRoll, 1 - Math.exp(-10 * dt));

      // --- Brake lights: flare up on deceleration / reverse input --------------
      const decel = (prevSpeed - speed) / Math.max(dt, 0.001);
      const braking = (decel > 4.5 && prevSpeed > 0.5) || (input.backward && speed > 1.5);
      brakeGlow = THREE.MathUtils.lerp(brakeGlow, braking ? 1 : 0, 1 - Math.exp(-9 * dt));
      const tailHot = 0.5 + brakeGlow * 0.5 + (pitchAngle > 0.05 ? 0.35 : 0);
      tailBase = Math.min(1, tailHot);
      // (until the lamps are measured, the sprites use this directly)
      if (!tailMatL.onBeforeRender || tailMatL.parent === root) {
        (tailMatL.material as THREE.SpriteMaterial).opacity = tailBase;
        (tailMatR.material as THREE.SpriteMaterial).opacity = tailBase;
      }
      prevSpeed = speed;

      // --- Headlight dynamics: subtle boost surge + beam flicker ---------------
      const flicker = input.boost ? Math.sin(exhaustTime * 47) * 3.5 : 0;
      const headI = 30 + Math.min(14, Math.abs(speed) * 0.22) + flicker;
      headL.intensity = headI;
      headR.intensity = headI;
      headL.target.updateMatrixWorld();
      headR.target.updateMatrixWorld();

      // Transition glow (blue underglow + aura), with a fast electric flicker
      const fxPulse = 0.86 + 0.14 * Math.sin(exhaustTime * 38) * Math.sin(exhaustTime * 11.7);
      underMat.opacity = fxLevel * 0.7 * fxPulse;
      auraMat.opacity = fxLevel * 0.22 * fxPulse;
      // contact shadow only while the car is actually on the road
      csMat.opacity = 0.55 * THREE.MathUtils.clamp(1 - pitchAngle * 6, 0, 1) * THREE.MathUtils.clamp(1 - root.position.y / 1.5, 0, 1);

      // Electric arcs: more of them as the glow level rises, none when idle
      const arcsActive = fxLevel > 0.2 ? Math.round(ARC_COUNT * Math.min(1, (fxLevel - 0.2) / 0.7)) : 0;
      let arcsChanged = false;
      for (let i = 0; i < ARC_COUNT; i++) {
        if (i >= arcsActive) {
          if (arcLife[i] > -1) {
            clearArc(i);
            arcLife[i] = -1;
            arcsChanged = true;
          }
          continue;
        }
        arcLife[i] -= dt;
        if (arcLife[i] <= 0) {
          rollArc(i);
          arcLife[i] = rnd(0.04, 0.14);
          arcsChanged = true;
        }
      }
      if (arcsChanged) arcAttr.needsUpdate = true;
      arcMat.opacity = arcsActive > 0 ? Math.min(1, fxLevel * 1.4) * (0.75 + 0.25 * Math.random()) : 0;

      // Wheel spin — re-pivoted hubs rotate about the car's lateral axis
      if (wheelPivots.length && Math.abs(speed) > 0.05) {
        // airborne (rocket launch): wheels free-spin slowly instead of strobing
        const grip = root.position.y > 0.6 ? 0.2 : 1;
        for (const { pivot, r } of wheelPivots) {
          pivot.rotateOnAxis(pivot.userData.ax, (-speed * grip * dt) / r);
        }
      }

    },
  };
}
