import * as THREE from "three";
import type { CollisionShape } from "../../world/player/movement";
import { addSoftShadow, applySceneShadows } from "../../world/rendering/shadows";
import { COASTAL_LANDMARKS, type CoastalLandmark } from "./content";
import { makeSkyMaterial, makeWaterMaterial, matSway, matte, type SwayTimeUniform } from "./materials";
import type { CoastalEnvironmentState, CoastalPalette } from "./environment";

export type LandmarkAnchor = {
  landmark: CoastalLandmark;
  object: THREE.Group;
  marker: THREE.Mesh;
};

export type CoastalScene = {
  colliders: CollisionShape[];
  landmarks: LandmarkAnchor[];
  transit: { boat: THREE.Group; balloon: THREE.Group };
  getGroundHeight(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  setSunDirection(direction: THREE.Vector3): void;
  applyEnvironment(state: CoastalEnvironmentState, palette: CoastalPalette): void;
  setTourRoute(from: THREE.Vector3, target: THREE.Vector3 | null): void;
  update(time: number, delta: number, isModalOpen?: boolean): void;
};

const colors = {
  sand: "#dfc99c",
  sandEdge: "#bea878",
  grass: "#789d71",
  grassDark: "#4d7658",
  timber: "#78533c",
  cream: "#f1e4ca",
  ink: "#273941"
};

const WATER_Y = -0.55;

const COASTAL_TRAIL_POINTS = [
  new THREE.Vector3(24, 0, -142),
  new THREE.Vector3(24, 0, -120),
  new THREE.Vector3(24, 0, -96),
  new THREE.Vector3(31, 0, -68),
  new THREE.Vector3(28, 0, -38),
  new THREE.Vector3(35, 0, -4),
  new THREE.Vector3(34, 0, 29),
  new THREE.Vector3(25, 0, 62)
];

const smooth01 = (value: number): number => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

const smoothRange = (from: number, to: number, value: number): number => {
  if (Math.abs(to - from) < 0.0001) return value >= to ? 1 : 0;
  return smooth01((value - from) / (to - from));
};

const hash2 = (x: number, z: number): number => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function coastalShoreX(z: number): number {
  const inlet = 13 * Math.exp(-(((z + 16) / 54) ** 2));
  const northernCove = -7 * Math.exp(-(((z + 104) / 31) ** 2));
  return 18 * Math.sin(z * 0.016 + 0.35) + 7 * Math.sin(z * 0.043) + inlet + northernCove;
}

type LandmarkPlacement = {
  x: number;
  y: number;
  z: number;
};

type HarborPier = {
  group: THREE.Group;
  walkableColliders: CollisionShape[];
  isWalkable(x: number, z: number): boolean;
};

type CloudFormation = {
  group: THREE.Group;
  x0: number;
  speed: number;
  range: number;
  phase: number;
};

type CloudLayer = {
  formations: CloudFormation[];
  setWeather(weather: CoastalEnvironmentState["weather"]): void;
  update(time: number): void;
};

type GullMember = {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  phase: number;
  offset: number;
};

type GullFlock = {
  group: THREE.Group;
  members: GullMember[];
  radius: number;
  speed: number;
  start: number;
};

type SmokePuff = {
  mesh: THREE.Mesh;
  emitter: THREE.Vector3;
  offset: number;
  phase: number;
};

type DistrictLife = {
  smokePuffs: SmokePuff[];
  emissiveMaterials: THREE.MeshStandardMaterial[];
};

type FarSail = {
  group: THREE.Group;
  x0: number;
  z: number;
  range: number;
  speed: number;
  phase: number;
};

type Dolphin = {
  mesh: THREE.Mesh;
  offset: number;
};

type DolphinPod = {
  group: THREE.Group;
  dolphins: Dolphin[];
  nextEventAt: number;
  eventStart: number;
  heading: number;
  originX: number;
  originZ: number;
  active: boolean;
};

type CampLife = {
  flames: THREE.Mesh[];
  flameMaterials: THREE.MeshStandardMaterial[];
  light: THREE.PointLight;
};

/**
 * Checks the entire usable building footprint instead of trusting a centre
 * terrain sample. This prevents coast-side structures from looking grounded
 * while their outer walls are below the waterline.
 */
function isDryBuildingPad(x: number, z: number, radius: number, inlandDistance = 9): boolean {
  const samples: Array<[number, number]> = [[0, 0]];
  for (const fraction of [0.46, 0.76, 1]) {
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      samples.push([Math.cos(angle) * radius * fraction, Math.sin(angle) * radius * fraction]);
    }
  }
  return samples.every(([offsetX, offsetZ]) => {
    const sampleX = x + offsetX;
    const sampleZ = z + offsetZ;
    return coastalTerrainBaseHeight(sampleX, sampleZ) > WATER_Y + 0.35
      && sampleX - coastalShoreX(sampleZ) >= inlandDistance;
  });
}

function landmarkFootprintRadius(landmark: CoastalLandmark): number {
  if (landmark.kind === "archive") return 6.5;
  if (landmark.kind === "lighthouse") return 3.8;
  if (landmark.kind === "career") return 7;
  if (landmark.kind === "workshop") return 5;
  return 4.2;
}

function resolveDryLandmarkPlacement(landmark: CoastalLandmark): LandmarkPlacement {
  const [x, , z] = landmark.position;
  const radius = landmarkFootprintRadius(landmark);
  if (isDryBuildingPad(x, z, radius)) return { x, y: coastalTerrainHeight(x, z), z };

  // Keep a bad content coordinate from ever silently placing a landmark in the
  // sea. Search inward first so the scene remains geographically coherent.
  for (let inland = 2; inland <= 34; inland += 2) {
    for (const zOffset of [0, -3, 3, -6, 6, -9, 9]) {
      const candidateX = x + inland;
      const candidateZ = z + zOffset;
      if (isDryBuildingPad(candidateX, candidateZ, radius)) {
        return { x: candidateX, y: coastalTerrainHeight(candidateX, candidateZ), z: candidateZ };
      }
    }
  }
  throw new Error(`No dry footprint found for coastal landmark: ${landmark.id}`);
}

function coastalTerrainBaseHeight(x: number, z: number): number {
  const coastDistance = x - coastalShoreX(z);
  const land = smoothRange(-8, 22, coastDistance);
  const northernRise = Math.pow(smoothRange(64, -152, z), 1.56);
  const inland = smoothRange(4, 86, coastDistance);
  const bluff = Math.pow(smoothRange(35, 98, coastDistance), 1.42);
  let height = land * (0.35 + northernRise * 23 + bluff * (3.5 + northernRise * 10));
  height += land * inland * 4.8 * Math.sin(x * 0.043 + 1.3) * Math.sin(z * 0.031);
  height += land * 7.6 * smoothRange(14, 55, coastDistance) * Math.exp(-(((z - 2) / 78) ** 2));
  height += land * Math.pow(smoothRange(118, 185, coastDistance), 1.4) * 24;
  height -= height * 0.2 * Math.exp(-(((z + 72) / 37) ** 2));
  height += land * Math.sin(x * 0.088) * Math.cos(z * 0.068) * 1.12 * (0.3 + inland);
  // A shallow creek cuts diagonally through the interior bluff and makes the
  // main road read as a route through geography rather than a line on a plane.
  const creekX = 55 + Math.sin(z * 0.024) * 11;
  const creek = Math.exp(-(((x - creekX) / 7.2) ** 2));
  height -= land * creek * (2.8 + northernRise * 5.5);
  height = Math.max(height, 0.22 * land);
  height -= (1 - land) * 4.2;
  return height;
}

const LANDMARK_PADS = new Map(COASTAL_LANDMARKS.map((landmark) => [
  `${landmark.position[0]}:${landmark.position[2]}`,
  coastalTerrainBaseHeight(landmark.position[0], landmark.position[2])
]));

export function coastalTerrainHeight(x: number, z: number): number {
  let height = coastalTerrainBaseHeight(x, z);
  for (const landmark of COASTAL_LANDMARKS) {
    const padHeight = LANDMARK_PADS.get(`${landmark.position[0]}:${landmark.position[2]}`) ?? height;
    const distance = Math.hypot(x - landmark.position[0], z - landmark.position[2]);
    const blend = 1 - smoothRange(4.8, 8.2, distance);
    height = THREE.MathUtils.lerp(height, padHeight, blend);
  }
  return height;
}

