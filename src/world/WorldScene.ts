import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { createSharpenPass } from './sharpen';
import { TransitionDirector, createTransitionPass, TRANSITION_TUNING } from './transitions';
import { createFireTrails, FireTrails } from './fireTrails';
import { CHAPTERS } from '../content';
import { createTextureLibrary } from './textures';
import { createMaterialPalette } from './materials';
import { createEnvironment, EnvironmentSystem } from './environment';
import { buildGrandAvenue, AvenueSystem } from './avenue';
import { buildWorldArchitecture } from './buildings';
import { LightAnchor } from './architectureBuilder';
import { CarModelId, createVehicleController, VehicleController } from './vehicle';
import { loadAndPlaceElmTrees, TreeLod } from './trees';
import { createSpaceCosmos, SpaceCosmosSystem } from './spaceCosmos';

export type CameraMode = 'chase' | 'orbit' | 'cinematic-low';
export type ProjectStationId = 'web' | 'albion' | 'tenders' | 'space' | null;

export interface WorldZonePreset {
  id: string;
  label: string;
  era: string;
  subtitle: string;
  z: number;
  x: number;
  y?: number;
  pitch?: number;
  camYaw?: number;
  camPitch?: number;
  camDist?: number;
  stationId?: ProjectStationId;
}

export const WORLD_ZONES: WorldZonePreset[] = [
  {
    id: 'act1-web20',
    label: '01 · Web 2.0 Past',
    era: 'ACT I // PAST STACK',
    subtitle: 'Welcome to the Past · PHP 5 / WordPress / Bootstrap 2 / Table Layouts',
    z: 315,
    x: 2.8,
    camYaw: 0.04,
    camPitch: 0.13,
    camDist: 8.2,
  },
  {
    id: 'ribbed-gate',
    label: '02 · 88 MPH Time Vault',
    era: 'TRANSITION // TEMPORAL JUMP',
    subtitle: 'Crossed-Out Past Sign · 30 Catenary Formwork Ribs · Flash & Smoke Transition',
    z: 146, // before the jump now starts (crossed-out sign / crosswalk is at ~z 112-120)
    x: 2.8,
    camYaw: 0.0,
    camPitch: 0.12,
    camDist: 8.0,
  },
  {
    id: 'cluster1-web',
    label: '03 · Web Platforms',
    era: 'PROJECT 01 // WEB ARCHITECTURE',
    subtitle: 'Kestrel Ring-Chandelier Atrium · Confluence Rounded Terraces & Pavilions',
    z: -80,
    x: 2.8,
    camYaw: 0.06,
    camPitch: 0.13,
    camDist: 8.4,
    stationId: 'web',
  },
  {
    id: 'cluster2-albion',
    label: '04 · Albion Bot & Spindle',
    era: 'PROJECT 02 // EDTECH AUTOMATION',
    subtitle: 'MeritHub API + WhatsApp & Telegram · Unobstructed 262m Spindle Skyscraper',
    z: -208,
    x: 2.8,
    camYaw: 0.15,
    camPitch: 0.14,
    camDist: 8.5,
    stationId: 'albion',
  },
  {
    id: 'cluster3-tenders',
    label: '05 · GIAS.BY Tenders',
    era: 'PROJECT 03 // GOVTECH ANALYTICS',
    subtitle: 'Competitor Radar & Gov Plans · Grove Hall Arches & The Continuum Portal',
    z: -330,
    x: 2.8,
    camYaw: -0.1,
    camPitch: 0.13,
    camDist: 8.4,
    stationId: 'tenders',
  },
  {
    id: 'act3-space',
    label: '06 · 90° Space Finale',
    era: 'ACT III // FUTURE COSMOS',
    subtitle: '90° Vertical Launch Through The Continuum · Starfield Warp & Contact',
    z: -465,
    x: 0.0,
    y: 125,
    pitch: Math.PI * 0.48,
    camYaw: 0.0,
    camPitch: 0.12,
    camDist: 8.6,
    stationId: 'space',
  },
];

// Chase camera look (all in one place). side = metres to the car's right,
// lookShift = how much of that offset the aim point follows (0 = car stays on the
// aim line, 1 = parallel shift). Raise side for a more pronounced 3/4 view.
const CHASE_CAM = {
  side: 1.3,
  lookShift: 0.3,
  distScale: 0.88, // x the zone's orbit distance (closer than before)
  height: 1.55, // extra height above the orbit arc (1.6 originally, 1.2 first 3/4 pass)
  lookHeight: 3.4, // aim height above the car (was 3.6)
  fov: 46, // resting FOV (was 50)
};

// At a stop the camera slowly drifts to a 3/4 angle toward the project (sign =
// side of the avenue the project is on), keeping both the car and the project in frame.
const STATION_STOPS: Array<{ id: Exclude<ProjectStationId, null>; stopZ: number; camYaw: number }> = [
  // Wide enough that the whole stand of the stop is in frame (they were cropped at 0.34)
  { id: 'web', stopZ: -82, camYaw: 0.74 },
  { id: 'albion', stopZ: -210, camYaw: 0.74 },
  { id: 'tenders', stopZ: -332, camYaw: -0.74 },
];

// While parked at a project the camera also pulls back / lifts and aims nearer to
// the car, so the whole car stays in frame (not cropped by the HUD) next to the project.
const STATION_CAM = {
  distBoost: 1.22, // x chase distance
  heightAdd: 0.7, // metres
  sideScale: 0.4, // fraction of the chase side offset kept
  lookDist: 10, // aim point distance ahead (chase uses 16)
  lookHeight: 2.3,
};

export interface WorldTelemetry {
  fps: number;
  drawCalls: number;
  profile: string; // e.g. "mobile · cap30 · dpr1.5" (debug panel)
  triangles: number;
  speedKmh: number;
  zPos: number;
  yPos: number;
  activeZoneId: string;
  activeZoneLabel: string;
  activeZoneEra: string;
  activeZoneSubtitle: string;
  cameraMode: CameraMode;
  autoCruise: boolean;
  carModel: CarModelId;
  duskDepth: number;
  activeStation: ProjectStationId;
  temporalFlash: number; // 0..1 flash/smoke intensity during Past->Present jump
  flashKind: 'jump' | 'launch' | null;
  spaceFactor: number;   // 0..1 cosmic flight progress
}

// Integrated / software GPUs (old Intel HD/UHD, SwiftShader ...) get the lighter "weak" profile
// from the first frame instead of crawling at 15-20 fps until the governor has stepped down.
// Also remembered across visits once the governor had to go all the way down.
function probeWeakGpu(): boolean {
  try {
    // The "weak" memory is a timestamp and expires after a week (it used to be a permanent "1": one
    // bad session, e.g. a tab left in the background, branded a good machine for ever).
    const saved = localStorage.getItem('td-weak');
    if (saved) {
      const age = Date.now() - Number(saved);
      if (Number.isFinite(age) && age >= 0 && age < 7 * 24 * 3600 * 1000) return true;
      localStorage.removeItem('td-tier');
      localStorage.removeItem('td-weak'); // legacy "1" or expired
    }
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /Intel\(R\)\s*(HD|UHD)|Intel HD|\bGMA\b|SwiftShader|llvmpipe|Basic Render/i.test(name);
  } catch {
    return false;
  }
}

