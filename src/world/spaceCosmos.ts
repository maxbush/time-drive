import * as THREE from 'three';

export interface SpaceCosmosSystem {
  group: THREE.Group;
  update: (time: number, carPos: THREE.Vector3, spaceFactor: number) => void;
}

export function createSpaceCosmos(scene: THREE.Scene): SpaceCosmosSystem {
  const group = new THREE.Group();
  group.name = 'SpaceCosmos';
  scene.add(group);

  // 1. Streaming Starlight Warp Trails (rushing downward along -Y as the car flies 90-degrees straight up +Y!)
  const streakCount = 420;
  const streakGeo = new THREE.BoxGeometry(0.14, 16.0, 0.14);
  const streakMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 1.9, 2.5),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

  const streakInst = new THREE.InstancedMesh(streakGeo, streakMat, streakCount);
  streakInst.frustumCulled = false;
  group.add(streakInst);

  const streakSeeds: Array<{ x: number; y: number; z: number; speed: number; len: number; warm: boolean }> = [];
  for (let i = 0; i < streakCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.pow(Math.random(), 0.7) * 145;
    streakSeeds.push({
      x: Math.cos(angle) * radius,
      y: Math.random() * 260,
      z: -465 + Math.sin(angle) * radius,
      speed: 65 + Math.random() * 95,
      len: 0.5 + Math.random() * 1.6,
      warm: i % 5 === 0,
    });
  }

  // 2. Deep-Space Pinpoint Starfield Cloud around the vertical ascent column
  const starCount = 1600;
  const starPos = new Float32Array(starCount * 3);
  const starCols = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 35 + Math.random() * 420;
    starPos[i * 3] = Math.cos(theta) * r;
    starPos[i * 3 + 1] = 20 + Math.random() * 480;
    starPos[i * 3 + 2] = -465 + Math.sin(theta) * r;

    const warm = Math.random();
    starCols[i * 3] = 0.75 + warm * 0.25;
    starCols[i * 3 + 1] = 0.82 + warm * 0.12;
    starCols[i * 3 + 2] = 1.0 - warm * 0.18;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
  const starMat = new THREE.PointsMaterial({
    size: 1.9,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.frustumCulled = false;
  group.add(starPoints);

  // 3. High-Altitude Orbital Ring / Cosmic Horizon Portal high above the launch vector (`y = 260, z = -465`)
  const portalGroup = new THREE.Group();
  portalGroup.position.set(0, 260, -465);
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(68, 0.65, 12, 120),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.7, 1.8, 2.6),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  ring1.rotation.x = Math.PI / 2;
  portalGroup.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(46, 0.45, 10, 96),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 1.4, 0.65),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  ring2.rotation.x = Math.PI / 2;
  portalGroup.add(ring2);
  group.add(portalGroup);

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  return {
    group,
    update: (time: number, carPos: THREE.Vector3, spaceFactor: number) => {
      const sf = THREE.MathUtils.clamp(spaceFactor, 0, 1);
      group.visible = sf > 0.01;
      if (!group.visible) return;

      streakMat.opacity = sf * 0.85;
      starMat.opacity = sf * 0.95;
      (ring1.material as THREE.MeshBasicMaterial).opacity = sf * 0.75;
      (ring2.material as THREE.MeshBasicMaterial).opacity = sf * 0.65;

      portalGroup.position.y = carPos.y + 115;
      portalGroup.rotation.y = time * 0.18;

      for (let i = 0; i < streakCount; i++) {
        const s = streakSeeds[i];
        const relY = ((s.y - time * s.speed) % 240 + 240) % 240 - 60;
        dummy.position.set(s.x, carPos.y + relY, s.z);
        dummy.scale.set(1, s.len * (0.4 + sf * 0.9), 1);
        dummy.updateMatrix();
        streakInst.setMatrixAt(i, dummy.matrix);

        if (s.warm) {
          col.setRGB(2.2, 1.45, 0.75);
        } else {
          col.setRGB(0.65, 1.65, 2.5);
        }
        streakInst.setColorAt(i, col);
      }
      streakInst.instanceMatrix.needsUpdate = true;
      if (streakInst.instanceColor) streakInst.instanceColor.needsUpdate = true;
    },
  };
}
