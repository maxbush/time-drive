import * as THREE from 'three';
import { mulberry32 } from './textures';
import { MaterialPalette } from './materials';

const _lightDir = new THREE.Vector3();
const _lightRight = new THREE.Vector3();
const _lightUp = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export interface EnvironmentSystem {
  skyMesh: THREE.Mesh;
  distantSkylineGroup: THREE.Group;
  beaconMaterials: THREE.MeshBasicMaterial[];
  setMoodShift: (factor: number) => void;
  update: (time: number, focusPos: THREE.Vector3) => void;
}

function createSkyShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunAzimuthDir: { value: new THREE.Vector3(-0.34, 0.04, -0.94).normalize() },
      uTime: { value: 0 },
      uDuskDepth: { value: 0.25 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunAzimuthDir;
      uniform float uTime;
      uniform float uDuskDepth;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float elev = clamp(dir.y, -0.15, 1.0);
        float h = clamp(elev, 0.0, 1.0);

        vec3 zenithCol = mix(vec3(0.014, 0.034, 0.092), vec3(0.005, 0.012, 0.038), uDuskDepth);
        vec3 midSkyCol = mix(vec3(0.046, 0.108, 0.248), vec3(0.018, 0.048, 0.132), uDuskDepth);
        vec3 lowSkyCol = mix(vec3(0.098, 0.185, 0.355), vec3(0.042, 0.095, 0.205), uDuskDepth);

        vec3 sky = mix(lowSkyCol, midSkyCol, smoothstep(0.0, 0.28, h));
        sky = mix(sky, zenithCol, smoothstep(0.24, 0.84, h));

        float sunAlign = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(uSunAzimuthDir.x, 0.0, uSunAzimuthDir.z))), 0.0);
        float horizonBand = exp(-max(h, 0.0) * 12.5);
        float broadGlow = pow(sunAlign, 2.4) * exp(-max(h, 0.0) * 6.8);
        float coreAfterglow = pow(sunAlign, 5.8) * horizonBand;

        vec3 duskRose = vec3(0.42, 0.25, 0.34);
        vec3 duskAmber = vec3(0.78, 0.42, 0.24);
        float glowScale = mix(1.0, 0.45, uDuskDepth);

        sky += duskRose * broadGlow * 0.32 * glowScale;
        sky += duskAmber * coreAfterglow * 0.45 * glowScale;

        if (dir.y > 0.03) {
          vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.0022, -uTime * 0.0011);
          float c1 = noise2(cloudUv * vec2(2.2, 6.5));
          float c2 = noise2(cloudUv * vec2(5.5, 13.0) + 3.1);
          float cirrus = smoothstep(0.54, 0.86, c1 * 0.68 + c2 * 0.32) * smoothstep(0.03, 0.22, dir.y) * smoothstep(0.75, 0.25, dir.y);
          vec3 cirrusTint = mix(vec3(0.16, 0.25, 0.42), vec3(0.68, 0.46, 0.38), pow(sunAlign, 2.0) * (1.0 - dir.y));
          sky = mix(sky, cirrusTint, cirrus * 0.34 * glowScale);
        }

        if (dir.y > 0.25) {
          vec2 starGrid = floor(dir.xz * 280.0 + dir.y * 95.0);
          float starSeed = hash21(starGrid);
          if (starSeed > 0.996) {
            float twinkle = 0.72 + 0.28 * sin(uTime * 2.1 + starSeed * 80.0);
            sky += vec3(0.8, 0.88, 1.0) * smoothstep(0.25, 0.72, dir.y) * (0.42 + uDuskDepth * 0.38) * twinkle;
          }
        }

        if (dir.y < 0.0) {
          vec3 cityBounce = mix(vec3(0.12, 0.10, 0.09), vec3(0.03, 0.05, 0.09), clamp(-dir.y * 4.0, 0.0, 1.0));
          sky = mix(sky, cityBounce, smoothstep(0.0, -0.12, dir.y));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}