export function createCoastalScene(scene: THREE.Scene): CoastalScene {
  const world = new THREE.Group();
  world.name = "kairui-coastal-world";
  scene.add(world);

  const skyMaterial = makeSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 18), skyMaterial);
  sky.position.y = 36;
  world.add(sky);

  const waterMaterial = makeWaterMaterial();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 96, 96), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-160, WATER_Y, -20);
  world.add(water);

  const terrain = createCoastalTerrain(world);
  const swayUniforms: SwayTimeUniform[] = [];
  createCoastalCliffs(world);
  createCoastalRoad(world);
  createCreekAndBridges(world);
  const pier = createPier(world);
  createDistantIslands(world);
  createShoreline(world);
  createHeadlandDetails(world);
  createHundredLanternWalk(world);

  const colliders: CollisionShape[] = [...pier.walkableColliders];
  const landmarks = COASTAL_LANDMARKS.map((landmark) => {
    const anchor = createLandmark(world, landmark, colliders);
    return anchor;
  });
  const districtLife = createDistrictSetDressing(world);

  const palms = [
    [18, -110, 0.2], [35, -105, -0.35], [48, -94, 0.5], [17, -76, -0.25],
    [46, -69, 0.3], [16, -52, -0.4], [52, -41, 0.15], [15, -25, 0.5],
    [51, -12, -0.2], [18, 4, 0.15], [54, 17, 0.35], [16, 34, -0.3],
    [46, 48, 0.15], [22, 61, -0.28]
  ] as const;
  // Keep tree canopies off the wet shelf. Some of the authored palm coordinates
  // sit close to a wavy shoreline, so validate them against the same terrain and
  // shore rules used by procedural vegetation.
  palms.forEach(([x, z, rotation], index) => {
    if (coastalTerrainHeight(x, z) > 0.4 && x - coastalShoreX(z) >= 6) {
      createPalm(world, x, z, rotation, index, swayUniforms);
    }
  });
  createCoastalForest(world, swayUniforms);
  const clouds = createClouds(world);
  const boat = createBoat(world);
  const balloon = createBalloon(world);
  const gullFlocks = createSeaBirds(world);
  const celestial = createCelestial(world);
  const tourRoute = createTourRoute(world);
  const seasonal = createSeasonalLayer(world, swayUniforms);
  const weather = createWeatherLayer(world);
  const farSails = createFarSails(world);
  const dolphinPod = createDolphinPod(world);
  const campLife = landmarks.find(({ landmark }) => landmark.kind === "camp")?.object.userData.campLife as CampLife | undefined;
  const lighthouseMaterial = landmarks.find(({ landmark }) => landmark.kind === "lighthouse")?.object.userData.lighthouseMaterial as THREE.MeshStandardMaterial | undefined;
  let isNight = false;
  applySceneShadows(world);

  return {
    colliders,
    landmarks,
    transit: { boat, balloon },
    getGroundHeight: coastalTerrainHeight,
    isWalkable: (x, z) => (
      (z >= -148 && z <= 76 && x >= coastalShoreX(z) - 1 && x <= 112)
      || pier.isWalkable(x, z)
    ),
    setSunDirection(direction) {
      skyMaterial.uniforms.uSunDirection.value.copy(direction);
      waterMaterial.uniforms.uSunDirection.value.copy(direction);
    },
    applyEnvironment(state, palette) {
      skyMaterial.uniforms.uHorizon.value.set(palette.skyHorizon);
      skyMaterial.uniforms.uZenith.value.set(palette.skyZenith);
      skyMaterial.uniforms.uSunColor.value.set(palette.sunlight);
      skyMaterial.uniforms.uGlow.value = state.weather === "storm" ? 0.08 : palette.isNight ? 0.16 : state.time === "sunset" ? 0.6 : 0.42;
      waterMaterial.uniforms.uDeep.value.set(palette.waterDeep);
      waterMaterial.uniforms.uShallow.value.set(palette.waterShallow);
      waterMaterial.uniforms.uSun.value.set(palette.sunlight);
      waterMaterial.uniforms.uHorizon.value.set(palette.skyHorizon);
      waterMaterial.uniforms.uMoonPath.value = palette.isNight && state.weather !== "storm" ? 1 : 0;
      terrain.setPalette(palette.grass, palette.sand);
      seasonal.setSeason(state.season);
      weather.setWeather(state.weather);
      celestial.setNight(palette.isNight && state.weather !== "storm");
      clouds.setWeather(state.weather);
      isNight = palette.isNight;
      districtLife.emissiveMaterials.forEach((material) => {
        const baseIntensity = material.userData.baseEmissiveIntensity as number;
        material.emissiveIntensity = palette.isNight ? baseIntensity * 2.15 : baseIntensity;
      });
    },
    setTourRoute(from, target) {
      tourRoute.set(from, target);
    },
    update(time, delta, isModalOpen = false) {
      waterMaterial.uniforms.uTime.value = time;
      swayUniforms.forEach((uniform) => { uniform.value = time; });
      updateDistrictLife(districtLife, time);
      updateFarSails(farSails, time);
      updateDolphinPod(dolphinPod, time, isModalOpen);
      if (lighthouseMaterial) {
        const base = isNight ? 3.1 : 1.55;
        const amplitude = isNight ? 0.46 : 0.16;
        lighthouseMaterial.emissiveIntensity = base * (1 + Math.sin(time * Math.PI * 0.5) * amplitude);
      }
      if (campLife) updateCampFire(campLife, time);
      clouds.update(time);
      updateSeaBirds(gullFlocks, time);
      boat.position.x = -42 + THREE.MathUtils.euclideanModulo(time * 0.72, 84);
      boat.position.z = -30 + Math.sin(time * 0.2) * 42;
      boat.rotation.z = Math.sin(time * 1.1) * 0.025;
      const flame = balloon.userData.flame as THREE.Mesh | undefined;
      const flameMaterial = balloon.userData.flameMaterial as THREE.MeshStandardMaterial | undefined;
      const burnerLight = balloon.userData.burnerLight as THREE.PointLight | undefined;
      const burnCycle = THREE.MathUtils.euclideanModulo(time, 6.4);
      const flare = smoothRange(0, 0.35, burnCycle) * (1 - smoothRange(1.25, 1.85, burnCycle));
      const flicker = flare * (0.82 + 0.18 * Math.sin(time * 31) * Math.sin(time * 17.3));
      if (flame) flame.scale.set(0.38 + flicker * 0.88, 0.28 + flicker * 1.12, 0.38 + flicker * 0.88);
      if (flameMaterial) {
        flameMaterial.emissiveIntensity = 0.16 + flicker * 2.15;
        flameMaterial.opacity = 0.3 + flicker * 0.62;
      }
      if (burnerLight) burnerLight.intensity = 0.12 + flicker * 3.1;

      if (!balloon.userData.riding) {
        const idleStation = balloon.userData.idleStation as THREE.Vector3;
        balloon.position.set(
          idleStation.x + Math.sin(time * 0.045) * 1.15,
          idleStation.y + Math.sin(time * 0.4) * 0.38,
          idleStation.z + Math.cos(time * 0.038) * 0.8
        );
        balloon.rotation.set(0, Math.sin(time * 0.08) * 0.12, Math.sin(time * 0.32) * 0.012);
      }
      landmarks.forEach(({ marker }, index) => {
        const pulse = 1 + Math.sin(time * 1.6 + index) * 0.09;
        marker.scale.setScalar(pulse);
        marker.rotation.z = time * 0.22;
      });
      weather.update(time, delta);
      seasonal.update(time);
      tourRoute.update(time);
    }
  };
}

function createCoastalTerrain(world: THREE.Group): { setPalette(grass: string, sand: string): void } {
  const geometry = new THREE.PlaneGeometry(340, 430, 136, 172);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(28, 0, -32);
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const vertexColors = new Float32Array(positions.count * 3);
  const sand = new THREE.Color(colors.sand);
  const wetSand = new THREE.Color("#b8a27f");
  const grass = new THREE.Color(colors.grass);
  const meadow = new THREE.Color("#aabd78");
  const rock = new THREE.Color("#8f806f");
  const working = new THREE.Color();
  const terrainBands = new Uint8Array(positions.count);
  const terrainVariation = new Float32Array(positions.count);

  for (let index = 0; index < positions.count; index += 1) {
    let x = positions.getX(index);
    let z = positions.getZ(index);
    x += (hash2(x, z) - 0.5) * 1.2;
    z += (hash2(z, x) - 0.5) * 1.2;
    const height = coastalTerrainHeight(x, z);
    positions.setXYZ(index, x, height, z);
    const shoreDistance = x - coastalShoreX(z);
    const slope = Math.hypot(
      coastalTerrainHeight(x + 1, z) - coastalTerrainHeight(x - 1, z),
      coastalTerrainHeight(x, z + 1) - coastalTerrainHeight(x, z - 1)
    ) * 0.5;
    if (shoreDistance < 4.4) {
      terrainBands[index] = shoreDistance < -1 ? 0 : 1;
      working.copy(shoreDistance < -1 ? wetSand : sand);
    } else if (slope > 1.05) {
      terrainBands[index] = 2;
      working.copy(rock);
    }
    else {
      terrainBands[index] = 3;
      working.copy(grass);
      const meadowMix = smooth01((Math.sin(x * 0.04 + z * 0.026) + Math.sin(x * 0.018 - z * 0.034)) * 0.25 + 0.46);
      terrainVariation[index] = meadowMix;
      working.lerp(meadow, meadowMix * 0.34);
    }
    vertexColors[index * 3] = working.r;
    vertexColors[index * 3 + 1] = working.g;
    vertexColors[index * 3 + 2] = working.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.24,
    dithering: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.receiveOnly = true;
  world.add(mesh);
  return {
    setPalette(grassColor, sandColor) {
      const nextGrass = new THREE.Color(grassColor);
      const nextSand = new THREE.Color(sandColor);
      const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let index = 0; index < colorAttribute.count; index += 1) {
        if (terrainBands[index] === 0) working.copy(nextSand).lerp(new THREE.Color("#81786b"), 0.22);
        else if (terrainBands[index] === 1) working.copy(nextSand);
        else if (terrainBands[index] === 2) working.copy(nextGrass).lerp(new THREE.Color("#756f67"), 0.54);
        else working.copy(nextGrass).lerp(meadow, terrainVariation[index] * 0.3);
        colorAttribute.setXYZ(index, working.r, working.g, working.b);
      }
      colorAttribute.needsUpdate = true;
    }
  };
}

function createCoastalCliffs(world: THREE.Group): void {
  const samples = 140;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topColor = new THREE.Color("#a08b6d");
  const lowerColor = new THREE.Color("#7c6f5d");
  const color = new THREE.Color();

  for (let index = 0; index < samples; index += 1) {
    const progress = index / (samples - 1);
    const z = -154 + progress * 340;
    const x = coastalShoreX(z) + 1.5;
    const topY = Math.max(-0.18, coastalTerrainHeight(x, z) - 0.05);
    const bottomY = -7;
    positions.push(x, topY, z, x - 2.5, bottomY, z);
    color.copy(topColor).lerp(lowerColor, 0.12);
    colors.push(color.r, color.g, color.b);
    color.copy(lowerColor).lerp(topColor, 0.08 + (index % 5) * 0.018);
    colors.push(color.r, color.g, color.b);
    if (index < samples - 1) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cliffs = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide
  }));
  cliffs.castShadow = true;
  cliffs.receiveShadow = true;
  world.add(cliffs);

  // A warm seabed catches any grazing camera ray without presenting a dark
  // geometric slab. Its top remains just below the animated water surface.
  // Keep the seabed top below the deepest animated wave trough (water sits at
  // -0.55 and dips ~0.6 further), or flat tan patches surface through troughs.
  const seabed = new THREE.Mesh(new THREE.BoxGeometry(360, 6, 460), matte("#b8a27f"));
  seabed.position.set(28, -4.9, -32);
  seabed.receiveShadow = true;
  seabed.userData.receiveOnly = true;
  world.add(seabed);
}

