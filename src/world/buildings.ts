import * as THREE from 'three';
import { ArchitectureBuilder, LightAnchor, MatKey } from './architectureBuilder';
import { MaterialPalette } from './materials';
import { mulberry32 } from './textures';
import { TreePlacement } from './trees';
import { createSiteScreen, SiteScreen } from './siteScreen';
import type { StandDiagram } from './standTexture';

interface FacadeAxis {
  nx: number;
  nz: number;
  rx: number;
  rz: number;
  rotY: number;
}

function getFacadeAxis(facing: '+X' | '-X' | '+Z' | '-Z'): FacadeAxis {
  switch (facing) {
    case '+X':
      return { nx: 1, nz: 0, rx: 0, rz: -1, rotY: Math.PI / 2 };
    case '-X':
      return { nx: -1, nz: 0, rx: 0, rz: 1, rotY: -Math.PI / 2 };
    case '+Z':
      return { nx: 0, nz: 1, rx: 1, rz: 0, rotY: 0 };
    case '-Z':
      return { nx: 0, nz: -1, rx: -1, rz: 0, rotY: Math.PI };
  }
}

interface StorefrontSpec {
  title: string;
  subtitle: string;
  signStyle: { bg: string; fg: string; accent: string; serif?: boolean; border?: boolean; tag?: string };
  theme: 'gallery' | 'books' | 'bistro' | 'horology' | 'design' | 'computer';
  canopyMat: MatKey;
  hasArcade?: boolean;
}

interface BuildingSpec {
  id: string;
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  startY?: number;
  podiumH: number;
  floors: number;
  floorH: number;
  wallMat: MatKey;
  secondaryMat: MatKey;
  trimMat: MatKey;
  bayWidth: number;
  windowRatioW: number;
  windowRatioH: number;
  recessDepth: number;
  litProbability: number;
  style: 'beaux-arts' | 'fluted-gallery' | 'industrial-loft' | 'modern-stone' | 'curtain-accent';
  setbackAtFloor?: number;
  setbackMeters?: number;
  balconies?: boolean;
  verticalFins?: boolean;
  activeFaces: Array<{
    facing: '+X' | '-X' | '+Z' | '-Z';
    storefront?: StorefrontSpec;
  }>;
  roofProps?: {
    waterTower?: boolean;
    billboard?: { title: string; sub: string };
    antennas?: number;
  };
  seed: number;
}

function addOrientedBox(
  b: ArchitectureBuilder,
  mat: MatKey,
  originX: number,
  originY: number,
  originZ: number,
  axis: FacadeAxis,
  alongRight: number,
  upY: number,
  outwardNormalOffset: number,
  widthAlongRight: number,
  heightY: number,
  depthAlongNormal: number
) {
  const cx = originX + axis.rx * alongRight + axis.nx * outwardNormalOffset;
  const cy = originY + upY;
  const cz = originZ + axis.rz * alongRight + axis.nz * outwardNormalOffset;

  if (Math.abs(axis.nx) > 0.5) {
    b.addBox(mat, cx, cy, cz, depthAlongNormal, heightY, widthAlongRight);
  } else {
    b.addBox(mat, cx, cy, cz, widthAlongRight, heightY, depthAlongNormal);
  }
}

function buildStorefrontInteriorAndFacade(
  b: ArchitectureBuilder,
  faceOriginX: number,
  faceOriginZ: number,
  faceLength: number,
  podiumH: number,
  axis: FacadeAxis,
  wallMat: MatKey,
  trimMat: MatKey,
  store: StorefrontSpec,
  rng: () => number
) {
  const groundY = 0.17;
  const interiorDepth = 3.2;
  const pierW = 0.78;

  addOrientedBox(b, wallMat, faceOriginX, groundY, faceOriginZ, axis, -faceLength / 2 + pierW / 2, podiumH / 2, -0.35, pierW, podiumH, 0.78);
  addOrientedBox(b, wallMat, faceOriginX, groundY, faceOriginZ, axis, faceLength / 2 - pierW / 2, podiumH / 2, -0.35, pierW, podiumH, 0.78);

  const friezeH = 1.1;
  addOrientedBox(b, wallMat, faceOriginX, groundY, faceOriginZ, axis, 0, podiumH - friezeH / 2, -0.22, faceLength, friezeH, 0.54);
  addOrientedBox(b, trimMat, faceOriginX, groundY, faceOriginZ, axis, 0, podiumH + 0.12, 0.2, faceLength + 0.18, 0.28, 0.58);

  const roomW = Math.max(3.2, faceLength - pierW * 2);
  const clearH = podiumH - friezeH - 0.1;

  addOrientedBox(b, 'interiorFloorStone', faceOriginX, groundY, faceOriginZ, axis, 0, 0.06, -interiorDepth / 2 - 0.1, roomW, 0.12, interiorDepth);
  addOrientedBox(b, 'interiorPlasterWarm', faceOriginX, groundY, faceOriginZ, axis, 0, clearH - 0.08, -interiorDepth / 2 - 0.1, roomW, 0.14, interiorDepth);
  addOrientedBox(b, 'interiorPlasterWarm', faceOriginX, groundY, faceOriginZ, axis, 0, clearH / 2, -interiorDepth - 0.1, roomW, clearH, 0.18);
  addOrientedBox(b, 'interiorPlasterWarm', faceOriginX, groundY, faceOriginZ, axis, -roomW / 2, clearH / 2, -interiorDepth / 2, 0.18, clearH, interiorDepth);
  addOrientedBox(b, 'interiorPlasterWarm', faceOriginX, groundY, faceOriginZ, axis, roomW / 2, clearH / 2, -interiorDepth / 2, 0.18, clearH, interiorDepth);

  addOrientedBox(b, 'emissiveWarmSoft', faceOriginX, groundY, faceOriginZ, axis, 0, clearH - 0.18, -interiorDepth + 0.28, roomW * 0.88, 0.08, 0.18);
  addOrientedBox(b, 'emissiveWarmSoft', faceOriginX, groundY, faceOriginZ, axis, 0, clearH - 0.18, -0.95, roomW * 0.86, 0.07, 0.16);

  const numBays = Math.max(2, Math.round(roomW / 5.6));
  const baySpan = roomW / numBays;
  const doorBayIdx = Math.floor(numBays / 2);

  for (let i = 0; i < numBays; i++) {
    const bayCenter = -roomW / 2 + (i + 0.5) * baySpan;

    if (i > 0) {
      const pilasterPos = -roomW / 2 + i * baySpan;
      addOrientedBox(b, wallMat, faceOriginX, groundY, faceOriginZ, axis, pilasterPos, clearH / 2, -0.24, 0.54, clearH, 0.58);
    }

    const glassLineOffset = store.hasArcade ? -1.45 : -0.18;

    if (i === doorBayIdx) {
      const alcoveZ = glassLineOffset - 0.95;
      const openW = baySpan - 0.52;
      addOrientedBox(b, 'emissiveWarmBright', faceOriginX, groundY, faceOriginZ, axis, bayCenter, clearH - 0.12, glassLineOffset - 0.45, openW * 0.65, 0.06, 0.35);
      addOrientedBox(b, trimMat, faceOriginX, groundY, faceOriginZ, axis, bayCenter, 2.55, alcoveZ, openW, 0.12, 0.12);
      addOrientedBox(b, trimMat, faceOriginX, groundY, faceOriginZ, axis, bayCenter, 1.28, alcoveZ, 0.12, 2.55, 0.12);
      addOrientedBox(b, 'storefrontGlass', faceOriginX, groundY, faceOriginZ, axis, bayCenter, clearH / 2, alcoveZ, openW - 0.1, clearH - 0.15, 0.03);
    } else {
      const openW = baySpan - 0.48;
      const plinthH = store.theme === 'gallery' ? 0.3 : 0.52;
      addOrientedBox(b, store.theme === 'gallery' ? 'darkBronze' : wallMat, faceOriginX, groundY, faceOriginZ, axis, bayCenter, plinthH / 2, glassLineOffset, openW, plinthH, 0.36);
      addOrientedBox(b, trimMat, faceOriginX, groundY, faceOriginZ, axis, bayCenter, 2.95, glassLineOffset + 0.02, openW, 0.09, 0.12);
      addOrientedBox(
        b,
        'storefrontGlass',
        faceOriginX,
        groundY,
        faceOriginZ,
        axis,
        bayCenter,
        plinthH + (clearH - plinthH) / 2,
        glassLineOffset,
        openW - 0.06,
        clearH - plinthH - 0.06,
        0.03
      );

      const propDepth = -1.55;
      if (store.theme === 'gallery') {
        addOrientedBox(b, 'paleLimestone', faceOriginX, groundY, faceOriginZ, axis, bayCenter - openW * 0.2, 0.65, propDepth, 0.68, 1.15, 0.68);
        addOrientedBox(b, 'champagneMetal', faceOriginX, groundY, faceOriginZ, axis, bayCenter - openW * 0.2, 1.58, propDepth, 0.36, 0.78, 0.32);
        addOrientedBox(b, 'emissiveWarmSoft', faceOriginX, groundY, faceOriginZ, axis, bayCenter, 2.25, -interiorDepth + 0.08, openW * 0.58, 1.55, 0.08);
      } else if (store.theme === 'bistro') {
        for (const side of [-0.24, 0.24]) {
          addOrientedBox(b, 'paleLimestone', faceOriginX, groundY, faceOriginZ, axis, bayCenter + openW * side, 0.84, propDepth + 0.25, 0.8, 0.08, 0.8);
          addOrientedBox(b, 'emissiveAmberAccent', faceOriginX, groundY, faceOriginZ, axis, bayCenter + openW * side, 1.08, propDepth + 0.25, 0.18, 0.26, 0.18);
        }
      } else if (store.theme === 'computer') {
        addOrientedBox(b, 'warmTimber', faceOriginX, groundY, faceOriginZ, axis, bayCenter, 0.52, propDepth + 0.3, openW * 0.82, 0.14, 0.55);
        for (const m of [-0.3, 0, 0.3]) {
          addOrientedBox(b, 'blackSteel', faceOriginX, groundY, faceOriginZ, axis, bayCenter + openW * m, 0.92, propDepth + 0.22, 0.52, 0.42, 0.4);
          addOrientedBox(b, 'emissiveCyanAccent', faceOriginX, groundY, faceOriginZ, axis, bayCenter + openW * m, 0.95, propDepth + 0.45, 0.4, 0.3, 0.04);
        }
        addOrientedBox(b, 'emissiveWarmBright', faceOriginX, groundY, faceOriginZ, axis, bayCenter, clearH - 0.3, -interiorDepth + 0.35, openW * 0.7, 0.1, 0.3);
      } else {
        addOrientedBox(b, 'warmTimber', faceOriginX, groundY, faceOriginZ, axis, bayCenter, 1.85, -interiorDepth + 0.32, openW * 0.82, 3.0, 0.42);
        addOrientedBox(b, 'emissiveWarmBright', faceOriginX, groundY, faceOriginZ, axis, bayCenter, 2.65, propDepth, 0.52, 0.18, 0.52);
      }
    }
  }

  const canopyW = Math.min(faceLength - 1.6, Math.max(5.6, faceLength * 0.68));
  const canopyDepth = 1.45;
  const canopyY = podiumH - friezeH - 0.05;
  addOrientedBox(b, store.canopyMat, faceOriginX, groundY, faceOriginZ, axis, 0, canopyY, canopyDepth / 2 - 0.05, canopyW, 0.18, canopyDepth);
  addOrientedBox(b, 'emissiveWarmSoft', faceOriginX, groundY, faceOriginZ, axis, 0, canopyY - 0.09, canopyDepth * 0.42, canopyW * 0.86, 0.04, 0.2);

  b.addLightAnchor(faceOriginX + axis.nx * 2.2, 3.6, faceOriginZ + axis.nz * 2.2, 0xffd296, 10.0, 22.0);

  const signW = Math.min(faceLength * 0.52, 8.2);
  const signH = signW * 0.22;
  const signY = groundY + podiumH - friezeH * 0.5;
  addOrientedBox(b, trimMat, faceOriginX, 0, faceOriginZ, axis, 0, signY, 0.08, signW + 0.2, signH + 0.16, 0.08);

  const sx = faceOriginX + axis.nx * 0.14;
  const sz = faceOriginZ + axis.nz * 0.14;
  b.addSignBoard(sx, signY, sz, axis.rotY, signW, signH, store.title, store.subtitle, store.signStyle);

  void rng;
}

