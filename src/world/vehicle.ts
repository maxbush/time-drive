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

  const headSpot = new THREE.SpotLight('#fff0d4', 18, 42, Math.PI / 4.8, 0.65, 1.5);
  headSpot.position.set(0, 1.15, -3.7);
  headSpot.target.position.set(0, 0.0, -24.0);
  root.add(headSpot);
  root.add(headSpot.target);

  const loader = new GLTFLoader();
  const loadedModels = new Map<CarModelId, THREE.Group>();
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

      headSpot.target.updateMatrixWorld();
    },
  };
}