function createCoastalRoad(world: THREE.Group): void {
  const material = matte("#cfb789");
  const curve = new THREE.CatmullRomCurve3(COASTAL_TRAIL_POINTS, false, "centripetal", 0.35);
  const samples = 240;
  const positions = new Float32Array((samples + 1) * 2 * 3);
  const uvs = new Float32Array((samples + 1) * 2 * 2);
  const indices: number[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const center = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress).setY(0).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(2.8);
    for (let edge = 0; edge < 2; edge += 1) {
      const point = center.clone().addScaledVector(side, edge === 0 ? -1 : 1);
      point.y = coastalTerrainHeight(point.x, point.z) + 0.1;
      const vertex = (index * 2 + edge) * 3;
      positions[vertex] = point.x;
      positions[vertex + 1] = point.y;
      positions[vertex + 2] = point.z;
      const uv = (index * 2 + edge) * 2;
      uvs[uv] = edge;
      uvs[uv + 1] = progress * 24;
    }
    if (index < samples) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const road = new THREE.Mesh(geometry, material);
  road.receiveShadow = true;
  road.userData.receiveOnly = true;
  world.add(road);

  for (const point of COASTAL_TRAIL_POINTS.slice(2, -1)) {
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.12, 30), matte("#dfcaa0"));
    plaza.position.copy(point);
    plaza.position.y = coastalTerrainHeight(point.x, point.z) + 0.08;
    plaza.receiveShadow = true;
    world.add(plaza);
  }
}

function createCreekAndBridges(world: THREE.Group): void {
  const creekPoints = Array.from({ length: 92 }, (_, index) => {
    const z = -144 + index * 2.42;
    const x = 55 + Math.sin(z * 0.024) * 11;
    return new THREE.Vector3(x, coastalTerrainHeight(x, z) + 0.18, z);
  });
  const creek = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(creekPoints), 260, 0.48, 8, false),
    new THREE.MeshStandardMaterial({
      color: "#79aaa4",
      roughness: 0.62,
      metalness: 0.02,
      envMapIntensity: 0.4,
      transparent: true,
      opacity: 0.88
    })
  );
  creek.scale.y = 0.14;
  creek.receiveShadow = true;
  creek.userData.receiveOnly = true;
  world.add(creek);

  for (const [index, z] of [-82, -18, 43].entries()) {
    const x = 55 + Math.sin(z * 0.024) * 11;
    const bridge = new THREE.Group();
    bridge.position.set(x, coastalTerrainHeight(x, z) + 0.5, z);
    bridge.rotation.y = Math.sin(z * 0.024) * -0.22;
    for (let plankIndex = 0; plankIndex < 7; plankIndex += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 1.65), matte(plankIndex % 2 ? "#a5744d" : "#91633f"));
      plank.position.x = -2.38 + plankIndex * 0.79;
      plank.position.y = Math.sin(plankIndex * 0.7) * 0.035;
      bridge.add(plank);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 5.8, 7), matte("#72513a"));
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.62, side * 0.74);
      bridge.add(rail);
    }
    bridge.userData.bridgeIndex = index;
    addSoftShadow(bridge, 0.3, 0.3, 6.4, 2.1, 0, 0.12);
    world.add(bridge);
  }
}

function createCoastalForest(world: THREE.Group, swayUniforms: SwayTimeUniform[]): void {
  const trunkMaterial = matte("#725238");
  const crownMaterials = [
    matSway("#426c4d", 0.11, 0.72, swayUniforms),
    matSway("#557f55", 0.13, 0.67, swayUniforms),
    matSway("#668e5e", 0.1, 0.78, swayUniforms)
  ];
  const shrubMaterials = [
    matSway("#3f674b", 0.08, 0.9, swayUniforms),
    matSway("#587b52", 0.07, 0.84, swayUniforms)
  ];
  const groves = [
    [82, -132, 16, 22], [71, -96, 12, 19], [80, -55, 17, 24],
    [68, -10, 13, 18], [79, 31, 18, 22], [70, 65, 15, 18],
    [49, -120, 10, 13], [52, 43, 9, 12]
  ] as const;
  for (let index = 0; index < 148; index += 1) {
    const grove = groves[index % groves.length];
    const angle = index * 2.39996;
    const radius = Math.sqrt((index % 19) / 18);
    const z = grove[1] + Math.sin(angle) * grove[3] * radius;
    const shoreline = coastalShoreX(z);
    const x = Math.max(shoreline + 11, grove[0] + Math.cos(angle) * grove[2] * radius);
    if (COASTAL_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position[0], z - landmark.position[2]) < 8)) continue;
    if (COASTAL_TRAIL_POINTS.some((point) => Math.hypot(x - point.x, z - point.z) < 7)) continue;
    if (Math.hypot(x - 68, z + 18) < 13) continue;
    const ground = coastalTerrainHeight(x, z);
    if (ground <= 0.4 || x - shoreline < 6) continue;
    const scale = 0.68 + (index % 7) * 0.12;
    const tree = new THREE.Group();
    tree.position.set(x, ground, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.2 * scale, 6), trunkMaterial);
    trunk.position.y = 1.1 * scale;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.32 * scale, 1), crownMaterials[index % crownMaterials.length]);
    crown.position.y = 3.18 * scale;
    crown.scale.y = 1.18;
    crown.rotation.y = index * 0.71;
    tree.add(crown);
    world.add(tree);

    if (index % 2 === 0) {
      const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54 + (index % 4) * 0.09, 1), shrubMaterials[index % shrubMaterials.length]);
      shrub.position.set(x + Math.cos(index * 1.91) * 1.45, ground + 0.42, z + Math.sin(index * 1.91) * 1.45);
      shrub.scale.y = 0.76;
      shrub.rotation.y = index * 0.53;
      world.add(shrub);
    }
  }
}

function createPier(world: THREE.Group): HarborPier {
  const z = 58;
  const shore = coastalShoreX(z);
  // The shore's visible dry shelf starts well inland of the water plane. The
  // anchor is deliberately sampled there, then the deck projects west to sea.
  const anchorX = shore + 18;
  const landY = coastalTerrainHeight(anchorX, z);
  const deckTop = 1.62;
  const deckWidth = 5.1;
  const deckStart = -6;
  const deckLength = 80;
  const terminalX = deckStart - deckLength - 4.5;
  const pier = new THREE.Group();
  pier.name = "harbor-pier";
  pier.position.set(anchorX, 0, z);
  world.add(pier);

  const timberLight = matte("#aa7b52");
  const timberDark = matte("#80583d");
  const timberEdge = matte("#664633");
  const pilingMaterial = matte("#5e4535");
  const metalMaterial = matte("#3e4746");

  const rampLength = 9;
  const rampStartY = landY + 0.12;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLength, 0.3, deckWidth), timberLight);
  ramp.position.set(-1.4, (rampStartY + deckTop) / 2, 0);
  ramp.rotation.z = -Math.atan2(deckTop - rampStartY, rampLength);
  ramp.receiveShadow = true;
  pier.add(ramp);

  // A segmented deck reads as timber construction at walking height instead
  // of a single monolithic brown slab.
  for (let index = 0; index < deckLength; index += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.18, deckWidth - 0.14),
      index % 3 === 0 ? timberDark : timberLight
    );
    plank.position.set(deckStart - 0.5 - index, deckTop - 0.09 + Math.sin(index * 1.9) * 0.008, 0);
    plank.receiveShadow = true;
    pier.add(plank);
  }

  const terminal = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 9.2), timberLight);
  terminal.position.set(terminalX, deckTop - 0.15, 0);
  terminal.receiveShadow = true;
  pier.add(terminal);
  for (let index = 0; index < 10; index += 1) {
    const terminalPlank = new THREE.Mesh(
      new THREE.BoxGeometry(9.7, 0.07, 0.78),
      index % 2 ? timberDark : timberLight
    );
    terminalPlank.position.set(terminalX, deckTop + 0.02, -3.95 + index * 0.87);
    pier.add(terminalPlank);
  }

  const rail = (length: number, x: number, side: number) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, 0.14), timberEdge);
    beam.position.set(x, deckTop + 1.05, side * (deckWidth / 2 - 0.12));
    pier.add(beam);
  };
  rail(deckLength - 7, deckStart - deckLength / 2 + 1.8, -1);
  rail(deckLength - 7, deckStart - deckLength / 2 + 1.8, 1);
  for (let x = deckStart - 7; x >= deckStart - deckLength + 3; x -= 8) {
    for (const side of [-1, 1]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), timberEdge);
      upright.position.set(x, deckTop + 0.55, side * (deckWidth / 2 - 0.12));
      pier.add(upright);
    }
  }
  const endRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.6), timberEdge);
  endRail.position.set(terminalX - 4.55, deckTop + 1.05, 0);
  pier.add(endRail);
  for (const side of [-1, 1]) {
    const terminalRail = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.14, 0.14), timberEdge);
    terminalRail.position.set(terminalX, deckTop + 1.05, side * 4.48);
    pier.add(terminalRail);
  }

  const pilingGeometry = new THREE.CylinderGeometry(0.28, 0.36, 4.9, 5);
  const pilingCount = 24;
  const pilings = new THREE.InstancedMesh(pilingGeometry, pilingMaterial, pilingCount);
  const matrix = new THREE.Object3D();
  let pilingIndex = 0;
  for (let x = deckStart - 5; x >= deckStart - deckLength + 1; x -= 8) {
    for (const side of [-1, 1]) {
      matrix.position.set(x, -0.72, side * 2.16);
      matrix.rotation.set(0, (pilingIndex % 3) * 0.16, 0);
      matrix.updateMatrix();
      pilings.setMatrixAt(pilingIndex, matrix.matrix);
      pilingIndex += 1;
    }
  }
  for (const side of [-1, 1]) {
    matrix.position.set(terminalX, -0.72, side * 3.85);
    matrix.rotation.set(0, 0, 0);
    matrix.updateMatrix();
    pilings.setMatrixAt(pilingIndex, matrix.matrix);
    pilingIndex += 1;
  }
  pilings.count = pilingIndex;
  pilings.instanceMatrix.needsUpdate = true;
  pilings.castShadow = true;
  pier.add(pilings);

  const lineBetween = (from: THREE.Vector3, to: THREE.Vector3, radius = 0.025) => {
    const length = from.distanceTo(to);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 5), matte("#4b4037"));
    line.position.copy(from).lerp(to, 0.5);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    pier.add(line);
  };
  const boatSpecs = [
    { x: -24, side: 1, length: 5.2, hull: "#d46d51", trim: "#f1dfbd", kind: "sail" },
    { x: -42, side: -1, length: 6.6, hull: "#4f8580", trim: "#e6d6b4", kind: "cabin" },
    { x: -61, side: 1, length: 4.4, hull: "#d4a24b", trim: "#75513a", kind: "row" },
    { x: -79, side: -1, length: 7.6, hull: "#7d7199", trim: "#e4d5b5", kind: "trawler" }
  ] as const;
  boatSpecs.forEach((spec, index) => {
    const boat = createDockedBoat(spec.length, spec.hull, spec.trim, spec.kind);
    boat.position.set(spec.x, WATER_Y + 0.34, spec.side * 5.35);
    boat.rotation.y = spec.side * (Math.PI / 2 + 0.08 * (index - 1));
    boat.rotation.z = Math.sin(index * 1.7) * 0.035;
    pier.add(boat);

    const cleat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.32, 8), metalMaterial);
    cleat.position.set(spec.x + 1.1, deckTop + 0.19, spec.side * 2.15);
    pier.add(cleat);
    lineBetween(cleat.position, new THREE.Vector3(spec.x + 0.9, WATER_Y + 0.72, spec.side * 4.85));

    const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.82, 8), matte("#d8c59d"));
    fender.position.set(spec.x - 1.4, deckTop - 0.44, spec.side * 2.42);
    fender.rotation.z = Math.PI / 2;
    pier.add(fender);
  });

  const walkableColliders: CollisionShape[] = [];
  for (let index = 0; index < 6; index += 1) {
    const progress = index / 5;
    const x = anchorX + 2.8 - progress * rampLength;
    const top = THREE.MathUtils.lerp(rampStartY + 0.15, deckTop + 0.03, progress);
    walkableColliders.push({ kind: "box", x, z, width: 1.8, depth: deckWidth - 0.25, top });
  }
  walkableColliders.push({ kind: "box", x: anchorX + deckStart - deckLength / 2, z, width: deckLength, depth: deckWidth - 0.25, top: deckTop + 0.03 });
  walkableColliders.push({ kind: "box", x: anchorX + terminalX, z, width: 10, depth: 9, top: deckTop + 0.03 });

  return {
    group: pier,
    walkableColliders,
    isWalkable(x, pointZ) {
      const onDeck = pointZ >= z - deckWidth / 2 && pointZ <= z + deckWidth / 2
        && x >= anchorX + deckStart - deckLength && x <= anchorX + 3;
      const onTerminal = pointZ >= z - 4.6 && pointZ <= z + 4.6
        && x >= anchorX + terminalX - 5 && x <= anchorX + terminalX + 5;
      return onDeck || onTerminal;
    }
  };
}

