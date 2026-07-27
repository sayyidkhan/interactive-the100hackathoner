import * as THREE from "three";

export type AtmosphereObject = {
  object: THREE.Object3D;
  speed: number;
};

export type SakuraPetal = {
  mesh: THREE.InstancedMesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  origins: THREE.Vector3[];
  phases: Float32Array;
  drifts: Float32Array;
  fallSpeeds: Float32Array;
  scales: Float32Array;
  transform: THREE.Object3D;
};

export type Firefly = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  origins: THREE.Vector3[];
  phases: Float32Array;
  radii: Float32Array;
  speeds: Float32Array;
  positions: Float32Array;
  colors: Float32Array;
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

export function createSakuraPetals(scene: THREE.Scene): SakuraPetal {
  const count = 46;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.13);
  shape.quadraticCurveTo(0.1, 0.03, 0, -0.13);
  shape.quadraticCurveTo(-0.1, 0.03, 0, 0.13);
  const geometry = new THREE.ShapeGeometry(shape);
  const colors = ["#e7a4ae", "#f1c2c0", "#c49bad", "#dfb0b4"];
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexColors: true
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const origins: THREE.Vector3[] = [];
  const phases = new Float32Array(count);
  const drifts = new Float32Array(count);
  const fallSpeeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const transform = new THREE.Object3D();

  for (let index = 0; index < count; index += 1) {
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 42, 0.65 + Math.random() * 7, (Math.random() - 0.5) * 38);
    origins.push(origin);
    phases[index] = phase;
    drifts[index] = 0.45 + Math.random() * 0.7;
    fallSpeeds[index] = 0.28 + Math.random() * 0.26;
    scales[index] = 0.65 + Math.random() * 1.25;
    transform.position.copy(origin);
    transform.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, phase);
    transform.scale.setScalar(scales[index]);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, new THREE.Color(colors[index % colors.length]));
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, origins, phases, drifts, fallSpeeds, scales, transform };
}

export function createFireflies(scene: THREE.Scene): Firefly {
  const count = 30;
  const texture = createFireflyTexture();
  const origins: THREE.Vector3[] = [];
  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const speeds = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3((Math.random() - 0.5) * 38, 0.55 + Math.random() * 3.5, (Math.random() - 0.5) * 34);
    origins.push(origin);
    phases[index] = phase;
    radii[index] = 0.14 + Math.random() * 0.35;
    speeds[index] = 0.65 + Math.random() * 0.8;
    positions[index * 3] = origin.x;
    positions[index * 3 + 1] = origin.y;
    positions[index * 3 + 2] = origin.z;
    colors[index * 3] = 1;
    colors[index * 3 + 1] = 0.84;
    colors[index * 3 + 2] = 0.34;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  scene.add(points);
  return { points, origins, phases, radii, speeds, positions, colors };
}

export function updateAtmosphere(atmosphere: AtmosphereObject[], delta: number): void {
  for (const item of atmosphere) {
    item.object.position.x += item.speed * delta;
    if (item.object.position.x > 38) item.object.position.x = -38;
  }
}

export function updateSakuraPetals(petals: SakuraPetal, time: number): void {
  for (let index = 0; index < petals.origins.length; index += 1) {
    const origin = petals.origins[index];
    const phase = petals.phases[index];
    const drift = petals.drifts[index];
    const fallSpan = 7.5;
    const wrappedHeight = ((origin.y - time * petals.fallSpeeds[index] + phase) % fallSpan + fallSpan) % fallSpan;
    petals.transform.position.set(
      origin.x + Math.sin(time * 0.7 + phase) * drift,
      0.35 + wrappedHeight,
      origin.z + Math.cos(time * 0.52 + phase * 1.4) * drift
    );
    petals.transform.rotation.set(
      time * 1.1 + phase,
      time * 0.7 + phase * 0.6,
      Math.sin(time * 1.7 + phase) * 0.85
    );
    petals.transform.scale.setScalar(petals.scales[index]);
    petals.transform.updateMatrix();
    petals.mesh.setMatrixAt(index, petals.transform.matrix);
  }
  petals.mesh.instanceMatrix.needsUpdate = true;
}

export function updateFireflies(fireflies: Firefly, time: number): void {
  for (let index = 0; index < fireflies.origins.length; index += 1) {
    const origin = fireflies.origins[index];
    const phase = time * fireflies.speeds[index] + fireflies.phases[index];
    fireflies.positions[index * 3] = origin.x + Math.cos(phase) * fireflies.radii[index];
    fireflies.positions[index * 3 + 1] = origin.y + Math.sin(phase * 1.7) * 0.28;
    fireflies.positions[index * 3 + 2] = origin.z + Math.sin(phase * 0.78) * fireflies.radii[index];
    const pulse = 0.72 + Math.sin(phase * 2.6) * 0.28;
    fireflies.colors[index * 3] = 0.7 + pulse * 0.3;
    fireflies.colors[index * 3 + 1] = 0.5 + pulse * 0.34;
    fireflies.colors[index * 3 + 2] = 0.12 + pulse * 0.22;
  }
  fireflies.points.geometry.attributes.position.needsUpdate = true;
  fireflies.points.geometry.attributes.color.needsUpdate = true;
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