function buildUpperFacadeWall(
  b: ArchitectureBuilder,
  spec: BuildingSpec,
  faceOriginX: number,
  faceOriginZ: number,
  faceLength: number,
  axis: FacadeAxis,
  startFloor: number,
  endFloor: number,
  baseY: number,
  rng: () => number
) {
  const numFloors = endFloor - startFloor;
  if (numFloors <= 0) return;
  const sectionH = numFloors * spec.floorH;

  const cornerPierW = 0.96;
  const usableW = Math.max(2.6, faceLength - cornerPierW * 2);
  const bays = Math.max(2, Math.round(usableW / spec.bayWidth));
  const bayW = usableW / bays;
  const pierW = Math.max(0.4, bayW * (1 - spec.windowRatioW));
  const winW = bayW - pierW;
  const winH = spec.floorH * spec.windowRatioH;
  const spandrelH = spec.floorH - winH;

  addOrientedBox(b, spec.wallMat, faceOriginX, baseY, faceOriginZ, axis, -faceLength / 2 + cornerPierW / 2, sectionH / 2, -0.45, cornerPierW, sectionH, 0.92);
  addOrientedBox(b, spec.wallMat, faceOriginX, baseY, faceOriginZ, axis, faceLength / 2 - cornerPierW / 2, sectionH / 2, -0.45, cornerPierW, sectionH, 0.92);

  for (let i = 0; i <= bays; i++) {
    const px = -usableW / 2 + i * bayW;
    addOrientedBox(b, spec.wallMat, faceOriginX, baseY, faceOriginZ, axis, px, sectionH / 2, -0.43, pierW, sectionH, 0.9);

    if (spec.verticalFins) {
      addOrientedBox(
        b,
        spec.style === 'fluted-gallery' ? 'flutedConcrete' : spec.trimMat,
        faceOriginX,
        baseY,
        faceOriginZ,
        axis,
        px,
        sectionH / 2,
        0.24,
        0.24,
        sectionH - 0.2,
        0.58
      );
    }
  }

  const normalVec = new THREE.Vector3(axis.nx, 0, axis.nz);
  const rightVec = new THREE.Vector3(axis.rx, 0, axis.rz);

  for (let f = 0; f < numFloors; f++) {
    const floorIdx = startFloor + f;
    const fBaseY = baseY + f * spec.floorH;

    for (let i = 0; i < bays; i++) {
      const bayCenter = -usableW / 2 + (i + 0.5) * bayW;
      const sillY = spandrelH * 0.72;

      addOrientedBox(b, spec.secondaryMat, faceOriginX, fBaseY, faceOriginZ, axis, bayCenter, sillY * 0.5, -0.51, winW + 0.08, sillY + 0.04, 0.74);
      addOrientedBox(b, spec.trimMat, faceOriginX, fBaseY, faceOriginZ, axis, bayCenter, sillY, -0.18, winW + 0.1, 0.12, 0.52);

      const topBandH = Math.max(0.18, spec.floorH - (sillY + winH));
      addOrientedBox(
        b,
        spec.style === 'industrial-loft' ? 'blackSteel' : spec.wallMat,
        faceOriginX,
        fBaseY,
        faceOriginZ,
        axis,
        bayCenter,
        sillY + winH + topBandH * 0.5,
        -0.43,
        winW + 0.1,
        topBandH + 0.04,
        0.9
      );

      const winCenterY = fBaseY + sillY + winH * 0.5;
      const paneOffset = -spec.recessDepth;

      addOrientedBox(b, spec.trimMat, faceOriginX, 0, faceOriginZ, axis, bayCenter, winCenterY + winH * 0.2, paneOffset + 0.04, winW, 0.06, 0.08);
      if (winW > 1.55) {
        addOrientedBox(b, spec.trimMat, faceOriginX, 0, faceOriginZ, axis, bayCenter, winCenterY, paneOffset + 0.04, 0.06, winH, 0.08);
      }

      if (spec.balconies && (floorIdx + i) % 2 === 0 && f < numFloors - 1) {
        const balcY = fBaseY + sillY;
        addOrientedBox(b, spec.secondaryMat, faceOriginX, 0, faceOriginZ, axis, bayCenter, balcY - 0.05, 0.34, winW + 0.36, 0.14, 0.72);
        addOrientedBox(b, spec.trimMat, faceOriginX, 0, faceOriginZ, axis, bayCenter, balcY + 0.48, 0.66, winW + 0.34, 0.06, 0.06);
      }

      const isLit = rng() < spec.litProbability;
      const litLevel = isLit ? 0.58 + rng() * 0.65 : 0.06 + rng() * 0.1;
      const warmth = spec.style === 'curtain-accent' ? 0.35 + rng() * 0.55 : rng() * 0.55;
      const blindRoll = rng();
      const blindDrop = blindRoll > 0.72 ? 0.22 + rng() * 0.42 : 0.0;

      const wCenter = new THREE.Vector3(
        faceOriginX + axis.rx * bayCenter + axis.nx * paneOffset,
        winCenterY,
        faceOriginZ + axis.rz * bayCenter + axis.nz * paneOffset
      );

      b.addWindow({
        center: wCenter,
        rightDir: rightVec.clone(),
        normal: normalVec.clone(),
        width: winW,
        height: winH,
        seed: rng() * 100.0 + floorIdx * 7.13 + i * 3.7,
        lit: litLevel,
        warmth,
        blindDrop,
      });
    }
  }

  for (let f = 1; f < numFloors; f++) {
    const bandY = baseY + f * spec.floorH;
    addOrientedBox(b, spec.trimMat, faceOriginX, bandY, faceOriginZ, axis, 0, 0.0, -0.1, faceLength - 0.6, 0.13, 0.56);
  }

  const topY = baseY + sectionH;
  addOrientedBox(b, spec.trimMat, faceOriginX, topY, faceOriginZ, axis, 0, 0.2, 0.2, faceLength + 0.32, 0.24, 0.5);
  addOrientedBox(b, spec.wallMat, faceOriginX, topY, faceOriginZ, axis, 0, 0.72, -0.18, faceLength, 0.82, 0.44);
  addOrientedBox(b, spec.trimMat, faceOriginX, topY, faceOriginZ, axis, 0, 1.18, -0.14, faceLength + 0.12, 0.12, 0.54);
}