function createDockedBoat(
  length: number,
  hullColor: THREE.ColorRepresentation,
  trimColor: THREE.ColorRepresentation,
  kind: "sail" | "cabin" | "row" | "trawler"
): THREE.Group {
  const boat = new THREE.Group();
  const beam = length * 0.3;
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.68, beam, length * 0.72, 5), matte(hullColor));
  hull.rotation.z = Math.PI / 2;
  hull.scale.z = 0.72;
  boat.add(hull);
  const gunwale = new THREE.Mesh(new THREE.BoxGeometry(length * 0.72, 0.13, beam + 0.1), matte(trimColor));
  gunwale.position.y = 0.5;
  boat.add(gunwale);
  for (let index = 0; index < 3; index += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(length * 0.62, 0.05, beam / 3.4), matte(index % 2 ? "#9d7653" : "#b38a60"));
    plank.position.set(0, 0.59, (index - 1) * beam / 3);
    boat.add(plank);
  }
  if (kind === "sail") {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, length * 0.78, 7), matte(colors.timber));
    mast.position.set(-length * 0.08, length * 0.39 + 0.5, 0);
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(length * 0.25, length * 0.62, 3), matte(trimColor));
    sail.position.set(length * 0.15, length * 0.48 + 0.52, 0);
    sail.rotation.z = -Math.PI / 2;
    boat.add(sail);
  } else if (kind === "cabin") {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.3, length * 0.18, beam * 0.76), matte(trimColor));
    cabin.position.set(-length * 0.12, length * 0.09 + 0.55, 0);
    boat.add(cabin);
    const window = new THREE.Mesh(new THREE.BoxGeometry(length * 0.16, length * 0.07, beam * 0.8), matte("#9ec1c4"));
    window.position.set(-length * 0.13, length * 0.19 + 0.55, 0);
    boat.add(window);
  } else if (kind === "row") {
    for (const side of [-1, 1]) {
      const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length * 0.72, 5), matte("#75513a"));
      oar.position.set(0, 0.72, side * beam * 0.7);
      oar.rotation.z = Math.PI / 2;
      oar.rotation.y = side * 0.36;
      boat.add(oar);
    }
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.28, length * 0.2, beam * 0.8), matte(trimColor));
    cabin.position.set(-length * 0.12, length * 0.1 + 0.55, 0);
    boat.add(cabin);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, length * 0.22, 7), matte("#454b4b"));
    stack.position.set(length * 0.14, length * 0.18 + 0.55, 0);
    boat.add(stack);
    const net = new THREE.Mesh(new THREE.TorusGeometry(beam * 0.36, 0.045, 6, 12), matte("#d8c59d"));
    net.position.set(length * 0.23, 0.73, 0);
    net.rotation.y = Math.PI / 2;
    boat.add(net);
  }
  return boat;
}

function createLandmark(world: THREE.Group, landmark: CoastalLandmark, colliders: CollisionShape[]): LandmarkAnchor {
  const group = new THREE.Group();
  group.name = `coastal-landmark:${landmark.id}`;
  const placement = resolveDryLandmarkPlacement(landmark);
  const needsFoundation = landmark.kind === "archive" || landmark.kind === "lighthouse";
  group.position.set(placement.x, placement.y + (needsFoundation ? 0.78 : 0), placement.z);
  world.add(group);

  if (needsFoundation) createStoneFoundation(group, landmark.kind === "archive" ? 13.6 : 8.4, landmark.kind === "archive" ? 13.6 : 8.4);

  if (landmark.kind === "camp") createOperatorCamp(group, landmark.color);
  else if (landmark.kind === "workshop") createExecutionWorkshop(group, landmark.color);
  else if (landmark.kind === "career") createCareerRidge(group, landmark.color);
  else if (landmark.kind === "harbour") createVentureHarbour(group, landmark.color);
  else if (landmark.kind === "archive") createSignalArchive(group, landmark.color);
  else createLighthouse(group, landmark.color);

  const markerMaterial = new THREE.MeshBasicMaterial({
    color: landmark.color,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.065, 8, 48), markerMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.79;
  marker.userData.softShadow = true;
  group.add(marker);
  addSoftShadow(group, 0, 0.35, 4.4, 3.2, 0, 0.16);

  if (landmark.kind !== "harbour" && landmark.kind !== "camp") {
    const size = landmark.kind === "career" ? 8.5 : landmark.kind === "workshop" ? 5.8 : 4.6;
    colliders.push({ kind: "box", x: placement.x, z: placement.z, width: size, depth: size * 0.82 });
  }
  return { landmark, object: group, marker };
}

function createStoneFoundation(group: THREE.Group, width: number, depth: number): void {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.82, depth), matte("#8d806d"));
  slab.position.y = -0.41;
  slab.receiveShadow = true;
  group.add(slab);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.35, 0.14, depth + 0.35), matte("#b2a184"));
  cap.position.y = 0.02;
  cap.receiveShadow = true;
  group.add(cap);
}

function createLighthouse(group: THREE.Group, accent: string): void {
  const knoll = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), matte("#8f806f"));
  knoll.position.y = 0.72;
  knoll.scale.y = 0.58;
  group.add(knoll);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.9, 12.5, 18), matte("#f2e5cc"));
  tower.position.y = 7.05;
  group.add(tower);
  for (const y of [4.5, 9.5]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.48 - y * 0.025, 1.52 - y * 0.025, 0.58, 18), matte(accent));
    band.position.y = y;
    group.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 32), matte(colors.ink));
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 13.2;
  group.add(gallery);
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 1.05, 14),
    new THREE.MeshStandardMaterial({ color: "#fff0bd", emissive: accent, emissiveIntensity: 2.2, roughness: 0.42 })
  );
  lantern.position.y = 13.75;
  group.add(lantern);
  group.userData.lighthouseMaterial = lantern.material;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 14), matte(colors.ink));
  roof.position.y = 14.75;
  group.add(roof);
}

function createDistrictSetDressing(world: THREE.Group): DistrictLife {
  const hutPlacements = [
    [38, -106, 0.82, "#d48662", 0.18], [42, -90, 0.7, "#73958d", -0.2],
    [47, -76, 0.92, "#d6a05f", 0.12], [50, -60, 0.72, "#7c909b", -0.18],
    [49, -47, 0.78, "#a87259", 0.1], [53, -31, 0.9, "#73958d", -0.12],
    [50, -14, 0.75, "#d48662", 0.24], [56, 2, 0.9, "#d6a05f", -0.18],
    [48, 16, 0.72, "#73958d", 0.15], [53, 32, 0.9, "#8d79a6", -0.14],
    [45, 45, 0.72, "#a87259", 0.18], [47, 62, 0.82, "#73958d", -0.18]
  ] as const;
  const cream = matte("#eadabb");
  const roofMaterials = [matte("#bd694e"), matte("#4f6668"), matte("#8c704c")];
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: "#ffe7a3",
    emissive: "#e8a84c",
    emissiveIntensity: 0.86,
    roughness: 0.72
  });
  glowMaterial.userData.baseEmissiveIntensity = glowMaterial.emissiveIntensity;
  const smokePuffs: SmokePuff[] = [];
  hutPlacements.forEach(([x, z, scale, color, rotation], index) => {
    const hut = new THREE.Group();
    hut.position.set(x, coastalTerrainHeight(x, z), z);
    hut.rotation.y = rotation;
    hut.scale.setScalar(scale);
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.42, 4.7), matte("#b7a47d"));
    terrace.position.y = 0.06;
    hut.add(terrace);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.8, 3.25), matte(color));
    body.position.y = 1.66;
    hut.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.15, 1.45, 4), roofMaterials[index % roofMaterials.length]);
    roof.position.y = 3.72;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    hut.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.72, 0.12), matte("#604433"));
    door.position.set(0, 1.02, -1.69);
    hut.add(door);
    for (const side of [-1, 1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.66, 0.13), glowMaterial);
      window.position.set(side * 1.08, 1.82, -1.7);
      hut.add(window);
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.13, 0.82), cream);
    awning.position.set(0, 2.1, -2.02);
    awning.rotation.x = -0.16;
    hut.add(awning);
    if ([0, 3, 7, 10].includes(index)) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.38, 0.42), matte("#66554b"));
      chimney.position.set(0.9, 4.35, 0.28);
      hut.add(chimney);
      for (let puffIndex = 0; puffIndex < 5; puffIndex += 1) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({
          color: "#e8e4d9",
          transparent: true,
          opacity: 0.22,
          flatShading: true,
          roughness: 1,
          depthWrite: false
        }));
        world.add(puff);
        smokePuffs.push({
          mesh: puff,
          emitter: new THREE.Vector3(x + Math.cos(rotation) * 0.9 + Math.sin(rotation) * 0.28, hut.position.y + 4.95 * scale, z + Math.sin(rotation) * 0.9 + Math.cos(rotation) * 0.28),
          offset: puffIndex / 5,
          phase: index * 1.73 + puffIndex * 0.91
        });
      }
    }
    addSoftShadow(hut, 0.4, 0.4, 5.5, 4.6, rotation, 0.15);
    world.add(hut);
  });

  const lampMaterial = matte("#3b4645");
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: "#fff0bd",
    emissive: "#efad4b",
    emissiveIntensity: 1.35,
    roughness: 0.66
  });
  bulbMaterial.userData.baseEmissiveIntensity = bulbMaterial.emissiveIntensity;
  COASTAL_LANDMARKS.forEach((landmark, districtIndex) => {
    for (const side of [-1, 1]) {
      const z = landmark.position[2] + side * 7.5;
      const x = landmark.position[0] + 7 + (districtIndex % 2) * 2;
      const lamp = new THREE.Group();
      lamp.position.set(x, coastalTerrainHeight(x, z), z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.7, 8), lampMaterial);
      post.position.y = 1.85;
      lamp.add(post);
      const bulb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), bulbMaterial);
      bulb.position.y = 3.85;
      lamp.add(bulb);
      world.add(lamp);
    }
  });
  return { smokePuffs, emissiveMaterials: [glowMaterial, bulbMaterial] };
}

