import * as THREE from "three";
import {
  type FallingFoliage,
  type SeasonChoice,
  type WeatherCondition
} from "../data/townSchema";

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
  spinRates: Float32Array;
  transform: THREE.Object3D;
};

export type Firefly = {
  core: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  halo: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  origins: THREE.Vector3[];
  phases: Float32Array;
  radii: Float32Array;
  speeds: Float32Array;
  positions: Float32Array;
  colors: Float32Array;
};

export type WeatherParticles = {
  rain: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  snow: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  positions: Float32Array;
  fallSpeeds: Float32Array;
  drifts: Float32Array;
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
  const count = 128;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.13);
  shape.quadraticCurveTo(0.1, 0.03, 0, -0.13);
  shape.quadraticCurveTo(-0.1, 0.03, 0, 0.13);
  const geometry = new THREE.ShapeGeometry(shape);
  const colors = ["#dba8aa", "#e8bfba", "#b89aa4", "#d4aaa9", "#8e817d"];
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.62,
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
  const spinRates = new Float32Array(count);
  const transform = new THREE.Object3D();
  const zones = [
    { x: 0, z: 1, radius: 10 },
    { x: 11, z: 13, radius: 7 },
    { x: -13, z: 9, radius: 7 },
    { x: 14, z: -10, radius: 7 },
    { x: -12, z: -12, radius: 7 }
  ] as const;

  for (let index = 0; index < count; index += 1) {
    const phase = Math.random() * Math.PI * 2;
    const zone = zones[index % zones.length];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * zone.radius;
    const origin = new THREE.Vector3(
      zone.x + Math.cos(angle) * distance,
      0.65 + Math.random() * 7,
      zone.z + Math.sin(angle) * distance
    );
    origins.push(origin);
    phases[index] = phase;
    drifts[index] = 0.32 + Math.random() * 0.58;
    fallSpeeds[index] = 0.24 + Math.random() * 0.22;
    scales[index] = 0.48 + Math.random() * 0.68;
    spinRates[index] = 0.58 + Math.random() * 0.72;
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
  return { mesh, origins, phases, drifts, fallSpeeds, scales, spinRates, transform };
}

export function createFireflies(scene: THREE.Scene): Firefly {
  const count = 150;
  const texture = createFireflyTexture();
  const zones = [
    { x: 0, z: 0, radius: 8.5, weight: 0.34 },
    { x: 9, z: 14, radius: 7, weight: 0.26 },
    { x: -13, z: 10, radius: 6.5, weight: 0.2 },
    { x: 14, z: -9, radius: 6.5, weight: 0.2 }
  ] as const;
  const origins: THREE.Vector3[] = [];
  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const speeds = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const zoneRoll = Math.random();
    let weightTotal = 0;
    const zone = zones.find((candidate) => {
      weightTotal += candidate.weight;
      return zoneRoll <= weightTotal;
    }) ?? zones[0];
    const zoneAngle = Math.random() * Math.PI * 2;
    const zoneRadius = Math.sqrt(Math.random()) * zone.radius;
    const phase = Math.random() * Math.PI * 2;
    const origin = new THREE.Vector3(
      zone.x + Math.cos(zoneAngle) * zoneRadius,
      0.7 + Math.random() * 1.9,
      zone.z + Math.sin(zoneAngle) * zoneRadius
    );
    origins.push(origin);
    phases[index] = phase;
    radii[index] = 0.24 + Math.random() * 0.5;
    speeds[index] = 0.22 + Math.random() * 0.3;
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
  const haloMaterial = new THREE.PointsMaterial({
    map: texture,
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    fog: false
  });
  const coreMaterial = new THREE.PointsMaterial({
    map: texture,
    size: 0.14,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    fog: false
  });
  const halo = new THREE.Points(geometry, haloMaterial);
  const core = new THREE.Points(geometry, coreMaterial);
  halo.frustumCulled = false;
  core.frustumCulled = false;
  halo.renderOrder = 2;
  core.renderOrder = 3;
  scene.add(halo, core);
  return { core, halo, origins, phases, radii, speeds, positions, colors };
}