function buildAuthoredBuilding(b: ArchitectureBuilder, spec: BuildingSpec) {
  const rng = mulberry32(spec.seed);
  const cx = (spec.xMin + spec.xMax) * 0.5;
  const cz = (spec.zMin + spec.zMax) * 0.5;
  const sx = spec.xMax - spec.xMin;
  const sz = spec.zMax - spec.zMin;
  const groundY = spec.startY ?? 0.17;

  const splitFloor = spec.setbackAtFloor ?? spec.floors;
  const upperTierH = splitFloor * spec.floorH;
  const lowerH = spec.podiumH + upperTierH;

  const storeFaces = new Set(spec.activeFaces.filter((f) => f.storefront).map((f) => f.facing));
  const pXMin = spec.xMin + (storeFaces.has('-X') ? 3.5 : 0.65);
  const pXMax = spec.xMax - (storeFaces.has('+X') ? 3.5 : 0.65);
  const pZMin = spec.zMin + (storeFaces.has('-Z') ? 3.5 : 0.65);
  const pZMax = spec.zMax - (storeFaces.has('+Z') ? 3.5 : 0.65);

  if (pXMax - pXMin > 1.0 && pZMax - pZMin > 1.0 && spec.podiumH > 0.2) {
    b.addBox(spec.wallMat, (pXMin + pXMax) * 0.5, groundY + spec.podiumH * 0.5, (pZMin + pZMax) * 0.5, pXMax - pXMin, spec.podiumH, pZMax - pZMin);
  }

  if (upperTierH > 0.2) {
    b.addBox(spec.wallMat, cx, groundY + spec.podiumH + upperTierH * 0.5, cz, Math.max(2, sx - 1.84), upperTierH, Math.max(2, sz - 1.84));
  }
  b.addBox(spec.wallMat, cx, groundY + lowerH - 0.18, cz, Math.max(2, sx - 0.5), 0.36, Math.max(2, sz - 0.5));

  const activeSet = new Set(spec.activeFaces.map((f) => f.facing));

  for (const face of spec.activeFaces) {
    const axis = getFacadeAxis(face.facing);
    const isXFace = Math.abs(axis.nx) > 0.5;
    const faceLen = isXFace ? sz : sx;
    const faceOriginX = face.facing === '+X' ? spec.xMax : face.facing === '-X' ? spec.xMin : cx;
    const faceOriginZ = face.facing === '+Z' ? spec.zMax : face.facing === '-Z' ? spec.zMin : cz;

    if (face.storefront) {
      buildStorefrontInteriorAndFacade(b, faceOriginX, faceOriginZ, faceLen, spec.podiumH, axis, spec.wallMat, spec.trimMat, face.storefront, rng);
    } else {
      addOrientedBox(b, spec.wallMat, faceOriginX, groundY, faceOriginZ, axis, 0, spec.podiumH * 0.5, -0.18, faceLen, spec.podiumH, 0.42);
      addOrientedBox(b, spec.trimMat, faceOriginX, groundY, faceOriginZ, axis, 0, spec.podiumH, 0.1, faceLen, 0.22, 0.45);
    }

    buildUpperFacadeWall(b, spec, faceOriginX, faceOriginZ, faceLen, axis, 0, splitFloor, groundY + spec.podiumH, rng);
  }

  const allFaces: Array<'+X' | '-X' | '+Z' | '-Z'> = ['+X', '-X', '+Z', '-Z'];
  for (const dir of allFaces) {
    if (!activeSet.has(dir)) {
      const axis = getFacadeAxis(dir);
      const isXFace = Math.abs(axis.nx) > 0.5;
      const faceLen = isXFace ? sz : sx;
      const fx = dir === '+X' ? spec.xMax : dir === '-X' ? spec.xMin : cx;
      const fz = dir === '+Z' ? spec.zMax : dir === '-Z' ? spec.zMin : cz;
      addOrientedBox(b, spec.wallMat, fx, groundY, fz, axis, 0, lowerH * 0.5, -0.22, faceLen, lowerH, 0.44);
    }
  }

  let totalH = lowerH;
  if (spec.setbackAtFloor && spec.setbackAtFloor < spec.floors) {
    const sb = spec.setbackMeters ?? 3.0;
    const upperFloors = spec.floors - spec.setbackAtFloor;
    const upperH = upperFloors * spec.floorH;
    const uXMin = spec.xMin + (activeSet.has('-X') ? sb : 0.8);
    const uXMax = spec.xMax - (activeSet.has('+X') ? sb : 0.8);
    const uZMin = spec.zMin + (storeFaces.has('-Z') ? sb : 0.8);
    const uZMax = spec.zMax - (storeFaces.has('+Z') ? sb : 0.8);
    const uCx = (uXMin + uXMax) * 0.5;
    const uCz = (uZMin + uZMax) * 0.5;
    const uSx = uXMax - uXMin;
    const uSz = uZMax - uZMin;

    b.addBox(spec.wallMat, uCx, groundY + lowerH + upperH * 0.5, uCz, Math.max(2, uSx - 1.84), upperH, Math.max(2, uSz - 1.84));
    b.addBox(spec.wallMat, uCx, groundY + lowerH + upperH - 0.18, uCz, Math.max(2, uSx - 0.5), 0.36, Math.max(2, uSz - 0.5));

    for (const face of spec.activeFaces) {
      const axis = getFacadeAxis(face.facing);
      const isXFace = Math.abs(axis.nx) > 0.5;
      const faceLen = isXFace ? uSz : uSx;
      const fx = face.facing === '+X' ? uXMax : face.facing === '-X' ? uXMin : uCx;
      const fz = face.facing === '+Z' ? uZMax : face.facing === '-Z' ? uZMin : uCz;

      buildUpperFacadeWall(b, spec, fx, fz, faceLen, axis, spec.setbackAtFloor, spec.floors, groundY + lowerH, rng);
      addOrientedBox(b, 'emissiveWarmSoft', fx, groundY + lowerH + 0.35, fz, axis, 0, 0, 0.85, faceLen * 0.65, 0.12, 0.18);
    }
    totalH += upperH;
  }

  const roofY = groundY + totalH;
  const mechW = Math.min(sx * 0.44, 10.0);
  const mechD = Math.min(sz * 0.44, 10.0);
  b.addBox('archConcrete', cx, roofY + 1.6, cz, mechW, 3.2, mechD);
  b.addBox(spec.trimMat, cx, roofY + 3.28, cz, mechW + 0.3, 0.18, mechD + 0.3);

  if (spec.roofProps) {
    const roadFace = spec.activeFaces[0]?.facing ?? '+X';
    const axis = getFacadeAxis(roadFace);
    const edgeX = roadFace === '+X' ? spec.xMax : roadFace === '-X' ? spec.xMin : cx;
    const edgeZ = roadFace === '+Z' ? spec.zMax : roadFace === '-Z' ? spec.zMin : cz;

    if (spec.roofProps.waterTower) {
      const tx = cx - axis.nx * sx * 0.16;
      const tz = cz - sz * 0.2 + axis.rx * sx * 0.0;
      const legH = 4.4;
      const tankR = 2.05;
      const tankH = 3.3;
      for (let a = 0; a < 4; a++) {
        const ph = a * (Math.PI / 2) + 0.62;
        b.addBeam(
          'blackSteel',
          new THREE.Vector3(tx + Math.cos(ph) * 1.65, roofY, tz + Math.sin(ph) * 1.65),
          new THREE.Vector3(tx + Math.cos(ph) * 1.05, roofY + legH, tz + Math.sin(ph) * 1.05),
          0.1,
          0.07,
          6
        );
      }
      b.addCylinder('warmTimber', tx, roofY + legH + tankH * 0.5, tz, tankR, tankR * 0.92, tankH, 14);
      b.addCylinder('blackSteel', tx, roofY + legH + 0.12, tz, tankR + 0.16, tankR + 0.16, 0.24, 14);
      b.addCylinder('darkBronze', tx, roofY + legH + tankH + 0.62, tz, 0.08, tankR * 0.9, 1.24, 14);
    }

    if (spec.roofProps.billboard) {
      const bbW = 9.4;
      const bbH = 4.4;
      const bbX = edgeX - axis.nx * 1.6;
      const bbZ = edgeZ - axis.nz * 1.6 + axis.rz * sz * 0.14;
      const signY = roofY + 5.4;
      addOrientedBox(b, 'blackSteel', bbX, roofY, bbZ, axis, -bbW * 0.36, 1.6, -0.2, 0.32, 3.2, 0.32);
      addOrientedBox(b, 'blackSteel', bbX, roofY, bbZ, axis, bbW * 0.36, 1.6, -0.2, 0.32, 3.2, 0.32);
      addOrientedBox(b, 'darkBronze', bbX, roofY, bbZ, axis, 0, signY - roofY, -0.2, bbW, bbH, 0.34);
      b.addSignBoard(
        bbX + axis.nx * 0.06,
        signY,
        bbZ + axis.nz * 0.06,
        axis.rotY,
        bbW - 0.7,
        bbH - 0.55,
        spec.roofProps.billboard.title,
        spec.roofProps.billboard.sub,
        { bg: '#0d1420', fg: '#f6efdd', accent: '#f59e0b', border: true, tag: 'AD // CIRCA 2004' }
      );
    }

    if (spec.roofProps.antennas) {
      for (let i = 0; i < spec.roofProps.antennas; i++) {
        const ax = cx + (rng() - 0.5) * sx * 0.42;
        const az = cz + (rng() - 0.5) * sz * 0.42;
        const ah = 4.5 + rng() * 4.5;
        b.addBeam('blackSteel', new THREE.Vector3(ax, roofY, az), new THREE.Vector3(ax, roofY + ah, az), 0.06, 0.03, 5);
        b.addBox('blackSteel', ax, roofY + ah * 0.72, az, 1.1, 0.06, 0.06, rng() * Math.PI);
        b.addBox('blackSteel', ax, roofY + ah * 0.55, az, 0.7, 0.05, 0.05, rng() * Math.PI);
      }
    }
  }
}