export class WorldSceneEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private bloomBase = 0.28;
  private baseFov = 50;
  private trans = new TransitionDirector();
  private transPass!: ShaderPass;
  private fireTrails!: FireTrails;

  private reflectRT!: THREE.WebGLRenderTarget;
  private reflectCam!: THREE.PerspectiveCamera;
  private reflectMatrix = new THREE.Matrix4();
  private biasMatrix = new THREE.Matrix4().set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0
  );
  private reflectPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02); // the road plane, normal up
  private reflectClip = new THREE.Plane();
  private reflectClip4 = new THREE.Vector4();
  private reflectQ = new THREE.Vector4();

  private envSystem!: EnvironmentSystem;
  private avenue!: AvenueSystem;
  private archGroup!: THREE.Group;
  private vehicle!: VehicleController;
  private spaceCosmos!: SpaceCosmosSystem;

  private allLightAnchors: LightAnchor[] = [];
  private dynamicLightPool: THREE.PointLight[] = [];
  private LIGHT_POOL_SIZE = 8; // 3 on phones (set in the constructor)

  // Phone profile (auto on coarse-pointer touch devices, or ?quality=mobile):
  // no shadow map / planar reflection, cheap windows, fewer lights & trees, FXAA
  // instead of SMAA, half-res bloom, DPR floor, and an automatic 30 FPS cap when
  // the device can't hold ~48.
  private mobile = false;
  private bloomScale = 1;
  private frameCap = 0; // 0 = uncapped, else target FPS
  private capStreak = 0;
  private slowFrames = 0; // consecutive frames longer than half a second (background throttling)
  private fpsForced = false; // ?fps=… given: never auto-change the cap
  private paused = false;
  // DPR changes are queued and applied at the START of the next frame, right before
  // rendering: resizing the canvas clears it, and doing that at the end of a frame
  // let the compositor present one black frame (the "blinking black screen").
  private pendingDpr: number | null = null;
  private dprPinned = false; // ?dpr=N pins the resolution (testing sharpness vs fps)
  private dprDowns = 0; // phones: after a step down we never step back up (no thrash)
  private sharpPass: ShaderPass | null = null;
  private ctxLost = 0;
  private readonly _dPos = new THREE.Vector3();
  private readonly _dLook = new THREE.Vector3();
  private fxaaPass: ShaderPass | null = null;
  private lastLightSortPos = new THREE.Vector3(1e9, 0, 0);

  private cameraMode: CameraMode = 'chase';
  // Auto-Cruise is ON by default so the car drives itself and slows down at each project!
  private autoCruise = true;
  private duskDepth = 0.25;
  private activeStation: ProjectStationId = null;
  private clearedStations = new Set<string>();
  private temporalFlash = 0;
  private flashKind: 'jump' | 'launch' | null = null;

  private recenterCam = false;
  private stationBlend = 0; // 0 = driving chase cam, 1 = parked-at-a-project framing
  private orbitYaw = 0.04;
  private orbitPitch = 0.13;
  private orbitDist = 8.2;
  private introT = 0;
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  };

  private smoothCamPos = new THREE.Vector3(2.8, 2.5, 323);
  private smoothLookAt = new THREE.Vector3(2.8, 1.8, 290);

  private currentDpr = 1;
  private dprTimer = 0;
  private viewW = 1;
  private viewH = 1;
  private sharpBase = 0.12; // desktop CAS strength after the opening street
  private sharpBoost = 0.3; // extra strength on the opening street (posters)
  private sharpFixed = false;
  private sharpCur = 0.12;
  private treeLod: TreeLod | null = null; // full trees near the car, cheap ones far away
  private compileRT: THREE.WebGLRenderTarget | null = null;
  private fovKickCur = 0;
  // Frames longer than 50 ms, with what was going on (Ctrl+Alt+L copies the list: see handleKeyDown)
  private hitches: Record<string, number | string | null>[] = [];
  private noteHitch(now: number, dt: number) {
    if (document.hidden) return;
    if (this.hitches.length >= 80) this.hitches.shift();
    const info = this.renderer.info;
    this.hitches.push({
      t: Math.round(now),
      ms: Math.round(dt * 1000),
      z: Math.round(this.vehicle.position.z),
      y: Math.round(this.vehicle.position.y),
      v: Math.round(this.vehicle.speed * 10) / 10,
      dpr: this.currentDpr,
      tier: this.qualityTier,
      station: this.activeStation,
      fx: this.trans.state.kind,
      progs: info.programs?.length ?? null,
      tex: info.memory.textures,
      geo: info.memory.geometries,
    });
    if (new URLSearchParams(window.location.search).has('debug')) console.warn('[hitch]', JSON.stringify(this.hitches[this.hitches.length - 1]));
  }
  private gpuName(): string {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  /** The recorded hitches as text (for pasting into a bug report). */
  public hitchReport(): string {
    return JSON.stringify(
      { ua: navigator.userAgent, gpu: this.gpuName(), screen: [screen.width, screen.height, devicePixelRatio], view: [this.viewW, this.viewH], profile: (this.mobile ? 'mobile' : this.weak ? 'weak' : 'full') + ' tier' + this.qualityTier + ' dpr' + this.currentDpr, hitches: this.hitches },
      null,
      1
    );
  }
  private live = false; // set once everything is loaded, compiled and warmed up
  private weak = false; // integrated / software GPU: lighter profile from the first frame
  private reflScale = 0.5; // planar reflection target size relative to the screen
  private smaaPass: SMAAPass | null = null;
  private weakSaved = false;
  private lastShadowPos = new THREE.Vector3(1e6, 0, 0);
  private lastShadowT = 0;
  private rawAccum = 0; // real (unclamped) frame time, for the fps readout only
  private displayFps = 60;
  private dipStreak = 0; // consecutive slow governor windows
  private upStreak = 0; // consecutive windows with headroom
  private ssDowns = 0; // times a supersampled resolution had to be stepped back down
  private dprCap = 2.0; // governor steps this down on weak hardware anyway
  private qualityTier = 0; // 0 full → 1 low-DPR → 2 no reflection → 3 no bloom
  private lowStreak = 0;
  private reflectionDisabled = false;
  private spaceDprDropped = false;
  private cityHidden = false;
  private treesGroup: THREE.Object3D | null = null;
  private microDetail: THREE.Object3D[] | null = null;
  public onFlash?: (v: number, kind: 'jump' | 'launch' | null) => void;
  /** Fired when the stand of stop 01 switches to another client site. */

  private animFrameId = 0;
  private lastPerfTime = performance.now();
  private elapsedTime = 0;
  private frameCounter = 0;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private currentFps = 60;
  private disposed = false;

  private onTelemetry?: (t: WorldTelemetry) => void;
  public readonly ready: Promise<void>;

  constructor(
    container: HTMLElement,
    onTelemetry?: (t: WorldTelemetry) => void,
    onProgress?: (fraction: number) => void
  ) {
    this.container = container;
    this.onTelemetry = onTelemetry;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.viewW = width;
    this.viewH = height;

    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('quality');
    // Primary pointer coarse + no hover = phone/tablet (touch laptops keep the full profile).
    const coarse = window.matchMedia?.('(pointer: coarse) and (hover: none)').matches ?? false;
    this.mobile = qParam === 'mobile' || (!qParam && coarse);
    const fpsParam = params.get('fps');
    this.fpsForced = fpsParam !== null;
    if (fpsParam === '30' || fpsParam === '45' || fpsParam === '60') this.frameCap = fpsParam === '60' ? 0 : Number(fpsParam);
    if (this.mobile) {
      this.bloomScale = 0.5;
      this.LIGHT_POOL_SIZE = 3;
      // Tested on a Redmi Note 12 Pro: full DPR 2.0 at a steady 30 fps looked clearly
      // better than 1.5 (which read as mush) and was smooth enough, so that is the default.
      this.dprCap = 2.0;
      if (!fpsParam) this.frameCap = 30;
      this.reflectionDisabled = true;
      this.qualityTier = 2; // reflection already off; next governor step drops bloom
    }
    // Weak GPU (old Intel HD/UHD, software rendering): fewer lights, cheaper shadow filter,
    // FXAA instead of SMAA, half-res bloom, smaller reflection, no supersampling.
    if (qParam === 'full') {
      // ?quality=full: forget a remembered "weak" verdict and start in the full profile
      try {
        localStorage.removeItem('td-weak');
        localStorage.removeItem('td-tier');
      } catch {
        /* private mode */
      }
    }
    this.weak = !this.mobile && (qParam === 'weak' || (!qParam && probeWeakGpu()));
    if (this.weak) {
      this.bloomScale = 0.5;
      this.LIGHT_POOL_SIZE = 4;
      // a weak machine starts at 1x, not 1.25x: every later resolution change reallocates the buffers
      // (about 200 ms on such a laptop) and the 1.25 -> 1 step came right in the opening seconds
      this.dprCap = 1.0;
      this.reflScale = 0.33;
    }
    // ?dpr=1.5|1.75|2 pins the render resolution (to judge sharpness vs fps on a phone)
    const dprParam = parseFloat(params.get('dpr') ?? '');
    if (Number.isFinite(dprParam) && dprParam >= 1 && dprParam <= 3) {
      this.dprCap = dprParam;
      this.dprPinned = true;
    }
    // Desktop supersampling: start at the screen's own resolution (a weak laptop must not
    // begin heavy), then the governor climbs towards 2x only while there is clear frame-rate
    // headroom, and drops back for good if it does not fit. Phones keep their own profile.
    const nativeDpr = window.devicePixelRatio || 1;
    const pixelRatio = this.dprPinned
      ? this.dprCap
      : Math.min(nativeDpr, 2, this.weak ? this.dprCap : 2);
    this.currentDpr = pixelRatio;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // composer path — SMAAPass handles edges, MSAA here is dead weight
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.info.autoReset = false;
    // Reading the link status of every program right after compiling makes the browser wait for
    // each one (a multi-second freeze on a weak machine); only the debug builds need the log.
    this.renderer.debug.checkShaderErrors = params.has('debug') || params.has('dev') || params.has('chk');
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.autoUpdate = false; // driven manually every 2nd frame
    this.renderer.shadowMap.type = this.weak ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.35, 2200);
    this.camera.layers.enable(1); // layer 1: visible in main cam, excluded from planar reflection

    // The heavy part (textures, city, composer) runs as a chain of steps with a pause for the
    // browser between them: the loading screen keeps animating and its progress moves, instead of
    // the page freezing for several seconds in one block.
    this.ready = this.build(params, qParam, width, height, pixelRatio, onProgress);
  }

  /** One pause for the browser to paint and handle input (a hidden tab falls back to a timer). */
  private static breathe() {
    return new Promise<void>((resolve) => {
      let done = false;
      const fin = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      requestAnimationFrame(() => setTimeout(fin, 0));
      setTimeout(fin, 120);
    });
  }

  private async build(
    params: URLSearchParams,
    qParam: string | null,
    width: number,
    height: number,
    pixelRatio: number,
    onProgress?: (fraction: number) => void
  ): Promise<void> {
    const container = this.container;
    // overall progress: building the world is the first third, the downloads the rest
    let buildFrac = 0;
    let carFrac = 0;
    let treeFrac = 0;
    const report = () =>
      onProgress?.(Math.min(0.92, buildFrac * 0.3 + (carFrac * 0.72 + treeFrac * 0.28) * 0.62));
    const step = async (f: number) => {
      buildFrac = f;
      report();
      await WorldSceneEngine.breathe();
    };

    const texLib = await createTextureLibrary(this.renderer, this.weak ? 8 : 16, () => WorldSceneEngine.breathe());
    if (this.disposed) return;
    const palette = createMaterialPalette(texLib, { mobile: this.mobile });
    await step(0.15);
    if (this.disposed) return;

    this.envSystem = createEnvironment(this.renderer, this.scene, palette, { weak: this.weak });
    if (this.mobile) {
      // No shadow map on phones: stop the sun from casting before anything compiles
      this.scene.traverse((o) => {
        const l = o as THREE.DirectionalLight;
        if (l.isDirectionalLight) l.castShadow = false;
      });
    }
    await step(0.3);
    if (this.disposed) return;
    this.avenue = buildGrandAvenue(palette);
    this.scene.add(this.avenue.group);
    await step(0.55);
    if (this.disposed) return;

    // Everything that decides a shader's variant (the light set above all) exists from here on:
    // the Act III cosmos, the light pool, the car (its GLB starts downloading) and the fire trails.
    this.spaceCosmos = createSpaceCosmos(this.scene);
    for (let i = 0; i < this.LIGHT_POOL_SIZE; i++) {
      const pl = new THREE.PointLight(0xffd89e, 0, 32, 1.65);
      this.scene.add(pl);
      this.dynamicLightPool.push(pl);
    }
    this.vehicle = createVehicleController(
      this.scene,
      (f) => {
        carFrac = f;
        report();
      },
      this.renderer, { mobile: this.mobile, weak: this.weak });
    this.fireTrails = createFireTrails(this.scene);
    // The shader compiler runs in the GPU process: start it now on everything that exists, and let
    // it work in parallel with the generation of the city on this thread (the passes further down
    // only have what is new to do).
    const params0 = new URLSearchParams(window.location.search);
    const compileA = params0.has('noasync') ? Promise.resolve() : this.precompileAsync();

    const archResult = await buildWorldArchitecture(palette, texLib.maxAnisotropy, () => WorldSceneEngine.breathe());
    if (this.disposed) return;
    this.archGroup = archResult.group;
    this.scene.add(this.archGroup);
    await step(0.75);
    if (this.disposed) return;

    // Load real 3D elm trees (`tree_elm.glb`) onto sidewalk planter islands, park mounds & Confluence terraces!
    const allTrees = [...this.avenue.treePlacements, ...archResult.treePlacements];
    // Phones: every other tree (each is ~38k triangles)
    // Loading bar: the car GLB is ~70% of the bytes, the trees ~30%
    const treesReady = loadAndPlaceElmTrees(
      this.scene,
      this.mobile || this.weak ? allTrees.filter((_, i) => i % 2 === 0) : allTrees,
      (f) => {
        treeFrac = f;
        report();
      },
      // leaves are alpha-tested double-sided quads: the costliest thing in the shadow pass
      {
        leafShadows: !this.weak && !this.mobile,
        nearRadius: this.weak || this.mobile ? 70 : 95,
        cullRadius: this.weak || this.mobile ? 480 : 680,
      }
    ).then((lod) => {
      this.treeLod = lod;
    });

    this.allLightAnchors = [...this.avenue.lightAnchors, ...archResult.lightAnchors];
    // Loading screen waits for the car AND the tree GLB.
    const assetsReady = Promise.all([this.vehicle.ready, treesReady]);
    await step(0.9);
    if (this.disposed) return;
    // Second compile pass: whatever the first one could not see yet (the city, the late arrivals).
    const compileB = params0.has('noasync') ? Promise.resolve() : this.precompileAsync();

    // Cheap planar reflection: sprites, particles & micro-props stay on layer 1
    // (main camera sees them, reflection camera does not).
    this.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints || o.name === 'reflSkip') {
        o.layers.set(1);
      }
    });

    // (phones never render the reflection pass, so keep its target tiny)
    const reflW = this.mobile ? 64 : Math.max(256, Math.floor(width * pixelRatio * this.reflScale));
    const reflH = this.mobile ? 64 : Math.max(256, Math.floor(height * pixelRatio * this.reflScale));
    this.reflectRT = new THREE.WebGLRenderTarget(reflW, reflH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
    });
    this.reflectCam = new THREE.PerspectiveCamera();
    this.reflectCam.layers.enable(2); // layer 2: reflection-only lowpoly proxies
    palette.setReflectionData(this.reflectRT.texture, this.reflectMatrix);

    const composerRT = new THREE.WebGLRenderTarget(
      Math.floor(width * pixelRatio),
      Math.floor(height * pixelRatio),
      {
        type: THREE.HalfFloatType,
        samples: 0, // MSAA×4 on HalfFloat was the biggest bandwidth hog on the frame
      }
    );
    this.composer = new EffectComposer(this.renderer, composerRT);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Transition post pass (warp blur + chromatic aberration + HDR white-out).
    // Before bloom so the flash blooms; disabled outside transitions.
    // (weaker GPUs: fewer taps in the warp blur - it runs full-screen only during a jump)
    this.transPass = createTransitionPass(this.weak || this.mobile ? 6 : 10);
    this.composer.addPass(this.transPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height), // composer.setSize governs actual res; internal mip0 is already half
      0.28,
      0.48,
      0.96
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    if (this.mobile) {
      // One cheap FXAA pass instead of SMAA's three, and a half-res bloom
      this.fxaaPass = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaaPass);
      // CAS sharpen after FXAA: the scene is rendered below native res on phones
      // and FXAA softens it further. ?sharp=0..1 (0 = off), default 0.55 (0.65 made the
      // asphalt grain sparkle).
      const sharpParam = parseFloat(params.get('sharp') ?? '');
      const sharpness = Number.isFinite(sharpParam) ? sharpParam : 0.55;
      if (sharpness > 0) {
        this.sharpPass = createSharpenPass(sharpness);
        this.composer.addPass(this.sharpPass);
      }
      this.updateFxaa();
      this.bloomPass.setSize(width * this.bloomScale, height * this.bloomScale);
    } else {
      // FXAA also exists on desktop: from the start on weak GPUs (SMAA is three full-screen
      // passes), and as the governor's last-but-one step on the others.
      this.fxaaPass = new ShaderPass(FXAAShader);
      if (this.weak) {
        this.composer.addPass(this.fxaaPass);
        this.bloomPass.setSize(width * this.bloomScale, height * this.bloomScale);
      } else {
        this.smaaPass = new SMAAPass(width, height);
        this.composer.addPass(this.smaaPass);
        this.fxaaPass.enabled = false;
        this.composer.addPass(this.fxaaPass);
      }
      this.updateFxaa();
      // A light contrast-adaptive sharpen after SMAA brings back the edge crispness that the
      // downsampled image and the AA smoothing take away. Kept low overall; the opening street
      // (Act I, where the small gantry posters must read) gets extra, see the animate loop.
      // ?sharp=0..1 sets a fixed strength (0 = off).
      const sharpParam = parseFloat(params.get('sharp') ?? '');
      const sharpness = Number.isFinite(sharpParam) ? sharpParam : this.sharpBase;
      if (Number.isFinite(sharpParam)) this.sharpFixed = true;
      if (sharpness > 0) {
        this.sharpPass = createSharpenPass(sharpness);
        this.composer.addPass(this.sharpPass);
        this.updateFxaa();
      }
    }

    // Precompile all shaders behind the loading screen — kills first-frame
    // compile hitches when the world first becomes visible.
    // (done after the assets arrive instead, in parallel: see precompileAsync)

    this.jumpToZone(WORLD_ZONES[0].id, true);
    // Spawn the car just behind the intro camera so it drives into frame.
    this.vehicle.setPose(2.8, 344, 0, 0, 0);
    this.updateDynamicLights();

    // Optional forced quality: ?quality=low|med|high
    // (mobile is decided at the top of the constructor; touch laptops keep full quality)
    const q = qParam;
    if (q === 'low') {
      this.dprCap = 1.25;
      this.currentDpr = Math.min(this.currentDpr, 1.25);
      this.renderer.setPixelRatio(this.currentDpr);
      this.composer.setPixelRatio(this.currentDpr);
      this.reflectionDisabled = true;
      this.bloomPass.enabled = false;
      this.qualityTier = 3;
    } else if (q === 'med') {
      this.dprCap = 1.5;
      this.currentDpr = Math.min(this.currentDpr, 1.5);
      this.renderer.setPixelRatio(this.currentDpr);
      this.composer.setPixelRatio(this.currentDpr);
      this.qualityTier = 1;
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: false });
    // Phones can lose the GL context under memory pressure (shows up as a black flash).
    // Keep the page alive and reload cleanly if the browser restores it.
    dom.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ctxLost++;
    });
    dom.addEventListener('webglcontextrestored', () => window.location.reload());

    this.lastPerfTime = performance.now();
    this.animate(palette);
    // the window may have been resized while the world was being built
    if (container.clientWidth !== width || container.clientHeight !== height) this.handleResize();
    buildFrac = 1;
    report();

    // The downloads finish (they ran alongside the build), then every shader is compiled in
    // parallel (the page stays alive) and only then the one forced full frame, which now finds
    // everything ready.
    await Promise.all([compileA, compileB]);
    await assetsReady;
    if (this.disposed) return;
    await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 30)));
    if (!params0.has('noasync')) await this.precompileAsync();
    if (this.disposed) return;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await this.warmUp();
    this.restoreTier(); // a machine that needed the weakest tiers last time starts there
    this.live = true; // from now on the frame loop renders
    onProgress?.(1);
  }

  /** Pause/resume the whole simulation + rendering (e.g. while asking to rotate a phone).
   *  Asset loading and shader warm-up are unaffected. */
  private panelShift = 0; // target: fraction of the screen width the view is slid sideways
  private panelShiftCur = 0;
  private viewOffsetOn = false;
  public setPanelShift(fraction: number) {
    this.panelShift = Math.max(-0.4, Math.min(0.4, fraction));
  }

  /** Integrated / software GPU: started in the lighter profile (used to offer the light version). */
  public get lowEnd() {
    return this.weak;
  }

  public setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.lastPerfTime = performance.now();
  }

  public resumeFromStation() {
    if (this.activeStation === 'space') {
      // Restart journey from Act I
      this.clearedStations.clear();
      this.activeStation = null;
      this.autoCruise = true;
      this.jumpToZone(WORLD_ZONES[0].id, true);
      return;
    }
    if (this.activeStation) {
      this.clearedStations.add(this.activeStation);
      this.activeStation = null;
    }
    this.autoCruise = true;
    this.recenterCam = true; // ease the camera back behind the car while driving off
    this.emitTelemetry();
  }

  private updateDynamicLights() {
    const focus = this.vehicle.position;
    const dx = focus.x - this.lastLightSortPos.x;
    const dz = focus.z - this.lastLightSortPos.z;
    if (dx * dx + dz * dz < 225) {
      // Car hasn't moved enough for the nearest-light set to change.
      return;
    }
    this.lastLightSortPos.copy(focus);
    this.allLightAnchors.sort((a, b) => {
      const da =
        (a.position.x - focus.x) * (a.position.x - focus.x) +
        (a.position.z - focus.z) * (a.position.z - focus.z);
      const db =
        (b.position.x - focus.x) * (b.position.x - focus.x) +
        (b.position.z - focus.z) * (b.position.z - focus.z);
      return da - db;
    });

    for (let i = 0; i < this.LIGHT_POOL_SIZE; i++) {
      const anchor = this.allLightAnchors[i];
      const pl = this.dynamicLightPool[i];
      if (anchor) {
        pl.position.copy(anchor.position);
        pl.color.setHex(anchor.color);
        pl.intensity = anchor.intensity;
        pl.distance = anchor.distance;
      } else {
        pl.intensity = 0;
      }
    }
  }

  public jumpToZone(zoneId: string, instant = false) {
    const z = WORLD_ZONES.find((item) => item.id === zoneId) || WORLD_ZONES[0];
    this.trans.reset();
    this.fireTrails?.reset();
    this.vehicle.setPose(z.x, z.z, 0, z.y ?? 0, z.pitch ?? 0);
    if (z.camYaw !== undefined) this.orbitYaw = z.camYaw;
    if (z.camPitch !== undefined) this.orbitPitch = z.camPitch;
    if (z.camDist !== undefined) this.orbitDist = z.camDist;

    if (z.stationId) {
      this.activeStation = z.stationId;
      // Clear later stations so if user resumes from here, it stops at subsequent stations
      this.clearedStations.delete(z.stationId);
    } else {
      this.activeStation = null;
      this.clearedStations.clear();
    }

    this.updateDynamicLights();
    if (instant) {
      for (let i = 0; i < 40; i++) {
        this.updateCamera(0.05);
      }
    }
    this.emitTelemetry();
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.emitTelemetry();
  }

  public toggleAutoCruise() {
    if (this.activeStation) {
      this.resumeFromStation();
      return;
    }
    this.autoCruise = !this.autoCruise;
    this.emitTelemetry();
  }

  public setCarModel(id: CarModelId) {
    this.vehicle.setCarModel(id);
    this.emitTelemetry();
  }

  public setDuskDepth(val: number) {
    this.duskDepth = Math.max(0, Math.min(1, val));
    this.envSystem.setMoodShift(this.duskDepth);
    this.bloomBase = 0.24 + this.duskDepth * 0.16;
    this.bloomPass.strength = this.bloomBase;
    this.emitTelemetry();
  }

  private updateCamera(dt: number) {
    const carPos = this.vehicle.position;
    const carYaw = this.vehicle.heading;
    const carPitch = this.vehicle.pitchAngle;

    const desiredPos = this._dPos.set(0, 0, 0); // reused (no per-frame allocation / GC)
    const desiredLook = this._dLook.set(0, 0, 0);
    this.introT += dt;

    if (carPitch > 0.12) {
      // Act III: 90-degree vertical ascent into the cosmos!
      // Camera tracks behind and slightly below the climbing car, looking up into the starfield
      const climbT = THREE.MathUtils.clamp(carPitch / (Math.PI * 0.48), 0, 1);
      desiredPos.set(
        carPos.x + Math.sin(this.orbitYaw) * 6.5,
        carPos.y - 7.2 * climbT + 2.2 * (1 - climbT),
        carPos.z + 8.5 * (1 - climbT * 0.45)
      );
      desiredLook.set(
        carPos.x,
        carPos.y + 18.0 * climbT + 2.0 * (1 - climbT),
        carPos.z - 12.0 * (1 - climbT * 0.85)
      );
    } else if (this.cameraMode === 'chase') {
      // Cinematic chase: lower and closer than before, shifted to one side so the
      // car is seen 3/4 from behind (tail light + flank) instead of dead-centre,
      // with a gentle speed-driven sway like a handheld tracking shot.
      const C = CHASE_CAM;
      const yaw = carYaw + this.orbitYaw;
      const pitch = THREE.MathUtils.clamp(this.orbitPitch, 0.05, 0.65);
      const sb = this.stationBlend;
      const dist = this.orbitDist * C.distScale * THREE.MathUtils.lerp(1, STATION_CAM.distBoost, sb);
      const horiz = dist * Math.cos(pitch);
      const vert = dist * Math.sin(pitch) + C.height + STATION_CAM.heightAdd * sb;

      const sn = THREE.MathUtils.clamp(Math.abs(this.vehicle.speed) / 34, 0, 1);
      const calm = this.trans.reduced ? 0.2 : 1;
      const t = this.elapsedTime;
      const sway = (Math.sin(t * 0.55) * 0.16 + Math.sin(t * 1.3 + 0.7) * 0.05) * sn * calm;
      const bob = Math.sin(t * 0.9 + 1.1) * 0.05 * sn * calm;
      const side = C.side * THREE.MathUtils.lerp(1, STATION_CAM.sideScale, sb) + sway;
      const lookDist = THREE.MathUtils.lerp(16, STATION_CAM.lookDist, sb);
      const lookH = THREE.MathUtils.lerp(C.lookHeight, STATION_CAM.lookHeight, sb);
      // car's right-hand direction on the ground plane (forward is -Z at yaw 0)
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      desiredPos.set(
        carPos.x + Math.sin(yaw) * horiz + rx * side,
        carPos.y + vert + bob,
        carPos.z + Math.cos(yaw) * horiz + rz * side
      );

      desiredLook.set(
        carPos.x - Math.sin(yaw) * lookDist + rx * side * C.lookShift,
        carPos.y + lookH,
        carPos.z - Math.cos(yaw) * lookDist + rz * side * C.lookShift
      );
      this.baseFov = THREE.MathUtils.lerp(
        this.baseFov,
        C.fov + Math.min(12, Math.abs(this.vehicle.speed) * 0.22),
        1 - Math.exp(-6 * dt)
      );
    } else if (this.cameraMode === 'cinematic-low') {
      const yaw = carYaw + this.orbitYaw - 0.22;
      desiredPos.set(
        carPos.x + Math.sin(yaw) * 8.0 - 2.0,
        carPos.y + 1.4,
        carPos.z + Math.cos(yaw) * 8.0
      );
      desiredLook.set(
        carPos.x - Math.sin(carYaw) * 18.0,
        carPos.y + 5.5,
        carPos.z - Math.cos(carYaw) * 18.0
      );
      this.baseFov = THREE.MathUtils.lerp(this.baseFov, 56, 1 - Math.exp(-6 * dt));
    } else {
      const pitch = THREE.MathUtils.clamp(this.orbitPitch, 0.04, 1.15);
      const dist = this.orbitDist;
      const horiz = dist * Math.cos(pitch);
      const vert = dist * Math.sin(pitch) + 1.5;

      desiredPos.set(
        carPos.x + Math.sin(this.orbitYaw) * horiz,
        carPos.y + vert,
        carPos.z + Math.cos(this.orbitYaw) * horiz
      );
      desiredLook.set(carPos.x, carPos.y + 3.0, carPos.z - 4.0);
    }

    // Mouse-wheel zoom (every mode, also the space ascent): scales the camera's offset from
    // the car, eased. The wheel no longer drives the car.
    this.userZoomCur += (this.userZoom - this.userZoomCur) * (1 - Math.exp(-8 * dt));
    if (Math.abs(this.userZoomCur - 1) > 0.002) {
      desiredPos.sub(carPos).multiplyScalar(this.userZoomCur).add(carPos);
    }

    // Intro: hold a fixed roadside camera while the DeLorean pulls in from
    // behind, then blend into the normal chase pose over ~2s.
    if (this.introT < 3.4) {
      const k = THREE.MathUtils.smoothstep(this.introT, 1.3, 3.4);
      desiredPos.lerpVectors(new THREE.Vector3(4.6, 2.6, 335), desiredPos, k);
      desiredLook.lerpVectors(new THREE.Vector3(-0.5, 1.9, 298), desiredLook, k);
    }

    // While the car climbs at rocket speed the camera must catch up much faster,
    // otherwise it trails ~11 m behind and the car shrinks away right after the flash.
    const followRate = THREE.MathUtils.lerp(8.5, 22, THREE.MathUtils.smoothstep(carPitch, 0.05, 0.45));
    const damp = 1 - Math.exp(-followRate * dt);
    this.smoothCamPos.lerp(desiredPos, damp);
    this.smoothLookAt.lerp(desiredLook, damp);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothLookAt);

    // Transition feel, applied AFTER the smoothing so the damper can't eat it:
    // FOV kick + procedural shake (position jitter + roll).
    const tr = this.trans.state;
    // (the kick rises over ~3 frames instead of snapping in one: a 15 degree pop in a single frame reads as a
    // stutter; the fall-off keeps the designed curve)
    this.fovKickCur =
      tr.fovKick > this.fovKickCur ? this.fovKickCur + (tr.fovKick - this.fovKickCur) * (1 - Math.exp(-40 * dt)) : tr.fovKick;
    const fovTarget = Math.min(105, this.baseFov + this.fovKickCur);
    if (Math.abs(this.camera.fov - fovTarget) > 0.01) {
      this.camera.fov = fovTarget;
      this.camera.updateProjectionMatrix();
    }
    // A side panel covers part of the screen: slide the view so the scene (stand, car)
    // stays centred in the free part. Eased, and cleared again once it is back to 0.
    this.panelShiftCur += (this.panelShift - this.panelShiftCur) * (1 - Math.exp(-6 * dt));
    if (Math.abs(this.panelShift - this.panelShiftCur) < 0.0005) this.panelShiftCur = this.panelShift;
    if (Math.abs(this.panelShiftCur) > 0.0005) {
      this.camera.setViewOffset(this.viewW, this.viewH, this.panelShiftCur * this.viewW, 0, this.viewW, this.viewH);
      this.viewOffsetOn = true;
    } else if (this.viewOffsetOn) {
      this.camera.clearViewOffset();
      this.viewOffsetOn = false;
    }
    if (tr.shake > 0.002) {
      const t = this.elapsedTime;
      const a = tr.shake * TRANSITION_TUNING.shakePos;
      this.camera.position.x += (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 23.7 + 1.3) * 0.4) * a;
      this.camera.position.y += (Math.sin(t * 41.9 + 2.1) * 0.6 + Math.sin(t * 17.3) * 0.4) * a;
      this.camera.rotateZ(Math.sin(t * 29.3 + 0.7) * tr.shake * TRANSITION_TUNING.shakeRoll);
    }
  }

  private resolveCurrentZone(zPos: number, yPos: number): WorldZonePreset {
    if (yPos > 15 || zPos < -442) return WORLD_ZONES[5];
    if (zPos > 108) return WORLD_ZONES[0];
    if (zPos > -35) return WORLD_ZONES[1];
    if (zPos > -175) return WORLD_ZONES[2];
    if (zPos > -305) return WORLD_ZONES[3];
    return WORLD_ZONES[4];
  }

  private updatePlanarReflection() {
    if (this.vehicle.position.y > 12 || this.cityHidden || this.reflectionDisabled || this.paused) return;
    this.camera.updateMatrixWorld();

    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    this.camera.getWorldDirection(camDir);

    this.reflectCam.fov = this.camera.fov;
    this.reflectCam.aspect = this.camera.aspect;
    this.reflectCam.near = this.camera.near;
    this.reflectCam.far = 150; // wet asphalt only needs nearby reflections
    this.reflectCam.position.set(camPos.x, -camPos.y, camPos.z);

    const target = new THREE.Vector3(
      camPos.x + camDir.x * 25,
      -(camPos.y + camDir.y * 25),
      camPos.z + camDir.z * 25
    );
    this.reflectCam.up.set(0, 1, 0);
    this.reflectCam.lookAt(target);
    this.reflectCam.updateProjectionMatrix();
    this.reflectCam.updateMatrixWorld();

    this.reflectMatrix.copy(this.biasMatrix);
    this.reflectMatrix.multiply(this.reflectCam.projectionMatrix);
    this.reflectMatrix.multiply(this.reflectCam.matrixWorldInverse);

    // Everything below the road plane must stay out of the reflection. That used to be a clipping
    // plane on the renderer - which makes a second, clipped variant of every shader program (about
    // half of all programs, half of the compile time) and a discard in every fragment shader.
    // The oblique near-plane trick does the same in the projection matrix itself (the technique of
    // three's Reflector): the near plane is moved onto the road, the hardware clips the rest, and the
    // shaders stay the ordinary ones. (The texture matrix above is taken from the plain projection.)
    {
      const p = this.reflectClip.copy(this.reflectPlane).applyMatrix4(this.reflectCam.matrixWorldInverse);
      const plane = this.reflectClip4.set(p.normal.x, p.normal.y, p.normal.z, p.constant);
      const m = this.reflectCam.projectionMatrix.elements;
      const q = this.reflectQ;
      q.x = (Math.sign(plane.x) + m[8]) / m[0];
      q.y = (Math.sign(plane.y) + m[9]) / m[5];
      q.z = -1;
      q.w = (1 + m[10]) / m[14];
      plane.multiplyScalar(2 / plane.dot(q));
      m[2] = plane.x;
      m[6] = plane.y;
      m[10] = plane.z + 1 - 0.0005;
      m[14] = plane.w;
      this.reflectCam.projectionMatrixInverse.copy(this.reflectCam.projectionMatrix).invert();
    }

    this.avenue.roadMesh.visible = false;
    const prevTarget = this.renderer.getRenderTarget();
    const prevShadows = this.renderer.shadowMap.autoUpdate;
    if (this.frameCounter > 1) {
      this.renderer.shadowMap.autoUpdate = false;
    }
    this.renderer.setRenderTarget(this.reflectRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.reflectCam);

    this.renderer.shadowMap.autoUpdate = prevShadows;
    this.renderer.setRenderTarget(prevTarget);
    this.avenue.roadMesh.visible = true;
  }

  private animate = (palette: ReturnType<typeof createMaterialPalette>, frameTime?: number) => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame((t) => this.animate(palette, t));

    // The time stamp rAF hands over is aligned to the display's refresh; performance.now() inside the
    // callback also carries the jitter of when the callback happened to run, which shows up as
    // uneven steps of the car and camera even at a steady 60 fps.
    const now = frameTime ?? performance.now();
    if (this.paused || !this.live) {
      // (not live yet = still loading: nothing is rendered behind the loader. Rendering early made
      // the first frames compile every shader one by one on the main thread - a frozen loader.)
      this.lastPerfTime = now; // no giant dt when we resume
      return;
    }
    // Frame cap (phones that can't hold ~48 fps lock to an even 30 instead of
    // stuttering between 20 and 40). rAF keeps running, we just skip the frame.
    if (this.frameCap > 0 && now - this.lastPerfTime < 1000 / this.frameCap - 2) return;
    if (this.pendingDpr !== null) {
      // resize right before drawing, in the same task: no blank frame in between
      this.setDpr(this.pendingDpr);
      this.pendingDpr = null;
    }
    const rawDt = Math.max(0, (now - this.lastPerfTime) * 0.001);
    if (rawDt > 0.05) this.noteHitch(now, rawDt);
    const dt = Math.min(rawDt, 0.05); // governor / easing clock
    // The simulation clock follows real time up to 0.1 s per frame (it used to stop at 0.05 s, so
    // below 20 fps the whole journey ran in slow motion: at 12 fps it took 1.7x as long)
    const simDt = Math.min(rawDt, 0.1);
    this.lastPerfTime = now;
    this.elapsedTime += simDt;

    // Compute automatic station slowdown & brief trigger
    const zPos = this.vehicle.position.z;
    const yPos = this.vehicle.position.y;
    let slowdownFactor = 0;

    if (!this.input.forward && !this.input.backward) {
      for (const st of STATION_STOPS) {
        if (this.clearedStations.has(st.id)) continue;
        const distToStop = zPos - st.stopZ;
        // As car approaches stopZ from +28m down to 0m, smoothly ramp slowdownFactor 0 -> 1
        if (distToStop > -6 && distToStop < 28) {
          slowdownFactor = Math.max(slowdownFactor, 1 - Math.max(0, distToStop) / 28);
          if (distToStop < 4.5) {
            slowdownFactor = 1.0;
            this.activeStation = st.id;
            if (!this.isPointerDown) {
              // slow cinematic drift (was a quick 3/s snap) toward the 3/4 angle
              this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, st.camYaw, 1 - Math.exp(-0.9 * dt));
            }
          }
          break;
        }
      }

      // In Act III Space Launch, once car climbs to y >= 95m, open the Space Finale Contact card
      // (Let the rocket flight play for a few seconds before the card opens —
      // teleporting straight to the space zone skips the wait.)
      if (
        yPos >= 95 &&
        !this.clearedStations.has('space') &&
        (!this.trans.launchPlaying || this.trans.launchElapsed >= TRANSITION_TUNING.launch.cardDelaySecs)
      ) {
        slowdownFactor = 0.72; // Keep gentle zero-gravity drift among the rushing stars
        this.activeStation = 'space';
      }
    } else {
      // Manual W/S overrides station pause
      if (this.activeStation && this.activeStation !== 'space') {
        this.clearedStations.add(this.activeStation);
        this.activeStation = null;
      }
    }

    // Temporal flashes: (1) at the ENTRY of the Ribbed Gate — we flash out of
    // the past and drive the vault mid-jump; (2) at the Continuum ring — masks
    // the 90° pitch-up and lets us drop the whole city below.
    // Now driven by the TransitionDirector: timeline from the moment the car
    // crosses the gate / ring (see transitions.ts, all numbers in one place).
    // After leaving a station the 3/4 drift eases back to the chase angle
    // (unless the user grabbed the camera).
    if (this.recenterCam && !this.isPointerDown) {
      this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, 0.04, 1 - Math.exp(-1.3 * dt));
      if (Math.abs(this.orbitYaw - 0.04) < 0.004) this.recenterCam = false;
    }

    const atProject = this.activeStation !== null && this.activeStation !== 'space';
    this.stationBlend += ((atProject ? 1 : 0) - this.stationBlend) * (1 - Math.exp(-1.0 * dt));

    this.trans.update(simDt, zPos, yPos, this.vehicle.speed);
    const tr = this.trans.state;
    this.temporalFlash = tr.flash;
    this.flashKind = tr.flash > 0.02 ? tr.kind : null;

    // Post pass + bloom: only pay for the warp pass while a transition plays.
    // On the weak tiers the blur of the approach / gate (a full-screen pass for about 7 s) is skipped: only
    // the flash itself, which is short, uses the pass.
    const warpOn = this.qualityTier < 3 && !this.mobile;
    const passOn = tr.flash > 0.002 || (warpOn && tr.warp > 0.01);
    this.transPass.enabled = passOn;
    if (passOn) {
      this.transPass.uniforms.uWarp.value = warpOn ? tr.warp : 0;
      this.transPass.uniforms.uFlash.value = tr.flash;
      this.transPass.uniforms.uFlashEdge.value = tr.flashEdge;
      this.transPass.uniforms.uAspect.value = this.camera.aspect;
    }
    this.vehicle.setFx(tr.carFx);
    // An edge-weighted (see-through) flash must not bloom the bright ribs into a
    // haze, so its bloom contribution is cut down.
    this.bloomPass.strength =
      this.bloomBase + tr.flash * (0.9 - 0.6 * tr.flashEdge) + tr.warp * 0.12;
    // Hit-stop: the simulation (car + camera) runs on scaled time, UI/fps on real time.
    const sdt = simDt * tr.timeScale;

    // Space approach: strip the expensive passes BEFORE the launch, not at it.
    // Past z≈-435 the city is behind the camera anyway — hide world, kill the
    // planar reflection, and cap pixel ratio so the ring flight stays smooth.
    this.onFlash?.(this.temporalFlash, this.flashKind);

    // Hide the detailed city only once the launch flash covers the screen
    // (or the car is already high) — hides once, restores only back on ground.
    if (!this.cityHidden && (yPos > 16 || (this.flashKind === 'launch' && this.temporalFlash > 0.5))) {
      this.cityHidden = true;
    } else if (this.cityHidden && yPos < 10 && zPos > -420) {
      this.cityHidden = false;
    }
    this.avenue.group.visible = !this.cityHidden;
    this.archGroup.visible = !this.cityHidden;
    // Trees + distant skyline die with the city — nothing but sky above anyway.
    if (!this.treesGroup) this.treesGroup = this.scene.getObjectByName('ElmTreesInstanced') ?? null;
    if (this.treesGroup) this.treesGroup.visible = !this.cityHidden;
    this.envSystem.distantSkylineGroup.visible = !this.cityHidden;

    // Single stepped DPR drop at the PEAK of the launch flash — the screen is
    // already white, so the one-time buffer realloc is invisible. Governor is
    // frozen meanwhile (zPos<-380 || yPos>5 check in the DPR block).
    if (!this.spaceDprDropped && this.flashKind === 'launch' && this.temporalFlash > 0.8) {
      this.spaceDprDropped = true;
      this.setDpr(Math.min(this.currentDpr, 1.3));
    } else if (zPos > -400 && this.spaceDprDropped) {
      this.spaceDprDropped = false;
    }

    const spaceFactor = THREE.MathUtils.clamp((yPos - 5) / 55 + (-442 - zPos) / 35, 0, 1);

    this.renderer.info.reset();
    // (long frames are split so the car's physics keep small, stable steps)
    const steps = Math.max(1, Math.ceil(sdt / 0.034));
    for (let s = 0; s < steps; s++) {
      this.vehicle.update(sdt / steps, this.input, this.autoCruise, slowdownFactor, tr.cruiseBoost);
    }
    this.treeLod?.update(this.vehicle.position.z);
    this.fireTrails.update(
      this.elapsedTime,
      this.vehicle.root,
      this.vehicle.speed,
      tr.carFx > 0.15,
      (this.renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
    );
    this.updateCamera(sdt);
    this.avenue.update(this.elapsedTime);
    this.avenue.setHaloView(
      (this.renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)),
      (this.scene.fog as THREE.FogExp2 | null)?.density ?? 0.0016
    );
    this.envSystem.update(this.elapsedTime, this.vehicle.position);
    this.spaceCosmos.update(this.elapsedTime, this.vehicle.position, spaceFactor, this.vehicle.speed);
    palette.updateUniforms(this.elapsedTime);

    if (this.frameCounter % 3 === 0) {
      this.updateDynamicLights();
    }

    const curZone = this.resolveCurrentZone(this.vehicle.position.z, this.vehicle.position.y);

    // Zone-tuned exposure: brighter warm dusk in Act I, cooler in the city,
    // deeper in space — same ACES curve, zero frame cost.
    const expTarget =
      yPos > 8 || zPos < -430 ? 1.02 : curZone.id === WORLD_ZONES[0].id ? 1.3 : 1.16;
    this.renderer.toneMappingExposure +=
      (expTarget - this.renderer.toneMappingExposure) * Math.min(1, dt * 2);

    // Zonal economy: the dense Act I street is the heaviest stretch — on weak
    // hardware (governor already at tier 1+) micro-props vanish and the two
    // heavy passes thin out to every 3rd frame. Other zones keep full quality.
    const heavyZone = curZone.id === WORLD_ZONES[0].id && this.qualityTier >= 1;
    if (!this.microDetail) {
      this.microDetail = [];
      this.scene.traverse((o) => {
        if (o.name === 'reflSkip') this.microDetail!.push(o);
      });
    }
    for (const m of this.microDetail) m.visible = !heavyZone;

    // The two heavy extra passes alternate: shadows on even frames, the planar reflection on
    // odd ones. Sharing the even frames made heavy and light frames alternate (micro-judder
    // on weak GPUs even at a decent average fps); now the cost is spread evenly.
    // Shadows: on the heavy street they refresh when the car has moved (or after a quarter
    // of a second) instead of by frame count, so the car's shadow never trails behind it.
    const sp = this.vehicle.position;
    const moved = Math.abs(sp.x - this.lastShadowPos.x) + Math.abs(sp.y - this.lastShadowPos.y) + Math.abs(sp.z - this.lastShadowPos.z);
    let shadowNow: boolean;
    // Idle = zero shadow work: nothing moved, nothing to re-render.
    if (moved < 0.05) {
      shadowNow = false;
    } else if (!heavyZone) {
      shadowNow = this.frameCounter % 2 === 0;
    } else {
      shadowNow = this.qualityTier >= 3 ? moved > 2.0 || this.elapsedTime - this.lastShadowT > 0.2 : moved > 0.9 || this.elapsedTime - this.lastShadowT > 0.25;
    }
    shadowNow = shadowNow && !this.cityHidden;
    if (shadowNow) {
      this.lastShadowPos.copy(sp);
      this.lastShadowT = this.elapsedTime;
    }
    this.renderer.shadowMap.needsUpdate = shadowNow;

    if (this.frameCounter % (heavyZone ? 3 : 2) === 1 && !(heavyZone && shadowNow)) {
      this.updatePlanarReflection();
    }
    // Desktop CAS: stronger on the opening street so the gantry posters read, light elsewhere
    if (this.sharpPass && !this.mobile && !this.sharpFixed) {
      const want = this.sharpBase + (zPos > 105 ? this.sharpBoost : 0);
      this.sharpCur += (want - this.sharpCur) * (1 - Math.exp(-2 * dt));
      this.sharpPass.uniforms.uSharp.value = this.sharpCur;
    }
    this.composer.render();

    this.frameCounter++;
    this.fpsFrames++;
    this.fpsAccum += dt;
    this.rawAccum += rawDt;
    // Telemetry re-renders the whole React tree: every 0.12s is too often on a phone CPU
    if (this.fpsAccum >= 0.25) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum); // clamped: what the governor uses
      this.displayFps = Math.round(this.fpsFrames / Math.max(this.rawAccum, 1e-3)); // real, for the readout
      this.rawAccum = 0;
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      this.emitTelemetry();
    }

    // Adaptive resolution: scale pixel ratio to hold ~60fps.
    // A hidden / occluded / throttled tab renders about one frame per second. That says nothing about
    // the GPU, so the governor must not read it as "slow": it pauses and forgets its streaks (it used
    // to walk through every quality step in a background tab and then save "weak" for good).
    this.slowFrames = rawDt > 0.5 ? this.slowFrames + 1 : 0;
    const throttled = document.hidden || rawDt > 0.5 || this.slowFrames >= 3;
    if (throttled) {
      this.dprTimer = 0;
      this.dipStreak = 0;
      this.upStreak = 0;
      this.lowStreak = 0;
      this.capStreak = 0;
    } else {
      this.dprTimer += dt;
    }
    // (checked faster during the first seconds, so a weak machine settles quickly instead of
    // crawling at 20 fps for the whole opening street)
    if (this.dprTimer >= (this.elapsedTime < 25 ? 1.2 : 2) && this.frameCounter > 30 && !(zPos < -380 || yPos > 5)) {
      this.dprTimer = 0;
      // Supersampling stops at 1.5x on an ordinary (1x) screen. The last steps, 1.75 and 2x, add little
      // sharpness (SMAA and the sharpen pass do the rest) but need render buffers of 8 megapixels:
      // on a real desktop (many tabs, a video playing) the 1.75 -> 2x reallocation froze the page for
      // 1.2 s right at the web stop (a recorded hitch). ?dpr=2 still pins 2x for anyone who wants it.
      const maxDpr = Math.min(this.maxRenderDpr(), this.dprCap, this.mobile ? 99 : Math.max(window.devicePixelRatio || 1, 1.5));
      // Phones never go below 1.5 (below that the image turns to mush).
      const floor = this.mobile ? 1.5 : this.dprFloor;
      const DPR_STEPS = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0].filter((s) => s >= floor);
      const target = this.frameCap || 60; // fps we are trying to hold
      let next = this.currentDpr;
      const cur = DPR_STEPS.reduce((a, b) => (Math.abs(b - next) < Math.abs(a - next) ? b : a));
      const native = window.devicePixelRatio || 1;
      // Every resolution change reallocates the render buffers (a one-off hitch), so a single
      // slow or fast window is not enough: a mild dip must repeat in two windows in a row,
      // and so must the headroom before climbing. A severe drop (< 60% of the target) acts at
      // once and skips a step, so a weak machine still settles quickly.
      const slow = this.currentFps < target * 0.83 && cur > floor;
      const severe = this.currentFps < target * 0.6;
      this.dipStreak = slow ? this.dipStreak + 1 : 0;
      // never climb to a higher resolution while the jump is approaching / playing: the resize
      // hitch would land exactly where the frame gets heavier
      const calm = !this.transPass.enabled && !(zPos < 215 && zPos > 85);
      const headroom =
        calm &&
        !slow &&
        this.currentFps > target * 0.95 &&
        cur < maxDpr &&
        (!this.mobile || this.dprDowns === 0) &&
        // above the screen's own resolution (supersampling) only with clear headroom, once
        (cur < native - 0.01 || (this.ssDowns === 0 && this.currentFps > target * 0.97));
      this.upStreak = headroom ? this.upStreak + 1 : 0;
      if (slow && (severe || this.dipStreak >= 2)) {
        const stepsDown = severe ? 2 : 1;
        next = DPR_STEPS[Math.max(0, DPR_STEPS.indexOf(cur) - stepsDown)];
        this.dprDowns++;
        this.dipStreak = 0;
        if (cur > native + 0.01) this.ssDowns++; // supersampling did not fit: never retry
      } else if (headroom && this.upStreak >= 2) {
        next = Math.min(maxDpr, DPR_STEPS[Math.min(DPR_STEPS.length - 1, DPR_STEPS.indexOf(cur) + 1)]);
        this.upStreak = 0;
      }
      // applied at the start of the next frame (see pendingDpr); pinned = never auto-change
      if (!this.dprPinned && Math.abs(next - this.currentDpr) >= 0.01) this.pendingDpr = next;

      // Phones that can't hold ~48 fps settle on a steady 30 instead of 20-40 stutter.
      if (this.mobile && !this.frameCap && !this.fpsForced) {
        this.capStreak = this.currentFps < 46 ? this.capStreak + 1 : 0;
        if (this.capStreak >= 2) {
          this.frameCap = 30;
          this.lowStreak = 0;
        }
      }

      // Quality governor: ~4s of sustained low FPS steps the scene down a tier
      // (a machine at under 45% of the target - 12-20 fps - is not going to recover by itself: it acts after one
      // window and drops two tiers at once, so it reaches a playable picture in seconds, not in sixteen)
      const crawling = this.currentFps < target * 0.45;
      this.lowStreak = this.currentFps < target * 0.7 ? this.lowStreak + 1 : 0;
      if ((this.lowStreak >= 2 || (crawling && this.lowStreak >= 1)) && this.qualityTier < 6) {
        this.lowStreak = 0;
        const steps = crawling ? 2 : 1;
        for (let i = 0; i < steps && this.qualityTier < 6; i++) this.applyQualityTier(++this.qualityTier);
      }
    }
  };

  // From tier 5 the machine is really struggling: remember the verdict (a week) so the next visit starts in the
  // weak profile at that tier at once, instead of crawling through the steps again in the first seconds.
  private rememberWeak(tier: number) {
    if (this.weakSaved && tier <= this.savedTier) return;
    this.weakSaved = true;
    this.savedTier = tier;
    try {
      localStorage.setItem('td-weak', String(Date.now()));
      localStorage.setItem('td-tier', String(tier));
    } catch {
      /* private mode */
    }
  }
  private savedTier = 0;
  private restoreTier() {
    if (!this.weak || this.mobile) return;
    let saved = 0;
    try {
      saved = Number(localStorage.getItem('td-tier')) || 0;
    } catch {
      /* private mode */
    }
    for (let t = 1; t <= Math.min(saved, 6); t++) {
      this.qualityTier = t;
      this.applyQualityTier(t);
    }
    // resize now, behind the loading screen, not in the first frame of the drive
    if (this.pendingDpr !== null) {
      this.setDpr(this.pendingDpr);
      this.pendingDpr = null;
    }
  }

  private applyQualityTier(tier: number) {
    if (tier >= 5) this.rememberWeak(tier);
    if (tier === 1) {
      this.dprCap = 1.0;
      this.pendingDpr = 1.0; // applied (and clamped to the cap) at the start of the next frame
    } else if (tier === 2) {
      this.reflectionDisabled = true;
    } else if (tier === 3) {
      this.bloomPass.enabled = false;
    } else if (tier === 4) {
      // three SMAA passes -> one FXAA pass
      if (this.smaaPass && this.fxaaPass) {
        this.smaaPass.enabled = false;
        this.fxaaPass.enabled = true;
      }
    } else if (tier === 5) {
      // Only the car casts a shadow. The shadow pass otherwise redraws every building and lamp in the
      // frustum, and on the opening street it runs about every frame (the car moves > 0.9 m per frame
      // at 30 fps): on a weak GPU that single pass is a third of the frame. The car keeps its shadow
      // (and its contact shadow); the street loses the long building shadows.
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.castShadow && !m.userData.carShadow) {
          m.castShadow = false;
          this.droppedCasters.push(m);
        }
      });
    } else if (tier === 6) {
      // last resort: render a little below the screen's resolution (FXAA smooths it)
      this.dprFloor = 0.8;
      this.dprCap = 0.8;
      this.pendingDpr = 0.8;
    }
  }
  private droppedCasters: THREE.Mesh[] = [];
  private dprFloor = 1.0;

  private emitTelemetry() {
    if (!this.onTelemetry) return;
    const zPos = this.vehicle.position.z;
    const yPos = this.vehicle.position.y;
    const zPreset = this.resolveCurrentZone(zPos, yPos);
    const spaceFactor = THREE.MathUtils.clamp((yPos - 5) / 55 + (-442 - zPos) / 35, 0, 1);

    this.onTelemetry({
      fps: this.displayFps,
      drawCalls: this.renderer.info.render.calls,
      profile: `${this.mobile ? 'mobile' : this.weak ? 'weak' : 'full'} · ${this.frameCap ? 'cap' + this.frameCap : 'uncapped'} · dpr${this.currentDpr.toFixed(2)}${this.dprPinned ? ' pinned' : ''}${this.ctxLost ? ' · CTX LOST x' + this.ctxLost : ''}`,
      triangles: this.renderer.info.render.triangles,
      speedKmh: Math.round(Math.abs(this.vehicle.speed) * 3.2),
      zPos: Math.round(zPos),
      yPos: Math.round(yPos),
      activeZoneId: zPreset.id,
      activeZoneLabel: zPreset.label,
      activeZoneEra: zPreset.era,
      activeZoneSubtitle: zPreset.subtitle,
      cameraMode: this.cameraMode,
      autoCruise: this.autoCruise,
      carModel: this.vehicle.currentCar,
      duskDepth: this.duskDepth,
      activeStation: this.activeStation,
      temporalFlash: Math.round(this.temporalFlash * 100) / 100,
      flashKind: this.flashKind,
      spaceFactor: Math.round(spaceFactor * 100) / 100,
    });
  }

  private pointers = new Map<number, { x: number; y: number }>();
  private pinchPrev = 0;
  private pinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinchPrev = this.pinchDist();
    this.isPointerDown = true;
    this.recenterCam = false;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      // two fingers: pinch = zoom (the wheel's counterpart on a touch screen), no orbiting
      const d = this.pinchDist();
      if (this.pinchPrev > 0 && d > 0) {
        this.userZoom = THREE.MathUtils.clamp(this.userZoom * (this.pinchPrev / d), 0.55, 2.2);
      }
      this.pinchPrev = d;
      return;
    }
    if (!this.isPointerDown) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.orbitYaw -= dx * 0.0055;
    this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.0045, 0.04, 1.05);
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchPrev = 0;
    if (this.pointers.size === 1) {
      // one finger stays after a pinch: continue orbiting from where it is, without a jump
      const p = [...this.pointers.values()][0];
      this.lastPointerX = p.x;
      this.lastPointerY = p.y;
    }
    if (this.pointers.size === 0) this.isPointerDown = false;
  };

  // The wheel only zooms the camera (closer / further), in every mode; it never moves the car.
  private userZoom = 1;
  private userZoomCur = 1;
  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.userZoom = THREE.MathUtils.clamp(this.userZoom * Math.exp(dy * 0.0011), 0.55, 2.2);
  };

  // Highest pixel ratio worth rendering: the screen's own, or 2x on desktop (supersampling)
  private maxRenderDpr() {
    const native = window.devicePixelRatio || 1;
    if (this.weak) return Math.min(native, 1.0);
    return this.mobile ? native : Math.max(native, 2);
  }

  // Single place that actually resizes renderer/composer/RT — every DPR change
  // routes through here so buffers are reallocated exactly once per step.
  private setDpr(next: number) {
    next = Math.min(next, this.dprCap, this.maxRenderDpr());
    if (Math.abs(next - this.currentDpr) < 0.01) return;
    this.currentDpr = next;
    this.renderer.setPixelRatio(next);
    this.composer.setPixelRatio(next);
    this.renderer.setSize(this.viewW, this.viewH);
    this.composer.setSize(this.viewW, this.viewH);
    // Bloom is low-frequency: at render res >=1.5x half-res bloom is free
    if (!this.mobile && !this.weak) this.bloomScale = next >= 1.5 ? 0.5 : 1;
    this.bloomPass.setSize(this.viewW * this.bloomScale, this.viewH * this.bloomScale);
    this.reflectRT.setSize(
      this.mobile ? 64 : Math.max(256, Math.floor(this.viewW * next * this.reflScale)),
      this.mobile ? 64 : Math.max(256, Math.floor(this.viewH * next * this.reflScale))
    );
    this.updateFxaa();
  }

  // FXAA needs the texel size of the (DPR-scaled) drawing buffer
  private updateFxaa() {
    const w = this.renderer.domElement.width || this.viewW;
    const h = this.renderer.domElement.height || this.viewH;
    if (this.fxaaPass) this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    if (this.sharpPass) this.sharpPass.uniforms['resolution'].value.set(1 / w, 1 / h);
  }

  // One real composer frame with EVERYTHING forced visible: compiles the
  // render-target shader variants (space group, trees, reflections, shadow
  // depth) behind the loading screen instead of mid-launch (was 150-530ms).
  // Compiles every material of the whole world (all groups forced visible for the call) with the
  // browser's parallel shader compilation; the main thread keeps running meanwhile.
  // Objects that are hidden until something happens (the car's glow / arcs / halos of a time jump,
  // fire, ...) were never compiled or uploaded by the warm-up, so their first appearance - just
  // before the jump - compiled shaders and uploaded buffers in the middle of the drive (a hitch
  // that only a first visit with a cold shader cache sees, e.g. on the published site).
  // Shows them for the warm-up and returns the function that hides them again. Lights are left
  // alone: toggling one would change the light count and recompile every material.
  private forceShowHidden(): () => void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o !== this.scene && !o.visible && !(o as THREE.Light).isLight) hidden.push(o);
    });
    hidden.forEach((o) => (o.visible = true));
    return () => hidden.forEach((o) => (o.visible = false));
  }

  private async precompileAsync() {
    // (the city may not exist yet when the first pass starts)
    const groups = [this.avenue.group, this.archGroup, this.spaceCosmos.group].filter(Boolean);
    const prev = groups.map((g) => g.visible);
    groups.forEach((g) => (g.visible = true));
    const hideAgain = this.forceShowHidden();
    // A program is specific to the render target it draws into (tone mapping and the output colour
    // space are part of its key): the scene is drawn into the composer's float target, so compile
    // with that target bound - compiling for the screen produced programs that were never used.
    const prevRT = this.renderer.getRenderTarget();
    // (a 1x1 target of the same type is enough: it can be called before the composer exists)
    const keyRT = this.compileRT ?? (this.compileRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.renderer.setRenderTarget(keyRT);
    let p: Promise<unknown>;
    try {
      p = this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined);
    } catch {
      p = Promise.resolve();
    }
    this.renderer.setRenderTarget(prevRT);
    hideAgain();
    groups.forEach((g, i) => (g.visible = prev[i])); // the collecting part of the call is synchronous
    await p;

  }

  // One forced frame of everything, so that nothing compiles or uploads during the first seconds of
  // the drive. Done in stages with a pause between them (each stage a few hundred ms instead of one
  // block): the reflection, the scene with its shadows, the post-processing chain. Nothing is
  // drawn to the screen before the last stage (the screen is a different render target, i.e.
  // different shader variants).
  private async warmUp() {
    const prevAvenue = this.avenue.group.visible;
    const prevArch = this.archGroup.visible;
    const prevCosmos = this.spaceCosmos.group.visible;
    this.avenue.group.visible = true;
    this.archGroup.visible = true;
    this.spaceCosmos.group.visible = true;
    const hideAgain = this.forceShowHidden();

    const culled: [THREE.Object3D, boolean][] = [];
    this.scene.traverse((o) => {
      const t = o as THREE.Mesh | THREE.Points | THREE.Sprite;
      if (t instanceof THREE.Mesh || t instanceof THREE.Points || t instanceof THREE.Sprite) {
        culled.push([o, o.frustumCulled]);
        o.frustumCulled = false;
      }
    });

    this.spaceCosmos.update(0, this.vehicle.position, 1);
    this.renderer.shadowMap.needsUpdate = true;
    this.updatePlanarReflection();
    await WorldSceneEngine.breathe();

    const passes = this.composer.passes;
    const savedEnabled = passes.map((p) => p.enabled);
    const toScreen = this.composer.renderToScreen;
    this.composer.renderToScreen = false;
    // stage 1: the scene itself (and its shadow map)
    passes.forEach((p, i) => (p.enabled = i === 0));
    this.composer.render();
    await WorldSceneEngine.breathe();
    // stage 2: + the transition pass (toggled on mid-journey) and the bloom
    this.transPass.uniforms.uWarp.value = 0.01;
    this.transPass.uniforms.uFlash.value = 0.001;
    this.transPass.uniforms.uAspect.value = this.camera.aspect;
    passes.forEach((p, i) => (p.enabled = i <= 2));
    this.composer.render();
    await WorldSceneEngine.breathe();
    // stage 3: the whole chain, to the screen
    passes.forEach((p, i) => (p.enabled = savedEnabled[i]));
    this.transPass.enabled = true;
    this.composer.renderToScreen = toScreen;
    this.composer.render();
    this.transPass.enabled = false;

    for (const [o, v] of culled) o.frustumCulled = v;
    hideAgain();
    this.avenue.group.visible = prevAvenue;
    this.archGroup.visible = prevArch;
    this.spaceCosmos.group.visible = prevCosmos;
    this.spaceCosmos.update(0, this.vehicle.position, 0);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.viewW = width;
    this.viewH = height;
    const pixelRatio = this.currentDpr;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width * this.bloomScale, height * this.bloomScale);
    this.reflectRT.setSize(
      this.mobile ? 64 : Math.max(256, Math.floor(width * pixelRatio * this.reflScale)),
      this.mobile ? 64 : Math.max(256, Math.floor(height * pixelRatio * this.reflScale))
    );
    this.updateFxaa();
    // Resizing cleared the canvas: redraw in the same task so no black frame is shown
    if (!this.paused) this.composer.render();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Ctrl+Alt+L: copy the list of recorded hitches (frames over 50 ms) for a bug report
    if (e.ctrlKey && e.altKey && e.code === 'KeyL') {
      const text = this.hitchReport();
      const done = (msg: string) => {
        const n = document.createElement('div');
        n.textContent = msg;
        n.style.cssText =
          'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99;padding:8px 14px;border-radius:8px;background:rgba(5,10,20,.9);color:#fbbf24;font:12px ui-monospace,monospace;border:1px solid rgba(255,255,255,.2)';
        document.body.appendChild(n);
        window.setTimeout(() => n.remove(), 2600);
      };
      navigator.clipboard
        ?.writeText(text)
        .then(() => done('Лог скопирован: ' + this.hitches.length + ' подвисаний'))
        .catch(() => done('Не удалось скопировать лог'));
      console.info(text);
      return;
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.boost = true;
        break;
      case 'KeyP':
      case 'Space':
        // (a focused UI button already turns Space into a click: don't toggle twice)
        if (!e.repeat && tag !== 'BUTTON') this.toggleAutoCruise();
        break;
      case 'KeyC':
        if (!e.repeat) {
          const modes: CameraMode[] = ['chase', 'cinematic-low', 'orbit'];
          const next = modes[(modes.indexOf(this.cameraMode) + 1) % modes.length];
          this.setCameraMode(next);
        }
        break;
      // 1-5: the chapters of the bottom strip, in the same order (the gate is not a chapter)
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5': {
        const ch = CHAPTERS[Number(e.code.slice(5)) - 1];
        if (!e.repeat && ch) this.jumpToZone(ch.id);
        break;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.boost = false;
        break;
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.compileRT?.dispose();
    this.reflectRT?.dispose(); // (undefined if disposed while still being built)
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