function updateDistrictLife(life: DistrictLife, time: number): void {
  life.smokePuffs.forEach((puff) => {
    const progress = THREE.MathUtils.euclideanModulo(time * 0.045 + puff.offset, 1);
    const envelope = Math.sin(progress * Math.PI);
    puff.mesh.position.set(
      puff.emitter.x + Math.sin(time * 0.44 + puff.phase) * (0.18 + progress * 0.52),
      puff.emitter.y + progress * 5.8,
      puff.emitter.z + Math.cos(time * 0.37 + puff.phase) * (0.12 + progress * 0.38)
    );
    puff.mesh.scale.setScalar(0.55 + progress * 2.1);
    (puff.mesh.material as THREE.MeshStandardMaterial).opacity = envelope * 0.22;
  });
}

function updateCampFire(camp: CampLife, time: number): void {
  const flicker = 0.84 + Math.sin(time * 15.7) * 0.1 + Math.sin(time * 27.1) * 0.06;
  camp.flames.forEach((flame, index) => {
    const life = flicker + Math.sin(time * (10.8 + index * 2.6) + index * 1.9) * 0.09;
    flame.scale.set(0.92 + life * 0.12, 0.88 + life * 0.24, 0.92 + life * 0.12);
    camp.flameMaterials[index].emissiveIntensity = 0.95 + life * 0.72;
  });
  camp.light.intensity = 1.02 + flicker * 0.74;
}

function createFarSails(world: THREE.Group): FarSail[] {
  const hullGeometry = new THREE.CylinderGeometry(0.38, 0.64, 3.1, 5);
  hullGeometry.rotateZ(Math.PI / 2);
  const hullMaterial = matte("#d9d0be");
  const sailMaterials = [matte("#f1e6cd"), matte("#d8e0d5")];
  const sails: FarSail[] = [];
  [[-232, -78, 72, 0.85, 1.2], [-180, -124, 28, 0.62, 4.1]].forEach(([x0, z, range, speed, phase], index) => {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.position.y = WATER_Y + 0.22;
    hull.scale.z = 0.72;
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.9, 6), matte("#6b5948"));
    mast.position.y = WATER_Y + 1.08;
    group.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6), sailMaterials[index]);
    sail.position.set(0.34, WATER_Y + 1.34, 0);
    group.add(sail);
    group.rotation.y = index === 0 ? 0.08 : -0.11;
    world.add(group);
    sails.push({ group, x0, z, range, speed, phase });
  });
  return sails;
}

function updateFarSails(sails: FarSail[], time: number): void {
  sails.forEach((sail) => {
    sail.group.position.set(
      sail.x0 + THREE.MathUtils.euclideanModulo(time * sail.speed + sail.phase, sail.range),
      Math.sin(time * 0.8 + sail.phase) * 0.07,
      sail.z + Math.sin(time * 0.18 + sail.phase) * 3.2
    );
    sail.group.rotation.z = Math.sin(time * 0.9 + sail.phase) * 0.018;
  });
}

function createDolphinPod(world: THREE.Group): DolphinPod {
  const group = new THREE.Group();
  group.name = "rare-offshore-dolphin-pod";
  const geometry = new THREE.TorusGeometry(0.48, 0.055, 5, 12, Math.PI);
  geometry.rotateX(Math.PI / 2);
  const material = matte("#31545b");
  const dolphins = [0, 1, 2].map((index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.scale.setScalar(0.7 + index * 0.12);
    group.add(mesh);
    return { mesh, offset: index * 0.52 };
  });
  world.add(group);
  return {
    group,
    dolphins,
    nextEventAt: 30 + hash2(17, 91) * 15,
    eventStart: 0,
    heading: 0,
    originX: -92,
    originZ: -96,
    active: false
  };
}

function updateDolphinPod(pod: DolphinPod, time: number, isModalOpen: boolean): void {
  if (!pod.active && !isModalOpen && time >= pod.nextEventAt) {
    pod.active = true;
    pod.eventStart = time;
    pod.heading = -0.42 + hash2(time, pod.nextEventAt) * 0.84;
    pod.originX = -106 - hash2(pod.nextEventAt, time) * 26;
    pod.originZ = -98 + hash2(time, 41) * 104;
  }
  if (!pod.active) return;
  const elapsed = time - pod.eventStart;
  pod.dolphins.forEach((dolphin) => {
    const leap = (elapsed - dolphin.offset) / 1.8;
    const visible = leap >= 0 && leap <= 1;
    dolphin.mesh.visible = visible;
    if (!visible) return;
    const distance = leap * 20;
    dolphin.mesh.position.set(
      pod.originX + Math.cos(pod.heading) * distance,
      WATER_Y + 0.16 + Math.sin(leap * Math.PI) * 0.82,
      pod.originZ + Math.sin(pod.heading) * distance
    );
    dolphin.mesh.rotation.y = -pod.heading + Math.PI / 2;
  });
  if (elapsed <= 3.1) return;
  pod.active = false;
  pod.dolphins.forEach(({ mesh }) => { mesh.visible = false; });
  pod.nextEventAt = time + 30 + hash2(time, pod.originZ) * 15;
}

function createOperatorCamp(group: THREE.Group, accent: string): void {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(5.4, 28), matte("#cfb58b"));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.05;
  ground.receiveShadow = true;
  group.add(ground);

  const tent = new THREE.Group();
  tent.position.set(-2.4, 0, 0.7);
  const tentBody = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3, 4), matte("#d98962"));
  tentBody.position.y = 1.45;
  tentBody.rotation.y = Math.PI / 4;
  tentBody.scale.z = 0.7;
  tent.add(tentBody);
  const opening = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), matte("#4d3b32"));
  opening.position.set(0, 0.88, -1.42);
  opening.rotation.x = Math.PI / 2;
  tent.add(opening);
  group.add(tent);

  const fire = new THREE.Group();
  fire.position.set(1.2, 0, 0.35);
  for (const rotation of [-0.55, 0.55]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.7, 8), matte("#6c4934"));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rotation;
    log.position.y = 0.22;
    fire.add(log);
  }
  const flames: THREE.Mesh[] = [];
  const flameMaterials: THREE.MeshStandardMaterial[] = [];
  for (const [scale, color, y] of [[1, "#ef6e48", 0.72], [0.72, accent, 0.94], [0.42, "#fff1b6", 1.12]] as const) {
    const flameMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.7
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 1.05 * scale, 9), flameMaterial);
    flame.position.y = y;
    fire.add(flame);
    flames.push(flame);
    flameMaterials.push(flameMaterial);
  }
  const fireLight = new THREE.PointLight("#ffb35e", 1.35, 14, 2);
  fireLight.position.y = 1.15;
  fire.add(fireLight);
  group.add(fire);
  group.userData.campLife = { flames, flameMaterials, light: fireLight } satisfies CampLife;

  const props = [
    [-4.1, -2.1, "#6b8f8a"], [-3.2, -2.55, "#d1a15e"],
    [2.8, 1.5, "#866a55"], [3.75, 1.1, "#8f775e"], [3.3, -1.4, "#668c82"]
  ] as const;
  props.forEach(([x, z, color], index) => {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.75 + index % 2 * 0.3, 0.7, 0.5), matte(color));
    pack.position.set(x, 0.4, z);
    pack.rotation.y = index * 0.7;
    group.add(pack);
  });
  createJournalSign(group, "WHY 100?", 3.8, -2.6, -0.4, accent);
}

function createExecutionWorkshop(group: THREE.Group, accent: string): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.6, 5.2), matte("#547b78"));
  body.position.y = 2.2;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.05, 4), matte("#49525b"));
  roof.position.y = 4.78;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.72;
  group.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.6, 0.18), matte("#5c3d2e"));
  door.position.set(0, 1.52, -2.68);
  group.add(door);
  for (const x of [-2.35, 2.35]) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.25, 0.16),
      new THREE.MeshStandardMaterial({ color: "#ffd67d", emissive: "#e9a84f", emissiveIntensity: 0.68, roughness: 0.72 })
    );
    window.position.set(x, 2.35, -2.69);
    group.add(window);
  }
  const workbench = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.32, 1.25), matte("#a9784e"));
  workbench.position.set(0, 1.25, 3.15);
  group.add(workbench);
  for (let index = 0; index < 4; index += 1) {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22 + index * 0.12, 0.44), matte(index % 2 ? accent : "#ef835f"));
    tool.position.set(-2.05 + index * 1.35, 1.56, 3.12);
    group.add(tool);
  }
  createJournalSign(group, "BUILD · SHIP · SCALE", 0, -3.05, 0, accent);
}

