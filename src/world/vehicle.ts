import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type CarModelId = 'bttf' | 'alpha5' | 'rimac';

const CAR_FILES: Record<CarModelId, string> = {
  bttf: '/models/bttf_delorean_mobile.glb',
  alpha5: '/models/delorean_alpha5.glb',
  rimac: '/models/rimac_concept_one.glb',
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

export function createVehicleController(scene: THREE.Scene): VehicleController {
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

  const headGlowL = lampSprite('#ffd9a2', 1.15);
  headGlowL.position.set(-0.85, 1.02, -3.62);
  const headGlowR = lampSprite('#ffd9a2', 1.15);
  headGlowR.position.set(0.85, 1.02, -3.62);
  root.add(headGlowL, headGlowR);

  // Taillights: full-width rear glow + brake dynamics
  const tailMatL = lampSprite('#ff3822', 1.35);
  const tailMatR = lampSprite('#ff3822', 1.35);
  tailMatL.position.set(-0.95, 1.0, 3.58);
  tailMatR.position.set(0.95, 1.0, 3.58);
  root.add(tailMatL, tailMatR);
  const tailLight = new THREE.PointLight('#ff2c14', 3.5, 11, 1.8);
  tailLight.position.set(0, 1.05, 3.9);
  root.add(tailLight);

  // Atmospheric-friction heat glow around the car during the 90° space climb
  const heatGlow = lampSprite('#ff7a28', 9.5);
  heatGlow.position.set(0, 1.3, 1.6);
  (heatGlow.material as THREE.SpriteMaterial).opacity = 0;
  root.add(heatGlow);

  // Exhaust / time-jump flame trail particle pool (BTTF fire trails)
  const P_COUNT = 240;
  const pPos = new Float32Array(P_COUNT * 3);
  const pVel = new Float32Array(P_COUNT * 3);
  const pLife = new Float32Array(P_COUNT);
  const pLifeMax = new Float32Array(P_COUNT);
  const pCol = new Float32Array(P_COUNT * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: 1.4,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const exhaust = new THREE.Points(pGeo, pMat);
  exhaust.frustumCulled = false;
  scene.add(exhaust);

  const loader = new GLTFLoader();
  const loadedModels = new Map<CarModelId, THREE.Group>();
  const wheelSets = new Map<CarModelId, THREE.Object3D[]>();
  let activeModelGroup: THREE.Group | null = null;
  let currentCar: CarModelId = 'bttf';

  const applyModel = (id: CarModelId, group: THREE.Group) => {
    if (activeModelGroup) {
      chassis.remove(activeModelGroup);
    }
    fallbackGroup.visible = false;
    activeModelGroup = group;
    chassis.add(group);
    currentCar = id;
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
        const wheels: THREE.Object3D[] = [];
        model.traverse((o) => {
          if (/wheel/i.test(o.name)) wheels.push(o);
        });
        wheelSets.set(id, wheels);
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
                    m.emissiveIntensity = 0.65;
                    m.depthWrite = true;
                  }
                  if (m.name === 'red_glas') {
                    m.emissiveIntensity = 0.85;
                  }
                  if (id === 'alpha5' && m.metalness < 0.3 && m.roughness > 0.6) {
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
      },
      undefined,
      () => {
        fallbackGroup.visible = true;
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
  const carVel = new THREE.Vector3();
  const emitA = new THREE.Vector3();
  const emitB = new THREE.Vector3();
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

      // --- Wheel spin ---------------------------------------------------------
      const wheels = wheelSets.get(currentCar);
      if (wheels) {
        const wSpin = (speed / 0.42) * dt;
        for (const w of wheels) w.rotation.x += wSpin;
      }

      // --- Brake lights: flare up on deceleration / reverse input --------------
      const decel = (prevSpeed - speed) / Math.max(dt, 0.001);
      const braking = (decel > 4.5 && prevSpeed > 0.5) || (input.backward && speed > 1.5);
      brakeGlow = THREE.MathUtils.lerp(brakeGlow, braking ? 1 : 0, 1 - Math.exp(-9 * dt));
      const tailHot = 0.5 + brakeGlow * 0.5 + (pitchAngle > 0.05 ? 0.35 : 0);
      (tailMatL.material as THREE.SpriteMaterial).opacity = Math.min(1, tailHot);
      (tailMatR.material as THREE.SpriteMaterial).opacity = Math.min(1, tailHot);
      tailLight.intensity = 3.5 + brakeGlow * 18 + (pitchAngle > 0.05 ? 6 : 0);
      prevSpeed = speed;

      // --- Headlight dynamics: subtle boost surge + beam flicker ---------------
      const flicker = input.boost ? Math.sin(exhaustTime * 47) * 3.5 : 0;
      const headI = 30 + Math.min(14, Math.abs(speed) * 0.22) + flicker;
      headL.intensity = headI;
      headR.intensity = headI;
      headL.target.updateMatrixWorld();
      headR.target.updateMatrixWorld();

      // --- Space-flight dynamics: heat glow + BTTF fire-trail exhaust ----------
      const flightFactor = THREE.MathUtils.clamp(pitchAngle / 1.2, 0, 1);
      const boosting = input.boost && Math.abs(speed) > 28;
      const emitting = flightFactor > 0.02 || boosting;
      const heatMat = heatGlow.material as THREE.SpriteMaterial;
      heatMat.opacity = THREE.MathUtils.lerp(
        heatMat.opacity,
        Math.min(0.85, flightFactor * Math.abs(speed) * 0.022 + (boosting ? 0.3 : 0)),
        1 - Math.exp(-5 * dt)
      );
      heatGlow.scale.setScalar(7.5 + flightFactor * 4.5 + Math.sin(exhaustTime * 31) * 0.5);

      carVel.copy(root.position).sub(prevPos).divideScalar(Math.max(dt, 0.001));
      prevPos.copy(root.position);

      root.updateMatrixWorld();
      emitA.set(-1.05, 0.32, 3.55).applyMatrix4(root.matrixWorld);
      emitB.set(1.05, 0.32, 3.55).applyMatrix4(root.matrixWorld);

      for (let i = 0; i < P_COUNT; i++) {
        const i3 = i * 3;
        if (pLife[i] > 0) {
          pLife[i] -= dt;
          pVel[i3 + 1] -= 7.5 * dt;
          const drag = 1 - Math.min(0.9, 1.1 * dt);
          pVel[i3] *= drag;
          pVel[i3 + 1] *= drag;
          pVel[i3 + 2] *= drag;
          pPos[i3] += pVel[i3] * dt;
          pPos[i3 + 1] += pVel[i3 + 1] * dt;
          pPos[i3 + 2] += pVel[i3 + 2] * dt;
          const heat = Math.max(0, pLife[i] / pLifeMax[i]);
          pCol[i3] = 0.15 + 2.4 * heat;
          pCol[i3 + 1] = 0.12 + 1.35 * heat * heat;
          pCol[i3 + 2] = 0.05 + 0.5 * heat * heat * heat;
        } else {
          pCol[i3] = pCol[i3 + 1] = pCol[i3 + 2] = 0;
          if (emitting && Math.random() < (0.55 + flightFactor * 0.45)) {
            const e = i % 2 === 0 ? emitA : emitB;
            pPos[i3] = e.x + (Math.random() - 0.5) * 0.35;
            pPos[i3 + 1] = e.y + (Math.random() - 0.5) * 0.25;
            pPos[i3 + 2] = e.z + (Math.random() - 0.5) * 0.35;
            pVel[i3] = -carVel.x * 0.45 + (Math.random() - 0.5) * 5.5;
            pVel[i3 + 1] = -carVel.y * 0.45 - (2.5 + Math.random() * 5.5);
            pVel[i3 + 2] = -carVel.z * 0.45 + (Math.random() - 0.5) * 5.5;
            pLifeMax[i] = pLife[i] = 0.45 + Math.random() * 0.8;
          }
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    },
  };
}