export function createWeatherParticles(scene: THREE.Scene): WeatherParticles {
  const count = 440;
  const positions = new Float32Array(count * 3);
  const fallSpeeds = new Float32Array(count);
  const drifts = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 62;
    positions[index * 3 + 1] = 0.5 + Math.random() * 12;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 62;
    fallSpeeds[index] = 0.72 + Math.random() * 0.65;
    drifts[index] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.PointsMaterial({
    color: "#c8d8df",
    map: createPrecipitationTexture("rain"),
    size: 0.32,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    alphaTest: 0.08,
    fog: true
  });
  const snowMaterial = new THREE.PointsMaterial({
    color: "#fffaf0",
    map: createPrecipitationTexture("snow"),
    size: 0.25,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    alphaTest: 0.04,
    fog: true
  });
  const rain = new THREE.Points(geometry, rainMaterial);
  const snow = new THREE.Points(geometry, snowMaterial);
  rain.visible = false;
  snow.visible = false;
  rain.frustumCulled = false;
  snow.frustumCulled = false;
  rain.renderOrder = 4;
  snow.renderOrder = 4;
  scene.add(rain, snow);
  return { rain, snow, positions, fallSpeeds, drifts };
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
    const horizontalDrift =
      Math.sin(time * 0.42 + phase) * drift
      + Math.sin(time * 0.16 + phase * 2.1) * drift * 0.42;
    const depthDrift =
      Math.cos(time * 0.34 + phase * 1.4) * drift
      + Math.sin(time * 0.13 + phase * 0.8) * drift * 0.36;
    const edgeFade =
      THREE.MathUtils.smoothstep(wrappedHeight, 0, 0.7)
      * (1 - THREE.MathUtils.smoothstep(wrappedHeight, fallSpan - 0.85, fallSpan));
    const windTravel = (fallSpan - wrappedHeight) * 0.24;
    petals.transform.position.set(
      origin.x + horizontalDrift + windTravel,
      0.35 + wrappedHeight,
      origin.z + depthDrift
    );
    petals.transform.rotation.set(
      time * 0.62 * petals.spinRates[index] + phase,
      time * 0.48 * petals.spinRates[index] + phase * 0.6,
      Math.sin(time * 0.72 + phase) * 0.72
    );
    petals.transform.scale.setScalar(petals.scales[index] * edgeFade);
    petals.transform.updateMatrix();
    petals.mesh.setMatrixAt(index, petals.transform.matrix);
  }
  petals.mesh.instanceMatrix.needsUpdate = true;
}

export function setFallingFoliageAppearance(
  petals: SakuraPetal,
  style: FallingFoliage,
  season: Exclude<SeasonChoice, "auto">
): void {
  const sakura = ["#dba8aa", "#e8bfba", "#b89aa4", "#d4aaa9", "#f1d0c8"];
  const seasonalLeaves: Record<Exclude<SeasonChoice, "auto">, string[]> = {
    spring: ["#91aa68", "#b5bd78", "#7e9c5e", "#c6b981", "#89a56b"],
    summer: ["#527c48", "#678e50", "#466f43", "#78985a", "#5f844c"],
    autumn: ["#c77b3c", "#d89a4b", "#a85532", "#d1aa58", "#9a6540"],
    winter: ["#9b8d7b", "#b7a68e", "#7e8177", "#a99c88", "#8e817d"],
    wet: ["#557f51", "#6f965d", "#4d744c", "#87a66b", "#668c58"],
    dry: ["#b58b4f", "#c6a05e", "#8e7448", "#d0ad67", "#9f7c46"]
  };
  const leaves = seasonalLeaves[season];
  petals.mesh.visible = style !== "off";
  for (let index = 0; index < petals.origins.length; index += 1) {
    const palette = style === "sakura" || (style === "mixed" && index % 2 === 0) ? sakura : leaves;
    petals.mesh.setColorAt(index, new THREE.Color(palette[index % palette.length]));
  }
  if (petals.mesh.instanceColor) petals.mesh.instanceColor.needsUpdate = true;
}

