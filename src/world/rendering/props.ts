import * as THREE from "three";
import { addSoftShadow } from "./shadows";

export function addGardenPlot(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const timber = new THREE.MeshStandardMaterial({ color: "#a9784f", roughness: 0.86 });
  const soil = new THREE.MeshStandardMaterial({ color: "#765b3e", roughness: 0.96 });
  const leaf = new THREE.MeshStandardMaterial({ color: "#5e934f", roughness: 0.88 });
  const bloom = new THREE.MeshStandardMaterial({ color: "#f0b65c", roughness: 0.72 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.18), timber);
  base.position.y = 0.1;
  base.castShadow = true;
  group.add(base);
  const soilBed = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.92), soil);
  soilBed.position.y = 0.23;
  soilBed.castShadow = true;
  group.add(soilBed);

  for (const offsetX of [-0.55, 0, 0.55]) {
    for (const offsetZ of [-0.25, 0.25]) {
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), leaf);
      plant.position.set(offsetX, 0.38, offsetZ);
      plant.scale.y = 0.7;
      plant.castShadow = true;
      group.add(plant);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), bloom);
      flower.position.set(offsetX + 0.03, 0.49, offsetZ);
      group.add(flower);
    }
  }

  addSoftShadow(group, 0.18, 0.12, 2.3, 1.25, -0.16, 0.24);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function addPicnicTable(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#a77545", roughness: 0.82 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.84 });
  const tabletop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.72), wood);
  tabletop.position.y = 0.82;
  tabletop.castShadow = true;
  group.add(tabletop);
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.3), wood);
    seat.position.set(0, 0.48, side * 0.58);
    seat.castShadow = true;
    group.add(seat);
  }
  for (const offsetX of [-0.54, 0.54]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12), legMaterial);
    support.position.set(offsetX, 0.39, 0);
    support.castShadow = true;
    group.add(support);
  }
  addSoftShadow(group, 0.2, 0.12, 2.1, 1.42, -0.14, 0.24);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function addPicnicLawn(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.55),
    new THREE.MeshStandardMaterial({ color: "#91aa73", roughness: 0.96 })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.rotation.z = rotation;
  lawn.position.set(x, 0.014, z);
  lawn.receiveShadow = true;
  scene.add(lawn);

  for (const [offsetX, offsetZ, size] of [
    [-1.14, -0.72, 0.62],
    [1.08, 0.66, 0.54],
    [-0.86, 0.77, 0.46]
  ] as const) {
    addGrassClump(scene, x + offsetX, z + offsetZ, size);
  }
}

export function addGrassClump(scene: THREE.Scene, x: number, z: number, size: number): void {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#739b57", roughness: 0.94 });
  for (const [offsetX, offsetZ, rotation] of [
    [-0.1, 0.02, -0.26],
    [0.08, -0.08, 0.2],
    [0.16, 0.13, 0.45]
  ] as const) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055 * size, 0.34 * size, 4), material);
    blade.position.set(offsetX * size, 0.17 * size, offsetZ * size);
    blade.rotation.z = rotation;
    group.add(blade);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

export function addShrub(scene: THREE.Scene, x: number, z: number, size: number): void {
  const group = new THREE.Group();
  const leafLight = new THREE.MeshStandardMaterial({ color: "#67925d", roughness: 0.9 });
  const leafDark = new THREE.MeshStandardMaterial({ color: "#4c7448", roughness: 0.9 });
  const clusters = [
    [-0.22, 0.18, 0.34, leafDark],
    [0.18, 0.22, 0.4, leafLight],
    [0.02, -0.12, 0.32, leafDark]
  ] as const;

  for (const [offsetX, offsetZ, radius, material] of clusters) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * size, 0), material);
    leaf.position.set(offsetX * size, 0.22 + radius * size * 0.45, offsetZ * size);
    leaf.scale.y = 0.72;
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);
  }

  addSoftShadow(group, 0.18 * size, 0.14 * size, 1.24 * size, 0.66 * size, -0.15, 0.18);
  group.position.set(x, 0, z);
  scene.add(group);
}