// ============================================================================
// ACT I STREET FURNITURE: BLADE SIGNS & SAGGING WIRES
// ============================================================================
function buildBladeSigns(b: ArchitectureBuilder) {
  const signs: Array<{ x: number; dir: 1 | -1; z: number; y: number; t: string; s: string; accent: string }> = [
    { x: -25.5, dir: 1, z: 306, y: 4.5, t: 'INTERNET CAFE', s: '56K · $2 / HOUR', accent: '#38bdf8' },
    { x: -25.5, dir: 1, z: 148, y: 4.6, t: 'PC CLUB', s: 'CS 1.6 · LAN PARTY', accent: '#f59e0b' },
    { x: 25.5, dir: -1, z: 298, y: 4.5, t: 'CD · DVD · MP3', s: 'BURN WHILE U WAIT', accent: '#f59e0b' },
    { x: 25.5, dir: -1, z: 136, y: 4.4, t: 'WEB STUDIO', s: 'FLASH · HTML · PHP', accent: '#38bdf8' },
  ];
  for (const sg of signs) {
    const sx = sg.x + sg.dir * 1.75;
    b.addBeam('blackSteel', new THREE.Vector3(sg.x + sg.dir * 0.1, sg.y + 0.95, sg.z), new THREE.Vector3(sx, sg.y + 0.95, sg.z), 0.05, 0.05, 6);
    b.addBeam('blackSteel', new THREE.Vector3(sg.x + sg.dir * 0.1, sg.y + 0.12, sg.z), new THREE.Vector3(sx, sg.y + 0.9, sg.z), 0.045, 0.045, 6);
    b.addSignBoard(sx, sg.y, sg.z, 0, 3.6, 1.5, sg.t, sg.s, { bg: '#0d1420', fg: '#f4ecd8', accent: sg.accent, border: true });
    b.addSignBoard(sx, sg.y, sg.z, Math.PI, 3.6, 1.5, sg.t, sg.s, { bg: '#0d1420', fg: '#f4ecd8', accent: sg.accent, border: true });
  }
}

function buildStreetWires(b: ArchitectureBuilder) {
  for (const wz of [272, 178]) {
    const x0 = -24.8;
    const x1 = 24.8;
    for (const off of [-0.55, 0, 0.55]) {
      const y0 = 10.6 + off * 0.5;
      const sag = 2.5;
      let prev = new THREE.Vector3(x0, y0, wz + off);
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const cur = new THREE.Vector3(x0 + (x1 - x0) * t, y0 - sag * 4 * t * (1 - t), wz + off);
        b.addBeam('blackSteel', prev, cur, 0.028, 0.028, 5);
        prev = cur;
      }
    }
    for (const t of [0.32, 0.5, 0.68]) {
      const bx = x0 + (x1 - x0) * t;
      const wireY = 10.6 - 2.5 * 4 * t * (1 - t);
      b.addBeam('blackSteel', new THREE.Vector3(bx, wireY, wz), new THREE.Vector3(bx, wireY - 0.55, wz), 0.02, 0.02, 4);
      b.addBox('emissiveAmberAccent', bx, wireY - 0.68, wz, 0.14, 0.2, 0.14);
    }
  }
}

// ============================================================================
// EXACT CONFLUENCE ARCHITECTURAL ARCHETYPE 1 (From Max's Reference Screenshot 3):
// Cascading Rounded-Corner Terraces with Solid Stone Core Shaft, Deep Cantilevered
// Overhangs, Dark Emerald/Mirror Glass, Per-Floor Glow & Terrace Elm Trees!
// ============================================================================
function buildConfluenceTerraces(
  b: ArchitectureBuilder,
  treePlacements: TreePlacement[],
  opts: {
    x: number;
    z: number;
    floors: number;
    w: number;
    d: number;
    angle?: number;
    glassMat?: 'confluenceGlass' | 'tintedGlassMirror' | 'tintedGlassBronze';
    glowMat?: 'hdrWarmGlow' | 'hdrCyanGlow';
    stepSignX?: number;
  }
) {
  const {
    x,
    z,
    floors,
    w,
    d,
    angle = 0,
    glassMat = 'confluenceGlass',
    glowMat = 'hdrWarmGlow',
    stepSignX = -1,
  } = opts;

  // 1. Solid vertical stone core rising through the top (as in `confluence/src/world.ts` line 490!)
  const coreH = floors * 5.8 + 2.5;
  b.addBox('lightConcrete', x + stepSignX * w * 0.08, coreH * 0.5, z, w * 0.42, coreH, d * 0.52, angle);

  // Base plinth
  b.addRoundedSlab('lightConcrete', x, 0.17, z, w + 9, d + 8, 0.55, 13, angle);

  for (let i = 0; i < floors; i++) {
    const fw = Math.max(20, w - i * 3.2);
    const fd = Math.max(26, d - i * 4.0);
    const fy = 2.4 + i * 5.8;
    const fx = x + stepSignX * i * 1.1;
    const fz = z - i * 1.2;
    const fRot = angle + i * 0.018;

    // Thick rounded ivory-stone floor slab (`h = 1.05, r = 11`)
    b.addRoundedSlab('ivoryCeramic', fx, fy, fz, fw, fd, 1.05, 11, fRot);

    // Deeply inset solid dark-emerald / mirror glass volume (`fw - 8, fd - 9, h = 4.55`)
    // leaving a deep 4m cantilevered terrace ledge all around!
    b.addRoundedSlab(glassMat, fx, fy + 1.05, fz, fw - 8, fd - 9, 4.55, 8, fRot, false);

    // Upper cornice lip (`h = 0.24`) + per-floor glowing contour band
    b.addRoundedSlab('lightConcrete', fx, fy + 5.48, fz, fw + 0.2, fd + 0.2, 0.24, 11, fRot);
    b.addRoundedSlab(glowMat, fx, fy + 5.32, fz, fw - 0.4, fd - 0.4, 0.14, 10, fRot, false);

    // Place small terrace trees on the wide cantilevered ledges (just like in Screenshot 3!)
    if (i < floors - 1 && i % 2 === 0) {
      const edgeX = fx - stepSignX * (fw * 0.5 - 2.6);
      for (const zFrac of [-0.28, 0.28]) {
        treePlacements.push({
          x: edgeX,
          y: fy + 1.05,
          z: fz + fd * zFrac,
          scale: 0.36 + (i % 3) * 0.05,
          rotY: i * 1.3 + zFrac * 4,
        });
      }
    }
  }
}

// ============================================================================
// EXACT CONFLUENCE ARCHITECTURAL ARCHETYPE 2 (From Max's Reference Screenshots 1 & 2):
// Low Rounded-Corner Courtyard Pavilion with Overhanging Roof Slab, Mid-Belt Slab,
// Dark Emerald-Slate Glass & Slanted Exterior Columns!
// ============================================================================
function buildConfluencePavilion(
  b: ArchitectureBuilder,
  opts: {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    rotY?: number;
    glassMat?: 'confluenceGlass' | 'tintedGlassMirror' | 'tintedGlassBronze';
  }
) {
  const { x, z, w, d, h, rotY = 0, glassMat = 'confluenceGlass' } = opts;
  const base = 0.17;

  // Ground plinth
  b.addRoundedSlab('lightConcrete', x, base, z, w + 4, d + 4, 0.5, 12, rotY);

  // Rounded dark-emerald/mirror glass core (`w - 4, d - 4, h`)
  b.addRoundedSlab(glassMat, x, base + 0.5, z, w - 4, d - 4, h, 10, rotY, false);

  // Mid-height horizontal projecting stone belt slab (`h * 0.55`) — exact match to Screenshot 1 & 2!
  b.addRoundedSlab('lightConcrete', x, base + h * 0.55, z, w + 0.5, d + 0.5, 0.72, 10, rotY);
  b.addRoundedSlab('hdrWarmGlow', x, base + h * 0.55 - 0.12, z, w - 0.4, d - 0.4, 0.12, 10, rotY, false);

  // Thick overhanging stone roof slab (`w + 3, d + 3, h = 1.55`)
  b.addRoundedSlab('ivoryCeramic', x, base + h + 0.5, z, w + 3.2, d + 3.2, 1.55, 12, rotY);
  b.addRoundedSlab('hdrWarmGlow', x, base + h + 0.36, z, w + 2.2, d + 2.2, 0.14, 11, rotY, false);

  // Upper penthouse slab (`w * 0.8, d * 0.7`)
  b.addRoundedSlab('ivoryCeramic', x, base + h + 2.05, z, w * 0.78, d * 0.68, 0.75, 8, rotY);

  // Slanted exterior structural stone columns (`beam`) along the street-facing side (Screenshot 1!)
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  const streetSide = x < 0 ? 1 : -1;
  const localFaceX = streetSide * (w * 0.5 - 1.2);

  for (let k = -2; k <= 2; k++) {
    const localZ0 = (k * d) / 5.5;
    const localZ1 = localZ0 + 3.0;
    const p0 = new THREE.Vector3(
      x + localFaceX * cosR + localZ0 * sinR,
      base + 0.5,
      z - localFaceX * sinR + localZ0 * cosR
    );
    const p1 = new THREE.Vector3(
      x + localFaceX * cosR + localZ1 * sinR,
      base + h + 0.6,
      z - localFaceX * sinR + localZ1 * cosR
    );
    b.addBeam('ivoryCeramic', p0, p1, 0.46, 0.46, 8);
  }
}

