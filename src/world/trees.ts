import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Distance switch between the full trees and the cheap far versions (see below). */
export interface TreeLod {
  update(carZ: number): void;
}

export interface TreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY?: number;
}

// Bakes a mesh into world-normalised plain float data (position / normal / uv) for merging.
function bakeGeometry(obj: THREE.Mesh, offsetMatrix: THREE.Matrix4): THREE.BufferGeometry {
  const cloned = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  for (const k of Object.keys(cloned.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') {
      cloned.deleteAttribute(k);
    } else {
      const a = cloned.attributes[k];
      if (!(a.array instanceof Float32Array) || a.normalized) {
        const f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) {
          f[i * a.itemSize] = a.getX(i);
          f[i * a.itemSize + 1] = a.getY(i);
          if (a.itemSize > 2) f[i * a.itemSize + 2] = a.getZ(i);
        }
        cloned.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
      }
    }
  }
  if (!cloned.attributes.normal) cloned.computeVertexNormals();
  if (!cloned.attributes.uv) {
    cloned.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cloned.attributes.position.count * 2), 2));
  }
  cloned.applyMatrix4(new THREE.Matrix4().multiplyMatrices(offsetMatrix, obj.matrixWorld));
  return cloned;
}

/**
 * Loads `public/models/tree_elm.glb` once, merges its 552 sub-meshes into
 * 1 bark BufferGeometry + 1 leaf BufferGeometry, and renders all trees in the world
 * using just 2 InstancedMesh draw calls for 60 FPS performance!
 */
