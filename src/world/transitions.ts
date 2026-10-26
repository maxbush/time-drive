import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// ============================================================================
// TRANSITION DIRECTOR
// One small timeline that turns "the car just crossed X" into the numbers every
// other system needs: camera shake, FOV kick, hit-stop (time scale), a warp
// amount for the post pass and an in-GL white-out. All the feel lives in
// TRANSITION_TUNING — tweak numbers here, nothing else needs to change.
// ============================================================================

export const TRANSITION_TUNING = {
  // Global multipliers: 1 = the aggressive default, 0.5 = half as violent.
  shake: 1.0,
  fov: 1.0,
  warp: 1.0,
  hitStop: 1.0,

  // Camera shake amplitude at shake=1 (metres of position, radians of roll).
  shakePos: 0.22,
  shakeRoll: 0.035,

  jump: {
    approachStartZ: 152, // ramp-up begins here (before the crossed-out "THE PAST" sign)
    impactZ: 112, // the flash lands here: the sign / pedestrian crossing, just before the gate
    preFov: 8, // FOV kick (deg) right before impact
    impactFov: 24, // extra FOV (deg) on impact, decays
    fovDecay: 2.6,
    shakeDecay: 2.0,
    warpDecay: 2.4,
    // The gate is the prettiest thing in Act I, so the flash is a see-through
    // edge burst (bright frame, clear centre) instead of a full white-out.
    flashPeak: 0.45,
    flashEdge: 0.9, // 0 = centre-weighted white-out, 1 = edge-weighted burst
    flashRise: 0.08, // seconds
    flashDecay: 4.2,
    hitStopSecs: 0.06,
    hitStopScale: 0.25,
    durationSecs: 3.0,
    // Inside the gate: faster cruise + blur-streaked ribs + glow around the car.
    gateEndZ: -35,
    gateCruiseBoost: 1, // 0..1 -> vehicle cruise 28 -> GATE_SPEED (vehicle.ts)
    boostFadeStartZ: 45, // the extra speed eases out over a long stretch so the exit doesn't brake
    gateFov: 10,
    gateWarp: 0.5,
    gateShake: 0.14,
    gateCarFx: 1,
  },

  launch: {
    approachStartZ: -410,
    impactZ: -442, // The Continuum ring
    preFov: 8,
    impactFov: 34,
    ascentFov: 26, // extra FOV (deg) while speed is high
    fovDecay: 2.2,
    shakeDecay: 1.4,
    warpDecay: 2.0,
    flashRise: 0.12,
    flashHold: 0.3, // was 0.4 / 2.2: the white lifts a touch earlier so the car is back in frame sooner
    flashDecay: 2.8,
    hitStopSecs: 0.1,
    hitStopScale: 0.15,
    maxSpeed: 95, // for normalising ascent effects (matches vehicle launch speed)
    // How long the rocket flight plays before the contact card may open.
    cardDelaySecs: 4.2,
  },
} as const;

export type TransitionKind = 'jump' | 'launch';