function buildDistantSkyline(): { group: THREE.Group; beaconMaterials: THREE.MeshBasicMaterial[] } {
  const group = new THREE.Group();
  const rng = mulberry32(314159);

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0c1528';
  ctx.fillRect(0, 0, 256, 512);

  for (let row = 4; row < 62; row++) {
    const floorLitProb = 0.24 + 0.28 * Math.sin(row * 1.7);
    for (let col = 1; col < 15; col++) {
      if (rng() < floorLitProb) {
        const warm = rng();
        const r = Math.round(215 + warm * 40);
        const g = Math.round(165 + warm * 55);
        const b = Math.round(115 + (1 - warm) * 85);
        const alpha = 0.3 + rng() * 0.65;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(col * 16 + 2, row * 8 + 2, 11, 4);
      } else {
        ctx.fillStyle = 'rgba(26, 46, 78, 0.45)';
        ctx.fillRect(col * 16 + 2, row * 8 + 2, 11, 4);
      }
    }
  }

  const skylineTex = new THREE.CanvasTexture(c);
  skylineTex.wrapS = THREE.RepeatWrapping;
  skylineTex.wrapT = THREE.RepeatWrapping;
  skylineTex.colorSpace = THREE.SRGBColorSpace;

  const towerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#16243d'),
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: skylineTex,
    emissiveIntensity: 0.85,
    roughness: 0.4,
    metalness: 0.45,
  });

  const crownGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.5, 1.1, 0.65),
  });

  const beaconMatA = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2e38') });
  const beaconMatB = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2e38') });

  const towerSpecs: Array<{ x: number; z: number; w: number; d: number; h: number; crown?: boolean }> = [
    { x: -245, z: 210, w: 34, d: 30, h: 112, crown: true },
    { x: -275, z: 95, w: 30, d: 28, h: 94 },
    { x: -260, z: -20, w: 36, d: 32, h: 128, crown: true },
    { x: -290, z: -140, w: 32, d: 28, h: 102 },
    { x: -275, z: -380, w: 34, d: 30, h: 118, crown: true },
    { x: 245, z: 220, w: 32, d: 28, h: 108, crown: true },
    { x: 270, z: 110, w: 36, d: 30, h: 122, crown: true },
    { x: 255, z: -15, w: 30, d: 28, h: 92 },
    { x: 280, z: -155, w: 34, d: 32, h: 116, crown: true },
    { x: 265, z: -310, w: 32, d: 28, h: 98 },
    { x: -55, z: 440, w: 34, d: 30, h: 104, crown: true },
    { x: 55, z: 455, w: 32, d: 28, h: 96, crown: true },
  ];

  const beaconGeo = new THREE.SphereGeometry(0.55, 8, 8);

  towerSpecs.forEach((spec, idx) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(spec.x, 0, spec.z);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), towerMat);
    shaft.position.y = spec.h * 0.5;
    tGroup.add(shaft);

    const tierH = spec.h * 0.24;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.72, tierH, spec.d * 0.72), towerMat);
    tier.position.y = spec.h + tierH * 0.5;
    tGroup.add(tier);

    if (spec.crown) {
      const crownRim = new THREE.Mesh(
        new THREE.BoxGeometry(spec.w * 0.74, 0.9, spec.d * 0.74),
        crownGlowMat
      );
      crownRim.position.y = spec.h + tierH + 0.45;
      tGroup.add(crownRim);

      const spireH = 18 + (idx % 3) * 6;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.7, spireH, 6), towerMat);
      spire.position.y = spec.h + tierH + spireH * 0.5;
      tGroup.add(spire);

      const beacon = new THREE.Mesh(beaconGeo, idx % 2 === 0 ? beaconMatA : beaconMatB);
      beacon.position.y = spec.h + tierH + spireH + 0.5;
      tGroup.add(beacon);
    }

    group.add(tGroup);
  });

  return { group, beaconMaterials: [beaconMatA, beaconMatB] };
}