// ============================================================================
// DESIGNER PROJECT TOTEM (Strictly 3 in total: Web Platforms, Albion Bot, GIAS.BY)
// Properly oriented in local XY space so base, frame & screen all face the driver!
// ============================================================================
function buildDesignerProjectTotem(
  b: ArchitectureBuilder,
  opts: {
    side: 'WEST' | 'EAST';
    z: number;
    era: string;
    title: string;
    subtitle: string;
    metrics: string[];
    accentHex: string;
    secondaryHex: string;
    customMap?: THREE.Texture;
    diagram?: StandDiagram;
  }
) {
  const isWest = opts.side === 'WEST';
  const px = isWest ? -16.8 : 16.8;
  // Rotated toward the oncoming South->North driver (+Z) so both base & screen face the car!
  const rotY = isWest ? 0.34 : -0.34;
  const normalX = Math.sin(rotY);
  const normalZ = Math.cos(rotY);

  // Notice: Width is along X (`13.2m`), Depth is thin along Z (`0.9m`), matching PlaneGeometry(12.2, 6.8)!
  // 1. Sculpted rounded ivory-stone & bronze pedestal base
  b.addRoundedSlab('ivoryCeramic', px, 0.17, opts.z, 14.2, 2.6, 0.55, 1.1, rotY);
  b.addRoundedSlab('champagneMetal', px, 0.72, opts.z, 13.4, 1.9, 0.35, 0.8, rotY);
  b.addRoundedSlab('hdrWarmGlow', px, 0.66, opts.z, 13.8, 2.2, 0.1, 0.9, rotY, false);

  // 2. Sleek floating architectural monolith frame (wide along X, thin along Z!)
  b.addBox('champagneMetal', px, 4.95, opts.z, 13.0, 7.6, 0.62, rotY);
  b.addBox('blackSteel', px, 4.95, opts.z, 12.6, 7.2, 0.74, rotY);
  b.addBox('hdrWarmGlow', px, 8.82, opts.z, 12.8, 0.14, 0.76, rotY);

  // 3. High-contrast designer screen mounted flush on the front (+Z local normal)
  b.addShowcaseScreen(
    px + normalX * 0.4,
    4.95,
    opts.z + normalZ * 0.4,
    rotY,
    12.2,
    6.8,
    {
      era: opts.era,
      title: opts.title,
      subtitle: opts.subtitle,
      metrics: opts.metrics,
      accentHex: opts.accentHex,
      secondaryHex: opts.secondaryHex,
      diagram: opts.diagram,
    },
    opts.customMap
  );
}

// ============================================================================
// ACT I: ROADSIDE SIGNS ("WELCOME TO THE PAST" & CROSSED-OUT "THE PAST") + GANTRIES
// ============================================================================
function buildAct1SignsAndGantries(b: ArchitectureBuilder) {
  // 1. Entrance Sign at z = +292 (Right side of road, angled toward driver)
  const buildHighwaySign = (z: number, crossedOut: boolean) => {
    const sx = 15.2;
    const rotY = -0.28;
    const nx = Math.sin(rotY);
    const nz = Math.cos(rotY);

    b.addRoundedSlab('lightConcrete', sx, 0.17, z, 9.6, 2.2, 0.45, 0.8, rotY);
    b.addBox('blackSteel', sx - Math.cos(rotY) * 3.4, 3.6, z + Math.sin(rotY) * 3.4, 0.28, 6.8, 0.28, rotY);
    b.addBox('blackSteel', sx + Math.cos(rotY) * 3.4, 3.6, z - Math.sin(rotY) * 3.4, 0.28, 6.8, 0.28, rotY);
    b.addBox('darkBronze', sx, 4.6, z, 9.2, 4.6, 0.36, rotY);
    b.addBox('hdrWarmGlow', sx, 6.98, z, 8.8, 0.12, 0.44, rotY);
    b.addPastRoadSign(sx + nx * 0.22, 4.6, z + nz * 0.22, rotY, 8.8, 4.4, crossedOut);
  };

  buildHighwaySign(292, false); // WELCOME TO THE PAST
  buildHighwaySign(108, true);  // CROSSED-OUT "THE PAST" right before Ribbed Gate!

  // 2. Overhead Web 2.0 Gantry Portals
  const gantries = [
    {
      z: 245,
      leftTitle: 'PHP 5 · MYSQL · APACHE',
      leftSub: 'LAMP STACK · SERVER-SIDE TEMPLATES · FTP DEPLOY',
      rightTitle: 'WORDPRESS · CMS',
      rightSub: 'CUSTOM THEMES · PLUGINS · MONOLITHIC BLOGS',
      accent: '#f59e0b',
    },
    {
      z: 162,
      leftTitle: 'BOOTSTRAP 2 · JQUERY',
      leftSub: '12-COLUMN GRIDS · DOM MANIPULATION · AJAX',
      rightTitle: 'WEB 2.0 · TABLE LAYOUTS',
      rightSub: 'XHTML 1.0 · FLASH BANNERS · SKEUOMORPHIC UI',
      accent: '#38bdf8',
    },
  ];

  for (const g of gantries) {
    for (const side of [-1, 1] as const) {
      const px = side * 14.8;
      b.addBox('darkBronze', px, 0.8, g.z, 1.8, 1.6, 2.2);
      b.addBox('blackSteel', px, 6.8, g.z - 0.65, 0.55, 13.2, 0.55);
      b.addBox('blackSteel', px, 6.8, g.z + 0.65, 0.55, 13.2, 0.55);
      b.addBox('hdrWarmGlow', px - side * 0.32, 6.8, g.z, 0.1, 11.5, 0.18);
    }

    b.addBox('blackSteel', 0, 11.0, g.z, 31.2, 0.45, 1.8);
    b.addBox('blackSteel', 0, 13.8, g.z, 31.2, 0.45, 1.8);
    b.addBox('darkBronze', 0, 12.4, g.z - 0.75, 30.8, 2.5, 0.2);
    b.addBox('hdrWarmGlow', 0, 10.72, g.z, 26.5, 0.1, 0.3);

    b.addSignBoard(-6.4, 12.4, g.z + 0.96, 0, 11.8, 2.55, g.leftTitle, g.leftSub, {
      bg: '#0c1220',
      fg: '#f8fafc',
      accent: g.accent,
      border: true,
      tag: 'ERA 01 // LEGACY WEB 2.0',
    });
    b.addSignBoard(6.4, 12.4, g.z + 0.96, 0, 11.8, 2.55, g.rightTitle, g.rightSub, {
      bg: '#0c1220',
      fg: '#f8fafc',
      accent: g.accent,
      border: true,
      tag: 'ERA 01 // LEGACY WEB 2.0',
    });
  }
}

// ============================================================================
// TEMPORAL TRANSITION: THE RIBBED GATE IN LIGHT FORMWORK CONCRETE + HDR GLOW
// ============================================================================
function buildRibbedGateVault(b: ArchitectureBuilder) {
  const numRibs = 30;
  const zStart = 98;
  const zEnd = -32;
  const step = (zStart - zEnd) / (numRibs - 1);

  for (let i = 0; i < numRibs; i++) {
    const u = i / (numRibs - 1);
    const z = zStart - i * step;

    const H = 15 + 21 * Math.pow(Math.sin(Math.PI * u), 0.85);
    const W = 25 + 3.5 * Math.sin(Math.PI * u);
    const sway = 6.2 * Math.sin(i * 0.42 + 0.6);

    const outer: THREE.Vector2[] = [];
    const inner: THREE.Vector2[] = [];
    const strip: THREE.Vector2[] = [];
    const K = 28;

    for (let k = 0; k <= K; k++) {
      const uu = -1 + (2 * k) / K;
      const y = H * (1 - uu * uu);
      outer.push(new THREE.Vector2(W * uu + sway * (y / H), y));
    }
    for (let k = K; k >= 0; k--) {
      const uu = -1 + (2 * k) / K;
      const y = (H - 1.75) * (1 - uu * uu);
      inner.push(new THREE.Vector2((W - 3.4) * uu + sway * (y / H), y));
    }

    for (let k = 0; k <= K; k++) {
      const uu = -1 + (2 * k) / K;
      const y = (H - 1.75) * (1 - uu * uu);
      strip.push(new THREE.Vector2((W - 3.4) * uu + sway * (y / H), y));
    }
    for (let k = K; k >= 0; k--) {
      const uu = -1 + (2 * k) / K;
      const y = Math.max(0, (H - 1.75) * (1 - uu * uu) - 0.52);
      strip.push(new THREE.Vector2((W - 3.4) * uu * 0.995 + sway * (y / H), y));
    }

    const ribShape = new THREE.Shape([...outer, ...inner]);
    const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
      depth: 1.55,
      bevelEnabled: false,
      curveSegments: 1,
    });
    ribGeo.translate(0, 0, z - 0.775);
    const uv = ribGeo.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, uv.getX(k) / 8, uv.getY(k) / 8);
    }
    b.pushGeo('lightConcrete', ribGeo);

    const stripGeo = new THREE.ExtrudeGeometry(new THREE.Shape(strip), {
      depth: 1.05,
      bevelEnabled: false,
      curveSegments: 1,
    });
    stripGeo.translate(0, 0, z - 0.525);
    b.pushGeo('hdrWarmGlow', stripGeo);
  }
}

