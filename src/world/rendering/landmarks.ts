import * as THREE from "three";
import { WATER_TOWER_LADDER_Z_OFFSET, WATER_TOWER_PLATFORM_RADIUS } from "../worldConstants";
import { addSoftShadow } from "./shadows";
import { createTownWelcomeTexture } from "./signs";

export function addTownWelcomeSign(scene: THREE.Scene, x: number, z: number): void {
  const sign = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: "#765238", roughness: 0.62 });
  const panelBacking = new THREE.Mesh(
    new THREE.BoxGeometry(4.35, 1.56, 0.16),
    new THREE.MeshStandardMaterial({ color: "#5b422f", roughness: 0.68 })
  );
  panelBacking.position.y = 1.54;
  panelBacking.castShadow = true;
  sign.add(panelBacking);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.06, 1.3),
    new THREE.MeshBasicMaterial({ map: createTownWelcomeTexture(), side: THREE.DoubleSide })
  );
  panel.position.set(0, 1.54, 0.092);
  sign.add(panel);

  for (const postX of [-1.68, 1.68]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.75, 0.18), timber);
    post.position.set(postX, 1.02, 0);
    post.castShadow = true;
    sign.add(post);

    const postCap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 4), timber);
    postCap.position.set(postX, 2.48, 0);
    postCap.rotation.y = Math.PI / 4;
    postCap.castShadow = true;
    sign.add(postCap);
  }

  const flowerMaterial = new THREE.MeshStandardMaterial({ color: "#f0b65c", roughness: 0.7 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#5a8a4f", roughness: 0.9 });
  for (const offsetX of [-1.2, -0.8, 0.8, 1.2]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), leafMaterial);
    leaf.position.set(offsetX, 0.15, -0.08);
    leaf.castShadow = true;
    sign.add(leaf);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), flowerMaterial);
    bloom.position.set(offsetX, 0.31, -0.08);
    sign.add(bloom);
  }

  addSoftShadow(sign, 0.28, 0.18, 4.8, 1, -0.14, 0.26);
  sign.position.set(x, 0, z);
  scene.add(sign);
}

export function addLoopMonument(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.52, 0.52, 8),
    new THREE.MeshStandardMaterial({ color: "#d8c9a9", roughness: 0.66 })
  );
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.92, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: "#b9a682", roughness: 0.55, metalness: 0.08 })
  );
  plinth.position.y = 0.7;
  plinth.castShadow = true;
  group.add(plinth);

  const gold = new THREE.MeshStandardMaterial({ color: "#d9a932", metalness: 0.48, roughness: 0.28 });
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.64, 0.63, 20, 1, true),
    gold
  );
  cup.position.y = 1.52;
  cup.castShadow = true;
  group.add(cup);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 8, 20), gold);
  cupRim.position.y = 1.84;
  cupRim.rotation.x = Math.PI / 2;
  cupRim.castShadow = true;
  group.add(cupRim);

  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 8, 16, Math.PI), gold);
    handle.position.set(side * 0.52, 1.55, 0);
    handle.rotation.z = side * Math.PI / 2;
    handle.castShadow = true;
    group.add(handle);
  }

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.38, 12), gold);
  stem.position.y = 0.98;
  stem.castShadow = true;
  group.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.13, 16), gold);
  foot.position.y = 0.82;
  foot.castShadow = true;
  group.add(foot);

  const medallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.055, 16),
    new THREE.MeshStandardMaterial({ color: "#fff0a5", metalness: 0.35, roughness: 0.22 })
  );
  medallion.position.set(0, 1.48, 0.64);
  medallion.rotation.x = Math.PI / 2;
  group.add(medallion);

  group.position.set(x, 0, z);
  addSoftShadow(group, 0.28, 0.3, 2.9, 2.15, -0.2, 0.2);
  scene.add(group);
}

