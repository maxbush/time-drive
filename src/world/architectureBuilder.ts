import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MaterialPalette } from './materials';
import { mergeIntoChunks } from './chunkedMerge';
import { createPastRoadSignTexture, createShowcaseScreenTexture, createSignageTexture } from './textures';

export type MatKey =
  | 'limestone'
  | 'paleLimestone'
  | 'warmStone'
  | 'darkBrick'
  | 'warmBrick'
  | 'flutedConcrete'
  | 'archConcrete'
  | 'lightConcrete'
  | 'ivoryCeramic'
  | 'silverMetal'
  | 'plazaStone'
  | 'darkBronze'
  | 'champagneMetal'
  | 'blackSteel'
  | 'patinatedCopper'
  | 'warmTimber'
  | 'interiorPlasterWarm'
  | 'interiorFloorStone'
  | 'interiorCoreGlow'
  | 'emissiveWarmSoft'
  | 'emissiveWarmBright'
  | 'emissiveCoolWhite'
  | 'emissiveAmberAccent'
  | 'emissiveCyanAccent'
  | 'hdrWarmGlow'
  | 'hdrCyanGlow'
  | 'storefrontGlass'
  | 'skybridgeGlass'
  | 'tintedGlass'
  | 'tintedGlassMirror'
  | 'tintedGlassBronze'
  | 'confluenceGlass'
  | 'grassTurf';

export interface LightAnchor {
  position: THREE.Vector3;
  color: number;
  intensity: number;
  distance: number;
}

export interface WindowQuadSpec {
  center: THREE.Vector3;
  rightDir: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  seed: number;
  lit: number;
  warmth: number;
  blindDrop: number;
}

function makeRoundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const rr = Math.min(r, w * 0.48, d * 0.48);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + rr, -d / 2);
  shape.lineTo(w / 2 - rr, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
  shape.lineTo(w / 2, d / 2 - rr);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
  shape.lineTo(-w / 2 + rr, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr);
  shape.lineTo(-w / 2, -d / 2 + rr);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
  return shape;
}

export class ArchitectureBuilder {
  private buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  private windowQuads: WindowQuadSpec[] = [];
  public extraGroup = new THREE.Group();
  public lightAnchors: LightAnchor[] = [];
  private anisotropy: number;

  constructor(anisotropy: number) {
    this.anisotropy = anisotropy;
  }

  public addLightAnchor(x: number, y: number, z: number, color: number, intensity: number, distance: number) {
    this.lightAnchors.push({
      position: new THREE.Vector3(x, y, z),
      color,
      intensity,
      distance,
    });
  }

  public pushGeo(mat: MatKey, geo: THREE.BufferGeometry) {
    const normalized = geo.index ? geo.toNonIndexed() : geo;
    if (geo.index) geo.dispose();

    for (const k of Object.keys(normalized.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') {
        normalized.deleteAttribute(k);
      }
    }

    if (!normalized.attributes.normal) {
      normalized.computeVertexNormals();
    }
    if (!normalized.attributes.uv) {
      const count = normalized.attributes.position.count;
      normalized.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }

    // Weld identical position/normal/uv tuples -> indexed geometry.
    // GPU post-transform vertex cache only works on indexed draws.
    const deduped = mergeVertices(normalized, 1e-4);
    if (deduped !== normalized) normalized.dispose();

    let arr = this.buckets.get(mat);
    if (!arr) {
      arr = [];
      this.buckets.set(mat, arr);
    }
    arr.push(deduped);
  }

