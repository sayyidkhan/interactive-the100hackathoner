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
  lightning: LightningEffect;
};

type LightningEffect = {
  group: THREE.Group;
  boltGroup: THREE.Group;
  bolts: LightningBolt[];
  light: THREE.PointLight;
  sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  sparkPositions: Float32Array;
  sparkVelocities: Float32Array;
  sparkAges: Float32Array;
  sparkLifetimes: Float32Array;
  sparkColors: Float32Array;
  sparkCursor: number;
  burnMarks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  burnTexture: THREE.CanvasTexture;
  nextStrikeAt: number;
  strikeStartedAt: number;
  active: boolean;
  stormActive: boolean;
};

type LightningBolt = {
  group: THREE.Group;
  core: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  branchCore: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  branchGlow: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  impactPoint: THREE.Vector3;
  delay: number;
  impacted: boolean;
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
  const count = 1120;
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
    color: "#dcebf1",
    map: createPrecipitationTexture("rain"),
    size: 0.4,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    alphaTest: 0.04,
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
  const lightning = createLightningEffect();
  scene.add(rain, snow, lightning.group, lightning.light);
  return { rain, snow, positions, fallSpeeds, drifts, lightning };
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
  const storming = condition === "storm";
  particles.rain.visible = raining;
  particles.snow.visible = snowing;
  updateLightning(particles.lightning, time, storming, delta);
  if (!raining && !snowing) return;
  particles.rain.geometry.setDrawRange(0, storming ? particles.fallSpeeds.length : raining ? 720 : 520);
  particles.rain.material.opacity = storming ? 0.94 : 0.76;
  particles.rain.material.size = storming ? 0.54 : 0.42;
  const velocity = snowing ? 1.15 : storming ? 13.5 : 8.8;
  const wind = THREE.MathUtils.clamp(windSpeed / 40, 0.06, 0.8);
  for (let index = 0; index < particles.fallSpeeds.length; index += 1) {
    const offset = index * 3;
    particles.positions[offset + 1] -= velocity * particles.fallSpeeds[index] * delta;
    particles.positions[offset] += wind * delta * (snowing
      ? Math.sin(time * 0.55 + particles.drifts[index])
      : storming
        ? 3.1
        : 2.1);
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

function createLightningEffect(): LightningEffect {
  const group = new THREE.Group();
  group.name = "weather-lightning-effects";
  const boltGroup = new THREE.Group();
  boltGroup.name = "weather-lightning-bolts";
  group.add(boltGroup);
  const bolts = Array.from({ length: 4 }, (_, index) => createLightningBolt(index * 0.17));
  bolts.forEach((bolt) => boltGroup.add(bolt.group));
  boltGroup.visible = false;

  const sparkCount = 240;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities = new Float32Array(sparkCount * 3);
  const sparkAges = new Float32Array(sparkCount);
  const sparkLifetimes = new Float32Array(sparkCount);
  const sparkColors = new Float32Array(sparkCount * 3);
  for (let index = 0; index < sparkCount; index += 1) {
    sparkPositions[index * 3 + 1] = -100;
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute("color", new THREE.BufferAttribute(sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkMaterial = new THREE.PointsMaterial({
    map: createSparkTexture(),
    size: 0.26,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = "weather-lightning-sparks";
  sparks.frustumCulled = false;
  sparks.renderOrder = 13;
  group.add(sparks);

  const burnTexture = createBurnTexture();
  const light = new THREE.PointLight("#d9e8ff", 0, 82, 1.25);
  light.position.set(0, 13, 0);
  light.castShadow = false;
  return {
    group,
    boltGroup,
    bolts,
    light,
    sparks,
    sparkPositions,
    sparkVelocities,
    sparkAges,
    sparkLifetimes,
    sparkColors,
    sparkCursor: 0,
    burnMarks: [],
    burnTexture,
    nextStrikeAt: Number.POSITIVE_INFINITY,
    strikeStartedAt: Number.NEGATIVE_INFINITY,
    active: false,
    stormActive: false
  };
}

function createLightningBolt(delay: number): LightningBolt {
  const placeholderCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0)
  ]);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: "#fffdf2",
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: "#b9d7ff",
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const core = new THREE.Mesh(
    new THREE.TubeGeometry(placeholderCurve, 2, 0.05, 4, false),
    coreMaterial
  );
  const glow = new THREE.Mesh(
    new THREE.TubeGeometry(placeholderCurve, 2, 0.18, 5, false),
    glowMaterial
  );
  const branchCore = new THREE.Mesh(
    new THREE.TubeGeometry(placeholderCurve, 2, 0.035, 4, false),
    coreMaterial.clone()
  );
  const branchGlow = new THREE.Mesh(
    new THREE.TubeGeometry(placeholderCurve, 2, 0.12, 5, false),
    glowMaterial.clone()
  );
  const group = new THREE.Group();
  group.name = "weather-lightning-bolt";
  group.visible = false;
  group.renderOrder = 12;
  for (const mesh of [glow, branchGlow, core, branchCore]) {
    mesh.frustumCulled = false;
    mesh.renderOrder = 12;
    group.add(mesh);
  }
  return {
    group,
    core,
    glow,
    branchCore,
    branchGlow,
    impactPoint: new THREE.Vector3(),
    delay,
    impacted: false
  };
}

function updateLightning(lightning: LightningEffect, time: number, storming: boolean, delta = 0): void {
  updateStormSparks(lightning, delta);
  if (!storming) {
    lightning.boltGroup.visible = false;
    lightning.light.intensity = 0;
    lightning.active = false;
    lightning.stormActive = false;
    lightning.nextStrikeAt = Number.POSITIVE_INFINITY;
    return;
  }

  if (!lightning.stormActive) {
    lightning.stormActive = true;
    lightning.nextStrikeAt = time + 0.45;
  }

  if (!lightning.active && time >= lightning.nextStrikeAt) {
    lightning.bolts.forEach((bolt) => regenerateLightningBolt(bolt));
    lightning.active = true;
    lightning.strikeStartedAt = time;
    lightning.nextStrikeAt = Number.POSITIVE_INFINITY;
    lightning.boltGroup.visible = true;
  }
  if (!lightning.active) return;

  const elapsed = time - lightning.strikeStartedAt;
  let strongestFlash = 0;
  let latestImpact: THREE.Vector3 | undefined;
  let anyBoltVisible = false;
  for (const bolt of lightning.bolts) {
    const localElapsed = elapsed - bolt.delay;
    if (localElapsed < 0) {
      bolt.group.visible = false;
      continue;
    }

    const travelDuration = 0.48;
    const travelProgress = THREE.MathUtils.clamp(localElapsed / travelDuration, 0, 1);
    const easedProgress = 1 - (1 - travelProgress) ** 2.4;
    setTubeProgress(bolt.core, easedProgress);
    setTubeProgress(bolt.glow, easedProgress);
    const branchProgress = THREE.MathUtils.clamp((easedProgress - 0.42) / 0.58, 0, 1);
    setTubeProgress(bolt.branchCore, branchProgress);
    setTubeProgress(bolt.branchGlow, branchProgress);

    if (travelProgress >= 1 && !bolt.impacted) {
      bolt.impacted = true;
      spawnGroundSparks(lightning, bolt.impactPoint);
      addBurnMark(lightning, bolt.impactPoint, time);
    }

    const impactElapsed = localElapsed - travelDuration;
    let strength = travelProgress < 1 ? 0.82 : 0;
    if (impactElapsed >= 0 && impactElapsed < 0.08) strength = 1;
    else if (impactElapsed < 0.17 && impactElapsed >= 0) strength = THREE.MathUtils.lerp(1, 0.2, (impactElapsed - 0.08) / 0.09);
    else if (impactElapsed < 0.25 && impactElapsed >= 0.17) strength = 0.2;
    else if (impactElapsed < 0.34 && impactElapsed >= 0.25) strength = 0.86;
    else if (impactElapsed < 0.58 && impactElapsed >= 0.34) strength = THREE.MathUtils.lerp(0.86, 0, (impactElapsed - 0.34) / 0.24);

    const visible = localElapsed < travelDuration + 0.58;
    bolt.group.visible = visible;
    anyBoltVisible ||= visible;
    bolt.core.material.opacity = strength;
    bolt.branchCore.material.opacity = strength * 0.9;
    bolt.glow.material.opacity = strength * 0.34;
    bolt.branchGlow.material.opacity = strength * 0.24;
    if (strength > strongestFlash) {
      strongestFlash = strength;
      latestImpact = bolt.impactPoint;
    }
  }

  lightning.boltGroup.visible = anyBoltVisible;
  lightning.light.intensity = strongestFlash * 11;
  if (latestImpact) lightning.light.position.set(latestImpact.x, 13, latestImpact.z);

  const lastBolt = lightning.bolts[lightning.bolts.length - 1];
  if (elapsed > lastBolt.delay + 1.08) {
    lightning.active = false;
    lightning.boltGroup.visible = false;
    lightning.light.intensity = 0;
    lightning.nextStrikeAt = time + 2.8 + Math.random() * 3.6;
  }
}

function regenerateLightningBolt(bolt: LightningBolt): void {
  const startX = (Math.random() - 0.5) * 32;
  const startZ = (Math.random() - 0.5) * 30;
  const travelX = (Math.random() - 0.5) * 10;
  const travelZ = (Math.random() - 0.5) * 10;
  const points: THREE.Vector3[] = [];
  const segments = 15;
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const jitter = 0.25 + progress * 1.35;
    points.push(new THREE.Vector3(
      startX + travelX * progress + (Math.random() - 0.5) * jitter,
      22 - progress * 21.42,
      startZ + travelZ * progress + (Math.random() - 0.5) * jitter
    ));
  }

  const branchOrigin = points[7];
  const branchPoints = [
    branchOrigin.clone(),
    branchOrigin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, -1.6, (Math.random() - 0.5) * 2.2)),
    branchOrigin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4.8, -3.8, (Math.random() - 0.5) * 4.8)),
    branchOrigin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 7.2, -6.4, (Math.random() - 0.5) * 7.2))
  ];
  const mainCurve = new THREE.CatmullRomCurve3(points);
  const branchCurve = new THREE.CatmullRomCurve3(branchPoints);
  replaceTubeGeometry(bolt.core, mainCurve, 0.055);
  replaceTubeGeometry(bolt.glow, mainCurve, 0.2);
  replaceTubeGeometry(bolt.branchCore, branchCurve, 0.038);
  replaceTubeGeometry(bolt.branchGlow, branchCurve, 0.13);
  bolt.impactPoint.copy(points[points.length - 1]);
  bolt.impacted = false;
  bolt.group.visible = false;
  setTubeProgress(bolt.core, 0);
  setTubeProgress(bolt.glow, 0);
  setTubeProgress(bolt.branchCore, 0);
  setTubeProgress(bolt.branchGlow, 0);
}

