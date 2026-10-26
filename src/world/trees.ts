import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface TreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY?: number;
}

/**
 * Loads `public/models/tree_elm.glb` once, merges its 552 sub-meshes into
 * 1 bark BufferGeometry + 1 leaf BufferGeometry, and renders all trees in the world
 * using just 2 InstancedMesh draw calls for 60 FPS performance!
 */
export function loadAndPlaceElmTrees(
  scene: THREE.Scene,
  placements: TreePlacement[]
): Promise<void> {
  if (placements.length === 0) return Promise.resolve();

  // Chunk placements into 80m Z-segments so each InstancedMesh gets a tight
  // bounding box and frustum culling can drop whole stretches of trees.
  const CHUNK = 80;
  const chunks = new Map<number, TreePlacement[]>();
  for (const p of placements) {
    const key = Math.floor(p.z / CHUNK);
    const arr = chunks.get(key) ?? [];
    arr.push(p);
    chunks.set(key, arr);
  }
  const placementChunks = [...chunks.values()];

  const loader = new GLTFLoader();
  return new Promise<void>((resolve) => {
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

      if (barkGeos.length > 0) {
        const mergedBark = mergeGeometries(barkGeos, false);
        barkGeos.forEach((g) => g.dispose());
        if (mergedBark) {
          const finalBarkMat =
            mats.barkMat instanceof THREE.MeshStandardMaterial
              ? mats.barkMat
              : new THREE.MeshStandardMaterial({ color: '#4a3c31', roughness: 0.9 });
          for (const chunk of placementChunks) {
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
          for (const chunk of placementChunks) {
            const leafInst = new THREE.InstancedMesh(mergedLeaf, finalLeafMat, chunk.length);
            leafInst.castShadow = true;
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
          }
        }
      }

      scene.add(treeGroup);
      resolve();
    },
    undefined,
    () => {
      resolve(); // Ignore if GLB missing
    }
    );
  });
}
