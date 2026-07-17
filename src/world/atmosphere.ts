import * as THREE from "three";

export type AtmosphereObject = {
  object: THREE.Object3D;
  speed: number;
};

export type SakuraPetal = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  origin: THREE.Vector3;
  phase: number;
  drift: number;
  fallSpeed: number;
};

export type Firefly = {
  sprite: THREE.Sprite;
  origin: THREE.Vector3;
  phase: number;
  radius: number;
  speed: number;
};

export function createAtmosphere(scene: THREE.Scene): AtmosphereObject[] {
  const atmosphere: AtmosphereObject[] = [];
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: "#fff8e7",
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });

  for (const [x, y, z, scale, speed] of [
    [-28, 9.2, -29, 1.05, 0.24],
    [-9, 10.4, -34, 1.4, 0.18],
    [13, 9.8, -30, 0.92, 0.2],
    [29, 10.8, -12, 1.18, 0.16]
  ] as const) {
    const cloud = createCloud(cloudMaterial.clone(), scale);
    cloud.position.set(x, y, z);
    scene.add(cloud);
    atmosphere.push({ object: cloud, speed });
  }

  return atmosphere;
}

export function createSakuraPetals(scene: THREE.Scene): SakuraPetal[] {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.13);
  shape.quadraticCurveTo(0.1, 0.03, 0, -0.13);
  shape.quadraticCurveTo(-0.1, 0.03, 0, 0.13);
  const geometry = new THREE.ShapeGeometry(shape);
  const colors = ["#e7a4ae", "#f1c2c0", "#c49bad", "#dfb0b4"];
  const petals: SakuraPetal[] = [];

  for (let index = 0; index < 46; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: colors[index % colors.length],
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 42, 0.65 + Math.random() * 7, (Math.random() - 0.5) * 38);
    mesh.position.copy(origin);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, phase);
    mesh.scale.setScalar(0.65 + Math.random() * 1.25);
    mesh.renderOrder = 2;
    scene.add(mesh);
    petals.push({ mesh, origin, phase, drift: 0.45 + Math.random() * 0.7, fallSpeed: 0.28 + Math.random() * 0.26 });
  }
  return petals;
}

export function createFireflies(scene: THREE.Scene): Firefly[] {
  const texture = createFireflyTexture();
  const fireflies: Firefly[] = [];
  for (let index = 0; index < 30; index += 1) {
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 38, 0.55 + Math.random() * 3.5, (Math.random() - 0.5) * 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, color: "#ffd76a", transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sprite.position.copy(origin);
    sprite.scale.setScalar(0.22 + Math.random() * 0.2);
    sprite.renderOrder = 3;
    scene.add(sprite);
    fireflies.push({ sprite, origin, phase, radius: 0.14 + Math.random() * 0.35, speed: 0.65 + Math.random() * 0.8 });
  }
  return fireflies;
}

export function updateAtmosphere(atmosphere: AtmosphereObject[], delta: number): void {
  for (const item of atmosphere) {
    item.object.position.x += item.speed * delta;
    if (item.object.position.x > 38) item.object.position.x = -38;
  }
}

export function updateSakuraPetals(petals: SakuraPetal[], time: number): void {
  for (const petal of petals) {
    const fallSpan = 7.5;
    const wrappedHeight = ((petal.origin.y - time * petal.fallSpeed + petal.phase) % fallSpan + fallSpan) % fallSpan;
    petal.mesh.position.set(
      petal.origin.x + Math.sin(time * 0.7 + petal.phase) * petal.drift,
      0.35 + wrappedHeight,
      petal.origin.z + Math.cos(time * 0.52 + petal.phase * 1.4) * petal.drift
    );
    petal.mesh.rotation.x = time * 1.1 + petal.phase;
    petal.mesh.rotation.y = time * 0.7 + petal.phase * 0.6;
    petal.mesh.rotation.z = Math.sin(time * 1.7 + petal.phase) * 0.85;
  }
}

export function updateFireflies(fireflies: Firefly[], time: number): void {
  for (const firefly of fireflies) {
    const phase = time * firefly.speed + firefly.phase;
    firefly.sprite.position.set(
      firefly.origin.x + Math.cos(phase) * firefly.radius,
      firefly.origin.y + Math.sin(phase * 1.7) * 0.28,
      firefly.origin.z + Math.sin(phase * 0.78) * firefly.radius
    );
    const pulse = 0.72 + Math.sin(phase * 2.6) * 0.28;
    firefly.sprite.material.opacity = 0.48 + pulse * 0.44;
    firefly.sprite.scale.setScalar(0.18 + pulse * 0.2);
  }
}

function createCloud(material: THREE.Material, scale: number): THREE.Group {
  const group = new THREE.Group();
  const pieces = [
    [-0.9, 0, 0, 0.7],
    [-0.25, 0.12, 0.05, 0.95],
    [0.48, 0.02, -0.03, 0.78],
    [1.05, -0.04, 0.02, 0.52]
  ] as const;

  for (const [x, y, z, radius] of pieces) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 18, 12), material);
    puff.position.set(x * scale, y * scale, z * scale);
    puff.scale.y = 0.58;
    group.add(puff);
  }
  return group;
}

function createFireflyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create firefly texture");
  const glow = context.createRadialGradient(48, 48, 1, 48, 48, 45);
  glow.addColorStop(0, "rgba(255, 252, 208, 1)");
  glow.addColorStop(0.16, "rgba(255, 221, 112, 0.95)");
  glow.addColorStop(0.45, "rgba(255, 197, 74, 0.3)");
  glow.addColorStop(1, "rgba(255, 197, 74, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