function replaceTubeGeometry(
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>,
  curve: THREE.CatmullRomCurve3,
  radius: number
): void {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(curve, 36, radius, 5, false);
}

function setTubeProgress(
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>,
  progress: number
): void {
  const indexCount = mesh.geometry.index?.count ?? 0;
  const segmentSize = 30;
  const visibleCount = Math.floor((indexCount * THREE.MathUtils.clamp(progress, 0, 1)) / segmentSize) * segmentSize;
  mesh.geometry.setDrawRange(0, visibleCount);
}

function spawnGroundSparks(lightning: LightningEffect, impactPoint: THREE.Vector3): void {
  const sparkCount = 28;
  for (let spark = 0; spark < sparkCount; spark += 1) {
    const index = lightning.sparkCursor;
    lightning.sparkCursor = (lightning.sparkCursor + 1) % lightning.sparkAges.length;
    const offset = index * 3;
    const angle = Math.random() * Math.PI * 2;
    const horizontalSpeed = 1.8 + Math.random() * 4.6;
    lightning.sparkPositions[offset] = impactPoint.x;
    lightning.sparkPositions[offset + 1] = 0.18 + Math.random() * 0.16;
    lightning.sparkPositions[offset + 2] = impactPoint.z;
    lightning.sparkVelocities[offset] = Math.cos(angle) * horizontalSpeed;
    lightning.sparkVelocities[offset + 1] = 2.6 + Math.random() * 5.4;
    lightning.sparkVelocities[offset + 2] = Math.sin(angle) * horizontalSpeed;
    lightning.sparkAges[index] = 0;
    lightning.sparkLifetimes[index] = 0.48 + Math.random() * 0.48;
  }
  lightning.sparks.geometry.attributes.position.needsUpdate = true;
}

