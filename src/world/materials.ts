import * as THREE from 'three';
import { TextureLibrary } from './textures';

export interface MaterialPalette {
  asphalt: THREE.MeshStandardMaterial;
  roadPaintWhite: THREE.MeshStandardMaterial;
  roadPaintAmber: THREE.MeshStandardMaterial;
  sidewalkPaver: THREE.MeshStandardMaterial;
  basaltStrip: THREE.MeshStandardMaterial;
  curbGranite: THREE.MeshStandardMaterial;
  limestone: THREE.MeshStandardMaterial;
  paleLimestone: THREE.MeshStandardMaterial;
  warmStone: THREE.MeshStandardMaterial;
  darkBrick: THREE.MeshStandardMaterial;
  warmBrick: THREE.MeshStandardMaterial;
  flutedConcrete: THREE.MeshStandardMaterial;
  archConcrete: THREE.MeshStandardMaterial;
  lightConcrete: THREE.MeshStandardMaterial;
  ivoryCeramic: THREE.MeshStandardMaterial;
  silverMetal: THREE.MeshStandardMaterial;
  plazaStone: THREE.MeshStandardMaterial;
  darkBronze: THREE.MeshStandardMaterial;
  champagneMetal: THREE.MeshStandardMaterial;
  blackSteel: THREE.MeshStandardMaterial;
  patinatedCopper: THREE.MeshStandardMaterial;
  warmTimber: THREE.MeshStandardMaterial;
  interiorPlasterWarm: THREE.MeshStandardMaterial;
  interiorFloorStone: THREE.MeshStandardMaterial;
  interiorCoreGlow: THREE.MeshStandardMaterial;
  storefrontGlass: THREE.MeshPhysicalMaterial;
  skybridgeGlass: THREE.MeshPhysicalMaterial;
  tintedGlass: THREE.MeshPhysicalMaterial;
  tintedGlassMirror: THREE.MeshPhysicalMaterial;
  tintedGlassBronze: THREE.MeshPhysicalMaterial;
  confluenceGlass: THREE.MeshStandardMaterial;
  grassTurf: THREE.MeshStandardMaterial;
  upperWindowInterior: THREE.ShaderMaterial;
  emissiveWarmSoft: THREE.MeshStandardMaterial;
  emissiveWarmBright: THREE.MeshStandardMaterial;
  emissiveCoolWhite: THREE.MeshStandardMaterial;
  emissiveAmberAccent: THREE.MeshStandardMaterial;
  emissiveCyanAccent: THREE.MeshStandardMaterial;
  hdrWarmGlow: THREE.MeshBasicMaterial;
  hdrCyanGlow: THREE.MeshBasicMaterial;
  manholeMat: THREE.MeshStandardMaterial;
  drainGrateMat: THREE.MeshStandardMaterial;
  haloSpriteMat: THREE.SpriteMaterial;
  updateUniforms: (time: number) => void;
  setReflectionData: (tex: THREE.Texture, matrix: THREE.Matrix4) => void;
  setEnvCubemap: (cubeTex: THREE.CubeTexture) => void;
}

