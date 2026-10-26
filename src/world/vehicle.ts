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
    stationSlowdownFactor: number,
    flashBoost?: number
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

  // Dual headlights — asphalt-ref tuning: very wide soft wash, mounted low
  const mkHeadlight = (x: number) => {
    const spot = new THREE.SpotLight('#eef5ff', 18, 48, Math.PI / 6.2, 0.58, 1.25);
    spot.position.set(x, 0.62, -3.55);
    spot.target.position.set(x * 0.85, 0.04, -26);
    root.add(spot);
    root.add(spot.target);
    return spot;
  };
  const headL = mkHeadlight(-0.85);
  const headR = mkHeadlight(0.85);

  // Barely-there volumetric haze cones so beams read in the dusk air
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0.1 } },
    vertexShader: `
      varying vec3 vLocal;
      varying float vFace;
      void main() {
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vLocal;
      varying float vFace;
      void main() {
        float d = clamp(-vLocal.z / 24.0, 0.0, 1.0);
        float prof = smoothstep(0.0, 0.06, d) * pow(1.0 - d, 1.5);
        float a = uOpacity * prof * (0.3 + 0.7 * pow(vFace, 1.3));
        gl_FragColor = vec4(vec3(0.85, 0.92, 1.1) * a, a);
      }
    `,
  });
  const beamGeo = new THREE.CylinderGeometry(1.45, 0.07, 24, 14, 4, true);
  beamGeo.translate(0, -12, 0);
  beamGeo.rotateX(Math.PI / 2); // narrow end at lamp, wide end 24m forward
  const beamL = new THREE.Mesh(beamGeo, beamMat);
  beamL.position.set(-0.85, 1.0, -3.55);
  const beamR = new THREE.Mesh(beamGeo, beamMat);
  beamR.position.set(0.85, 1.0, -3.55);
  beamL.layers.set(1);
  beamR.layers.set(1);
  root.add(beamL, beamR);

  const headGlowL = lampSprite('#ffd9a2', 0.62);
  headGlowL.position.set(-0.85, 0.98, -3.58);
  (headGlowL.material as THREE.SpriteMaterial).opacity = 0.75;
  const headGlowR = lampSprite('#ffd9a2', 0.62);
  headGlowR.position.set(0.85, 0.98, -3.58);
  (headGlowR.material as THREE.SpriteMaterial).opacity = 0.75;
  root.add(headGlowL, headGlowR);

  // Taillights: full-width rear glow + brake dynamics
  const tailMatL = lampSprite('#ff3822', 1.15);
  const tailMatR = lampSprite('#ff3822', 1.15);
  tailMatL.position.set(-0.95, 1.28, 3.62);
  tailMatR.position.set(0.95, 1.28, 3.62);
  root.add(tailMatL, tailMatR);


  // Soft red pool spilled onto the asphalt behind the car (asphalt-ref trick)
  const spillCanvas = document.createElement('canvas');
  spillCanvas.width = 128;
  spillCanvas.height = 128;
  const sctx = spillCanvas.getContext('2d')!;
  const sgrad = sctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  sgrad.addColorStop(0, 'rgba(220, 38, 38, 0.5)');
  sgrad.addColorStop(0.55, 'rgba(220, 38, 38, 0.16)');
  sgrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 128, 128);
  const spillTex = new THREE.CanvasTexture(spillCanvas);
  const rearSpillMat = new THREE.MeshBasicMaterial({
    map: spillTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
  const rearSpill = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), rearSpillMat);
  rearSpill.rotation.x = -Math.PI / 2;
  rearSpill.position.set(0, 0.03, 4.4);
  rearSpill.layers.set(1);
  root.add(rearSpill);

  // 88-MPH blue underglow (bridge-ref) — fades in on flash/boost/launch
  const underglowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.25, 0.6, 2.4),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), underglowMat);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.05;
  underglow.layers.set(1);
  root.add(underglow);

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
  exhaust.layers.set(1);
  scene.add(exhaust);

  // ---- BTTF fire-trail ribbons: two flame ribbons streaming off rear wheels ----
  const TRAIL_N = 56;
  const trailIdx: number[] = [];
  for (let i = 0; i < TRAIL_N - 1; i++) {
    const v = i * 2;
    trailIdx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
  }
  const mkTrail = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
    g.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2), 1));
    g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2), 1));
    g.setIndex(trailIdx);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        attribute float aAge;
        attribute float aEdge;
        varying float vAge;
        varying float vEdge;
        uniform float uTime;
        void main() {
          vAge = aAge;
          vEdge = aEdge;
          vec3 p = position;
          p.y += sin(aAge * 9.0 - uTime * 9.0) * 0.07 * aAge;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAge;
        varying float vEdge;
        void main() {
          float edge = sin(vEdge * 3.14159);
          vec3 col = mix(vec3(3.0, 2.4, 1.2), vec3(2.2, 0.5, 0.08), smoothstep(0.0, 0.45, vAge));
          col = mix(col, vec3(0.4, 0.04, 0.0), smoothstep(0.45, 1.0, vAge));
          float a = uOpacity * edge * pow(1.0 - vAge, 1.25);
          gl_FragColor = vec4(col * a, a);
        }
      `,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.layers.set(1);
    scene.add(mesh);
    return {
      mesh,
      geo: g,
      mat: m,
      pos: new Float32Array(TRAIL_N * 3),
      right: new Float32Array(TRAIL_N * 3),
      count: 0,
    };
  };
  const trailL = mkTrail();
  const trailR = mkTrail();

  const updateTrail = (
    trail: ReturnType<typeof mkTrail>,
    emitter: THREE.Vector3,
    emitting: boolean,
    t: number
  ) => {
    const m = trail.mat;
    const targetOp = emitting ? 0.9 : 0;
    m.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      m.uniforms.uOpacity.value,
      targetOp,
      1 - Math.exp(-8 * t)
    );
    m.uniforms.uTime.value = exhaustTime;
    trail.mesh.visible = m.uniforms.uOpacity.value > 0.02;
    if (!trail.mesh.visible) {
      trail.count = 0;
      return;
    }

    if (emitting) {
      // shift history one slot back, write fresh head point
      if (trail.count > 0) {
        const lx = trail.pos[0] - emitter.x;
        const ly = trail.pos[1] - emitter.y;
        const lz = trail.pos[2] - emitter.z;
        if (lx * lx + ly * ly + lz * lz > 36) trail.count = 0; // trail teleported: reset
      }
      if (trail.count > 0) {
        trail.pos.copyWithin(3, 0, (TRAIL_N - 1) * 3);
        trail.right.copyWithin(3, 0, (TRAIL_N - 1) * 3);
      }
      trail.pos[0] = emitter.x;
      trail.pos[1] = emitter.y;
      trail.pos[2] = emitter.z;
      // car's lateral axis in world space
      trail.right[0] = root.matrixWorld.elements[0];
      trail.right[1] = root.matrixWorld.elements[1];
      trail.right[2] = root.matrixWorld.elements[2];
      trail.count = Math.min(TRAIL_N, trail.count + 1);
    }

    // rebuild strip from history
    const posAttr = trail.geo.attributes.position as THREE.BufferAttribute;
    const ageAttr = trail.geo.attributes.aAge as THREE.BufferAttribute;
    const edgeAttr = trail.geo.attributes.aEdge as THREE.BufferAttribute;
    const n = Math.max(1, trail.count);
    for (let i = 0; i < TRAIL_N; i++) {
      const hi = Math.min(i, n - 1);
      const age = i / (TRAIL_N - 1);
      const w = 0.42 * (1 - age * 0.75);
      const px = trail.pos[hi * 3];
      const py = trail.pos[hi * 3 + 1];
      const pz = trail.pos[hi * 3 + 2];
      const rx = trail.right[hi * 3];
      const ry = trail.right[hi * 3 + 1];
      const rz = trail.right[hi * 3 + 2];
      posAttr.setXYZ(i * 2, px - rx * w, py - ry * w - 0.04, pz - rz * w);
      posAttr.setXYZ(i * 2 + 1, px + rx * w, py + ry * w + 0.04, pz + rz * w);
      ageAttr.setX(i * 2, age);
      ageAttr.setX(i * 2 + 1, age);
      edgeAttr.setX(i * 2, 0);
      edgeAttr.setX(i * 2 + 1, 1);
    }
    posAttr.needsUpdate = true;
    ageAttr.needsUpdate = true;
    edgeAttr.needsUpdate = true;
  };

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
    update: (dt, input, autoCruise, stationSlowdownFactor, flashBoost = 0) => {
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
      rearSpillMat.opacity = 0.35 + brakeGlow * 0.45 + (pitchAngle > 0.05 ? 0.3 : 0);
      prevSpeed = speed;

      // --- Headlight dynamics: subtle boost surge + beam flicker ---------------
      const flicker = input.boost ? Math.sin(exhaustTime * 47) * 3.5 : 0;
      const headI = 30 + Math.min(14, Math.abs(speed) * 0.22) + flicker;
      const flightDim = 1 - THREE.MathUtils.clamp(pitchAngle / 1.2, 0, 1) * 0.85;
      headL.intensity = headI * flightDim;
      headR.intensity = headI * flightDim;
      beamMat.uniforms.uOpacity.value = (0.06 + Math.min(0.07, Math.abs(speed) * 0.0016)) * flightDim;
      (headGlowL.material as THREE.SpriteMaterial).opacity = 0.75 * flightDim;
      (headGlowR.material as THREE.SpriteMaterial).opacity = 0.75 * flightDim;
      headL.target.updateMatrixWorld();
      headR.target.updateMatrixWorld();

      // --- Space-flight dynamics: BTTF fire-trail exhaust ----------------------
      const flightFactor = THREE.MathUtils.clamp(pitchAngle / 1.2, 0, 1);
      const boosting = input.boost && Math.abs(speed) > 28;
      const emitting = flightFactor > 0.02 || boosting || flashBoost > 0.25;

      // 88-MPH underglow breathes with the same emit state
      underglowMat.opacity = THREE.MathUtils.lerp(
        underglowMat.opacity,
        emitting ? 0.55 + Math.sin(exhaustTime * 21) * 0.1 : 0,
        1 - Math.exp(-6 * dt)
      );

      carVel.copy(root.position).sub(prevPos).divideScalar(Math.max(dt, 0.001));
      prevPos.copy(root.position);

      root.updateMatrixWorld();
      emitA.set(-1.05, 0.32, 3.55).applyMatrix4(root.matrixWorld);
      emitB.set(1.05, 0.32, 3.55).applyMatrix4(root.matrixWorld);

      updateTrail(trailL, emitA, emitting, dt);
      updateTrail(trailR, emitB, emitting, dt);

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