function updateStormSparks(lightning: LightningEffect, delta: number): void {
  if (delta <= 0) return;
  for (let index = 0; index < lightning.sparkAges.length; index += 1) {
    const lifetime = lightning.sparkLifetimes[index];
    if (lifetime <= 0) continue;
    const offset = index * 3;
    const age = lightning.sparkAges[index] + delta;
    lightning.sparkAges[index] = age;
    if (age >= lifetime || lightning.sparkPositions[offset + 1] <= 0.05) {
      lightning.sparkLifetimes[index] = 0;
      lightning.sparkPositions[offset + 1] = -100;
      lightning.sparkColors[offset] = 0;
      lightning.sparkColors[offset + 1] = 0;
      lightning.sparkColors[offset + 2] = 0;
      continue;
    }
    lightning.sparkVelocities[offset + 1] -= 9.4 * delta;
    lightning.sparkPositions[offset] += lightning.sparkVelocities[offset] * delta;
    lightning.sparkPositions[offset + 1] += lightning.sparkVelocities[offset + 1] * delta;
    lightning.sparkPositions[offset + 2] += lightning.sparkVelocities[offset + 2] * delta;
    const life = 1 - age / lifetime;
    lightning.sparkColors[offset] = 1;
    lightning.sparkColors[offset + 1] = 0.24 + life * 0.66;
    lightning.sparkColors[offset + 2] = 0.03 + life * 0.18;
  }
  lightning.sparks.geometry.attributes.position.needsUpdate = true;
  lightning.sparks.geometry.attributes.color.needsUpdate = true;
}