export function createEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  materials: MaterialPalette
): EnvironmentSystem {
  scene.fog = new THREE.FogExp2('#0d182e', 0.00115);

  const skyMat = createSkyShaderMaterial();
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1600, 40, 28), skyMat);
  scene.add(skyMesh);

  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), skyMat.clone());
  envScene.add(envSky);

  const warmRibbonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffaa58') });
  const coolRibbonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#527ec2') });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const dist = 42;
    const h = 4.0 + (i % 4) * 2.2;
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, h, 1.2),
      i % 3 === 0 ? coolRibbonMat : warmRibbonMat
    );
    card.position.set(Math.cos(ang) * dist, h * 0.5 - 1.0, Math.sin(ang) * dist);
    card.lookAt(0, 0, 0);
    envScene.add(card);
  }

  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(0.5, 220, cubeRT);
  cubeCam.update(renderer, envScene);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envPMREM = pmrem.fromCubemap(cubeRT.texture);
  scene.environment = envPMREM.texture;
  scene.environmentIntensity = 0.92;
  materials.setEnvCubemap(cubeRT.texture);
  pmrem.dispose();

  // Balanced atmospheric twilight lighting (not over-bright)
  const hemiLight = new THREE.HemisphereLight('#6e97d6', '#3d3026', 0.82);
  scene.add(hemiLight);

  const skyDirLight = new THREE.DirectionalLight('#ffdcb8', 1.42);
  skyDirLight.position.set(55, 68, 45);
  skyDirLight.castShadow = true;
  skyDirLight.shadow.mapSize.set(2048, 2048);
  skyDirLight.shadow.camera.near = 10;
  skyDirLight.shadow.camera.far = 260;
  const shadowSpan = 75;
  skyDirLight.shadow.camera.left = -shadowSpan;
  skyDirLight.shadow.camera.right = shadowSpan;
  skyDirLight.shadow.camera.top = shadowSpan;
  skyDirLight.shadow.camera.bottom = -shadowSpan;
  skyDirLight.shadow.bias = -0.0003;
  skyDirLight.shadow.normalBias = 0.025;
  scene.add(skyDirLight);
  scene.add(skyDirLight.target);

  const duskRimLight = new THREE.DirectionalLight('#7ea8eb', 0.65);
  duskRimLight.position.set(-65, 55, -75);
  scene.add(duskRimLight);

  const { group: distantSkylineGroup, beaconMaterials } = buildDistantSkyline();
  scene.add(distantSkylineGroup);

  return {
    skyMesh,
    distantSkylineGroup,
    beaconMaterials,
    setMoodShift: (factor: number) => {
      const f = Math.max(0, Math.min(1, factor));
      skyMat.uniforms.uDuskDepth.value = f;
      hemiLight.intensity = 0.82 - f * 0.28;
      skyDirLight.intensity = 1.42 - f * 0.65;
      skyDirLight.color.lerpColors(new THREE.Color('#ffdcb8'), new THREE.Color('#8ab0e8'), f);
      duskRimLight.intensity = 0.65 - f * 0.25;
      (scene.fog as THREE.FogExp2).color.lerpColors(new THREE.Color('#0d182e'), new THREE.Color('#060b16'), f);
    },
    update: (time: number, focusPos: THREE.Vector3) => {
      skyMat.uniforms.uTime.value = time;
      skyMesh.position.set(focusPos.x, 0, focusPos.z);

      skyDirLight.target.position.set(focusPos.x, 0, focusPos.z);
      skyDirLight.position.set(focusPos.x + 55, 68, focusPos.z + 45);

      // Snap the shadow camera to shadow-map texel increments so shadows
      // don't shimmer/crawl as the car moves continuously.
      const texel = (shadowSpan * 2) / skyDirLight.shadow.mapSize.x;
      _lightDir.subVectors(skyDirLight.position, skyDirLight.target.position).normalize();
      _lightRight.crossVectors(WORLD_UP, _lightDir).normalize();
      _lightUp.crossVectors(_lightDir, _lightRight).normalize();
      const tp = skyDirLight.target.position;
      const dR = Math.round(tp.dot(_lightRight) / texel) * texel - tp.dot(_lightRight);
      const dU = Math.round(tp.dot(_lightUp) / texel) * texel - tp.dot(_lightUp);
      tp.addScaledVector(_lightRight, dR).addScaledVector(_lightUp, dU);
      skyDirLight.position.addScaledVector(_lightRight, dR).addScaledVector(_lightUp, dU);

      skyDirLight.target.updateMatrixWorld();

      const pulseA = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.2), 3);
      const pulseB = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.2 + 2.1), 3);
      beaconMaterials[0].color.setRGB(pulseA, pulseA * 0.14, pulseA * 0.18);
      beaconMaterials[1].color.setRGB(pulseB, pulseB * 0.14, pulseB * 0.18);
    },
  };
}