function createCareerRidge(group: THREE.Group, accent: string): void {
  const labels = ["NCS", "FREELANCE", "UBS", "DBS", "SEMBCORP"];
  const colors = ["#a87057", "#c58d65", "#617a8e", "#667f75", "#6f8e7f"];
  labels.forEach((label, index) => {
    const building = new THREE.Group();
    const row = index < 3 ? 0 : 1;
    const column = row === 0 ? index : index - 3;
    building.position.set((column - (row === 0 ? 1 : 0.5)) * 4.6, row * 2.5, row * 4.1);
    const width = index === 4 ? 4.3 : 3.7;
    const height = 3.5 + index * 1.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 3.6), matte(colors[index]));
    body.position.y = height / 2 + 0.18;
    building.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.74, 1.25, 4), matte(index === 4 ? accent : "#4f4b4b"));
    roof.position.y = height + 0.82;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    building.add(roof);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.54, 0.75, 0.12),
      new THREE.MeshStandardMaterial({ color: "#ffe3a3", emissive: "#e9b85e", emissiveIntensity: 0.64, roughness: 0.75 })
    );
    light.position.set(0, height * 0.58, -1.86);
    building.add(light);
    createJournalSign(building, label, 0, -2.02, 0, index === 4 ? accent : "#e9d8b8", 1.36);
    group.add(building);
  });
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(12, 0.45, 5.4), matte("#b7a47d"));
  terrace.position.set(0, 2.3, 4.3);
  group.add(terrace);
}

function createVentureHarbour(group: THREE.Group, accent: string): void {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.38, 5.3), matte("#9b6c46"));
  deck.position.y = 0.28;
  group.add(deck);
  for (const x of [-4.6, -1.55, 1.55, 4.6]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.2, 8), matte("#4b453f"));
    bollard.position.set(x, 0.72, -2.15);
    group.add(bollard);
  }
  const boatColors = ["#df6e52", "#5c8e88", "#e0ab4f", "#8d79a6"];
  boatColors.forEach((color, index) => {
    const boat = new THREE.Group();
    boat.position.set(-6.2 + index * 4.15, -0.55 - (index % 2) * 0.08, -5.2 - (index % 2) * 2.5);
    boat.rotation.y = -0.12 + index * 0.08;
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.15, 4.2, 5), matte(color));
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.scale.z = 0.72;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 3.4, 8), matte(colors.timber));
    mast.position.y = 1.78;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), matte(index % 2 ? "#f4e7cc" : accent, 0.82));
    sail.position.set(0.88, 1.95, 0);
    boat.add(sail);
    group.add(boat);
  });
  createJournalSign(group, "IDEAS LEAVE THE DOCK", 0, 0.1, 0, accent);
}

function createSignalArchive(group: THREE.Group, accent: string): void {
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.1, 0.7, 30), matte("#d0bea0"));
  floor.position.y = 0.35;
  group.add(floor);
  for (let index = 0; index < 9; index += 1) {
    const angle = -Math.PI * 0.76 + index / 8 * Math.PI * 1.52;
    const shelf = new THREE.Group();
    shelf.position.set(Math.cos(angle) * 4.65, 0.7, Math.sin(angle) * 4.65);
    shelf.rotation.y = -angle + Math.PI / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.85, 0.28), matte(index % 2 ? "#6c5c78" : "#776b82"));
    back.position.y = 1.45;
    shelf.add(back);
    for (let row = 0; row < 3; row += 1) {
      for (let book = 0; book < 4; book += 1) {
        const volume = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.56, 0.24), matte((book + row) % 3 === 0 ? accent : (book + row) % 3 === 1 ? "#ef835f" : "#e5c078"));
        volume.position.set(-0.66 + book * 0.43, 0.62 + row * 0.82, -0.2);
        shelf.add(volume);
      }
    }
    group.add(shelf);
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.35, 0.75, 22), matte("#8e684d"));
  table.position.y = 1.05;
  group.add(table);
  const journal = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.05), matte("#f0dfbd"));
  journal.position.set(0, 1.48, 0);
  journal.rotation.y = -0.35;
  group.add(journal);
  createJournalSign(group, "FIELD NOTES", 0, -5.7, 0, accent);
}

function createJournalSign(
  group: THREE.Group,
  label: string,
  x: number,
  z: number,
  rotation: number,
  accent: string,
  scale = 1
): void {
  const sign = new THREE.Group();
  sign.position.set(x, 0, z);
  sign.rotation.y = rotation;
  sign.scale.setScalar(scale);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), matte("#6e4e38"));
  post.position.y = 0.95;
  sign.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.02, 0.18), matte("#f0e1c3"));
  board.position.y = 1.85;
  sign.add(board);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.13, 0.04), matte(accent));
  stripe.position.set(0, 2.12, -0.12);
  sign.add(stripe);
  const markerCount = Math.min(9, Math.max(3, Math.round(label.length / 2.8)));
  for (let index = 0; index < markerCount; index += 1) {
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.19 + index % 2 * 0.05, 0.08, 0.035), matte("#4e453d"));
    glyph.position.set((index - (markerCount - 1) / 2) * 0.3, 1.72 + (index % 3) * 0.12, -0.12);
    sign.add(glyph);
  }
  sign.userData.label = label;
  group.add(sign);
}

function createPalm(world: THREE.Group, x: number, z: number, rotation: number, phase: number, swayUniforms: SwayTimeUniform[]): void {
  const palm = new THREE.Group();
  palm.position.set(x, coastalTerrainHeight(x, z), z);
  palm.rotation.y = rotation;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 4.6, 9), matte("#855f3f"));
  trunk.position.y = 2.25;
  trunk.rotation.z = Math.sin(phase) * 0.06;
  palm.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = 4.55;
  const frondMaterials = [
    matSway("#4d7956", 0.18, 0.82, swayUniforms),
    matSway("#5f8c5e", 0.16, 0.74, swayUniforms)
  ];
  for (let index = 0; index < 7; index += 1) {
    const leaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 2.15, 4, 8), frondMaterials[index % frondMaterials.length]);
    leaf.rotation.z = Math.PI / 2.7;
    leaf.rotation.y = index / 7 * Math.PI * 2;
    leaf.position.set(Math.cos(leaf.rotation.y) * 0.85, -0.12, Math.sin(leaf.rotation.y) * 0.85);
    crown.add(leaf);
  }
  palm.add(crown);
  world.add(palm);
  addSoftShadow(palm, 1.3, 0.6, 4.4, 1.3, rotation, 0.14);
}

function createClouds(world: THREE.Group): CloudLayer {
  const cloudGeometry = new THREE.IcosahedronGeometry(3, 0);
  const clearMaterial = new THREE.MeshStandardMaterial({
    color: 0xF7F5EE,
    emissive: 0xFFF6E8,
    emissiveIntensity: 0.32,
    flatShading: true,
    roughness: 1
  });
  const rainMaterial = clearMaterial.clone();
  rainMaterial.color.set("#adb8b5");
  rainMaterial.emissive.set("#c5cdca");
  rainMaterial.emissiveIntensity = 0.18;
  const stormMaterial = clearMaterial.clone();
  stormMaterial.color.set("#59666d");
  stormMaterial.emissive.set("#657178");
  stormMaterial.emissiveIntensity = 0.09;
  const definitions = [
    { x: -62, y: 68, z: -64, scale: 1.45, speed: 0.55, range: 136, phase: 17 },
    { x: 95, y: 86, z: -148, scale: 1.8, speed: 0.4, range: 112, phase: 41 },
    { x: 130, y: 78, z: -89, scale: 1.18, speed: 0.6, range: 96, phase: 73 },
    { x: -12, y: 88, z: 121, scale: 1.68, speed: 0.35, range: 122, phase: 29 },
    { x: 88, y: 74, z: 42, scale: 1.3, speed: 0.5, range: 102, phase: 94 },
    { x: -78, y: 66, z: 57, scale: 1.08, speed: 0.65, range: 92, phase: 58 },
    { x: -42, y: 81, z: -4, scale: 1.58, speed: 0.42, range: 124, phase: 7 },
    { x: -97, y: 71, z: -122, scale: 1.38, speed: 0.5, range: 104, phase: 82 },
    { x: 58, y: 93, z: 149, scale: 1.5, speed: 0.38, range: 114, phase: 51 }
  ] as const;
  const lobeOffsets = [
    [0, 0, 0, 1], [3.4, 0.5, 0.8, 0.72], [-3.2, 0.3, -0.6, 0.66],
    [1.2, 1.3, -1.1, 0.55], [-1.1, 1.08, 1.2, 0.48], [4.8, 0.12, -0.35, 0.4]
  ] as const;
  const formations: CloudFormation[] = [];
  const extraLobes: THREE.Mesh[] = [];

  definitions.forEach((definition, definitionIndex) => {
    const group = new THREE.Group();
    lobeOffsets.forEach(([x, y, z, localScale], lobeIndex) => {
      const lobe = new THREE.Mesh(cloudGeometry, clearMaterial);
      lobe.position.set(x * definition.scale, y * definition.scale, z * definition.scale);
      lobe.scale.set(
        1.6 * localScale * definition.scale,
        0.55 * localScale * definition.scale,
        1.05 * localScale * definition.scale
      );
      lobe.rotation.y = hash2(definition.x + x, definition.z + z) * Math.PI;
      // Clear weather keeps four or five lobes; storms reveal the remaining
      // faceted volumes to make the sky feel denser without transparency.
      if (lobeIndex >= 4 && (lobeIndex === 5 || definitionIndex % 2 === 0)) {
        lobe.visible = false;
        extraLobes.push(lobe);
      }
      group.add(lobe);
    });
    group.position.set(definition.x, definition.y, definition.z);
    world.add(group);
    formations.push({
      group,
      x0: definition.x,
      speed: definition.speed,
      range: definition.range,
      phase: definition.phase
    });
  });

  return {
    formations,
    setWeather(weather) {
      const material = weather === "storm" ? stormMaterial : weather === "rain" ? rainMaterial : clearMaterial;
      formations.forEach(({ group }) => {
        group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.material = material;
        });
      });
      extraLobes.forEach((lobe) => {
        lobe.visible = weather !== "clear";
      });
    },
    update(time) {
      formations.forEach((formation) => {
        formation.group.position.x = formation.x0
          + THREE.MathUtils.euclideanModulo(time * formation.speed + formation.phase, formation.range)
          - formation.range / 2;
      });
    }
  };
}