function addBurnMark(lightning: LightningEffect, impactPoint: THREE.Vector3, time: number): void {
  const material = new THREE.MeshBasicMaterial({
    map: lightning.burnTexture,
    color: "#3b281d",
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), material);
  mark.name = "weather-lightning-scorch";
  mark.position.set(impactPoint.x, 0.045, impactPoint.z);
  mark.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
  const scale = 0.72 + Math.random() * 0.58;
  mark.scale.set(scale, scale * (0.78 + Math.random() * 0.34), 1);
  mark.renderOrder = 1;
  mark.userData.createdAt = time;
  lightning.group.add(mark);
  lightning.burnMarks.push(mark);
  if (lightning.burnMarks.length > 18) {
    const oldest = lightning.burnMarks.shift();
    if (oldest) {
      lightning.group.remove(oldest);
      oldest.geometry.dispose();
      oldest.material.dispose();
    }
  }
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create lightning spark texture");
  const glow = context.createRadialGradient(16, 16, 1, 16, 16, 15);
  glow.addColorStop(0, "rgba(255,255,235,1)");
  glow.addColorStop(0.22, "rgba(255,204,82,1)");
  glow.addColorStop(0.58, "rgba(255,117,30,0.62)");
  glow.addColorStop(1, "rgba(255,82,20,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBurnTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create lightning scorch texture");
  const scorch = context.createRadialGradient(64, 64, 8, 64, 64, 62);
  scorch.addColorStop(0, "rgba(24,14,10,0.92)");
  scorch.addColorStop(0.32, "rgba(45,25,16,0.82)");
  scorch.addColorStop(0.62, "rgba(91,50,28,0.42)");
  scorch.addColorStop(0.84, "rgba(71,44,27,0.16)");
  scorch.addColorStop(1, "rgba(47,34,24,0)");
  context.fillStyle = scorch;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