// ============================================================================
// ACT II STATION 1 (z = -60..-170): WEB PLATFORMS
// Left: Kestrel Sky-Atrium with Circular Ring Chandeliers + Confluence Pavilion
// Right: Exact Confluence Cascading Rounded Terraces (Screenshot 3!)
// ============================================================================
function buildCluster1WebArchitecture(
  b: ArchitectureBuilder,
  treePlacements: TreePlacement[],
  webMap?: THREE.Texture
) {
  const groundY = 0.17;
  const zMin = -152;
  const zMax = -68;
  const zCenter = (zMin + zMax) * 0.5; // -110
  const spanZ = zMax - zMin;

  // 1. LEFT SIDE: Kestrel Sky-Atrium with 5 Circular Glowing Ring Chandeliers inside
  b.addBox('ivoryCeramic', -23.5, groundY + 0.15, zCenter, 3.8, 0.3, spanZ - 2);
  b.addBox('hdrWarmGlow', -21.55, groundY + 0.12, zCenter, 0.14, 0.08, spanZ - 4);

  const atriumH = 13.5;
  const atriumFrontX = -25.2;
  const atriumBackX = -43.0;
  const atriumDepth = atriumFrontX - atriumBackX;

  b.addBox('interiorFloorStone', (atriumFrontX + atriumBackX) * 0.5, groundY + 0.28, zCenter, atriumDepth, 0.24, spanZ - 3);
  b.addBox('warmTimber', atriumBackX, groundY + atriumH * 0.5, zCenter, 0.8, atriumH, spanZ - 3);
  b.addBox('emissiveWarmSoft', atriumBackX + 0.55, groundY + atriumH - 0.7, zCenter, 0.3, 0.4, spanZ - 6);

  b.addRoundedSlab('ivoryCeramic', -34.0, groundY + 6.2, zCenter, 12.5, spanZ - 10, 0.55, 4);
  b.addRoundedSlab('champagneMetal', -34.0, groundY + 6.75, zCenter, 12.7, spanZ - 9.8, 0.18, 4);
  b.addRoundedSlab('hdrWarmGlow', -34.0, groundY + 6.1, zCenter, 12.8, spanZ - 9.6, 0.12, 4, 0, false);

  for (let i = -2; i <= 2; i++) {
    const rz = zCenter + i * 13.5;
    b.addTorus('hdrWarmGlow', -30.5, groundY + 9.8, rz, 2.85, 0.13);
    b.addTorus('champagneMetal', -30.5, groundY + 9.96, rz, 2.85, 0.08);
  }

  const colCount = 11;
  for (let i = 0; i < colCount; i++) {
    const cz = zMin + 3.0 + (i / (colCount - 1)) * (spanZ - 6.0);
    b.addCylinder('champagneMetal', -23.0, groundY + atriumH * 0.5, cz, 0.26, 0.34, atriumH, 10, 0.09 * (i % 2 === 0 ? 1 : -1));
    b.addBox('champagneMetal', atriumFrontX, groundY + atriumH * 0.5, cz, 0.32, atriumH, 0.14);
  }

  b.addRoundedSlab('ivoryCeramic', -24.5, groundY + atriumH, zCenter, 6.5, spanZ + 1.5, 1.1, 4);
  b.addRoundedSlab('hdrWarmGlow', -24.5, groundY + atriumH + 0.95, zCenter, 6.65, spanZ + 1.6, 0.14, 4, 0, false);
  b.addBox('storefrontGlass', atriumFrontX, groundY + atriumH * 0.5, zCenter, 0.06, atriumH - 0.3, spanZ - 4);

  // Setback Confluence Terrace levels above the Kestrel Atrium (solid core + dark emerald glass)
  buildConfluenceTerraces(b, treePlacements, {
    x: -46,
    z: zCenter,
    floors: 6,
    w: 36,
    d: 68,
    angle: -0.03,
    glassMat: 'confluenceGlass',
    glowMat: 'hdrWarmGlow',
    stepSignX: -1,
  });

  // 2. RIGHT SIDE: Exact Confluence Cascading Rounded Terraces (Screenshot 3!) + Courtyard Pavilion (Screenshot 1!)
  buildConfluenceTerraces(b, treePlacements, {
    x: 56,
    z: -95,
    floors: 9,
    w: 58,
    d: 88,
    angle: 0.05,
    glassMat: 'confluenceGlass',
    glowMat: 'hdrWarmGlow',
    stepSignX: 1,
  });

  buildConfluencePavilion(b, {
    x: 46,
    z: -158,
    w: 38,
    d: 48,
    h: 15,
    rotY: -0.08,
    glassMat: 'confluenceGlass',
  });

  // SINGLE Designer Project Totem #1 for Web Platforms (`z = -95`, West side)
  buildDesignerProjectTotem(b, {
    side: 'WEST',
    z: -95,
    era: 'ПРОЕКТ 01 // ВЕБ',
    title: 'ВЕБ-ПЛАТФОРМЫ',
    subtitle: 'Сайты и интерактив под ключ · 3D · Next.js',
    metrics: ['ПОД КЛЮЧ|от идеи до запуска', 'NEXT.JS · TS|современный стек', '3D · WEBGL|живой интерактив'],
    accentHex: '#f59e0b',
    secondaryHex: '#38bdf8',
    customMap: webMap, // the live browser-window screen of the client sites
  });
}

// ============================================================================
// ACT II STATION 2 (z = -185..-305): ALBION BOT & UNOBSTRUCTED SPINDLE SKYSCRAPER
// ============================================================================
function buildCluster2AlbionAndSpindle(b: ArchitectureBuilder, treePlacements: TreePlacement[]) {
  // 1. LEFT SIDE: THE SPINDLE (262m Hyperboloid Diagrid Skyscraper in Light Tones)
  const cx = -102;
  const cz = -240;
  const H = 262;
  const R0 = 38;
  const R1 = 31;
  const twist = 1.7;
  const N = 40;

  b.addCylinder('plazaStone', cx, 0.12, cz, 86, 86, 0.24, 72);
  b.addCylinder('lightConcrete', cx, 0.55, cz, 72, 72, 1.1, 72);
  b.addCylinder('hdrWarmGlow', cx, 0.98, cz, 68.5, 68.5, 0.26, 72, 0, 0, true);
  b.addCylinder('lightConcrete', cx, 1.1, cz, 48, 51, 1.6, 64);

  b.addBox('ivoryCeramic', -44, 0.65, cz, 44, 0.75, 14.0);
  b.addBox('hdrWarmGlow', -44, 1.06, cz - 6.7, 44, 0.16, 0.28);
  b.addBox('hdrWarmGlow', -44, 1.06, cz + 6.7, 44, 0.16, 0.28);

  for (let i = 0; i < N; i++) {
    const ph = (i / N) * Math.PI * 2;
    const A = new THREE.Vector3(cx + R0 * Math.cos(ph), 1.4, cz + R0 * Math.sin(ph));
    for (const sg of [1, -1] as const) {
      const B = new THREE.Vector3(cx + R1 * Math.cos(ph + sg * twist), H, cz + R1 * Math.sin(ph + sg * twist));
      b.addBeam('silverMetal', A, B, 1.15, 0.7, 6);
    }
    b.addBox('lightConcrete', A.x, 1.6, A.z, 4.2, 3.2, 4.2, -ph);
  }

  const radiusAt = (t: number) => Math.hypot((1 - t) * R0 + t * R1 * Math.cos(twist), t * R1 * Math.sin(twist));
  const FL = 26;
  for (let k = 1; k <= FL; k++) {
    const t = k / (FL + 1);
    const y = 1.4 + t * (H - 1.4);
    const r = radiusAt(t);
    b.addCylinder('ivoryCeramic', cx, y, cz, r - 0.3, r - 0.3, 1.0, 40);
    b.addCylinder(k % 3 === 0 ? 'hdrCyanGlow' : 'hdrWarmGlow', cx, y - 0.2, cz, r + 0.55, r + 0.55, 0.34, 40, 0, 0, true);

    if (k % 3 === 0) {
      for (let a = 0; a < 6; a++) {
        const ph = (a / 6) * Math.PI * 2 + k;
        b.addBeam(
          'silverMetal',
          new THREE.Vector3(cx, y, cz),
          new THREE.Vector3(cx + Math.cos(ph) * (r - 0.5), y - 0.4, cz + Math.sin(ph) * (r - 0.5)),
          0.28,
          0.28,
          5
        );
      }
    }
  }

  b.addCylinder('lightConcrete', cx, (H + 22) / 2, cz, 5.5, 7.5, H + 22, 20);
  b.addCylinder('hdrWarmGlow', cx, (H + 60) / 2 + 20, cz, 1.15, 1.15, H + 60, 8);
  b.addCylinder('ivoryCeramic', cx, H + 0.4, cz, R1 + 10, R1 + 3, 2.8, 48);
  b.addCylinder('hdrWarmGlow', cx, H + 1.0, cz, R1 + 10.2, R1 + 10.2, 0.38, 48, 0, 0, true);
  b.addCylinder('lightConcrete', cx, H + 5.8, cz, R1 - 6, R1 - 4, 9, 32);
  b.addCylinder('silverMetal', cx, H + 45, cz, 0.5, 1.4, 70, 8);

  // Low Confluence Courtyard Pavilion (Screenshot 1!) right beside the causeway at x = -44, z = -195
  buildConfluencePavilion(b, {
    x: -44,
    z: -195,
    w: 34,
    d: 42,
    h: 13,
    rotY: 0.1,
    glassMat: 'confluenceGlass',
  });

  // 2. RIGHT SIDE: Confluence Cascading Terraces in Mirror Glass + Courtyard Pavilion
  buildConfluenceTerraces(b, treePlacements, {
    x: 56,
    z: -242,
    floors: 8,
    w: 54,
    d: 82,
    angle: -0.05,
    glassMat: 'tintedGlassMirror',
    glowMat: 'hdrCyanGlow',
    stepSignX: 1,
  });

  // SINGLE Designer Project Totem #2 for Albion Bot (`z = -222`, West side)
  buildDesignerProjectTotem(b, {
    side: 'WEST',
    z: -222,
    era: 'ПРОЕКТ 02 // АВТОМАТИЗАЦИЯ',
    title: 'ALBION BOT',
    subtitle: 'Ассистент координатора репетиторов',
    metrics: ['MERITHUB|интеграция по API', 'TELEGRAM|уведомления', 'AI|заявки и сценарии'],
    accentHex: '#38bdf8',
    secondaryHex: '#f59e0b',
    diagram: 'albion',
  });
}

