import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

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
  update: (
    dt: number,
    input: { forward: boolean; backward: boolean; left: boolean; right: boolean; boost: boolean },
    autoCruise: boolean,
    stationSlowdownFactor: number
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

export function createVehicleController(
  scene: THREE.Scene,
  onProgress?: (fraction: number) => void
): VehicleController {
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
    root.add(spot);
    root.add(spot.target);
    return spot;
  };
  const headL = mkHeadlight(-0.85);
  const headR = mkHeadlight(0.85);

  const headGlowL = lampSprite('#fff3d9', 0.5);
  headGlowL.position.set(-0.84, 1.0, -3.8);
  (headGlowL.material as THREE.SpriteMaterial).opacity = 0.55;
  const headGlowR = lampSprite('#fff3d9', 0.5);
  headGlowR.position.set(0.84, 1.0, -3.8);
  (headGlowR.material as THREE.SpriteMaterial).opacity = 0.55;
  root.add(headGlowL, headGlowR);

  // Taillights: full-width rear glow + brake dynamics
  const tailMatL = lampSprite('#ff3822', 1.15);
  const tailMatR = lampSprite('#ff3822', 1.15);
  tailMatL.position.set(-0.95, 1.28, 3.62);
  tailMatR.position.set(0.95, 1.28, 3.62);
  root.add(tailMatL, tailMatR);

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
  };

  // Wheels have baked transforms in these Sketchfab GLBs — detect them by
  // bounding box (roundish, low, out at the four corners) and re-pivot.
  const wheelPivots: { pivot: THREE.Group; r: number }[] = [];
  const setupWheelPivots = (group: THREE.Group) => {
    wheelPivots.length = 0;
    group.updateMatrixWorld(true);
    const carBox = new THREE.Box3().setFromObject(group);
    const carSize = carBox.getSize(new THREE.Vector3());
    const carC = carBox.getCenter(new THREE.Vector3());
    const wheelMeshes: { mesh: THREE.Mesh; c: THREE.Vector3; r: number }[] = [];
    const meshes: { mesh: THREE.Mesh; b: THREE.Box3 }[] = [];
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push({ mesh: o, b: new THREE.Box3().setFromObject(o) });
    });
    // Expected wheel-well positions: four corners just above the ground
    for (const sx of [-1, 1]) {
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
      parent.updateMatrixWorld(true);
      pivot.position.copy(parent.worldToLocal(c.clone()));
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
  const spinAxis = new THREE.Vector3();

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
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (const m of mats) {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.envMapIntensity = 1.45;
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
                }
              }
            }
          }
        });

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.rotation.y = (size.x > size.z ? Math.PI / 2 : 0) + Math.PI;
        loadedModels.set(id, wrapper);
        if (currentCar === id) {
          applyModel(id, wrapper);
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

  let heading = 0;
  let pitchAngle = 0; // 0 on road, smoothly rotates up to +Math.PI/2 (90 degrees straight up!) in Act III Space Launch
  let speed = 0;
  let prevSpeed = 0;
  let brakeGlow = 0;
  let exhaustTime = 0;
  const prevPos = new THREE.Vector3();
  const tmpV = new THREE.Vector3();

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
    update: (dt, input, autoCruise, stationSlowdownFactor) => {
      exhaustTime += dt;
      const maxSpeed = input.boost ? 56 : 34;
      const accel = input.boost ? 36 : 22;

      if (input.forward) {
        speed = THREE.MathUtils.lerp(speed, maxSpeed, 1 - Math.exp(-accel * 0.12 * dt));
      } else if (input.backward) {
        speed = THREE.MathUtils.lerp(speed, -18, 1 - Math.exp(-18 * 0.12 * dt));
      } else if (autoCruise) {
        // In auto-cruise, smoothly slow down when approaching a project station (`stationSlowdownFactor` 0..1)
        const targetCruise = THREE.MathUtils.lerp(28, 0, stationSlowdownFactor);
        speed = THREE.MathUtils.lerp(speed, targetCruise, 1 - Math.exp(-4.2 * dt));
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
          pitchAngle = THREE.MathUtils.lerp(pitchAngle, targetPitch, 1 - Math.exp(-3.5 * dt));

          const forwardHoriz = Math.cos(pitchAngle) * speed;
          const climbVert = Math.sin(pitchAngle) * speed;

          root.position.z -= forwardHoriz * dt;
          root.position.y = Math.min(220, root.position.y + climbVert * dt);
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
      (tailMatL.material as THREE.SpriteMaterial).opacity = Math.min(1, tailHot);
      (tailMatR.material as THREE.SpriteMaterial).opacity = Math.min(1, tailHot);
      prevSpeed = speed;

      // --- Headlight dynamics: subtle boost surge + beam flicker ---------------
      const flicker = input.boost ? Math.sin(exhaustTime * 47) * 3.5 : 0;
      const headI = 30 + Math.min(14, Math.abs(speed) * 0.22) + flicker;
      headL.intensity = headI;
      headR.intensity = headI;
      headL.target.updateMatrixWorld();
      headR.target.updateMatrixWorld();

      // Wheel spin — re-pivoted hubs rotate about the car's lateral axis
      if (wheelPivots.length && Math.abs(speed) > 0.05) {
        for (const { pivot, r } of wheelPivots) {
          pivot.rotateOnAxis(pivot.userData.ax, (-speed * dt) / r);
        }
      }

    },
  };
}
