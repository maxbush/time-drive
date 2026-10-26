import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeIntoChunks } from './chunkedMerge';
import { LightAnchor } from './architectureBuilder';
import { MaterialPalette } from './materials';
import { TreePlacement } from './trees';

export interface AvenueSystem {
  group: THREE.Group;
  roadMesh: THREE.Mesh;
  lightAnchors: LightAnchor[];
  treePlacements: TreePlacement[];
  update: (time: number) => void;
}

function makeWorldUVBox(
  sx: number,
  sy: number,
  sz: number,
  cx: number,
  cy: number,
  cz: number,
  tile = 2.4
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + cx;
    const py = pos.getY(i) + cy;
    const pz = pos.getZ(i) + cz;
    if (Math.abs(norm.getY(i)) > 0.7) {
      uv.setXY(i, px / tile, pz / tile);
    } else if (Math.abs(norm.getX(i)) > 0.7) {
      uv.setXY(i, pz / tile, py / tile);
    } else {
      uv.setXY(i, px / tile, py / tile);
    }
  }
  geo.translate(cx, cy, cz);
  return geo;
}

function makeTransformedGeo(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m);
  return g;
}

export function buildGrandAvenue(palette: MaterialPalette): AvenueSystem {
  const group = new THREE.Group();
  const lightAnchors: LightAnchor[] = [];
  const treePlacements: TreePlacement[] = [];

  // ===========================================================================
  // 1. CROWNED, ORGANICALLY CAMBERED 22m DAMP ASPHALT ROADWAY (z = +360 to -460)
  // ===========================================================================
  const roadWidth = 22.0;
  const roadZStart = 360;
  const roadZEnd = -470;
  const roadLen = roadZStart - roadZEnd;
  const roadZCenter = (roadZStart + roadZEnd) * 0.5;

  const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLen, 28, 240);
  const rPos = roadGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const px = rPos.getX(i);
    const py = rPos.getY(i);
    const normX = px / (roadWidth * 0.5);
    // Natural road crown + subtle organic micro-relief across lanes
    const crownZ =
      (1.0 - normX * normX) * 0.065 +
      Math.sin(py * 0.06 + px * 0.4) * 0.008 +
      Math.cos(py * 0.19 - px * 0.7) * 0.004;
    rPos.setZ(i, crownZ);
  }
  roadGeo.computeVertexNormals();
  roadGeo.rotateX(-Math.PI / 2);
  roadGeo.translate(0, 0, roadZCenter);

  const roadMesh = new THREE.Mesh(roadGeo, palette.asphalt);
  roadMesh.receiveShadow = true;
  roadMesh.name = 'mainAsphaltRoad';
  group.add(roadMesh);

  // Solid architectural dark basalt & stone urban ground
  const baseGroundGeo = new THREE.PlaneGeometry(1800, 1400);
  baseGroundGeo.rotateX(-Math.PI / 2);
  baseGroundGeo.translate(0, -0.05, -60);
  const baseGroundMesh = new THREE.Mesh(baseGroundGeo, palette.basaltStrip);
  baseGroundMesh.receiveShadow = true;
  group.add(baseGroundMesh);

  // ===========================================================================
  // 2. STEPPED PROMENADE SIDEWALKS, SCULPTED LAWN PLANTER ISLANDS & PARK MOUNDS
  // ===========================================================================
  const paverGeos: THREE.BufferGeometry[] = [];
  const basaltGeos: THREE.BufferGeometry[] = [];
  const curbGeos: THREE.BufferGeometry[] = [];
  const grassGeos: THREE.BufferGeometry[] = [];
  const whitePaintGeos: THREE.BufferGeometry[] = [];
  const amberPaintGeos: THREE.BufferGeometry[] = [];
  const bronzeGeos: THREE.BufferGeometry[] = [];
  const steelGeos: THREE.BufferGeometry[] = [];
  const lightConcreteGeos: THREE.BufferGeometry[] = [];
  const ivoryCeramicGeos: THREE.BufferGeometry[] = [];
  const hdrWarmGeos: THREE.BufferGeometry[] = [];
  const hdrCyanGeos: THREE.BufferGeometry[] = [];

  const curbH = 0.18;
  const curbW = 0.36;
  const swH = 0.17;

  const addPromenadeSidewalk = (side: -1 | 1, zMin: number, zMax: number, outerWidth = 14.5) => {
    const innerX = side * 11.0;
    const outerX = side * (11.0 + outerWidth);
    const xMin = Math.min(innerX, outerX);
    const xMax = Math.max(innerX, outerX);
    const cx = (xMin + xMax) * 0.5;
    const cz = (zMin + zMax) * 0.5;
    const sx = xMax - xMin;
    const sz = zMax - zMin;

    paverGeos.push(makeWorldUVBox(sx, swH, sz, cx, swH * 0.5, cz, 2.4));

    const curbX = side * (11.0 + curbW * 0.5);
    curbGeos.push(makeWorldUVBox(curbW, curbH, sz, curbX, curbH * 0.5, cz, 1.5));

    const stripW = 1.45;
    const stripX = side * (11.0 + curbW + stripW * 0.5);
    basaltGeos.push(makeWorldUVBox(stripW, 0.018, sz, stripX, swH + 0.006, cz, 1.6));

    for (let z = zMin + 4; z < zMax; z += 6.0) {
      basaltGeos.push(makeWorldUVBox(sx - curbW, 0.01, 0.05, cx + side * 0.15, swH + 0.004, z, 1.0));
    }
  };

  addPromenadeSidewalk(-1, -455, 355, 14.5);
  addPromenadeSidewalk(1, -455, 355, 14.5);

  paverGeos.push(makeWorldUVBox(110, swH - 0.02, 820, -80, (swH - 0.02) * 0.5, -50, 3.6));
  paverGeos.push(makeWorldUVBox(110, swH - 0.02, 820, 80, (swH - 0.02) * 0.5, -50, 3.6));

  // SCULPTED STONE & GRASS LAWN PLANTER ISLANDS ON THE SIDEWALKS + ELM TREES
  // Breaks up the flat sidewalk with raised travertine/ceramic planter beds, lush grass mounds, warm benches & real 3D elm trees!
  const planterZPositions = [
    315, 275, 205, 138, // Act I Old Town planters
    -52, -148, -178, -280, -312, -412, // Act II Modern Boulevard planters (kept clear of showcase totems!)
  ];

  for (const pz of planterZPositions) {
    for (const side of [-1, 1] as const) {
      const px = side * 15.6;
      const pW = 3.8;
      const pL = 13.5;
      const pH = 0.42;

      // Raised stone planter border & warm recessed LED base strip
      ivoryCeramicGeos.push(makeWorldUVBox(pW, pH, pL, px, swH + pH * 0.5, pz, 2.0));
      bronzeGeos.push(makeWorldUVBox(pW + 0.16, 0.08, pL + 0.16, px, swH + pH + 0.02, pz, 1.0));
      hdrWarmGeos.push(makeWorldUVBox(pW - 0.3, 0.05, pL - 0.3, px, swH + 0.04, pz, 1.0));

      // Lush slightly mounded grass turf bed inside the planter
      grassGeos.push(makeWorldUVBox(pW - 0.48, 0.16, pL - 0.48, px, swH + pH + 0.04, pz, 2.2));

      // Place real 3D elm tree (`tree_elm.glb`) in the planter bed
      treePlacements.push({
        x: px,
        y: swH + pH + 0.08,
        z: pz,
        scale: 0.92 + ((Math.abs(pz) % 5) * 0.06),
        rotY: pz * 0.37 + side * 1.2,
      });
    }
  }

  // Distant Rolling Green Parkland / Lawn Strips flanking the modern district (`x = +-82m`)
  for (const side of [-1, 1] as const) {
    grassGeos.push(makeWorldUVBox(46, 0.35, 420, side * 88, swH + 0.12, -230, 4.5));
    for (let z = -410; z <= -60; z += 55) {
      treePlacements.push({
        x: side * (74 + ((Math.abs(z) % 3) * 6)),
        y: swH + 0.28,
        z,
        scale: 1.25 + ((Math.abs(z) % 4) * 0.12),
        rotY: z * 0.51,
      });
    }
  }

  // ===========================================================================
  // 3. THERMOPLASTIC LANE MARKINGS, MANHOLES, STORM DRAINS & WARM ROAD STUDS
  // ===========================================================================
  amberPaintGeos.push(makeWorldUVBox(0.14, 0.009, roadLen - 10, -0.18, 0.064, roadZCenter, 2.0));
  amberPaintGeos.push(makeWorldUVBox(0.14, 0.009, roadLen - 10, 0.18, 0.064, roadZCenter, 2.0));

  whitePaintGeos.push(makeWorldUVBox(0.16, 0.009, roadLen - 10, -10.1, 0.016, roadZCenter, 2.0));
  whitePaintGeos.push(makeWorldUVBox(0.16, 0.009, roadLen - 10, 10.1, 0.016, roadZCenter, 2.0));

  for (let z = -455; z <= 345; z += 9.0) {
    whitePaintGeos.push(makeWorldUVBox(0.14, 0.009, 3.4, -5.2, 0.048, z, 1.0));
    whitePaintGeos.push(makeWorldUVBox(0.14, 0.009, 3.4, 5.2, 0.048, z, 1.0));
    hdrWarmGeos.push(makeWorldUVBox(0.16, 0.032, 0.32, 0, 0.066, z + 4.5, 1.0));
  }

  const crosswalkZPositions = [275, 112, -45, -182, -318, -445];
  for (const cwZ of crosswalkZPositions) {
    for (let x = -9.0; x <= 9.0; x += 1.5) {
      const normX = x / 11.0;
      const cy = (1 - normX * normX) * 0.062 + 0.008;
      whitePaintGeos.push(makeWorldUVBox(0.74, 0.01, 3.8, x, cy, cwZ, 1.0));
    }
  }

  const mhGeo = new THREE.PlaneGeometry(1.05, 1.05);
  mhGeo.rotateX(-Math.PI / 2);
  const grateGeo = new THREE.PlaneGeometry(0.52, 0.95);
  grateGeo.rotateX(-Math.PI / 2);

  for (let z = -420; z <= 330; z += 34) {
    const mh = new THREE.Mesh(mhGeo, palette.manholeMat);
    const mx = z % 68 === 0 ? -2.4 : 2.6;
    mh.position.set(mx, 0.066, z);
    mh.name = 'reflSkip';
    group.add(mh);

    for (const side of [-1, 1] as const) {
      const gr = new THREE.Mesh(grateGeo, palette.drainGrateMat);
      gr.position.set(side * 10.55, 0.02, z + 12);
      gr.name = 'reflSkip';
      group.add(gr);
    }
  }

  // ===========================================================================
  // 4. SCULPTED CAST-IRON & BRONZE TEARDROP STREETLIGHTS
  // ===========================================================================
  const basePlinthGeo = new THREE.CylinderGeometry(0.24, 0.35, 1.1, 14);
  const decorativeCollarGeo = new THREE.TorusGeometry(0.2, 0.05, 8, 16);
  decorativeCollarGeo.rotateX(Math.PI / 2);
  const shaftGeo = new THREE.CylinderGeometry(0.085, 0.155, 6.4, 12);
  const armHorizGeo = new THREE.CylinderGeometry(0.055, 0.075, 2.2, 10);
  armHorizGeo.rotateZ(Math.PI / 2);
  const bracketScrollGeo = new THREE.TorusGeometry(0.48, 0.036, 8, 16, Math.PI);
  bracketScrollGeo.rotateZ(Math.PI);
  const hoodGeo = new THREE.CylinderGeometry(0.14, 0.4, 0.28, 16);
  const glassBellGeo = new THREE.SphereGeometry(0.24, 16, 14);
  const bollardPostGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.95, 12);
  const bollardRingGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.08, 12);

  const m4 = new THREE.Matrix4();

  for (let z = -440; z <= 345; z += 28) {
    if ((z > -36 && z < 102) || (z > -405 && z < -325)) continue;

    for (const side of [-1, 1] as const) {
      const lx = side * 12.0;
      const armDir = -side;

      m4.makeTranslation(lx, swH + 0.55, z);
      steelGeos.push(makeTransformedGeo(basePlinthGeo, m4));

      m4.makeTranslation(lx, swH + 1.12, z);
      bronzeGeos.push(makeTransformedGeo(decorativeCollarGeo, m4));

      m4.makeTranslation(lx, swH + 4.1, z);
      steelGeos.push(makeTransformedGeo(shaftGeo, m4));

      m4.makeTranslation(lx + armDir * 1.05, swH + 7.15, z);
      steelGeos.push(makeTransformedGeo(armHorizGeo, m4));

      m4.makeTranslation(lx + armDir * 0.55, swH + 6.68, z);
      bronzeGeos.push(makeTransformedGeo(bracketScrollGeo, m4));

      const bulbX = lx + armDir * 1.95;
      const bulbY = swH + 6.82;
      m4.makeTranslation(bulbX, bulbY + 0.22, z);
      bronzeGeos.push(makeTransformedGeo(hoodGeo, m4));

      m4.makeTranslation(bulbX, bulbY, z);
      hdrWarmGeos.push(makeTransformedGeo(glassBellGeo, m4));

      const halo = new THREE.Sprite(palette.haloSpriteMat);
      halo.position.set(bulbX, bulbY, z);
      halo.scale.set(2.5, 2.5, 1);
      group.add(halo);

      lightAnchors.push({
        position: new THREE.Vector3(bulbX, bulbY - 0.3, z),
        color: 0xffd699,
        intensity: 11.0,
        distance: 28.0,
      });
    }
  }

  for (let z = -445; z <= 345; z += 14) {
    if (z > -36 && z < 102) continue;
    for (const side of [-1, 1] as const) {
      const bx = side * 12.85;
      m4.makeTranslation(bx, swH + 0.48, z);
      steelGeos.push(makeTransformedGeo(bollardPostGeo, m4));
      m4.makeTranslation(bx, swH + 0.82, z);
      hdrWarmGeos.push(makeTransformedGeo(bollardRingGeo, m4));
    }
  }

  // ===========================================================================
  // 5. ACT III LAUNCH RAMP GUIDE RAILS (z = -435 to -485)
  //    (No redundant cable bridge or second ring — clean launch ramp into space!)
  // ===========================================================================
  for (const side of [-1, 1] as const) {
    hdrCyanGeos.push(makeWorldUVBox(0.24, 0.16, 55, side * 10.6, 0.25, -455, 1.0));
    hdrWarmGeos.push(makeWorldUVBox(0.18, 0.12, 55, side * 6.5, 0.15, -455, 1.0));
  }

  const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, shadow = true) => {
    if (geos.length === 0) return;
    const deduped = geos.map((g) => {
      const d = mergeVertices(g, 1e-4);
      if (d !== g) g.dispose();
      return d;
    });
    for (const mesh of mergeIntoChunks(deduped, mat, { castShadow: shadow, receiveShadow: true })) {
      group.add(mesh);
    }
  };

  addMerged(paverGeos, palette.sidewalkPaver, false);
  addMerged(basaltGeos, palette.basaltStrip, false);
  addMerged(curbGeos, palette.curbGranite, false);
  addMerged(grassGeos, palette.grassTurf, false);
  addMerged(whitePaintGeos, palette.roadPaintWhite, false);
  addMerged(amberPaintGeos, palette.roadPaintAmber, false);
  addMerged(bronzeGeos, palette.darkBronze, true);
  addMerged(steelGeos, palette.blackSteel, true);
  addMerged(lightConcreteGeos, palette.lightConcrete, true);
  addMerged(ivoryCeramicGeos, palette.ivoryCeramic, true);
  addMerged(hdrWarmGeos, palette.hdrWarmGlow, false);
  addMerged(hdrCyanGeos, palette.hdrCyanGlow, false);

  return {
    group,
    roadMesh,
    lightAnchors,
    treePlacements,
    update: (_time: number) => {},
  };
}
