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
import { createTextureLibrary } from './textures';
import { createMaterialPalette } from './materials';
import { createEnvironment, EnvironmentSystem } from './environment';
import { buildGrandAvenue, AvenueSystem } from './avenue';
import { buildWorldArchitecture } from './buildings';
import { LightAnchor } from './architectureBuilder';
import { CarModelId, createVehicleController, VehicleController } from './vehicle';
import { loadAndPlaceElmTrees } from './trees';
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

export class WorldSceneEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private bloomBase = 0.28;
  private baseFov = 50;
  private trans = new TransitionDirector();
  private transPass!: ShaderPass;
  private fireTrails!: FireTrails;

  private reflectRT: THREE.WebGLRenderTarget;
  private reflectCam: THREE.PerspectiveCamera;
  private reflectMatrix = new THREE.Matrix4();
  private biasMatrix = new THREE.Matrix4().set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0
  );
  private reflectionClipPlane = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02)];

  private envSystem: EnvironmentSystem;
  private avenue: AvenueSystem;
  private archGroup!: THREE.Group;
  private vehicle: VehicleController;
  private spaceCosmos: SpaceCosmosSystem;

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
  private activeZoneId = WORLD_ZONES[0].id;
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
  private dprCap = 2.0; // governor steps this down on weak hardware anyway
  private qualityTier = 0; // 0 full → 1 low-DPR → 2 no reflection → 3 no bloom
  private lowStreak = 0;
  private reflectionDisabled = false;
  private spaceDprDropped = false;
  private cityHidden = false;
  private treesGroup: THREE.Object3D | null = null;
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
    // ?dpr=1.5|1.75|2 pins the render resolution (to judge sharpness vs fps on a phone)
    const dprParam = parseFloat(params.get('dpr') ?? '');
    if (Number.isFinite(dprParam) && dprParam >= 1 && dprParam <= 3) {
      this.dprCap = dprParam;
      this.dprPinned = true;
    }
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.dprPinned ? this.dprCap : 2
    );
    this.currentDpr = pixelRatio;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // composer path — SMAAPass handles edges, MSAA here is dead weight
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.info.autoReset = false;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.autoUpdate = false; // driven manually every 2nd frame
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.35, 2200);
    this.camera.layers.enable(1); // layer 1: visible in main cam, excluded from planar reflection

    const texLib = createTextureLibrary(this.renderer);
    const palette = createMaterialPalette(texLib, { mobile: this.mobile });

    this.envSystem = createEnvironment(this.renderer, this.scene, palette);
    if (this.mobile) {
      // No shadow map on phones: stop the sun from casting before anything compiles
      this.scene.traverse((o) => {
        const l = o as THREE.DirectionalLight;
        if (l.isDirectionalLight) l.castShadow = false;
      });
    }
    this.avenue = buildGrandAvenue(palette);
    this.scene.add(this.avenue.group);

    const archResult = buildWorldArchitecture(palette, texLib.maxAnisotropy);
    this.archGroup = archResult.group;
    this.scene.add(this.archGroup);

    // Load real 3D elm trees (`tree_elm.glb`) onto sidewalk planter islands, park mounds & Confluence terraces!
    const allTrees = [...this.avenue.treePlacements, ...archResult.treePlacements];
    // Phones: every other tree (each is ~38k triangles)
    // Loading bar: the car GLB is ~70% of the bytes, the trees ~30%
    let carFrac = 0;
    let treeFrac = 0;
    const report = () => onProgress?.(Math.min(1, carFrac * 0.72 + treeFrac * 0.28));
    const treesReady = loadAndPlaceElmTrees(
      this.scene,
      this.mobile ? allTrees.filter((_, i) => i % 2 === 0) : allTrees,
      (f) => {
        treeFrac = f;
        report();
      }
    );

    // Build Act III Space Cosmos & Starfield Warp
    this.spaceCosmos = createSpaceCosmos(this.scene);

    this.allLightAnchors = [...this.avenue.lightAnchors, ...archResult.lightAnchors];
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
      this.renderer, { mobile: this.mobile });
    this.fireTrails = createFireTrails(this.scene);
    // Loading screen waits for the car AND the tree GLB; tree shaders get a
    // second compile so they never stutter on first appearance.
    this.ready = Promise.all([this.vehicle.ready, treesReady]).then(() => {
      this.warmUp();
    });

    // Cheap planar reflection: sprites, particles & micro-props stay on layer 1
    // (main camera sees them, reflection camera does not).
    this.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints || o.name === 'reflSkip') {
        o.layers.set(1);
      }
    });

    // (phones never render the reflection pass, so keep its target tiny)
    const reflW = this.mobile ? 64 : Math.max(256, Math.floor(width * pixelRatio * 0.5));
    const reflH = this.mobile ? 64 : Math.max(256, Math.floor(height * pixelRatio * 0.5));
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
    this.transPass = createTransitionPass();
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
      this.composer.addPass(new SMAAPass(width, height));
    }

    // Precompile all shaders behind the loading screen — kills first-frame
    // compile hitches when the world first becomes visible.
    this.renderer.compile(this.scene, this.camera);

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
  }

  /** Pause/resume the whole simulation + rendering (e.g. while asking to rotate a phone).
   *  Asset loading and shader warm-up are unaffected. */
  private panelShift = 0; // target: fraction of the screen width the view is slid sideways
  private panelShiftCur = 0;
  private viewOffsetOn = false;
  public setPanelShift(fraction: number) {
    this.panelShift = Math.max(0, Math.min(0.4, fraction));
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
    this.activeZoneId = z.id;
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
    const fovTarget = Math.min(105, this.baseFov + tr.fovKick);
    if (Math.abs(this.camera.fov - fovTarget) > 0.01) {
      this.camera.fov = fovTarget;
      this.camera.updateProjectionMatrix();
    }
    // A side panel covers part of the screen: slide the view so the scene (stand, car)
    // stays centred in the free part. Eased, and cleared again once it is back to 0.
    this.panelShiftCur += (this.panelShift - this.panelShiftCur) * (1 - Math.exp(-6 * dt));
    if (Math.abs(this.panelShift - this.panelShiftCur) < 0.0005) this.panelShiftCur = this.panelShift;
    if (this.panelShiftCur > 0.0005) {
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
    if (this.vehicle.position.y > 12 || this.cityHidden || this.reflectionDisabled) return;
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

    this.avenue.roadMesh.visible = false;
    const prevTarget = this.renderer.getRenderTarget();
    const prevShadows = this.renderer.shadowMap.autoUpdate;
    if (this.frameCounter > 1) {
      this.renderer.shadowMap.autoUpdate = false;
    }
    this.renderer.clippingPlanes = this.reflectionClipPlane;

    this.renderer.setRenderTarget(this.reflectRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.reflectCam);

    this.renderer.clippingPlanes = [];
    this.renderer.shadowMap.autoUpdate = prevShadows;
    this.renderer.setRenderTarget(prevTarget);
    this.avenue.roadMesh.visible = true;
  }

  private animate = (palette: ReturnType<typeof createMaterialPalette>) => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(() => this.animate(palette));

    const now = performance.now();
    if (this.paused) {
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
    const dt = Math.min((now - this.lastPerfTime) * 0.001, 0.05);
    this.lastPerfTime = now;
    this.elapsedTime += dt;

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

    this.trans.update(dt, zPos, yPos, this.vehicle.speed);
    const tr = this.trans.state;
    this.temporalFlash = tr.flash;
    this.flashKind = tr.flash > 0.02 ? tr.kind : null;

    // Post pass + bloom: only pay for the warp pass while a transition plays.
    const passOn = tr.flash > 0.002 || tr.warp > 0.01;
    this.transPass.enabled = passOn;
    if (passOn) {
      this.transPass.uniforms.uWarp.value = tr.warp;
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
    const sdt = dt * tr.timeScale;

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
    this.vehicle.update(sdt, this.input, this.autoCruise, slowdownFactor, tr.cruiseBoost);
    this.fireTrails.update(
      this.elapsedTime,
      this.vehicle.root,
      this.vehicle.speed,
      tr.carFx > 0.15,
      (this.renderer.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5))
    );
    this.updateCamera(sdt);
    this.avenue.update(this.elapsedTime);
    this.envSystem.update(this.elapsedTime, this.vehicle.position);
    this.spaceCosmos.update(this.elapsedTime, this.vehicle.position, spaceFactor, this.vehicle.speed);
    palette.updateUniforms(this.elapsedTime);

    if (this.frameCounter % 3 === 0) {
      this.updateDynamicLights();
    }

    const curZone = this.resolveCurrentZone(this.vehicle.position.z, this.vehicle.position.y);
    this.activeZoneId = curZone.id;

    // Shadow map renders every other frame — halves the third pass cost
    this.renderer.shadowMap.needsUpdate = !this.cityHidden && this.frameCounter % 2 === 0;

    if (this.frameCounter % 2 === 0) {
      this.updatePlanarReflection();
    }
    this.composer.render();

    this.frameCounter++;
    this.fpsFrames++;
    this.fpsAccum += dt;
    // Telemetry re-renders the whole React tree: every 0.12s is too often on a phone CPU
    if (this.fpsAccum >= (this.mobile ? 0.4 : 0.12)) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      this.emitTelemetry();
    }

    // Adaptive resolution: scale pixel ratio to hold ~60fps.
    this.dprTimer += dt;
    if (this.dprTimer >= 2 && this.frameCounter > 30 && !(zPos < -380 || yPos > 5)) {
      this.dprTimer = 0;
      const maxDpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
      // Phones never go below 1.5 (below that the image turns to mush).
      const floor = this.mobile ? 1.5 : 1.0;
      const DPR_STEPS = [1.0, 1.25, 1.5, 2.0].filter((s) => s >= floor);
      const target = this.frameCap || 60; // fps we are trying to hold
      let next = this.currentDpr;
      const cur = DPR_STEPS.reduce((a, b) => (Math.abs(b - next) < Math.abs(a - next) ? b : a));
      if (this.currentFps < target * 0.83 && cur > floor) {
        next = DPR_STEPS[Math.max(0, DPR_STEPS.indexOf(cur) - 1)];
        this.dprDowns++;
      } else if (this.currentFps > target * 0.95 && cur < maxDpr && (!this.mobile || this.dprDowns === 0)) {
        next = Math.min(maxDpr, DPR_STEPS[Math.min(DPR_STEPS.length - 1, DPR_STEPS.indexOf(cur) + 1)]);
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
      this.lowStreak = this.currentFps < target * 0.7 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 2 && this.qualityTier < 3) {
        this.lowStreak = 0;
        this.applyQualityTier(++this.qualityTier);
      }
    }
  };

  private applyQualityTier(tier: number) {
    if (tier === 1) {
      this.dprCap = 1.0;
      this.pendingDpr = 1.0; // applied (and clamped to the cap) at the start of the next frame
    } else if (tier === 2) {
      this.reflectionDisabled = true;
    } else {
      this.bloomPass.enabled = false;
    }
  }

  private emitTelemetry() {
    if (!this.onTelemetry) return;
    const zPos = this.vehicle.position.z;
    const yPos = this.vehicle.position.y;
    const zPreset = this.resolveCurrentZone(zPos, yPos);
    const spaceFactor = THREE.MathUtils.clamp((yPos - 5) / 55 + (-442 - zPos) / 35, 0, 1);

    this.onTelemetry({
      fps: this.currentFps,
      drawCalls: this.renderer.info.render.calls,
      profile: `${this.mobile ? 'mobile' : 'full'} · ${this.frameCap ? 'cap' + this.frameCap : 'uncapped'} · dpr${this.currentDpr.toFixed(2)}${this.dprPinned ? ' pinned' : ''}${this.ctxLost ? ' · CTX LOST x' + this.ctxLost : ''}`,
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

  private handlePointerDown = (e: PointerEvent) => {
    this.isPointerDown = true;
    this.recenterCam = false;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.orbitYaw -= dx * 0.0055;
    this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.0045, 0.04, 1.05);
  };

  private handlePointerUp = () => {
    this.isPointerDown = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.cameraMode === 'orbit') {
      this.orbitDist = THREE.MathUtils.clamp(this.orbitDist + e.deltaY * 0.015, 5.5, 65);
    } else {
      if (this.activeStation && e.deltaY > 0) {
        this.clearedStations.add(this.activeStation);
        this.activeStation = null;
      }
      this.vehicle.position.z = THREE.MathUtils.clamp(
        this.vehicle.position.z - e.deltaY * 0.045,
        -485,
        340
      );
    }
  };

  // Single place that actually resizes renderer/composer/RT — every DPR change
  // routes through here so buffers are reallocated exactly once per step.
  private setDpr(next: number) {
    next = Math.min(next, this.dprCap, window.devicePixelRatio || 1);
    if (Math.abs(next - this.currentDpr) < 0.01) return;
    this.currentDpr = next;
    this.renderer.setPixelRatio(next);
    this.composer.setPixelRatio(next);
    this.renderer.setSize(this.viewW, this.viewH);
    this.composer.setSize(this.viewW, this.viewH);
    this.bloomPass.setSize(this.viewW * this.bloomScale, this.viewH * this.bloomScale);
    this.reflectRT.setSize(
      this.mobile ? 64 : Math.max(256, Math.floor(this.viewW * next * 0.5)),
      this.mobile ? 64 : Math.max(256, Math.floor(this.viewH * next * 0.5))
    );
    this.updateFxaa();
  }

  // FXAA needs the texel size of the (DPR-scaled) drawing buffer
  private updateFxaa() {
    if (!this.fxaaPass) return;
    const w = this.renderer.domElement.width || this.viewW;
    const h = this.renderer.domElement.height || this.viewH;
    this.fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    if (this.sharpPass) this.sharpPass.uniforms['resolution'].value.set(1 / w, 1 / h);
  }

  // One real composer frame with EVERYTHING forced visible: compiles the
  // render-target shader variants (space group, trees, reflections, shadow
  // depth) behind the loading screen instead of mid-launch (was 150-530ms).
  private warmUp() {
    const prevAvenue = this.avenue.group.visible;
    const prevArch = this.archGroup.visible;
    const prevCosmos = this.spaceCosmos.group.visible;
    this.avenue.group.visible = true;
    this.archGroup.visible = true;
    this.spaceCosmos.group.visible = true;

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
    // Also compile the transition post pass now (it is toggled on mid-journey).
    this.transPass.enabled = true;
    this.transPass.uniforms.uWarp.value = 0.01;
    this.transPass.uniforms.uFlash.value = 0.001;
    this.transPass.uniforms.uAspect.value = this.camera.aspect;
    this.composer.render();
    this.transPass.enabled = false;

    for (const [o, v] of culled) o.frustumCulled = v;
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
      this.mobile ? 64 : Math.max(256, Math.floor(width * pixelRatio * 0.5)),
      this.mobile ? 64 : Math.max(256, Math.floor(height * pixelRatio * 0.5))
    );
    this.updateFxaa();
    // Resizing cleared the canvas: redraw in the same task so no black frame is shown
    if (!this.paused) this.composer.render();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
      case 'Digit1':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[0].id);
        break;
      case 'Digit2':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[1].id);
        break;
      case 'Digit3':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[2].id);
        break;
      case 'Digit4':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[3].id);
        break;
      case 'Digit5':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[4].id);
        break;
      case 'Digit6':
        if (!e.repeat) this.jumpToZone(WORLD_ZONES[5].id);
        break;
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
    this.reflectRT.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