export function updateWeatherParticles(
  particles: WeatherParticles,
  delta: number,
  time: number,
  condition: WeatherCondition,
  windSpeed: number
): void {
  const snowing = condition === "snow";
  const raining = condition === "rain" || condition === "storm";
  particles.rain.visible = raining;
  particles.snow.visible = snowing;
  if (!raining && !snowing) return;
  particles.rain.material.opacity = condition === "storm" ? 0.76 : 0.62;
  particles.rain.material.size = condition === "storm" ? 0.38 : 0.32;
  const velocity = snowing ? 1.15 : condition === "storm" ? 9.5 : 7.2;
  const wind = THREE.MathUtils.clamp(windSpeed / 40, 0.06, 0.8);
  for (let index = 0; index < particles.fallSpeeds.length; index += 1) {
    const offset = index * 3;
    particles.positions[offset + 1] -= velocity * particles.fallSpeeds[index] * delta;
    particles.positions[offset] += wind * delta * (snowing ? Math.sin(time * 0.55 + particles.drifts[index]) : 1.8);
    if (snowing) particles.positions[offset + 2] += Math.cos(time * 0.42 + particles.drifts[index]) * delta * 0.18;
    if (particles.positions[offset + 1] < 0.2) {
      particles.positions[offset + 1] = 9 + Math.random() * 4;
      particles.positions[offset] = (Math.random() - 0.5) * 62;
      particles.positions[offset + 2] = (Math.random() - 0.5) * 62;
    }
    if (particles.positions[offset] > 31) particles.positions[offset] = -31;
  }
  particles.rain.geometry.attributes.position.needsUpdate = true;
}

export function updateFireflies(fireflies: Firefly, time: number): void {
  for (let index = 0; index < fireflies.origins.length; index += 1) {
    const origin = fireflies.origins[index];
    const phase = time * fireflies.speeds[index] + fireflies.phases[index];
    const secondary = time * fireflies.speeds[index] * 0.47 + fireflies.phases[index] * 1.7;
    const radius = fireflies.radii[index];
    fireflies.positions[index * 3] =
      origin.x + Math.cos(phase) * radius + Math.sin(secondary * 1.31) * radius * 0.52;
    fireflies.positions[index * 3 + 1] =
      origin.y + Math.sin(phase * 1.12) * 0.18 + Math.cos(secondary * 0.73) * 0.1;
    fireflies.positions[index * 3 + 2] =
      origin.z + Math.sin(phase * 0.82) * radius + Math.cos(secondary * 1.19) * radius * 0.46;
    const pulse = 0.62 + Math.sin(time * (1.15 + fireflies.speeds[index]) + fireflies.phases[index] * 2.3) * 0.38;
    fireflies.colors[index * 3] = 0.82 + pulse * 0.18;
    fireflies.colors[index * 3 + 1] = 0.5 + pulse * 0.3;
    fireflies.colors[index * 3 + 2] = 0.1 + pulse * 0.12;
  }
  fireflies.core.geometry.attributes.position.needsUpdate = true;
  fireflies.core.geometry.attributes.color.needsUpdate = true;
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
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create firefly texture");
  const glow = context.createRadialGradient(64, 64, 1, 64, 64, 62);
  glow.addColorStop(0, "rgba(255, 252, 220, 1)");
  glow.addColorStop(0.1, "rgba(255, 235, 160, 0.9)");
  glow.addColorStop(0.3, "rgba(246, 185, 80, 0.4)");
  glow.addColorStop(0.62, "rgba(238, 169, 71, 0.08)");
  glow.addColorStop(1, "rgba(255, 177, 77, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPrecipitationTexture(kind: "rain" | "snow"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create precipitation texture");
  const gradient = context.createRadialGradient(16, kind === "rain" ? 42 : 32, 1, 16, 32, kind === "rain" ? 26 : 12);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  if (kind === "rain") context.fillRect(13, 3, 6, 58);
  else context.beginPath(), context.arc(16, 32, 11, 0, Math.PI * 2), context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