export function createMaterialPalette(
  texLib: TextureLibrary,
  opts: { mobile?: boolean } = {}
): MaterialPalette {
  const reflectionUniforms = {
    uReflectionMap: { value: null as THREE.Texture | null },
    uReflectMatrix: { value: new THREE.Matrix4() },
    uHasReflection: { value: 0.0 },
    uTime: { value: 0.0 },
  };

  // Rich dark damp basalt-asphalt that stays deep in tone while reflecting glowing buildings & arches vividly
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#a8aba8'),
    map: texLib.asphalt.map,
    normalMap: texLib.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: texLib.asphalt.roughnessMap,
    roughness: 0.92,
    metalness: 0.06,
    envMapIntensity: 1.05,
  });

  asphaltMat.onBeforeCompile = (shader) => {
    shader.uniforms.uReflectionMap = reflectionUniforms.uReflectionMap;
    shader.uniforms.uReflectMatrix = reflectionUniforms.uReflectMatrix;
    shader.uniforms.uHasReflection = reflectionUniforms.uHasReflection;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform mat4 uReflectMatrix;
        varying vec4 vReflectCoord;
        varying vec3 vRoadWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 roadWp = modelMatrix * vec4(transformed, 1.0);
        vRoadWorldPos = roadWp.xyz;
        vReflectCoord = uReflectMatrix * roadWp;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uReflectionMap;
        uniform float uHasReflection;
        varying vec4 vReflectCoord;
        varying vec3 vRoadWorldPos;`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uHasReflection > 0.5 && vReflectCoord.w > 0.0) {
          vec2 projUv = vReflectCoord.xy / vReflectCoord.w;
          if (projUv.x > 0.002 && projUv.x < 0.998 && projUv.y > 0.002 && projUv.y < 0.998) {
            vec3 viewDirW = normalize(cameraPosition - vRoadWorldPos);
            float ndotv = clamp(dot(vec3(0.0, 1.0, 0.0), viewDirW), 0.0, 1.0);
            float fresnel = 0.08 + 0.52 * pow(1.0 - ndotv, 2.8);
            float wetness = clamp((0.74 - roughnessFactor) / 0.55, 0.0, 1.0);

            vec2 nDistort = (normal.xz) * (0.016 + roughnessFactor * 0.032);
            float spreadX = 0.0022 + roughnessFactor * 0.011;
            float spreadY = 0.0055 + roughnessFactor * 0.026;

            vec3 refl = vec3(0.0);
            refl += texture2D(uReflectionMap, clamp(projUv + nDistort, 0.003, 0.997)).rgb * 0.36;
            refl += texture2D(uReflectionMap, clamp(projUv + nDistort + vec2(spreadX, spreadY), 0.003, 0.997)).rgb * 0.16;
            refl += texture2D(uReflectionMap, clamp(projUv + nDistort + vec2(-spreadX, spreadY), 0.003, 0.997)).rgb * 0.16;
            refl += texture2D(uReflectionMap, clamp(projUv + nDistort + vec2(spreadX * 0.6, -spreadY), 0.003, 0.997)).rgb * 0.16;
            refl += texture2D(uReflectionMap, clamp(projUv + nDistort + vec2(-spreadX * 0.6, -spreadY), 0.003, 0.997)).rgb * 0.16;

            float reflWeight = clamp(fresnel * (0.35 + 0.95 * wetness), 0.0, 0.54);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, refl * 1.25, reflWeight);
          }
        }
        #include <dithering_fragment>`
      );
  };

  const roadPaintWhite = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cfd6e2'),
    roughness: 0.58,
    metalness: 0.04,
    normalMap: texLib.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const roadPaintAmber = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cf9840'),
    roughness: 0.58,
    metalness: 0.05,
    normalMap: texLib.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const sidewalkPaver = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#989ea8'),
    map: texLib.sidewalk.map,
    normalMap: texLib.sidewalk.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: texLib.sidewalk.roughnessMap,
    roughness: 0.78,
    metalness: 0.05,
    envMapIntensity: 0.82,
  });

  const basaltStrip = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#747b87'),
    map: texLib.basaltStrip.map,
    normalMap: texLib.basaltStrip.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: texLib.basaltStrip.roughnessMap,
    roughness: 0.74,
    metalness: 0.07,
    envMapIntensity: 0.85,
  });

  const curbGranite = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9fa4b0'),
    map: texLib.curbGranite.map,
    normalMap: texLib.curbGranite.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: texLib.curbGranite.roughnessMap,
    roughness: 0.72,
    metalness: 0.07,
  });

  const limestone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dcd5c8'),
    map: texLib.limestone.map,
    normalMap: texLib.limestone.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: texLib.limestone.roughnessMap,
    roughness: 0.8,
    metalness: 0.04,
    envMapIntensity: 0.88,
  });

  const paleLimestone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ede8de'),
    map: texLib.limestone.map,
    normalMap: texLib.limestone.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: texLib.limestone.roughnessMap,
    roughness: 0.74,
    metalness: 0.05,
    envMapIntensity: 0.94,
  });

  const warmStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ceb6a2'),
    map: texLib.warmStone.map,
    normalMap: texLib.warmStone.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: texLib.warmStone.roughnessMap,
    roughness: 0.8,
    metalness: 0.04,
    envMapIntensity: 0.86,
  });

  const darkBrick = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b0948a'),
    map: texLib.darkBrick.map,
    normalMap: texLib.darkBrick.normalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: texLib.darkBrick.roughnessMap,
    roughness: 0.86,
    metalness: 0.04,
    envMapIntensity: 0.72,
  });

  const warmBrick = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cfa08e'),
    map: texLib.warmBrick.map,
    normalMap: texLib.warmBrick.normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: texLib.warmBrick.roughnessMap,
    roughness: 0.84,
    metalness: 0.04,
    envMapIntensity: 0.75,
  });

  const flutedConcrete = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#a6aeb9'),
    map: texLib.flutedConcrete.map,
    normalMap: texLib.flutedConcrete.normalMap,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: texLib.flutedConcrete.roughnessMap,
    roughness: 0.74,
    metalness: 0.08,
    envMapIntensity: 0.9,
  });

  const archConcrete = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b6bcc6'),
    map: texLib.architecturalConcrete.map,
    normalMap: texLib.architecturalConcrete.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: texLib.architecturalConcrete.roughnessMap,
    roughness: 0.76,
    metalness: 0.06,
    envMapIntensity: 0.86,
  });

  const lightConcrete = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6dfd2'),
    map: texLib.lightFormworkConcrete,
    bumpMap: texLib.lightFormworkConcrete,
    bumpScale: 0.06,
    roughness: 0.8,
    metalness: 0.04,
    envMapIntensity: 0.9,
  });

  const ivoryCeramic = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f0eadc'),
    roughness: 0.38,
    metalness: 0.12,
    envMapIntensity: 1.05,
  });

  const silverMetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8d4ca'),
    roughness: 0.28,
    metalness: 0.84,
    envMapIntensity: 1.35,
  });

  const plazaStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8c0b2'),
    map: texLib.plazaRingTex,
    roughness: 0.72,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const darkBronze = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6c5a4b'),
    map: texLib.brushedBronze,
    roughness: 0.28,
    metalness: 0.86,
    envMapIntensity: 1.45,
  });

  const champagneMetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d0ba9a'),
    roughness: 0.24,
    metalness: 0.88,
    envMapIntensity: 1.55,
  });

  const blackSteel = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#252b35'),
    roughness: 0.32,
    metalness: 0.85,
    envMapIntensity: 1.3,
  });

  const patinatedCopper = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#567d79'),
    roughness: 0.44,
    metalness: 0.55,
    envMapIntensity: 1.1,
  });

  const warmTimber = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#a26a42'),
    roughness: 0.48,
    metalness: 0.06,
    envMapIntensity: 0.85,
  });

  const interiorPlasterWarm = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e2d2be'),
    map: texLib.limestone.map,
    normalMap: texLib.limestone.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    emissive: new THREE.Color('#ffb86c'),
    emissiveIntensity: 0.32,
    roughness: 0.72,
    metalness: 0.02,
  });

  const interiorFloorStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#807264'),
    map: texLib.sidewalk.map,
    normalMap: texLib.sidewalk.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    emissive: new THREE.Color('#df9b56'),
    emissiveIntensity: 0.18,
    roughness: 0.36,
    metalness: 0.1,
  });

  // Softly glowing warm architectural core inside the tinted rounded-corner buildings
  // so light shines gently from within while hiding that the building interior is simple geometry!
  const interiorCoreGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c2219'),
    emissive: new THREE.Color('#e89b4e'),
    emissiveIntensity: 0.52,
    roughness: 0.55,
    metalness: 0.1,
  });

  // Clearer glass for Kestrel Atrium & Skybridge passage so circular chandeliers inside are visible
  const storefrontGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#a8c4de'),
    roughness: 0.04,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    reflectivity: 0.94,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.9,
    depthWrite: false,
  });

  // Transparent Skybridge passage glass (as Max requested: "проход между ними можно оставить прозрачный")
  const skybridgeGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#94b8d8'),
    roughness: 0.05,
    metalness: 0.14,
    transparent: true,
    opacity: 0.32,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.95,
    depthWrite: false,
  });

  // 1. Dark smoky obsidian-sapphire tinted glass
  const tintedGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#08101c'),
    roughness: 0.05,
    metalness: 0.65,
    transparent: true,
    opacity: 0.82,
    reflectivity: 0.96,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.1,
    depthWrite: false,
  });

  // 2. Mirror silver-blue architectural curtain-wall glass
  const tintedGlassMirror = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1c314a'),
    roughness: 0.03,
    metalness: 0.92,
    transparent: true,
    opacity: 0.88,
    reflectivity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.6,
    depthWrite: false,
  });

  // 3. Warm bronze-champagne mirror architectural glass
  const tintedGlassBronze = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2a2017'),
    roughness: 0.04,
    metalness: 0.88,
    transparent: true,
    opacity: 0.85,
    reflectivity: 0.98,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.4,
    depthWrite: false,
  });

  // 4. Exact Solid Dark Emerald-Teal Architectural Glass from Confluence reference screenshots!
  //    (Opaque, deep metallic-slate finish so rounded buildings & pavilions look 100% solid and architectural)
  const confluenceGlass = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d3331'),
    metalness: 0.58,
    roughness: 0.18,
    envMapIntensity: 1.55,
  });

  // 5. Lush Parkland & Promenade Planter Grass Turf
  const grassTurf = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a6e4d'),
    map: texLib.grassTurf.map,
    normalMap: texLib.grassTurf.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.88,
    metalness: 0.02,
  });

  const upperWindowInterior = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uEnvMap: { value: null },
        uHasEnv: { value: 0.0 },
        uTime: { value: 0.0 },
      },
    ]),
    fog: true,
    // Phones: skip the interior-mapping ray cast (windows are a few pixels there
    // anyway) and shade each pane with a cheap lit/unlit gradient instead.
    defines: opts.mobile ? { MOBILE_WINDOWS: '' } : {},
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 aTangent;
      attribute vec3 aRoomMeta;
      attribute float aBlindDrop;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangent;
      varying vec3 vRoomMeta;
      varying float vBlindDrop;

      void main() {
        vUv = uv;
        vRoomMeta = aRoomMeta;
        vBlindDrop = aBlindDrop;

        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldTangent = normalize(mat3(modelMatrix) * aTangent);

        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>

      uniform samplerCube uEnvMap;
      uniform float uHasEnv;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldTangent;
      varying vec3 vRoomMeta;
      varying float vBlindDrop;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      void main() {
#ifdef MOBILE_WINDOWS
        {
          float lit = vRoomMeta.y;
          float warmth = vRoomMeta.z;
          vec3 warmC = mix(vec3(1.0, 0.72, 0.42), vec3(0.95, 0.89, 0.78), warmth);
          vec3 unlit = vec3(0.045, 0.075, 0.125);
          float wash = 0.62 + 0.38 * smoothstep(0.0, 1.0, vUv.y); // ceiling-wash feel
          vec3 roomC = mix(unlit, warmC * (0.40 + 0.28 * hash11(vRoomMeta.x + 4.1)) * wash, clamp(lit, 0.0, 1.2));
          if (vBlindDrop > 0.02 && vUv.y > (1.0 - vBlindDrop)) roomC *= 0.35;
          float edge = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x))
                     * smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y));
          roomC *= 0.7 + 0.3 * edge;
          vec3 Vm = normalize(vWorldPos - cameraPosition);
          float ndv = clamp(dot(-Vm, normalize(vWorldNormal)), 0.0, 1.0);
          float fres = 0.08 + 0.6 * pow(1.0 - ndv, 4.0);
          vec3 col = mix(roomC, vec3(0.115, 0.195, 0.345), clamp(fres * mix(0.95, 0.4, clamp(lit, 0.0, 1.0)), 0.06, 0.7));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
          return;
        }