// ============================================================================
// ACT II STATION 3 (z = -320..-445): GIAS.BY TENDERS, GROVE HALL ("ГРИБЫ"),
// CONFLUENCE PAVILIONS & SINGLE CIRCULAR PORTAL ARCH (THE CONTINUUM)
// ============================================================================
function buildCluster3TendersAndContinuum(b: ArchitectureBuilder, treePlacements: TreePlacement[]) {
  // 1. AUTHENTIC GROVE HALL ("ГРИБЫ") FRAMING THE TENDERS ANALYTICS STATION (`z = -332..-396`)
  const groveRows: Array<[number, number]> = [
    [-25.5, -332],
    [-25.5, -368],
    [-25.5, -404],
    [25.5, -332],
    [25.5, -368],
    [25.5, -404],
  ];

  for (const [bx, bz] of groveRows) {
    b.addCylinder('lightConcrete', bx, 25.1, bz, 26.5, 21.5, 3.2, 6, 0, 0, false, Math.PI / 2);
    b.addCylinder('ivoryCeramic', bx, 26.3, bz, 26.7, 26.7, 0.55, 6, 0, 0, true, Math.PI / 2);
    b.addCylinder('hdrWarmGlow', bx, 23.38, bz, 18.8, 18.8, 0.22, 6, 0, 0, false, Math.PI / 2);

    b.addCylinder('lightConcrete', bx, 0.45, bz, 4.2, 4.8, 0.9, 16);
    b.addBeam('lightConcrete', new THREE.Vector3(bx, 0.9, bz), new THREE.Vector3(bx, 9.5, bz), 2.3, 1.6, 14);
    b.addCylinder('hdrWarmGlow', bx, 9.4, bz, 1.85, 1.85, 0.26, 14);

    const rot = (bx * 0.013 + bz * 0.007) % 1;
    for (let a = 0; a < 4; a++) {
      const ph = (a / 4) * Math.PI * 2 + rot;
      const p0 = new THREE.Vector3(bx, 9.3, bz);
      const p1 = new THREE.Vector3(bx + Math.cos(ph) * 4.8, 16.0, bz + Math.sin(ph) * 4.8);
      b.addBeam('lightConcrete', p0, p1, 1.35, 0.95, 10);

      for (const sg of [-1, 1] as const) {
        const ph2 = ph + sg * 0.34;
        const p2 = new THREE.Vector3(bx + Math.cos(ph2) * 16.4, 23.4, bz + Math.sin(ph2) * 16.4);
        b.addBeam('lightConcrete', p1, p2, 0.88, 0.52, 8);

        const mid = p1.clone().lerp(p2, 0.55);
        for (const s2 of [-1, 1] as const) {
          const ph3 = ph2 + s2 * 0.2;
          const p3 = new THREE.Vector3(bx + Math.cos(ph3) * 18.8, 23.4, bz + Math.sin(ph3) * 18.8);
          b.addBeam('lightConcrete', mid, p3, 0.48, 0.3, 6);
        }
      }
    }

    b.addLightAnchor(bx, 11.0, bz, 0xffd699, 11.0, 30.0);
  }

  // 2. Flanking Confluence Pavilions & Terraces (Screenshots 1, 2 & 3!)
  buildConfluencePavilion(b, {
    x: -64,
    z: -362,
    w: 42,
    d: 58,
    h: 16,
    rotY: 0.12,
    glassMat: 'confluenceGlass',
  });

  buildConfluenceTerraces(b, treePlacements, {
    x: 68,
    z: -366,
    floors: 7,
    w: 50,
    d: 76,
    angle: 0.06,
    glassMat: 'tintedGlassBronze',
    glowMat: 'hdrWarmGlow',
    stepSignX: 1,
  });

  // 3. SINGLE ICONIC CIRCULAR ARCH (`The Continuum` at z = -442) — Launch Portal to Space!
  const ringPos = new THREE.Vector3(0, 38, -442);
  const ringEuler = new THREE.Euler(0, -0.17, -0.18);
  const ringQuat = new THREE.Quaternion().setFromEuler(ringEuler);
  const ringMat4 = new THREE.Matrix4().compose(ringPos, ringQuat, new THREE.Vector3(0.88, 0.8, 1));

  const ringShape = new THREE.Shape();
  ringShape.absellipse(0, 0, 51, 65, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(3, -1, 40, 54, 0, Math.PI * 2, true, 0);
  ringShape.holes.push(hole);

  const ringGeo = new THREE.ExtrudeGeometry(ringShape, {
    depth: 16,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.65,
    bevelThickness: 0.65,
    curveSegments: 96,
    steps: 1,
  });
  ringGeo.translate(0, 0, -8);
  ringGeo.applyMatrix4(ringMat4);
  b.pushGeo('ivoryCeramic', ringGeo);

  for (const zOff of [-8.6, 8.6]) {
    const rimShape = new THREE.Shape();
    rimShape.absellipse(3, -1, 42, 56, 0, Math.PI * 2, false, 0);
    const inner = new THREE.Path();
    inner.absellipse(3, -1, 40.2, 54.2, 0, Math.PI * 2, true, 0);
    rimShape.holes.push(inner);
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.4, bevelEnabled: false, curveSegments: 72 });
    rimGeo.translate(0, 0, zOff - 0.2);
    rimGeo.applyMatrix4(ringMat4);
    b.pushGeo('champagneMetal', rimGeo);
  }

  const glowRingShape = new THREE.Shape();
  glowRingShape.absellipse(3, -1, 40.3, 54.3, 0, Math.PI * 2, false, 0);
  const glowInner = new THREE.Path();
  glowInner.absellipse(3, -1, 39.7, 53.7, 0, Math.PI * 2, true, 0);
  glowRingShape.holes.push(glowInner);
  const glowRingGeo = new THREE.ExtrudeGeometry(glowRingShape, { depth: 1.4, bevelEnabled: false, curveSegments: 72 });
  glowRingGeo.translate(0, 0, -0.7);
  glowRingGeo.applyMatrix4(ringMat4);
  b.pushGeo('hdrWarmGlow', glowRingGeo);

  for (const x of [-32, 34]) {
    b.addRoundedSlab('lightConcrete', x, 0.17, -442, 26, 39, 1.4, 10);
    b.addRoundedSlab('ivoryCeramic', x, 1.57, -442, 23, 35, 1.5, 8);
    b.addRoundedSlab('hdrWarmGlow', x, 1.48, -442, 24.5, 36.5, 0.16, 9, 0, false);
  }

  // SINGLE Designer Project Totem #3 for GIAS.BY Tenders (`z = -345`, East side)
  buildDesignerProjectTotem(b, {
    side: 'EAST',
    z: -345,
    era: 'ПРОЕКТ 03 // ТЕНДЕРЫ И АНАЛИТИКА',
    title: 'ТЕНДЕРНЫЙ БОТ',
    subtitle: 'Аналитика госзакупок Беларуси',
    metrics: ['API GIAS.BY|данные о торгах', 'КОНКУРЕНТЫ|анализ участия', 'ПЛАНЫ ЗАКУПОК|анализ и фильтр'],
    accentHex: '#f59e0b',
    secondaryHex: '#38bdf8',
    diagram: 'tenders',
  });
}