function createBoat(world: THREE.Group): THREE.Group {
  const boat = new THREE.Group();
  boat.position.set(-34, -0.18, 8);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.15, 4.2, 5), matte("#bb6248"));
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.scale.z = 0.72;
  boat.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), matte(colors.timber));
  mast.position.y = 1.8;
  boat.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.7), matte("#f4e7cc", 0.7));
  sail.position.set(1.05, 2, 0);
  boat.add(sail);
  world.add(boat);
  return boat;
}

function createBalloon(world: THREE.Group): THREE.Group {
  const balloon = new THREE.Group();
  // The group origin is the basket, which is also the ride-curve anchor. This
  // lets the controller place the rider at basket height while the ropes frame
  // the view on the way to the raised envelope.
  const idleStation = new THREE.Vector3(70, Math.max(coastalTerrainHeight(70, -18) + 2.05, 3), -18);
  balloon.position.copy(idleStation);
  balloon.name = "boardable-hot-air-balloon";
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 9), matte("#ef835f"));
  envelope.scale.y = 1.28;
  envelope.position.y = 5.1;
  balloon.add(envelope);
  for (const rotation of [0, Math.PI / 2]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.1, 6, 18), matte("#f6cf6d"));
    band.rotation.x = rotation;
    band.position.y = 5.1;
    balloon.add(band);
  }
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.25, 0.74, 7), matte("#cc704d"));
  throat.position.y = 2.92;
  balloon.add(throat);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 1.35), matte(colors.timber));
  balloon.add(basket);
  for (const [x, z, width, depth] of [[0, -0.74, 1.28, 0.1], [0, 0.74, 1.28, 0.1], [-0.62, 0, 0.1, 1.58], [0.62, 0, 0.1, 1.58]] as const) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), matte("#5f4534"));
    rim.position.set(x, 0.4, z);
    balloon.add(rim);
  }
  // The forward pair sits at the wide front corners so it remains visible at
  // the edge of the rider's forward view, rather than disappearing behind the
  // camera inside the basket.
  for (const [x, z] of [[-0.46, -0.56], [0.46, -0.56], [-0.54, 0.72], [0.54, 0.72]] as const) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.48, 4), matte("#6e5540"));
    rope.position.set(x, 1.5, z);
    rope.rotation.z = x * -0.16;
    rope.rotation.x = z * 0.12;
    balloon.add(rope);
  }
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.34, 6), matte("#413b35"));
  burner.position.y = 2.6;
  balloon.add(burner);
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: "#ffc97e",
    emissive: "#ff9e4a",
    emissiveIntensity: 0.16,
    flatShading: true,
    roughness: 0.9,
    transparent: true,
    opacity: 0.3
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.76, 5), flameMaterial);
  flame.position.y = 2.87;
  balloon.add(flame);
  const burnerLight = new THREE.PointLight("#ffb066", 0.12, 17, 1.8);
  burnerLight.position.y = 3.02;
  balloon.add(burnerLight);
  balloon.userData.idleStation = idleStation;
  balloon.userData.flame = flame;
  balloon.userData.flameMaterial = flameMaterial;
  balloon.userData.burnerLight = burnerLight;
  balloon.userData.riding = false;
  world.add(balloon);
  return balloon;
}

function createSeaBirds(world: THREE.Group): GullFlock[] {
  const wingGeometryLeft = new THREE.BoxGeometry(1.05, 0.05, 0.32);
  wingGeometryLeft.translate(0.52, 0, 0);
  const wingGeometryRight = new THREE.BoxGeometry(1.05, 0.05, 0.32);
  wingGeometryRight.translate(-0.52, 0, 0);
  const wingMaterial = matte("#f7f4ec");
  const bodyMaterial = matte("#ede8da");
  const flocks: GullFlock[] = [];
  const makeFlock = (x: number, y: number, z: number, radius: number, count: number, speed: number) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const members: GullMember[] = [];
    for (let index = 0; index < count; index += 1) {
      const bird = new THREE.Group();
      const leftWing = new THREE.Mesh(wingGeometryLeft, wingMaterial);
      const rightWing = new THREE.Mesh(wingGeometryRight, wingMaterial);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.6), bodyMaterial);
      body.position.y = -0.02;
      bird.add(leftWing, rightWing, body);
      bird.scale.setScalar(0.5);
      group.add(bird);
      members.push({
        group: bird,
        leftWing,
        rightWing,
        phase: index * 2.3,
        offset: index * (Math.PI * 2 / count)
      });
    }
    world.add(group);
    flocks.push({ group, members, radius, speed, start: hash2(x, z) * 20 });
  };

  makeFlock(63, 18, -42, 17, 3, 0.05); // bluff/headland
  makeFlock(11, 11, -16, 12, 2, 0.065); // coast / creek mouth
  makeFlock(-27, 9, 58, 15, 3, 0.045); // pier
  return flocks;
}

function updateSeaBirds(flocks: GullFlock[], time: number): void {
  flocks.forEach((flock) => {
    flock.members.forEach((member) => {
      const angle = (time + flock.start) * flock.speed * Math.PI * 2 + member.offset;
      member.group.position.set(
        Math.cos(angle) * flock.radius,
        Math.sin(time * 0.4 + member.phase) * 1.4,
        Math.sin(angle) * flock.radius * 0.82
      );
      member.group.rotation.y = Math.atan2(-Math.sin(angle), 0.82 * Math.cos(angle));
      member.group.rotation.z = Math.sin(time * 1.7 + member.phase) * 0.055;
      const flap = Math.sin(time * 4.5 + member.phase * 3) * 0.45;
      member.leftWing.rotation.z = flap;
      member.rightWing.rotation.z = -flap;
    });
  });
}

function createDistantIslands(world: THREE.Group): void {
  const islands = [
    [-94, -106, 3.8, 0.58], [-55, -58, 2.6, 0.5], [-112, 6, 4.8, 0.7],
    [-112, 78, 3.3, 0.56], [-66, 126, 2.7, 0.5], [-142, 106, 5.2, 0.66]
  ] as const;
  for (const [x, z, scale, height] of islands) {
    const island = new THREE.Group();
    island.position.set(x, WATER_Y, z);
    // A wide, low faceted base visibly breaks the water surface before the
    // meadow begins, so these read as islands rather than floating crowns.
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), matte("#71685b"));
    base.scale.set(7.3 * scale, 2.65 * height, 5.6 * scale);
    base.position.y = 1.45 * height;
    island.add(base);
    const sandCap = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), matte("#b59a71"));
    sandCap.scale.set(5.95 * scale, 0.76 * height, 4.45 * scale);
    sandCap.position.y = 3.3 * height;
    island.add(sandCap);
    const meadow = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), matte("#4f6e4c"));
    meadow.scale.set(4.75 * scale, 0.68 * height, 3.65 * scale);
    meadow.position.y = 3.82 * height;
    island.add(meadow);
    const treeCount = Math.max(2, Math.floor(scale * 2));
    for (let index = 0; index < treeCount; index += 1) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 6), matte(index % 2 ? "#3f6548" : "#547b50"));
      tree.position.set((index - (treeCount - 1) / 2) * 1.45, 4.55 * height, Math.sin(index * 2.1) * 1.8);
      island.add(tree);
    }
    world.add(island);
  }
}

function createShoreline(world: THREE.Group): void {
  const wetMaterial = new THREE.MeshStandardMaterial({
    color: "#9db9a8",
    transparent: true,
    opacity: 0.3,
    roughness: 0.9,
    depthWrite: false
  });
  const points = Array.from({ length: 100 }, (_, index) => {
    const z = -136 + index * 2.18;
    return new THREE.Vector3(coastalShoreX(z) - 0.9, -0.06, z);
  });
  const wetPoints = points.map((point) => point.clone().add(new THREE.Vector3(1.45, 0.01, 0)));
  const wetLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wetPoints), 260, 0.62, 8, false), wetMaterial);
  wetLine.scale.y = 0.08;
  world.add(wetLine);

  for (let index = 0; index < 22; index += 1) {
    const z = -126 + index * 9.2;
    const x = coastalShoreX(z) + 3.2 + (index % 3) * 0.9;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (index % 4) * 0.12, 0), matte(index % 2 ? "#8d8272" : "#a39782"));
    rock.position.set(x, coastalTerrainHeight(x, z) + 0.18, z);
    rock.scale.y = 0.62;
    world.add(rock);
  }
}

function createHeadlandDetails(world: THREE.Group): void {
  const flowerColors = ["#f09a91", "#f3cc70", "#eee4cf", "#89b7ac"];
  const stemGeometry = new THREE.CylinderGeometry(0.025, 0.035, 0.34, 5);
  const bloomGeometry = new THREE.DodecahedronGeometry(0.1, 0);
  const stemMaterial = matte("#527451");
  const bloomMaterials = flowerColors.map((color) => matte(color));
  for (let index = 0; index < 90; index += 1) {
    const z = -124 + (index * 13.73) % 190;
    const x = coastalShoreX(z) + 8 + (index * 23.17) % 75;
    if (COASTAL_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position[0], z - landmark.position[2]) < 5.8)) continue;
    const ground = coastalTerrainHeight(x, z);
    if (ground <= 0.4 || x - coastalShoreX(z) < 6) continue;
    const flower = new THREE.Group();
    flower.position.set(x, ground, z);
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.17;
    flower.add(stem);
    const bloom = new THREE.Mesh(bloomGeometry, bloomMaterials[index % bloomMaterials.length]);
    bloom.position.y = 0.38;
    bloom.scale.setScalar(0.82 + (index % 3) * 0.16);
    flower.add(bloom);
    world.add(flower);
  }

  const overlooks = [[73, -46, 0.28], [70, 22, -0.2], [62, 51, 0.5]] as const;
  overlooks.forEach(([x, z, rotation], index) => {
    const group = new THREE.Group();
    group.position.set(x, coastalTerrainHeight(x, z), z);
    group.rotation.y = rotation;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.62), matte(index === 1 ? "#a66f4d" : "#896044"));
    seat.position.y = 0.85;
    group.add(seat);
    for (const legX of [-1.1, 1.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.42), matte("#4d4740"));
      leg.position.set(legX, 0.42, 0);
      group.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.85, 0.18), matte(index === 1 ? "#a66f4d" : "#896044"));
    back.position.set(0, 1.35, 0.22);
    back.rotation.x = -0.1;
    group.add(back);
    addSoftShadow(group, 0.4, 0.35, 3.8, 1.4, rotation, 0.12);
    world.add(group);
  });
}

