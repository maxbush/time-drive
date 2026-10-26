import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
    z: 122,
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

const STATION_STOPS: Array<{ id: Exclude<ProjectStationId, null>; stopZ: number; camYaw: number }> = [
  { id: 'web', stopZ: -82, camYaw: 0.14 },
  { id: 'albion', stopZ: -210, camYaw: 0.18 },
  { id: 'tenders', stopZ: -332, camYaw: -0.14 },
];

export interface WorldTelemetry {
  fps: number;
  drawCalls: number;
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
  private readonly LIGHT_POOL_SIZE = 8;
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
  private dprCap = 2.0;
  private qualityTier = 0; // 0 full → 1 low-DPR → 2 no reflection → 3 no bloom
  private lowStreak = 0;
  private reflectionDisabled = false;

  private animFrameId = 0;
  private lastPerfTime = performance.now();
  private elapsedTime = 0;
  private frameCounter = 0;
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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.currentDpr = pixelRatio;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.info.autoReset = false;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.35, 2200);
    this.camera.layers.enable(1); // layer 1: visible in main cam, excluded from planar reflection

    const texLib = createTextureLibrary(this.renderer);
    const palette = createMaterialPalette(texLib);

    this.envSystem = createEnvironment(this.renderer, this.scene, palette);
    this.avenue = buildGrandAvenue(palette);
    this.scene.add(this.avenue.group);

    const archResult = buildWorldArchitecture(palette, texLib.maxAnisotropy);
    this.archGroup = archResult.group;
    this.scene.add(this.archGroup);

    // Load real 3D elm trees (`tree_elm.glb`) onto sidewalk planter islands, park mounds & Confluence terraces!
    loadAndPlaceElmTrees(this.scene, [
      ...this.avenue.treePlacements,
      ...archResult.treePlacements,
    ]);

    // Build Act III Space Cosmos & Starfield Warp
    this.spaceCosmos = createSpaceCosmos(this.scene);

    this.allLightAnchors = [...this.avenue.lightAnchors, ...archResult.lightAnchors];
    for (let i = 0; i < this.LIGHT_POOL_SIZE; i++) {
      const pl = new THREE.PointLight(0xffd89e, 0, 32, 1.65);
      this.scene.add(pl);
      this.dynamicLightPool.push(pl);
    }

    this.vehicle = createVehicleController(this.scene, onProgress);
    this.ready = this.vehicle.ready;

    // Cheap planar reflection: sprites, particles & micro-props stay on layer 1
    // (main camera sees them, reflection camera does not).
    this.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite || (o as THREE.Points).isPoints || o.name === 'reflSkip') {
        o.layers.set(1);
      }
    });

    const reflW = Math.max(256, Math.floor(width * pixelRatio * 0.5));
    const reflH = Math.max(256, Math.floor(height * pixelRatio * 0.5));
    this.reflectRT = new THREE.WebGLRenderTarget(reflW, reflH, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
    });
    this.reflectCam = new THREE.PerspectiveCamera();
    palette.setReflectionData(this.reflectRT.texture, this.reflectMatrix);

    const composerRT = new THREE.WebGLRenderTarget(
      Math.floor(width * pixelRatio),
      Math.floor(height * pixelRatio),
      {
        type: THREE.HalfFloatType,
        samples: 4,
      }
    );
    this.composer = new EffectComposer(this.renderer, composerRT);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.28,
      0.48,
      0.96
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.jumpToZone(WORLD_ZONES[0].id, true);
    // Spawn the car just behind the intro camera so it drives into frame.
    this.vehicle.setPose(2.8, 344, 0, 0, 0);
    this.updateDynamicLights();

    // Optional forced quality: ?quality=low|med|high
    const q = new URLSearchParams(window.location.search).get('quality');
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

    this.lastPerfTime = performance.now();
    this.animate(palette);
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
    this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, 0.04, 0.6);
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
    this.bloomPass.strength = 0.24 + this.duskDepth * 0.16;
    this.emitTelemetry();
  }

  private updateCamera(dt: number) {
    const carPos = this.vehicle.position;
    const carYaw = this.vehicle.heading;
    const carPitch = this.vehicle.pitchAngle;

    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
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
      const yaw = carYaw + this.orbitYaw;
      const pitch = THREE.MathUtils.clamp(this.orbitPitch, 0.05, 0.65);
      const dist = this.orbitDist;
      const horiz = dist * Math.cos(pitch);
      const vert = dist * Math.sin(pitch) + 1.6;

      desiredPos.set(
        carPos.x + Math.sin(yaw) * horiz,
        carPos.y + vert,
        carPos.z + Math.cos(yaw) * horiz
      );

      desiredLook.set(
        carPos.x - Math.sin(yaw) * 16.0,
        carPos.y + 3.6,
        carPos.z - Math.cos(yaw) * 16.0
      );
      this.camera.fov = THREE.MathUtils.lerp(
        this.camera.fov,
        50 + Math.min(12, Math.abs(this.vehicle.speed) * 0.22),
        1 - Math.exp(-6 * dt)
      );
      this.camera.updateProjectionMatrix();
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
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 56, 1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
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

    const damp = 1 - Math.exp(-8.5 * dt);
    this.smoothCamPos.lerp(desiredPos, damp);
    this.smoothLookAt.lerp(desiredLook, damp);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothLookAt);
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
    if (this.vehicle.position.y > 12 || this.vehicle.position.z < -420 || this.reflectionDisabled) return;
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
              this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, st.camYaw, 1 - Math.exp(-3 * dt));
            }
          }
          break;
        }
      }

      // In Act III Space Launch, once car climbs to y >= 95m, open the Space Finale Contact card
      if (yPos >= 95 && !this.clearedStations.has('space')) {
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
    let flashTarget = 0;
    this.flashKind = null;
    if (zPos < 106 && zPos > 72 && yPos < 2) {
      flashTarget = Math.max(0, 1 - Math.abs(zPos - 89) / 16);
      this.flashKind = 'jump';
    } else if (zPos < -434 && zPos > -472 && yPos < 10) {
      flashTarget = Math.max(0, 1 - Math.abs(zPos + 452) / 18);
      this.flashKind = 'launch';
    }
    this.temporalFlash = THREE.MathUtils.lerp(
      this.temporalFlash,
      flashTarget,
      1 - Math.exp(-(flashTarget > this.temporalFlash ? 14 : 6) * dt)
    );

    // Space approach: strip the expensive passes BEFORE the launch, not at it.
    // Past z≈-435 the city is behind the camera anyway — hide world, kill the
    // planar reflection, and cap pixel ratio so the ring flight stays smooth.
    const spaceApproach = zPos < -420;
    const hideCity = yPos > 16 || zPos < -435 || (this.flashKind === 'launch' && this.temporalFlash > 0.45);
    this.avenue.group.visible = !hideCity;
    this.archGroup.visible = !hideCity;
    if (spaceApproach && this.currentDpr > 1.5) {
      this.currentDpr = Math.max(1.35, this.currentDpr - dt * 0.9);
      this.renderer.setPixelRatio(this.currentDpr);
      this.composer.setPixelRatio(this.currentDpr);
    }

    const spaceFactor = THREE.MathUtils.clamp((yPos - 5) / 55 + (-442 - zPos) / 35, 0, 1);

    this.renderer.info.reset();
    this.vehicle.update(dt, this.input, this.autoCruise, slowdownFactor);
    this.updateCamera(dt);
    this.avenue.update(this.elapsedTime);
    this.envSystem.update(this.elapsedTime, this.vehicle.position);
    this.spaceCosmos.update(this.elapsedTime, this.vehicle.position, spaceFactor);
    palette.updateUniforms(this.elapsedTime);

    if (this.frameCounter % 3 === 0) {
      this.updateDynamicLights();
    }

    const curZone = this.resolveCurrentZone(this.vehicle.position.z, this.vehicle.position.y);
    this.activeZoneId = curZone.id;

    if (this.frameCounter % 2 === 0) {
      this.updatePlanarReflection();
    }
    this.composer.render();

    this.frameCounter++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.12) {
      this.currentFps = Math.round(this.frameCounter / this.fpsAccum);
      this.frameCounter = 0;
      this.fpsAccum = 0;
      this.emitTelemetry();
    }

    // Adaptive resolution: scale pixel ratio to hold ~60fps.
    this.dprTimer += dt;
    if (this.dprTimer >= 2 && this.frameCounter > 30) {
      this.dprTimer = 0;
      const maxDpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
      let next = this.currentDpr;
      if (this.currentFps < 50 && next > 1.0) {
        next = Math.max(1.0, next - 0.25);
      } else if (this.currentFps > 57 && next < maxDpr) {
        next = Math.min(maxDpr, next + 0.1);
      }
      if (next !== this.currentDpr) {
        this.currentDpr = next;
        this.renderer.setPixelRatio(next);
        this.composer.setPixelRatio(next);
        this.renderer.setSize(this.viewW, this.viewH);
        this.composer.setSize(this.viewW, this.viewH);
        this.reflectRT.setSize(
          Math.max(256, Math.floor(this.viewW * next * 0.5)),
          Math.max(256, Math.floor(this.viewH * next * 0.5))
        );
      }

      // Quality governor: ~4s of sustained low FPS steps the scene down a tier
      this.lowStreak = this.currentFps < 42 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 2 && this.qualityTier < 3) {
        this.lowStreak = 0;
        this.applyQualityTier(++this.qualityTier);
      }
    }
  };

  private applyQualityTier(tier: number) {
    if (tier === 1) {
      this.dprCap = 1.0;
      this.currentDpr = Math.min(this.currentDpr, 1.0);
      this.renderer.setPixelRatio(this.currentDpr);
      this.composer.setPixelRatio(this.currentDpr);
      this.renderer.setSize(this.viewW, this.viewH);
      this.composer.setSize(this.viewW, this.viewH);
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
    this.bloomPass.setSize(width, height);
    this.reflectRT.setSize(
      Math.max(256, Math.floor(width * pixelRatio * 0.5)),
      Math.max(256, Math.floor(height * pixelRatio * 0.5))
    );
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
        if (!e.repeat) this.toggleAutoCruise();
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