export function addBench(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#a9763f", roughness: 0.8 });
  const woodEdge = new THREE.MeshStandardMaterial({ color: "#875528", roughness: 0.86 });
  const woodHighlight = new THREE.MeshStandardMaterial({ color: "#c28b4d", roughness: 0.76 });
  const support = new THREE.MeshStandardMaterial({ color: "#363a35", roughness: 0.72 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 0.58), wood);
  seat.position.set(0, 0.5, -0.05);
  seat.rotation.x = -0.035;
  seat.castShadow = true;
  group.add(seat);

  const seatInset = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.025, 0.43), woodHighlight);
  seatInset.position.set(0, 0.572, -0.04);
  seatInset.rotation.x = -0.035;
  seatInset.castShadow = true;
  group.add(seatInset);

  const seatFront = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.07), woodEdge);
  seatFront.position.set(0, 0.45, -0.34);
  seatFront.rotation.x = -0.035;
  seatFront.castShadow = true;
  group.add(seatFront);

  const underSeatBrace = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 0.1), support);
  underSeatBrace.position.set(0, 0.37, 0.04);
  underSeatBrace.castShadow = true;
  group.add(underSeatBrace);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 0.12), wood);
  backrest.position.set(0, 0.9, 0.29);
  backrest.rotation.x = 0.15;
  backrest.castShadow = true;
  group.add(backrest);

  const backCap = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.075, 0.16), woodHighlight);
  backCap.position.set(0, 1.2, 0.33);
  backCap.rotation.x = 0.15;
  backCap.castShadow = true;
  group.add(backCap);

  for (const edgeX of [-0.91, 0.91]) {
    const backEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.15), woodEdge);
    backEdge.position.set(edgeX, 0.9, 0.29);
    backEdge.rotation.x = 0.15;
    backEdge.castShadow = true;
    group.add(backEdge);
  }

  const fastenerMaterial = new THREE.MeshStandardMaterial({ color: "#c7a66b", roughness: 0.62 });
  for (const fastenerX of [-0.72, 0.72]) {
    const fastener = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fastenerMaterial);
    fastener.position.set(fastenerX, 0.87, 0.36);
    fastener.castShadow = true;
    group.add(fastener);
  }

  const supportShape = new THREE.Shape();
  supportShape.moveTo(-0.14, 0);
  supportShape.lineTo(0.14, 0);
  supportShape.lineTo(0.14, 0.34);
  supportShape.lineTo(0.1, 0.42);
  supportShape.lineTo(-0.1, 0.42);
  supportShape.lineTo(-0.14, 0.34);
  supportShape.closePath();
  const supportGeometry = new THREE.ExtrudeGeometry(supportShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012
  });

  for (const supportX of [-0.66, 0.66]) {
    const pier = new THREE.Mesh(supportGeometry, support);
    pier.position.set(supportX, 0, -0.15);
    pier.castShadow = true;
    group.add(pier);

    const backBracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.12), support);
    backBracket.position.set(supportX, 0.66, 0.25);
    backBracket.rotation.x = 0.15;
    backBracket.castShadow = true;
    group.add(backBracket);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  addSoftShadow(group, 0.22, 0.14, 2.08, 0.78, -0.08, 0.22);
  scene.add(group);
}
export function addFlowerBed(scene: THREE.Scene, x: number, z: number, flowerColor: string): void {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.05, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: "#6f5b3e", roughness: 0.9 })
  );
  base.position.set(x, 0.09, z);
  base.castShadow = true;
  scene.add(base);
  addSoftShadow(scene, x + 0.24, z + 0.16, 1.45, 0.92, -0.12, 0.2);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#4f8a48", roughness: 0.9 });
  const flowerMaterial = new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.65 });
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const radius = 0.18 + (i % 3) * 0.18;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), leafMaterial);
    leaf.position.set(x + Math.cos(angle) * radius, 0.28, z + Math.sin(angle) * radius);
    leaf.castShadow = true;
    scene.add(leaf);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flowerMaterial);
    bloom.position.set(leaf.position.x, 0.43, leaf.position.z);
    bloom.castShadow = true;
    scene.add(bloom);
  }
}

export function addFence(scene: THREE.Scene, x: number, z: number, length: number, rotation: number): void {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#b58b56", roughness: 0.8 });
  const rails = [0.42, 0.78];
  for (const y of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.08), material);
    rail.position.y = y;
    rail.castShadow = true;
    group.add(rail);
  }
  for (let i = -length / 2; i <= length / 2; i += 0.8) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), material);
    post.position.set(i, 0.5, 0);
    post.castShadow = true;
    group.add(post);
  }
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function addRock(scene: THREE.Scene, x: number, z: number, size: number): void {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ color: "#9b9b8f", roughness: 0.95 })
  );
  rock.position.set(x, size * 0.42, z);
  rock.scale.y = 0.62;
  rock.rotation.set(size, x, z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  addSoftShadow(scene, x + size * 0.35, z + size * 0.24, size * 1.9, size * 0.92, -0.2, 0.2);
}

export function addTinyFlag(scene: THREE.Scene, x: number, z: number, color: string): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: "#4a4036", roughness: 0.7 })
  );
  pole.position.y = 0.68;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.34, 0.035),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
  );
  flag.position.set(0.28, 1.08, 0);
  group.add(flag);
  group.position.set(x, 0, z);
  addSoftShadow(group, 0.32, 0.2, 1.25, 0.34, -0.2, 0.18);
  scene.add(group);
}

export function addLamp(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: "#263238", roughness: 0.6 })
  );
  pole.position.y = 1.1;
  group.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f1be54", emissiveIntensity: 1.1 })
  );
  bulb.position.y = 2.25;
  group.add(bulb);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: "#3c3a34", roughness: 0.62 })
  );
  shade.position.y = 2.48;
  shade.rotation.x = Math.PI;
  shade.castShadow = true;
  group.add(shade);

  addSoftShadow(group, 0.82, 0.36, 2.05, 0.24, -0.2, 0.24);
  addSoftShadow(group, 0.04, 0.02, 0.46, 0.34, 0, 0.12);
  group.position.set(x, 0, z);
  scene.add(group);
}

export function addLampToGroup(group: THREE.Group, x: number, z: number): void {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 1.55, 8),
    new THREE.MeshStandardMaterial({ color: "#2c332f", roughness: 0.58 })
  );
  pole.position.y = 0.78;
  lamp.add(pole);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.23, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: "#4a4840", roughness: 0.6 })
  );
  shade.position.y = 1.62;
  shade.rotation.x = Math.PI;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#ffe6a3", emissive: "#f3bd58", emissiveIntensity: 0.85 })
  );
  bulb.position.y = 1.48;
  lamp.add(bulb);

  addSoftShadow(lamp, 0.58, 0.28, 1.45, 0.2, -0.2, 0.2);
  addSoftShadow(lamp, 0.02, 0.01, 0.34, 0.24, 0, 0.1);
  lamp.position.set(x, 0, z);
  group.add(lamp);
}
