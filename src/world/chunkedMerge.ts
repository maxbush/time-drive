import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometries merged into ~64m Z-chunks so frustum culling works in every pass
// (shadow map, planar reflection, main render) instead of one giant world mesh.
export const MERGE_CHUNK_SIZE = 64;

export function mergeIntoChunks(
  geos: THREE.BufferGeometry[],
  material: THREE.Material,
  opts: { castShadow?: boolean; receiveShadow?: boolean; renderOrder?: number; chunkSize?: number } = {}
): THREE.Mesh[] {
  const chunkSize = opts.chunkSize ?? MERGE_CHUNK_SIZE;
  const buckets = new Map<number, THREE.BufferGeometry[]>();

  for (const g of geos) {
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;
    const key = Math.floor((bb.min.z + bb.max.z) * 0.5 / chunkSize);
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(g);
  }

  const meshes: THREE.Mesh[] = [];
  for (const arr of buckets.values()) {
    const merged = mergeGeometries(arr, false);
    arr.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
    meshes.push(mesh);
  }
  return meshes;
}