export function addFountain(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#cdbf9b", roughness: 0.82 });
  const water = new THREE.MeshStandardMaterial({
    color: "#9fd2ce",
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82
  });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.72, 0.35, 32), stone);
  basin.position.y = 0.18;
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.42, 0.08, 32), water);
  pool.position.y = 0.42;
  group.add(pool);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.95, 18), stone);
  stem.position.y = 0.85;
  stem.castShadow = true;
  group.add(stem);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.2, 28), stone);
  topBowl.position.y = 1.38;
  topBowl.castShadow = true;
  group.add(topBowl);

  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.9, 12), water);
  stream.position.y = 1.75;
  group.add(stream);

  addSoftShadow(group, 0.4, 0.35, 3.25, 2, -0.12, 0.2);
  group.position.set(x, 0, z);
  scene.add(group);
}

export function addTrees(scene: THREE.Scene): void {
  const treeLawnMaterial = new THREE.MeshStandardMaterial({ color: "#9fba79", roughness: 0.94 });
  const positions = [
    [-13, -8],
    [-12, 8],
    [13, -9],
    [13, 8],
    [5, 12],
    [-6, 12],
    [-15.2, -4.1],
    [-5, -12],
    [5.5, -12],
    [15.7, 12.6],
    [-1.2, 13],
    [10.8, 10.5],
    [-20, -14],
    [-20, 1],
    [-20, 14],
    [20, -15],
    [20, 0],
    [20, 14],
    [-8, 19],
    [9, 19]
  ];
  for (const [index, [x, z]] of positions.entries()) {
    addTree(scene, x, z, index, treeLawnMaterial);
  }
}

export function addTree(scene: THREE.Scene, x: number, z: number, variant = 0, lawnMaterial?: THREE.MeshStandardMaterial): void {
  const treeScale = 0.88 + (variant % 4) * 0.08;
  const treeLawnMaterial = lawnMaterial ?? new THREE.MeshStandardMaterial({ color: "#9fba79", roughness: 0.94 });
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(0.94 * treeScale, 12), treeLawnMaterial);
  lawn.rotation.x = -Math.PI / 2;
  lawn.rotation.z = variant * 0.47;
  lawn.scale.set(1.24, 0.78, 1);
  lawn.position.set(x, 0.016, z);
  lawn.receiveShadow = true;
  scene.add(lawn);

  const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#7b5636", roughness: 0.85 })
  );
  trunk.position.set(x, 0.6 * treeScale, z);
  trunk.scale.setScalar(treeScale);
  trunk.castShadow = true;
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 0),
    new THREE.MeshStandardMaterial({ color: "#68965d", roughness: 0.9 })
  );
  leaves.position.set(x, 1.55 * treeScale, z);
  leaves.scale.setScalar(treeScale);
  leaves.castShadow = true;
  scene.add(leaves);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#527f50", roughness: 0.88 });
  const leafClusterA = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 0), leafMaterial);
  leafClusterA.position.set(x - 0.38 * treeScale, 1.42 * treeScale, z + 0.14 * treeScale);
  leafClusterA.scale.setScalar(treeScale);
  leafClusterA.castShadow = true;
  scene.add(leafClusterA);

  const leafClusterB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.64, 0), leafMaterial);
  leafClusterB.position.set(x + 0.42 * treeScale, 1.5 * treeScale, z - 0.18 * treeScale);
  leafClusterB.scale.setScalar(treeScale);
  leafClusterB.castShadow = true;
  scene.add(leafClusterB);

  addSoftShadow(scene, x + 0.88 * treeScale, z + 0.48 * treeScale, 2.35 * treeScale, 0.72 * treeScale, -0.22, 0.22);
  addSoftShadow(scene, x + 0.05 * treeScale, z + 0.04 * treeScale, 0.76 * treeScale, 0.5 * treeScale, 0, 0.12);
}