function createHundredLanternWalk(world: THREE.Group): void {
  const group = new THREE.Group();
  group.name = "the-100-lantern-walk";
  world.add(group);

  const postGeometry = new THREE.CylinderGeometry(0.055, 0.075, 1.08, 7);
  const bulbGeometry = new THREE.DodecahedronGeometry(0.145, 0);
  const posts = new THREE.InstancedMesh(postGeometry, matte("#5e5144"), 100);
  const lit = new THREE.InstancedMesh(
    bulbGeometry,
    new THREE.MeshStandardMaterial({ color: "#ffd674", emissive: "#f0a83f", emissiveIntensity: 1.35, roughness: 0.78 }),
    19
  );
  const waiting = new THREE.InstancedMesh(bulbGeometry, matte("#786f60"), 81);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < 100; index += 1) {
    const z = -141 + index * 2.08;
    const x = 91 + Math.sin(index * 0.21) * 5.5 + Math.sin(z * 0.032) * 4;
    const ground = coastalTerrainHeight(x, z);
    position.set(x, ground + 0.54, z);
    matrix.compose(position, quaternion, scale);
    posts.setMatrixAt(index, matrix);
    position.y = ground + 1.18;
    matrix.compose(position, quaternion, scale);
    if (index < 19) lit.setMatrixAt(index, matrix);
    else waiting.setMatrixAt(index - 19, matrix);

    if (index === 0 || index === 9 || index === 18) {
      const glow = new THREE.PointLight("#ffc95f", 0.48, 9, 2);
      glow.position.copy(position);
      group.add(glow);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  lit.instanceMatrix.needsUpdate = true;
  waiting.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  lit.castShadow = false;
  waiting.castShadow = false;
  group.add(posts, lit, waiting);

  const startZ = -141;
  const startX = 91 + Math.sin(startZ * 0.032) * 4;
  const sign = new THREE.Group();
  sign.position.set(startX - 4.8, coastalTerrainHeight(startX - 4.8, startZ + 2), startZ + 2);
  createJournalSign(sign, "19 SHIPPED · 81 AHEAD", 0, 0, 0.28, "#f3bd52", 0.9);
  group.add(sign);
}

function createTourRoute(world: THREE.Group): {
  set(from: THREE.Vector3, target: THREE.Vector3 | null): void;
  update(time: number): void;
} {
  const group = new THREE.Group();
  group.name = "coastal-guided-route";
  world.add(group);
  const material = new THREE.MeshBasicMaterial({
    color: "#ffd46b",
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    toneMapped: false
  });
  const dots = Array.from({ length: 12 }, (_, index) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09 + index * 0.004, 10, 8), material.clone());
    dot.position.y = 1.02;
    dot.visible = false;
    dot.userData.routeIndex = index;
    dot.userData.softShadow = true;
    group.add(dot);
    return dot;
  });

  return {
    set(from, target) {
      group.visible = Boolean(target);
      if (!target) return;
      dots.forEach((dot, index) => {
        const progress = (index + 1) / (dots.length + 1);
        dot.position.lerpVectors(from, target, progress);
        dot.position.y = 1.08;
        dot.visible = true;
      });
    },
    update(time) {
      if (!group.visible) return;
      dots.forEach((dot, index) => {
        const pulse = 0.78 + Math.max(0, Math.sin(time * 2.4 - index * 0.48)) * 0.7;
        dot.scale.setScalar(pulse);
        if (dot.material instanceof THREE.MeshBasicMaterial) {
          dot.material.opacity = 0.28 + Math.max(0, Math.sin(time * 2.4 - index * 0.48)) * 0.66;
        }
      });
    }
  };
}

function createCelestial(world: THREE.Group): { setNight(active: boolean): void } {
  const group = new THREE.Group();
  group.name = "coastal-night-sky";
  group.visible = false;
  world.add(group);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 18),
    new THREE.MeshStandardMaterial({ color: "#fff3cf", emissive: "#dce9ff", emissiveIntensity: 1.25, roughness: 0.9 })
  );
  moon.position.set(-155, 145, -220);
  moon.userData.softShadow = true;
  group.add(moon);
  const glow = new THREE.PointLight("#c9dcff", 1.8, 70, 2);
  glow.position.copy(moon.position);
  group.add(glow);

  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(270 * 3);
  for (let index = 0; index < 270; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const elevation = 0.18 + Math.random() * 0.82;
    const radius = 480;
    positions[index * 3] = Math.cos(angle) * radius * Math.cos(elevation);
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(angle) * radius * Math.cos(elevation);
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: "#fff1cf", size: 0.72, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false })
  );
  group.add(stars);
  return { setNight(active) { group.visible = active; } };
}

function createSeasonalLayer(world: THREE.Group, swayUniforms: SwayTimeUniform[]): {
  setSeason(season: CoastalEnvironmentState["season"]): void;
  update(time: number): void;
} {
  const layer = new THREE.Group();
  layer.name = "coastal-seasonal-scenery";
  world.add(layer);
  const groups = {
    spring: new THREE.Group(),
    summer: new THREE.Group(),
    autumn: new THREE.Group(),
    winter: new THREE.Group()
  };
  Object.entries(groups).forEach(([name, group]) => {
    group.name = `coastal-season:${name}`;
    layer.add(group);
  });

  const flowerColors = ["#f19ab1", "#f6cf66", "#efe6df", "#8c87cd"];
  for (let index = 0; index < 150; index += 1) {
    const z = -122 + (index * 19.7) % 188;
    const x = coastalShoreX(z) + 8 + (index * 13.3) % 63;
    const flower = new THREE.Group();
    flower.position.set(x, coastalTerrainHeight(x, z) + 0.05, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.32, 6), matte("#4c7952"));
    stem.position.y = 0.16;
    flower.add(stem);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matte(flowerColors[index % flowerColors.length]));
    bloom.position.y = 0.36;
    flower.add(bloom);
    groups.spring.add(flower);
  }

  const grassMaterials = [
    matSway("#6e9c65", 0.12, 1.2, swayUniforms),
    matSway("#88b875", 0.1, 1.06, swayUniforms)
  ];
  for (let index = 0; index < 82; index += 1) {
    const z = -122 + (index * 23.9) % 188;
    const x = coastalShoreX(z) + 11 + (index * 17.1) % 61;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.75, 5), grassMaterials[index % grassMaterials.length]);
    tuft.position.set(x, coastalTerrainHeight(x, z) + 0.4, z);
    groups.summer.add(tuft);
  }

  const autumnLeaves: THREE.Mesh[] = [];
  for (let index = 0; index < 220; index += 1) {
    const z = -125 + (index * 11.9) % 194;
    const x = coastalShoreX(z) + 9 + (index * 7.7) % 66;
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.12 + index % 3 * 0.035, 7), matte(index % 3 === 0 ? "#d66d43" : index % 3 === 1 ? "#e4a34f" : "#9f6d3f"));
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = index * 1.72;
    leaf.position.set(x, coastalTerrainHeight(x, z) + 0.06, z);
    leaf.userData.baseY = leaf.position.y;
    groups.autumn.add(leaf);
    autumnLeaves.push(leaf);
  }

  for (let index = 0; index < 74; index += 1) {
    const z = -122 + (index * 17.2) % 188;
    const x = coastalShoreX(z) + 7 + (index * 21.3) % 65;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.75 + index % 4 * 0.24, 16),
      new THREE.MeshStandardMaterial({ color: "#f1f3ea", roughness: 0.98, transparent: true, opacity: 0.82 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, coastalTerrainHeight(x, z) + 0.07, z);
    groups.winter.add(patch);
  }
  const snowman = new THREE.Group();
  snowman.position.set(25, coastalTerrainHeight(25, -72), -72);
  for (const [radius, y] of [[0.7, 0.7], [0.52, 1.62], [0.36, 2.28]] as const) {
    const snow = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), matte("#f8f5ec"));
    snow.position.y = y;
    snowman.add(snow);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.44, 8), matte("#dc7a3d"));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 2.28, -0.38);
  snowman.add(nose);
  groups.winter.add(snowman);

  return {
    setSeason(season) {
      Object.entries(groups).forEach(([name, group]) => {
        group.visible = name === season;
      });
    },
    update(time) {
      autumnLeaves.forEach((leaf, index) => {
        leaf.position.y = leaf.userData.baseY + Math.sin(time * 0.8 + index) * 0.012;
      });
    }
  };
}

function createWeatherLayer(world: THREE.Group): {
  setWeather(weather: CoastalEnvironmentState["weather"]): void;
  update(time: number, delta: number): void;
} {
  const count = 3200;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = -24 + Math.random() * 132;
    positions[index * 3 + 1] = Math.random() * 38 + 1;
    positions[index * 3 + 2] = -135 + Math.random() * 218;
    seeds[index] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rainMaterial = new THREE.PointsMaterial({
    color: "#c8e3eb",
    size: 0.075,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const rain = new THREE.Points(geometry, rainMaterial);
  rain.visible = false;
  rain.frustumCulled = false;
  world.add(rain);

  const flashMaterial = new THREE.MeshBasicMaterial({ color: "#e9f1ff", transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide, toneMapped: false });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), flashMaterial);
  flash.position.y = 6;
  flash.userData.softShadow = true;
  world.add(flash);
  let weather: CoastalEnvironmentState["weather"] = "clear";
  let flashEnergy = 0;
  let nextFlash = 2.2;

  return {
    setWeather(next) {
      weather = next;
      rain.visible = next !== "clear";
      rainMaterial.opacity = next === "storm" ? 0.88 : 0.58;
      rainMaterial.size = next === "storm" ? 0.095 : 0.065;
    },
    update(time, delta) {
      if (rain.visible) {
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < count; index += 1) {
          const y = position.getY(index) - delta * (weather === "storm" ? 24 : 14) * (0.75 + seeds[index] * 0.6);
          position.setY(index, y < 0.8 ? 19 + seeds[index] * 4 : y);
          position.setX(index, position.getX(index) + delta * (weather === "storm" ? 2.8 : 0.9));
          if (position.getX(index) > 108) position.setX(index, -24);
        }
        position.needsUpdate = true;
      }
      if (weather === "storm" && time > nextFlash) {
        flashEnergy = 0.95;
        nextFlash = time + 2.8 + Math.random() * 5;
      }
      flashEnergy = THREE.MathUtils.damp(flashEnergy, 0, 7, delta);
      flashMaterial.opacity = flashEnergy;
    }
  };
}