  public addBox(
    mat: MatKey,
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    rotY = 0,
    uvScale = 3.2
  ) {
    if (sx <= 0.001 || sy <= 0.001 || sz <= 0.001) return;
    const geo = new THREE.BoxGeometry(sx, sy, sz);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const norm = geo.attributes.normal as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) + cx;
      const py = pos.getY(i) + cy;
      const pz = pos.getZ(i) + cz;
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      if (ny > 0.7) {
        uv.setXY(i, px / uvScale, pz / uvScale);
      } else if (nx > 0.7) {
        uv.setXY(i, pz / uvScale, py / uvScale);
      } else {
        uv.setXY(i, px / uvScale, py / uvScale);
      }
    }

    if (rotY !== 0) {
      geo.rotateY(rotY);
    }
    geo.translate(cx, cy, cz);
    this.pushGeo(mat, geo);
  }

  public addRoundedSlab(
    mat: MatKey,
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    cornerRadius = 8,
    rotY = 0,
    bevel = true
  ) {
    const geo = new THREE.ExtrudeGeometry(makeRoundedRectShape(w, d, cornerRadius), {
      depth: h,
      bevelEnabled: bevel,
      bevelSegments: 2,
      steps: 1,
      bevelSize: bevel ? 0.14 : 0,
      bevelThickness: bevel ? 0.12 : 0,
      curveSegments: 12,
    });
    geo.rotateX(-Math.PI / 2);
    if (rotY !== 0) geo.rotateY(rotY);
    geo.translate(cx, baseY, cz);

    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) / 4.0, uv.getY(i) / 4.0);
    }

    this.pushGeo(mat, geo);
  }

  public addCylinder(
    mat: MatKey,
    cx: number,
    cy: number,
    cz: number,
    rTop: number,
    rBot: number,
    height: number,
    seg = 16,
    rotX = 0,
    rotZ = 0,
    openEnded = false,
    rotY = 0,
    tile = 8
  ) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, height, seg, 1, openEnded);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const arc = ((rTop + rBot) / 2) * Math.PI * 2;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) * arc) / tile, (uv.getY(i) * height) / tile);
    }
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(cx, cy, cz);
    this.pushGeo(mat, geo);
  }

  public addBeam(
    mat: MatKey,
    a: THREE.Vector3,
    b: THREE.Vector3,
    rBot: number,
    rTop = rBot,
    seg = 8
  ) {
    const len = a.distanceTo(b);
    if (len <= 0.001) return;
    const geo = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mat4 = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(mat4);
    this.pushGeo(mat, geo);
  }

  public addTorus(
    mat: MatKey,
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    tube: number,
    rotX = Math.PI / 2,
    rotY = 0,
    radialSeg = 12,
    tubularSeg = 48
  ) {
    const geo = new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    geo.translate(cx, cy, cz);
    this.pushGeo(mat, geo);
  }

  public addWindow(spec: WindowQuadSpec) {
    this.windowQuads.push(spec);
  }

  public addSignBoard(
    cx: number,
    cy: number,
    cz: number,
    rotY: number,
    width: number,
    height: number,
    title: string,
    subtitle: string,
    style: { bg: string; fg: string; accent: string; serif?: boolean; border?: boolean; tag?: string }
  ) {
    const tex = createSignageTexture(title, subtitle, style, this.anisotropy);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color('#ffe8c8'),
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), signMat);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = rotY;
    this.extraGroup.add(mesh);
  }

  public addPastRoadSign(
    cx: number,
    cy: number,
    cz: number,
    rotY: number,
    width: number,
    height: number,
    crossedOut: boolean
  ) {
    const tex = createPastRoadSignTexture(crossedOut, this.anisotropy);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.78,
      roughness: 0.3,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = rotY;
    this.extraGroup.add(mesh);
  }

  public addShowcaseScreen(
    cx: number,
    cy: number,
    cz: number,
    rotY: number,
    width: number,
    height: number,
    opts: {
      era: string;
      title: string;
      subtitle: string;
      metrics: string[];
      accentHex: string;
      secondaryHex: string;
    }
  ) {
    const tex = createShowcaseScreenTexture(opts, this.anisotropy);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.95,
      roughness: 0.18,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.y = rotY;
    this.extraGroup.add(mesh);
  }

  public buildGroup(palette: MaterialPalette): THREE.Group {
    const root = new THREE.Group();

    const noShadowMats = new Set<MatKey>([
      'emissiveWarmSoft',
      'emissiveWarmBright',
      'emissiveCoolWhite',
      'emissiveAmberAccent',
      'emissiveCyanAccent',
      'hdrWarmGlow',
      'hdrCyanGlow',
      'storefrontGlass',
      'skybridgeGlass',
      'tintedGlass',
      'tintedGlassMirror',
      'tintedGlassBronze',
      'plazaStone',
    ]);

    const glassMats = new Set<MatKey>([
      'storefrontGlass',
      'skybridgeGlass',
      'tintedGlass',
      'tintedGlassMirror',
      'tintedGlassBronze',
    ]);

    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;

      const mat = palette[key] as THREE.Material;
      const isGlass = glassMats.has(key);
      const meshes = mergeIntoChunks(geos, mat, {
        castShadow: !noShadowMats.has(key),
        receiveShadow: !isGlass,
        renderOrder: isGlass ? 3 : undefined,
      });
      for (const mesh of meshes) root.add(mesh);
    }

    if (this.windowQuads.length > 0) {
      // Z-chunked window meshes: tight bounds let frustum culling drop whole
      // street stretches; layer 1 keeps this heavy shader out of reflections.
      const WIN_CHUNK = 80;
      const winChunks = new Map<number, WindowQuadSpec[]>();
      for (const q of this.windowQuads) {
        const key = Math.floor(q.center.z / WIN_CHUNK);
        const arr = winChunks.get(key) ?? [];
        arr.push(q);
        winChunks.set(key, arr);
      }

      const up = new THREE.Vector3(0, 1, 0);
      const tmp = new THREE.Vector3();

      for (const quads of winChunks.values()) {
      const count = quads.length;
      const positions = new Float32Array(count * 4 * 3);
      const normals = new Float32Array(count * 4 * 3);
      const uvs = new Float32Array(count * 4 * 2);
      const tangents = new Float32Array(count * 4 * 3);
      const roomMetas = new Float32Array(count * 4 * 3);
      const blindDrops = new Float32Array(count * 4);
      const indices = new Uint32Array(count * 6);

      for (let i = 0; i < count; i++) {
        const q = quads[i];
        const hw = q.width * 0.5;
        const hh = q.height * 0.5;

        const corners = [
          [-hw, -hh, 0, 0],
          [hw, -hh, 1, 0],
          [-hw, hh, 0, 1],
          [hw, hh, 1, 1],
        ];

        for (let c = 0; c < 4; c++) {
          const vIdx = i * 4 + c;
          tmp
            .copy(q.center)
            .addScaledVector(q.rightDir, corners[c][0])
            .addScaledVector(up, corners[c][1]);

          positions[vIdx * 3] = tmp.x;
          positions[vIdx * 3 + 1] = tmp.y;
          positions[vIdx * 3 + 2] = tmp.z;

          normals[vIdx * 3] = q.normal.x;
          normals[vIdx * 3 + 1] = q.normal.y;
          normals[vIdx * 3 + 2] = q.normal.z;

          uvs[vIdx * 2] = corners[c][2];
          uvs[vIdx * 2 + 1] = corners[c][3];

          tangents[vIdx * 3] = q.rightDir.x;
          tangents[vIdx * 3 + 1] = q.rightDir.y;
          tangents[vIdx * 3 + 2] = q.rightDir.z;

          roomMetas[vIdx * 3] = q.seed;
          roomMetas[vIdx * 3 + 1] = q.lit;
          roomMetas[vIdx * 3 + 2] = q.warmth;

          blindDrops[vIdx] = q.blindDrop;
        }

        const base = i * 4;
        indices[i * 6] = base;
        indices[i * 6 + 1] = base + 1;
        indices[i * 6 + 2] = base + 2;
        indices[i * 6 + 3] = base + 2;
        indices[i * 6 + 4] = base + 1;
        indices[i * 6 + 5] = base + 3;
      }

      const winGeo = new THREE.BufferGeometry();
      winGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      winGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      winGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      winGeo.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
      winGeo.setAttribute('aRoomMeta', new THREE.BufferAttribute(roomMetas, 3));
      winGeo.setAttribute('aBlindDrop', new THREE.BufferAttribute(blindDrops, 1));
      winGeo.setIndex(new THREE.BufferAttribute(indices, 1));
      winGeo.computeBoundingSphere();

      const winMesh = new THREE.Mesh(winGeo, palette.upperWindowInterior);
      winMesh.layers.set(1);
      root.add(winMesh);
      }
    }

    root.add(this.extraGroup);
    return root;
  }
}