#endif
        vec3 N = normalize(vWorldNormal);
        vec3 T = normalize(vWorldTangent);
        vec3 B = normalize(cross(N, T));

        vec3 V = normalize(vWorldPos - cameraPosition);

        vec3 dLocal = vec3(dot(V, T), dot(V, B), dot(V, -N));
        dLocal.z = max(dLocal.z, 0.08);

        float roomDepth = 0.78;
        vec3 p0 = vec3(clamp(vUv.x, 0.001, 0.999), clamp(vUv.y, 0.001, 0.999), 0.0);

        float tx = ((dLocal.x >= 0.0 ? 1.0 : 0.0) - p0.x) / (abs(dLocal.x) < 1e-4 ? (dLocal.x >= 0.0 ? 1e-4 : -1e-4) : dLocal.x);
        float ty = ((dLocal.y >= 0.0 ? 1.0 : 0.0) - p0.y) / (abs(dLocal.y) < 1e-4 ? (dLocal.y >= 0.0 ? 1e-4 : -1e-4) : dLocal.y);
        float tz = roomDepth / dLocal.z;

        float tHit = min(min(tx, ty), tz);
        vec3 hit = p0 + dLocal * tHit;

        float seed = vRoomMeta.x;
        float lit = vRoomMeta.y;
        float warmth = vRoomMeta.z;

        vec3 warmColor = mix(vec3(1.0, 0.72, 0.42), vec3(0.95, 0.89, 0.78), warmth);
        vec3 unlitAmbient = vec3(0.045, 0.075, 0.125);

        vec3 roomCol = unlitAmbient;

        bool hitCeiling = (tHit == ty && dLocal.y > 0.0);
        bool hitFloor = (tHit == ty && dLocal.y < 0.0);
        bool hitBack = (tHit == tz);

        float stylePick = fract(seed * 3.17);
        float fixtureGlow = 0.0;
        if (hitCeiling) {
          if (stylePick < 0.45) {
            float strip = (1.0 - smoothstep(0.02, 0.09, abs(hit.x - 0.5))) * (1.0 - smoothstep(0.48, 0.65, abs(hit.z - roomDepth * 0.48)));
            fixtureGlow = strip * 1.55;
          } else {
            float d1 = length(vec2(hit.x - 0.32, hit.z - roomDepth * 0.45));
            float d2 = length(vec2(hit.x - 0.68, hit.z - roomDepth * 0.45));
            fixtureGlow = ((1.0 - smoothstep(0.03, 0.11, d1)) + (1.0 - smoothstep(0.03, 0.11, d2))) * 1.45;
          }
          float ceilFalloff = 1.0 - 0.42 * (hit.z / roomDepth);
          roomCol = mix(unlitAmbient * 0.85, warmColor * (0.30 + fixtureGlow * 0.62) * ceilFalloff, clamp(lit, 0.0, 1.2));
        } else if (hitBack) {
          float upperWash = smoothstep(0.05, 0.95, hit.y) * (0.55 + 0.45 * (1.0 - abs(hit.x - 0.5) * 1.3));
          vec3 wallTint = mix(vec3(0.76, 0.68, 0.58), vec3(0.58, 0.61, 0.66), hash11(seed + 4.1));

          float artFrame = step(0.24, hit.x) * step(hit.x, 0.76) * step(0.38, hit.y) * step(hit.y, 0.76);
          if (stylePick > 0.55) {
            float shelves = step(0.65, fract(hit.y * 5.0)) * step(0.15, hit.x) * step(hit.x, 0.85);
            wallTint *= mix(1.0, 0.48, shelves * 0.75);
          } else {
            wallTint *= mix(1.0, 0.68, artFrame * 0.65);
          }
          float furniture = step(hit.y, 0.27);
          wallTint *= mix(1.0, 0.34, furniture);

          float lampPos = 0.25 + 0.5 * hash11(seed + 9.2);
          float lampHalo = exp(-length(vec2(hit.x - lampPos, hit.y - 0.46)) * 5.0) * 0.68;

          vec3 litWall = wallTint * warmColor * (0.30 + 0.58 * upperWash + lampHalo * 0.58);
          roomCol = mix(unlitAmbient, litWall * lit, clamp(lit, 0.0, 1.25));
        } else if (hitFloor) {
          vec3 floorCol = warmColor * 0.28 * (1.0 - 0.4 * (hit.z / roomDepth));
          roomCol = mix(unlitAmbient * 0.6, floorCol * lit, clamp(lit, 0.0, 1.2));
        } else {
          float cone = smoothstep(0.12, 0.92, hit.y) * (1.0 - 0.32 * (hit.z / roomDepth));
          vec3 sideCol = warmColor * (0.24 + 0.50 * cone);
          roomCol = mix(unlitAmbient * 0.85, sideCol * lit, clamp(lit, 0.0, 1.2));
        }

        if (vBlindDrop > 0.02 && vUv.y > (1.0 - vBlindDrop)) {
          float slats = 0.62 + 0.38 * sin(vUv.y * 95.0);
          vec3 blindCol = mix(vec3(0.06, 0.08, 0.12), warmColor * 0.58 * lit, clamp(lit, 0.0, 1.0));
          roomCol = mix(roomCol * 0.22, blindCol * slats, 0.84);
        }

        float paneEdge = smoothstep(0.0, 0.045, vUv.x) * (1.0 - smoothstep(0.955, 1.0, vUv.x))
                       * smoothstep(0.0, 0.045, vUv.y) * (1.0 - smoothstep(0.955, 1.0, vUv.y));
        roomCol *= (0.68 + 0.32 * paneEdge);

        vec3 reflDir = reflect(V, N);
        reflDir = normalize(reflDir + vec3(
          sin(vWorldPos.y * 0.45 + seed) * 0.018,
          cos(vWorldPos.x * 0.35 + vWorldPos.z * 0.35) * 0.015,
          0.0
        ));

        vec3 envCol = vec3(0.10, 0.17, 0.30);
        if (uHasEnv > 0.5) {
          envCol = textureCube(uEnvMap, reflDir).rgb;
        }

        float ndotv = clamp(dot(-V, N), 0.0, 1.0);
        float fresnel = 0.08 + 0.78 * pow(1.0 - ndotv, 4.2);
        float reflMix = clamp(fresnel * mix(0.95, 0.40, clamp(lit, 0.0, 1.0)), 0.06, 0.88);

        vec3 finalColor = mix(roomCol, envCol * 1.15, reflMix);

        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const emissiveWarmSoft = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff2de'),
    emissive: new THREE.Color('#ffbe73'),
    emissiveIntensity: 1.25,
    roughness: 0.25,
  });

  const emissiveWarmBright = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff8ed'),
    emissive: new THREE.Color('#ffb963'),
    emissiveIntensity: 2.1,
    roughness: 0.15,
  });

  const emissiveCoolWhite = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f2f7ff'),
    emissive: new THREE.Color('#dce9ff'),
    emissiveIntensity: 1.9,
    roughness: 0.15,
  });

  const emissiveAmberAccent = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffe5bd'),
    emissive: new THREE.Color('#ffa03b'),
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  const emissiveCyanAccent = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e0f7ff'),
    emissive: new THREE.Color('#38bdf8'),
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  // Balanced HDR glow materials (glows in bloom without blinding the road)
  const hdrWarmGlow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.75, 1.12, 0.54),
    fog: true,
    toneMapped: true,
  });

  const hdrCyanGlow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.55, 1.45, 2.05),
    fog: true,
    toneMapped: true,
  });

  const manholeMat = new THREE.MeshStandardMaterial({
    map: texLib.manholeMap,
    transparent: true,
    roughness: 0.44,
    metalness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });

  const drainGrateMat = new THREE.MeshStandardMaterial({
    map: texLib.drainGrateMap,
    roughness: 0.42,
    metalness: 0.76,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });

  const haloSpriteMat = new THREE.SpriteMaterial({
    map: texLib.haloCoronaMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.65,
  });

  return {
    asphalt: asphaltMat,
    roadPaintWhite,
    roadPaintAmber,
    sidewalkPaver,
    basaltStrip,
    curbGranite,
    limestone,
    paleLimestone,
    warmStone,
    darkBrick,
    warmBrick,
    flutedConcrete,
    archConcrete,
    lightConcrete,
    ivoryCeramic,
    silverMetal,
    plazaStone,
    darkBronze,
    champagneMetal,
    blackSteel,
    patinatedCopper,
    warmTimber,
    interiorPlasterWarm,
    interiorFloorStone,
    interiorCoreGlow,
    storefrontGlass,
    skybridgeGlass,
    tintedGlass,
    tintedGlassMirror,
    tintedGlassBronze,
    confluenceGlass,
    grassTurf,
    upperWindowInterior,
    emissiveWarmSoft,
    emissiveWarmBright,
    emissiveCoolWhite,
    emissiveAmberAccent,
    emissiveCyanAccent,
    hdrWarmGlow,
    hdrCyanGlow,
    manholeMat,
    drainGrateMat,
    haloSpriteMat,
    updateUniforms: (time: number) => {
      reflectionUniforms.uTime.value = time;
      upperWindowInterior.uniforms.uTime.value = time;
    },
    setReflectionData: (tex: THREE.Texture, matrix: THREE.Matrix4) => {
      reflectionUniforms.uReflectionMap.value = tex;
      reflectionUniforms.uReflectMatrix.value.copy(matrix);
      reflectionUniforms.uHasReflection.value = 1.0;
    },
    setEnvCubemap: (cubeTex: THREE.CubeTexture) => {
      upperWindowInterior.uniforms.uEnvMap.value = cubeTex;
      upperWindowInterior.uniforms.uHasEnv.value = 1.0;
    },
  };
}