export function buildWorldArchitecture(
  palette: MaterialPalette,
  maxAnisotropy: number
): { group: THREE.Group; lightAnchors: LightAnchor[]; treePlacements: TreePlacement[]; webScreen: SiteScreen } {
  const builder = new ArchitectureBuilder(maxAnisotropy);
  const treePlacements: TreePlacement[] = [];

  const act1Buildings: BuildingSpec[] = [
    // WEST ROW (facing +X toward the road)
    {
      id: 'act1-w1',
      xMin: -54,
      xMax: -25.5,
      zMin: 235,
      zMax: 280,
      podiumH: 5.8,
      floors: 8,
      floorH: 3.65,
      wallMat: 'darkBrick',
      secondaryMat: 'warmStone',
      trimMat: 'blackSteel',
      bayWidth: 3.8,
      windowRatioW: 0.68,
      windowRatioH: 0.7,
      recessDepth: 0.38,
      litProbability: 0.62,
      style: 'industrial-loft',
      balconies: true,
      setbackAtFloor: 6,
      setbackMeters: 3.2,
      roofProps: {
        waterTower: true,
        billboard: { title: 'WINAMP', sub: 'IT REALLY WHIPS THE LLAMA' },
        antennas: 2,
      },
      activeFaces: [
        {
          facing: '+X',
          storefront: {
            title: 'FOUNDATION LABS',
            subtitle: 'EARLY WEB · PHP 5 · MYSQL · APACHE',
            signStyle: { bg: '#121826', fg: '#f5ebd6', accent: '#f59e0b', serif: false, border: true },
            theme: 'books',
            canopyMat: 'blackSteel',
          },
        },
      ],
      seed: 101,
    },
    {
      id: 'act1-w2',
      xMin: -54,
      xMax: -25.5,
      zMin: 284,
      zMax: 330,
      podiumH: 5.4,
      floors: 6,
      floorH: 3.55,
      wallMat: 'warmStone',
      secondaryMat: 'paleLimestone',
      trimMat: 'darkBronze',
      bayWidth: 3.6,
      windowRatioW: 0.7,
      windowRatioH: 0.68,
      recessDepth: 0.36,
      litProbability: 0.66,
      style: 'beaux-arts',
      roofProps: { antennas: 2 },
      activeFaces: [
        {
          facing: '+X',
          storefront: {
            title: 'INTERNET CAFE',
            subtitle: '56K MODEMS · WEBMAIL · ICQ',
            signStyle: { bg: '#0e1a24', fg: '#eef7ff', accent: '#38bdf8', serif: false, border: true },
            theme: 'computer',
            canopyMat: 'darkBronze',
          },
        },
      ],
      seed: 111,
    },
    {
      id: 'act1-w3',
      xMin: -54,
      xMax: -25.5,
      zMin: 118,
      zMax: 168,
      podiumH: 5.8,
      floors: 10,
      floorH: 3.65,
      wallMat: 'warmBrick',
      secondaryMat: 'limestone',
      trimMat: 'darkBronze',
      bayWidth: 3.7,
      windowRatioW: 0.68,
      windowRatioH: 0.7,
      recessDepth: 0.38,
      litProbability: 0.64,
      style: 'beaux-arts',
      balconies: true,
      setbackAtFloor: 7,
      setbackMeters: 3.0,
      activeFaces: [
        {
          facing: '+X',
          storefront: {
            title: 'WORDPRESS ATELIER',
            subtitle: 'CMS ARCHITECTURE · BOOTSTRAP GRIDS',
            signStyle: { bg: '#181412', fg: '#f4e8d6', accent: '#d89b52', serif: true, border: true },
            theme: 'bistro',
            canopyMat: 'darkBronze',
          },
        },
      ],
      seed: 202,
    },
    {
      id: 'act1-w4',
      xMin: -54,
      xMax: -25.5,
      zMin: 172,
      zMax: 222,
      podiumH: 5.6,
      floors: 9,
      floorH: 3.6,
      wallMat: 'darkBrick',
      secondaryMat: 'warmStone',
      trimMat: 'blackSteel',
      bayWidth: 3.9,
      windowRatioW: 0.66,
      windowRatioH: 0.68,
      recessDepth: 0.4,
      litProbability: 0.6,
      style: 'industrial-loft',
      roofProps: {
        billboard: { title: 'FREE RINGTONES', sub: 'POLYPHONIC HITS · SMS 3344' },
        antennas: 1,
      },
      activeFaces: [
        {
          facing: '+X',
          storefront: {
            title: 'PC CLUB · CYBER ARENA',
            subtitle: 'COUNTER-STRIKE 1.6 · LAN TOURNEYS',
            signStyle: { bg: '#0d1420', fg: '#e8f2ff', accent: '#38bdf8', serif: false, border: true },
            theme: 'computer',
            canopyMat: 'blackSteel',
          },
        },
      ],
      seed: 212,
    },
    // EAST ROW (facing -X toward the road)
    {
      id: 'act1-e1',
      xMin: 25.5,
      xMax: 54,
      zMin: 235,
      zMax: 278,
      podiumH: 5.8,
      floors: 9,
      floorH: 3.65,
      wallMat: 'limestone',
      secondaryMat: 'archConcrete',
      trimMat: 'darkBronze',
      bayWidth: 3.8,
      windowRatioW: 0.7,
      windowRatioH: 0.7,
      recessDepth: 0.38,
      litProbability: 0.58,
      style: 'beaux-arts',
      setbackAtFloor: 6,
      setbackMeters: 3.0,
      activeFaces: [
        {
          facing: '-X',
          storefront: {
            title: 'MONOLITH ARCHIVE',
            subtitle: 'WEB 2.0 · JQUERY · TABLE LAYOUTS',
            signStyle: { bg: '#151922', fg: '#f0eadf', accent: '#38bdf8', serif: false, border: true },
            theme: 'gallery',
            canopyMat: 'darkBronze',
          },
        },
      ],
      seed: 303,
    },
    {
      id: 'act1-e2',
      xMin: 25.5,
      xMax: 54,
      zMin: 282,
      zMax: 330,
      podiumH: 5.5,
      floors: 7,
      floorH: 3.6,
      wallMat: 'flutedConcrete',
      secondaryMat: 'archConcrete',
      trimMat: 'champagneMetal',
      bayWidth: 3.9,
      windowRatioW: 0.74,
      windowRatioH: 0.72,
      recessDepth: 0.36,
      litProbability: 0.64,
      style: 'fluted-gallery',
      verticalFins: true,
      roofProps: {
        billboard: { title: 'ICQ · UIN', sub: 'UH-OH! MESSENGER INSIDE' },
        antennas: 3,
      },
      activeFaces: [
        {
          facing: '-X',
          storefront: {
            title: 'FLASH PORTAL',
            subtitle: 'NEWGROUNDS · MINICLIP · SHOCKWAVE',
            signStyle: { bg: '#101828', fg: '#eef4ff', accent: '#38bdf8', serif: false, border: true },
            theme: 'computer',
            canopyMat: 'blackSteel',
          },
        },
      ],
      seed: 313,
    },
    {
      id: 'act1-e3',
      xMin: 25.5,
      xMax: 54,
      zMin: 118,
      zMax: 166,
      podiumH: 5.8,
      floors: 11,
      floorH: 3.65,
      wallMat: 'flutedConcrete',
      secondaryMat: 'archConcrete',
      trimMat: 'champagneMetal',
      bayWidth: 3.9,
      windowRatioW: 0.74,
      windowRatioH: 0.72,
      recessDepth: 0.36,
      litProbability: 0.64,
      style: 'fluted-gallery',
      verticalFins: true,
      setbackAtFloor: 8,
      setbackMeters: 3.2,
      activeFaces: [
        {
          facing: '-X',
          storefront: {
            title: 'CHRONO DYNAMICS',
            subtitle: 'TEMPORAL DISPLACEMENT · 88 MPH',
            signStyle: { bg: '#111622', fg: '#eef4ff', accent: '#38bdf8', serif: false, border: true },
            theme: 'horology',
            canopyMat: 'blackSteel',
          },
        },
      ],
      seed: 404,
    },
    {
      id: 'act1-e4',
      xMin: 25.5,
      xMax: 54,
      zMin: 170,
      zMax: 222,
      podiumH: 5.6,
      floors: 8,
      floorH: 3.6,
      wallMat: 'warmBrick',
      secondaryMat: 'limestone',
      trimMat: 'darkBronze',
      bayWidth: 3.75,
      windowRatioW: 0.68,
      windowRatioH: 0.7,
      recessDepth: 0.38,
      litProbability: 0.62,
      style: 'beaux-arts',
      balconies: true,
      roofProps: { antennas: 2 },
      activeFaces: [
        {
          facing: '-X',
          storefront: {
            title: 'MOBILE WORLD',
            subtitle: 'NOKIA · SIEMENS · MOTOROLA RAZR',
            signStyle: { bg: '#10141c', fg: '#f0f4fa', accent: '#f59e0b', serif: false, border: true },
            theme: 'design',
            canopyMat: 'darkBronze',
          },
        },
      ],
      seed: 414,
    },
    // BACKGROUND SECOND ROW — taller dark masses behind the front facades
    {
      id: 'act1-bgw1',
      xMin: -79,
      xMax: -58,
      zMin: 130,
      zMax: 208,
      podiumH: 3.0,
      floors: 15,
      floorH: 3.5,
      wallMat: 'darkBrick',
      secondaryMat: 'warmStone',
      trimMat: 'blackSteel',
      bayWidth: 4.1,
      windowRatioW: 0.66,
      windowRatioH: 0.66,
      recessDepth: 0.3,
      litProbability: 0.34,
      style: 'industrial-loft',
      activeFaces: [{ facing: '+X' }],
      seed: 505,
    },
    {
      id: 'act1-bgw2',
      xMin: -77,
      xMax: -59,
      zMin: 242,
      zMax: 316,
      podiumH: 3.0,
      floors: 12,
      floorH: 3.5,
      wallMat: 'warmBrick',
      secondaryMat: 'limestone',
      trimMat: 'darkBronze',
      bayWidth: 4.0,
      windowRatioW: 0.66,
      windowRatioH: 0.66,
      recessDepth: 0.3,
      litProbability: 0.3,
      style: 'beaux-arts',
      activeFaces: [{ facing: '+X' }],
      seed: 515,
    },
    {
      id: 'act1-bge1',
      xMin: 58,
      xMax: 79,
      zMin: 136,
      zMax: 214,
      podiumH: 3.0,
      floors: 16,
      floorH: 3.5,
      wallMat: 'warmBrick',
      secondaryMat: 'limestone',
      trimMat: 'darkBronze',
      bayWidth: 4.0,
      windowRatioW: 0.66,
      windowRatioH: 0.66,
      recessDepth: 0.3,
      litProbability: 0.32,
      style: 'beaux-arts',
      activeFaces: [{ facing: '-X' }],
      seed: 525,
    },
    {
      id: 'act1-bge2',
      xMin: 60,
      xMax: 77,
      zMin: 246,
      zMax: 318,
      podiumH: 3.0,
      floors: 13,
      floorH: 3.5,
      wallMat: 'darkBrick',
      secondaryMat: 'warmStone',
      trimMat: 'blackSteel',
      bayWidth: 4.1,
      windowRatioW: 0.66,
      windowRatioH: 0.66,
      recessDepth: 0.3,
      litProbability: 0.36,
      style: 'industrial-loft',
      activeFaces: [{ facing: '-X' }],
      seed: 535,
    },
  ];

  for (const spec of act1Buildings) {
    buildAuthoredBuilding(builder, spec);
  }

  buildBladeSigns(builder);
  buildStreetWires(builder);

  buildAct1SignsAndGantries(builder);
  buildRibbedGateVault(builder);
  const webScreen = createSiteScreen(maxAnisotropy);
  buildCluster1WebArchitecture(builder, treePlacements, webScreen.texture);
  buildCluster2AlbionAndSpindle(builder, treePlacements);
  buildCluster3TendersAndContinuum(builder, treePlacements);

  return {
    group: builder.buildGroup(palette),
    lightAnchors: builder.lightAnchors,
    treePlacements,
    webScreen,
  };
}