export interface TransitionState {
  shake: number; // 0..1
  fovKick: number; // degrees added to the base FOV
  warp: number; // 0..1+ strength for the post pass
  flash: number; // 0..1 white-out
  flashEdge: number; // 0 = centre-weighted, 1 = edge-weighted (see-through) flash
  timeScale: number; // 1 = normal, <1 = hit-stop
  cruiseBoost: number; // 0..1 extra auto-cruise speed (gate fly-through)
  carFx: number; // 0..1 glow around the car (underglow + aura)
  kind: TransitionKind | null; // which transition is currently driving effects
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export class TransitionDirector {
  public readonly state: TransitionState = {
    shake: 0,
    fovKick: 0,
    warp: 0,
    flash: 0,
    flashEdge: 0,
    timeScale: 1,
    cruiseBoost: 0,
    carFx: 0,
    kind: null,
  };

  private jumpArmed = true;
  private launchArmed = true;
  private jumpT = -1; // seconds since impact, <0 = not impacted
  private launchT = -1;
  /** prefers-reduced-motion: other systems (camera sway) can read this too. */
  public readonly reduced: boolean;

  /** Fires once on impact: lets the engine hook sound / extra FX later. */
  public onImpact?: (kind: TransitionKind) => void;

  constructor() {
    this.reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Re-arm both transitions (journey restarted / teleported to the start). */
  public reset() {
    this.jumpArmed = true;
    this.launchArmed = true;
    this.jumpT = -1;
    this.launchT = -1;
  }

  /** dt is REAL time (not hit-stop scaled). */
  public update(dt: number, z: number, y: number, speed: number) {
    const T = TRANSITION_TUNING;
    const s = this.state;

    // Re-arm when the car is well back before a trigger.
    if (z > T.jump.approachStartZ + 12) {
      this.jumpArmed = true;
      this.jumpT = -1;
    }
    if (z > T.launch.approachStartZ + 12 || (y < 1 && z > T.launch.impactZ + 30)) {
      this.launchArmed = true;
      this.launchT = -1;
    }

    // --- impact triggers --------------------------------------------------
    if (this.jumpArmed && z <= T.jump.impactZ && z > T.jump.impactZ - 40 && y < 2 && speed > 0) {
      this.jumpArmed = false;
      this.jumpT = 0;
      this.onImpact?.('jump');
    }
    if (this.launchArmed && z <= T.launch.impactZ && z > T.launch.impactZ - 40 && y < 10 && speed > 0) {
      this.launchArmed = false;
      this.launchT = 0;
      this.onImpact?.('launch');
    }
    if (this.jumpT >= 0) this.jumpT += dt;
    if (this.launchT >= 0) this.launchT += dt;

    let shake = 0;
    let fov = 0;
    let warp = 0;
    let flash = 0;
    let flashEdge = 0;
    let cruiseBoost = 0;
    let carFx = 0;
    let ts = 1;
    let kind: TransitionKind | null = null;

    // --- JUMP (88 MPH) ----------------------------------------------------
    {
      const J = T.jump;
      if (this.jumpT < 0) {
        const p = clamp01((J.approachStartZ - z) / (J.approachStartZ - J.impactZ));
        if (p > 0 && z > J.impactZ && y < 2) {
          shake = Math.max(shake, 0.3 * p * p);
          fov = Math.max(fov, J.preFov * p);
          warp = Math.max(warp, 0.3 * p);
          carFx = Math.max(carFx, 0.5 * p);
          kind = 'jump';
        }
      } else {
        const t = this.jumpT;
        if (t < J.durationSecs) {
          flash = (t < J.flashRise ? t / J.flashRise : Math.exp(-(t - J.flashRise) * J.flashDecay)) * J.flashPeak;
          flashEdge = J.flashEdge;
          fov = Math.max(fov, J.impactFov * Math.exp(-t * J.fovDecay));
          shake = Math.max(shake, Math.exp(-t * J.shakeDecay));
          warp = Math.max(warp, Math.exp(-t * J.warpDecay));
          if (t < J.hitStopSecs + 0.2) {
            ts = t < J.hitStopSecs ? J.hitStopScale : THREE.MathUtils.lerp(J.hitStopScale, 1, smooth(J.hitStopSecs, J.hitStopSecs + 0.2, t));
          }
          kind = 'jump';
        }
        // Sustained fly-through of the gate: the ribs streak past, the car glows.
        if (y < 2 && z > J.gateEndZ) {
          const enter = clamp01((J.impactZ + 6 - z) / 16);
          const exit = 1 - clamp01((-5 - z) / (-5 - J.gateEndZ));
          const env = enter * exit;
          if (env > 0) {
            cruiseBoost = enter * (1 - smooth(J.boostFadeStartZ, J.gateEndZ, z)) * J.gateCruiseBoost;
            fov = Math.max(fov, J.gateFov * env);
            warp = Math.max(warp, J.gateWarp * env);
            shake = Math.max(shake, J.gateShake * env);
            carFx = Math.max(carFx, J.gateCarFx * env);
            kind = kind ?? 'jump';
          }
        }
      }
    }

    // --- LAUNCH (to space) ------------------------------------------------
    {
      const L = T.launch;
      const speedNorm = clamp01(speed / L.maxSpeed);
      if (this.launchT < 0) {
        const p = clamp01((L.approachStartZ - z) / (L.approachStartZ - L.impactZ));
        if (p > 0 && z > L.impactZ && y < 2) {
          shake = Math.max(shake, 0.25 * p * p);
          fov = Math.max(fov, L.preFov * p);
          warp = Math.max(warp, 0.25 * p);
          carFx = Math.max(carFx, 0.4 * p);
          kind = 'launch';
        }
      } else {
        const t = this.launchT;
        const f = t < L.flashRise ? t / L.flashRise : t < L.flashRise + L.flashHold ? 1 : Math.exp(-(t - L.flashRise - L.flashHold) * L.flashDecay);
        flash = Math.max(flash, f);
        flashEdge = 0;
        carFx = Math.max(carFx, 0.35 + 0.65 * speedNorm);
        fov = Math.max(fov, L.impactFov * Math.exp(-t * L.fovDecay) + L.ascentFov * speedNorm);
        shake = Math.max(shake, Math.exp(-t * L.shakeDecay) + 0.3 * speedNorm);
        warp = Math.max(warp, Math.exp(-t * L.warpDecay) + 0.4 * speedNorm);
        if (t < L.hitStopSecs + 0.2) {
          ts = t < L.hitStopSecs ? L.hitStopScale : THREE.MathUtils.lerp(L.hitStopScale, 1, smooth(L.hitStopSecs, L.hitStopSecs + 0.2, t));
        }
        kind = 'launch';
      }
    }

    // --- global multipliers + accessibility --------------------------------
    const calm = this.reduced ? 0.15 : 1;
    s.shake = Math.min(1.3, shake * T.shake * calm);
    s.fovKick = fov * T.fov * (this.reduced ? 0.2 : 1);
    s.warp = Math.min(1.3, warp * T.warp * (this.reduced ? 0.3 : 1));
    s.flash = this.reduced ? Math.min(0.7, flash) : flash;
    s.flashEdge = flashEdge;
    s.timeScale = this.reduced ? 1 : THREE.MathUtils.lerp(1, ts, T.hitStop);
    s.cruiseBoost = cruiseBoost;
    s.carFx = carFx;
    s.kind = kind;
  }

  /** True from the launch impact until the car is back on the ground / restarted. */
  public get launchPlaying(): boolean {
    return this.launchT >= 0;
  }

  /** Seconds since the launch impact (0 when no launch is playing). */
  public get launchElapsed(): number {
    return this.launchT >= 0 ? this.launchT : 0;
  }

  /** Sustained effects are meaningful only while something is playing. */
  public get active(): boolean {
    const s = this.state;
    return s.flash > 0.002 || s.warp > 0.01 || s.shake > 0.002 || s.fovKick > 0.05;
  }
}

// ============================================================================
// POST PASS: radial "warp" blur + chromatic aberration + HDR white-out.
// Sits BEFORE bloom so the flash is > 1.0 and blooms into a proper burst.
// ============================================================================

const TransitionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uWarp: { value: 0 },
    uFlash: { value: 0 },
    uFlashEdge: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uWarp;
    uniform float uFlash;
    uniform float uFlashEdge;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uAspect, 1.0));

      // Radial blur toward the centre, stronger at the edges (speed tunnel)
      float strength = uWarp * 0.06 * smoothstep(0.05, 0.75, r);
      float ca = uWarp * 0.012 * smoothstep(0.1, 0.8, r);
      vec3 col = vec3(0.0);
      const int TAPS = 6;
      for (int i = 0; i < TAPS; i++) {
        float t = float(i) / float(TAPS - 1);
        float sc = 1.0 - strength * t;
        col.r += texture2D(tDiffuse, 0.5 + c * (sc + ca)).r;
        col.g += texture2D(tDiffuse, 0.5 + c * sc).g;
        col.b += texture2D(tDiffuse, 0.5 + c * (sc - ca)).b;
      }
      col /= float(TAPS);

      // HDR white-out: cool white core, blue edges, pushes past 1.0 for bloom
      float core = 1.0 - smoothstep(0.0, 0.85, r);
      // uFlashEdge -> 1 keeps the centre of the frame readable (bright frame,
      // clear middle) so a flash never has to hide the scenery.
      float edge = pow(1.0 - core, 2.2); // concentrate the burst in the corners
      float w = mix(core, edge, uFlashEdge);
      vec3 flashCol = mix(vec3(0.55, 0.78, 1.0), vec3(1.0), w);
      col += flashCol * uFlash * (mix(1.0, 0.12, uFlashEdge) + 3.2 * w);
      col = mix(col, flashCol * (1.4 + 2.0 * w), smoothstep(0.75, 1.0, uFlash));

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }
  `,
};

export function createTransitionPass(): ShaderPass {
  const pass = new ShaderPass(TransitionShader);
  pass.enabled = false; // only costs anything while a transition is playing
  return pass;
}
