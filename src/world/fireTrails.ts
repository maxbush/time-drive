import * as THREE from 'three';

// ============================================================================
// FIRE TRAILS — the two lines of flame the DeLorean leaves behind its rear
// wheels during the time jump (and the rocket launch). One Points draw call,
// ring buffers, a tiny custom shader; zero textures, zero downloads.
// The mesh always exists (dead points have size 0) so its shader compiles
// with everything else at load, never mid-jump.
// ============================================================================

const PER_WHEEL = 320; // ring size per wheel
const LIFE = 2.6; // seconds a flame point lives
const SPACING = 0.42; // metres between emitted points
const SIZE = 0.7; // world-space diameter of a fresh flame blob
const WHEEL_X = 0.95; // rear wheel track (car local)
const WHEEL_Y = 0.2;
const WHEEL_Z = 2.35; // rear axle (car front is -Z)
const MAX_SPAWN_PER_FRAME = 10;

export interface FireTrails {
  points: THREE.Points;
  /** pxScale = drawing-buffer height / 2 / tan(fov / 2) (world size -> pixels at 1 m). */
  update: (time: number, root: THREE.Object3D, speed: number, active: boolean, pxScale: number) => void;
  reset: () => void;
}

export function createFireTrails(scene: THREE.Scene): FireTrails {
  const total = PER_WHEEL * 2;
  const pos = new Float32Array(total * 3);
  const birth = new Float32Array(total);
  const seed = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    pos[i * 3 + 1] = -1000;
    birth[i] = -1000;
    seed[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uLife: { value: LIFE },
      uSize: { value: SIZE },
      uPx: { value: 900 },
    },
    vertexShader: /* glsl */ `
      attribute float aBirth;
      attribute float aSeed;
      uniform float uTime;
      uniform float uLife;
      uniform float uSize;
      uniform float uPx;
      varying float vT;
      varying float vSeed;
      void main() {
        float t = (uTime - aBirth) / uLife;
        vT = t;
        vSeed = aSeed;
        vec3 p = position;
        // flames lick upward and drift sideways as they age
        p.y += t * 0.55 + 0.08 * sin(uTime * 18.0 + aSeed * 40.0);
        p.x += (aSeed - 0.5) * 0.35 * t;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = uSize * (0.55 + 0.9 * (1.0 - clamp(t, 0.0, 1.0))) * (0.8 + 0.4 * aSeed);
        float px = s * uPx / max(-mv.z, 0.1);
        gl_PointSize = (t < 0.0 || t > 1.0) ? 0.0 : min(px, 512.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vT;
      varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float t = clamp(vT, 0.0, 1.0);
        // Flame-shaped alpha: per-particle cell noise breaks the round blob
        // into a ragged tongue; older flakes get rougher edges.
        float n = fract(sin(dot(floor(gl_PointCoord * 7.0 + vSeed * 57.0),
                                vec2(12.9898, 78.233))) * 43758.5453);
        float a = smoothstep(1.0, 0.15, d) * (0.45 + 0.55 * n);
        vec3 hot = vec3(1.9, 0.95, 0.2);
        vec3 mid = vec3(1.7, 0.5, 0.07);
        vec3 cool = vec3(0.55, 0.07, 0.02);
        vec3 col = mix(hot, mid, smoothstep(0.0, 0.18, t));
        col = mix(col, cool, smoothstep(0.18, 1.0, t));
        // White-hot core on young particles — fire reads as fire, not glow.
        col += vec3(1.3, 1.1, 0.6) * smoothstep(0.45, 0.0, d) * (1.0 - t) * 0.7;
        float fade = pow(1.0 - t, 1.5);
        float flick = 0.75 + 0.25 * sin(uTime * 42.0 + vSeed * 31.0);
        gl_FragColor = vec4(max(col * a * a * fade * flick, vec3(0.0)), 1.0);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.layers.set(1); // not in the planar reflection pass
  points.name = 'fireTrails';
  scene.add(points);

  const head = [0, 0];
  const last: (THREE.Vector3 | null)[] = [null, null];
  const cur = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const birthAttr = geo.getAttribute('aBirth') as THREE.BufferAttribute;

  const spawn = (w: number, p: THREE.Vector3, time: number) => {
    const idx = w * PER_WHEEL + head[w];
    head[w] = (head[w] + 1) % PER_WHEEL;
    pos[idx * 3] = p.x + (Math.random() - 0.5) * 0.12;
    pos[idx * 3 + 1] = p.y;
    pos[idx * 3 + 2] = p.z + (Math.random() - 0.5) * 0.12;
    birth[idx] = time;
  };

  return {
    points,
    update: (time, root, speed, active, pxScale) => {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uPx.value = pxScale;
      root.updateMatrixWorld();
      let dirty = false;
      for (let w = 0; w < 2; w++) {
        if (!(active && speed > 6)) {
          last[w] = null;
          continue;
        }
        cur.set(w === 0 ? -WHEEL_X : WHEEL_X, WHEEL_Y, WHEEL_Z);
        root.localToWorld(cur);
        const prev = last[w];
        if (!prev || prev.distanceTo(cur) > 20) {
          last[w] = cur.clone();
          spawn(w, cur, time);
          dirty = true;
          continue;
        }
        const dist = prev.distanceTo(cur);
        const n = Math.min(MAX_SPAWN_PER_FRAME, Math.floor(dist / SPACING));
        if (n > 0) {
          for (let i = 1; i <= n; i++) {
            tmp.lerpVectors(prev, cur, (i * SPACING) / dist);
            spawn(w, tmp, time);
          }
          // advance by exactly what we emitted, keep the remainder for next frame
          prev.lerp(cur, Math.min(1, (n * SPACING) / dist));
          dirty = true;
        }
      }
      if (dirty) {
        posAttr.needsUpdate = true;
        birthAttr.needsUpdate = true;
      }
    },
    reset: () => {
      for (let i = 0; i < total; i++) {
        pos[i * 3 + 1] = -1000;
        birth[i] = -1000;
      }
      last[0] = last[1] = null;
      posAttr.needsUpdate = true;
      birthAttr.needsUpdate = true;
    },
  };
}