export function addWaterTower(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const tank = new THREE.MeshStandardMaterial({ color: "#91a9a2", roughness: 0.66, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: "#d9e0d2", roughness: 0.58, metalness: 0.12 });
  const support = new THREE.MeshStandardMaterial({ color: "#5d7067", roughness: 0.78, metalness: 0.15 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: "#45564f", roughness: 0.74, metalness: 0.18 });

  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3, rotation?: THREE.Euler) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const legPositions = [
    [-0.9, -0.84],
    [0.9, -0.84],
    [-0.9, 0.84],
    [0.9, 0.84]
  ] as const;
  for (const [offsetX, offsetZ] of legPositions) {
    const leg = addMesh(
      new THREE.CylinderGeometry(0.105, 0.16, 4.4, 6),
      support,
      new THREE.Vector3(offsetX, 2.2, offsetZ)
    );
    leg.rotation.z = -offsetX * 0.055;
    leg.rotation.x = offsetZ * 0.055;
  }

  for (const y of [1.6, 3.2]) {
    for (const direction of [-1, 1]) {
      addMesh(
        new THREE.BoxGeometry(1.82, 0.1, 0.1),
        darkMetal,
        new THREE.Vector3(0, y, direction * 0.84),
        new THREE.Euler(0, 0, direction * 0.48)
      );
      addMesh(
        new THREE.BoxGeometry(0.1, 0.1, 1.7),
        darkMetal,
        new THREE.Vector3(direction * 0.9, y, 0),
        new THREE.Euler(direction * 0.48, 0, 0)
      );
    }
  }

  const hopper = addMesh(
    new THREE.ConeGeometry(1.22, 0.68, 12),
    tank,
    new THREE.Vector3(0, 4.42, 0),
    new THREE.Euler(Math.PI, 0, 0)
  );
  hopper.scale.y = 0.92;

  addMesh(new THREE.CylinderGeometry(1.32, 1.22, 1.48, 12), tank, new THREE.Vector3(0, 5.35, 0));
  addMesh(new THREE.TorusGeometry(1.27, 0.055, 6, 16), trim, new THREE.Vector3(0, 4.75, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  addMesh(new THREE.TorusGeometry(1.34, 0.06, 6, 16), trim, new THREE.Vector3(0, 5.92, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  addMesh(new THREE.ConeGeometry(1.38, 0.46, 12), support, new THREE.Vector3(0, 6.32, 0));
  addMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.28, 8), darkMetal, new THREE.Vector3(0, 6.69, 0));

  const catwalk = addMesh(
    new THREE.CylinderGeometry(WATER_TOWER_PLATFORM_RADIUS, WATER_TOWER_PLATFORM_RADIUS, 0.14, 20),
    darkMetal,
    new THREE.Vector3(0, 4.8, 0)
  );
  catwalk.scale.y = 0.65;
  addMesh(
    new THREE.TorusGeometry(WATER_TOWER_PLATFORM_RADIUS - 0.07, 0.065, 6, 20),
    trim,
    new THREE.Vector3(0, 4.88, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );
  for (let index = 0; index < 12; index += 1) {
    if (index === 9) continue;
    const angle = (index / 12) * Math.PI * 2;
    const railX = Math.cos(angle) * (WATER_TOWER_PLATFORM_RADIUS - 0.16);
    const railZ = Math.sin(angle) * (WATER_TOWER_PLATFORM_RADIUS - 0.16);
    addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), trim, new THREE.Vector3(railX, 5.1, railZ));
  }

  addMesh(
    new THREE.TorusGeometry(WATER_TOWER_PLATFORM_RADIUS - 0.16, 0.035, 5, 24),
    trim,
    new THREE.Vector3(0, 5.38, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );

  const ladderZ = WATER_TOWER_LADDER_Z_OFFSET;
  for (const offsetX of [-0.22, 0.22]) {
    addMesh(new THREE.BoxGeometry(0.055, 3.7, 0.055), trim, new THREE.Vector3(offsetX, 2.62, ladderZ));
  }
  for (let y = 0.95; y <= 4.35; y += 0.36) {
    addMesh(new THREE.BoxGeometry(0.5, 0.05, 0.055), trim, new THREE.Vector3(0, y, ladderZ));
  }

  addSoftShadow(group, 0.28, 0.24, 3.6, 2.7, -0.08, 0.26);
  group.position.set(x, 0, z);
  scene.add(group);
}