export function loadAndPlaceElmTrees(
  scene: THREE.Scene,
  placements: TreePlacement[],
  onProgress?: (fraction: number) => void,
  opts: { leafShadows?: boolean; nearRadius?: number; cullRadius?: number } = {}
): Promise<TreeLod | null> {
  if (placements.length === 0) return Promise.resolve(null);

  // Chunk placements into 80m Z-segments so each InstancedMesh gets a tight
  // bounding box and frustum culling can drop whole stretches of trees.
  const CHUNK = 40; // finer than before: the full/far switch happens per chunk
  const chunks = new Map<number, TreePlacement[]>();
  for (const p of placements) {
    const key = Math.floor(p.z / CHUNK);
    const arr = chunks.get(key) ?? [];
    arr.push(p);
    chunks.set(key, arr);
  }
  const placementChunks = [...chunks.values()];
  const nearMeshes: THREE.Object3D[][] = placementChunks.map(() => []);

  // Far trees: a tree is ~21k triangles, and on a straight avenue every one of the 62 is in the
  // frustum at any time (1.3M triangles = two thirds of the whole scene). Beyond ~110 m it is a
  // few dozen pixels tall, so a cheap stand-in is used there: a plain trunk + a third of the
  // leaf cards (~1.5k triangles, about 14 times less), and beyond the cull radius nothing.
  const lodLoader = new GLTFLoader();
  lodLoader.setMeshoptDecoder(MeshoptDecoder);
  const lodPromise = new Promise<THREE.Object3D | null>((res) => {
    lodLoader.load('./models/tree_elm_lod.glb', (g) => res(g.scene), undefined, () => res(null));
  });

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise<TreeLod | null>((resolve) => {
    loader.load(
    './models/tree_elm.glb',
    (gltf) => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const normScale = 7.5 / Math.max(size.y, 0.001);

      const barkGeos: THREE.BufferGeometry[] = [];
      const leafGeos: THREE.BufferGeometry[] = [];
      const mats = {
        barkMat: null as THREE.Material | null,
        leafMat: null as THREE.Material | null,
      };

      const offsetMatrix = new THREE.Matrix4()
        .makeTranslation(-center.x, -bounds.min.y, -center.z)
        .premultiply(new THREE.Matrix4().makeScale(normScale, normScale, normScale));

      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) {
          const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
          const mName = (mat?.name || '').toLowerCase();
          const isLeaf = mName.includes('leaf');

          const cloned = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
          for (const k of Object.keys(cloned.attributes)) {
            if (k !== 'position' && k !== 'normal' && k !== 'uv') {
              cloned.deleteAttribute(k);
            } else {
              // the compressed GLB is quantized (normalized ints): back to float so the
              // matrix bake below and the merge work on plain Float32 data
              const a = cloned.attributes[k];
              if (!(a.array instanceof Float32Array) || a.normalized) {
                const f = new Float32Array(a.count * a.itemSize);
                for (let i = 0; i < a.count; i++) {
                  f[i * a.itemSize] = a.getX(i);
                  f[i * a.itemSize + 1] = a.getY(i);
                  if (a.itemSize > 2) f[i * a.itemSize + 2] = a.getZ(i);
                }
                cloned.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
              }
            }
          }
          if (!cloned.attributes.normal) cloned.computeVertexNormals();
          if (!cloned.attributes.uv) {
            cloned.setAttribute(
              'uv',
              new THREE.BufferAttribute(new Float32Array(cloned.attributes.position.count * 2), 2)
            );
          }

          const worldMtx = new THREE.Matrix4().multiplyMatrices(offsetMatrix, obj.matrixWorld);
          cloned.applyMatrix4(worldMtx);

          if (isLeaf) {
            leafGeos.push(cloned);
            if (!mats.leafMat && mat) mats.leafMat = mat;
          } else {
            barkGeos.push(cloned);
            if (!mats.barkMat && mat) mats.barkMat = mat;
          }
        }
      });

      const treeGroup = new THREE.Group();
      treeGroup.name = 'ElmTreesInstanced';

      const dummy = new THREE.Object3D();
      let nearBarkMat: THREE.Material | null = null;
      let nearLeafMat: THREE.Material | null = null;
      let trunkR = 0.25;

      if (barkGeos.length > 0) {
        const mergedBark = mergeGeometries(barkGeos, false);
        barkGeos.forEach((g) => g.dispose());
        if (mergedBark) {
          // trunk radius for the far version: 90th percentile of the horizontal distance of the
          // vertices in the lowest metre
          const pos = mergedBark.attributes.position;
          const rs: number[] = [];
          for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.9) rs.push(Math.hypot(pos.getX(i), pos.getZ(i)));
          if (rs.length > 8) {
            rs.sort((a, b) => a - b);
            trunkR = THREE.MathUtils.clamp(rs[Math.floor(rs.length * 0.9)], 0.12, 0.6);
          }
          const finalBarkMat =
            mats.barkMat instanceof THREE.MeshStandardMaterial
              ? mats.barkMat
              : new THREE.MeshStandardMaterial({ color: '#4a3c31', roughness: 0.9 });
          nearBarkMat = finalBarkMat;
          for (let ci = 0; ci < placementChunks.length; ci++) {
            const chunk = placementChunks[ci];
            const barkInst = new THREE.InstancedMesh(mergedBark, finalBarkMat, chunk.length);
            barkInst.castShadow = true;
            barkInst.receiveShadow = true;
            chunk.forEach((p, idx) => {
              dummy.position.set(p.x, p.y, p.z);
              dummy.rotation.set(0, p.rotY ?? (idx * 1.7) % (Math.PI * 2), 0);
              dummy.scale.setScalar(p.scale);
              dummy.updateMatrix();
              barkInst.setMatrixAt(idx, dummy.matrix);
            });
            barkInst.instanceMatrix.needsUpdate = true;
            treeGroup.add(barkInst);
            nearMeshes[ci].push(barkInst);
          }
        }
      }

      if (leafGeos.length > 0) {
        const mergedLeaf = mergeGeometries(leafGeos, false);
        leafGeos.forEach((g) => g.dispose());
        if (mergedLeaf) {
          let finalLeafMat: THREE.Material;
          if (mats.leafMat instanceof THREE.MeshStandardMaterial) {
            finalLeafMat = mats.leafMat.clone();
            (finalLeafMat as THREE.MeshStandardMaterial).alphaTest = 0.45;
            (finalLeafMat as THREE.MeshStandardMaterial).transparent = false;
            (finalLeafMat as THREE.MeshStandardMaterial).depthWrite = true;
            (finalLeafMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
            (finalLeafMat as THREE.MeshStandardMaterial).roughness = 0.78;
          } else {
            finalLeafMat = new THREE.MeshStandardMaterial({
              color: '#3c5e42',
              roughness: 0.8,
              side: THREE.DoubleSide,
            });
          }
          nearLeafMat = finalLeafMat;
          for (let ci = 0; ci < placementChunks.length; ci++) {
            const chunk = placementChunks[ci];
            const leafInst = new THREE.InstancedMesh(mergedLeaf, finalLeafMat, chunk.length);
            leafInst.castShadow = opts.leafShadows !== false;
            leafInst.receiveShadow = true;
            leafInst.layers.set(1); // skip the planar reflection pass
            chunk.forEach((p, idx) => {
              dummy.position.set(p.x, p.y, p.z);
              dummy.rotation.set(0, p.rotY ?? (idx * 1.7) % (Math.PI * 2), 0);
              dummy.scale.setScalar(p.scale);
              dummy.updateMatrix();
              leafInst.setMatrixAt(idx, dummy.matrix);
            });
            leafInst.instanceMatrix.needsUpdate = true;
            treeGroup.add(leafInst);
            nearMeshes[ci].push(leafInst);
          }
        }
      }

      scene.add(treeGroup);

      // ---- far versions + the distance switch
      lodPromise.then((lodRoot) => {
        const farMeshes: THREE.Object3D[][] = placementChunks.map(() => []);
        const farLeafGeos: THREE.BufferGeometry[] = [];
        if (lodRoot) {
          lodRoot.updateMatrixWorld(true);
          lodRoot.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.geometry) farLeafGeos.push(bakeGeometry(obj, offsetMatrix));
          });
        }
        const farLeaf = farLeafGeos.length ? mergeGeometries(farLeafGeos, false) : null;
        const trunkH = 3.4;
        const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 7, 1, false);
        trunkGeo.translate(0, trunkH / 2, 0);
        if (nearBarkMat && nearLeafMat) {
          placementChunks.forEach((chunk, ci) => {
            const make = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
              const m = new THREE.InstancedMesh(geo, mat, chunk.length);
              m.castShadow = false; // far trees are outside the shadow camera (±75 m) anyway
              m.receiveShadow = false;
              m.layers.set(1); // not in the planar reflection
              chunk.forEach((p, idx) => {
                dummy.position.set(p.x, p.y, p.z);
                dummy.rotation.set(0, p.rotY ?? (idx * 1.7) % (Math.PI * 2), 0);
                dummy.scale.setScalar(p.scale);
                dummy.updateMatrix();
                m.setMatrixAt(idx, dummy.matrix);
              });
              m.instanceMatrix.needsUpdate = true;
              m.visible = false;
              treeGroup.add(m);
              farMeshes[ci].push(m);
            };
            make(trunkGeo, nearBarkMat as THREE.Material);
            if (farLeaf) make(farLeaf, nearLeafMat as THREE.Material);
          });
        }

        const NEAR_R = opts.nearRadius ?? 115;
        const CULL_R = opts.cullRadius ?? 680;
        const state = placementChunks.map((chunk) => ({
          zMin: Math.min(...chunk.map((p) => p.z)),
          zMax: Math.max(...chunk.map((p) => p.z)),
          near: true,
        }));
        const hasFar = farMeshes.some((a) => a.length > 0);
        const lod: TreeLod = {
          update(carZ: number) {
            for (let i = 0; i < state.length; i++) {
              const s = state[i];
              const d = carZ < s.zMin ? s.zMin - carZ : carZ > s.zMax ? carZ - s.zMax : 0;
              // a little hysteresis so a chunk on the border does not flicker between versions
              if (s.near && d > NEAR_R + 18) s.near = false;
              else if (!s.near && d < NEAR_R) s.near = true;
              const culled = d > CULL_R;
              const nearVisible = !culled && (s.near || !hasFar);
              const farVisible = !culled && !s.near && hasFar;
              for (const m of nearMeshes[i]) m.visible = nearVisible;
              for (const m of farMeshes[i]) m.visible = farVisible;
            }
          },
        };
        lod.update(344);
        resolve(lod);
      });
    },
    (ev) => {
      if (onProgress && ev.total > 0) onProgress(Math.min(1, ev.loaded / ev.total));
    },
    () => {
      resolve(null); // Ignore if GLB missing
    }
    );
  });
}
